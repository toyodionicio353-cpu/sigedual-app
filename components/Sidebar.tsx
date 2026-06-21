"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Rol } from "@/types";
import {
  LayoutDashboard, Users, Building2, GraduationCap,
  FileText, MessageSquare, Settings, LogOut, BookOpen,
  ChevronRight, UserPlus, ClipboardList, FilePlus,
  FolderOpen, Send, UsersRound, Building, ShieldCheck,
  BarChart3, CalendarCheck, FileSearch, MessagesSquare,
  UserCog, School, ChevronLeft, Menu,
} from "lucide-react";

interface SubItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: Rol[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  roles: Rol[];
  sub: SubItem[];
}

const MENUS: NavGroup[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: <LayoutDashboard size={18} />,
    color: "#2563eb",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard", label: "Panel principal", icon: <LayoutDashboard size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/estadisticas", label: "Estadísticas", icon: <BarChart3 size={14} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "estudiantes",
    label: "Estudiantes",
    icon: <Users size={18} />,
    color: "#3b82f6",
    roles: ["administrador", "coordinador", "director", "profesor"],
    sub: [
      { href: "/dashboard/estudiantes", label: "Lista de estudiantes", icon: <ClipboardList size={14} />, roles: ["administrador", "coordinador", "director", "profesor"] },
      { href: "/dashboard/estudiantes/nuevo", label: "Agregar estudiante", icon: <UserPlus size={14} />, roles: ["administrador", "profesor"] },
      { href: "/dashboard/estudiantes/asignaciones", label: "Asignaciones", icon: <CalendarCheck size={14} />, roles: ["administrador", "coordinador", "director", "profesor"] },
      { href: "/dashboard/estudiantes/historial", label: "Historial", icon: <FileSearch size={14} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "centros",
    label: "Centros Duales",
    icon: <Building2 size={18} />,
    color: "#22c55e",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"],
    sub: [
      { href: "/dashboard/centros", label: "Lista de centros", icon: <Building size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
      { href: "/dashboard/centros/nuevo", label: "Agregar centro", icon: <Building2 size={14} />, roles: ["administrador", "profesor"] },
      { href: "/dashboard/centros/maestros", label: "Maestros guía", icon: <UsersRound size={14} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "profesores",
    label: "Profesores",
    icon: <BookOpen size={18} />,
    color: "#8b5cf6",
    roles: ["administrador", "coordinador", "director"],
    sub: [
      { href: "/dashboard/profesores", label: "Lista de profesores", icon: <ClipboardList size={14} />, roles: ["administrador", "coordinador", "director"] },
      { href: "/dashboard/profesores/asignaciones", label: "Asignaciones", icon: <CalendarCheck size={14} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "especialidades",
    label: "Especialidades",
    icon: <GraduationCap size={18} />,
    color: "#06b6d4",
    roles: ["administrador", "coordinador", "director"],
    sub: [
      { href: "/dashboard/especialidades", label: "Lista de especialidades", icon: <GraduationCap size={14} />, roles: ["administrador", "coordinador", "director"] },
      { href: "/dashboard/especialidades/cursos", label: "Cursos", icon: <School size={14} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: <FileText size={18} />,
    color: "#f59e0b",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard/documentos", label: "Todos los documentos", icon: <FolderOpen size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/documentos/subir", label: "Subir documento", icon: <FilePlus size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
      { href: "/dashboard/documentos/mis-documentos", label: "Mis documentos", icon: <FileText size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
    ],
  },
  {
    id: "mensajes",
    label: "Mensajes",
    icon: <MessageSquare size={18} />,
    color: "#ec4899",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard/mensajes", label: "Canal general", icon: <MessagesSquare size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/mensajes/directos", label: "Mensajes directos", icon: <Send size={14} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/mensajes/grupos", label: "Grupos", icon: <UsersRound size={14} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    icon: <Settings size={18} />,
    color: "#ef4444",
    roles: ["administrador"],
    sub: [
      { href: "/dashboard/usuarios", label: "Usuarios", icon: <UserCog size={14} />, roles: ["administrador"] },
      { href: "/dashboard/liceos", label: "Liceos", icon: <School size={14} />, roles: ["administrador"] },
      { href: "/dashboard/administracion/seguridad", label: "Seguridad", icon: <ShieldCheck size={14} />, roles: ["administrador"] },
    ],
  },
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
  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(() => {
    // Abre el menú activo al cargar
    for (const m of MENUS) {
      if (m.sub.some((s) => pathname.startsWith(s.href) && s.href !== "/dashboard" || s.href === pathname)) return m.id;
    }
    return "inicio";
  });

  function toggleMenu(id: string) {
    setOpenMenu((prev) => (prev === id ? null : id));
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  const visibleMenus = MENUS.filter((m) => usuario && m.roles.includes(usuario.rol));
  const inicial = usuario?.nombre?.charAt(0).toUpperCase() ?? "?";
  const rolColor = usuario ? ROL_COLOR[usuario.rol] : "#2563eb";

  return (
    <aside
      style={{
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        width: collapsed ? 68 : 260,
        transition: "width 0.25s ease",
        flexShrink: 0,
      }}
      className="min-h-screen flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)", minHeight: 64 }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div style={{ background: "var(--accent-blue)", borderRadius: 8, minWidth: 32, height: 32 }} className="flex items-center justify-center">
              <span className="text-white font-black text-xs">SG</span>
            </div>
            <div>
              <p style={{ color: "#fff" }} className="text-sm font-bold leading-none">SIGEDUAL</p>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Gestión Dual</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ background: "var(--accent-blue)", borderRadius: 8, width: 36, height: 36 }} className="flex items-center justify-center mx-auto">
            <span className="text-white font-black text-xs">SG</span>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{ color: "var(--text-muted)", borderRadius: 6 }} className="p-1.5 hover:bg-white/5 transition-colors">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Botón expandir (solo cuando colapsado) */}
      {collapsed && (
        <div className="flex justify-center py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setCollapsed(false)} style={{ color: "var(--text-muted)", borderRadius: 6 }} className="p-1.5 hover:bg-white/5 transition-colors">
            <Menu size={18} />
          </button>
        </div>
      )}

      {/* Usuario */}
      {!collapsed && (
        <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 10 }} className="px-3 py-2.5 flex items-center gap-2.5">
            <div style={{ background: rolColor, borderRadius: 7, minWidth: 32, height: 32 }} className="flex items-center justify-center">
              <span className="text-white font-bold text-xs">{inicial}</span>
            </div>
            <div className="min-w-0">
              <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold truncate">{usuario?.nombre ?? "..."}</p>
              <p style={{ color: rolColor }} className="text-xs mt-0.5 font-medium">{usuario ? ROL_LABEL[usuario.rol] : ""}</p>
            </div>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ background: rolColor, borderRadius: 8, width: 36, height: 36 }} className="flex items-center justify-center">
            <span className="text-white font-bold text-xs">{inicial}</span>
          </div>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto flex flex-col gap-0.5" style={{ scrollbarWidth: "none" }}>
        {!collapsed && (
          <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wider px-2 mb-2">Menú principal</p>
        )}

        {visibleMenus.map((menu) => {
          const isOpen = openMenu === menu.id;
          const visibleSub = menu.sub.filter((s) => usuario && s.roles.includes(usuario.rol));
          const isActive = visibleSub.some((s) => s.href === pathname || (pathname.startsWith(s.href) && s.href !== "/dashboard"));

          if (collapsed) {
            return (
              <div key={menu.id} className="relative group">
                <button
                  onClick={() => { setCollapsed(false); setOpenMenu(menu.id); }}
                  title={menu.label}
                  style={{
                    background: isActive ? "var(--accent-blue)" : "transparent",
                    borderRadius: 10,
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    width: "100%",
                  }}
                  className="flex items-center justify-center p-2.5 hover:bg-white/5 transition-all"
                >
                  <span style={{ color: isActive ? "#fff" : menu.color }}>{menu.icon}</span>
                </button>
              </div>
            );
          }

          return (
            <div key={menu.id}>
              {/* Cabecera del menú */}
              <button
                onClick={() => toggleMenu(menu.id)}
                style={{
                  background: isActive && !isOpen ? menu.color + "18" : "transparent",
                  borderRadius: 10,
                  color: isActive ? menu.color : "var(--text-secondary)",
                  width: "100%",
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-white/5 transition-all text-left"
              >
                <span style={{ color: isActive ? menu.color : "var(--text-muted)" }}>{menu.icon}</span>
                <span className="flex-1">{menu.label}</span>
                <ChevronRight
                  size={14}
                  style={{
                    color: "var(--text-muted)",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {/* Submenús */}
              <div style={{
                maxHeight: isOpen ? visibleSub.length * 44 + "px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.25s ease",
              }}>
                <div className="ml-3 pl-3 my-1 flex flex-col gap-0.5" style={{ borderLeft: "1px solid var(--border-light)" }}>
                  {visibleSub.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        style={{
                          background: subActive ? menu.color + "25" : "transparent",
                          color: subActive ? menu.color : "var(--text-secondary)",
                          borderRadius: 8,
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-white/5 transition-all"
                      >
                        <span style={{ opacity: 0.8 }}>{sub.icon}</span>
                        {sub.label}
                        {subActive && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: menu.color }} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-2 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{ borderRadius: 10, color: "var(--text-muted)", width: "100%" }}
          className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={18} />
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
