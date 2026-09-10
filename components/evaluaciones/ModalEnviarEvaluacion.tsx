"use client";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import type { Asignacion, CentroDual, Estudiante } from "@/types";
import { Send, X } from "lucide-react";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

function ahoraISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ModalEnviarEvaluacionProps {
  plantillaId: string;
  plantillaNombre: string;
  asignaciones: Asignacion[];
  liceoId: string;
  profesorUid: string;
  profesorNombre: string;
  onEnviado: (cantidad: number) => void;
  onCancelar: () => void;
}

export default function ModalEnviarEvaluacion({
  plantillaId, plantillaNombre, asignaciones, liceoId, profesorUid, profesorNombre, onEnviado, onCancelar,
}: ModalEnviarEvaluacionProps) {
  const vigentes = useMemo(() => asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa"), [asignaciones]);

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [fechaInicio, setFechaInicio] = useState(ahoraISO());
  const [fechaFin, setFechaFin] = useState(() => ahoraISO().slice(0, 10) + "T23:59");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [estudiantesData, centrosData] = await Promise.all([
        obtenerDocumentosPorId<Estudiante>("estudiantes", vigentes.map((a) => a.estudianteId)),
        obtenerDocumentosPorId<CentroDual>("centros_duales", vigentes.map((a) => a.centroDualId)),
      ]);
      if (cancelado) return;
      setEstudiantes(estudiantesData);
      setCentros(centrosData);
      setCargandoDatos(false);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternar(asignacionId: string) {
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(asignacionId)) nuevo.delete(asignacionId);
      else nuevo.add(asignacionId);
      return nuevo;
    });
  }

  function nombreEstudiante(id: string): string {
    const e = estudiantes.find((e) => e.id === id);
    return e ? `${e.nombres} ${e.apellidos}` : "Estudiante";
  }
  function nombreCentro(id: string): string {
    return centros.find((c) => c.id === id)?.nombre || "Centro Dual";
  }

  async function enviar() {
    if (enviando) return;
    setError("");
    if (!fechaInicio || !fechaFin) { setError("Ingresa la fecha de inicio y de término del plazo."); return; }
    if (fechaFin < fechaInicio) { setError("La fecha de término no puede ser anterior a la de inicio."); return; }
    if (seleccionadas.size === 0) { setError("Selecciona al menos un Centro Dual/estudiante."); return; }

    setEnviando(true);
    try {
      const ahora = new Date().toISOString();
      await Promise.all(
        Array.from(seleccionadas).map((asignacionId) => {
          const asignacion = vigentes.find((a) => a.id === asignacionId);
          if (!asignacion) return Promise.resolve();
          return addDoc(collection(db, "envios_evaluacion"), {
            liceoId,
            plantillaId,
            asignacionId: asignacion.id,
            estudianteId: asignacion.estudianteId,
            centroDualId: asignacion.centroDualId,
            ...(asignacion.maestroGuiaId ? { maestroGuiaId: asignacion.maestroGuiaId } : {}),
            profesorSupervisorId: profesorUid,
            profesorSupervisorNombre: profesorNombre,
            fechaInicio,
            fechaFin,
            creadoEn: ahora,
          });
        })
      );
      onEnviado(seleccionadas.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la evaluación.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Enviar evaluación"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">Enviar evaluación</h2>
          <button onClick={onCancelar} style={{ color: "var(--text-muted)" }} className="flex-shrink-0"><X size={18} /></button>
        </div>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-5">{plantillaNombre}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Desde</label>
            <input type="datetime-local" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} className={inputClass} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Hasta</label>
            <input type="datetime-local" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} className={inputClass} />
          </div>
        </div>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">
          El Centro Dual solo verá esta evaluación como disponible entre esa fecha y hora.
        </p>

        <p style={{ color: "var(--text-secondary)" }} className="text-xs font-semibold uppercase tracking-wide mb-2">
          ¿A quién enviarla?
        </p>
        {cargandoDatos ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">Cargando...</p>
        ) : vigentes.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">No tienes estudiantes con una asignación vigente.</p>
        ) : (
          <div style={{ border: "1px solid var(--border)" }} className="rounded-xl mb-4 max-h-48 overflow-y-auto">
            {vigentes.map((a, i) => (
              <label
                key={a.id}
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seleccionadas.has(a.id)}
                  onChange={() => alternar(a.id)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{nombreEstudiante(a.estudianteId)}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">{nombreCentro(a.centroDualId)}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)" }} className="text-sm mb-4">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={enviando || cargandoDatos}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Send size={15} />
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
