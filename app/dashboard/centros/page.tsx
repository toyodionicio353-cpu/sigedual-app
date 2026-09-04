"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { estadoEfectivo, disponibilidadDe, camposFaltantes } from "@/lib/compatibilidad";
import { useVistaListado } from "@/lib/preferencias/useVistaListado";
import EncabezadoListado from "@/components/listado/EncabezadoListado";
import TarjetasEstadisticas from "@/components/listado/TarjetasEstadisticas";
import BarraControles from "@/components/listado/BarraControles";
import PanelFiltros from "@/components/listado/PanelFiltros";
import ChipsFiltros from "@/components/listado/ChipsFiltros";
import EstadoVacio from "@/components/listado/EstadoVacio";
import ContadorResultados from "@/components/listado/ContadorResultados";
import PaginacionListado from "@/components/listado/PaginacionListado";
import type { Asignacion, CentroDual, EstadoCentroDual, Especialidad } from "@/types";
import { Search, ChevronRight, AlertCircle, Building, School, Users2, BadgeCheck, DoorOpen, Handshake } from "lucide-react";
import Select from "@/components/ui/Select";

const PAGE_SIZE = 20;

const ESTADO_LABEL: Record<EstadoCentroDual, string> = { activo: "Activo", inactivo: "Inactivo", en_revision: "En revisión" };
const ESTADO_COLOR: Record<EstadoCentroDual, string> = { activo: "var(--success)", inactivo: "var(--danger)", en_revision: "var(--warning)" };

const ORDEN_OPCIONES = [
  { value: "recomendado", label: "Activos primero" },
  { value: "nombre", label: "Nombre A-Z" },
  { value: "estado", label: "Estado" },
  { value: "cupos", label: "Cupos disponibles" },
  { value: "asignados", label: "Estudiantes asignados" },
  { value: "fecha", label: "Más recientes" },
];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CentrosPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const ambito = useAmbitoProfesor();
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");
  const [vista, setVista] = useVistaListado("centros");
  const [pagina, setPagina] = useState(1);

  const puedeGestionar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const qEsp = modoGlobal ? collection(db, "especialidades") : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
    if (usuario.rol === "profesor") {
      const [centrosData, snapEsp] = await Promise.all([
        obtenerDocumentosPorId<CentroDual>("centros_duales", ambito.idsCentros),
        getDocs(qEsp),
      ]);
      setCentros(centrosData);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      // Disponibilidad/ocupación se calcula solo con las asignaciones propias del
      // profesor: las reglas de Firestore no le permiten leer las de sus colegas.
      setAsignaciones(ambito.asignaciones);
      setLoading(false);
      return;
    }
    const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
    const qAsig = modoGlobal ? collection(db, "asignaciones") : query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId));
    const [snapCentros, snapEsp, snapAsig] = await Promise.all([getDocs(qCentros), getDocs(qEsp), getDocs(qAsig)]);
    setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    setLoading(false);
  }

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, ambito.cargando, ambito.idsCentros, ambito.asignaciones]);

  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || id;
  }

  const filtrados = useMemo(() => {
    let base = centros;
    if (filtroLiceoId) base = base.filter((c) => c.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((c) => estadoEfectivo(c) === filtroEstado);
    if (filtroEspecialidad) base = base.filter((c) => c.especialidades.includes(filtroEspecialidad));
    if (filtroDisponibilidad) {
      base = base.filter((c) => {
        const { capacidad, disponibles } = disponibilidadDe(c, asignaciones);
        const conCupos = capacidad == null || (disponibles ?? 0) > 0;
        return filtroDisponibilidad === "con_cupos" ? conCupos : !conCupos;
      });
    }
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      const qAlfanum = soloAlfanumerico(busqueda);
      base = base.filter((c) => {
        const coincideNombre = normalizar(c.nombre).includes(q);
        const coincideRut = qAlfanum.length > 0 && soloAlfanumerico(c.rut).includes(qAlfanum);
        const coincideEspecialidad = c.especialidades.some((id) => normalizar(especialidadNombre(id)).includes(q));
        return coincideNombre || coincideRut || coincideEspecialidad;
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros, filtroEstado, filtroEspecialidad, filtroDisponibilidad, filtroLiceoId, busqueda, asignaciones, especialidades]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const conDatos = (c: CentroDual) => ({ centro: c, ...disponibilidadDe(c, asignaciones) });
    switch (orden) {
      case "nombre":
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case "estado":
        arr.sort((a, b) => estadoEfectivo(a).localeCompare(estadoEfectivo(b)) || a.nombre.localeCompare(b.nombre));
        break;
      case "cupos":
        arr.sort((a, b) => (conDatos(b).disponibles ?? Infinity) - (conDatos(a).disponibles ?? Infinity));
        break;
      case "asignados":
        arr.sort((a, b) => conDatos(b).ocupados - conDatos(a).ocupados);
        break;
      case "fecha":
        arr.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
        break;
      default:
        arr.sort((a, b) => {
          const activoA = estadoEfectivo(a) === "activo" ? 0 : 1;
          const activoB = estadoEfectivo(b) === "activo" ? 0 : 1;
          return activoA - activoB || a.nombre.localeCompare(b.nombre);
        });
    }
    return arr;
  }, [filtrados, orden, asignaciones]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * PAGE_SIZE;
  const paginaCentros = ordenados.slice(inicio, inicio + PAGE_SIZE);

  const cantidadFiltrosActivos = [filtroEstado, filtroEspecialidad, filtroDisponibilidad, filtroLiceoId].filter(Boolean).length;

  const filtrosActivosChips = useMemo(() => {
    const chips: { key: string; label: string; onQuitar: () => void }[] = [];
    if (filtroLiceoId) chips.push({ key: "liceo", label: liceoNombrePorId[filtroLiceoId] || "Liceo", onQuitar: () => setFiltroLiceoId("") });
    if (filtroEstado) chips.push({ key: "estado", label: ESTADO_LABEL[filtroEstado as EstadoCentroDual] || filtroEstado, onQuitar: () => setFiltroEstado("") });
    if (filtroEspecialidad) chips.push({ key: "especialidad", label: especialidadNombre(filtroEspecialidad), onQuitar: () => setFiltroEspecialidad("") });
    if (filtroDisponibilidad) chips.push({ key: "disponibilidad", label: filtroDisponibilidad === "con_cupos" ? "Con cupos" : "Sin cupos", onQuitar: () => setFiltroDisponibilidad("") });
    return chips;
  }, [filtroLiceoId, filtroEstado, filtroEspecialidad, filtroDisponibilidad, liceoNombrePorId, especialidades]);

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroEspecialidad(""); setFiltroDisponibilidad(""); setFiltroLiceoId(""); setPagina(1);
  }

  const stats = useMemo(() => {
    let cuposDisponibles = 0;
    let estudiantesAsignados = 0;
    centros.forEach((c) => {
      const { disponibles, ocupados } = disponibilidadDe(c, asignaciones);
      if (disponibles != null) cuposDisponibles += disponibles;
      estudiantesAsignados += ocupados;
    });
    return {
      total: centros.length,
      activos: centros.filter((c) => estadoEfectivo(c) === "activo").length,
      cuposDisponibles,
      estudiantesAsignados,
    };
  }, [centros, asignaciones]);

  return (
    <div className="p-4 md:p-8">
      <EncabezadoListado
        icon={<Building size={28} />}
        titulo="Centros duales"
        descripcion={
          modoGlobal
            ? "Centros duales de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : "Administra los centros disponibles para la formación dual."
        }
        acciones={
          puedeGestionar && (
            <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
              + Agregar centro
            </Link>
          )
        }
      />

      <TarjetasEstadisticas
        loading={loading}
        estadisticas={[
          { label: "Total de Centros Duales", value: stats.total, icon: <Building size={18} />, color: "#2563eb" },
          { label: "Centros activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Cupos disponibles", value: stats.cuposDisponibles, icon: <DoorOpen size={18} />, color: "#f59e0b" },
          { label: "Estudiantes asignados", value: stats.estudiantesAsignados, icon: <Handshake size={18} />, color: "#06b6d4" },
        ]}
      />

      <BarraControles
        busqueda={busqueda}
        onBusqueda={(v) => { setBusqueda(v); setPagina(1); }}
        placeholderBusqueda="Buscar centro, RUT o especialidad..."
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
              <Select value={filtroLiceoId} onChange={(v) => { setFiltroLiceoId(v); setPagina(1); }} ariaLabel="Liceo"
                opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]} />
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={filtroEstado} onChange={(v) => { setFiltroEstado(v); setPagina(1); }} ariaLabel="Estado"
              opciones={[
                { value: "", label: "Todos" }, { value: "activo", label: "Activos" },
                { value: "inactivo", label: "Inactivos" }, { value: "en_revision", label: "En revisión" },
              ]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
            <Select value={filtroEspecialidad} onChange={(v) => { setFiltroEspecialidad(v); setPagina(1); }} ariaLabel="Especialidad"
              opciones={[{ value: "", label: "Todas" }, ...especialidades.map((esp) => ({ value: esp.id, label: esp.nombre }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Disponibilidad</label>
            <Select value={filtroDisponibilidad} onChange={(v) => { setFiltroDisponibilidad(v); setPagina(1); }} ariaLabel="Disponibilidad"
              opciones={[{ value: "", label: "Todos" }, { value: "con_cupos", label: "Con cupos" }, { value: "sin_cupos", label: "Sin cupos" }]} />
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
      ) : centros.length === 0 ? (
        <EstadoVacio
          icon={<Building size={24} style={{ color: "var(--accent-light)" }} />}
          titulo="No hay centros duales registrados"
          descripcion="Agrega el primer centro dual para comenzar a gestionar tus espacios de formación."
          accion={puedeGestionar && (
            <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar centro
            </Link>
          )}
        />
      ) : ordenados.length === 0 ? (
        <EstadoVacio
          icon={<Search size={22} style={{ color: "var(--text-muted)" }} />}
          titulo="No encontramos centros"
          descripcion="Prueba modificando la búsqueda o eliminando algunos filtros."
          accion={
            <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <>
          <ContadorResultados
            total={ordenados.length}
            entidadSingular="centro"
            entidadPlural="centros"
            rango={{ inicio: inicio + 1, fin: Math.min(inicio + PAGE_SIZE, ordenados.length) }}
          />

          {vista === "lista" ? (
          <>
          {/* Tabla — escritorio */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden mb-4 hidden md:block">
            <div style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }} className="grid grid-cols-[2fr_1.2fr_1.6fr_0.8fr_1.4fr_1fr_0.6fr] gap-3 px-5 py-3 text-[11px] font-semibold tracking-wide uppercase">
              <span>Centro</span>
              <span>Ubicación</span>
              <span>Especialidades</span>
              <span>Capacidad</span>
              <span>Disponibilidad</span>
              <span>Estado</span>
              <span></span>
            </div>
            {paginaCentros.map((c, i) => {
              const estado = estadoEfectivo(c);
              const { capacidad, ocupados, disponibles } = disponibilidadDe(c, asignaciones);
              const incompleto = camposFaltantes(c).length > 0;
              const especialidadesNombres = c.especialidades.map((id) => especialidadNombre(id));
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/centros/${c.id}`}
                  style={{ borderBottom: i < paginaCentros.length - 1 ? "1px solid var(--border)" : "none" }}
                  className="grid grid-cols-[2fr_1.2fr_1.6fr_0.8fr_1.4fr_1fr_0.6fr] gap-3 px-5 py-4 items-center hover:[background:var(--hover-overlay)] transition-colors"
                >
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{c.nombre}</p>
                    {modoGlobal && (
                      <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                        <School size={11} /> {liceoNombrePorId[c.liceoId] || "—"}
                      </p>
                    )}
                    {incompleto && (
                      <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5">
                        <AlertCircle size={11} />
                        Información incompleta
                      </p>
                    )}
                  </div>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{[c.comuna, c.ciudad].filter(Boolean).join(" · ") || "—"}</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">
                    {especialidadesNombres.length === 0 ? "—" : especialidadesNombres.length <= 2
                      ? especialidadesNombres.join(" · ")
                      : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2} más`}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">{capacidad ?? "Sin límite"}</p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                    {capacidad != null && disponibles === 0
                      ? <span style={{ color: "var(--danger)" }} className="font-medium">Sin cupos</span>
                      : `${ocupados} ocupado(s)${disponibles != null ? ` · ${disponibles} disponible(s)` : ""}`}
                  </p>
                  <span style={{ color: ESTADO_COLOR[estado], background: ESTADO_COLOR[estado] + "22" }} className="text-xs px-2 py-1 rounded-full text-center w-fit">
                    {ESTADO_LABEL[estado]}
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="justify-self-end" />
                </Link>
              );
            })}
          </div>

          {/* Bloques compactos — móvil */}
          <div className="flex flex-col gap-3 mb-4 md:hidden">
            {paginaCentros.map((c) => {
              const estado = estadoEfectivo(c);
              const { capacidad, ocupados, disponibles } = disponibilidadDe(c, asignaciones);
              const incompleto = camposFaltantes(c).length > 0;
              const especialidadesNombres = c.especialidades.map((id) => especialidadNombre(id));
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/centros/${c.id}`}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  className="rounded-2xl p-4 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{c.nombre}</p>
                      <span style={{ color: ESTADO_COLOR[estado], background: ESTADO_COLOR[estado] + "22" }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                        {ESTADO_LABEL[estado]}
                      </span>
                    </div>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{[c.comuna, c.ciudad].filter(Boolean).join(" · ") || "Sin ubicación"}</p>
                    {modoGlobal && (
                      <p style={{ color: "var(--accent-light)" }} className="flex items-center gap-1 text-[11px] mt-0.5">
                        <School size={11} /> {liceoNombrePorId[c.liceoId] || "—"}
                      </p>
                    )}
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1.5 truncate">
                      {especialidadesNombres.length === 0 ? "Sin especialidades" : especialidadesNombres.length <= 2
                        ? especialidadesNombres.join(" · ")
                        : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2} más`}
                    </p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">
                      {capacidad != null ? `${ocupados} de ${capacidad} estudiantes` : `${ocupados} estudiante(s)`}
                      {capacidad != null && (disponibles === 0 ? <span style={{ color: "var(--danger)" }}> · Sin cupos</span> : disponibles != null ? ` · ${disponibles} cupo(s) disponible(s)` : "")}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {paginaCentros.map((c) => {
                const estado = estadoEfectivo(c);
                const { capacidad, ocupados, disponibles } = disponibilidadDe(c, asignaciones);
                const especialidadesNombres = c.especialidades.map((id) => especialidadNombre(id));
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/centros/${c.id}`}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
                    className="p-4 flex flex-col gap-3 hover:[border-color:var(--accent)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{c.nombre}</p>
                        {modoGlobal && (
                          <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                            <School size={11} /> {liceoNombrePorId[c.liceoId] || "—"}
                          </p>
                        )}
                      </div>
                      <span style={{ color: ESTADO_COLOR[estado], background: ESTADO_COLOR[estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0">
                        {ESTADO_LABEL[estado]}
                      </span>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1">
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                        Cupos disponibles: {capacidad != null ? (disponibles ?? 0) : "Sin límite"}
                      </p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">Estudiantes: {ocupados}</p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">
                        {especialidadesNombres.length === 0 ? "Sin especialidades" : especialidadesNombres.length <= 2
                          ? especialidadesNombres.join(" · ")
                          : `${especialidadesNombres.slice(0, 2).join(" · ")} +${especialidadesNombres.length - 2} más`}
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

          {/* Paginación */}
          <PaginacionListado paginaActual={paginaSegura} totalPaginas={totalPaginas} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
