"use client";
import { Printer } from "lucide-react";

/**
 * Imprime la pantalla en la que está.
 *
 * No necesita saber qué se imprime: de eso se encargan dos clases de
 * app/globals.css — `no-imprimir` en lo que es de la aplicación y
 * `hoja-impresa` en el documento. Así el mismo botón sirve en Visitas,
 * Convenios, Evaluaciones y Documentos sin configurar nada.
 */
export default function BotonImprimir({ etiqueta = "Imprimir", className = "" }: { etiqueta?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      className={`no-imprimir flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 ${className}`}
    >
      <Printer size={16} />
      {etiqueta}
    </button>
  );
}
