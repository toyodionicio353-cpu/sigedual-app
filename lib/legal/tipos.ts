// Tipos del contenido legal (Términos, Condiciones y Política de Privacidad).
// El contenido en sí (lib/legal/contenido/*) es una fuente cerrada: se
// transcribe tal como fue entregado, sin resumir ni reescribir. Estos tipos
// solo describen su ESTRUCTURA (títulos, subtítulos, párrafos, listas) para
// que la presentación (DocumentoLegal) pueda renderizarla fielmente sin
// tener que interpretar texto libre.

export type BloqueLegal =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  /** Lista donde cada viñeta es "Término: descripción" (el patrón más común
   * en este documento: "* Nombre del concepto: explicación."). */
  | { tipo: "lista_definiciones"; items: { termino: string; descripcion: string }[] };

export interface SeccionLegal {
  /** Ancla de navegación, ej. "1-1" para la sección 1.1. */
  id: string;
  /** Numeración original del documento, ej. "1.1." — nunca se reemplaza. */
  numero: string;
  titulo: string;
  bloques: BloqueLegal[];
}

export interface ParteLegal {
  /** Ancla de navegación, ej. "parte-1". */
  id: string;
  numero: number;
  titulo: string;
  /** false mientras el contenido de esta parte no haya sido entregado
   * completo — nunca se completa por inferencia, solo se marca pendiente. */
  completo: boolean;
  secciones: SeccionLegal[];
}
