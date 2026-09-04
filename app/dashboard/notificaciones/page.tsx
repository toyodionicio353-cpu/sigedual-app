"use client";
import { useNotificaciones } from "@/lib/notificaciones/useNotificaciones";
import ListaNotificaciones from "@/components/notificaciones/ListaNotificaciones";
import TituloPagina from "@/components/TituloPagina";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificacionesPage() {
  const { notificaciones, noLeidas, cargando, marcarLeida, marcarTodasLeidas } = useNotificaciones(100);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Bell size={28} />}>Notificaciones</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {noLeidas > 0 ? `Tienes ${noLeidas} notificación(es) sin leer.` : "Todo al día."}
          </p>
        </div>
        {noLeidas > 0 && (
          <button
            onClick={marcarTodasLeidas}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors flex-shrink-0"
          >
            <CheckCheck size={15} />
            Marcar todas
          </button>
        )}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="overflow-hidden">
        <ListaNotificaciones notificaciones={notificaciones} cargando={cargando} onMarcarLeida={marcarLeida} />
      </div>
    </div>
  );
}
