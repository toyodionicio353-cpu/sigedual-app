"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CaracteristicasComerciales } from "@/types";

const DOC_ID = "caracteristicas";

/** Lista compartida "¿Qué incluye SIGEDUAL?" (un solo documento, no por
 * plan — los tres planes son el mismo servicio, ver PlanComercial). */
export function useCaracteristicasComerciales() {
  const [items, setItems] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const snap = await getDoc(doc(db, "configuracion_comercial", DOC_ID));
    setItems(snap.exists() ? ((snap.data() as CaracteristicasComerciales).items ?? []) : []);
    setCargando(false);
  }

  return { items, cargando, recargar: cargar };
}

export { DOC_ID as CARACTERISTICAS_DOC_ID };
