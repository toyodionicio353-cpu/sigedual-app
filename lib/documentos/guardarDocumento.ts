import { collection, deleteDoc, doc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SegmentoDocumento, TipoModuloDocumento } from "@/types";

export const NOMBRE_DUPLICADO = "NOMBRE_DUPLICADO";

/**
 * Firestore no admite arrays anidados dentro de arrays (un array de
 * párrafos, cada uno un array de segmentos, es justo eso), así que
 * `contenido` se guarda como JSON y se reconstruye al leerlo.
 */
export function serializarContenido(contenido: SegmentoDocumento[][]): string {
  return JSON.stringify(contenido);
}

export function deserializarContenido(valor: unknown): SegmentoDocumento[][] {
  if (typeof valor !== "string") return [];
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function claveIndiceNombre(
  liceoId: string,
  alcance: "modulo" | "liceo",
  tipoModulo: TipoModuloDocumento,
  nombre: string
): string {
  const norm = normalizarNombre(nombre);
  return alcance === "modulo" ? `${liceoId}__${tipoModulo}__${norm}` : `${liceoId}__${norm}`;
}

interface CrearDocumentoParams {
  liceoId: string;
  tipoModulo: TipoModuloDocumento;
  plantillaId: string;
  nombre: string;
  estudianteId?: string;
  campos: Record<string, string>;
  contenido: SegmentoDocumento[][];
  creadoPor: string;
  alcanceUnicidadNombre?: "modulo" | "liceo";
}

/** Crea un documento nuevo, garantizando el nombre único vía transacción real (no solo frontend). */
export async function crearDocumento(params: CrearDocumentoParams): Promise<string> {
  const nombre = params.nombre.trim();
  const alcance = params.alcanceUnicidadNombre ?? "modulo";
  const claveIndice = claveIndiceNombre(params.liceoId, alcance, params.tipoModulo, nombre);
  const refIndice = doc(db, "documentos_generados_indices", claveIndice);
  const refDocumento = doc(collection(db, "documentos_generados"));

  await runTransaction(db, async (tx) => {
    const snapIndice = await tx.get(refIndice);
    if (snapIndice.exists()) throw new Error(NOMBRE_DUPLICADO);

    const datos: Record<string, unknown> = {
      tipoModulo: params.tipoModulo,
      plantillaId: params.plantillaId,
      liceoId: params.liceoId,
      nombre,
      campos: params.campos,
      contenido: serializarContenido(params.contenido),
      creadoPor: params.creadoPor,
      creadoEn: new Date().toISOString(),
    };
    if (params.estudianteId) datos.estudianteId = params.estudianteId;

    tx.set(refDocumento, datos);
    tx.set(refIndice, { liceoId: params.liceoId, tipoModulo: params.tipoModulo, documentoId: refDocumento.id });
  });

  return refDocumento.id;
}

interface ActualizarDocumentoParams {
  documentoId: string;
  liceoId: string;
  tipoModulo: TipoModuloDocumento;
  nombreAnterior: string;
  nombreNuevo: string;
  estudianteId?: string;
  campos: Record<string, string>;
  contenido: SegmentoDocumento[][];
  alcanceUnicidadNombre?: "modulo" | "liceo";
}

/** Actualiza un documento existente. Si el nombre cambió, libera el índice viejo y reclama el nuevo atómicamente. */
export async function actualizarDocumento(params: ActualizarDocumentoParams): Promise<void> {
  const nombreNuevo = params.nombreNuevo.trim();
  const alcance = params.alcanceUnicidadNombre ?? "modulo";
  const claveVieja = claveIndiceNombre(params.liceoId, alcance, params.tipoModulo, params.nombreAnterior);
  const claveNueva = claveIndiceNombre(params.liceoId, alcance, params.tipoModulo, nombreNuevo);
  const refDocumento = doc(db, "documentos_generados", params.documentoId);

  const cambios: Record<string, unknown> = {
    nombre: nombreNuevo,
    campos: params.campos,
    contenido: serializarContenido(params.contenido),
    actualizadoEn: new Date().toISOString(),
  };
  if (params.estudianteId) cambios.estudianteId = params.estudianteId;

  if (claveVieja === claveNueva) {
    await updateDoc(refDocumento, cambios);
    return;
  }

  const refIndiceVieja = doc(db, "documentos_generados_indices", claveVieja);
  const refIndiceNueva = doc(db, "documentos_generados_indices", claveNueva);

  await runTransaction(db, async (tx) => {
    const snapNueva = await tx.get(refIndiceNueva);
    if (snapNueva.exists()) throw new Error(NOMBRE_DUPLICADO);
    tx.update(refDocumento, cambios);
    tx.set(refIndiceNueva, { liceoId: params.liceoId, tipoModulo: params.tipoModulo, documentoId: params.documentoId });
    tx.delete(refIndiceVieja);
  });
}

/** Elimina un documento y libera su nombre para poder reutilizarlo. */
export async function eliminarDocumento(params: {
  documentoId: string; liceoId: string; tipoModulo: TipoModuloDocumento; nombre: string; alcanceUnicidadNombre?: "modulo" | "liceo";
}): Promise<void> {
  const alcance = params.alcanceUnicidadNombre ?? "modulo";
  const clave = claveIndiceNombre(params.liceoId, alcance, params.tipoModulo, params.nombre);
  await Promise.all([
    deleteDoc(doc(db, "documentos_generados", params.documentoId)),
    deleteDoc(doc(db, "documentos_generados_indices", clave)),
  ]);
}
