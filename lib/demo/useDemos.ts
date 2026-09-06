"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DemoInstancia } from "@/types";

/** Todas las demos de la plataforma — solo accesible para rol administrador
 * (ver firestore.rules, colección `demos`). Sin filtro por liceoId: una
 * demo recién generada todavía no tiene institución asociada. */
export function useDemos() {
  const [demos, setDemos] = useState<DemoInstancia[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const snap = await getDocs(query(collection(db, "demos"), orderBy("emitidoEn", "desc")));
    setDemos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DemoInstancia)));
    setCargando(false);
  }

  return { demos, cargando, recargar: cargar };
}
