"use client";
import { useEffect, useRef, useState } from "react";
import { Bold } from "lucide-react";
import Select from "@/components/ui/Select";
import { MAX_CARACTERES, caracteresUsados, normalizarDescripcion } from "@/lib/novedades/texto";
import { ETIQUETA_FUENTE, FAMILIA_FUENTE, FUENTES } from "@/lib/novedades/validar";
import type { FuenteNovedad, SegmentoTexto } from "@/types";

/**
 * Editor deliberadamente pobre: tipografía, negrita, emojis y saltos de
 * línea. Nada más — ni tamaños, ni colores, ni títulos gigantes, ni
 * imágenes dentro del texto, ni HTML libre.
 *
 * El contenido NO sale como HTML: al escribir se recorre el DOM y se
 * produce una lista de segmentos `{texto, negrita}`. Así lo que se guarda
 * es texto, la cuenta de caracteres es exacta y la vista pública puede
 * dibujarlo sin `dangerouslySetInnerHTML`.
 */
export default function EditorNovedad({
  descripcion, fuente, onCambiar, deshabilitado,
}: {
  descripcion: SegmentoTexto[];
  fuente: FuenteNovedad;
  onCambiar: (cambios: { descripcion?: SegmentoTexto[]; fuente?: FuenteNovedad }) => void;
  deshabilitado?: boolean;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [negritaActiva, setNegritaActiva] = useState(false);
  const hidratado = useRef(false);

  const usados = caracteresUsados(descripcion);
  const lleno = usados >= MAX_CARACTERES;

  // Se vuelca el contenido en el editor UNA sola vez (o al cargar un
  // borrador). Reescribirlo en cada cambio movería el cursor al principio
  // mientras la persona escribe.
  useEffect(() => {
    if (hidratado.current || !caja.current) return;
    if (descripcion.length === 0) { hidratado.current = true; return; }
    caja.current.replaceChildren(
      ...descripcion.map((s) => {
        const nodo = document.createTextNode(s.texto);
        if (!s.negrita) return nodo;
        const fuerte = document.createElement("strong");
        fuerte.appendChild(nodo);
        return fuerte;
      })
    );
    hidratado.current = true;
  }, [descripcion]);

  /** Recorre el DOM del editor y lo traduce a segmentos. */
  function leerSegmentos(): SegmentoTexto[] {
    const raiz = caja.current;
    if (!raiz) return [];
    const salida: SegmentoTexto[] = [];

    const recorrer = (nodo: Node, negrita: boolean) => {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const texto = nodo.textContent ?? "";
        if (texto) salida.push({ texto, negrita });
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;
      const el = nodo as HTMLElement;
      // Un <div>/<br> del contenteditable es un salto de línea.
      if (el.tagName === "BR") { salida.push({ texto: "\n", negrita }); return; }
      const bloque = el.tagName === "DIV" || el.tagName === "P";
      if (bloque && salida.length > 0) salida.push({ texto: "\n", negrita: false });

      const enNegrita = negrita
        || el.tagName === "B" || el.tagName === "STRONG"
        || Number(el.style.fontWeight) >= 600 || el.style.fontWeight === "bold";
      el.childNodes.forEach((hijo) => recorrer(hijo, enNegrita));
    };

    raiz.childNodes.forEach((hijo) => recorrer(hijo, false));
    return normalizarDescripcion(salida);
  }

  function alEscribir() {
    const segmentos = leerSegmentos();
    // Se avisa del exceso, pero no se recorta el texto a la fuerza: borrar
    // en silencio lo que alguien acaba de escribir es peor que pedirle que
    // lo acorte. El guardado sí lo rechaza.
    onCambiar({ descripcion: segmentos });
  }

  function alternarNegrita() {
    if (deshabilitado) return;
    caja.current?.focus();
    document.execCommand("bold");
    setNegritaActiva(document.queryCommandState("bold"));
    alEscribir();
  }

  function sincronizarEstado() {
    try { setNegritaActiva(document.queryCommandState("bold")); } catch { /* sin soporte */ }
  }

  /** Pegar SIEMPRE como texto plano: si no, entraría el formato (y el
   * marcado) de cualquier página desde la que se copie. */
  function alPegar(e: React.ClipboardEvent) {
    e.preventDefault();
    const texto = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texto);
    alEscribir();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-48">
          <Select
            value={fuente}
            onChange={(v) => onCambiar({ fuente: v as FuenteNovedad })}
            ariaLabel="Tipo de letra"
            disabled={deshabilitado}
            opciones={FUENTES.map((f) => ({ value: f, label: ETIQUETA_FUENTE[f] }))}
          />
        </div>
        <button
          type="button"
          onClick={alternarNegrita}
          disabled={deshabilitado}
          aria-pressed={negritaActiva}
          title="Negrita"
          aria-label="Negrita"
          style={{
            background: negritaActiva ? "var(--accent)" : "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: negritaActiva ? "var(--text-on-accent)" : "var(--text-primary)",
          }}
          className="p-2 rounded-lg disabled:opacity-40"
        >
          <Bold size={15} />
        </button>
        <span style={{ color: "var(--text-muted)" }} className="text-xs">
          Puedes usar emojis y saltos de línea.
        </span>
      </div>

      <div
        ref={caja}
        contentEditable={!deshabilitado}
        suppressContentEditableWarning
        onInput={alEscribir}
        onPaste={alPegar}
        onKeyUp={sincronizarEstado}
        onMouseUp={sincronizarEstado}
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido de la publicación"
        data-marcador={descripcion.length === 0 ? "Escribe aquí el contenido de la publicación..." : undefined}
        style={{
          background: "var(--bg-base)",
          border: `1px solid ${lleno ? "var(--danger)" : "var(--border-light)"}`,
          color: "var(--text-primary)",
          fontFamily: FAMILIA_FUENTE[fuente],
          minHeight: 180,
          whiteSpace: "pre-wrap",
        }}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors overflow-y-auto max-h-80 [&[data-marcador]:empty]:before:content-[attr(data-marcador)] [&:empty]:before:[color:var(--text-muted)]"
      />

      <div className="flex items-center justify-between gap-3">
        <p style={{ color: lleno ? "var(--danger)" : "var(--text-muted)" }} className="text-xs">
          {usados.toLocaleString("es-CL")} / {MAX_CARACTERES.toLocaleString("es-CL")} caracteres
        </p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          Los espacios no cuentan.
        </p>
      </div>

      {lleno && (
        <p style={{ color: "var(--danger)" }} className="text-xs">
          Alcanzaste el límite de {MAX_CARACTERES.toLocaleString("es-CL")} caracteres. Acorta el texto para poder publicar.
        </p>
      )}
    </div>
  );
}
