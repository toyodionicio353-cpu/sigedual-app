"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { estaVigente } from "./semestre";
import type { Novedad } from "@/types";

/**
 * Novedades visibles públicamente: de TODOS los liceos, publicadas y aún
 * vigentes, de la más reciente a la más antigua.
 *
 * El filtro de vigencia se hace acá y no en la consulta: una novedad
 * "expira" por el paso del tiempo, no porque alguien le cambie el estado,
 * así que comparar contra el reloj en el cliente es lo que hace que deje
 * de verse sola al llegar su fecha, sin depender de ninguna tarea
 * programada. El estado "expirada" del documento es solo para el historial
 * administrativo del liceo.
 *
 * No requiere sesión: la sección vive en el login.
 */
export function useNovedadesPublicas() {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "novedades"), where("estado", "==", "publicada")));
        if (cancelado) return;
        const ahora = new Date();
        setNovedades(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Novedad))
            .filter((n) => estaVigente(n.expiraEn, ahora))
            .sort((a, b) => (b.publicadoEn ?? "").localeCompare(a.publicadoEn ?? ""))
        );
      } catch {
        // Sin novedades no se muestra un error en la cara de un visitante:
        // la sección simplemente queda vacía.
        if (!cancelado) setNovedades([]);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return { novedades, cargando };
}
