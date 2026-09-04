import type { Preferencias } from "@/types/preferencias";
import { PREFERENCIAS_DEFAULT } from "./defaults";

const CLAVE = "sigedual_preferences";

/** Combina lo guardado con los valores predeterminados, campo por campo,
 * para que agregar una preferencia nueva en el futuro no rompa lo ya guardado. */
function combinarConDefaults(guardado: Partial<Preferencias> | null): Preferencias {
  if (!guardado) return { ...PREFERENCIAS_DEFAULT };
  return {
    ...PREFERENCIAS_DEFAULT,
    ...guardado,
    notificacionesCategorias: {
      ...PREFERENCIAS_DEFAULT.notificacionesCategorias,
      ...(guardado.notificacionesCategorias ?? {}),
    },
    noMolestar: { ...PREFERENCIAS_DEFAULT.noMolestar, ...(guardado.noMolestar ?? {}) },
    cookies: { ...PREFERENCIAS_DEFAULT.cookies, tecnicas: true, ...(guardado.cookies ?? {}) },
    dashboardModulos: guardado.dashboardModulos ?? PREFERENCIAS_DEFAULT.dashboardModulos,
    version: 1,
  };
}

export function cargarPreferencias(): Preferencias {
  if (typeof window === "undefined") return { ...PREFERENCIAS_DEFAULT };
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return { ...PREFERENCIAS_DEFAULT };
    return combinarConDefaults(JSON.parse(raw));
  } catch {
    return { ...PREFERENCIAS_DEFAULT };
  }
}

export function guardarPreferencias(prefs: Preferencias): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(prefs));
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.): la preferencia
    // se aplica igual en esta sesión, solo no persiste entre visitas.
  }
}

export function limpiarPreferencias(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // ver nota anterior
  }
}

export const CLAVE_PREFERENCIAS = CLAVE;
