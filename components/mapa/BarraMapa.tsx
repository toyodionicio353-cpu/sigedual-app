"use client";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import Select from "@/components/ui/Select";
import {
  ESTADOS_CENTRO, ESTADOS_PRACTICA, alternar, hayFiltrosActivos,
  type FiltrosMapa, type TipoActividad,
} from "@/lib/mapa/filtros";
import { COLOR_CENTRO, COLOR_PRACTICA, ETIQUETA_CENTRO, ETIQUETA_PRACTICA } from "@/lib/mapa/estados";
import type { PinMapa } from "@/lib/mapa/useDatosMapa";

/** Fila de un desplegable de filtros: casilla + punto de color + texto. */
function Opcion({ activa, color, texto, onClick }: { activa: boolean; color?: string; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={activa}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:[background:var(--hover-overlay)] transition-colors"
    >
      <span
        style={{
          background: activa ? "var(--accent)" : "transparent",
          border: `1.5px solid ${activa ? "var(--accent)" : "var(--border-firm, var(--border))"}`,
          color: "var(--text-on-accent)",
        }}
        className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
      >
        {activa && <Check size={10} strokeWidth={3} />}
      </span>
      {color && <span style={{ background: color, width: 8, height: 8, borderRadius: "50%" }} className="flex-shrink-0" />}
      <span style={{ color: "var(--text-primary)" }} className="text-xs truncate">{texto}</span>
    </button>
  );
}

/**
 * Barra superior del mapa: un buscador y un solo botón de filtros.
 *
 * Deliberadamente NO es una fila de botones por cada estado: son nueve
 * opciones entre las dos categorías y, puestas a la vista, taparían el
 * mapa que vienen a filtrar.
 */
export default function BarraMapa({
  filtros, onCambiar, resultados, onElegirResultado,
}: {
  filtros: FiltrosMapa;
  onCambiar: (f: FiltrosMapa) => void;
  /** Coincidencias del texto buscado, ya filtradas por permisos. */
  resultados: PinMapa[];
  onElegirResultado: (pin: PinMapa) => void;
}) {
  const [abiertos, setAbiertos] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  // Cerrar el panel de filtros al hacer clic fuera: dentro de un mapa,
  // dejarlo abierto tapa justamente lo que se quiere mirar.
  useEffect(() => {
    if (!abiertos) return;
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbiertos(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abiertos]);

  const sugerencias = filtros.texto.trim() && enfocado ? resultados.slice(0, 6) : [];
  const activos = hayFiltrosActivos(filtros);

  return (
    <div ref={caja} className="relative flex items-center gap-2" style={{ zIndex: 500 }}>
      <div className="relative flex-1 min-w-0">
        <Search size={14} style={{ color: "var(--text-muted)" }} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={filtros.texto}
          onChange={(e) => onCambiar({ ...filtros, texto: e.target.value })}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setTimeout(() => setEnfocado(false), 150)}
          placeholder="Buscar centro, empresa, dirección o estudiante..."
          aria-label="Buscar en el mapa"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        />
        {filtros.texto && (
          <button
            onClick={() => onCambiar({ ...filtros, texto: "" })}
            aria-label="Limpiar búsqueda"
            style={{ color: "var(--text-muted)" }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
          >
            <X size={14} />
          </button>
        )}

        {sugerencias.length > 0 && (
          <div
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto"
          >
            {sugerencias.map((pin, i) => (
              <button
                key={pin.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onElegirResultado(pin)}
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:[background:var(--hover-overlay)] transition-colors"
              >
                <span
                  style={{
                    background: pin.tipo === "centro" ? COLOR_CENTRO[pin.estado] : COLOR_PRACTICA,
                    width: 9, height: 9,
                    borderRadius: pin.tipo === "centro" ? "50%" : 2,
                    transform: pin.tipo === "practica" ? "rotate(45deg)" : undefined,
                  }}
                  className="flex-shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span style={{ color: "var(--text-primary)" }} className="text-sm block truncate">
                    {pin.tipo === "centro" ? pin.centro.nombre : pin.practica.lugarNombre}
                  </span>
                  <span style={{ color: "var(--text-muted)" }} className="text-xs block truncate">
                    {pin.tipo === "centro" ? "Centro Dual" : "Práctica Profesional"} · {pin.tipo === "centro" ? pin.centro.comuna : pin.practica.comuna}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[150px] flex-shrink-0 hidden sm:block">
        <Select
          value={filtros.tipo}
          onChange={(v) => onCambiar({ ...filtros, tipo: v as TipoActividad })}
          ariaLabel="Tipo de actividad"
          opciones={[
            { value: "todas", label: "Todas" },
            { value: "dual", label: "Formación Dual" },
            { value: "practicas", label: "Prácticas" },
          ]}
        />
      </div>

      <button
        onClick={() => setAbiertos((a) => !a)}
        aria-expanded={abiertos}
        style={{
          background: "var(--bg-card)",
          border: `1px solid ${activos ? "var(--accent)" : "var(--border)"}`,
          color: activos ? "var(--accent-light)" : "var(--text-secondary)",
        }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors"
      >
        <SlidersHorizontal size={14} />
        <span className="hidden sm:inline">Filtros</span>
      </button>

      {abiertos && (
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          className="absolute right-0 top-full mt-1 w-64 rounded-xl overflow-hidden shadow-2xl py-2 max-h-[70vh] overflow-y-auto"
        >
          <div className="sm:hidden px-3 pb-2">
            <Select
              value={filtros.tipo}
              onChange={(v) => onCambiar({ ...filtros, tipo: v as TipoActividad })}
              ariaLabel="Tipo de actividad"
              opciones={[
                { value: "todas", label: "Todas" },
                { value: "dual", label: "Formación Dual" },
                { value: "practicas", label: "Prácticas" },
              ]}
            />
          </div>

          {filtros.tipo !== "practicas" && (
            <>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5">
                Formación Dual
              </p>
              {ESTADOS_CENTRO.map((e) => (
                <Opcion
                  key={e}
                  activa={filtros.estadosCentro.includes(e)}
                  color={COLOR_CENTRO[e]}
                  texto={ETIQUETA_CENTRO[e]}
                  onClick={() => onCambiar({ ...filtros, estadosCentro: alternar(filtros.estadosCentro, e) })}
                />
              ))}
              <Opcion
                activa={filtros.soloPeriodoPrueba}
                color="#9333EA"
                texto="Solo período de prueba"
                onClick={() => onCambiar({ ...filtros, soloPeriodoPrueba: !filtros.soloPeriodoPrueba })}
              />
            </>
          )}

          {filtros.tipo !== "dual" && (
            <>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 mt-1">
                Prácticas Profesionales
              </p>
              {ESTADOS_PRACTICA.map((e) => (
                <Opcion
                  key={e}
                  activa={filtros.estadosPractica.includes(e)}
                  color={COLOR_PRACTICA}
                  texto={ETIQUETA_PRACTICA[e]}
                  onClick={() => onCambiar({ ...filtros, estadosPractica: alternar(filtros.estadosPractica, e) })}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
