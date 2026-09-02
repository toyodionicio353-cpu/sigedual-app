"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Estudiante, Especialidad } from "@/types";
import {
  ArrowLeft, BadgeCheck, Phone, GraduationCap, HeartPulse,
  Sparkles, FileText, Users, Pencil,
} from "lucide-react";

const ESTADO_COLOR: Record<string, string> = {
  activo: "var(--success)",
  inactivo: "var(--danger)",
  egresado: "var(--text-muted)",
  retirado: "var(--warning)",
};

function iniciales(nombres: string, apellidos: string): string {
  return `${(nombres[0] || "").toUpperCase()}${(apellidos[0] || "").toUpperCase()}`;
}

function Seccion({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: "var(--accent-blue-light)" }}>{icon}</span>
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Dato({ label, valor, span }: { label: string; valor?: string | null; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{valor?.trim() ? valor : "—"}</p>
    </div>
  );
}

export default function FichaEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

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
          <Link href="/dashboard/estudiantes" style={{ background: "var(--accent-blue)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const especialidadNombre = especialidades.find((e) => e.id === estudiante.especialidadId)?.nombre;
  const anio = estudiante.anioAcademico || String(new Date(estudiante.creadoEn).getFullYear());

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
          <Link
            href={`/dashboard/estudiantes/${estudiante.id}/editar`}
            style={{ background: "var(--accent-blue)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Pencil size={15} />
            Editar estudiante
          </Link>
        )}
      </div>

      {/* Encabezado */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div style={{ background: "var(--accent-blue)22", borderRadius: "9999px" }} className="w-16 h-16 flex items-center justify-center flex-shrink-0">
          <span style={{ color: "var(--accent-blue-light)" }} className="text-xl font-bold">{iniciales(estudiante.nombres, estudiante.apellidos)}</span>
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
          <Dato label="Fecha de nacimiento" valor={estudiante.fechaNacimiento} />
          <Dato label="Sexo/Género" valor={estudiante.sexo} />
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
          <Dato label="Nivel" valor={estudiante.nivel} />
          <Dato label="Curso" valor={estudiante.curso} />
          <Dato label="Especialidad" valor={especialidadNombre} />
          <Dato label="Jornada" valor={estudiante.jornada} />
          <Dato label="Centro dual asignado" valor={estudiante.centroDualId ? "Asignado" : "Sin empresa asignada"} />
        </Seccion>

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
