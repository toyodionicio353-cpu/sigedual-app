"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarX, Check, Plus, Undo2, X, ShieldCheck, Clock, FileText } from "lucide-react";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { useFaltasEstudiante, type NuevaFalta } from "@/lib/faltas/useFaltas";
import { ETIQUETA_JORNADA_CORTA, formatearDias } from "@/lib/faltas/calculo";
import { formatearFecha } from "@/lib/fecha";
import type { FaltaDual, JornadaFalta } from "@/types";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Cifra({ valor, etiqueta, color }: { valor: string; etiqueta: string; color?: string }) {
  return (
    <div>
      <p style={{ color: color ?? "var(--text-primary)" }} className="text-xl font-black leading-none">{valor}</p>
      <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mt-1">{etiqueta}</p>
    </div>
  );
}

/**
 * Centro de faltas de un estudiante a su Centro Dual: cuántos días perdió,
 * cuántos debe reponer y el detalle de cada ausencia.
 *
 * Quién puede hacer qué lo decide el rol, igual que en las reglas de
 * Firestore: el liceo registra y confirma; el Centro Dual avisa de una
 * ausencia y consulta, pero no decide lo que el estudiante debe reponer.
 */
export default function CentroFaltas({
  estudianteId, contexto,
}: {
  estudianteId: string;
  contexto?: {
    asignacionId: string;
    centroDualId: string;
    especialidadId: string;
    liceoId: string;
    profesorSupervisorId?: string;
    estudianteNombre?: string;
  };
}) {
  const { usuario } = useAuth();
  const {
    faltas, resumen, cargando, error,
    registrar, confirmar, anular, marcarRecuperada,
  } = useFaltasEstudiante(estudianteId, contexto);

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [form, setForm] = useState<NuevaFalta>({
    fecha: hoyISO(), jornada: "completa", justificada: false, requiereRecuperacion: true, motivo: "",
  });

  const esCentroDual = usuario?.rol === "centro_dual";
  const esLiceo = usuario ? ["desarrollador", "director", "coordinador", "profesor"].includes(usuario.rol) : false;
  const puedeRegistrar = Boolean(contexto) && (esLiceo || esCentroDual);
  const puedeGestionar = esLiceo;

  async function guardar() {
    if (guardando) return;
    if (!form.fecha) { setErrorForm("Indica el día de la ausencia."); return; }
    setGuardando(true);
    setErrorForm("");
    try {
      await registrar(form);
      setForm({ fecha: hoyISO(), jornada: "completa", justificada: false, requiereRecuperacion: true, motivo: "" });
      setAbierto(false);
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo registrar la falta.");
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen: lo que de verdad se quiere saber de un vistazo. */}
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
        className="rounded-xl p-4 flex items-center gap-6 flex-wrap"
      >
        <Cifra valor={formatearDias(resumen.diasTotales)} etiqueta="Días perdidos" />
        <Cifra
          valor={formatearDias(resumen.diasPendientes)}
          etiqueta="Por recuperar"
          color={resumen.diasPendientes > 0 ? "var(--warning)" : "var(--success)"}
        />
        <Cifra valor={formatearDias(resumen.diasRecuperados)} etiqueta="Recuperados" color="var(--success)" />
        {resumen.porConfirmar > 0 && (
          <Cifra valor={String(resumen.porConfirmar)} etiqueta="Por confirmar" color="var(--accent-light)" />
        )}
      </div>

      {/* Sin esto, un Centro Dual que avisó tres ausencias ve "0 días
          perdidos" y cree que no se registró nada. Los días que avisó
          están ahí, esperando al liceo. */}
      {esCentroDual && resumen.porConfirmar > 0 && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          {resumen.porConfirmar === 1 ? "Avisaste de 1 ausencia que" : `Avisaste de ${resumen.porConfirmar} ausencias que`}
          {" "}el liceo todavía no confirma. Hasta que las confirme no suman días perdidos ni días por recuperar.
        </p>
      )}

      {!contexto && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          Este estudiante no tiene una asignación vigente a un Centro Dual, así que todavía no se le pueden registrar faltas.
        </p>
      )}

      {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {puedeRegistrar && !abierto && (
          <button
            onClick={() => setAbierto(true)}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
          >
            <Plus size={15} /> {esCentroDual ? "Avisar de una ausencia" : "Registrar falta"}
          </button>
        )}
        {/* El certificado sale de acá mismo: los números son los que se
            están viendo arriba, no unos escritos aparte. */}
        {esLiceo && resumen.cantidadFaltas > 0 && (
          <Link
            href={`/dashboard/estudiantes/${estudianteId}/certificado-faltas`}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
          >
            <FileText size={15} /> Certificado de faltas
          </Link>
        )}
      </div>

      {abierto && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 flex flex-col gap-3">
          {esCentroDual && (
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              Tu aviso queda pendiente hasta que el Profesor Supervisor lo confirme. Recién entonces cuenta como falta.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label style={{ color: "var(--text-secondary)" }} className="text-xs">
              <span className="block mb-1">Día</span>
              <input
                type="date"
                value={form.fecha}
                max={hoyISO()}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                style={inputStyle}
                className={inputClass}
              />
            </label>
            <div>
              <span style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Jornada</span>
              <Select
                value={form.jornada}
                onChange={(v) => setForm((f) => ({ ...f, jornada: v as JornadaFalta }))}
                ariaLabel="Jornada de la ausencia"
                opciones={[
                  { value: "completa", label: "Día completo" },
                  { value: "manana", label: "Media jornada (A.M.)" },
                  { value: "tarde", label: "Media jornada (P.M.)" },
                ]}
              />
            </div>
          </div>

          <label style={{ color: "var(--text-secondary)" }} className="text-xs">
            <span className="block mb-1">Motivo (opcional)</span>
            <input
              value={form.motivo ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              placeholder="Ej: Licencia médica, trámite familiar..."
              style={inputStyle}
              className={inputClass}
            />
          </label>

          {!esCentroDual && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={form.justificada}
                  onChange={(e) => setForm((f) => ({ ...f, justificada: e.target.checked }))}
                />
                Justificada (con permiso, certificado médico u otro respaldo)
              </label>
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={form.requiereRecuperacion}
                  onChange={(e) => setForm((f) => ({ ...f, requiereRecuperacion: e.target.checked }))}
                />
                Debe recuperar este día en el centro
              </label>
            </div>
          )}

          {errorForm && <p style={{ color: "var(--danger)" }} className="text-xs">{errorForm}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {guardando ? "Guardando..." : esCentroDual ? "Enviar aviso" : "Registrar falta"}
            </button>
            <button
              onClick={() => { setAbierto(false); setErrorForm(""); }}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="px-4 py-2 rounded-xl text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Detalle */}
      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando faltas...</p>
      ) : faltas.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }} className="text-sm inline-flex items-center gap-2">
          <CalendarX size={14} /> Sin faltas registradas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {faltas.map((f) => (
            <FilaFalta
              key={f.id}
              falta={f}
              puedeGestionar={puedeGestionar}
              onConfirmar={() => confirmar(f)}
              onAnular={() => { if (confirm(`¿Anular la falta del ${formatearFecha(f.fecha)}?\n\nSe conserva en el historial, pero deja de contar.`)) anular(f); }}
              onRecuperada={(v) => marcarRecuperada(f, v)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaFalta({
  falta, puedeGestionar, onConfirmar, onAnular, onRecuperada,
}: {
  falta: FaltaDual;
  puedeGestionar: boolean;
  onConfirmar: () => void;
  onAnular: () => void;
  onRecuperada: (recuperada: boolean) => void;
}) {
  const anulada = falta.estado === "anulada";
  const reportada = falta.estado === "reportada";

  return (
    <li
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${anulada ? "var(--border-light)" : reportada ? "var(--accent)" : falta.justificada ? "var(--success)" : "var(--danger)"}`,
        opacity: anulada ? 0.55 : 1,
      }}
      className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
    >
      <div className="min-w-0 flex-1">
        <p style={{ color: "var(--text-primary)", textDecoration: anulada ? "line-through" : undefined }} className="text-sm font-semibold">
          {formatearFecha(falta.fecha)}
        </p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          {ETIQUETA_JORNADA_CORTA[falta.jornada]}
          {falta.motivo ? ` · ${falta.motivo}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {reportada && (
          <span style={{ color: "var(--accent-light)", background: "var(--accent)22" }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Clock size={9} /> Avisada por el centro
          </span>
        )}
        {anulada && (
          <span style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Anulada
          </span>
        )}
        {!anulada && falta.justificada && (
          <span style={{ color: "var(--success)", background: "var(--success)22" }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <ShieldCheck size={9} /> Justificada
          </span>
        )}
        {!anulada && falta.requiereRecuperacion && (
          <span
            style={{
              color: falta.recuperada ? "var(--success)" : "var(--warning)",
              background: `${falta.recuperada ? "var(--success)" : "var(--warning)"}22`,
            }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          >
            {falta.recuperada ? "Recuperada" : "Por recuperar"}
          </span>
        )}
      </div>

      {puedeGestionar && !anulada && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {reportada && (
            <button
              onClick={onConfirmar}
              title="Confirmar la falta"
              aria-label={`Confirmar la falta del ${formatearFecha(falta.fecha)}`}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="p-1.5 rounded-lg"
            >
              <Check size={13} />
            </button>
          )}
          {falta.requiereRecuperacion && falta.estado === "confirmada" && (
            <button
              onClick={() => onRecuperada(!falta.recuperada)}
              title={falta.recuperada ? "Deshacer: todavía la debe" : "Marcar como recuperada"}
              aria-label={falta.recuperada ? "Deshacer la recuperación" : "Marcar como recuperada"}
              style={{ color: falta.recuperada ? "var(--text-muted)" : "var(--success)" }}
              className="p-1.5"
            >
              {falta.recuperada ? <Undo2 size={13} /> : <Check size={13} />}
            </button>
          )}
          <button
            onClick={onAnular}
            title="Anular"
            aria-label={`Anular la falta del ${formatearFecha(falta.fecha)}`}
            style={{ color: "var(--danger)" }}
            className="p-1.5"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </li>
  );
}
