import type { EnvioEvaluacion } from "@/types";

export type EstadoEnvioEvaluacion = "programado" | "disponible" | "completado" | "vencido";

function ahoraISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * `fechaInicio`/`fechaFin` admiten fecha con hora ("YYYY-MM-DDTHH:MM", lo
 * que entrega <input type="datetime-local">) para poder fijar un plazo
 * preciso (ej. "el sábado a las 15:00"), no solo el día completo. Un envío
 * creado antes de que existiera la hora solo tiene "YYYY-MM-DD" — se
 * completa con el borde del día (00:00 para el inicio, 23:59 para el
 * término) para no cambiarle el comportamiento a lo ya enviado.
 */
function conHora(fecha: string, finDeDia: boolean): string {
  return fecha.includes("T") ? fecha : `${fecha}T${finDeDia ? "23:59" : "00:00"}`;
}

/**
 * El estado de un envío nunca se guarda: se deriva siempre de la fecha/hora
 * actual contra `fechaInicio`/`fechaFin` y de si ya tiene `evaluacionId`,
 * así que el plazo se abre y se cierra solo, sin depender de un cron.
 */
export function estadoEnvioEvaluacion(envio: EnvioEvaluacion, ahora: string = ahoraISO()): EstadoEnvioEvaluacion {
  if (envio.evaluacionId) return "completado";
  if (ahora < conHora(envio.fechaInicio, false)) return "programado";
  if (ahora > conHora(envio.fechaFin, true)) return "vencido";
  return "disponible";
}

/** Horas completas que faltan para que cierre el plazo (negativo si ya venció). */
export function horasParaCierre(envio: EnvioEvaluacion, ahora: string = ahoraISO()): number {
  const msPorHora = 60 * 60 * 1000;
  return Math.ceil((new Date(conHora(envio.fechaFin, true)).getTime() - new Date(ahora).getTime()) / msPorHora);
}

/** Días completos que faltan para que cierre el plazo (negativo si ya venció). */
export function diasParaCierre(envio: EnvioEvaluacion, ahora: string = ahoraISO()): number {
  return Math.ceil(horasParaCierre(envio, ahora) / 24);
}
