"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ESTADO_TICKET_LABEL, ESTADO_TICKET_COLOR, numeroTicket } from "@/lib/tickets/constantes";
import TituloPagina from "@/components/TituloPagina";
import type { Ticket } from "@/types";
import { ChevronRight, LifeBuoy } from "lucide-react";

export default function MisTicketsPage() {
  const { usuario } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, "tickets"), where("creadoPor", "==", usuario!.uid), orderBy("creadoEn", "desc"))
      );
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
      setLoading(false);
    }
    cargar();
  }, [usuario]);

  if (!usuario) return null;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<LifeBuoy size={28} />}>Mis tickets</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Solicitudes de ayuda o incidencias que has reportado.
          </p>
        </div>
        <Link href="/dashboard/soporte/tickets/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0">
          + Crear ticket
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : tickets.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay tickets pendientes.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Si necesitas ayuda, reporta un problema o haz una solicitud.</p>
          <Link href="/dashboard/soporte/tickets/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            + Crear ticket
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <Link key={t.id} href={`/dashboard/soporte/tickets/${t.id}`}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              className="rounded-2xl p-4 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-mono">{numeroTicket(t.numero)}</p>
                  <span style={{ color: ESTADO_TICKET_COLOR[t.estado], background: ESTADO_TICKET_COLOR[t.estado] + "22" }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                    {ESTADO_TICKET_LABEL[t.estado]}
                  </span>
                </div>
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mt-0.5 truncate">{t.asunto}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{new Date(t.creadoEn).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
