"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Trash2 } from "lucide-react";
import { errorDeCoordenada, puntoValido, CENTRO_POR_DEFECTO, ZOOM_POR_DEFECTO } from "@/lib/mapa/geo";
import "leaflet/dist/leaflet.css";

/**
 * Selector de ubicación en mapa. Existe porque pedirle a alguien que
 * escriba una latitud y una longitud a mano es una forma segura de obtener
 * coordenadas equivocadas: acá se hace clic sobre el punto y el sistema
 * escribe los números.
 *
 * Nunca deduce la ubicación desde la dirección escrita: si nadie marca un
 * punto, el registro queda sin ubicación (y el mapa lo listará como
 * "ubicación pendiente"), que es preferible a un pin inventado.
 */
export default function SelectorUbicacion({
  latitud, longitud, onCambiar, etiqueta = "Ubicación en el mapa",
}: {
  latitud?: number;
  longitud?: number;
  onCambiar: (punto: { latitud?: number; longitud?: number }) => void;
  etiqueta?: string;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const marcadorRef = useRef<import("leaflet").Marker | null>(null);
  const onCambiarRef = useRef(onCambiar);
  onCambiarRef.current = onCambiar;

  // Texto de los campos numéricos, separado del valor guardado: mientras
  // alguien escribe "-35." el número todavía no es válido y no hay que
  // borrarle lo tecleado ni mover el mapa a medio camino.
  const [textoLat, setTextoLat] = useState(latitud !== undefined ? String(latitud) : "");
  const [textoLng, setTextoLng] = useState(longitud !== undefined ? String(longitud) : "");
  const [error, setError] = useState<string | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);

  const punto = puntoValido(latitud, longitud);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapaRef.current) return;

      const inicio = puntoValido(latitud, longitud) ?? CENTRO_POR_DEFECTO;
      const mapa = L.map(contenedor.current, { attributionControl: true })
        .setView([inicio.lat, inicio.lng], puntoValido(latitud, longitud) ? 15 : ZOOM_POR_DEFECTO);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      mapa.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        const problema = errorDeCoordenada(lat, lng);
        if (problema) { setError(problema); return; }
        setError(null);
        setTextoLat(String(lat));
        setTextoLng(String(lng));
        onCambiarRef.current({ latitud: lat, longitud: lng });
      });

      mapaRef.current = mapa;
      // El contenedor nace dentro de un formulario que puede estar oculto
      // (pasos del asistente): sin esto Leaflet calcula mal su tamaño.
      setTimeout(() => mapa.invalidateSize(), 0);
    })();

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // Solo al montar: el punto se sincroniza en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantiene el marcador y el encuadre al día con el valor del formulario.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const mapa = mapaRef.current;
      if (cancelado || !mapa) return;

      if (!punto) {
        marcadorRef.current?.remove();
        marcadorRef.current = null;
        return;
      }

      if (marcadorRef.current) {
        marcadorRef.current.setLatLng([punto.lat, punto.lng]);
      } else {
        const icono = L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        marcadorRef.current = L.marker([punto.lat, punto.lng], { icon: icono }).addTo(mapa);
      }
      if (mapa.getZoom() < 13) mapa.setView([punto.lat, punto.lng], 15);
      else mapa.panTo([punto.lat, punto.lng]);
    })();
    return () => { cancelado = true; };
  }, [punto?.lat, punto?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  function alEscribir(cual: "lat" | "lng", valor: string) {
    if (cual === "lat") setTextoLat(valor); else setTextoLng(valor);
    const lat = cual === "lat" ? Number(valor) : Number(textoLat);
    const lng = cual === "lng" ? Number(valor) : Number(textoLng);
    const ambosVacios = (cual === "lat" ? valor : textoLat).trim() === ""
      && (cual === "lng" ? valor : textoLng).trim() === "";
    if (ambosVacios) {
      setError(null);
      onCambiarRef.current({ latitud: undefined, longitud: undefined });
      return;
    }
    const problema = errorDeCoordenada(lat, lng);
    setError(problema);
    onCambiarRef.current(problema ? { latitud: undefined, longitud: undefined } : { latitud: lat, longitud: lng });
  }

  function limpiar() {
    setTextoLat("");
    setTextoLng("");
    setError(null);
    onCambiarRef.current({ latitud: undefined, longitud: undefined });
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setError("Este navegador no permite obtener la ubicación actual. Marca el punto en el mapa.");
      return;
    }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const problema = errorDeCoordenada(lat, lng);
        if (problema) { setError(problema); return; }
        setError(null);
        setTextoLat(String(lat));
        setTextoLng(String(lng));
        onCambiarRef.current({ latitud: lat, longitud: lng });
      },
      () => {
        setBuscandoGps(false);
        setError("No se pudo obtener la ubicación actual. Marca el punto en el mapa.");
      },
      { timeout: 10_000 }
    );
  }

  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span style={{ color: "var(--text-secondary)" }} className="text-xs">{etiqueta}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={buscandoGps}
            style={{ color: "var(--accent-light)" }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-50"
          >
            <Crosshair size={13} /> {buscandoGps ? "Buscando..." : "Usar mi ubicación"}
          </button>
          {punto && (
            <button
              type="button"
              onClick={limpiar}
              style={{ color: "var(--danger)" }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
            >
              <Trash2 size={13} /> Quitar
            </button>
          )}
        </div>
      </div>

      <p style={{ color: "var(--text-muted)" }} className="text-xs">
        Haz clic en el mapa para marcar dónde queda. Si lo dejas sin marcar, el registro aparecerá como <strong>ubicación pendiente</strong> y no se mostrará en el Mapa Dual.
      </p>

      <div
        ref={contenedor}
        style={{ border: "1px solid var(--border-light)", height: 260, borderRadius: 12, zIndex: 0 }}
        className="w-full overflow-hidden"
        role="application"
        aria-label="Mapa para marcar la ubicación"
      />

      <div className="grid grid-cols-2 gap-3">
        <label style={{ color: "var(--text-secondary)" }} className="text-xs">
          <span className="block mb-1">Latitud</span>
          <input value={textoLat} onChange={(e) => alEscribir("lat", e.target.value)} inputMode="decimal" placeholder="-35.826" style={inputStyle} className={inputClass} />
        </label>
        <label style={{ color: "var(--text-secondary)" }} className="text-xs">
          <span className="block mb-1">Longitud</span>
          <input value={textoLng} onChange={(e) => alEscribir("lng", e.target.value)} inputMode="decimal" placeholder="-71.596" style={inputStyle} className={inputClass} />
        </label>
      </div>

      {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}
      {!error && punto && (
        <p style={{ color: "var(--success)" }} className="text-xs inline-flex items-center gap-1.5">
          <MapPin size={12} /> Ubicación registrada.
        </p>
      )}
    </div>
  );
}
