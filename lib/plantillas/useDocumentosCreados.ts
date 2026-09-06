"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import type { DocumentoGenerado, TipoModuloDocumento } from "@/types";
import type { ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";
import { deserializarContenido } from "@/lib/documentos/guardarDocumento";
import { plantillasParaModulo } from "@/lib/plantillas";

function loteados<T>(items: T[], tamano = 30): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

function textoParaPreview(doc: DocumentoGenerado): string[] {
  const lineas: string[] = [];
  for (const parrafo of doc.contenido) {
    const texto = parrafo.map((s) => s.texto).join("");
    if (texto.trim()) lineas.push(texto.trim());
    if (lineas.length >= 5) break;
  }
  return lineas;
}

export function useDocumentosCreados(tipoModulo: TipoModuloDocumento) {
  const { usuario } = useAuth();
  // Un Centro Dual solo ve documentos de SUS propios estudiantes (los de su
  // ámbito real, vía Asignacion) — igual criterio que Visitas/Evaluaciones.
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (usuario && !(usuario.rol === "centro_dual" && ambitoMaestroGuia.cargando)) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tipoModulo, ambitoMaestroGuia.cargando, ambitoMaestroGuia.idsEstudiantes]);

  function convertir(docs: QueryDocumentSnapshot[]): DocumentoGenerado[] {
    return docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, contenido: deserializarContenido(data.contenido) } as DocumentoGenerado;
    });
  }

  async function cargar() {
    if (!usuario) return;
    setCargando(true);
    // Un estudiante o Centro Dual solo puede consultar por `estudianteId` o
    // `creadoPor` (lo único que firestore.rules les permite leer en esta
    // colección) — nunca por `liceoId`, que expondría documentos ajenos.
    if (usuario.rol === "estudiante") {
      const porId = new Map<string, DocumentoGenerado>();
      const [snapPropio, snapCreados] = await Promise.all([
        usuario.estudianteId
          ? getDocs(query(collection(db, "documentos_generados"), where("tipoModulo", "==", tipoModulo), where("estudianteId", "==", usuario.estudianteId)))
          : Promise.resolve(null),
        getDocs(query(collection(db, "documentos_generados"), where("tipoModulo", "==", tipoModulo), where("creadoPor", "==", usuario.uid))),
      ]);
      convertir(snapPropio ? snapPropio.docs : []).forEach((d) => porId.set(d.id, d));
      convertir(snapCreados.docs).forEach((d) => porId.set(d.id, d));
      setDocumentos(Array.from(porId.values()));
      setCargando(false);
      return;
    }
    if (usuario.rol === "centro_dual") {
      const porId = new Map<string, DocumentoGenerado>();
      const lotes = loteados(ambitoMaestroGuia.idsEstudiantes);
      const [snapsPorEstudiante, snapCreados] = await Promise.all([
        Promise.all(lotes.map((lote) => getDocs(query(collection(db, "documentos_generados"), where("tipoModulo", "==", tipoModulo), where("estudianteId", "in", lote))))),
        getDocs(query(collection(db, "documentos_generados"), where("tipoModulo", "==", tipoModulo), where("creadoPor", "==", usuario.uid))),
      ]);
      snapsPorEstudiante.forEach((snap) => convertir(snap.docs).forEach((d) => porId.set(d.id, d)));
      convertir(snapCreados.docs).forEach((d) => porId.set(d.id, d));
      setDocumentos(Array.from(porId.values()));
      setCargando(false);
      return;
    }
    const snap = await getDocs(query(
      collection(db, "documentos_generados"),
      where("liceoId", "==", usuario.liceoId),
      where("tipoModulo", "==", tipoModulo)
    ));
    setDocumentos(convertir(snap.docs));
    setCargando(false);
  }

  const plantillasDefinidas = plantillasParaModulo(tipoModulo);

  const items: ItemBiblioteca[] = documentos.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    tipo: plantillasDefinidas.find((p) => p.id === d.plantillaId)?.nombre,
    fecha: d.creadoEn,
    estado: d.estado === "borrador" ? "Borrador" : "Finalizado",
    autor: d.creadoPorNombre,
    previewLineas: textoParaPreview(d),
  }));

  return { documentos, items, cargando, recargar: cargar };
}
