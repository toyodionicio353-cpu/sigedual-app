import type { Asignacion, Usuario } from "@/types";

export function estudiantesAsignadosDe(profesorUid: string, asignaciones: Asignacion[]): number {
  return asignaciones.filter(
    (a) => a.profesorSupervisorId === profesorUid && (a.estado === "asignada" || a.estado === "activa")
  ).length;
}

export function especialidadesEnUso(profesores: Usuario[]): string[] {
  const set = new Set<string>();
  profesores.forEach((p) => { if (p.especialidad?.trim()) set.add(p.especialidad.trim()); });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
