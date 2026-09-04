"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { formatearFecha } from "@/lib/fecha";
import {
  estadoCanonico, estudianteIdsDe, fechaProgramadaDe, horaProgramadaDe, profesorSupervisorIdDe,
  ESTADO_VISITA_LABEL, ESTADO_VISITA_COLOR,
} from "@/lib/visitas/normalizar";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { CentroDual, Especialidad, Estudiante, MaestroGuia, Usuario, Visita } from "@/types";
import { AlertCircle, CalendarClock, CalendarCheck, CheckCircle2, MapPin, School, Search, SlidersHorizontal, X } from "lucide-react";

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VisitasPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const ambitoProfesor = useAmbitoProfesor();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const esProfesor = usuario?.rol === "profesor";
  const esCentroDual = usuario?.rol === "centro_dual";
  const cargandoAmbito = (esProfesor && ambitoProfesor.cargando) || (esCentroDual && ambitoMaestroGuia.cargando);

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [maestrosGuia, setMaestrosGuia] = useState<MaestroGuia[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEstudianteId, setFiltroEstudianteId] = useState("");
  const [filtroCentroId, setFiltroCentroId] = useState("");
  const [filtroMaestroGuiaId, setFiltroMaestroGuiaId] = useState("");
  const [filtroProfesorId, setFiltroProfesorId] = useState("");
  const [filtroEspecialidadId, setFiltroEspecialidadId] = useState("");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const puedeAgregar = ["administrador", "coordinador", "director", "profesor"].includes(usuario?.rol ?? "");

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    setError(false);
    try {
      if (esProfesor) {
        const idsEst = ambitoProfesor.idsEstudiantes;
        const lotes: string[][] = [];
        for (let i = 0; i < idsEst.length; i += 30) lotes.push(idsEst.slice(i, i + 30));
        const [propias, supervisadas, ...snapsDeEstudiantes] = await Promise.all([
          getDocs(query(collection(db, "visitas"), where("profesorId", "==", usuario.uid))),
          getDocs(query(collection(db, "visitas"), where("profesorSupervisorId", "==", usuario.uid))),
          ...lotes.map((lote) => getDocs(query(collection(db, "visitas"), where("estudianteId", "in", lote)))),
          ...lotes.map((lote) => getDocs(query(collection(db, "visitas"), where("estudianteIds", "array-contains-any", lote)))),
        ]);
        const porId = new Map<string, Visita>();
        propias.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() } as Visita));
        supervisadas.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() } as Visita));
        snapsDeEstudiantes.forEach((snap) => snap.docs.forEach((d) => porId.set(d.id, { id: d.id, ...d.data() } as Visita)));
        const [centrosData, estudiantesData, mgData] = await Promise.all([
          obtenerDocumentosPorId<CentroDual>("centros_duales", ambitoProfesor.idsCentros),
          obtenerDocumentosPorId<Estudiante>("estudiantes", ambitoProfesor.idsEstudiantes),
          obtenerDocumentosPorId<MaestroGuia>("maestros_guia", ambitoProfesor.idsMaestros),
        ]);
        setVisitas(Array.from(porId.values()));
        setCentros(centrosData);
        setEstudiantes(estudiantesData);
        setMaestrosGuia(mgData);
        setLoading(false);
        return;
      }
      if (esCentroDual) {
        const [snapVisitas, snapCentro, estudiantesData, mgData] = await Promise.all([
          getDocs(query(collection(db, "visitas"), where("centroDualId", "==", usuario.centroDualId ?? ""))),
          usuario.centroDualId ? obtenerDocumentosPorId<CentroDual>("centros_duales", [usuario.centroDualId]) : Promise.resolve([]),
          obtenerDocumentosPorId<Estudiante>("estudiantes", ambitoMaestroGuia.idsEstudiantes),
          usuario.maestroGuiaId ? obtenerDocumentosPorId<MaestroGuia>("maestros_guia", [usuario.maestroGuiaId]) : Promise.resolve([]),
        ]);
        setVisitas(snapVisitas.docs.map((d) => ({ id: d.id, ...d.data() } as Visita)));
        setCentros(snapCentro);
        setEstudiantes(estudiantesData);
        setMaestrosGuia(mgData);
        setLoading(false);
        return;
      }
      const qVisitas = modoGlobal ? collection(db, "visitas") : query(collection(db, "visitas"), where("liceoId", "==", usuario.liceoId));
      const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
      const qEstudiantes = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
      const qMg = modoGlobal ? collection(db, "maestros_guia") : query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId));
      const qProf = modoGlobal
        ? query(collection(db, "usuarios"), where("rol", "==", "profesor"))
        : query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId), where("rol", "==", "profesor"));
      const qEsp = modoGlobal ? collection(db, "especialidades") : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
      const [snapVisitas, snapCentros, snapEst, snapMg, snapProf, snapEsp] = await Promise.all([
        getDocs(qVisitas), getDocs(qCentros), getDocs(qEstudiantes), getDocs(qMg), getDocs(qProf), getDocs(qEsp),
      ]);
      setVisitas(snapVisitas.docs.map((d) => ({ id: d.id, ...d.data() } as Visita)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setMaestrosGuia(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setProfesores(snapProf.docs.map((d) => d.data() as Usuario));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    } catch (err) {
      console.error("Error al cargar visitas:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!usuario) return;
    if (cargandoAmbito) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, cargandoAmbito, ambitoProfesor.idsEstudiantes, ambitoProfesor.idsCentros, ambitoMaestroGuia.idsEstudiantes]);

  function centroNombre(id: string): string {
    return centros.find((c) => c.id === id)?.nombre || "Centro no encontrado";
  }
  function nombresEstudiantes(v: Visita): string {
    return estudianteIdsDe(v)
      .map((id) => estudiantes.find((e) => e.id === id))
      .filter((e): e is Estudiante => Boolean(e))
      .map((e) => `${e.nombres} ${e.apellidos}`)
      .join(", ");
  }
  function profesorNombre(id: string): string {
    if (esProfesor && id === usuario?.uid) return usuario.nombre;
    return profesores.find((p) => p.uid === id)?.nombre || "—";
  }
  function vistaPrevia(v: Visita): string {
    const primeraPregunta = v.preguntas?.find((p) => p.respuesta?.trim());
    if (primeraPregunta) return `${primeraPregunta.texto.slice(0, 50)}${primeraPregunta.texto.length > 50 ? "…" : ""}: ${primeraPregunta.respuesta}`;
    return v.observacionesGenerales || v.observaciones || "";
  }

  const hoy = hoyISO();
  const visitasProximas = useMemo(() => visitas.filter((v) => estadoCanonico(v.estado) === "agendada" && fechaProgramadaDe(v) >= hoy), [visitas, hoy]);
  const visitasPendientes = useMemo(() => {
    const estados = new Set(["en_proceso", "pendiente_de_finalizar"]);
    return visitas.filter((v) => estados.has(estadoCanonico(v.estado)));
  }, [visitas]);
  const visitasFinalizadas = useMemo(() => visitas.filter((v) => estadoCanonico(v.estado) === "finalizada"), [visitas]);

  const filtradas = useMemo(() => {
    let base = visitas;
    if (filtroLiceoId) base = base.filter((v) => v.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((v) => estadoCanonico(v.estado) === filtroEstado);
    if (filtroEstudianteId) base = base.filter((v) => estudianteIdsDe(v).includes(filtroEstudianteId));
    if (filtroCentroId) base = base.filter((v) => v.centroDualId === filtroCentroId);
    if (filtroMaestroGuiaId) base = base.filter((v) => v.maestroGuiaId === filtroMaestroGuiaId);
    if (filtroProfesorId) base = base.filter((v) => profesorSupervisorIdDe(v) === filtroProfesorId);
    if (filtroEspecialidadId) base = base.filter((v) => estudianteIdsDe(v).some((id) => estudiantes.find((e) => e.id === id)?.especialidadId === filtroEspecialidadId));
    if (filtroCurso.trim()) {
      const c = normalizar(filtroCurso);
      base = base.filter((v) => estudianteIdsDe(v).some((id) => normalizar(estudiantes.find((e) => e.id === id)?.curso).includes(c)));
    }
    if (filtroDesde) base = base.filter((v) => fechaProgramadaDe(v) >= filtroDesde);
    if (filtroHasta) base = base.filter((v) => fechaProgramadaDe(v) <= filtroHasta);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((v) =>
        normalizar(centroNombre(v.centroDualId)).includes(q) ||
        normalizar(nombresEstudiantes(v)).includes(q) ||
        normalizar(v.observacionesGenerales ?? v.observaciones).includes(q)
      );
    }
    return [...base].sort((a, b) => {
      const fa = fechaProgramadaDe(a); const fb = fechaProgramadaDe(b);
      return fa < fb ? 1 : fa > fb ? -1 : 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitas, filtroEstado, filtroLiceoId, filtroEstudianteId, filtroCentroId, filtroMaestroGuiaId, filtroProfesorId, filtroEspecialidadId, filtroCurso, filtroDesde, filtroHasta, busqueda, centros, estudiantes]);

  const hayFiltrosActivos = Boolean(
    busqueda.trim() || filtroEstado || filtroLiceoId || filtroEstudianteId || filtroCentroId
    || filtroMaestroGuiaId || filtroProfesorId || filtroEspecialidadId || filtroCurso.trim() || filtroDesde || filtroHasta
  );
  const cantidadFiltrosActivos = [
    filtroEstado, filtroLiceoId, filtroEstudianteId, filtroCentroId, filtroMaestroGuiaId,
    filtroProfesorId, filtroEspecialidadId, filtroCurso.trim(), filtroDesde, filtroHasta,
  ].filter(Boolean).length;

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroLiceoId(""); setFiltroEstudianteId(""); setFiltroCentroId("");
    setFiltroMaestroGuiaId(""); setFiltroProfesorId(""); setFiltroEspecialidadId(""); setFiltroCurso("");
    setFiltroDesde(""); setFiltroHasta("");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<MapPin size={28} />}>Visitas</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {esCentroDual
              ? "Visitas realizadas a tu Centro Dual."
              : modoGlobal
                ? "Visitas de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
                : "Agenda visitas a los centros duales y registra lo ocurrido durante ellas."}
          </p>
        </div>
        {puedeAgregar && (
          <Link href="/dashboard/visitas/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
            Agendar visita
          </Link>
        )}
      </div>

      {!loading && !error && visitas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button onClick={() => { limpiarFiltros(); setFiltroEstado("agendada"); }} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 text-left hover:[border-color:var(--accent)] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={16} style={{ color: "var(--accent-light)" }} />
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-medium">Próximas visitas</p>
            </div>
            <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">{visitasProximas.length}</p>
          </button>
          <button onClick={() => { limpiarFiltros(); setFiltroEstado("en_proceso"); }} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 text-left hover:[border-color:var(--accent)] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={16} style={{ color: "var(--warning)" }} />
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-medium">Pendientes de completar</p>
            </div>
            <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">{visitasPendientes.length}</p>
          </button>
          <button onClick={() => { limpiarFiltros(); setFiltroEstado("finalizada"); }} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 text-left hover:[border-color:var(--accent)] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-medium">Visitas realizadas</p>
            </div>
            <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">{visitasFinalizadas.length}</p>
          </button>
        </div>
      )}

      <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wide mb-2">Visitas registradas</p>

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
              opciones={[{ value: "", label: "Todos" }, ...Object.entries(ESTADO_VISITA_LABEL).map(([value, label]) => ({ value, label }))]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estudiante</label>
            <Select value={filtroEstudianteId} onChange={setFiltroEstudianteId} ariaLabel="Estudiante"
              opciones={[{ value: "", label: "Todos" }, ...estudiantes.map((e) => ({ value: e.id, label: `${e.nombres} ${e.apellidos}` }))]} />
          </div>
          {!esCentroDual && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centro Dual</label>
              <Select value={filtroCentroId} onChange={setFiltroCentroId} ariaLabel="Centro Dual"
                opciones={[{ value: "", label: "Todos" }, ...centros.map((c) => ({ value: c.id, label: c.nombre }))]} />
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Maestro Guía</label>
            <Select value={filtroMaestroGuiaId} onChange={setFiltroMaestroGuiaId} ariaLabel="Maestro Guía"
              opciones={[{ value: "", label: "Todos" }, ...maestrosGuia.map((m) => ({ value: m.id, label: `${m.nombres} ${m.apellidoPaterno}` }))]} />
          </div>
          {!esProfesor && !esCentroDual && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Profesor Supervisor</label>
              <Select value={filtroProfesorId} onChange={setFiltroProfesorId} ariaLabel="Profesor Supervisor"
                opciones={[{ value: "", label: "Todos" }, ...profesores.map((p) => ({ value: p.uid, label: p.nombre }))]} />
            </div>
          )}
          {especialidades.length > 0 && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
              <Select value={filtroEspecialidadId} onChange={setFiltroEspecialidadId} ariaLabel="Especialidad"
                opciones={[{ value: "", label: "Todas" }, ...especialidades.map((e) => ({ value: e.id, label: e.nombre }))]} />
            </div>
          )}
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Curso / nivel</label>
            <input value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Desde</label>
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Hasta</label>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
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
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">
            {esCentroDual ? "Todavía no se ha registrado ninguna visita a tu Centro Dual." : "Agenda una visita a un centro dual para comenzar a hacer seguimiento."}
          </p>
          {puedeAgregar && (
            <Link href="/dashboard/visitas/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Agendar visita
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map((v) => {
              const estado = estadoCanonico(v.estado);
              const fecha = fechaProgramadaDe(v);
              const hora = horaProgramadaDe(v);
              const estudiantesTxt = nombresEstudiantes(v);
              const preview = vistaPrevia(v);
              return (
                <Link
                  key={v.id}
                  href={`/dashboard/visitas/${v.id}`}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  className="rounded-2xl p-4 flex flex-col gap-2 hover:[border-color:var(--accent)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold leading-snug line-clamp-2 flex-1">{centroNombre(v.centroDualId)}</p>
                    <span style={{ color: ESTADO_VISITA_COLOR[estado], background: `${ESTADO_VISITA_COLOR[estado]}22` }} className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0">
                      {ESTADO_VISITA_LABEL[estado]}
                    </span>
                  </div>
                  {estudiantesTxt && <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">{estudiantesTxt}</p>}
                  <p style={{ color: "var(--text-muted)" }} className="text-xs">
                    {formatearFecha(fecha)}{hora ? ` · ${hora}` : ""}
                  </p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs">
                    Profesor Supervisor: {profesorNombre(profesorSupervisorIdDe(v))}
                  </p>
                  {preview && (
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs line-clamp-2 mt-1">{preview}</p>
                  )}
                  {modoGlobal && (
                    <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-1">
                      <School size={11} /> {liceoNombrePorId[v.liceoId] || "—"}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
