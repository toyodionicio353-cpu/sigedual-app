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
import { useDemoDeLiceo } from "@/lib/demo/useDemoDeLiceo";
import { Bell, Building2, LogOut, ArrowLeft, Clock } from "lucide-react";

// Rutas que se mantienen accesibles aunque la Demo de la institución ya
// haya vencido/sido cancelada — para no dejar sin salida a alguien que
// necesita contactar a SIGEDUAL o cerrar sesión. Todo lo demás redirige a
// /demo-vencida (ver sección "Finalización de la demostración").
const RUTAS_PERMITIDAS_DEMO_VENCIDA = [
  "/dashboard/soporte", "/dashboard/soporte/tickets", "/dashboard/soporte/tickets/nuevo",
  "/dashboard/administracion/usuario",
];

const TITULOS: Record<string, ClaveTraduccion> = {
  "/dashboard": "titulo.inicio",
  "/dashboard/estudiantes": "titulo.estudiantes",
  "/dashboard/estudiantes/nuevo": "titulo.estudianteNuevo",
  "/dashboard/estudiantes/asignaciones": "titulo.asignaciones",
  "/dashboard/estudiantes/asignaciones/nueva": "titulo.asignacionNueva",
  "/dashboard/estudiantes/historial": "titulo.historial",
  "/dashboard/centros": "titulo.centros",
  "/dashboard/centros/nuevo": "titulo.centroNuevo",
  "/dashboard/centros/estudiantes": "titulo.misEstudiantes",
  "/dashboard/centros/maestros": "titulo.maestros",
  "/dashboard/centros/maestros/nuevo": "titulo.maestroNuevo",
  "/dashboard/profesores": "titulo.profesores",
  "/dashboard/profesores/nuevo": "titulo.profesorNuevo",
  "/dashboard/profesores/asignaciones": "titulo.profesorAsignaciones",
  "/dashboard/especialidades": "titulo.especialidades",
  "/dashboard/especialidades/cursos": "titulo.cursos",
  "/dashboard/documentos/convenios": "titulo.convenios",
  "/dashboard/documentos/evaluaciones": "titulo.evaluaciones",
  "/dashboard/documentos/documentos": "titulo.documentos",
  "/dashboard/mensajes": "titulo.mensajes",
  "/dashboard/mensajes/directos": "titulo.mensajesDirectos",
  "/dashboard/mensajes/grupos": "titulo.grupos",
  "/dashboard/usuarios": "titulo.usuarios",
  "/dashboard/liceos": "titulo.liceos",
  "/dashboard/administracion/datos-liceo": "titulo.datosLiceo",
  "/dashboard/administracion/seguridad": "titulo.seguridad",
  "/dashboard/administracion/usuario": "titulo.usuario",
  "/dashboard/administracion/configuracion": "titulo.configuracion",
  "/dashboard/administracion/privacidad": "titulo.privacidad",
  "/dashboard/administracion/aviso-legal": "titulo.avisoLegal",
  "/dashboard/administracion/tickets": "titulo.tickets",
  "/dashboard/administracion/plan": "titulo.plan",
  "/dashboard/administracion/novedades": "titulo.novedades",
  "/dashboard/soporte": "titulo.soporte",
  "/dashboard/soporte/tickets": "titulo.misTickets",
  "/dashboard/soporte/tickets/nuevo": "titulo.ticketNuevo",
  "/dashboard/visitas": "titulo.visitas",
  "/dashboard/visitas/nueva": "titulo.visitaNueva",
  "/dashboard/notificaciones": "titulo.notificaciones",
  "/dashboard/calendario": "titulo.calendario",
  "/dashboard/estudiantes/promocion": "titulo.promocion",
  "/dashboard/especialidades/nueva": "titulo.especialidadNueva",
  "/dashboard/liceos/nuevo": "titulo.liceoNuevo",
};


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, liceoActivo, salirDelLiceo } = useAuth();
  const { t } = usePreferencias();
  const router = useRouter();
  const pathname = usePathname();
  /**
   * Barra colapsada (solo iconos). Se recuerda entre sesiones: si alguien
   * prefiere el riel angosto, no tiene por qué volver a colapsarlo cada
   * vez que entra. Arranca expandida mientras no haya una preferencia
   * guardada, y el acceso a localStorage va protegido porque en modo
   * privado puede lanzar.
   */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("sigedual.sidebar.colapsada") === "1") setCollapsed(true);
    } catch { /* sin almacenamiento: queda expandida */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("sigedual.sidebar.colapsada", collapsed ? "1" : "0");
    } catch { /* no poder recordarlo no debe romper nada */ }
  }, [collapsed]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelNotifAbierto, setPanelNotifAbierto] = useState(false);
  const panelNotifRef = useRef<HTMLDivElement>(null);
  const { pendientes, noLeidas, cargando: cargandoNotif, marcarLeida, eliminarNotificacion } = useNotificaciones();
  const demoLiceo = useDemoDeLiceo();

  useEffect(() => {
    if (demoLiceo.cargando || !demoLiceo.esDemo) return;
    if (demoLiceo.estado === "activa") return;
    if (RUTAS_PERMITIDAS_DEMO_VENCIDA.includes(pathname)) return;
    router.replace("/demo-vencida");
  }, [demoLiceo.cargando, demoLiceo.esDemo, demoLiceo.estado, pathname, router]);

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

  if (loading || !user) {
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

  // Toda ruta del mapa tiene clave; las que no estén (fichas con id) caen
  // en "Panel" / "Dashboard", igual que antes.
  const clave = TITULOS[pathname];
  const titulo = clave ? t(clave) : t("titulo.panel");

  function salir() {
    salirDelLiceo();
    router.push("/dashboard/liceos");
  }

  return (
    /**
     * El marco. El fondo exterior es el MISMO color de la barra lateral,
     * así que la barra no necesita un borde que la separe: se funde con el
     * marco y el contenido queda encastrado dentro, como una pantalla
     * dentro del aparato.
     *
     * Solo en escritorio: en un teléfono la pantalla ya es el aparato, y
     * un marco alrededor solo le quitaría espacio al contenido.
     */
    <div style={{ background: "var(--sidebar-bg)" }} className="flex h-screen overflow-hidden">
      <CommandPalette />
      <ShortcutsProvider />
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        style={{ background: "var(--bg-base)" }}
        className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden md:my-2 md:mr-2 md:rounded-2xl md:border md:[border-color:var(--border)]"
      >
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
            <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-titulo)" }} className="text-xl font-bold tracking-tight truncate">{titulo}</h2>
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
                    notificaciones={pendientes}
                    cargando={cargandoNotif}
                    onMarcarLeida={marcarLeida}
                    onEliminar={eliminarNotificacion}
                    onItemClick={() => setPanelNotifAbierto(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        {demoLiceo.esDemo && demoLiceo.estado === "activa" && (
          <div
            style={{ background: "var(--accent)22", borderBottom: "1px solid var(--accent)" }}
            className="px-3 md:px-6 py-2 flex items-center gap-2 flex-shrink-0"
          >
            <Clock size={14} style={{ color: "var(--accent-light)" }} className="flex-shrink-0" />
            <span style={{ color: "var(--accent-light)" }} className="text-xs font-semibold truncate">
              Demo SIGEDUAL: tu acceso de demostración está activo. Tiempo restante: {demoLiceo.tiempoRestante}.
            </span>
          </div>
        )}

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
