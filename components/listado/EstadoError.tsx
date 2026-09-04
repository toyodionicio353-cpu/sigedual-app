import { AlertCircle } from "lucide-react";

/** Estado de error de carga compartido por los listados principales de
 * SIGEDUAL: ícono, mensaje y botón para reintentar la carga. */
export default function EstadoError({
  titulo, onReintentar,
}: {
  titulo: string;
  onReintentar: () => void;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
      <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
      <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">{titulo}</p>
      <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
      <button onClick={onReintentar} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
        Reintentar
      </button>
    </div>
  );
}
