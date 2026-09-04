import type { Rol } from "@/types";

/**
 * Matriz de autorización de SIGEDUAL (referencia central — sección 20/21
 * del requerimiento de autorización granular por ámbito).
 *
 *   Rol                      | Alcance
 *   --------------------------|--------------------------------------------
 *   administrador             | Global — todos los liceos, sin excepción.
 *   director                  | Todo su liceo (institucional completo).
 *   coordinador                | Toda la gestión TP de su liceo.
 *   profesor                  | Solo su ámbito asignado: los estudiantes,
 *                              | centros duales y maestros guía vinculados
 *                              | a él a través de una Asignacion donde
 *                              | profesorSupervisorId sea su uid.
 *   centro_dual / estudiante   | Su propia información (sin cambios en
 *                              | esta entrega — fuera del alcance pedido).
 *
 * Regla de oro: el dominio/liceo define la institución; el rol define el
 * nivel de responsabilidad; el ámbito (Asignacion) define qué información
 * puede ver un profesor dentro de esa institución. Pertenecer al mismo
 * liceo NUNCA es, por sí solo, motivo para otorgar acceso.
 */

/** Roles con visión institucional completa de su liceo (o global, para
 * administrador) — no necesitan calcular un ámbito, ven todo lo que la
 * página ya filtra por liceoId (o sin filtro, en modo global admin). */
export function esRolConAccesoCompletoLiceo(rol: Rol): boolean {
  return rol === "administrador" || rol === "coordinador" || rol === "director";
}

/** true solo para el rol cuyo acceso debe calcularse a partir de su ámbito
 * asignado (Asignacion.profesorSupervisorId), no del liceo completo. */
export function requiereAmbito(rol: Rol): boolean {
  return rol === "profesor";
}
