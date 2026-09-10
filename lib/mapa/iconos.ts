import {
  COLOR_CENTRO, COLOR_PRACTICA,
  type EstadoPinCentro, type EstadoPinPractica,
} from "./estados";

/**
 * HTML de los marcadores. Leaflet los inserta fuera del árbol de React
 * (divIcon recibe una cadena), por eso se arman acá y las clases viven en
 * components/mapa/mapa.css.
 *
 * El tipo de actividad se distingue por FORMA además de color — círculo
 * para Formación Dual, rombo para Práctica Profesional — para que no
 * dependa de poder diferenciar el rosado del resto de la paleta.
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
