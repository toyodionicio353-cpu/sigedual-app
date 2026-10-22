import type { Estudiante } from "@/types";

/** Nombre para mostrar. Prefiere los apellidos separados (lo que se
 * captura hoy) y cae en el campo antiguo `apellidos` para las fichas
 * creadas antes de esa separación. */
export function nombreCompleto(e: Estudiante): string {
  const apellidos = [e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(" ") || e.apellidos || "";
  return [e.nombres, apellidos].filter(Boolean).join(" ").trim() || "Estudiante";
}
