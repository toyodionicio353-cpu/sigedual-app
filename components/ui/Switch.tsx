"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string; // para lectores de pantalla (aria-label)
  disabled?: boolean;
}

export default function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        background: checked ? "var(--accent)" : "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      className="w-11 h-6 min-w-11 rounded-full relative transition-colors flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--accent)]"
    >
      <span
        style={{ background: checked ? "var(--text-on-accent)" : "#fff", left: checked ? 22 : 3, top: 2 }}
        className="absolute w-4 h-4 rounded-full transition-all"
      />
    </button>
  );
}
