"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { porFechaDescendente, resumirFaltas, type ResumenFaltas } from "./calculo";
import type { FaltaDual, JornadaFalta } from "@/types";

export interface NuevaFalta {
  fecha: string;
  jornada: JornadaFalta;
  justificada: boolean;
  requiereRecuperacion: boolean;
  motivo?: string;
}

interface DatosFaltas {
  faltas: FaltaDual[];
  resumen: ResumenFaltas;
  cargando: boolean;
  error: string | null;
  registrar: (datos: NuevaFalta) => Promise<void>;
  confirmar: (falta: FaltaDual) => Promise<void>;
  anular: (falta: FaltaDual) => Promise<void>;
  marcarRecuperada: (falta: FaltaDual, recuperada: boolean) => Promise<void>;
  recargar: () => Promise<void>;
}

/**
 * Faltas de un estudiante a su Centro Dual.
 *
 * La consulta filtra por `estudianteId`, un solo campo de igualdad: no
 * necesita índice compuesto, y las reglas la aceptan porque quien puede
 * ver al estudiante puede ver sus faltas.
 */
export function useFaltasEstudiante(
  estudianteId: string,
  /** Asignación vigente — de ahí salen el centro, la especialidad y el
   * profesor a cargo que quedan grabados en cada falta. */
  contexto?: {
    asignacionId: string;
    centroDualId: string;
    especialidadId: string;
    liceoId: string;
    profesorSupervisorId?: string;
  }
): DatosFaltas {
  const { usuario } = useAuth();
  const [faltas, setFaltas] = useState<FaltaDual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario || !estudianteId) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "faltas_dual"), where("estudianteId", "==", estudianteId))
      );
      setFaltas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FaltaDual)).sort(porFechaDescendente));
    } catch (e) {
      const codigo = (e as { code?: string })?.code ?? "";
      setError(
        codigo === "permission-denied"
          ? "No tienes permiso para ver las faltas de este estudiante."
          : "No se pudieron cargar las faltas."
      );
      setFaltas([]);
    } finally {
      setCargando(false);
    }
  }, [usuario, estudianteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(() => resumirFaltas(faltas), [faltas]);

  /** El liceo registra una falta ya confirmada; el Centro Dual solo avisa.
   * Lo decide el rol, no un parámetro: así no hay forma de pedir un estado
   * que las reglas de Firestore vayan a rechazar. */
  const registrar = useCallback(async (datos: NuevaFalta) => {
    if (!usuario || !contexto) throw new Error("Este estudiante no tiene una asignación vigente a un Centro Dual.");
    const esCentroDual = usuario.rol === "centro_dual";
    const ahora = new Date().toISOString();

    const nueva: Omit<FaltaDual, "id"> = {
      liceoId: contexto.liceoId,
      estudianteId,
      asignacionId: contexto.asignacionId,
      centroDualId: contexto.centroDualId,
      especialidadId: contexto.especialidadId,
      fecha: datos.fecha,
      jornada: datos.jornada,
      estado: esCentroDual ? "reportada" : "confirmada",
      justificada: datos.justificada,
      requiereRecuperacion: datos.requiereRecuperacion,
      recuperada: false,
      creadoEn: ahora,
    };
    if (contexto.profesorSupervisorId) nueva.profesorSupervisorId = contexto.profesorSupervisorId;
    if (datos.motivo?.trim()) nueva.motivo = datos.motivo.trim();
    if (esCentroDual) {
      nueva.reportadaPor = usuario.uid;
      nueva.reportadaPorNombre = usuario.nombre;
    } else {
      nueva.confirmadaPor = usuario.uid;
      nueva.confirmadaPorNombre = usuario.nombre;
    }

    const ref = await addDoc(collection(db, "faltas_dual"), nueva);
    registrarEvento({
      uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
      accion: esCentroDual ? "reportar_falta_dual" : "registrar_falta_dual",
      recurso: "faltas_dual", recursoId: ref.id, resultado: "permitido",
      detalle: `${datos.fecha} · ${datos.jornada}`,
    });
    await cargar();
  }, [usuario, contexto, estudianteId, cargar]);

  const confirmar = useCallback(async (falta: FaltaDual) => {
    if (!usuario) return;
    await updateDoc(doc(db, "faltas_dual", falta.id), {
      estado: "confirmada",
      confirmadaPor: usuario.uid,
      confirmadaPorNombre: usuario.nombre,
      actualizadoEn: new Date().toISOString(),
    });
    registrarEvento({
      uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
      accion: "confirmar_falta_dual", recurso: "faltas_dual", recursoId: falta.id,
      resultado: "permitido", detalle: falta.fecha,
    });
    await cargar();
  }, [usuario, cargar]);

  const anular = useCallback(async (falta: FaltaDual) => {
    if (!usuario) return;
    await updateDoc(doc(db, "faltas_dual", falta.id), {
      estado: "anulada",
      actualizadoEn: new Date().toISOString(),
    });
    registrarEvento({
      uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
      accion: "anular_falta_dual", recurso: "faltas_dual", recursoId: falta.id,
      resultado: "permitido", detalle: falta.fecha,
    });
    await cargar();
  }, [usuario, cargar]);

  const marcarRecuperada = useCallback(async (falta: FaltaDual, recuperada: boolean) => {
    if (!usuario) return;
    await updateDoc(doc(db, "faltas_dual", falta.id), {
      recuperada,
      // Al deshacer se borra la fecha: dejarla puesta diría que el día se
      // repuso cuando ya no es así.
      fechaRecuperacion: recuperada ? new Date().toISOString() : "",
      actualizadoEn: new Date().toISOString(),
    });
    await cargar();
  }, [usuario, cargar]);

  return { faltas, resumen, cargando, error, registrar, confirmar, anular, marcarRecuperada, recargar: cargar };
}
