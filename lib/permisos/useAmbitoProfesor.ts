"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { sincronizarAutorizacionesDeProfesor } from "./sincronizarAutorizacion";
import type { Asignacion } from "@/types";

interface AmbitoProfesor {
  /** Sus propias Asignaciones formales (profesorSupervisorId == su uid) —
   * sigue siendo la base para crear/editar (Visitas, cambios de estado,
   * etc.), que no se comparte por especialidad. */
  asignaciones: Asignacion[];
  /** Todos los estudiantes de SU especialidad en su liceo — compartido con
   * cualquier otro profesor de esa misma especialidad, ya no solo los que
   * tiene formalmente asignados (ver firestore.rules, `estudiantes`). */
  idsEstudiantes: string[];
  idsCentros: string[];
  idsMaestros: string[];
  cargando: boolean;
}

/**
 * Carga el ámbito de lectura de un Profesor Supervisor: todos los
 * estudiantes/centros duales/maestros guía de su misma especialidad en su
 * liceo (compartido entre todos los profesores de esa especialidad — ver
 * lib/permisos/ambito.ts), más sus propias Asignaciones formales (para lo
 * que sigue exigiendo asignación real: crear/editar Visitas, etc.). Un
 * profesor sin especialidad asignada no ve nada por esta vía.
 *
 * De paso, autosana el índice `autorizaciones` (Estudiante/Centro/Maestro
 * asignados formalmente, todavía usado para permisos de escritura).
 *
 * Para roles con acceso completo al liceo (administrador, coordinador,
 * director) este hook no hace nada — ver `esRolConAccesoCompletoLiceo`.
 */
export function useAmbitoProfesor(): AmbitoProfesor {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [idsEstudiantes, setIdsEstudiantes] = useState<string[]>([]);
  const [idsCentros, setIdsCentros] = useState<string[]>([]);
  const [idsMaestros, setIdsMaestros] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario || usuario.rol !== "profesor") {
      setAsignaciones([]);
      setIdsEstudiantes([]);
      setIdsCentros([]);
      setIdsMaestros([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      const snapAsig = await getDocs(query(collection(db, "asignaciones"), where("profesorSupervisorId", "==", usuario.uid)));
      if (cancelado) return;
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
      // Autosanación del índice de autorizaciones (permisos de escritura):
      // no bloquea la carga, corre en segundo plano.
      sincronizarAutorizacionesDeProfesor(usuario.uid).catch(() => {});

      if (!usuario.especialidadId) {
        setIdsEstudiantes([]);
        setIdsCentros([]);
        setIdsMaestros([]);
        setCargando(false);
        return;
      }
      const [snapEst, snapCentros, snapMaestros] = await Promise.all([
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId), where("especialidadId", "==", usuario.especialidadId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId), where("especialidades", "array-contains", usuario.especialidadId))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId), where("especialidades", "array-contains", usuario.especialidadId))),
      ]);
      if (cancelado) return;
      setIdsEstudiantes(snapEst.docs.map((d) => d.id));
      setIdsCentros(snapCentros.docs.map((d) => d.id));
      setIdsMaestros(snapMaestros.docs.map((d) => d.id));
      setCargando(false);
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol, usuario?.liceoId, usuario?.especialidadId]);

  return { asignaciones, idsEstudiantes, idsCentros, idsMaestros, cargando };
}
