"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import TituloPagina from "@/components/TituloPagina";
import type { Liceo, Especialidad } from "@/types";
import {
  Search, SlidersHorizontal, X, Plus, Eye, Pencil, Building2,
  BadgeCheck, CircleSlash, CalendarClock, MapPin, GraduationCap, Power, Trash2, School,
} from "lucide-react";
import { REGIONES } from "./_components/LiceoForm";
import Select from "@/components/ui/Select";

const RECIENTE_DIAS = 30;

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}


interface Filtros {
  estado: string;
  region: string;
  comuna: string;
  especialidades: string;
}

const FILTROS_VACIOS: Filtros = { estado: "", region: "", comuna: "", especialidades: "" };

export default function LiceosPage() {
  const { usuario } = useAuth();
  const [liceos, setLiceos] = useState<Liceo[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);
  const [confirmandoDesactivar, setConfirmandoDesactivar] = useState<Liceo | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<Liceo | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState("");

  const puedeGestionar = usuario?.rol === "administrador";

  useEffect(() => {
    if (usuario && puedeGestionar) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function cargar() {
    setLoading(true);
    const [snapLiceos, snapEsp] = await Promise.all([
      getDocs(collection(db, "liceos")),
      getDocs(collection(db, "especialidades")),
    ]);
    setLiceos(snapLiceos.docs.map((d) => ({ id: d.id, ...d.data() } as Liceo)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setLoading(false);
  }

  function especialidadesActivasDe(liceoId: string): number {
    return especialidades.filter((e) => e.liceoId === liceoId && e.estado !== "inactiva").length;
  }

  const regionesDisponibles = useMemo(() => {
    const set = new Set<string>();
    liceos.forEach((l) => { if (l.region) set.add(l.region); });
    return REGIONES.filter((r) => set.has(r));
  }, [liceos]);

  const comunasDisponibles = useMemo(() => {
    const set = new Set<string>();
    liceos
      .filter((l) => !filtros.region || l.region === filtros.region)
      .forEach((l) => { if (l.comuna) set.add(l.comuna); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [liceos, filtros.region]);

  function actualizarFiltro<K extends keyof Filtros>(key: K, value: string) {
    setFiltros((f) => {
      const next = { ...f, [key]: value };
      if (key === "region" && f.comuna && value !== f.region) next.comuna = "";
      return next;
    });
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setBusqueda("");
  }

  const filtrosActivos = useMemo(() => {
    const chips: { key: keyof Filtros; label: string }[] = [];
    if (filtros.estado) chips.push({ key: "estado", label: filtros.estado === "activo" ? "Activo" : "Inactivo" });
    if (filtros.region) chips.push({ key: "region", label: filtros.region });
    if (filtros.comuna) chips.push({ key: "comuna", label: filtros.comuna });
    if (filtros.especialidades) chips.push({ key: "especialidades", label: filtros.especialidades === "con" ? "Con especialidades" : "Sin especialidades" });
    return chips;
  }, [filtros]);

  const filtrados = useMemo(() => {
    let base = liceos;
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((l) => {
        const campos = [l.nombre, l.responsableNombre, l.dominioCorreo, l.comuna, l.ciudad];
        return campos.some((c) => normalizar(c).includes(q));
      });
    }
    if (filtros.estado) base = base.filter((l) => (l.estado ?? "activo") === filtros.estado);
    if (filtros.region) base = base.filter((l) => l.region === filtros.region);
    if (filtros.comuna) base = base.filter((l) => l.comuna === filtros.comuna);
    if (filtros.especialidades) {
      base = base.filter((l) => (filtros.especialidades === "con") === (especialidadesActivasDe(l.id) > 0));
    }
    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [liceos, busqueda, filtros, especialidades]);

  const stats = useMemo(() => {
    const limite = Date.now() - RECIENTE_DIAS * 86400000;
    return {
      total: liceos.length,
      activos: liceos.filter((l) => (l.estado ?? "activo") === "activo").length,
      inactivos: liceos.filter((l) => l.estado === "inactivo").length,
      recientes: liceos.filter((l) => l.creadoEn && new Date(l.creadoEn).getTime() >= limite).length,
    };
  }, [liceos]);

  const hayFiltrosActivos = filtrosActivos.length > 0 || busqueda.trim().length > 0;

  async function eliminarLiceo(liceo: Liceo) {
    setEliminando(liceo.id);
    setErrorEliminar("");
    try {
      const [snapEst, snapUsuarios] = await Promise.all([
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", liceo.id))),
        getDocs(query(collection(db, "usuarios"), where("liceoId", "==", liceo.id))),
      ]);
      if (snapEst.size > 0 || snapUsuarios.size > 0) {
        const nombresEst = snapEst.docs.map((d) => {
          const data = d.data() as { nombres?: string; apellidos?: string };
          return `${data.nombres ?? ""} ${data.apellidos ?? ""}`.trim() || "(sin nombre)";
        });
        const nombresUsr = snapUsuarios.docs.map((d) => {
          const data = d.data() as { nombre?: string; email?: string };
          return data.nombre || data.email || "(sin nombre)";
        });
        const detalle = [
          nombresEst.length > 0 ? `Estudiante(s): ${nombresEst.join(", ")}` : null,
          nombresUsr.length > 0 ? `Usuario(s): ${nombresUsr.join(", ")}` : null,
        ].filter(Boolean).join(". ");
        setErrorEliminar(
          `No se puede eliminar: tiene registros asociados. ${detalle}. Si alguno quedó asignado a este liceo por error, corrígelo en su ficha (Estudiantes/Usuarios) o elimínalo, y vuelve a intentar.`
        );
        setEliminando(null);
        return;
      }
      const snapEsp = await getDocs(query(collection(db, "especialidades"), where("liceoId", "==", liceo.id)));
      await Promise.all([
        deleteDoc(doc(db, "liceos", liceo.id)),
        ...snapEsp.docs.map((d) => deleteDoc(d.ref)),
      ]);
      setLiceos((prev) => prev.filter((l) => l.id !== liceo.id));
      setEspecialidades((prev) => prev.filter((e) => e.liceoId !== liceo.id));
      setConfirmandoEliminar(null);
    } finally {
      setEliminando(null);
    }
  }

  async function cambiarEstado(liceo: Liceo, nuevoEstado: "activo" | "inactivo") {
    setCambiandoEstado(liceo.id);
    try {
      await updateDoc(doc(db, "liceos", liceo.id), { estado: nuevoEstado, actualizadoEn: new Date().toISOString(), actualizadoPor: usuario?.uid });
      setLiceos((prev) => prev.map((l) => (l.id === liceo.id ? { ...l, estado: nuevoEstado } : l)));
    } finally {
      setCambiandoEstado(null);
      setConfirmandoDesactivar(null);
    }
  }

  if (usuario && !puedeGestionar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<School size={28} />}>Liceos</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Administra los establecimientos registrados en SIGEDUAL.</p>
        </div>
        <Link
          href="/dashboard/liceos/nuevo"
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={16} />
          Agregar liceo
        </Link>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Liceos registrados", value: stats.total, icon: <Building2 size={18} />, color: "#2563eb" },
          { label: "Liceos activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#22c55e" },
          { label: "Liceos inactivos", value: stats.inactivos, icon: <CircleSlash size={18} />, color: "#ef4444" },
          { label: "Agregados recientemente", value: stats.recientes, icon: <CalendarClock size={18} />, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
            <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center">
              <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold leading-tight">{loading ? "—" : s.value}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Búsqueda + filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar liceo por nombre, responsable o dominio..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <button
          onClick={() => setFiltrosAbiertos((v) => !v)}
          style={{
            background: filtrosAbiertos ? "var(--accent)" + "22" : "var(--bg-card)",
            border: `1px solid ${filtrosAbiertos ? "var(--accent)" : "var(--border-light)"}`,
            color: filtrosAbiertos ? "var(--accent-light)" : "var(--text-secondary)",
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {filtrosActivos.length > 0 && (
            <span style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center">
              {filtrosActivos.length}
            </span>
          )}
        </button>
      </div>

      {filtrosAbiertos && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 sm:p-5 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
              <Select value={filtros.estado} onChange={(v) => actualizarFiltro("estado", v)} ariaLabel="Estado"
                opciones={[{ value: "", label: "Todos" }, { value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }]} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Región</label>
              <Select value={filtros.region} onChange={(v) => actualizarFiltro("region", v)} ariaLabel="Región"
                opciones={[{ value: "", label: "Todas las regiones" }, ...regionesDisponibles.map((r) => ({ value: r, label: r }))]} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Comuna</label>
              <Select value={filtros.comuna} onChange={(v) => actualizarFiltro("comuna", v)} disabled={comunasDisponibles.length === 0} ariaLabel="Comuna"
                opciones={[
                  { value: "", label: comunasDisponibles.length === 0 ? "Sin comunas registradas" : "Todas las comunas" },
                  ...comunasDisponibles.map((c) => ({ value: c, label: c })),
                ]} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidades</label>
              <Select value={filtros.especialidades} onChange={(v) => actualizarFiltro("especialidades", v)} ariaLabel="Especialidades"
                opciones={[{ value: "", label: "Todos" }, { value: "con", label: "Con especialidades" }, { value: "sin", label: "Sin especialidades" }]} />
            </div>
          </div>
        </div>
      )}

      {hayFiltrosActivos && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {busqueda.trim() && (
            <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium">
              &quot;{busqueda.trim()}&quot;
              <button onClick={() => setBusqueda("")} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
            </span>
          )}
          {filtrosActivos.map((chip) => (
            <span key={chip.key} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium">
              {chip.label}
              <button onClick={() => actualizarFiltro(chip.key, "")} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
            </span>
          ))}
          <button onClick={limpiarFiltros} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}
      {!hayFiltrosActivos && <div className="mb-6" />}

      {/* Listado */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : liceos.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--accent)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} style={{ color: "var(--accent-light)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Aún no hay liceos registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Comienza registrando el primer establecimiento en SIGEDUAL.</p>
          <Link href="/dashboard/liceos/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Agregar liceo
          </Link>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos liceos</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Prueba modificando los términos de búsqueda o limpiando los filtros.</p>
          <button onClick={limpiarFiltros} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((liceo) => {
            const activo = (liceo.estado ?? "activo") === "activo";
            const cantidadEsp = especialidadesActivasDe(liceo.id);
            return (
              <div key={liceo.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div style={{ background: "var(--accent)22", borderRadius: 10 }} className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} style={{ color: "var(--accent-light)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold leading-snug">{liceo.nombre}</p>
                    {(liceo.comuna || liceo.ciudad) && (
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 flex items-center gap-1">
                        <MapPin size={11} />
                        {liceo.comuna}{liceo.ciudad ? `, ${liceo.ciudad}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    style={{ color: activo ? "var(--success)" : "var(--text-muted)", background: activo ? "var(--success)22" : "var(--bg-surface)" }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                  >
                    {activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1.5">
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Responsable: </span>{liceo.responsableNombre || "—"}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Dominio: </span>{liceo.dominioCorreo ? `@${liceo.dominioCorreo}` : "—"}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs flex items-center gap-1">
                    <GraduationCap size={12} style={{ color: "var(--text-muted)" }} />
                    {cantidadEsp} especialidad{cantidadEsp === 1 ? "" : "es"}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Link
                    href={`/dashboard/liceos/${liceo.id}`}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--accent-light)" }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
                  >
                    <Eye size={13} />
                    Ver
                  </Link>
                  <Link
                    href={`/dashboard/liceos/${liceo.id}/editar`}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
                  >
                    <Pencil size={13} />
                    Editar
                  </Link>
                  <button
                    onClick={() => (activo ? setConfirmandoDesactivar(liceo) : cambiarEstado(liceo, "activo"))}
                    disabled={cambiandoEstado === liceo.id}
                    title={activo ? "Desactivar liceo" : "Activar liceo"}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: activo ? "var(--danger)" : "var(--success)" }}
                    className="p-2 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => { setErrorEliminar(""); setConfirmandoEliminar(liceo); }}
                    disabled={eliminando === liceo.id}
                    title="Eliminar liceo"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--danger)" }}
                    className="p-2 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmandoDesactivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Desactivar este liceo?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              <strong style={{ color: "var(--text-primary)" }}>{confirmandoDesactivar.nombre}</strong> quedará marcado como inactivo. Sus datos no se eliminarán y podrás reactivarlo cuando quieras.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmandoDesactivar(null)}
                disabled={cambiandoEstado === confirmandoDesactivar.id}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => cambiarEstado(confirmandoDesactivar, "inactivo")}
                disabled={cambiandoEstado === confirmandoDesactivar.id}
                style={{ background: "var(--danger)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              >
                {cambiandoEstado === confirmandoDesactivar.id ? "Desactivando..." : "Desactivar liceo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Eliminar este liceo?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              <strong style={{ color: "var(--text-primary)" }}>{confirmandoEliminar.nombre}</strong> y sus especialidades se eliminarán permanentemente. Esta acción no se puede deshacer.
            </p>
            {errorEliminar && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-xs font-medium">{errorEliminar}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmandoEliminar(null); setErrorEliminar(""); }}
                disabled={eliminando === confirmandoEliminar.id}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarLiceo(confirmandoEliminar)}
                disabled={eliminando === confirmandoEliminar.id}
                style={{ background: "var(--danger)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              >
                {eliminando === confirmandoEliminar.id ? "Eliminando..." : "Eliminar liceo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
