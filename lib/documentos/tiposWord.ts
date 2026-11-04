/** Un párrafo tal como se escribe en el .docx: trozos de texto, algunos
 *  en negrita. El mismo formato que usan las plantillas en pantalla. */
export interface ParrafoWord {
  runs: { texto: string; negrita?: boolean }[];
  alineacion?: "justificada" | "izquierda";
}
