"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { plantillaEvaluacionPorId } from "@/lib/evaluaciones";
import { NIVELES_LOGRO } from "@/lib/evaluaciones/tipos";
import type { Evaluacion, Estudiante, CentroDual, MaestroGuia, NivelLogro } from "@/types";
import TituloPagina from "@/components/TituloPagina";
import LeyendaNiveles from "@/components/evaluaciones/LeyendaNiveles";
import { ArrowLeft, ClipboardCheck, AlertCircle } from "lucide-react";

function NivelesConValor({ valor }: { valor?: NivelLogro }) {
  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap">
        {NIVELES_LOGRO.map((n) => {
          const activo = valor === n.value;
          return (
            <span key={n.value} className="flex items-center gap-1.5" title={n.descripcion}>
              <span
                style={{
                  border: `1px solid ${activo ? "var(--accent)" : "var(--border-light)"}`,
                  background: activo ? "var(--accent)" : "transparent",
                }}
                className="w-3.5 h-3.5 rounded-full inline-block"
              />
              <span style={{ color: activo ? "var(--text-primary)" : "var(--text-muted)" }} className="text-sm font-medium">{n.label}</span>
            </span>
          );
        })}
        <LeyendaNiveles />
      </div>
    </div>
  );
}

export default function RegistroEvaluacionPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [maestroGuia, setMaestroGuia] = useState<MaestroGuia | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDoc(doc(db, "evaluaciones", id));
      if (!snap.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const ev = { id: snap.id, ...snap.data() } as Evaluacion;
      setEvaluacion(ev);
      const [snapEst, snapCentro, snapMg] = await Promise.all([
        getDoc(doc(db, "estudiantes", ev.estudianteId)),
        getDoc(doc(db, "centros_duales", ev.centroDualId)),
        getDoc(doc(db, "maestros_guia", ev.maestroGuiaId)),
      ]);
      if (snapEst.exists()) setEstudiante({ id: snapEst.id, ...snapEst.data() } as Estudiante);
      if (snapCentro.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      if (snapMg.exists()) setMaestroGuia({ id: snapMg.id, ...snapMg.data() } as MaestroGuia);
      setLoading(false);
    }
    cargar();
  }, [usuario, id]);

  if (loading) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (noEncontrado || !evaluacion) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Evaluación no encontrada</p>
          <Link href="/dashboard/documentos/evaluaciones" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-4">
            <ArrowLeft size={16} /> Volver a evaluaciones
          </Link>
        </div>
      </div>
    );
  }

  const plantilla = plantillaEvaluacionPorId(evaluacion.plantillaId);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/documentos/evaluaciones" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <TituloPagina icon={<ClipboardCheck size={28} />}>{plantilla?.nombre ?? "Evaluación"}</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : "Estudiante"} · {evaluacion.fecha}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          {plantilla && <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-2">{plantilla.titulo}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p style={{ color: "var(--text-secondary)" }}>Estudiante: <span style={{ color: "var(--text-primary)" }}>{estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : "—"}</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Empresa/Centro Dual: <span style={{ color: "var(--text-primary)" }}>{centro?.nombre || "—"}</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Maestro Guía: <span style={{ color: "var(--text-primary)" }}>{maestroGuia ? `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}` : "—"}</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Fecha: <span style={{ color: "var(--text-primary)" }}>{evaluacion.fecha}</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Evaluado por: <span style={{ color: "var(--text-primary)" }}>{evaluacion.evaluadorNombre}</span></p>
          </div>
        </div>

        {plantilla && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Logros en las actividades — {plantilla.porcentajeLogros}%</p>
            <div className="flex flex-col gap-6">
              {plantilla.categoriasLogros.map((cat) => (
                <div key={cat.id}>
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-3">{cat.titulo}</p>
                  {cat.permiteTareasDinamicas ? (
                    <div className="flex flex-col gap-3">
                      {evaluacion.tareasAdicionales.length === 0 ? (
                        <p style={{ color: "var(--text-muted)" }} className="text-xs">Sin tareas adicionales registradas.</p>
                      ) : (
                        evaluacion.tareasAdicionales.map((tarea, i) => (
                          <div key={i} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{tarea.descripcion}</p>
                            <NivelesConValor valor={tarea.valor} />
                            {tarea.observacion && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2">{tarea.observacion}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {cat.criterios.map((criterio) => (
                        <div key={criterio.id}>
                          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                          <NivelesConValor valor={evaluacion.respuestasLogros[cat.id]?.[criterio.id]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {plantilla && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Desarrollo Personal — {plantilla.porcentajeDesarrolloPersonal}%</p>
            <div className="flex flex-col gap-4">
              {plantilla.criteriosDesarrolloPersonal.map((criterio) => (
                <div key={criterio.id}>
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                  <NivelesConValor valor={evaluacion.respuestasDesarrolloPersonal[criterio.id]} />
                </div>
              ))}
            </div>
          </div>
        )}

        {evaluacion.observaciones && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-3">Observaciones</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap">{evaluacion.observaciones}</p>
          </div>
        )}

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Resultado</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <p style={{ color: "var(--text-secondary)" }}>Logros en actividades: <span style={{ color: "var(--text-primary)" }} className="font-semibold">{evaluacion.resultados.logrosPorcentaje}%</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Desarrollo personal: <span style={{ color: "var(--text-primary)" }} className="font-semibold">{evaluacion.resultados.desarrolloPersonalPorcentaje}%</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Promedio general: <span style={{ color: "var(--accent-light)" }} className="font-bold">{evaluacion.resultados.promedioGeneral}%</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
