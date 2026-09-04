"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useVistaListado } from "@/lib/preferencias/useVistaListado";
import EncabezadoListado from "@/components/listado/EncabezadoListado";
import TarjetasEstadisticas from "@/components/listado/TarjetasEstadisticas";
import BarraControles from "@/components/listado/BarraControles";
import PanelFiltros from "@/components/listado/PanelFiltros";
import ChipsFiltros from "@/components/listado/ChipsFiltros";
import EstadoVacio from "@/components/listado/EstadoVacio";
import ContadorResultados from "@/components/listado/ContadorResultados";
import Select from "@/components/ui/Select";
import type { CentroDual, Especialidad, Estudiante } from "@/types";
import {
  GraduationCap, School, Search, Trash2,
  BadgeCheck, Users2, Building2,
} from "lucide-react";

const ESTADO_LABEL: Record<string, string> = { activa: "Activa", inactiva: "Inactiva" };
const ESTADO_COLOR: Record<string, string> = { activa: "var(--success)", inactiva: "var(--text-muted)" };

const ORDEN_OPCIONES = [
  { value: "nombre-asc", label: "Nombre A-Z" },
  { value: "nombre-desc", label: "Nombre Z-A" },
  { value: "recomendado", label: "Activas primero" },
  { value: "inactivas", label: "Inactivas primero" },
  { value: "recientes", label: "Más recientes" },
  { value: "antiguas", label: "Más antiguas" },
  { value: "mas-estudiantes", label: "Mayor cantidad de estudiantes" },
  { value: "menos-estudiantes", label: "Menor cantidad de estudiantes" },
];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function estadoDe(esp: Especialidad): "activa" | "inactiva" {
  return esp.estado ?? "activa";
}

export default function EspecialidadesPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroLiceoId, setFiltroLiceoId] = useState("");
  const [filtroCentros, setFiltroCentros] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("recomendado");
  const [vista, setVista] = useVistaListado("especialidades");

  const puedeEditar = usuario?.rol === "administrador" && !modoGlobal;

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const qEsp = modoGlobal ? collection(db, "especialidades") : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
    const qEst = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
    const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
    const [snapEsp, snapEst, snapCentros] = await Promise.all([getDocs(qEsp), getDocs(qEst), getDocs(qCentros)]);
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
    setLoading(false);
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario, modoGlobal]); // eslint-disable-line react-hooks/exhaustive-deps

  function estudiantesDe(espId: string): number {
    return estudiantes.filter((e) => e.especialidadId === espId).length;
  }
  function centrosDe(espId: string): number {
    return centros.filter((c) => (c.especialidades ?? []).includes(espId)).length;
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta especialidad?")) return;
    await deleteDoc(doc(db, "especialidades", id));
    cargar();
  }

  const filtrados = useMemo(() => {
    let base = especialidades;
    if (filtroLiceoId) base = base.filter((e) => e.liceoId === filtroLiceoId);
    if (filtroEstado) base = base.filter((e) => estadoDe(e) === filtroEstado);
    if (filtroCentros) {
      base = base.filter((e) => (filtroCentros === "con" ? centrosDe(e.id) > 0 : centrosDe(e.id) === 0));
    }
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((e) => normalizar(e.nombre).includes(q));
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidades, filtroLiceoId, filtroEstado, filtroCentros, busqueda, centros]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    switch (orden) {
      case "nombre-asc":
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case "nombre-desc":
        arr.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
      case "inactivas":
        arr.sort((a, b) => {
          const inactivaA = estadoDe(a) === "inactiva" ? 0 : 1;
          const inactivaB = estadoDe(b) === "inactiva" ? 0 : 1;
          return inactivaA - inactivaB || a.nombre.localeCompare(b.nombre);
        });
        break;
      case "recientes":
        arr.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
        break;
      case "antiguas":
        arr.sort((a, b) => (a.creadoEn ?? "").localeCompare(b.creadoEn ?? ""));
        break;
      case "mas-estudiantes":
        arr.sort((a, b) => estudiantesDe(b.id) - estudiantesDe(a.id));
        break;
      case "menos-estudiantes":
        arr.sort((a, b) => estudiantesDe(a.id) - estudiantesDe(b.id));
        break;
      default:
        arr.sort((a, b) => {
          const activaA = estadoDe(a) === "activa" ? 0 : 1;
          const activaB = estadoDe(b) === "activa" ? 0 : 1;
          return activaA - activaB || a.nombre.localeCompare(b.nombre);
        });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, orden, estudiantes]);

  const cantidadFiltrosActivos = [filtroEstado, filtroLiceoId, filtroCentros].filter(Boolean).length;

  const filtrosActivosChips = useMemo(() => {
    const chips: { key: string; label: string; onQuitar: () => void }[] = [];
    if (filtroLiceoId) chips.push({ key: "liceo", label: liceoNombrePorId[filtroLiceoId] || "Liceo", onQuitar: () => setFiltroLiceoId("") });
    if (filtroEstado) chips.push({ key: "estado", label: ESTADO_LABEL[filtroEstado] || filtroEstado, onQuitar: () => setFiltroEstado("") });
    if (filtroCentros) chips.push({ key: "centros", label: filtroCentros === "con" ? "Con Centros Duales" : "Sin Centros Duales", onQuitar: () => setFiltroCentros("") });
    return chips;
  }, [filtroLiceoId, filtroEstado, filtroCentros, liceoNombrePorId]);

  function limpiarFiltros() {
    setBusqueda(""); setFiltroEstado(""); setFiltroLiceoId(""); setFiltroCentros("");
  }

  const stats = useMemo(() => {
    let conCentros = 0;
    let totalEstudiantes = 0;
    especialidades.forEach((e) => {
      if (centrosDe(e.id) > 0) conCentros += 1;
      totalEstudiantes += estudiantesDe(e.id);
    });
    return {
      total: especialidades.length,
      activas: especialidades.filter((e) => estadoDe(e) === "activa").length,
      estudiantes: totalEstudiantes,
      conCentros,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidades, estudiantes, centros]);

  if (!["administrador", "coordinador", "director"].includes(usuario?.rol ?? "")) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <EncabezadoListado
        icon={<GraduationCap size={28} />}
        titulo="Especialidades"
        descripcion={
          modoGlobal
            ? "Especialidades de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : "Gestiona las especialidades disponibles en el establecimiento."
        }
        acciones={
          puedeEditar && (
            <Link href="/dashboard/especialidades/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
              + Agregar especialidad
            </Link>
          )
        }
      />

      <TarjetasEstadisticas
        loading={loading}
        estadisticas={[
          { label: "Total de especialidades", value: stats.total, icon: <GraduationCap size={18} />, color: "#2563eb" },
          { label: "Especialidades activas", value: stats.activas, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Estudiantes asociados", value: stats.estudiantes, icon: <Users2 size={18} />, color: "#f59e0b" },
          { label: "Con Centros Duales asociados", value: stats.conCentros, icon: <Building2 size={18} />, color: "#06b6d4" },
        ]}
      />

      <BarraControles
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholderBusqueda="Buscar especialidad por nombre..."
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
              opciones={[{ value: "", label: "Todos" }, { value: "activa", label: "Activas" }, { value: "inactiva", label: "Inactivas" }]} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centros Duales</label>
            <Select value={filtroCentros} onChange={setFiltroCentros} ariaLabel="Centros Duales"
              opciones={[{ value: "", label: "Todas" }, { value: "con", label: "Con Centros Duales asociados" }, { value: "sin", label: "Sin Centros Duales asociados" }]} />
          </div>
        </PanelFiltros>
      )}

      <ChipsFiltros
        busqueda={busqueda}
        onQuitarBusqueda={() => setBusqueda("")}
        chips={filtrosActivosChips}
        onLimpiarTodo={limpiarFiltros}
      />

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : especialidades.length === 0 ? (
        <EstadoVacio
          icon={<GraduationCap size={24} style={{ color: "var(--accent-light)" }} />}
          titulo="No hay especialidades registradas"
          descripcion="Agrega la primera especialidad para comenzar a asociarla a estudiantes y Centros Duales."
          accion={puedeEditar && (
            <Link href="/dashboard/especialidades/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar especialidad
            </Link>
          )}
        />
      ) : ordenados.length === 0 ? (
        <EstadoVacio
          icon={<Search size={22} style={{ color: "var(--text-muted)" }} />}
          titulo="No encontramos especialidades"
          descripcion="Prueba modificando la búsqueda o eliminando algunos filtros."
          accion={
            <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <>
          <ContadorResultados total={ordenados.length} entidadSingular="especialidad" entidadPlural="especialidades" />

          {vista === "lista" ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
              <div style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }} className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.4fr_0.6fr] gap-3 px-5 py-3 text-[11px] font-semibold tracking-wide uppercase">
                <span>Especialidad</span>
                <span>Estado</span>
                <span>Estudiantes</span>
                <span>Centros Duales</span>
                <span></span>
              </div>
              {ordenados.map((esp, i) => {
                const estado = estadoDe(esp);
                return (
                  <div
                    key={esp.id}
                    style={{ borderBottom: i < ordenados.length - 1 ? "1px solid var(--border)" : "none" }}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1.4fr_0.6fr] gap-2 md:gap-3 px-5 py-4 items-center hover:[background:var(--hover-overlay)] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">🎓</span>
                      <div className="min-w-0">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{esp.nombre}</p>
                        {modoGlobal && (
                          <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                            <School size={11} /> {liceoNombrePorId[esp.liceoId] || "—"}
                          </p>
                        )}
                      </div>
                    </div>
                    <span style={{ color: ESTADO_COLOR[estado], background: ESTADO_COLOR[estado] + "22" }} className="text-xs px-2 py-1 rounded-full text-center w-fit">
                      {ESTADO_LABEL[estado]}
                    </span>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs">{estudiantesDe(esp.id)} estudiante(s)</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs">{centrosDe(esp.id)} centro(s) dual(es)</p>
                    {puedeEditar ? (
                      <button onClick={() => eliminar(esp.id)} style={{ color: "var(--danger)" }} className="flex items-center gap-1 text-xs font-medium hover:underline justify-self-end">
                        <Trash2 size={13} /> Eliminar
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ordenados.map((esp) => {
                const estado = estadoDe(esp);
                return (
                  <div key={esp.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">🎓</span>
                        <div className="min-w-0">
                          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{esp.nombre}</p>
                          {modoGlobal && (
                            <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5 truncate">
                              <School size={11} /> {liceoNombrePorId[esp.liceoId] || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      <span style={{ color: ESTADO_COLOR[estado], background: ESTADO_COLOR[estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0">
                        {ESTADO_LABEL[estado]}
                      </span>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1">
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">Estudiantes: {estudiantesDe(esp.id)}</p>
                      <p style={{ color: "var(--text-secondary)" }} className="text-xs">Centros Duales: {centrosDe(esp.id)}</p>
                    </div>
                    {puedeEditar && (
                      <button onClick={() => eliminar(esp.id)} style={{ color: "var(--danger)" }} className="flex items-center gap-1 text-xs font-medium mt-1">
                        <Trash2 size={13} /> Eliminar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
