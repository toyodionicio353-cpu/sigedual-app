"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addDoc, collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { plantillaEvaluacionPorId } from "@/lib/evaluaciones";
import { calcularResultado, evaluacionCompleta } from "@/lib/evaluaciones/calcular";
import { NIVELES_LOGRO } from "@/lib/evaluaciones/tipos";
import type { NivelLogro, TareaAdicionalEvaluacion, Asignacion, Estudiante, CentroDual, MaestroGuia, Especialidad } from "@/types";
import Select from "@/components/ui/Select";
import TituloPagina from "@/components/TituloPagina";
import LeyendaNiveles from "@/components/evaluaciones/LeyendaNiveles";
import { ArrowLeft, ArrowRight, ClipboardCheck, Plus, Trash2, AlertTriangle } from "lucide-react";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function SelectorNivel({ valor, onChange }: { valor?: NivelLogro; onChange: (v: NivelLogro) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {NIVELES_LOGRO.map((n) => (
        <label key={n.value} className="flex items-center gap-1.5 cursor-pointer" title={n.descripcion}>
          <input
            type="radio"
            checked={valor === n.value}
            onChange={() => onChange(n.value)}
            style={{ accentColor: "var(--accent)" }}
          />
          <span style={{ color: valor === n.value ? "var(--text-primary)" : "var(--text-secondary)" }} className="text-sm font-medium">{n.label}</span>
        </label>
      ))}
      <LeyendaNiveles />
    </div>
  );
}

export default function RealizarEvaluacionPage() {
  const { plantillaId } = useParams<{ plantillaId: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const plantilla = plantillaEvaluacionPorId(plantillaId);

  const ambitoProfesor = useAmbitoProfesor();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const esProfesor = usuario?.rol === "profesor";
  const esCentroDual = usuario?.rol === "centro_dual";
  const cargandoAmbito = (esProfesor && ambitoProfesor.cargando) || (esCentroDual && ambitoMaestroGuia.cargando);

  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [paso, setPaso] = useState<0 | 1>(0);
  const [asignacionSeleccionada, setAsignacionSeleccionada] = useState<Asignacion | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [maestroGuia, setMaestroGuia] = useState<MaestroGuia | null>(null);
  const [especialidad, setEspecialidad] = useState<Especialidad | null>(null);
  const [fecha, setFecha] = useState(hoy());

  const [respuestasLogros, setRespuestasLogros] = useState<Record<string, Record<string, NivelLogro>>>({});
  const [tareasAdicionales, setTareasAdicionales] = useState<TareaAdicionalEvaluacion[]>([]);
  const [respuestasDesarrolloPersonal, setRespuestasDesarrolloPersonal] = useState<Record<string, NivelLogro>>({});
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario || cargandoAmbito) return;
    async function cargar() {
      setCargandoDatos(true);
      if (esProfesor) {
        const vigentes = ambitoProfesor.asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa");
        setAsignaciones(vigentes);
        setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", vigentes.map((a) => a.estudianteId)));
      } else if (esCentroDual) {
        const vigentes = ambitoMaestroGuia.asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa");
        setAsignaciones(vigentes);
        setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", vigentes.map((a) => a.estudianteId)));
      } else {
        const [snapAsig, snapEst] = await Promise.all([
          getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
          getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        const todas = snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));
        setAsignaciones(todas.filter((a) => a.estado === "asignada" || a.estado === "activa"));
        setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      }
      setCargandoDatos(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, cargandoAmbito, ambitoProfesor.asignaciones, ambitoMaestroGuia.asignaciones]);

  const opcionesEstudiante = useMemo(
    () => asignaciones.map((a) => {
      const est = estudiantes.find((e) => e.id === a.estudianteId);
      return { value: a.id, label: est ? `${est.nombres} ${est.apellidos}` : "Estudiante" };
    }),
    [asignaciones, estudiantes]
  );

  async function seleccionarAsignacion(asignacionId: string) {
    const asignacion = asignaciones.find((a) => a.id === asignacionId);
    if (!asignacion || !asignacion.maestroGuiaId) return;
    setAsignacionSeleccionada(asignacion);
    const est = estudiantes.find((e) => e.id === asignacion.estudianteId);
    const [snapCentro, snapMg, snapEsp] = await Promise.all([
      getDoc(doc(db, "centros_duales", asignacion.centroDualId)),
      getDoc(doc(db, "maestros_guia", asignacion.maestroGuiaId)),
      est?.especialidadId ? getDoc(doc(db, "especialidades", est.especialidadId)) : Promise.resolve(null),
    ]);
    setCentro(snapCentro.exists() ? ({ id: snapCentro.id, ...snapCentro.data() } as CentroDual) : null);
    setMaestroGuia(snapMg.exists() ? ({ id: snapMg.id, ...snapMg.data() } as MaestroGuia) : null);
    setEspecialidad(snapEsp?.exists() ? ({ id: snapEsp.id, ...snapEsp.data() } as Especialidad) : null);
  }

  function siguiente() {
    if (!asignacionSeleccionada || !maestroGuia) {
      setError("Selecciona un estudiante con maestro guía asignado para continuar.");
      return;
    }
    setError("");
    setPaso(1);
  }

  function setLogro(categoriaId: string, criterioId: string, valor: NivelLogro) {
    setRespuestasLogros((r) => ({ ...r, [categoriaId]: { ...r[categoriaId], [criterioId]: valor } }));
  }

  function agregarTarea() {
    setTareasAdicionales((t) => [...t, { descripcion: "", valor: "B" }]);
  }
  function actualizarTarea(idx: number, campo: keyof TareaAdicionalEvaluacion, valor: string) {
    setTareasAdicionales((t) => t.map((tarea, i) => (i === idx ? { ...tarea, [campo]: valor } : tarea)));
  }
  function quitarTarea(idx: number) {
    setTareasAdicionales((t) => t.filter((_, i) => i !== idx));
  }

  const resultado = plantilla
    ? calcularResultado(plantilla, respuestasLogros, tareasAdicionales.map((t) => t.valor), respuestasDesarrolloPersonal)
    : null;
  const completa = plantilla ? evaluacionCompleta(plantilla, respuestasLogros, respuestasDesarrolloPersonal) : false;
  const tareasIncompletas = tareasAdicionales.some((t) => !t.descripcion.trim());

  async function guardar() {
    if (!plantilla || !usuario || !asignacionSeleccionada || !maestroGuia || !resultado || !completa || guardando) return;
    if (tareasIncompletas) {
      setError("Completa la descripción de cada tarea adicional o quítala.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const nueva = {
        liceoId: usuario.liceoId,
        plantillaId: plantilla.id,
        estudianteId: asignacionSeleccionada.estudianteId,
        centroDualId: asignacionSeleccionada.centroDualId,
        maestroGuiaId: maestroGuia.id,
        asignacionId: asignacionSeleccionada.id,
        tipoEvaluador: plantilla.tipoEvaluador,
        evaluadorUid: usuario.uid,
        evaluadorNombre: usuario.nombre,
        evaluadorRol: usuario.rol,
        fecha,
        respuestasLogros,
        tareasAdicionales,
        respuestasDesarrolloPersonal,
        estado: "completada",
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
        resultados: resultado,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      };
      await addDoc(collection(db, "evaluaciones"), nueva);
      router.push("/dashboard/documentos/evaluaciones");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la evaluación.");
    } finally {
      setGuardando(false);
    }
  }

  if (!plantilla) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Evaluación no encontrada.</p>
      </div>
    );
  }

  const estudianteSeleccionado = asignacionSeleccionada ? estudiantes.find((e) => e.id === asignacionSeleccionada.estudianteId) : null;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/documentos/evaluaciones" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <TituloPagina icon={<ClipboardCheck size={28} />}>{plantilla.nombre}</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{plantilla.especialidad} · {plantilla.nivel}</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      {paso === 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-6">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Selecciona el estudiante a evaluar</p>
          {cargandoDatos || cargandoAmbito ? (
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
          ) : opcionesEstudiante.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">No tienes estudiantes con una asignación vigente para evaluar.</p>
          ) : (
            <>
              <Select
                value={asignacionSeleccionada?.id ?? ""}
                onChange={seleccionarAsignacion}
                ariaLabel="Estudiante"
                placeholder="Selecciona un estudiante"
                opciones={opcionesEstudiante}
              />
              {asignacionSeleccionada && (
                <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <p style={{ color: "var(--text-secondary)" }}>Estudiante: <span style={{ color: "var(--text-primary)" }} className="font-medium">{estudianteSeleccionado ? `${estudianteSeleccionado.nombres} ${estudianteSeleccionado.apellidos}` : "—"}</span></p>
                  <p style={{ color: "var(--text-secondary)" }}>Curso: <span style={{ color: "var(--text-primary)" }} className="font-medium">{estudianteSeleccionado?.curso || "—"}</span></p>
                  <p style={{ color: "var(--text-secondary)" }}>Empresa/Centro Dual: <span style={{ color: "var(--text-primary)" }} className="font-medium">{centro?.nombre || "—"}</span></p>
                  <p style={{ color: "var(--text-secondary)" }}>Maestro Guía: <span style={{ color: "var(--text-primary)" }} className="font-medium">{maestroGuia ? `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}` : "Sin maestro guía asignado"}</span></p>
                  <p style={{ color: "var(--text-secondary)" }}>Especialidad: <span style={{ color: "var(--text-primary)" }} className="font-medium">{especialidad?.nombre || "—"}</span></p>
                  <div>
                    <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha</label>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} className={inputClass} />
                  </div>
                </div>
              )}
              <button
                onClick={siguiente}
                disabled={!asignacionSeleccionada}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                Continuar <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      )}

      {paso === 1 && (
        <div className="flex flex-col gap-5">
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-2">{plantilla.titulo}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <p style={{ color: "var(--text-secondary)" }}>Estudiante: <span style={{ color: "var(--text-primary)" }}>{estudianteSeleccionado ? `${estudianteSeleccionado.nombres} ${estudianteSeleccionado.apellidos}` : "—"}</span></p>
              <p style={{ color: "var(--text-secondary)" }}>Empresa/Centro Dual: <span style={{ color: "var(--text-primary)" }}>{centro?.nombre || "—"}</span></p>
              <p style={{ color: "var(--text-secondary)" }}>Maestro Guía: <span style={{ color: "var(--text-primary)" }}>{maestroGuia ? `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}` : "—"}</span></p>
              <p style={{ color: "var(--text-secondary)" }}>Fecha: <span style={{ color: "var(--text-primary)" }}>{fecha}</span></p>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Logros en las actividades — {plantilla.porcentajeLogros}%</p>
            <div className="flex flex-col gap-6">
              {plantilla.categoriasLogros.map((cat) => (
                <div key={cat.id}>
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-3">{cat.titulo}</p>
                  {cat.permiteTareasDinamicas ? (
                    <div className="flex flex-col gap-3">
                      {tareasAdicionales.length === 0 && (
                        <p style={{ color: "var(--text-muted)" }} className="text-xs">Sin tareas adicionales agregadas.</p>
                      )}
                      {tareasAdicionales.map((tarea, i) => (
                        <div key={i} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <input
                              value={tarea.descripcion}
                              onChange={(e) => actualizarTarea(i, "descripcion", e.target.value)}
                              placeholder="Descripción de la tarea"
                              style={inputStyle} className={`${inputClass} flex-1`}
                            />
                            <button onClick={() => quitarTarea(i)} type="button" style={{ color: "var(--danger)" }} className="p-2 flex-shrink-0"><Trash2 size={15} /></button>
                          </div>
                          <SelectorNivel valor={tarea.valor} onChange={(v) => actualizarTarea(i, "valor", v)} />
                          <input
                            value={tarea.observacion ?? ""}
                            onChange={(e) => actualizarTarea(i, "observacion", e.target.value)}
                            placeholder="Observación (opcional)"
                            style={inputStyle} className={`${inputClass} mt-2`}
                          />
                        </div>
                      ))}
                      <button onClick={agregarTarea} type="button" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1 self-start">
                        <Plus size={14} /> Agregar tarea
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {cat.criterios.map((criterio) => (
                        <div key={criterio.id}>
                          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                          <SelectorNivel valor={respuestasLogros[cat.id]?.[criterio.id]} onChange={(v) => setLogro(cat.id, criterio.id, v)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Desarrollo Personal — {plantilla.porcentajeDesarrolloPersonal}%</p>
            <div className="flex flex-col gap-4">
              {plantilla.criteriosDesarrolloPersonal.map((criterio) => (
                <div key={criterio.id}>
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                  <SelectorNivel valor={respuestasDesarrolloPersonal[criterio.id]} onChange={(v) => setRespuestasDesarrolloPersonal((r) => ({ ...r, [criterio.id]: v }))} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-3">Observaciones</p>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              placeholder="Situaciones particulares, fortalezas, aspectos a mejorar u otra circunstancia relevante (opcional)"
              style={inputStyle} className={inputClass}
            />
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Resultado</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <p style={{ color: "var(--text-secondary)" }}>Logros en actividades: <span style={{ color: "var(--text-primary)" }} className="font-semibold">{resultado?.logrosPorcentaje ?? 0}%</span></p>
              <p style={{ color: "var(--text-secondary)" }}>Desarrollo personal: <span style={{ color: "var(--text-primary)" }} className="font-semibold">{resultado?.desarrolloPersonalPorcentaje ?? 0}%</span></p>
              <p style={{ color: "var(--text-secondary)" }}>Promedio general: <span style={{ color: "var(--accent-light)" }} className="font-bold">{resultado?.promedioGeneral ?? 0}%</span></p>
            </div>
            {!completa && (
              <p style={{ color: "var(--warning)" }} className="text-xs mt-3">Faltan criterios obligatorios por responder.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPaso(0)} type="button" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
              <ArrowLeft size={15} /> Atrás
            </button>
            <button
              onClick={guardar}
              disabled={!completa || guardando || tareasIncompletas}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar evaluación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
