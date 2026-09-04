"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { crearTicket } from "@/lib/tickets/crearTicket";
import { TIPO_TICKET_LABEL, PRIORIDAD_TICKET_LABEL } from "@/lib/tickets/constantes";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { PrioridadTicket, TipoTicket } from "@/types";
import { LifeBuoy } from "lucide-react";

export default function CrearTicketPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoTicket>("problema");
  const [prioridad, setPrioridad] = useState<PrioridadTicket>("media");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const puedeGuardar = asunto.trim() && descripcion.trim();

  async function enviar() {
    if (!usuario || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const { id } = await crearTicket({
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        tipo,
        prioridad,
        creadoPor: usuario.uid,
        creadoPorNombre: usuario.nombre,
        liceoId: usuario.liceoId,
      });
      router.push(`/dashboard/soporte/tickets/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear el ticket.");
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario) return null;

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-6">
        <TituloPagina icon={<LifeBuoy size={28} />}>Crear ticket</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Informa un problema, solicita ayuda o reporta una incidencia. El administrador lo revisará.
        </p>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Asunto *</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Resumen breve del problema o solicitud"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Tipo</label>
            <Select value={tipo} onChange={(v) => setTipo(v as TipoTicket)} ariaLabel="Tipo"
              opciones={Object.entries(TIPO_TICKET_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Prioridad</label>
            <Select value={prioridad} onChange={(v) => setPrioridad(v as PrioridadTicket)} ariaLabel="Prioridad"
              opciones={Object.entries(PRIORIDAD_TICKET_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Descripción *</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5}
            placeholder="Describe el problema o la solicitud con el mayor detalle posible."
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-none" />
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={enviar}
            disabled={!puedeGuardar || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Enviando..." : "Enviar ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
