"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useDemos } from "@/lib/demo/useDemos";
import { generarDemo, cancelarDemo } from "@/lib/demo/gestionarDemo";
import { estadoEfectivo, formatearTiempoRestante, ETIQUETA_ESTADO_DEMO } from "@/lib/demo";
import type { DemoInstancia, EstadoDemo } from "@/types";
import TituloPagina from "@/components/TituloPagina";
import { Clock, Plus, Copy, Check, ExternalLink, Ban } from "lucide-react";

const COLOR_ESTADO: Record<EstadoDemo, string> = {
  activa: "var(--success)",
  vencida: "var(--text-muted)",
  cancelada: "var(--danger)",
  datos_eliminados: "var(--text-muted)",
};

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function TarjetaDemo({ demo, onCopiar, copiada, onCancelar, cancelando }: {
  demo: DemoInstancia;
  onCopiar: () => void;
  copiada: boolean;
  onCancelar: () => void;
  cancelando: boolean;
}) {
  const estado = estadoEfectivo(demo);
  const enlace = typeof window !== "undefined" ? `${window.location.origin}/demo/${demo.id}` : `/demo/${demo.id}`;
  const puedeCancelar = estado === "activa";

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">
          {demo.liceoNombre ?? "Demo sin reclamar"}
        </h2>
        <span
          style={{ background: `${COLOR_ESTADO[estado]}22`, color: COLOR_ESTADO[estado] }}
          className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
        >
          {ETIQUETA_ESTADO_DEMO[estado]}
        </span>
      </div>

      <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3 flex items-center justify-between gap-3 mb-4">
        <span style={{ color: "var(--text-primary)" }} className="text-sm font-mono truncate">{enlace}</span>
        <button onClick={onCopiar} style={{ color: "var(--text-muted)" }} className="p-1.5 hover:[color:var(--text-primary)] transition-colors flex-shrink-0" title="Copiar enlace">
          {copiada ? <Check size={16} style={{ color: "var(--success)" }} /> : <Copy size={16} />}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
        <dt style={{ color: "var(--text-muted)" }}>Emitido</dt>
        <dd style={{ color: "var(--text-secondary)" }}>{formatearFechaHora(demo.emitidoEn)}</dd>
        <dt style={{ color: "var(--text-muted)" }}>Vence</dt>
        <dd style={{ color: "var(--text-secondary)" }}>{formatearFechaHora(demo.venceEn)}</dd>
        {estado === "activa" && (
          <>
            <dt style={{ color: "var(--text-muted)" }}>Tiempo restante</dt>
            <dd style={{ color: "var(--text-secondary)" }}>{formatearTiempoRestante(demo.venceEn)}</dd>
          </>
        )}
        <dt style={{ color: "var(--text-muted)" }}>Generado por</dt>
        <dd style={{ color: "var(--text-secondary)" }}>{demo.generadoPorNombre}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <a
          href={enlace} target="_blank" rel="noopener noreferrer"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
        >
          <ExternalLink size={13} />
          Ver demostración
        </a>
        {puedeCancelar && (
          <button
            onClick={onCancelar}
            disabled={cancelando}
            style={{ background: "var(--danger)22", color: "var(--danger)" }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Ban size={13} />
            {cancelando ? "Cancelando..." : "Cancelar enlace"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AccesoDemostracionPage() {
  const { usuario } = useAuth();
  const { demos, cargando, recargar } = useDemos();
  const [generando, setGenerando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState<string | null>(null);

  if (!usuario) return null;
  if (usuario.rol !== "administrador") {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  async function generar() {
    if (!usuario || generando) return;
    setGenerando(true);
    try {
      await generarDemo({ administradorUid: usuario.uid, administradorNombre: usuario.nombre });
      await recargar();
    } finally {
      setGenerando(false);
    }
  }

  function copiar(demo: DemoInstancia) {
    const enlace = `${window.location.origin}/demo/${demo.id}`;
    navigator.clipboard.writeText(enlace);
    setCopiadoId(demo.id);
    setTimeout(() => setCopiadoId(null), 1500);
  }

  async function confirmarYcancelar() {
    if (!usuario || !confirmarCancelar) return;
    setCancelandoId(confirmarCancelar);
    try {
      await cancelarDemo({ demoId: confirmarCancelar, administradorUid: usuario.uid, administradorNombre: usuario.nombre });
      await recargar();
    } finally {
      setCancelandoId(null);
      setConfirmarCancelar(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Clock size={28} />} className="mb-1">Acceso de Demostración</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            Genera un enlace único para que una institución use SIGEDUAL gratis durante 7 días
            (168 horas exactas) antes de contratar el servicio.
          </p>
        </div>
        <button
          onClick={generar}
          disabled={generando}
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
        >
          <Plus size={16} />
          {generando ? "Generando..." : "Generar enlace de demostración"}
        </button>
      </div>

      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : demos.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Todavía no hay demostraciones generadas.</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Usa el botón de arriba para crear el primer enlace.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {demos.map((demo) => (
            <TarjetaDemo
              key={demo.id}
              demo={demo}
              onCopiar={() => copiar(demo)}
              copiada={copiadoId === demo.id}
              onCancelar={() => setConfirmarCancelar(demo.id)}
              cancelando={cancelandoId === demo.id}
            />
          ))}
        </div>
      )}

      {confirmarCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setConfirmarCancelar(null)}>
          <div
            role="dialog" aria-modal="true" aria-label="Cancelar enlace de demostración"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Cancelar este enlace?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              El enlace dejará de funcionar de inmediato. Esto no elimina datos ni afecta a los usuarios ya registrados en la demo — para eso usa "Eliminar datos de la demostración" desde dentro de la propia demo, una vez vencida.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarCancelar(null)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button onClick={confirmarYcancelar} style={{ background: "var(--danger)", color: "#fff" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold">
                Sí, invalidar enlace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
