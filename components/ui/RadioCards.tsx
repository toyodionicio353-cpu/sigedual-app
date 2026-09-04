"use client";

export interface OpcionRadioCard<T extends string> {
  value: T;
  label: string;
  descripcion?: string;
  icon?: React.ReactNode;
}

interface RadioCardsProps<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  opciones: OpcionRadioCard<T>[];
}

export default function RadioCards<T extends string>({ name, value, onChange, opciones }: RadioCardsProps<T>) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(opciones.length, 3)}, minmax(0, 1fr))` }}>
      {opciones.map((op) => {
        const activo = op.value === value;
        return (
          <button
            key={op.value}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(op.value)}
            style={{
              background: activo ? "var(--accent)" : "var(--bg-surface)",
              border: `1px solid ${activo ? "var(--accent)" : "var(--border-light)"}`,
              color: activo ? "var(--text-on-accent)" : "var(--text-primary)",
              borderRadius: 12,
            }}
            className="flex flex-col items-center gap-1.5 px-3 py-3 text-center transition-colors hover:[border-color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--accent)]"
          >
            {op.icon && <span>{op.icon}</span>}
            <span className="text-sm font-semibold leading-tight">{op.label}</span>
            {op.descripcion && (
              <span style={{ color: activo ? "var(--text-on-accent)" : "var(--text-muted)", opacity: activo ? 0.8 : 1 }} className="text-xs leading-tight">
                {op.descripcion}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
