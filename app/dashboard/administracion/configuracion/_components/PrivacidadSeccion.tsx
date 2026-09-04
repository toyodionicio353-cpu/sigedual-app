"use client";
import { useState } from "react";
import Link from "next/link";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { limpiarPreferencias } from "@/lib/preferencias/storage";
import { limpiarTodosLosBorradores } from "@/lib/borradores/useBorradorAutomatico";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import { ShieldAlert, Scale, ScrollText, Trash2, AlertTriangle } from "lucide-react";

export default function PrivacidadSeccion() {
  const { preferencias, actualizarVarias } = usePreferencias();
  const avisar = useFeedback();
  const [modalEliminar, setModalEliminar] = useState(false);
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);
  const [modalLimpiar, setModalLimpiar] = useState(false);

  function limpiarDatosLocales() {
    limpiarTodosLosBorradores();
    limpiarPreferencias();
    setModalLimpiar(false);
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Privacidad, legal y datos</h2>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">
        Configuraciones sensibles sobre tus datos personales en este dispositivo y en SIGEDUAL.
      </p>

      <SettingRow id="set-cookies" titulo="Preferencias de cookies" descripcion="Gestiona qué categorías de cookies permites en SIGEDUAL." vertical>
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Técnicas / necesarias</p>
              <p style={{ color: "var(--text-muted)" }} className="text-xs">Imprescindibles para el funcionamiento de SIGEDUAL (sesión, seguridad). No se pueden desactivar.</p>
            </div>
            <Switch checked={true} onChange={() => {}} label="Cookies técnicas (siempre activas)" disabled />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Análisis</p>
              <p style={{ color: "var(--text-muted)" }} className="text-xs">Ayudan a entender el uso de la plataforma para mejorarla.</p>
            </div>
            <Switch
              checked={preferencias.cookies.analisis}
              onChange={(v) => { actualizarVarias({ cookies: { ...preferencias.cookies, analisis: v } }); avisar("Preferencia guardada."); }}
              label="Cookies de análisis"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Publicidad</p>
              <p style={{ color: "var(--text-muted)" }} className="text-xs">SIGEDUAL no muestra publicidad actualmente; esta preferencia queda lista por si cambia.</p>
            </div>
            <Switch
              checked={preferencias.cookies.publicidad}
              onChange={(v) => { actualizarVarias({ cookies: { ...preferencias.cookies, publicidad: v } }); avisar("Preferencia guardada."); }}
              label="Cookies de publicidad"
            />
          </div>
        </div>
      </SettingRow>

      <SettingRow id="set-legal" titulo="Información legal" descripcion="Documentos legales de SIGEDUAL." vertical>
        <div className="flex flex-col gap-1 mt-1">
          <Link href="/dashboard/administracion/privacidad" className="inline-flex items-center gap-2 text-sm hover:underline w-fit" style={{ color: "var(--accent-light)" }}>
            <ScrollText size={14} /> Políticas (privacidad y términos de uso)
          </Link>
          <Link href="/dashboard/administracion/aviso-legal" className="inline-flex items-center gap-2 text-sm hover:underline w-fit" style={{ color: "var(--accent-light)" }}>
            <Scale size={14} /> Aviso legal
          </Link>
        </div>
      </SettingRow>

      <SettingRow id="set-eliminar-cuenta" titulo="Eliminar mi cuenta y mis datos" descripcion="Solicita el borrado de tu cuenta y datos personales (derecho al olvido).">
        <button
          onClick={() => { setPasoEliminar(1); setModalEliminar(true); }}
          style={{ background: "var(--danger)", color: "#fff" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ShieldAlert size={15} />
          Solicitar eliminación
        </button>
      </SettingRow>

      <SettingRow id="set-borradores" titulo="Guardar borradores automáticamente" descripcion="Guarda temporalmente información introducida en formularios para evitar pérdidas accidentales. Nunca guarda contraseñas ni información sensible.">
        <Switch
          checked={preferencias.borradoresAutomaticos}
          onChange={(v) => { actualizarVarias({ borradoresAutomaticos: v }); avisar("Configuración actualizada."); }}
          label="Guardar borradores automáticamente"
        />
      </SettingRow>

      <SettingRow id="set-limpiar-cache" titulo="Limpiar datos locales" descripcion="Elimina preferencias y borradores guardados en este dispositivo. No borra información almacenada en el servidor.">
        <button
          onClick={() => setModalLimpiar(true)}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
        >
          <Trash2 size={15} />
          Limpiar caché y preferencias
        </button>
      </SettingRow>

      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setModalEliminar(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Eliminar mi cuenta y mis datos"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} style={{ color: "var(--danger)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">
                {pasoEliminar === 1 ? "¿Eliminar tu cuenta y tus datos?" : "Confirmación final"}
              </h2>
            </div>

            {pasoEliminar === 1 ? (
              <div style={{ color: "var(--text-secondary)" }} className="text-sm flex flex-col gap-2 mb-6">
                <p>Esta solicitud puede incluir la eliminación de tu información personal y preferencias asociadas a tu cuenta.</p>
                <p>Cierta información (por ejemplo, registros académicos o de asignaciones vinculados a la trazabilidad institucional) podría estar sujeta a obligaciones legales o administrativas y no eliminarse de inmediato.</p>
                <p style={{ color: "var(--danger)" }} className="font-medium">Esta acción puede ser irreversible una vez procesada.</p>
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
                Por seguridad, confirma una vez más. SIGEDUAL aún no cuenta con un proceso automático de eliminación: tu solicitud debe ser procesada por un administrador a través de Soporte.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModalEliminar(false)}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              {pasoEliminar === 1 ? (
                <button
                  onClick={() => setPasoEliminar(2)}
                  style={{ background: "var(--danger)", color: "#fff" }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Continuar
                </button>
              ) : (
                <Link
                  href="/dashboard/soporte"
                  onClick={() => setModalEliminar(false)}
                  style={{ background: "var(--danger)", color: "#fff" }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                >
                  Ir a Soporte
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {modalLimpiar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setModalLimpiar(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Limpiar datos locales"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Limpiar datos locales?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Esto elimina tus preferencias, borradores guardados y restablece la configuración predeterminada en este dispositivo. No afecta la información almacenada en el servidor. La página se recargará.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalLimpiar(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button onClick={limpiarDatosLocales} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold">
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
