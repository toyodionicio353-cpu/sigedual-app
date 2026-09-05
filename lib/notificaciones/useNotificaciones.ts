"use client";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Notificacion } from "@/types";

/** Notificaciones del usuario autenticado, en vivo (onSnapshot) — es la
 * única fuente de datos tanto para la campana global (app/dashboard/layout.tsx)
 * como para la tarjeta "Notificaciones" de Inicio y /dashboard/notificaciones,
 * para que el estado leído/no leído quede siempre sincronizado entre las tres. */
export function useNotificaciones(limite = 30) {
  const { usuario } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setNotificaciones([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    // Sin orderBy en la consulta a propósito: combinar el where con un
    // orderBy en otro campo exige un índice compuesto que este proyecto no
    // tiene desplegado — se ordena y se recorta al límite en el cliente en
    // vez de depender de un índice que podría no existir en Firestore.
    const q = query(
      collection(db, "notificaciones"),
      where("destinatarioUid", "==", usuario.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion));
        lista.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
        setNotificaciones(lista.slice(0, limite));
        setCargando(false);
      },
      () => {
        // Un error de Firestore (permisos, red, etc.) no debe dejar el
        // spinner girando para siempre.
        setNotificaciones([]);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [usuario, limite]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  async function marcarLeida(id: string) {
    await updateDoc(doc(db, "notificaciones", id), { leida: true, leidaEn: new Date().toISOString() });
  }

  async function marcarTodasLeidas() {
    const pendientes = notificaciones.filter((n) => !n.leida);
    if (pendientes.length === 0) return;
    const batch = writeBatch(db);
    pendientes.forEach((n) => batch.update(doc(db, "notificaciones", n.id), { leida: true, leidaEn: new Date().toISOString() }));
    await batch.commit();
  }

  async function eliminarNotificacion(id: string) {
    await deleteDoc(doc(db, "notificaciones", id));
  }

  async function eliminarTodas() {
    if (notificaciones.length === 0) return;
    const batch = writeBatch(db);
    notificaciones.forEach((n) => batch.delete(doc(db, "notificaciones", n.id)));
    await batch.commit();
  }

  return { notificaciones, noLeidas, cargando, marcarLeida, marcarTodasLeidas, eliminarNotificacion, eliminarTodas };
}
