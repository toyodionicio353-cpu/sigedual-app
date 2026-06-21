"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import type { Rol } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Rol[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "⊞", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/estudiantes", label: "Estudiantes", icon: "👤", roles: ["administrador", "coordinador", "director", "profesor"] },
  { href: "/dashboard/centros", label: "Centros Duales", icon: "🏢", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
  { href: "/dashboard/profesores", label: "Profesores", icon: "📋", roles: ["administrador", "coordinador", "director"] },
  { href: "/dashboard/especialidades", label: "Especialidades", icon: "🎓", roles: ["administrador", "coordinador", "director"] },
  { href: "/dashboard/documentos", label: "Documentos", icon: "📄", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/mensajes", label: "Mensajes", icon: "💬", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: "⚙️", roles: ["administrador"] },
];

const ROL_LABEL: Record<Rol, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  director: "Director",
  profesor: "Profesor Supervisor",
  centro_dual: "Centro Dual",
  estudiante: "Estudiante",
};

export default function Sidebar() {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const visibleNav = NAV.filter((item) => usuario && item.roles.includes(usuario.rol));

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <aside
      style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)" }}
      className="w-64 min-h-screen flex flex-col"
    >
      {/* Logo */}
      <div style={{ borderBottom: "1px solid var(--border)" }} className="px-6 py-5">
        <h1 style={{ color: "#fff" }} className="text-xl font-bold tracking-tight">SIGEDUAL</h1>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">Gestión Dual</p>
      </div>

      {/* Usuario */}
      <div style={{ borderBottom: "1px solid var(--border)" }} className="px-6 py-4">
        <div
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
          className="rounded-xl px-4 py-3"
        >
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">
            {usuario?.nombre ?? "..."}
          </p>
          <p style={{ color: "var(--accent-blue-light)" }} className="text-xs mt-0.5">
            {usuario ? ROL_LABEL[usuario.rol] : ""}
          </p>
          {usuario?.especialidad && (
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">
              {usuario.especialidad}
            </p>
          )}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {visibleNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                background: active ? "var(--accent-blue)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="px-3 py-4">
        <button
          onClick={handleLogout}
          style={{ color: "var(--danger)" }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
        >
          <span>🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
