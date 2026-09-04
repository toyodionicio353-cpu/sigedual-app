import type { NivelLogro, TipoEvaluador } from "@/types";

export type { NivelLogro, TipoEvaluador };

export const NIVELES_LOGRO: { value: NivelLogro; label: string; descripcion: string }[] = [
  { value: "I", label: "I", descripcion: "Insuficiente — Progreso comprometido, debe mejorar" },
  { value: "R", label: "R", descripcion: "Regular — Progreso incierto, prioridad en deficiencias" },
  { value: "B", label: "B", descripcion: "Bueno — Progreso lento, pero satisfactorio" },
  { value: "MB", label: "MB", descripcion: "Muy Bueno — Asegura el progreso creciente del aprendizaje" },
];

/** Puntaje de cada nivel para calcular los porcentajes de resultado. */
export const PUNTAJE_NIVEL: Record<NivelLogro, number> = { I: 1, R: 2, B: 3, MB: 4 };

export interface CriterioEvaluacion {
  id: string;
  texto: string;
}

export interface CategoriaEvaluacion {
  id: string;
  titulo: string;
  criterios: CriterioEvaluacion[];
  /** Solo la categoría "Tareas Adicionales": sin criterios fijos, el
   * evaluador agrega las suyas dinámicamente al realizar la evaluación. */
  permiteTareasDinamicas?: boolean;
}

export interface PlantillaEvaluacion {
  id: string;
  nombre: string;
  especialidad: string;
  nivel: string;
  tipoEvaluador: TipoEvaluador;
  titulo: string;
  categoriasLogros: CategoriaEvaluacion[];
  criteriosDesarrolloPersonal: CriterioEvaluacion[];
  porcentajeLogros: number;
  porcentajeDesarrolloPersonal: number;
}
