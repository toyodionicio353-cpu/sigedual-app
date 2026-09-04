import type { EstadoVisita, Visita } from "@/types";

/** Estados "canónicos" nuevos — todo lo que se escribe desde ahora en
 * adelante usa exclusivamente estos. "programada"/"realizada" son valores
 * legado que pueden existir en visitas creadas antes de esta ampliación. */
export type EstadoVisitaCanonico = Exclude<EstadoVisita, "programada" | "realizada">;

const MAPA_ESTADO_LEGADO: Record<string, EstadoVisitaCanonico> = {
  programada: "agendada",
  realizada: "finalizada",
};

export function estadoCanonico(estado: EstadoVisita): EstadoVisitaCanonico {
  return (MAPA_ESTADO_LEGADO[estado] as EstadoVisitaCanonico | undefined) ?? (estado as EstadoVisitaCanonico);
}

/** IDs de estudiante de una visita, tolerante al formato legado (un solo
 * `estudianteId` en vez del arreglo `estudianteIds`). */
export function estudianteIdsDe(visita: Pick<Visita, "estudianteIds" | "estudianteId">): string[] {
  if (visita.estudianteIds?.length) return visita.estudianteIds;
  return visita.estudianteId ? [visita.estudianteId] : [];
}

export function fechaProgramadaDe(visita: Pick<Visita, "fechaProgramada" | "fecha">): string {
  return visita.fechaProgramada ?? visita.fecha ?? "";
}

export function horaProgramadaDe(visita: Pick<Visita, "horaProgramada" | "hora">): string | undefined {
  return visita.horaProgramada ?? visita.hora;
}

export function profesorSupervisorIdDe(visita: Pick<Visita, "profesorSupervisorId" | "profesorId">): string {
  return visita.profesorSupervisorId ?? visita.profesorId ?? "";
}

export const ESTADO_VISITA_LABEL: Record<EstadoVisitaCanonico, string> = {
  agendada: "Agendada",
  en_proceso: "En proceso",
  pendiente_de_finalizar: "Pendiente de finalizar",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

export const ESTADO_VISITA_COLOR: Record<EstadoVisitaCanonico, string> = {
  agendada: "var(--accent-light)",
  en_proceso: "var(--warning)",
  pendiente_de_finalizar: "var(--warning)",
  finalizada: "var(--success)",
  cancelada: "var(--danger)",
  reprogramada: "var(--text-muted)",
};
