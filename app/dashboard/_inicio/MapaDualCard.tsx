"use client";
import { Lock } from "lucide-react";

/** Vestigio visual del futuro "Mapa Dual" — puramente decorativo y
 * bloqueado: sin clics, sin zoom, sin librería de mapas, sin coordenadas ni
 * datos reales. Solo indica que la funcionalidad llegará más adelante. */
export default function MapaDualCard() {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Mapa Dual</h2>
        <span style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold">
          <Lock size={10} /> Próximamente
        </span>
      </div>

      <div
        aria-hidden="true"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", pointerEvents: "none", userSelect: "none" }}
        className="relative rounded-xl overflow-hidden flex items-center justify-center"
      >
        <svg width="100%" height="220" viewBox="0 0 200 240" style={{ opacity: 0.5 }}>
          {/* Silueta abstracta y estilizada — no representa fronteras ni ubicaciones reales */}
          <path
            d="M100 8 C112 8 118 22 116 40 C120 60 130 78 126 100 C132 120 128 145 120 165 C126 185 118 205 108 218 C104 228 96 230 92 220 C82 208 86 188 80 170 C72 150 76 128 70 108 C64 86 72 64 76 44 C74 26 88 8 100 8 Z"
            fill="var(--accent)"
            opacity="0.25"
          />
          <path
            d="M100 8 C112 8 118 22 116 40 C120 60 130 78 126 100 C132 120 128 145 120 165 C126 185 118 205 108 218 C104 228 96 230 92 220 C82 208 86 188 80 170 C72 150 76 128 70 108 C64 86 72 64 76 44 C74 26 88 8 100 8 Z"
            fill="none"
            stroke="var(--accent-light)"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {[[96, 50], [92, 90], [100, 130], [90, 170], [102, 200]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3.5" fill="var(--accent-light)" opacity="0.7" />
          ))}
        </svg>
        <div style={{ background: "linear-gradient(180deg, transparent, var(--bg-surface) 85%)" }} className="absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
            <Lock size={20} style={{ color: "var(--text-muted)" }} />
          </div>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-4">
        Próximamente podrás visualizar la distribución geográfica de los centros duales, liceos y actividades de la Formación Profesional Dual.
      </p>
    </div>
  );
}
