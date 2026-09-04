"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { formatearFecha } from "@/lib/fecha";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { CentroDual, Estudiante, EstadoVisita, Visita } from "@/types";
import { AlertCircle, ChevronRight, MapPin, School, Search, SlidersHorizontal, X } from "lucide-react";

const ESTADO_LABEL: Record<EstadoVisita, string> = {
  programada: "Programada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};
const ESTADO_COLOR: Record<EstadoVisita, string> = {
  programada: "var(--accent-light)",
  realizada: "var(--success)",
  cancelada: "var(--danger)",
};

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function VisitasPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const ambito = useAmbitoProfesor();

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const puedeAgregar = ["administrador", "coordinador", "director", "profesor"].includes(usuario?.rol ?? "");

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    setError(false);
    try {
      if (usuario.rol === "profesor") {
        const propias = await getDocs(query(collection(db, "visitas"), where("profesorId", "==", usuario.uid)));
        const idsEst = ambito.idsEstudiantes;
        const lotes: string[][] = [];
        for (let i = 0; i < idsEst.length; i += 30) lotes.push(idsEst.slice(i, i + 30));
        const snapsDeEstudiantes = await Promise.all(
          lotes.map((lote) => getDocs(query(collection(db, "visitas"), where("estudianteId", "in", lote))))
        );
        const porId = new Map<string, Visita>();
        propias.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() } as Visita));
        snapsDeEstudiantes.forEach((snap) => snap.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() } as Visita)));
        const [centrosData, estudiantesData] = await Promise.all([
          obtenerDocumentosPorId<CentroDual>("centros_duales", ambito.idsCentros),
          obtenerDocumentosPorId<Estudiante>("estudiantes", ambito.idsEstudiantes),
        ]);
        setVisitas(Array.from(porId.values()));
        setCentros(centrosData);
        setEstudiantes(estudiantesData);
        setLoading(false);
        return;
      }
      const qVisitas = modoGlobal ? collection(db, "visitas") : query(collection(db, "visitas"), where("liceoId", "==", usuario.liceoId));
      const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
      const qEstudiantes = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
      const [snapVisitas, snapCentros, snapEst] = await Promise.all([getDocs(qVisitas), getDocs(qCentros), getDocs(qEstudiantes)]);
      setVisitas(snapVisitas.docs.map((d) => ({ id: d.id, ...d.data() } as Visita)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    } catch (err) {
      console.error("Error al cargar visitas:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, ambito.cargando, ambito.idsEstudiantes, ambito.idsCentros]);

  function centroNombre(id: string): string {
    return centros.find((c) => c.id === id)?.nombre || "Centro no encontrado";
  }
  function estudianteNombre(id?: string): string {
    if (!id) return "";
    const e = estudiantes.find((e) => e.id === id);
    return e ? `${e.nombres} ${e.apellidos}` : "";
  }

  const filtradas = useMemo(() => {
    let base = visitas;
    if (filtroLiceoId) base = base.filter((v) => v.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((v) => v.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((v) =>
        normalizar(centroNombre(v.centroDualId)).includes(q) ||
        normalizar(estudianteNombre(v.estudianteId)).includes(q) ||
        normalizar(v.observaciones).includes(q)
      );
    }
    return [...base].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitas, filtroEstado, filtroLiceoId, busqueda, centros, estudiantes]);

  const hayFiltrosActivos = Boolean(busqueda.trim() || filtroEstado || filtroLiceoId);
  const cantidadFiltrosActivos = [filtroEstado, filtroLiceoId].filter(Boolean).length;

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroLiceoId("");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<MapPin size={28} />}>Visitas</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {modoGlobal
              ? "Visitas de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
              : "Visitas a los centros duales, programadas o realizadas."}
          </p>
        </div>
        {puedeAgregar && (
          <Link href="/dashboard/visitas/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
            + Registrar visita
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por centro, estudiante u observaciones..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <button
          onClick={() => setFiltrosAbiertos((v) => !v)}
          style={{
            background: filtrosAbiertos ? "var(--accent)" : "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: filtrosAbiertos ? "var(--text-on-accent)" : "var(--text-secondary)",
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0 relative"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {cantidadFiltrosActivos > 0 && (
            <span style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-5 h-5 rounded-full text-xs flex items-center justify-center">
              {cantidadFiltrosActivos}
            </span>
          )}
        </button>
      </div>

      {filtrosAbiertos && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {modoGlobal && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Liceo</label>
              <Select value={filtroLiceoId} onChange={setFiltroLiceoId} ariaLabel="Liceo"
                opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]} />
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={filtroEstado} onChange={setFiltroEstado} ariaLabel="Estado"
              opciones={[
                { value: "", label: "Todos" },
                { value: "programada", label: "Programada" },
                { value: "realizada", label: "Realizada" },
                { value: "cancelada", label: "Cancelada" },
              ]} />
          </div>
        </div>
      )}

      {hayFiltrosActivos && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {busqueda.trim() && (
            <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium">
              &quot;{busqueda.trim()}&quot;
              <button onClick={() => setBusqueda("")} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
            </span>
          )}
          <button onClick={limpiarFiltros} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : error ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No pudimos cargar las visitas</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
          <button onClick={cargar} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Reintentar
          </button>
        </div>
      ) : visitas.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay visitas registradas</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Registra una visita a un centro dual para comenzar a hacer seguimiento.</p>
          {puedeAgregar && (
            <Link href="/dashboard/visitas/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Registrar visita
            </Link>
          )}
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos visitas que coincidan con tu búsqueda.</p>
          <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium mt-4">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">{filtradas.length} visita(s)</p>
          <div className="flex flex-col gap-3">
            {filtradas.map((v) => (
              <div key={v.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{centroNombre(v.centroDualId)}</p>
                    <span style={{ color: ESTADO_COLOR[v.estado], background: ESTADO_COLOR[v.estado] + "22" }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                      {ESTADO_LABEL[v.estado]}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                    {formatearFecha(v.fecha)}{v.hora ? ` · ${v.hora}` : ""}
                    {estudianteNombre(v.estudianteId) && ` · ${estudianteNombre(v.estudianteId)}`}
                  </p>
                  {v.observaciones && (
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1 truncate">{v.observaciones}</p>
                  )}
                  {modoGlobal && (
                    <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-1">
                      <School size={11} /> {liceoNombrePorId[v.liceoId] || "—"}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
