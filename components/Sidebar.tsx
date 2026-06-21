"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import type { Rol } from "@/types";
import {
  LayoutDashboard, Users, Building2, GraduationCap,
  FileText, MessageSquare, Settings, LogOut, BookOpen,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: Rol[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: <LayoutDashboard size={18} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/estudiantes", label: "Estudiantes", icon: <Users size={18} />, roles: ["administrador", "coordinador", "director", "profesor"] },
  { href: "/dashboard/centros", label: "Centros Duales", icon: <Building2 size={18} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
  { href: "/dashboard/profesores", label: "Profesores", icon: <BookOpen size={18} />, roles: ["administrador", "coordinador", "director"] },
  { href: "/dashboard/especialidades", label: "Especialidades", icon: <GraduationCap size={18} />, roles: ["administrador", "coordinador", "director"] },
  { href: "/dashboard/documentos", label: "Documentos", icon: <FileText size={18} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/mensajes", label: "Mensajes", icon: <MessageSquare size={18} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: <Settings size={18} />, roles: ["administrador"] },
];

const ROL_LABEL: Record<Rol, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  director: "Director",
  profesor: "Profesor Supervisor",
  centro_dual: "Centro Dual",
  estudiante: "Estudiante",
};

const ROL_COLOR: Record<Rol, string> = {
  administrador: "#ef4444",
  coordinador: "#f59e0b",
  director: "#8b5cf6",
  profesor: "#2563eb",
  centro_dual: "#22c55e",
  estudiante: "#06b6d4",
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

  const inicial = usuario?.nombre?.charAt(0).toUpperCase() ?? "?";
  const rolColor = usuario ? ROL_COLOR[usuario.rol] : "#2563eb";

  return (
    <aside
      style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)" }}
      className="w-64 min-h-screen flex flex-col"
    >
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div style={{ background: "var(--accent-blue)", borderRadius: 10 }} className="w-9 h-9 flex items-center justify-center">
            <span className="text-white font-black text-sm">SG</span>
          </div>
          <div>
            <h1 style={{ color: "#fff" }} className="text-base font-bold tracking-tight leading-none">SIGEDUAL</h1>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Gestión Dual</p>
          </div>
        </div>
      </div>

      {/* Usuario */}
      <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 12 }} className="px-3 py-3 flex items-center gap-3">
          <div style={{ background: rolColor, borderRadius: 8, minWidth: 36, height: 36 }} className="flex items-center justify-center">
            <span className="text-white font-bold text-sm">{inicial}</span>
          </div>
          <div className="min-w-0">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate leading-tight">
              {usuario?.nombre ?? "..."}
            </p>
            <p style={{ color: rolColor }} className="text-xs mt-0.5 font-medium">
              {usuario ? ROL_LABEL[usuario.rol] : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
        <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wider px-3 mb-2">Menú</p>
        {visibleNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                background: active ? "var(--accent-blue)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                borderRadius: 10,
              }}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-white/5 transition-all"
            >
              <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleLogout}
          style={{ color: "var(--text-muted)", borderRadius: 10 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
