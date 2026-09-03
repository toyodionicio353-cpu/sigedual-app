"use client";
import { useState } from "react";
import BibliotecaDocumental, { type ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";

export default function EvaluacionesPage() {
  const [aviso, setAviso] = useState("");
  const plantillas: ItemBiblioteca[] = [];
  const creados: ItemBiblioteca[] = [];

  function mostrarProximamente() {
    setAviso("Esta función estará disponible próximamente.");
    setTimeout(() => setAviso(""), 3000);
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
        titulo="Evaluaciones"
        descripcion="Gestiona, consulta y utiliza las evaluaciones disponibles en SIGEDUAL."
        placeholderBusqueda="Buscar evaluaciones..."
        labelTabCreados="Evaluaciones creadas"
        labelPlural="evaluaciones"
        plantillas={plantillas}
        creados={creados}
        cargando={false}
        accionPrincipal={{ label: "+ Agregar evaluación", onClick: mostrarProximamente }}
        acciones={[
          { label: "Abrir", onClick: mostrarProximamente },
          { label: "Ver", onClick: mostrarProximamente },
          { label: "Editar", onClick: mostrarProximamente },
          { label: "Duplicar", onClick: mostrarProximamente },
          { label: "Descargar", onClick: mostrarProximamente },
          { label: "Eliminar", onClick: mostrarProximamente },
        ]}
      />
    </div>
  );
}
