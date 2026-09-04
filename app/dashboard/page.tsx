"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias/context";
import { ordenarModulosDashboard } from "@/lib/preferencias/dashboardModulos";
import { ROL_LABEL } from "@/lib/roles";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { estadoEfectivo, camposFaltantes } from "@/lib/compatibilidad";
import { camposFaltantesMaestroGuia } from "@/lib/maestro-guia";
import { formatearFecha } from "@/lib/fecha";
import { estadoCanonico, fechaProgramadaDe, horaProgramadaDe } from "@/lib/visitas/normalizar";
import { useNotificaciones } from "@/lib/notificaciones/useNotificaciones";
import { ESTADOS_TICKET_ABIERTOS, ESTADO_TICKET_LABEL, ESTADO_TICKET_COLOR, PRIORIDAD_TICKET_COLOR, numeroTicket } from "@/lib/tickets/constantes";
import ListaNotificaciones from "@/components/notificaciones/ListaNotificaciones";
import MapaDualCard from "./_inicio/MapaDualCard";
import type { Asignacion, CentroDual, Estudiante, MaestroGuia, Rol, Ticket, Usuario, Visita } from "@/types";
import {
  Users, Building2, BookOpen, UsersRound, CalendarCheck, MapPin, ArrowRight, Pin,
  UserPlus, Building, FileText, LifeBuoy, AlertTriangle, Bell, CalendarDays,
  ChevronRight, School, UserCheck,
} from "lucide-react";

interface Stat {
  id: string;
  label: string;
  principal: number;
  secundaria: string;
  icon: React.ReactNode;
  href: string;
  roles: Rol[];
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = useMemo(() => Object.fromEntries(liceos.map((l) => [l.id, l.nombre])), [liceos]);
  const esAdmin = usuario?.rol === "administrador";
  const ambito = useAmbitoProfesor();

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [maestros, setMaestros] = useState<MaestroGuia[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);

  const { notificaciones, cargando: cargandoNotif, marcarLeida } = useNotificaciones(6);

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    async function cargar() {
      const liceoId = usuario!.liceoId;

      if (usuario!.rol === "profesor") {
        // El Dashboard de un profesor no debe mostrar estadísticas
        // globales del liceo — solo lo que está dentro de su ámbito.
        const [estudiantesData, centrosData, maestrosData] = await Promise.all([
          obtenerDocumentosPorId<Estudiante>("estudiantes", ambito.idsEstudiantes),
          obtenerDocumentosPorId<CentroDual>("centros_duales", ambito.idsCentros),
          obtenerDocumentosPorId<MaestroGuia>("maestros_guia", ambito.idsMaestros),
        ]);
        const lotesEst: string[][] = [];
        for (let i = 0; i < ambito.idsEstudiantes.length; i += 30) lotesEst.push(ambito.idsEstudiantes.slice(i, i + 30));
        const [propias, supervisadas, ...snapsVisitasEst] = await Promise.all([
          getDocs(query(collection(db, "visitas"), where("profesorId", "==", usuario!.uid))),
          getDocs(query(collection(db, "visitas"), where("profesorSupervisorId", "==", usuario!.uid))),
          ...lotesEst.map((lote) => getDocs(query(collection(db, "visitas"), where("estudianteId", "in", lote)))),
          ...lotesEst.map((lote) => getDocs(query(collection(db, "visitas"), where("estudianteIds", "array-contains-any", lote)))),
        ]);
        const visitasPorId = new Map<string, Visita>();
        propias.docs.forEach((d) => visitasPorId.set(d.id, { id: d.id, ...d.data() } as Visita));
        supervisadas.docs.forEach((d) => visitasPorId.set(d.id, { id: d.id, ...d.data() } as Visita));
        snapsVisitasEst.forEach((snap) => snap.docs.forEach((d) => visitasPorId.set(d.id, { id: d.id, ...d.data() } as Visita)));

        setEstudiantes(estudiantesData);
        setCentros(centrosData);
        setProfesores([]);
        setMaestros(maestrosData);
        setAsignaciones(ambito.asignaciones);
        setVisitas(Array.from(visitasPorId.values()));
        setTickets([]);
        setCargando(false);
        return;
      }

      const alcance = <T,>(coleccion: string) =>
        modoGlobal ? collection(db, coleccion) : query(collection(db, coleccion), where("liceoId", "==", liceoId));
      const qProfesores = modoGlobal
        ? query(collection(db, "usuarios"), where("rol", "==", "profesor"))
        : query(collection(db, "usuarios"), where("liceoId", "==", liceoId), where("rol", "==", "profesor"));

      const [snapEst, snapCentros, snapProf, snapMg, snapAsig, snapVisitas] = await Promise.all([
        getDocs(alcance("estudiantes")),
        getDocs(alcance("centros_duales")),
        getDocs(qProfesores),
        getDocs(alcance("maestros_guia")),
        getDocs(alcance("asignaciones")),
        getDocs(alcance("visitas")),
      ]);
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setProfesores(snapProf.docs.map((d) => d.data() as Usuario));
      setMaestros(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setVisitas(snapVisitas.docs.map((d) => ({ id: d.id, ...d.data() } as Visita)));

      if (usuario!.rol === "administrador") {
        const snapTickets = await getDocs(collection(db, "tickets"));
        setTickets(snapTickets.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
      } else {
        setTickets([]);
      }
      setCargando(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal, ambito.cargando, ambito.idsEstudiantes, ambito.idsCentros, ambito.idsMaestros, ambito.asignaciones]);

  const hoy = hoyISO();

  const idsConAsignacionActiva = useMemo(
    () => new Set(asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa").map((a) => a.estudianteId)),
    [asignaciones]
  );
  const estudiantesActivos = useMemo(() => estudiantes.filter((e) => e.estado === "activo"), [estudiantes]);
  const centrosActivos = useMemo(() => centros.filter((c) => estadoEfectivo(c) === "activo"), [centros]);
  const asignacionesActivas = useMemo(() => asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa"), [asignaciones]);
  const estudiantesSinAsignacion = useMemo(
    () => estudiantesActivos.filter((e) => !idsConAsignacionActiva.has(e.id)),
    [estudiantesActivos, idsConAsignacionActiva]
  );
  const visitasProximas = useMemo(() => visitas.filter((v) => estadoCanonico(v.estado) === "agendada" && fechaProgramadaDe(v) >= hoy), [visitas, hoy]);
  const visitasAtrasadas = useMemo(() => visitas.filter((v) => estadoCanonico(v.estado) === "agendada" && fechaProgramadaDe(v) < hoy), [visitas, hoy]);

  const stats: Stat[] = [
    {
      id: "estudiantes", label: "Estudiantes", principal: estudiantes.length,
      secundaria: `${estudiantesActivos.length} activos`, icon: <Users size={20} />,
      href: "/dashboard/estudiantes", roles: ["administrador", "coordinador", "director", "profesor"],
    },
    {
      id: "centros", label: "Empresas Duales", principal: centros.length,
      secundaria: `${centrosActivos.length} activas`, icon: <Building2 size={20} />,
      href: "/dashboard/centros", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"],
    },
    {
      id: "profesores", label: "Profesores Supervisores", principal: profesores.length,
      secundaria: `${profesores.filter((p) => p.activo).length} activos`, icon: <BookOpen size={20} />,
      href: "/dashboard/profesores", roles: ["administrador", "coordinador", "director"],
    },
    {
      id: "maestros", label: "Maestros Guía", principal: maestros.length,
      secundaria: `${maestros.filter((m) => m.estado === "activo").length} activos`, icon: <UsersRound size={20} />,
      href: "/dashboard/centros/maestros", roles: ["administrador", "coordinador", "director", "profesor"],
    },
    {
      id: "asignaciones", label: "Asignaciones Duales", principal: asignacionesActivas.length,
      secundaria: `${estudiantesSinAsignacion.length} sin asignar`, icon: <CalendarCheck size={20} />,
      href: "/dashboard/estudiantes/asignaciones", roles: ["administrador", "coordinador", "director", "profesor"],
    },
    {
      id: "visitas", label: "Visitas", principal: visitasProximas.length,
      secundaria: `${visitasAtrasadas.length} pendientes`, icon: <MapPin size={20} />,
      href: "/dashboard/visitas", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"],
    },
  ];

  const visibleStats = ordenarModulosDashboard(
    stats.filter((s) => usuario && s.roles.includes(usuario.rol)),
    preferencias.dashboardModulos
  );

  const acciones = [
    { label: "Agregar estudiante", icon: <UserPlus size={15} />, href: "/dashboard/estudiantes/nuevo", roles: ["administrador", "profesor"] as Rol[] },
    { label: "Agregar empresa dual", icon: <Building size={15} />, href: "/dashboard/centros/nuevo", roles: ["administrador", "profesor"] as Rol[] },
    { label: "Agregar profesor", icon: <BookOpen size={15} />, href: "/dashboard/profesores/nuevo", roles: ["administrador"] as Rol[] },
    { label: "Agregar maestro guía", icon: <UsersRound size={15} />, href: "/dashboard/centros/maestros/nuevo", roles: ["administrador", "profesor"] as Rol[] },
    { label: "Crear asignación", icon: <CalendarCheck size={15} />, href: "/dashboard/estudiantes/asignaciones/nueva", roles: ["administrador", "coordinador", "director", "profesor"] as Rol[] },
    { label: "Registrar visita", icon: <MapPin size={15} />, href: "/dashboard/visitas/nueva", roles: ["administrador", "coordinador", "director", "profesor"] as Rol[] },
    { label: "Crear documento", icon: <FileText size={15} />, href: "/dashboard/documentos/documentos", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] as Rol[] },
  ];
  const accionesVisibles = acciones.filter((a) => usuario && a.roles.includes(usuario.rol));

  const requiereAtencion = useMemo(() => {
    const items: { id: string; texto: string; href: string }[] = [];
    if (estudiantesSinAsignacion.length > 0) {
      items.push({ id: "sin-asignacion", texto: `${estudiantesSinAsignacion.length} estudiante(s) sin empresa asignada`, href: "/dashboard/estudiantes/asignaciones" });
    }
    const asignacionesVencidas = asignaciones.filter((a) => (a.estado === "asignada" || a.estado === "activa") && a.fechaTermino && a.fechaTermino < hoy);
    if (asignacionesVencidas.length > 0) {
      items.push({ id: "asig-vencidas", texto: `${asignacionesVencidas.length} asignación(es) con fecha de término vencida`, href: "/dashboard/estudiantes/asignaciones" });
    }
    if (visitasAtrasadas.length > 0) {
      items.push({ id: "visitas-atrasadas", texto: `${visitasAtrasadas.length} visita(s) programada(s) atrasada(s)`, href: "/dashboard/visitas" });
    }
    const centrosIncompletos = centros.filter((c) => camposFaltantes(c).length > 0);
    if (centrosIncompletos.length > 0) {
      items.push({ id: "centros-incompletos", texto: `${centrosIncompletos.length} empresa(s) dual(es) con información incompleta`, href: "/dashboard/centros" });
    }
    const maestrosIncompletos = maestros.filter((m) => camposFaltantesMaestroGuia(m, centros.some((c) => c.id === m.centroDualId)).length > 0);
    if (maestrosIncompletos.length > 0) {
      items.push({ id: "maestros-incompletos", texto: `${maestrosIncompletos.length} maestro(s) guía con información incompleta`, href: "/dashboard/centros/maestros" });
    }
    if (esAdmin) {
      const ticketsCriticos = tickets.filter((t) => t.prioridad === "critica" && ESTADOS_TICKET_ABIERTOS.includes(t.estado));
      if (ticketsCriticos.length > 0) {
        items.push({ id: "tickets-criticos", texto: `${ticketsCriticos.length} ticket(s) crítico(s) abierto(s)`, href: "/dashboard/administracion/tickets" });
      }
    }
    return items;
  }, [estudiantesSinAsignacion, asignaciones, visitasAtrasadas, centros, maestros, tickets, esAdmin, hoy]);

  const proximasActividades = useMemo(() => {
    function estudianteNombre(id: string) {
      const e = estudiantes.find((e) => e.id === id);
      return e ? `${e.nombres} ${e.apellidos}` : "Estudiante";
    }
    function centroNombre(id: string) {
      return centros.find((c) => c.id === id)?.nombre || "Centro dual";
    }
    const items: { id: string; fecha: string; titulo: string; subtitulo: string; icon: React.ReactNode }[] = [];
    visitasProximas.forEach((v) => {
      const fecha = fechaProgramadaDe(v);
      const hora = horaProgramadaDe(v);
      items.push({
        id: `visita-${v.id}`, fecha, titulo: `Visita a ${centroNombre(v.centroDualId)}`,
        subtitulo: hora ? `${formatearFecha(fecha)} · ${hora} h` : formatearFecha(fecha),
        icon: <MapPin size={14} style={{ color: "var(--accent-light)" }} />,
      });
    });
    asignaciones
      .filter((a) => (a.estado === "asignada" || a.estado === "activa") && a.fechaTermino && a.fechaTermino >= hoy)
      .forEach((a) => items.push({
        id: `asig-${a.id}`, fecha: a.fechaTermino as string,
        titulo: `Término de asignación: ${estudianteNombre(a.estudianteId)}`,
        subtitulo: `${formatearFecha(a.fechaTermino as string)} · ${centroNombre(a.centroDualId)}`,
        icon: <UserCheck size={14} style={{ color: "var(--warning)" }} />,
      }));
    return items.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)).slice(0, 5);
  }, [visitasProximas, asignaciones, estudiantes, centros, hoy]);

  const contadoresTickets = useMemo(() => {
    const abiertos = tickets.filter((t) => ESTADOS_TICKET_ABIERTOS.includes(t.estado)).length;
    const criticos = tickets.filter((t) => t.prioridad === "critica" && ESTADOS_TICKET_ABIERTOS.includes(t.estado)).length;
    const recientes = [...tickets].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)).slice(0, 4);
    return { abiertos, criticos, recientes };
  }, [tickets]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const primerNombre = usuario?.nombre?.split(" ")[0] ?? "";
  const fechaHoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (!usuario) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Encabezado */}
      <div className="mb-6">
        <p style={{ color: "var(--accent-light)" }} className="text-sm font-semibold">{saludo}, {primerNombre}.</p>
        <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold tracking-tight mt-0.5">Resumen de la Formación Profesional Dual</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1 capitalize">
          {ROL_LABEL[usuario.rol]} · {fechaHoy}
          {modoGlobal && " · Mostrando la información de todos los liceos"}
          {usuario.rol === "profesor" && " · Mostrando solo tu ámbito asignado"}
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {visibleStats.map((s) => (
          <Link key={s.id} href={s.href}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
            className="p-4 flex flex-col gap-3 transition-all hover:[border-color:var(--accent)]">
            <div className="flex items-center justify-between">
              <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-10 h-10 flex items-center justify-center">
                <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
              </div>
              {preferencias.dashboardModulos.find((m) => m.id === s.id)?.fijado ? (
                <Pin size={13} style={{ color: "var(--accent-light)" }} fill="var(--accent-light)" />
              ) : (
                <ArrowRight size={15} style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-2xl font-bold leading-none">{s.principal}</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1.5">{s.label}</p>
              <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{s.secundaria}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna principal */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Requiere atención */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Requiere atención</h2>
            </div>
            {requiereAtencion.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm">Sin acciones pendientes.</p>
            ) : (
              <div className="flex flex-col">
                {requiereAtencion.map((item, i) => (
                  <Link key={item.id} href={item.href}
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                    className="flex items-center justify-between gap-3 py-2.5 hover:[opacity:0.8] transition-opacity">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm">{item.texto}</p>
                    <span style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                      Revisar <ChevronRight size={13} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Próximas actividades */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Próximas actividades</h2>
              </div>
              <Link href="/dashboard/calendario" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
                Ver calendario
              </Link>
            </div>
            {proximasActividades.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay actividades programadas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proximasActividades.map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div style={{ background: "var(--bg-surface)" }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">{e.icon}</div>
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{e.titulo}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">{e.subtitulo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <MapaDualCard />
        </div>

        {/* Columna lateral */}
        <div className="flex flex-col gap-5">
          {/* Notificaciones */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell size={16} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Notificaciones</h2>
              </div>
              <Link href="/dashboard/notificaciones" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
                Ver todas
              </Link>
            </div>
            <ListaNotificaciones notificaciones={notificaciones} cargando={cargandoNotif} onMarcarLeida={marcarLeida} />
          </div>

          {/* Tickets — solo administrador */}
          {esAdmin && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LifeBuoy size={16} style={{ color: "var(--accent-light)" }} />
                  <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Tickets</h2>
                </div>
                <Link href="/dashboard/administracion/tickets" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline">
                  Ver todos
                </Link>
              </div>
              {tickets.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay tickets pendientes.</p>
              ) : (
                <>
                  <p style={{ color: "var(--text-primary)" }} className="text-sm mb-1">
                    <span className="font-bold">{contadoresTickets.abiertos}</span> tickets abiertos
                  </p>
                  {contadoresTickets.criticos > 0 && (
                    <p style={{ color: "var(--danger)" }} className="text-xs font-medium mb-3">{contadoresTickets.criticos} requieren atención</p>
                  )}
                  <div className="flex flex-col gap-2 mt-3">
                    {contadoresTickets.recientes.map((t) => (
                      <Link key={t.id} href={`/dashboard/soporte/tickets/${t.id}`}
                        style={{ borderTop: "1px solid var(--border)" }} className="pt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-mono">{numeroTicket(t.numero)}</p>
                          <p style={{ color: "var(--text-primary)" }} className="text-xs font-medium truncate">{t.asunto}</p>
                        </div>
                        <span style={{ color: ESTADO_TICKET_COLOR[t.estado], background: ESTADO_TICKET_COLOR[t.estado] + "22" }} className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {ESTADO_TICKET_LABEL[t.estado]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Acciones rápidas */}
          {accionesVisibles.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
              <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-3">Acciones rápidas</h2>
              <div className="flex flex-col gap-1.5">
                {accionesVisibles.map((a) => (
                  <Link key={a.href} href={a.href}
                    style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium hover:[color:var(--text-primary)] transition-colors">
                    <span style={{ color: "var(--accent-light)" }}>{a.icon}</span>
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {modoGlobal && liceos.length > 0 && (
        <p style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5 text-xs mt-6">
          <School size={12} /> Datos combinados de {liceos.length} liceo(s): {liceos.map((l) => liceoNombrePorId[l.id]).join(", ")}
        </p>
      )}
    </div>
  );
}
