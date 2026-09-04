"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estadoDisponibilidadMaestroGuia, disponibilidadMaestroGuiaDe, camposFaltantesMaestroGuia } from "@/lib/maestro-guia";
import type { Asignacion, CentroDual, Especialidad, MaestroGuia } from "@/types";
import { AlertCircle, ChevronRight, Search, SlidersHorizontal, X, UsersRound } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";

const ESTADO_LABEL: Record<string, string> = { activo: "Activo", inactivo: "Inactivo" };
const ESTADO_COLOR: Record<string, string> = { activo: "var(--success)", inactivo: "var(--danger)" };

const DISPONIBILIDAD_LABEL: Record<string, string> = {
  disponible: "Disponible",
  sin_capacidad: "Sin capacidad",
  no_disponible: "No disponible",
};
const DISPONIBILIDAD_COLOR: Record<string, string> = {
  disponible: "var(--success)",
  sin_capacidad: "var(--warning)",
  no_disponible: "var(--text-muted)",
};

const ORDEN_OPCIONES = [
  { value: "recomendado", label: "Activos primero" },
  { value: "nombre", label: "Nombre A-Z" },
  { value: "centro", label: "Centro dual" },
  { value: "asignados", label: "Estudiantes asignados" },
  { value: "disponibles", label: "Capacidad disponible" },
  { value: "estado", label: "Estado" },
];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function ListaMaestrosGuiaPage() {
  const { usuario } = useAuth();
  const [maestros, setMaestros] = useState<MaestroGuia[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCentroId, setFiltroCentroId] = useState("");
  const [filtroEspecialidadId, setFiltroEspecialidadId] = useState("");
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");

  const puedeAgregar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    setError(false);
    try {
      const [snapMg, snapCentros, snapEsp, snapAsig] = await Promise.all([
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))),
      ]);
      setMaestros(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    } catch (err) {
      console.error("Error al cargar maestros guía:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  function centroDe(id: string): CentroDual | undefined {
    return centros.find((c) => c.id === id);
  }
  function centroNombre(id: string): string {
    return centroDe(id)?.nombre || "Centro no encontrado";
  }
  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || id;
  }

  const filtrados = useMemo(() => {
    let base = maestros;
    if (filtroEstado) base = base.filter((m) => m.estado === filtroEstado);
    if (filtroCentroId) base = base.filter((m) => m.centroDualId === filtroCentroId);
    if (filtroEspecialidadId) base = base.filter((m) => (m.especialidades ?? []).includes(filtroEspecialidadId));
    if (filtroDisponibilidad) {
      base = base.filter((m) => {
        const estado = estadoDisponibilidadMaestroGuia(m, centroDe(m.centroDualId), asignaciones);
        return filtroDisponibilidad === "disponible" ? estado === "disponible" : estado !== "disponible";
      });
    }
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      const qAlfanum = soloAlfanumerico(busqueda);
      base = base.filter((m) => {
        const nombreCompleto = `${m.nombres} ${m.apellidoPaterno} ${m.apellidoMaterno ?? ""}`;
        const coincideNombre = normalizar(nombreCompleto).includes(q);
        const coincideRut = qAlfanum.length > 0 && soloAlfanumerico(m.run).includes(qAlfanum);
        const coincideCentro = normalizar(centroNombre(m.centroDualId)).includes(q);
        const coincideCargo = normalizar(m.cargo).includes(q);
        return coincideNombre || coincideRut || coincideCentro || coincideCargo;
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maestros, filtroEstado, filtroCentroId, filtroEspecialidadId, filtroDisponibilidad, busqueda, centros, asignaciones]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const nombreCompleto = (m: MaestroGuia) => `${m.nombres} ${m.apellidoPaterno}`;
    switch (orden) {
      case "nombre":
        arr.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
        break;
      case "centro":
        arr.sort((a, b) => centroNombre(a.centroDualId).localeCompare(centroNombre(b.centroDualId)));
        break;
      case "asignados":
        arr.sort((a, b) => disponibilidadMaestroGuiaDe(b, asignaciones).asignados - disponibilidadMaestroGuiaDe(a, asignaciones).asignados);
        break;
      case "disponibles":
        arr.sort((a, b) => (disponibilidadMaestroGuiaDe(b, asignaciones).disponibles ?? Infinity) - (disponibilidadMaestroGuiaDe(a, asignaciones).disponibles ?? Infinity));
        break;
      case "estado":
        arr.sort((a, b) => a.estado.localeCompare(b.estado) || nombreCompleto(a).localeCompare(nombreCompleto(b)));
        break;
      default:
        arr.sort((a, b) => {
          const activoA = a.estado === "activo" ? 0 : 1;
          const activoB = b.estado === "activo" ? 0 : 1;
          return activoA - activoB || nombreCompleto(a).localeCompare(nombreCompleto(b));
        });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, orden, asignaciones, centros]);

  const hayFiltrosActivos = Boolean(busqueda.trim() || filtroEstado || filtroCentroId || filtroEspecialidadId || filtroDisponibilidad);
  const cantidadFiltrosActivos = [filtroEstado, filtroCentroId, filtroEspecialidadId, filtroDisponibilidad].filter(Boolean).length;

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroCentroId(""); setFiltroEspecialidadId(""); setFiltroDisponibilidad("");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<UsersRound size={28} />}>Maestros guía</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Administra las personas responsables de acompañar a los estudiantes en los centros duales.</p>
        </div>
        {puedeAgregar && (
          <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
            + Agregar maestro guía
          </Link>
        )}
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RUT o centro dual..."
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
        <Select
          value={orden}
          onChange={setOrden}
          ariaLabel="Ordenar"
          className="w-44 flex-shrink-0"
          opciones={ORDEN_OPCIONES}
        />
      </div>

      {filtrosAbiertos && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={filtroEstado} onChange={setFiltroEstado} ariaLabel="Estado"
              opciones={[{ value: "", label: "Todos" }, { value: "activo", label: "Activos" }, { value: "inactivo", label: "Inactivos" }]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centro dual</label>
            <Select value={filtroCentroId} onChange={setFiltroCentroId} ariaLabel="Centro dual"
              opciones={[{ value: "", label: "Todos" }, ...centros.map((c) => ({ value: c.id, label: c.nombre }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
            <Select value={filtroEspecialidadId} onChange={setFiltroEspecialidadId} ariaLabel="Especialidad"
              opciones={[{ value: "", label: "Todas" }, ...especialidades.map((esp) => ({ value: esp.id, label: esp.nombre }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Disponibilidad</label>
            <Select value={filtroDisponibilidad} onChange={setFiltroDisponibilidad} ariaLabel="Disponibilidad"
              opciones={[{ value: "", label: "Todos" }, { value: "disponible", label: "Disponible" }, { value: "sin_capacidad", label: "Sin capacidad" }]} />
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

      {/* Contenido */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : error ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No pudimos cargar los maestros guía</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
          <button onClick={cargar} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Reintentar
          </button>
        </div>
      ) : maestros.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay maestros guía registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Registra un maestro guía para comenzar a gestionar el acompañamiento de estudiantes en los centros duales.</p>
          {puedeAgregar && (
            <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar maestro guía
            </Link>
          )}
        </div>
      ) : ordenados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos maestros guía que coincidan con tu búsqueda.</p>
          <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium mt-4">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">{ordenados.length} maestro(s) guía</p>

          {/* Tabla — escritorio */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden mb-4 hidden md:block">
            <div style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }} className="grid grid-cols-[1.8fr_1.4fr_1.3fr_1.4fr_1fr_1.1fr_0.9fr_0.6fr] gap-3 px-5 py-3 text-[11px] font-semibold tracking-wide uppercase">
              <span>Maestro guía</span>
              <span>Centro dual</span>
              <span>Cargo</span>
              <span>Especialidades</span>
              <span>Estudiantes</span>
              <span>Disponibilidad</span>
              <span>Estado</span>
              <span></span>
            </div>
            {ordenados.map((m, i) => {
              const centro = centroDe(m.centroDualId);
              const { capacidad, asignados, disponibles } = disponibilidadMaestroGuiaDe(m, asignaciones);
              const disp = estadoDisponibilidadMaestroGuia(m, centro, asignaciones);
              const incompleto = camposFaltantesMaestroGuia(m, Boolean(centro)).length > 0;
              const especialidadesNombres = (m.especialidades ?? []).map((id) => especialidadNombre(id));
              return (
                <Link
                  key={m.id}
                  href={`/dashboard/centros/maestros/${m.id}`}
                  style={{ borderBottom: i < ordenados.length - 1 ? "1px solid var(--border)" : "none" }}
                  className="grid grid-cols-[1.8fr_1.4fr_1.3fr_1.4fr_1fr_1.1fr_0.9fr_0.6fr] gap-3 px-5 py-4 items-center hover:[background:var(--hover-overlay)] transition-colors"
                >
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{m.nombres} {m.apellidoPaterno} {m.apellidoMaterno}</p>
                    {incompleto && (
                      <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5">
                        <AlertCircle size={11} />
                        Información incompleta
                      </p>
                    )}
                  </div>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{centroNombre(m.centroDualId)}</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{m.cargo}</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">
                    {especialidadesNombres.length === 0 ? "—" : especialidadesNombres.length <= 2
                      ? especialidadesNombres.join(" · ")
                      : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2}`}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">{capacidad != null ? `${asignados} / ${capacidad}` : `${asignados}`}</p>
                  <span style={{ color: DISPONIBILIDAD_COLOR[disp], background: DISPONIBILIDAD_COLOR[disp] + "22" }} className="text-xs px-2 py-1 rounded-full text-center w-fit">
                    {disp === "disponible" && disponibles != null ? `${disponibles} disponible(s)` : DISPONIBILIDAD_LABEL[disp]}
                  </span>
                  <span style={{ color: ESTADO_COLOR[m.estado], background: ESTADO_COLOR[m.estado] + "22" }} className="text-xs px-2 py-1 rounded-full text-center w-fit">
                    {ESTADO_LABEL[m.estado]}
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="justify-self-end" />
                </Link>
              );
            })}
          </div>

          {/* Bloques compactos — móvil */}
          <div className="flex flex-col gap-3 md:hidden">
            {ordenados.map((m) => {
              const centro = centroDe(m.centroDualId);
              const { capacidad, asignados, disponibles } = disponibilidadMaestroGuiaDe(m, asignaciones);
              const disp = estadoDisponibilidadMaestroGuia(m, centro, asignaciones);
              const incompleto = camposFaltantesMaestroGuia(m, Boolean(centro)).length > 0;
              const especialidadesNombres = (m.especialidades ?? []).map((id) => especialidadNombre(id));
              return (
                <Link
                  key={m.id}
                  href={`/dashboard/centros/maestros/${m.id}`}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  className="rounded-2xl p-4 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{m.nombres} {m.apellidoPaterno}</p>
                      <span style={{ color: ESTADO_COLOR[m.estado], background: ESTADO_COLOR[m.estado] + "22" }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                        {ESTADO_LABEL[m.estado]}
                      </span>
                    </div>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{centroNombre(m.centroDualId)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">{m.cargo}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1 truncate">
                      {especialidadesNombres.length === 0 ? "Sin especialidades" : especialidadesNombres.length <= 2
                        ? especialidadesNombres.join(" · ")
                        : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2}`}
                    </p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">
                      {capacidad != null ? `${asignados} de ${capacidad} estudiantes` : `${asignados} estudiante(s)`}
                      {" · "}
                      <span style={{ color: DISPONIBILIDAD_COLOR[disp] }}>{disp === "disponible" && disponibles != null ? `${disponibles} disponible(s)` : DISPONIBILIDAD_LABEL[disp]}</span>
                    </p>
                    {incompleto && (
                      <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-1">
                        <AlertCircle size={11} />
                        Información incompleta
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
