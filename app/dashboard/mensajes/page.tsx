"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, doc, setDoc, updateDoc, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Search, Plus, ArrowLeft, Send, Users, X, Check } from "lucide-react";
import type { Usuario, Conversacion, MensajeConversacion } from "@/types";

export default function MensajesPage() {
  const { usuario } = useAuth();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeConversacion[]>([]);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const usuariosMap = useMemo(() => {
    const map: Record<string, Usuario> = {};
    usuarios.forEach((u) => (map[u.uid] = u));
    return map;
  }, [usuarios]);

  // Conversaciones del usuario
  useEffect(() => {
    if (!usuario) return;
    const q = query(
      collection(db, "conversaciones"),
      where("participantes", "array-contains", usuario.uid),
      orderBy("ultimaActividad", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversacion)));
    });
    return () => unsub();
  }, [usuario]);

  // Usuarios del liceo (para nombres y nueva conversación)
  useEffect(() => {
    if (!usuario) return;
    getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId))).then((snap) => {
      setUsuarios(snap.docs.map((d) => d.data() as Usuario).filter((u) => u.uid !== usuario.uid));
    });
  }, [usuario]);

  // Mensajes de la conversación activa
  useEffect(() => {
    if (!activaId) return;
    const q = query(collection(db, "conversaciones", activaId, "mensajes"), orderBy("creadoEn", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MensajeConversacion)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [activaId]);

  function seleccionarConversacion(id: string | null) {
    setMensajes([]);
    setActivaId(id);
  }

  function nombreConversacion(c: Conversacion) {
    if (c.tipo === "grupo") return c.nombre || "Grupo";
    const otroUid = c.participantes.find((p) => p !== usuario?.uid);
    return otroUid ? usuariosMap[otroUid]?.nombre ?? "Usuario" : "Usuario";
  }

  function inicialConversacion(c: Conversacion) {
    return nombreConversacion(c).charAt(0).toUpperCase();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !usuario || !activaId) return;
    const contenido = texto.trim();
    setTexto("");
    await addDoc(collection(db, "conversaciones", activaId, "mensajes"), {
      texto: contenido, uid: usuario.uid, nombre: usuario.nombre, creadoEn: new Date().toISOString(),
    });
    await updateDoc(doc(db, "conversaciones", activaId), {
      ultimoMensaje: contenido, ultimaActividad: new Date().toISOString(),
    });
  }

  async function iniciarConversacion() {
    if (!usuario || seleccionados.length === 0) return;
    const esGrupo = seleccionados.length > 1;
    if (esGrupo && !nombreGrupo.trim()) return;

    if (!esGrupo) {
      const existente = conversaciones.find(
        (c) => c.tipo === "privada" && c.participantes.includes(seleccionados[0]) && c.participantes.length === 2
      );
      if (existente) {
        seleccionarConversacion(existente.id);
        cerrarModal();
        return;
      }
    }

    const ref = doc(collection(db, "conversaciones"));
    const nueva: Omit<Conversacion, "id"> = {
      tipo: esGrupo ? "grupo" : "privada",
      nombre: esGrupo ? nombreGrupo.trim() : undefined,
      participantes: [usuario.uid, ...seleccionados],
      liceoId: usuario.liceoId,
      ultimaActividad: new Date().toISOString(),
      creadoPor: usuario.uid,
      creadoEn: new Date().toISOString(),
    };
    await setDoc(ref, nueva);
    seleccionarConversacion(ref.id);
    cerrarModal();
  }

  function cerrarModal() {
    setModalNuevo(false);
    setSeleccionados([]);
    setNombreGrupo("");
  }

  function toggleSeleccion(uid: string) {
    setSeleccionados((prev) => (prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]));
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  const conversacionesFiltradas = conversaciones.filter((c) =>
    nombreConversacion(c).toLowerCase().includes(busqueda.toLowerCase())
  );
  const activa = conversaciones.find((c) => c.id === activaId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-56px)]">
      {/* Lista de conversaciones */}
      <div
        style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)" }}
        className={`w-full md:w-80 flex-shrink-0 flex-col ${activaId ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Mensajes</h1>
          <button
            onClick={() => setModalNuevo(true)}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
            title="Nueva conversación"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Search size={15} style={{ color: "var(--text-muted)" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar conversación..."
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.length === 0 && (
            <p style={{ color: "var(--text-muted)" }} className="text-sm text-center mt-8 px-4">
              No tienes conversaciones aún. Toca + para iniciar una.
            </p>
          )}
          {conversacionesFiltradas.map((c) => {
            const esActiva = c.id === activaId;
            return (
              <button
                key={c.id}
                onClick={() => seleccionarConversacion(c.id)}
                style={{ background: esActiva ? "var(--bg-surface)" : "transparent" }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:[background:var(--hover-overlay)] transition-colors text-left"
              >
                <div
                  style={{
                    background: c.tipo === "grupo" ? "var(--accent)" : "var(--success)",
                    color: c.tipo === "grupo" ? "var(--text-on-accent)" : "#fff",
                    borderRadius: 999,
                  }}
                  className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                >
                  {c.tipo === "grupo" ? <Users size={17} /> : (
                    <span className="font-bold text-sm">{inicialConversacion(c)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{nombreConversacion(c)}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">{c.ultimoMensaje || "Sin mensajes aún"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat activo */}
      <div className={`flex-1 flex-col ${activaId ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg-base)" }}>
        {activa ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => seleccionarConversacion(null)} className="md:hidden" style={{ color: "var(--text-secondary)" }}>
                <ArrowLeft size={18} />
              </button>
              <div
                style={{
                  background: activa.tipo === "grupo" ? "var(--accent)" : "var(--success)",
                  color: activa.tipo === "grupo" ? "var(--text-on-accent)" : "#fff",
                  borderRadius: 999,
                }}
                className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              >
                {activa.tipo === "grupo" ? <Users size={14} /> : (
                  <span className="font-bold text-xs">{inicialConversacion(activa)}</span>
                )}
              </div>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{nombreConversacion(activa)}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3">
              {mensajes.length === 0 && (
                <p style={{ color: "var(--text-muted)" }} className="text-sm text-center mt-8">Aún no hay mensajes. ¡Escribe el primero!</p>
              )}
              {mensajes.map((m) => {
                const esMio = m.uid === usuario?.uid;
                return (
                  <div key={m.id} className={`flex flex-col ${esMio ? "items-end" : "items-start"}`}>
                    {!esMio && activa.tipo === "grupo" && (
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1 ml-1">{m.nombre}</p>
                    )}
                    <div
                      style={{ background: esMio ? "var(--accent)" : "var(--bg-surface)", color: esMio ? "#fff" : "var(--text-primary)", maxWidth: "70%" }}
                      className="px-4 py-2.5 rounded-2xl text-sm"
                    >
                      {m.texto}
                    </div>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 mx-1">{formatHora(m.creadoEn)}</p>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={enviar} style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }} className="px-4 py-3 flex gap-3">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje..."
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
              <button
                type="submit"
                disabled={!texto.trim()}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <p style={{ color: "var(--text-muted)" }} className="text-sm">Selecciona una conversación para comenzar</p>
          </div>
        )}
      </div>

      {/* Modal nueva conversación */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">Nueva conversación</h2>
              <button onClick={cerrarModal} style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {seleccionados.length > 1 && (
              <input
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
                placeholder="Nombre del grupo"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors mb-4"
              />
            )}

            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-2">
              {seleccionados.length > 1 ? "Selecciona los integrantes del grupo" : "Selecciona una persona, o marca varias para crear un grupo"}
            </p>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {usuarios.map((u) => {
                const marcado = seleccionados.includes(u.uid);
                return (
                  <button
                    key={u.uid}
                    onClick={() => toggleSeleccion(u.uid)}
                    style={{ background: marcado ? "var(--bg-surface)" : "transparent" }}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:[background:var(--hover-overlay)] transition-colors text-left"
                  >
                    <div style={{ background: "var(--success)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">{u.nombre.charAt(0).toUpperCase()}</span>
                    </div>
                    <span style={{ color: "var(--text-primary)" }} className="text-sm flex-1 truncate">{u.nombre}</span>
                    {marcado && (
                      <div style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={iniciarConversacion}
              disabled={seleccionados.length === 0 || (seleccionados.length > 1 && !nombreGrupo.trim())}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mt-4 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {seleccionados.length > 1 ? "Crear grupo" : "Iniciar conversación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
