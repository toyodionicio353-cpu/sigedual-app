import type { AcentoId } from "@/types/preferencias";

// Variantes de acento permitidas: todas dentro de la familia ámbar/dorada de
// SIGEDUAL, ya probadas contra "--text-on-accent" (negro) para mantener
// contraste legible. No se permite un color fuera de esta familia: así el
// selector nunca puede romper el branding ni la legibilidad.
export interface OpcionAcento {
  id: AcentoId;
  nombre: string;
  accent: string;
  accentHover: string;
}

export const OPCIONES_ACENTO: OpcionAcento[] = [
  { id: "amarillo", nombre: "Amarillo SIGEDUAL", accent: "#FFD100", accentHover: "#E6BC00" },
  { id: "ambar", nombre: "Ámbar", accent: "#F5B800", accentHover: "#DBA400" },
  { id: "dorado", nombre: "Dorado", accent: "#E8C33D", accentHover: "#CFAC2E" },
  { id: "mostaza", nombre: "Mostaza", accent: "#EAB308", accentHover: "#CA9A07" },
];

export function obtenerAcento(id: AcentoId): OpcionAcento {
  return OPCIONES_ACENTO.find((o) => o.id === id) ?? OPCIONES_ACENTO[0];
}
