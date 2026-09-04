"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { InvitacionEmpresa, RespuestaInvitacion, CentroDual, EstadoInvitacion, Especialidad } from "@/types";
import {
  ArrowLeft, Building2, User2, Sparkles, ClipboardCheck, Users2, CheckCircle2, AlertTriangle, MoreVertical, Wand2,
} from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import CentroDualForm, { CENTRO_FORM_VACIO, TIPOS_CENTRO, type CentroDualFormValues } from "../../_components/CentroDualForm";
import MaestroGuiaForm, { MAESTRO_GUIA_FORM_VACIO, type MaestroGuiaFormValues } from "../../maestros/_components/MaestroGuiaForm";

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  generado: "Generado", abierto: "Abierto por la empresa", enviado: "Enviado por la empresa",
  en_revision: "En revisión", procesado: "Procesado", expirado: "Expirado", revocado: "Revocado",
};

function Bloque({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: "var(--accent-light)" }}>{icon}</span>
        <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor?: string | number | null }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase font-semibold tracking-wide">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm mt-0.5">{valor || valor === 0 ? String(valor) : "No proporcionado"}</p>
    </div>
  );
}

function valoresCentroDesdeRespuesta(r: RespuestaInvitacion): CentroDualFormValues {
  return {
    ...CENTRO_FORM_VACIO,
    nombre: r.empresa.razonSocial ?? "",
    rut: r.empresa.rut ?? "",
    tipo: r.empresa.tipo ?? "empresa",
    razonSocial: r.empresa.razonSocial ?? "",
    nombreComercial: r.empresa.nombreFantasia ?? "",
    direccion: r.empresa.direccion ?? "",
    comuna: r.empresa.comuna ?? "",
    ciudad: r.empresa.ciudad ?? "",
    region: r.empresa.region ?? "",
    telefono: r.empresa.telefono ?? "",
    email: r.empresa.email ?? "",
    sitioWeb: r.empresa.sitioWeb ?? "",
    contactoNombre: r.empresa.contactoNombre ?? "",
    contactoCargo: r.empresa.contactoCargo ?? "",
    contactoTelefono: r.empresa.contactoTelefono ?? "",
    contactoEmail: r.empresa.contactoEmail ?? "",
    capacidad: r.capacidad.cantidadEstudiantes != null ? String(r.capacidad.cantidadEstudiantes) : "",
  };
}

function valoresMaestroDesdeRespuesta(m: RespuestaInvitacion["maestrosGuia"][number]): MaestroGuiaFormValues {
  const notasEmpresa = [
    m.especialidad ? `Especialidad indicada: ${m.especialidad}` : "",
    m.disponibilidad ? `Disponibilidad: ${m.disponibilidad}` : "",
    m.observaciones ?? "",
  ].filter(Boolean).join("\n");
  return {
    ...MAESTRO_GUIA_FORM_VACIO,
    nombres: m.nombres,
    apellidoPaterno: m.apellidoPaterno ?? "",
    apellidoMaterno: m.apellidoMaterno ?? "",
    run: m.run ?? "",
    email: m.email ?? "",
    telefono: m.telefono ?? "",
    cargo: m.cargo ?? "",
    area: m.area ?? "",
    aniosExperiencia: m.aniosExperiencia ?? "",
    capacidad: m.capacidad ?? "",
    observaciones: notasEmpresa,
  };
}

export default function VistaPreviaInvitacionPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [invitacion, setInvitacion] = useState<InvitacionEmpresa | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaInvitacion | null>(null);
  const [centroExistente, setCentroExistente] = useState<CentroDual | null>(null);
  const [centroResultado, setCentroResultado] = useState<CentroDual | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarFormCentro, setMostrarFormCentro] = useState(false);
  const [guardandoCentro, setGuardandoCentro] = useState(false);
  const [errorCentro, setErrorCentro] = useState("");

  const [maestroActivoIdx, setMaestroActivoIdx] = useState<number | null>(null);
  const [guardandoMaestro, setGuardandoMaestro] = useState(false);
  const [errorMaestro, setErrorMaestro] = useState("");
  const [maestrosProcesados, setMaestrosProcesados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const snapInv = await getDoc(doc(db, "invitaciones", id));
      if (!snapInv.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const inv = { id: snapInv.id, ...snapInv.data() } as InvitacionEmpresa;
      setInvitacion(inv);

      const snapResp = await getDoc(doc(db, "respuestas_invitacion", id));
      if (snapResp.exists()) {
        setRespuesta({ id: snapResp.id, ...snapResp.data() } as RespuestaInvitacion);
      }

      const snapEsp = await getDocs(query(collection(db, "especialidades"), where("liceoId", "==", inv.liceoId)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          const res = await fetch(`/api/invitaciones/${id}/centro-existente`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setCentroExistente(data.centroExistente ?? null);
          }
        }
      } catch {
        // La comparación con SIGEDUAL es informativa — su falla no bloquea la revisión.
      }

      if (inv.centroDualIdResultado) {
        const snapCentro = await getDoc(doc(db, "centros_duales", inv.centroDualIdResultado));
        if (snapCentro.exists()) setCentroResultado({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      }

      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  async function guardarCentro(
    valores: CentroDualFormValues,
    especialidadesSel: string[],
    areas: string[],
    caracteristicas: string[],
    habilidades: string[]
  ) {
    if (guardandoCentro) return;
    setGuardandoCentro(true);
    setErrorCentro("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/invitaciones/${id}/autorellenar-centro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          centroDualIdExistente: centroExistente?.id,
          valores, especialidades: especialidadesSel, areas, caracteristicas, habilidades,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCentro(data.error ?? "No fue posible guardar el centro dual.");
        return;
      }
      const snapCentro = await getDoc(doc(db, "centros_duales", data.centroDualId));
      if (snapCentro.exists()) setCentroResultado({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      setInvitacion((inv) => (inv ? { ...inv, estado: "procesado", centroDualIdResultado: data.centroDualId } : inv));
      setMostrarFormCentro(false);
    } catch (err) {
      setErrorCentro(err instanceof Error ? err.message : "No fue posible conectar con el servidor.");
    } finally {
      setGuardandoCentro(false);
    }
  }

  async function guardarMaestro(valores: MaestroGuiaFormValues, centroDualId: string, especialidadesSel: string[], areas: string[]) {
    if (guardandoMaestro || maestroActivoIdx === null) return;
    setGuardandoMaestro(true);
    setErrorMaestro("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/invitaciones/${id}/autorellenar-maestro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ centroDualId, valores, especialidades: especialidadesSel, areas }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMaestro(data.error ?? "No fue posible guardar el maestro guía.");
        return;
      }
      const maestroId = respuesta?.maestrosGuia[maestroActivoIdx]?.id;
      if (maestroId) setMaestrosProcesados((set) => new Set(set).add(maestroId));
      setMaestroActivoIdx(null);
    } catch (err) {
      setErrorMaestro(err instanceof Error ? err.message : "No fue posible conectar con el servidor.");
    } finally {
      setGuardandoMaestro(false);
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (noEncontrado || !invitacion) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Invitación no encontrada</p>
          <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} /> Volver a formularios recibidos
          </Link>
        </div>
      </div>
    );
  }

  if (!respuesta) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <TituloPagina icon={<ClipboardCheck size={28} />}>{invitacion.nombrePreliminar || "Invitación"}</TituloPagina>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center mt-6">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Esta invitación aún no tiene respuesta</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Estado actual: {ESTADO_LABEL[invitacion.estado]}</p>
        </div>
      </div>
    );
  }

  const centroParaMaestros = centroResultado ?? centroExistente;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <TituloPagina icon={<ClipboardCheck size={28} />}>{respuesta.empresa.razonSocial || invitacion.nombrePreliminar || "Formulario recibido"}</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Generada por {invitacion.profesorNombre} · Estado: {ESTADO_LABEL[invitacion.estado]}
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}
            className="p-2 rounded-lg"
            aria-label="Más acciones"
          >
            <MoreVertical size={16} />
          </button>
          {menuAbierto && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuAbierto(false)} />
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="absolute right-0 top-full mt-1 w-64 rounded-xl shadow-2xl overflow-hidden z-40 py-1">
                <button
                  onClick={() => { setMostrarFormCentro(true); setMenuAbierto(false); }}
                  style={{ color: "var(--text-primary)" }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors text-left"
                >
                  <Wand2 size={14} /> Autorrellenar Empresa Dual
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {centroExistente ? (
        <div style={{ background: "var(--warning)22", border: "1px solid var(--warning)" }} className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
          <AlertTriangle size={16} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Empresa existente encontrada</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">
              Ya existe un centro dual registrado en SIGEDUAL con el mismo RUT: <strong>{centroExistente.nombre}</strong>. Al autorrellenar, se actualizará ese registro en vez de crear uno nuevo.
            </p>
          </div>
        </div>
      ) : !centroResultado ? (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">No se encontró ninguna empresa con este RUT registrada en SIGEDUAL — se creará un nuevo centro dual.</p>
        </div>
      ) : null}

      {centroResultado && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            Centro dual autorrellenado: <strong style={{ color: "var(--text-primary)" }}>{centroResultado.nombre}</strong>. Ya puedes autorrellenar los Maestros Guía.
          </p>
        </div>
      )}

      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3 uppercase font-semibold tracking-wide">Información proporcionada por la empresa</p>

      <Bloque icon={<Building2 size={16} />} titulo="Empresa">
        <Dato label="Razón social" valor={respuesta.empresa.razonSocial} />
        <Dato label="Nombre de fantasía" valor={respuesta.empresa.nombreFantasia} />
        <Dato label="RUT" valor={respuesta.empresa.rut} />
        <Dato label="Tipo" valor={TIPOS_CENTRO.find((t) => t.value === respuesta.empresa.tipo)?.label} />
        <Dato label="Giro" valor={respuesta.empresa.giro} />
        <Dato label="Dirección" valor={respuesta.empresa.direccion} />
        <Dato label="Comuna" valor={respuesta.empresa.comuna} />
        <Dato label="Ciudad" valor={respuesta.empresa.ciudad} />
        <Dato label="Región" valor={respuesta.empresa.region} />
        <Dato label="Teléfono" valor={respuesta.empresa.telefono} />
        <Dato label="Correo" valor={respuesta.empresa.email} />
        <Dato label="Sitio web" valor={respuesta.empresa.sitioWeb} />
        <Dato label="Contacto" valor={respuesta.empresa.contactoNombre} />
        <Dato label="Cargo del contacto" valor={respuesta.empresa.contactoCargo} />
        <Dato label="Correo del contacto" valor={respuesta.empresa.contactoEmail} />
        <Dato label="Teléfono del contacto" valor={respuesta.empresa.contactoTelefono} />
      </Bloque>

      <Bloque icon={<User2 size={16} />} titulo="Perfil">
        <Dato label="Actividad principal" valor={respuesta.perfil.actividadPrincipal} />
        <Dato label="Área de trabajo" valor={respuesta.perfil.areaTrabajo} />
        <Dato label="Tipo de tareas" valor={respuesta.perfil.tipoTareas} />
        <Dato label="Tecnologías" valor={respuesta.perfil.tecnologias} />
        <Dato label="Herramientas" valor={respuesta.perfil.herramientas} />
        <Dato label="Ambiente laboral" valor={respuesta.perfil.ambienteLaboral} />
        <Dato label="Características importantes" valor={respuesta.perfil.caracteristicasImportantes} />
      </Bloque>

      <Bloque icon={<Sparkles size={16} />} titulo="Necesidades">
        <Dato label="Nivel de actividad" valor={respuesta.necesidades.nivelActividad} />
        <Dato label="Ritmo de aprendizaje" valor={respuesta.necesidades.ritmoAprendizaje} />
        <Dato label="Autonomía" valor={respuesta.necesidades.autonomia} />
        <Dato label="Adaptación" valor={respuesta.necesidades.adaptacion} />
        <Dato label="Comunicación" valor={respuesta.necesidades.comunicacion} />
        <Dato label="Trabajo en equipo" valor={respuesta.necesidades.trabajoEquipo} />
        <Dato label="Otras observaciones" valor={respuesta.necesidades.otras} />
      </Bloque>

      <Bloque icon={<Sparkles size={16} />} titulo="Características del centro">
        <Dato label="Ambiente de trabajo" valor={respuesta.caracteristicas.ambiente?.join(", ")} />
        <Dato label="Habilidades valoradas" valor={respuesta.caracteristicas.habilidadesValoradas?.join(", ")} />
        <Dato label="Áreas de desempeño" valor={respuesta.caracteristicas.areasDesempeno?.join(", ")} />
      </Bloque>

      <Bloque icon={<ClipboardCheck size={16} />} titulo="Capacidad">
        <Dato label="Cantidad de estudiantes" valor={respuesta.capacidad.cantidadEstudiantes} />
        <Dato label="Especialidades de interés" valor={respuesta.capacidad.especialidades?.join(", ")} />
        <Dato label="Cursos de interés" valor={respuesta.capacidad.cursos?.join(", ")} />
        <Dato label="Período" valor={respuesta.capacidad.periodo} />
        <Dato label="Jornada" valor={respuesta.capacidad.jornada} />
        <Dato label="Horarios" valor={respuesta.capacidad.horarios} />
        <Dato label="Restricciones" valor={respuesta.capacidad.restricciones} />
      </Bloque>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={16} style={{ color: "var(--accent-light)" }} />
          <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Maestros Guía ({respuesta.maestrosGuia.length})</h2>
        </div>
        {!centroParaMaestros && (
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Primero autorrellena la Empresa Dual para poder autorrellenar sus Maestros Guía.</p>
        )}
        <div className="flex flex-col gap-4">
          {respuesta.maestrosGuia.map((m, i) => {
            const procesado = maestrosProcesados.has(m.id);
            return (
              <div key={m.id} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">
                    {[m.nombres, m.apellidoPaterno, m.apellidoMaterno].filter(Boolean).join(" ")}
                  </p>
                  {procesado ? (
                    <span style={{ color: "var(--success)" }} className="text-xs flex items-center gap-1 flex-shrink-0"><CheckCircle2 size={13} /> Autorrellenado</span>
                  ) : (
                    <button
                      onClick={() => setMaestroActivoIdx(i)}
                      disabled={!centroParaMaestros}
                      style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40"
                    >
                      <Wand2 size={13} /> Autorrellenar Maestro Guía
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Dato label="RUN" valor={m.run} />
                  <Dato label="Cargo" valor={m.cargo} />
                  <Dato label="Área" valor={m.area} />
                  <Dato label="Especialidad" valor={m.especialidad} />
                  <Dato label="Correo" valor={m.email} />
                  <Dato label="Teléfono" valor={m.telefono} />
                  <Dato label="Años de experiencia" valor={m.aniosExperiencia} />
                  <Dato label="Máximo de estudiantes" valor={m.capacidad} />
                  <Dato label="Disponibilidad" valor={m.disponibilidad} />
                  <Dato label="Observaciones" valor={m.observaciones} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mostrarFormCentro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">
                {centroExistente ? "Actualizar centro dual existente" : "Autorrellenar Empresa Dual"}
              </h2>
              <button onClick={() => setMostrarFormCentro(false)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorCentro && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorCentro}</p>
              </div>
            )}
            <CentroDualForm
              modo={centroExistente ? "editar" : "crear"}
              valoresIniciales={valoresCentroDesdeRespuesta(respuesta)}
              especialidadesIniciales={[]}
              areasIniciales={respuesta.caracteristicas.areasDesempeno ?? []}
              caracteristicasIniciales={respuesta.caracteristicas.ambiente ?? []}
              habilidadesIniciales={respuesta.caracteristicas.habilidadesValoradas ?? []}
              especialidadesDisponibles={especialidades}
              rutsOcupados={[]}
              guardando={guardandoCentro}
              onCancelar={() => setMostrarFormCentro(false)}
              onGuardar={guardarCentro}
            />
          </div>
        </div>
      )}

      {maestroActivoIdx !== null && centroParaMaestros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">Autorrellenar Maestro Guía</h2>
              <button onClick={() => setMaestroActivoIdx(null)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorMaestro && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorMaestro}</p>
              </div>
            )}
            <MaestroGuiaForm
              modo="crear"
              valoresIniciales={valoresMaestroDesdeRespuesta(respuesta.maestrosGuia[maestroActivoIdx])}
              centrosDisponibles={[centroParaMaestros]}
              centroFijo={centroParaMaestros}
              especialidadesIniciales={[]}
              areasIniciales={[]}
              especialidadesDisponibles={especialidades}
              rutsOcupadosPorCentro={[]}
              guardando={guardandoMaestro}
              onCancelar={() => setMaestroActivoIdx(null)}
              onGuardar={guardarMaestro}
            />
          </div>
        </div>
      )}
    </div>
  );
}
