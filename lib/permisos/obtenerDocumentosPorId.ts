import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const TAMANO_LOTE = 30; // límite de Firestore para el operador "in"

/**
 * Trae documentos de una colección por un conjunto de IDs ya autorizado
 * (por ejemplo, el ámbito de un profesor), en lotes de 30 vía
 * `documentId() in [...]`. Es la única forma de "listar" un subconjunto ya
 * conocido sin hacer una consulta amplia que las reglas de Firestore
 * rechazarían para un usuario sin acceso a la colección completa.
 */
export async function obtenerDocumentosPorId<T extends { id: string }>(
  coleccion: string,
  ids: string[]
): Promise<T[]> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return [];

  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += TAMANO_LOTE) lotes.push(unicos.slice(i, i + TAMANO_LOTE));

  const resultados = await Promise.all(
    lotes.map((lote) => getDocs(query(collection(db, coleccion), where(documentId(), "in", lote))))
  );
  return resultados.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
}
