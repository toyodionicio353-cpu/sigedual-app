"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import type { Estudiante, Especialidad } from "@/types";
import {
  ArrowLeft, BadgeCheck, Phone, GraduationCap, HeartPulse,
  Sparkles, FileText, Users, Pencil, History, Trash2,
} from "lucide-react";

const ESTADO_COLOR: Record<string, string> = {
  activo: "var(--success)",
  inactivo: "var(--warning)",
  egresado: "var(--danger)",
  retirado: "var(--warning)",
};

function iniciales(nombres: string, apellidos: string): string {
  return `${(nombres[0] || "").toUpperCase()}${(apellidos[0] || "").toUpperCase()}`;
}

function Seccion({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: "var(--accent-light)" }}>{icon}</span>
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Dato({ label, valor, span, color }: { label: string; valor?: string | null; span?: boolean; color?: string }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1">{label}</p>
      <p style={{ color: color ?? "var(--text-primary)" }} className="text-sm font-medium">{valor?.trim() ? valor : "—"}</p>
    </div>
  );
}

export default function FichaEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const [snapEst, snapEsp] = await Promise.all([
        getDoc(doc(db, "estudiantes", id)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      if (snapEst.exists()) {
        setEstudiante({ id: snapEst.id, ...snapEst.data() } as Estudiante);
      } else {
        setNoEncontrado(true);
      }
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado || !estudiante) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Estudiante no encontrado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">El registro que buscas no existe o fue eliminado.</p>
          <Link href="/dashboard/estudiantes" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  async function eliminar() {
    if (!estudiante || eliminando) return;
    setEliminando(true);
    try {
      const snapAsig = await getDocs(query(collection(db, "asignaciones"), where("estudianteId", "==", estudiante.id)));
      if (snapAsig.size > 0) {
        alert("Este estudiante tiene asignaciones asociadas y no se puede eliminar, para proteger la trazabilidad histórica. Si ya no debe aparecer activo, cámbialo a estado \"Retirado\" desde Editar.");
        return;
      }
      if (!confirm(`¿Eliminar a ${estudiante.nombres} ${estudiante.apellidos}? Esta acción no se puede deshacer.`)) return;
      await deleteDoc(doc(db, "estudiantes", estudiante.id));
      router.push("/dashboard/estudiantes");
    } finally {
      setEliminando(false);
    }
  }

  const especialidadNombre = especialidades.find((e) => e.id === estudiante.especialidadId)?.nombre;
  const anio = estudiante.anioAcademico || String(new Date(estudiante.creadoEn).getFullYear());
  const repitiendoNivelActual = (estudiante.historialCursos ?? []).some((h) => h.nivel === estudiante.nivel);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link
          href="/dashboard/estudiantes"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
        {(usuario?.rol === "administrador" || usuario?.rol === "profesor") && (
          <div className="flex gap-3">
            <button
              onClick={eliminar}
              disabled={eliminando}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--danger)" }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--danger)] transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              Eliminar
            </button>
            <Link
              href={`/dashboard/estudiantes/${estudiante.id}/editar`}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Pencil size={15} />
              Editar estudiante
            </Link>
          </div>
        )}
      </div>

      {/* Encabezado */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div style={{ background: "var(--accent)22", borderRadius: "9999px" }} className="w-16 h-16 flex items-center justify-center flex-shrink-0">
          <span style={{ color: "var(--accent-light)" }} className="text-xl font-bold">{iniciales(estudiante.nombres, estudiante.apellidos)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold truncate">{estudiante.nombres} {estudiante.apellidos}</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-0.5">{estudiante.run} · {estudiante.curso || "Sin curso"} · {especialidadNombre || "Sin especialidad"} · {anio}</p>
        </div>
        <span
          style={{ color: ESTADO_COLOR[estudiante.estado], background: ESTADO_COLOR[estudiante.estado] + "22" }}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize flex-shrink-0 self-start sm:self-center"
        >
          {estudiante.estado}
        </span>
      </div>

      {/* Detalle */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        <Seccion icon={<BadgeCheck size={16} />} titulo="Identificación">
          <Dato label="RUN" valor={estudiante.run} />
          <Dato label="Nombres" valor={estudiante.nombres} />
          <Dato label="Apellido paterno" valor={estudiante.apellidoPaterno} />
          <Dato label="Apellido materno" valor={estudiante.apellidoMaterno} />
          <Dato label="Fecha de nacimiento" valor={formatearFecha(estudiante.fechaNacimiento)} />
          <Dato label="Sexo/Género" valor={estudiante.sexo} />
          <Dato label="Nacionalidad" valor={estudiante.nacionalidad} />
        </Seccion>

        <Seccion icon={<Phone size={16} />} titulo="Información de contacto">
          <Dato label="Correo electrónico" valor={estudiante.email} />
          <Dato label="Teléfono" valor={estudiante.telefono} />
          <Dato label="Dirección" valor={estudiante.direccion} span />
          <Dato label="Comuna" valor={estudiante.comuna} />
          <Dato label="Ciudad" valor={estudiante.ciudad} />
        </Seccion>

        <Seccion icon={<GraduationCap size={16} />} titulo="Información académica">
          <Dato label="Año académico" valor={anio} />
          <Dato
            label={repitiendoNivelActual ? "Nivel (repitiendo)" : "Nivel"}
            valor={estudiante.nivel}
            color={repitiendoNivelActual ? "var(--warning)" : undefined}
          />
          <Dato label="Curso" valor={estudiante.curso} />
          <Dato label="Especialidad" valor={especialidadNombre} />
          <Dato label="Jornada" valor={estudiante.jornada} />
          <Dato label="Centro dual asignado" valor={estudiante.centroDualId ? "Asignado" : "Sin empresa asignada"} />
        </Seccion>

        {(estudiante.historialCursos?.length ?? 0) > 0 && (
          <Seccion icon={<History size={16} />} titulo="Cursos pasados">
            <div className="sm:col-span-2 flex flex-col gap-2">
              {[...estudiante.historialCursos!].reverse().map((h, i) => {
                const aprobado = h.resultado === "aprobado";
                const color = aprobado ? "var(--success)" : "var(--warning)";
                return (
                  <div
                    key={i}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                    className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">
                        {h.nivel}{especialidades.find((esp) => esp.id === h.especialidadId)?.nombre ? ` en ${especialidades.find((esp) => esp.id === h.especialidadId)?.nombre}` : ""}
                      </p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{h.curso ? `${h.curso} · ` : ""}Año {h.anioAcademico}</p>
                    </div>
                    <span style={{ color, background: color + "22" }} className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0">
                      {aprobado ? "Aprobado" : "Repitió"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Seccion>
        )}
        {(estudiante.enfermedadesCronicas || estudiante.alergias || (estudiante.informacionMedicaAdicional?.length ?? 0) > 0) && (
          <Seccion icon={<HeartPulse size={16} />} titulo="Información médica">
            <Dato label="Enfermedades crónicas" valor={estudiante.enfermedadesCronicas} />
            <Dato label="Alergias" valor={estudiante.alergias} />
            {estudiante.informacionMedicaAdicional?.map((info, i) => (
              <Dato key={i} label={`Otro dato médico ${i + 1}`} valor={info} span />
            ))}
          </Seccion>
        )}

        <Seccion icon={<Users size={16} />} titulo="Información del apoderado">
          <Dato label="Nombre completo" valor={estudiante.apoderadoNombre} />
          <Dato label="RUN" valor={estudiante.apoderadoRun} />
          <Dato label="Parentesco" valor={estudiante.apoderadoParentesco} />
          <Dato label="Teléfono" valor={estudiante.apoderadoTelefono} />
          <Dato label="Correo electrónico" valor={estudiante.apoderadoEmail} span />
          <Dato label="Domicilio" valor={estudiante.apoderadoDomicilio} />
          <Dato label="Ciudad" valor={estudiante.apoderadoCiudad} />
        </Seccion>

        {(estudiante.rasgos?.length ?? 0) > 0 && (
          <Seccion icon={<Sparkles size={16} />} titulo="Características y habilidades">
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {estudiante.rasgos!.map((r) => (
                <span
                  key={r}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                >
                  {r}
                </span>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion icon={<FileText size={16} />} titulo="Observaciones">
          <Dato label="Información adicional" valor={estudiante.observaciones} span />
        </Seccion>
      </div>
    </div>
  );
}
