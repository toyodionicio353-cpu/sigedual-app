"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIJO = "sigedual_borrador_";

/** Guardado automático de borradores de formularios, en localStorage,
 * gateado por la preferencia "Guardar borradores automáticamente".
 *
 * Uso: `const { borradorDisponible, restaurar, limpiar, guardadoEn } =
 * useBorradorAutomatico("estudiantes-nuevo", habilitado);`
 * y en cada cambio del formulario llamar a `guardar(valores)`.
 *
 * No guarda campos sensibles: quien use el hook decide qué objeto pasar a
 * `guardar` — nunca debe incluir contraseñas ni tokens. */
export function useBorradorAutomatico<T>(id: string, habilitado: boolean) {
  const clave = `${PREFIJO}${id}`;
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [borradorDisponible, setBorradorDisponible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(clave);
      if (raw) {
        const parsed = JSON.parse(raw);
        setGuardadoEn(parsed.guardadoEn ?? null);
        setBorradorDisponible(true);
      }
    } catch {
      // sin borrador recuperable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const guardar = useCallback(
    (valores: T) => {
      if (!habilitado) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        try {
          const ahora = new Date().toISOString();
          localStorage.setItem(clave, JSON.stringify({ valores, guardadoEn: ahora }));
          setGuardadoEn(ahora);
          setBorradorDisponible(true);
        } catch {
          // localStorage no disponible: el borrador simplemente no persiste.
        }
      }, 800);
    },
    [clave, habilitado]
  );

  const restaurar = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(clave);
      if (!raw) return null;
      return JSON.parse(raw).valores as T;
    } catch {
      return null;
    }
  }, [clave]);

  const limpiar = useCallback(() => {
    try {
      localStorage.removeItem(clave);
    } catch {
      // sin efecto si no está disponible
    }
    setBorradorDisponible(false);
    setGuardadoEn(null);
  }, [clave]);

  return { guardar, restaurar, limpiar, borradorDisponible, guardadoEn };
}

/** Elimina todos los borradores automáticos guardados (usado por "Limpiar
 * datos locales" en Configuración). */
export function limpiarTodosLosBorradores() {
  try {
    const claves = Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO));
    claves.forEach((k) => localStorage.removeItem(k));
  } catch {
    // sin efecto si no está disponible
  }
}
