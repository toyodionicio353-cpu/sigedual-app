"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { sincronizarAutorizacionMaestroGuia } from "./sincronizarAutorizacionMaestroGuia";
import type { Asignacion } from "@/types";

interface AmbitoMaestroGuia {
  asignaciones: Asignacion[];
  idsEstudiantes: string[];
  cargando: boolean;
}

/**
 * Igual que `useAmbitoProfesor`, pero para una cuenta "centro_dual" (login
 * del Maestro Guía): su ámbito son los estudiantes de las Asignaciones
 * donde `maestroGuiaId == usuario.maestroGuiaId` — el Maestro Guía solo ve
 * a SUS propios estudiantes asignados, nunca todo el Centro Dual. Para
 * cualquier otro rol devuelve un ámbito vacío sin consultar nada.
 */
export function useAmbitoMaestroGuia(): AmbitoMaestroGuia {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario || usuario.rol !== "centro_dual" || !usuario.maestroGuiaId) {
      setAsignaciones([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      const snap = await getDocs(query(collection(db, "asignaciones"), where("maestroGuiaId", "==", usuario.maestroGuiaId)));
      if (cancelado) return;
      setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setCargando(false);
      sincronizarAutorizacionMaestroGuia(usuario.uid, usuario.maestroGuiaId!).catch(() => {});
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol, usuario?.maestroGuiaId]);

  const idsEstudiantes = useMemo(() => Array.from(new Set(asignaciones.map((a) => a.estudianteId))), [asignaciones]);

  return { asignaciones, idsEstudiantes, cargando };
}
