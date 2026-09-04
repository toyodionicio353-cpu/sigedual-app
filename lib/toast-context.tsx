"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

interface ToastContextValue {
  mostrar: (mensaje: string, tipo?: TipoToast) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONOS: Record<TipoToast, React.ReactNode> = {
  exito: <CheckCircle2 size={18} style={{ color: "var(--success)" }} />,
  error: <XCircle size={18} style={{ color: "var(--danger)" }} />,
  info: <Info size={18} style={{ color: "var(--accent-light)" }} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const mostrar = useCallback((mensaje: string, tipo: TipoToast = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-80"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12 }}
            className="flex items-center gap-2.5 px-4 py-3 shadow-2xl animate-[fadeIn_0.15s_ease-out]"
          >
            {ICONOS[toast.tipo]}
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium flex-1">{toast.mensaje}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
