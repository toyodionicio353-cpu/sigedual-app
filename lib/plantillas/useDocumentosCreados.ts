"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { DocumentoGenerado, TipoModuloDocumento } from "@/types";
import type { ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";

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
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { if (usuario) cargar(); }, [usuario, tipoModulo]);

  async function cargar() {
    if (!usuario) return;
    setCargando(true);
    const snap = await getDocs(query(
      collection(db, "documentos_generados"),
      where("liceoId", "==", usuario.liceoId),
      where("tipoModulo", "==", tipoModulo)
    ));
    setDocumentos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentoGenerado)));
    setCargando(false);
  }

  const items: ItemBiblioteca[] = documentos.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    fecha: d.creadoEn,
    previewLineas: textoParaPreview(d),
  }));

  return { documentos, items, cargando, recargar: cargar };
}
