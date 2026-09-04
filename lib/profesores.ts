import type { Asignacion, Usuario } from "@/types";

function normalizarTexto(texto?: string): string {
  return (texto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Compara la especialidad de un profesor (Usuario.especialidad, texto)
 * contra el nombre de una especialidad del catálogo del liceo, tolerando
 * diferencias de mayúsculas/tildes/espacios — necesario porque el campo no
 * es una referencia (id) a la colección `especialidades`, sino texto. */
export function especialidadCoincide(especialidadProfesor: string | undefined, nombreEspecialidad: string): boolean {
  const a = normalizarTexto(especialidadProfesor);
  const b = normalizarTexto(nombreEspecialidad);
  return a.length > 0 && b.length > 0 && a === b;
}

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
