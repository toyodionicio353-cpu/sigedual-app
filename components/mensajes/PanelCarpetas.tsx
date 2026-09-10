"use client";
import { Inbox, Star, Send, FileText, Trash2, PenSquare } from "lucide-react";
import type { CarpetaMensajes } from "@/lib/mensajes/useConversaciones";

const CARPETAS: { id: CarpetaMensajes; label: string; icon: React.ReactNode }[] = [
  { id: "recibidos", label: "Recibidos", icon: <Inbox size={16} strokeWidth={2.25} /> },
  { id: "destacados", label: "Destacados", icon: <Star size={16} strokeWidth={2.25} /> },
  { id: "enviados", label: "Enviados", icon: <Send size={16} strokeWidth={2.25} /> },
  { id: "borradores", label: "Borradores", icon: <FileText size={16} strokeWidth={2.25} /> },
  { id: "papelera", label: "Papelera", icon: <Trash2 size={16} strokeWidth={2.25} /> },
];

export default function PanelCarpetas({
  carpeta, onCambiar, noLeidos, borradores, onRedactar,
}: {
  carpeta: CarpetaMensajes;
  onCambiar: (c: CarpetaMensajes) => void;
  noLeidos: number;
  borradores: number;
  onRedactar: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onRedactar}
        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mb-3"
      >
        <PenSquare size={16} />
        Redactar
      </button>

      {CARPETAS.map((c) => {
        const activa = c.id === carpeta;
        const contador = c.id === "recibidos" ? noLeidos : c.id === "borradores" ? borradores : 0;
        return (
          <button
            key={c.id}
            onClick={() => onCambiar(c.id)}
            style={{
              background: activa ? "var(--accent)22" : "transparent",
              color: activa ? "var(--text-primary)" : "var(--text-secondary)",
              borderLeft: `3px solid ${activa ? "var(--accent)" : "transparent"}`,
            }}
            className="flex items-center gap-2.5 pl-3 pr-3 py-2.5 rounded-lg text-sm hover:[background:var(--hover-overlay)] transition-colors text-left"
          >
            <span style={{ color: activa ? "var(--accent-light)" : "var(--text-muted)", flexShrink: 0 }}>{c.icon}</span>
            <span className={`flex-1 truncate ${activa ? "font-semibold" : "font-medium"}`}>{c.label}</span>
            {contador > 0 && (
              <span
                style={{ background: activa ? "var(--accent)" : "var(--bg-surface)", color: activa ? "var(--text-on-accent)" : "var(--text-secondary)" }}
                className="px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums flex-shrink-0"
              >
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
