"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { sincronizarAutorizacionesDeProfesor } from "./sincronizarAutorizacion";
import type { Asignacion } from "@/types";

interface AmbitoProfesor {
  asignaciones: Asignacion[];
  idsEstudiantes: string[];
  idsCentros: string[];
  idsMaestros: string[];
  cargando: boolean;
}

/**
 * Carga el ámbito real de un Profesor Supervisor: sus propias Asignaciones
 * (`profesorSupervisorId == su uid`, la única query que las reglas de
 * Firestore pueden validar directamente) y deriva de ahí qué estudiantes,
 * centros duales y maestros guía tiene autorizados. De paso, autosana el
 * índice `autorizaciones` que respalda las reglas de otras colecciones —
 * así una asignación creada antes de este cambio queda al día la primera
 * vez que el profesor entra a SIGEDUAL, sin necesitar una migración manual.
 *
 * Para roles con acceso completo al liceo (administrador, coordinador,
 * director) este hook no hace nada — ver `esRolConAccesoCompletoLiceo`.
 */
export function useAmbitoProfesor(): AmbitoProfesor {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario || usuario.rol !== "profesor") {
      setAsignaciones([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      const snap = await getDocs(query(collection(db, "asignaciones"), where("profesorSupervisorId", "==", usuario.uid)));
      if (cancelado) return;
      setAsignaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      setCargando(false);
      // Autosanación: no bloquea la carga, corre en segundo plano.
      sincronizarAutorizacionesDeProfesor(usuario.uid).catch(() => {});
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol]);

  const idsEstudiantes = useMemo(() => Array.from(new Set(asignaciones.map((a) => a.estudianteId))), [asignaciones]);
  const idsCentros = useMemo(() => Array.from(new Set(asignaciones.map((a) => a.centroDualId))), [asignaciones]);
  const idsMaestros = useMemo(
    () => Array.from(new Set(asignaciones.map((a) => a.maestroGuiaId).filter((id): id is string => Boolean(id)))),
    [asignaciones]
  );

  return { asignaciones, idsEstudiantes, idsCentros, idsMaestros, cargando };
}
