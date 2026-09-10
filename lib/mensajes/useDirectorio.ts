"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { useAmbitoEstudiante } from "@/lib/permisos/useAmbitoEstudiante";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { esRolConAccesoCompletoLiceo } from "@/lib/permisos/ambito";
import type { Usuario } from "@/types";

interface Directorio {
  contactos: Usuario[];
  cargando: boolean;
}

/**
 * A quién puede escribirle cada usuario. NO es "todo el liceo": se calcula
 * con la misma matriz de autorización del resto de SIGEDUAL (ver
 * lib/permisos/ambito.ts), porque poder mandar un mensaje ya revela que esa
 * persona existe, su rol y su especialidad.
 *
 *   desarrollador/director/coordinador | Todo su liceo (ya tienen acceso
 *                                      | institucional completo).
 *   profesor                           | El staff de su liceo, más los
 *                                      | estudiantes y Centros Duales que ya
 *                                      | están dentro de su ámbito (mismo
 *                                      | cálculo que useAmbitoProfesor).
 *   centro_dual / estudiante           | Solo los Profesores Supervisores de
 *                                      | sus propias Asignaciones — nunca
 *                                      | otros estudiantes ni otras empresas.
 *
 * Los tres últimos casos son también lo único que firestore.rules les deja
 * leer de `usuarios`, así que la consulta nunca pide más de lo permitido.
 */
export function useDirectorioMensajes(): Directorio {
  const { usuario } = useAuth();
  const ambitoProfesor = useAmbitoProfesor();
  const ambitoEstudiante = useAmbitoEstudiante();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();

  const [contactos, setContactos] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);

  const rol = usuario?.rol;
  const esExterno = rol === "estudiante" || rol === "centro_dual";
  const ambitoExterno = rol === "estudiante" ? ambitoEstudiante : ambitoMaestroGuia;

  // Profesores Supervisores de las propias Asignaciones (solo cuentas
  // externas). Se memoriza como texto para no relanzar la consulta en cada
  // render por una referencia de arreglo nueva.
  const uidsSupervisores = useMemo(() => {
    if (!esExterno) return "";
    const uids = ambitoExterno.asignaciones
      .map((a) => a.profesorSupervisorId)
      .filter((uid): uid is string => Boolean(uid));
    return Array.from(new Set(uids)).sort().join(",");
  }, [esExterno, ambitoExterno.asignaciones]);

  const idsAmbitoProfesor = useMemo(
    () => ({
      estudiantes: new Set(ambitoProfesor.idsEstudiantes),
      centros: new Set(ambitoProfesor.idsCentros),
      maestros: new Set(ambitoProfesor.idsMaestros),
    }),
    [ambitoProfesor.idsEstudiantes, ambitoProfesor.idsCentros, ambitoProfesor.idsMaestros]
  );

  useEffect(() => {
    if (!usuario || !rol) {
      setContactos([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);

    (async () => {
      try {
        if (esExterno) {
          if (ambitoExterno.cargando) return;
          const uids = uidsSupervisores ? uidsSupervisores.split(",") : [];
          // El id del documento en `usuarios` ES el uid de la cuenta.
          const supervisores = uids.length > 0
            ? await obtenerDocumentosPorId<Usuario & { id: string }>("usuarios", uids)
            : [];
          if (cancelado) return;
          setContactos(supervisores.filter((u) => u.uid !== usuario.uid && u.activo !== false));
          setCargando(false);
          return;
        }

        if (rol === "profesor" && ambitoProfesor.cargando) return;

        const snap = await getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId)));
        if (cancelado) return;
        const delLiceo = snap.docs
          .map((d) => d.data() as Usuario)
          .filter((u) => u.uid !== usuario.uid && u.activo !== false);

        if (esRolConAccesoCompletoLiceo(rol)) {
          setContactos(delLiceo);
          setCargando(false);
          return;
        }

        // Profesor: staff completo, pero de estudiantes/empresas solo lo que
        // ya está en su ámbito — Mensajes no amplía lo que puede ver.
        setContactos(
          delLiceo.filter((u) => {
            if (u.rol === "estudiante") return Boolean(u.estudianteId && idsAmbitoProfesor.estudiantes.has(u.estudianteId));
            if (u.rol === "centro_dual") {
              return Boolean(
                (u.centroDualId && idsAmbitoProfesor.centros.has(u.centroDualId))
                || (u.maestroGuiaId && idsAmbitoProfesor.maestros.has(u.maestroGuiaId))
              );
            }
            return true;
          })
        );
        setCargando(false);
      } catch {
        // Sin directorio no se puede redactar, pero la bandeja sigue viva.
        if (cancelado) return;
        setContactos([]);
        setCargando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [
    usuario, rol, esExterno, uidsSupervisores, ambitoExterno.cargando,
    ambitoProfesor.cargando, idsAmbitoProfesor,
  ]);

  return { contactos, cargando };
}
