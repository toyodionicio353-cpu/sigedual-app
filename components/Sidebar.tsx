"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import type { Rol } from "@/types";
import Mascota, { mascotaGuardada, type TipoMascota } from "@/components/Mascota";

interface SubItem {
  href: string;
  label: string;
  icon: string;
  roles: Rol[];
  proximamente?: boolean;
  moduloId?: string;
}

// Niveles por defecto por módulo/rol (espejo del DEFAULT en permisos/page.tsx)
const DEFAULT_NIVELES: Record<string, Partial<Record<Rol, string>>> = {
  usuarios:     { coordinador:"ninguno", director:"lectura", profesor:"ninguno", centro_dual:"ninguno", estudiante:"ninguno" },
  roles:        { coordinador:"ninguno", director:"lectura", profesor:"ninguno", centro_dual:"ninguno", estudiante:"ninguno" },
  permisos:     { coordinador:"ninguno", director:"lectura", profesor:"ninguno", centro_dual:"ninguno", estudiante:"ninguno" },
  auditoria:    { coordinador:"ninguno", director:"lectura", profesor:"ninguno", centro_dual:"ninguno", estudiante:"ninguno" },
  sesiones:     { coordinador:"ninguno", director:"ninguno", profesor:"ninguno", centro_dual:"ninguno", estudiante:"ninguno" },
  asignaciones: { coordinador:"total",   director:"lectura", profesor:"lectura", centro_dual:"lectura", estudiante:"lectura" },
  planes:       { coordinador:"total",   director:"lectura", profesor:"lectura", centro_dual:"lectura", estudiante:"lectura" },
  actividades:  { coordinador:"total",   director:"lectura", profesor:"total",   centro_dual:"lectura", estudiante:"lectura" },
  competencias: { coordinador:"total",   director:"lectura", profesor:"total",   centro_dual:"lectura", estudiante:"lectura" },
  evidencias:   { coordinador:"total",   director:"lectura", profesor:"total",   centro_dual:"total",   estudiante:"total"   },
  estudiantes:  { coordinador:"total",   director:"lectura", profesor:"lectura", centro_dual:"lectura", estudiante:"lectura" },
  empresas:     { coordinador:"total",   director:"lectura", profesor:"ninguno", centro_dual:"lectura", estudiante:"ninguno" },
};

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  roles: Rol[];
  sub: SubItem[];
  proximamente?: boolean;
}

const ALL: Rol[] = ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"];
const STAFF: Rol[] = ["administrador", "coordinador", "director", "profesor"];
const MGMT: Rol[] = ["administrador", "coordinador", "director"];
const ADMIN: Rol[] = ["administrador"];

// Menús desplegables (sin Inicio, que es directo)
const MENUS: NavGroup[] = [
  {
    id: "gestion",
    label: "Gestión Dual",
    icon: "fa-solid fa-graduation-cap",
    color: "#818cf8",
    roles: STAFF,
    sub: [
      { href: "/dashboard/estudiantes",      label: "Estudiantes",          icon: "fa-solid fa-users",            roles: STAFF, moduloId: "estudiantes" },
      { href: "/dashboard/profesores",       label: "Profesores Supervisores", icon: "fa-solid fa-chalkboard-user", roles: MGMT },
      { href: "/dashboard/empresas",         label: "Empresas Duales",      icon: "fa-solid fa-building",         roles: STAFF, moduloId: "empresas" },
      { href: "/dashboard/maestros-guia",    label: "Maestros Guía",        icon: "fa-solid fa-user-tie",         roles: STAFF },
      { href: "/dashboard/gestion/ubicaciones", label: "Ubicaciones Duales", icon: "fa-solid fa-location-dot",   roles: MGMT, proximamente: true },
    ],
  },
  {
    id: "practicas",
    label: "Prácticas y Formación",
    icon: "fa-solid fa-book-open",
    color: "#34d399",
    roles: STAFF,
    sub: [
      { href: "/dashboard/practicas/asignaciones", label: "Asignaciones",      icon: "fa-solid fa-list-check",      roles: STAFF, moduloId: "asignaciones" },
      { href: "/dashboard/practicas/planes",       label: "Planes Formativos", icon: "fa-solid fa-clipboard-list",  roles: MGMT,  moduloId: "planes" },
      { href: "/dashboard/practicas/actividades",  label: "Actividades",       icon: "fa-solid fa-calendar-check",  roles: STAFF, moduloId: "actividades" },
      { href: "/dashboard/practicas/competencias", label: "Competencias",      icon: "fa-solid fa-star",            roles: MGMT,  moduloId: "competencias" },
      { href: "/dashboard/practicas/evidencias",   label: "Evidencias",        icon: "fa-solid fa-file-image",      roles: STAFF, moduloId: "evidencias" },
    ],
  },
  {
    id: "seguimiento",
    label: "Seguimiento",
    icon: "fa-solid fa-chart-line",
    color: "#22d3ee",
    roles: STAFF,
    sub: [
      { href: "/dashboard/seguimiento/visitas", label: "Visitas", icon: "fa-solid fa-route", roles: STAFF },
      { href: "/dashboard/seguimiento/evaluaciones", label: "Evaluaciones", icon: "fa-solid fa-clipboard-check", roles: STAFF },
      { href: "/dashboard/seguimiento/bitacoras", label: "Bitácoras", icon: "fa-solid fa-book", roles: STAFF },
      { href: "/dashboard/seguimiento/informes", label: "Informes", icon: "fa-solid fa-file-lines", roles: MGMT },
      { href: "/dashboard/seguimiento/alertas", label: "Alertas", icon: "fa-solid fa-triangle-exclamation", roles: MGMT },
    ],
  },
  {
    id: "documentacion",
    label: "Documentación",
    icon: "fa-solid fa-folder-open",
    color: "#fbbf24",
    roles: ALL,
    proximamente: true,
    sub: [
      { href: "/dashboard/documentacion/documentos", label: "Documentos", icon: "fa-solid fa-file-lines", roles: ALL },
      { href: "/dashboard/documentacion/convenios", label: "Convenios", icon: "fa-solid fa-handshake", roles: MGMT },
      { href: "/dashboard/documentacion/formularios", label: "Formularios", icon: "fa-solid fa-rectangle-list", roles: STAFF },
    ],
  },
  {
    id: "comunicaciones",
    label: "Comunicaciones",
    icon: "fa-solid fa-comments",
    color: "#f472b6",
    roles: ALL,
    sub: [
      { href: "/dashboard/mensajes", label: "Mensajes", icon: "fa-solid fa-envelope", roles: ALL },
      { href: "/dashboard/comunicaciones/notificaciones", label: "Notificaciones", icon: "fa-solid fa-bell", roles: ALL },
      { href: "/dashboard/comunicaciones/anuncios", label: "Anuncios", icon: "fa-solid fa-bullhorn", roles: MGMT, proximamente: true },
      { href: "/dashboard/comunicaciones/calendario", label: "Calendario", icon: "fa-solid fa-calendar-days", roles: ALL },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: "fa-solid fa-chart-bar",
    color: "#a78bfa",
    roles: MGMT,
    sub: [
      { href: "/dashboard/reportes/estudiantes", label: "Reporte de Estudiantes", icon: "fa-solid fa-users", roles: MGMT },
      { href: "/dashboard/reportes/empresas", label: "Reporte de Empresas", icon: "fa-solid fa-building", roles: MGMT },
      { href: "/dashboard/reportes/visitas", label: "Reporte de Visitas", icon: "fa-solid fa-route", roles: MGMT },
      { href: "/dashboard/reportes/indicadores", label: "Indicadores Duales", icon: "fa-solid fa-gauge", roles: MGMT },
      { href: "/dashboard/estadisticas", label: "Estadísticas Generales", icon: "fa-solid fa-chart-pie", roles: MGMT },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    icon: "fa-solid fa-gear",
    color: "#f87171",
    roles: ADMIN,
    sub: [
      { href: "/dashboard/usuarios",                  label: "Usuarios",         icon: "fa-solid fa-users-gear",        roles: ADMIN, moduloId: "usuarios" },
      { href: "/dashboard/administracion/roles",      label: "Roles",            icon: "fa-solid fa-user-shield",       roles: ADMIN, moduloId: "roles" },
      { href: "/dashboard/administracion/permisos",   label: "Permisos",         icon: "fa-solid fa-key",               roles: ADMIN, moduloId: "permisos" },
      { href: "/dashboard/administracion/auditoria",  label: "Auditoría",        icon: "fa-solid fa-clock-rotate-left", roles: ADMIN, moduloId: "auditoria" },
      { href: "/dashboard/administracion/sesiones",   label: "Sesiones Activas", icon: "fa-solid fa-desktop",           roles: ADMIN, moduloId: "sesiones" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: "fa-solid fa-server",
    color: "#94a3b8",
    roles: ADMIN,
    sub: [
      { href: "/dashboard/sistema/configuracion", label: "Configuración General", icon: "fa-solid fa-sliders", roles: ADMIN },
      { href: "/dashboard/sistema/apariencia", label: "Apariencia", icon: "fa-solid fa-palette", roles: ADMIN },
      { href: "/dashboard/sistema/respaldos", label: "Respaldos", icon: "fa-solid fa-database", roles: ADMIN },
      { href: "/dashboard/sistema/base-datos", label: "Base de Datos", icon: "fa-solid fa-hard-drive", roles: ADMIN },
      { href: "/dashboard/sistema/integraciones", label: "Integraciones", icon: "fa-solid fa-plug", roles: ADMIN },
    ],
  },
  {
    id: "soporte",
    label: "Soporte",
    icon: "fa-solid fa-life-ring",
    color: "#2dd4bf",
    roles: ALL,
    sub: [
      { href: "/dashboard/soporte/manual", label: "Manual de Uso", icon: "fa-solid fa-book", roles: ALL },
      { href: "/dashboard/soporte/ayuda", label: "Centro de Ayuda", icon: "fa-solid fa-circle-question", roles: ALL },
      { href: "/dashboard/soporte/tickets", label: "Tickets", icon: "fa-solid fa-ticket", roles: ALL },
      { href: "/dashboard/soporte/contacto", label: "Contacto", icon: "fa-solid fa-phone", roles: ALL },
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
  administrador: "#f87171",
  coordinador: "#fbbf24",
  director: "#a78bfa",
  profesor: "#60a5fa",
  centro_dual: "#34d399",
  estudiante: "#22d3ee",
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [notifNoLeidas, setNotifNoLeidas] = useState(0);
  const [nivelesPermiso, setNivelesPermiso] = useState<Record<string, string> | null>(null);
  const [mascota, setMascota] = useState<TipoMascota | null>(null);

  // Mascota elegida en el login (null hasta montar, para evitar desajuste de hidratación)
  useEffect(() => { setMascota(mascotaGuardada()); }, []);

  // Cargar permisos en tiempo real desde Firestore
  useEffect(() => {
    if (!usuario?.liceoId || !usuario?.rol || usuario.rol === "administrador") return;
    const unsub = onSnapshot(doc(db, "configuracion", usuario.liceoId), snap => {
      if (snap.exists() && snap.data().permisos) {
        const matrix = snap.data().permisos as Record<string, Record<string, string>>;
        const niveles: Record<string, string> = {};
        for (const [modulo, roles] of Object.entries(matrix)) {
          niveles[modulo] = roles[usuario.rol] ?? "ninguno";
        }
        setNivelesPermiso(niveles);
      } else {
        setNivelesPermiso(null); // sin config → usar DEFAULT_NIVELES
      }
    }, () => setNivelesPermiso(null));
    return () => unsub();
  }, [usuario?.liceoId, usuario?.rol]);

  useEffect(() => {
    if (!usuario?.uid) return;
    const q = query(
      collection(db, "notificaciones", usuario.uid, "items"),
      where("leida", "==", false)
    );
    const unsub = onSnapshot(
      q,
      snap => {
        const count = snap.docs.filter(d => !d.data().archivada).length;
        setNotifNoLeidas(count);
      },
      () => {}
    );
    return () => unsub();
  }, [usuario?.uid]);

  function isSubActive(href: string): boolean {
    if (href === "/dashboard") return false;
    const [hrefPath, hrefQuery] = href.split("?");
    if (!hrefQuery) {
      if (!pathname.startsWith(hrefPath)) return false;
      return !searchParams.get("tab") || searchParams.get("tab") === "todos";
    }
    const hrefTab = new URLSearchParams(hrefQuery).get("tab");
    return pathname === hrefPath && searchParams.get("tab") === hrefTab;
  }

  function toggleMenu(id: string) {
    setOpenMenu((prev) => (prev === id ? null : id));
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  const visibleMenus = MENUS.filter((m) => usuario && m.roles.includes(usuario.rol));
  const inicial = usuario?.nombre?.charAt(0).toUpperCase() ?? "?";
  const rolColor = usuario ? ROL_COLOR[usuario.rol] : "#60a5fa";
  const inicioActivo = pathname === "/dashboard";

  return (
    <>
    <style>{`
      .sidebar-nav::-webkit-scrollbar { display: none !important; }
      .sidebar-nav { scrollbar-width: none !important; -ms-overflow-style: none !important; }
    `}</style>
    <aside
      style={{
        /* Degradado: teal suave arriba-derecha → azul oscuro abajo-izquierda (predominante oscuro) */
        background: "linear-gradient(225deg, rgba(31,178,166,0.38) 0%, #0f2835 42%, #091520 100%)",
        width: collapsed ? 64 : 272,
        minWidth: collapsed ? 64 : 272,
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── CABECERA: hamburguesa + nombre ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 12,
          padding: collapsed ? "18px 0" : "18px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          minHeight: 64,
          flexShrink: 0,
        }}
      >
        {/* Botón hamburguesa */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            color: "#fff",
            transition: "background 0.15s",
          }}
          onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.16)"}
          onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
        >
          <i className="fa-solid fa-bars" style={{ fontSize: 14 }} />
        </button>

        {/* Nombre SIGEDUAL — solo cuando está expandido */}
        {!collapsed && (
          <span
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.8px",
              whiteSpace: "nowrap",
            }}
          >
            SIGEDUAL
          </span>
        )}
      </div>

      {/* ── USUARIO (solo expandido) ── */}
      {!collapsed && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10,
            padding: "8px 11px",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: rolColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
            }}>{inicial}</div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                {usuario?.nombre ?? "..."}
              </p>
              <p style={{ color: rolColor, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", margin: 0 }}>
                {usuario ? ROL_LABEL[usuario.rol] : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── NAVEGACIÓN ── */}
      <nav className="sidebar-nav" style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: collapsed ? "10px 7px" : "10px 9px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>

        {/* INICIO — botón directo, sin desplegable */}
        <Link
          href="/dashboard"
          title={collapsed ? "Inicio" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 11,
            padding: collapsed ? "11px 0" : "11px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 9,
            background: inicioActivo ? "rgba(255,255,255,0.16)" : "transparent",
            color: "#fff",
            fontSize: 15,
            fontWeight: inicioActivo ? 600 : 500,
            textDecoration: "none",
            transition: "background 0.15s",
            fontFamily: "'Inter', system-ui, sans-serif",
            position: "relative",
          }}
          onMouseOver={e => { if (!inicioActivo) e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
          onMouseOut={e => { if (!inicioActivo) e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ width: 22, textAlign: "center", flexShrink: 0, color: inicioActivo ? "#38bdf8" : "rgba(255,255,255,0.72)" }}>
            <i className="fa-solid fa-house" style={{ fontSize: 15 }} />
          </span>
          {!collapsed && <span style={{ whiteSpace: "nowrap" }}>Inicio</span>}
          {collapsed && inicioActivo && (
            <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#38bdf8" }} />
          )}
        </Link>

        {/* SEPARADOR */}
        {!collapsed && (
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", padding: "10px 12px 4px", margin: 0 }}>
            Módulos
          </p>
        )}
        {collapsed && <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "6px 0" }} />}

        {/* MENÚS DESPLEGABLES */}
        {visibleMenus.map((menu) => {
          const isOpen = openMenu === menu.id && !collapsed;
          const visibleSub = menu.sub.filter((s) => {
            if (!usuario || !s.roles.includes(usuario.rol)) return false;
            if (usuario.rol === "administrador" || !s.moduloId) return true;
            const nivel = nivelesPermiso
              ? (nivelesPermiso[s.moduloId] ?? "ninguno")
              : (DEFAULT_NIVELES[s.moduloId]?.[usuario.rol] ?? "ninguno");
            return nivel !== "ninguno";
          });
          const isActive = visibleSub.some((s) => isSubActive(s.href));
          const esAdmin = usuario?.rol === "administrador";
          // Un menú o ítem está "bloqueado" si está marcado como próximamente Y el usuario no es admin
          const menuBloqueado = !!menu.proximamente && !esAdmin;

          return (
            <div key={menu.id}>
              <button
                onClick={() => !collapsed && toggleMenu(menu.id)}
                title={collapsed ? menu.label : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 11,
                  padding: collapsed ? "11px 0" : "11px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 9,
                  border: "none",
                  background: isActive ? "rgba(255,255,255,0.14)" : isOpen ? "rgba(255,255,255,0.09)" : "transparent",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  textAlign: "left",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  position: "relative",
                }}
                onMouseOver={e => { if (!isActive && !isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                onMouseOut={e => { if (!isActive && !isOpen) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 22, textAlign: "center", flexShrink: 0, color: isActive ? menu.color : "rgba(255,255,255,0.68)" }}>
                  <i className={menu.icon} style={{ fontSize: 15 }} />
                </span>

                {!collapsed && (
                  <>
                    <span style={{ flex: 1, whiteSpace: "nowrap", fontSize: 15 }}>{menu.label}</span>
                    {/* Badge próximamente en el header del grupo */}
                    {menuBloqueado && (
                      <span style={{
                        background: "rgba(251,191,36,0.15)",
                        border: "1px solid rgba(251,191,36,0.35)",
                        color: "#fbbf24",
                        borderRadius: 6,
                        padding: "1px 6px",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                        marginRight: 4,
                      }}>Próximo</span>
                    )}
                    <i
                      className="fa-solid fa-chevron-down"
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.40)",
                        transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 0.22s ease",
                        flexShrink: 0,
                      }}
                    />
                  </>
                )}

                {collapsed && isActive && (
                  <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: menu.color }} />
                )}
              </button>

              {/* Submenús */}
              {!collapsed && (
                <div style={{
                  maxHeight: isOpen ? `${visibleSub.length * 42 + 10}px` : "0px",
                  overflow: "hidden",
                  transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)",
                }}>
                  <div style={{
                    marginLeft: 18,
                    paddingLeft: 13,
                    paddingTop: 3,
                    paddingBottom: 4,
                    borderLeft: `2px solid ${menu.color}45`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}>
                    {visibleSub.map((sub) => {
                      const subActive = isSubActive(sub.href);
                      const isNotifLink = sub.href === "/dashboard/comunicaciones/notificaciones";
                      const badge = isNotifLink && notifNoLeidas > 0 ? notifNoLeidas : 0;
                      // Bloqueado si el menú padre está marcado O el propio ítem, y no es admin
                      const subBloqueado = (!!menu.proximamente || !!sub.proximamente) && !esAdmin;

                      if (subBloqueado) {
                        return (
                          <div
                            key={sub.href}
                            title="Próximamente disponible"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "9px 10px",
                              borderRadius: 8,
                              background: "transparent",
                              cursor: "not-allowed",
                              opacity: 0.45,
                              userSelect: "none",
                            }}
                          >
                            <i className={sub.icon} style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", width: 16, textAlign: "center", flexShrink: 0 }} />
                            <span style={{ flex: 1, lineHeight: 1.3, fontSize: 14, color: "rgba(255,255,255,0.58)", fontFamily: "'Inter', system-ui, sans-serif" }}>{sub.label}</span>
                            <span style={{
                              background: "rgba(251,191,36,0.13)",
                              border: "1px solid rgba(251,191,36,0.30)",
                              color: "#fbbf24",
                              borderRadius: 6,
                              padding: "1px 6px",
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              flexShrink: 0,
                            }}>Próximo</span>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 10px",
                            borderRadius: 8,
                            background: subActive ? `${menu.color}28` : "transparent",
                            color: subActive ? "#fff" : "rgba(255,255,255,0.58)",
                            fontSize: 14,
                            fontWeight: subActive ? 600 : 400,
                            textDecoration: "none",
                            transition: "background 0.15s, color 0.15s",
                            fontFamily: "'Inter', system-ui, sans-serif",
                          }}
                          onMouseOver={e => { if (!subActive) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; } }}
                          onMouseOut={e => { if (!subActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.58)"; } }}
                        >
                          <i className={sub.icon} style={{ fontSize: 12, color: subActive ? menu.color : "rgba(255,255,255,0.38)", width: 16, textAlign: "center", flexShrink: 0 }} />
                          <span style={{ flex: 1, lineHeight: 1.3 }}>{sub.label}</span>
                          {badge > 0 && (
                            <span style={{
                              background: "#ef4444", color: "#fff",
                              borderRadius: 999, padding: "1px 7px",
                              fontSize: 11, fontWeight: 700, flexShrink: 0,
                              minWidth: 20, textAlign: "center",
                            }}>{badge > 99 ? "99+" : badge}</span>
                          )}
                          {/* Badge próximamente en ítems individuales (solo para admins lo ven igual) */}
                          {sub.proximamente && esAdmin && (
                            <span style={{
                              background: "rgba(251,191,36,0.13)",
                              border: "1px solid rgba(251,191,36,0.30)",
                              color: "#fbbf24",
                              borderRadius: 6,
                              padding: "1px 6px",
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              flexShrink: 0,
                            }}>Beta</span>
                          )}
                          {subActive && !badge && <span style={{ width: 6, height: 6, borderRadius: "50%", background: menu.color, flexShrink: 0 }} />}
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

      {/* ── MASCOTA ── */}
      {!collapsed && mascota && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 2px", flexShrink: 0 }} title="Tu compañero SIGEDUAL">
          <Mascota tipo={mascota} animacion="idle" escala={0.28} fps={4} />
        </div>
      )}

      {/* ── CERRAR SESIÓN ── */}
      <div style={{ padding: collapsed ? "12px 7px" : "12px 9px", borderTop: "1px solid rgba(255,255,255,0.10)", flexShrink: 0 }}>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            padding: collapsed ? "11px 0" : "10px 13px",
            borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.75)",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          onMouseOver={e => e.currentTarget.style.background = "rgba(220,38,38,0.28)"}
          onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
        >
          <i className="fa-solid fa-arrow-right-from-bracket" style={{ fontSize: 15 }} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
