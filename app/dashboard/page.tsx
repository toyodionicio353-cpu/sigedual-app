"use client";
import { useAuth } from "@/lib/auth-context";
import type { Rol } from "@/types";

const ROL_LABEL: Record<Rol, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  director: "Director",
  profesor: "Profesor Supervisor",
  centro_dual: "Centro Dual",
  estudiante: "Estudiante",
};

const TARJETAS = [
  { label: "Estudiantes", icon: "👤", href: "/dashboard/estudiantes", roles: ["administrador", "coordinador", "director", "profesor"] },
  { label: "Centros Duales", icon: "🏢", href: "/dashboard/centros", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
  { label: "Documentos", icon: "📄", href: "/dashboard/documentos", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { label: "Mensajes", icon: "💬", href: "/dashboard/mensajes", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { label: "Profesores", icon: "📋", href: "/dashboard/profesores", roles: ["administrador", "coordinador", "director"] },
  { label: "Especialidades", icon: "🎓", href: "/dashboard/especialidades", roles: ["administrador", "coordinador", "director"] },
  { label: "Usuarios", icon: "⚙️", href: "/dashboard/usuarios", roles: ["administrador"] },
];

export default function DashboardPage() {
  const { usuario } = useAuth();

  const tarjetas = TARJETAS.filter((t) => usuario && t.roles.includes(usuario.rol));

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">
          Bienvenido, {usuario?.nombre?.split(" ")[0]} 👋
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-1 text-sm">
          {usuario ? ROL_LABEL[usuario.rol] : ""} — Panel principal de SIGEDUAL
        </p>
      </div>

      {/* Tarjetas de acceso rápido */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tarjetas.map((t) => (
          <a
            key={t.href}
            href={t.href}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
            className="rounded-2xl p-6 flex flex-col gap-3 hover:border-blue-500 transition-colors group"
          >
            <span className="text-3xl">{t.icon}</span>
            <span style={{ color: "var(--text-primary)" }} className="font-semibold text-sm group-hover:text-blue-400 transition-colors">
              {t.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
