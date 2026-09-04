"use client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Building2, MessageSquare, BookOpen, GraduationCap, Settings, ArrowRight, Pin } from "lucide-react";
import Link from "next/link";
import type { Rol } from "@/types";
import { usePreferencias } from "@/lib/preferencias/context";
import { ordenarModulosDashboard } from "@/lib/preferencias/dashboardModulos";
import { ROL_LABEL } from "@/lib/roles";
import { useModoGlobalAdmin } from "@/lib/liceos/modoGlobalAdmin";

interface Stat {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  href: string;
  roles: Rol[];
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const modoGlobal = useModoGlobalAdmin();
  const [counts, setCounts] = useState({ estudiantes: 0, centros: 0, mensajes: 0, profesores: 0, especialidades: 0 });

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      const liceoId = usuario!.liceoId;
      const [e, c, p, esp] = await Promise.all([
        getCountFromServer(modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", liceoId))),
        getCountFromServer(modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", liceoId))),
        getCountFromServer(modoGlobal
          ? query(collection(db, "usuarios"), where("rol", "==", "profesor"))
          : query(collection(db, "usuarios"), where("liceoId", "==", liceoId), where("rol", "==", "profesor"))),
        getCountFromServer(modoGlobal ? collection(db, "especialidades") : query(collection(db, "especialidades"), where("liceoId", "==", liceoId))),
      ]);
      setCounts({
        estudiantes: e.data().count,
        centros: c.data().count,
        mensajes: 0,
        profesores: p.data().count,
        especialidades: esp.data().count,
      });
    }
    cargar();
  }, [usuario, modoGlobal]);

  const stats: Stat[] = [
    { id: "estudiantes", label: "Estudiantes", value: counts.estudiantes, icon: <Users size={22} />, color: "#2563eb", href: "/dashboard/estudiantes", roles: ["administrador", "coordinador", "director", "profesor"] },
    { id: "centros", label: "Centros Duales", value: counts.centros, icon: <Building2 size={22} />, color: "#22c55e", href: "/dashboard/centros", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
    { id: "profesores", label: "Profesores", value: counts.profesores, icon: <BookOpen size={22} />, color: "#8b5cf6", href: "/dashboard/profesores", roles: ["administrador", "coordinador", "director"] },
    { id: "especialidades", label: "Especialidades", value: counts.especialidades, icon: <GraduationCap size={22} />, color: "#06b6d4", href: "/dashboard/especialidades", roles: ["administrador", "coordinador", "director"] },
    { id: "mensajes", label: "Mensajes", value: 0, icon: <MessageSquare size={22} />, color: "#ec4899", href: "/dashboard/mensajes", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  ];

  const accesos = [
    { label: "Gestionar Usuarios", icon: <Settings size={16} />, href: "/dashboard/usuarios", roles: ["administrador"] as Rol[] },
    { label: "Ver Estudiantes", icon: <Users size={16} />, href: "/dashboard/estudiantes", roles: ["administrador", "coordinador", "director", "profesor"] as Rol[] },
    { label: "Ver Centros", icon: <Building2 size={16} />, href: "/dashboard/centros", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] as Rol[] },
  ];

  const visibleStats = ordenarModulosDashboard(
    stats.filter((s) => usuario && s.roles.includes(usuario.rol)),
    preferencias.dashboardModulos
  );
  const visibleAccesos = accesos.filter((a) => usuario && a.roles.includes(usuario.rol));

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="p-4 md:p-8 max-w-6xl">

      {/* Header */}
      <div className="mb-8">
        <p style={{ color: "var(--accent-light)" }} className="text-sm font-medium mb-1">{saludo}</p>
        <h1 style={{ color: "var(--text-primary)" }} className="text-4xl font-bold tracking-tight">
          {usuario?.nombre?.split(" ")[0]} 👋
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-1.5 text-sm">
          {usuario ? ROL_LABEL[usuario.rol] : ""} — Panel principal de SIGEDUAL
          {modoGlobal && " · Mostrando la información de todos los liceos"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {visibleStats.map((s) => (
          <Link key={s.id} href={s.href}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
            className="p-5 flex flex-col gap-4 transition-all group hover:[border-color:var(--accent)]">
            <div className="flex items-center justify-between">
              <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-11 h-11 flex items-center justify-center">
                <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
              </div>
              {preferencias.dashboardModulos.find((m) => m.id === s.id)?.fijado ? (
                <Pin size={14} style={{ color: "var(--accent-light)" }} fill="var(--accent-light)" />
              ) : (
                <ArrowRight size={16} style={{ color: "var(--text-muted)" }} className="transition-colors hover:[color:var(--text-primary)]" />
              )}
            </div>
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{s.value}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Accesos rápidos */}
      {visibleAccesos.length > 0 && (
        <div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-3">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-3">
            {visibleAccesos.map((a) => (
              <Link key={a.href} href={a.href}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 10 }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all hover:[border-color:var(--accent)] hover:[color:var(--text-primary)]">
                {a.icon}
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Info sistema */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="mt-8 p-5 flex items-center gap-4">
        <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">ℹ️</span>
        </div>
        <div>
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">SIGEDUAL — Sistema Integral de Gestión Dual</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
            Plataforma centralizada para la formación dual en liceos técnico-profesionales.
          </p>
        </div>
      </div>

    </div>
  );
}
