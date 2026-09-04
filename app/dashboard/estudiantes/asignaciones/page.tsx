"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import type { Asignacion, CentroDual, EstadoAsignacion, Estudiante } from "@/types";
import { CalendarCheck, Search, Eye, Handshake, CheckCircle2, Clock, School } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";

const ESTADOS: EstadoAsignacion[] = ["pendiente", "en_proceso", "asignada", "activa", "finalizada", "cancelada"];

const ESTADO_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  asignada: "Asignada",
  activa: "Activa",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const ESTADO_COLOR: Record<EstadoAsignacion, string> = {
  pendiente: "var(--text-muted)",
  en_proceso: "var(--warning)",
  asignada: "var(--accent-light)",
  activa: "var(--success)",
  finalizada: "var(--text-secondary)",
  cancelada: "var(--danger)",
};

function normalizar(texto?: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function AsignacionesPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");

  const puedeAgregar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setLoading(true);
      const qAsig = modoGlobal ? collection(db, "asignaciones") : query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId));
      const qEst = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId));
      const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId));
      const [snapAsig, snapEst, snapCentros] = await Promise.all([getDocs(qAsig), getDocs(qEst), getDocs(qCentros)]);
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setLoading(false);
    }
    cargar();
  }, [usuario, modoGlobal]);

  const estudiantePor = useMemo(() => new Map(estudiantes.map((e) => [e.id, e])), [estudiantes]);
  const centroPor = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);

  const stats = useMemo(() => ({
    total: asignaciones.length,
    activas: asignaciones.filter((a) => a.estado === "activa" || a.estado === "asignada").length,
    pendientes: asignaciones.filter((a) => a.estado === "pendiente" || a.estado === "en_proceso").length,
    finalizadas: asignaciones.filter((a) => a.estado === "finalizada").length,
  }), [asignaciones]);

  const filtradas = useMemo(() => {
    let base = asignaciones;
    if (filtroLiceoId) base = base.filter((a) => a.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((a) => a.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((a) => {
        const est = estudiantePor.get(a.estudianteId);
        const centro = centroPor.get(a.centroDualId);
        const texto = `${est?.nombres ?? ""} ${est?.apellidos ?? ""} ${centro?.nombre ?? ""}`;
        return normalizar(texto).includes(q);
      });
    }
    return [...base].sort((a, b) => (b.creadoEn > a.creadoEn ? 1 : -1));
  }, [asignaciones, busqueda, filtroEstado, filtroLiceoId, estudiantePor, centroPor]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<CalendarCheck size={28} />}>Asignaciones</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {modoGlobal
              ? "Asignaciones de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
              : "Asigna estudiantes a centros duales con recomendaciones de compatibilidad."}
          </p>
        </div>
        {puedeAgregar && (
          <Link
            href="/dashboard/estudiantes/asignaciones/nueva"
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0 text-center"
          >
            + Nueva asignación
          </Link>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total de asignaciones", value: stats.total, icon: <Handshake size={18} /> },
          { label: "Activas", value: stats.activas, icon: <CheckCircle2 size={18} /> },
          { label: "Pendientes / en proceso", value: stats.pendientes, icon: <Clock size={18} /> },
          { label: "Finalizadas", value: stats.finalizadas, icon: <CalendarCheck size={18} /> },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
            <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center">
              <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold leading-tight">{loading ? "—" : s.value}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador y filtro */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por estudiante o centro dual..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <Select
          value={filtroEstado}
          onChange={setFiltroEstado}
          ariaLabel="Filtrar por estado"
          className="w-full sm:w-56 flex-shrink-0"
          opciones={[{ value: "", label: "Todos los estados" }, ...ESTADOS.map((es) => ({ value: es, label: ESTADO_LABEL[es] }))]}
        />
        {modoGlobal && (
          <Select
            value={filtroLiceoId}
            onChange={setFiltroLiceoId}
            ariaLabel="Filtrar por liceo"
            className="w-full sm:w-56 flex-shrink-0"
            opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]}
          />
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : asignaciones.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--accent)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Handshake size={24} style={{ color: "var(--text-on-accent)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Aún no hay asignaciones registradas</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Crea la primera asignación y SIGEDUAL recomendará los centros duales más compatibles.</p>
          {puedeAgregar && (
            <Link href="/dashboard/estudiantes/asignaciones/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Nueva asignación
            </Link>
          )}
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos asignaciones</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Prueba modificando la búsqueda o el filtro de estado.</p>
          <button onClick={() => { setBusqueda(""); setFiltroEstado(""); }} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          {filtradas.map((a, i) => {
            const est = estudiantePor.get(a.estudianteId);
            const centro = centroPor.get(a.centroDualId);
            return (
              <div
                key={a.id}
                style={{ borderBottom: i < filtradas.length - 1 ? "1px solid var(--border)" : "none" }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4 hover:[background:var(--hover-overlay)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">
                    {est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}
                  </p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 flex items-center gap-1">
                    {centro ? centro.nombre : "Centro no encontrado"}
                    {a.compatibilidad.puntaje != null && <span>· {a.compatibilidad.puntaje}% compatible</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {modoGlobal && (
                    <span style={{ color: "var(--text-secondary)", background: "var(--bg-surface)" }} className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs">
                      <School size={11} /> {liceoNombrePorId[a.liceoId] || "—"}
                    </span>
                  )}
                  <span style={{ color: ESTADO_COLOR[a.estado], background: ESTADO_COLOR[a.estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium">
                    {ESTADO_LABEL[a.estado]}
                  </span>
                  <Link
                    href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--accent-light)" }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors flex-shrink-0"
                  >
                    <Eye size={13} />
                    Ver ficha
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
