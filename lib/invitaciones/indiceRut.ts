import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarRut } from "@/lib/rut";

/**
 * Mantiene el índice inverso RUT → CentroDual (`centros_duales_por_rut`),
 * usado para detectar si una empresa ya existe en SIGEDUAL al procesar un
 * formulario de invitación — necesario porque los documentos de
 * `centros_duales` usan ID autogenerado, no el RUT, y un profesor no tiene
 * permiso para listar toda la colección buscando coincidencias.
 *
 * Se llama cada vez que se crea o edita un centro dual con RUT. Los
 * centros creados antes de que existiera este índice no quedan cubiertos
 * hasta la próxima vez que se guarden — no hay backfill retroactivo.
 */
export async function sincronizarIndiceRutCentro(centroDualId: string, liceoId: string, rut: string, rutAnterior?: string): Promise<void> {
  const nuevo = rut.trim() ? normalizarRut(rut) : "";
  const anterior = rutAnterior?.trim() ? normalizarRut(rutAnterior) : "";
  if (anterior && anterior !== nuevo) {
    await deleteDoc(doc(db, "centros_duales_por_rut", anterior));
  }
  if (nuevo) {
    await setDoc(doc(db, "centros_duales_por_rut", nuevo), { centroDualId, liceoId });
  }
}
