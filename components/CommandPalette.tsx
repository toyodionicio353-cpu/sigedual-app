"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias/context";
import { COMANDOS } from "@/lib/preferencias/comandos";
import { Search } from "lucide-react";

export default function CommandPalette() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preferencias.paletaComandos) return;
    function alPresionar(e: KeyboardEvent) {
      const esCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (esCombo) {
        e.preventDefault();
        setAbierta((v) => !v);
      }
      if (e.key === "Escape") setAbierta(false);
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [preferencias.paletaComandos]);

  useEffect(() => {
    if (abierta) {
      setBusqueda("");
      setIndice(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [abierta]);

  const resultados = useMemo(() => {
    const disponibles = COMANDOS.filter((c) => usuario && c.roles.includes(usuario.rol));
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((c) => c.etiqueta.toLowerCase().includes(q) || c.categoria.toLowerCase().includes(q));
  }, [busqueda, usuario]);

  async function ejecutar(id: string) {
    const cmd = COMANDOS.find((c) => c.id === id);
    if (!cmd) return;
    setAbierta(false);
    if (cmd.accion === "cerrar-sesion") {
      await signOut(auth);
      router.replace("/login");
      return;
    }
    if (cmd.href) router.push(cmd.href);
  }

  if (!preferencias.paletaComandos || !abierta) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-24 px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={() => setAbierta(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 16 }}
        className="w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search size={17} style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setIndice(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndice((i) => Math.min(i + 1, resultados.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && resultados[indice]) ejecutar(resultados[indice].id);
            }}
            placeholder="Buscar una acción o sección..."
            style={{ color: "var(--text-primary)" }}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border-light)" }} className="text-[10px] px-1.5 py-0.5 rounded font-mono">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {resultados.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-6">Sin resultados.</p>
          ) : (
            resultados.map((c, i) => (
              <button
                key={c.id}
                onClick={() => ejecutar(c.id)}
                onMouseEnter={() => setIndice(i)}
                style={{
                  background: i === indice ? "var(--hover-overlay)" : "transparent",
                  color: "var(--text-primary)",
                }}
                className="w-full text-left flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors"
              >
                <span>{c.etiqueta}</span>
                <span style={{ color: "var(--text-muted)" }} className="text-xs">{c.categoria}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
