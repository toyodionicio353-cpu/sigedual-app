"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  getDocs, Timestamp, arrayUnion, deleteDoc,
} from "firebase/firestore";
import { ref as sRef, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import QRCode from "qrcode";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
interface PrivacidadConfig {
  mostrarEstadoEnLinea: boolean;
  mostrarUltimaConexion: boolean;
  encontrablePorCodigo: boolean;
  permitirMensajesDesconocidos: boolean;
  mostrarFotoATodos: boolean;
  mostrarDescripcionATodos: boolean;
}
const PRIVACIDAD_DEFAULT: PrivacidadConfig = {
  mostrarEstadoEnLinea: true, mostrarUltimaConexion: true,
  encontrablePorCodigo: true, permitirMensajesDesconocidos: false,
  mostrarFotoATodos: true, mostrarDescripcionATodos: true,
};
interface PerfilCom {
  uid: string; codigoSGD: string; nombreVisible: string; descripcion: string;
  fotoURL: string; institucion: string; cargo: string; email: string;
  liceoId: string; creadoEn: Timestamp | null; ultimaConexion: Timestamp | null;
  estado: "online" | "ausente" | "offline";
  privacidad?: PrivacidadConfig;
  bloqueados?: string[];
}
interface ConvInfo { nombre: string; fotoURL: string; codigoSGD: string; cargo: string; institucion: string; estado: string; }
const EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 horas en ms

interface Conversacion {
  id: string; tipo: "directa" | "grupo"; participantes: string[];
  participantesInfo: Record<string, ConvInfo>;
  ultimoMensaje: { texto: string; senderId: string; timestamp: Timestamp | null; tipo: string } | null;
  noLeidos: Record<string, number>; creadoEn: Timestamp | null; actualizadoEn: Timestamp | null;
  primerMensajeEn: Timestamp | null;
  cicloId?: string;
}
interface Mensaje {
  id: string; senderId: string; texto: string; timestamp: Timestamp | null;
  tipo: "texto" | "imagen" | "archivo" | "sigedual-doc";
  archivoURL?: string; archivoNombre?: string; archivoTipo?: string; archivoTamano?: number;
  estado: "enviando" | "enviado" | "leido"; leidoPor: Record<string, boolean>;
  eliminado?: boolean;
  eliminadoPara?: string[];
  editado?: boolean;
  editadoEn?: Timestamp | null;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function generarCodigoSGD(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => chars[b % chars.length]).join("");
  return `SGD-${r(4)}-${r(4)}`;
}
function fmtHora(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function fmtRelativa(ts: Timestamp | null): string {
  if (!ts) return "";
  const d = ts.toDate(), now = new Date(), diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Ayer";
  if (days < 7) return d.toLocaleDateString("es-CL", { weekday: "short" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}
function fmtTamano(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtFechaLarga(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function iniciales(n: string) { return n.split(" ").slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase() || "?"; }
function colorNombre(n: string) {
  const cs = ["#1fb2a6","#3b82f6","#a78bfa","#f59e0b","#ef4444","#34d399","#f472b6","#818cf8"];
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return cs[Math.abs(h) % cs.length];
}
function iconArchivo(tipo?: string) {
  if (!tipo) return "fa-file";
  if (tipo.includes("pdf")) return "fa-file-pdf";
  if (tipo.includes("word") || tipo.includes("doc")) return "fa-file-word";
  if (tipo.includes("excel") || tipo.includes("sheet") || tipo.includes("xls")) return "fa-file-excel";
  if (tipo.includes("powerpoint") || tipo.includes("ppt")) return "fa-file-powerpoint";
  if (tipo.includes("zip") || tipo.includes("rar") || tipo.includes("7z")) return "fa-file-zipper";
  if (tipo.includes("image")) return "fa-file-image";
  return "fa-file";
}
const EMOJIS = ["😊","😂","👍","❤️","🙏","😅","🔥","✅","👏","💪","😍","🎉","💯","🤔","😢","😮","🙌","✨","🚀","💡","👀","🥳","😎","🤝","⭐","📌","📎","🔑","💼","📋"];

// ─────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────
function Avatar({ nombre, fotoURL, size = 38, estado }: { nombre: string; fotoURL?: string; size?: number; estado?: string }) {
  const color = colorNombre(nombre);
  const ec = estado === "online" ? "#22c55e" : estado === "ausente" ? "#f59e0b" : "#6b7280";
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      {fotoURL ? (
        <img src={fotoURL} alt={nombre} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.36 }}>
          {iniciales(nombre)}
        </div>
      )}
      {estado && <span style={{ position: "absolute", bottom: 1, right: 1, width: size * 0.3, height: size * 0.3, borderRadius: "50%", background: ec, border: "2px solid #111827" }} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SWITCH TOGGLE
// ─────────────────────────────────────────────────────────────
function Switch({ value, onChange, loading, disabled }: { value: boolean; onChange: (v: boolean) => void; loading?: boolean; disabled?: boolean }) {
  const blocked = loading || disabled;
  return (
    <div onClick={() => !blocked && onChange(!value)}
      style={{ width: 40, height: 22, borderRadius: 11, background: loading ? "#1f2937" : value ? "#1fb2a6" : "#1f2937", position: "relative", cursor: blocked ? "not-allowed" : "pointer", transition: "background 0.2s", flexShrink: 0, opacity: disabled && !loading ? 0.4 : 1 }}>
      <div style={{ position: "absolute", top: 3, left: value && !loading ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {loading && <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 8, color: "#6b7280" }} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
function Toast({ msg, visible, tipo = "ok" }: { msg: string; visible: boolean; tipo?: "ok" | "error" }) {
  const bg = tipo === "error" ? "#ef4444" : "#1fb2a6";
  const shadow = tipo === "error" ? "rgba(239,68,68,0.4)" : "rgba(31,178,166,0.4)";
  const icon = tipo === "error" ? "fa-circle-exclamation" : "fa-check";
  return (
    <div style={{ position: "absolute", bottom: 70, left: "50%", transform: `translateX(-50%) translateY(${visible ? 0 : 12}px)`, opacity: visible ? 1 : 0, transition: "all 0.25s", background: bg, color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", zIndex: 50, boxShadow: `0 4px 16px ${shadow}`, pointerEvents: "none" }}>
      <i className={`fa-solid ${icon}`} style={{ marginRight: 7 }} />{msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────
function Onboarding({ uid, email, nombre, liceoId, onDone }: {
  uid: string; email: string; nombre: string; liceoId: string; onDone: (p: PerfilCom) => void;
}) {
  const [nombreVisible, setNombreVisible] = useState(nombre);
  const [descripcion, setDescripcion] = useState("");
  const [fotoURL, setFotoURL] = useState("");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const codigo = useRef(generarCodigoSGD());
  const fotoInput = useRef<HTMLInputElement>(null);

  async function subirFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const r = sRef(storage, `perfiles/${uid}/${file.name}`);
      await new Promise<void>((res, rej) => {
        const up = uploadBytesResumable(r, file);
        up.on("state_changed", null, rej, async () => { setFotoURL(await getDownloadURL(r)); res(); });
      });
    } finally { setSubiendoFoto(false); }
  }

  async function guardar() {
    if (!nombreVisible.trim()) return;
    setGuardando(true);
    const perfil: PerfilCom = {
      uid, codigoSGD: codigo.current, nombreVisible: nombreVisible.trim(),
      descripcion: descripcion.slice(0, 120), fotoURL, institucion: liceoId,
      cargo: "", email, liceoId, creadoEn: null, ultimaConexion: null, estado: "online",
      privacidad: PRIVACIDAD_DEFAULT, bloqueados: [],
    };
    await setDoc(doc(db, "perfilesComunicacion", uid), {
      ...perfil, creadoEn: serverTimestamp(), ultimaConexion: serverTimestamp(),
    });
    setGuardando(false);
    onDone(perfil);
  }

  const INP: React.CSSProperties = { width: "100%", background: "#0d1829", border: "1px solid #1f2937", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const LBL: React.CSSProperties = { color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 4, display: "block", letterSpacing: "0.5px" };

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1a", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "24px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="fa-solid fa-comments" style={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 800, margin: "0 0 2px" }}>Bienvenido a Comunicaciones</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Configura tu perfil antes de comenzar.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, padding: "12px 14px", background: "#0d1829", borderRadius: 10, border: "1px solid #1f2937" }}>
          <div style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} onClick={() => fotoInput.current?.click()}>
            <Avatar nombre={nombreVisible || "U"} fotoURL={fotoURL || undefined} size={52} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0d1829" }}>
              {subiendoFoto ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 8, color: "#fff" }} /> : <i className="fa-solid fa-camera" style={{ fontSize: 8, color: "#fff" }} />}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ ...LBL, marginBottom: 3 }}>NOMBRE VISIBLE *</label>
            <input style={INP} value={nombreVisible} onChange={e => setNombreVisible(e.target.value)} placeholder="¿Cómo te llamas?" maxLength={60} />
          </div>
          <input ref={fotoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && subirFoto(e.target.files[0])} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={LBL}>DESCRIPCIÓN <span style={{ color: "#374151", fontWeight: 400 }}>(opcional)</span></label>
            <textarea style={{ ...INP, resize: "none", height: 56 }} value={descripcion} onChange={e => setDescripcion(e.target.value.slice(0, 120))} placeholder="Ej: Coordinador de prácticas, Empresa ABC..." />
            <p style={{ color: "#374151", fontSize: 10, textAlign: "right", marginTop: 2 }}>{descripcion.length}/120</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LBL}>INSTITUCIÓN</label>
              <input style={{ ...INP, color: "#4b5563", cursor: "not-allowed" }} value={liceoId} readOnly />
            </div>
            <div>
              <label style={LBL}>CÓDIGO SIGEDUAL</label>
              <input style={{ ...INP, color: "#1fb2a6", letterSpacing: "1px", cursor: "not-allowed", fontSize: 11 }} value={codigo.current} readOnly />
            </div>
          </div>
        </div>
        <button onClick={guardar} disabled={!nombreVisible.trim() || guardando}
          style={{ width: "100%", marginTop: 16, padding: "11px 0", background: !nombreVisible.trim() ? "#1f2937" : "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: !nombreVisible.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1, transition: "opacity 0.15s" }}>
          {guardando ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Guardando...</> : <><i className="fa-solid fa-check" style={{ marginRight: 8 }} />Guardar perfil</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL QR
// ─────────────────────────────────────────────────────────────
function QRModal({ perfil, onClose }: { perfil: PerfilCom; onClose: () => void }) {
  const [qrSrc, setQrSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(perfil.codigoSGD, { width: 220, margin: 2, color: { dark: "#0f2835", light: "#f0fafa" } })
      .then(setQrSrc).catch(() => {});
  }, [perfil.codigoSGD]);

  function descargar() {
    if (!qrSrc) return;
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = `SIGEDUAL-QR-${perfil.codigoSGD}.png`;
    a.click();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: 32, textAlign: "center", maxWidth: 320, width: "90%", boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700, margin: 0 }}>Mi código QR</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div style={{ background: "#f0fafa", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 16 }}>
          {qrSrc ? <img src={qrSrc} alt="QR" style={{ width: 180, height: 180, display: "block" }} /> : (
            <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: "#0f2835" }} />
            </div>
          )}
        </div>
        <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{perfil.nombreVisible}</p>
        <p style={{ color: "#1fb2a6", fontSize: 13, fontFamily: "monospace", letterSpacing: "1.5px", margin: "0 0 20px" }}>{perfil.codigoSGD}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={descargar} disabled={!qrSrc}
            style={{ flex: 1, padding: "10px 0", background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: qrSrc ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            <i className="fa-solid fa-download" style={{ marginRight: 7 }} />Descargar
          </button>
          <button onClick={() => { if (navigator.share) navigator.share({ title: `SIGEDUAL - ${perfil.nombreVisible}`, text: `Mi código SIGEDUAL: ${perfil.codigoSGD}` }).catch(() => {}); }}
            style={{ padding: "10px 16px", background: "#1f2937", border: "none", borderRadius: 10, color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-share-nodes" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL EDITAR PERFIL
// ─────────────────────────────────────────────────────────────
async function comprimirImagen(file: File, maxDim = 800, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

function EditarPerfilModal({ perfil, onGuardar, onClose }: {
  perfil: PerfilCom; onGuardar: (p: Partial<PerfilCom>) => Promise<void>; onClose: () => void;
}) {
  const [nombre, setNombre]     = useState(perfil.nombreVisible);
  const [desc, setDesc]         = useState(perfil.descripcion);
  const [foto, setFoto]         = useState(perfil.fotoURL);
  const [preview, setPreview]   = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);

  const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_MB   = 5;

  async function seleccionarFoto(file: File) {
    setErrorFoto("");

    if (!TIPOS_OK.includes(file.type)) {
      setErrorFoto("Solo se permiten imágenes JPG, PNG, WebP o GIF.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorFoto(`La imagen no puede superar los ${MAX_MB} MB.`);
      return;
    }

    setPreview(URL.createObjectURL(file));
    setSubiendo(true);
    setProgreso(10);

    try {
      // Comprimir a tamaño pequeño — cabe sin problema en Firestore (límite 1 MB por doc)
      const blob = await comprimirImagen(file, 500, 0.72).catch(() => file as Blob);
      setProgreso(50);

      // Convertir a base64 para guardar en Firestore sin depender de Firebase Storage
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      setProgreso(80);

      if (base64.length > 700_000) {
        setErrorFoto("Imagen demasiado grande después de comprimir. Elige una más pequeña.");
        setPreview(null);
        return;
      }

      setFoto(base64);
      setPreview(null);
      setProgreso(100);
    } catch {
      setErrorFoto("No se pudo cargar la imagen. Intenta nuevamente.");
      setPreview(null);
    } finally {
      setSubiendo(false);
      if (fotoRef.current) fotoRef.current.value = "";
    }
  }

  async function guardar() {
    if (!nombre.trim() || subiendo) return;
    setGuardando(true);
    try {
      await onGuardar({ nombreVisible: nombre.trim(), descripcion: desc.slice(0, 120), fotoURL: foto });
      onClose();
    } catch {
      // no bloquear
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarFoto() {
    if (foto && foto.includes("firebasestorage.googleapis.com")) {
      try { await deleteObject(sRef(storage, foto)); } catch {}
    }
    setFoto("");
    setPreview(null);
    setErrorFoto("");
  }

  const INP: React.CSSProperties = {
    width: "100%", background: "#0d1829", border: "1px solid #1f2937",
    borderRadius: 9, padding: "9px 13px", color: "#f1f5f9", fontSize: 13,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const fotoMostrada = preview || foto || undefined;
  const bloqueado    = subiendo || guardando;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}
    >
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 18, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700, margin: 0 }}>
            <i className="fa-solid fa-pen" style={{ marginRight: 9, color: "#1fb2a6" }} />Editar perfil
          </h3>
          <button onClick={() => !bloqueado && onClose()} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: bloqueado ? "not-allowed" : "pointer", fontSize: 18 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Foto */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            {/* Avatar con posible vista previa local */}
            <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: "3px solid #1f2937", position: "relative" }}>
              {fotoMostrada ? (
                <img src={fotoMostrada} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <Avatar nombre={nombre || "?"} size={80} />
              )}
              {/* Overlay de carga */}
              {subiendo && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: "#fff", fontSize: 16 }} />
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{progreso}%</span>
                </div>
              )}
            </div>
            {/* Botón cámara */}
            {!subiendo && (
              <button
                onClick={() => fotoRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "#3b82f6", border: "2px solid #111827", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <i className="fa-solid fa-camera" style={{ fontSize: 11, color: "#fff" }} />
              </button>
            )}
          </div>

          {/* Barra de progreso */}
          {subiendo && (
            <div style={{ margin: "10px auto 0", maxWidth: 200, height: 4, background: "#1f2937", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progreso}%`, background: "linear-gradient(90deg,#1fb2a6,#3b82f6)", borderRadius: 2, transition: "width 0.2s" }} />
            </div>
          )}

          {/* Input oculto */}
          <input
            ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) seleccionarFoto(f); }}
          />

          {/* Botones */}
          {!subiendo && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <button onClick={() => fotoRef.current?.click()}
                style={{ background: "#1f2937", border: "none", borderRadius: 8, padding: "5px 13px", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <i className="fa-solid fa-upload" style={{ marginRight: 5, fontSize: 11 }} />Cambiar foto
              </button>
              {(foto || preview) && (
                <button onClick={eliminarFoto}
                  style={{ background: "transparent", border: "1px solid #374151", borderRadius: 8, padding: "5px 13px", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  <i className="fa-solid fa-trash" style={{ marginRight: 5, fontSize: 11 }} />Eliminar
                </button>
              )}
            </div>
          )}

          {/* Error foto */}
          {errorFoto && (
            <div style={{ marginTop: 8, padding: "7px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: "#ef4444", fontSize: 12 }} />
              <span style={{ color: "#f87171", fontSize: 12 }}>{errorFoto}</span>
            </div>
          )}

          <p style={{ color: "#374151", fontSize: 10, marginTop: 6 }}>JPG, PNG, WebP o GIF · máx. {MAX_MB} MB</p>
        </div>

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5, letterSpacing: "0.5px" }}>NOMBRE VISIBLE *</label>
            <input style={INP} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre visible" maxLength={60} />
          </div>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5, letterSpacing: "0.5px" }}>
              DESCRIPCIÓN <span style={{ color: "#374151", fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea style={{ ...INP, resize: "none", height: 64 }} value={desc} onChange={e => setDesc(e.target.value.slice(0, 120))} placeholder="Ej: Coordinador de prácticas..." />
            <p style={{ color: "#374151", fontSize: 10, textAlign: "right", marginTop: 2 }}>{desc.length}/120</p>
          </div>
        </div>

        {/* Botones footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => !bloqueado && onClose()} disabled={bloqueado}
            style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #1f2937", borderRadius: 10, color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: bloqueado ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!nombre.trim() || bloqueado}
            style={{ flex: 2, padding: "10px 0", background: (!nombre.trim() || bloqueado) ? "#1f2937" : "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!nombre.trim() || bloqueado) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: bloqueado ? 0.7 : 1 }}>
            {subiendo
              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Subiendo foto...</>
              : guardando
                ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Guardando...</>
                : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL CENTRO DE AYUDA
// ─────────────────────────────────────────────────────────────
const SECCIONES_AYUDA = [
  {
    id: "codigo", icon: "fa-id-badge", color: "#1fb2a6", titulo: "¿Qué es el Código SIGEDUAL?",
    tags: ["código", "sgd", "identificador", "buscar"],
    contenido: (
      <div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 12px" }}>
          Cada usuario posee un código único e irrepetible que funciona como identificador dentro del sistema de comunicaciones:
        </p>
        <div style={{ background: "#0d1829", border: "1px solid #1fb2a640", borderRadius: 10, padding: "10px 16px", margin: "0 0 12px", textAlign: "center" as const }}>
          <span style={{ color: "#1fb2a6", fontSize: 18, fontFamily: "monospace", fontWeight: 700, letterSpacing: "2px" }}>SGD-8F4A-92C1</span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          Este código <strong style={{ color: "#d1d5db" }}>reemplaza el uso de números telefónicos</strong> y permite que otros usuarios encuentren tu perfil de forma rápida y segura, sin necesidad de compartir datos personales.
        </p>
      </div>
    ),
  },
  {
    id: "contacto", icon: "fa-user-plus", color: "#3b82f6", titulo: "¿Cómo agrego un contacto?",
    tags: ["contacto", "agregar", "buscar", "usuario"],
    contenido: (
      <div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 10px" }}>Existen dos formas de encontrar a otro usuario:</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {[
            { icon: "fa-id-badge", color: "#1fb2a6", label: "Por Código SIGEDUAL", desc: "Ingresa el código exacto (ej: SGD-XXXX-XXXX) en el buscador de nuevo chat." },
            { icon: "fa-user", color: "#3b82f6", label: "Por nombre visible", desc: "Escribe parte del nombre del usuario en la barra de búsqueda." },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", gap: 10, background: "#0d1829", borderRadius: 10, padding: "10px 14px" }}>
              <i className={`fa-solid ${item.icon}`} style={{ fontSize: 15, color: item.color, marginTop: 1 }} />
              <div>
                <p style={{ color: "#d1d5db", fontSize: 13, fontWeight: 600, margin: "0 0 3px" }}>{item.label}</p>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "conversacion", icon: "fa-comments", color: "#a78bfa", titulo: "¿Cómo inicio una conversación?",
    tags: ["conversación", "chat", "iniciar", "mensaje"],
    contenido: (
      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
        Presiona el botón <strong style={{ color: "#d1d5db" }}>Nuevo chat</strong> (ícono de lápiz en la barra izquierda), busca al usuario por nombre o código SIGEDUAL, y presiona <strong style={{ color: "#d1d5db" }}>Chatear</strong>. La conversación quedará guardada en tu lista de mensajes y podrás retomarlo cuando quieras.
      </p>
    ),
  },
  {
    id: "perfil", icon: "fa-pen", color: "#f59e0b", titulo: "¿Cómo cambio mi foto o nombre?",
    tags: ["foto", "nombre", "descripción", "editar", "perfil"],
    contenido: (
      <div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 10px" }}>
          Desde <strong style={{ color: "#d1d5db" }}>Mi Perfil</strong> (ícono en la parte superior de la barra de chats) puedes modificar:
        </p>
        {["Fotografía de perfil", "Nombre visible", "Descripción personal"].map(item => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <i className="fa-solid fa-check" style={{ color: "#1fb2a6", fontSize: 11 }} />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>{item}</span>
          </div>
        ))}
        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
          Los cambios se reflejan automáticamente en todas tus conversaciones.
        </p>
      </div>
    ),
  },
  {
    id: "privacidad", icon: "fa-shield-halved", color: "#34d399", titulo: "¿Quién puede encontrarme?",
    tags: ["privacidad", "encontrar", "visibilidad", "seguridad"],
    contenido: (
      <div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 10px" }}>
          Desde la sección <strong style={{ color: "#d1d5db" }}>Privacidad</strong> en Mi Perfil puedes controlar:
        </p>
        {[
          { label: "Estado en línea", desc: "Si otros ven cuando estás activo" },
          { label: "Última conexión", desc: "Si otros ven cuándo te conectaste" },
          { label: "Encontrable por código", desc: "Si otros pueden hallarte con tu código SGD" },
          { label: "Mensajes de desconocidos", desc: "Si usuarios que no son contactos pueden escribirte" },
          { label: "Visibilidad de foto y descripción", desc: "Quién puede ver tu información" },
        ].map(item => (
          <div key={item.label} style={{ marginBottom: 8, paddingLeft: 12, borderLeft: "2px solid #1f2937" }}>
            <p style={{ color: "#d1d5db", fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>{item.label}</p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{item.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "archivos", icon: "fa-paperclip", color: "#f472b6", titulo: "¿Qué archivos puedo enviar?",
    tags: ["archivos", "pdf", "imagen", "word", "excel", "enviar"],
    contenido: (
      <div>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: "0 0 12px" }}>
          El módulo de Comunicaciones soporta los siguientes formatos:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { icon: "fa-file-pdf", color: "#ef4444", label: "PDF" },
            { icon: "fa-file-word", color: "#2563eb", label: "Word (.doc, .docx)" },
            { icon: "fa-file-excel", color: "#16a34a", label: "Excel (.xls, .xlsx)" },
            { icon: "fa-file-powerpoint", color: "#f97316", label: "PowerPoint (.ppt, .pptx)" },
            { icon: "fa-image", color: "#8b5cf6", label: "Imágenes (jpg, png, gif…)" },
            { icon: "fa-file-zipper", color: "#6b7280", label: "ZIP / RAR" },
            { icon: "fa-file-lines", color: "#1fb2a6", label: "Documentos SIGEDUAL" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1829", borderRadius: 8, padding: "7px 10px" }}>
              <i className={`fa-solid ${f.icon}`} style={{ fontSize: 14, color: f.color, width: 16 }} />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "faq", icon: "fa-circle-question", color: "#6b7280", titulo: "Preguntas frecuentes (FAQ)",
    tags: ["faq", "preguntas", "código", "foto", "privacidad", "frecuentes"],
    contenido: (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
        {[
          { q: "¿Puedo cambiar mi Código SIGEDUAL?", a: "No. Es un identificador único y permanente asignado al crear tu perfil. No puede modificarse." },
          { q: "¿Qué ocurre si elimino mi fotografía?", a: "Se mostrará un avatar con tus iniciales en un color representativo de tu nombre." },
          { q: "¿Puedo conversar con cualquier usuario?", a: "Depende de la configuración de privacidad del destinatario. Si tiene restringidos los mensajes de desconocidos, no podrás iniciar la conversación." },
          { q: "¿Qué hago si no encuentro a un usuario?", a: "Verifica que el Código SIGEDUAL o el nombre visible sean correctos. También puede que el usuario tenga desactivada la opción de ser encontrable por código." },
        ].map(item => (
          <div key={item.q} style={{ background: "#0d1829", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ color: "#d1d5db", fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
              <i className="fa-solid fa-circle-question" style={{ color: "#3b82f6", fontSize: 11, marginRight: 7 }} />{item.q}
            </p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{item.a}</p>
          </div>
        ))}
      </div>
    ),
  },
];

function CentroAyudaModal({ onClose }: { onClose: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  function toggle(id: string) {
    setAbierto(s => s === id ? null : id);
  }

  const filtradas = busqueda.trim()
    ? SECCIONES_AYUDA.filter(s =>
        s.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.tags.some(t => t.includes(busqueda.toLowerCase())))
    : SECCIONES_AYUDA;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(6px)", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #1f2937", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#1fb2a6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-circle-question" style={{ fontSize: 16, color: "#fff" }} />
              </div>
              <div>
                <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, margin: 0 }}>Centro de Ayuda</h3>
                <p style={{ color: "#4b5563", fontSize: 11, margin: 0 }}>Comunicaciones · SIGEDUAL</p>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 4, borderRadius: 8, lineHeight: 1 }}
              onMouseOver={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#f1f5f9"; }}
              onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          {/* Buscador */}
          <div style={{ position: "relative" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 13 }} />
            <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en el centro de ayuda..."
              style={{ width: "100%", background: "#0d1829", border: "1px solid #1f2937", borderRadius: 10, padding: "9px 12px 9px 36px", color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            {busqueda && (
              <button onClick={() => setBusqueda("")}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Acordeón */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#1f2937 transparent", padding: "8px 0" }}>
          {filtradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 26, color: "#1f2937", display: "block", marginBottom: 10 }} />
              <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Sin resultados para "{busqueda}"</p>
            </div>
          ) : filtradas.map(sec => {
            const estaAbierto = abierto === sec.id;
            return (
              <div key={sec.id} style={{ borderBottom: "1px solid #1a2338" }}>
                <button onClick={() => toggle(sec.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", background: estaAbierto ? "#0d1829" : "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 0.15s" }}
                  onMouseOver={e => { if (!estaAbierto) e.currentTarget.style.background = "#111827"; }}
                  onMouseOut={e => { if (!estaAbierto) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${sec.color}18`, border: `1px solid ${sec.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={`fa-solid ${sec.icon}`} style={{ fontSize: 13, color: sec.color }} />
                  </div>
                  <span style={{ flex: 1, color: "#d1d5db", fontSize: 14, fontWeight: 600 }}>{sec.titulo}</span>
                  <i className={`fa-solid ${estaAbierto ? "fa-chevron-up" : "fa-chevron-down"}`} style={{ fontSize: 12, color: "#374151" }} />
                </button>
                {estaAbierto && (
                  <div style={{ padding: "4px 22px 18px", background: "#0d1829" }}>
                    {sec.contenido}
                  </div>
                )}
              </div>
            );
          })}

          {/* Soporte SIGEDUAL */}
          <div style={{ margin: "8px 16px 16px", background: "linear-gradient(135deg,#1fb2a610,#3b82f610)", border: "1px solid #1fb2a630", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <i className="fa-solid fa-headset" style={{ fontSize: 18, color: "#1fb2a6" }} />
              <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>Soporte SIGEDUAL</span>
            </div>
            <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.7, margin: "0 0 14px" }}>
              Si presentas problemas con el módulo de Comunicaciones o detectas un comportamiento inesperado, comunícate con el administrador de tu institución o con el soporte técnico de SIGEDUAL.
            </p>
            <button disabled
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#1f2937", border: "1px solid #374151", borderRadius: 10, color: "#4b5563", fontSize: 13, fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" }}>
              <i className="fa-solid fa-ticket" style={{ fontSize: 13 }} />
              Abrir ticket de soporte
              <span style={{ marginLeft: 4, background: "#111827", borderRadius: 6, padding: "2px 7px", fontSize: 10, color: "#374151" }}>Próximamente</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PANEL MI PERFIL (reemplaza contenido de la barra izquierda)
// ─────────────────────────────────────────────────────────────
function MiPerfilPanel({ perfil, onClose, onActualizar, onShowQR, onEditar, onToast, onEstadoChange }: {
  perfil: PerfilCom; onClose: () => void;
  onActualizar: (p: Partial<PerfilCom>) => Promise<void>;
  onShowQR: () => void; onEditar: () => void;
  onToast: (msg: string) => void;
  onEstadoChange?: (estado: "online" | "offline") => void;
}) {
  const priv = perfil.privacidad ?? PRIVACIDAD_DEFAULT;
  const [privacidad, setPrivacidad] = useState<PrivacidadConfig>(priv);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [showAyuda, setShowAyuda] = useState(false);
  const [toastPrivMsg, setToastPrivMsg] = useState("");
  const [toastPrivVis, setToastPrivVis] = useState(false);
  const [toastPrivTipo, setToastPrivTipo] = useState<"ok"|"error">("ok");

  function mostrarToastPriv(msg: string, tipo: "ok"|"error" = "ok") {
    setToastPrivMsg(msg); setToastPrivTipo(tipo); setToastPrivVis(true);
    setTimeout(() => setToastPrivVis(false), 2800);
  }

  async function actualizarPrivacidad(key: keyof PrivacidadConfig, val: boolean) {
    const previo = privacidad;
    const nuevo = { ...privacidad, [key]: val };
    setPrivacidad(nuevo);
    setLoadingKey(key);
    try {
      const extras: Record<string, unknown> = { privacidad: nuevo };
      if (key === "mostrarEstadoEnLinea") extras.estado = val ? "online" : "offline";
      await updateDoc(doc(db, "perfilesComunicacion", perfil.uid), extras);
      if (key === "mostrarEstadoEnLinea") onEstadoChange?.(val ? "online" : "offline");
      mostrarToastPriv("Configuración actualizada correctamente");
    } catch {
      setPrivacidad(previo);
      mostrarToastPriv("No fue posible guardar la configuración. Inténtalo nuevamente.", "error");
    } finally {
      setLoadingKey(null);
    }
  }

  function copiarCodigo() {
    navigator.clipboard.writeText(perfil.codigoSGD).then(() => onToast("Código SIGEDUAL copiado")).catch(() => {});
  }

  const SECCION = { color: "#374151", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, padding: "14px 18px 6px", borderTop: "1px solid #1a2338" };
  const FILA = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", gap: 10 };
  const FILA_LBL = { color: "#d1d5db", fontSize: 13 };
  const FILA_SUB = { color: "#4b5563", fontSize: 11 };

  return (
    <>
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a2338", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, padding: 4, borderRadius: 8 }}
          onMouseOver={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#f1f5f9"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700 }}>Mi Perfil</span>
        <div style={{ flex: 1 }} />
        <button onClick={onEditar} title="Editar perfil"
          style={{ background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 15, padding: 6, borderRadius: 8, transition: "all 0.15s" }}
          onMouseOver={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#1fb2a6"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b5563"; }}>
          <i className="fa-solid fa-pen" />
        </button>
      </div>

      {/* Contenido scrollable */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>

        {/* Foto + nombre */}
        <div style={{ padding: "24px 20px 16px", textAlign: "center", background: "linear-gradient(180deg,#0f1e30 0%,#0d1829 100%)" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
            <Avatar nombre={perfil.nombreVisible} fotoURL={perfil.fotoURL || undefined} size={80} estado={perfil.estado} />
            <button onClick={onEditar} title="Cambiar foto"
              style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#3b82f6", border: "2px solid #0d1829", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <i className="fa-solid fa-camera" style={{ fontSize: 10, color: "#fff" }} />
            </button>
          </div>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>{perfil.nombreVisible}</h2>
          {perfil.descripcion && (
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 8px", fontStyle: "italic" }}>"{perfil.descripcion}"</p>
          )}
          <span style={{ fontSize: 12, color: perfil.estado === "online" ? "#22c55e" : "#6b7280", fontWeight: 600 }}>
            ● {perfil.estado === "online" ? "En línea" : perfil.estado === "ausente" ? "Ausente" : "Desconectado"}
          </span>
        </div>

        {/* Código SIGEDUAL */}
        <div style={{ margin: "12px 16px", background: "#111827", border: "1px solid #1f2937", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px 8px" }}>
            <p style={{ color: "#4b5563", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 6px" }}>Código SIGEDUAL</p>
            <p style={{ color: "#1fb2a6", fontSize: 18, fontFamily: "monospace", fontWeight: 700, letterSpacing: "2px", margin: 0 }}>{perfil.codigoSGD}</p>
            <p style={{ color: "#374151", fontSize: 11, margin: "4px 0 0" }}>Comparte este código para que otros usuarios te encuentren</p>
          </div>
          <div style={{ display: "flex", borderTop: "1px solid #1f2937" }}>
            <button onClick={copiarCodigo}
              style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRight: "1px solid #1f2937", transition: "background 0.15s" }}
              onMouseOver={e => e.currentTarget.style.background = "#1f2937"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <i className="fa-solid fa-copy" style={{ marginRight: 6, color: "#1fb2a6" }} />Copiar
            </button>
            <button onClick={onShowQR}
              style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
              onMouseOver={e => e.currentTarget.style.background = "#1f2937"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <i className="fa-solid fa-qrcode" style={{ marginRight: 6, color: "#3b82f6" }} />Ver QR
            </button>
          </div>
        </div>

        {/* Información */}
        <div style={{ margin: "0 16px 4px" }}>
          {[
            { icon: "fa-briefcase", label: "Cargo", value: perfil.cargo },
            { icon: "fa-building", label: "Institución", value: perfil.institucion || perfil.liceoId },
            { icon: "fa-envelope", label: "Correo", value: perfil.email },
            { icon: "fa-calendar", label: "Perfil creado", value: fmtFechaLarga(perfil.creadoEn) },
          ].filter(r => r.value).map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#111827", border: "1px solid #1f2937", borderRadius: 12, marginBottom: 6 }}>
              <i className={`fa-solid ${r.icon}`} style={{ fontSize: 13, color: "#374151", width: 16, textAlign: "center" }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ color: "#4b5563", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>{r.label}</p>
                <p style={{ color: "#d1d5db", fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Privacidad */}
        <p style={SECCION}>Privacidad</p>
        {([
          { key: "mostrarEstadoEnLinea", label: "Mostrar estado en línea", sub: "Otros verán cuándo estás activo" },
          { key: "mostrarUltimaConexion", label: "Mostrar última conexión", sub: "Otros verán cuándo te conectaste" },
          { key: "encontrablePorCodigo", label: "Encontrable por código", sub: "Cualquiera puede buscarte con tu código SGD" },
          { key: "permitirMensajesDesconocidos", label: "Mensajes de desconocidos", sub: "Usuarios que no son contactos" },
          { key: "mostrarFotoATodos", label: "Foto de perfil visible", sub: "Todos pueden ver tu fotografía" },
          { key: "mostrarDescripcionATodos", label: "Descripción visible", sub: "Todos pueden ver tu descripción" },
        ] as { key: keyof PrivacidadConfig; label: string; sub: string }[]).map(item => (
          <div key={item.key} style={FILA}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...FILA_LBL, margin: "0 0 2px" }}>{item.label}</p>
              <p style={{ ...FILA_SUB, margin: 0 }}>{item.sub}</p>
            </div>
            <Switch value={privacidad[item.key]} onChange={v => actualizarPrivacidad(item.key, v)} loading={loadingKey === item.key} disabled={loadingKey !== null && loadingKey !== item.key} />
          </div>
        ))}

        {/* Usuarios bloqueados */}
        <p style={SECCION}>Usuarios bloqueados</p>
        {(!perfil.bloqueados || perfil.bloqueados.length === 0) ? (
          <div style={{ padding: "12px 18px 18px" }}>
            <p style={{ color: "#374151", fontSize: 13, margin: 0 }}>No tienes usuarios bloqueados.</p>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            {/* Preparado: aquí irá la lista de usuarios bloqueados */}
          </div>
        )}

        {/* Acciones bottom */}
        <p style={SECCION}>Acciones</p>
        {[
          { icon: "fa-copy", label: "Copiar código", color: "#1fb2a6", action: copiarCodigo },
          { icon: "fa-qrcode", label: "Mostrar QR", color: "#3b82f6", action: onShowQR },
          { icon: "fa-pen", label: "Editar perfil", color: "#a78bfa", action: onEditar },
          { icon: "fa-circle-question", label: "Ayuda", color: "#3b82f6", action: () => setShowAyuda(true) },
        ].map(a => (
          <button key={a.label} onClick={a.action}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 0.15s" }}
            onMouseOver={e => e.currentTarget.style.background = "#111827"}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
            <i className={`fa-solid ${a.icon}`} style={{ fontSize: 14, color: a.color, width: 20, textAlign: "center" }} />
            <span style={{ color: "#d1d5db", fontSize: 13 }}>{a.label}</span>
          </button>
        ))}
        <div style={{ height: 20 }} />
      </div>
    </div>
    {showAyuda && <CentroAyudaModal onClose={() => setShowAyuda(false)} />}
    <Toast msg={toastPrivMsg} visible={toastPrivVis} tipo={toastPrivTipo} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// BARRA LATERAL IZQUIERDA
// ─────────────────────────────────────────────────────────────
function LeftSidebar({ conversaciones, selectedId, onSelect, miUid, onNuevoChat, busqueda, setBusqueda, miPerfil, onActualizarPerfil, onToast, onEstadoChange }: {
  conversaciones: Conversacion[]; selectedId: string | null; onSelect: (id: string) => void;
  miUid: string; onNuevoChat: () => void; busqueda: string; setBusqueda: (v: string) => void;
  miPerfil: PerfilCom; onActualizarPerfil: (p: Partial<PerfilCom>) => Promise<void>; onToast: (msg: string) => void;
  onEstadoChange?: (estado: "online" | "offline") => void;
}) {
  const [viendoPerfil, setViendoPerfil] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVis, setToastVis] = useState(false);

  function mostrarToast(msg: string) {
    setToastMsg(msg); setToastVis(true);
    setTimeout(() => setToastVis(false), 2500);
    onToast(msg);
  }

  const filtradas = conversaciones.filter(c => {
    const otroUid = c.participantes.find(p => p !== miUid) ?? "";
    const otro = c.participantesInfo[otroUid];
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (otro?.nombre ?? "").toLowerCase().includes(q) || (c.ultimoMensaje?.texto ?? "").toLowerCase().includes(q);
  });

  if (viendoPerfil) {
    return (
      <div style={{ width: 300, minWidth: 300, borderRight: "1px solid #1f2937", background: "#0d1829", height: "100%", position: "relative" }}>
        <MiPerfilPanel perfil={miPerfil} onClose={() => setViendoPerfil(false)}
          onActualizar={async p => { await onActualizarPerfil(p); }}
          onShowQR={() => setShowQR(true)} onEditar={() => setShowEditar(true)}
          onToast={mostrarToast} onEstadoChange={onEstadoChange} />
        <Toast msg={toastMsg} visible={toastVis} />
        {showQR && <QRModal perfil={miPerfil} onClose={() => setShowQR(false)} />}
        {showEditar && (
          <EditarPerfilModal perfil={miPerfil}
            onGuardar={async p => { await onActualizarPerfil(p); mostrarToast("Perfil actualizado correctamente"); }}
            onClose={() => setShowEditar(false)} />
        )}
      </div>
    );
  }

  return (
    <div style={{ width: 300, minWidth: 300, borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", background: "#0d1829", height: "100%", overflow: "hidden", position: "relative" }}>

      {/* Tarjeta Mi Perfil */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #1a2338", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, cursor: "pointer", transition: "background 0.15s" }}
          onClick={() => setViendoPerfil(true)}
          onMouseOver={e => e.currentTarget.style.background = "#111827"}
          onMouseOut={e => e.currentTarget.style.background = "transparent"}>
          <Avatar nombre={miPerfil.nombreVisible} fotoURL={miPerfil.fotoURL || undefined} size={38} estado={miPerfil.estado} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{miPerfil.nombreVisible}</p>
            <p style={{ color: "#1fb2a650", fontSize: 10, margin: 0, fontFamily: "monospace", letterSpacing: "0.8px" }}>{miPerfil.codigoSGD}</p>
          </div>
          <i className="fa-solid fa-ellipsis-vertical" style={{ color: "#374151", fontSize: 14 }} />
        </div>
      </div>

      {/* Cabecera chats */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid #1a2338", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, margin: 0 }}>Mensajes</h2>
          <button onClick={onNuevoChat} title="Nuevo chat"
            style={{ background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 9, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <i className="fa-solid fa-pen-to-square" style={{ fontSize: 13, color: "#fff" }} />
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 12 }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar conversaciones..."
            style={{ width: "100%", background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "8px 12px 8px 30px", color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Lista de conversaciones */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {filtradas.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center" }}>
            <i className="fa-solid fa-message" style={{ fontSize: 28, color: "#1f2937", display: "block", marginBottom: 10 }} />
            <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>{busqueda ? "Sin resultados" : "Sin conversaciones aún"}</p>
          </div>
        ) : filtradas.map(conv => {
          const otroUid = conv.participantes.find(p => p !== miUid) ?? "";
          const otro = conv.participantesInfo[otroUid] ?? {};
          const noLeidos = conv.noLeidos?.[miUid] ?? 0;
          const isSelected = conv.id === selectedId;
          const ultimo = conv.ultimoMensaje;
          const esMio = ultimo?.senderId === miUid;
          return (
            <div key={conv.id} onClick={() => onSelect(conv.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", cursor: "pointer", background: isSelected ? "#1a2338" : "transparent", borderBottom: "1px solid #1a233810", transition: "background 0.15s" }}
              onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = "#111827"; }}
              onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
              <Avatar nombre={otro.nombre || "?"} fotoURL={otro.fotoURL} size={42} estado={otro.estado} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: noLeidos > 0 ? "#f1f5f9" : "#d1d5db", fontSize: 13, fontWeight: noLeidos > 0 ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {otro.nombre || "Usuario"}
                  </span>
                  <span style={{ color: noLeidos > 0 ? "#1fb2a6" : "#4b5563", fontSize: 11, flexShrink: 0, marginLeft: 6 }}>
                    {fmtRelativa(ultimo?.timestamp ?? null)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: noLeidos > 0 ? "#94a3b8" : "#4b5563", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {esMio && <i className="fa-solid fa-check-double" style={{ fontSize: 10, marginRight: 4, color: "#1fb2a6" }} />}
                    {ultimo?.tipo === "imagen" ? "📷 Imagen" : ultimo?.tipo === "archivo" ? "📎 Archivo" : (ultimo?.texto || "Sin mensajes")}
                  </span>
                  {noLeidos > 0 && (
                    <span style={{ background: "#1fb2a6", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px", marginLeft: 8, flexShrink: 0 }}>
                      {noLeidos > 99 ? "99+" : noLeidos}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Toast msg={toastMsg} visible={toastVis} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MENÚ CONTEXTUAL DE MENSAJE
// ─────────────────────────────────────────────────────────────
function MenuContextualMsg({ msg, esMio, pos, onCerrar, onEditar, onEliminarParaTodos, onEliminarParaMi }: {
  msg: Mensaje; esMio: boolean; pos: { x: number; y: number };
  onCerrar: () => void; onEditar: () => void;
  onEliminarParaTodos: () => void; onEliminarParaMi: () => void;
}) {
  const dentro5min = !!msg.timestamp && (Date.now() - msg.timestamp.toMillis()) <= 5 * 60 * 1000;
  const puedeEditar      = esMio && msg.tipo === "texto" && !msg.eliminado && dentro5min;
  const puedeElimParaTodos = esMio && !msg.eliminado && dentro5min;

  const items: { icon: string; label: string; onClick: () => void; color: string; disabled?: boolean }[] = [
    ...(esMio && msg.tipo === "texto" && !msg.eliminado
      ? [{ icon: "fa-pen", label: "Editar mensaje", onClick: onEditar, color: puedeEditar ? "#f1f5f9" : "#4b5563", disabled: !puedeEditar }] : []),
    ...(esMio && !msg.eliminado
      ? [{ icon: "fa-trash-can", label: "Eliminar para todos", onClick: onEliminarParaTodos, color: puedeElimParaTodos ? "#ef4444" : "#4b5563", disabled: !puedeElimParaTodos }] : []),
    ...(!msg.eliminado
      ? [{ icon: "fa-eye-slash", label: "Eliminar para mí", onClick: onEliminarParaMi, color: "#f59e0b" }] : []),
    { icon: "fa-xmark", label: "Cancelar", onClick: onCerrar, color: "#6b7280" },
  ];

  const menuW = 230;
  const menuH = items.length * 42 + 8;
  const left = Math.min(pos.x, (typeof window !== "undefined" ? window.innerWidth : 800) - menuW - 8);
  const top  = Math.min(pos.y, (typeof window !== "undefined" ? window.innerHeight : 600) - menuH - 8);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 500 }} onClick={onCerrar} onContextMenu={e => { e.preventDefault(); onCerrar(); }} />
      <div style={{ position: "fixed", left, top, zIndex: 501, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.55)", minWidth: menuW, overflow: "hidden" }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => { if (!item.disabled) { item.onClick(); onCerrar(); } }}
            style={{ width: "100%", background: "transparent", border: "none", borderTop: i > 0 ? "1px solid #1a2338" : "none", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, color: item.color, fontSize: 13, fontWeight: 500, cursor: item.disabled ? "not-allowed" : "pointer", textAlign: "left", fontFamily: "inherit", opacity: item.disabled ? 0.45 : 1, transition: "background 0.1s" }}
            onMouseOver={e => { if (!item.disabled) e.currentTarget.style.background = "#1f2937"; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
            <i className={`fa-solid ${item.icon}`} style={{ width: 16, textAlign: "center", fontSize: 12 }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.label === "Eliminar para todos" && item.disabled &&
              <span style={{ fontSize: 10, color: "#374151" }}>Expiró</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// DIÁLOGO DE CONFIRMACIÓN
// ─────────────────────────────────────────────────────────────
function ConfirmarDialog({ titulo, descripcion, labelConfirmar = "Eliminar", peligroso = true, onConfirmar, onCancelar, cargando }: {
  titulo: string; descripcion: string; labelConfirmar?: string; peligroso?: boolean;
  onConfirmar: () => void; onCancelar: () => void; cargando?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "24px 28px", maxWidth: 340, width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
        <h3 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{titulo}</h3>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>{descripcion}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancelar} disabled={cargando}
            style={{ padding: "8px 18px", background: "#1f2937", border: "none", borderRadius: 9, color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={cargando}
            style={{ padding: "8px 18px", background: peligroso ? "#ef4444" : "#1fb2a6", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: cargando ? 0.7 : 1, display: "flex", alignItems: "center", gap: 7 }}>
            {cargando && <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 12 }} />}
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BURBUJA DE MENSAJE
// ─────────────────────────────────────────────────────────────
function BurbujaMsg({ msg, esMio, onEditar, onEliminarParaTodos, onEliminarParaMi }: {
  msg: Mensaje; esMio: boolean;
  onEditar: (msg: Mensaje, nuevoTexto: string) => Promise<void>;
  onEliminarParaTodos: (msg: Mensaje) => Promise<void>;
  onEliminarParaMi: (msg: Mensaje) => Promise<void>;
}) {
  const hora = fmtHora(msg.timestamp);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmando, setConfirmando] = useState<"todos" | "mi" | null>(null);
  const [cargandoConfirm, setCargandoConfirm] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(msg.texto);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  function abrirMenu(x: number, y: number) { setMenuPos({ x, y }); }

  function onPointerDown(e: React.PointerEvent) {
    movedRef.current = false;
    longTimer.current = setTimeout(() => {
      if (!movedRef.current) abrirMenu(e.clientX, e.clientY);
    }, 500);
  }
  function onPointerMove() { movedRef.current = true; if (longTimer.current) clearTimeout(longTimer.current); }
  function onPointerUp() { if (longTimer.current) clearTimeout(longTimer.current); }
  function onContextMenu(e: React.MouseEvent) { e.preventDefault(); abrirMenu(e.clientX, e.clientY); }

  async function confirmarElimParaTodos() {
    setCargandoConfirm(true);
    await onEliminarParaTodos(msg);
    setCargandoConfirm(false);
    setConfirmando(null);
  }
  async function confirmarElimParaMi() {
    setCargandoConfirm(true);
    await onEliminarParaMi(msg);
    setCargandoConfirm(false);
    setConfirmando(null);
  }
  async function guardarEdicion() {
    if (!textoEdit.trim() || guardandoEdit) return;
    setGuardandoEdit(true);
    await onEditar(msg, textoEdit.trim());
    setGuardandoEdit(false);
    setEditando(false);
  }

  const burbujaBg = esMio ? "linear-gradient(135deg,#1fb2a6,#0ea5e9)" : "#1a2338";
  const burbujaBorder = esMio ? "none" : "1px solid #1f2937";
  const burbujaRadius: React.CSSProperties = { borderRadius: esMio ? "16px 4px 16px 16px" : "4px 16px 16px 16px" };

  // Mensaje eliminado para todos
  if (msg.eliminado) {
    return (
      <div style={{ display: "flex", justifyContent: esMio ? "flex-end" : "flex-start", marginBottom: 4, padding: "0 16px" }}>
        <div>
          <div style={{ background: "transparent", border: "1px solid #1f2937", ...burbujaRadius, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <i className="fa-solid fa-ban" style={{ fontSize: 11, color: "#374151" }} />
            <span style={{ color: "#4b5563", fontSize: 13, fontStyle: "italic" }}>Este mensaje fue eliminado.</span>
          </div>
          <div style={{ display: "flex", justifyContent: esMio ? "flex-end" : "flex-start", marginTop: 3 }}>
            <span style={{ color: "#374151", fontSize: 11 }}>{hora}</span>
          </div>
        </div>
      </div>
    );
  }

  const contenido = () => {
    if (msg.tipo === "imagen" && msg.archivoURL) {
      return (
        <a href={msg.archivoURL} target="_blank" rel="noopener noreferrer">
          <img src={msg.archivoURL} alt="imagen" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, display: "block", cursor: "pointer" }} />
        </a>
      );
    }
    if (msg.tipo === "archivo" && msg.archivoURL) {
      return (
        <a href={msg.archivoURL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "4px 0" }}>
          <i className={`fa-solid ${iconArchivo(msg.archivoTipo)}`} style={{ fontSize: 26, color: esMio ? "#a5f3fc" : "#60a5fa" }} />
          <div>
            <p style={{ color: "#f1f5f9", fontSize: 13, margin: 0, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.archivoNombre}</p>
            {msg.archivoTamano != null && <p style={{ color: "#94a3b8", fontSize: 11, margin: 0 }}>{fmtTamano(msg.archivoTamano)}</p>}
          </div>
        </a>
      );
    }
    return <span style={{ color: "#f1f5f9", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.texto}</span>;
  };

  return (
    <>
      <div
        style={{ display: "flex", justifyContent: esMio ? "flex-end" : "flex-start", marginBottom: 4, padding: "0 16px" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onContextMenu={onContextMenu}
      >
        <div style={{ maxWidth: "68%" }}>
          {/* Modo edición */}
          {editando ? (
            <div style={{ background: burbujaBg, border: burbujaBorder, ...burbujaRadius, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
              <textarea value={textoEdit} onChange={e => setTextoEdit(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); guardarEdicion(); } if (e.key === "Escape") setEditando(false); }}
                style={{ width: "100%", background: "rgba(0,0,0,0.25)", border: "none", borderRadius: 8, padding: "6px 10px", color: "#f1f5f9", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 56, outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Enter guardar · Esc cancelar</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditando(false)} style={{ padding: "4px 12px", background: "rgba(0,0,0,0.3)", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  <button onClick={guardarEdicion} disabled={guardandoEdit || !textoEdit.trim()} style={{ padding: "4px 12px", background: "#1fb2a6", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: guardandoEdit ? 0.7 : 1 }}>
                    {guardandoEdit ? <i className="fa-solid fa-spinner fa-spin" /> : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: burbujaBg, border: burbujaBorder, ...burbujaRadius, padding: msg.tipo === "imagen" ? "4px" : "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", userSelect: "none" }}>
              {contenido()}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: esMio ? "flex-end" : "flex-start", marginTop: 3 }}>
            {msg.editado && <span style={{ color: "#374151", fontSize: 10, fontStyle: "italic" }}>Editado ·</span>}
            <span style={{ color: "#4b5563", fontSize: 11 }}>{hora}</span>
            {esMio && (msg.estado === "enviando"
              ? <i className="fa-solid fa-clock" style={{ fontSize: 10, color: "#4b5563" }} />
              : msg.estado === "leido"
                ? <i className="fa-solid fa-check-double" style={{ fontSize: 10, color: "#1fb2a6" }} />
                : <i className="fa-solid fa-check" style={{ fontSize: 10, color: "#6b7280" }} />)}
          </div>
        </div>
      </div>

      {menuPos && !editando && (
        <MenuContextualMsg msg={msg} esMio={esMio} pos={menuPos}
          onCerrar={() => setMenuPos(null)}
          onEditar={() => { setTextoEdit(msg.texto); setEditando(true); setMenuPos(null); }}
          onEliminarParaTodos={() => { setMenuPos(null); setConfirmando("todos"); }}
          onEliminarParaMi={() => { setMenuPos(null); setConfirmando("mi"); }}
        />
      )}

      {confirmando === "todos" && (
        <ConfirmarDialog
          titulo="¿Eliminar este mensaje para todos?"
          descripcion="Esta acción no se puede deshacer. El mensaje desaparecerá para ambos participantes."
          cargando={cargandoConfirm}
          onConfirmar={confirmarElimParaTodos}
          onCancelar={() => setConfirmando(null)}
        />
      )}
      {confirmando === "mi" && (
        <ConfirmarDialog
          titulo="¿Eliminar este mensaje solo de tu conversación?"
          descripcion="El otro participante seguirá viendo este mensaje normalmente."
          cargando={cargandoConfirm}
          onConfirmar={confirmarElimParaMi}
          onCancelar={() => setConfirmando(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// SELECTOR DE EMOJIS
// ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
        {EMOJIS.map(e => (
          <button key={e} onClick={() => { onSelect(e); onClose(); }}
            style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", padding: 4, borderRadius: 8, lineHeight: 1 }}
            onMouseOver={ev => ev.currentTarget.style.background = "#1f2937"}
            onMouseOut={ev => ev.currentTarget.style.background = "transparent"}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function HdrBtn({ icon, title, onClick, disabled }: { icon: string; title: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{ background: "transparent", border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#1f2937" : "#4b5563", transition: "background 0.15s, color 0.15s" }}
      onMouseOver={e => { if (!disabled) { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#94a3b8"; } }}
      onMouseOut={e => { if (!disabled) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b5563"; } }}>
      <i className={`fa-solid ${icon}`} style={{ fontSize: 14 }} />
    </button>
  );
}

function BtnInput({ icon, title, onClick, active, disabled, loading }: { icon: string; title: string; onClick: () => void; active?: boolean; disabled?: boolean; loading?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{ background: active ? "#1f2937" : "transparent", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#2d3748" : active ? "#1fb2a6" : "#6b7280", transition: "background 0.15s, color 0.15s" }}
      onMouseOver={e => { if (!disabled) { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#94a3b8"; } }}
      onMouseOut={e => { if (!disabled && !active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; } }}>
      <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : icon}`} style={{ fontSize: 14 }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ÁREA DE ENTRADA (con carga de archivos robusta)
// ─────────────────────────────────────────────────────────────
const IMG_EXTS  = [".jpg",".jpeg",".png",".gif",".webp"];
const IMG_MIMES = ["image/jpeg","image/png","image/gif","image/webp"];
const DOC_EXTS  = [".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".csv",".zip"];
const DOC_MIMES = ["application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain","text/csv","application/zip","application/x-zip-compressed"];
const BLOQUEADOS = [".exe",".bat",".cmd",".msi",".vbs",".ps1",".js",".sh",".dll",".scr",".com"];

type ArchivoPendiente = { file: File; tipo: "imagen"|"archivo"; preview?: string };

function InputArea({ onEnviar, convId }: { onEnviar: (texto: string, tipo: Mensaje["tipo"], extra?: Partial<Mensaje>) => Promise<void>; convId: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendiente, setPendiente] = useState<ArchivoPendiente | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const uploadTaskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Limpieza de URL de objeto al desmontar
  useEffect(() => {
    return () => { if (pendiente?.preview) URL.revokeObjectURL(pendiente.preview); };
  }, [pendiente]);

  // ── Validar y preparar archivo ───────────────────────────
  function seleccionarArchivo(file: File, esImagen: boolean) {
    setErrorArchivo(null);
    const nombre = file.name.toLowerCase();

    // Bloquear ejecutables
    if (BLOQUEADOS.some(ext => nombre.endsWith(ext))) {
      setErrorArchivo("Tipo de archivo no permitido por razones de seguridad.");
      return;
    }

    const extsPermitidas = esImagen ? IMG_EXTS : DOC_EXTS;
    const mimesPermitidos = esImagen ? IMG_MIMES : DOC_MIMES;
    const maxBytes = esImagen ? 10 * 1024 * 1024 : 20 * 1024 * 1024;

    if (!extsPermitidas.some(ext => nombre.endsWith(ext))) {
      setErrorArchivo(`Formato no permitido. Usa: ${extsPermitidas.join(", ")}`);
      return;
    }
    if (file.type && !mimesPermitidos.some(m => file.type === m || file.type.startsWith("image/"))) {
      if (esImagen) { setErrorArchivo("El tipo MIME no corresponde a una imagen válida."); return; }
    }
    if (file.size > maxBytes) {
      setErrorArchivo(`El ${esImagen ? "imagen" : "archivo"} supera el tamaño máximo permitido (${esImagen ? "10" : "20"} MB).`);
      return;
    }

    const preview = esImagen ? URL.createObjectURL(file) : undefined;
    setPendiente({ file, tipo: esImagen ? "imagen" : "archivo", preview });
    // Reset input para permitir re-seleccionar el mismo archivo
    if (fileRef.current) fileRef.current.value = "";
    if (imgRef.current) imgRef.current.value = "";
  }

  // ── Subir archivo a Storage ──────────────────────────────
  async function enviarArchivo() {
    if (!pendiente || subiendo) return;
    setSubiendo(true);
    setProgreso(0);
    setErrorArchivo(null);

    const { file, tipo, preview } = pendiente;
    // Sanitizar nombre: solo alfanuméricos, puntos, guiones
    const safeNombre = file.name.replace(/[^\w.\-]/g, "_").slice(0, 120);
    const path = `mensajes/${convId}/${Date.now()}_${safeNombre}`;
    const storageRef = sRef(storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream",
    });
    uploadTaskRef.current = task;

    task.on(
      "state_changed",
      snap => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => {
        let msg = "No se pudo subir el archivo.";
        if (err.code === "storage/unauthorized")  msg = "Sin permisos para subir archivos. Verifica las reglas de Storage.";
        else if (err.code === "storage/canceled") msg = "Subida cancelada.";
        else if (err.code === "storage/quota-exceeded") msg = "Cuota de almacenamiento excedida.";
        else if (err.code === "storage/retry-limit-exceeded") msg = "Error de conexión. Inténtalo nuevamente.";
        setErrorArchivo(msg);
        setSubiendo(false); setProgreso(null); uploadTaskRef.current = null;
      },
      async () => {
        // Callback síncrono-seguro: capturamos errores explícitamente
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          await onEnviar("", tipo, {
            archivoURL: url, archivoNombre: file.name,
            archivoTipo: file.type || "application/octet-stream", archivoTamano: file.size,
          });
          if (preview) URL.revokeObjectURL(preview);
          setPendiente(null); setProgreso(null); setSubiendo(false); uploadTaskRef.current = null;
        } catch {
          setErrorArchivo("El archivo se subió pero no se pudo registrar el mensaje.");
          setSubiendo(false); setProgreso(null); uploadTaskRef.current = null;
        }
      }
    );
  }

  // ── Cancelar subida ──────────────────────────────────────
  function cancelar() {
    uploadTaskRef.current?.cancel();
    if (pendiente?.preview) URL.revokeObjectURL(pendiente.preview);
    setPendiente(null); setProgreso(null); setSubiendo(false);
    setErrorArchivo(null); uploadTaskRef.current = null;
  }

  // ── Enviar texto ─────────────────────────────────────────
  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto(""); setEnviando(true);
    try { await onEnviar(t, "texto"); } finally { setEnviando(false); }
    taRef.current?.focus();
  }

  const puedeEnviarTexto = texto.trim().length > 0 && !enviando;

  return (
    <div style={{ borderTop: "1px solid #1a2338", background: "#0d1829", flexShrink: 0, position: "relative" }}>

      {/* ── Panel de previsualización de archivo ── */}
      {pendiente && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a2338", background: "#0d1829" }}>
          {pendiente.tipo === "imagen" && pendiente.preview ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <img src={pendiente.preview} alt="preview"
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid #1f2937", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendiente.file.name}</p>
                <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 8px" }}>{fmtTamano(pendiente.file.size)}</p>
                {subiendo ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 11 }}>Subiendo imagen…</span>
                      <span style={{ color: "#1fb2a6", fontSize: 11, fontWeight: 700 }}>{progreso ?? 0}%</span>
                    </div>
                    <div style={{ height: 4, background: "#1f2937", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progreso ?? 0}%`, background: "linear-gradient(90deg,#1fb2a6,#3b82f6)", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={enviarArchivo}
                      style={{ padding: "5px 14px", background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Enviar
                    </button>
                    <button onClick={cancelar}
                      style={{ padding: "5px 12px", background: "#1f2937", border: "none", borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              {subiendo && (
                <button onClick={cancelar} title="Cancelar subida"
                  style={{ background: "#1f2937", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef4444", flexShrink: 0 }}>
                  <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
                </button>
              )}
            </div>
          ) : (
            /* Archivo */
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#111827", border: "1px solid #1f2937", borderRadius: 12 }}>
              <i className={`fa-solid ${iconArchivo(pendiente.file.type)}`} style={{ fontSize: 28, color: "#60a5fa", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendiente.file.name}</p>
                <p style={{ color: "#6b7280", fontSize: 11, margin: subiendo ? "0 0 6px" : 0 }}>{fmtTamano(pendiente.file.size)}</p>
                {subiendo && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 10 }}>Subiendo…</span>
                      <span style={{ color: "#1fb2a6", fontSize: 10, fontWeight: 700 }}>{progreso ?? 0}%</span>
                    </div>
                    <div style={{ height: 3, background: "#1f2937", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progreso ?? 0}%`, background: "linear-gradient(90deg,#1fb2a6,#3b82f6)", transition: "width 0.3s" }} />
                    </div>
                  </>
                )}
              </div>
              {!subiendo ? (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={enviarArchivo}
                    style={{ padding: "6px 14px", background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Enviar
                  </button>
                  <button onClick={cancelar}
                    style={{ padding: "6px 12px", background: "#1f2937", border: "none", borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={cancelar} title="Cancelar"
                  style={{ background: "#1f2937", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef4444", flexShrink: 0 }}>
                  <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Banner de error ── */}
      {errorArchivo && (
        <div style={{ padding: "7px 16px", background: "rgba(239,68,68,0.12)", borderBottom: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 12, color: "#ef4444", flexShrink: 0 }} />
          <span style={{ color: "#fca5a5", fontSize: 12, flex: 1 }}>{errorArchivo}</span>
          <button onClick={() => setErrorArchivo(null)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* ── Fila de entrada ── */}
      <div style={{ padding: "10px 16px" }}>
        {emojiOpen && <EmojiPicker onSelect={e => setTexto(t => t + e)} onClose={() => setEmojiOpen(false)} />}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: "6px 8px 6px 12px", opacity: subiendo ? 0.6 : 1, transition: "opacity 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, paddingBottom: 4, flexShrink: 0 }}>
            <BtnInput icon="fa-face-smile" title="Emoji" onClick={() => !subiendo && setEmojiOpen(o => !o)} active={emojiOpen} disabled={subiendo} />
            <BtnInput icon="fa-paperclip" title="Adjuntar archivo" onClick={() => !subiendo && fileRef.current?.click()} disabled={subiendo} />
            <BtnInput icon="fa-image" title="Imagen" onClick={() => !subiendo && imgRef.current?.click()} disabled={subiendo} />
            <BtnInput icon="fa-microphone" title="Nota de voz (próximamente)" onClick={() => {}} disabled />
          </div>
          <textarea ref={taRef} value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={subiendo ? "Subiendo archivo…" : "Escribe un mensaje..."} rows={1} disabled={subiendo}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1f5f9", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, minHeight: 24, paddingTop: 4, scrollbarWidth: "none" }} />
          <button onClick={enviar} disabled={!puedeEnviarTexto || subiendo}
            style={{ width: 36, height: 36, borderRadius: 10, background: puedeEnviarTexto && !subiendo ? "linear-gradient(135deg,#1fb2a6,#3b82f6)" : "#1f2937", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: puedeEnviarTexto && !subiendo ? "pointer" : "not-allowed", transition: "background 0.2s", flexShrink: 0 }}>
            {enviando ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 14, color: "#fff" }} /> : <i className="fa-solid fa-paper-plane" style={{ fontSize: 14, color: puedeEnviarTexto && !subiendo ? "#fff" : "#4b5563" }} />}
          </button>
        </div>
      </div>

      {/* Inputs ocultos */}
      <input ref={fileRef} type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) seleccionarArchivo(f, false); }} />
      <input ref={imgRef} type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) seleccionarArchivo(f, true); }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PANEL DE PERFIL DE OTRO USUARIO
// ─────────────────────────────────────────────────────────────
function ProfilePanel({ perfil, privacidad, onClose }: {
  perfil: ConvInfo & { email?: string; creadoEn?: Timestamp | null; descripcion?: string; ultimaConexion?: Timestamp | null };
  privacidad?: PrivacidadConfig;
  onClose: () => void;
}) {
  const priv = privacidad ?? PRIVACIDAD_DEFAULT;
  // Aplicar privacidad al mostrar datos del otro usuario
  const fotoVisible = priv.mostrarFotoATodos !== false ? perfil.fotoURL : undefined;
  const estadoVisible = priv.mostrarEstadoEnLinea !== false ? perfil.estado : "offline";
  const descripcionVisible = priv.mostrarDescripcionATodos !== false ? perfil.descripcion : undefined;

  const estadoColor = { online: "#22c55e", ausente: "#f59e0b", offline: "#6b7280" }[estadoVisible] ?? "#6b7280";
  const estadoLabel = priv.mostrarEstadoEnLinea !== false
    ? ({ online: "En línea", ausente: "Ausente", offline: "Desconectado" }[estadoVisible] ?? "Desconectado")
    : "Desconectado";

  function fmtUltimaConexion(ts: Timestamp | null | undefined): string {
    if (!ts) return "No disponible";
    const d = ts.toDate(), now = new Date(), diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Hace un momento";
    if (mins < 60) return `Hace ${mins} minuto${mins > 1 ? "s" : ""}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hoy a las ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
    const dias = Math.floor(hrs / 24);
    if (dias === 1) return `Ayer a las ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
    return `${d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} a las ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
  }

  const ultimaConexionTexto = priv.mostrarUltimaConexion !== false
    ? fmtUltimaConexion(perfil.ultimaConexion)
    : "No disponible";

  return (
    <div style={{ width: 280, minWidth: 280, borderLeft: "1px solid #1f2937", background: "#0d1829", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a2338", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>Perfil</span>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Avatar nombre={perfil.nombre || "?"} fotoURL={fotoVisible} size={80} estado={estadoVisible} />
          </div>
          <h3 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{perfil.nombre}</h3>
          {priv.mostrarEstadoEnLinea !== false ? (
            <span style={{ fontSize: 12, color: estadoColor, fontWeight: 600 }}>● {estadoLabel}</span>
          ) : (
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Estado no disponible</span>
          )}
          {descripcionVisible && <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>"{descripcionVisible}"</p>}
        </div>
        {[
          { icon: "fa-id-badge", label: "Código SIGEDUAL", value: perfil.codigoSGD, mono: true, color: "#1fb2a6" },
          { icon: "fa-briefcase", label: "Cargo", value: perfil.cargo, mono: false, color: "#d1d5db" },
          { icon: "fa-building", label: "Institución", value: perfil.institucion, mono: false, color: "#d1d5db" },
          { icon: "fa-envelope", label: "Correo", value: perfil.email, mono: false, color: "#d1d5db" },
        ].filter(r => r.value).map(r => (
          <div key={r.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <i className={`fa-solid ${r.icon}`} style={{ fontSize: 11, color: "#374151", width: 14 }} />
              <span style={{ color: "#4b5563", fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>{r.label}</span>
            </div>
            <p style={{ color: r.color, fontSize: 13, margin: 0, paddingLeft: 21, fontFamily: r.mono ? "monospace" : "inherit", letterSpacing: r.mono ? "1px" : "normal" }}>{r.value}</p>
          </div>
        ))}
        {/* Última conexión */}
        <div style={{ marginTop: 4, marginBottom: 8, padding: "10px 14px", background: "#111827", border: "1px solid #1f2937", borderRadius: 10 }}>
          <p style={{ color: "#374151", fontSize: 10, fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Última conexión</p>
          <p style={{ color: priv.mostrarUltimaConexion !== false ? "#6b7280" : "#374151", fontSize: 12, margin: 0, fontStyle: priv.mostrarUltimaConexion !== false ? "normal" : "italic" }}>{ultimaConexionTexto}</p>
        </div>
        {perfil.creadoEn && (
          <div style={{ padding: "10px 14px", background: "#111827", border: "1px solid #1f2937", borderRadius: 10 }}>
            <p style={{ color: "#374151", fontSize: 10, fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Perfil creado</p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{fmtFechaLarga(perfil.creadoEn)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AVISO CONVERSACIÓN TEMPORAL
// ─────────────────────────────────────────────────────────────
function AvisoTemporalModal({ horasRestantes, onEntendido }: {
  horasRestantes: number; onEntendido: () => void;
}) {
  const critico = horasRestantes <= 2;
  const accentColor = critico ? "#ef4444" : "#f59e0b";
  const gradiente   = critico ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "linear-gradient(135deg,#f59e0b,#ef4444)";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }}>
      <div style={{ background: "#111827", border: `1px solid ${critico ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`, borderRadius: 20, padding: "28px 30px", maxWidth: 430, width: "90%", boxShadow: "0 30px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: gradiente, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className={`fa-solid ${critico ? "fa-triangle-exclamation" : "fa-clock-rotate-left"}`} style={{ fontSize: 20, color: "#fff" }} />
          </div>
          <div>
            <h2 style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 800, margin: "0 0 2px" }}>
              {critico ? "⚠️ Conversación próxima a eliminarse" : "Aviso de expiración"}
            </h2>
            <p style={{ color: accentColor, fontSize: 12, margin: 0, fontWeight: 600 }}>
              Faltan aproximadamente <strong>{horasRestantes} hora{horasRestantes !== 1 ? "s" : ""}</strong>
            </p>
          </div>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.65, margin: "0 0 22px" }}>
          {critico
            ? <>Esta conversación se eliminará automáticamente en aproximadamente <strong style={{ color: accentColor }}>{horasRestantes} hora{horasRestantes !== 1 ? "s" : ""}</strong>. Guarda cualquier información importante ahora, ya que los mensajes <strong style={{ color: "#ef4444" }}>no podrán recuperarse</strong>.</>
            : <>Esta conversación se eliminará automáticamente en aproximadamente <strong style={{ color: "#f1f5f9" }}>{horasRestantes} horas</strong>. Asegúrate de revisar o guardar cualquier información importante antes de que finalice ese período.</>
          }
        </p>
        <button onClick={onEntendido}
          style={{ width: "100%", padding: "11px 0", background: critico ? gradiente : "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 11, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <i className="fa-solid fa-check" style={{ marginRight: 8 }} />Entendido
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONTADOR DE EXPIRACIÓN
// ─────────────────────────────────────────────────────────────
function ContadorExpiracion({ primerMensajeEn }: { primerMensajeEn: Timestamp | null }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!primerMensajeEn) return null;

  const expiraMs = primerMensajeEn.toMillis() + EXPIRY_MS;
  const restante = expiraMs - Date.now();
  if (restante <= 0) return null;

  const horas   = Math.floor(restante / 3600000);
  const minutos = Math.floor((restante % 3600000) / 60000);

  const critico = restante < 60 * 60 * 1000;        // < 1 h
  const alerta  = restante < 6 * 60 * 60 * 1000;   // < 6 h

  const color  = critico ? "#ef4444" : alerta ? "#f59e0b" : "#4b5563";
  const bg     = critico ? "rgba(239,68,68,0.08)" : alerta ? "rgba(245,158,11,0.08)" : "transparent";
  const border = critico ? "rgba(239,68,68,0.2)"  : alerta ? "rgba(245,158,11,0.2)"  : "#1a2338";
  const icon   = critico || alerta ? "fa-triangle-exclamation" : "fa-clock";

  return (
    <div style={{ padding: "5px 18px", background: bg, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
      <i className={`fa-solid ${icon}`} style={{ fontSize: 10, color, flexShrink: 0 }} />
      <span style={{ color, fontSize: 11, fontWeight: 500 }}>
        Se eliminará en{" "}<strong>{horas}h {minutos < 10 ? `0${minutos}` : minutos}min</strong>
        {critico && <span style={{ marginLeft: 8, opacity: 0.85 }}>· Esta conversación está próxima a eliminarse.</span>}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO CHAT
// ─────────────────────────────────────────────────────────────
function NuevoChatModal({ miUid, miPerfil, onIniciar, onClose }: { miUid: string; miPerfil: PerfilCom; onIniciar: (convId: string) => void; onClose: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PerfilCom[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResultados([]); return; }
    setBuscando(true);
    try {
      const snap = await getDocs(collection(db, "perfilesComunicacion"));
      const ql = q.toLowerCase().trim();
      const esBusquedaPorCodigo = /^sgd[-\s]?/i.test(ql);
      setResultados(
        snap.docs.map(d => d.data() as PerfilCom)
          .filter(p => {
            if (p.uid === miUid) return false;
            // Si la búsqueda es por código y el usuario no es encontrable, excluirlo
            if (esBusquedaPorCodigo && p.privacidad?.encontrablePorCodigo === false) return false;
            return (
              p.codigoSGD?.toLowerCase().includes(ql) ||
              p.nombreVisible?.toLowerCase().includes(ql) ||
              p.cargo?.toLowerCase().includes(ql) ||
              p.institucion?.toLowerCase().includes(ql) ||
              p.email?.toLowerCase().includes(ql)
            );
          })
          .map(p => ({
            ...p,
            // Aplicar privacidad de foto y descripción en los resultados de búsqueda
            fotoURL: p.privacidad?.mostrarFotoATodos !== false ? p.fotoURL : "",
            descripcion: p.privacidad?.mostrarDescripcionATodos !== false ? p.descripcion : "",
            estado: p.privacidad?.mostrarEstadoEnLinea !== false ? p.estado : "offline",
          }))
      );
    } finally { setBuscando(false); }
  }, [miUid]);

  useEffect(() => { const t = setTimeout(() => buscar(busqueda), 350); return () => clearTimeout(t); }, [busqueda, buscar]);

  async function iniciar(otro: PerfilCom) {
    setErrorMsg(null);
    setIniciando(otro.uid);
    const convId = [miUid, otro.uid].sort().join("_");
    const convRef = doc(db, "conversaciones", convId);
    const snap = await getDoc(convRef);
    // Si no hay conversación previa y el destinatario no acepta mensajes de desconocidos, bloquear
    if (!snap.exists() && otro.privacidad?.permitirMensajesDesconocidos === false) {
      setErrorMsg(`${otro.nombreVisible} no acepta mensajes de usuarios que no pertenecen a sus contactos o relaciones permitidas.`);
      setIniciando(null);
      return;
    }
    if (!snap.exists()) {
      const privMia = miPerfil.privacidad;
      const privOtro = otro.privacidad;
      await setDoc(convRef, {
        tipo: "directa", participantes: [miUid, otro.uid].sort(),
        participantesInfo: {
          [miUid]: {
            nombre: miPerfil.nombreVisible,
            fotoURL: privMia?.mostrarFotoATodos !== false ? miPerfil.fotoURL : "",
            codigoSGD: miPerfil.codigoSGD, cargo: miPerfil.cargo, institucion: miPerfil.institucion,
            estado: privMia?.mostrarEstadoEnLinea !== false ? miPerfil.estado : "offline",
          },
          [otro.uid]: {
            nombre: otro.nombreVisible,
            fotoURL: privOtro?.mostrarFotoATodos !== false ? otro.fotoURL : "",
            codigoSGD: otro.codigoSGD, cargo: otro.cargo, institucion: otro.institucion,
            estado: privOtro?.mostrarEstadoEnLinea !== false ? otro.estado : "offline",
          },
        },
        ultimoMensaje: null, noLeidos: { [miUid]: 0, [otro.uid]: 0 },
        creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
      });
    }
    setIniciando(null);
    onIniciar(convId);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 18, width: 460, maxHeight: "78vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700, margin: 0 }}><i className="fa-solid fa-user-plus" style={{ marginRight: 10, color: "#1fb2a6" }} />Nuevo chat</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div style={{ padding: "14px 20px 10px" }}>
          <div style={{ position: "relative" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 13 }} />
            <input autoFocus value={busqueda} onChange={e => { setBusqueda(e.target.value); setErrorMsg(null); }} placeholder="Nombre, código SGD, empresa, cargo..."
              style={{ width: "100%", background: "#0d1829", border: "1px solid #1f2937", borderRadius: 11, padding: "10px 12px 10px 36px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          {errorMsg && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 10, background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 10, padding: "10px 14px" }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 13, color: "#ef4444", marginTop: 1, flexShrink: 0 }} />
              <p style={{ color: "#fca5a5", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{errorMsg}</p>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#1f2937 transparent", paddingBottom: 12 }}>
          {buscando ? (
            <div style={{ textAlign: "center", padding: 28 }}><i className="fa-solid fa-spinner fa-spin" style={{ color: "#4b5563", fontSize: 22 }} /></div>
          ) : resultados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <i className="fa-solid fa-users" style={{ fontSize: 28, color: "#1f2937", display: "block", marginBottom: 10 }} />
              <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>{busqueda.trim() ? `Sin resultados para "${busqueda}"` : "Busca por nombre, código SGD, cargo o empresa"}</p>
            </div>
          ) : resultados.map(p => (
            <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid #1a233820" }}>
              <Avatar nombre={p.nombreVisible} fotoURL={p.fotoURL || undefined} size={44} estado={p.estado} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombreVisible}</p>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[p.cargo, p.institucion].filter(Boolean).join(" · ")}</p>
                <p style={{ color: "#1fb2a650", fontSize: 11, margin: "2px 0 0", fontFamily: "monospace" }}>{p.codigoSGD}</p>
              </div>
              <button onClick={() => iniciar(p)} disabled={iniciando === p.uid}
                style={{ background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 9, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: iniciando === p.uid ? "not-allowed" : "pointer", flexShrink: 0, opacity: iniciando === p.uid ? 0.6 : 1, fontFamily: "inherit" }}>
                {iniciando === p.uid ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-comment" style={{ marginRight: 6 }} />Chatear</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function MensajesPage() {
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [miPerfil, setMiPerfil] = useState<PerfilCom | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [convSelId, setConvSelId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [showNuevoChat, setShowNuevoChat] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [perfilOtroFull, setPerfilOtroFull] = useState<PerfilCom | null>(null);
  const [toastPagMsg, setToastPagMsg] = useState("");
  const [toastPagVis, setToastPagVis] = useState(false);
  const [toastPagTipo, setToastPagTipo] = useState<"ok"|"error">("ok");
  const [avisoHoras, setAvisoHoras] = useState<number | null>(null);
  const [limpiando, setLimpiando] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const unsubMensajes = useRef<(() => void) | null>(null);

  function mostrarToastPag(msg: string, tipo: "ok"|"error" = "ok") {
    setToastPagMsg(msg); setToastPagTipo(tipo); setToastPagVis(true);
    setTimeout(() => setToastPagVis(false), 3000);
  }

  // Cargar perfil propio
  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const snap = await getDoc(doc(db, "perfilesComunicacion", usuario.uid));
      if (snap.exists()) {
        const data = snap.data() as PerfilCom;
        setMiPerfil(data);
        const estadoVisible = data.privacidad?.mostrarEstadoEnLinea !== false ? "online" : "offline";
        updateDoc(doc(db, "perfilesComunicacion", usuario.uid), { estado: estadoVisible, ultimaConexion: serverTimestamp() }).catch(() => {});
      } else { setOnboarding(true); }
      setCargando(false);
    })();
    return () => { if (usuario) updateDoc(doc(db, "perfilesComunicacion", usuario.uid), { estado: "offline" }).catch(() => {}); };
  }, [usuario]);

  // Conversaciones en tiempo real
  useEffect(() => {
    if (!usuario || !miPerfil) return;
    const q = query(collection(db, "conversaciones"), where("participantes", "array-contains", usuario.uid), orderBy("actualizadoEn", "desc"));
    const unsub = onSnapshot(q, snap => {
      setConversaciones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversacion)));
    }, () => {
      const q2 = query(collection(db, "conversaciones"), where("participantes", "array-contains", usuario.uid));
      onSnapshot(q2, snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversacion));
        arr.sort((a, b) => (b.actualizadoEn?.seconds ?? 0) - (a.actualizadoEn?.seconds ?? 0));
        setConversaciones(arr);
      });
    });
    return () => unsub();
  }, [usuario, miPerfil]);

  // Disparar aviso a las 5h, 4h, 3h, 2h y 1h antes de expirar (una vez por umbral/ciclo)
  useEffect(() => {
    if (!convSelId) return;
    const UMBRALES = [5, 4, 3, 2, 1];

    function verificarUmbrales() {
      const conv = conversaciones.find(c => c.id === convSelId);
      if (!conv?.primerMensajeEn) return;

      const restante = conv.primerMensajeEn.toMillis() + EXPIRY_MS - Date.now();
      if (restante <= 0) return;

      const horasRestantes = Math.ceil(restante / 3600000);
      const cicloKey = conv.cicloId ?? convSelId;

      for (const umbral of UMBRALES) {
        if (horasRestantes <= umbral) {
          const lsKey = `sgd-exp-aviso-${cicloKey}-${umbral}h`;
          if (!localStorage.getItem(lsKey)) {
            localStorage.setItem(lsKey, "1");
            setAvisoHoras(umbral);
          }
          break;
        }
      }
    }

    verificarUmbrales();
    const id = setInterval(verificarUmbrales, 60000);
    return () => clearInterval(id);
  }, [convSelId, conversaciones]);

  // Verificar y limpiar conversaciones expiradas al seleccionar o cada 60 s
  useEffect(() => {
    async function verificar() {
      if (!convSelId || limpiando) return;
      const conv = conversaciones.find(c => c.id === convSelId);
      if (!conv?.primerMensajeEn) return;
      if (Date.now() < conv.primerMensajeEn.toMillis() + EXPIRY_MS) return;

      setLimpiando(true);
      try {
        // Eliminar mensajes de Firestore
        const mensajesRef = collection(db, "conversaciones", convSelId, "mensajes");
        const snap = await getDocs(mensajesRef);
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

        // Eliminar archivos en Storage (mensajes/{convId}/*)
        try {
          const storageRef = sRef(storage, `mensajes/${convSelId}`);
          const lista = await listAll(storageRef);
          await Promise.all(lista.items.map(item => deleteObject(item)));
        } catch { /* carpeta puede no existir */ }

        // Reiniciar conversación para ambos usuarios
        await updateDoc(doc(db, "conversaciones", convSelId), {
          primerMensajeEn: null,
          cicloId: `ciclo-${Date.now()}`,
          ultimoMensaje: null,
        });
      } catch (e) {
        console.warn("Error limpiando conversación expirada:", e);
      } finally {
        setLimpiando(false);
      }
    }

    verificar();
    const id = setInterval(verificar, 60000);
    return () => clearInterval(id);
  }, [convSelId, conversaciones, limpiando]);

  // Mensajes en tiempo real — sin orderBy para evitar requerir índice compuesto;
  // se ordenan en cliente por timestamp.
  useEffect(() => {
    unsubMensajes.current?.();
    setMensajes([]);
    if (!convSelId) return;

    const colRef = collection(db, "conversaciones", convSelId, "mensajes");
    const unsub = onSnapshot(
      query(colRef),
      snap => {
        const miUid = usuario?.uid ?? "";
        const reales = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Mensaje))
          // Filtrar mensajes que el usuario eliminó para sí mismo
          .filter(d => !d.eliminadoPara?.includes(miUid));
        reales.sort((a, b) => (a.timestamp?.toMillis() ?? 0) - (b.timestamp?.toMillis() ?? 0));
        setMensajes(reales);
      },
      err => console.error("Mensajes onSnapshot error:", err.code, err.message)
    );
    unsubMensajes.current = unsub;

    if (usuario) updateDoc(doc(db, "conversaciones", convSelId), { [`noLeidos.${usuario.uid}`]: 0 }).catch(() => {});
    return () => { unsub(); unsubMensajes.current = null; };
  }, [convSelId, usuario]);

  // Scroll al final
  useEffect(() => { setTimeout(() => mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80); }, [mensajes]);

  // Cargar perfil completo del otro usuario
  useEffect(() => {
    if (!convSelId || !usuario) { setPerfilOtroFull(null); return; }
    const conv = conversaciones.find(c => c.id === convSelId);
    const otroUid = conv?.participantes.find(p => p !== usuario.uid) ?? "";
    if (!otroUid) return;
    getDoc(doc(db, "perfilesComunicacion", otroUid)).then(snap => { if (snap.exists()) setPerfilOtroFull(snap.data() as PerfilCom); }).catch(() => {});
  }, [convSelId, conversaciones, usuario]);

  // Actualizar perfil propio
  async function actualizarPerfil(cambios: Partial<PerfilCom>) {
    if (!usuario || !miPerfil) return;
    await updateDoc(doc(db, "perfilesComunicacion", usuario.uid), cambios as Record<string, unknown>);
    setMiPerfil(p => p ? { ...p, ...cambios } : p);
  }

  // Propagar cambio de estado a todos los participantesInfo de mis conversaciones
  async function propagarEstado(nuevoEstado: "online" | "offline") {
    if (!usuario) return;
    setMiPerfil(p => p ? { ...p, estado: nuevoEstado } : p);
    conversaciones.forEach(conv => {
      if (!conv.participantes.includes(usuario.uid)) return;
      updateDoc(doc(db, "conversaciones", conv.id), {
        [`participantesInfo.${usuario.uid}.estado`]: nuevoEstado,
      }).catch(() => {});
    });
  }

  // ── Editar mensaje ──────────────────────────────────────────
  async function editarMensaje(msg: Mensaje, nuevoTexto: string) {
    if (!convSelId || !usuario || msg.senderId !== usuario.uid) return;
    await updateDoc(doc(db, "conversaciones", convSelId, "mensajes", msg.id), {
      texto: nuevoTexto,
      editado: true,
      editadoEn: serverTimestamp(),
    });
  }

  // ── Eliminar para todos (solo si ≤ 5 min) ────────────────
  async function eliminarParaTodos(msg: Mensaje) {
    if (!convSelId || !usuario || msg.senderId !== usuario.uid) return;
    if (!msg.timestamp || Date.now() - msg.timestamp.toMillis() > 5 * 60 * 1000) return;
    await updateDoc(doc(db, "conversaciones", convSelId, "mensajes", msg.id), {
      eliminado: true,
      texto: "",
      archivoURL: "",
      archivoNombre: "",
    });
  }

  // ── Eliminar para mí ─────────────────────────────────────
  async function eliminarParaMi(msg: Mensaje) {
    if (!convSelId || !usuario) return;
    await updateDoc(doc(db, "conversaciones", convSelId, "mensajes", msg.id), {
      eliminadoPara: arrayUnion(usuario.uid),
    });
    // Optimista: quitar del estado local inmediatamente
    setMensajes(prev => prev.filter(m => m.id !== msg.id));
  }

  // Enviar mensaje
  async function enviarMensaje(texto: string, tipo: Mensaje["tipo"], extra?: Partial<Mensaje>) {
    if (!usuario || !miPerfil || !convSelId) return;
    const conv = conversaciones.find(c => c.id === convSelId);
    const otroUid = conv?.participantes.find(p => p !== usuario.uid) ?? "";

    try {
      await addDoc(collection(db, "conversaciones", convSelId, "mensajes"), {
        senderId: usuario.uid, texto, tipo, timestamp: serverTimestamp(), estado: "enviado",
        leidoPor: { [usuario.uid]: true }, ...extra,
      });
    } catch (err: any) {
      mostrarToastPag("No se pudo enviar el mensaje. Inténtalo nuevamente.", "error");
      console.error("enviarMensaje error:", err);
      return;
    }

    // Actualización de metadatos de la conversación (no crítica — falla en silencio)
    const textoMeta = texto || (tipo === "imagen" ? "📷 Imagen" : "📎 Archivo");
    // Si primerMensajeEn es null, este es el primer mensaje del ciclo → iniciar temporizador 48h
    const esPrimerMensaje = !conv?.primerMensajeEn;
    updateDoc(doc(db, "conversaciones", convSelId), {
      "ultimoMensaje.texto":     textoMeta,
      "ultimoMensaje.senderId":  usuario.uid,
      "ultimoMensaje.tipo":      tipo,
      "ultimoMensaje.timestamp": serverTimestamp(),
      actualizadoEn:             serverTimestamp(),
      ...(esPrimerMensaje ? { primerMensajeEn: serverTimestamp(), cicloId: `ciclo-${Date.now()}` } : {}),
      [`participantesInfo.${usuario.uid}.nombre`]:      miPerfil.nombreVisible,
      [`participantesInfo.${usuario.uid}.fotoURL`]:     miPerfil.privacidad?.mostrarFotoATodos !== false ? miPerfil.fotoURL : "",
      [`participantesInfo.${usuario.uid}.codigoSGD`]:   miPerfil.codigoSGD,
      [`participantesInfo.${usuario.uid}.cargo`]:       miPerfil.cargo,
      [`participantesInfo.${usuario.uid}.institucion`]: miPerfil.institucion,
      [`participantesInfo.${usuario.uid}.estado`]:      miPerfil.privacidad?.mostrarEstadoEnLinea !== false ? miPerfil.estado : "offline",
      ...(otroUid ? { [`noLeidos.${otroUid}`]: (conv?.noLeidos?.[otroUid] ?? 0) + 1 } : {}),
    }).catch(e => console.warn("updateDoc conv metadata:", e));
  }

  const convSel = conversaciones.find(c => c.id === convSelId);
  const otroUid = convSel?.participantes.find(p => p !== usuario?.uid) ?? "";
  const otroPerfil = convSel?.participantesInfo[otroUid];
  // Respetar privacidad del otro usuario al mostrar estado en el encabezado
  const otroMuestraEstado = perfilOtroFull?.privacidad?.mostrarEstadoEnLinea !== false;
  const estadoOtroReal = otroMuestraEstado ? (otroPerfil?.estado ?? "offline") : "offline";
  const estadoOtroLabel = otroMuestraEstado
    ? ({ online: "En línea", ausente: "Ausente", offline: "Desconectado" }[estadoOtroReal] ?? "Desconectado")
    : "Estado no disponible";
  const estadoOtroColor = otroMuestraEstado
    ? ({ online: "#22c55e", ausente: "#f59e0b", offline: "#6b7280" }[estadoOtroReal] ?? "#6b7280")
    : "#374151";

  function needsSep(i: number): boolean {
    if (i === 0) return true;
    const a = mensajes[i - 1].timestamp, b = mensajes[i].timestamp;
    if (!a || !b) return false;
    return a.toDate().toDateString() !== b.toDate().toDateString();
  }

  if (cargando) return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1a" }}>
      <div style={{ textAlign: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: "#1fb2a6", display: "block", marginBottom: 12 }} />
        <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Cargando mensajes...</p>
      </div>
    </div>
  );

  if (onboarding && usuario) return (
    <div style={{ height: "100%" }}>
      <Onboarding uid={usuario.uid} email={usuario.email} nombre={usuario.nombre} liceoId={usuario.liceoId}
        onDone={p => { setMiPerfil(p); setOnboarding(false); }} />
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden", background: "#0a0f1a", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── COLUMNA IZQUIERDA ── */}
      {miPerfil && usuario && (
        <LeftSidebar
          conversaciones={conversaciones} selectedId={convSelId}
          onSelect={id => { setConvSelId(id); setShowPerfil(false); }}
          miUid={usuario.uid} onNuevoChat={() => setShowNuevoChat(true)}
          busqueda={busqueda} setBusqueda={setBusqueda}
          miPerfil={miPerfil} onActualizarPerfil={actualizarPerfil}
          onToast={() => {}} onEstadoChange={propagarEstado} />
      )}

      {/* ── COLUMNA CENTRAL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {!convSel ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0a0f1a" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "#111827", border: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-comments" style={{ fontSize: 30, color: "#1f2937" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#4b5563", fontSize: 15, margin: "0 0 6px", fontWeight: 500 }}>Selecciona una conversación para comenzar</p>
              <p style={{ color: "#374151", fontSize: 13, margin: 0 }}>O inicia un nuevo chat con un colega</p>
            </div>
            <button onClick={() => setShowNuevoChat(true)}
              style={{ background: "linear-gradient(135deg,#1fb2a6,#3b82f6)", border: "none", borderRadius: 11, padding: "10px 22px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8 }} />Nuevo chat
            </button>
          </div>
        ) : (
          <>
            {/* Encabezado */}
            <div style={{ padding: "11px 18px", borderBottom: "1px solid #1a2338", display: "flex", alignItems: "center", gap: 12, background: "#0d1829", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setShowPerfil(s => !s)}>
                <Avatar nombre={otroPerfil?.nombre || "?"} fotoURL={otroPerfil?.fotoURL} size={42} estado={otroMuestraEstado ? otroPerfil?.estado : undefined} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{otroPerfil?.nombre || "Usuario"}</p>
                  <p style={{ color: estadoOtroColor, fontSize: 12, margin: "2px 0 0" }}>● {estadoOtroLabel}{otroPerfil?.cargo ? ` · ${otroPerfil.cargo}` : ""}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <HdrBtn icon="fa-phone" title="Llamada (próximamente)" disabled />
                <HdrBtn icon="fa-video" title="Videollamada (próximamente)" disabled />
                <HdrBtn icon="fa-magnifying-glass" title="Buscar en chat (próximamente)" disabled />
                <HdrBtn icon="fa-ellipsis-vertical" title="Ver perfil" onClick={() => setShowPerfil(s => !s)} />
              </div>
            </div>

            {/* Contador de expiración */}
            <ContadorExpiracion primerMensajeEn={convSel.primerMensajeEn ?? null} />

            {/* Mensajes */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px", scrollbarWidth: "thin", scrollbarColor: "#1f2937 transparent", background: "#0a0f1a" }}>
              {mensajes.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
                  <Avatar nombre={otroPerfil?.nombre || "?"} fotoURL={otroPerfil?.fotoURL} size={56} />
                  <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600, margin: 0 }}>{otroPerfil?.nombre}</p>
                  <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Aún no hay mensajes. ¡Di hola! 👋</p>
                </div>
              ) : mensajes.map((msg, i) => (
                <div key={msg.id}>
                  {needsSep(i) && (
                    <div style={{ textAlign: "center", margin: "16px 0 12px" }}>
                      <span style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: "3px 14px", color: "#6b7280", fontSize: 11 }}>{fmtFechaLarga(msg.timestamp)}</span>
                    </div>
                  )}
                  <BurbujaMsg
                    msg={msg}
                    esMio={msg.senderId === usuario?.uid}
                    onEditar={editarMensaje}
                    onEliminarParaTodos={eliminarParaTodos}
                    onEliminarParaMi={eliminarParaMi}
                  />
                </div>
              ))}
              <div ref={mensajesEndRef} style={{ height: 8 }} />
            </div>

            {usuario && <InputArea onEnviar={enviarMensaje} convId={convSel.id} />}
          </>
        )}
      </div>

      {/* ── PANEL PERFIL OTRO USUARIO ── */}
      {showPerfil && otroPerfil && (
        <ProfilePanel
          perfil={{ ...otroPerfil, email: perfilOtroFull?.email ?? "", creadoEn: perfilOtroFull?.creadoEn ?? null, descripcion: perfilOtroFull?.descripcion ?? "", ultimaConexion: perfilOtroFull?.ultimaConexion ?? null }}
          privacidad={perfilOtroFull?.privacidad}
          onClose={() => setShowPerfil(false)} />
      )}

      {/* ── MODAL NUEVO CHAT ── */}
      {showNuevoChat && usuario && miPerfil && (
        <NuevoChatModal miUid={usuario.uid} miPerfil={miPerfil} onIniciar={convId => { setConvSelId(convId); setShowNuevoChat(false); }} onClose={() => setShowNuevoChat(false)} />
      )}

      {/* ── AVISO EXPIRACIÓN POR UMBRAL ── */}
      {avisoHoras !== null && (
        <AvisoTemporalModal
          horasRestantes={avisoHoras}
          onEntendido={() => setAvisoHoras(null)}
        />
      )}

      {/* ── OVERLAY LIMPIEZA ── */}
      {limpiando && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,15,26,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)" }}>
          <div style={{ textAlign: "center" }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: "#1fb2a6", display: "block", marginBottom: 10 }} />
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Limpiando conversación expirada…</p>
          </div>
        </div>
      )}

      {/* ── TOAST GLOBAL PÁGINA ── */}
      <Toast msg={toastPagMsg} visible={toastPagVis} tipo={toastPagTipo} />
    </div>
  );
}
