/**
 * Reglas geográficas del Mapa Dual.
 *
 * Las coordenadas NO se inventan en ninguna parte del sistema: o vienen
 * registradas en la ficha (Centro Dual / Práctica Profesional), o el
 * registro se muestra como "ubicación pendiente". Este módulo solo valida
 * y encuadra; nunca deduce una ubicación a partir de una dirección.
 */

/** Coordenada válida de un punto ya ubicado. */
export interface Punto {
  lat: number;
  lng: number;
}

/**
 * Caja envolvente del territorio continental e insular habitado de Chile,
 * de Arica (norte) a la Antártica chilena (sur), incluyendo Isla de Pascua
 * al oeste. Es deliberadamente una caja y no la frontera exacta: sirve para
 * rechazar lo que claramente no es Chile (Argentina, Perú, Bolivia, un
 * error de tipeo que manda el punto al Atlántico), no para arbitrar
 * límites internacionales, que no le corresponden a esta aplicación.
 */
export const LIMITES_CHILE = {
  latMin: -56.0,
  latMax: -17.4,
  lngMin: -110.0,
  lngMax: -66.3,
} as const;

/**
 * Encuadre por defecto cuando no hay ni un solo Centro Dual ubicado: la
 * Región del Maule, donde opera el liceo que origina SIGEDUAL. Se usa solo
 * como último recurso para que el mapa no abra en el océano; en cuanto
 * exista un centro con coordenadas, manda ese encuadre.
 */
export const CENTRO_POR_DEFECTO: Punto = { lat: -35.9, lng: -71.7 };
export const ZOOM_POR_DEFECTO = 9;

/** ¿Es un número utilizable como coordenada? Descarta null, undefined,
 * NaN, Infinity y el string vacío que Firestore a veces devuelve. */
function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** ¿El punto cae dentro de Chile? Única restricción territorial que se
 * aplica a una Práctica Profesional (puede estar en cualquier región). */
export function estaEnChile(lat: unknown, lng: unknown): boolean {
  if (!esNumeroFinito(lat) || !esNumeroFinito(lng)) return false;
  return (
    lat >= LIMITES_CHILE.latMin && lat <= LIMITES_CHILE.latMax
    && lng >= LIMITES_CHILE.lngMin && lng <= LIMITES_CHILE.lngMax
  );
}

/**
 * Devuelve el punto solo si es utilizable. Un registro cuyo par de
 * coordenadas no pase por acá se trata como "ubicación pendiente": no
 * recibe pin, y su dirección registrada queda intacta.
 */
export function puntoValido(lat: unknown, lng: unknown): Punto | null {
  if (!estaEnChile(lat, lng)) return null;
  return { lat: lat as number, lng: lng as number };
}

/** Mensaje de por qué una coordenada no sirve, para mostrarlo en el
 * formulario. `null` significa que es válida. */
export function errorDeCoordenada(lat: unknown, lng: unknown): string | null {
  if (!esNumeroFinito(lat) || !esNumeroFinito(lng)) {
    return "Faltan la latitud y la longitud, o no son números válidos.";
  }
  if (lat < -90 || lat > 90) return "La latitud debe estar entre -90 y 90.";
  if (lng < -180 || lng > 180) return "La longitud debe estar entre -180 y 180.";
  if (!estaEnChile(lat, lng)) {
    return "Esa ubicación queda fuera de Chile. Revisa que la latitud sea negativa (hemisferio sur) y que no se hayan invertido los valores.";
  }
  return null;
}

/** Recuadro geográfico que contiene todos los puntos dados. */
export interface Encuadre {
  suroeste: Punto;
  noreste: Punto;
}

/**
 * Encuadre que abarca los puntos entregados.
 *
 * El Mapa Dual lo calcula SOLO con los Centros Duales, nunca con las
 * Prácticas Profesionales: una práctica en Santiago no debe reencuadrar un
 * mapa cuyo liceo opera entre Retiro y Parral. La navegación después queda
 * libre por todo Chile; esto define únicamente la vista inicial.
 *
 * Devuelve null si no hay ningún punto: quien llama decide el respaldo.
 */
export function encuadreDe(puntos: Punto[]): Encuadre | null {
  if (puntos.length === 0) return null;
  let latMin = puntos[0].lat, latMax = puntos[0].lat;
  let lngMin = puntos[0].lng, lngMax = puntos[0].lng;
  for (const p of puntos) {
    if (p.lat < latMin) latMin = p.lat;
    if (p.lat > latMax) latMax = p.lat;
    if (p.lng < lngMin) lngMin = p.lng;
    if (p.lng > lngMax) lngMax = p.lng;
  }
  // Un solo punto (o varios idénticos) daría un recuadro de área cero, que
  // los mapas resuelven con un zoom máximo incómodo: se le da un margen.
  if (latMin === latMax && lngMin === lngMax) {
    const margen = 0.05;
    return {
      suroeste: { lat: latMin - margen, lng: lngMin - margen },
      noreste: { lat: latMax + margen, lng: lngMax + margen },
    };
  }
  return {
    suroeste: { lat: latMin, lng: lngMin },
    noreste: { lat: latMax, lng: lngMax },
  };
}
