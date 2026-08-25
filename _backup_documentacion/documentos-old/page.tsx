"use client";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  collection, query, where, onSnapshot, addDoc,
  deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Doc {
  id: string; nombre: string; url: string; tipo: string; tamaño: number;
  categoria: string; subcategoria: string; empresa: string; carrera: string;
  autor: string; version: string; estado: string;
  estadoFirma?: string; firmantes?: string[]; firmasCompletadas?: number;
  fechaEnvio?: string; fechaFirma?: string; fechaRenovacion?: string;
  etiquetas: string[]; descripcion: string; favorito: boolean;
  liceoId: string; subidoPor: string; creadoEn: string; actualizadoEn: string;
  estudiante?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  { id: "Convenios",           color: "#a78bfa", icon: "fa-handshake" },
  { id: "Plan Formativo",      color: "#3b82f6", icon: "fa-clipboard-list" },
  { id: "Bitácoras",           color: "#06b6d4", icon: "fa-book" },
  { id: "Informes",            color: "#f59e0b", icon: "fa-chart-bar" },
  { id: "Evaluaciones",        color: "#f97316", icon: "fa-clipboard-check" },
  { id: "Certificados",        color: "#22c55e", icon: "fa-certificate" },
  { id: "Autorizaciones",      color: "#14b8a6", icon: "fa-stamp" },
  { id: "Documentación Legal", color: "#ef4444", icon: "fa-scale-balanced" },
  { id: "Formularios",         color: "#6366f1", icon: "fa-rectangle-list" },
  { id: "Otros",               color: "#64748b", icon: "fa-file" },
];

const ESTADOS: Record<string, { color: string; bg: string }> = {
  "Vigente":     { color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  "Pendiente":   { color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  "Firmado":     { color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  "En revisión": { color: "#06b6d4", bg: "rgba(6,182,212,.12)" },
  "Rechazado":   { color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  "Expirado":    { color: "#64748b", bg: "rgba(100,116,139,.12)" },
};

const CAT_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}
function fmtSize(b: number) {
  if (!b) return "—";
  if (b < 1024) return b + "B";
  if (b < 1048576) return (b / 1024).toFixed(1) + "KB";
  return (b / 1048576).toFixed(1) + "MB";
}
function extOf(tipo: string, nombre: string) {
  if (tipo?.includes("pdf")) return "PDF";
  if (tipo?.includes("word") || tipo?.includes("document")) return "DOCX";
  if (tipo?.includes("sheet") || tipo?.includes("excel")) return "XLSX";
  if (tipo?.includes("presentation") || tipo?.includes("powerpoint")) return "PPTX";
  if (tipo?.includes("image")) return "IMG";
  if (tipo?.includes("zip")) return "ZIP";
  return nombre?.split(".").pop()?.toUpperCase() || "FILE";
}

// ── FileIcon ───────────────────────────────────────────────────────────────────
function FileIcon({ tipo, nombre, size = 16 }: { tipo: string; nombre: string; size?: number }) {
  const ext = extOf(tipo, nombre);
  const map: Record<string, { i: string; c: string }> = {
    PDF:  { i: "fa-file-pdf",        c: "#ef4444" },
    DOCX: { i: "fa-file-word",       c: "#3b82f6" },
    XLSX: { i: "fa-file-excel",      c: "#22c55e" },
    PPTX: { i: "fa-file-powerpoint", c: "#f97316" },
    IMG:  { i: "fa-file-image",      c: "#a78bfa" },
    ZIP:  { i: "fa-file-zipper",     c: "#f59e0b" },
  };
  const r = map[ext] ?? { i: "fa-file", c: "#64748b" };
  return <i className={`fa-solid ${r.i}`} style={{ fontSize: size, color: r.c, flexShrink: 0 }} />;
}

// ── CatBadge ───────────────────────────────────────────────────────────────────
function CatBadge({ cat }: { cat: string }) {
  const c = CAT_MAP[cat]?.color ?? "#64748b";
  return (
    <span style={{ background: `${c}18`, color: c, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", border: `1px solid ${c}30` }}>
      {cat || "—"}
    </span>
  );
}

// ── EstadoBadge ────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADOS[estado] ?? { color: "#64748b", bg: "rgba(100,116,139,.12)" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", border: `1px solid ${s.color}30` }}>
      {estado || "—"}
    </span>
  );
}

// ── FirmasBadge ────────────────────────────────────────────────────────────────
function FirmasBadge({ completadas, total, onClick }: { completadas: number; total: number; onClick: () => void }) {
  if (!total) return <span style={{ color: "#334155", fontSize: 12 }}>—</span>;
  const done = completadas >= total;
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: done ? "#22c55e" : "#f59e0b" }}>
        {completadas}/{total}
      </span>
    </button>
  );
}

// ── FilterSelect ───────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: "7px 28px 7px 10px", background: "#111827", border: "1px solid #1f2937",
          borderRadius: 8, color: value ? "#f1f5f9" : "#475569", fontSize: 12,
          fontFamily: "inherit", outline: "none", cursor: "pointer",
          appearance: "none", WebkitAppearance: "none",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#475569", pointerEvents: "none" }} />
    </div>
  );
}

// ── AccionesMenu ───────────────────────────────────────────────────────────────
function AccionesMenu({ d, onVer, onEditar, onEliminar, onFirmar }: {
  d: Doc; onVer: () => void; onEditar: () => void; onEliminar: () => void; onFirmar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
    { icon: "fa-eye",        label: "Ver",       action: () => { onVer(); setOpen(false); } },
    { icon: "fa-download",   label: "Descargar", action: () => { window.open(d.url, "_blank"); setOpen(false); } },
    { icon: "fa-pen",        label: "Editar",    action: () => { onEditar(); setOpen(false); } },
    { icon: "fa-pen-nib",    label: "Firmar",    action: () => { onFirmar(); setOpen(false); } },
    { icon: "fa-share-nodes",label: "Compartir", action: () => { navigator.clipboard.writeText(d.url); setOpen(false); } },
    { icon: "fa-trash",      label: "Eliminar",  action: () => { onEliminar(); setOpen(false); }, danger: true },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: 14 }}
        onMouseOver={e => e.currentTarget.style.color = "#f1f5f9"}
        onMouseOut={e => e.currentTarget.style.color = "#475569"}
      >
        <i className="fa-solid fa-ellipsis" />
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", zIndex: 100,
          background: "#1a2438", border: "1px solid #1f2937", borderRadius: 10,
          padding: "4px", minWidth: 150, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        }}>
          {items.map(item => (
            <button key={item.label} onClick={item.action} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "8px 12px", background: "none", border: "none", borderRadius: 7,
              color: item.danger ? "#ef4444" : "#cbd5e1", fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}
              onMouseOver={e => e.currentTarget.style.background = item.danger ? "rgba(239,68,68,.1)" : "rgba(255,255,255,.06)"}
              onMouseOut={e => e.currentTarget.style.background = "none"}
            >
              <i className={`fa-solid ${item.icon}`} style={{ width: 14, fontSize: 11, textAlign: "center" }} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DrawerPanel ────────────────────────────────────────────────────────────────
function DrawerPanel({ d, onClose, onFirmar }: { d: Doc; onClose: () => void; onFirmar: () => void }) {
  const cat = CAT_MAP[d.categoria];
  const estado = ESTADOS[d.estado] ?? { color: "#64748b", bg: "rgba(100,116,139,.12)" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "#0d1421", borderLeft: "1px solid #1f2937",
        zIndex: 201, display: "flex", flexDirection: "column",
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: "-8px 0 40px rgba(0,0,0,.4)",
        animation: "slideIn .2s ease",
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <FileIcon tipo={d.tipo} nombre={d.nombre} size={18} />
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <CatBadge cat={d.categoria} />
              <EstadoBadge estado={d.estado} />
              <span style={{ color: "#475569", fontSize: 10 }}>{fmtSize(d.tamaño)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: 4, flexShrink: 0 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Preview area */}
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, height: 180, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <FileIcon tipo={d.tipo} nombre={d.nombre} size={40} />
                <span style={{ color: "#3b82f6", fontSize: 12 }}>Abrir archivo</span>
              </a>
            ) : (
              <div style={{ textAlign: "center" }}>
                <FileIcon tipo={d.tipo} nombre={d.nombre} size={40} />
                <p style={{ color: "#334155", fontSize: 12, marginTop: 8 }}>Sin vista previa</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          {([
            ["Categoría",    d.categoria],
            ["Empresa",      d.empresa],
            ["Estudiante",   d.estudiante ?? d.autor],
            ["Responsable",  d.autor],
            ["Versión",      d.version],
            ["Cargado",      fmtDate(d.creadoEn)],
            ["Modificado",   fmtDate(d.actualizadoEn)],
            ["Tamaño",       fmtSize(d.tamaño)],
          ] as [string, string][]).map(([k, v]) => v && v !== "—" ? (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #0f1929" }}>
              <span style={{ color: "#475569", fontSize: 12 }}>{k}</span>
              <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 500, maxWidth: 220, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ) : null)}

          {/* Descripción */}
          {d.descripcion && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Descripción</p>
              <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{d.descripcion}</p>
            </div>
          )}

          {/* Firmantes */}
          {(d.firmantes?.length ?? 0) > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Firmantes</p>
              {d.firmantes!.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #0f1929" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#60a5fa", fontWeight: 700 }}>
                    {f.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{f}</span>
                  <span style={{ marginLeft: "auto", color: "#22c55e", fontSize: 10 }}>
                    {i < (d.firmasCompletadas ?? 0) ? "✓ Firmado" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Etiquetas */}
          {d.etiquetas?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Etiquetas</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d.etiquetas.map(e => (
                  <span key={e} style={{ background: "#1a2438", color: "#64748b", fontSize: 11, padding: "2px 8px", borderRadius: 99, border: "1px solid #1f2937" }}>{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #1f2937", display: "flex", gap: 8 }}>
          <a href={d.url} target="_blank" rel="noreferrer" style={{
            flex: 1, padding: "9px 0", background: "transparent", border: "1px solid #1f2937",
            borderRadius: 8, color: "#94a3b8", fontSize: 13, textAlign: "center", textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <i className="fa-solid fa-download" style={{ fontSize: 12 }} /> Descargar
          </a>
          <button onClick={onFirmar} style={{
            flex: 1, padding: "9px 0", background: "#2563eb", border: "none",
            borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <i className="fa-solid fa-pen-nib" style={{ fontSize: 12 }} /> Firmar
          </button>
          <button onClick={() => navigator.clipboard.writeText(d.url)} style={{
            padding: "9px 14px", background: "transparent", border: "1px solid #1f2937",
            borderRadius: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer",
          }}>
            <i className="fa-solid fa-share-nodes" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── UploadModal ────────────────────────────────────────────────────────────────
function UploadModal({ onClose, liceoId, usuarioNombre, estudiantesOpts, empresasOpts }: {
  onClose: () => void; liceoId: string; usuarioNombre: string;
  estudiantesOpts: string[]; empresasOpts: string[];
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [estudiante, setEstudiante] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleUpload() {
    if (!file || !categoria) return;
    setUploading(true);
    const path = `documentos/${liceoId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      () => setUploading(false),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "documentos"), {
          nombre: file.name, url, tipo: file.type, tamaño: file.size,
          categoria, empresa, estudiante, descripcion,
          subcategoria: "", carrera: "", autor: usuarioNombre,
          version: "1.0", estado: "Vigente", estadoFirma: "",
          firmantes: [], firmasCompletadas: 0, etiquetas: [],
          favorito: false, liceoId, subidoPor: usuarioNombre,
          creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
          creadoEnServer: serverTimestamp(),
        });
        setDone(true); setUploading(false);
        setTimeout(onClose, 1200);
      }
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, width: "100%", maxWidth: 520, fontFamily: "'Inter',system-ui,sans-serif" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Subir documento</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#14532d20", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <i className="fa-solid fa-check" style={{ color: "#22c55e", fontSize: 22 }} />
              </div>
              <p style={{ color: "#f1f5f9", fontWeight: 700, margin: 0 }}>¡Documento subido!</p>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#3b82f6" : file ? "#22c55e" : "#1f2937"}`,
                  borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer",
                  background: dragging ? "rgba(59,130,246,.06)" : "transparent", marginBottom: 16,
                  transition: "all .2s",
                }}
              >
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                {file ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                    <i className="fa-solid fa-file-circle-check" style={{ color: "#22c55e", fontSize: 20 }} />
                    <div style={{ textAlign: "left" }}>
                      <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, margin: 0 }}>{file.name}</p>
                      <p style={{ color: "#64748b", fontSize: 11, margin: 0 }}>{(file.size / 1048576).toFixed(2)} MB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up" style={{ color: "#334155", fontSize: 32, display: "block", marginBottom: 8 }} />
                    <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Arrastra un archivo o haz clic</p>
                    <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>PDF, DOCX, XLSX, PPTX, imágenes y más</p>
                  </>
                )}
              </div>

              {/* Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 4 }}>Categoría *</label>
                  <div style={{ position: "relative" }}>
                    <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ width: "100%", padding: "8px 28px 8px 10px", background: "#1a2438", border: `1px solid ${!categoria && uploading ? "#ef4444" : "#1f2937"}`, borderRadius: 8, color: categoria ? "#f1f5f9" : "#475569", fontSize: 12, fontFamily: "inherit", outline: "none", appearance: "none" }}>
                      <option value="">Seleccionar...</option>
                      {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#475569", pointerEvents: "none" }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 4 }}>Empresa</label>
                  <div style={{ position: "relative" }}>
                    <select value={empresa} onChange={e => setEmpresa(e.target.value)} style={{ width: "100%", padding: "8px 28px 8px 10px", background: "#1a2438", border: "1px solid #1f2937", borderRadius: 8, color: empresa ? "#f1f5f9" : "#475569", fontSize: 12, fontFamily: "inherit", outline: "none", appearance: "none", WebkitAppearance: "none", boxSizing: "border-box" }}>
                      <option value="">Seleccionar empresa...</option>
                      {empresasOpts.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#475569", pointerEvents: "none" }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 4 }}>Estudiante</label>
                  <div style={{ position: "relative" }}>
                    <select value={estudiante} onChange={e => setEstudiante(e.target.value)} style={{ width: "100%", padding: "8px 28px 8px 10px", background: "#1a2438", border: "1px solid #1f2937", borderRadius: 8, color: estudiante ? "#f1f5f9" : "#475569", fontSize: 12, fontFamily: "inherit", outline: "none", appearance: "none", WebkitAppearance: "none", boxSizing: "border-box" }}>
                      <option value="">Seleccionar estudiante...</option>
                      {estudiantesOpts.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#475569", pointerEvents: "none" }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 4 }}>Descripción</label>
                  <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Breve descripción" style={{ width: "100%", padding: "8px 10px", background: "#1a2438", border: "1px solid #1f2937", borderRadius: 8, color: "#f1f5f9", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Progress */}
              {uploading && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#64748b", fontSize: 11 }}>Subiendo...</span>
                    <span style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700 }}>{progress}%</span>
                  </div>
                  <div style={{ height: 4, background: "#1f2937", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "#3b82f6", borderRadius: 99, transition: "width .3s" }} />
                  </div>
                </div>
              )}

              <button onClick={handleUpload} disabled={!file || !categoria || uploading} style={{
                width: "100%", padding: "11px 0", background: !file || !categoria ? "#1a2438" : "#2563eb",
                border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: !file || !categoria || uploading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {uploading ? <><i className="fa-solid fa-spinner fa-spin" /> Subiendo...</> : <><i className="fa-solid fa-cloud-arrow-up" /> Subir documento</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TablaView ──────────────────────────────────────────────────────────────────
const COL = "24px minmax(0,1fr) 130px 120px 120px 100px 90px 70px 60px 44px";

function TablaView({ docs, sel, toggleSel, allSel, toggleAll, onRowClick, onEliminar, onFirmar }: {
  docs: Doc[]; sel: Set<string>; toggleSel: (id: string) => void;
  allSel: boolean; toggleAll: () => void;
  onRowClick: (d: Doc) => void; onEliminar: (d: Doc) => void; onFirmar: (d: Doc) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: COL, gap: 8, padding: "0 16px", height: 36, alignItems: "center", borderBottom: "1px solid #1f2937", background: "#0a0f1a", position: "sticky", top: 0, zIndex: 10, minWidth: 900 }}>
        <input type="checkbox" checked={allSel} onChange={toggleAll} style={{ cursor: "pointer", accentColor: "#2563eb" }} />
        {["Nombre", "Categoría", "Estudiante", "Empresa", "Cargado", "Estado", "Firmas", ""].map((h, i) => (
          <span key={i} style={{ color: "#374151", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ minWidth: 900 }}>
        {docs.length === 0 && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <i className="fa-solid fa-folder-open" style={{ color: "#1f2937", fontSize: 36, display: "block", marginBottom: 12 }} />
            <p style={{ color: "#334155", fontSize: 14, margin: 0 }}>No hay documentos</p>
          </div>
        )}
        {docs.map(d => {
          const isSel = sel.has(d.id);
          return (
            <div key={d.id}
              style={{ display: "grid", gridTemplateColumns: COL, gap: 8, padding: "0 16px", height: 46, alignItems: "center", borderBottom: "1px solid #0d1421", background: isSel ? "rgba(37,99,235,.07)" : "transparent", cursor: "pointer", transition: "background .1s" }}
              onMouseOver={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
              onMouseOut={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              onClick={() => onRowClick(d)}
            >
              <input type="checkbox" checked={isSel} onChange={() => toggleSel(d.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", accentColor: "#2563eb" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <FileIcon tipo={d.tipo} nombre={d.nombre} size={14} />
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</span>
              </div>

              <div><CatBadge cat={d.categoria} /></div>

              <span style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.estudiante || d.autor || "—"}
              </span>
              <span style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.empresa || "—"}
              </span>
              <span style={{ color: "#475569", fontSize: 11 }}>{fmtDate(d.creadoEn)}</span>

              <div><EstadoBadge estado={d.estado} /></div>

              <FirmasBadge
                completadas={d.firmasCompletadas ?? 0}
                total={d.firmantes?.length ?? 0}
                onClick={() => onFirmar(d)}
              />

              <div onClick={e => e.stopPropagation()}>
                <AccionesMenu
                  d={d}
                  onVer={() => onRowClick(d)}
                  onEditar={() => onRowClick(d)}
                  onEliminar={() => onEliminar(d)}
                  onFirmar={() => onFirmar(d)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ListaView ──────────────────────────────────────────────────────────────────
function ListaView({ docs, sel, toggleSel, onRowClick, onEliminar, onFirmar }: {
  docs: Doc[]; sel: Set<string>; toggleSel: (id: string) => void;
  onRowClick: (d: Doc) => void; onEliminar: (d: Doc) => void; onFirmar: (d: Doc) => void;
}) {
  return (
    <div>
      {docs.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <i className="fa-solid fa-folder-open" style={{ color: "#1f2937", fontSize: 36, display: "block", marginBottom: 12 }} />
          <p style={{ color: "#334155", fontSize: 14, margin: 0 }}>No hay documentos</p>
        </div>
      )}
      {docs.map(d => {
        const isSel = sel.has(d.id);
        return (
          <div key={d.id}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #0d1421", background: isSel ? "rgba(37,99,235,.07)" : "transparent", cursor: "pointer", transition: "background .1s" }}
            onMouseOver={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
            onMouseOut={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
            onClick={() => onRowClick(d)}
          >
            <input type="checkbox" checked={isSel} onChange={() => toggleSel(d.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", accentColor: "#2563eb", flexShrink: 0 }} />
            <FileIcon tipo={d.tipo} nombre={d.nombre} size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <CatBadge cat={d.categoria} />
                <span style={{ color: "#475569", fontSize: 11 }}>{d.empresa || "—"}</span>
                <span style={{ color: "#334155", fontSize: 11 }}>{fmtDate(d.creadoEn)}</span>
              </div>
            </div>
            <EstadoBadge estado={d.estado} />
            <div onClick={e => e.stopPropagation()}>
              <AccionesMenu d={d} onVer={() => onRowClick(d)} onEditar={() => onRowClick(d)} onEliminar={() => onEliminar(d)} onFirmar={() => onFirmar(d)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CarpetasView ───────────────────────────────────────────────────────────────
function CarpetasView({ docs, onRowClick, onEliminar, onFirmar }: {
  docs: Doc[]; onRowClick: (d: Doc) => void; onEliminar: (d: Doc) => void; onFirmar: (d: Doc) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const grouped = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    docs.forEach(d => { if (!map[d.categoria]) map[d.categoria] = []; map[d.categoria].push(d); });
    return map;
  }, [docs]);

  return (
    <div style={{ padding: "8px 0" }}>
      {Object.entries(grouped).map(([cat, catDocs]) => {
        const catData = CAT_MAP[cat];
        const isOpen = expanded.has(cat);
        return (
          <div key={cat}>
            <div onClick={() => toggle(cat)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid #0d1421" }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.03)"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: "#475569", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", width: 14 }} />
              <i className={`fa-solid ${catData?.icon ?? "fa-folder"}`} style={{ color: catData?.color ?? "#64748b", fontSize: 14 }} />
              <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{cat}</span>
              <span style={{ background: "#1f2937", color: "#64748b", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, marginLeft: 4 }}>{catDocs.length}</span>
            </div>
            {isOpen && catDocs.map(d => (
              <div key={d.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px 9px 44px", borderBottom: "1px solid #090f1a", cursor: "pointer" }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.025)"}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}
                onClick={() => onRowClick(d)}
              >
                <FileIcon tipo={d.tipo} nombre={d.nombre} size={14} />
                <span style={{ flex: 1, color: "#cbd5e1", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</span>
                <span style={{ color: "#334155", fontSize: 11 }}>{fmtDate(d.creadoEn)}</span>
                <EstadoBadge estado={d.estado} />
                <div onClick={e => e.stopPropagation()}>
                  <AccionesMenu d={d} onVer={() => onRowClick(d)} onEditar={() => onRowClick(d)} onEliminar={() => onEliminar(d)} onFirmar={() => onFirmar(d)} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {Object.keys(grouped).length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <i className="fa-solid fa-folder-open" style={{ color: "#1f2937", fontSize: 36, display: "block", marginBottom: 12 }} />
          <p style={{ color: "#334155", fontSize: 14, margin: 0 }}>No hay documentos</p>
        </div>
      )}
    </div>
  );
}

// ── Page sizes & ruler constants ───────────────────────────────────────────────
const PX_PER_CM = 37.795;
const MAR_H = 80;   // horizontal margin px (≈ 2.12 cm)
const MAR_V = 72;   // vertical   margin px (≈ 1.90 cm)

const PAGE_SIZES = [
  { id: "a4",     label: "A4",     w: 794,  h: 1123, wCm: 21,    hCm: 29.7, desc: "21 × 29,7 cm" },
  { id: "carta",  label: "Carta",  w: 816,  h: 1056, wCm: 21.59, hCm: 27.94, desc: "21,6 × 27,9 cm" },
  { id: "oficio", label: "Oficio", w: 816,  h: 1344, wCm: 21.59, hCm: 35.56, desc: "21,6 × 35,6 cm" },
  { id: "a3",     label: "A3",     w: 1123, h: 1587, wCm: 29.7,  hCm: 42,   desc: "29,7 × 42 cm" },
  { id: "a5",     label: "A5",     w: 559,  h: 794,  wCm: 14.8,  hCm: 21,   desc: "14,8 × 21 cm" },
] as const;
type PageSizeId = typeof PAGE_SIZES[number]["id"];

function HRuler({ w, wCm }: { w: number; wCm: number }) {
  const ticks: { x: number; h: number; label?: string }[] = [];
  for (let mm = 0; mm <= Math.ceil(wCm * 10); mm++) {
    const x = +(mm * PX_PER_CM / 10).toFixed(2);
    if (x > w + 1) break;
    const isCm = mm % 10 === 0;
    const isHalf = mm % 5 === 0 && !isCm;
    ticks.push({ x, h: isCm ? 11 : isHalf ? 7 : 4, label: isCm && mm > 0 ? String(mm / 10) : undefined });
  }
  return (
    <div style={{ width: w, height: 24, background: "#e4e4e4", position: "relative", overflow: "hidden", userSelect: "none", flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: MAR_H, height: 24, background: "#c2c2c2" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: MAR_H, height: 24, background: "#c2c2c2" }} />
      <svg width={w} height={24} style={{ position: "absolute", inset: 0 }}>
        {ticks.map(({ x, h, label }) => (
          <g key={x}>
            <line x1={x} y1={24 - h} x2={x} y2={24} stroke="#777" strokeWidth={h === 11 ? 1 : 0.5} />
            {label && <text x={x + 2} y={12} fill="#555" fontSize={8} fontFamily="system-ui,sans-serif">{label}</text>}
          </g>
        ))}
        <polygon points={`${MAR_H},0 ${MAR_H + 6},0 ${MAR_H},8`}     fill="#555" />
        <polygon points={`${w - MAR_H},0 ${w - MAR_H - 6},0 ${w - MAR_H},8`} fill="#555" />
      </svg>
    </div>
  );
}

function VRuler({ h, hCm }: { h: number; hCm: number }) {
  const ticks: { y: number; w: number; label?: string }[] = [];
  for (let mm = 0; mm <= Math.ceil(hCm * 10) + 10; mm++) {
    const y = +(mm * PX_PER_CM / 10).toFixed(2);
    if (y > h + 1) break;
    const isCm = mm % 10 === 0;
    const isHalf = mm % 5 === 0 && !isCm;
    const showLabel = isCm && mm > 0 && mm % 20 === 0;
    ticks.push({ y, w: isCm ? 11 : isHalf ? 7 : 4, label: showLabel ? String(mm / 10) : undefined });
  }
  return (
    <div style={{ width: 24, height: h, background: "#e4e4e4", position: "relative", overflow: "hidden", userSelect: "none", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 0,    left: 0, width: 24, height: MAR_V, background: "#c2c2c2" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 24, height: MAR_V, background: "#c2c2c2" }} />
      <svg width={24} height={h} style={{ position: "absolute", inset: 0 }}>
        {ticks.map(({ y, w: tw, label }) => (
          <g key={y}>
            <line x1={24 - tw} y1={y} x2={24} y2={y} stroke="#777" strokeWidth={tw === 11 ? 1 : 0.5} />
            {label && (
              <text x={12} y={y - 2} fill="#555" fontSize={8} fontFamily="system-ui,sans-serif"
                textAnchor="middle" transform={`rotate(-90,12,${y - 2})`}>{label}</text>
            )}
          </g>
        ))}
        <polygon points={`0,${MAR_V} 0,${MAR_V - 6} 8,${MAR_V}`}         fill="#555" />
        <polygon points={`0,${h - MAR_V} 0,${h - MAR_V + 6} 8,${h - MAR_V}`} fill="#555" />
      </svg>
    </div>
  );
}

const FONTS = [
  { label: "Calibri",           name: "Calibri" },
  { label: "Times New Roman",   name: "Times New Roman" },
  { label: "Arial",             name: "Arial" },
  { label: "Georgia",           name: "Georgia" },
  { label: "Verdana",           name: "Verdana" },
  { label: "Courier New",       name: "Courier New" },
  { label: "Trebuchet MS",      name: "Trebuchet MS" },
  { label: "Palatino Linotype", name: "Palatino Linotype" },
  { label: "Inter",             name: "Inter" },
  { label: "Roboto",            name: "Roboto" },
];

// ── EditorModal ────────────────────────────────────────────────────────────────
function EditorModal({ onClose, liceoId, usuarioNombre, estudiantesOpts, empresasOpts }: {
  onClose: () => void; liceoId: string; usuarioNombre: string;
  estudiantesOpts: string[]; empresasOpts: string[];
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [titulo, setTitulo] = useState("Nuevo documento");
  const [categoria, setCategoria] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [estudiante, setEstudiante] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [fmt, setFmt] = useState<Record<string, boolean>>({});
  const [sizeId, setSizeId] = useState<PageSizeId>("a4");
  const pSize = PAGE_SIZES.find(s => s.id === sizeId) ?? PAGE_SIZES[0];
  const [pageHeight, setPageHeight] = useState<number>(pSize.h);

  useEffect(() => {
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    if (editorRef.current) editorRef.current.focus();
    if (!document.getElementById("editor-gfonts")) {
      const link = document.createElement("link");
      link.id = "editor-gfonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setPageHeight(Math.max(pSize.h, Math.ceil(e.contentRect.height)));
    });
    ro.observe(editorRef.current);
    return () => ro.disconnect();
  }, [pSize.h]);

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    try { document.execCommand(command, false, value ?? undefined); } catch {}
    refreshFmt();
  }

  function refreshFmt() {
    try {
      setFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
      });
    } catch {}
  }

  function tbBtn(command: string, icon: string, title: string, active?: boolean) {
    return (
      <button
        key={command + icon}
        title={title}
        onMouseDown={e => { e.preventDefault(); cmd(command); }}
        style={{
          background: active ? "rgba(59,130,246,.2)" : "none",
          border: `1px solid ${active ? "rgba(59,130,246,.4)" : "transparent"}`,
          borderRadius: 5, color: active ? "#60a5fa" : "#94a3b8",
          padding: "4px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1,
        }}
      >
        <i className={`fa-solid ${icon}`} />
      </button>
    );
  }

  async function handleGuardar() {
    if (!categoria || uploading) return;
    const content = editorRef.current?.innerHTML ?? "<p></p>";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>@page{size:${pSize.wCm}cm ${pSize.hCm}cm;margin:2cm}body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.7;margin:2.54cm;color:#1a1a1a}h1{font-size:20pt}h2{font-size:16pt}h3{font-size:13pt}p{margin:.2cm 0}ul,ol{margin-left:1cm}blockquote{border-left:3px solid #aaa;margin:0 0 0 1cm;padding-left:.5cm;color:#555}</style></head><body>${content}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const safe = titulo.replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ\s]/g, "_").trim() || "documento";
    const fileName = `${safe}.html`;
    setUploading(true);
    const storRef = ref(storage, `documentos/${liceoId}/${Date.now()}_${fileName}`);
    const task = uploadBytesResumable(storRef, blob);
    task.on("state_changed",
      s => setProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)),
      () => setUploading(false),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "documentos"), {
          nombre: fileName, url, tipo: "text/html", tamaño: blob.size,
          categoria, empresa, estudiante, descripcion,
          subcategoria: "", carrera: "", autor: usuarioNombre,
          version: "1.0", estado: "Vigente", estadoFirma: "",
          firmantes: [], firmasCompletadas: 0, etiquetas: [],
          favorito: false, liceoId, subidoPor: usuarioNombre,
          creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
          creadoEnServer: serverTimestamp(),
        });
        setDone(true); setUploading(false);
        setTimeout(onClose, 1400);
      }
    );
  }

  const sep = <div style={{ width: 1, height: 20, background: "#1f2937", margin: "0 3px", flexShrink: 0 }} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#070d18", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#0d1421", borderBottom: "1px solid #1f2937", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <i className="fa-solid fa-file-word" style={{ color: "#3b82f6", fontSize: 18 }} />
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          style={{ flex: 1, background: "none", border: "none", color: "#f1f5f9", fontSize: 15, fontWeight: 700, fontFamily: "inherit", outline: "none" }}
          placeholder="Nombre del documento"
        />
        <span style={{ color: "#334155", fontSize: 11 }}>.html</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: "4px 6px" }}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "5px 16px", display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        {tbBtn("undo", "fa-rotate-left", "Deshacer")}
        {tbBtn("redo", "fa-rotate-right", "Rehacer")}
        {sep}
        {/* Font family selector */}
        <div style={{ position: "relative" }}>
          <select
            defaultValue="Calibri"
            onChange={e => { cmd("fontName", e.target.value); }}
            style={{
              background: "#1a2438", border: "1px solid #1f2937", borderRadius: 6,
              color: "#e2e8f0", fontSize: 11, padding: "4px 24px 4px 8px",
              fontFamily: "inherit", outline: "none", cursor: "pointer",
              appearance: "none", WebkitAppearance: "none", minWidth: 140,
            }}
          >
            {FONTS.map(f => (
              <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>
                {f.label}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#475569", pointerEvents: "none" }} />
        </div>
        {sep}
        {tbBtn("bold", "fa-bold", "Negrita", fmt.bold)}
        {tbBtn("italic", "fa-italic", "Cursiva", fmt.italic)}
        {tbBtn("underline", "fa-underline", "Subrayado", fmt.underline)}
        {tbBtn("strikeThrough", "fa-strikethrough", "Tachado", fmt.strikeThrough)}
        {sep}
        <div style={{ position: "relative" }}>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { cmd("formatBlock", e.target.value); e.target.value = ""; } }}
            style={{ background: "#1a2438", border: "1px solid #1f2937", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 22px 4px 8px", fontFamily: "inherit", outline: "none", cursor: "pointer", appearance: "none" }}
          >
            <option value="" disabled>Estilo</option>
            <option value="p">Normal</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
            <option value="blockquote">Cita</option>
          </select>
          <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#475569", pointerEvents: "none" }} />
        </div>
        {sep}
        {tbBtn("justifyLeft", "fa-align-left", "Izquierda", fmt.justifyLeft)}
        {tbBtn("justifyCenter", "fa-align-center", "Centrar", fmt.justifyCenter)}
        {tbBtn("justifyRight", "fa-align-right", "Derecha", fmt.justifyRight)}
        {tbBtn("justifyFull", "fa-align-justify", "Justificar")}
        {sep}
        {tbBtn("insertUnorderedList", "fa-list-ul", "Viñetas", fmt.ul)}
        {tbBtn("insertOrderedList", "fa-list-ol", "Numerada", fmt.ol)}
        {sep}
        {tbBtn("removeFormat", "fa-eraser", "Limpiar formato")}
        <label title="Color de texto" style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 5, border: "1px solid transparent", color: "#94a3b8", fontSize: 13, position: "relative" }}>
          <i className="fa-solid fa-palette" />
          <input type="color" defaultValue="#000000" onInput={e => cmd("foreColor", (e.target as HTMLInputElement).value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
        </label>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {uploading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 80, height: 4, background: "#1f2937", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "#3b82f6", borderRadius: 99, transition: "width .3s" }} />
              </div>
              <span style={{ color: "#64748b", fontSize: 11 }}>{progress}%</span>
            </div>
          )}
          {done && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}><i className="fa-solid fa-check" style={{ marginRight: 4 }} />Guardado</span>}
          {!categoria && <span style={{ color: "#f59e0b", fontSize: 11 }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />Elige categoría</span>}
          <button
            onClick={handleGuardar}
            disabled={!categoria || uploading || done}
            style={{
              background: !categoria || done ? "#1a2438" : "#2563eb",
              border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700,
              padding: "7px 18px", cursor: !categoria || uploading || done ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {uploading ? <><i className="fa-solid fa-spinner fa-spin" /> Guardando...</> : <><i className="fa-solid fa-floppy-disk" /> Guardar</>}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Document canvas */}
        <div style={{ flex: 1, overflow: "auto", background: "#1a1f2e", padding: "44px 60px 60px 64px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          <style>{`
            [contenteditable]:focus{outline:none}
            [contenteditable] p{margin:.25em 0}
            [contenteditable] h1{font-size:20pt;margin:.5em 0 .2em}
            [contenteditable] h2{font-size:15pt;margin:.5em 0 .2em}
            [contenteditable] h3{font-size:12pt;font-weight:700;margin:.4em 0 .1em}
            [contenteditable] ul,[contenteditable] ol{padding-left:1.5em;margin:.3em 0}
            [contenteditable] blockquote{border-left:3px solid #ccc;margin:.4em 0 .4em 1em;padding-left:.8em;color:#555}
            [contenteditable]:empty:before{content:attr(data-placeholder);color:#aaa;pointer-events:none}
          `}</style>

          {/* Wrapper — rulers positioned absolute around it */}
          <div style={{ position: "relative", flexShrink: 0 }}>

            {/* ── Horizontal ruler (above the page) ── */}
            <div style={{ position: "absolute", top: -24, left: -24, display: "flex", zIndex: 2 }}>
              {/* Corner square */}
              <div style={{ width: 24, height: 24, background: "#aaa", flexShrink: 0, borderRight: "1px solid #999", borderBottom: "1px solid #999" }} />
              <HRuler w={pSize.w} wCm={pSize.wCm} />
            </div>

            {/* ── Vertical ruler (left of the page) ── */}
            <div style={{ position: "absolute", top: 0, left: -24, zIndex: 2 }}>
              <VRuler h={pageHeight} hCm={pSize.hCm} />
            </div>

            {/* ── White page ── */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onKeyUp={refreshFmt}
              onMouseUp={refreshFmt}
              onFocus={refreshFmt}
              data-placeholder="Empieza a escribir aquí..."
              style={{
                width: pSize.w, flexShrink: 0, minHeight: pSize.h,
                background: "#fff",
                padding: `${MAR_V}px ${MAR_H}px`,
                color: "#1a1a1a", fontSize: "12pt", lineHeight: 1.7,
                fontFamily: "Calibri, Arial, sans-serif",
                boxShadow: "0 8px 48px rgba(0,0,0,.7), 0 0 0 1px rgba(0,0,0,.2)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Properties sidebar */}
        <div style={{ width: 230, background: "#0d1421", borderLeft: "1px solid #1f2937", padding: "18px 14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, flexShrink: 0 }}>
          <p style={{ color: "#475569", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, margin: 0, fontWeight: 700 }}>Propiedades</p>

          {/* Page size selector */}
          <div>
            <label style={{ color: "#64748b", fontSize: 10, display: "block", marginBottom: 5 }}>Tamaño de página</label>
            <div style={{ position: "relative" }}>
              <select
                value={sizeId}
                onChange={e => {
                  const id = e.target.value as PageSizeId;
                  setSizeId(id);
                  const s = PAGE_SIZES.find(p => p.id === id)!;
                  setPageHeight(s.h);
                }}
                style={{
                  width: "100%", padding: "7px 24px 7px 9px",
                  background: "#1a2438", border: "1px solid #1f2937",
                  borderRadius: 7, color: "#f1f5f9",
                  fontSize: 11, fontFamily: "inherit", outline: "none",
                  appearance: "none", boxSizing: "border-box",
                }}
              >
                {PAGE_SIZES.map(s => (
                  <option key={s.id} value={s.id}>{s.label} — {s.desc}</option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#475569", pointerEvents: "none" }} />
            </div>
          </div>

          {([
            { label: "Categoría *", value: categoria, set: setCategoria, opts: CATEGORIAS.map(c => c.id), ph: "Seleccionar..." },
            { label: "Empresa",     value: empresa,   set: setEmpresa,   opts: empresasOpts,               ph: "Seleccionar empresa..." },
            { label: "Estudiante",  value: estudiante, set: setEstudiante, opts: estudiantesOpts,           ph: "Seleccionar estudiante..." },
          ] as { label: string; value: string; set: (v: string) => void; opts: string[]; ph: string }[]).map(f => (
            <div key={f.label}>
              <label style={{ color: "#64748b", fontSize: 10, display: "block", marginBottom: 5 }}>{f.label}</label>
              <div style={{ position: "relative" }}>
                <select
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 24px 7px 9px",
                    background: "#1a2438",
                    border: `1px solid ${!f.value && f.label.includes("*") ? "#f59e0b55" : "#1f2937"}`,
                    borderRadius: 7, color: f.value ? "#f1f5f9" : "#475569",
                    fontSize: 11, fontFamily: "inherit", outline: "none",
                    appearance: "none", boxSizing: "border-box",
                  }}
                >
                  <option value="">{f.ph}</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down" style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#475569", pointerEvents: "none" }} />
              </div>
            </div>
          ))}

          <div>
            <label style={{ color: "#64748b", fontSize: 10, display: "block", marginBottom: 5 }}>Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Descripción breve..."
              style={{ width: "100%", padding: "7px 9px", background: "#1a2438", border: "1px solid #1f2937", borderRadius: 7, color: "#f1f5f9", fontSize: 11, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #1f2937" }}>
            <p style={{ color: "#334155", fontSize: 10, margin: 0, lineHeight: 1.6 }}>
              Se guarda como <strong style={{ color: "#475569" }}>.html</strong>, compatible con Word y cualquier navegador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DocumentosContent ──────────────────────────────────────────────────────────
function DocumentosContent() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [estudianteFilter, setEstudianteFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [view, setView] = useState<"tabla" | "lista" | "carpetas">("tabla");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Doc | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estudiantesFS, setEstudiantesFS] = useState<string[]>([]);
  const [empresasFS, setEmpresasFS] = useState<string[]>([]);

  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db, "documentos"), where("liceoId", "==", usuario.liceoId ?? "default"));
    return onSnapshot(q, snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doc)));
      setLoading(false);
    }, () => setLoading(false));
  }, [usuario?.uid]);

  // Fetch students from Firestore collection
  useEffect(() => {
    if (!usuario) return;
    const lid = usuario.liceoId ?? "default";
    const qE = query(collection(db, "estudiantes"), where("liceoId", "==", lid));
    const unsubE = onSnapshot(qE, snap => {
      const names = snap.docs.map(d => {
        const data = d.data();
        return data.nombre ?? data.nombreCompleto ?? data.name ?? "";
      }).filter(Boolean).sort() as string[];
      setEstudiantesFS(names);
    }, () => {});
    const qEmp = query(collection(db, "empresas"), where("liceoId", "==", lid));
    const unsubEmp = onSnapshot(qEmp, snap => {
      const names = snap.docs.map(d => {
        const data = d.data();
        return data.nombre ?? data.razonSocial ?? data.name ?? "";
      }).filter(Boolean).sort() as string[];
      setEmpresasFS(names);
    }, () => {});
    return () => { unsubE(); unsubEmp(); };
  }, [usuario?.uid]);

  // Derived filter options — merge Firestore lists with values found in existing docs
  const empresas = useMemo(() => {
    const fromDocs = docs.map(d => d.empresa).filter(Boolean) as string[];
    return [...new Set([...empresasFS, ...fromDocs])].sort();
  }, [docs, empresasFS]);

  const estudiantes = useMemo(() => {
    const fromDocs = docs.map(d => d.estudiante || d.autor).filter(Boolean) as string[];
    return [...new Set([...estudiantesFS, ...fromDocs])].sort();
  }, [docs, estudiantesFS]);

  const filtered = useMemo(() => {
    let r = docs.filter(d => {
      if (search && !d.nombre.toLowerCase().includes(search.toLowerCase()) && !d.empresa?.toLowerCase().includes(search.toLowerCase()) && !(d.estudiante ?? d.autor)?.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && d.categoria !== catFilter) return false;
      if (empresaFilter && d.empresa !== empresaFilter) return false;
      if (estudianteFilter && (d.estudiante ?? d.autor) !== estudianteFilter) return false;
      if (estadoFilter && d.estado !== estadoFilter) return false;
      return true;
    });
    r = r.sort((a, b) => {
      const da = new Date(a.creadoEn).getTime(), db2 = new Date(b.creadoEn).getTime();
      return sortDir === "desc" ? db2 - da : da - db2;
    });
    return r;
  }, [docs, search, catFilter, empresaFilter, estudianteFilter, estadoFilter, sortDir]);

  const allSel = filtered.length > 0 && filtered.every(d => sel.has(d.id));
  const toggleAll = () => {
    if (allSel) setSel(new Set());
    else setSel(new Set(filtered.map(d => d.id)));
  };
  const toggleSel = (id: string) => setSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  async function handleEliminar(d: Doc) {
    if (!confirm(`¿Eliminar "${d.nombre}"?`)) return;
    await deleteDoc(doc(db, "documentos", d.id));
    if (d.url) deleteObject(ref(storage, d.url)).catch(() => {});
    if (drawer?.id === d.id) setDrawer(null);
  }

  async function handleEliminarMasivo() {
    if (!confirm(`¿Eliminar ${sel.size} documentos?`)) return;
    const toDelete = docs.filter(d => sel.has(d.id));
    await Promise.all(toDelete.map(d => deleteDoc(doc(db, "documentos", d.id))));
    setSel(new Set());
  }

  const anyFilters = !!(search || catFilter || empresaFilter || estudianteFilter || estadoFilter);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#f1f5f9", display: "flex", flexDirection: "column" }}>

      {/* ── Sticky top bar ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#0a0f1a", borderBottom: "1px solid #1f2937" }}>
        {/* Title row */}
        <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 9 }}>
              <i className="fa-solid fa-folder-open" style={{ color: "#fbbf24", fontSize: 17 }} />
              Documentos
            </h1>
            <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>{filtered.length} documento{filtered.length !== 1 ? "s" : ""}{anyFilters ? " (filtrados)" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {sel.size > 0 && (
              <button onClick={handleEliminarMasivo} style={{ padding: "7px 14px", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fa-solid fa-trash" style={{ fontSize: 11 }} /> Eliminar {sel.size}
              </button>
            )}
            <button onClick={() => router.push("/dashboard/documentos/editor")} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2d3a52", borderRadius: 8, color: "#a78bfa", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
              <i className="fa-solid fa-file-pen" style={{ fontSize: 12 }} /> Crear documento
            </button>
            <button onClick={() => setShowUpload(true)} style={{ padding: "7px 16px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
              <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 12 }} /> Subir documento
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#334155", fontSize: 11 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar documentos..."
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: "#111827", border: "1px solid #1f2937", borderRadius: 8, color: "#f1f5f9", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <FilterSelect value={catFilter} onChange={setCatFilter} placeholder="Categoría" options={CATEGORIAS.map(c => ({ value: c.id, label: c.id }))} />
          <FilterSelect value={empresaFilter} onChange={setEmpresaFilter} placeholder="Empresa" options={empresas.map(e => ({ value: e, label: e }))} />
          <FilterSelect value={estudianteFilter} onChange={setEstudianteFilter} placeholder="Estudiante" options={estudiantes.map(e => ({ value: e, label: e }))} />
          <FilterSelect value={estadoFilter} onChange={setEstadoFilter} placeholder="Estado" options={Object.keys(ESTADOS).map(e => ({ value: e, label: e }))} />

          {/* Sort */}
          <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")} style={{ padding: "7px 12px", background: "#111827", border: "1px solid #1f2937", borderRadius: 8, color: "#64748b", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <i className={`fa-solid fa-arrow-${sortDir === "desc" ? "down" : "up"}`} style={{ fontSize: 10 }} />
            {sortDir === "desc" ? "Más reciente" : "Más antiguo"}
          </button>

          {anyFilters && (
            <button onClick={() => { setSearch(""); setCatFilter(""); setEmpresaFilter(""); setEstudianteFilter(""); setEstadoFilter(""); }} style={{ padding: "7px 12px", background: "transparent", border: "1px solid #1f2937", borderRadius: 8, color: "#ef4444", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} /> Limpiar
            </button>
          )}

          {/* View switcher */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 2, background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 2 }}>
            {([
              { id: "tabla",    icon: "fa-table" },
              { id: "lista",    icon: "fa-list" },
              { id: "carpetas", icon: "fa-folder" },
            ] as const).map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{ padding: "5px 10px", background: view === v.id ? "#1f2937" : "transparent", border: "none", borderRadius: 6, color: view === v.id ? "#f1f5f9" : "#475569", fontSize: 12, cursor: "pointer" }}>
                <i className={`fa-solid ${v.icon}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: "#3b82f6", fontSize: 28 }} />
          </div>
        ) : (
          <>
            {view === "tabla"    && <TablaView docs={filtered} sel={sel} toggleSel={toggleSel} allSel={allSel} toggleAll={toggleAll} onRowClick={setDrawer} onEliminar={handleEliminar} onFirmar={d => window.location.href = "/dashboard/firmas"} />}
            {view === "lista"    && <ListaView docs={filtered} sel={sel} toggleSel={toggleSel} onRowClick={setDrawer} onEliminar={handleEliminar} onFirmar={d => window.location.href = "/dashboard/firmas"} />}
            {view === "carpetas" && <CarpetasView docs={filtered} onRowClick={setDrawer} onEliminar={handleEliminar} onFirmar={d => window.location.href = "/dashboard/firmas"} />}
          </>
        )}
      </div>

      {/* Drawer */}
      {drawer && <DrawerPanel d={drawer} onClose={() => setDrawer(null)} onFirmar={() => window.location.href = "/dashboard/firmas"} />}

      {/* Upload modal */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} liceoId={usuario?.liceoId ?? "default"} usuarioNombre={usuario?.nombre ?? usuario?.email ?? "Usuario"} estudiantesOpts={estudiantes} empresasOpts={empresas} />}
      {showEditor && <EditorModal onClose={() => setShowEditor(false)} liceoId={usuario?.liceoId ?? "default"} usuarioNombre={usuario?.nombre ?? usuario?.email ?? "Usuario"} estudiantesOpts={estudiantes} empresasOpts={empresas} />}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────
export default function DocumentosPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ color: "#3b82f6", fontSize: 28 }} />
      </div>
    }>
      <DocumentosContent />
    </Suspense>
  );
}
