"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "./modoGlobalAdmin";

/** Para páginas de "Agregar X": cuando el administrador está en modo global
 * (sin haber entrado a un liceo específico), el nuevo registro se guardará
 * en su liceo predeterminado igualmente — pero primero se le pide
 * confirmación explícita, para que no sea una sorpresa a cuál liceo quedó
 * asociado. En cualquier otro caso (usuario normal, o admin que ya entró a
 * un liceo) la acción procede directo, sin interrumpir. */
export function useAdvertenciaLiceoGlobal() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoPredeterminado = liceos.find((l) => l.id === usuario?.liceoId) ?? null;
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);

  function conConfirmacion(accion: () => void) {
    if (modoGlobal) setAccionPendiente(() => accion);
    else accion();
  }

  function confirmar() {
    const accion = accionPendiente;
    setAccionPendiente(null);
    accion?.();
  }

  function cancelar() {
    setAccionPendiente(null);
  }

  return {
    modoGlobal,
    liceoPredeterminado,
    mostrarAdvertencia: accionPendiente !== null,
    conConfirmacion,
    confirmar,
    cancelar,
  };
}
