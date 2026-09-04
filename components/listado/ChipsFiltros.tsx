import { X } from "lucide-react";

export interface ChipFiltro {
  key: string;
  label: string;
  onQuitar: () => void;
}

/** Fila de chips de filtros activos (búsqueda + filtros individuales),
 * compartida por los listados principales de SIGEDUAL. No se renderiza
 * nada si no hay ningún filtro activo. */
export default function ChipsFiltros({
  busqueda, onQuitarBusqueda, chips, onLimpiarTodo,
}: {
  busqueda: string;
  onQuitarBusqueda: () => void;
  chips: ChipFiltro[];
  onLimpiarTodo: () => void;
}) {
  const hayFiltrosActivos = chips.length > 0 || busqueda.trim().length > 0;
  if (!hayFiltrosActivos) return <div className="mb-6" />;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {busqueda.trim() && (
        <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium">
          &quot;{busqueda.trim()}&quot;
          <button onClick={onQuitarBusqueda} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
        </span>
      )}
      {chips.map((chip) => (
        <span key={chip.key} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium">
          {chip.label}
          <button onClick={chip.onQuitar} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
        </span>
      ))}
      <button onClick={onLimpiarTodo} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
        Limpiar filtros
      </button>
    </div>
  );
}
