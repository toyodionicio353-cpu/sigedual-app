import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarRut } from "@/lib/rut";

/**
 * Mantiene el índice inverso RUN → Estudiante (`estudiantes_por_run`),
 * usado para detectar si un estudiante ya existe en SIGEDUAL al procesar
 * un formulario de invitación — necesario porque los documentos de
 * `estudiantes` usan ID autogenerado, no el RUN, y un profesor no tiene
 * permiso para listar toda la colección buscando coincidencias.
 *
 * Se llama cada vez que se crea o edita un estudiante. Los estudiantes
 * creados antes de que existiera este índice no quedan cubiertos hasta la
 * próxima vez que se guarden — no hay backfill retroactivo.
 */
export async function sincronizarIndiceRunEstudiante(estudianteId: string, liceoId: string, run: string, runAnterior?: string): Promise<void> {
  const nuevo = run.trim() ? normalizarRut(run) : "";
  const anterior = runAnterior?.trim() ? normalizarRut(runAnterior) : "";
  if (anterior && anterior !== nuevo) {
    await deleteDoc(doc(db, "estudiantes_por_run", anterior));
  }
  if (nuevo) {
    await setDoc(doc(db, "estudiantes_por_run", nuevo), { estudianteId, liceoId });
  }
}
