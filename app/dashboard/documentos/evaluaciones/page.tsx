"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { PLANTILLAS_EVALUACION, plantillaEvaluacionPorId } from "@/lib/evaluaciones";
import type { Evaluacion, Estudiante } from "@/types";
import Select from "@/components/ui/Select";
import TituloPagina from "@/components/TituloPagina";
import { ClipboardCheck, Wand2, Eye, ChevronRight } from "lucide-react";

type Tab = "plantillas" | "realizadas";

export default function EvaluacionesPage() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<Tab>("plantillas");

  const ambitoProfesor = useAmbitoProfesor();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const esProfesor = usuario?.rol === "profesor";
  const esCentroDual = usuario?.rol === "centro_dual";
  const cargandoAmbito = (esProfesor && ambitoProfesor.cargando) || (esCentroDual && ambitoMaestroGuia.cargando);

  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [filtroEstudianteId, setFiltroEstudianteId] = useState("");

  useEffect(() => {
    if (!usuario || tab !== "realizadas" || cargandoAmbito) return;
    async function cargar() {
      setCargandoHistorial(true);
      if (esProfesor || esCentroDual) {
        const idsEstudiantes = esProfesor ? ambitoProfesor.idsEstudiantes : ambitoMaestroGuia.idsEstudiantes;
        const lotes: string[][] = [];
        for (let i = 0; i < idsEstudiantes.length; i += 30) lotes.push(idsEstudiantes.slice(i, i + 30));
        const snaps = await Promise.all(
          lotes.map((lote) => getDocs(query(collection(db, "evaluaciones"), where("estudianteId", "in", lote))))
        );
        setEvaluaciones(snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluacion))));
        setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", idsEstudiantes));
      } else {
        const [snapEval, snapEst] = await Promise.all([
          getDocs(query(collection(db, "evaluaciones"), where("liceoId", "==", usuario!.liceoId))),
          getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        setEvaluaciones(snapEval.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluacion)));
        setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      }
      setCargandoHistorial(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tab, cargandoAmbito, ambitoProfesor.idsEstudiantes, ambitoMaestroGuia.idsEstudiantes]);

  function nombreEstudiante(id: string): string {
    const est = estudiantes.find((e) => e.id === id);
    return est ? `${est.nombres} ${est.apellidos}` : "Estudiante";
  }

  const evaluacionesFiltradas = useMemo(() => {
    const base = filtroEstudianteId ? evaluaciones.filter((e) => e.estudianteId === filtroEstudianteId) : evaluaciones;
    return [...base].sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  }, [evaluaciones, filtroEstudianteId]);

  const opcionesEstudiante = useMemo(() => {
    const idsConEvaluacion = new Set(evaluaciones.map((e) => e.estudianteId));
    return [
      { value: "", label: "Todos los estudiantes" },
      ...estudiantes.filter((e) => idsConEvaluacion.has(e.id)).map((e) => ({ value: e.id, label: `${e.nombres} ${e.apellidos}` })),
    ];
  }, [evaluaciones, estudiantes]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <TituloPagina icon={<ClipboardCheck size={28} />}>Evaluaciones</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Evalúa el desempeño de un estudiante en su Centro Dual.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("plantillas")}
          style={{ background: tab === "plantillas" ? "var(--accent)" : "var(--bg-card)", color: tab === "plantillas" ? "var(--text-on-accent)" : "var(--text-secondary)", border: "1px solid var(--border)" }}
          className="px-4 py-2 rounded-xl text-sm font-medium"
        >
          Evaluaciones disponibles
        </button>
        <button
          onClick={() => setTab("realizadas")}
          style={{ background: tab === "realizadas" ? "var(--accent)" : "var(--bg-card)", color: tab === "realizadas" ? "var(--text-on-accent)" : "var(--text-secondary)", border: "1px solid var(--border)" }}
          className="px-4 py-2 rounded-xl text-sm font-medium"
        >
          Evaluaciones realizadas
        </button>
      </div>

      {tab === "plantillas" && (
        PLANTILLAS_EVALUACION.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
            <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay evaluaciones disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLANTILLAS_EVALUACION.map((p) => (
              <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 flex flex-col gap-3">
                <div>
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{p.nombre}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{p.especialidad} · {p.nivel}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-[11px]">
                    Evaluación Maestro Guía
                  </span>
                  <span style={{ background: "var(--success)22", color: "var(--success)" }} className="px-2.5 py-1 rounded-full text-[11px]">
                    Activa
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <Link
                    href={`/dashboard/documentos/evaluaciones/realizar/${p.id}`}
                    style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Wand2 size={15} /> Realizar
                  </Link>
                  <Link
                    href={`/dashboard/documentos/evaluaciones/vista-previa/${p.id}`}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center"
                    aria-label="Vista previa"
                  >
                    <Eye size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "realizadas" && (
        <>
          {estudiantes.length > 0 && (
            <div className="mb-4 max-w-xs">
              <Select value={filtroEstudianteId} onChange={setFiltroEstudianteId} ariaLabel="Filtrar por estudiante" opciones={opcionesEstudiante} />
            </div>
          )}
          {cargandoHistorial || cargandoAmbito ? (
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
          ) : evaluacionesFiltradas.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
              <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Aún no hay evaluaciones realizadas</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {evaluacionesFiltradas.map((ev) => {
                const plantilla = plantillaEvaluacionPorId(ev.plantillaId);
                return (
                  <Link
                    key={ev.id}
                    href={`/dashboard/documentos/evaluaciones/registros/${ev.id}`}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    className="rounded-2xl p-4 flex items-center justify-between gap-3 hover:[border-color:var(--accent)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{nombreEstudiante(ev.estudianteId)}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{plantilla?.nombre ?? "Evaluación"} · {ev.fecha}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span style={{ color: "var(--accent-light)" }} className="text-sm font-bold">{ev.resultados.promedioGeneral}%</span>
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
