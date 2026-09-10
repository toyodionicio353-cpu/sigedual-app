"use client";
import { useMemo, useState } from "react";
import { ROL_LABEL } from "@/lib/roles";
import { inicial, colorAvatar } from "@/lib/mensajes/formato";
import { X, Send, Search, FileText, Trash2 } from "lucide-react";
import type { Usuario } from "@/types";

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface BorradorEnEdicion {
  id?: string;
  destinatarios: string[];
  asunto: string;
  cuerpo: string;
}

export default function ModalRedactar({
  contactos, cargandoContactos, inicialValores, enviando, errorEnvio,
  onCerrar, onEnviar, onGuardarBorrador, onDescartar,
}: {
  contactos: Usuario[];
  cargandoContactos: boolean;
  inicialValores?: BorradorEnEdicion;
  enviando: boolean;
  /** Falla real al enviar, informada por la página. */
  errorEnvio?: string;
  onCerrar: () => void;
  onEnviar: (datos: BorradorEnEdicion) => Promise<void>;
  onGuardarBorrador: (datos: BorradorEnEdicion) => Promise<void>;
  onDescartar: (id?: string) => Promise<void>;
}) {
  const [destinatarios, setDestinatarios] = useState<string[]>(inicialValores?.destinatarios ?? []);
  const [asunto, setAsunto] = useState(inicialValores?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(inicialValores?.cuerpo ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  const contactosPorUid = useMemo(() => {
    const map: Record<string, Usuario> = {};
    contactos.forEach((c) => (map[c.uid] = c));
    return map;
  }, [contactos]);

  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const disponibles = contactos.filter((c) => !destinatarios.includes(c.uid));
    if (!q) return disponibles.slice(0, 6);
    return disponibles
      .filter((c) => normalizar(`${c.nombre} ${ROL_LABEL[c.rol]} ${c.especialidad ?? ""}`).includes(q))
      .slice(0, 6);
  }, [contactos, destinatarios, busqueda]);

  const datos: BorradorEnEdicion = { id: inicialValores?.id, destinatarios, asunto, cuerpo };
  const hayContenido = Boolean(destinatarios.length > 0 || asunto.trim() || cuerpo.trim());

  /** Cerrar sin enviar no pierde lo escrito: se guarda como borrador, que es
   * lo que se espera de un redactor. Si no hay nada escrito, solo cierra. */
  async function cerrar() {
    if (hayContenido && !enviando) await onGuardarBorrador(datos);
    else onCerrar();
  }

  async function enviar() {
    setError("");
    if (destinatarios.length === 0) { setError("Elige al menos un destinatario."); return; }
    if (!cuerpo.trim()) { setError("Escribe el mensaje antes de enviarlo."); return; }
    await onEnviar(datos);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={cerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Redactar mensaje"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">
            {inicialValores?.id ? "Continuar borrador" : "Nuevo mensaje"}
          </h2>
          <button onClick={cerrar} style={{ color: "var(--text-muted)" }} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Para</label>
            {destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {destinatarios.map((uid) => {
                  const u = contactosPorUid[uid];
                  return (
                    <span
                      key={uid}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-medium"
                    >
                      {u?.nombre ?? "Usuario"}
                      <button
                        onClick={() => setDestinatarios((prev) => prev.filter((d) => d !== uid))}
                        aria-label={`Quitar a ${u?.nombre ?? "usuario"}`}
                        style={{ color: "var(--text-muted)" }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search size={15} style={{ color: "var(--text-muted)" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={cargandoContactos ? "Cargando personas..." : "Buscar persona por nombre o rol"}
                disabled={cargandoContactos}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>

            {!cargandoContactos && contactos.length === 0 && (
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2">
                Todavía no tienes personas a quienes escribirles. Aparecerán aquí en cuanto tengas una asignación vigente.
              </p>
            )}

            {sugerencias.length > 0 && (
              <div style={{ border: "1px solid var(--border)" }} className="rounded-lg mt-2 max-h-44 overflow-y-auto">
                {sugerencias.map((c, i) => (
                  <button
                    key={c.uid}
                    onClick={() => { setDestinatarios((prev) => [...prev, c.uid]); setBusqueda(""); }}
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:[background:var(--hover-overlay)] transition-colors text-left"
                  >
                    <span
                      style={{ background: colorAvatar(c.nombre), color: "var(--text-on-accent)" }}
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      aria-hidden
                    >
                      {inicial(c.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate block">{c.nombre}</span>
                      <span style={{ color: "var(--text-muted)" }} className="text-xs truncate block">
                        {ROL_LABEL[c.rol]}{c.especialidad ? ` · ${c.especialidad}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Asunto</label>
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej: Visita al Centro Dual del jueves"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Mensaje</label>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={7}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-y"
            />
          </div>

          {(error || errorEnvio) && (
            <p style={{ color: "var(--danger)" }} className="text-xs">{error || errorEnvio}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4 flex-shrink-0">
          <button
            onClick={enviar}
            disabled={enviando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send size={15} />
            {enviando ? "Enviando..." : "Enviar"}
          </button>
          <button
            onClick={() => onGuardarBorrador(datos)}
            disabled={!hayContenido || enviando}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-40"
          >
            <FileText size={15} />
            Guardar borrador
          </button>
          <button
            onClick={() => onDescartar(inicialValores?.id)}
            style={{ color: "var(--danger)" }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ml-auto hover:opacity-80 transition-opacity"
            title="Descartar"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Descartar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
