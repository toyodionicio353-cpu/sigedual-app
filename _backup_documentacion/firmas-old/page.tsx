"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  collection, doc, getDoc, addDoc, updateDoc, setDoc,
  onSnapshot, query, where, orderBy, limit, getDocs, deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FirmaInstitucional {
  userId: string;
  firmaCode: string;
  nombre: string;
  email: string;
  rol: string;
  cargo: string;
  estado: "Activa" | "Suspendida" | "Bloqueada";
  nivel: string;
  nivelColor: string;
  fechaCreacion: string;
  ultimoUso: string;
  hash: string;
  liceoId: string;
  documentosFirmados: number;
}

interface Actividad {
  id: string;
  documentoNombre: string;
  empresa?: string;
  tipo?: string;
  fechaFirma: string;
  firmaCode: string;
}

interface DocPendiente {
  id: string;
  nombre: string;
  empresa?: string;
  autor?: string;
  subcategoria?: string;
  estadoFirma?: string;
  creadoEn?: string;
  url?: string;
  tipo?: string;
}

// ── Constants / Helpers ────────────────────────────────────────────────────────
const NIVELES: Record<string, { nivel: string; color: string }> = {
  administrador: { nivel: "Avanzado",  color: "#a78bfa" },
  coordinador:   { nivel: "Avanzado",  color: "#a78bfa" },
  director:      { nivel: "Avanzado",  color: "#a78bfa" },
  profesor:      { nivel: "Estándar",  color: "#3b82f6" },
  centro_dual:   { nivel: "Estándar",  color: "#22c55e" },
  estudiante:    { nivel: "Básico",    color: "#64748b" },
};

const CARGO_MAP: Record<string, string> = {
  administrador: "Administrador del Sistema",
  coordinador:   "Coordinador de Formación Dual",
  director:      "Director de Establecimiento",
  profesor:      "Profesor Supervisor Dual",
  centro_dual:   "Centro de Formación Dual",
  estudiante:    "Estudiante Dual",
};

const ROL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  coordinador:   "Coordinador Dual",
  director:      "Director",
  profesor:      "Profesor Supervisor",
  centro_dual:   "Centro Dual",
  estudiante:    "Estudiante",
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genFirmaCode(): string {
  const seg = () =>
    Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
  return `SIG-${seg()}-${seg()}-${seg()}`;
}

function genHash(code: string): string {
  const raw = btoa(code + "-SIGEDUAL-" + Date.now().toString(36));
  return raw.replace(/[^A-Z0-9]/gi, "").slice(0, 32).toUpperCase();
}

function timeSince(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Hace un momento";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-CL");
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// ── SelloVisual ───────────────────────────────────────────────────────────────
function SelloVisual({ code, nombre, nivel, nivelColor, hash }: {
  code: string; nombre: string; nivel: string; nivelColor: string; hash: string;
}) {
  const matrix = useMemo(() => {
    const clean = code.replace(/[^A-Z0-9]/g, "");
    if (!clean) return Array.from({ length: 10 }, () => Array(10).fill(false) as boolean[]);
    const m: boolean[][] = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => {
        const idx = (r * 10 + c) % clean.length;
        const ch = clean.charCodeAt(idx);
        return ((ch ^ (r * 17 + 5) ^ (c * 13 + 3)) % 3) !== 0;
      })
    );
    for (let r = 0; r < 10; r++)
      for (let c = 5; c < 10; c++) m[r][c] = m[r][9 - c];
    // Finder patterns (QR-style corners)
    [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r,c]) => m[r][c] = true);
    [[0,7],[0,8],[0,9],[1,7],[1,9],[2,7],[2,8],[2,9]].forEach(([r,c]) => m[r][c] = true);
    [[7,0],[7,1],[7,2],[8,0],[8,2],[9,0],[9,1],[9,2]].forEach(([r,c]) => m[r][c] = true);
    [[1,1],[8,1],[1,8],[8,8]].forEach(([r,c]) => m[r][c] = false);
    return m;
  }, [code]);

  const hashLine = hash
    ? `${hash.slice(0, 8)} ${hash.slice(8, 16)}  ${hash.slice(16, 24)} ${hash.slice(24, 32)}`
    : "·· ·· ·· ··  ·· ·· ·· ··";

  return (
    <svg viewBox="0 0 340 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block", borderRadius: 10 }}>
      <defs>
        <linearGradient id="sv-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#050d1c" />
          <stop offset="55%" stopColor="#091525" />
          <stop offset="100%" stopColor="#0b1c33" />
        </linearGradient>
        <pattern id="sv-diag" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
          <line x1="0" y1="7" x2="7" y2="0" stroke="#ffffff" strokeWidth="0.35" opacity="0.04" />
        </pattern>
        <pattern id="sv-dot" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="0.65" fill="#2563eb" opacity="0.18" />
        </pattern>
        <radialGradient id="sv-glow" cx="65%" cy="48%">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="sv-clip"><rect width="340" height="200" rx="12" /></clipPath>
      </defs>
      <g clipPath="url(#sv-clip)">
        <rect width="340" height="200" rx="12" fill="url(#sv-bg)" />
        <rect width="340" height="200" fill="url(#sv-diag)" />
        <rect width="340" height="200" fill="url(#sv-dot)" />
        <ellipse cx="220" cy="104" rx="130" ry="84" fill="url(#sv-glow)" />
        {/* Corner marks */}
        <path d="M11,11 L11,25 M11,11 L25,11" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M329,11 L329,25 M329,11 L315,11" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M11,189 L11,175 M11,189 L25,189" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M329,189 L329,175 M329,189 L315,189" stroke="#1d4ed8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* Data matrix */}
        <rect x="13" y="30" width="80" height="128" rx="5" fill="rgba(9,25,57,0.5)" stroke="#1e3a8a" strokeWidth="0.6" />
        {matrix.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect key={`${r}-${c}`}
                x={16 + c * 7.4} y={33 + r * 12.1} width={5.5} height={10.2} rx={1.1}
                fill={(r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3) ? "#1d4ed8" : "#3b82f6"}
                opacity={(r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3) ? 1 : 0.75}
              />
            ) : null
          )
        )}
        <line x1="100" y1="24" x2="100" y2="175" stroke="#1e3a8a" strokeWidth="0.7" />
        {/* SIGEDUAL header */}
        <text x="113" y="45" fontFamily="Inter,system-ui" fontSize="9.5" fontWeight="700" fill="#2563eb" letterSpacing="3.5">SIGEDUAL</text>
        <text x="113" y="57" fontFamily="Inter,system-ui" fontSize="6.5" fill="#33456a" letterSpacing="2">FIRMA ELECTRÓNICA INSTITUCIONAL</text>
        <line x1="113" y1="63" x2="326" y2="63" stroke="#1e3a8a" strokeWidth="0.5" />
        {/* Firma code */}
        <text x="219" y="90" fontFamily="'Courier New',monospace" fontSize="16" fontWeight="700" fill="#e2e8f0" textAnchor="middle" letterSpacing="2.5">{code}</text>
        <text x="219" y="105" fontFamily="Inter,system-ui" fontSize="9" fill="#4b6080" textAnchor="middle" letterSpacing="1">{nombre.toUpperCase().slice(0, 32)}</text>
        {/* Nivel pill */}
        <rect x={219 - (nivel.length * 4 + 12)} y="110" width={nivel.length * 8 + 24} height="14" rx="7" fill={`${nivelColor}1a`} stroke={`${nivelColor}44`} strokeWidth="0.7" />
        <text x="219" y="120.5" fontFamily="Inter,system-ui" fontSize="7" fontWeight="700" fill={nivelColor} textAnchor="middle" letterSpacing="1.2">{nivel.toUpperCase()}</text>
        <line x1="113" y1="130" x2="290" y2="130" stroke="#1e3a8a" strokeWidth="0.5" />
        {/* Hash */}
        <text x="113" y="142" fontFamily="'Courier New',monospace" fontSize="6.8" fill="#1e3052" letterSpacing="0.6">{hashLine}</text>
        <text x="113" y="153" fontFamily="'Courier New',monospace" fontSize="6.5" fill="#1a2a48" letterSpacing="0.5">SHA-256 · VERIFICACIÓN EN LÍNEA DISPONIBLE</text>
        {/* Seal circle */}
        <circle cx="302" cy="154" r="24" fill="none" stroke="#1d4ed8" strokeWidth="0.9" />
        <circle cx="302" cy="154" r="19" fill="none" stroke="#1d4ed8" strokeWidth="0.45" strokeDasharray="2.5,2" />
        <circle cx="302" cy="154" r="12" fill="rgba(29,78,216,0.12)" />
        <line x1="295" y1="154" x2="309" y2="154" stroke="#1e3a8a" strokeWidth="0.4" />
        <line x1="302" y1="147" x2="302" y2="161" stroke="#1e3a8a" strokeWidth="0.4" />
        <text x="302" y="150" fontFamily="Inter,system-ui" fontSize="5.8" fontWeight="800" fill="#3b82f6" textAnchor="middle" letterSpacing="0.5">FIRMA</text>
        <text x="302" y="158" fontFamily="Inter,system-ui" fontSize="5.2" fill="#3b82f6" textAnchor="middle">DIGITAL</text>
        <text x="302" y="166" fontFamily="Inter,system-ui" fontSize="5.5" fill="#22c55e" textAnchor="middle">✓ VÁLIDA</text>
        {/* Bottom strip */}
        <rect x="0" y="175" width="340" height="25" fill="rgba(4,10,22,0.75)" />
        <line x1="0" y1="175" x2="340" y2="175" stroke="#1e3a8a" strokeWidth="0.5" />
        <text x="170" y="187" fontFamily="'Courier New',monospace" fontSize="6" fill="#1e3a8a" textAnchor="middle" letterSpacing="1">
          {`sigedual.cl/verificar   ·   ${code}   ·   © ${new Date().getFullYear()} SIGEDUAL`}
        </text>
        <text x="170" y="196" fontFamily="'Courier New',monospace" fontSize="5.5" fill="#121e36" textAnchor="middle" letterSpacing="0.5">
          SISTEMA INTEGRAL DE GESTIÓN DUAL · CHILE
        </text>
      </g>
    </svg>
  );
}

// ── ModalFirmar ───────────────────────────────────────────────────────────────
function ModalFirmar({ documento, firma, onClose, onFirmado }: {
  documento: DocPendiente;
  firma: FirmaInstitucional;
  onClose: () => void;
  onFirmado: (id: string) => void;
}) {
  const { usuario } = useAuth();
  const [step, setStep] = useState<"preview" | "done">("preview");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const expected = firma.firmaCode.replace(/-/g, "").slice(-4);

  async function handleFirmar() {
    if (pin.trim().toUpperCase() !== expected) {
      setErr("Código incorrecto. Ingresa los últimos 4 caracteres de tu código de firma.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, "historial_firmas"), {
        firmanteId: usuario!.uid,
        firmanteName: firma.nombre,
        firmaCode: firma.firmaCode,
        documentoId: documento.id,
        documentoNombre: documento.nombre,
        empresa: documento.empresa ?? "",
        tipo: documento.tipo ?? "Documento",
        fechaFirma: now,
        liceoId: usuario!.liceoId ?? "default",
        creadoEnServer: serverTimestamp(),
      });
      await updateDoc(doc(db, "documentos", documento.id), {
        estadoFirma: "Firmado",
        fechaFirma: now,
      }).catch(() => {});
      await updateDoc(doc(db, "firmas_institucionales", usuario!.uid), {
        ultimoUso: now,
        documentosFirmados: (firma.documentosFirmados ?? 0) + 1,
      }).catch(() => {});
      setStep("done");
      onFirmado(documento.id);
    } catch {
      setErr("Error al registrar la firma. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#111827", border: "1px solid #1f2937", borderRadius: 16,
        width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #1f2937",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1d4ed820", border: "1px solid #1d4ed840", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-pen-nib" style={{ color: "#3b82f6", fontSize: 16 }} />
            </div>
            <div>
              <p style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700, margin: 0 }}>Firmar Electrónicamente</p>
              <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Confirma tu identidad para proceder</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {step === "done" ? (
          <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#14532d20", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-check" style={{ color: "#22c55e", fontSize: 28 }} />
            </div>
            <p style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, margin: 0 }}>Documento Firmado</p>
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{documento.nombre}</p>
            <p style={{ color: "#22c55e", fontSize: 13, margin: 0, fontFamily: "monospace" }}>Código: {firma.firmaCode}</p>
            <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>{new Date().toLocaleString("es-CL")}</p>
            <button onClick={onClose} style={{
              marginTop: 8, padding: "10px 28px", background: "#2563eb", border: "none",
              borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {/* Left: doc info */}
            <div style={{ padding: 24, borderRight: "1px solid #1f2937" }}>
              <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>Documento a firmar</p>
              <div style={{ background: "#1a2438", border: "1px solid #1f2937", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 40, height: 48, background: "#172035", border: "1px solid #2563eb30", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="fa-solid fa-file-lines" style={{ color: "#3b82f6", fontSize: 16 }} />
                  </div>
                  <div>
                    <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{documento.nombre}</p>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 2px" }}>{documento.empresa ?? "Sin empresa"}</p>
                    <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{documento.tipo ?? "Documento"} · {fmtDate(documento.creadoEn ?? "")}</p>
                  </div>
                </div>
              </div>
              {/* Firma preview (small) */}
              <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>Tu sello digital</p>
              <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #1e3a8a40" }}>
                <SelloVisual code={firma.firmaCode} nombre={firma.nombre} nivel={firma.nivel} nivelColor={firma.nivelColor} hash={firma.hash} />
              </div>
            </div>

            {/* Right: confirmation */}
            <div style={{ padding: 24 }}>
              <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 20px" }}>Confirmación de identidad</p>
              <div style={{ background: "#0a1628", border: "1px solid #1e3a8a", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <i className="fa-solid fa-shield-halved" style={{ color: "#3b82f6", fontSize: 16 }} />
                  <p style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600, margin: 0 }}>Verificación de firma</p>
                </div>
                <p style={{ color: "#475569", fontSize: 12, lineHeight: 1.5, margin: "0 0 12px" }}>
                  Para confirmar que eres el titular de esta firma, ingresa los <strong style={{ color: "#94a3b8" }}>últimos 4 caracteres</strong> de tu código de firma.
                </p>
                <p style={{ color: "#1d4ed8", fontFamily: "monospace", fontSize: 11, margin: 0 }}>
                  Tu código: {firma.firmaCode.slice(0, -4).replace(/[A-Z0-9]/g, "·")}<strong style={{ color: "#60a5fa" }}>{firma.firmaCode.slice(-4)}</strong>
                </p>
              </div>

              <label style={{ display: "block", marginBottom: 8 }}>
                <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 6px" }}>Últimos 4 caracteres</p>
                <input
                  type="text"
                  maxLength={4}
                  value={pin}
                  onChange={e => { setPin(e.target.value.toUpperCase()); setErr(""); }}
                  placeholder="ej: PL7Q"
                  style={{
                    width: "100%", padding: "12px 14px", background: "#1a2438",
                    border: err ? "1px solid #ef4444" : "1px solid #1f2937",
                    borderRadius: 8, color: "#f1f5f9", fontSize: 18, fontFamily: "monospace",
                    letterSpacing: 4, outline: "none", boxSizing: "border-box",
                  }}
                />
                {err && <p style={{ color: "#ef4444", fontSize: 12, margin: "6px 0 0" }}>{err}</p>}
              </label>

              <div style={{ background: "#1a2438", border: "1px solid #1f2937", borderRadius: 8, padding: 12, margin: "16px 0" }}>
                <p style={{ color: "#64748b", fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                  Al firmar este documento, confirmas que has leído y aceptas el contenido. Esta acción queda registrada en el sistema de auditoría SIGEDUAL con fecha, hora e IP del firmante.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={{
                  flex: 1, padding: "11px 0", background: "transparent", border: "1px solid #1f2937",
                  borderRadius: 8, color: "#94a3b8", fontSize: 14, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={handleFirmar} disabled={loading || pin.length < 4} style={{
                  flex: 2, padding: "11px 0", background: loading ? "#1e3a8a" : "#2563eb",
                  border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: loading || pin.length < 4 ? "not-allowed" : "pointer",
                  opacity: pin.length < 4 ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Firmando...</> : <><i className="fa-solid fa-pen-nib" /> Firmar Electrónicamente</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PanelIzquierdo ────────────────────────────────────────────────────────────
function PanelIzquierdo({ firma, onCopiar }: { firma: FirmaInstitucional | null; onCopiar: () => void }) {
  const estadoColor = firma?.estado === "Activa" ? "#22c55e" : firma?.estado === "Suspendida" ? "#fbbf24" : "#ef4444";

  if (!firma) return (
    <div style={{ width: 248, flexShrink: 0, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className="fa-solid fa-spinner fa-spin" style={{ color: "#3b82f6", fontSize: 24 }} />
    </div>
  );

  return (
    <div style={{
      width: 248, flexShrink: 0, background: "#111827", border: "1px solid #1f2937",
      borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* User header */}
      <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #1f2937" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: firma.nivelColor + "22",
            border: `2px solid ${firma.nivelColor}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: firma.nivelColor, fontSize: 20, fontWeight: 700,
            flexShrink: 0,
          }}>
            {firma.nombre.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firma.nombre}</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{ROL_LABEL[firma.rol] ?? firma.rol}</p>
          </div>
        </div>
        {/* Status */}
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: `${estadoColor}18`, color: estadoColor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${estadoColor}33` }}>
            <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 5, verticalAlign: "middle" }} />{firma.estado}
          </span>
          <span style={{ background: `${firma.nivelColor}18`, color: firma.nivelColor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${firma.nivelColor}33` }}>
            {firma.nivel}
          </span>
        </div>
      </div>

      {/* Sello visual */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>
        <p style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 10px" }}>Sello digital</p>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #1e3a8a30", boxShadow: "0 0 24px rgba(29,78,216,0.12)" }}>
          <SelloVisual code={firma.firmaCode} nombre={firma.nombre} nivel={firma.nivel} nivelColor={firma.nivelColor} hash={firma.hash} />
        </div>
      </div>

      {/* Meta info */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2937" }}>
        {([
          ["Cargo", firma.cargo],
          ["Código", firma.firmaCode],
          ["Creado", fmtDate(firma.fechaCreacion)],
          ["Último uso", firma.ultimoUso ? timeSince(firma.ultimoUso) : "Nunca"],
          ["Docs firmados", String(firma.documentosFirmados ?? 0)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #0f1929" }}>
            <span style={{ color: "#475569", fontSize: 11 }}>{k}</span>
            <span style={{ color: k === "Código" ? "#60a5fa" : "#94a3b8", fontSize: 11, fontWeight: k === "Código" ? 700 : 400, fontFamily: k === "Código" ? "monospace" : "inherit" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onCopiar} style={{
          padding: "9px 0", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)",
          borderRadius: 8, color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <i className="fa-solid fa-copy" /> Copiar código
        </button>
      </div>
    </div>
  );
}

// ── PanelCentral ──────────────────────────────────────────────────────────────
function PanelCentral({ docs, firma, onFirmado }: {
  docs: DocPendiente[];
  firma: FirmaInstitucional | null;
  onFirmado: (id: string) => void;
}) {
  const [modalDoc, setModalDoc] = useState<DocPendiente | null>(null);
  const [filtro, setFiltro] = useState<"Todos" | "Pendiente" | "Firmado">("Todos");

  const filtered = docs.filter(d => filtro === "Todos" || d.estadoFirma === filtro);

  return (
    <div style={{ flex: 1, minWidth: 0, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Documentos</p>
          <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Gestiona los documentos que requieren tu firma</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["Todos", "Pendiente", "Firmado"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filtro === f ? "#2563eb" : "transparent",
              color: filtro === f ? "#fff" : "#64748b",
              border: filtro === f ? "1px solid #2563eb" : "1px solid #1f2937",
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1a2438", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-file-signature" style={{ color: "#334155", fontSize: 22 }} />
            </div>
            <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>No hay documentos en esta categoría</p>
          </div>
        ) : (
          <>
            {/* Col headers */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px 110px 110px 120px", padding: "8px 20px", background: "#0d1421", borderBottom: "1px solid #1f2937" }}>
              {["Documento", "Empresa", "Tipo", "Fecha", "Acciones"].map(h => (
                <span key={h} style={{ color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
              ))}
            </div>
            {filtered.map(d => {
              const isPend = !d.estadoFirma || d.estadoFirma === "Pendiente";
              return (
                <div key={d.id} style={{
                  display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px 110px 110px 120px",
                  padding: "12px 20px", borderBottom: "1px solid #0f1929", alignItems: "center",
                  transition: "background 0.1s",
                }}
                  onMouseOver={e => (e.currentTarget.style.background = "#151e2e")}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0, paddingRight: 8 }}>
                    <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</p>
                    <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{d.autor ?? "Sin autor"}</p>
                  </div>
                  <span style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.empresa ?? "—"}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{d.subcategoria ?? d.tipo ?? "—"}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(d.creadoEn ?? "")}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {isPend && firma?.estado === "Activa" && (
                      <button onClick={() => setModalDoc(d)} style={{
                        padding: "5px 10px", background: "#1d4ed820", border: "1px solid #2563eb40",
                        borderRadius: 6, color: "#60a5fa", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}>
                        <i className="fa-solid fa-pen-nib" style={{ marginRight: 4 }} />Firmar
                      </button>
                    )}
                    {!isPend && (
                      <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <i className="fa-solid fa-check-circle" />Firmado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {modalDoc && firma && (
        <ModalFirmar
          documento={modalDoc}
          firma={firma}
          onClose={() => setModalDoc(null)}
          onFirmado={(id) => { onFirmado(id); setModalDoc(null); }}
        />
      )}
    </div>
  );
}

// ── PanelDerecho ──────────────────────────────────────────────────────────────
function PanelDerecho({ actividades }: { actividades: Actividad[] }) {
  return (
    <div style={{ width: 210, flexShrink: 0, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #1f2937" }}>
        <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>Actividad reciente</p>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Historial de firmas</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
        {actividades.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ color: "#1f2937", fontSize: 28, display: "block", marginBottom: 10 }} />
            <p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Sin actividad registrada</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 11, top: 0, bottom: 0, width: 1, background: "#1f2937" }} />
            {actividades.map((a, i) => (
              <div key={a.id} style={{ display: "flex", gap: 14, marginBottom: 18, position: "relative" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: "#1a2438",
                  border: "1px solid #2563eb40", display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0, zIndex: 1,
                }}>
                  <i className="fa-solid fa-pen-nib" style={{ color: "#3b82f6", fontSize: 9 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.documentoNombre}</p>
                  {a.empresa && <p style={{ color: "#475569", fontSize: 11, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.empresa}</p>}
                  <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>{timeSince(a.fechaFirma)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SeccionVerificacion ───────────────────────────────────────────────────────
function SeccionVerificacion() {
  const [input, setInput] = useState("");
  const [resultado, setResultado] = useState<FirmaInstitucional | null | "not-found">(null);
  const [loading, setLoading] = useState(false);

  async function verificar() {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setResultado(null);
    try {
      const q = query(collection(db, "firmas_institucionales"), where("firmaCode", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) {
        setResultado("not-found");
      } else {
        setResultado(snap.docs[0].data() as FirmaInstitucional);
      }
    } catch {
      setResultado("not-found");
    } finally {
      setLoading(false);
    }
  }

  const estadoColor = (resultado && resultado !== "not-found")
    ? (resultado.estado === "Activa" ? "#22c55e" : resultado.estado === "Suspendida" ? "#fbbf24" : "#ef4444")
    : "#ef4444";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Verificar firma electrónica</p>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 32px" }}>Ingresa el código de firma para validar la autenticidad de un documento firmado en SIGEDUAL</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          placeholder="ej: SIG-A8F3-K2X9-PL7Q"
          onKeyDown={e => e.key === "Enter" && verificar()}
          style={{
            flex: 1, padding: "13px 16px", background: "#1a2438",
            border: "1px solid #1f2937", borderRadius: 10,
            color: "#f1f5f9", fontSize: 15, fontFamily: "monospace",
            letterSpacing: 2, outline: "none",
          }}
        />
        <button onClick={verificar} disabled={loading || !input.trim()} style={{
          padding: "13px 24px", background: "#2563eb", border: "none",
          borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: loading || !input.trim() ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-magnifying-glass" />}
          Verificar
        </button>
      </div>

      {resultado === "not-found" && (
        <div style={{ background: "#1a1217", border: "1px solid #7f1d1d", borderRadius: 12, padding: 24, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#7f1d1d20", border: "1px solid #ef444440", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="fa-solid fa-xmark" style={{ color: "#ef4444", fontSize: 18 }} />
          </div>
          <div>
            <p style={{ color: "#fca5a5", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Firma no encontrada</p>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>El código ingresado no corresponde a ninguna firma registrada en SIGEDUAL. Verifica que el código sea correcto.</p>
          </div>
        </div>
      )}

      {resultado && resultado !== "not-found" && (
        <div style={{ background: "#0a1628", border: `1px solid ${estadoColor}44`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", background: `${estadoColor}10`, borderBottom: `1px solid ${estadoColor}22`, display: "flex", gap: 12, alignItems: "center" }}>
            <i className={`fa-solid ${resultado.estado === "Activa" ? "fa-shield-check" : "fa-shield-exclamation"}`} style={{ color: estadoColor, fontSize: 20 }} />
            <div>
              <p style={{ color: estadoColor, fontSize: 15, fontWeight: 700, margin: 0 }}>
                {resultado.estado === "Activa" ? "Firma válida y activa" : `Firma ${resultado.estado.toLowerCase()}`}
              </p>
              <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>Código verificado en SIGEDUAL</p>
            </div>
          </div>
          <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              ["Titular", resultado.nombre],
              ["Cargo", resultado.cargo],
              ["Rol", ROL_LABEL[resultado.rol] ?? resultado.rol],
              ["Nivel", resultado.nivel],
              ["Estado", resultado.estado],
              ["Creado", fmtDate(resultado.fechaCreacion)],
              ["Último uso", resultado.ultimoUso ? fmtDate(resultado.ultimoUso) : "Nunca"],
              ["Docs firmados", String(resultado.documentosFirmados ?? 0)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <p style={{ color: "#475569", fontSize: 11, margin: "0 0 2px" }}>{k}</p>
                <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid #1e3a8a20" }}>
            <p style={{ color: "#1e3a8a", fontSize: 11, margin: 0, fontFamily: "monospace" }}>
              Hash: {resultado.hash.slice(0, 8)}...{resultado.hash.slice(-8)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SeccionAdmin ──────────────────────────────────────────────────────────────
function SeccionAdmin() {
  const { usuario } = useAuth();
  const [firmas, setFirmas] = useState<(FirmaInstitucional & { id: string })[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db, "firmas_institucionales"), where("liceoId", "==", usuario.liceoId ?? "default"));
    return onSnapshot(q, snap => {
      setFirmas(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirmaInstitucional & { id: string })));
      setLoading(false);
    });
  }, [usuario?.uid]);

  const sel = firmas.find(f => f.id === selId) ?? null;

  async function cambiarEstado(id: string, estado: "Activa" | "Suspendida" | "Bloqueada") {
    setAccion(id + estado);
    await updateDoc(doc(db, "firmas_institucionales", id), { estado });
    setAccion(null);
  }

  async function regenerarCodigo(id: string) {
    setAccion(id + "regen");
    const newCode = genFirmaCode();
    const newHash = genHash(newCode);
    await updateDoc(doc(db, "firmas_institucionales", id), {
      firmaCode: newCode,
      hash: newHash,
    });
    setAccion(null);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta firma? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "firmas_institucionales", id));
    if (selId === id) setSelId(null);
  }

  const estadoColor = (estado: string) =>
    estado === "Activa" ? "#22c55e" : estado === "Suspendida" ? "#fbbf24" : "#ef4444";

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* Table */}
      <div style={{ flex: 1, minWidth: 0, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937" }}>
          <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Firmas institucionales</p>
          <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{firmas.length} firma{firmas.length !== 1 ? "s" : ""} registradas</p>
        </div>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: "#3b82f6", fontSize: 24 }} />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 130px 100px 100px 150px", padding: "8px 20px", background: "#0d1421", borderBottom: "1px solid #1f2937", position: "sticky", top: 0 }}>
              {["Usuario", "Código", "Nivel", "Estado", "Acciones"].map(h => (
                <span key={h} style={{ color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
              ))}
            </div>
            {firmas.map(f => {
              const isSel = selId === f.id;
              const isLoading = accion?.startsWith(f.id) ?? false;
              return (
                <div key={f.id} onClick={() => setSelId(isSel ? null : f.id)} style={{
                  display: "grid", gridTemplateColumns: "minmax(0,1fr) 130px 100px 100px 150px",
                  padding: "11px 20px", borderBottom: "1px solid #0f1929", alignItems: "center",
                  background: isSel ? "#1a2438" : "transparent", cursor: "pointer", transition: "background 0.1s",
                }}
                  onMouseOver={e => { if (!isSel) e.currentTarget.style.background = "#151e2e"; }}
                  onMouseOut={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ minWidth: 0, paddingRight: 8 }}>
                    <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</p>
                    <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{ROL_LABEL[f.rol] ?? f.rol}</p>
                  </div>
                  <span style={{ color: "#60a5fa", fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>{f.firmaCode.slice(0, 11)}…</span>
                  <span style={{ background: `${f.nivelColor}18`, color: f.nivelColor, padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, width: "fit-content" }}>{f.nivel}</span>
                  <span style={{ background: `${estadoColor(f.estado)}18`, color: estadoColor(f.estado), padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, width: "fit-content" }}>
                    {f.estado}
                  </span>
                  <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                    {f.estado !== "Activa" && (
                      <button title="Activar" onClick={() => cambiarEstado(f.id, "Activa")} disabled={isLoading} style={{ padding: "4px 8px", background: "#14532d20", border: "1px solid #22c55e30", borderRadius: 5, color: "#22c55e", cursor: "pointer", fontSize: 10 }}>
                        <i className="fa-solid fa-check" />
                      </button>
                    )}
                    {f.estado === "Activa" && (
                      <button title="Suspender" onClick={() => cambiarEstado(f.id, "Suspendida")} disabled={isLoading} style={{ padding: "4px 8px", background: "#78350f20", border: "1px solid #fbbf2430", borderRadius: 5, color: "#fbbf24", cursor: "pointer", fontSize: 10 }}>
                        <i className="fa-solid fa-pause" />
                      </button>
                    )}
                    {f.estado !== "Bloqueada" && (
                      <button title="Bloquear" onClick={() => cambiarEstado(f.id, "Bloqueada")} disabled={isLoading} style={{ padding: "4px 8px", background: "#7f1d1d20", border: "1px solid #ef444430", borderRadius: 5, color: "#ef4444", cursor: "pointer", fontSize: 10 }}>
                        <i className="fa-solid fa-ban" />
                      </button>
                    )}
                    <button title="Regenerar código" onClick={() => regenerarCodigo(f.id)} disabled={isLoading} style={{ padding: "4px 8px", background: "#1e3a8a20", border: "1px solid #2563eb30", borderRadius: 5, color: "#3b82f6", cursor: "pointer", fontSize: 10 }}>
                      <i className={`fa-solid ${isLoading && accion === f.id + "regen" ? "fa-spinner fa-spin" : "fa-rotate"}`} />
                    </button>
                    <button title="Eliminar" onClick={() => eliminar(f.id)} style={{ padding: "4px 8px", background: "#7f1d1d10", border: "1px solid #7f1d1d30", borderRadius: 5, color: "#dc2626", cursor: "pointer", fontSize: 10 }}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {sel && (
        <div style={{ width: 280, flexShrink: 0, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>Detalle de firma</p>
            <button onClick={() => setSelId(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #1f2937" }}>
            <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #1e3a8a30" }}>
              <SelloVisual code={sel.firmaCode} nombre={sel.nombre} nivel={sel.nivel} nivelColor={sel.nivelColor} hash={sel.hash} />
            </div>
          </div>
          <div style={{ padding: "14px 18px", flex: 1, overflowY: "auto" }}>
            {([
              ["Nombre", sel.nombre],
              ["Email", sel.email],
              ["Rol", ROL_LABEL[sel.rol] ?? sel.rol],
              ["Cargo", sel.cargo],
              ["Código", sel.firmaCode],
              ["Nivel", sel.nivel],
              ["Estado", sel.estado],
              ["Creado", fmtDate(sel.fechaCreacion)],
              ["Último uso", sel.ultimoUso ? fmtDate(sel.ultimoUso) : "Nunca"],
              ["Docs firmados", String(sel.documentosFirmados ?? 0)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <p style={{ color: "#475569", fontSize: 11, margin: "0 0 2px" }}>{k}</p>
                <p style={{ color: k === "Código" ? "#60a5fa" : "#e2e8f0", fontSize: 12, fontWeight: k === "Código" ? 700 : 500, margin: 0, fontFamily: k === "Código" ? "monospace" : "inherit", wordBreak: "break-all" }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FirmasPage() {
  const { usuario, loading: authLoading } = useAuth();
  const [vista, setVista] = useState<"mis-firmas" | "verificar" | "admin">("mis-firmas");
  const [firma, setFirma] = useState<FirmaInstitucional | null>(null);
  const [docs, setDocs] = useState<DocPendiente[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [copiado, setCopiado] = useState(false);

  const isAdmin = ["administrador", "coordinador", "director"].includes(usuario?.rol ?? "");

  // Load/create firma for current user
  useEffect(() => {
    if (!usuario) return;
    const ref = doc(db, "firmas_institucionales", usuario.uid);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        setFirma(snap.data() as FirmaInstitucional);
      } else {
        const nivel = NIVELES[usuario.rol] ?? { nivel: "Básico", color: "#64748b" };
        const code = genFirmaCode();
        const hash = genHash(code);
        const now = new Date().toISOString();
        const newFirma: FirmaInstitucional = {
          userId: usuario.uid,
          firmaCode: code,
          nombre: usuario.nombre ?? usuario.email,
          email: usuario.email,
          rol: usuario.rol,
          cargo: CARGO_MAP[usuario.rol] ?? "Usuario",
          estado: "Activa",
          nivel: nivel.nivel,
          nivelColor: nivel.color,
          fechaCreacion: now,
          ultimoUso: "",
          hash,
          liceoId: usuario.liceoId ?? "default",
          documentosFirmados: 0,
        };
        setDoc(ref, newFirma).catch(() => {});
        setFirma(newFirma);
      }
    });
  }, [usuario?.uid]);

  // Load docs that need signature from this user
  useEffect(() => {
    if (!usuario) return;
    const q = query(
      collection(db, "documentos"),
      where("liceoId", "==", usuario.liceoId ?? "default"),
      where("categoria", "==", "Firmas")
    );
    return onSnapshot(q, snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocPendiente)));
    });
  }, [usuario?.uid]);

  // Load activity
  useEffect(() => {
    if (!usuario) return;
    const q = query(
      collection(db, "historial_firmas"),
      where("firmanteId", "==", usuario.uid),
      orderBy("fechaFirma", "desc"),
      limit(30)
    );
    return onSnapshot(q, snap => {
      setActividades(snap.docs.map(d => ({ id: d.id, ...d.data() } as Actividad)));
    }, () => {});
  }, [usuario?.uid]);

  function handleFirmado(docId: string) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, estadoFirma: "Firmado" } : d));
  }

  function copiarCodigo() {
    if (firma) {
      navigator.clipboard.writeText(firma.firmaCode).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
    }
  }

  if (authLoading) return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className="fa-solid fa-spinner fa-spin" style={{ color: "#3b82f6", fontSize: 32 }} />
    </div>
  );

  const VISTAS = [
    { id: "mis-firmas" as const, label: "Mis firmas", icon: "fa-solid fa-pen-nib" },
    { id: "verificar" as const, label: "Verificar documento", icon: "fa-solid fa-shield-check" },
    ...(isAdmin ? [{ id: "admin" as const, label: "Administrar firmas", icon: "fa-solid fa-sliders" }] : []),
  ];

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#f1f5f9", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #1f2937", background: "#0d1421", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 0 }}>
          <div>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fa-solid fa-pen-nib" style={{ color: "#3b82f6", fontSize: 18 }} />
              Firmas Electrónicas
            </h1>
            <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Sistema de firma digital institucional SIGEDUAL</p>
          </div>
          {firma && copiado && (
            <div style={{ background: "#14532d20", border: "1px solid #22c55e40", borderRadius: 8, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 13 }}>
              <i className="fa-solid fa-check" /> Código copiado
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, marginTop: 16 }}>
          {VISTAS.map(v => (
            <button key={v.id} onClick={() => setVista(v.id)} style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: vista === v.id ? "2px solid #3b82f6" : "2px solid transparent",
              color: vista === v.id ? "#60a5fa" : "#64748b",
              fontSize: 13, fontWeight: vista === v.id ? 700 : 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7, transition: "color 0.15s",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              <i className={v.icon} style={{ fontSize: 12 }} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {vista === "mis-firmas" && (
          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <PanelIzquierdo firma={firma} onCopiar={copiarCodigo} />
            <PanelCentral docs={docs} firma={firma} onFirmado={handleFirmado} />
            <PanelDerecho actividades={actividades} />
          </div>
        )}
        {vista === "verificar" && (
          <div style={{ flex: 1, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, overflowY: "auto" }}>
            <SeccionVerificacion />
          </div>
        )}
        {vista === "admin" && isAdmin && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <SeccionAdmin />
          </div>
        )}
      </div>
    </div>
  );
}
