import type { ParteLegal } from "../tipos";
import { PARTE_1 } from "./parte1";
import { PARTE_2 } from "./parte2";
import { PARTE_3 } from "./parte3";
import { PARTE_4 } from "./parte4";
import { PARTE_5 } from "./parte5";
import { PARTE_6 } from "./parte6";

// Estructura preparada para las 12 partes del documento (Términos,
// Condiciones y Política de Privacidad). Por ahora se incorporan las
// Partes 1 a 6 — cuando lleguen las Partes 7 a 12 se agregan del mismo
// modo (un archivo parteN.ts + una línea aquí), sin tocar la presentación.
export const PARTES_LEGALES: ParteLegal[] = [PARTE_1, PARTE_2, PARTE_3, PARTE_4, PARTE_5, PARTE_6];

export const TOTAL_PARTES_PLANEADAS = 12;
