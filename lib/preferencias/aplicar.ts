import type { Preferencias } from "@/types/preferencias";
import { obtenerAcento } from "./acentos";

/** Aplica el tema (claro/oscuro/sistema) al documento, resolviendo "sistema"
 * contra la preferencia de apariencia del sistema operativo. */
export function resolverTema(tema: Preferencias["tema"]): "claro" | "oscuro" {
  if (tema === "sistema") {
    const prefiereOscuro = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true;
    return prefiereOscuro ? "oscuro" : "claro";
  }
  return tema;
}

const FUENTE_ESCALA: Record<Preferencias["tamanoFuente"], string> = {
  pequeno: "87.5%",
  mediano: "100%",
  grande: "112.5%",
  "muy-grande": "125%",
};

/** Aplica todas las preferencias visuales al <html> vía atributos data-* y
 * variables CSS. Es la única función que toca el DOM global: se llama desde
 * el script inline (antes del primer pintado) y desde el Provider (en cada
 * cambio), así ambos caminos quedan siempre sincronizados. */
export function aplicarPreferenciasAlDocumento(prefs: Preferencias): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;

  const temaResuelto = resolverTema(prefs.tema);
  html.setAttribute("data-theme", temaResuelto === "oscuro" ? "dark" : "light");
  html.setAttribute("data-density", prefs.densidad === "compacta" ? "compacta" : "comoda");
  html.setAttribute("data-contrast", prefs.altoContraste ? "alto" : "normal");
  html.setAttribute("data-width", prefs.anchoContenido === "completo" ? "completo" : "fijo");
  html.style.fontSize = FUENTE_ESCALA[prefs.tamanoFuente] ?? FUENTE_ESCALA.mediano;

  const acento = obtenerAcento(prefs.colorAcento);
  html.style.setProperty("--accent", acento.accent);
  html.style.setProperty("--accent-light", acento.accent);
  html.style.setProperty("--accent-hover", acento.accentHover);

  html.setAttribute("lang", prefs.idioma === "en" ? "en" : "es");
}
