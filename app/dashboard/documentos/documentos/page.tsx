"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import BibliotecaDocumental, { type ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";
import EditorDocumento from "@/components/biblioteca/EditorDocumento";
import { plantillasParaModulo } from "@/lib/plantillas";
import { useContextoDocumentos } from "@/lib/plantillas/useContextoDocumentos";
import { useDocumentosCreados } from "@/lib/plantillas/useDocumentosCreados";
import { eliminarDocumento } from "@/lib/documentos/guardarDocumento";
import type { DocumentoGenerado } from "@/types";
import type { PlantillaDocumento } from "@/types/plantillas";

const TIPO_MODULO = "documento" as const;

type Vista = { modo: "biblioteca" } | { modo: "editor"; plantilla?: PlantillaDocumento; existente?: DocumentoGenerado };

export default function DocumentosPage() {
  const { usuario } = useAuth();
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState<Vista>({ modo: "biblioteca" });
  const [tabBiblioteca, setTabBiblioteca] = useState<"plantillas" | "creados">("plantillas");

  const plantillasDefinidas = plantillasParaModulo(TIPO_MODULO);
  const { contexto, cargando: cargandoContexto } = useContextoDocumentos();
  const { documentos, items: itemsCreados, cargando: cargandoCreados, recargar } = useDocumentosCreados(TIPO_MODULO);

  const plantillas: ItemBiblioteca[] = plantillasDefinidas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    subtitulo: p.descripcion,
    previewLineas: p.previewLineas,
  }));

  function mostrarAviso(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 3000);
  }

  function usarPlantilla(item: ItemBiblioteca) {
    const plantilla = plantillasDefinidas.find((p) => p.id === item.id);
    if (!plantilla) return;
    setVista({ modo: "editor", plantilla });
  }

  function abrirCreado(item: ItemBiblioteca) {
    const doc = documentos.find((d) => d.id === item.id);
    if (!doc) return;
    setVista({ modo: "editor", existente: doc });
  }

  async function eliminarCreado(item: ItemBiblioteca) {
    const doc = documentos.find((d) => d.id === item.id);
    if (!doc || !usuario) return;
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    await eliminarDocumento({
      documentoId: doc.id, liceoId: usuario.liceoId, tipoModulo: TIPO_MODULO, nombre: doc.nombre,
    });
    mostrarAviso("Documento eliminado.");
    recargar();
  }

  if (vista.modo === "editor" && usuario) {
    return (
      <EditorDocumento
        tipoModulo={TIPO_MODULO}
        liceoId={usuario.liceoId}
        usuarioUid={usuario.uid}
        contexto={contexto}
        plantilla={vista.plantilla}
        documentoExistente={vista.existente}
        onGuardado={() => { recargar(); setVista({ modo: "biblioteca" }); }}
        onCancelar={() => setVista({ modo: "biblioteca" })}
      />
    );
  }

  return (
    <div>
      {aviso && (
        <div className="px-4 md:px-8 pt-4">
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-2.5 text-xs" >
            <span style={{ color: "var(--text-secondary)" }}>{aviso}</span>
          </div>
        </div>
      )}
      <BibliotecaDocumental
        titulo="Documentos"
        descripcion="Gestiona, consulta y utiliza los documentos disponibles en SIGEDUAL."
        placeholderBusqueda="Buscar documentos..."
        labelTabCreados="Documentos creados"
        labelPlural="documentos"
        plantillas={plantillas}
        creados={itemsCreados}
        cargando={cargandoContexto || cargandoCreados}
        onUsarPlantilla={usarPlantilla}
        onAbrirCreado={abrirCreado}
        tabInicial={tabBiblioteca}
        onCambiarTab={setTabBiblioteca}
        acciones={[
          { label: "Editar", onClick: abrirCreado },
          { label: "Eliminar", onClick: eliminarCreado },
        ]}
      />
    </div>
  );
}
