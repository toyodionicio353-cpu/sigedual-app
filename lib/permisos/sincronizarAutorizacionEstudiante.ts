import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asignacion } from "@/types";

/**
 * Igual que `sincronizarAutorizacionesDeProfesor`, pero para una cuenta
 * "estudiante": recalcula los índices `autorizaciones/{uid}_centro_{id}` y
 * `.../{uid}_maestro_{id}` a partir de sus propias Asignaciones — así puede
 * leer el Centro Dual y el Maestro Guía que le corresponden (firestore.rules
 * no puede consultar "qué asignación tiene este estudiante" directamente,
 * solo leer por ruta conocida). No genera índice `estudiante`: ese tipo es
 * para que OTRO rol (profesor/centro_dual) acceda a un estudiante, no para
 * que el propio estudiante se autorice a sí mismo.
 */
export async function sincronizarAutorizacionEstudiante(usuarioUid: string, estudianteId: string): Promise<void> {
  const [snapAsignaciones, snapIndiceActual] = await Promise.all([
    getDocs(query(collection(db, "asignaciones"), where("estudianteId", "==", estudianteId))),
    getDocs(query(collection(db, "autorizaciones"), where("profesorUid", "==", usuarioUid))),
  ]);

  const asignaciones = snapAsignaciones.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));

  const deseados = new Map<string, { tipo: "centro" | "maestro"; recursoId: string; liceoId: string; asignacionId: string }>();
  asignaciones.forEach((a) => {
    deseados.set(`centro_${a.centroDualId}`, { tipo: "centro", recursoId: a.centroDualId, liceoId: a.liceoId, asignacionId: a.id });
    if (a.maestroGuiaId) deseados.set(`maestro_${a.maestroGuiaId}`, { tipo: "maestro", recursoId: a.maestroGuiaId, liceoId: a.liceoId, asignacionId: a.id });
  });

  const actuales = snapIndiceActual.docs.map((d) => ({ id: d.id, ...(d.data() as { tipo: string; recursoId: string }) }));
  const actualesRelevantes = actuales.filter((a) => a.tipo === "centro" || a.tipo === "maestro");
  const clavesActuales = new Set(actualesRelevantes.map((a) => `${a.tipo}_${a.recursoId}`));
  const clavesDeseadas = new Set(deseados.keys());

  const batch = writeBatch(db);
  let cambios = 0;

  for (const [clave, info] of deseados) {
    if (!clavesActuales.has(clave)) {
      batch.set(doc(db, "autorizaciones", `${usuarioUid}_${clave}`), {
        profesorUid: usuarioUid, tipo: info.tipo, recursoId: info.recursoId, liceoId: info.liceoId,
        asignacionId: info.asignacionId, creadoEn: new Date().toISOString(),
      });
      cambios++;
    }
  }
  for (const actual of actualesRelevantes) {
    const clave = `${actual.tipo}_${actual.recursoId}`;
    if (!clavesDeseadas.has(clave)) {
      batch.delete(doc(db, "autorizaciones", actual.id));
      cambios++;
    }
  }

  if (cambios > 0) await batch.commit();
}
