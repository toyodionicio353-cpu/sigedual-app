"use client";
import { useState } from "react";
import { MessageSquareWarning, Plus, Send, ThumbsUp, Eye, CircleCheck, CircleDot } from "lucide-react";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { useObservacionesEstudiante, type NuevaObservacion } from "@/lib/observaciones/useObservaciones";
import { formatearFecha } from "@/lib/fecha";
import type { EstadoObservacionDual, ObservacionDual, TipoObservacionDual } from "@/types";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ETIQUETA_TIPO: Record<TipoObservacionDual, string> = {
  observacion: "Observación",
  reclamo: "Reclamo",
  felicitacion: "Reconocimiento",
};

/** Colores: el reclamo advierte, el reconocimiento celebra, la
 * observación informa. Ninguno grita. */
const COLOR_TIPO: Record<TipoObservacionDual, string> = {
  observacion: "var(--text-secondary)",
  reclamo: "var(--danger)",
  felicitacion: "var(--success, #16A34A)",
};

const ETIQUETA_ESTADO: Record<EstadoObservacionDual, string> = {
  abierta: "Sin responder",
  en_revision: "En revisión",
  cerrada: "Cerrada",
};

const LIMITE_TEXTO = 1500;

/**
 * Observaciones, reclamos y reconocimientos de un estudiante en su Centro
 * Dual.
 *
 * Quién puede hacer qué lo decide el rol, igual que en las reglas de
 * Firestore: el Centro Dual y el liceo registran; solo el liceo responde y
 * cierra — nadie da por resuelto su propio reclamo.
 */
export default function PanelObservaciones({
  estudianteId, contexto,
}: {
  estudianteId: string;
  contexto?: {
    centroDualId: string;
    especialidadId: string;
    liceoId: string;
    asignacionId?: string;
    profesorSupervisorId?: string;
    estudianteNombre?: string;
  };
}) {
  const { usuario } = useAuth();
  const { observaciones, cargando, error, crear, responder } = useObservacionesEstudiante(estudianteId, contexto);

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [form, setForm] = useState<NuevaObservacion>({ tipo: "observacion", fecha: hoyISO(), texto: "" });

  const esLiceo = usuario ? ["desarrollador", "director", "coordinador", "profesor"].includes(usuario.rol) : false;
  const esCentroDual = usuario?.rol === "centro_dual";
  const puedeRegistrar = Boolean(contexto) && (esLiceo || esCentroDual);

  async function guardar() {
    if (guardando) return;
    if (!form.texto.trim()) { setErrorForm("Escribe lo que ocurrió."); return; }
    if (!form.fecha) { setErrorForm("Indica cuándo ocurrió."); return; }
    setGuardando(true);
    setErrorForm("");
    try {
      await crear(form);
      setForm({ tipo: "observacion", fecha: hoyISO(), texto: "" });
      setAbierto(false);
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]";

  return (
    <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold flex items-center gap-2">
            <MessageSquareWarning size={16} style={{ color: "var(--accent-light)" }} />
            Observaciones y reclamos
          </h2>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
            {esCentroDual
              ? "Lo que registres acá llega al liceo, que responde y cierra el caso."
              : "Lo que el Centro Dual levanta sobre este estudiante. Responder cierra el caso."}
          </p>
        </div>
        {puedeRegistrar && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} /> Registrar
          </button>
        )}
      </div>

      {abierto && (
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 mb-4 flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Tipo</label>
              <Select
                value={form.tipo}
                onChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoObservacionDual }))}
                ariaLabel="Tipo de registro"
                opciones={[
                  { value: "observacion", label: "Observación" },
                  { value: "reclamo", label: "Reclamo" },
                  { value: "felicitacion", label: "Reconocimiento" },
                ]}
              />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">¿Cuándo ocurrió?</label>
              <input
                type="date"
                value={form.fecha}
                max={hoyISO()}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                style={inputStyle}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Qué pasó</label>
            <textarea
              value={form.texto}
              maxLength={LIMITE_TEXTO}
              onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
              rows={4}
              placeholder="Describe el hecho con la mayor precisión posible: qué pasó, cuándo y quiénes estaban."
              style={inputStyle}
              className={inputClass + " resize-y"}
            />
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1">
              {form.texto.length} / {LIMITE_TEXTO}. Queda registrado con tu nombre y no se puede editar después.
            </p>
          </div>
          {errorForm && <p style={{ color: "var(--danger)" }} className="text-xs">{errorForm}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)", opacity: guardando ? 0.6 : 1 }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {guardando ? "Guardando..." : "Registrar"}
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(false); setErrorForm(""); }}
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              className="px-4 py-2 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando && <p style={{ color: "var(--text-muted)" }} className="text-xs">Cargando...</p>}
      {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}

      {!cargando && !error && observaciones.length === 0 && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          Todavía no hay nada registrado sobre este estudiante.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {observaciones.map((o) => (
          <Tarjeta key={o.id} obs={o} puedeResponder={esLiceo} onResponder={responder} />
        ))}
      </div>
    </section>
  );
}

function Tarjeta({
  obs, puedeResponder, onResponder,
}: {
  obs: ObservacionDual;
  puedeResponder: boolean;
  onResponder: (obs: ObservacionDual, respuesta: string, estado: EstadoObservacionDual) => Promise<void>;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const color = COLOR_TIPO[obs.tipo];
  const iconoEstado = obs.estado === "cerrada"
    ? <CircleCheck size={12} />
    : obs.estado === "en_revision" ? <Eye size={12} /> : <CircleDot size={12} />;

  async function enviar(estado: EstadoObservacionDual) {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await onResponder(obs, texto, estado);
      setTexto("");
      setRespondiendo(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", borderLeft: `3px solid ${color}` }} className="rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <span style={{ color }} className="text-xs font-bold flex items-center gap-1.5">
          {obs.tipo === "felicitacion" ? <ThumbsUp size={13} /> : <MessageSquareWarning size={13} />}
          {ETIQUETA_TIPO[obs.tipo]}
        </span>
        <span style={{ color: "var(--text-muted)" }} className="text-[11px] flex items-center gap-1.5">
          {iconoEstado} {ETIQUETA_ESTADO[obs.estado]}
        </span>
      </div>

      <p style={{ color: "var(--text-primary)" }} className="text-sm whitespace-pre-wrap">{obs.texto}</p>

      <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-2">
        Ocurrió el {formatearFecha(obs.fecha)} · Registrado por {obs.creadoPorNombre}
      </p>

      {obs.respuesta && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="mt-3 pt-3">
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-1">
            Respuesta del liceo
          </p>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap">{obs.respuesta}</p>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1">
            {obs.respondidaPorNombre}
            {obs.respondidaEn ? ` · ${formatearFecha(obs.respondidaEn)}` : ""}
          </p>
        </div>
      )}

      {puedeResponder && obs.estado !== "cerrada" && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="mt-3 pt-3">
          {respondiendo ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={texto}
                maxLength={LIMITE_TEXTO}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                placeholder="Qué se hizo o se va a hacer con esto."
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => enviar("cerrada")}
                  disabled={enviando || !texto.trim()}
                  style={{ background: "var(--accent)", color: "var(--text-on-accent)", opacity: enviando || !texto.trim() ? 0.6 : 1 }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send size={13} /> Responder y cerrar
                </button>
                <button
                  type="button"
                  onClick={() => enviar("en_revision")}
                  disabled={enviando || !texto.trim()}
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                >
                  Responder y dejar en revisión
                </button>
                <button
                  type="button"
                  onClick={() => { setRespondiendo(false); setTexto(""); }}
                  style={{ color: "var(--text-muted)" }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setRespondiendo(true); setTexto(obs.respuesta ?? ""); }}
              style={{ color: "var(--accent-light)" }}
              className="text-xs font-semibold"
            >
              {obs.respuesta ? "Actualizar respuesta" : "Responder"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
