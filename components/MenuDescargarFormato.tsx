"use client";
import { useState } from "react";
import { MoreVertical, FileDown } from "lucide-react";

/**
 * Los tres puntos con "Descargar formato (Word)".
 *
 * Solo descarga si el documento está completo: lo que se baja se termina
 * en Word y vuelve impreso, así que un documento a medias se descubriría
 * demasiado tarde. Cuando falta algo, el menú dice exactamente qué falta
 * en vez de limitarse a estar apagado.
 */
export default function MenuDescargarFormato({
  onDescargar,
  motivoIncompleto,
}: {
  onDescargar: () => Promise<void> | void;
  /** Vacío cuando el documento está listo. */
  motivoIncompleto: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative no-imprimir">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más opciones"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        className="flex items-center justify-center w-10 h-10 rounded-xl hover:opacity-90 transition-opacity flex-shrink-0"
      >
        <MoreVertical size={16} />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="absolute right-0 top-full mt-1 w-72 rounded-xl shadow-2xl overflow-hidden z-40 py-1"
          >
            <button
              type="button"
              onClick={async () => { setAbierto(false); if (!motivoIncompleto) await onDescargar(); }}
              disabled={Boolean(motivoIncompleto)}
              style={{ color: motivoIncompleto ? "var(--text-muted)" : "var(--text-primary)" }}
              className="flex items-start gap-2.5 px-4 py-3 text-sm w-full text-left hover:[background:var(--hover-overlay)] transition-colors disabled:cursor-not-allowed"
            >
              <FileDown size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                Descargar formato (Word)
                <span style={{ color: "var(--text-muted)" }} className="block text-xs mt-0.5">
                  {motivoIncompleto || "Para ponerle el logo y el formato de tu liceo."}
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
