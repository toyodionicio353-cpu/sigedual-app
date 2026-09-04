// Efectos de sonido breves y discretos (osciladores Web Audio, sin archivos
// de audio externos) para confirmaciones, errores y alertas relevantes.

type TipoSonido = "confirmar" | "error" | "alerta";

let contextoAudio: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!contextoAudio) contextoAudio = new AudioCtor();
  return contextoAudio;
}

const TONOS: Record<TipoSonido, { frecuencia: number; duracion: number }> = {
  confirmar: { frecuencia: 880, duracion: 0.08 },
  error: { frecuencia: 220, duracion: 0.14 },
  alerta: { frecuencia: 440, duracion: 0.1 },
};

export function reproducirSonido(tipo: TipoSonido) {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const { frecuencia, duracion } = TONOS[tipo];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracion);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duracion);
  } catch {
    // Reproducción de audio no disponible en este navegador/contexto: se omite en silencio.
  }
}
