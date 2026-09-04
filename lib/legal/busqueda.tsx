import type { ReactNode } from "react";
import type { BloqueLegal, ParteLegal } from "./tipos";

export interface CoincidenciaBusqueda {
  parteId: string;
  parteNumero: number;
  seccionId: string;
  seccionNumero: string;
  seccionTitulo: string;
  fragmento: string;
}

function textoDeBloque(bloque: BloqueLegal): string[] {
  if (bloque.tipo === "parrafo") return [bloque.texto];
  if (bloque.tipo === "lista") return bloque.items;
  return bloque.items.map((i) => `${i.termino}: ${i.descripcion}`);
}

function fragmentoAlrededorDe(texto: string, query: string, radio = 60): string {
  const idx = texto.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return texto.slice(0, radio * 2);
  const inicio = Math.max(0, idx - radio);
  const fin = Math.min(texto.length, idx + query.length + radio);
  return `${inicio > 0 ? "…" : ""}${texto.slice(inicio, fin)}${fin < texto.length ? "…" : ""}`;
}

/** Búsqueda simple de texto (sin distinguir mayúsculas/acentos exactos) sobre
 * el contenido ya cargado — nunca modifica el texto original, solo lo indexa. */
export function buscarEnDocumento(partes: ParteLegal[], query: string): CoincidenciaBusqueda[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const resultados: CoincidenciaBusqueda[] = [];

  for (const parte of partes) {
    for (const seccion of parte.secciones) {
      const titulo = `${seccion.numero} ${seccion.titulo}`;
      if (titulo.toLowerCase().includes(q)) {
        resultados.push({
          parteId: parte.id, parteNumero: parte.numero,
          seccionId: seccion.id, seccionNumero: seccion.numero, seccionTitulo: seccion.titulo,
          fragmento: titulo,
        });
      }
      for (const bloque of seccion.bloques) {
        for (const texto of textoDeBloque(bloque)) {
          if (texto.toLowerCase().includes(q)) {
            resultados.push({
              parteId: parte.id, parteNumero: parte.numero,
              seccionId: seccion.id, seccionNumero: seccion.numero, seccionTitulo: seccion.titulo,
              fragmento: fragmentoAlrededorDe(texto, q),
            });
          }
        }
      }
    }
  }
  return resultados.slice(0, 30);
}

/** Envuelve las coincidencias de `query` dentro de <mark> para resaltarlas
 * en pantalla — es puramente visual, el texto en sí no se altera. */
export function resaltar(texto: string, query: string): ReactNode {
  const q = query.trim();
  if (q.length < 2) return texto;
  const partes = texto.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  if (partes.length === 1) return texto;
  return partes.map((parte, i) =>
    parte.toLowerCase() === q.toLowerCase() ? (
      // eslint-disable-next-line react/no-array-index-key
      <mark key={i} style={{ background: "var(--accent)", color: "var(--text-on-accent)", borderRadius: 2 }}>{parte}</mark>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{parte}</span>
    )
  );
}
