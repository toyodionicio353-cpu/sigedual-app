"use client";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import SettingRow from "@/components/ui/SettingRow";
import RadioCards from "@/components/ui/RadioCards";
import Select from "@/components/ui/Select";

const ZONAS_COMUNES = [
  "America/Santiago", "America/Argentina/Buenos_Aires", "America/Lima", "America/Bogota",
  "America/Mexico_City", "America/New_York", "Europe/Madrid", "UTC",
];

export default function IdiomaSeccion() {
  const { preferencias, actualizar } = usePreferencias();
  const avisar = useFeedback();

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Idioma y regionalización</h2>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">
        Solo traduce menús, botones, etiquetas y mensajes del sistema — nunca los datos que tú u otros usuarios ingresan.
      </p>

      <SettingRow id="set-idioma" titulo="Idioma" descripcion="Cambia el idioma de la interfaz de SIGEDUAL." vertical>
        <RadioCards
          name="Idioma"
          value={preferencias.idioma}
          onChange={(v) => { actualizar("idioma", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "es", label: "Español" },
            { value: "en", label: "English" },
          ]}
        />
      </SettingRow>

      <SettingRow id="set-hora" titulo="Formato de fecha y hora" descripcion="Se aplica dondequiera que SIGEDUAL muestre una hora (mensajes, historial, etc.)." vertical>
        <RadioCards
          name="Formato de hora"
          value={preferencias.formatoHora}
          onChange={(v) => { actualizar("formatoHora", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "24", label: "24 horas" },
            { value: "12", label: "12 horas" },
          ]}
        />
      </SettingRow>

      <SettingRow id="set-zona" titulo="Zona horaria" descripcion="No cambia el instante real guardado en la base de datos, solo cómo se muestra." vertical>
        <RadioCards
          name="Zona horaria"
          value={preferencias.zonaHorariaModo}
          onChange={(v) => { actualizar("zonaHorariaModo", v); avisar("Configuración actualizada."); }}
          opciones={[
            { value: "dispositivo", label: "Del dispositivo" },
            { value: "manual", label: "Seleccionar manualmente" },
          ]}
        />
        {preferencias.zonaHorariaModo === "manual" && (
          <Select
            value={preferencias.zonaHorariaManual}
            onChange={(v) => { actualizar("zonaHorariaManual", v); avisar("Configuración actualizada."); }}
            ariaLabel="Zona horaria"
            className="mt-1 max-w-xs"
            opciones={ZONAS_COMUNES.map((z) => ({ value: z, label: z }))}
          />
        )}
      </SettingRow>
    </div>
  );
}
