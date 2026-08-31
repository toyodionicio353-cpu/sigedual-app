"use client";
import Link from "next/link";
import Image from "next/image";
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
  ChevronDown, UserPlus, ClipboardList, FilePlus,
  FolderOpen, Send, UsersRound, Building, ShieldCheck,
  BarChart3, CalendarCheck, FileSearch, MessagesSquare,
  UserCog, School,
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
    icon: <LayoutDashboard size={17} />,
    color: "#2563eb",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard", label: "Panel principal", icon: <LayoutDashboard size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/estadisticas", label: "Estadísticas", icon: <BarChart3 size={13} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "estudiantes",
    label: "Estudiantes",
    icon: <Users size={17} />,
    color: "#3b82f6",
    roles: ["administrador", "coordinador", "director", "profesor"],
    sub: [
      { href: "/dashboard/estudiantes", label: "Lista de estudiantes", icon: <ClipboardList size={13} />, roles: ["administrador", "coordinador", "director", "profesor"] },
      { href: "/dashboard/estudiantes/nuevo", label: "Agregar estudiante", icon: <UserPlus size={13} />, roles: ["administrador", "profesor"] },
      { href: "/dashboard/estudiantes/asignaciones", label: "Asignaciones", icon: <CalendarCheck size={13} />, roles: ["administrador", "coordinador", "director", "profesor"] },
      { href: "/dashboard/estudiantes/historial", label: "Historial", icon: <FileSearch size={13} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "centros",
    label: "Centros Duales",
    icon: <Building2 size={17} />,
    color: "#22c55e",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"],
    sub: [
      { href: "/dashboard/centros", label: "Lista de centros", icon: <Building size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
      { href: "/dashboard/centros/nuevo", label: "Agregar centro", icon: <Building2 size={13} />, roles: ["administrador", "profesor"] },
      { href: "/dashboard/centros/maestros", label: "Maestros guía", icon: <UsersRound size={13} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "profesores",
    label: "Profesores",
    icon: <BookOpen size={17} />,
    color: "#8b5cf6",
    roles: ["administrador", "coordinador", "director"],
    sub: [
      { href: "/dashboard/profesores", label: "Lista de profesores", icon: <ClipboardList size={13} />, roles: ["administrador", "coordinador", "director"] },
      { href: "/dashboard/profesores/asignaciones", label: "Asignaciones", icon: <CalendarCheck size={13} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "especialidades",
    label: "Especialidades",
    icon: <GraduationCap size={17} />,
    color: "#06b6d4",
    roles: ["administrador", "coordinador", "director"],
    sub: [
      { href: "/dashboard/especialidades", label: "Lista de especialidades", icon: <GraduationCap size={13} />, roles: ["administrador", "coordinador", "director"] },
      { href: "/dashboard/especialidades/cursos", label: "Cursos", icon: <School size={13} />, roles: ["administrador", "coordinador", "director"] },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: <FileText size={17} />,
    color: "#f59e0b",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard/documentos", label: "Todos los documentos", icon: <FolderOpen size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/documentos/subir", label: "Subir documento", icon: <FilePlus size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
      { href: "/dashboard/documentos/mis-documentos", label: "Mis documentos", icon: <FileText size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
    ],
  },
  {
    id: "mensajes",
    label: "Mensajes",
    icon: <MessageSquare size={17} />,
    color: "#ec4899",
    roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"],
    sub: [
      { href: "/dashboard/mensajes", label: "Canal general", icon: <MessagesSquare size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/mensajes/directos", label: "Mensajes directos", icon: <Send size={13} />, roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
      { href: "/dashboard/mensajes/grupos", label: "Grupos", icon: <UsersRound size={13} />, roles: ["administrador", "coordinador", "director", "profesor"] },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    icon: <Settings size={17} />,
    color: "#ef4444",
    roles: ["administrador", "director"],
    sub: [
      { href: "/dashboard/usuarios", label: "Usuarios", icon: <UserCog size={13} />, roles: ["administrador"] },
      { href: "/dashboard/liceos", label: "Liceos", icon: <School size={13} />, roles: ["administrador"] },
      { href: "/dashboard/administracion/seguridad", label: "Seguridad", icon: <ShieldCheck size={13} />, roles: ["administrador", "director"] },
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

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>("inicio");

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
    <>
      {/* Fondo oscuro al abrir el menú en celular */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}
      <aside
        style={{
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border)",
          flexShrink: 0,
        }}
        className={`min-h-screen flex flex-col fixed md:static inset-y-0 left-0 z-40 overflow-hidden transition-all duration-200 ease-in-out w-64 ${
          collapsed ? "md:w-16" : "md:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
      {/* Logo */}
      <div className="flex items-center px-4" style={{ borderBottom: "1px solid var(--border)", height: 56, minHeight: 56 }}>
        <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={32} height={32} className="object-contain flex-shrink-0" style={{ minWidth: 32 }} />
        {!collapsed && (
          <h2 style={{ color: "#fff" }} className="ml-2.5 text-base font-bold tracking-tight uppercase leading-none whitespace-nowrap overflow-hidden">
            SIGEDUAL
          </h2>
        )}
      </div>

      {/* Usuario */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 10 }} className="px-2 py-2 flex items-center gap-2">
          <div style={{ background: rolColor, borderRadius: 7, minWidth: 32, height: 32 }} className="flex items-center justify-center">
            <span className="text-white font-bold text-xs">{inicial}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold truncate whitespace-nowrap">{usuario?.nombre ?? "..."}</p>
              <p style={{ color: rolColor }} className="text-xs font-medium whitespace-nowrap">{usuario ? ROL_LABEL[usuario.rol] : ""}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto flex flex-col gap-0.5" style={{ scrollbarWidth: "none" }}>
        {!collapsed && (
          <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-widest px-2 mb-2 mt-1">Menú</p>
        )}

        {visibleMenus.map((menu) => {
          const isOpen = openMenu === menu.id && !collapsed;
          const visibleSub = menu.sub.filter((s) => usuario && s.roles.includes(usuario.rol));
          const isActive = visibleSub.some((s) => s.href === pathname || (s.href !== "/dashboard" && pathname.startsWith(s.href)));

          return (
            <div key={menu.id}>
              <button
                onClick={() => !collapsed && toggleMenu(menu.id)}
                title={collapsed ? menu.label : undefined}
                style={{
                  background: isActive && collapsed ? menu.color + "22" : "transparent",
                  borderRadius: 9,
                  width: "100%",
                  color: isActive ? menu.color : "var(--text-secondary)",
                }}
                className="flex items-center gap-2.5 px-2.5 py-2.5 text-sm font-medium hover:bg-white/5 transition-all text-left"
              >
                {/* Icono coloreado */}
                <span style={{ color: isActive ? menu.color : "var(--text-muted)", flexShrink: 0 }}>{menu.icon}</span>

                {!collapsed && (
                  <>
                    <span className="flex-1 whitespace-nowrap">{menu.label}</span>
                    {/* Flecha */}
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: isOpen ? menu.color + "22" : "transparent",
                      flexShrink: 0,
                      transition: "background 0.15s",
                    }}>
                      <ChevronDown
                        size={13}
                        style={{
                          color: isOpen ? menu.color : "var(--text-muted)",
                          transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                          transition: "transform 0.2s ease, color 0.15s",
                        }}
                      />
                    </span>
                  </>
                )}
              </button>

              {/* Submenús animados */}
              {!collapsed && (
                <div style={{
                  maxHeight: isOpen ? `${visibleSub.length * 36 + 8}px` : "0px",
                  overflow: "hidden",
                  transition: "max-height 0.22s cubic-bezier(0.4,0,0.2,1)",
                }}>
                  <div className="ml-4 pl-3 pt-0.5 pb-1 flex flex-col gap-0.5" style={{ borderLeft: `2px solid ${menu.color}33` }}>
                    {visibleSub.map((sub) => {
                      const subActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={onCloseMobile}
                          style={{
                            background: subActive ? menu.color + "20" : "transparent",
                            color: subActive ? menu.color : "var(--text-secondary)",
                            borderRadius: 7,
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium hover:bg-white/5 transition-all"
                        >
                          <span style={{ color: subActive ? menu.color : "var(--text-muted)", opacity: 0.85, flexShrink: 0 }}>{sub.icon}</span>
                          <span className="truncate">{sub.label}</span>
                          {subActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: menu.color }} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{ borderRadius: 9, color: "var(--text-muted)", width: "100%" }}
          className={`flex items-center gap-2.5 px-2.5 py-2.5 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={17} />
          {!collapsed && <span className="whitespace-nowrap">Cerrar sesión</span>}
        </button>
      </div>
      </aside>
    </>
  );
}
