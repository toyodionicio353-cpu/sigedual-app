import { PUNTAJE_NIVEL, type NivelLogro, type PlantillaEvaluacion } from "./tipos";

export interface ResultadoEvaluacion {
  logrosPorcentaje: number;
  desarrolloPersonalPorcentaje: number;
  promedioGeneral: number;
}

function porcentajeDe(valores: NivelLogro[]): number {
  if (valores.length === 0) return 0;
  const suma = valores.reduce((acc, v) => acc + PUNTAJE_NIVEL[v], 0);
  return Math.round((suma / (4 * valores.length)) * 1000) / 10;
}

/**
 * Calcula el resultado de una evaluación a partir de las respuestas
 * registradas. Las tareas adicionales cuentan dentro del % de Logros en
 * las actividades, junto a los criterios fijos de esa sección — tal como
 * pide la pauta original (sección 5, categoría "Tareas Adicionales").
 */
export function calcularResultado(
  plantilla: PlantillaEvaluacion,
  respuestasLogros: Record<string, Record<string, NivelLogro>>,
  tareasAdicionales: NivelLogro[],
  respuestasDesarrolloPersonal: Record<string, NivelLogro>
): ResultadoEvaluacion {
  const valoresLogros: NivelLogro[] = [];
  for (const categoria of plantilla.categoriasLogros) {
    for (const criterio of categoria.criterios) {
      const valor = respuestasLogros[categoria.id]?.[criterio.id];
      if (valor) valoresLogros.push(valor);
    }
  }
  valoresLogros.push(...tareasAdicionales);

  const valoresDesarrolloPersonal = plantilla.criteriosDesarrolloPersonal
    .map((c) => respuestasDesarrolloPersonal[c.id])
    .filter((v): v is NivelLogro => Boolean(v));

  const logrosPorcentaje = porcentajeDe(valoresLogros);
  const desarrolloPersonalPorcentaje = porcentajeDe(valoresDesarrolloPersonal);
  const promedioGeneral = Math.round(
    (logrosPorcentaje * (plantilla.porcentajeLogros / 100) + desarrolloPersonalPorcentaje * (plantilla.porcentajeDesarrolloPersonal / 100)) * 10
  ) / 10;

  return { logrosPorcentaje, desarrolloPersonalPorcentaje, promedioGeneral };
}

/** Verdadero solo si todos los criterios FIJOS (no las tareas adicionales,
 * que son opcionales como sección) tienen una respuesta. */
export function evaluacionCompleta(
  plantilla: PlantillaEvaluacion,
  respuestasLogros: Record<string, Record<string, NivelLogro>>,
  respuestasDesarrolloPersonal: Record<string, NivelLogro>
): boolean {
  for (const categoria of plantilla.categoriasLogros) {
    for (const criterio of categoria.criterios) {
      if (!respuestasLogros[categoria.id]?.[criterio.id]) return false;
    }
  }
  for (const criterio of plantilla.criteriosDesarrolloPersonal) {
    if (!respuestasDesarrolloPersonal[criterio.id]) return false;
  }
  return true;
}
