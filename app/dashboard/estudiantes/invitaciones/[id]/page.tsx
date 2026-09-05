"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { InvitacionEstudiante, RespuestaInvitacionEstudiante, Estudiante, EstadoInvitacion, Especialidad } from "@/types";
import {
  ArrowLeft, BadgeCheck, Phone, GraduationCap, HeartPulse, Users, Sparkles, ClipboardCheck, CheckCircle2, AlertTriangle, MoreVertical, Wand2,
} from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import EstudianteForm, { ESTUDIANTE_FORM_VACIO, type EstudianteFormValues } from "../../_components/EstudianteForm";

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  generado: "Generado", abierto: "Abierto por el estudiante", enviado: "Enviado por el estudiante",
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

function valoresEstudianteDesdeRespuesta(r: RespuestaInvitacionEstudiante): EstudianteFormValues {
  return {
    ...ESTUDIANTE_FORM_VACIO,
    run: r.run, nombres: r.nombres, apellidoPaterno: r.apellidoPaterno, apellidoMaterno: r.apellidoMaterno,
    fechaNacimiento: r.fechaNacimiento, sexo: r.sexo, nacionalidad: r.nacionalidad,
    email: r.email, telefono: r.telefono, direccion: r.direccion, comuna: r.comuna, ciudad: r.ciudad,
    anioAcademico: r.anioAcademico, nivel: r.nivel, curso: r.curso, especialidadId: r.especialidadId, jornada: r.jornada,
    estado: "activo",
    enfermedadesCronicas: r.enfermedadesCronicas, alergias: r.alergias,
    apoderadoNombre: r.apoderadoNombre, apoderadoRun: r.apoderadoRun, apoderadoParentesco: r.apoderadoParentesco,
    apoderadoTelefono: r.apoderadoTelefono, apoderadoEmail: r.apoderadoEmail,
    apoderadoDomicilio: r.apoderadoDomicilio, apoderadoCiudad: r.apoderadoCiudad,
    observaciones: r.observaciones,
  };
}

export default function VistaPreviaInvitacionEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [invitacion, setInvitacion] = useState<InvitacionEstudiante | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaInvitacionEstudiante | null>(null);
  const [estudianteExistente, setEstudianteExistente] = useState<Estudiante | null>(null);
  const [estudianteResultado, setEstudianteResultado] = useState<Estudiante | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarFormEstudiante, setMostrarFormEstudiante] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const snapInv = await getDoc(doc(db, "invitaciones_estudiante", id));
      if (!snapInv.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const inv = { id: snapInv.id, ...snapInv.data() } as InvitacionEstudiante;
      setInvitacion(inv);

      const snapResp = await getDoc(doc(db, "respuestas_invitacion_estudiante", id));
      if (snapResp.exists()) {
        setRespuesta({ id: snapResp.id, ...snapResp.data() } as RespuestaInvitacionEstudiante);
      }

      const snapEsp = await getDocs(query(collection(db, "especialidades"), where("liceoId", "==", inv.liceoId)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          const res = await fetch(`/api/invitaciones-estudiante/${id}/estudiante-existente`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setEstudianteExistente(data.estudianteExistente ?? null);
          }
        }
      } catch {
        // La comparación con SIGEDUAL es informativa — su falla no bloquea la revisión.
      }

      if (inv.estudianteIdResultado) {
        const snapEst = await getDoc(doc(db, "estudiantes", inv.estudianteIdResultado));
        if (snapEst.exists()) setEstudianteResultado({ id: snapEst.id, ...snapEst.data() } as Estudiante);
      }

      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  async function guardarEstudiante(valores: EstudianteFormValues, otrosMedicos: string[], rasgos: string[], habilidades: string[]) {
    if (guardando) return;
    setGuardando(true);
    setErrorGuardar("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/invitaciones-estudiante/${id}/autorellenar-estudiante`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          estudianteIdExistente: estudianteExistente?.id,
          valores, otrosMedicos, rasgos, habilidades,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorGuardar(data.error ?? "No fue posible guardar el estudiante.");
        return;
      }
      const snapEst = await getDoc(doc(db, "estudiantes", data.estudianteId));
      if (snapEst.exists()) setEstudianteResultado({ id: snapEst.id, ...snapEst.data() } as Estudiante);
      setInvitacion((inv) => (inv ? { ...inv, estado: "procesado", estudianteIdResultado: data.estudianteId } : inv));
      setMostrarFormEstudiante(false);
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No fue posible conectar con el servidor.");
    } finally {
      setGuardando(false);
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
          <Link href="/dashboard/estudiantes/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
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

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <TituloPagina icon={<ClipboardCheck size={28} />}>
            {[respuesta.nombres, respuesta.apellidoPaterno].filter(Boolean).join(" ") || invitacion.nombrePreliminar || "Formulario recibido"}
          </TituloPagina>
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
                  onClick={() => { setMostrarFormEstudiante(true); setMenuAbierto(false); }}
                  style={{ color: "var(--text-primary)" }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors text-left"
                >
                  <Wand2 size={14} /> Autorrellenar Estudiante
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {estudianteResultado ? (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            Listo — {estudianteExistente ? "se actualizó el registro existente" : "estudiante autorrellenado"}: <Link href={`/dashboard/estudiantes/${estudianteResultado.id}`} style={{ color: "var(--text-primary)" }} className="font-semibold underline">{estudianteResultado.nombres} {estudianteResultado.apellidos}</Link>.
          </p>
        </div>
      ) : estudianteExistente ? (
        <div style={{ background: "var(--warning)22", border: "1px solid var(--warning)" }} className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
          <AlertTriangle size={16} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Estudiante existente encontrado</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">
              Ya existe un estudiante registrado en SIGEDUAL con el mismo RUN: <strong>{estudianteExistente.nombres} {estudianteExistente.apellidos}</strong>. Al autorrellenar, se actualizará ese registro en vez de crear uno nuevo.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">No se encontró ningún estudiante con este RUN registrado en SIGEDUAL — se creará un estudiante nuevo.</p>
        </div>
      )}

      {errorGuardar && !mostrarFormEstudiante && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorGuardar}</p>
        </div>
      )}

      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3 uppercase font-semibold tracking-wide">Información proporcionada por el estudiante</p>

      <Bloque icon={<BadgeCheck size={16} />} titulo="Identificación">
        <Dato label="Nombres" valor={respuesta.nombres} />
        <Dato label="Apellido paterno" valor={respuesta.apellidoPaterno} />
        <Dato label="Apellido materno" valor={respuesta.apellidoMaterno} />
        <Dato label="RUN" valor={respuesta.run} />
        <Dato label="Fecha de nacimiento" valor={respuesta.fechaNacimiento} />
        <Dato label="Sexo" valor={respuesta.sexo} />
        <Dato label="Nacionalidad" valor={respuesta.nacionalidad} />
      </Bloque>

      <Bloque icon={<Phone size={16} />} titulo="Contacto">
        <Dato label="Correo" valor={respuesta.email} />
        <Dato label="Teléfono" valor={respuesta.telefono} />
        <Dato label="Dirección" valor={respuesta.direccion} />
        <Dato label="Comuna" valor={respuesta.comuna} />
        <Dato label="Ciudad" valor={respuesta.ciudad} />
      </Bloque>

      <Bloque icon={<GraduationCap size={16} />} titulo="Información académica">
        <Dato label="Año académico" valor={respuesta.anioAcademico} />
        <Dato label="Nivel" valor={respuesta.nivel} />
        <Dato label="Curso" valor={respuesta.curso} />
        <Dato label="Especialidad" valor={especialidades.find((e) => e.id === respuesta.especialidadId)?.nombre} />
        <Dato label="Jornada" valor={respuesta.jornada} />
      </Bloque>

      <Bloque icon={<HeartPulse size={16} />} titulo="Información médica">
        <Dato label="Enfermedades crónicas" valor={respuesta.enfermedadesCronicas} />
        <Dato label="Alergias" valor={respuesta.alergias} />
        <Dato label="Otros antecedentes" valor={respuesta.informacionMedicaAdicional?.join(", ")} />
      </Bloque>

      <Bloque icon={<Users size={16} />} titulo="Apoderado">
        <Dato label="Nombre" valor={respuesta.apoderadoNombre} />
        <Dato label="RUN" valor={respuesta.apoderadoRun} />
        <Dato label="Parentesco" valor={respuesta.apoderadoParentesco} />
        <Dato label="Teléfono" valor={respuesta.apoderadoTelefono} />
        <Dato label="Correo" valor={respuesta.apoderadoEmail} />
        <Dato label="Domicilio" valor={respuesta.apoderadoDomicilio} />
        <Dato label="Ciudad" valor={respuesta.apoderadoCiudad} />
      </Bloque>

      <Bloque icon={<Sparkles size={16} />} titulo="Características y observaciones">
        <Dato label="Rasgos" valor={respuesta.rasgos?.join(", ")} />
        <Dato label="Habilidades" valor={respuesta.habilidades?.join(", ")} />
        <Dato label="Observaciones" valor={respuesta.observaciones} />
      </Bloque>

      {mostrarFormEstudiante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">
                {estudianteExistente ? "Actualizar estudiante existente" : "Autorrellenar Estudiante"}
              </h2>
              <button onClick={() => setMostrarFormEstudiante(false)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorGuardar && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorGuardar}</p>
              </div>
            )}
            <EstudianteForm
              modo="crear"
              valoresIniciales={valoresEstudianteDesdeRespuesta(respuesta)}
              otrosMedicosIniciales={respuesta.informacionMedicaAdicional ?? []}
              rasgosIniciales={respuesta.rasgos ?? []}
              habilidadesIniciales={respuesta.habilidades ?? []}
              especialidades={especialidades}
              runsOcupados={[]}
              guardando={guardando}
              onCancelar={() => setMostrarFormEstudiante(false)}
              onGuardar={guardarEstudiante}
            />
          </div>
        </div>
      )}
    </div>
  );
}
