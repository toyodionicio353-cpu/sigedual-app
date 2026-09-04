"use client";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import type { Notificacion, TipoNotificacion } from "@/types";

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  alerta: "Alerta",
  aviso: "Aviso",
  mensaje: "Mensaje",
  solicitud: "Solicitud",
  cambio: "Cambio",
  evaluacion_pendiente: "Evaluación pendiente",
  visita_proxima: "Visita próxima",
  documento_pendiente: "Documento pendiente",
  firma_pendiente: "Firma pendiente",
  asignacion: "Asignación",
  actualizacion_sistema: "Actualización del sistema",
  incidencia: "Incidencia",
  recordatorio: "Recordatorio",
  ticket: "Ticket",
  formulario_recibido: "Formulario recibido",
};

function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  notificaciones: Notificacion[];
  cargando: boolean;
  onMarcarLeida: (id: string) => void;
  onItemClick?: () => void;
  vacioTitulo?: string;
  vacioDescripcion?: string;
}

/** Lista presentacional de notificaciones — la usan tanto la campana global
 * (app/dashboard/layout.tsx) como la tarjeta de Inicio y /dashboard/notificaciones,
 * siempre alimentada por el mismo hook `useNotificaciones`. Un solo componente,
 * una sola fuente de datos: leer/marcar leída en un lugar se refleja en el otro. */
export default function ListaNotificaciones({
  notificaciones,
  cargando,
  onMarcarLeida,
  onItemClick,
  vacioTitulo = "Todo al día",
  vacioDescripcion = "No tienes notificaciones nuevas.",
}: Props) {
  if (cargando) {
    return <p style={{ color: "var(--text-secondary)" }} className="text-sm p-4">Cargando...</p>;
  }

  if (notificaciones.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
          <Bell size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{vacioTitulo}</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{vacioDescripcion}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {notificaciones.map((n, i) => (
        <div
          key={n.id}
          style={{
            borderBottom: i < notificaciones.length - 1 ? "1px solid var(--border)" : "none",
            background: n.leida ? "transparent" : "var(--accent-light)0d",
          }}
          className="px-4 py-3"
        >
          <div className="flex items-center gap-2">
            {!n.leida && <span style={{ background: "var(--accent)" }} className="w-1.5 h-1.5 rounded-full flex-shrink-0" />}
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wide">{TIPO_LABEL[n.tipo]}</p>
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mt-0.5">{n.titulo}</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{n.descripcion}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <p style={{ color: "var(--text-muted)" }} className="text-[11px]">{formatearFechaHora(n.creadoEn)}</p>
            {n.accionHref && (
              <Link
                href={n.accionHref}
                onClick={() => { if (!n.leida) onMarcarLeida(n.id); onItemClick?.(); }}
                style={{ color: "var(--accent-light)" }}
                className="text-[11px] font-semibold hover:underline"
              >
                {n.accionLabel || "Ver"}
              </Link>
            )}
            {!n.leida && (
              <button
                onClick={() => onMarcarLeida(n.id)}
                style={{ color: "var(--text-muted)" }}
                className="text-[11px] hover:[color:var(--text-primary)] transition-colors flex items-center gap-1"
              >
                <Check size={11} /> Marcar leída
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
