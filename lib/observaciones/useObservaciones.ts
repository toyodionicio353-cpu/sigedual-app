"use client";
import { useCallback, useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import type { EstadoObservacionDual, ObservacionDual, TipoObservacionDual } from "@/types";

export interface NuevaObservacion {
  tipo: TipoObservacionDual;
  fecha: string;
  texto: string;
}

interface DatosObservaciones {
  observaciones: ObservacionDual[];
  cargando: boolean;
  error: string | null;
  crear: (datos: NuevaObservacion) => Promise<void>;
  responder: (obs: ObservacionDual, respuesta: string, estado: EstadoObservacionDual) => Promise<void>;
  cambiarEstado: (obs: ObservacionDual, estado: EstadoObservacionDual) => Promise<void>;
  recargar: () => Promise<void>;
}

/** Más reciente primero: lo que acaba de pasar es lo que se va a leer. */
function porFechaDescendente(a: ObservacionDual, b: ObservacionDual): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return a.creadoEn < b.creadoEn ? 1 : -1;
}

/**
 * Observaciones, reclamos y reconocimientos sobre un estudiante.
 *
 * Filtra por `estudianteId`, un solo campo de igualdad: no necesita índice
 * compuesto, y las reglas la aceptan porque quien puede ver al estudiante
 * puede ver lo que se registró sobre él.
 */
export function useObservacionesEstudiante(
  estudianteId: string,
  contexto?: {
    centroDualId: string;
    especialidadId: string;
    liceoId: string;
    asignacionId?: string;
  }
): DatosObservaciones {
  const { usuario } = useAuth();
  const [observaciones, setObservaciones] = useState<ObservacionDual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario || !estudianteId) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "observaciones_dual"), where("estudianteId", "==", estudianteId))
      );
      setObservaciones(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as ObservacionDual)).sort(porFechaDescendente)
      );
    } catch (e) {
      const codigo = (e as { code?: string })?.code ?? "";
      setError(
        codigo === "permission-denied"
          ? "No tienes permiso para ver las observaciones de este estudiante."
          : "No se pudieron cargar las observaciones."
      );
      setObservaciones([]);
    } finally {
      setCargando(false);
    }
  }, [usuario, estudianteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = useCallback(async (datos: NuevaObservacion) => {
    if (!usuario || !contexto) {
      throw new Error("Este estudiante no tiene una asignación vigente a un Centro Dual.");
    }
    const nueva: Omit<ObservacionDual, "id"> = {
      liceoId: contexto.liceoId,
      estudianteId,
      centroDualId: contexto.centroDualId,
      especialidadId: contexto.especialidadId,
      tipo: datos.tipo,
      fecha: datos.fecha,
      texto: datos.texto.trim(),
      // Nace abierta siempre: nadie registra algo ya resuelto, y así queda
      // alguien responsable de responderlo.
      estado: "abierta",
      creadoPor: usuario.uid,
      creadoPorNombre: usuario.nombre,
      creadoPorRol: usuario.rol,
      creadoEn: new Date().toISOString(),
    };
    if (contexto.asignacionId) nueva.asignacionId = contexto.asignacionId;

    const ref = await addDoc(collection(db, "observaciones_dual"), nueva);
    registrarEvento({
      uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
      accion: "crear_observacion_dual", recurso: "observaciones_dual", recursoId: ref.id,
      resultado: "permitido", detalle: `${datos.tipo} · ${datos.fecha}`,
    });
    await cargar();
  }, [usuario, contexto, estudianteId, cargar]);

  const responder = useCallback(async (obs: ObservacionDual, respuesta: string, estado: EstadoObservacionDual) => {
    if (!usuario) return;
    await updateDoc(doc(db, "observaciones_dual", obs.id), {
      respuesta: respuesta.trim(),
      respondidaPor: usuario.uid,
      respondidaPorNombre: usuario.nombre,
      respondidaEn: new Date().toISOString(),
      estado,
      actualizadoEn: new Date().toISOString(),
    });
    registrarEvento({
      uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
      accion: "responder_observacion_dual", recurso: "observaciones_dual", recursoId: obs.id,
      resultado: "permitido", detalle: estado,
    });
    await cargar();
  }, [usuario, cargar]);

  const cambiarEstado = useCallback(async (obs: ObservacionDual, estado: EstadoObservacionDual) => {
    if (!usuario) return;
    await updateDoc(doc(db, "observaciones_dual", obs.id), {
      estado,
      actualizadoEn: new Date().toISOString(),
    });
    await cargar();
  }, [usuario, cargar]);

  return { observaciones, cargando, error, crear, responder, cambiarEstado, recargar: cargar };
}
