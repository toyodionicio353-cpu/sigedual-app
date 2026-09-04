"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estudiantesAsignadosDe, especialidadesEnUso } from "@/lib/profesores";
import TituloPagina from "@/components/TituloPagina";
import type { Asignacion, Usuario } from "@/types";
import {
  Search, SlidersHorizontal, X, ChevronRight, ChevronLeft, MoreVertical,
  Eye, Pencil, Users, ClipboardCheck, MapPin, Power, ClipboardList,
} from "lucide-react";

const PAGE_SIZE = 20;

const ESTADO_LABEL: Record<string, string> = { activo: "Activo", inactivo: "Inactivo" };
const ESTADO_COLOR: Record<string, string> = { activo: "var(--success)", inactivo: "var(--text-muted)" };

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function ProfesoresPage() {
  const { usuario } = useAuth();
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [actualizandoUid, setActualizandoUid] = useState<string | null>(null);

  const tieneAccesoGlobal = usuario?.rol === "administrador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const puedeGestionar = usuario?.rol === "administrador";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const [snapProf, snapAsig] = await Promise.all([
      getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId), where("rol", "==", "profesor"))),
      getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))),
    ]);
    setProfesores(snapProf.docs.map((d) => d.data() as Usuario));
    setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    setLoading(false);
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  const especialidadesDisponibles = useMemo(() => especialidadesEnUso(profesores), [profesores]);

  const filtrados = useMemo(() => {
    let base = profesores;
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
    return [...base].sort((a, b) => {
      const activoA = a.activo ? 0 : 1;
      const activoB = b.activo ? 0 : 1;
      return activoA - activoB || a.nombre.localeCompare(b.nombre);
    });
  }, [profesores, filtroEstado, filtroEspecialidad, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * PAGE_SIZE;
  const paginaProfesores = filtrados.slice(inicio, inicio + PAGE_SIZE);

  const hayFiltrosActivos = Boolean(busqueda.trim() || filtroEspecialidad || filtroEstado);
  const cantidadFiltrosActivos = [filtroEspecialidad, filtroEstado].filter(Boolean).length;

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEspecialidad(""); setFiltroEstado(""); setPagina(1);
  }

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<ClipboardList size={28} />}>Profesores Supervisores</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Gestiona y consulta los profesores supervisores registrados en SIGEDUAL.</p>
        </div>
        {puedeGestionar && (
          <Link href="/dashboard/profesores/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
            + Agregar profesor supervisor
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
            placeholder="Buscar por nombre, RUT, correo o especialidad..."
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
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad</label>
            <select value={filtroEspecialidad} onChange={(e) => { setFiltroEspecialidad(e.target.value); setPagina(1); }} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors">
              <option value="">Todas las especialidades</option>
              {especialidadesDisponibles.map((esp) => <option key={esp} value={esp}>{esp}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors">
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
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
      ) : profesores.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay profesores supervisores registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Registra al primer profesor supervisor para comenzar a asignarles estudiantes.</p>
          {puedeGestionar && (
            <Link href="/dashboard/profesores/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar profesor supervisor
            </Link>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No se encontraron profesores supervisores</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">Prueba cambiando los filtros o realizando una nueva búsqueda.</p>
          <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">
            {hayFiltrosActivos
              ? `${filtrados.length} profesor(es) supervisor(es) encontrado(s)`
              : `${filtrados.length} profesor(es) supervisor(es)`}
          </p>

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

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <p style={{ color: "var(--text-muted)" }} className="text-xs sm:mr-3">
                Mostrando {inicio + 1}–{Math.min(inicio + PAGE_SIZE, filtrados.length)} de {filtrados.length} profesor(es)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagina((v) => Math.max(1, v - 1))}
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
                  onClick={() => setPagina((v) => Math.min(totalPaginas, v + 1))}
                  disabled={paginaSegura === totalPaginas}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  className="p-2 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
