"use client";
import { Star } from "lucide-react";
import { fechaBandeja, inicial, colorAvatar } from "@/lib/mensajes/formato";
import type { Conversacion } from "@/types";

export default function FilaConversacion({
  conversacion, titulo, sinLeer, destacada, seleccionada, formatoHora,
  onAbrir, onSeleccionar, onDestacar,
}: {
  conversacion: Conversacion;
  /** Con quién es el hilo, ya resuelto por la página (nombres reales). */
  titulo: string;
  sinLeer: boolean;
  destacada: boolean;
  seleccionada: boolean;
  formatoHora: "12" | "24";
  onAbrir: () => void;
  onSeleccionar: (valor: boolean) => void;
  onDestacar: () => void;
}) {
  const asunto = conversacion.asunto || conversacion.nombre || "(sin asunto)";
  const cantidad = conversacion.cantidadMensajes ?? 0;

  return (
    <div
      style={{
        background: sinLeer ? "var(--bg-surface)" : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:[background:var(--hover-overlay)] transition-colors"
    >
      <input
        type="checkbox"
        checked={seleccionada}
        onChange={(e) => onSeleccionar(e.target.checked)}
        aria-label={`Seleccionar ${asunto}`}
        style={{ accentColor: "var(--accent)" }}
        className="flex-shrink-0 cursor-pointer"
      />
      <button
        onClick={onDestacar}
        title={destacada ? "Quitar destacado" : "Destacar"}
        aria-label={destacada ? "Quitar destacado" : "Destacar"}
        className="flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        <Star
          size={16}
          style={{ color: destacada ? "var(--accent)" : "var(--text-muted)" }}
          fill={destacada ? "var(--accent)" : "none"}
        />
      </button>

      <button onClick={onAbrir} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <span
          style={{ background: colorAvatar(titulo), color: "var(--text-on-accent)" }}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          aria-hidden
        >
          {inicial(titulo)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              style={{ color: "var(--text-primary)" }}
              className={`text-sm truncate ${sinLeer ? "font-bold" : "font-medium"}`}
            >
              {titulo}
            </span>
            {cantidad > 1 && (
              <span style={{ color: "var(--text-muted)" }} className="text-xs tabular-nums flex-shrink-0">
                {cantidad}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 min-w-0">
            <span
              style={{ color: "var(--text-primary)" }}
              className={`text-sm truncate ${sinLeer ? "font-semibold" : "font-normal"}`}
            >
              {asunto}
            </span>
            {conversacion.ultimoMensaje && (
              <span style={{ color: "var(--text-muted)" }} className="text-sm truncate hidden sm:inline">
                — {conversacion.ultimoMensaje}
              </span>
            )}
          </span>
          {conversacion.ultimoMensaje && (
            <span style={{ color: "var(--text-muted)" }} className="text-xs truncate block sm:hidden">
              {conversacion.ultimoMensaje}
            </span>
          )}
        </span>

        <span
          style={{ color: sinLeer ? "var(--text-primary)" : "var(--text-muted)" }}
          className={`text-xs flex-shrink-0 tabular-nums ${sinLeer ? "font-semibold" : ""}`}
        >
          {fechaBandeja(conversacion.ultimaActividad, formatoHora)}
        </span>
      </button>
    </div>
  );
}
