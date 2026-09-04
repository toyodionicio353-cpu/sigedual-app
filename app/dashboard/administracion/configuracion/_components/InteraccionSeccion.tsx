"use client";
import { useState } from "react";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { MODULOS_DASHBOARD_DISPONIBLES } from "@/lib/preferencias/modulosDisponibles";
import { EVENTO_ABRIR_ATAJOS } from "@/components/ShortcutsProvider";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import type { DashboardModuloPref } from "@/types/preferencias";
import { GripVertical, Eye, EyeOff, Pin, PinOff, RotateCcw } from "lucide-react";

function ordenActual(prefs: DashboardModuloPref[]): DashboardModuloPref[] {
  if (prefs.length > 0) return prefs;
  return MODULOS_DASHBOARD_DISPONIBLES.map((m) => ({ id: m.id, visible: true, fijado: false }));
}

export default function InteraccionSeccion() {
  const { preferencias, actualizar } = usePreferencias();
  const avisar = useFeedback();
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const modulos = ordenActual(preferencias.dashboardModulos);

  function guardarOrden(nuevo: DashboardModuloPref[]) {
    actualizar("dashboardModulos", nuevo);
  }

  function moverModulo(desdeId: string, haciaId: string) {
    if (desdeId === haciaId) return;
    const copia = [...modulos];
    const desdeIdx = copia.findIndex((m) => m.id === desdeId);
    const haciaIdx = copia.findIndex((m) => m.id === haciaId);
    if (desdeIdx === -1 || haciaIdx === -1) return;
    const [item] = copia.splice(desdeIdx, 1);
    copia.splice(haciaIdx, 0, item);
    guardarOrden(copia);
  }

  function toggleVisible(id: string) {
    guardarOrden(modulos.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)));
  }

  function toggleFijado(id: string) {
    guardarOrden(modulos.map((m) => (m.id === id ? { ...m, fijado: !m.fijado } : m)));
  }

  function restaurarDashboard() {
    actualizar("dashboardModulos", []);
    avisar("Dashboard restaurado a su diseño predeterminado.");
  }

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Audio, interacción y atajos</h2>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">
        Sonido, vibración, atajos de teclado y personalización del panel principal.
      </p>

      <SettingRow id="set-sonidos" titulo="Efectos de sonido" descripcion="Reproduce sonidos breves para confirmar determinadas acciones.">
        <Switch checked={preferencias.sonidos} onChange={(v) => { actualizar("sonidos", v); avisar("Configuración actualizada."); }} label="Efectos de sonido" />
      </SettingRow>

      <SettingRow id="set-haptica" titulo="Respuesta háptica" descripcion="Utiliza una respuesta táctil breve en dispositivos compatibles.">
        <Switch checked={preferencias.haptica} onChange={(v) => { actualizar("haptica", v); avisar("Configuración actualizada."); }} label="Respuesta háptica" />
      </SettingRow>

      <SettingRow
        id="set-paleta"
        titulo="Paleta de comandos"
        descripcion={<>Accede rápidamente a funciones y secciones de SIGEDUAL mediante el teclado — <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="px-1.5 py-0.5 rounded text-[11px] font-mono">Ctrl</kbd> + <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="px-1.5 py-0.5 rounded text-[11px] font-mono">K</kbd> (o <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="px-1.5 py-0.5 rounded text-[11px] font-mono">Cmd</kbd> + <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="px-1.5 py-0.5 rounded text-[11px] font-mono">K</kbd> en macOS).</>}
      >
        <Switch checked={preferencias.paletaComandos} onChange={(v) => { actualizar("paletaComandos", v); avisar("Configuración actualizada."); }} label="Paleta de comandos" />
      </SettingRow>

      <SettingRow id="set-atajos" titulo="Atajos de teclado" descripcion="Permite navegar SIGEDUAL con teclas rápidas cuando no estás escribiendo en un campo.">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ATAJOS))}
            style={{ color: "var(--accent-light)" }}
            className="text-xs font-semibold hover:underline"
          >
            Ver todos los atajos
          </button>
          <Switch checked={preferencias.atajosTeclado} onChange={(v) => { actualizar("atajosTeclado", v); avisar("Configuración actualizada."); }} label="Atajos de teclado" />
        </div>
      </SettingRow>

      <SettingRow id="set-dashboard" titulo="Personalizar Dashboard" descripcion="Reordena (arrastra), oculta, muestra o fija los módulos del panel principal." vertical>
        <ul className="flex flex-col gap-1.5 mt-1">
          {modulos.map((m) => {
            const info = MODULOS_DASHBOARD_DISPONIBLES.find((d) => d.id === m.id);
            if (!info) return null;
            return (
              <li
                key={m.id}
                draggable
                onDragStart={() => setArrastrando(m.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (arrastrando) moverModulo(arrastrando, m.id); setArrastrando(null); }}
                onDragEnd={() => setArrastrando(null)}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", opacity: m.visible ? 1 : 0.55 }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium flex-1">{info.label}</span>
                <button onClick={() => toggleFijado(m.id)} title={m.fijado ? "Quitar fijado" : "Fijar"} style={{ color: m.fijado ? "var(--accent-light)" : "var(--text-muted)" }} className="p-1.5 hover:[color:var(--text-primary)] transition-colors">
                  {m.fijado ? <Pin size={15} /> : <PinOff size={15} />}
                </button>
                <button onClick={() => toggleVisible(m.id)} title={m.visible ? "Ocultar" : "Mostrar"} style={{ color: "var(--text-muted)" }} className="p-1.5 hover:[color:var(--text-primary)] transition-colors">
                  {m.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          onClick={restaurarDashboard}
          style={{ color: "var(--text-secondary)" }}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:[color:var(--text-primary)] transition-colors mt-3"
        >
          <RotateCcw size={13} />
          Restaurar Dashboard
        </button>
      </SettingRow>
    </div>
  );
}
