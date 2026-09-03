"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import type { Asignacion, EstadoAsignacion, Estudiante, Usuario } from "@/types";
import { ArrowLeft, Pencil, Power, MapPin, ClipboardCheck } from "lucide-react";

const ESTADO_ASIGNACION_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};

function Bloque({ titulo, id, children }: { titulo: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", scrollMarginTop: 80 }} className="rounded-2xl p-5 sm:p-6 mb-5">
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

export default function FichaProfesorPage() {
  const { uid } = useParams<{ uid: string }>();
  const { usuario } = useAuth();

  const [profesor, setProfesor] = useState<Usuario | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const tieneAccesoGlobal = usuario?.rol === "administrador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const puedeGestionar = usuario?.rol === "administrador";

  useEffect(() => {
    if (!usuario || !uid) return;
    async function cargar() {
      setLoading(true);
      setError(false);
      try {
        const snapProf = await getDoc(doc(db, "usuarios", uid));
        if (!snapProf.exists() || (snapProf.data() as Usuario).rol !== "profesor") {
          setNoEncontrado(true);
          setLoading(false);
          return;
        }
        setProfesor(snapProf.data() as Usuario);

        const [snapAsig, snapEst] = await Promise.all([
          getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
          getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
        setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      } catch (err) {
        console.error("Error al cargar ficha de profesor:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [usuario, uid]);

  function estudianteDe(asig: Asignacion): Estudiante | undefined {
    return estudiantes.find((e) => e.id === asig.estudianteId);
  }

  async function cambiarEstado() {
    if (!profesor || actualizando) return;
    setActualizando(true);
    try {
      await updateDoc(doc(db, "usuarios", profesor.uid), { activo: !profesor.activo });
      setProfesor({ ...profesor, activo: !profesor.activo });
    } finally {
      setActualizando(false);
    }
  }

  if (usuario && !tieneAccesoGlobal) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No pudimos cargar este profesor supervisor</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
          <Link href="/dashboard/profesores" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver a profesores
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrado || !profesor) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Profesor supervisor no encontrado</p>
          <Link href="/dashboard/profesores" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a profesores
          </Link>
        </div>
      </div>
    );
  }

  const asignacionesDeEsteProfesor = asignaciones.filter((a) => a.profesorSupervisorId === profesor.uid);
  const asignacionesVigentes = asignacionesDeEsteProfesor.filter((a) => a.estado === "asignada" || a.estado === "activa");
  const asignacionesHistoricas = asignacionesDeEsteProfesor.filter((a) => a.estado === "finalizada" || a.estado === "cancelada");

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{profesor.nombre}</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{profesor.especialidad || "Sin especialidad registrada"}</p>
        </div>
        <Link
          href="/dashboard/profesores"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a profesores
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: profesor.activo ? "var(--success)" : "var(--text-muted)", background: (profesor.activo ? "var(--success)" : "var(--text-muted)") + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {profesor.activo ? "Activo" : "Inactivo"}
        </span>
        {puedeGestionar && (
          <>
            <Link href={`/dashboard/profesores/${profesor.uid}/editar`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-light)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors">
              <Pencil size={13} />
              Editar
            </Link>
            <button onClick={cambiarEstado} disabled={actualizando} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50">
              <Power size={13} />
              {profesor.activo ? "Marcar inactivo" : "Marcar activo"}
            </button>
          </>
        )}
      </div>

      <Bloque titulo="Información personal">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="RUT" valor={profesor.run || "No registrado"} />
          <Dato label="Correo" valor={profesor.email} />
          <Dato label="Especialidad" valor={profesor.especialidad || "No registrada"} />
        </div>
      </Bloque>

      <Bloque titulo="Estudiantes asignados" id="estudiantes">
        {asignacionesVigentes.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Este profesor supervisor no tiene estudiantes asignados actualmente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {asignacionesVigentes.map((a) => {
              const est = estudianteDe(a);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
                >
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{est?.curso || "Sin curso"} · Asignado desde: {a.fechaInicio ? formatearFecha(a.fechaInicio) : "No definida"}</p>
                  </div>
                  <span style={{ color: "var(--text-secondary)" }} className="text-xs flex-shrink-0">{ESTADO_ASIGNACION_LABEL[a.estado]}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Bloque>

      {asignacionesHistoricas.length > 0 && (
        <Bloque titulo="Historial">
          <div className="flex flex-col gap-2">
            {asignacionesHistoricas.map((a) => {
              const est = estudianteDe(a);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
                >
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}</p>
                  <span style={{ color: "var(--text-muted)" }} className="text-xs flex-shrink-0">{ESTADO_ASIGNACION_LABEL[a.estado]}</span>
                </Link>
              );
            })}
          </div>
        </Bloque>
      )}

      <Bloque titulo="Visitas" id="visitas">
        <div className="flex items-start gap-2">
          <MapPin size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">SIGEDUAL todavía no tiene un módulo de registro de visitas para profesores supervisores.</p>
        </div>
      </Bloque>

      <Bloque titulo="Evaluaciones" id="evaluaciones">
        <div className="flex items-start gap-2">
          <ClipboardCheck size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">SIGEDUAL todavía no tiene un módulo de evaluaciones para profesores supervisores.</p>
        </div>
      </Bloque>
    </div>
  );
}
