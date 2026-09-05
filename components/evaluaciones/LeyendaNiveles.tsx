"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NIVELES_LOGRO } from "@/lib/evaluaciones/tipos";

/** Botón con flecha que despliega, junto a una fila de niveles I/R/B/MB, el
 * significado de cada uno — mismo texto ya usado como tooltip (title) en los
 * selectores, ahora visible sin depender de pasar el mouse por encima. */
export default function LeyendaNiveles() {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        style={{ color: "var(--text-muted)" }}
        className="p-1 rounded-lg hover:[background:var(--hover-overlay)] transition-colors flex-shrink-0"
        aria-label={abierta ? "Ocultar significado de los niveles" : "Ver significado de los niveles"}
      >
        <ChevronDown size={14} style={{ transform: abierta ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {abierta && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="mt-2 rounded-lg p-3 flex flex-col gap-1.5 max-w-md">
          {NIVELES_LOGRO.map((n) => (
            <p key={n.value} style={{ color: "var(--text-secondary)" }} className="text-xs">
              <span style={{ color: "var(--text-primary)" }} className="font-semibold">{n.label}: </span>
              {n.descripcion}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
