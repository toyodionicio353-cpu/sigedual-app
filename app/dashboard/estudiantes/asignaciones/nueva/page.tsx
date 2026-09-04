"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { calcularCompatibilidad, disponibleParaRecomendar, estadoEfectivo, capacidadDe } from "@/lib/compatibilidad";
import { formatearFecha } from "@/lib/fecha";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import type { Asignacion, CentroDual, Compatibilidad, EstadoAsignacion, Especialidad, Estudiante, MaestroGuia, Usuario } from "@/types";
import {
  ArrowLeft, ArrowRight, Search, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, User, Users, CalendarCheck,
} from "lucide-react";

const JORNADAS = ["Diurna", "Vespertina", "Jornada Completa", "Otro"];
const ESTADOS_INICIALES: EstadoAsignacion[] = ["pendiente", "en_proceso", "asignada", "activa"];
const ESTADO_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};
const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const ESTADOS_ESTUDIANTE: Estudiante["estado"][] = ["activo", "inactivo", "egresado", "retirado"];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function iniciales(nombres: string, apellidos: string): string {
  return `${(nombres[0] || "").toUpperCase()}${(apellidos[0] || "").toUpperCase()}`;
}

interface Recomendacion {
  centro: CentroDual;
  compatibilidad: Compatibilidad;
  disponible: boolean;
}

export default function NuevaAsignacionPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [cargando, setCargando] = useState(true);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [maestrosGuia, setMaestrosGuia] = useState<MaestroGuia[]>([]);

  const [modo, setModo] = useState<"individual" | "grupo">("individual");

  const [paso, setPaso] = useState(1);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [estudianteId, setEstudianteId] = useState<string | null>(null);
  const [advertenciaAceptada, setAdvertenciaAceptada] = useState(false);

  // Modo grupo
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroEspecialidadId, setFiltroEspecialidadId] = useState("");
  const [filtroEstadoEst, setFiltroEstadoEst] = useState<Estudiante["estado"] | "">("activo");
  const [incluirConAsignacionActiva, setIncluirConAsignacionActiva] = useState(false);
  const [seleccionGrupo, setSeleccionGrupo] = useState<string[]>([]);
  const [centroPorEstudianteGrupo, setCentroPorEstudianteGrupo] = useState<Record<string, string | null>>({});
  const [filasExcluidas, setFilasExcluidas] = useState<string[]>([]);

  const [tabCentros, setTabCentros] = useState<"recomendados" | "todos">("recomendados");
  const [centroId, setCentroId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTermino, setFechaTermino] = useState("");
  const [jornada, setJornada] = useState("");
  const [profesorSupervisorId, setProfesorSupervisorId] = useState("");
  const [maestroGuiaId, setMaestroGuiaId] = useState("");
  const [estadoInicial, setEstadoInicial] = useState<EstadoAsignacion>("pendiente");
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargando(true);
      const [snapEst, snapEsp, snapCentros, snapAsig, snapUsuarios, snapMg] = await Promise.all([
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario!.liceoId), where("rol", "==", "profesor"))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setProfesores(snapUsuarios.docs.map((d) => ({ ...d.data() } as Usuario)));
      setMaestrosGuia(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setCargando(false);
    }
    cargar();
  }, [usuario]);

  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || "Sin especialidad";
  }

  const estudianteFiltrados = useMemo(() => {
    if (!busquedaEstudiante.trim()) return estudiantes;
    const q = normalizar(busquedaEstudiante);
    const soloAlfanumerico = (t?: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const qAlfanum = soloAlfanumerico(busquedaEstudiante);
    return estudiantes.filter((e) => {
      const campos = [e.nombres, e.apellidos, e.curso, especialidadNombre(e.especialidadId)];
      const coincideTexto = campos.some((c) => normalizar(c).includes(q));
      const coincideRun = qAlfanum.length > 0 && soloAlfanumerico(e.run).includes(qAlfanum);
      return coincideTexto || coincideRun;
    });
  }, [estudiantes, busquedaEstudiante, especialidades]);

  const estudianteSeleccionado = useMemo(() => estudiantes.find((e) => e.id === estudianteId) ?? null, [estudiantes, estudianteId]);

  const asignacionActivaEstudiante = useMemo(() => {
    if (!estudianteId) return null;
    return asignaciones.find((a) => a.estudianteId === estudianteId && (a.estado === "asignada" || a.estado === "activa")) ?? null;
  }, [asignaciones, estudianteId]);

  const recomendaciones: Recomendacion[] = useMemo(() => {
    if (!estudianteSeleccionado) return [];
    return centros
      .map((centro) => ({
        centro,
        compatibilidad: calcularCompatibilidad(estudianteSeleccionado, centro),
        disponible: disponibleParaRecomendar(centro, asignaciones),
      }))
      .sort((a, b) => (b.compatibilidad.puntaje ?? -1) - (a.compatibilidad.puntaje ?? -1));
  }, [centros, estudianteSeleccionado, asignaciones]);

  const recomendadosDisponibles = useMemo(
    () => recomendaciones.filter((r) => r.disponible && r.centro.especialidades.includes(estudianteSeleccionado?.especialidadId ?? "")),
    [recomendaciones, estudianteSeleccionado]
  );

  const listaCentrosVisible = tabCentros === "recomendados" ? recomendadosDisponibles : recomendaciones;
  const centroSeleccionado = useMemo(() => centros.find((c) => c.id === centroId) ?? null, [centros, centroId]);
  const maestrosGuiaDelCentro = useMemo(
    () => maestrosGuia.filter((m) => m.centroDualId === centroSeleccionado?.id && m.estado === "activo"),
    [maestrosGuia, centroSeleccionado]
  );
  const maestroGuiaSeleccionado = useMemo(() => maestrosGuia.find((m) => m.id === maestroGuiaId) ?? null, [maestrosGuia, maestroGuiaId]);
  const compatibilidadSeleccionada = useMemo(() => {
    if (!estudianteSeleccionado || !centroSeleccionado) return null;
    return calcularCompatibilidad(estudianteSeleccionado, centroSeleccionado);
  }, [estudianteSeleccionado, centroSeleccionado]);

  // --- Modo grupo ---
  const estudiantesConAsignacionActivaIds = useMemo(
    () => new Set(asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa").map((a) => a.estudianteId)),
    [asignaciones]
  );

  const cursosDisponiblesGrupo = useMemo(() => {
    const set = new Set<string>();
    estudiantes.filter((e) => !filtroNivel || e.nivel === filtroNivel).forEach((e) => { if (e.curso) set.add(e.curso); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [estudiantes, filtroNivel]);

  const estudiantesGrupoFiltrados = useMemo(() => {
    let base = estudiantes;
    if (filtroNivel) base = base.filter((e) => e.nivel === filtroNivel);
    if (filtroCurso) base = base.filter((e) => e.curso === filtroCurso);
    if (filtroEspecialidadId) base = base.filter((e) => e.especialidadId === filtroEspecialidadId);
    if (filtroEstadoEst) base = base.filter((e) => e.estado === filtroEstadoEst);
    if (busquedaEstudiante.trim()) {
      const q = normalizar(busquedaEstudiante);
      base = base.filter((e) => normalizar(`${e.nombres} ${e.apellidos} ${e.curso}`).includes(q));
    }
    return base;
  }, [estudiantes, filtroNivel, filtroCurso, filtroEspecialidadId, filtroEstadoEst, busquedaEstudiante]);

  const todosFiltradosSeleccionados = estudiantesGrupoFiltrados.length > 0 && estudiantesGrupoFiltrados.every((e) => seleccionGrupo.includes(e.id));

  function toggleSeleccionGrupo(id: string) {
    setSeleccionGrupo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSeleccionarTodosFiltrados() {
    if (todosFiltradosSeleccionados) {
      const idsFiltrados = new Set(estudiantesGrupoFiltrados.map((e) => e.id));
      setSeleccionGrupo((prev) => prev.filter((id) => !idsFiltrados.has(id)));
    } else {
      setSeleccionGrupo((prev) => Array.from(new Set([...prev, ...estudiantesGrupoFiltrados.map((e) => e.id)])));
    }
  }

  const estudiantesSeleccionadosGrupo = useMemo(
    () => estudiantes.filter((e) => seleccionGrupo.includes(e.id)),
    [estudiantes, seleccionGrupo]
  );

  // Asignación golosa: a cada estudiante (ordenado por su mejor compatibilidad)
  // se le sugiere el centro mejor puntuado que aún tenga cupo, contabilizando
  // tanto las asignaciones ya existentes como las reservas del propio lote.
  function calcularSugerenciasGrupo(seleccionados: Estudiante[]): Record<string, string | null> {
    const porEstudiante = seleccionados.map((estudiante) => ({
      estudiante,
      opciones: centros
        .filter((c) => c.especialidades.includes(estudiante.especialidadId) && estadoEfectivo(c) === "activo")
        .map((centro) => ({ centro, compatibilidad: calcularCompatibilidad(estudiante, centro) }))
        .sort((a, b) => (b.compatibilidad.puntaje ?? -1) - (a.compatibilidad.puntaje ?? -1)),
    }));
    porEstudiante.sort((a, b) => (b.opciones[0]?.compatibilidad.puntaje ?? -1) - (a.opciones[0]?.compatibilidad.puntaje ?? -1));

    const cuposUsados = new Map<string, number>();
    for (const a of asignaciones) {
      if (a.estado === "asignada" || a.estado === "activa") {
        cuposUsados.set(a.centroDualId, (cuposUsados.get(a.centroDualId) ?? 0) + 1);
      }
    }

    const resultado: Record<string, string | null> = {};
    for (const { estudiante, opciones } of porEstudiante) {
      let elegido: string | null = null;
      for (const { centro } of opciones) {
        const usados = cuposUsados.get(centro.id) ?? 0;
        const capacidad = capacidadDe(centro);
        if (capacidad == null || usados < capacidad) {
          elegido = centro.id;
          cuposUsados.set(centro.id, usados + 1);
          break;
        }
      }
      resultado[estudiante.id] = elegido;
    }
    return resultado;
  }

  function opcionesCentroPara(estudiante: Estudiante) {
    return centros
      .filter((c) => c.especialidades.includes(estudiante.especialidadId))
      .map((centro) => ({ centro, compatibilidad: calcularCompatibilidad(estudiante, centro), disponible: disponibleParaRecomendar(centro, asignaciones) }))
      .sort((a, b) => (b.compatibilidad.puntaje ?? -1) - (a.compatibilidad.puntaje ?? -1));
  }

  const filasGrupo = useMemo(
    () => estudiantesSeleccionadosGrupo
      .filter((e) => !filasExcluidas.includes(e.id))
      .map((estudiante) => {
        const centroId2 = centroPorEstudianteGrupo[estudiante.id] ?? null;
        const centro = centroId2 ? centros.find((c) => c.id === centroId2) ?? null : null;
        const compatibilidad = centro ? calcularCompatibilidad(estudiante, centro) : null;
        return { estudiante, centro, compatibilidad };
      }),
    [estudiantesSeleccionadosGrupo, filasExcluidas, centroPorEstudianteGrupo, centros]
  );

  const filasGrupoListas = filasGrupo.filter((f) => f.centro);

  function seleccionarEstudiante(id: string) {
    setEstudianteId(id);
    setAdvertenciaAceptada(false);
  }

  function irAPaso2() {
    if (!estudianteId) return;
    if (asignacionActivaEstudiante && !advertenciaAceptada) return;
    setPaso(2);
  }

  function irAPaso2Grupo() {
    if (seleccionGrupo.length === 0) return;
    setFilasExcluidas([]);
    setCentroPorEstudianteGrupo(calcularSugerenciasGrupo(estudiantesSeleccionadosGrupo));
    setPaso(2);
  }

  function seleccionarCentro(id: string) {
    setCentroId(id);
    const disponibles = maestrosGuia.filter((m) => m.centroDualId === id && m.estado === "activo");
    setMaestroGuiaId(disponibles.length === 1 ? disponibles[0].id : "");
    setPaso(3);
  }

  async function confirmarAsignacion() {
    if (!usuario || !estudianteSeleccionado || !centroSeleccionado || !compatibilidadSeleccionada || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const nueva: Record<string, unknown> = {
        estudianteId: estudianteSeleccionado.id,
        centroDualId: centroSeleccionado.id,
        liceoId: usuario.liceoId,
        estado: estadoInicial,
        compatibilidad: compatibilidadSeleccionada,
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      };
      if (fechaInicio) nueva.fechaInicio = fechaInicio;
      if (fechaTermino) nueva.fechaTermino = fechaTermino;
      if (jornada) nueva.jornada = jornada;
      if (profesorSupervisorId) nueva.profesorSupervisorId = profesorSupervisorId;
      if (maestroGuiaId) nueva.maestroGuiaId = maestroGuiaId;
      if (maestroGuiaSeleccionado) nueva.maestroGuia = `${maestroGuiaSeleccionado.nombres} ${maestroGuiaSeleccionado.apellidoPaterno}`;
      if (observaciones.trim()) nueva.observaciones = observaciones.trim();
      const ref = await addDoc(collection(db, "asignaciones"), nueva);
      if (estadoInicial === "asignada" || estadoInicial === "activa") {
        await updateDoc(doc(db, "estudiantes", estudianteSeleccionado.id), { centroDualId: centroSeleccionado.id });
      }
      router.push(`/dashboard/estudiantes/asignaciones/${ref.id}`);
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible crear la asignación. Intenta nuevamente. (${detalle})`);
      setGuardando(false);
    }
  }

  async function confirmarAsignacionesGrupo() {
    if (!usuario || guardando || filasGrupoListas.length === 0) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const batch = writeBatch(db);
      for (const { estudiante, centro, compatibilidad } of filasGrupoListas) {
        if (!centro || !compatibilidad) continue;
        const ref = doc(collection(db, "asignaciones"));
        const nueva: Record<string, unknown> = {
          estudianteId: estudiante.id,
          centroDualId: centro.id,
          liceoId: usuario.liceoId,
          estado: estadoInicial,
          compatibilidad,
          creadoPor: usuario.uid,
          creadoEn: new Date().toISOString(),
        };
        if (fechaInicio) nueva.fechaInicio = fechaInicio;
        if (fechaTermino) nueva.fechaTermino = fechaTermino;
        if (jornada) nueva.jornada = jornada;
        if (profesorSupervisorId) nueva.profesorSupervisorId = profesorSupervisorId;
        const mgDelCentro = maestrosGuia.filter((m) => m.centroDualId === centro.id && m.estado === "activo");
        if (mgDelCentro.length === 1) {
          nueva.maestroGuiaId = mgDelCentro[0].id;
          nueva.maestroGuia = `${mgDelCentro[0].nombres} ${mgDelCentro[0].apellidoPaterno}`;
        }
        if (observaciones.trim()) nueva.observaciones = observaciones.trim();
        batch.set(ref, nueva);
        if (estadoInicial === "asignada" || estadoInicial === "activa") {
          batch.update(doc(db, "estudiantes", estudiante.id), { centroDualId: centro.id });
        }
      }
      await batch.commit();
      router.push("/dashboard/estudiantes/asignaciones");
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible crear las asignaciones. Intenta nuevamente. (${detalle})`);
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  const PASOS = modo === "grupo"
    ? ["Grupo", "Centros sugeridos", "Detalles", "Confirmar"]
    : ["Estudiante", "Centro dual", "Detalles", "Confirmar"];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <TituloPagina icon={<CalendarCheck size={28} />}>Nueva asignación</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          {modo === "grupo" ? "Filtra un grupo de estudiantes y SIGEDUAL sugerirá un centro dual compatible para cada uno." : "Selecciona un estudiante y SIGEDUAL recomendará los centros duales más compatibles."}
        </p>
      </div>

      {/* Selector de modo */}
      {paso === 1 && (
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setModo("individual")}
            style={{
              background: modo === "individual" ? "var(--accent)" : "var(--bg-card)",
              color: modo === "individual" ? "var(--text-on-accent)" : "var(--text-secondary)",
              border: `1px solid ${modo === "individual" ? "var(--accent)" : "var(--border)"}`,
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <User size={16} />
            Un estudiante
          </button>
          <button
            type="button"
            onClick={() => setModo("grupo")}
            style={{
              background: modo === "grupo" ? "var(--accent)" : "var(--bg-card)",
              color: modo === "grupo" ? "var(--text-on-accent)" : "var(--text-secondary)",
              border: `1px solid ${modo === "grupo" ? "var(--accent)" : "var(--border)"}`,
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Users size={16} />
            Grupo de estudiantes
          </button>
        </div>
      )}

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto">
        {PASOS.map((p, i) => {
          const num = i + 1;
          const activo = paso === num;
          const completado = paso > num;
          return (
            <div key={p} className="flex items-center gap-2 flex-shrink-0">
              <div
                style={{
                  background: activo || completado ? "var(--accent)" : "var(--bg-surface)",
                  color: activo || completado ? "var(--text-on-accent)" : "var(--text-muted)",
                  border: `1px solid ${activo || completado ? "var(--accent)" : "var(--border)"}`,
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              >
                {completado ? <CheckCircle2 size={14} /> : num}
              </div>
              <span style={{ color: activo ? "var(--text-primary)" : "var(--text-muted)" }} className="text-xs font-medium whitespace-nowrap">{p}</span>
              {i < PASOS.length - 1 && <div style={{ background: "var(--border)" }} className="w-6 h-px" />}
            </div>
          );
        })}
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {/* Paso 1: seleccionar estudiante (modo individual) */}
      {paso === 1 && modo === "individual" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <div className="relative mb-4">
            <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={busquedaEstudiante}
              onChange={(e) => setBusquedaEstudiante(e.target.value)}
              placeholder="Buscar por nombre, RUN o curso..."
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div className="max-h-96 overflow-y-auto flex flex-col gap-2">
            {estudianteFiltrados.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-6">No encontramos estudiantes con ese criterio.</p>
            ) : estudianteFiltrados.map((e) => {
              const seleccionado = e.id === estudianteId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => seleccionarEstudiante(e.id)}
                  style={{
                    background: seleccionado ? "var(--accent)" : "var(--bg-surface)",
                    border: `1px solid ${seleccionado ? "var(--accent)" : "var(--border)"}`,
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors"
                >
                  <div style={{ background: seleccionado ? "var(--text-on-accent)" : "var(--accent)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                    <span style={{ color: seleccionado ? "var(--accent)" : "var(--text-on-accent)" }} className="text-xs font-bold">{iniciales(e.nombres, e.apellidos)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-primary)" }} className="text-sm font-semibold truncate">{e.nombres} {e.apellidos}</p>
                    <p style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-muted)", opacity: seleccionado ? 0.8 : 1 }} className="text-xs mt-0.5">
                      {e.curso || "Sin curso"} · {especialidadNombre(e.especialidadId)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {estudianteSeleccionado && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mt-4">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}</p>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{estudianteSeleccionado.curso || "Sin curso"} — {especialidadNombre(estudianteSeleccionado.especialidadId)}</p>
              {(estudianteSeleccionado.rasgos?.length || estudianteSeleccionado.habilidades?.length) ? (
                <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-2">
                  <span style={{ color: "var(--text-muted)" }}>Características principales: </span>
                  {[...(estudianteSeleccionado.rasgos ?? []), ...(estudianteSeleccionado.habilidades ?? [])].slice(0, 5).join(" · ")}
                </p>
              ) : (
                <p style={{ color: "var(--warning)" }} className="text-xs mt-2">Este estudiante no tiene características ni habilidades registradas — las recomendaciones serán limitadas.</p>
              )}
            </div>
          )}

          {asignacionActivaEstudiante && (
            <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }} className="rounded-xl p-4 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
                <p style={{ color: "var(--warning)" }} className="text-sm font-medium">
                  Este estudiante ya posee una asignación activa. ¿Deseas continuar con una nueva asignación?
                </p>
              </div>
              <label className="flex items-center gap-2 flex-shrink-0 text-sm" style={{ color: "var(--warning)" }}>
                <input type="checkbox" checked={advertenciaAceptada} onChange={(e) => setAdvertenciaAceptada(e.target.checked)} />
                Continuar de todas formas
              </label>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={irAPaso2}
              disabled={!estudianteId || Boolean(asignacionActivaEstudiante && !advertenciaAceptada)}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Continuar
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Paso 1: filtrar y seleccionar grupo (modo grupo) */}
      {paso === 1 && modo === "grupo" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Select value={filtroNivel} onChange={(v) => { setFiltroNivel(v); setFiltroCurso(""); }}
              ariaLabel="Nivel"
              opciones={[{ value: "", label: "Todos los niveles" }, ...NIVELES.map((n) => ({ value: n, label: n }))]} />
            <Select value={filtroCurso} onChange={setFiltroCurso} disabled={!filtroNivel}
              ariaLabel="Curso"
              opciones={[
                { value: "", label: filtroNivel ? "Todos los cursos" : "Selecciona primero un nivel" },
                ...cursosDisponiblesGrupo.map((c) => ({ value: c, label: c })),
              ]} />
            <Select value={filtroEspecialidadId} onChange={setFiltroEspecialidadId}
              ariaLabel="Especialidad"
              opciones={[{ value: "", label: "Todas las especialidades" }, ...especialidades.map((esp) => ({ value: esp.id, label: esp.nombre }))]} />
            <Select value={filtroEstadoEst} onChange={(v) => setFiltroEstadoEst(v as Estudiante["estado"] | "")}
              ariaLabel="Estado"
              opciones={[
                { value: "", label: "Todos los estados" },
                ...ESTADOS_ESTUDIANTE.map((es) => ({ value: es, label: es.charAt(0).toUpperCase() + es.slice(1) })),
              ]} />
          </div>

          <div className="relative mb-4">
            <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={busquedaEstudiante}
              onChange={(e) => setBusquedaEstudiante(e.target.value)}
              placeholder="Buscar por nombre o curso..."
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={todosFiltradosSeleccionados} onChange={toggleSeleccionarTodosFiltrados} />
              Seleccionar todos los filtrados ({estudiantesGrupoFiltrados.length})
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={incluirConAsignacionActiva} onChange={(e) => setIncluirConAsignacionActiva(e.target.checked)} />
                Incluir estudiantes con asignación activa
              </label>
              <span style={{ color: "var(--accent-light)" }} className="text-sm font-semibold whitespace-nowrap">{seleccionGrupo.length} seleccionado(s)</span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto flex flex-col gap-2">
            {estudiantesGrupoFiltrados.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-6">No encontramos estudiantes con esos filtros.</p>
            ) : estudiantesGrupoFiltrados.map((e) => {
              const seleccionado = seleccionGrupo.includes(e.id);
              const tieneActiva = estudiantesConAsignacionActivaIds.has(e.id);
              const deshabilitado = tieneActiva && !incluirConAsignacionActiva;
              return (
                <label
                  key={e.id}
                  style={{
                    background: seleccionado ? "var(--accent)" : "var(--bg-surface)",
                    border: `1px solid ${seleccionado ? "var(--accent)" : "var(--border)"}`,
                    opacity: deshabilitado ? 0.5 : 1,
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={seleccionado}
                    disabled={deshabilitado}
                    onChange={() => toggleSeleccionGrupo(e.id)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-primary)" }} className="text-sm font-semibold truncate">{e.nombres} {e.apellidos}</p>
                    <p style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-muted)", opacity: seleccionado ? 0.8 : 1 }} className="text-xs mt-0.5">
                      {e.curso || "Sin curso"} · {especialidadNombre(e.especialidadId)}
                      {tieneActiva && <span style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--warning)" }}> · Ya tiene asignación activa</span>}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={irAPaso2Grupo}
              disabled={seleccionGrupo.length === 0}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Continuar
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: recomendaciones de centros (modo individual) */}
      {paso === 2 && modo === "individual" && estudianteSeleccionado && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">Centros duales recomendados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Para: {estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}</p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTabCentros("recomendados")}
              style={{
                background: tabCentros === "recomendados" ? "var(--accent)" : "var(--bg-surface)",
                color: tabCentros === "recomendados" ? "var(--text-on-accent)" : "var(--text-secondary)",
                border: `1px solid ${tabCentros === "recomendados" ? "var(--accent)" : "var(--border)"}`,
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Recomendados ({recomendadosDisponibles.length})
            </button>
            <button
              onClick={() => setTabCentros("todos")}
              style={{
                background: tabCentros === "todos" ? "var(--accent)" : "var(--bg-surface)",
                color: tabCentros === "todos" ? "var(--text-on-accent)" : "var(--text-secondary)",
                border: `1px solid ${tabCentros === "todos" ? "var(--accent)" : "var(--border)"}`,
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Todos los centros ({centros.length})
            </button>
          </div>

          {listaCentrosVisible.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-8">
              {tabCentros === "recomendados" ? "No hay centros recomendados disponibles para este estudiante todavía. Prueba en \"Todos los centros\"." : "No hay centros duales registrados en tu liceo."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {listaCentrosVisible.map(({ centro, compatibilidad, disponible }, i) => {
                const abierto = expandido === centro.id;
                return (
                  <div key={centro.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">
                          {tabCentros === "recomendados" && <span style={{ color: "var(--text-muted)" }}>{i + 1}. </span>}
                          {centro.nombre}
                          {!disponible && <span style={{ color: "var(--danger)" }} className="text-xs font-normal ml-2">Sin disponibilidad</span>}
                        </p>
                        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{centro.comuna}</p>
                        <div className="mt-2">
                          {compatibilidad.limitada ? (
                            <p style={{ color: "var(--text-muted)" }} className="text-xs italic">Compatibilidad limitada por falta de información</p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div style={{ background: "var(--border)", borderRadius: 999 }} className="h-1.5 w-32 overflow-hidden">
                                <div style={{ background: "var(--accent)", width: `${compatibilidad.puntaje}%`, height: "100%" }} />
                              </div>
                              <span style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">{compatibilidad.puntaje}% compatible</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandido(abierto ? null : centro.id)}
                        style={{ color: "var(--text-muted)" }}
                        className="flex-shrink-0 p-1"
                      >
                        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {abierto && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                        {compatibilidad.coincidencias.length > 0 && (
                          <div className="mb-2">
                            <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold mb-1">¿Por qué se recomienda?</p>
                            {compatibilidad.coincidencias.map((c, ci) => (
                              <p key={ci} style={{ color: "var(--success)" }} className="text-xs">✓ {c.descripcion}</p>
                            ))}
                          </div>
                        )}
                        {compatibilidad.advertencias.length > 0 && (
                          <div>
                            <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold mb-1">Aspectos a considerar</p>
                            {compatibilidad.advertencias.map((a, ai) => (
                              <p key={ai} style={{ color: "var(--warning)" }} className="text-xs">⚠ {a.descripcion}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => seleccionarCentro(centro.id)}
                      style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                      className="w-full mt-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Seleccionar este centro
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setPaso(1)}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium mt-6"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>
      )}

      {/* Paso 2: centros sugeridos por estudiante (modo grupo) */}
      {paso === 2 && modo === "grupo" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">Centro dual sugerido por estudiante</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">
            SIGEDUAL sugiere el centro más compatible para cada estudiante, respetando los cupos disponibles. Puedes cambiar cualquier sugerencia o quitar a un estudiante de esta tanda.
          </p>

          <div className="flex flex-col gap-3">
            {estudiantesSeleccionadosGrupo.map((estudiante) => {
              const excluido = filasExcluidas.includes(estudiante.id);
              const centroIdActual = centroPorEstudianteGrupo[estudiante.id] ?? "";
              const opciones = opcionesCentroPara(estudiante);
              const opcionActual = opciones.find((o) => o.centro.id === centroIdActual);
              return (
                <div key={estudiante.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", opacity: excluido ? 0.5 : 1 }} className="rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{estudiante.nombres} {estudiante.apellidos}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{estudiante.curso || "Sin curso"} · {especialidadNombre(estudiante.especialidadId)}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      <input type="checkbox" checked={!excluido} onChange={() => setFilasExcluidas((prev) => (excluido ? prev.filter((id) => id !== estudiante.id) : [...prev, estudiante.id]))} />
                      Incluir
                    </label>
                  </div>

                  {opciones.length === 0 ? (
                    <p style={{ color: "var(--danger)" }} className="text-xs">No hay centros con la especialidad de este estudiante.</p>
                  ) : (
                    <Select
                      value={centroIdActual}
                      onChange={(v) => setCentroPorEstudianteGrupo((prev) => ({ ...prev, [estudiante.id]: v || null }))}
                      disabled={excluido}
                      ariaLabel={`Centro para ${estudiante.nombres}`}
                      opciones={[
                        { value: "", label: "Sin centro asignado" },
                        ...opciones.map(({ centro, compatibilidad, disponible }) => ({
                          value: centro.id,
                          label: `${centro.nombre} — ${compatibilidad.limitada ? "compatibilidad limitada" : `${compatibilidad.puntaje}% compatible`}${!disponible ? " (sin disponibilidad)" : ""}`,
                        })),
                      ]}
                    />
                  )}

                  {!excluido && opcionActual && (
                    <div className="flex items-center gap-2 mt-2">
                      <div style={{ background: "var(--border)", borderRadius: 999 }} className="h-1.5 w-24 overflow-hidden">
                        <div style={{ background: "var(--accent)", width: `${opcionActual.compatibilidad.puntaje ?? 0}%`, height: "100%" }} />
                      </div>
                      <span style={{ color: "var(--text-secondary)" }} className="text-xs">{opcionActual.compatibilidad.limitada ? "Compatibilidad limitada por falta de información" : `${opcionActual.compatibilidad.puntaje}% compatible`}</span>
                    </div>
                  )}
                  {!excluido && !centroIdActual && opciones.length > 0 && (
                    <p style={{ color: "var(--warning)" }} className="text-xs mt-2">Sin centro disponible automáticamente — elige uno manualmente o deja a este estudiante fuera de la tanda.</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPaso(1)}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <button
              onClick={() => setPaso(3)}
              disabled={filasGrupoListas.length === 0}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Continuar ({filasGrupoListas.length})
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Paso 3: configurar asignación */}
      {paso === 3 && (modo === "grupo" ? filasGrupoListas.length > 0 : Boolean(estudianteSeleccionado && centroSeleccionado)) && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">Datos de la asignación</p>
          {modo === "grupo" && (
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Estos datos se aplicarán a las {filasGrupoListas.length} asignaciones de esta tanda. El maestro guía se toma automáticamente del centro asignado a cada estudiante.</p>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${modo === "grupo" ? "mt-4" : ""}`}>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha de inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha de término</label>
              <input type="date" value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Jornada</label>
              <Select value={jornada} onChange={setJornada}
                ariaLabel="Jornada"
                placeholder="Selecciona una jornada"
                opciones={JORNADAS.map((j) => ({ value: j, label: j }))} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Profesor supervisor</label>
              <Select value={profesorSupervisorId} onChange={setProfesorSupervisorId}
                ariaLabel="Profesor supervisor"
                placeholder={profesores.length === 0 ? "No hay profesores registrados" : "Selecciona un profesor"}
                opciones={profesores.map((p) => ({ value: p.uid, label: p.nombre }))} />
            </div>
            {modo === "individual" && (
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Maestro guía</label>
                <Select value={maestroGuiaId} onChange={setMaestroGuiaId}
                  disabled={maestrosGuiaDelCentro.length === 0}
                  ariaLabel="Maestro guía"
                  placeholder={maestrosGuiaDelCentro.length === 0 ? "Sin maestros guía en este centro" : "Selecciona un maestro guía"}
                  opciones={maestrosGuiaDelCentro.map((m) => ({ value: m.id, label: `${m.nombres} ${m.apellidoPaterno} — ${m.cargo}` }))} />
                {maestrosGuiaDelCentro.length === 0 && (
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
                    {centroSeleccionado?.nombre} no tiene maestros guía registrados. <Link href="/dashboard/centros/maestros/nuevo" style={{ color: "var(--accent-light)" }} className="hover:underline">Agregar uno</Link>.
                  </p>
                )}
              </div>
            )}
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado inicial</label>
              <Select value={estadoInicial} onChange={(v) => setEstadoInicial(v as EstadoAsignacion)}
                ariaLabel="Estado inicial"
                opciones={ESTADOS_INICIALES.map((es) => ({ value: es, label: ESTADO_LABEL[es] }))} />
            </div>
            <div className="sm:col-span-2">
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Observaciones (opcional)</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-none" />
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setPaso(2)}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <button
              onClick={() => setPaso(4)}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Revisar y confirmar
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Paso 4: confirmación (modo individual) */}
      {paso === 4 && modo === "individual" && estudianteSeleccionado && centroSeleccionado && compatibilidadSeleccionada && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-4">Confirmar asignación</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
              <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1">Estudiante</p>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{estudianteSeleccionado.curso || "Sin curso"} — {especialidadNombre(estudianteSeleccionado.especialidadId)}</p>
            </div>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
              <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1">Centro dual</p>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{centroSeleccionado.nombre}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{centroSeleccionado.comuna}</p>
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mb-4">
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1">Compatibilidad</p>
            {compatibilidadSeleccionada.limitada ? (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm italic">Compatibilidad limitada por falta de información</p>
            ) : (
              <p style={{ color: "var(--text-primary)" }} className="text-xl font-bold">{compatibilidadSeleccionada.puntaje}%</p>
            )}
            {compatibilidadSeleccionada.coincidencias.length > 0 && (
              <div className="mt-2">
                <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold mb-1">Coincidencias principales</p>
                {compatibilidadSeleccionada.coincidencias.slice(0, 5).map((c, i) => (
                  <p key={i} style={{ color: "var(--success)" }} className="text-xs">✓ {c.descripcion}</p>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mb-6 text-sm flex flex-col gap-1.5">
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de inicio: </span>{fechaInicio ? formatearFecha(fechaInicio) : "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de término: </span>{fechaTermino ? formatearFecha(fechaTermino) : "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Jornada: </span>{jornada || "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Profesor supervisor: </span>{profesores.find((p) => p.uid === profesorSupervisorId)?.nombre || "No definido"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Maestro guía: </span>{maestroGuiaSeleccionado ? `${maestroGuiaSeleccionado.nombres} ${maestroGuiaSeleccionado.apellidoPaterno}` : "No definido"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estado: </span>{ESTADO_LABEL[estadoInicial]}</p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setPaso(3)}
              disabled={guardando}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              Cancelar
            </button>
            <button
              onClick={() => conConfirmacion(confirmarAsignacion)}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Confirmar asignación"}
            </button>
          </div>
        </div>
      )}

      {/* Paso 4: confirmación (modo grupo) */}
      {paso === 4 && modo === "grupo" && filasGrupoListas.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Confirmar asignaciones</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Se crearán {filasGrupoListas.length} asignación(es).</p>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl overflow-hidden mb-4">
            {filasGrupoListas.map(({ estudiante, centro, compatibilidad }, i) => (
              <div key={estudiante.id} style={{ borderBottom: i < filasGrupoListas.length - 1 ? "1px solid var(--border)" : "none" }} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{estudiante.nombres} {estudiante.apellidos}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{centro?.nombre}</p>
                </div>
                <span style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold flex-shrink-0">
                  {compatibilidad?.limitada ? "Limitada" : `${compatibilidad?.puntaje}%`}
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mb-6 text-sm flex flex-col gap-1.5">
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de inicio: </span>{fechaInicio ? formatearFecha(fechaInicio) : "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de término: </span>{fechaTermino ? formatearFecha(fechaTermino) : "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Jornada: </span>{jornada || "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Profesor supervisor: </span>{profesores.find((p) => p.uid === profesorSupervisorId)?.nombre || "No definido"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estado: </span>{ESTADO_LABEL[estadoInicial]}</p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setPaso(3)}
              disabled={guardando}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              Cancelar
            </button>
            <button
              onClick={() => conConfirmacion(confirmarAsignacionesGrupo)}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {guardando ? "Guardando..." : `Confirmar ${filasGrupoListas.length} asignaciones`}
            </button>
          </div>
        </div>
      )}

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una asignación" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
