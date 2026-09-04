import type { EstadoTicket, PrioridadTicket, TipoTicket } from "@/types";

export const ESTADO_TICKET_LABEL: Record<EstadoTicket, string> = {
  nuevo: "Nuevo",
  abierto: "Abierto",
  en_revision: "En revisión",
  en_proceso: "En proceso",
  esperando_respuesta: "Esperando respuesta",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

export const ESTADO_TICKET_COLOR: Record<EstadoTicket, string> = {
  nuevo: "var(--accent-light)",
  abierto: "var(--warning)",
  en_revision: "var(--warning)",
  en_proceso: "var(--warning)",
  esperando_respuesta: "var(--text-secondary)",
  resuelto: "var(--success)",
  cerrado: "var(--text-muted)",
};

export const PRIORIDAD_TICKET_LABEL: Record<PrioridadTicket, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORIDAD_TICKET_COLOR: Record<PrioridadTicket, string> = {
  baja: "var(--text-muted)",
  media: "var(--accent-light)",
  alta: "var(--warning)",
  critica: "var(--danger)",
};

export const TIPO_TICKET_LABEL: Record<TipoTicket, string> = {
  problema: "Problema",
  error: "Error",
  solicitud: "Solicitud",
  incidencia: "Incidencia",
  soporte_tecnico: "Soporte técnico",
  datos: "Problema con datos",
  otro: "Otro",
};

export const ESTADOS_TICKET_ORDEN: EstadoTicket[] = [
  "nuevo", "abierto", "en_revision", "en_proceso", "esperando_respuesta", "resuelto", "cerrado",
];

/** Estados que cuentan como "abierto" (requiere atención de alguna forma). */
export const ESTADOS_TICKET_ABIERTOS: EstadoTicket[] = [
  "nuevo", "abierto", "en_revision", "en_proceso", "esperando_respuesta",
];

export function numeroTicket(numero: number): string {
  return `TK-${String(numero).padStart(5, "0")}`;
}
