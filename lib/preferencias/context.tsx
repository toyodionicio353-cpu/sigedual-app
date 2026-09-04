"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Preferencias } from "@/types/preferencias";
import { PREFERENCIAS_DEFAULT } from "./defaults";
import { cargarPreferencias, guardarPreferencias } from "./storage";
import { aplicarPreferenciasAlDocumento, resolverTema } from "./aplicar";
import { traducir, type ClaveTraduccion } from "./i18n";

interface PreferenciasContextValue {
  preferencias: Preferencias;
  listo: boolean;
  actualizar: <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => void;
  actualizarVarias: (parcial: Partial<Preferencias>) => void;
  restablecer: () => void;
  t: (clave: ClaveTraduccion) => string;
}

const PreferenciasContext = createContext<PreferenciasContextValue | null>(null);

export function PreferenciasProvider({ children }: { children: React.ReactNode }) {
  const [preferencias, setPreferencias] = useState<Preferencias>(PREFERENCIAS_DEFAULT);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const cargadas = cargarPreferencias();
    setPreferencias(cargadas);
    aplicarPreferenciasAlDocumento(cargadas);
    setListo(true);
  }, []);

  // "Sistema": si el usuario elige seguir el tema del SO, reacciona a cambios en vivo.
  useEffect(() => {
    if (preferencias.tema !== "sistema" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const escuchar = () => aplicarPreferenciasAlDocumento(preferencias);
    media.addEventListener("change", escuchar);
    return () => media.removeEventListener("change", escuchar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferencias.tema]);

  const persistir = useCallback((nuevas: Preferencias) => {
    setPreferencias(nuevas);
    guardarPreferencias(nuevas);
    aplicarPreferenciasAlDocumento(nuevas);
  }, []);

  const actualizar = useCallback(<K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => {
    setPreferencias((prev) => {
      const nuevas = { ...prev, [clave]: valor };
      guardarPreferencias(nuevas);
      aplicarPreferenciasAlDocumento(nuevas);
      return nuevas;
    });
  }, []);

  const actualizarVarias = useCallback((parcial: Partial<Preferencias>) => {
    setPreferencias((prev) => {
      const nuevas = { ...prev, ...parcial };
      guardarPreferencias(nuevas);
      aplicarPreferenciasAlDocumento(nuevas);
      return nuevas;
    });
  }, []);

  const restablecer = useCallback(() => {
    persistir({ ...PREFERENCIAS_DEFAULT });
  }, [persistir]);

  const t = useCallback((clave: ClaveTraduccion) => traducir(preferencias.idioma, clave), [preferencias.idioma]);

  const value = useMemo(
    () => ({ preferencias, listo, actualizar, actualizarVarias, restablecer, t }),
    [preferencias, listo, actualizar, actualizarVarias, restablecer, t]
  );

  return <PreferenciasContext.Provider value={value}>{children}</PreferenciasContext.Provider>;
}

export function usePreferencias(): PreferenciasContextValue {
  const ctx = useContext(PreferenciasContext);
  if (!ctx) throw new Error("usePreferencias debe usarse dentro de <PreferenciasProvider>");
  return ctx;
}

export { resolverTema };
