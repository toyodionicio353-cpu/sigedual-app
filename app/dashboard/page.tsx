"use client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useRef } from "react";
import {
  collection, query, where, getCountFromServer, onSnapshot,
  limit, updateDoc, doc, writeBatch, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { Rol } from "@/types";

const ROL_INICIAL: Record<Rol, string> = {
  administrador: "A", coordinador: "CO", director: "D",
  profesor: "P", centro_dual: "CD", estudiante: "E",
};
const ROL_LABEL: Record<Rol, string> = {
  administrador: "Administrador", coordinador: "Coordinador", director: "Director",
  profesor: "Profesor Supervisor", centro_dual: "Centro Dual", estudiante: "Estudiante",
};
const ROL_COLOR: Record<Rol, string> = {
  administrador: "#f87171", coordinador: "#fbbf24", director: "#a78bfa",
  profesor: "#60a5fa", centro_dual: "#34d399", estudiante: "#22d3ee",
};
const ALERT_COLOR: Record<string, string> = {
  warning: "#f59e0b", info: "#3b82f6", danger: "#ef4444", success: "#22c55e",
};

type Alerta = { id: string; tipo: string; texto: string; icono: string };

interface NotifItem {
  id: string;
  titulo: string;
  descripcion: string;
  icono?: string;
  color?: string;
  tipo?: string;
  timestamp: Timestamp | null;
  leida: boolean;
}

interface ConvResumen {
  id: string;
  nombre: string;
  ultimoMensaje: string;
  timestamp: Timestamp | null;
  noLeidos: number;
  color: string;
}

function tiempoRelativo(ts: Timestamp | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts.toMillis();
  if (diff < 60000)     return "Ahora";
  if (diff < 3600000)   return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000)  return `Hace ${Math.floor(diff / 3600000)} h`;
  return `Hace ${Math.floor(diff / 86400000)} días`;
}

const TIPO_ICONO: Record<string, { icon: string; color: string }> = {
  comunicaciones: { icon: "fa-solid fa-comments",             color: "#f472b6" },
  calendario:     { icon: "fa-solid fa-calendar-days",        color: "#60a5fa" },
  documentos:     { icon: "fa-solid fa-file-lines",           color: "#fbbf24" },
  firmas:         { icon: "fa-solid fa-pen-nib",              color: "#34d399" },
  evaluaciones:   { icon: "fa-solid fa-clipboard-check",      color: "#a78bfa" },
  alertas:        { icon: "fa-solid fa-triangle-exclamation", color: "#f87171" },
  sistema:        { icon: "fa-solid fa-gear",                 color: "#94a3b8" },
  estudiantes:    { icon: "fa-solid fa-graduation-cap",       color: "#22d3ee" },
  empresas:       { icon: "fa-solid fa-building",             color: "#fb923c" },
};

export default function DashboardPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [counts, setCounts]     = useState({ estudiantes: 0, centros: 0, profesores: 0, especialidades: 0 });
  const [alertas, setAlertas]   = useState<Alerta[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab]   = useState<"notif" | "chat">("notif");
  const panelRef = useRef<HTMLDivElement>(null);
  const alertasRef = useRef<Record<string, Alerta | null>>({});

  // Real notifications from Firestore
  const [notifs, setNotifs]       = useState<NotifItem[]>([]);
  const [convs, setConvs]         = useState<ConvResumen[]>([]);

  function mergeAlerta(id: string, alerta: Alerta | null) {
    alertasRef.current[id] = alerta;
    setAlertas(Object.values(alertasRef.current).filter(Boolean) as Alerta[]);
  }

  // ── Counts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      const liceoId = usuario!.liceoId;
      const [e, c, p, esp] = await Promise.all([
        getCountFromServer(query(collection(db, "estudiantes"),    where("liceoId", "==", liceoId))),
        getCountFromServer(query(collection(db, "centros_duales"), where("liceoId", "==", liceoId))),
        getCountFromServer(query(collection(db, "usuarios"),       where("liceoId", "==", liceoId), where("rol", "==", "profesor"))),
        getCountFromServer(query(collection(db, "especialidades"), where("liceoId", "==", liceoId))),
      ]);
      setCounts({ estudiantes: e.data().count, centros: c.data().count, profesores: p.data().count, especialidades: esp.data().count });
    }
    cargar();
  }, [usuario]);

  // ── Alertas sistema ───────────────────────────────────────────────
  useEffect(() => {
    if (!usuario) return;
    const liceoId = usuario.liceoId;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "estudiantes"), where("liceoId", "==", liceoId), where("centroDualId", "==", "")),
      snap => {
        const n = snap.size;
        mergeAlerta("sin_centro", n > 0
          ? { id: "sin_centro", tipo: "danger", icono: "fa-solid fa-file-circle-exclamation", texto: `${n} estudiante${n === 1 ? "" : "s"} sin centro dual asignado` }
          : null);
      }, () => mergeAlerta("sin_centro", null)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "evaluaciones"), where("liceoId", "==", liceoId), where("estado", "==", "pendiente")),
      snap => {
        const n = snap.size;
        mergeAlerta("eval_pendiente", n > 0
          ? { id: "eval_pendiente", tipo: "warning", icono: "fa-solid fa-clipboard-question", texto: `${n} evaluación${n === 1 ? "" : "es"} pendiente${n === 1 ? "" : "s"} sin completar` }
          : null);
      }, () => mergeAlerta("eval_pendiente", null)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "planes_formativos"), where("liceoId", "==", liceoId), where("estado", "==", "vencido")),
      snap => {
        const n = snap.size;
        mergeAlerta("planes_vencidos", n > 0
          ? { id: "planes_vencidos", tipo: "danger", icono: "fa-solid fa-calendar-xmark", texto: `${n} plan${n === 1 ? "" : "es"} formativo${n === 1 ? "" : "s"} vencido${n === 1 ? "" : "s"}` }
          : null);
      }, () => mergeAlerta("planes_vencidos", null)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "convenios"), where("liceoId", "==", liceoId), where("estado", "==", "pendiente")),
      snap => {
        const n = snap.size;
        mergeAlerta("convenios_pendientes", n > 0
          ? { id: "convenios_pendientes", tipo: "info", icono: "fa-solid fa-handshake", texto: `${n} convenio${n === 1 ? "" : "s"} pendiente${n === 1 ? "" : "s"} de aprobación` }
          : null);
      }, () => mergeAlerta("convenios_pendientes", null)
    ));

    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // ── Notificaciones reales ────────────────────────────────────────
  useEffect(() => {
    if (!usuario?.uid) return;
    // Only where("leida","==",false) — avoids composite index requirement
    const q = query(
      collection(db, "notificaciones", usuario.uid, "items"),
      where("leida", "==", false),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<NotifItem, "id">) }))
        .filter(n => !(n as any).archivada)
        .sort((a, b) => {
          const ta = a.timestamp?.toMillis() ?? 0;
          const tb = b.timestamp?.toMillis() ?? 0;
          return tb - ta;
        })
        .slice(0, 10);
      setNotifs(items);
    }, () => {});
    return () => unsub();
  }, [usuario?.uid]);

  // ── Conversaciones con mensajes no leídos ────────────────────────
  useEffect(() => {
    if (!usuario?.uid) return;
    // array-contains only — no orderBy to avoid composite index requirement
    const q = query(
      collection(db, "conversaciones"),
      where("participantes", "array-contains", usuario.uid),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const uid = usuario!.uid;
      const items: ConvResumen[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const noLeidos = data.noLeidos?.[uid] ?? 0;
        if (noLeidos <= 0) return;
        const otroUid = (data.participantes as string[]).find((p: string) => p !== uid) ?? "";
        const info = data.participantesInfo?.[otroUid] ?? {};
        const nombre = info.nombre ?? "Usuario";
        const colores = ["#60a5fa","#34d399","#a78bfa","#f472b6","#fb923c","#22d3ee"];
        const color = colores[nombre.charCodeAt(0) % colores.length];
        items.push({
          id: d.id,
          nombre,
          ultimoMensaje: data.ultimoMensaje?.texto ?? "",
          timestamp: data.actualizadoEn ?? null,
          noLeidos,
          color,
        });
      });
      // Sort by most recent
      items.sort((a, b) => {
        const ta = a.timestamp?.toMillis() ?? 0;
        const tb = b.timestamp?.toMillis() ?? 0;
        return tb - ta;
      });
      setConvs(items);
    }, () => {});
    return () => unsub();
  }, [usuario?.uid]);

  // ── Cerrar panel al click fuera ───────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // ── Marcar notif como leída ───────────────────────────────────────
  async function marcarLeida(id: string) {
    if (!usuario?.uid) return;
    await updateDoc(doc(db, "notificaciones", usuario.uid, "items", id), { leida: true }).catch(() => {});
  }

  async function marcarTodasLeidas() {
    if (!usuario?.uid || notifs.length === 0) return;
    const batch = writeBatch(db);
    notifs.forEach(n => batch.update(doc(db, "notificaciones", usuario!.uid, "items", n.id), { leida: true }));
    await batch.commit().catch(() => {});
  }

  const hora       = new Date().getHours();
  const saludo     = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const rolColor   = usuario ? ROL_COLOR[usuario.rol]   : "#60a5fa";
  const rolInicial = usuario ? ROL_INICIAL[usuario.rol] : "?";

  const totalBadge = notifs.length + convs.reduce((s, c) => s + c.noLeidos, 0);

  const stats = [
    { label: "Estudiantes",     value: counts.estudiantes,    icon: "fa-solid fa-users",          color: "#3b82f6", href: "/dashboard/estudiantes",   roles: ["administrador","coordinador","director","profesor"] },
    { label: "Empresas Duales", value: counts.centros,        icon: "fa-solid fa-building",        color: "#22c55e", href: "/dashboard/empresas",       roles: ["administrador","coordinador","director","profesor","centro_dual"] },
    { label: "Supervisores",    value: counts.profesores,     icon: "fa-solid fa-chalkboard-user", color: "#a78bfa", href: "/dashboard/profesores",     roles: ["administrador","coordinador","director"] },
    { label: "Especialidades",  value: counts.especialidades, icon: "fa-solid fa-graduation-cap",  color: "#f59e0b", href: "/dashboard/especialidades", roles: ["administrador","coordinador","director"] },
  ].filter(s => usuario && (s.roles as string[]).includes(usuario.rol));

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══ CABECERA ══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 15, flexShrink: 0,
            background: `linear-gradient(135deg, ${rolColor} 0%, ${rolColor}77 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: rolInicial.length > 1 ? 15 : 22,
            color: "#fff", boxShadow: `0 4px 18px ${rolColor}40`,
          }}>{rolInicial}</div>
          <div>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{saludo}</p>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "3px 0 2px", lineHeight: 1.1 }}>
              Bienvenido a SIGEDUAL
            </h1>
            <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>
              {usuario?.nombre}&nbsp;·&nbsp;
              <span style={{ color: rolColor, fontWeight: 600 }}>{usuario ? ROL_LABEL[usuario.rol] : ""}</span>
            </p>
          </div>
        </div>

        {/* ── Campanita ── */}
        <div style={{ position: "relative" }} ref={panelRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            style={{
              width: 46, height: 46, borderRadius: 13, cursor: "pointer",
              background: notifOpen ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${notifOpen ? "#3b82f6" : "#1f2937"}`,
              color: notifOpen ? "#3b82f6" : "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", position: "relative",
            }}
            onMouseOver={e => { if (!notifOpen) { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.color = "#f1f5f9"; }}}
            onMouseOut={e => { if (!notifOpen) { e.currentTarget.style.borderColor = "#1f2937"; e.currentTarget.style.color = "#94a3b8"; }}}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: 17 }} />
            {totalBadge > 0 && (
              <span style={{
                position: "absolute", top: 8, right: 9,
                width: 8, height: 8, borderRadius: "50%",
                background: "#ef4444", border: "2px solid #0b1220",
              }} />
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: "absolute", top: 54, right: 0, width: 360,
              background: "#111827", border: "1px solid #1f2937", borderRadius: 16,
              boxShadow: "0 24px 64px rgba(0,0,0,0.55)", zIndex: 200, overflow: "hidden",
            }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
                {[
                  { key: "notif", label: "Notificaciones", count: notifs.length },
                  { key: "chat",  label: "Mensajes",       count: convs.reduce((s, c) => s + c.noLeidos, 0) },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setNotifTab(tab.key as "notif" | "chat")} style={{
                    flex: 1, padding: "12px 0", background: "transparent", border: "none",
                    borderBottom: notifTab === tab.key ? "2px solid #3b82f6" : "2px solid transparent",
                    color: notifTab === tab.key ? "#f1f5f9" : "#64748b",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab: Notificaciones ── */}
              {notifTab === "notif" && (
                <div>
                  {notifs.length === 0 ? (
                    <div style={{ padding: "36px 20px", textAlign: "center" }}>
                      <i className="fa-solid fa-bell-slash" style={{ color: "#374151", fontSize: 28, display: "block", marginBottom: 10 }} />
                      <p style={{ color: "#4b5563", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Sin notificaciones</p>
                      <p style={{ color: "#374151", fontSize: 12, margin: 0 }}>No tienes notificaciones pendientes</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: 300, overflowY: "auto" }}>
                        {notifs.map((n, i) => {
                          const tipoCfg = TIPO_ICONO[n.tipo ?? "sistema"] ?? TIPO_ICONO.sistema;
                          const icon  = n.icono  ?? tipoCfg.icon;
                          const color = n.color  ?? tipoCfg.color;
                          return (
                            <div
                              key={n.id}
                              onClick={() => marcarLeida(n.id)}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                padding: "13px 16px",
                                borderBottom: i < notifs.length - 1 ? "1px solid #1a2236" : "none",
                                cursor: "pointer", transition: "background 0.15s",
                                background: "rgba(255,255,255,0.01)",
                              }}
                              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                            >
                              <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: color + "18", border: `1px solid ${color}25`,
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>
                                <i className={icon} style={{ color, fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{n.titulo}</p>
                                {n.descripcion && (
                                  <p style={{ color: "#475569", fontSize: 11, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.descripcion}</p>
                                )}
                                <p style={{ color: "#374151", fontSize: 11, margin: "3px 0 0" }}>{tiempoRelativo(n.timestamp)}</p>
                              </div>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa", flexShrink: 0, marginTop: 6 }} />
                            </div>
                          );
                        })}
                      </div>
                      {notifs.length > 0 && (
                        <div style={{ padding: "8px 16px", borderTop: "1px solid #1f2937", display: "flex", gap: 8 }}>
                          <button
                            onClick={marcarTodasLeidas}
                            style={{ flex: 1, color: "#64748b", fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "center" }}
                          >
                            Marcar todas como leídas
                          </button>
                          <button
                            onClick={() => { router.push("/dashboard/comunicaciones/notificaciones"); setNotifOpen(false); }}
                            style={{ flex: 1, color: "#3b82f6", fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "center" }}
                          >
                            Ver todas →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: Mensajes ── */}
              {notifTab === "chat" && (
                <div>
                  {convs.length === 0 ? (
                    <div style={{ padding: "36px 20px", textAlign: "center" }}>
                      <i className="fa-solid fa-comments" style={{ color: "#374151", fontSize: 28, display: "block", marginBottom: 10 }} />
                      <p style={{ color: "#4b5563", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Sin mensajes nuevos</p>
                      <p style={{ color: "#374151", fontSize: 12, margin: 0 }}>No tienes mensajes sin leer</p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                      {convs.map((c, i) => (
                        <div
                          key={c.id}
                          onClick={() => { router.push("/dashboard/mensajes"); setNotifOpen(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "13px 16px",
                            borderBottom: i < convs.length - 1 ? "1px solid #1a2236" : "none",
                            cursor: "pointer", transition: "background 0.15s",
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                          onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: c.color + "25",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, color: c.color, fontWeight: 700, fontSize: 15,
                          }}>
                            {c.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, margin: 0 }}>{c.nombre}</p>
                              <p style={{ color: "#374151", fontSize: 11, margin: 0, flexShrink: 0 }}>{tiempoRelativo(c.timestamp)}</p>
                            </div>
                            <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.ultimoMensaje || "Nuevo mensaje"}
                            </p>
                          </div>
                          <span style={{
                            minWidth: 20, height: 20, borderRadius: "50%",
                            background: "#3b82f6", color: "#fff", fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, padding: "0 4px",
                          }}>{c.noLeidos}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "10px 16px", borderTop: "1px solid #1f2937", textAlign: "center" }}>
                    <button
                      onClick={() => { router.push("/dashboard/mensajes"); setNotifOpen(false); }}
                      style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                    >
                      Ir a mensajes →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ STATS ══ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} onClick={() => router.push(s.href)}
            style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "20px 22px", cursor: "pointer", transition: "border-color 0.15s, transform 0.15s" }}
            onMouseOver={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = s.color + "55"; d.style.transform = "translateY(-2px)"; }}
            onMouseOut={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = "#1f2937"; d.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={s.icon} style={{ color: s.color, fontSize: 19 }} />
              </div>
              <i className="fa-solid fa-arrow-right" style={{ color: "#1f2937", fontSize: 13 }} />
            </div>
            <p style={{ color: "#f1f5f9", fontSize: 34, fontWeight: 800, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "7px 0 0", fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ══ MAPA + ALERTAS ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>

        {/* MAPA DUAL */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, overflow: "hidden", minHeight: 420, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #1f2937" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-map-location-dot" style={{ color: "#22c55e", fontSize: 16 }} />
              </div>
              <div>
                <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Mapa Dual</p>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Distribución geográfica de empresas duales</p>
              </div>
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #1f2937", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "#374151"}
              onMouseOut={e => e.currentTarget.style.borderColor = "#1f2937"}>
              <i className="fa-solid fa-expand" style={{ fontSize: 11 }} />Expandir
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1520" }}>
            <div style={{ textAlign: "center", opacity: 0.28, userSelect: "none" }}>
              <i className="fa-solid fa-map" style={{ fontSize: 60, color: "#22c55e", display: "block", marginBottom: 14 }} />
              <p style={{ color: "#64748b", fontSize: 14, margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>Mapa interactivo</p>
              <p style={{ color: "#374151", fontSize: 12, margin: "5px 0 0", fontFamily: "'Inter', sans-serif" }}>Se habilitará próximamente</p>
            </div>
          </div>
        </div>

        {/* ALERTAS */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: "#f59e0b", fontSize: 15 }} />
            </div>
            <div>
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>Alertas del sistema</p>
              <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                {alertas.length > 0
                  ? <><span style={{ color: "#ef4444", fontWeight: 700 }}>{alertas.filter(a => a.tipo === "danger").length}</span> críticas · {alertas.length} totales</>
                  : "Sin alertas activas"}
              </p>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
            {alertas.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", opacity: 0.35, userSelect: "none" }}>
                <i className="fa-solid fa-circle-check" style={{ color: "#22c55e", fontSize: 40, marginBottom: 14 }} />
                <p style={{ color: "#64748b", fontSize: 13, fontWeight: 600, margin: 0, textAlign: "center" }}>Todo en orden</p>
                <p style={{ color: "#374151", fontSize: 12, margin: "6px 0 0", textAlign: "center" }}>No hay alertas pendientes</p>
              </div>
            ) : alertas.map((a, i) => (
              <div key={a.id}
                style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 18px", borderBottom: i < alertas.length - 1 ? "1px solid #1a2236" : "none", cursor: "pointer", transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: ALERT_COLOR[a.tipo] + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <i className={a.icono} style={{ color: ALERT_COLOR[a.tipo], fontSize: 12 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "#cbd5e1", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{a.texto}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: ALERT_COLOR[a.tipo], display: "inline-block" }} />
                    <p style={{ color: "#374151", fontSize: 10, margin: 0 }}>
                      {a.tipo === "danger" ? "Urgente" : a.tipo === "warning" ? "Atención" : a.tipo === "success" ? "OK" : "Info"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {alertas.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937" }}>
              <button style={{ width: "100%", padding: "9px 0", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)", borderRadius: 9, color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <i className="fa-solid fa-list-check" style={{ fontSize: 12 }} />Ver todas las alertas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
