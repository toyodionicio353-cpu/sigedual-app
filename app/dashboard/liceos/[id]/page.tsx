"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Liceo, Especialidad } from "@/types";
import {
  ArrowLeft, Building2, UserCog, Phone, Globe2, GraduationCap, Pencil,
} from "lucide-react";

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

export default function FichaLiceoPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const [snapLiceo, snapEsp] = await Promise.all([
        getDoc(doc(db, "liceos", id)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", id))),
      ]);
      if (snapLiceo.exists()) {
        setLiceo({ id: snapLiceo.id, ...snapLiceo.data() } as Liceo);
      } else {
        setNoEncontrado(true);
      }
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  const puedeGestionar = usuario?.rol === "administrador";

  if (!puedeGestionar && usuario) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado || !liceo) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Liceo no encontrado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">El establecimiento que buscas no existe o fue eliminado.</p>
          <Link href="/dashboard/liceos" style={{ background: "var(--accent-blue)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const activo = liceo.estado !== "inactivo";
  const especialidadesActivas = especialidades.filter((e) => e.estado !== "inactiva");

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link
          href="/dashboard/liceos"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
        {puedeGestionar && (
          <Link
            href={`/dashboard/liceos/${liceo.id}/editar`}
            style={{ background: "var(--accent-blue)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Pencil size={15} />
            Editar liceo
          </Link>
        )}
      </div>

      {/* Encabezado */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div style={{ background: "var(--accent-blue)22", borderRadius: 14 }} className="w-14 h-14 flex items-center justify-center flex-shrink-0">
          <Building2 size={24} style={{ color: "var(--accent-blue-light)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold truncate">{liceo.nombre}</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-0.5">
            {liceo.comuna}{liceo.ciudad ? `, ${liceo.ciudad}` : ""} · RBD {liceo.rbd || "—"}
          </p>
        </div>
        <span
          style={{ color: activo ? "var(--success)" : "var(--text-muted)", background: activo ? "var(--success)22" : "var(--bg-surface)" }}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 self-start sm:self-center"
        >
          {activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        <Seccion icon={<Building2 size={16} />} titulo="Información del liceo">
          <Dato label="Nombre completo" valor={liceo.nombre} />
          <Dato label="Nombre corto / sigla" valor={liceo.nombreCorto} />
          <Dato label="RBD" valor={liceo.rbd} />
          <Dato label="RUT del establecimiento" valor={liceo.rut} />
          <Dato label="Tipo de establecimiento" valor={liceo.tipoEstablecimiento} />
          <Dato label="Dependencia" valor={liceo.dependencia} />
          <Dato label="Dirección" valor={liceo.direccion} span />
          <Dato label="Comuna" valor={liceo.comuna} />
          <Dato label="Ciudad" valor={liceo.ciudad} />
          <Dato label="Región" valor={liceo.region} />
        </Seccion>

        <Seccion icon={<UserCog size={16} />} titulo="Responsable del establecimiento">
          <Dato label="Nombre completo" valor={liceo.responsableNombre} />
          <Dato label="Cargo" valor={liceo.responsableCargo} />
          <Dato label="RUN" valor={liceo.responsableRun} />
          <Dato label="Teléfono" valor={liceo.responsableTelefono} />
          <Dato label="Correo electrónico" valor={liceo.responsableEmail} span />
        </Seccion>

        <Seccion icon={<Phone size={16} />} titulo="Información de contacto">
          <Dato label="Teléfono institucional" valor={liceo.telefono} />
          <Dato label="Correo institucional" valor={liceo.email} />
          <Dato label="Sitio web" valor={liceo.sitioWeb} span />
        </Seccion>

        <Seccion icon={<Globe2 size={16} />} titulo="Dominio institucional">
          <Dato label="Dominio" valor={liceo.dominioCorreo ? `@${liceo.dominioCorreo}` : ""} span />
        </Seccion>

        <Seccion icon={<GraduationCap size={16} />} titulo="Especialidades">
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {especialidadesActivas.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm">Sin especialidades registradas.</p>
            ) : (
              especialidadesActivas.map((esp) => (
                <span key={esp.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-full text-xs font-medium">
                  {esp.nombre}
                </span>
              ))
            )}
          </div>
        </Seccion>

        <Seccion icon={<Building2 size={16} />} titulo="Registro">
          <Dato label="Fecha de registro" valor={liceo.creadoEn ? new Date(liceo.creadoEn).toLocaleDateString("es-CL") : ""} />
          <Dato label="Última modificación" valor={liceo.actualizadoEn ? new Date(liceo.actualizadoEn).toLocaleDateString("es-CL") : ""} />
        </Seccion>
      </div>
    </div>
  );
}
