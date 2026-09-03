"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
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
  const [contexto, setContexto] = useState<ContextoResolucion>(CONTEXTO_VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setCargando(true);
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
