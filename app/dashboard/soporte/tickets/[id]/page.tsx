"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { crearNotificacion } from "@/lib/notificaciones/crearNotificacion";
import {
  ESTADO_TICKET_LABEL, ESTADO_TICKET_COLOR, PRIORIDAD_TICKET_LABEL, PRIORIDAD_TICKET_COLOR,
  TIPO_TICKET_LABEL, numeroTicket,
} from "@/lib/tickets/constantes";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { EstadoTicket, MensajeTicket, NotaInternaTicket, PrioridadTicket, Ticket, Usuario } from "@/types";
import { ArrowLeft, LifeBuoy, Lock, Send, ShieldAlert } from "lucide-react";

export default function DetalleTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "administrador";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [cargando, setCargando] = useState(true);
  const [denegado, setDenegado] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeTicket[]>([]);
  const [notas, setNotas] = useState<NotaInternaTicket[]>([]);
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [texto, setTexto] = useState("");
  const [notaTexto, setNotaTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cargarTicket() {
    if (!usuario || !id) return;
    setCargando(true);
    setDenegado(false);
    try {
      const snap = await getDoc(doc(db, "tickets", id));
      if (!snap.exists()) {
        setDenegado(true);
      } else {
        setTicket({ id: snap.id, ...snap.data() } as Ticket);
      }
    } catch {
      setDenegado(true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarTicket(); }, [usuario, id]);

  useEffect(() => {
    if (!ticket) return;
    const q = query(collection(db, "tickets", ticket.id, "mensajes"), orderBy("creadoEn", "asc"));
    const unsub = onSnapshot(q, (snap) => setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MensajeTicket))));
    return () => unsub();
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket || !esAdmin) return;
    const q = query(collection(db, "tickets", ticket.id, "notasInternas"), orderBy("creadoEn", "asc"));
    const unsub = onSnapshot(q, (snap) => setNotas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotaInternaTicket))));
    return () => unsub();
  }, [ticket?.id, esAdmin]);

  useEffect(() => {
    if (!esAdmin) return;
    getDocs(query(collection(db, "usuarios"), where("rol", "==", "administrador"))).then((snap) => {
      setAdministradores(snap.docs.map((d) => d.data() as Usuario));
    });
  }, [esAdmin]);

  const puedeParticipar = useMemo(() => Boolean(ticket && usuario && (ticket.creadoPor === usuario.uid || esAdmin)), [ticket, usuario, esAdmin]);

  async function enviarMensaje() {
    if (!ticket || !usuario || !texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, "tickets", ticket.id, "mensajes"), {
        texto: texto.trim(), uid: usuario.uid, nombre: usuario.nombre, creadoEn: new Date().toISOString(),
      });
      setTexto("");
      if (esAdmin && ticket.creadoPor !== usuario.uid) {
        await crearNotificacion({
          destinatarioUid: ticket.creadoPor,
          liceoId: ticket.liceoId,
          tipo: "ticket",
          titulo: `Respuesta en tu ticket ${numeroTicket(ticket.numero)}`,
          descripcion: texto.trim().slice(0, 120),
          accionHref: `/dashboard/soporte/tickets/${ticket.id}`,
          accionLabel: "Ver ticket",
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function enviarNota() {
    if (!ticket || !usuario || !notaTexto.trim()) return;
    await addDoc(collection(db, "tickets", ticket.id, "notasInternas"), {
      texto: notaTexto.trim(), uid: usuario.uid, nombre: usuario.nombre, creadoEn: new Date().toISOString(),
    });
    setNotaTexto("");
  }

  async function cambiarEstado(nuevo: EstadoTicket) {
    if (!ticket) return;
    const cambios: Record<string, unknown> = { estado: nuevo, actualizadoEn: new Date().toISOString() };
    if (nuevo === "resuelto") cambios.resueltoEn = new Date().toISOString();
    if (nuevo === "cerrado") cambios.cerradoEn = new Date().toISOString();
    await updateDoc(doc(db, "tickets", ticket.id), cambios);
    setTicket((t) => (t ? { ...t, ...cambios } as Ticket : t));
    if (usuario && ticket.creadoPor !== usuario.uid && (nuevo === "resuelto" || nuevo === "cerrado")) {
      await crearNotificacion({
        destinatarioUid: ticket.creadoPor,
        liceoId: ticket.liceoId,
        tipo: "ticket",
        titulo: `Tu ticket ${numeroTicket(ticket.numero)} fue ${nuevo === "resuelto" ? "resuelto" : "cerrado"}`,
        descripcion: ticket.asunto,
        accionHref: `/dashboard/soporte/tickets/${ticket.id}`,
        accionLabel: "Ver ticket",
      });
    }
  }

  async function cambiarPrioridad(nueva: PrioridadTicket) {
    if (!ticket) return;
    await updateDoc(doc(db, "tickets", ticket.id), { prioridad: nueva, actualizadoEn: new Date().toISOString() });
    setTicket((t) => (t ? { ...t, prioridad: nueva } : t));
  }

  async function asignar(uid: string) {
    if (!ticket) return;
    const admin = administradores.find((a) => a.uid === uid);
    const cambios: Record<string, unknown> = { actualizadoEn: new Date().toISOString() };
    if (uid) { cambios.asignadoA = uid; cambios.asignadoANombre = admin?.nombre ?? ""; }
    await updateDoc(doc(db, "tickets", ticket.id), cambios);
    setTicket((t) => (t ? { ...t, asignadoA: uid || undefined, asignadoANombre: admin?.nombre } : t));
  }

  if (cargando) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (denegado || !ticket || !puedeParticipar) {
    return (
      <div className="p-4 md:p-8 max-w-lg">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <ShieldAlert size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Acceso denegado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">No tienes permiso para ver este ticket, o no existe.</p>
          <Link href="/dashboard/soporte/tickets" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={15} /> Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <p style={{ color: "var(--text-muted)" }} className="text-xs font-mono mb-1">{numeroTicket(ticket.numero)}</p>
        <TituloPagina icon={<LifeBuoy size={28} />}>{ticket.asunto}</TituloPagina>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span style={{ color: ESTADO_TICKET_COLOR[ticket.estado], background: ESTADO_TICKET_COLOR[ticket.estado] + "22" }} className="text-xs px-2.5 py-1 rounded-full font-medium">
            {ESTADO_TICKET_LABEL[ticket.estado]}
          </span>
          <span style={{ color: PRIORIDAD_TICKET_COLOR[ticket.prioridad], background: PRIORIDAD_TICKET_COLOR[ticket.prioridad] + "22" }} className="text-xs px-2.5 py-1 rounded-full font-medium">
            Prioridad {PRIORIDAD_TICKET_LABEL[ticket.prioridad]}
          </span>
          <span style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }} className="text-xs px-2.5 py-1 rounded-full font-medium">
            {TIPO_TICKET_LABEL[ticket.tipo]}
          </span>
        </div>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2">
          Creado por {ticket.creadoPorNombre} · {new Date(ticket.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {ticket.asignadoANombre && ` · Asignado a ${ticket.asignadoANombre}`}
        </p>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 mb-5">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap">{ticket.descripcion}</p>
      </div>

      {esAdmin && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
            <Select value={ticket.estado} onChange={(v) => cambiarEstado(v as EstadoTicket)} ariaLabel="Estado"
              opciones={Object.entries(ESTADO_TICKET_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Prioridad</label>
            <Select value={ticket.prioridad} onChange={(v) => cambiarPrioridad(v as PrioridadTicket)} ariaLabel="Prioridad"
              opciones={Object.entries(PRIORIDAD_TICKET_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Asignar a</label>
            <Select value={ticket.asignadoA ?? ""} onChange={asignar} ariaLabel="Asignar a"
              opciones={[{ value: "", label: "Sin asignar" }, ...administradores.map((a) => ({ value: a.uid, label: a.nombre }))]} />
          </div>
        </div>
      )}

      {/* Hilo de mensajes */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl mb-5 overflow-hidden">
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Conversación</p>
        </div>
        <div className="flex flex-col">
          {mensajes.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-sm px-5 py-4">Aún no hay respuestas.</p>
          ) : (
            mensajes.map((m) => (
              <div key={m.id} className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">{m.nombre}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px]">{new Date(m.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1 whitespace-pre-wrap">{m.texto}</p>
              </div>
            ))
          )}
        </div>
        <div className="p-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enviarMensaje(); }}
            placeholder="Escribe una respuesta..."
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
          <button
            onClick={enviarMensaje}
            disabled={!texto.trim() || enviando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Notas internas — exclusivas del administrador */}
      {esAdmin && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Lock size={13} style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Notas internas</p>
            <span style={{ color: "var(--text-muted)" }} className="text-[11px]">visibles solo para administradores</span>
          </div>
          <div className="flex flex-col">
            {notas.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm px-5 py-4">Sin notas internas.</p>
            ) : (
              notas.map((n) => (
                <div key={n.id} className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">{n.nombre}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px]">{new Date(n.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1 whitespace-pre-wrap">{n.texto}</p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviarNota(); }}
              placeholder="Agregar nota interna..."
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
            <button
              onClick={enviarNota}
              disabled={!notaTexto.trim()}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 hover:[border-color:var(--accent)] transition-colors flex-shrink-0"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
