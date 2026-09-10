"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias/context";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { useConversaciones, type CarpetaMensajes } from "@/lib/mensajes/useConversaciones";
import { useBorradores } from "@/lib/mensajes/useBorradores";
import { useDirectorioMensajes } from "@/lib/mensajes/useDirectorio";
import { iniciarConversacion, responderConversacion, marcarHiloLeido } from "@/lib/mensajes/enviarMensaje";
import PanelCarpetas from "@/components/mensajes/PanelCarpetas";
import FilaConversacion from "@/components/mensajes/FilaConversacion";
import VistaConversacion from "@/components/mensajes/VistaConversacion";
import ModalRedactar, { type BorradorEnEdicion } from "@/components/mensajes/ModalRedactar";
import TituloPagina from "@/components/TituloPagina";
import {
  MessageSquare, Search, Inbox, Star, Send, FileText, Trash2,
  MailOpen, Mail, RotateCcw, Menu,
} from "lucide-react";
import type { Conversacion, Usuario } from "@/types";

type Filtro = "todos" | "no_leidos" | "destacados";

const VACIOS: Record<CarpetaMensajes, { icon: React.ReactNode; titulo: string; detalle: string }> = {
  recibidos: { icon: <Inbox size={22} />, titulo: "No tienes mensajes", detalle: "Cuando recibas uno, aparecerá aquí." },
  destacados: { icon: <Star size={22} />, titulo: "No tienes mensajes destacados", detalle: "Marca con la estrella lo que quieras tener a mano." },
  enviados: { icon: <Send size={22} />, titulo: "Todavía no has enviado mensajes", detalle: "Lo que escribas va a quedar registrado aquí." },
  borradores: { icon: <FileText size={22} />, titulo: "No tienes borradores", detalle: "Lo que empieces y no envíes se guarda acá." },
  papelera: { icon: <Trash2 size={22} />, titulo: "La papelera está vacía", detalle: "Los mensajes que elimines quedan aquí antes de borrarse." },
};

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function MensajesContenido() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hiloDeUrl = searchParams.get("hilo");

  const {
    conversaciones, cargando, noLeidos, porCarpeta, noLeida, destacada,
    marcarLeida, alternarDestacada, moverAPapelera, restaurar, eliminarDefinitivamente,
  } = useConversaciones();
  const { borradores, guardar, descartar } = useBorradores();
  const { contactos, cargando: cargandoContactos } = useDirectorioMensajes();

  const [carpeta, setCarpeta] = useState<CarpetaMensajes>("recibidos");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [redactando, setRedactando] = useState<BorradorEnEdicion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [personas, setPersonas] = useState<Record<string, Usuario>>({});
  const [carpetasAbiertas, setCarpetasAbiertas] = useState(false);

  // Nombres de todos los participantes de los hilos visibles. Se resuelven
  // por id (nunca listando el liceo completo), así que respeta lo que cada
  // rol tiene permitido leer de `usuarios`.
  const uidsParticipantes = useMemo(() => {
    const uids = new Set<string>();
    conversaciones.forEach((c) => c.participantes.forEach((p) => uids.add(p)));
    borradores.forEach((b) => b.destinatarios.forEach((d) => uids.add(d)));
    return Array.from(uids).sort().join(",");
  }, [conversaciones, borradores]);

  useEffect(() => {
    if (!uidsParticipantes) return;
    let cancelado = false;
    obtenerDocumentosPorId<Usuario & { id: string }>("usuarios", uidsParticipantes.split(","))
      .then((lista) => {
        if (cancelado) return;
        const map: Record<string, Usuario> = {};
        // Se indexa por el id del documento, que es el uid real de la cuenta
        // (el campo `uid` de adentro es una copia que puede faltar).
        lista.forEach((u) => (map[u.id] = { ...u, uid: u.id }));
        setPersonas(map);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [uidsParticipantes]);

  const nombreDe = useCallback(
    (uid: string) => personas[uid]?.nombre ?? (uid === usuario?.uid ? usuario.nombre : "Usuario"),
    [personas, usuario]
  );

  /** Con quién es el hilo: en Enviados, a quién se le escribió; en el resto,
   * quién escribe. Es lo que se muestra como remitente en cada fila. */
  const tituloDe = useCallback(
    (c: Conversacion): string => {
      const otros = c.participantes.filter((p) => p !== usuario?.uid);
      if (otros.length === 0) return usuario?.nombre ?? "Yo";
      if (otros.length === 1) return nombreDe(otros[0]);
      return `${nombreDe(otros[0])} y ${otros.length - 1} más`;
    },
    [usuario, nombreDe]
  );

  const abierta = useMemo(
    () => conversaciones.find((c) => c.id === abiertaId) ?? null,
    [conversaciones, abiertaId]
  );

  const abrirHilo = useCallback(async (id: string) => {
    setAbiertaId(id);
    setSeleccion([]);
    if (usuario) await marcarHiloLeido(id, usuario.uid).catch(() => {});
  }, [usuario]);

  // Enlace directo desde la notificación (?hilo=...).
  useEffect(() => {
    if (!hiloDeUrl || cargando) return;
    if (conversaciones.some((c) => c.id === hiloDeUrl)) {
      abrirHilo(hiloDeUrl);
      router.replace("/dashboard/mensajes");
    }
  }, [hiloDeUrl, cargando, conversaciones, abrirHilo, router]);

  const visibles = useMemo(() => {
    if (carpeta === "borradores") return [];
    let lista = porCarpeta(carpeta);
    if (filtro === "no_leidos") lista = lista.filter(noLeida);
    if (filtro === "destacados") lista = lista.filter(destacada);
    const q = normalizar(busqueda.trim());
    if (!q) return lista;
    return lista.filter((c) => {
      const gente = c.participantes.map((p) => nombreDe(p)).join(" ");
      return normalizar(`${c.asunto ?? c.nombre ?? ""} ${c.ultimoMensaje ?? ""} ${gente}`).includes(q);
    });
  }, [carpeta, porCarpeta, filtro, noLeida, destacada, busqueda, nombreDe]);

  const borradoresVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return borradores;
    return borradores.filter((b) => {
      const gente = b.destinatarios.map((d) => nombreDe(d)).join(" ");
      return normalizar(`${b.asunto ?? ""} ${b.cuerpo ?? ""} ${gente}`).includes(q);
    });
  }, [borradores, busqueda, nombreDe]);

  function alternarSeleccion(id: string, valor: boolean) {
    setSeleccion((prev) => (valor ? [...prev, id] : prev.filter((s) => s !== id)));
  }

  async function enviarMensaje(datos: BorradorEnEdicion) {
    if (!usuario || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      const id = await iniciarConversacion({
        autor: usuario,
        destinatarios: datos.destinatarios,
        asunto: datos.asunto,
        cuerpo: datos.cuerpo,
      });
      if (datos.id) await descartar(datos.id).catch(() => {});
      setRedactando(null);
      setCarpeta("enviados");
      await abrirHilo(id);
    } catch (err) {
      // Un envío que falla tiene que decirlo: antes el error se perdía y el
      // mensaje simplemente no llegaba, sin ninguna señal.
      setErrorEnvio(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  }

  async function responder(texto: string) {
    if (!usuario || !abierta || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      await responderConversacion(abierta, usuario, texto);
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : "No fue posible enviar la respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  async function guardarBorrador(datos: BorradorEnEdicion) {
    await guardar({ destinatarios: datos.destinatarios, asunto: datos.asunto, cuerpo: datos.cuerpo }, datos.id);
    setRedactando(null);
    setCarpeta("borradores");
  }

  async function descartarBorrador(id?: string) {
    if (id) await descartar(id).catch(() => {});
    setRedactando(null);
  }

  if (!usuario) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  // ── Conversación abierta ────────────────────────────────────────────
  if (abierta) {
    return (
      <div className="h-[calc(100dvh-56px)] flex flex-col" style={{ background: "var(--bg-card)" }}>
        {errorEnvio && (
          <div style={{ background: "var(--danger)22", borderBottom: "1px solid var(--danger)" }} className="px-4 py-2.5 flex-shrink-0">
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorEnvio}</p>
          </div>
        )}
        <div className="flex-1 min-h-0">
        <VistaConversacion
          conversacion={abierta}
          titulo={tituloDe(abierta)}
          destacada={destacada(abierta)}
          formatoHora={preferencias.formatoHora}
          enviando={enviando}
          onVolver={() => setAbiertaId(null)}
          onDestacar={() => alternarDestacada(abierta)}
          onEliminar={async () => { await moverAPapelera([abierta.id]); setAbiertaId(null); }}
          onMarcarNoLeida={async () => { await marcarLeida(abierta.id, false); setAbiertaId(null); }}
          onResponder={responder}
        />
        </div>
      </div>
    );
  }

  const vacio = VACIOS[carpeta];
  const listaVacia = carpeta === "borradores" ? borradoresVisibles.length === 0 : visibles.length === 0;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <TituloPagina icon={<MessageSquare size={28} />}>Mensajes</TituloPagina>
        <button
          onClick={() => setCarpetasAbiertas((v) => !v)}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="md:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
        >
          <Menu size={15} />
          Carpetas
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar mensajes"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        />
      </div>

      <div className="flex gap-4 items-start">
        <aside className={`w-48 flex-shrink-0 ${carpetasAbiertas ? "block" : "hidden"} md:block`}>
          <PanelCarpetas
            carpeta={carpeta}
            onCambiar={(c) => { setCarpeta(c); setSeleccion([]); setCarpetasAbiertas(false); }}
            noLeidos={noLeidos}
            borradores={borradores.length}
            onRedactar={() => setRedactando({ destinatarios: [], asunto: "", cuerpo: "" })}
          />
        </aside>

        <section
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          className="flex-1 min-w-0 rounded-2xl overflow-hidden"
        >
          <div
            style={{ borderBottom: "1px solid var(--border)" }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 flex-wrap"
          >
            {seleccion.length > 0 ? (
              <>
                <span style={{ color: "var(--text-secondary)" }} className="text-xs font-medium mr-1">
                  {seleccion.length} seleccionado{seleccion.length === 1 ? "" : "s"}
                </span>
                {carpeta === "papelera" ? (
                  <>
                    <AccionBarra icon={<RotateCcw size={14} />} label="Restaurar" onClick={async () => { await restaurar(seleccion); setSeleccion([]); }} />
                    <AccionBarra
                      icon={<Trash2 size={14} />}
                      label="Eliminar definitivamente"
                      peligro
                      onClick={async () => {
                        if (!confirm("¿Eliminar definitivamente? No vas a poder recuperar estos mensajes.")) return;
                        await eliminarDefinitivamente(seleccion);
                        setSeleccion([]);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <AccionBarra icon={<MailOpen size={14} />} label="Marcar como leído" onClick={async () => { await Promise.all(seleccion.map((id) => marcarLeida(id, true))); setSeleccion([]); }} />
                    <AccionBarra icon={<Mail size={14} />} label="Marcar como no leído" onClick={async () => { await Promise.all(seleccion.map((id) => marcarLeida(id, false))); setSeleccion([]); }} />
                    <AccionBarra icon={<Star size={14} />} label="Destacar" onClick={async () => {
                      const objetivo = conversaciones.filter((c) => seleccion.includes(c.id) && !destacada(c));
                      await Promise.all(objetivo.map((c) => alternarDestacada(c)));
                      setSeleccion([]);
                    }} />
                    <AccionBarra icon={<Trash2 size={14} />} label="Mover a papelera" onClick={async () => { await moverAPapelera(seleccion); setSeleccion([]); }} />
                  </>
                )}
              </>
            ) : (
              carpeta !== "borradores" && carpeta !== "papelera" && (
                <>
                  {(["todos", "no_leidos", "destacados"] as Filtro[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      style={{
                        background: filtro === f ? "var(--accent)" : "transparent",
                        border: `1px solid ${filtro === f ? "var(--accent)" : "var(--border)"}`,
                        color: filtro === f ? "var(--text-on-accent)" : "var(--text-secondary)",
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {f === "todos" ? "Todos" : f === "no_leidos" ? "No leídos" : "Destacados"}
                    </button>
                  ))}
                </>
              )
            )}
          </div>

          {cargando ? (
            <p style={{ color: "var(--text-secondary)" }} className="text-sm p-6">Cargando mensajes...</p>
          ) : listaVacia ? (
            <div className="p-10 sm:p-14 text-center">
              <div style={{ background: "var(--accent)22", color: "var(--accent-light)" }} className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                {vacio.icon}
              </div>
              <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">
                {busqueda.trim() ? "Sin resultados" : vacio.titulo}
              </p>
              <p style={{ color: "var(--text-muted)" }} className="text-sm">
                {busqueda.trim() ? "Ningún mensaje coincide con lo que buscaste." : vacio.detalle}
              </p>
            </div>
          ) : carpeta === "borradores" ? (
            borradoresVisibles.map((b) => (
              <button
                key={b.id}
                onClick={() => setRedactando({ id: b.id, destinatarios: b.destinatarios, asunto: b.asunto ?? "", cuerpo: b.cuerpo ?? "" })}
                style={{ borderBottom: "1px solid var(--border)" }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:[background:var(--hover-overlay)] transition-colors text-left"
              >
                <FileText size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate block">
                    {b.asunto?.trim() || "(sin asunto)"}
                  </span>
                  <span style={{ color: "var(--text-muted)" }} className="text-xs truncate block">
                    {b.destinatarios.length > 0 ? `Para ${b.destinatarios.map((d) => nombreDe(d)).join(", ")}` : "Sin destinatario"}
                    {b.cuerpo?.trim() ? ` — ${b.cuerpo.trim()}` : ""}
                  </span>
                </span>
              </button>
            ))
          ) : (
            visibles.map((c) => (
              <FilaConversacion
                key={c.id}
                conversacion={c}
                titulo={tituloDe(c)}
                sinLeer={noLeida(c)}
                destacada={destacada(c)}
                seleccionada={seleccion.includes(c.id)}
                formatoHora={preferencias.formatoHora}
                onAbrir={() => abrirHilo(c.id)}
                onSeleccionar={(v) => alternarSeleccion(c.id, v)}
                onDestacar={() => alternarDestacada(c)}
              />
            ))
          )}
        </section>
      </div>

      {redactando && (
        <ModalRedactar
          contactos={contactos}
          cargandoContactos={cargandoContactos}
          inicialValores={redactando}
          enviando={enviando}
          errorEnvio={errorEnvio}
          onCerrar={() => setRedactando(null)}
          onEnviar={enviarMensaje}
          onGuardarBorrador={guardarBorrador}
          onDescartar={descartarBorrador}
        />
      )}
    </div>
  );
}

function AccionBarra({
  icon, label, onClick, peligro,
}: { icon: React.ReactNode; label: string; onClick: () => void; peligro?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        color: peligro ? "var(--danger)" : "var(--text-secondary)",
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-85 transition-opacity"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function MensajesPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>}>
      <MensajesContenido />
    </Suspense>
  );
}
