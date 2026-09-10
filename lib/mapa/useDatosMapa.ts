"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, onSnapshot, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin } from "@/lib/liceos/modoGlobalAdmin";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { esRolConAccesoCompletoLiceo } from "@/lib/permisos/ambito";
import { puntoValido, type Punto } from "./geo";
import {
  calcularCapacidad, esCentroNuevo, estadoDeCentro, estadoDePractica, ocupaCupo,
  type CapacidadCentro, type EstadoPinCentro, type EstadoPinPractica,
} from "./estados";
import type { Asignacion, CentroDual, Estudiante, PracticaProfesional } from "@/types";

/** Datos mínimos de un estudiante para la ficha del mapa. El mapa no es
 * una vía para consultar la ficha completa de nadie. */
export interface EstudianteEnMapa {
  id: string;
  nombre: string;
  curso: string;
  nivel: string;
}

export interface PinCentro {
  tipo: "centro";
  id: string;
  centro: CentroDual;
  punto: Punto;
  estado: EstadoPinCentro;
  /** Dentro de sus primeros 60 días: se dibuja el anillo morado ADEMÁS del
   * color de estado, nunca en lugar de él. */
  esNuevo: boolean;
  capacidad: CapacidadCentro;
  estudiantes: EstudianteEnMapa[];
}

export interface PinPractica {
  tipo: "practica";
  id: string;
  practica: PracticaProfesional;
  punto: Punto;
  estado: EstadoPinPractica;
  estudiante: EstudianteEnMapa | null;
}

export type PinMapa = PinCentro | PinPractica;

/** Registro que existe y el usuario puede ver, pero que no tiene una
 * ubicación utilizable. No recibe pin: se lista aparte para que alguien
 * complete su ubicación desde el formulario correspondiente. */
export interface RegistroSinUbicacion {
  tipo: "centro" | "practica";
  id: string;
  nombre: string;
  direccion: string;
}

export interface DatosMapa {
  centros: PinCentro[];
  practicas: PinPractica[];
  sinUbicacion: RegistroSinUbicacion[];
  cargando: boolean;
  error: string | null;
}

function nombreEstudiante(e: Estudiante): string {
  const apellidos = [e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(" ") || e.apellidos || "";
  return [e.nombres, apellidos].filter(Boolean).join(" ").trim() || "Estudiante";
}

/**
 * Datos del Mapa Dual, filtrados por los mismos permisos que el resto de
 * SIGEDUAL (ver lib/permisos/ambito.ts). El mapa NO es una vía alternativa
 * de acceso: solo dibuja información que el usuario ya podía consultar.
 *
 *   desarrollador (modo global) | Todos los liceos.
 *   desarrollador (en un liceo) |
 *   director / coordinador      | Su liceo completo.
 *   profesor                    | Los Centros Duales de su ámbito (mismos
 *                               | que ve en el listado) y las prácticas que
 *                               | supervisa.
 *   centro_dual                 | Su propio centro.
 *   estudiante                  | Su propio centro y su propia práctica.
 *
 * Un profesor nunca lanza una consulta a nivel de liceo: las reglas de
 * Firestore rechazarían la consulta completa porque no todos los
 * documentos del liceo son de su especialidad. Lee por id, igual que ya
 * lo hace el listado de Centros Duales.
 */
export function useDatosMapa(): DatosMapa {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const ambitoProfesor = useAmbitoProfesor();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();

  const [centrosRaw, setCentrosRaw] = useState<CentroDual[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [practicasRaw, setPracticasRaw] = useState<PracticaProfesional[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rol = usuario?.rol;
  const liceoId = usuario?.liceoId;
  const idsCentrosAmbito = ambitoProfesor.idsCentros.join(",");

  // Se recalcula cada minuto para que "próxima a finalizar" y el período
  // de prueba de 60 días cambien solos al cruzar su fecha, sin recargar.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cargandoAmbito = useRef(false);
  cargandoAmbito.current =
    (rol === "profesor" && ambitoProfesor.cargando)
    || (rol === "centro_dual" && ambitoMaestroGuia.cargando);

  useEffect(() => {
    if (!usuario || !rol) { setCargando(false); return; }
    if (cargandoAmbito.current) return;

    setError(null);
    const desuscribir: (() => void)[] = [];
    let cancelado = false;

    /** Escucha en vivo: cualquier cambio hecho desde otra parte de
     * SIGEDUAL (asignar un estudiante, dar de baja un centro) se refleja
     * en el mapa sin que nadie recargue nada. */
    function escuchar<T>(q: Query, aplicar: (filas: T[]) => void) {
      desuscribir.push(onSnapshot(
        q,
        (snap) => { if (!cancelado) aplicar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)); },
        () => { if (!cancelado) setError("No se pudo cargar parte de la información del mapa."); }
      ));
    }

    (async () => {
      try {
        if (rol === "profesor") {
          // Centros y estudiantes por id (su ámbito ya resuelto); las
          // asignaciones, en vivo, son las suyas.
          const ids = idsCentrosAmbito ? idsCentrosAmbito.split(",") : [];
          const [centros, ests] = await Promise.all([
            ids.length ? obtenerDocumentosPorId<CentroDual>("centros_duales", ids) : Promise.resolve([]),
            ambitoProfesor.idsEstudiantes.length
              ? obtenerDocumentosPorId<Estudiante>("estudiantes", ambitoProfesor.idsEstudiantes)
              : Promise.resolve([]),
          ]);
          if (cancelado) return;
          setCentrosRaw(centros);
          setEstudiantes(ests);
          setAsignaciones(ambitoProfesor.asignaciones);
          // Solo un campo en el filtro: no requiere índice compuesto y las
          // reglas lo aceptan sin ambigüedad.
          escuchar<PracticaProfesional>(
            query(collection(db, "practicas_profesionales"), where("profesorSupervisorId", "==", usuario.uid)),
            setPracticasRaw
          );
          setCargando(false);
          return;
        }

        if (rol === "centro_dual" || rol === "estudiante") {
          const idCentro = usuario.centroDualId;
          const idEstudiante = usuario.estudianteId;
          const [centros, ests] = await Promise.all([
            idCentro ? obtenerDocumentosPorId<CentroDual>("centros_duales", [idCentro]) : Promise.resolve([]),
            idEstudiante ? obtenerDocumentosPorId<Estudiante>("estudiantes", [idEstudiante]) : Promise.resolve([]),
          ]);
          if (cancelado) return;
          setCentrosRaw(centros);
          setEstudiantes(ests);
          setAsignaciones(rol === "centro_dual" ? ambitoMaestroGuia.asignaciones : []);
          if (idEstudiante) {
            escuchar<PracticaProfesional>(
              query(collection(db, "practicas_profesionales"), where("estudianteId", "==", idEstudiante)),
              setPracticasRaw
            );
          } else {
            setPracticasRaw([]);
          }
          setCargando(false);
          return;
        }

        if (!esRolConAccesoCompletoLiceo(rol)) { setCargando(false); return; }

        // Acceso institucional completo: consulta por colección, en vivo.
        // En modo global (desarrollador sin liceo elegido) sin filtro.
        const porLiceo = (col: string): Query =>
          modoGlobal || !liceoId
            ? collection(db, col)
            : query(collection(db, col), where("liceoId", "==", liceoId));

        escuchar<CentroDual>(porLiceo("centros_duales"), setCentrosRaw);
        escuchar<Asignacion>(porLiceo("asignaciones"), setAsignaciones);
        escuchar<PracticaProfesional>(porLiceo("practicas_profesionales"), setPracticasRaw);
        escuchar<Estudiante>(porLiceo("estudiantes"), setEstudiantes);
        setCargando(false);
      } catch {
        if (!cancelado) {
          setError("No se pudo cargar la información del mapa.");
          setCargando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
      desuscribir.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    usuario, rol, liceoId, modoGlobal, idsCentrosAmbito,
    ambitoProfesor.cargando, ambitoProfesor.asignaciones, ambitoProfesor.idsEstudiantes,
    ambitoMaestroGuia.cargando, ambitoMaestroGuia.asignaciones,
  ]);

  const estudiantePorId = useMemo(() => {
    const mapa: Record<string, Estudiante> = {};
    estudiantes.forEach((e) => (mapa[e.id] = e));
    return mapa;
  }, [estudiantes]);

  const asignacionesPorCentro = useMemo(() => {
    const mapa: Record<string, Asignacion[]> = {};
    asignaciones.forEach((a) => {
      (mapa[a.centroDualId] ??= []).push(a);
    });
    return mapa;
  }, [asignaciones]);

  return useMemo(() => {
    const centros: PinCentro[] = [];
    const practicas: PinPractica[] = [];
    const sinUbicacion: RegistroSinUbicacion[] = [];

    for (const centro of centrosRaw) {
      const propias = asignacionesPorCentro[centro.id] ?? [];
      const punto = puntoValido(centro.latitud, centro.longitud);
      if (!punto) {
        sinUbicacion.push({ tipo: "centro", id: centro.id, nombre: centro.nombre, direccion: [centro.direccion, centro.comuna].filter(Boolean).join(", ") });
        continue;
      }
      centros.push({
        tipo: "centro",
        id: centro.id,
        centro,
        punto,
        estado: estadoDeCentro(centro, propias, ahora),
        esNuevo: esCentroNuevo(centro, ahora),
        capacidad: calcularCapacidad(centro, propias),
        estudiantes: propias
          .filter(ocupaCupo)
          .map((a) => estudiantePorId[a.estudianteId])
          .filter((e): e is Estudiante => Boolean(e))
          .map((e) => ({ id: e.id, nombre: nombreEstudiante(e), curso: e.curso, nivel: e.nivel })),
      });
    }

    for (const practica of practicasRaw) {
      const punto = puntoValido(practica.latitud, practica.longitud);
      if (!punto) {
        sinUbicacion.push({ tipo: "practica", id: practica.id, nombre: practica.lugarNombre, direccion: [practica.direccion, practica.comuna].filter(Boolean).join(", ") });
        continue;
      }
      const e = estudiantePorId[practica.estudianteId];
      practicas.push({
        tipo: "practica",
        id: practica.id,
        practica,
        punto,
        estado: estadoDePractica(practica, ahora),
        estudiante: e ? { id: e.id, nombre: nombreEstudiante(e), curso: e.curso, nivel: e.nivel } : null,
      });
    }

    return { centros, practicas, sinUbicacion, cargando, error };
  }, [centrosRaw, practicasRaw, asignacionesPorCentro, estudiantePorId, ahora, cargando, error]);
}
