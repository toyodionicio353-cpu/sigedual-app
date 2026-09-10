"use client";
import { useCallback, useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { BorradorMensaje } from "@/types";

export interface ContenidoBorrador {
  destinatarios: string[];
  asunto: string;
  cuerpo: string;
}

/** Borradores propios, en vivo. Son privados de quien los escribe: el
 * destinatario no ve nada hasta que el mensaje se envía. */
export function useBorradores() {
  const { usuario } = useAuth();
  const [borradores, setBorradores] = useState<BorradorMensaje[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setBorradores([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const q = query(collection(db, "borradores_mensaje"), where("uid", "==", usuario.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BorradorMensaje));
        lista.sort((a, b) => (b.actualizadoEn ?? "").localeCompare(a.actualizadoEn ?? ""));
        setBorradores(lista);
        setCargando(false);
      },
      () => {
        setBorradores([]);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [usuario]);

  /** Guarda (o actualiza) el borrador y devuelve su id, para que el
   * siguiente guardado del mismo texto no cree otro documento. */
  const guardar = useCallback(async (contenido: ContenidoBorrador, id?: string): Promise<string | null> => {
    if (!usuario) return null;
    const ahora = new Date().toISOString();
    const ref = id ? doc(db, "borradores_mensaje", id) : doc(collection(db, "borradores_mensaje"));
    const datos: Omit<BorradorMensaje, "id"> = {
      uid: usuario.uid,
      liceoId: usuario.liceoId,
      destinatarios: contenido.destinatarios,
      asunto: contenido.asunto,
      cuerpo: contenido.cuerpo,
      actualizadoEn: ahora,
      creadoEn: id ? (borradores.find((b) => b.id === id)?.creadoEn ?? ahora) : ahora,
    };
    await setDoc(ref, datos);
    return ref.id;
  }, [usuario, borradores]);

  const descartar = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "borradores_mensaje", id));
  }, []);

  return { borradores, cargando, guardar, descartar };
}
