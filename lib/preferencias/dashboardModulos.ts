import type { DashboardModuloPref } from "@/types/preferencias";

interface ConId {
  id: string;
}

/** Aplica el orden, visibilidad y fijado guardados en preferencias a una
 * lista de módulos del Dashboard (identificados por `id`). Los módulos
 * fijados van primero (en el orden guardado entre ellos), luego el resto
 * de los visibles en el orden guardado; los módulos sin preferencia
 * guardada se muestran al final, en su orden original. */
export function ordenarModulosDashboard<T extends ConId>(modulos: T[], prefs: DashboardModuloPref[]): T[] {
  if (prefs.length === 0) return modulos;
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const ordenGuardado = prefs
    .filter((p) => porId.has(p.id) && p.visible)
    .sort((a, b) => (a.fijado === b.fijado ? 0 : a.fijado ? -1 : 1));
  const resultado: T[] = [];
  for (const p of ordenGuardado) {
    const m = porId.get(p.id);
    if (m) { resultado.push(m); porId.delete(p.id); }
  }
  // Módulos nuevos (agregados después de guardar la preferencia): al final, visibles por defecto.
  for (const m of modulos) {
    if (porId.has(m.id)) resultado.push(m);
  }
  return resultado;
}
