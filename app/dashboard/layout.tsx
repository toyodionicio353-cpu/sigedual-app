"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette from "@/components/CommandPalette";
import ShortcutsProvider from "@/components/ShortcutsProvider";
import { usePreferencias } from "@/lib/preferencias/context";
import type { ClaveTraduccion } from "@/lib/preferencias/i18n";
import { useNotificaciones } from "@/lib/notificaciones/useNotificaciones";
import ListaNotificaciones from "@/components/notificaciones/ListaNotificaciones";
import { Bell, Building2, LogOut, ArrowLeft } from "lucide-react";

const TITULOS: Record<string, string> = {
  "/dashboard": "Inicio",
  "/dashboard/estudiantes": "Estudiantes",
  "/dashboard/estudiantes/nuevo": "Agregar Estudiante",
  "/dashboard/estudiantes/asignaciones": "Asignaciones",
  "/dashboard/estudiantes/asignaciones/nueva": "Nueva asignación",
  "/dashboard/estudiantes/historial": "Historial",
  "/dashboard/centros": "Centros Duales",
  "/dashboard/centros/nuevo": "Agregar Centro",
  "/dashboard/centros/maestros": "Maestros Guía",
  "/dashboard/centros/maestros/nuevo": "Agregar maestro guía",
  "/dashboard/profesores": "Profesores",
  "/dashboard/profesores/nuevo": "Agregar profesor",
  "/dashboard/profesores/asignaciones": "Listado de asignaciones",
  "/dashboard/especialidades": "Especialidades",
  "/dashboard/especialidades/cursos": "Cursos",
  "/dashboard/documentos/convenios": "Convenios",
  "/dashboard/documentos/evaluaciones": "Evaluaciones",
  "/dashboard/documentos/documentos": "Documentos",
  "/dashboard/mensajes": "Canal General",
  "/dashboard/mensajes/directos": "Mensajes Directos",
  "/dashboard/mensajes/grupos": "Grupos",
  "/dashboard/usuarios": "Usuarios",
  "/dashboard/liceos": "Liceos",
  "/dashboard/administracion/datos-liceo": "Datos del liceo",
  "/dashboard/administracion/seguridad": "Seguridad",
  "/dashboard/administracion/usuario": "Usuario",
  "/dashboard/administracion/configuracion": "Configuración",
  "/dashboard/administracion/privacidad": "Políticas",
  "/dashboard/administracion/aviso-legal": "Aviso legal",
  "/dashboard/administracion/tickets": "Tickets",
  "/dashboard/soporte": "Soporte",
  "/dashboard/soporte/tickets": "Mis tickets",
  "/dashboard/soporte/tickets/nuevo": "Crear ticket",
  "/dashboard/visitas": "Visitas",
  "/dashboard/visitas/nueva": "Registrar visita",
  "/dashboard/notificaciones": "Notificaciones",
  "/dashboard/calendario": "Calendario",
};

// Solo se traduce el título del encabezado para las rutas que ya tienen una
// clave en el diccionario de i18n (ver lib/preferencias/i18n.ts). El resto
// de las páginas conserva su título en español hasta que se traduzcan.
const TITULOS_CLAVE: Record<string, ClaveTraduccion> = {
  "/dashboard": "nav.inicio",
  "/dashboard/estudiantes": "nav.estudiantes",
  "/dashboard/centros": "nav.centros",
  "/dashboard/profesores": "nav.profesores",
  "/dashboard/especialidades": "nav.especialidades",
  "/dashboard/mensajes": "nav.mensajes",
  "/dashboard/usuarios": "nav.usuarios",
  "/dashboard/liceos": "nav.liceos",
  "/dashboard/administracion/datos-liceo": "nav.datosLiceo",
  "/dashboard/administracion/seguridad": "nav.seguridad",
  "/dashboard/administracion/usuario": "nav.usuario",
  "/dashboard/administracion/configuracion": "nav.configuracion",
  "/dashboard/administracion/privacidad": "nav.privacidad",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, liceoActivo, salirDelLiceo } = useAuth();
  const { t } = usePreferencias();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelNotifAbierto, setPanelNotifAbierto] = useState(false);
  const panelNotifRef = useRef<HTMLDivElement>(null);
  const { notificaciones, noLeidas, cargando: cargandoNotif, marcarLeida } = useNotificaciones();

  useEffect(() => {
    if (!panelNotifAbierto) return;
    function alHacerClickFuera(e: MouseEvent) {
      if (panelNotifRef.current && !panelNotifRef.current.contains(e.target as Node)) setPanelNotifAbierto(false);
    }
    window.addEventListener("mousedown", alHacerClickFuera);
    return () => window.removeEventListener("mousedown", alHacerClickFuera);
  }, [panelNotifAbierto]);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div style={{ background: "var(--accent)", borderRadius: 10 }} className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <span style={{ color: "var(--text-on-accent)" }} className="font-black">SG</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  const claveTitulo = TITULOS_CLAVE[pathname];
  const titulo = claveTitulo ? t(claveTitulo) : (TITULOS[pathname] ?? "Panel");

  function salir() {
    salirDelLiceo();
    router.push("/dashboard/liceos");
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="flex h-screen overflow-hidden">
      <CommandPalette />
      <ShortcutsProvider />
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Topbar */}
        <header
          style={{ background: "var(--bg-card)", height: 56 }}
          className="px-3 md:px-6 flex items-center justify-between sticky top-0 z-20"
        >
          <div className="flex items-center gap-3 h-14 min-w-0">
            {/* Logo: abre el menú en móvil (el sidebar está oculto hasta abrirlo) */}
            <button
              onClick={toggleSidebar}
              style={{ borderRadius: 8 }}
              className="p-1 hover:[background:var(--hover-overlay)] transition-colors flex-shrink-0 md:hidden"
              title="Abrir menú"
            >
              <Image src="/logo-icon.png" alt="Abrir menú" width={24} height={24} className="object-contain" />
            </button>

            {/* Volver: navega a la página anterior. Se oculta en el inicio, que no tiene "atrás". */}
            {pathname !== "/dashboard" && (
              <button
                onClick={() => router.back()}
                style={{ color: "var(--accent)", borderRadius: 8 }}
                className="p-1.5 hover:[background:var(--hover-overlay)] transition-colors flex-shrink-0"
                title="Volver"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            {/* Título */}
            <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif" }} className="text-xl font-bold tracking-tight truncate">{titulo}</h2>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="relative" ref={panelNotifRef}>
              <button
                onClick={() => setPanelNotifAbierto((v) => !v)}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                className="w-8 h-8 flex items-center justify-center hover:[border-color:var(--accent)] transition-colors relative"
                title="Notificaciones"
              >
                <Bell size={15} style={{ color: "var(--text-muted)" }} />
                {noLeidas > 0 && (
                  <span
                    style={{ background: "var(--danger)", color: "#fff" }}
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  >
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </button>

              {panelNotifAbierto && (
                <div
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 14 }}
                  className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[70vh] overflow-y-auto shadow-2xl"
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Notificaciones</p>
                    <Link href="/dashboard/notificaciones" onClick={() => setPanelNotifAbierto(false)} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
                      Ver todas
                    </Link>
                  </div>
                  <ListaNotificaciones
                    notificaciones={notificaciones}
                    cargando={cargandoNotif}
                    onMarcarLeida={marcarLeida}
                    onItemClick={() => setPanelNotifAbierto(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        {liceoActivo && (
          <div
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-3 md:px-6 py-2 flex items-center justify-between gap-3 flex-shrink-0"
          >
            <span className="flex items-center gap-2 text-xs font-semibold truncate">
              <Building2 size={14} className="flex-shrink-0" />
              Viendo como administrador el liceo: {liceoActivo.nombre}
            </span>
            <button
              onClick={salir}
              className="flex items-center gap-1.5 text-xs font-semibold hover:underline flex-shrink-0"
            >
              <LogOut size={13} />
              Salir del liceo
            </button>
          </div>
        )}

        {/* Contenido */}
        <main className="flex-1 min-h-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
