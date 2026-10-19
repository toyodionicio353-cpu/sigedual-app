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
  /** Se distingue de una lista vacía a propósito: "no hay publicaciones" y
   * "no se pudieron leer" se ven igual en pantalla, y confundirlos hace
   * invisible un problema de configuración que sí tiene arreglo. */
  const [error, setError] = useState<string | null>(null);

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
      } catch (e) {
        if (cancelado) return;
        setNovedades([]);
        const codigo = (e as { code?: string })?.code ?? "";
        // El caso típico: las reglas de Firestore desplegadas todavía no
        // permiten leer `novedades` sin sesión, así que el escaparate
        // público queda vacío aunque las publicaciones sí existan.
        setError(
          codigo === "permission-denied"
            ? "Las reglas de Firestore no permiten leer las novedades sin iniciar sesión."
            : "No se pudieron cargar las novedades."
        );
        if (typeof console !== "undefined") {
          console.error("[SIGEDUAL] No se pudieron leer las novedades:", codigo, e);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return { novedades, cargando, error };
}
