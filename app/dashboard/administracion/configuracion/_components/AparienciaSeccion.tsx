"use client";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { OPCIONES_ACENTO } from "@/lib/preferencias/acentos";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import RadioCards from "@/components/ui/RadioCards";
import { Sun, Moon, Laptop, Rows3, Rows2, Check } from "lucide-react";
import type { TamanoFuente } from "@/types/preferencias";

const FUENTES: { value: TamanoFuente; label: string }[] = [
  { value: "pequeno", label: "Pequeño" },
  { value: "mediano", label: "Mediano" },
  { value: "grande", label: "Grande" },
  { value: "muy-grande", label: "Muy grande" },
];

export default function AparienciaSeccion() {
  const { preferencias, actualizar } = usePreferencias();
  const avisar = useFeedback();

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Apariencia y visualización</h2>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">
        Controla cómo se ve SIGEDUAL en este dispositivo. Estos cambios son personales y no afectan a otros usuarios.
      </p>

      <SettingRow id="set-tema" titulo="Tema de la interfaz" descripcion="Utiliza una interfaz clara u oscura, o sigue la preferencia de tu sistema operativo." vertical>
        <RadioCards
          name="Tema de la interfaz"
          value={preferencias.tema}
          onChange={(v) => { actualizar("tema", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "claro", label: "Claro", icon: <Sun size={18} /> },
            { value: "oscuro", label: "Oscuro", icon: <Moon size={18} /> },
            { value: "sistema", label: "Sistema", icon: <Laptop size={18} /> },
          ]}
        />
      </SettingRow>

      <SettingRow id="set-acento" titulo="Color de acento" descripcion="Se usa en botones principales, enlaces, indicadores y elementos seleccionados." vertical>
        <div className="flex flex-wrap gap-3">
          {OPCIONES_ACENTO.map((op) => {
            const activo = preferencias.colorAcento === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => { actualizar("colorAcento", op.id); avisar("Configuración actualizada."); }}
                title={op.nombre}
                aria-label={op.nombre}
                aria-pressed={activo}
                style={{ background: op.accent, border: activo ? "3px solid var(--text-primary)" : "1px solid var(--border-light)" }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--text-primary)]"
              >
                {activo && <Check size={16} color="#000" />}
              </button>
            );
          })}
        </div>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2.5">
          Solo se ofrecen variantes de la identidad amarilla/dorada de SIGEDUAL, para mantener el branding y la legibilidad.
        </p>
      </SettingRow>

      <SettingRow id="set-densidad" titulo="Densidad de interfaz" descripcion="Cómoda para uso general, o compacta para ver más información a la vez (ideal en tablas)." vertical>
        <RadioCards
          name="Densidad de interfaz"
          value={preferencias.densidad}
          onChange={(v) => { actualizar("densidad", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "comoda", label: "Cómoda", icon: <Rows2 size={18} /> },
            { value: "compacta", label: "Compacta", icon: <Rows3 size={18} /> },
          ]}
        />
      </SettingRow>

      <SettingRow id="set-contraste" titulo="Modo de alto contraste" descripcion="Mejora el contraste de textos, controles y elementos interactivos para facilitar la visualización.">
        <Switch
          checked={preferencias.altoContraste}
          onChange={(v) => { actualizar("altoContraste", v); avisar("Configuración actualizada."); }}
          label="Modo de alto contraste"
        />
      </SettingRow>

      <SettingRow id="set-fuente" titulo="Tamaño de fuente" descripcion="Se aplica a textos, menús, botones, formularios y tablas en toda la aplicación." vertical>
        <RadioCards
          name="Tamaño de fuente"
          value={preferencias.tamanoFuente}
          onChange={(v) => { actualizar("tamanoFuente", v); avisar("Configuración actualizada."); }}
          opciones={FUENTES}
        />
      </SettingRow>

      <SettingRow id="set-ancho" titulo="Ancho del contenido" descripcion="Pantalla completa es especialmente útil para tablas, reportes y gestión administrativa." vertical>
        <RadioCards
          name="Ancho del contenido"
          value={preferencias.anchoContenido}
          onChange={(v) => { actualizar("anchoContenido", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "fijo", label: "Ancho fijo", descripcion: "Contenido centrado" },
            { value: "completo", label: "Pantalla completa", descripcion: "Usa todo el espacio" },
          ]}
        />
      </SettingRow>
    </div>
  );
}
