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
  const { usuario, liceoActivo } = useAuth();
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
        let lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion));
        // La cuenta desarrollador es global y recibe notificaciones de
        // cualquier liceo — al "entrar" a uno puntual (modo global admin,
        // ver lib/liceos/modoGlobalAdmin.ts), la bandeja debe acotarse a
        // ese liceo, igual que ya ocurre con el resto de los datos que
        // filtran por `usuario.liceoId`. Sin liceoActivo (vista global, o
        // cualquier otro rol) se muestran todas, sin este filtro.
        if (liceoActivo) lista = lista.filter((n) => n.liceoId === liceoActivo.id);
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
  }, [usuario, liceoActivo, limite]);

  /**
   * Lo que sigue pendiente de atención. La bandeja muestra esto, no la
   * lista completa: una notificación es un aviso de que algo pasó, y una
   * vez atendida deja de ser un pendiente. Si las leídas se quedaran en la
   * bandeja, cada aviso habría que apagarlo a mano dos veces — leerlo y
   * después borrarlo — y mientras tanto la lista miente sobre lo que falta
   * por hacer. Las leídas no se pierden: quedan tras "Ver leídas".
   */
  const pendientes = notificaciones.filter((n) => !n.leida);
  const leidas = notificaciones.filter((n) => n.leida);
  const noLeidas = pendientes.length;

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

  /** Vacía el historial de avisos ya atendidos. NO toca los pendientes:
   * borrar de un golpe algo que el usuario todavía no vio seria perder
   * información sin que se entere. */
  async function eliminarLeidas() {
    if (leidas.length === 0) return;
    const batch = writeBatch(db);
    leidas.forEach((n) => batch.delete(doc(db, "notificaciones", n.id)));
    await batch.commit();
  }

  return {
    notificaciones, pendientes, leidas, noLeidas, cargando,
    marcarLeida, marcarTodasLeidas, eliminarNotificacion, eliminarLeidas,
  };
}
