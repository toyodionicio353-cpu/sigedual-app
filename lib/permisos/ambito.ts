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
 *   profesor                  | Estudiantes: ve y edita la ficha de
 *                              | CUALQUIER estudiante de su liceo — la
 *                              | ficha es su herramienta de trabajo.
 *                              | Centros duales y maestros guía: los de SU
 *                              | MISMA especialidad en su liceo, sin
 *                              | importar quién los creó. El resto de la
 *                              | escritura (crear/editar Visitas, cambiar
 *                              | estado, etc.) sigue exigiendo la
 *                              | Asignacion formal (profesorSupervisorId ==
 *                              | su uid).
 *   centro_dual / estudiante   | Su propia información (sin cambios en
 *                              | esta entrega — fuera del alcance pedido).
 *
 * Regla de oro: el dominio/liceo define la institución y el rol define el
 * nivel de responsabilidad. Dentro de su liceo, el profesor trabaja con la
 * ficha de cualquier estudiante; la especialidad acota qué centros duales y
 * maestros guía ve, y la Asignacion formal sigue definiendo qué puede crear
 * y editar más allá de la ficha. Pertenecer al mismo liceo no abre, por sí
 * solo, la información de OTRO liceo.
 */

/** Roles con visión institucional completa de su liceo (o global, para
 * administrador) — no necesitan calcular un ámbito, ven todo lo que la
 * página ya filtra por liceoId (o sin filtro, en modo global admin). */
export function esRolConAccesoCompletoLiceo(rol: Rol): boolean {
  return rol === "desarrollador" || rol === "coordinador" || rol === "director";
}
