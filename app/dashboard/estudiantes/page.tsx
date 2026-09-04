"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import Select from "@/components/ui/Select";
import { useVistaListado } from "@/lib/preferencias/useVistaListado";
import EncabezadoListado from "@/components/listado/EncabezadoListado";
import TarjetasEstadisticas from "@/components/listado/TarjetasEstadisticas";
import BarraControles from "@/components/listado/BarraControles";
import PanelFiltros from "@/components/listado/PanelFiltros";
import ChipsFiltros from "@/components/listado/ChipsFiltros";
import EstadoVacio from "@/components/listado/EstadoVacio";
import ContadorResultados from "@/components/listado/ContadorResultados";
import PaginacionListado from "@/components/listado/PaginacionListado";
import type { Estudiante, Especialidad } from "@/types";
import {
  Search, Eye, UserPlus, Users2, BadgeCheck, Handshake,
  AlertTriangle, GraduationCap, ClipboardList, School,
} from "lucide-react";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const ESTADOS: Estudiante["estado"][] = ["activo", "inactivo", "egresado", "retirado"];
const PAGE_SIZE = 12;
const RETENCION_ANIOS = 5;
const AVISO_DIAS_ANTES = 30;

const ESTADO_COLOR: Record<string, string> = {
  activo: "var(--success)",
  inactivo: "var(--warning)",
  egresado: "var(--danger)",
  retirado: "var(--warning)",
};

const ORDEN_OPCIONES = [
  { value: "nombre-asc", label: "Nombre A-Z" },
  { value: "nombre-desc", label: "Nombre Z-A" },
  { value: "recientes", label: "Más recientes" },
  { value: "antiguos", label: "Más antiguos" },
  { value: "curso", label: "Curso" },
  { value: "especialidad", label: "Especialidad" },
];

interface Filtros {
  anio: string;
  nivel: string;
  curso: string;
  especialidadId: string;
  estado: string;
  dual: string;
  liceoId: string;
}

const FILTROS_VACIOS: Filtros = { anio: "", nivel: "", curso: "", especialidadId: "", estado: "", dual: "", liceoId: "" };

function normalizar(texto?: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function iniciales(nombres: string, apellidos: string): string {
  return `${(nombres[0] || "").toUpperCase()}${(apellidos[0] || "").toUpperCase()}`;
}

export default function EstudiantesPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const ambito = useAmbitoProfesor();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [vista, setVista] = useVistaListado("estudiantes");
  const [orden, setOrden] = useState("nombre-asc");
  const [pagina, setPagina] = useState(1);

  const puedeAgregar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, ambito.cargando, ambito.idsEstudiantes]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const qEsp = modoGlobal
      ? collection(db, "especialidades")
      : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
    if (usuario.rol === "profesor") {
      const [estudiantesData, snapEsp] = await Promise.all([
        obtenerDocumentosPorId<Estudiante>("estudiantes", ambito.idsEstudiantes),
        getDocs(qEsp),
      ]);
      setEstudiantes(estudiantesData);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setLoading(false);
      return;
    }
    const q = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
    const [snapEst, snapEsp] = await Promise.all([getDocs(q), getDocs(qEsp)]);
    setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setLoading(false);
  }

  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || "";
  }

  const anioDe = (e: Estudiante) => e.anioAcademico || String(new Date(e.creadoEn).getFullYear());

  const aniosDisponibles = useMemo(() => {
    const set = new Set<string>();
    estudiantes.forEach((e) => set.add(anioDe(e)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [estudiantes]);

  const nivelesDisponibles = useMemo(() => {
    const set = new Set<string>();
    estudiantes.forEach((e) => { if (e.nivel) set.add(e.nivel); });
    return NIVELES.filter((n) => set.has(n));
  }, [estudiantes]);

  const cursosDisponibles = useMemo(() => {
    const set = new Set<string>();
    estudiantes
      .filter((e) => !filtros.nivel || e.nivel === filtros.nivel)
      .forEach((e) => { if (e.curso) set.add(e.curso); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [estudiantes, filtros.nivel]);

  function actualizarFiltro<K extends keyof Filtros>(key: K, value: string) {
    setFiltros((f) => {
      const next = { ...f, [key]: value };
      if (key === "nivel" && f.curso && value !== f.nivel) next.curso = "";
      return next;
    });
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setBusqueda("");
  }

  const filtrosActivos = useMemo(() => {
    const chips: { key: keyof Filtros; label: string }[] = [];
    if (filtros.anio) chips.push({ key: "anio", label: filtros.anio });
    if (filtros.nivel) chips.push({ key: "nivel", label: filtros.nivel });
    if (filtros.curso) chips.push({ key: "curso", label: filtros.curso });
    if (filtros.especialidadId) chips.push({ key: "especialidadId", label: especialidadNombre(filtros.especialidadId) });
    if (filtros.estado) chips.push({ key: "estado", label: filtros.estado.charAt(0).toUpperCase() + filtros.estado.slice(1) });
    if (filtros.dual) chips.push({ key: "dual", label: filtros.dual === "si" ? "En formación dual" : "Sin formación dual" });
    if (filtros.liceoId) chips.push({ key: "liceoId", label: liceoNombrePorId[filtros.liceoId] || "Liceo" });
    return chips;
  }, [filtros, especialidades, liceoNombrePorId]);

  const filtrados = useMemo(() => {
    let base = estudiantes;
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      const qAlfanum = soloAlfanumerico(busqueda);
      base = base.filter((e) => {
        const campos = [e.nombres, e.apellidos, e.apellidoPaterno, e.apellidoMaterno, e.curso, especialidadNombre(e.especialidadId)];
        const coincideTexto = campos.some((c) => normalizar(c).includes(q));
        const coincideRun = soloAlfanumerico(e.run).includes(qAlfanum) && qAlfanum.length > 0;
        return coincideTexto || coincideRun;
      });
    }
    if (filtros.anio) base = base.filter((e) => anioDe(e) === filtros.anio);
    if (filtros.nivel) base = base.filter((e) => e.nivel === filtros.nivel);
    if (filtros.curso) base = base.filter((e) => e.curso === filtros.curso);
    if (filtros.especialidadId) base = base.filter((e) => e.especialidadId === filtros.especialidadId);
    if (filtros.estado) base = base.filter((e) => e.estado === filtros.estado);
    if (filtros.dual) base = base.filter((e) => (filtros.dual === "si") === Boolean(e.centroDualId));
    if (filtros.liceoId) base = base.filter((e) => e.liceoId === filtros.liceoId);
    return base;
  }, [estudiantes, busqueda, filtros, especialidades]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    switch (orden) {
      case "nombre-asc":
        arr.sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`));
        break;
      case "nombre-desc":
        arr.sort((a, b) => `${b.nombres} ${b.apellidos}`.localeCompare(`${a.nombres} ${a.apellidos}`));
        break;
      case "recientes":
        arr.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
        break;
      case "antiguos":
        arr.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
        break;
      case "curso":
        arr.sort((a, b) => a.curso.localeCompare(b.curso));
        break;
      case "especialidad":
        arr.sort((a, b) => especialidadNombre(a.especialidadId).localeCompare(especialidadNombre(b.especialidadId)));
        break;
    }
    return arr;
  }, [filtrados, orden, especialidades]);

  useEffect(() => { setPagina(1); }, [busqueda, filtros, orden]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const paginaEstudiantes = ordenados.slice(inicio, inicio + PAGE_SIZE);

  const stats = useMemo(() => {
    const anioActual = new Date().getFullYear();
    return {
      total: estudiantes.length,
      activos: estudiantes.filter((e) => e.estado === "activo").length,
      agregadosEsteAnio: estudiantes.filter((e) => new Date(e.creadoEn).getFullYear() === anioActual).length,
      enFormacionDual: estudiantes.filter((e) => Boolean(e.centroDualId)).length,
    };
  }, [estudiantes]);

  const { porVencer, vencidosPendientes } = useMemo(() => {
    const ahora = Date.now();
    const porVencerList: Estudiante[] = [];
    const vencidosList: Estudiante[] = [];
    estudiantes.forEach((e) => {
      const fecha = new Date(e.creadoEn);
      if (Number.isNaN(fecha.getTime())) return;
      const fechaLimite = new Date(fecha);
      fechaLimite.setFullYear(fechaLimite.getFullYear() + RETENCION_ANIOS);
      const diasRestantes = Math.ceil((fechaLimite.getTime() - ahora) / 86400000);
      if (diasRestantes <= 0) vencidosList.push(e);
      else if (diasRestantes <= AVISO_DIAS_ANTES) porVencerList.push(e);
    });
    return { porVencer: porVencerList, vencidosPendientes: vencidosList };
  }, [estudiantes]);

  const pendientesPromocion = useMemo(() => {
    const anioActual = new Date().getFullYear();
    return estudiantes.filter((e) => {
      if (e.estado !== "activo") return false;
      const anio = Number(e.anioAcademico);
      return !Number.isNaN(anio) && anio < anioActual;
    }).length;
  }, [estudiantes]);

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <EncabezadoListado
        icon={<ClipboardList size={28} />}
        titulo="Listado de estudiantes"
        descripcion={
          modoGlobal
            ? "Estudiantes de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : usuario?.rol === "profesor"
              ? "Estudiantes que tienes asignados como profesor supervisor."
              : "Consulta y revisa los estudiantes registrados en SIGEDUAL."
        }
        acciones={
          puedeAgregar && (
            <>
              <Link
                href="/dashboard/estudiantes/promocion"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:[border-color:var(--accent)] transition-colors relative"
              >
                <GraduationCap size={16} />
                Promoción de curso
                {pendientesPromocion > 0 && (
                  <span style={{ background: "var(--warning)", color: "#1a1300" }} className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center">
                    {pendientesPromocion}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/estudiantes/nuevo"
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <UserPlus size={16} />
                Agregar estudiante
              </Link>
            </>
          )
        }
      />

      {/* Avisos de retención de datos (5 años) */}
      {!loading && porVencer.length > 0 && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }} className="rounded-xl px-4 py-3 mb-3 flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--warning)" }} className="text-sm font-medium">
            {porVencer.length === 1
              ? "1 estudiante cumplirá 5 años registrado en los próximos 30 días"
              : `${porVencer.length} estudiantes cumplirán 5 años registrados en los próximos 30 días`}
            {" "}y se eliminarán automáticamente de SIGEDUAL según la política de retención de datos.
          </p>
        </div>
      )}
      {!loading && vencidosPendientes.length > 0 && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-3 flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: "var(--danger)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">
            {vencidosPendientes.length === 1
              ? "1 estudiante ya superó los 5 años de registro"
              : `${vencidosPendientes.length} estudiantes ya superaron los 5 años de registro`}
            {" "}y serán eliminados de SIGEDUAL en la próxima limpieza automática (diaria).
          </p>
        </div>
      )}

      {/* Estadísticas */}
      <TarjetasEstadisticas
        loading={loading}
        estadisticas={[
          { label: "Total de estudiantes", value: stats.total, icon: <Users2 size={18} />, color: "#2563eb" },
          { label: "Estudiantes activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Agregados este año", value: stats.agregadosEsteAnio, icon: <UserPlus size={18} />, color: "#f59e0b" },
          { label: "En formación dual", value: stats.enFormacionDual, icon: <Handshake size={18} />, color: "#06b6d4" },
        ]}
      />

      {/* Búsqueda + filtros + orden + vista */}
      <BarraControles
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholderBusqueda="Buscar estudiante por nombre, RUN o curso..."
        filtrosAbiertos={filtrosAbiertos}
        onToggleFiltros={() => setFiltrosAbiertos((v) => !v)}
        cantidadFiltrosActivos={filtrosActivos.length}
        orden={orden}
        onOrden={setOrden}
        opcionesOrden={ORDEN_OPCIONES}
        vista={vista}
        onVista={setVista}
      />

      {/* Panel de filtros */}
      {filtrosAbiertos && (
        <PanelFiltros>
          {modoGlobal && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Liceo</label>
              <Select value={filtros.liceoId} onChange={(v) => actualizarFiltro("liceoId", v)} ariaLabel="Liceo"
                opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]} />
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Año académico</label>
            <Select value={filtros.anio} onChange={(v) => actualizarFiltro("anio", v)} ariaLabel="Año académico"
              opciones={[{ value: "", label: "Todos los años" }, ...aniosDisponibles.map((a) => ({ value: a, label: a }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nivel</label>
            <Select value={filtros.nivel} onChange={(v) => actualizarFiltro("nivel", v)} ariaLabel="Nivel"
              opciones={[{ value: "", label: "Todos los niveles" }, ...nivelesDisponibles.map((n) => ({ value: n, label: n }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Curso</label>
            <Select value={filtros.curso} onChange={(v) => actualizarFiltro("curso", v)} disabled={cursosDisponibles.length === 0} ariaLabel="Curso"
              opciones={[
                { value: "", label: cursosDisponibles.length === 0 ? "Sin cursos registrados" : "Todos los cursos" },
                ...cursosDisponibles.map((c) => ({ value: c, label: c })),
              ]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
            <Select value={filtros.especialidadId} onChange={(v) => actualizarFiltro("especialidadId", v)} disabled={especialidades.length === 0} ariaLabel="Especialidad"
              opciones={[
                { value: "", label: especialidades.length === 0 ? "Sin especialidades" : "Todas las especialidades" },
                ...especialidades.map((esp) => ({ value: esp.id, label: esp.nombre })),
              ]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={filtros.estado} onChange={(v) => actualizarFiltro("estado", v)} ariaLabel="Estado"
              opciones={[{ value: "", label: "Todos los estados" }, ...ESTADOS.map((es) => ({ value: es, label: es.charAt(0).toUpperCase() + es.slice(1) }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Formación dual</label>
            <Select value={filtros.dual} onChange={(v) => actualizarFiltro("dual", v)} ariaLabel="Formación dual"
              opciones={[
                { value: "", label: "Todos" },
                { value: "si", label: "En formación dual" },
                { value: "no", label: "Sin formación dual" },
              ]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Empresa asignada</label>
            <Select disabled value="" onChange={() => {}} ariaLabel="Empresa asignada"
              opciones={[{ value: "", label: "Disponible próximamente" }]} />
          </div>
        </PanelFiltros>
      )}

      {/* Chips de filtros activos */}
      <ChipsFiltros
        busqueda={busqueda}
        onQuitarBusqueda={() => setBusqueda("")}
        chips={filtrosActivos.map((chip) => ({ key: chip.key, label: chip.label, onQuitar: () => actualizarFiltro(chip.key, "") }))}
        onLimpiarTodo={limpiarFiltros}
      />

      {/* Contenido */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : estudiantes.length === 0 ? (
        <EstadoVacio
          icon={<Users2 size={24} style={{ color: "var(--accent-light)" }} />}
          titulo="Aún no hay estudiantes registrados"
          descripcion="Comienza agregando el primer estudiante a SIGEDUAL."
          accion={puedeAgregar && (
            <Link href="/dashboard/estudiantes/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              <UserPlus size={16} />
              Agregar estudiante
            </Link>
          )}
        />
      ) : ordenados.length === 0 ? (
        <EstadoVacio
          icon={<Search size={22} style={{ color: "var(--text-muted)" }} />}
          titulo="No encontramos estudiantes"
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
            entidadSingular="estudiante"
            entidadPlural="estudiantes"
            rango={{ inicio: inicio + 1, fin: Math.min(inicio + PAGE_SIZE, ordenados.length) }}
          />

          {vista === "lista" ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
              {paginaEstudiantes.map((e, i) => (
                <div
                  key={e.id}
                  style={{ borderBottom: i < paginaEstudiantes.length - 1 ? "1px solid var(--border)" : "none" }}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4 hover:[background:var(--hover-overlay)] transition-colors"
                >
                  <div style={{ background: "var(--accent)22", borderRadius: "9999px" }} className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <span style={{ color: "var(--accent-light)" }} className="text-xs font-bold">{iniciales(e.nombres, e.apellidos)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{e.nombres} {e.apellidos}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{e.run} · {e.curso || "Sin curso"} · {especialidadNombre(e.especialidadId) || "Sin especialidad"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {modoGlobal && (
                      <span style={{ color: "var(--text-secondary)", background: "var(--bg-surface)" }} className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs">
                        <School size={11} /> {liceoNombrePorId[e.liceoId] || "—"}
                      </span>
                    )}
                    <span style={{ color: ESTADO_COLOR[e.estado], background: ESTADO_COLOR[e.estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium capitalize">
                      {e.estado}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }} className="text-xs hidden md:block w-12">{anioDe(e)}</span>
                    <Link
                      href={`/dashboard/estudiantes/${e.id}`}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--accent-light)" }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors flex-shrink-0"
                    >
                      <Eye size={13} />
                      Ver ficha
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginaEstudiantes.map((e) => (
                <div key={e.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div style={{ background: "var(--accent)22", borderRadius: "9999px" }} className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                      <span style={{ color: "var(--accent-light)" }} className="text-sm font-bold">{iniciales(e.nombres, e.apellidos)}</span>
                    </div>
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{e.nombres} {e.apellidos}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{e.run}</p>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1">
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs">{e.curso || "Sin curso"} · {anioDe(e)}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs">{especialidadNombre(e.especialidadId) || "Sin especialidad"}</p>
                    {modoGlobal && (
                      <p style={{ color: "var(--accent-light)" }} className="text-xs flex items-center gap-1 mt-0.5">
                        <School size={11} /> {liceoNombrePorId[e.liceoId] || "—"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ color: ESTADO_COLOR[e.estado], background: ESTADO_COLOR[e.estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium capitalize">
                      {e.estado}
                    </span>
                    <Link
                      href={`/dashboard/estudiantes/${e.id}`}
                      style={{ color: "var(--accent-light)" }}
                      className="flex items-center gap-1 text-xs font-semibold hover:underline"
                    >
                      <Eye size={13} />
                      Ver ficha
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          <PaginacionListado paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
