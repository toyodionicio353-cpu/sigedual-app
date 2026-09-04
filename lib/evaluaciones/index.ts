import type { PlantillaEvaluacion } from "./tipos";
import { PLANTILLA_LOGROS_DESARROLLO_CONTABILIDAD_4 } from "./plantillas/logrosDesarrolloContabilidad4";

/** Todas las plantillas de evaluación disponibles. Fija por ahora (sin
 * editor todavía) — cuando exista, esto pasará a leerse desde Firestore. */
export const PLANTILLAS_EVALUACION: PlantillaEvaluacion[] = [
  PLANTILLA_LOGROS_DESARROLLO_CONTABILIDAD_4,
];

export function plantillaEvaluacionPorId(id: string): PlantillaEvaluacion | undefined {
  return PLANTILLAS_EVALUACION.find((p) => p.id === id);
}

export * from "./tipos";
