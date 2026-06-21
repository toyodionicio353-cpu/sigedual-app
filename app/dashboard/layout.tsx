"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { Bell } from "lucide-react";

const TITULOS: Record<string, string> = {
  "/dashboard": "Inicio",
  "/dashboard/estudiantes": "Estudiantes",
  "/dashboard/centros": "Centros Duales",
  "/dashboard/profesores": "Profesores",
  "/dashboard/especialidades": "Especialidades",
  "/dashboard/documentos": "Documentos",
  "/dashboard/mensajes": "Mensajes",
  "/dashboard/usuarios": "Usuarios",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }} className="px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">{titulo}</h2>
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10 }} className="w-9 h-9 flex items-center justify-center">
              <Bell size={16} style={{ color: "var(--text-muted)" }} />
            </button>
            <div style={{ background: "var(--accent-blue)", borderRadius: 8 }} className="w-8 h-8 flex items-center justify-center">
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
