"use client";
import { useEffect, useState } from "react";

export type VistaListado = "lista" | "tarjetas";

function claveDe(moduloId: string): string {
  return `sigedual_vista_${moduloId}`;
}

/** Recuerda la vista (lista/tarjetas) elegida por el usuario en un listado,
 * por módulo, en localStorage. No sincroniza entre pestañas ni dispositivos. */
export function useVistaListado(moduloId: string, porDefecto: VistaListado = "lista") {
  const [vista, setVistaState] = useState<VistaListado>(porDefecto);

  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(claveDe(moduloId));
      if (guardada === "lista" || guardada === "tarjetas") setVistaState(guardada);
    } catch {
      // localStorage no disponible (modo privado, etc.) — se mantiene el valor por defecto.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId]);

  function setVista(v: VistaListado) {
    setVistaState(v);
    try {
      window.localStorage.setItem(claveDe(moduloId), v);
    } catch {
      // Ignorar: la preferencia simplemente no persiste en esta sesión.
    }
  }

  return [vista, setVista] as const;
}
