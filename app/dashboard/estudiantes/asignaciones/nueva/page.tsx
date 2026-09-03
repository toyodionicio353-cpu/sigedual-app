"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { calcularCompatibilidad, disponibleParaRecomendar } from "@/lib/compatibilidad";
import type { Asignacion, CentroDual, Compatibilidad, EstadoAsignacion, Especialidad, Estudiante, Usuario } from "@/types";
import {
  ArrowLeft, ArrowRight, Search, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

const JORNADAS = ["Diurna", "Vespertina", "Jornada Completa", "Otro"];
const ESTADOS_INICIALES: EstadoAsignacion[] = ["pendiente", "en_proceso", "asignada", "activa"];
const ESTADO_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};

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

  const [cargando, setCargando] = useState(true);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);

  const [paso, setPaso] = useState(1);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [estudianteId, setEstudianteId] = useState<string | null>(null);
  const [advertenciaAceptada, setAdvertenciaAceptada] = useState(false);

  const [tabCentros, setTabCentros] = useState<"recomendados" | "todos">("recomendados");
  const [centroId, setCentroId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTermino, setFechaTermino] = useState("");
  const [jornada, setJornada] = useState("");
  const [profesorSupervisorId, setProfesorSupervisorId] = useState("");
  const [maestroGuia, setMaestroGuia] = useState("");
  const [estadoInicial, setEstadoInicial] = useState<EstadoAsignacion>("pendiente");
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargando(true);
      const [snapEst, snapEsp, snapCentros, snapAsig, snapUsuarios] = await Promise.all([
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario!.liceoId), where("rol", "==", "profesor"))),
      ]);
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setProfesores(snapUsuarios.docs.map((d) => ({ ...d.data() } as Usuario)));
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
  const compatibilidadSeleccionada = useMemo(() => {
    if (!estudianteSeleccionado || !centroSeleccionado) return null;
    return calcularCompatibilidad(estudianteSeleccionado, centroSeleccionado);
  }, [estudianteSeleccionado, centroSeleccionado]);

  function seleccionarEstudiante(id: string) {
    setEstudianteId(id);
    setAdvertenciaAceptada(false);
  }

  function irAPaso2() {
    if (!estudianteId) return;
    if (asignacionActivaEstudiante && !advertenciaAceptada) return;
    setPaso(2);
  }

  function seleccionarCentro(id: string) {
    setCentroId(id);
    const centro = centros.find((c) => c.id === id);
    setMaestroGuia(centro?.maestroGuia ?? "");
    setPaso(3);
  }

  async function confirmarAsignacion() {
    if (!usuario || !estudianteSeleccionado || !centroSeleccionado || !compatibilidadSeleccionada || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const nueva: Omit<Asignacion, "id"> = {
        estudianteId: estudianteSeleccionado.id,
        centroDualId: centroSeleccionado.id,
        liceoId: usuario.liceoId,
        estado: estadoInicial,
        fechaInicio: fechaInicio || undefined,
        fechaTermino: fechaTermino || undefined,
        jornada: jornada || undefined,
        profesorSupervisorId: profesorSupervisorId || undefined,
        maestroGuia: maestroGuia || undefined,
        observaciones: observaciones.trim() || undefined,
        compatibilidad: compatibilidadSeleccionada,
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      };
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

  if (cargando) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  const PASOS = ["Estudiante", "Centro dual", "Detalles", "Confirmar"];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Nueva asignación</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Selecciona un estudiante y SIGEDUAL recomendará los centros duales más compatibles.</p>
        </div>
        <Link
          href="/dashboard/estudiantes/asignaciones"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
      </div>

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

      {/* Paso 1: seleccionar estudiante */}
      {paso === 1 && (
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

      {/* Paso 2: recomendaciones de centros */}
      {paso === 2 && estudianteSeleccionado && (
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

      {/* Paso 3: configurar asignación */}
      {paso === 3 && estudianteSeleccionado && centroSeleccionado && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Datos de la asignación</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <select value={jornada} onChange={(e) => setJornada(e.target.value)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors">
                <option value="">Selecciona una jornada</option>
                {JORNADAS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Profesor supervisor</label>
              <select value={profesorSupervisorId} onChange={(e) => setProfesorSupervisorId(e.target.value)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors">
                <option value="">{profesores.length === 0 ? "No hay profesores registrados" : "Selecciona un profesor"}</option>
                {profesores.map((p) => <option key={p.uid} value={p.uid}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Maestro guía</label>
              <input value={maestroGuia} onChange={(e) => setMaestroGuia(e.target.value)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado inicial</label>
              <select value={estadoInicial} onChange={(e) => setEstadoInicial(e.target.value as EstadoAsignacion)}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors">
                {ESTADOS_INICIALES.map((es) => <option key={es} value={es}>{ESTADO_LABEL[es]}</option>)}
              </select>
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

      {/* Paso 4: confirmación */}
      {paso === 4 && estudianteSeleccionado && centroSeleccionado && compatibilidadSeleccionada && (
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
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de inicio: </span>{fechaInicio || "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha de término: </span>{fechaTermino || "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Jornada: </span>{jornada || "No definida"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Profesor supervisor: </span>{profesores.find((p) => p.uid === profesorSupervisorId)?.nombre || "No definido"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Maestro guía: </span>{maestroGuia || "No definido"}</p>
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
              onClick={confirmarAsignacion}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Confirmar asignación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
