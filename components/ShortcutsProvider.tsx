"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias/context";
import { X } from "lucide-react";

export const EVENTO_ABRIR_ATAJOS = "sigedual-shortcuts-open";

interface Atajo {
  tecla: string;
  descripcion: string;
  href?: string;
}

const ATAJOS: Atajo[] = [
  { tecla: "G", descripcion: "Ir al Dashboard", href: "/dashboard" },
  { tecla: "E", descripcion: "Ir a Estudiantes", href: "/dashboard/estudiantes" },
  { tecla: "C", descripcion: "Ir a Centros Duales", href: "/dashboard/centros" },
  { tecla: "M", descripcion: "Ir a Mensajes", href: "/dashboard/mensajes" },
  { tecla: "S", descripcion: "Ir a Soporte", href: "/dashboard/soporte" },
  { tecla: "?", descripcion: "Ver todos los atajos" },
  { tecla: "Ctrl/Cmd + K", descripcion: "Abrir la paleta de comandos" },
];

function estaEscribiendo(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Atajos de navegación de una sola tecla (activos solo si el foco no está
 * en un campo de texto) + modal "Ver todos los atajos". No usa combinaciones
 * con Ctrl/Alt/Cmd para no interferir con los atajos propios del navegador. */
export default function ShortcutsProvider() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const router = useRouter();
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    function abrir() { setMostrarModal(true); }
    window.addEventListener(EVENTO_ABRIR_ATAJOS, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_ATAJOS, abrir);
  }, []);

  // Escape siempre puede cerrar el modal, independiente del interruptor de atajos.
  useEffect(() => {
    if (!mostrarModal) return;
    function alEscapar(e: KeyboardEvent) {
      if (e.key === "Escape") setMostrarModal(false);
    }
    window.addEventListener("keydown", alEscapar);
    return () => window.removeEventListener("keydown", alEscapar);
  }, [mostrarModal]);

  useEffect(() => {
    if (!preferencias.atajosTeclado || !usuario) return;
    function alPresionar(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (estaEscribiendo(e.target)) return;
      if (e.key === "Escape") return;
      if (e.key === "?") { setMostrarModal(true); return; }
      const destinos: Record<string, string> = {
        g: "/dashboard", e: "/dashboard/estudiantes", c: "/dashboard/centros",
        m: "/dashboard/mensajes", s: "/dashboard/soporte",
      };
      const tecla = e.key.toLowerCase();
      if (tecla === "m" && usuario?.rol !== "administrador") return;
      const destino = destinos[tecla];
      if (destino) router.push(destino);
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [preferencias.atajosTeclado, usuario, router]);

  if (!mostrarModal) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={() => setMostrarModal(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 16 }}
        className="w-full max-w-sm p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">Atajos de teclado</h2>
          <button onClick={() => setMostrarModal(false)} aria-label="Cerrar" style={{ color: "var(--text-muted)" }} className="p-1 hover:[color:var(--text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {ATAJOS.map((a) => (
            <li key={a.tecla} className="flex items-center justify-between gap-3">
              <span style={{ color: "var(--text-secondary)" }} className="text-sm">{a.descripcion}</span>
              <kbd style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-light)" }} className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0">{a.tecla}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
