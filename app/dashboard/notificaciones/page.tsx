"use client";
import { useState } from "react";
import { useNotificaciones } from "@/lib/notificaciones/useNotificaciones";
import ListaNotificaciones from "@/components/notificaciones/ListaNotificaciones";
import TituloPagina from "@/components/TituloPagina";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

export default function NotificacionesPage() {
  const {
    pendientes, leidas, noLeidas, cargando,
    marcarLeida, marcarTodasLeidas, eliminarNotificacion, eliminarLeidas,
  } = useNotificaciones(100);

  // La bandeja son los pendientes. Las leídas siguen guardadas y se
  // consultan acá mismo, pero no estorban: un aviso ya atendido no es
  // trabajo por hacer.
  const [verLeidas, setVerLeidas] = useState(false);
  const visibles = verLeidas ? leidas : pendientes;

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <TituloPagina icon={<Bell size={28} />}>Notificaciones</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {noLeidas > 0
              ? `Tienes ${noLeidas} ${noLeidas === 1 ? "notificación pendiente" : "notificaciones pendientes"}.`
              : "Todo al día."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {noLeidas > 0 && !verLeidas && (
            <button
              onClick={marcarTodasLeidas}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
            >
              <CheckCheck size={15} />
              Marcar todas
            </button>
          )}
          {verLeidas && leidas.length > 0 && (
            <button
              onClick={() => { if (confirm("¿Eliminar el historial de notificaciones ya vistas?")) eliminarLeidas(); }}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--danger)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--danger)] transition-colors"
            >
              <Trash2 size={15} />
              Vaciar historial
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => setVerLeidas(false)}
          style={{
            color: verLeidas ? "var(--text-muted)" : "var(--text-primary)",
            borderBottom: verLeidas ? "2px solid transparent" : "2px solid var(--accent)",
          }}
          className="pb-1.5 text-sm font-semibold transition-colors"
        >
          Pendientes{pendientes.length > 0 ? ` (${pendientes.length})` : ""}
        </button>
        <button
          onClick={() => setVerLeidas(true)}
          style={{
            color: verLeidas ? "var(--text-primary)" : "var(--text-muted)",
            borderBottom: verLeidas ? "2px solid var(--accent)" : "2px solid transparent",
          }}
          className="pb-1.5 text-sm font-semibold transition-colors"
        >
          Ya vistas{leidas.length > 0 ? ` (${leidas.length})` : ""}
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="overflow-hidden">
        <ListaNotificaciones
          notificaciones={visibles}
          cargando={cargando}
          onMarcarLeida={marcarLeida}
          onEliminar={eliminarNotificacion}
          vacioTitulo={verLeidas ? "Sin historial" : "Todo al día"}
          vacioDescripcion={
            verLeidas
              ? "Acá quedan los avisos que ya atendiste."
              : "No tienes avisos pendientes. Los que ya viste quedan en \"Ya vistas\"."
          }
        />
      </div>
    </div>
  );
}
