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
