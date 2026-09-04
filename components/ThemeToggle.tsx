"use client";
import { Sun, Moon } from "lucide-react";
import { usePreferencias, resolverTema } from "@/lib/preferencias/context";

export default function ThemeToggle() {
  const { preferencias, actualizar } = usePreferencias();
  const temaActual = resolverTema(preferencias.tema);

  function alternar() {
    actualizar("tema", temaActual === "oscuro" ? "claro" : "oscuro");
  }

  return (
    <button
      onClick={alternar}
      title={temaActual === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)" }}
      className="w-8 h-8 flex items-center justify-center hover:[color:var(--text-primary)] transition-colors flex-shrink-0"
    >
      {temaActual === "oscuro" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
