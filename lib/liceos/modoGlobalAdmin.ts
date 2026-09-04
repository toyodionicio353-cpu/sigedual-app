"use client";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Liceo } from "@/types";

/** true cuando el administrador está viendo SIGEDUAL sin haber entrado a un
 * liceo específico ("Ingresar al liceo") — en ese modo, las listas (no los
 * mensajes ni los documentos) muestran la información de TODOS los liceos
 * combinada, con un filtro para acotar a uno en particular. */
export function useModoGlobalAdmin(): boolean {
  const { usuarioReal, liceoActivo } = useAuth();
  return usuarioReal?.rol === "administrador" && !liceoActivo;
}

/** Catálogo de liceos (id -> Liceo), cargado solo cuando el modo global está
 * activo — se usa para el filtro "Liceo" y para mostrar a qué liceo
 * pertenece cada fila de una lista agregada. */
export function useCatalogoLiceos(habilitado: boolean) {
  const [liceos, setLiceos] = useState<Liceo[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!habilitado) {
      setLiceos([]);
      return;
    }
    setCargando(true);
    getDocs(collection(db, "liceos")).then((snap) => {
      setLiceos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Liceo)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCargando(false);
    });
  }, [habilitado]);

  return { liceos, cargando };
}
