"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const actual = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    setTheme(actual);
  }, []);

  function alternar() {
    const nuevo = theme === "dark" ? "light" : "dark";
    setTheme(nuevo);
    document.documentElement.setAttribute("data-theme", nuevo);
    try {
      localStorage.setItem("sigedual-theme", nuevo);
    } catch {
      // localStorage no disponible; el tema simplemente no persistirá.
    }
  }

  return (
    <button
      onClick={alternar}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)" }}
      className="w-8 h-8 flex items-center justify-center hover:[color:var(--text-primary)] transition-colors flex-shrink-0"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
