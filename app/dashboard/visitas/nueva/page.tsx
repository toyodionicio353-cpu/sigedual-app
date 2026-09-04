"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { CentroDual, EstadoVisita, Estudiante } from "@/types";
import { MapPin } from "lucide-react";

export default function RegistrarVisitaPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [centroDualId, setCentroDualId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [estado, setEstado] = useState<EstadoVisita>("programada");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const puedeAgregar = ["administrador", "coordinador", "director", "profesor"].includes(usuario?.rol ?? "");

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargandoDatos(true);
      const [snapCentros, snapEst] = await Promise.all([
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setCargandoDatos(false);
    }
    cargar();
  }, [usuario]);

  const puedeGuardar = Boolean(centroDualId && fecha);

  async function registrar() {
    if (!usuario || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const nueva: Record<string, unknown> = {
        liceoId: usuario.liceoId,
        centroDualId,
        fecha,
        estado,
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      };
      if (estudianteId) nueva.estudianteId = estudianteId;
      if (hora.trim()) nueva.hora = hora.trim();
      if (observaciones.trim()) nueva.observaciones = observaciones.trim();
      if (usuario.rol === "profesor") nueva.profesorId = usuario.uid;
      await addDoc(collection(db, "visitas"), nueva);
      router.push("/dashboard/visitas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible registrar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeAgregar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-6">
        <TituloPagina icon={<MapPin size={28} />}>Registrar visita</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Registra una visita a un centro dual.
        </p>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centro dual *</label>
          {!cargandoDatos && centros.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              Este liceo todavía no tiene centros duales registrados. Agrega uno primero en "Centros Duales".
            </p>
          ) : (
            <Select
              value={centroDualId}
              onChange={setCentroDualId}
              ariaLabel="Centro dual"
              disabled={cargandoDatos}
              opciones={[{ value: "", label: "Selecciona un centro" }, ...centros.map((c) => ({ value: c.id, label: c.nombre }))]}
            />
          )}
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estudiante (opcional)</label>
          <Select
            value={estudianteId}
            onChange={setEstudianteId}
            ariaLabel="Estudiante"
            disabled={cargandoDatos}
            opciones={[{ value: "", label: "Sin estudiante asociado" }, ...estudiantes.map((e) => ({ value: e.id, label: `${e.nombres} ${e.apellidos}` }))]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Hora (opcional)</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </div>
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
          <Select value={estado} onChange={(v) => setEstado(v as EstadoVisita)} ariaLabel="Estado"
            opciones={[
              { value: "programada", label: "Programada" },
              { value: "realizada", label: "Realizada" },
              { value: "cancelada", label: "Cancelada" },
            ]} />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Observaciones (opcional)</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3}
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-none" />
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={() => conConfirmacion(registrar)}
            disabled={!puedeGuardar || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Registrando..." : "Registrar visita"}
          </button>
        </div>
      </div>

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una visita" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
