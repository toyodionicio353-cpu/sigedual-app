import { ChevronLeft, ChevronRight } from "lucide-react";

/** Paginación numerada compartida por los listados principales de
 * SIGEDUAL, con elipsis cuando hay muchas páginas. */
export default function PaginacionListado({
  paginaActual, totalPaginas, onCambiarPagina,
}: {
  paginaActual: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <button
        onClick={() => onCambiarPagina(Math.max(1, paginaActual - 1))}
        disabled={paginaActual === 1}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
      >
        <ChevronLeft size={14} />
        Anterior
      </button>
      {Array.from({ length: totalPaginas }, (_, i) => i + 1)
        .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - paginaActual) <= 1)
        .map((n, idx, arr) => (
          <span key={n} className="flex items-center gap-1.5">
            {idx > 0 && arr[idx - 1] !== n - 1 && <span style={{ color: "var(--text-muted)" }} className="text-xs px-1">...</span>}
            <button
              onClick={() => onCambiarPagina(n)}
              style={{
                background: n === paginaActual ? "var(--accent)" : "var(--bg-card)",
                border: `1px solid ${n === paginaActual ? "var(--accent)" : "var(--border)"}`,
                color: n === paginaActual ? "#fff" : "var(--text-secondary)",
              }}
              className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
            >
              {n}
            </button>
          </span>
        ))}
      <button
        onClick={() => onCambiarPagina(Math.min(totalPaginas, paginaActual + 1))}
        disabled={paginaActual === totalPaginas}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
      >
        Siguiente
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
