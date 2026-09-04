"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { estudiantesAsignadosDe, especialidadesEnUso } from "@/lib/profesores";
import { useVistaListado } from "@/lib/preferencias/useVistaListado";
import EncabezadoListado from "@/components/listado/EncabezadoListado";
import TarjetasEstadisticas from "@/components/listado/TarjetasEstadisticas";
import BarraControles from "@/components/listado/BarraControles";
import PanelFiltros from "@/components/listado/PanelFiltros";
import ChipsFiltros from "@/components/listado/ChipsFiltros";
import EstadoVacio from "@/components/listado/EstadoVacio";
import ContadorResultados from "@/components/listado/ContadorResultados";
import PaginacionListado from "@/components/listado/PaginacionListado";
import Select from "@/components/ui/Select";
import type { Asignacion, Usuario } from "@/types";
import {
  Search, ChevronRight, MoreVertical,
  Eye, Pencil, Users, ClipboardCheck, MapPin, Power, ClipboardList, School,
  BadgeCheck, Handshake, GraduationCap,
} from "lucide-react";

const PAGE_SIZE = 20;

const ESTADO_LABEL: Record<string, string> = { activo: "Activo", inactivo: "Inactivo" };
const ESTADO_COLOR: Record<string, string> = { activo: "var(--success)", inactivo: "var(--text-muted)" };

const ORDEN_OPCIONES = [
  { value: "nombre-asc", label: "Nombre A-Z" },
  { value: "nombre-desc", label: "Nombre Z-A" },
  { value: "recomendado", label: "Activos primero" },
  { value: "inactivos", label: "Inactivos primero" },
  { value: "recientes", label: "Más recientes" },
  { value: "antiguos", label: "Más antiguos" },
  { value: "especialidad", label: "Especialidad" },
  { value: "asignados", label: "Estudiantes asignados" },
];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function ProfesoresPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");
  const [vista, setVista] = useVistaListado("profesores");
  const [pagina, setPagina] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [actualizandoUid, setActualizandoUid] = useState<string | null>(null);

  const tieneAccesoGlobal = usuario?.rol === "administrador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const puedeGestionar = usuario?.rol === "administrador";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const qProf = modoGlobal
      ? query(collection(db, "usuarios"), where("rol", "==", "profesor"))
      : query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId), where("rol", "==", "profesor"));
    const qAsig = modoGlobal ? collection(db, "asignaciones") : query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId));
    const [snapProf, snapAsig] = await Promise.all([getDocs(qProf), getDocs(qAsig)]);
    setProfesores(snapProf.docs.map((d) => d.data() as Usuario));
    setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    setLoading(false);
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario, modoGlobal]);

  const especialidadesDisponibles = useMemo(() => especialidadesEnUso(profesores), [profesores]);

  const filtrados = useMemo(() => {
    let base = profesores;
    if (filtroLiceoId) base = base.filter((p) => p.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((p) => (p.activo ? "activo" : "inactivo") === filtroEstado);
    if (filtroEspecialidad) base = base.filter((p) => (p.especialidad || "").trim() === filtroEspecialidad);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      const qAlfanum = soloAlfanumerico(busqueda);
      base = base.filter((p) => {
        const coincideTexto = normalizar(`${p.nombre} ${p.email} ${p.especialidad || ""}`).includes(q);
        const coincideRut = qAlfanum.length > 0 && soloAlfanumerico(p.run).includes(qAlfanum);
        return coincideTexto || coincideRut;
      });
    }
    return base;
  }, [profesores, filtroEstado, filtroEspecialidad, filtroLiceoId, busqueda]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    switch (orden) {
      case "nombre-asc":
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case "nombre-desc":
        arr.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
      case "inactivos":
        arr.sort((a, b) => {
          const inactivoA = a.activo ? 1 : 0;
          const inactivoB = b.activo ? 1 : 0;
          return inactivoB - inactivoA || a.nombre.localeCompare(b.nombre);
        });
        break;
      case "recientes":
        arr.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
        break;
      case "antiguos":
        arr.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
        break;
      case "especialidad":
        arr.sort((a, b) => (a.especialidad || "").localeCompare(b.especialidad || ""));
        break;
      case "asignados":
        arr.sort((a, b) => estudiantesAsignadosDe(b.uid, asignaciones) - estudiantesAsignadosDe(a.uid, asignaciones));
        break;
      default:
        arr.sort((a, b) => {
          const activoA = a.activo ? 0 : 1;
          const activoB = b.activo ? 0 : 1;
          return activoA - activoB || a.nombre.localeCompare(b.nombre);
        });
    }
    return arr;
  }, [filtrados, orden, asignaciones]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * PAGE_SIZE;
  const paginaProfesores = ordenados.slice(inicio, inicio + PAGE_SIZE);

  const cantidadFiltrosActivos = [filtroEspecialidad, filtroEstado, filtroLiceoId].filter(Boolean).length;

  const filtrosActivosChips = useMemo(() => {
    const chips: { key: string; label: string; onQuitar: () => void }[] = [];
    if (filtroLiceoId) chips.push({ key: "liceo", label: liceoNombrePorId[filtroLiceoId] || "Liceo", onQuitar: () => setFiltroLiceoId("") });
    if (filtroEspecialidad) chips.push({ key: "especialidad", label: filtroEspecialidad, onQuitar: () => setFiltroEspecialidad("") });
    if (filtroEstado) chips.push({ key: "estado", label: ESTADO_LABEL[filtroEstado] || filtroEstado, onQuitar: () => setFiltroEstado("") });
    return chips;
  }, [filtroLiceoId, filtroEspecialidad, filtroEstado, liceoNombrePorId]);

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEspecialidad(""); setFiltroEstado(""); setFiltroLiceoId(""); setPagina(1);
  }

  const stats = useMemo(() => {
    let conEstudiantes = 0;
    profesores.forEach((p) => {
      if (estudiantesAsignadosDe(p.uid, asignaciones) > 0) conEstudiantes += 1;
    });
    return {
      total: profesores.length,
      activos: profesores.filter((p) => p.activo).length,
      conEstudiantes,
      especialidades: especialidadesDisponibles.length,
    };
  }, [profesores, asignaciones, especialidadesDisponibles]);

  async function toggleActivo(p: Usuario) {
    if (actualizandoUid) return;
    setActualizandoUid(p.uid);
    setMenuAbierto(null);
    try {
      await updateDoc(doc(db, "usuarios", p.uid), { activo: !p.activo });
      setProfesores((prev) => prev.map((x) => (x.uid === p.uid ? { ...x, activo: !x.activo } : x)));
    } finally {
      setActualizandoUid(null);
    }
  }

  if (usuario && !tieneAccesoGlobal) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  function MenuAcciones({ p }: { p: Usuario }) {
    const abierto = menuAbierto === p.uid;
    return (
      <div className="relative justify-self-end" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuAbierto(abierto ? null : p.uid)}
          style={{ color: "var(--text-muted)" }}
          className="p-1.5 rounded-lg hover:[background:var(--hover-overlay)] transition-colors"
        >
          <MoreVertical size={16} />
        </button>
        {abierto && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuAbierto(null)} />
            <div
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
              className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-2xl overflow-hidden z-40 py-1"
            >
              <Link href={`/dashboard/profesores/${p.uid}`} onClick={() => setMenuAbierto(null)} style={{ color: "var(--text-primary)" }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                <Eye size={14} /> Ver ficha
              </Link>
              {puedeGestionar && (
                <Link href={`/dashboard/profesores/${p.uid}/editar`} onClick={() => setMenuAbierto(null)} style={{ color: "var(--text-primary)" }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                  <Pencil size={14} /> Editar
                </Link>
              )}
              <Link href={`/dashboard/profesores/${p.uid}#estudiantes`} onClick={() => setMenuAbierto(null)} style={{ color: "var(--text-primary)" }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                <Users size={14} /> Ver estudiantes asignados
              </Link>
              <Link href={`/dashboard/profesores/${p.uid}#visitas`} onClick={() => setMenuAbierto(null)} style={{ color: "var(--text-primary)" }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                <MapPin size={14} /> Ver visitas
              </Link>
              <Link href={`/dashboard/profesores/${p.uid}#evaluaciones`} onClick={() => setMenuAbierto(null)} style={{ color: "var(--text-primary)" }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors">
                <ClipboardCheck size={14} /> Ver evaluaciones
              </Link>
              {puedeGestionar && (
                <button
                  onClick={() => toggleActivo(p)}
                  disabled={actualizandoUid === p.uid}
                  style={{ color: p.activo ? "var(--danger)" : "var(--success)", borderTop: "1px solid var(--border)" }}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm w-full text-left hover:[background:var(--hover-overlay)] transition-colors disabled:opacity-50"
                >
                  <Power size={14} /> {p.activo ? "Desactivar" : "Activar"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <EncabezadoListado
        icon={<ClipboardList size={28} />}
        titulo="Profesores Supervisores"
        descripcion={
          modoGlobal
            ? "Profesores supervisores de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : "Gestiona y consulta los profesores supervisores registrados en SIGEDUAL."
        }
        acciones={
          puedeGestionar && (
            <Link href="/dashboard/profesores/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
              + Agregar profesor supervisor
            </Link>
          )
        }
      />

      <TarjetasEstadisticas
        loading={loading}
        estadisticas={[
          { label: "Total de Profesores", value: stats.total, icon: <ClipboardList size={18} />, color: "#2563eb" },
          { label: "Profesores activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Con estudiantes asignados", value: stats.conEstudiantes, icon: <Handshake size={18} />, color: "#f59e0b" },
          { label: "Especialidades cubiertas", value: stats.especialidades, icon: <GraduationCap size={18} />, color: "#06b6d4" },
        ]}
      />

      <BarraControles
        busqueda={busqueda}
        onBusqueda={(v) => { setBusqueda(v); setPagina(1); }}
        placeholderBusqueda="Buscar por nombre, RUT, correo o especialidad..."
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
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
            <Select value={filtroEspecialidad} onChange={(v) => { setFiltroEspecialidad(v); setPagina(1); }} ariaLabel="Especialidad"
              opciones={[{ value: "", label: "Todas las especialidades" }, ...especialidadesDisponibles.map((esp) => ({ value: esp, label: esp }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={filtroEstado} onChange={(v) => { setFiltroEstado(v); setPagina(1); }} ariaLabel="Estado"
              opciones={[{ value: "", label: "Todos" }, { value: "activo", label: "Activos" }, { value: "inactivo", label: "Inactivos" }]} />
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
      ) : profesores.length === 0 ? (
        <EstadoVacio
          icon={<ClipboardList size={24} style={{ color: "var(--accent-light)" }} />}
          titulo="No hay profesores supervisores registrados"
          descripcion="Registra al primer profesor supervisor para comenzar a asignarles estudiantes."
          accion={puedeGestionar && (
            <Link href="/dashboard/profesores/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar profesor supervisor
            </Link>
          )}
        />
      ) : ordenados.length === 0 ? (
        <EstadoVacio
          icon={<Search size={22} style={{ color: "var(--text-muted)" }} />}
          titulo="No se encontraron profesores supervisores"
          descripcion="Prueba cambiando los filtros o realizando una nueva búsqueda."
          accion={
            <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <>
          <ContadorResultados total={ordenados.length} entidadSingular="profesor supervisor" entidadPlural="profesores supervisores" />

          {vista === "lista" ? (
          <>
          {/* Tabla — escritorio */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden mb-4 hidden md:block overflow-x-auto">
            <div style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }} className="grid grid-cols-[1.8fr_1fr_1.2fr_1.6fr_1fr_0.9fr_0.5fr] gap-3 px-5 py-3 text-[11px] font-semibold tracking-wide uppercase min-w-[860px]">
              <span>Profesor supervisor</span>
              <span>RUT</span>
              <span>Especialidad</span>
              <span>Correo electrónico</span>
              <span>Estudiantes</span>
              <span>Estado</span>
              <span></span>
            </div>
            {paginaProfesores.map((p, i) => (
              <div
                key={p.uid}
                style={{ borderBottom: i < paginaProfesores.length - 1 ? "1px solid var(--border)" : "none" }}
                className="grid grid-cols-[1.8fr_1fr_1.2fr_1.6fr_1fr_0.9fr_0.5fr] gap-3 px-5 py-4 items-center hover:[background:var(--hover-overlay)] transition-colors min-w-[860px]"
              >
                <Link href={`/dashboard/profesores/${p.uid}`} className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{p.nombre}</p>
                  {modoGlobal && (
                    <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                      <School size={11} /> {liceoNombrePorId[p.liceoId] || "—"}
                    </p>
                  )}
                </Link>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{p.run || "—"}</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{p.especialidad || "—"}</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{p.email}</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs">{estudiantesAsignadosDe(p.uid, asignaciones)}</p>
                <span style={{ color: ESTADO_COLOR[p.activo ? "activo" : "inactivo"], background: ESTADO_COLOR[p.activo ? "activo" : "inactivo"] + "22" }} className="text-xs px-2 py-1 rounded-full text-center w-fit">
                  {ESTADO_LABEL[p.activo ? "activo" : "inactivo"]}
                </span>
                <MenuAcciones p={p} />
              </div>
            ))}
          </div>

          {/* Bloques compactos — móvil */}
          <div className="flex flex-col gap-3 mb-4 md:hidden">
            {paginaProfesores.map((p) => (
              <div key={p.uid} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/profesores/${p.uid}`} className="min-w-0 flex-1">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{p.nombre}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{p.especialidad || "Sin especialidad"}</p>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span style={{ color: ESTADO_COLOR[p.activo ? "activo" : "inactivo"], background: ESTADO_COLOR[p.activo ? "activo" : "inactivo"] + "22" }} className="text-xs px-2 py-0.5 rounded-full">
                      {ESTADO_LABEL[p.activo ? "activo" : "inactivo"]}
                    </span>
                    <MenuAcciones p={p} />
                  </div>
                </div>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-2 truncate">{p.email}</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">
                  {p.run ? `RUT ${p.run} · ` : ""}{estudiantesAsignadosDe(p.uid, asignaciones)} estudiante(s) asignado(s)
                </p>
              </div>
            ))}
          </div>
          </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {paginaProfesores.map((p) => (
                <div key={p.uid} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/profesores/${p.uid}`} className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{p.nombre}</p>
                      {modoGlobal && (
                        <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                          <School size={11} /> {liceoNombrePorId[p.liceoId] || "—"}
                        </p>
                      )}
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span style={{ color: ESTADO_COLOR[p.activo ? "activo" : "inactivo"], background: ESTADO_COLOR[p.activo ? "activo" : "inactivo"] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium">
                        {ESTADO_LABEL[p.activo ? "activo" : "inactivo"]}
                      </span>
                      <MenuAcciones p={p} />
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1">
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{p.especialidad || "Sin especialidad"}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{p.email}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs">{estudiantesAsignadosDe(p.uid, asignaciones)} estudiante(s) asignado(s)</p>
                  </div>
                  <Link href={`/dashboard/profesores/${p.uid}`} style={{ color: "var(--accent-light)" }} className="flex items-center gap-1 text-xs font-semibold mt-1">
                    Ver ficha <ChevronRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          <PaginacionListado paginaActual={paginaSegura} totalPaginas={totalPaginas} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
