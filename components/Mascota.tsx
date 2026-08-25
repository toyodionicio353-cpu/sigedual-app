"use client";
import { useEffect, useRef, useState } from "react";

export type TipoMascota = "cerdito" | "osito";
export type AnimacionMascota =
  | "idle" | "walk" | "blink" | "jump" | "turn" | "attack"
  | "hurt" | "die" | "happy" | "confused" | "angry";

const FRAMES: Record<AnimacionMascota, number> = {
  idle: 4, walk: 5, blink: 4, jump: 4, turn: 5, attack: 3,
  hurt: 3, die: 4, happy: 3, confused: 3, angry: 3,
};

const PREFIJO: Record<TipoMascota, string> = { cerdito: "pig", osito: "bear" };

// Altura nativa máxima entre todos los frames (~200px, frame de salto).
// El escenario usa esta referencia para que las animaciones no "salten" de tamaño.
const ALTO_NATIVO = 200;

export const CLAVE_MASCOTA = "sigedual_mascota";

/** Lee la mascota elegida por el usuario (localStorage). */
export function mascotaGuardada(): TipoMascota {
  if (typeof window === "undefined") return "cerdito";
  const v = window.localStorage.getItem(CLAVE_MASCOTA);
  return v === "osito" ? "osito" : "cerdito";
}

/** Guarda la mascota elegida. */
export function guardarMascota(tipo: TipoMascota) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLAVE_MASCOTA, tipo);
  }
}

interface MascotaProps {
  tipo?: TipoMascota;
  animacion?: AnimacionMascota;
  /** Cuadros por segundo (default 6). */
  fps?: number;
  /** Escala visual: 1 = tamaño nativo del sprite (default 1). */
  escala?: number;
  /** Si es false, la animación se detiene en el último frame y dispara onFin. */
  loop?: boolean;
  onFin?: () => void;
}

export default function Mascota({
  tipo = "cerdito",
  animacion = "idle",
  fps = 6,
  escala = 1,
  loop = true,
  onFin,
}: MascotaProps) {
  const [frame, setFrame] = useState(1);
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  const total = FRAMES[animacion];

  // Precarga de los frames de la animación activa
  useEffect(() => {
    for (let i = 1; i <= total; i++) {
      const img = new Image();
      img.src = `/mascotas/${tipo}/${PREFIJO[tipo]}_${animacion}_${i}.png`;
    }
  }, [tipo, animacion, total]);

  useEffect(() => {
    setFrame(1);
    let actual = 1;
    let terminada = false;
    const id = window.setInterval(() => {
      if (terminada) return;
      if (actual < total) {
        actual += 1;
      } else if (loop) {
        actual = 1;
      } else {
        terminada = true;
        window.clearInterval(id);
        onFinRef.current?.();
        return;
      }
      setFrame(actual);
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [tipo, animacion, fps, loop, total]);

  const alto = Math.round(ALTO_NATIVO * escala);

  return (
    <div
      style={{
        height: alto,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mascotas/${tipo}/${PREFIJO[tipo]}_${animacion}_${frame}.png`}
        alt={`Mascota ${tipo} (${animacion})`}
        draggable={false}
        style={{
          height: "auto",
          width: "auto",
          transform: escala !== 1 ? `scale(${escala})` : undefined,
          transformOrigin: "bottom center",
          imageRendering: "pixelated",
          userSelect: "none",
        }}
      />
    </div>
  );
}
