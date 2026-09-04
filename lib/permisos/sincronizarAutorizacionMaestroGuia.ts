import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asignacion } from "@/types";

/**
 * Igual que `sincronizarAutorizacionesDeProfesor`, pero para una cuenta
 * "centro_dual" (login del Maestro Guía): recalcula el índice
 * `autorizaciones/{usuarioUid}_estudiante_{estudianteId}` a partir de las
 * Asignaciones donde `maestroGuiaId` coincide con el Maestro Guía que esa
 * cuenta representa. `centros_duales`/`maestros_guia` no necesitan este
 * índice para centro_dual — sus reglas comparan directo contra
 * `Usuario.centroDualId`/`maestroGuiaId` (ver firestore.rules).
 */
export async function sincronizarAutorizacionMaestroGuia(usuarioUid: string, maestroGuiaId: string): Promise<void> {
  const [snapAsignaciones, snapIndiceActual] = await Promise.all([
    getDocs(query(collection(db, "asignaciones"), where("maestroGuiaId", "==", maestroGuiaId))),
    getDocs(query(collection(db, "autorizaciones"), where("profesorUid", "==", usuarioUid))),
  ]);

  const asignaciones = snapAsignaciones.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));
  const idsEstudiantesDeseados = new Set(asignaciones.map((a) => a.estudianteId));

  const actuales = snapIndiceActual.docs.map((d) => ({ id: d.id, ...(d.data() as { tipo: string; recursoId: string }) }));
  const actualesEstudiante = actuales.filter((a) => a.tipo === "estudiante");

  const batch = writeBatch(db);
  let cambios = 0;

  for (const estudianteId of idsEstudiantesDeseados) {
    if (!actualesEstudiante.some((a) => a.recursoId === estudianteId)) {
      const asignacion = asignaciones.find((a) => a.estudianteId === estudianteId);
      batch.set(doc(db, "autorizaciones", `${usuarioUid}_estudiante_${estudianteId}`), {
        profesorUid: usuarioUid, tipo: "estudiante", recursoId: estudianteId,
        liceoId: asignacion?.liceoId, asignacionId: asignacion?.id, creadoEn: new Date().toISOString(),
      });
      cambios++;
    }
  }
  for (const actual of actualesEstudiante) {
    if (!idsEstudiantesDeseados.has(actual.recursoId)) {
      batch.delete(doc(db, "autorizaciones", actual.id));
      cambios++;
    }
  }

  if (cambios > 0) await batch.commit();
}
