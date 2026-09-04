"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estadoEfectivo, disponibilidadDe, camposFaltantes } from "@/lib/compatibilidad";
import type { Asignacion, CentroDual, EstadoCentroDual, Especialidad } from "@/types";
import { Search, SlidersHorizontal, X, ChevronRight, ChevronLeft, AlertCircle, Building } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
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
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");
  const [pagina, setPagina] = useState(1);

  const puedeGestionar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const [snapCentros, snapEsp, snapAsig] = await Promise.all([
      getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))),
    ]);
    setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    setLoading(false);
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || id;
  }

  const filtrados = useMemo(() => {
    let base = centros;
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
  }, [centros, filtroEstado, filtroEspecialidad, filtroDisponibilidad, busqueda, asignaciones, especialidades]);

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

  const hayFiltrosActivos = Boolean(busqueda.trim() || filtroEstado || filtroEspecialidad || filtroDisponibilidad);
  const cantidadFiltrosActivos = [filtroEstado, filtroEspecialidad, filtroDisponibilidad].filter(Boolean).length;

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroEspecialidad(""); setFiltroDisponibilidad(""); setPagina(1);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Building size={28} />}>Centros duales</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Administra los centros disponibles para la formación dual.</p>
        </div>
        {puedeGestionar && (
          <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
            + Agregar centro
          </Link>
        )}
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Buscar centro, RUT o especialidad..."
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
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      ) : centros.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay centros duales registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Agrega el primer centro dual para comenzar a gestionar tus espacios de formación.</p>
          {puedeGestionar && (
            <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar centro
            </Link>
          )}
        </div>
      ) : ordenados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos centros que coincidan con tu búsqueda.</p>
          <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium mt-4">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">
            Mostrando {inicio + 1}–{Math.min(inicio + PAGE_SIZE, ordenados.length)} de {ordenados.length} centro(s)
          </p>

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

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="p-2 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ color: "var(--text-secondary)" }} className="text-xs px-2">
                Página {paginaSegura} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="p-2 rounded-lg disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
