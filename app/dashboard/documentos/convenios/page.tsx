"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import BibliotecaDocumental, { type ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";
import EditorDocumento from "@/components/biblioteca/EditorDocumento";
import { plantillasParaModulo } from "@/lib/plantillas";
import { useContextoDocumentos } from "@/lib/plantillas/useContextoDocumentos";
import { useDocumentosCreados } from "@/lib/plantillas/useDocumentosCreados";
import { eliminarDocumento, duplicarDocumento, NOMBRE_DUPLICADO } from "@/lib/documentos/guardarDocumento";
import type { DocumentoGenerado } from "@/types";
import type { PlantillaDocumento } from "@/types/plantillas";
import { Handshake } from "lucide-react";

const TIPO_MODULO = "convenio" as const;

type Vista = { modo: "biblioteca" } | { modo: "editor"; plantilla?: PlantillaDocumento; existente?: DocumentoGenerado };

export default function ConveniosPage() {
  const { usuario } = useAuth();
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState<Vista>({ modo: "biblioteca" });
  const [tabBiblioteca, setTabBiblioteca] = useState<"plantillas" | "creados">("plantillas");

  // Centro Dual/Estudiante nunca crean, editan ni eliminan un convenio —
  // solo pueden VER el que esté a su nombre (ver useDocumentosCreados).
  const puedeCrear = usuario?.rol !== "centro_dual" && usuario?.rol !== "estudiante";

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
    if (!puedeCrear) return;
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
    if (!puedeCrear) return;
    const doc = documentos.find((d) => d.id === item.id);
    if (!doc || !usuario) return;
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    await eliminarDocumento({
      documentoId: doc.id, liceoId: usuario.liceoId, tipoModulo: TIPO_MODULO, nombre: doc.nombre,
    });
    mostrarAviso("Convenio eliminado.");
    recargar();
  }

  async function duplicarCreado(item: ItemBiblioteca) {
    if (!puedeCrear) return;
    const doc = documentos.find((d) => d.id === item.id);
    if (!doc || !usuario) return;
    try {
      await duplicarDocumento({
        origen: doc, liceoId: usuario.liceoId, tipoModulo: TIPO_MODULO,
        creadoPor: usuario.uid, creadoPorNombre: usuario.nombre,
      });
      mostrarAviso("Convenio duplicado como borrador.");
      recargar();
    } catch (err) {
      mostrarAviso(
        err instanceof Error && err.message === NOMBRE_DUPLICADO
          ? "Ya existe una copia con ese nombre. Cambia el nombre del original antes de duplicar de nuevo."
          : "No fue posible duplicar el convenio."
      );
    }
  }

  if (vista.modo === "editor" && usuario) {
    return (
      <EditorDocumento
        tipoModulo={TIPO_MODULO}
        liceoId={usuario.liceoId}
        usuarioUid={usuario.uid}
        usuarioNombre={usuario.nombre}
        contexto={contexto}
        plantilla={vista.plantilla}
        documentoExistente={vista.existente}
        soloLectura={!puedeCrear}
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
        titulo="Convenios"
        icono={<Handshake size={28} />}
        descripcion="Gestiona, consulta y utiliza los convenios disponibles en SIGEDUAL."
        placeholderBusqueda="Buscar convenios..."
        labelTabCreados="Convenios creados"
        labelPlural="convenios"
        plantillas={plantillas}
        creados={itemsCreados}
        cargando={cargandoContexto || cargandoCreados}
        onUsarPlantilla={usarPlantilla}
        onAbrirCreado={abrirCreado}
        tabInicial={tabBiblioteca}
        onCambiarTab={setTabBiblioteca}
        mostrarPlantillas={puedeCrear}
        acciones={puedeCrear ? [
          { label: "Editar", onClick: abrirCreado },
          { label: "Duplicar", onClick: duplicarCreado },
          { label: "Eliminar", onClick: eliminarCreado },
        ] : []}
      />
    </div>
  );
}
