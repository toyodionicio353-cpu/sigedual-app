"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { COLOR_CENTRO, COLOR_PRACTICA, ETIQUETA_CENTRO, ETIQUETA_PRACTICA } from "@/lib/mapa/estados";
import { ESTADOS_CENTRO, ESTADOS_PRACTICA, type TipoActividad } from "@/lib/mapa/filtros";

function Fila({ color, texto, rombo = false, anillo = false }: { color: string; texto: string; rombo?: boolean; anillo?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        style={{
          background: anillo ? "transparent" : color,
          border: anillo ? `2px solid ${color}` : "1.5px solid rgba(255,255,255,.85)",
          width: 10, height: 10,
          borderRadius: rombo ? 2 : "50%",
          transform: rombo ? "rotate(45deg)" : undefined,
        }}
        className="flex-shrink-0"
        aria-hidden
      />
      <span style={{ color: "var(--text-secondary)" }} className="text-[11px]">{texto}</span>
    </li>
  );
}

/**
 * Leyenda de los símbolos, colapsable: en la tarjeta del Dashboard el
 * mapa ya es pequeño y una leyenda siempre desplegada le come el espacio
 * que necesita para ser útil.
 */
export default function LeyendaMapa({ tipo }: { tipo: TipoActividad }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      className="rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        style={{ color: "var(--text-secondary)" }}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold"
      >
        <span>Qué significa cada símbolo</span>
        {abierta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {abierta && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="px-3 py-2.5 flex flex-col sm:flex-row gap-4">
          {tipo !== "practicas" && (
            <div className="min-w-0">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                Formación Dual
              </p>
              <ul className="flex flex-col gap-1">
                {ESTADOS_CENTRO.map((e) => (
                  <Fila key={e} color={COLOR_CENTRO[e]} texto={ETIQUETA_CENTRO[e]} />
                ))}
                <Fila color="#9333EA" texto="Centro nuevo, menos de 60 días" anillo />
              </ul>
            </div>
          )}
          {tipo !== "dual" && (
            <div className="min-w-0">
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                Prácticas Profesionales
              </p>
              <ul className="flex flex-col gap-1">
                {ESTADOS_PRACTICA.map((e) => (
                  <Fila key={e} color={COLOR_PRACTICA} texto={ETIQUETA_PRACTICA[e]} rombo />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
