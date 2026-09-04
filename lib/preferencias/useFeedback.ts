"use client";
import { useCallback } from "react";
import { useToast, type TipoToast } from "@/lib/toast-context";
import { usePreferencias } from "./context";
import { reproducirSonido } from "@/lib/sound";
import { vibrar } from "@/lib/haptics";

/** Feedback unificado: toast visual + sonido + háptica, cada uno respetando
 * las preferencias del usuario. Es el único punto de entrada recomendado
 * para avisar "Preferencia guardada", "Configuración actualizada", etc. */
export function useFeedback() {
  const { mostrar } = useToast();
  const { preferencias } = usePreferencias();

  return useCallback(
    (mensaje: string, tipo: TipoToast = "exito") => {
      mostrar(mensaje, tipo);
      if (preferencias.sonidos) reproducirSonido(tipo === "error" ? "error" : "confirmar");
      if (preferencias.haptica) vibrar(tipo === "error" ? 30 : 12);
    },
    [mostrar, preferencias.sonidos, preferencias.haptica]
  );
}
