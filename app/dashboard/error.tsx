"use client";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-8 text-center">
        <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Ocurrió un error al mostrar esta página</p>
        <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">{error.message || "Error desconocido."}</p>
        <button
          onClick={reset}
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <RotateCcw size={16} />
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
