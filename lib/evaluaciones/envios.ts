import type { EnvioEvaluacion } from "@/types";

export type EstadoEnvioEvaluacion = "programado" | "disponible" | "completado" | "vencido";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * El estado de un envío nunca se guarda: se deriva siempre de la fecha de
 * hoy contra `fechaInicio`/`fechaFin` y de si ya tiene `evaluacionId`, así
 * que el plazo se abre y se cierra solo, sin depender de un cron.
 */
export function estadoEnvioEvaluacion(envio: EnvioEvaluacion, hoy: string = hoyISO()): EstadoEnvioEvaluacion {
  if (envio.evaluacionId) return "completado";
  if (hoy < envio.fechaInicio) return "programado";
  if (hoy > envio.fechaFin) return "vencido";
  return "disponible";
}

/** Días completos que faltan para que cierre el plazo (negativo si ya venció). */
export function diasParaCierre(envio: EnvioEvaluacion, hoy: string = hoyISO()): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(`${envio.fechaFin}T00:00:00`).getTime() - new Date(`${hoy}T00:00:00`).getTime()) / msPorDia);
}
