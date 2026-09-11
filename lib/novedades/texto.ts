import type { SegmentoTexto } from "@/types";

/** Tope de la descripción, contando sin espacios (ver `contarCaracteres`). */
export const MAX_CARACTERES = 2500;
/** Tope del título. Acotado a propósito: un título es una línea, no un párrafo. */
export const MAX_TITULO = 120;
/** Cuánto se muestra en la tarjeta antes de "Ver más". */
export const RESUMEN_CARACTERES = 200;
export const MAX_IMAGENES = 5;

/**
 * Cuenta los caracteres de la descripción SIN contar espacios.
 *
 * Dos decisiones importantes:
 *
 * 1. Se descarta todo el espacio en blanco — espacios, tabulaciones y
 *    saltos de línea — no solo el espacio simple. Si los saltos contaran
 *    como "no espacio", bastaría con escribir en columna para saltarse el
 *    límite, que es justo lo que el requerimiento quiere evitar.
 *
 * 2. Se cuenta por GRAFEMAS, no por unidades de código. En JavaScript
 *    "👨‍👩‍👧".length vale 8 y [..."👨‍👩‍👧"].length vale 5, cuando para
 *    quien escribe es un solo emoji. `Intl.Segmenter` agrupa lo que el
 *    usuario percibe como un carácter; sin él, un texto con emojis
 *    alcanzaría el tope mucho antes de lo que la persona ve en pantalla.
 */
export function contarCaracteres(texto: string): number {
  const sinEspacios = texto.replace(/\s+/gu, "");
  return grafemas(sinEspacios).length;
}

/** Divide en grafemas (lo que una persona percibe como un carácter). */
export function grafemas(texto: string): string[] {
  // Intl.Segmenter existe en todos los navegadores actuales y en Node 18+,
  // pero el respaldo evita romperse en un entorno que no lo traiga.
  const Segmentador = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmentador) {
    return Array.from(new Segmentador("es", { granularity: "grapheme" }).segment(texto), (s) => s.segment);
  }
  return Array.from(texto);
}

/** Texto plano de una descripción por segmentos, sin perder los saltos. */
export function textoPlano(descripcion: SegmentoTexto[]): string {
  return descripcion.map((s) => s.texto).join("");
}

/** Caracteres usados por una descripción completa. */
export function caracteresUsados(descripcion: SegmentoTexto[]): number {
  return contarCaracteres(textoPlano(descripcion));
}

/**
 * Resumen para la tarjeta: los primeros 200 caracteres visibles.
 *
 * Acá los espacios SÍ cuentan, al revés que en el límite de
 * almacenamiento: esto mide cuánto ocupa en pantalla, no cuánto contenido
 * se permitió escribir. Corta en el último espacio para no partir una
 * palabra por la mitad.
 */
export function resumen(descripcion: SegmentoTexto[], limite = RESUMEN_CARACTERES): { texto: string; recortado: boolean } {
  const plano = textoPlano(descripcion).replace(/\s+/gu, " ").trim();
  const partes = grafemas(plano);
  if (partes.length <= limite) return { texto: plano, recortado: false };

  const cortado = partes.slice(0, limite).join("");
  const ultimoEspacio = cortado.lastIndexOf(" ");
  const limpio = ultimoEspacio > limite * 0.6 ? cortado.slice(0, ultimoEspacio) : cortado;
  return { texto: `${limpio.trimEnd()}…`, recortado: true };
}

/**
 * Deja la descripción en su forma mínima: quita segmentos vacíos y funde
 * los contiguos que comparten estilo. Sin esto, escribir y borrar negrita
 * va dejando decenas de fragmentos que dicen lo mismo.
 */
export function normalizarDescripcion(segmentos: SegmentoTexto[]): SegmentoTexto[] {
  const salida: SegmentoTexto[] = [];
  for (const bruto of segmentos) {
    if (!bruto.texto) continue;
    const actual: SegmentoTexto = bruto.negrita ? { texto: bruto.texto, negrita: true } : { texto: bruto.texto };
    const anterior = salida[salida.length - 1];
    if (anterior && Boolean(anterior.negrita) === Boolean(actual.negrita)) {
      anterior.texto += actual.texto;
    } else {
      salida.push(actual);
    }
  }
  return salida;
}
