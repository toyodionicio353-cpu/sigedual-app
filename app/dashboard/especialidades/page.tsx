"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import { GraduationCap, School } from "lucide-react";
import type { Especialidad } from "@/types";

export default function EspecialidadesPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [filtroLiceoId, setFiltroLiceoId] = useState("");

  const puedeEditar = usuario?.rol === "administrador";

  useEffect(() => { if (usuario) cargar(); }, [usuario, modoGlobal]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = modoGlobal
      ? collection(db, "especialidades")
      : query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
    const snap = await getDocs(q);
    setEspecialidades(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setLoading(false);
  }

  const especialidadesFiltradas = useMemo(
    () => (filtroLiceoId ? especialidades.filter((e) => e.liceoId === filtroLiceoId) : especialidades),
    [especialidades, filtroLiceoId]
  );

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !usuario) return;
    setGuardando(true);
    await addDoc(collection(db, "especialidades"), { nombre: nombre.trim(), liceoId: usuario.liceoId });
    setNombre(""); cargar();
    setGuardando(false);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta especialidad?")) return;
    await deleteDoc(doc(db, "especialidades", id));
    cargar();
  }

  if (!["administrador", "coordinador", "director"].includes(usuario?.rol ?? "")) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <TituloPagina icon={<GraduationCap size={28} />}>Especialidades</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          {modoGlobal
            ? "Especialidades de todos los liceos. Usa el filtro \"Liceo\" para acotar a uno en particular."
            : "Carreras técnico-profesionales del establecimiento"}
        </p>
      </div>

      {modoGlobal && (
        <div className="mb-4 max-w-xs">
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Liceo</label>
          <Select value={filtroLiceoId} onChange={setFiltroLiceoId} ariaLabel="Liceo"
            opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]} />
        </div>
      )}

      {puedeEditar && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) conConfirmacion(() => agregar(e)); }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la especialidad (ej: Contabilidad)"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          <button type="submit" disabled={guardando || !nombre.trim()} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 sm:w-auto w-full">
            {guardando ? "Agregando..." : "Agregar"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : especialidadesFiltradas.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay especialidades registradas aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {especialidadesFiltradas.map((esp) => (
            <div key={esp.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎓</span>
                <div>
                  <p style={{ color: "var(--text-primary)" }} className="font-medium text-sm">{esp.nombre}</p>
                  {modoGlobal && (
                    <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5">
                      <School size={11} /> {liceoNombrePorId[esp.liceoId] || "—"}
                    </p>
                  )}
                </div>
              </div>
              {puedeEditar && (
                <button onClick={() => eliminar(esp.id)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
              )}
            </div>
          ))}
        </div>
      )}

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una especialidad" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
