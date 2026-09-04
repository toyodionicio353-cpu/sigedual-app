import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asignacion } from "@/types";

export type TipoAutorizacion = "estudiante" | "centro" | "maestro";

interface DocAutorizacion {
  id: string;
  profesorUid: string;
  tipo: TipoAutorizacion;
  recursoId: string;
  origen?: string;
}

/**
 * Recalcula desde cero el índice de autorización (colección
 * `autorizaciones`) de un profesor a partir de sus Asignaciones vigentes en
 * Firestore — la fuente de verdad real. Se llama después de crear, editar o
 * eliminar una Asignacion (para el profesor anterior y/o el nuevo, si
 * cambió), y también de forma oportunista al cargar el ámbito del propio
 * profesor (auto-sanación: genera los índices de asignaciones antiguas que
 * todavía no los tuvieran, sin necesidad de una migración manual).
 *
 * Las reglas de Firestore de `estudiantes`/`centros_duales`/`maestros_guia`
 * usan `exists()` sobre estos documentos (ruta conocida
 * `autorizaciones/{profesorUid}_{tipo}_{recursoId}`) porque una regla no
 * puede ejecutar la consulta "existe una Asignacion con estos dos campos" —
 * solo puede leer por ruta. Este índice es lo que hace esa lectura posible.
 */
export async function sincronizarAutorizacionesDeProfesor(profesorUid: string): Promise<void> {
  const [snapAsignaciones, snapIndiceActual] = await Promise.all([
    getDocs(query(collection(db, "asignaciones"), where("profesorSupervisorId", "==", profesorUid))),
    getDocs(query(collection(db, "autorizaciones"), where("profesorUid", "==", profesorUid))),
  ]);

  const asignaciones = snapAsignaciones.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));

  const deseados = new Map<string, { tipo: TipoAutorizacion; recursoId: string; liceoId: string; asignacionId: string }>();
  asignaciones.forEach((a) => {
    deseados.set(`estudiante_${a.estudianteId}`, { tipo: "estudiante", recursoId: a.estudianteId, liceoId: a.liceoId, asignacionId: a.id });
    deseados.set(`centro_${a.centroDualId}`, { tipo: "centro", recursoId: a.centroDualId, liceoId: a.liceoId, asignacionId: a.id });
    if (a.maestroGuiaId) deseados.set(`maestro_${a.maestroGuiaId}`, { tipo: "maestro", recursoId: a.maestroGuiaId, liceoId: a.liceoId, asignacionId: a.id });
  });

  const actuales = snapIndiceActual.docs.map((d) => ({ id: d.id, ...d.data() } as DocAutorizacion));
  const clavesActuales = new Set(actuales.map((d) => `${d.tipo}_${d.recursoId}`));
  const clavesDeseadas = new Set(deseados.keys());

  const batch = writeBatch(db);
  let cambios = 0;

  for (const [clave, info] of deseados) {
    if (!clavesActuales.has(clave)) {
      const idDoc = `${profesorUid}_${clave}`;
      batch.set(doc(db, "autorizaciones", idDoc), {
        profesorUid, tipo: info.tipo, recursoId: info.recursoId, liceoId: info.liceoId,
        asignacionId: info.asignacionId, creadoEn: new Date().toISOString(),
      });
      cambios++;
    }
  }
  for (const actual of actuales) {
    // Los grants creados por el autorrellenado de una invitación no vienen
    // de una Asignacion real — no le corresponde a esta reconciliación
    // tocarlos (se revocan explícitamente, no por ausencia de Asignacion).
    if (actual.origen === "invitacion") continue;
    const clave = `${actual.tipo}_${actual.recursoId}`;
    if (!clavesDeseadas.has(clave)) {
      batch.delete(doc(db, "autorizaciones", actual.id));
      cambios++;
    }
  }

  if (cambios > 0) await batch.commit();
}
