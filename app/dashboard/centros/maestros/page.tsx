"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { estadoDisponibilidadMaestroGuia, disponibilidadMaestroGuiaDe, camposFaltantesMaestroGuia } from "@/lib/maestro-guia";
import { useVistaListado } from "@/lib/preferencias/useVistaListado";
import EncabezadoListado from "@/components/listado/EncabezadoListado";
import TarjetasEstadisticas from "@/components/listado/TarjetasEstadisticas";
import BarraControles from "@/components/listado/BarraControles";
import PanelFiltros from "@/components/listado/PanelFiltros";
import ChipsFiltros from "@/components/listado/ChipsFiltros";
import EstadoVacio from "@/components/listado/EstadoVacio";
import EstadoError from "@/components/listado/EstadoError";
import ContadorResultados from "@/components/listado/ContadorResultados";
import type { Asignacion, CentroDual, Especialidad, MaestroGuia } from "@/types";
import { AlertCircle, ChevronRight, Search, UsersRound, School, BadgeCheck, Handshake, Building2 } from "lucide-react";
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
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const ambito = useAmbitoProfesor();
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
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");
  const [vista, setVista] = useVistaListado("maestros-guia");

  const puedeAgregar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    setError(false);
    try {
      const qEsp = modoGlobal ? collection(db, "especialidades") : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
      if (usuario.rol === "profesor") {
        const [maestrosData, centrosData, snapEsp] = await Promise.all([
          obtenerDocumentosPorId<MaestroGuia>("maestros_guia", ambito.idsMaestros),
          obtenerDocumentosPorId<CentroDual>("centros_duales", ambito.idsCentros),
          getDocs(qEsp),
        ]);
        setMaestros(maestrosData);
        setCentros(centrosData);
        setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
        setAsignaciones(ambito.asignaciones);
        setLoading(false);
        return;
      }
      const qMg = modoGlobal ? collection(db, "maestros_guia") : query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId));
      const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
      const qAsig = modoGlobal ? collection(db, "asignaciones") : query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId));
      const [snapMg, snapCentros, snapEsp, snapAsig] = await Promise.all([
        getDocs(qMg), getDocs(qCentros), getDocs(qEsp), getDocs(qAsig),
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

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, ambito.cargando, ambito.idsMaestros, ambito.idsCentros, ambito.asignaciones]);

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
    if (filtroLiceoId) base = base.filter((m) => m.liceoId === filtroLiceoId);
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
  }, [maestros, filtroEstado, filtroCentroId, filtroEspecialidadId, filtroDisponibilidad, filtroLiceoId, busqueda, centros, asignaciones]);

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

  const cantidadFiltrosActivos = [filtroEstado, filtroCentroId, filtroEspecialidadId, filtroDisponibilidad, filtroLiceoId].filter(Boolean).length;

  const filtrosActivosChips = useMemo(() => {
    const chips: { key: string; label: string; onQuitar: () => void }[] = [];
    if (filtroLiceoId) chips.push({ key: "liceo", label: liceoNombrePorId[filtroLiceoId] || "Liceo", onQuitar: () => setFiltroLiceoId("") });
    if (filtroEstado) chips.push({ key: "estado", label: ESTADO_LABEL[filtroEstado] || filtroEstado, onQuitar: () => setFiltroEstado("") });
    if (filtroCentroId) chips.push({ key: "centro", label: centroNombre(filtroCentroId), onQuitar: () => setFiltroCentroId("") });
    if (filtroEspecialidadId) chips.push({ key: "especialidad", label: especialidadNombre(filtroEspecialidadId), onQuitar: () => setFiltroEspecialidadId("") });
    if (filtroDisponibilidad) chips.push({ key: "disponibilidad", label: filtroDisponibilidad === "disponible" ? "Disponible" : "Sin capacidad", onQuitar: () => setFiltroDisponibilidad("") });
    return chips;
  }, [filtroLiceoId, filtroEstado, filtroCentroId, filtroEspecialidadId, filtroDisponibilidad, liceoNombrePorId, centros, especialidades]);

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroCentroId(""); setFiltroEspecialidadId(""); setFiltroDisponibilidad(""); setFiltroLiceoId("");
  }

  const stats = useMemo(() => {
    let conEstudiantes = 0;
    maestros.forEach((m) => {
      if (disponibilidadMaestroGuiaDe(m, asignaciones).asignados > 0) conEstudiantes += 1;
    });
    return {
      total: maestros.length,
      activos: maestros.filter((m) => m.estado === "activo").length,
      conEstudiantes,
      centrosAsociados: new Set(maestros.map((m) => m.centroDualId).filter(Boolean)).size,
    };
  }, [maestros, asignaciones]);

  return (
    <div className="p-4 md:p-8">
      <EncabezadoListado
        icon={<UsersRound size={28} />}
        titulo="Maestros guía"
        descripcion={
          modoGlobal
            ? "Maestros guía de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : "Administra las personas responsables de acompañar a los estudiantes en los centros duales."
        }
        acciones={
          puedeAgregar && (
            <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
              + Agregar maestro guía
            </Link>
          )
        }
      />

      <TarjetasEstadisticas
        loading={loading}
        estadisticas={[
          { label: "Total de Maestros Guía", value: stats.total, icon: <UsersRound size={18} />, color: "#2563eb" },
          { label: "Maestros activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Con estudiantes asignados", value: stats.conEstudiantes, icon: <Handshake size={18} />, color: "#f59e0b" },
          { label: "Centros duales asociados", value: stats.centrosAsociados, icon: <Building2 size={18} />, color: "#06b6d4" },
        ]}
      />

      <BarraControles
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholderBusqueda="Buscar por nombre, RUT o centro dual..."
        filtrosAbiertos={filtrosAbiertos}
        onToggleFiltros={() => setFiltrosAbiertos((v) => !v)}
        cantidadFiltrosActivos={cantidadFiltrosActivos}
        orden={orden}
        onOrden={setOrden}
        opcionesOrden={ORDEN_OPCIONES}
        vista={vista}
        onVista={setVista}
      />

      {filtrosAbiertos && (
        <PanelFiltros>
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
        </PanelFiltros>
      )}

      <ChipsFiltros
        busqueda={busqueda}
        onQuitarBusqueda={() => setBusqueda("")}
        chips={filtrosActivosChips}
        onLimpiarTodo={limpiarFiltros}
      />

      {/* Contenido */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : error ? (
        <EstadoError titulo="No pudimos cargar los maestros guía" onReintentar={cargar} />
      ) : maestros.length === 0 ? (
        <EstadoVacio
          icon={<UsersRound size={24} style={{ color: "var(--accent-light)" }} />}
          titulo="No hay maestros guía registrados"
          descripcion="Registra un maestro guía para comenzar a gestionar el acompañamiento de estudiantes en los centros duales."
          accion={puedeAgregar && (
            <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar maestro guía
            </Link>
          )}
        />
      ) : ordenados.length === 0 ? (
        <EstadoVacio
          icon={<Search size={22} style={{ color: "var(--text-muted)" }} />}
          titulo="No encontramos maestros guía"
          descripcion="Prueba modificando la búsqueda o eliminando algunos filtros."
          accion={
            <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <>
          <ContadorResultados total={ordenados.length} entidadSingular="maestro guía" entidadPlural="maestros guía" />

          {vista === "lista" ? (
          <>
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
                    {modoGlobal && (
                      <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                        <School size={11} /> {liceoNombrePorId[m.liceoId] || "—"}
                      </p>
                    )}
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ordenados.map((m) => {
                const centro = centroDe(m.centroDualId);
                const { capacidad, asignados, disponibles } = disponibilidadMaestroGuiaDe(m, asignaciones);
                const disp = estadoDisponibilidadMaestroGuia(m, centro, asignaciones);
                const especialidadesNombres = (m.especialidades ?? []).map((id) => especialidadNombre(id));
                return (
                  <Link
                    key={m.id}
                    href={`/dashboard/centros/maestros/${m.id}`}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
                    className="p-4 flex flex-col gap-3 hover:[border-color:var(--accent)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{m.nombres} {m.apellidoPaterno}</p>
                        {modoGlobal && (
                          <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                            <School size={11} /> {liceoNombrePorId[m.liceoId] || "—"}
                          </p>
                        )}
                      </div>
                      <span style={{ color: ESTADO_COLOR[m.estado], background: ESTADO_COLOR[m.estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0">
                        {ESTADO_LABEL[m.estado]}
                      </span>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1">
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">{centroNombre(m.centroDualId)} · {m.cargo}</p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                        Estudiantes: {capacidad != null ? `${asignados} / ${capacidad}` : asignados}
                      </p>
                      <p style={{ color: DISPONIBILIDAD_COLOR[disp] }} className="text-xs font-medium">
                        {disp === "disponible" && disponibles != null ? `${disponibles} disponible(s)` : DISPONIBILIDAD_LABEL[disp]}
                      </p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">
                        {especialidadesNombres.length === 0 ? "Sin especialidades" : especialidadesNombres.length <= 2
                          ? especialidadesNombres.join(" · ")
                          : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2}`}
                      </p>
                    </div>
                    <span style={{ color: "var(--accent-light)" }} className="flex items-center gap-1 text-xs font-semibold mt-1">
                      Ver <ChevronRight size={13} />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
