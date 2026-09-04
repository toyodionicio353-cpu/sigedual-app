"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface OpcionSelect {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

/** Select con la misma apariencia en todos los navegadores y dispositivos,
 * consistente con la identidad visual de SIGEDUAL — reemplaza el <select>
 * nativo, cuyo menú desplegable lo dibuja el sistema operativo y no puede
 * estilizarse (por eso se ve genérico en móvil). */
export default function Select({ value, onChange, opciones, placeholder, disabled, ariaLabel, className, id }: SelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const opcionesRef = useRef<(HTMLLIElement | null)[]>([]);

  const seleccionada = opciones.find((o) => o.value === value);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (abierto) {
      const idx = Math.max(0, opciones.findIndex((o) => o.value === value));
      setActivo(idx);
      opcionesRef.current[idx]?.scrollIntoView({ block: "nearest" });
    }
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(opcion: OpcionSelect) {
    if (opcion.disabled) return;
    onChange(opcion.value);
    setAbierto(false);
  }

  function alPresionar(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!abierto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setAbierto(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => Math.min(i + 1, opciones.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const o = opciones[activo]; if (o) elegir(o); return; }
    if (e.key === "Tab") setAbierto(false);
  }

  return (
    <div ref={raiz} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setAbierto((v) => !v)}
        onKeyDown={alPresionar}
        style={{
          background: "var(--bg-base)",
          border: `1px solid ${abierto ? "var(--accent)" : "var(--border-light)"}`,
          color: seleccionada ? "var(--text-primary)" : "var(--text-muted)",
        }}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-left">{seleccionada?.label ?? placeholder ?? "Selecciona una opción"}</span>
        <ChevronDown size={15} style={{ color: "var(--text-muted)", transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} className="flex-shrink-0" />
      </button>

      {abierto && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12 }}
          className="absolute left-0 right-0 mt-1.5 z-30 shadow-2xl max-h-60 overflow-y-auto py-1"
        >
          {opciones.length === 0 ? (
            <li style={{ color: "var(--text-muted)" }} className="px-3 py-2 text-sm text-center">Sin opciones.</li>
          ) : (
            opciones.map((o, i) => {
              const esActiva = i === activo;
              const esSeleccionada = o.value === value;
              return (
                <li
                  key={o.value}
                  ref={(el) => { opcionesRef.current[i] = el; }}
                  role="option"
                  aria-selected={esSeleccionada}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(o)}
                  style={{
                    background: esActiva ? "var(--hover-overlay)" : "transparent",
                    color: o.disabled ? "var(--text-muted)" : "var(--text-primary)",
                    cursor: o.disabled ? "not-allowed" : "pointer",
                    opacity: o.disabled ? 0.5 : 1,
                  }}
                  className="px-3 py-2 text-sm flex items-center justify-between gap-2 mx-1 rounded-lg"
                >
                  <span className="truncate">{o.label}</span>
                  {esSeleccionada && <Check size={14} style={{ color: "var(--accent-light)" }} className="flex-shrink-0" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
