/**
 * Un bloque del .docx. Son los mínimos que hacen falta para que un
 * documento de SIGEDUAL se lea bien en papel; no es un formateador de
 * textos, que es justamente lo que el liceo hará en Word.
 */
export type BloqueWord =
  /** Párrafo corrido: trozos de texto, algunos en negrita. */
  | { tipo: "parrafo"; runs: { texto: string; negrita?: boolean }[]; alineacion?: "justificada" | "izquierda" }
  /** Encabezado de sección. */
  | { tipo: "titulo"; texto: string; nivel?: 1 | 2 }
  /** Dato y su valor, en una línea: "Centro Dual: Oficina de Contabilidad". */
  | { tipo: "dato"; etiqueta: string; valor: string }
  /** Separación en blanco entre secciones. */
  | { tipo: "espacio" };

/** Compatibilidad con el primer uso (convenios y documentos). */
export interface ParrafoWord {
  runs: { texto: string; negrita?: boolean }[];
  alineacion?: "justificada" | "izquierda";
}
