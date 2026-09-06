"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estadoEfectivo, formatearTiempoRestante } from "@/lib/demo";
import type { EstadoDemo, Liceo } from "@/types";

interface EstadoDemoLiceo {
  cargando: boolean;
  esDemo: boolean;
  estado?: EstadoDemo;
  venceEn?: string;
  tiempoRestante?: string;
}

/**
 * Lee, desde el propio Liceo del usuario (público, ver firestore.rules),
 * si es una institución en Demo y en qué estado real está — sin necesitar
 * acceso a la colección `demos` (restringida a administrador). Sirve tanto
 * para el aviso "tiempo restante" como para bloquear el acceso normal una
 * vez vencida (ver app/dashboard/layout.tsx).
 */
export function useDemoDeLiceo(): EstadoDemoLiceo {
  const { usuario } = useAuth();
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario?.liceoId) { setCargando(false); return; }
    let vigente = true;
    getDoc(doc(db, "liceos", usuario.liceoId)).then((snap) => {
      if (!vigente) return;
      setLiceo(snap.exists() ? ({ id: snap.id, ...snap.data() } as Liceo) : null);
      setCargando(false);
    });
    return () => { vigente = false; };
  }, [usuario?.liceoId]);

  if (!liceo?.esDemo || !liceo.demoVenceEn) {
    return { cargando, esDemo: false };
  }
  const estado = estadoEfectivo({ estado: liceo.demoEstado ?? "activa", venceEn: liceo.demoVenceEn });
  return {
    cargando, esDemo: true, estado, venceEn: liceo.demoVenceEn,
    tiempoRestante: formatearTiempoRestante(liceo.demoVenceEn),
  };
}
