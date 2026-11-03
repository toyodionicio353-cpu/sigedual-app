import type { FaltaDual, JornadaFalta } from "@/types";

/** Etiqueta de la jornada, en versión corta: es la única que se usa, en
 * listados y tablas. */
export const ETIQUETA_JORNADA_CORTA: Record<JornadaFalta, string> = {
  completa: "Día completo",
  manana: "Media jornada A.M.",
  tarde: "Media jornada P.M.",
};

/**
 * Cuánto día perdió una ausencia.
 *
 * Media jornada vale medio día, no uno entero: el estudiante tiene que
 * reponer lo que realmente faltó, y redondear hacia arriba le cobraría
 * horas que sí estuvo.
 */
function diasDe(jornada: JornadaFalta): number {
  return jornada === "completa" ? 1 : 0.5;
}

/** Solo las confirmadas cuentan. Una falta que avisó el Centro Dual pero
 * que el liceo todavía no valida no es un dato oficial, y una anulada se
 * conserva por historial pero no suma. */
export function cuenta(falta: FaltaDual): boolean {
  return falta.estado === "confirmada";
}

export interface ResumenFaltas {
  /** Días perdidos, sumando medias jornadas. */
  diasTotales: number;
  /** De esos, cuántos hay que reponer en el centro. */
  diasARecuperar: number;
  /** Ya repuestos. */
  diasRecuperados: number;
  /** Lo que todavía debe: a recuperar menos lo ya repuesto. */
  diasPendientes: number;
  /** Cuántos registros confirmados hay (distinto de los días: dos medias
   * jornadas son dos faltas y un solo día). */
  cantidadFaltas: number;
  justificadas: number;
  injustificadas: number;
  /** Avisos del Centro Dual todavía sin confirmar por el liceo. */
  porConfirmar: number;
}

export function resumirFaltas(faltas: FaltaDual[]): ResumenFaltas {
  const resumen: ResumenFaltas = {
    diasTotales: 0, diasARecuperar: 0, diasRecuperados: 0, diasPendientes: 0,
    cantidadFaltas: 0, justificadas: 0, injustificadas: 0, porConfirmar: 0,
  };

  for (const falta of faltas) {
    if (falta.estado === "reportada") { resumen.porConfirmar += 1; continue; }
    if (!cuenta(falta)) continue;

    const dias = diasDe(falta.jornada);
    resumen.cantidadFaltas += 1;
    resumen.diasTotales += dias;
    if (falta.justificada) resumen.justificadas += 1; else resumen.injustificadas += 1;

    if (falta.requiereRecuperacion) {
      resumen.diasARecuperar += dias;
      if (falta.recuperada) resumen.diasRecuperados += dias;
    }
  }

  resumen.diasPendientes = resumen.diasARecuperar - resumen.diasRecuperados;
  return resumen;
}

/**
 * Formatea una cantidad de días que puede tener media jornada: "3 días",
 * "1 día", "2,5 días". Coma decimal, que es como se escribe en Chile.
 */
export function formatearDias(dias: number): string {
  const texto = Number.isInteger(dias)
    ? String(dias)
    : dias.toFixed(1).replace(".", ",");
  return `${texto} ${dias === 1 ? "día" : "días"}`;
}

/** Ordena de la falta más reciente a la más antigua. */
export function porFechaDescendente(a: FaltaDual, b: FaltaDual): number {
  return (b.fecha ?? "").localeCompare(a.fecha ?? "");
}
