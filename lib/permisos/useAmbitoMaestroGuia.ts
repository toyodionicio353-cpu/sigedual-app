"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { sincronizarAutorizacionMaestroGuia } from "./sincronizarAutorizacionMaestroGuia";
import { sincronizarAutorizacionCentroDual } from "./sincronizarAutorizacionCentroDual";
import type { Asignacion } from "@/types";

interface AmbitoMaestroGuia {
  asignaciones: Asignacion[];
  idsEstudiantes: string[];
  cargando: boolean;
}

/**
 * Igual que `useAmbitoProfesor`, pero para una cuenta "centro_dual". Hay
 * dos variantes según cómo se creó la cuenta (ver Usuario.maestroGuiaId):
 * si tiene `maestroGuiaId`, su ámbito son solo las Asignaciones de ESE
 * Maestro Guía (nunca todo el Centro Dual); si no lo tiene (cuenta a nivel
 * de empresa, creada con el correo del propio Centro Dual), su ámbito son
 * TODAS las Asignaciones de su `centroDualId`. Para cualquier otro rol
 * devuelve un ámbito vacío sin consultar nada.
 */
export function useAmbitoMaestroGuia(): AmbitoMaestroGuia {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario || usuario.rol !== "centro_dual" || (!usuario.maestroGuiaId && !usuario.centroDualId)) {
      setAsignaciones([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      const campo = usuario.maestroGuiaId ? "maestroGuiaId" : "centroDualId";
      const valor = usuario.maestroGuiaId ?? usuario.centroDualId!;
      const snap = await getDocs(query(collection(db, "asignaciones"), where(campo, "==", valor)));
      if (cancelado) return;
      setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setCargando(false);
      if (usuario.maestroGuiaId) {
        sincronizarAutorizacionMaestroGuia(usuario.uid, usuario.maestroGuiaId).catch(() => {});
      } else {
        sincronizarAutorizacionCentroDual(usuario.uid, usuario.centroDualId!).catch(() => {});
      }
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol, usuario?.maestroGuiaId, usuario?.centroDualId]);

  const idsEstudiantes = useMemo(() => Array.from(new Set(asignaciones.map((a) => a.estudianteId))), [asignaciones]);

  return { asignaciones, idsEstudiantes, cargando };
}
