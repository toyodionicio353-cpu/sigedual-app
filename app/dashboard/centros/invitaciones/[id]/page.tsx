"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { InvitacionEmpresa, RespuestaInvitacion, CentroDual, EstadoInvitacion } from "@/types";
import { ArrowLeft, Building2, User2, Sparkles, ClipboardCheck, Users2, CheckCircle2, AlertTriangle } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

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

export default function VistaPreviaInvitacionPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [invitacion, setInvitacion] = useState<InvitacionEmpresa | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaInvitacion | null>(null);
  const [centroExistente, setCentroExistente] = useState<CentroDual | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

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
      setInvitacion({ id: snapInv.id, ...snapInv.data() } as InvitacionEmpresa);

      const snapResp = await getDoc(doc(db, "respuestas_invitacion", id));
      if (snapResp.exists()) {
        setRespuesta({ id: snapResp.id, ...snapResp.data() } as RespuestaInvitacion);
      }

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

      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  if (loading) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (noEncontrado || !invitacion) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Invitación no encontrada</p>
          <Link href="/dashboard/centros/invitaciones" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
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
      <div className="mb-6">
        <TituloPagina icon={<ClipboardCheck size={28} />}>{respuesta.empresa.razonSocial || invitacion.nombrePreliminar || "Formulario recibido"}</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Generada por {invitacion.profesorNombre} · Estado: {ESTADO_LABEL[invitacion.estado]}
        </p>
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
      ) : (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">No se encontró ninguna empresa con este RUT registrada en SIGEDUAL — se creará un nuevo centro dual.</p>
        </div>
      )}

      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3 uppercase font-semibold tracking-wide">Información proporcionada por la empresa</p>

      <Bloque icon={<Building2 size={16} />} titulo="Empresa">
        <Dato label="Razón social" valor={respuesta.empresa.razonSocial} />
        <Dato label="Nombre de fantasía" valor={respuesta.empresa.nombreFantasia} />
        <Dato label="RUT" valor={respuesta.empresa.rut} />
        <Dato label="Giro" valor={respuesta.empresa.giro} />
        <Dato label="Dirección" valor={respuesta.empresa.direccion} />
        <Dato label="Comuna" valor={respuesta.empresa.comuna} />
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
        <div className="flex flex-col gap-4">
          {respuesta.maestrosGuia.map((m) => (
            <div key={m.id} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-2">{m.nombreCompleto}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Dato label="RUN" valor={m.run} />
                <Dato label="Cargo" valor={m.cargo} />
                <Dato label="Área" valor={m.area} />
                <Dato label="Especialidad" valor={m.especialidad} />
                <Dato label="Correo" valor={m.email} />
                <Dato label="Teléfono" valor={m.telefono} />
                <Dato label="Experiencia" valor={m.experiencia} />
                <Dato label="Disponibilidad" valor={m.disponibilidad} />
                <Dato label="Observaciones" valor={m.observaciones} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
