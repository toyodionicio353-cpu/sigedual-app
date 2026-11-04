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
  /** Todos los estudiantes de su liceo. Un Profesor Supervisor puede ver y
   * editar la ficha de cualquier estudiante del establecimiento, no solo la
   * de los de su especialidad (ver firestore.rules, `estudiantes`). */
  idsEstudiantes: string[];
  idsCentros: string[];
  idsMaestros: string[];
  cargando: boolean;
}

/**
 * Carga el ámbito de un Profesor Supervisor: todos los estudiantes de su
 * liceo (su ficha es parte de su trabajo: la ve y la edita), los centros
 * duales y maestros guía de su misma especialidad, y sus propias
 * Asignaciones formales (para lo que sigue exigiendo asignación real:
 * crear/editar Visitas, etc.). Un profesor sin especialidad asignada ve
 * igualmente a los estudiantes, pero no centros ni maestros guía.
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

      // Estudiantes: todo el liceo. No depende de la especialidad, porque un
      // profesor sin especialidad asignada seguiría necesitando ver fichas.
      //
      // El respaldo por especialidad existe para el rato en que el código
      // nuevo ya está publicado pero las reglas de Firestore todavía no:
      // sin él, la consulta al liceo se deniega entera y el profesor se
      // queda sin ver NINGÚN estudiante, que es peor que antes.
      let docsEstudiantes;
      try {
        docsEstudiantes = (await getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId)))).docs;
      } catch {
        docsEstudiantes = usuario.especialidadId
          ? (await getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId), where("especialidadId", "==", usuario.especialidadId))).catch(() => null))?.docs ?? []
          : [];
      }
      if (cancelado) return;
      setIdsEstudiantes(docsEstudiantes.map((d) => d.id));

      // Centros duales y maestros guía sí siguen acotados a su especialidad.
      if (!usuario.especialidadId) {
        setIdsCentros([]);
        setIdsMaestros([]);
        setCargando(false);
        return;
      }
      const [snapCentros, snapMaestros] = await Promise.all([
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId), where("especialidades", "array-contains", usuario.especialidadId))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId), where("especialidades", "array-contains", usuario.especialidadId))),
      ]);
      if (cancelado) return;
      setIdsCentros(snapCentros.docs.map((d) => d.id));
      setIdsMaestros(snapMaestros.docs.map((d) => d.id));
      setCargando(false);
    })();
    return () => { cancelado = true; };
  }, [usuario?.uid, usuario?.rol, usuario?.liceoId, usuario?.especialidadId]);

  return { asignaciones, idsEstudiantes, idsCentros, idsMaestros, cargando };
}
