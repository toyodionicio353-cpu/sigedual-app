"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, limit as limitFn } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ROL_LABEL } from "@/lib/roles";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { Rol } from "@/types";
import { ScrollText, Search, ShieldCheck, ShieldX } from "lucide-react";

interface EventoAuditoria {
  id: string;
  uid: string;
  nombre: string;
  rol: Rol;
  liceoId: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  resultado: "permitido" | "denegado";
  detalle?: string;
  creadoEn: string;
}

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function AuditoriaPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "administrador";

  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroResultado, setFiltroResultado] = useState("");

  useEffect(() => {
    if (!usuario || !esAdmin) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "auditoria"), orderBy("creadoEn", "desc"), limitFn(200)));
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventoAuditoria)));
      setLoading(false);
    }
    cargar();
  }, [usuario, esAdmin]);

  const filtrados = useMemo(() => {
    let base = eventos;
    if (filtroResultado) base = base.filter((e) => e.resultado === filtroResultado);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      base = base.filter((e) => normalizar(e.nombre).includes(q) || normalizar(e.accion).includes(q) || normalizar(e.recurso).includes(q) || normalizar(e.detalle).includes(q));
    }
    return base;
  }, [eventos, filtroResultado, busqueda]);

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
        <TituloPagina icon={<ScrollText size={28} />}>Auditoría</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Denegaciones de acceso y acciones administrativas sensibles registradas en SIGEDUAL.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por usuario, acción o recurso..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <Select value={filtroResultado} onChange={setFiltroResultado} ariaLabel="Resultado" className="w-full sm:w-52 flex-shrink-0"
          opciones={[{ value: "", label: "Todos los resultados" }, { value: "denegado", label: "Denegados" }, { value: "permitido", label: "Permitidos" }]} />
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : eventos.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Sin eventos registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Las denegaciones de acceso y acciones administrativas sensibles aparecerán aquí.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos eventos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          {filtrados.map((e, i) => (
            <div key={e.id} style={{ borderBottom: i < filtrados.length - 1 ? "1px solid var(--border)" : "none" }} className="px-5 py-3.5 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {e.resultado === "denegado"
                  ? <ShieldX size={16} style={{ color: "var(--danger)" }} />
                  : <ShieldCheck size={16} style={{ color: "var(--success)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{e.accion}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px]">{new Date(e.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">
                  {e.nombre} ({ROL_LABEL[e.rol] ?? e.rol}) · {e.recurso}{e.recursoId ? ` (${e.recursoId})` : ""}
                </p>
                {e.detalle && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{e.detalle}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
