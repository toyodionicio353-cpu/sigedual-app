"use client";
import { usePreferencias } from "@/lib/preferencias/context";

/** Texto de contador de resultados compartido por los listados
 * principales de SIGEDUAL. Si se pasa un rango de paginación, muestra
 * "Mostrando X–Y de Z"; si no, muestra "Z encontrado(s)". */
export default function ContadorResultados({
  total, entidadSingular, entidadPlural, rango,
}: {
  total: number;
  entidadSingular: string;
  entidadPlural: string;
  rango?: { inicio: number; fin: number };
}) {
  const { t } = usePreferencias();
  const etiqueta = total === 1 ? entidadSingular : entidadPlural;
  // La plantilla viene del diccionario: el orden de las palabras cambia
  // entre idiomas, así que no se puede armar concatenando trozos.
  const texto = rango
    ? t("lista.mostrando")
        .replace("{inicio}", String(rango.inicio))
        .replace("{fin}", String(rango.fin))
        .replace("{total}", String(total))
        .replace("{entidad}", etiqueta)
    : t("lista.encontrados")
        .replace("{total}", String(total))
        .replace("{entidad}", etiqueta);
  return (
    <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">{texto}</p>
  );
}
