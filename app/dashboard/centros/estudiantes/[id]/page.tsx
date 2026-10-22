"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft, GraduationCap, IdCard, Phone, Mail, CalendarRange,
  ShieldAlert, Briefcase, Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { formatearFecha } from "@/lib/fecha";
import CentroFaltas from "@/components/faltas/CentroFaltas";
import PanelObservaciones from "@/components/observaciones/PanelObservaciones";
import TituloPagina from "@/components/TituloPagina";
import { nombreCompleto } from "@/lib/estudiantes/nombre";
import type { Asignacion, Especialidad, Estudiante } from "@/types";

const VIGENTES: Asignacion["estado"][] = ["asignada", "activa", "en_proceso"];

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider">{etiqueta}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm mt-0.5">{valor?.trim() || "—"}</p>
    </div>
  );
}

function Seccion({ icono, titulo, subtitulo, children }: {
  icono: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode;
}) {
  return (
    <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
      <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold flex items-center gap-2">
        <span style={{ color: "var(--accent-light)" }} className="flex items-center">{icono}</span>
        {titulo}
      </h2>
      {subtitulo && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 mb-4">{subtitulo}</p>}
      <div className={subtitulo ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

/**
 * Ficha de un estudiante vista por su Centro Dual.
 *
 * Es una vista RECORTADA de la ficha del liceo, no la misma pantalla con
 * otro permiso. El centro ve lo que necesita para recibir a esa persona y
 * responder por ella mientras está en su empresa: quién es, cuándo viene,
 * a quién llamar si pasa algo, y lo que él mismo registró. Lo que es del
 * liceo (domicilio, apoderado completo, historial académico, notas) no se
 * muestra acá aunque las reglas lo permitan: el permiso dice qué se puede
 * leer, no qué corresponde mostrar.
 */
export default function EstudianteDelCentroPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { usuario } = useAuth();
  const { asignaciones, cargando: cargandoAmbito } = useAmbitoMaestroGuia();

  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [especialidad, setEspecialidad] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /** La asignación vigente a ESTE centro. Sin ella no hay nada que
   * mostrar: el estudiante no es suyo. */
  const asignacion = useMemo(
    () => asignaciones.find((a) => a.estudianteId === id && VIGENTES.includes(a.estado)),
    [asignaciones, id]
  );

  useEffect(() => {
    if (!id || cargandoAmbito) return;
    if (!asignacion) { setCargando(false); return; }
    let cancelado = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "estudiantes", id));
        if (cancelado) return;
        if (!snap.exists()) { setError("Este estudiante ya no está registrado."); return; }
        const e = { id: snap.id, ...snap.data() } as Estudiante;
        setEstudiante(e);
        if (e.especialidadId) {
          const esp = await getDoc(doc(db, "especialidades", e.especialidadId));
          if (!cancelado && esp.exists()) setEspecialidad((esp.data() as Especialidad).nombre ?? "");
        }
      } catch {
        if (!cancelado) setError("No se pudo cargar la ficha de este estudiante.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [id, asignacion, cargandoAmbito]);

  if (usuario && usuario.rol !== "centro_dual") {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">
          Esta vista es del Centro Dual. La ficha completa está en Estudiantes → Lista de estudiantes.
        </p>
      </div>
    );
  }

  if (cargando || cargandoAmbito) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-muted)" }} className="text-sm">Cargando...</p></div>;
  }

  if (!asignacion) {
    return (
      <div className="p-4 md:p-8 flex flex-col gap-4">
        <Link href="/dashboard/centros/estudiantes" style={{ color: "var(--text-secondary)" }} className="text-sm flex items-center gap-2">
          <ArrowLeft size={16} /> Mis estudiantes
        </Link>
        <p style={{ color: "var(--danger)" }} className="text-sm">
          Este estudiante no tiene una asignación vigente a tu centro.
        </p>
      </div>
    );
  }

  if (error || !estudiante) {
    return (
      <div className="p-4 md:p-8 flex flex-col gap-4">
        <Link href="/dashboard/centros/estudiantes" style={{ color: "var(--text-secondary)" }} className="text-sm flex items-center gap-2">
          <ArrowLeft size={16} /> Mis estudiantes
        </Link>
        <p style={{ color: "var(--danger)" }} className="text-sm">{error || "No se pudo cargar la ficha."}</p>
      </div>
    );
  }

  const contexto = {
    asignacionId: asignacion.id,
    centroDualId: asignacion.centroDualId,
    especialidadId: estudiante.especialidadId,
    liceoId: asignacion.liceoId,
    profesorSupervisorId: asignacion.profesorSupervisorId,
    estudianteNombre: nombreCompleto(estudiante),
  };

  const emergencia = [estudiante.alergias, estudiante.enfermedadesCronicas].filter((t) => t?.trim());

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6">
      <Link href="/dashboard/centros/estudiantes" style={{ color: "var(--text-secondary)" }} className="text-sm flex items-center gap-2 w-fit">
        <ArrowLeft size={16} /> Mis estudiantes
      </Link>

      <div>
        <TituloPagina icon={<GraduationCap size={26} />}>{nombreCompleto(estudiante)}</TituloPagina>
        <p style={{ color: "var(--text-muted)" }} className="text-sm mt-2">
          {[especialidad, estudiante.nivel, estudiante.curso].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Seccion icono={<IdCard size={16} />} titulo="Quién es">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Nombre" valor={nombreCompleto(estudiante)} />
          <Dato etiqueta="Especialidad" valor={especialidad} />
          <Dato etiqueta="Nivel y curso" valor={[estudiante.nivel, estudiante.curso].filter(Boolean).join(" · ")} />
          <Dato etiqueta="Jornada en el centro" valor={asignacion.jornada ?? estudiante.jornada} />
        </div>
      </Seccion>

      <Seccion
        icono={<Briefcase size={16} />}
        titulo="Su estadía en tu centro"
        subtitulo="Las fechas y el profesor a cargo los define el liceo."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Desde" valor={asignacion.fechaInicio ? formatearFecha(asignacion.fechaInicio) : undefined} />
          <Dato etiqueta="Hasta" valor={asignacion.fechaTermino ? formatearFecha(asignacion.fechaTermino) : undefined} />
          <Dato etiqueta="Maestro guía" valor={asignacion.maestroGuia} />
          <Dato etiqueta="Estado" valor={asignacion.estado} />
        </div>
      </Seccion>

      <Seccion
        icono={<Phone size={16} />}
        titulo="A quién llamar"
        subtitulo="Para coordinar su asistencia o avisar de una urgencia mientras está en tu centro."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Teléfono del estudiante" valor={estudiante.telefono} />
          <Dato etiqueta="Correo del estudiante" valor={estudiante.email} />
          <Dato etiqueta="Apoderado" valor={estudiante.apoderadoNombre} />
          <Dato etiqueta="Teléfono del apoderado" valor={estudiante.apoderadoTelefono} />
        </div>
      </Seccion>

      {emergencia.length > 0 && (
        <Seccion
          icono={<ShieldAlert size={16} />}
          titulo="En caso de emergencia"
          subtitulo="Información de salud que el liceo registró. Es para actuar ante una urgencia, no para compartirla."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {estudiante.alergias?.trim() && <Dato etiqueta="Alergias" valor={estudiante.alergias} />}
            {estudiante.enfermedadesCronicas?.trim() && <Dato etiqueta="Condiciones crónicas" valor={estudiante.enfermedadesCronicas} />}
          </div>
        </Seccion>
      )}

      {(estudiante.habilidades?.length || estudiante.rasgos?.length) ? (
        <Seccion
          icono={<Sparkles size={16} />}
          titulo="Cómo acompañarlo"
          subtitulo="Lo que el liceo registró sobre su forma de trabajar. Es para adaptar el acompañamiento, no un diagnóstico."
        >
          <div className="flex flex-col gap-4">
            {estudiante.habilidades?.length ? (
              <div>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-2">Habilidades</p>
                <div className="flex flex-wrap gap-2">
                  {estudiante.habilidades.map((h) => (
                    <span key={h} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{h}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {estudiante.rasgos?.length ? (
              <div>
                <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-2">Características</p>
                <div className="flex flex-wrap gap-2">
                  {estudiante.rasgos.map((r) => (
                    <span key={r} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{r}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Seccion>
      ) : null}

      <CentroFaltas estudianteId={estudiante.id} contexto={contexto} />

      <PanelObservaciones
        estudianteId={estudiante.id}
        contexto={{
          centroDualId: asignacion.centroDualId,
          especialidadId: estudiante.especialidadId,
          liceoId: asignacion.liceoId,
          asignacionId: asignacion.id,
          profesorSupervisorId: asignacion.profesorSupervisorId,
          estudianteNombre: nombreCompleto(estudiante),
        }}
      />

      <p style={{ color: "var(--text-muted)" }} className="text-xs flex items-center gap-1.5">
        <CalendarRange size={13} />
        <Mail size={13} />
        Para cualquier otro tema, escribe al liceo desde Mensajes.
      </p>
    </div>
  );
}
