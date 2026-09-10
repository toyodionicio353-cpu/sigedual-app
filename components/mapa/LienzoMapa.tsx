"use client";
import { useEffect, useRef } from "react";
import type { Map as MapaLeaflet, Marker } from "leaflet";
import { encuadreDe, CENTRO_POR_DEFECTO, ZOOM_POR_DEFECTO, type Punto } from "@/lib/mapa/geo";
import { htmlPinCentro, htmlPinPractica, TAMANO_PIN, TAMANO_PIN_SELECCIONADO } from "@/lib/mapa/iconos";
import type { PinCentro, PinMapa, PinPractica } from "@/lib/mapa/useDatosMapa";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./mapa.css";

/**
 * El lienzo del mapa: solo dibuja. No decide qué mostrar (eso son los
 * filtros) ni permite editar nada — desde el mapa no se crea, modifica ni
 * elimina ningún registro de SIGEDUAL.
 *
 * Se carga siempre con ssr:false desde quien lo usa: Leaflet necesita
 * `window` y revienta si se intenta prerenderizar.
 */
export default function LienzoMapa({
  centros, practicas, seleccionadoId, onSeleccionar, onLimpiarSeleccion,
  irA, alturaMinima = 300,
}: {
  centros: PinCentro[];
  practicas: PinPractica[];
  seleccionadoId: string | null;
  onSeleccionar: (pin: PinMapa) => void;
  onLimpiarSeleccion: () => void;
  /** Punto al que desplazarse (resultado de una búsqueda). El contador
   * fuerza el movimiento aunque se repita el mismo punto. */
  irA: { punto: Punto; contador: number } | null;
  alturaMinima?: number;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const capaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const marcadoresRef = useRef<Record<string, Marker>>({});
  const yaEncuadrado = useRef(false);
  const listoRef = useRef(false);

  // Refs para que los callbacks vivos no obliguen a recrear el mapa.
  const onSeleccionarRef = useRef(onSeleccionar);
  onSeleccionarRef.current = onSeleccionar;
  const onLimpiarRef = useRef(onLimpiarSeleccion);
  onLimpiarRef.current = onLimpiarSeleccion;

  // Creación del mapa (una sola vez).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelado || !contenedor.current || mapaRef.current) return;

      const mapa = L.map(contenedor.current, {
        // Navegación libre: el encuadre inicial lo dan los Centros Duales,
        // pero nadie queda encerrado en esa zona. Se puede recorrer todo
        // Chile para llegar a una práctica lejana.
        minZoom: 3,
        maxZoom: 19,
        scrollWheelZoom: true,
      }).setView([CENTRO_POR_DEFECTO.lat, CENTRO_POR_DEFECTO.lng], ZOOM_POR_DEFECTO);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      mapa.on("click", () => onLimpiarRef.current());

      // Agrupación al alejar el zoom: con muchas prácticas repartidas por
      // Chile, dibujarlas todas sueltas degrada el mapa sin aportar nada.
      const grupo = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        iconCreateFunction: (cluster) =>
          L.divIcon({
            html: `<div>${cluster.getChildCount()}</div>`,
            className: "sig-cluster",
            iconSize: L.point(38, 38),
          }),
      });
      grupo.addTo(mapa);

      mapaRef.current = mapa;
      capaRef.current = grupo;
      listoRef.current = true;
      setTimeout(() => mapa.invalidateSize(), 0);
    })();

    return () => {
      cancelado = true;
      listoRef.current = false;
      mapaRef.current?.remove();
      mapaRef.current = null;
      capaRef.current = null;
      marcadoresRef.current = {};
    };
  }, []);

  // Redibujado de marcadores cada vez que cambian los datos o los filtros.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const grupo = capaRef.current;
      const mapa = mapaRef.current;
      if (cancelado || !grupo || !mapa) return;

      grupo.clearLayers();
      marcadoresRef.current = {};

      const agregar = (pin: PinMapa) => {
        const esSeleccionado = pin.id === seleccionadoId;
        const html = pin.tipo === "centro"
          ? htmlPinCentro(pin.estado, pin.esNuevo, esSeleccionado)
          : htmlPinPractica(pin.estado, esSeleccionado);
        const tamano = esSeleccionado ? TAMANO_PIN_SELECCIONADO : TAMANO_PIN;
        const nombre = pin.tipo === "centro" ? pin.centro.nombre : pin.practica.lugarNombre;
        const marcador = L.marker([pin.punto.lat, pin.punto.lng], {
          icon: L.divIcon({ html, className: "", iconSize: [tamano, tamano], iconAnchor: [tamano / 2, tamano / 2] }),
          title: nombre,
          alt: `${pin.tipo === "centro" ? "Centro Dual" : "Práctica Profesional"}: ${nombre}`,
          keyboard: true,
          riseOnHover: true,
        });
        marcador.on("click", () => onSeleccionarRef.current(pin));
        marcadoresRef.current[pin.id] = marcador;
        grupo.addLayer(marcador);
      };

      centros.forEach(agregar);
      practicas.forEach(agregar);

      // Encuadre inicial: SOLO con los Centros Duales. Una práctica en
      // Santiago no debe reencuadrar el mapa de un liceo que opera entre
      // Retiro y Parral — la zona de trabajo la definen los centros.
      // Se hace una única vez; después manda la navegación del usuario.
      if (!yaEncuadrado.current && centros.length > 0) {
        const caja = encuadreDe(centros.map((c) => c.punto));
        if (caja) {
          mapa.fitBounds(
            [[caja.suroeste.lat, caja.suroeste.lng], [caja.noreste.lat, caja.noreste.lng]],
            { padding: [40, 40], maxZoom: 15 }
          );
          yaEncuadrado.current = true;
        }
      }
    })();
    return () => { cancelado = true; };
  }, [centros, practicas, seleccionadoId]);

  // Desplazamiento a un resultado de búsqueda.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !irA) return;
    mapa.flyTo([irA.punto.lat, irA.punto.lng], Math.max(mapa.getZoom(), 15), { duration: 0.8 });
  }, [irA]);

  // El contenedor puede nacer oculto (tarjeta del Dashboard, overlay
  // ampliado): sin recalcular el tamaño, Leaflet dibuja las teselas mal.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !contenedor.current) return;
    const observador = new ResizeObserver(() => mapa.invalidateSize());
    observador.observe(contenedor.current);
    return () => observador.disconnect();
  });

  return (
    <div
      ref={contenedor}
      className="sig-mapa w-full h-full"
      style={{ minHeight: alturaMinima, zIndex: 0 }}
      role="application"
      aria-label="Mapa de Centros Duales y Prácticas Profesionales"
    />
  );
}
