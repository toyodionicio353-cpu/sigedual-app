import type { AcentoId } from "@/types/preferencias";

// Variantes de acento seleccionables por el usuario. Cada una fue verificada
// contra "--text-on-accent" (negro, fijo en app/globals.css) con contraste
// WCAG AA o superior, para que el selector nunca produzca texto ilegible
// sobre el color elegido.
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
  { id: "teal", nombre: "Teal base", accent: "#14B8A6", accentHover: "#12A292" },
  { id: "amarillo-marca", nombre: "Amarillo marca", accent: "#FFD54F", accentHover: "#E0BB46" },
  { id: "morado", nombre: "Morado", accent: "#AB8ED6", accentHover: "#967DBC" },
  { id: "rojo-coral", nombre: "Rojo coral", accent: "#E7786E", accentHover: "#CB6A61" },
  { id: "azul-suave", nombre: "Azul suave", accent: "#6CB2D6", accentHover: "#5F9DBC" },
];

export function obtenerAcento(id: AcentoId): OpcionAcento {
  return OPCIONES_ACENTO.find((o) => o.id === id) ?? OPCIONES_ACENTO[0];
}
