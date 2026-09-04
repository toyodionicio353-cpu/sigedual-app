"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import type { Liceo, Especialidad } from "@/types";
import {
  ArrowLeft, Building2, UserCog, Phone, Globe2, GraduationCap, Pencil, LogIn,
} from "lucide-react";

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
  const router = useRouter();
  const { usuario, entrarALiceo } = useAuth();
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      setErrorCarga("");
      try {
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
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        setErrorCarga(`No fue posible cargar el liceo. (${detalle})`);
      } finally {
        setLoading(false);
      }
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

  if (errorCarga) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-2xl p-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium mb-4">{errorCarga}</p>
          <Link href="/dashboard/liceos" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrado || !liceo) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Liceo no encontrado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">El establecimiento que buscas no existe o fue eliminado.</p>
          <Link href="/dashboard/liceos" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const activo = liceo.estado !== "inactivo";
  const especialidadesActivas = especialidades.filter((e) => e.estado !== "inactiva");

  function ingresarAlLiceo() {
    entrarALiceo({ id: liceo!.id, nombre: liceo!.nombre });
    router.push("/dashboard");
  }

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
          <div className="flex gap-3">
            <button
              onClick={ingresarAlLiceo}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:[border-color:var(--accent)] transition-colors"
            >
              <LogIn size={15} />
              Ingresar al liceo
            </button>
            <Link
              href={`/dashboard/liceos/${liceo.id}/editar`}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Pencil size={15} />
              Editar liceo
            </Link>
          </div>
        )}
      </div>

      {/* Encabezado */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div style={{ background: "var(--accent)22", borderRadius: 14 }} className="w-14 h-14 flex items-center justify-center flex-shrink-0">
          <Building2 size={24} style={{ color: "var(--accent-light)" }} />
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
          <Dato label="Fecha de registro" valor={formatearFecha(liceo.creadoEn)} />
          <Dato label="Última modificación" valor={formatearFecha(liceo.actualizadoEn)} />
        </Seccion>
      </div>
    </div>
  );
}
