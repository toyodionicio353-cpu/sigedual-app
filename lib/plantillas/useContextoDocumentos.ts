"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { useAmbitoEstudiante } from "@/lib/permisos/useAmbitoEstudiante";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import type { Asignacion, CentroDual, Especialidad, Estudiante, Liceo, MaestroGuia, Usuario } from "@/types";
import type { ContextoResolucion } from "@/types/plantillas";

const CONTEXTO_VACIO: ContextoResolucion = {
  estudiantes: [], asignaciones: [], centros: [], maestrosGuia: [], profesores: [], especialidades: [],
};

/**
 * Carga el mismo conjunto de colecciones planas que ya usa el asistente de
 * Asignaciones (estudiantes, asignaciones, centros duales, maestros guía,
 * profesores, especialidades y el liceo), para que los tres módulos de
 * documentos resuelvan campos automáticos sin triplicar esta carga.
 */
export function useContextoDocumentos() {
  const { usuario } = useAuth();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const ambitoEstudiante = useAmbitoEstudiante();
  const [contexto, setContexto] = useState<ContextoResolucion>(CONTEXTO_VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === "centro_dual" && ambitoMaestroGuia.cargando) return;
    if (usuario.rol === "estudiante" && ambitoEstudiante.cargando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, ambitoMaestroGuia.cargando, ambitoMaestroGuia.asignaciones, ambitoEstudiante.cargando, ambitoEstudiante.asignaciones]);

  async function cargar() {
    if (!usuario) return;
    setCargando(true);

    // Centro Dual/Estudiante nunca necesitan el catálogo completo del liceo
    // para autocompletar SUS propios documentos — solo lo suyo. Además,
    // `usuarios` (profesores) no está scoped por liceo en las reglas, así
    // que nunca se consulta para estos dos roles.
    if (usuario.rol === "centro_dual" || usuario.rol === "estudiante") {
      const ambito = usuario.rol === "centro_dual" ? ambitoMaestroGuia : ambitoEstudiante;
      const idsCentros = usuario.rol === "centro_dual" ? (usuario.centroDualId ? [usuario.centroDualId] : []) : ambitoEstudiante.idsCentros;
      const idsMaestros = Array.from(new Set(ambito.asignaciones.map((a) => a.maestroGuiaId).filter((id): id is string => Boolean(id))));
      const idsEstudiantes = usuario.rol === "estudiante"
        ? (usuario.estudianteId ? [usuario.estudianteId] : [])
        : Array.from(new Set(ambito.asignaciones.map((a) => a.estudianteId)));
      const [estudiantesData, centrosData, mgData, snapLiceo] = await Promise.all([
        obtenerDocumentosPorId<Estudiante>("estudiantes", idsEstudiantes),
        obtenerDocumentosPorId<CentroDual>("centros_duales", idsCentros),
        obtenerDocumentosPorId<MaestroGuia>("maestros_guia", idsMaestros),
        getDoc(doc(db, "liceos", usuario.liceoId)),
      ]);
      setContexto({
        estudiantes: estudiantesData,
        asignaciones: ambito.asignaciones,
        centros: centrosData,
        maestrosGuia: mgData,
        profesores: [],
        especialidades: [],
        liceo: snapLiceo.exists() ? ({ id: snapLiceo.id, ...snapLiceo.data() } as Liceo) : undefined,
      });
      setCargando(false);
      return;
    }

    const [snapEst, snapAsig, snapCentros, snapMg, snapProf, snapEsp, snapLiceo] = await Promise.all([
      getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId), where("rol", "==", "profesor"))),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
      getDoc(doc(db, "liceos", usuario.liceoId)),
    ]);
    setContexto({
      estudiantes: snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)),
      asignaciones: snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)),
      centros: snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)),
      maestrosGuia: snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)),
      profesores: snapProf.docs.map((d) => ({ ...d.data() } as Usuario)),
      especialidades: snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)),
      liceo: snapLiceo.exists() ? ({ id: snapLiceo.id, ...snapLiceo.data() } as Liceo) : undefined,
    });
    setCargando(false);
  }

  return { contexto, cargando };
}
