"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Ticket FAB ──────────────────────────────────────────────────────
const CORNER_KEY = "sgd-fab-corner";
type Corner = "tl" | "tr" | "bl" | "br";
const M = 20; // margin from edge

function cornerPos(c: Corner): { x: number; y: number } {
  const W = window.innerWidth, H = window.innerHeight;
  if (c === "tl") return { x: M,      y: M };
  if (c === "tr") return { x: W-M-52, y: M };
  if (c === "bl") return { x: M,      y: H-M-52 };
  return                 { x: W-M-52, y: H-M-52 };
}

function nearestCorner(x: number, y: number): Corner {
  const W = window.innerWidth, H = window.innerHeight;
  const cx = x < W / 2 ? "l" : "r";
  const cy = y < H / 2 ? "t" : "b";
  return (cy + cx) as Corner;
}

const CATEGORIAS = [
  "Error o falla técnica",
  "Problema de acceso o permisos",
  "Datos incorrectos",
  "Solicitud de nueva funcionalidad",
  "Consulta general",
  "Otro",
];

function TicketModal({ onClose, uid, nombre }: { onClose: () => void; uid: string; nombre: string }) {
  const [categoria, setCategoria] = useState("");
  const [asunto,    setAsunto]    = useState("");
  const [desc,      setDesc]      = useState("");
  const [enviando,  setEnviando]  = useState(false);
  const [enviado,   setEnviado]   = useState(false);
  const [error,     setError]     = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || !asunto.trim() || !desc.trim()) { setError("Completa todos los campos."); return; }
    setError(""); setEnviando(true);
    try {
      const now = serverTimestamp();
      const codigo = `TCK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      await addDoc(collection(db, "tickets"), {
        codigo, asunto: asunto.trim(), titulo: asunto.trim(),
        categoria, descripcion: desc.trim(),
        estado: "abierto", prioridad: "media",
        uid, nombre, creadoPor: nombre, creadoPorUid: uid,
        creadoEn: now, actualizadoEn: now,
        historial: [{ accion: "Ticket creado", usuario: nombre, ts: new Date().toISOString() }],
      });
      setEnviado(true);
    } catch { setError("No se pudo enviar. Intenta nuevamente."); }
    setEnviando(false);
  }

  const INP: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: "1px solid #1f2937",
    borderRadius: 10, padding: "10px 13px", color: "#f1f5f9",
    fontSize: 13, outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s",
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "#111827", border: "1px solid #1f2937",
        borderRadius: 18, padding: "26px 28px", maxWidth: 440, width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {enviado ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e40",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <i className="fa-solid fa-circle-check" style={{ color: "#22c55e", fontSize: 24 }} />
            </div>
            <p style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>¡Ticket enviado!</p>
            <p style={{ color: "#475569", fontSize: 13, margin: "0 0 22px" }}>El equipo de soporte lo revisará pronto.</p>
            <button onClick={onClose}
              style={{ padding: "9px 28px", background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e40", borderRadius: 10, color: "#22c55e", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(168,85,247,0.12)", border: "1px solid #a855f730", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="fa-solid fa-ticket" style={{ color: "#a855f7", fontSize: 16 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Reportar un problema</p>
                <p style={{ color: "#475569", fontSize: 12, margin: "2px 0 0" }}>Completa el formulario y te ayudamos</p>
              </div>
              <button type="button" onClick={onClose}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: 2 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Campos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Categoría *</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{ ...INP, cursor: "pointer", colorScheme: "dark" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#a855f760"}
                  onBlur={e => e.currentTarget.style.borderColor = "#1f2937"}>
                  <option value="" style={{ background: "#111827", color: "#475569" }}>Selecciona una categoría…</option>
                  {CATEGORIAS.map(c => <option key={c} value={c} style={{ background: "#111827", color: "#f1f5f9" }}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Asunto *</label>
                <input value={asunto} onChange={e => setAsunto(e.target.value)}
                  placeholder="Resumen breve del problema…" maxLength={120} style={INP}
                  onFocus={e => e.currentTarget.style.borderColor = "#a855f760"}
                  onBlur={e => e.currentTarget.style.borderColor = "#1f2937"} />
              </div>

              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Descripción *</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Describe qué ocurrió, qué esperabas y qué pasó en cambio…"
                  rows={4} maxLength={1000}
                  style={{ ...INP, resize: "vertical", minHeight: 88 }}
                  onFocus={e => e.currentTarget.style.borderColor = "#a855f760"}
                  onBlur={e => e.currentTarget.style.borderColor = "#1f2937"} />
                <p style={{ color: "#374151", fontSize: 10, textAlign: "right", margin: "3px 0 0" }}>{desc.length}/1000</p>
              </div>
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: 12, margin: "12px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fa-solid fa-circle-exclamation" />{error}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #1f2937", borderRadius: 10, color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando}
                style={{ flex: 2, padding: "10px 0", background: enviando ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.18)", border: "1px solid #a855f740", borderRadius: 10, color: "#a855f7", fontSize: 13, fontWeight: 700, cursor: enviando ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseOver={e => { if (!enviando) e.currentTarget.style.background = "rgba(168,85,247,0.28)"; }}
                onMouseOut={e => { if (!enviando) e.currentTarget.style.background = "rgba(168,85,247,0.18)"; }}>
                {enviando
                  ? <><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 12 }} />Enviando…</>
                  : <><i className="fa-solid fa-paper-plane" style={{ fontSize: 12 }} />Enviar ticket</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TicketFAB({ uid, nombre }: { uid: string; nombre: string }) {
  const [corner, setCorner]   = useState<Corner>("br");
  const [pos,    setPos]      = useState<{ x: number; y: number } | null>(null);
  const [modal,  setModal]    = useState(false);
  const dragging  = useRef(false);
  const hasMoved  = useRef(false);
  const origin    = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  // Carga esquina guardada
  useEffect(() => {
    const saved = localStorage.getItem(CORNER_KEY) as Corner | null;
    const c: Corner = (saved && ["tl","tr","bl","br"].includes(saved)) ? saved : "br";
    setCorner(c);
    setPos(cornerPos(c));
  }, []);

  // Recalcula posición si cambia el tamaño de ventana
  useEffect(() => {
    function onResize() { setPos(cornerPos(corner)); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [corner]);

  function snapToCorner(x: number, y: number) {
    const c = nearestCorner(x, y);
    const p = cornerPos(c);
    setCorner(c);
    setPos(p);
    try { localStorage.setItem(CORNER_KEY, c); } catch {}
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragging.current = true;
    hasMoved.current = false;
    origin.current   = { mx: e.clientX, my: e.clientY, bx: pos?.x ?? 0, by: pos?.y ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.mx;
    const dy = e.clientY - origin.current.my;
    if (Math.abs(dx) + Math.abs(dy) > 6) hasMoved.current = true;
    setPos({ x: origin.current.bx + dx, y: origin.current.by + dy });
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    if (hasMoved.current) {
      snapToCorner(e.clientX, e.clientY);
    } else {
      setModal(true);
    }
  }

  if (!pos) return null;

  return (
    <>
      {modal && <TicketModal onClose={() => setModal(false)} uid={uid} nombre={nombre} />}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 8000,
          width: 52, height: 52, borderRadius: 16,
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          border: "none", boxShadow: "0 4px 20px rgba(168,85,247,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: dragging.current ? "grabbing" : "pointer",
          touchAction: "none",
          transition: hasMoved.current ? "none" : "left 0.3s cubic-bezier(.4,0,.2,1), top 0.3s cubic-bezier(.4,0,.2,1), box-shadow 0.15s",
          userSelect: "none",
        }}
        onMouseOver={e => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(168,85,247,0.65), 0 0 0 1px rgba(255,255,255,0.12)"; }}
        onMouseOut={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(168,85,247,0.45), 0 0 0 1px rgba(255,255,255,0.08)"; }}
      >
        <i className="fa-solid fa-ticket" style={{ color: "#fff", fontSize: 20, pointerEvents: "none" }} />
      </button>
    </>
  );
}

// ─── Dashboard Layout ────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div style={{ background: "var(--accent-blue)", borderRadius: 10 }} className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-black">SG</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      {usuario && <TicketFAB uid={usuario.uid} nombre={usuario.nombre} />}
    </div>
  );
}
