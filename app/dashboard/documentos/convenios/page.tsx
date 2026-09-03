"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import BibliotecaDocumental, { type ItemBiblioteca } from "@/components/biblioteca/BibliotecaDocumental";

export default function ConveniosPage() {
  const { usuario } = useAuth();
  const [creados, setCreados] = useState<ItemBiblioteca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setCargando(true);
    const snap = await getDocs(query(collection(db, "convenios"), where("liceoId", "==", usuario.liceoId)));
    setCreados(snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        nombre: (data.nombre as string) || (data.plantillaNombre as string) || "Convenio sin nombre",
        tipo: (data.tipo as string) || "Convenio",
        fecha: (data.creadoEn as string) || "",
        estado: data.estado as string | undefined,
        autor: (data.estudianteNombre as string) || (data.centroNombre as string) || undefined,
      };
    }));
    setCargando(false);
  }

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
        titulo="Convenios"
        descripcion="Gestiona, consulta y utiliza los convenios disponibles en SIGEDUAL."
        placeholderBusqueda="Buscar convenios..."
        labelTabCreados="Convenios creados"
        labelPlural="convenios"
        plantillas={[]}
        creados={creados}
        cargando={cargando}
        accionPrincipal={{ label: "+ Agregar convenio", onClick: mostrarProximamente }}
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
