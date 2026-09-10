"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, MapPinOff, Map as IconoMapa } from "lucide-react";
import { useDatosMapa, type PinMapa } from "@/lib/mapa/useDatosMapa";
import { FILTROS_INICIALES, filtrarCentros, filtrarPracticas, coincideTexto, type FiltrosMapa } from "@/lib/mapa/filtros";
import type { Punto } from "@/lib/mapa/geo";
import BarraMapa from "@/components/mapa/BarraMapa";
import LeyendaMapa from "@/components/mapa/LeyendaMapa";
import FichaMapa from "@/components/mapa/FichaMapa";

// Leaflet necesita `window`: sin ssr:false el prerenderizado revienta.
// Solo funciona dentro de un Client Component, y este lo es.
const LienzoMapa = dynamic(() => import("@/components/mapa/LienzoMapa"), {
  ssr: false,
  loading: () => <EsqueletoMapa />,
});

function EsqueletoMapa() {
  return (
    <div
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
      className="w-full h-full rounded-xl flex items-center justify-center"
    >
      <p style={{ color: "var(--text-muted)" }} className="text-xs">Cargando mapa...</p>
    </div>
  );
}

/**
 * Mapa Dual. Es una sección del Inicio, NO un módulo: no tiene ruta propia
 * ni entrada en el Sidebar. "Ampliar" abre el mismo mapa a pantalla
 * completa sobre esta misma página, sin navegar a ninguna parte.
 *
 * Es de consulta: desde acá no se crea, edita ni elimina nada. Los datos
 * se modifican en los módulos correspondientes y el mapa los refleja solo.
 */
export default function MapaDualCard() {
  const { centros, practicas, sinUbicacion, cargando, error } = useDatosMapa();
  const [filtros, setFiltros] = useState<FiltrosMapa>(FILTROS_INICIALES);
  const [seleccionado, setSeleccionado] = useState<PinMapa | null>(null);
  const [irA, setIrA] = useState<{ punto: Punto; contador: number } | null>(null);
  const [ampliado, setAmpliado] = useState(false);

  const centrosVisibles = useMemo(() => filtrarCentros(centros, filtros), [centros, filtros]);
  const practicasVisibles = useMemo(() => filtrarPracticas(practicas, filtros), [practicas, filtros]);

  // Sugerencias del buscador: se buscan en todo lo que el usuario puede
  // ver, no solo en lo que los filtros dejan pintado ahora mismo — si no,
  // buscar algo filtrado devolvería "sin resultados" sin explicar por qué.
  const resultadosBusqueda = useMemo(() => {
    if (!filtros.texto.trim()) return [];
    return [...centros, ...practicas].filter((p) => coincideTexto(p, filtros.texto));
  }, [centros, practicas, filtros.texto]);

  function elegir(pin: PinMapa) {
    setSeleccionado(pin);
    setIrA((prev) => ({ punto: pin.punto, contador: (prev?.contador ?? 0) + 1 }));
  }

  const total = centrosVisibles.length + practicasVisibles.length;
  const vacio = !cargando && total === 0;

  const contenido = (
    <div className="flex flex-col gap-2.5 h-full min-h-0">
      <BarraMapa
        filtros={filtros}
        onCambiar={setFiltros}
        resultados={resultadosBusqueda}
        onElegirResultado={elegir}
      />

      <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-light)" }}>
        <LienzoMapa
          centros={centrosVisibles}
          practicas={practicasVisibles}
          seleccionadoId={seleccionado?.id ?? null}
          onSeleccionar={setSeleccionado}
          onLimpiarSeleccion={() => setSeleccionado(null)}
          irA={irA}
          alturaMinima={ampliado ? 400 : 260}
        />

        {seleccionado && (
          <div className="absolute left-2 right-2 bottom-2 sm:left-auto sm:right-3 sm:top-3 sm:bottom-auto sm:w-72" style={{ zIndex: 600 }}>
            <FichaMapa pin={seleccionado} onCerrar={() => setSeleccionado(null)} />
          </div>
        )}

        {vacio && (
          <div
            style={{ background: "var(--bg-surface)" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <MapPinOff size={22} style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }} className="text-sm font-medium">
              {centros.length + practicas.length === 0
                ? "Todavía no hay actividades ubicadas en el mapa"
                : "Ningún resultado con estos filtros"}
            </p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs max-w-xs">
              {centros.length + practicas.length === 0
                ? "Los Centros Duales aparecen acá cuando se registra su ubicación desde su ficha."
                : "Prueba cambiando el tipo de actividad o los estados seleccionados."}
            </p>
          </div>
        )}
      </div>

      <LeyendaMapa tipo={filtros.tipo} />

      {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}

      {sinUbicacion.length > 0 && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          {sinUbicacion.length === 1
            ? "1 registro sin ubicación registrada; no aparece en el mapa."
            : `${sinUbicacion.length} registros sin ubicación registrada; no aparecen en el mapa.`}{" "}
          Se completa desde la ficha de cada uno.
        </p>
      )}
    </div>
  );

  return (
    <>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <IconoMapa size={16} style={{ color: "var(--accent-light)" }} />
            <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Mapa Dual</h2>
          </div>
          <button
            onClick={() => setAmpliado(true)}
            style={{ color: "var(--accent-light)" }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
          >
            <Maximize2 size={13} /> Ampliar mapa
          </button>
        </div>

        {/* Mientras está ampliado, el mapa vive solo en el overlay: montar
            dos instancias de Leaflet a la vez duplicaría la carga de
            teselas y los listeners, por un mapa que además queda tapado. */}
        <div style={{ height: 400 }}>
          {ampliado ? (
            <div
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
              className="w-full h-full rounded-xl flex items-center justify-center"
            >
              <p style={{ color: "var(--text-muted)" }} className="text-xs">Mapa abierto en pantalla completa</p>
            </div>
          ) : contenido}
        </div>
      </div>

      {ampliado && (
        <div
          className="fixed inset-0 z-50 p-3 sm:p-5 flex flex-col"
          style={{ background: "var(--bg-base)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Mapa Dual ampliado"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <IconoMapa size={17} style={{ color: "var(--accent-light)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">Mapa Dual</h2>
            </div>
            <button
              onClick={() => setAmpliado(false)}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              <Minimize2 size={13} /> Reducir
            </button>
          </div>
          <div className="flex-1 min-h-0">{contenido}</div>
        </div>
      )}
    </>
  );
}
