"use client";
import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import type { TipoDatoSolicitud } from "@/types";
import { X } from "lucide-react";

const OPCIONES_DATO: { value: TipoDatoSolicitud; label: string }[] = [
  { value: "nombre", label: "Nombre completo" },
  { value: "correo", label: "Correo electrónico" },
  { value: "rut", label: "RUT" },
  { value: "otro", label: "Otro" },
];

interface ModalSolicitudProps {
  datoSugerido: TipoDatoSolicitud;
  valorActual: string;
  onCerrar: () => void;
}

export default function ModalSolicitud({ datoSugerido, valorActual, onCerrar }: ModalSolicitudProps) {
  const { usuario } = useAuth();
  const avisar = useFeedback();
  const [tipoDato, setTipoDato] = useState<TipoDatoSolicitud>(datoSugerido);
  const [valorNuevo, setValorNuevo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar() {
    if (!usuario) return;
    if (!valorNuevo.trim() || !motivo.trim()) {
      setError("Completa el nuevo valor y el motivo de la solicitud.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await addDoc(collection(db, "solicitudesModificacion"), {
        uid: usuario.uid,
        liceoId: usuario.liceoId,
        tipoDato,
        valorActual,
        valorNuevo: valorNuevo.trim(),
        motivo: motivo.trim(),
        estado: "pendiente",
        creadoEn: new Date().toISOString(),
      });
      avisar("Solicitud registrada. Quedará pendiente de revisión administrativa.");
      onCerrar();
    } catch {
      setError("No se pudo enviar la solicitud. Inténtalo nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCerrar}>
      <div
        role="dialog" aria-modal="true" aria-label="Solicitar modificación"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">Solicitar modificación</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ color: "var(--text-muted)" }} className="p-1 hover:[color:var(--text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-5">
          Este dato está bloqueado y solo puede cambiarlo un administrador. Tu solicitud quedará registrada como pendiente de revisión.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Dato que deseas modificar</label>
            <select
              value={tipoDato}
              onChange={(e) => setTipoDato(e.target.value as TipoDatoSolicitud)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            >
              {OPCIONES_DATO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Valor actual</label>
            <input value={valorActual || "—"} disabled style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-muted)" }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nuevo valor</label>
            <input
              value={valorNuevo}
              onChange={(e) => setValorNuevo(e.target.value)}
              maxLength={120}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Motivo de la solicitud</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              rows={3}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-none"
            />
          </div>

          {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCerrar} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
            Cancelar
          </button>
          <button onClick={enviar} disabled={enviando} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
