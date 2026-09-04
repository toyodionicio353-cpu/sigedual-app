"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { especialidadCoincide } from "@/lib/profesores";
import { sincronizarAutorizacionesDeProfesor } from "@/lib/permisos/sincronizarAutorizacion";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { Asignacion, CentroDual, EstadoAsignacion, Especialidad, Estudiante, MaestroGuia, Usuario } from "@/types";
import { ArrowLeft, CalendarCheck, ShieldAlert } from "lucide-react";

const ESTADOS: EstadoAsignacion[] = ["pendiente", "en_proceso", "asignada", "activa", "finalizada", "cancelada"];

const ESTADO_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};

const ESTADO_COLOR: Record<EstadoAsignacion, string> = {
  pendiente: "var(--text-muted)",
  en_proceso: "var(--warning)",
  asignada: "var(--accent-light)",
  activa: "var(--success)",
  finalizada: "var(--text-secondary)",
  cancelada: "var(--danger)",
};

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{valor}</p>
    </div>
  );
}

export default function FichaAsignacionPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [asignacion, setAsignacion] = useState<Asignacion | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [maestroGuia, setMaestroGuia] = useState<MaestroGuia | null>(null);
  const [responsable, setResponsable] = useState<Usuario | null>(null);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [denegada, setDenegada] = useState(false);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [cambiandoProfesor, setCambiandoProfesor] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      try {
        const snapAsig = await getDoc(doc(db, "asignaciones", id));
        if (!snapAsig.exists()) {
          setNoEncontrada(true);
          setLoading(false);
          return;
        }
        const a = { id: snapAsig.id, ...snapAsig.data() } as Asignacion;
        if (usuario!.rol === "profesor" && a.profesorSupervisorId !== usuario!.uid) {
          setDenegada(true);
          setLoading(false);
          registrarEvento({
            uid: usuario!.uid, nombre: usuario!.nombre, rol: usuario!.rol, liceoId: usuario!.liceoId,
            accion: "ver_asignacion", recurso: "asignaciones", recursoId: id,
            resultado: "denegado", detalle: "Asignación fuera del ámbito autorizado del profesor.",
          });
          return;
        }
        setAsignacion(a);

        const [snapEst, snapCentro, snapResp, snapMg, snapProfesores, snapEspecialidades] = await Promise.all([
          getDoc(doc(db, "estudiantes", a.estudianteId)),
          getDoc(doc(db, "centros_duales", a.centroDualId)),
          getDoc(doc(db, "usuarios", a.creadoPor)),
          a.maestroGuiaId ? getDoc(doc(db, "maestros_guia", a.maestroGuiaId)) : Promise.resolve(null),
          getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario!.liceoId), where("rol", "==", "profesor"))),
          getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        if (snapEst.exists()) setEstudiante({ id: snapEst.id, ...snapEst.data() } as Estudiante);
        if (snapCentro.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
        if (snapResp.exists()) setResponsable(snapResp.data() as Usuario);
        if (snapMg?.exists()) setMaestroGuia({ id: snapMg.id, ...snapMg.data() } as MaestroGuia);
        setProfesores(snapProfesores.docs.map((d) => ({ ...d.data() } as Usuario)));
        setEspecialidades(snapEspecialidades.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      } catch {
        setDenegada(true);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [usuario, id]);

  const puedeEditar = Boolean(usuario && (
    usuario.rol === "administrador" || usuario.rol === "coordinador" || usuario.rol === "director"
    || (usuario.rol === "profesor" && asignacion?.profesorSupervisorId === usuario.uid)
  ));

  const profesorActual = profesores.find((p) => p.uid === asignacion?.profesorSupervisorId) ?? null;

  function especialidadNombre(id?: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || "";
  }

  const profesoresFiltrados = (() => {
    const nombre = especialidadNombre(estudiante?.especialidadId);
    if (!nombre) return profesores;
    const filtrados = profesores.filter((p) => especialidadCoincide(p.especialidad, nombre));
    return filtrados.length > 0 ? filtrados : profesores;
  })();

  async function cambiarProfesor(nuevoProfesorId: string) {
    if (!asignacion || cambiandoProfesor) return;
    const anteriorId = asignacion.profesorSupervisorId;
    if (nuevoProfesorId === (anteriorId || "")) return;
    setCambiandoProfesor(true);
    try {
      await updateDoc(
        doc(db, "asignaciones", asignacion.id),
        nuevoProfesorId
          ? { profesorSupervisorId: nuevoProfesorId, actualizadoEn: new Date().toISOString() }
          : { profesorSupervisorId: deleteField(), actualizadoEn: new Date().toISOString() }
      );
      setAsignacion({ ...asignacion, profesorSupervisorId: nuevoProfesorId || undefined });
      if (nuevoProfesorId) await sincronizarAutorizacionesDeProfesor(nuevoProfesorId);
      if (anteriorId && anteriorId !== nuevoProfesorId) await sincronizarAutorizacionesDeProfesor(anteriorId);
      if (usuario) {
        registrarEvento({
          uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
          accion: "cambiar_profesor_supervisor", recurso: "asignaciones", recursoId: asignacion.id,
          resultado: "permitido",
          detalle: `Profesor supervisor: ${profesorActual?.nombre || "sin asignar"} → ${profesores.find((p) => p.uid === nuevoProfesorId)?.nombre || "sin asignar"}`,
        });
      }
    } finally {
      setCambiandoProfesor(false);
    }
  }

  async function cambiarEstado(nuevoEstado: EstadoAsignacion) {
    if (!asignacion || actualizandoEstado) return;
    setActualizandoEstado(true);
    try {
      await updateDoc(doc(db, "asignaciones", asignacion.id), { estado: nuevoEstado, actualizadoEn: new Date().toISOString() });
      setAsignacion({ ...asignacion, estado: nuevoEstado });
      if (estudiante) {
        if (nuevoEstado === "asignada" || nuevoEstado === "activa") {
          await updateDoc(doc(db, "estudiantes", estudiante.id), { centroDualId: asignacion.centroDualId });
        } else if (nuevoEstado === "cancelada") {
          await updateDoc(doc(db, "estudiantes", estudiante.id), { centroDualId: "" });
        }
      }
    } finally {
      setActualizandoEstado(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (denegada) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <ShieldAlert size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Acceso denegado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Esta asignación no está dentro de tu ámbito autorizado.</p>
          <Link href="/dashboard/estudiantes/asignaciones" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrada || !asignacion) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Asignación no encontrada</p>
          <Link href="/dashboard/estudiantes/asignaciones" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <TituloPagina icon={<CalendarCheck size={28} />}>Ficha de asignación</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          {estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : "Estudiante no encontrado"} — {centro?.nombre ?? "Centro no encontrado"}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: ESTADO_COLOR[asignacion.estado], background: ESTADO_COLOR[asignacion.estado] + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {ESTADO_LABEL[asignacion.estado]}
        </span>
        {puedeEditar && (
          <Select
            value={asignacion.estado}
            onChange={(v) => cambiarEstado(v as EstadoAsignacion)}
            disabled={actualizandoEstado}
            ariaLabel="Cambiar estado de la asignación"
            className="w-52"
            opciones={ESTADOS.map((es) => ({ value: es, label: `Cambiar a: ${ESTADO_LABEL[es]}` }))}
          />
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Estudiante</p>
        {estudiante ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Dato label="Nombre" valor={`${estudiante.nombres} ${estudiante.apellidos}`} />
            <Dato label="Curso" valor={estudiante.curso || "—"} />
            <Dato label="RUN" valor={estudiante.run} />
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Estudiante no encontrado.</p>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Centro dual</p>
        {centro ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Dato label="Empresa" valor={centro.nombre} />
            <Dato label="Dirección" valor={`${centro.direccion}, ${centro.comuna}`} />
            <Dato
              label="Maestro guía"
              valor={
                maestroGuia ? (
                  <Link href={`/dashboard/centros/maestros/${maestroGuia.id}`} style={{ color: "var(--accent-light)" }} className="hover:underline">
                    {maestroGuia.nombres} {maestroGuia.apellidoPaterno}
                  </Link>
                ) : (
                  asignacion.maestroGuia || centro.maestroGuia || "—"
                )
              }
            />
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Centro dual no encontrado.</p>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Profesor supervisor</p>
        {puedeEditar ? (
          <div className="max-w-xs">
            <Select
              value={asignacion.profesorSupervisorId || ""}
              onChange={cambiarProfesor}
              disabled={cambiandoProfesor}
              ariaLabel="Profesor supervisor"
              placeholder={profesoresFiltrados.length === 0 ? "No hay profesores registrados" : "Selecciona un profesor"}
              opciones={[{ value: "", label: "Sin profesor asignado" }, ...profesoresFiltrados.map((p) => ({ value: p.uid, label: p.nombre }))]}
            />
            {estudiante && especialidadNombre(estudiante.especialidadId) && profesoresFiltrados.length === profesores.length && profesores.length > 0 && (
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">Ningún profesor tiene registrada la especialidad de este estudiante — puedes elegir manualmente.</p>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--text-primary)" }} className="text-sm">{profesorActual?.nombre || "Sin profesor asignado"}</p>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">Compatibilidad</p>
        {asignacion.compatibilidad.limitada ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm italic mb-3">Compatibilidad limitada por falta de información</p>
        ) : (
          <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold mb-3">{asignacion.compatibilidad.puntaje}%</p>
        )}
        {asignacion.compatibilidad.coincidencias.length > 0 && (
          <div className="mb-3">
            <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold mb-1">Factores de compatibilidad</p>
            {asignacion.compatibilidad.coincidencias.map((c, i) => (
              <p key={i} style={{ color: "var(--success)" }} className="text-xs">✓ {c.descripcion}</p>
            ))}
          </div>
        )}
        {asignacion.compatibilidad.advertencias.length > 0 && (
          <div>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold mb-1">Aspectos a considerar</p>
            {asignacion.compatibilidad.advertencias.map((a, i) => (
              <p key={i} style={{ color: "var(--warning)" }} className="text-xs">⚠ {a.descripcion}</p>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Datos de la asignación</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Fecha de inicio" valor={asignacion.fechaInicio ? formatearFecha(asignacion.fechaInicio) : "No definida"} />
          <Dato label="Fecha de término" valor={asignacion.fechaTermino ? formatearFecha(asignacion.fechaTermino) : "No definida"} />
          <Dato label="Jornada" valor={asignacion.jornada || "No definida"} />
        </div>
        {asignacion.observaciones && (
          <div className="mt-4">
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">Observaciones</p>
            <p style={{ color: "var(--text-primary)" }} className="text-sm">{asignacion.observaciones}</p>
          </div>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Trazabilidad</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Dato label="Asignación creada" valor={formatearFecha(asignacion.creadoEn)} />
          <Dato label="Responsable" valor={responsable?.nombre || "No disponible"} />
        </div>
      </div>
    </div>
  );
}
