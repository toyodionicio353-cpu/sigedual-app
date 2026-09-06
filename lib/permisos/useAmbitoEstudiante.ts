"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { sincronizarAutorizacionEstudiante } from "./sincronizarAutorizacionEstudiante";
import type { Asignacion } from "@/types";

interface AmbitoEstudiante {
  asignaciones: Asignacion[];
  idsCentros: string[];
  idsMaestros: string[];
  cargando: boolean;
}

/**
 * Ámbito de una cuenta "estudiante" (ver Usuario.estudianteId, poblado solo
 * cuando la cuenta se creó vinculada a una ficha de Estudiante real vía
 * /crear-cuenta): su propia información, nunca la de otro estudiante — sus
 * propias Asignaciones (`estudianteId == su ficha`, la única consulta que
 * firestore.rules puede validar directamente) y, a partir de ellas, el
 * Centro Dual y Maestro Guía que le corresponden. Para cualquier otro rol
 * devuelve un ámbito vacío sin consultar nada.
 */
export function useAmbitoEstudiante(): AmbitoEstudiante {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario || usuario.rol !== "estudiante" || !usuario.estudianteId) {
      setAsignaciones([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      const snap = await getDocs(query(collection(db, "asignaciones"), where("estudianteId", "==", usuario.estudianteId)));
      if (cancelado) return;
      setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setCargando(false);
      sincronizarAutorizacionEstudiante(usuario.uid, usuario.estudianteId!).catch(() => {});
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol, usuario?.estudianteId]);

  const idsCentros = useMemo(() => Array.from(new Set(asignaciones.map((a) => a.centroDualId))), [asignaciones]);
  const idsMaestros = useMemo(
    () => Array.from(new Set(asignaciones.map((a) => a.maestroGuiaId).filter((id): id is string => Boolean(id)))),
    [asignaciones]
  );

  return { asignaciones, idsCentros, idsMaestros, cargando };
}
