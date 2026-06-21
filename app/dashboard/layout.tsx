"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { Bell, Menu } from "lucide-react";

const TITULOS: Record<string, string> = {
  "/dashboard": "Inicio",
  "/dashboard/estudiantes": "Estudiantes",
  "/dashboard/estudiantes/nuevo": "Agregar Estudiante",
  "/dashboard/estudiantes/asignaciones": "Asignaciones",
  "/dashboard/estudiantes/historial": "Historial",
  "/dashboard/centros": "Centros Duales",
  "/dashboard/centros/nuevo": "Agregar Centro",
  "/dashboard/centros/maestros": "Maestros Guía",
  "/dashboard/profesores": "Profesores",
  "/dashboard/profesores/asignaciones": "Asignaciones de Profesores",
  "/dashboard/especialidades": "Especialidades",
  "/dashboard/especialidades/cursos": "Cursos",
  "/dashboard/documentos": "Documentos",
  "/dashboard/documentos/subir": "Subir Documento",
  "/dashboard/documentos/mis-documentos": "Mis Documentos",
  "/dashboard/mensajes": "Canal General",
  "/dashboard/mensajes/directos": "Mensajes Directos",
  "/dashboard/mensajes/grupos": "Grupos",
  "/dashboard/usuarios": "Usuarios",
  "/dashboard/liceos": "Liceos",
  "/dashboard/administracion/seguridad": "Seguridad",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div style={{ background: "var(--accent-blue)", borderRadius: 10 }} className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-black">SG</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  const titulo = TITULOS[pathname] ?? "Panel";

  return (
    <div style={{ background: "var(--bg-base)" }} className="flex min-h-screen">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", height: 56 }}
          className="px-6 flex items-center justify-between sticky top-0 z-10"
        >
          <div className="flex items-center gap-4 h-14">
            {/* Hamburguesa */}
            <button
              onClick={() => setCollapsed((v) => !v)}
              style={{ borderRadius: 8, color: "var(--text-secondary)" }}
              className="p-2 hover:bg-white/5 transition-colors"
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <Menu size={20} />
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 24, background: "var(--border)" }} />

            {/* Título */}
            <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}
              className="w-8 h-8 flex items-center justify-center hover:border-blue-500/50 transition-colors"
            >
              <Bell size={15} style={{ color: "var(--text-muted)" }} />
            </button>
            <div
              style={{ background: "var(--accent-blue)", borderRadius: 8, width: 32, height: 32 }}
              className="flex items-center justify-center cursor-pointer"
              title={usuario?.nombre}
            >
              <span className="text-white text-xs font-bold">{usuario?.nombre?.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
