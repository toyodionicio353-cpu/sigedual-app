"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  ESTADO_TICKET_LABEL, ESTADO_TICKET_COLOR, ESTADOS_TICKET_ORDEN, ESTADOS_TICKET_ABIERTOS,
  PRIORIDAD_TICKET_LABEL, PRIORIDAD_TICKET_COLOR, numeroTicket,
} from "@/lib/tickets/constantes";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { EstadoTicket, PrioridadTicket, Ticket } from "@/types";
import { ChevronRight, LifeBuoy, Search } from "lucide-react";

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function TicketsAdminPage() {
  const { usuario } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");

  const esAdmin = usuario?.rol === "administrador";

  useEffect(() => {
    if (!usuario || !esAdmin) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "tickets"), orderBy("creadoEn", "desc")));
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
      setLoading(false);
    }
    cargar();
  }, [usuario, esAdmin]);

  const contadores = useMemo(() => {
    const porEstado: Record<EstadoTicket, number> = { nuevo: 0, abierto: 0, en_revision: 0, en_proceso: 0, esperando_respuesta: 0, resuelto: 0, cerrado: 0 };
    tickets.forEach((t) => { porEstado[t.estado] += 1; });
    const abiertos = ESTADOS_TICKET_ABIERTOS.reduce((acc, e) => acc + porEstado[e], 0);
    const criticos = tickets.filter((t) => t.prioridad === "critica" && ESTADOS_TICKET_ABIERTOS.includes(t.estado)).length;
    return { porEstado, abiertos, criticos };
  }, [tickets]);

  const filtrados = useMemo(() => {
    let base = tickets;
    if (filtroEstado) base = base.filter((t) => t.estado === filtroEstado);
    if (filtroPrioridad) base = base.filter((t) => t.prioridad === filtroPrioridad);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((t) => normalizar(t.asunto).includes(q) || normalizar(t.creadoPorNombre).includes(q) || normalizar(numeroTicket(t.numero)).includes(q));
    }
    return base;
  }, [tickets, filtroEstado, filtroPrioridad, busqueda]);

  if (usuario && !esAdmin) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <TituloPagina icon={<LifeBuoy size={28} />}>Tickets</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Solicitudes de ayuda, problemas e incidencias reportadas por los usuarios de SIGEDUAL.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">{contadores.abiertos}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Abiertos</p>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <p style={{ color: "var(--accent-light)" }} className="text-2xl font-bold">{contadores.porEstado.nuevo}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Nuevos</p>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <p style={{ color: "var(--danger)" }} className="text-2xl font-bold">{contadores.criticos}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Críticos, requieren atención</p>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <p style={{ color: "var(--success)" }} className="text-2xl font-bold">{contadores.porEstado.resuelto}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Resueltos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, asunto o usuario..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <Select value={filtroEstado} onChange={setFiltroEstado} ariaLabel="Estado" className="w-full sm:w-48 flex-shrink-0"
          opciones={[{ value: "", label: "Todos los estados" }, ...ESTADOS_TICKET_ORDEN.map((e) => ({ value: e, label: ESTADO_TICKET_LABEL[e] }))]} />
        <Select value={filtroPrioridad} onChange={setFiltroPrioridad} ariaLabel="Prioridad" className="w-full sm:w-44 flex-shrink-0"
          opciones={[{ value: "", label: "Todas las prioridades" }, ...(["baja", "media", "alta", "critica"] as PrioridadTicket[]).map((p) => ({ value: p, label: PRIORIDAD_TICKET_LABEL[p] }))]} />
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : tickets.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay tickets pendientes.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Los tickets que reporten los usuarios aparecerán aquí.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos tickets que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((t) => (
            <Link key={t.id} href={`/dashboard/soporte/tickets/${t.id}`}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              className="rounded-2xl p-4 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-mono">{numeroTicket(t.numero)}</p>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: PRIORIDAD_TICKET_COLOR[t.prioridad], background: PRIORIDAD_TICKET_COLOR[t.prioridad] + "22" }} className="text-xs px-2 py-0.5 rounded-full">
                      {PRIORIDAD_TICKET_LABEL[t.prioridad]}
                    </span>
                    <span style={{ color: ESTADO_TICKET_COLOR[t.estado], background: ESTADO_TICKET_COLOR[t.estado] + "22" }} className="text-xs px-2 py-0.5 rounded-full">
                      {ESTADO_TICKET_LABEL[t.estado]}
                    </span>
                  </div>
                </div>
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mt-0.5 truncate">{t.asunto}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                  {t.creadoPorNombre} · {new Date(t.creadoEn).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
