"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import type { NotificacionesCategorias } from "@/types/preferencias";
import type { Rol } from "@/types";

const CATEGORIAS: { key: keyof NotificacionesCategorias; label: string; roles: Rol[] }[] = [
  { key: "mensajes", label: "Mensajes", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { key: "comentarios", label: "Comentarios", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { key: "evaluaciones", label: "Evaluaciones", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { key: "visitas", label: "Visitas", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"] },
  { key: "bitacoras", label: "Bitácoras", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { key: "documentos", label: "Documentos", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"] },
  { key: "asignaciones", label: "Asignaciones", roles: ["administrador", "coordinador", "director", "profesor"] },
  { key: "alertasAdministrativas", label: "Alertas administrativas", roles: ["administrador", "coordinador", "director"] },
];

type EstadoPermiso = "no-soportado" | "pendiente" | "bloqueado" | "activado";

export default function NotificacionesSeccion() {
  const { usuario } = useAuth();
  const { preferencias, actualizar, actualizarVarias } = usePreferencias();
  const avisar = useFeedback();
  const [permiso, setPermiso] = useState<EstadoPermiso>("no-soportado");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermiso("no-soportado");
      return;
    }
    setPermiso(Notification.permission === "granted" ? "activado" : Notification.permission === "denied" ? "bloqueado" : "pendiente");
  }, []);

  async function activarPush() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const resultado = await Notification.requestPermission();
    setPermiso(resultado === "granted" ? "activado" : resultado === "denied" ? "bloqueado" : "pendiente");
    actualizar("notificacionesPush", resultado === "granted");
    if (resultado === "granted") avisar("Notificaciones push activadas.");
  }

  const ETIQUETA_PERMISO: Record<EstadoPermiso, { texto: string; color: string }> = {
    "no-soportado": { texto: "No disponible en este navegador", color: "var(--text-muted)" },
    pendiente: { texto: "Permiso pendiente", color: "var(--warning)" },
    bloqueado: { texto: "Bloqueado por el navegador", color: "var(--danger)" },
    activado: { texto: "Activado", color: "var(--success)" },
  };

  const categoriasVisibles = CATEGORIAS.filter((c) => usuario && c.roles.includes(usuario.rol));

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Notificaciones y alertas</h2>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">
        Decide qué avisos quieres recibir. Estas preferencias quedan guardadas para cuando el sistema de notificaciones las use.
      </p>

      <SettingRow
        id="set-push"
        titulo="Notificaciones push"
        descripcion="Recibe avisos del sistema cuando el navegador lo permita."
        badge={
          <span style={{ color: ETIQUETA_PERMISO[permiso].color, background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {ETIQUETA_PERMISO[permiso].texto}
          </span>
        }
      >
        {permiso === "activado" ? (
          <Switch checked={preferencias.notificacionesPush} onChange={(v) => { actualizar("notificacionesPush", v); avisar("Configuración actualizada."); }} label="Notificaciones push" />
        ) : permiso === "no-soportado" || permiso === "bloqueado" ? (
          <span style={{ color: "var(--text-muted)" }} className="text-xs">
            {permiso === "bloqueado" ? "Habilítalas desde los ajustes del navegador." : "—"}
          </span>
        ) : (
          <button onClick={activarPush} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold">
            Activar
          </button>
        )}
      </SettingRow>

      <SettingRow id="set-categorias" titulo="Notificaciones dentro de SIGEDUAL" descripcion="Elige qué tipo de eventos quieres que te avisen, según tu rol." vertical>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-1">
          {categoriasVisibles.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3 py-1">
              <span style={{ color: "var(--text-primary)" }} className="text-sm">{c.label}</span>
              <Switch
                checked={preferencias.notificacionesCategorias[c.key]}
                onChange={(v) => actualizarVarias({ notificacionesCategorias: { ...preferencias.notificacionesCategorias, [c.key]: v } })}
                label={c.label}
              />
            </div>
          ))}
        </div>
      </SettingRow>

      <SettingRow id="set-nomolestar" titulo="No molestar" descripcion="Silencia notificaciones no críticas durante un horario. Las alertas críticas o de seguridad se mantienen visibles." vertical>
        <div className="flex items-center gap-3">
          <Switch
            checked={preferencias.noMolestar.activo}
            onChange={(v) => { actualizarVarias({ noMolestar: { ...preferencias.noMolestar, activo: v } }); avisar("Configuración actualizada."); }}
            label="No molestar"
          />
          <span style={{ color: "var(--text-secondary)" }} className="text-sm">Activar</span>
        </div>
        {preferencias.noMolestar.activo && (
          <div className="flex items-center gap-3 mt-1">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Inicio</label>
              <input
                type="time"
                value={preferencias.noMolestar.inicio}
                onChange={(e) => actualizarVarias({ noMolestar: { ...preferencias.noMolestar, inicio: e.target.value } })}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
            <span style={{ color: "var(--text-muted)" }} className="mt-4">—</span>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Término</label>
              <input
                type="time"
                value={preferencias.noMolestar.fin}
                onChange={(e) => actualizarVarias({ noMolestar: { ...preferencias.noMolestar, fin: e.target.value } })}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
          </div>
        )}
      </SettingRow>

      <SettingRow id="set-resumen" titulo="Frecuencia de resúmenes por email" descripcion="Al activarlo, el sistema de notificaciones podrá enviarte un resumen periódico. Cambiar esta opción no envía correos por sí sola." vertical>
        <select
          value={preferencias.resumenEmail}
          onChange={(e) => { actualizar("resumenEmail", e.target.value as typeof preferencias.resumenEmail); avisar("Configuración actualizada."); }}
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        >
          <option value="desactivado">Desactivado</option>
          <option value="diario">Diario</option>
          <option value="semanal">Semanal</option>
        </select>
      </SettingRow>
    </div>
  );
}
