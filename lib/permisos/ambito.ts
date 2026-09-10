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
 *   profesor                  | Lectura: todos los estudiantes, centros
 *                              | duales y maestros guía de SU MISMA
 *                              | especialidad en su liceo — compartido con
 *                              | cualquier otro profesor de esa especialidad
 *                              | (Usuario.especialidadId), sin importar
 *                              | quién los creó. Escritura (crear/editar
 *                              | Visitas, cambiar estado, etc.) sigue
 *                              | exigiendo la Asignacion formal
 *                              | (profesorSupervisorId == su uid). Un
 *                              | profesor sin especialidad no ve nada por
 *                              | esta vía.
 *   centro_dual / estudiante   | Su propia información (sin cambios en
 *                              | esta entrega — fuera del alcance pedido).
 *
 * Regla de oro: el dominio/liceo define la institución; el rol define el
 * nivel de responsabilidad; la especialidad define qué información puede
 * VER un profesor dentro de esa institución (compartida entre colegas de
 * la misma especialidad); la Asignacion formal sigue definiendo qué puede
 * EDITAR. Pertenecer al mismo liceo NUNCA es, por sí solo, motivo para
 * otorgar acceso.
 */

/** Roles con visión institucional completa de su liceo (o global, para
 * administrador) — no necesitan calcular un ámbito, ven todo lo que la
 * página ya filtra por liceoId (o sin filtro, en modo global admin). */
export function esRolConAccesoCompletoLiceo(rol: Rol): boolean {
  return rol === "desarrollador" || rol === "coordinador" || rol === "director";
}

/** true solo para el rol cuyo acceso debe calcularse a partir de su ámbito
 * asignado (Asignacion.profesorSupervisorId), no del liceo completo. */
export function requiereAmbito(rol: Rol): boolean {
  return rol === "profesor";
}
