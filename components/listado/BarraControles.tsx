import { Search, SlidersHorizontal, LayoutList, LayoutGrid } from "lucide-react";
import Select, { type OpcionSelect } from "@/components/ui/Select";
import type { VistaListado } from "@/lib/preferencias/useVistaListado";

/** Fila de controles compartida por los listados principales de SIGEDUAL:
 * búsqueda, botón de filtros (con contador de activos), selector "Ordenar
 * por" y selector de vista lista/tarjetas. */
export default function BarraControles({
  busqueda, onBusqueda, placeholderBusqueda,
  filtrosAbiertos, onToggleFiltros, cantidadFiltrosActivos,
  orden, onOrden, opcionesOrden,
  vista, onVista,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  placeholderBusqueda: string;
  filtrosAbiertos: boolean;
  onToggleFiltros: () => void;
  cantidadFiltrosActivos: number;
  orden: string;
  onOrden: (v: string) => void;
  opcionesOrden: OpcionSelect[];
  vista: VistaListado;
  onVista: (v: VistaListado) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-3">
      <div className="relative flex-1">
        <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder={placeholderBusqueda}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        />
      </div>

      <button
        onClick={onToggleFiltros}
        style={{
          background: filtrosAbiertos ? "var(--accent)" + "22" : "var(--bg-card)",
          border: `1px solid ${filtrosAbiertos ? "var(--accent)" : "var(--border-light)"}`,
          color: filtrosAbiertos ? "var(--accent-light)" : "var(--text-secondary)",
        }}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
      >
        <SlidersHorizontal size={16} />
        Filtros
        {cantidadFiltrosActivos > 0 && (
          <span style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center">
            {cantidadFiltrosActivos}
          </span>
        )}
      </button>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Select value={orden} onChange={onOrden} ariaLabel="Ordenar" className="w-44" opciones={opcionesOrden} />
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="flex items-center gap-1 p-1 rounded-xl flex-shrink-0">
        <button
          onClick={() => onVista("lista")}
          title="Vista de lista"
          style={{ background: vista === "lista" ? "var(--accent)" : "transparent", color: vista === "lista" ? "#fff" : "var(--text-muted)" }}
          className="p-2 rounded-lg transition-colors"
        >
          <LayoutList size={16} />
        </button>
        <button
          onClick={() => onVista("tarjetas")}
          title="Vista de tarjetas"
          style={{ background: vista === "tarjetas" ? "var(--accent)" : "transparent", color: vista === "tarjetas" ? "#fff" : "var(--text-muted)" }}
          className="p-2 rounded-lg transition-colors"
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}
