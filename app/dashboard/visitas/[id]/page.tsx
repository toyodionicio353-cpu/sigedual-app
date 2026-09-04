"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { crearNotificacion } from "@/lib/notificaciones/crearNotificacion";
import { PREGUNTAS_BASE_VISITA, CATEGORIAS_PREGUNTAS_VISITA } from "@/lib/visitas/preguntasBase";
import { estadoCanonico, estudianteIdsDe, fechaProgramadaDe, horaProgramadaDe, ESTADO_VISITA_LABEL, ESTADO_VISITA_COLOR } from "@/lib/visitas/normalizar";
import type {
  Visita, Estudiante, CentroDual, MaestroGuia, Usuario, Especialidad,
  RespuestaPreguntaVisita, ElementoPersonalizadoVisita, AcuerdoVisita, TipoElementoPersonalizado, FuenteInformacionVisita,
} from "@/types";
import Select from "@/components/ui/Select";
import TituloPagina from "@/components/TituloPagina";
import {
  ArrowLeft, MapPin, AlertCircle, PlayCircle, CheckCircle2, Plus, Trash2, Ban, RotateCcw, Lock,
} from "lucide-react";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

const FUENTE_OPCIONES: { value: FuenteInformacionVisita; label: string }[] = [
  { value: "maestro_guia", label: "Maestro Guía" },
  { value: "personal_oficina", label: "Personal de oficina" },
  { value: "encargado_empresa", label: "Encargado de empresa" },
  { value: "otro", label: "Otro" },
];

const TIPO_ELEMENTO_OPCIONES: { value: TipoElementoPersonalizado; label: string }[] = [
  { value: "pregunta", label: "Nueva pregunta" },
  { value: "observacion", label: "Observación" },
  { value: "situacion", label: "Situación detectada" },
  { value: "otro", label: "Otro" },
];

function horaActual(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function FuenteSelector({
  fuente, fuenteNombre, fuenteCargo, onCambiar,
}: {
  fuente?: FuenteInformacionVisita; fuenteNombre?: string; fuenteCargo?: string;
  onCambiar: (f: { fuente?: FuenteInformacionVisita; fuenteNombre?: string; fuenteCargo?: string }) => void;
}) {
  return (
    <div className="mt-2">
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] mb-1">Información proporcionada por</p>
      <div className="flex flex-wrap gap-3">
        {FUENTE_OPCIONES.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={fuente === o.value} onChange={() => onCambiar({ fuente: o.value })} style={{ accentColor: "var(--accent)" }} />
            <span style={{ color: "var(--text-secondary)" }} className="text-xs">{o.label}</span>
          </label>
        ))}
      </div>
      {fuente === "otro" && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input value={fuenteNombre ?? ""} onChange={(e) => onCambiar({ fuente, fuenteNombre: e.target.value })} placeholder="Nombre" style={inputStyle} className={inputClass} />
          <input value={fuenteCargo ?? ""} onChange={(e) => onCambiar({ fuente, fuenteCargo: e.target.value })} placeholder="Cargo" style={inputStyle} className={inputClass} />
        </div>
      )}
    </div>
  );
}

export default function DetalleVisitaPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { usuario } = useAuth();
  const router = useRouter();

  const [visita, setVisita] = useState<Visita | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [maestroGuia, setMaestroGuia] = useState<MaestroGuia | null>(null);
  const [profesorSupervisor, setProfesorSupervisor] = useState<Usuario | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [mostrarMenuElemento, setMostrarMenuElemento] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDoc(doc(db, "visitas", id));
      if (!snap.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const v = { id: snap.id, ...snap.data() } as Visita;
      setVisita(v);
      const idsEst = estudianteIdsDe(v);
      const [snapCentro, snapMg, snapProf, ...snapsEst] = await Promise.all([
        getDoc(doc(db, "centros_duales", v.centroDualId)),
        v.maestroGuiaId ? getDoc(doc(db, "maestros_guia", v.maestroGuiaId)) : Promise.resolve(null),
        getDoc(doc(db, "usuarios", v.profesorSupervisorId ?? v.profesorId ?? "")),
        ...idsEst.map((eid) => getDoc(doc(db, "estudiantes", eid))),
      ]);
      if (snapCentro.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      if (snapMg?.exists()) setMaestroGuia({ id: snapMg.id, ...snapMg.data() } as MaestroGuia);
      if (snapProf.exists()) setProfesorSupervisor(snapProf.data() as Usuario);
      const estudiantesData = snapsEst.filter((s) => s.exists()).map((s) => ({ id: s!.id, ...s!.data() } as Estudiante));
      setEstudiantes(estudiantesData);
      const especialidadIds = Array.from(new Set(estudiantesData.map((e) => e.especialidadId).filter(Boolean)));
      if (especialidadIds.length > 0) {
        const snapsEsp = await Promise.all(especialidadIds.map((eid) => getDoc(doc(db, "especialidades", eid))));
        setEspecialidades(snapsEsp.filter((s) => s.exists()).map((s) => ({ id: s!.id, ...s!.data() } as Especialidad)));
      }
      setLoading(false);

      if (searchParams.get("iniciar") === "1" && estadoCanonico(v.estado) === "agendada") {
        iniciarVisita(v);
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id]);

  function especialidadNombre(espId?: string): string {
    return especialidades.find((e) => e.id === espId)?.nombre || "";
  }

  const puedeGestionar = Boolean(
    usuario && visita && (
      usuario.rol === "administrador" || usuario.rol === "coordinador" || usuario.rol === "director"
      || usuario.uid === (visita.profesorSupervisorId ?? visita.profesorId)
    )
  );

  async function iniciarVisita(v: Visita) {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      const ahora = new Date().toISOString();
      const preguntas: RespuestaPreguntaVisita[] = PREGUNTAS_BASE_VISITA.map((p) => ({ id: p.id, categoria: p.categoria, texto: p.texto, respuesta: "" }));
      const cambios = {
        estado: "en_proceso" as const,
        iniciadoPor: usuario!.uid,
        iniciadoEn: ahora,
        fechaReal: fechaHoy(),
        horaInicioReal: horaActual(),
        preguntas,
        actualizadoEn: ahora,
      };
      await updateDoc(doc(db, "visitas", v.id), cambios);
      registrarEvento({
        uid: usuario!.uid, nombre: usuario!.nombre, rol: usuario!.rol, liceoId: usuario!.liceoId,
        accion: "iniciar_visita", recurso: "visitas", recursoId: v.id, resultado: "permitido",
      });
      setVisita({ ...v, ...cambios });
      router.replace(`/dashboard/visitas/${v.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  function setRespuestaPregunta(preguntaId: string, campo: Partial<RespuestaPreguntaVisita>) {
    setVisita((v) => v && ({ ...v, preguntas: v.preguntas.map((p) => (p.id === preguntaId ? { ...p, ...campo } : p)) }));
  }

  function agregarElemento(tipo: TipoElementoPersonalizado) {
    setMostrarMenuElemento(false);
    if (tipo === "acuerdo") {
      agregarAcuerdo();
      return;
    }
    const nuevo: ElementoPersonalizadoVisita = { id: crypto.randomUUID(), tipo, titulo: "", contenido: "" };
    setVisita((v) => v && ({ ...v, elementosPersonalizados: [...v.elementosPersonalizados, nuevo] }));
  }
  function actualizarElemento(elId: string, campo: Partial<ElementoPersonalizadoVisita>) {
    setVisita((v) => v && ({ ...v, elementosPersonalizados: v.elementosPersonalizados.map((el) => (el.id === elId ? { ...el, ...campo } : el)) }));
  }
  function quitarElemento(elId: string) {
    setVisita((v) => v && ({ ...v, elementosPersonalizados: v.elementosPersonalizados.filter((el) => el.id !== elId) }));
  }

  function agregarAcuerdo() {
    const nuevo: AcuerdoVisita = { id: crypto.randomUUID(), situacion: "", accion: "", responsable: "" };
    setVisita((v) => v && ({ ...v, acuerdos: [...v.acuerdos, nuevo] }));
  }
  function actualizarAcuerdo(acId: string, campo: Partial<AcuerdoVisita>) {
    setVisita((v) => v && ({ ...v, acuerdos: v.acuerdos.map((a) => (a.id === acId ? { ...a, ...campo } : a)) }));
  }
  function quitarAcuerdo(acId: string) {
    setVisita((v) => v && ({ ...v, acuerdos: v.acuerdos.filter((a) => a.id !== acId) }));
  }

  async function finalizarVisita() {
    if (!visita || !usuario || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const ahora = new Date().toISOString();
      const cambios = {
        estado: "finalizada" as const,
        finalizadoPor: usuario.uid,
        finalizadoEn: ahora,
        horaTerminoReal: horaActual(),
        preguntas: visita.preguntas,
        elementosPersonalizados: visita.elementosPersonalizados,
        acuerdos: visita.acuerdos,
        observacionesGenerales: visita.observacionesGenerales ?? "",
        actualizadoEn: ahora,
      };
      await updateDoc(doc(db, "visitas", visita.id), cambios);
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: "finalizar_visita", recurso: "visitas", recursoId: visita.id, resultado: "permitido",
      });
      if (visita.maestroGuiaId) {
        const snapCuenta = await getDocs(query(collection(db, "usuarios"), where("maestroGuiaId", "==", visita.maestroGuiaId), limit(1)));
        if (!snapCuenta.empty) {
          crearNotificacion({
            destinatarioUid: snapCuenta.docs[0].id,
            liceoId: usuario.liceoId,
            tipo: "aviso",
            titulo: "Visita finalizada",
            descripcion: `${usuario.nombre} finalizó el registro de una visita a ${centro?.nombre ?? "tu centro"}.`,
            prioridad: "baja",
            accionHref: `/dashboard/visitas/${visita.id}`,
            accionLabel: "Ver visita",
          });
        }
      }
      setVisita((v) => v && ({ ...v, ...cambios }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible finalizar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(nuevoEstado: "cancelada" | "reprogramada") {
    if (!visita || !usuario || guardando) return;
    if (!confirm(`¿Marcar esta visita como ${nuevoEstado === "cancelada" ? "cancelada" : "reprogramada"}?`)) return;
    setGuardando(true);
    setError("");
    try {
      const ahora = new Date().toISOString();
      await updateDoc(doc(db, "visitas", visita.id), { estado: nuevoEstado, actualizadoEn: ahora });
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: nuevoEstado === "cancelada" ? "cancelar_visita" : "reprogramar_visita",
        recurso: "visitas", recursoId: visita.id, resultado: "permitido",
      });
      setVisita((v) => v && ({ ...v, estado: nuevoEstado, actualizadoEn: ahora }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible actualizar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (noEncontrado || !visita) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Visita no encontrada</p>
          <Link href="/dashboard/visitas" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-4">
            <ArrowLeft size={16} /> Volver a visitas
          </Link>
        </div>
      </div>
    );
  }

  const estado = estadoCanonico(visita.estado);
  const soloLectura = estado === "finalizada" || estado === "cancelada" || estado === "reprogramada";
  const nombresEstudiantes = estudiantes.map((e) => `${e.nombres} ${e.apellidos}`).join(", ") || "Sin estudiante asociado";
  const preguntasPorCategoria = CATEGORIAS_PREGUNTAS_VISITA.map((cat) => ({
    categoria: cat,
    preguntas: visita.preguntas.filter((p) => p.categoria === cat),
  })).filter((c) => c.preguntas.length > 0);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/visitas" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <TituloPagina icon={<MapPin size={28} />}>Registro de visita al Centro Dual</TituloPagina>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{centro?.nombre}</p>
          </div>
        </div>
        <span style={{ color: ESTADO_VISITA_COLOR[estado], background: `${ESTADO_VISITA_COLOR[estado]}22` }} className="text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0">
          {ESTADO_VISITA_LABEL[estado]}
        </span>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      {soloLectura && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <Lock size={15} style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">Esta visita quedó cerrada y su contenido es de solo lectura — no puede editarse.</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <p style={{ color: "var(--text-secondary)" }}>Estudiante(s): <span style={{ color: "var(--text-primary)" }}>{nombresEstudiantes}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Especialidad: <span style={{ color: "var(--text-primary)" }}>{estudiantes.map((e) => especialidadNombre(e.especialidadId)).filter(Boolean).join(", ") || "—"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Nivel: <span style={{ color: "var(--text-primary)" }}>{estudiantes.map((e) => e.nivel).filter(Boolean).join(", ") || "—"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Centro Dual/Empresa: <span style={{ color: "var(--text-primary)" }}>{centro?.nombre || "—"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Dirección: <span style={{ color: "var(--text-primary)" }}>{visita.direccion || "—"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Maestro Guía: <span style={{ color: "var(--text-primary)" }}>{maestroGuia ? `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}` : "No definido"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Profesor Supervisor: <span style={{ color: "var(--text-primary)" }}>{profesorSupervisor?.nombre || "—"}</span></p>
          <p style={{ color: "var(--text-secondary)" }}>Fecha de visita: <span style={{ color: "var(--text-primary)" }}>{formatearFecha(fechaProgramadaDe(visita))}{horaProgramadaDe(visita) ? ` · ${horaProgramadaDe(visita)}` : ""}</span></p>
          {visita.horaInicioReal && <p style={{ color: "var(--text-secondary)" }}>Hora de inicio: <span style={{ color: "var(--text-primary)" }}>{visita.horaInicioReal}</span></p>}
          {visita.horaTerminoReal && <p style={{ color: "var(--text-secondary)" }}>Hora de término: <span style={{ color: "var(--text-primary)" }}>{visita.horaTerminoReal}</span></p>}
          {visita.motivo && <p style={{ color: "var(--text-secondary)" }} className="sm:col-span-2">Motivo: <span style={{ color: "var(--text-primary)" }}>{visita.motivo}</span></p>}
        </div>
      </div>

      {estado === "agendada" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5 mb-5 text-center">
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">Esta visita todavía no ha comenzado.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {puedeGestionar && (
              <button onClick={() => iniciarVisita(visita)} disabled={guardando} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
                <PlayCircle size={16} /> Iniciar visita
              </button>
            )}
            {puedeGestionar && (
              <>
                <button onClick={() => cambiarEstado("reprogramada")} disabled={guardando} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw size={15} /> Reprogramar
                </button>
                <button onClick={() => cambiarEstado("cancelada")} disabled={guardando} style={{ background: "var(--danger)22", color: "var(--danger)" }} className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5">
                  <Ban size={15} /> Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {(estado === "en_proceso" || estado === "pendiente_de_finalizar" || soloLectura) && (
        <div className="flex flex-col gap-5">
          {preguntasPorCategoria.map(({ categoria, preguntas }) => (
            <div key={categoria} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">{categoria}</p>
              <div className="flex flex-col gap-5">
                {preguntas.map((p) => (
                  <div key={p.id}>
                    <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{p.texto}</p>
                    {soloLectura ? (
                      <p style={{ color: "var(--text-primary)" }} className="text-sm whitespace-pre-wrap">{p.respuesta || "Sin respuesta."}</p>
                    ) : (
                      <textarea value={p.respuesta} onChange={(e) => setRespuestaPregunta(p.id, { respuesta: e.target.value })} rows={2} style={inputStyle} className={`${inputClass} resize-none`} />
                    )}
                    {(soloLectura ? p.fuente : true) && (
                      soloLectura ? (
                        p.fuente && (
                          <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1.5">
                            Información proporcionada por: {FUENTE_OPCIONES.find((f) => f.value === p.fuente)?.label}{p.fuente === "otro" && p.fuenteNombre ? ` (${p.fuenteNombre}${p.fuenteCargo ? `, ${p.fuenteCargo}` : ""})` : ""}
                          </p>
                        )
                      ) : (
                        <FuenteSelector fuente={p.fuente} fuenteNombre={p.fuenteNombre} fuenteCargo={p.fuenteCargo} onCambiar={(f) => setRespuestaPregunta(p.id, f)} />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Elementos personalizados</p>
              {!soloLectura && (
                <div className="relative">
                  <button onClick={() => setMostrarMenuElemento((v) => !v)} type="button" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1">
                    <Plus size={14} /> Agregar elemento
                  </button>
                  {mostrarMenuElemento && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMostrarMenuElemento(false)} />
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-2xl overflow-hidden z-40 py-1">
                        {[...TIPO_ELEMENTO_OPCIONES, { value: "acuerdo" as const, label: "Acuerdo / compromiso" }].map((o) => (
                          <button key={o.value} onClick={() => agregarElemento(o.value)} style={{ color: "var(--text-primary)" }} className="w-full text-left px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {visita.elementosPersonalizados.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-xs">Sin elementos adicionales registrados.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visita.elementosPersonalizados.map((el) => (
                  <div key={el.id} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2 py-0.5 rounded-full text-[11px]">
                        {TIPO_ELEMENTO_OPCIONES.find((t) => t.value === el.tipo)?.label ?? "Otro"}
                      </span>
                      {!soloLectura && (
                        <button onClick={() => quitarElemento(el.id)} type="button" style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>
                      )}
                    </div>
                    {el.tipo === "pregunta" && (
                      soloLectura ? <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">{el.titulo}</p> :
                        <input value={el.titulo ?? ""} onChange={(e) => actualizarElemento(el.id, { titulo: e.target.value })} placeholder="Pregunta" style={inputStyle} className={`${inputClass} mb-2`} />
                    )}
                    {soloLectura ? (
                      <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap">{el.contenido || "—"}</p>
                    ) : (
                      <textarea value={el.contenido} onChange={(e) => actualizarElemento(el.id, { contenido: e.target.value })} placeholder="Descripción / respuesta" rows={2} style={inputStyle} className={`${inputClass} resize-none`} />
                    )}
                    {!soloLectura && <FuenteSelector fuente={el.fuente} fuenteNombre={el.fuenteNombre} fuenteCargo={el.fuenteCargo} onCambiar={(f) => actualizarElemento(el.id, f)} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-3">Observaciones generales</p>
            {soloLectura ? (
              <p style={{ color: "var(--text-primary)" }} className="text-sm whitespace-pre-wrap">{visita.observacionesGenerales || "Sin observaciones."}</p>
            ) : (
              <textarea
                value={visita.observacionesGenerales ?? ""}
                onChange={(e) => setVisita((v) => v && ({ ...v, observacionesGenerales: e.target.value }))}
                rows={4} placeholder="Situaciones particulares, incidentes, comentarios, acuerdos, recomendaciones..." style={inputStyle} className={`${inputClass} resize-none`}
              />
            )}
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Acuerdos y acciones de mejora</p>
              {!soloLectura && (
                <button onClick={agregarAcuerdo} type="button" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1">
                  <Plus size={14} /> Agregar acuerdo
                </button>
              )}
            </div>
            {visita.acuerdos.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-xs">Sin acuerdos registrados.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visita.acuerdos.map((ac) => (
                  <div key={ac.id} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                    {soloLectura ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <p style={{ color: "var(--text-secondary)" }} className="sm:col-span-2">Situación: <span style={{ color: "var(--text-primary)" }}>{ac.situacion}</span></p>
                        <p style={{ color: "var(--text-secondary)" }} className="sm:col-span-2">Acción: <span style={{ color: "var(--text-primary)" }}>{ac.accion}</span></p>
                        <p style={{ color: "var(--text-secondary)" }}>Responsable: <span style={{ color: "var(--text-primary)" }}>{ac.responsable}</span></p>
                        <p style={{ color: "var(--text-secondary)" }}>Fecha comprometida: <span style={{ color: "var(--text-primary)" }}>{ac.fechaComprometida || "—"}</span></p>
                        {ac.observaciones && <p style={{ color: "var(--text-secondary)" }} className="sm:col-span-2">Observaciones: <span style={{ color: "var(--text-primary)" }}>{ac.observaciones}</span></p>}
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-end mb-1">
                          <button onClick={() => quitarAcuerdo(ac.id)} type="button" style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <input value={ac.situacion} onChange={(e) => actualizarAcuerdo(ac.id, { situacion: e.target.value })} placeholder="Situación detectada" style={inputStyle} className={inputClass} />
                          <input value={ac.accion} onChange={(e) => actualizarAcuerdo(ac.id, { accion: e.target.value })} placeholder="Acción acordada" style={inputStyle} className={inputClass} />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={ac.responsable} onChange={(e) => actualizarAcuerdo(ac.id, { responsable: e.target.value })} placeholder="Responsable" style={inputStyle} className={inputClass} />
                            <input type="date" value={ac.fechaComprometida ?? ""} onChange={(e) => actualizarAcuerdo(ac.id, { fechaComprometida: e.target.value })} style={inputStyle} className={inputClass} />
                          </div>
                          <input value={ac.observaciones ?? ""} onChange={(e) => actualizarAcuerdo(ac.id, { observaciones: e.target.value })} placeholder="Observaciones (opcional)" style={inputStyle} className={inputClass} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!soloLectura && puedeGestionar && (
            <button
              onClick={finalizarVisita}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 size={17} /> {guardando ? "Guardando..." : "Finalizar y guardar visita"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
