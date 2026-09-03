"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { disponibilidadMaestroGuiaDe } from "@/lib/maestro-guia";
import type { Asignacion, CentroDual, Especialidad, MaestroGuia } from "@/types";
import { ArrowLeft, Pencil, Power } from "lucide-react";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">{titulo}</p>
      {children}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{valor}</p>
    </div>
  );
}

export default function FichaMaestroGuiaPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [mg, setMg] = useState<MaestroGuia | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const snapMg = await getDoc(doc(db, "maestros_guia", id));
      if (!snapMg.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const m = { id: snapMg.id, ...snapMg.data() } as MaestroGuia;
      setMg(m);

      const [snapCentro, snapEsp, snapAsig] = await Promise.all([
        getDoc(doc(db, "centros_duales", m.centroDualId)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      if (snapCentro.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  function especialidadNombre(espId: string): string {
    return especialidades.find((e) => e.id === espId)?.nombre || espId;
  }

  async function cambiarEstado() {
    if (!mg || actualizando) return;
    setActualizando(true);
    try {
      const nuevoEstado = mg.estado === "activo" ? "inactivo" : "activo";
      await updateDoc(doc(db, "maestros_guia", mg.id), { estado: nuevoEstado, actualizadoEn: new Date().toISOString() });
      setMg({ ...mg, estado: nuevoEstado });
    } finally {
      setActualizando(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado || !mg) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Maestro guía no encontrado</p>
          <Link href="/dashboard/centros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a centros duales
          </Link>
        </div>
      </div>
    );
  }

  const disponibilidad = disponibilidadMaestroGuiaDe(mg, asignaciones);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{mg.nombres} {mg.apellidoPaterno} {mg.apellidoMaterno}</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {centro ? <>Maestro guía en <Link href={`/dashboard/centros/${centro.id}`} style={{ color: "var(--accent-light)" }} className="hover:underline">{centro.nombre}</Link></> : "Centro no encontrado"}
          </p>
        </div>
        <Link
          href="/dashboard/centros"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a centros duales
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: mg.estado === "activo" ? "var(--success)" : "var(--danger)", background: (mg.estado === "activo" ? "var(--success)" : "var(--danger)") + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {mg.estado === "activo" ? "Activo" : "Inactivo"}
        </span>
        {puedeEditar && (
          <>
            <Link href={`/dashboard/centros/maestros/${mg.id}/editar`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-light)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors">
              <Pencil size={13} />
              Editar
            </Link>
            <button onClick={cambiarEstado} disabled={actualizando} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50">
              <Power size={13} />
              {mg.estado === "activo" ? "Marcar inactivo" : "Marcar activo"}
            </button>
          </>
        )}
      </div>

      <Bloque titulo="Información personal">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="RUT" valor={mg.run} />
          <Dato label="Correo" valor={mg.email} />
          <Dato label="Teléfono" valor={mg.telefono} />
        </div>
      </Bloque>

      <Bloque titulo="Información profesional">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Cargo" valor={mg.cargo} />
          <Dato label="Área" valor={mg.area || "No registrada"} />
          <Dato label="Años de experiencia" valor={mg.aniosExperiencia != null ? mg.aniosExperiencia : "No registrados"} />
        </div>
      </Bloque>

      <Bloque titulo="Especialidades que puede guiar">
        {mg.especialidades.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin especialidades registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mg.especialidades.map((espId) => (
              <span key={espId} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">
                {especialidadNombre(espId)}
              </span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Áreas que puede supervisar">
        {(mg.areasSupervision ?? []).length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin áreas registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(mg.areasSupervision ?? []).map((a) => (
              <span key={a} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{a}</span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Capacidad de acompañamiento">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Máximo de estudiantes" valor={disponibilidad.capacidad != null ? disponibilidad.capacidad : "Sin límite definido"} />
          <Dato label="Asignados" valor={disponibilidad.asignados} />
          <Dato label="Disponibles" valor={disponibilidad.disponibles != null ? disponibilidad.disponibles : "Sin límite definido"} />
        </div>
      </Bloque>

      {mg.observaciones && (
        <Bloque titulo="Observaciones">
          <p style={{ color: "var(--text-primary)" }} className="text-sm">{mg.observaciones}</p>
        </Bloque>
      )}
    </div>
  );
}
