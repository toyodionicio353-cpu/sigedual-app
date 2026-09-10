"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Conversacion } from "@/types";

export type CarpetaMensajes = "recibidos" | "destacados" | "enviados" | "borradores" | "papelera";

/** Hilos donde el usuario participa, en vivo. El estado por persona (leído,
 * destacado, papelera) vive en arreglos de uid dentro del propio documento,
 * así que la bandeja completa se resuelve con esta única suscripción. */
export function useConversaciones() {
  const { usuario } = useAuth();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setConversaciones([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    // Sin orderBy en la consulta: combinarlo con el array-contains exigiría
    // un índice compuesto que este proyecto no despliega — se ordena en el
    // cliente, igual que en useNotificaciones.
    const q = query(collection(db, "conversaciones"), where("participantes", "array-contains", usuario.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Conversacion))
          // Lo eliminado definitivamente ya no existe para esta persona,
          // en ninguna carpeta.
          .filter((c) => !c.ocultaPara?.includes(usuario.uid));
        lista.sort((a, b) => (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? ""));
        setConversaciones(lista);
        setCargando(false);
      },
      () => {
        setConversaciones([]);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [usuario]);

  const uid = usuario?.uid;

  const enPapelera = useCallback((c: Conversacion) => Boolean(uid && c.eliminadaPor?.includes(uid)), [uid]);
  const noLeida = useCallback((c: Conversacion) => Boolean(uid && c.noLeidoPor?.includes(uid)), [uid]);
  const destacada = useCallback((c: Conversacion) => Boolean(uid && c.destacadaPor?.includes(uid)), [uid]);

  const porCarpeta = useCallback(
    (carpeta: CarpetaMensajes): Conversacion[] => {
      if (!uid) return [];
      const vivas = conversaciones.filter((c) => !enPapelera(c));
      switch (carpeta) {
        case "recibidos":
          // Solo si alguien más ya escribió: un hilo que mandé yo y nadie
          // respondió vive en Enviados, no en Recibidos.
          return vivas.filter((c) => haEscritoOtro(c, uid));
        case "destacados":
          return vivas.filter(destacada);
        case "enviados":
          return vivas.filter((c) => haParticipado(c, uid));
        case "papelera":
          return conversaciones.filter(enPapelera);
        default:
          return [];
      }
    },
    [conversaciones, uid, enPapelera, destacada]
  );

  const noLeidos = useMemo(
    () => conversaciones.filter((c) => !enPapelera(c) && noLeida(c)).length,
    [conversaciones, enPapelera, noLeida]
  );

  const marcarLeida = useCallback(async (id: string, leida: boolean) => {
    if (!uid) return;
    await updateDoc(doc(db, "conversaciones", id), {
      noLeidoPor: leida ? arrayRemove(uid) : arrayUnion(uid),
    });
  }, [uid]);

  const alternarDestacada = useCallback(async (c: Conversacion) => {
    if (!uid) return;
    await updateDoc(doc(db, "conversaciones", c.id), {
      destacadaPor: c.destacadaPor?.includes(uid) ? arrayRemove(uid) : arrayUnion(uid),
    });
  }, [uid]);

  const moverAPapelera = useCallback(async (ids: string[]) => {
    if (!uid) return;
    await Promise.all(ids.map((id) => updateDoc(doc(db, "conversaciones", id), { eliminadaPor: arrayUnion(uid) })));
  }, [uid]);

  const restaurar = useCallback(async (ids: string[]) => {
    if (!uid) return;
    await Promise.all(ids.map((id) => updateDoc(doc(db, "conversaciones", id), { eliminadaPor: arrayRemove(uid) })));
  }, [uid]);

  /** "Eliminar definitivamente" saca el hilo de todas las carpetas de esta
   * persona para siempre. El documento no se borra: sigue siendo la copia
   * del resto de los participantes, y por eso tampoco se toca
   * `participantes` (ver firestore.rules). */
  const eliminarDefinitivamente = useCallback(async (ids: string[]) => {
    if (!uid) return;
    await Promise.all(ids.map((id) => updateDoc(doc(db, "conversaciones", id), {
      ocultaPara: arrayUnion(uid),
      eliminadaPor: arrayRemove(uid),
      noLeidoPor: arrayRemove(uid),
      destacadaPor: arrayRemove(uid),
    })));
  }, [uid]);

  return {
    conversaciones, cargando, noLeidos, porCarpeta,
    noLeida, destacada, enPapelera,
    marcarLeida, alternarDestacada, moverAPapelera, restaurar, eliminarDefinitivamente,
  };
}

/** Un hilo aparece en Enviados si esta persona escribió en él: `remitentes`
 * acumula a quienes ya enviaron un mensaje (ver enviarMensaje). En hilos
 * anteriores a ese campo se cae al dato que sí guardaban — quién lo creó y
 * quién mandó lo último. */
function haParticipado(c: Conversacion, uid: string): boolean {
  if (c.remitentes) return c.remitentes.includes(uid);
  return c.creadoPor === uid || c.ultimoRemitenteUid === uid;
}

/** ...y aparece en Recibidos en cuanto alguien distinto escribió en él. */
function haEscritoOtro(c: Conversacion, uid: string): boolean {
  if (c.remitentes) return c.remitentes.some((r) => r !== uid);
  return Boolean(c.ultimoRemitenteUid && c.ultimoRemitenteUid !== uid);
}
