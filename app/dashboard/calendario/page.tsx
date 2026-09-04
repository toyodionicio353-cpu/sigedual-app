"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { formatearFecha } from "@/lib/fecha";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { Asignacion, CentroDual, Estudiante, Visita } from "@/types";
import { CalendarDays, ChevronRight, MapPin, School, UserCheck } from "lucide-react";

interface EventoCalendario {
  id: string;
  tipo: "visita" | "vencimiento_asignacion";
  fecha: string;
  titulo: string;
  subtitulo: string;
  href: string;
  liceoId: string;
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarioPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroLiceoId, setFiltroLiceoId] = useState("");

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setLoading(true);
      const qVisitas = modoGlobal ? collection(db, "visitas") : query(collection(db, "visitas"), where("liceoId", "==", usuario!.liceoId));
      const qAsig = modoGlobal ? collection(db, "asignaciones") : query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId));
      const qCentros = modoGlobal ? collection(db, "centros_duales") : query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId));
      const qEst = modoGlobal ? collection(db, "estudiantes") : query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId));
      const [snapVisitas, snapAsig, snapCentros, snapEst] = await Promise.all([getDocs(qVisitas), getDocs(qAsig), getDocs(qCentros), getDocs(qEst)]);
      setVisitas(snapVisitas.docs.map((d) => ({ id: d.id, ...d.data() } as Visita)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setLoading(false);
    }
    cargar();
  }, [usuario, modoGlobal]);

  function centroNombre(id: string): string {
    return centros.find((c) => c.id === id)?.nombre || "Centro dual";
  }
  function estudianteNombre(id: string): string {
    const e = estudiantes.find((e) => e.id === id);
    return e ? `${e.nombres} ${e.apellidos}` : "Estudiante";
  }

  const eventos = useMemo(() => {
    const hoy = hoyISO();
    const items: EventoCalendario[] = [];
    visitas
      .filter((v) => v.estado === "programada" && v.fecha >= hoy)
      .forEach((v) => items.push({
        id: `visita-${v.id}`, tipo: "visita", fecha: v.fecha, liceoId: v.liceoId,
        titulo: `Visita a ${centroNombre(v.centroDualId)}`,
        subtitulo: v.hora ? `${v.hora} h${v.estudianteId ? ` · ${estudianteNombre(v.estudianteId)}` : ""}` : (v.estudianteId ? estudianteNombre(v.estudianteId) : ""),
        href: "/dashboard/visitas",
      }));
    asignaciones
      .filter((a) => a.fechaTermino && a.fechaTermino >= hoy && (a.estado === "asignada" || a.estado === "activa"))
      .forEach((a) => items.push({
        id: `asig-${a.id}`, tipo: "vencimiento_asignacion", fecha: a.fechaTermino as string, liceoId: a.liceoId,
        titulo: `Término de asignación: ${estudianteNombre(a.estudianteId)}`,
        subtitulo: centroNombre(a.centroDualId),
        href: `/dashboard/estudiantes/asignaciones/${a.id}`,
      }));
    const filtrados = filtroLiceoId ? items.filter((e) => e.liceoId === filtroLiceoId) : items;
    return filtrados.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitas, asignaciones, centros, estudiantes, filtroLiceoId]);

  const agrupados = useMemo(() => {
    const grupos: { fecha: string; eventos: EventoCalendario[] }[] = [];
    eventos.forEach((e) => {
      const grupo = grupos.find((g) => g.fecha === e.fecha);
      if (grupo) grupo.eventos.push(e);
      else grupos.push({ fecha: e.fecha, eventos: [e] });
    });
    return grupos;
  }, [eventos]);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <TituloPagina icon={<CalendarDays size={28} />}>Calendario</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Visitas programadas y vencimientos de asignaciones próximos, agrupados por fecha.
        </p>
      </div>

      {modoGlobal && (
        <div className="mb-4 max-w-xs">
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Liceo</label>
          <Select value={filtroLiceoId} onChange={setFiltroLiceoId} ariaLabel="Liceo"
            opciones={[{ value: "", label: "Todos los liceos" }, ...liceos.map((l) => ({ value: l.id, label: l.nombre }))]} />
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : agrupados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay actividades programadas.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Las visitas programadas y los vencimientos de asignaciones aparecerán aquí.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {agrupados.map((g) => (
            <div key={g.fecha}>
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wide mb-2">{formatearFecha(g.fecha)}</p>
              <div className="flex flex-col gap-2">
                {g.eventos.map((e) => (
                  <Link key={e.id} href={e.href}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    className="rounded-xl px-4 py-3 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors">
                    <div style={{ background: (e.tipo === "visita" ? "var(--accent)" : "var(--warning)") + "22" }} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
                      {e.tipo === "visita"
                        ? <MapPin size={15} style={{ color: "var(--accent-light)" }} />
                        : <UserCheck size={15} style={{ color: "var(--warning)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{e.titulo}</p>
                      {e.subtitulo && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{e.subtitulo}</p>}
                      {modoGlobal && (
                        <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1 text-[11px] mt-0.5">
                          <School size={10} /> {liceoNombrePorId[e.liceoId] || "—"}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
