import {
  COLOR_CENTRO, COLOR_LICEO, COLOR_PRACTICA,
  type EstadoPinCentro, type EstadoPinPractica,
} from "./estados";

/**
 * HTML de los marcadores. Leaflet los inserta fuera del árbol de React
 * (divIcon recibe una cadena), por eso se arman acá y las clases viven en
 * components/mapa/mapa.css.
 *
 * El tipo de actividad se distingue por FORMA además de color — círculo
 * para Formación Dual, rombo para Práctica Profesional, placa con glifo de
 * establecimiento para el liceo — para que no dependa de poder diferenciar
 * el rosado del resto de la paleta.
 */

export const TAMANO_PIN = 20;
export const TAMANO_PIN_SELECCIONADO = 28;

export function htmlPinCentro(estado: EstadoPinCentro, esNuevo: boolean, seleccionado = false): string {
  const tamano = seleccionado ? TAMANO_PIN_SELECCIONADO : TAMANO_PIN;
  const clases = [
    "sig-pin", "sig-pin--centro",
    esNuevo ? "sig-pin--nuevo" : "",
    estado === "atencion" ? "sig-pin--pulso" : "",
  ].filter(Boolean).join(" ");
  return `<div class="${clases}" style="width:${tamano}px;height:${tamano}px;background:${COLOR_CENTRO[estado]}"></div>`;
}

export function htmlPinPractica(estado: EstadoPinPractica, seleccionado = false): string {
  const tamano = seleccionado ? TAMANO_PIN_SELECCIONADO - 4 : TAMANO_PIN - 3;
  const clases = [
    "sig-pin", "sig-pin--practica",
    estado === "atencion" || estado === "por_finalizar" ? "sig-pin--pulso" : "",
    estado === "finalizada" ? "sig-pin--atenuado" : "",
  ].filter(Boolean).join(" ");
  return `<div class="${clases}" style="width:${tamano}px;height:${tamano}px;background:${COLOR_PRACTICA}"></div>`;
}

export const TAMANO_PIN_LICEO = 32;

/**
 * Liceo: placa más grande que los demás pines, con el glifo del
 * establecimiento. Es el punto de referencia del mapa, así que tiene que
 * leerse como tal de un vistazo y no confundirse con una actividad.
 *
 * El glifo va en SVG inline porque Leaflet recibe HTML plano: un icono de
 * React no puede montarse acá.
 */
export function htmlPinLiceo(seleccionado = false): string {
  const tamano = seleccionado ? TAMANO_PIN_LICEO + 6 : TAMANO_PIN_LICEO;
  const glifo = Math.round(tamano * 0.55);
  return `<div class="sig-pin sig-pin--liceo" style="width:${tamano}px;height:${tamano}px;background:${COLOR_LICEO}">`
    + `<svg viewBox="0 0 24 24" width="${glifo}" height="${glifo}" fill="none" stroke="#fff" `
    + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>`
    + `</svg></div>`;
}
