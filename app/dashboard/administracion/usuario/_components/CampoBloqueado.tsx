"use client";
import { Lock } from "lucide-react";

interface CampoBloqueadoProps {
  label: string;
  valor: string;
  explicacion: string;
  badge?: React.ReactNode;
  accion?: React.ReactNode;
}

/** Fila de solo lectura para un dato bloqueado — nunca un input disabled
 * sin contexto: siempre se explica por qué no se puede editar aquí. */
export default function CampoBloqueado({ label, valor, explicacion, badge, accion }: CampoBloqueadoProps) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">{label}</span>
            <span
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-muted)" }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            >
              <Lock size={10} /> Bloqueado
            </span>
            {badge}
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mt-0.5 truncate">{valor || "—"}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 leading-relaxed max-w-md">{explicacion}</p>
        </div>
        {accion && <div className="flex-shrink-0">{accion}</div>}
      </div>
    </div>
  );
}
