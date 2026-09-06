import type { DemoInstancia, EstadoDemo } from "@/types";

/** El período de prueba es de 168 horas exactas — nunca "7 días calendario"
 * redondeados, para que no se sumen horas extra según cuándo se emita. */
export const HORAS_DEMO = 168;
export const DURACION_DEMO_MS = HORAS_DEMO * 60 * 60 * 1000;

/** `emitidoEn` + 168 horas exactas, calculado en el servidor (nunca en el
 * navegador del usuario que reclama o usa el enlace). */
export function calcularVencimiento(emitidoEn: string): string {
  return new Date(new Date(emitidoEn).getTime() + DURACION_DEMO_MS).toISOString();
}

/** Único criterio de vencimiento real: comparar contra `venceEn` guardado en
 * el servidor. El contador visual en pantalla es solo informativo — nunca
 * se usa para decidir si el acceso sigue vigente. */
export function estaVencida(demo: Pick<DemoInstancia, "venceEn">, ahora: Date = new Date()): boolean {
  return ahora.getTime() >= new Date(demo.venceEn).getTime();
}

/** Estado real de una demo en este instante, sin depender de que el cron ya
 * haya escrito "vencida" en el documento — para validar accesos entre
 * corridas del cron. No cambia estados finales (cancelada/datos_eliminados). */
export function estadoEfectivo(demo: Pick<DemoInstancia, "estado" | "venceEn">, ahora: Date = new Date()): EstadoDemo {
  if (demo.estado === "cancelada" || demo.estado === "datos_eliminados") return demo.estado;
  if (demo.estado === "activa" && estaVencida(demo, ahora)) return "vencida";
  return demo.estado;
}

/** "6 días, 14 horas" / "3 horas, 20 minutos" / "Vencida" — texto puramente
 * informativo para la interfaz, nunca la fuente de verdad del vencimiento. */
export function formatearTiempoRestante(venceEn: string, ahora: Date = new Date()): string {
  const restanteMs = new Date(venceEn).getTime() - ahora.getTime();
  if (restanteMs <= 0) return "Vencida";
  const totalMinutos = Math.floor(restanteMs / 60000);
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const minutos = totalMinutos % 60;
  if (dias > 0) return `${dias} día${dias === 1 ? "" : "s"}, ${horas} hora${horas === 1 ? "" : "s"}`;
  if (horas > 0) return `${horas} hora${horas === 1 ? "" : "s"}, ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
}

export const ETIQUETA_ESTADO_DEMO: Record<EstadoDemo, string> = {
  activa: "Activa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  datos_eliminados: "Datos eliminados",
};
