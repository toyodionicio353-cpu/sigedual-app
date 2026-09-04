"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from "firebase/firestore";
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
    const q = query(
      collection(db, "notificaciones"),
      where("destinatarioUid", "==", usuario.uid),
      orderBy("creadoEn", "desc"),
      limit(limite)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotificaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion)));
      setCargando(false);
    });
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

  return { notificaciones, noLeidas, cargando, marcarLeida, marcarTodasLeidas };
}
