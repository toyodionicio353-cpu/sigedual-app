// Respuesta háptica breve — solo se ejecuta cuando el dispositivo/navegador
// la soporta (Vibration API). Nunca lanza error si no está disponible.
export function vibrar(ms = 15) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // Vibración no soportada o bloqueada: se omite en silencio.
  }
}
