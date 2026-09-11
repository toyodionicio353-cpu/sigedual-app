"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PlanComercial } from "@/types";

/** Todos los planes comerciales (públicos, sin filtrar por estado — cada
 * pantalla decide qué mostrar: el panel admin ve todos, la página comercial
 * oculta los "inactivo"). */
export function usePlanesComerciales() {
  const [planes, setPlanes] = useState<PlanComercial[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db, "planes_comerciales"), orderBy("orden", "asc")));
      setPlanes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlanComercial)));
    } catch {
      // Un fallo de red o de Firestore no debe dejar un "Cargando planes..."
      // girando para siempre. Importa especialmente porque esto ahora se
      // muestra en el login, que es lo primero que ve un visitante: quien
      // llama distingue "sin planes" de "cargando" y muestra el vacío.
      setPlanes([]);
    } finally {
      setCargando(false);
    }
  }

  return { planes, cargando, recargar: cargar };
}
