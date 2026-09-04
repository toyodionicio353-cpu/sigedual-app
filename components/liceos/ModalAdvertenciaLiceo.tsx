"use client";
import { AlertTriangle } from "lucide-react";

interface ModalAdvertenciaLiceoProps {
  entidad: string; // ej: "un estudiante", "un centro dual"
  liceoNombre: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ModalAdvertenciaLiceo({ entidad, liceoNombre, onConfirmar, onCancelar }: ModalAdvertenciaLiceoProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="No hay un liceo seleccionado"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">No hay un liceo seleccionado</h2>
        </div>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          ¿Estás seguro de que quieres ingresar {entidad} sin antes haber seleccionado un liceo?
          Se guardará en <strong style={{ color: "var(--text-primary)" }}>{liceoNombre}</strong>.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          >
            Sí, continuar
          </button>
        </div>
      </div>
    </div>
  );
}
