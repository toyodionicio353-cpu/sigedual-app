"use client";
import { useEffect, useRef, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Usuario } from "@/types";

interface Mensaje {
  id: string;
  texto: string;
  uid: string;
  nombre: string;
  liceoId: string;
  creadoEn: string;
  grupoId: string;
}

export default function MensajesPage() {
  const { usuario } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [grupoId] = useState("general");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usuario) return;
    const q = query(
      collection(db, "mensajes"),
      where("liceoId", "==", usuario.liceoId),
      where("grupoId", "==", grupoId),
      orderBy("creadoEn", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mensaje)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [usuario, grupoId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !usuario) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, "mensajes"), {
        texto: texto.trim(), uid: usuario.uid, nombre: usuario.nombre,
        liceoId: usuario.liceoId, grupoId, creadoEn: new Date().toISOString(),
      });
      setTexto("");
    } finally { setEnviando(false); }
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  }

  let lastFecha = "";

  return (
    <div className="flex flex-col h-screen p-8 gap-0">
      <div className="mb-4">
        <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Mensajes</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Canal general del establecimiento</p>
      </div>

      {/* Chat */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="flex-1 rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {mensajes.length === 0 && (
            <p style={{ color: "var(--text-muted)" }} className="text-sm text-center mt-8">No hay mensajes aún. ¡Sé el primero en escribir!</p>
          )}
          {mensajes.map((m) => {
            const fecha = new Date(m.creadoEn).toDateString();
            const showFecha = fecha !== lastFecha;
            lastFecha = fecha;
            const esMio = m.uid === usuario?.uid;
            return (
              <div key={m.id}>
                {showFecha && (
                  <div className="text-center my-2">
                    <span style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }} className="text-xs px-3 py-1 rounded-full">
                      {formatFecha(m.creadoEn)}
                    </span>
                  </div>
                )}
                <div className={`flex flex-col ${esMio ? "items-end" : "items-start"}`}>
                  {!esMio && <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1 ml-1">{m.nombre}</p>}
                  <div style={{
                    background: esMio ? "var(--accent-blue)" : "var(--bg-surface)",
                    color: esMio ? "#fff" : "var(--text-primary)",
                    maxWidth: "70%",
                  }} className="px-4 py-2.5 rounded-2xl text-sm">
                    {m.texto}
                  </div>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 mx-1">{formatHora(m.creadoEn)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={enviar} style={{ borderTop: "1px solid var(--border)" }} className="px-4 py-3 flex gap-3">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <button type="submit" disabled={enviando || !texto.trim()} style={{ background: "var(--accent-blue)" }}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
