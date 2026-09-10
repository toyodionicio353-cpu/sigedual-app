"use client";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fechaMensaje, inicial, colorAvatar } from "@/lib/mensajes/formato";
import { ArrowLeft, Star, Trash2, MoreVertical, Send, MailOpen, Paperclip } from "lucide-react";
import type { Conversacion, MensajeConversacion } from "@/types";

export default function VistaConversacion({
  conversacion, titulo, destacada, formatoHora, enviando,
  onVolver, onDestacar, onEliminar, onMarcarNoLeida, onResponder,
}: {
  conversacion: Conversacion;
  /** Con quién es el hilo, ya resuelto por la página. */
  titulo: string;
  destacada: boolean;
  formatoHora: "12" | "24";
  enviando: boolean;
  onVolver: () => void;
  onDestacar: () => void;
  onEliminar: () => void;
  onMarcarNoLeida: () => void;
  onResponder: (texto: string) => Promise<void>;
}) {
  const [mensajes, setMensajes] = useState<MensajeConversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [respuesta, setRespuesta] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCargando(true);
    setMensajes([]);
    setRespuesta("");
    const q = query(collection(db, "conversaciones", conversacion.id, "mensajes"), orderBy("creadoEn", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MensajeConversacion)));
        setCargando(false);
        setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      },
      () => setCargando(false)
    );
    return () => unsub();
  }, [conversacion.id]);

  async function enviarRespuesta() {
    const texto = respuesta.trim();
    if (!texto || enviando) return;
    setRespuesta("");
    await onResponder(texto);
  }

  const asunto = conversacion.asunto || conversacion.nombre || "(sin asunto)";

  return (
    <div className="flex flex-col h-full">
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="flex items-center gap-2 px-3 sm:px-4 py-3 flex-shrink-0"
      >
        <button onClick={onVolver} title="Volver" aria-label="Volver a la bandeja" style={{ color: "var(--text-secondary)" }} className="flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold truncate">{asunto}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">{titulo}</p>
        </div>
        <button
          onClick={onDestacar}
          title={destacada ? "Quitar destacado" : "Destacar"}
          aria-label={destacada ? "Quitar destacado" : "Destacar"}
          className="flex-shrink-0 p-1.5"
        >
          <Star size={17} style={{ color: destacada ? "var(--accent)" : "var(--text-muted)" }} fill={destacada ? "var(--accent)" : "none"} />
        </button>
        <button onClick={onEliminar} title="Mover a papelera" aria-label="Mover a papelera" style={{ color: "var(--text-muted)" }} className="flex-shrink-0 p-1.5">
          <Trash2 size={17} />
        </button>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            title="Más acciones"
            aria-label="Más acciones"
            style={{ color: "var(--text-muted)" }}
            className="p-1.5"
          >
            <MoreVertical size={17} />
          </button>
          {menuAbierto && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuAbierto(false)} />
              <div
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
                className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-2xl overflow-hidden z-40 py-1"
              >
                <button
                  onClick={() => { setMenuAbierto(false); onMarcarNoLeida(); }}
                  style={{ color: "var(--text-primary)" }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:[background:var(--hover-overlay)] transition-colors text-left"
                >
                  <MailOpen size={14} /> Marcar como no leída
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
        {cargando ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando mensajes...</p>
        ) : (
          <div className="flex flex-col">
            {mensajes.map((m, i) => (
              <div key={m.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }} className="py-4 first:pt-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    style={{ background: colorAvatar(m.nombre), color: "var(--text-on-accent)" }}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    aria-hidden
                  >
                    {inicial(m.nombre)}
                  </span>
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate flex-1">{m.nombre}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs flex-shrink-0">{fechaMensaje(m.creadoEn, formatoHora)}</p>
                </div>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap leading-relaxed pl-9">{m.texto}</p>
                {m.adjuntos && m.adjuntos.length > 0 && (
                  <div className="pl-9 mt-3 flex flex-col gap-1.5">
                    {m.adjuntos.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-fit hover:[border-color:var(--accent)] transition-colors"
                      >
                        <Paperclip size={13} /> {a.nombre}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }} className="p-3 sm:p-4 flex-shrink-0">
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder="Escribe tu respuesta..."
          rows={3}
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-y"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={enviarRespuesta}
            disabled={!respuesta.trim() || enviando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send size={15} />
            {enviando ? "Enviando..." : "Responder"}
          </button>
        </div>
      </div>
    </div>
  );
}
