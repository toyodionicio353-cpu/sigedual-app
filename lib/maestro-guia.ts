import type { Asignacion, CentroDual, MaestroGuia } from "@/types";
import { estadoEfectivo } from "./compatibilidad";

// La capacidad de acompañamiento de un Maestro Guía es un dato distinto de
// la capacidad del Centro Dual al que pertenece: cada maestro guía puede
// acompañar a un número limitado de estudiantes propio. "Asignados" se
// calcula desde Asignacion.maestroGuiaId — hoy el asistente de Asignaciones
// todavía no escribe ese campo (usa el texto libre heredado), así que este
// cálculo mostrará 0 hasta que esa conexión se cablee; no es un dato
// inventado, refleja el estado real del sistema.
export function disponibilidadMaestroGuiaDe(mg: MaestroGuia, asignaciones: Asignacion[]) {
  const asignados = asignaciones.filter(
    (a) => a.maestroGuiaId === mg.id && (a.estado === "asignada" || a.estado === "activa")
  ).length;
  return {
    capacidad: mg.capacidad,
    asignados,
    disponibles: mg.capacidad == null ? undefined : Math.max(0, mg.capacidad - asignados),
  };
}

// Un Maestro Guía es candidato a una nueva asignación si él y su centro
// están activos y todavía tiene capacidad de acompañamiento disponible.
export function disponibleParaAsignarMaestroGuia(mg: MaestroGuia, centro: CentroDual, asignaciones: Asignacion[]): boolean {
  if (mg.estado !== "activo" || estadoEfectivo(centro) !== "activo") return false;
  const { capacidad, asignados } = disponibilidadMaestroGuiaDe(mg, asignaciones);
  return capacidad == null || asignados < capacidad;
}

export type EstadoDisponibilidadMaestroGuia = "disponible" | "sin_capacidad" | "no_disponible";

// Etiqueta de disponibilidad de tres estados para mostrar en listado/ficha:
// distingue "no disponible" (el maestro guía o su centro están inactivos)
// de "sin capacidad" (ambos activos, pero ya alcanzó su máximo).
export function estadoDisponibilidadMaestroGuia(mg: MaestroGuia, centro: CentroDual | undefined, asignaciones: Asignacion[]): EstadoDisponibilidadMaestroGuia {
  if (mg.estado !== "activo" || !centro || estadoEfectivo(centro) !== "activo") return "no_disponible";
  const { capacidad, asignados } = disponibilidadMaestroGuiaDe(mg, asignaciones);
  if (capacidad != null && asignados >= capacidad) return "sin_capacidad";
  return "disponible";
}

// Campos importantes que, si faltan, marcan al maestro guía como
// "Información incompleta" en el listado y la ficha.
export function camposFaltantesMaestroGuia(mg: MaestroGuia, centroExiste: boolean): string[] {
  const faltantes: string[] = [];
  if (!centroExiste) faltantes.push("Centro dual");
  if ((mg.especialidades ?? []).length === 0) faltantes.push("Especialidad");
  if (!mg.email) faltantes.push("Correo");
  if (!mg.telefono) faltantes.push("Teléfono");
  if (mg.capacidad == null) faltantes.push("Capacidad");
  return faltantes;
}
