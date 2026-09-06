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
import { estadoEnvioEvaluacion, diasParaCierre } from "@/lib/evaluaciones/envios";
import ModalEnviarEvaluacion from "@/components/evaluaciones/ModalEnviarEvaluacion";
import type { Evaluacion, Estudiante, EnvioEvaluacion, Asignacion } from "@/types";
import Select from "@/components/ui/Select";
import TituloPagina from "@/components/TituloPagina";
import { ClipboardCheck, Wand2, Eye, ChevronRight, Send, Clock, AlertTriangle } from "lucide-react";

type Tab = "plantillas" | "realizadas";

const DIAS_ALERTA_CIERRE = 3;

export default function EvaluacionesPage() {
  const { usuario } = useAuth();
  const esEstudianteInicial = usuario?.rol === "estudiante";
  const [tab, setTab] = useState<Tab>(esEstudianteInicial ? "realizadas" : "plantillas");

  const ambitoProfesor = useAmbitoProfesor();
  const ambitoMaestroGuia = useAmbitoMaestroGuia();
  const esProfesor = usuario?.rol === "profesor";
  const esCentroDual = usuario?.rol === "centro_dual";
  const esEstudiante = usuario?.rol === "estudiante";
  const esAdmin = usuario?.rol === "administrador";
  const puedeEnviar = esProfesor || esAdmin;
  const cargandoAmbito = (esProfesor && ambitoProfesor.cargando) || (esCentroDual && ambitoMaestroGuia.cargando);

  // Un administrador no tiene "ámbito" acotado (ve el liceo completo), así
  // que para poder elegir a quién enviar necesita sus propias asignaciones
  // vigentes — igual criterio que el resto de la app usa para su liceo.
  const [asignacionesAdmin, setAsignacionesAdmin] = useState<Asignacion[]>([]);
  useEffect(() => {
    if (!usuario || !esAdmin || tab !== "plantillas") return;
    getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))).then((snap) => {
      const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));
      setAsignacionesAdmin(todas.filter((a) => a.estado === "asignada" || a.estado === "activa"));
    });
  }, [usuario, esAdmin, tab]);

  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [filtroEstudianteId, setFiltroEstudianteId] = useState("");

  // Envíos pendientes de un Centro Dual: solo estos, dentro de su plazo,
  // cuentan como "Evaluaciones disponibles" — nunca la lista de plantillas
  // libre que sí ve un profesor.
  const [enviosPendientes, setEnviosPendientes] = useState<EnvioEvaluacion[]>([]);
  const [cargandoEnvios, setCargandoEnvios] = useState(true);
  const [plantillaAEnviar, setPlantillaAEnviar] = useState<{ id: string; nombre: string } | null>(null);
  const [avisoEnvio, setAvisoEnvio] = useState("");

  useEffect(() => {
    if (!usuario || usuario.rol !== "centro_dual" || tab !== "plantillas" || ambitoMaestroGuia.cargando) return;
    let cancelado = false;
    (async () => {
      setCargandoEnvios(true);
      const idsEstudiantes = ambitoMaestroGuia.idsEstudiantes;
      const lotes: string[][] = [];
      for (let i = 0; i < idsEstudiantes.length; i += 30) lotes.push(idsEstudiantes.slice(i, i + 30));
      const snaps = await Promise.all(
        lotes.map((lote) => getDocs(query(collection(db, "envios_evaluacion"), where("estudianteId", "in", lote))))
      );
      if (cancelado) return;
      const todos = snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() } as EnvioEvaluacion)));
      setEnviosPendientes(todos.filter((e) => estadoEnvioEvaluacion(e) === "disponible"));
      setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", idsEstudiantes));
      setCargandoEnvios(false);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tab, ambitoMaestroGuia.cargando, ambitoMaestroGuia.idsEstudiantes]);

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
      } else if (esEstudiante) {
        if (!usuario!.estudianteId) {
          setEvaluaciones([]); setEstudiantes([]);
        } else {
          const snapEval = await getDocs(query(collection(db, "evaluaciones"), where("estudianteId", "==", usuario!.estudianteId)));
          setEvaluaciones(snapEval.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluacion)));
          setEstudiantes([]);
        }
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
          {esEstudiante ? "Tus evaluaciones de desempeño en el Centro Dual." : "Evalúa el desempeño de un estudiante en su Centro Dual."}
        </p>
      </div>

      {!esEstudiante && (
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
      )}

      {tab === "plantillas" && !esEstudiante && (
        esCentroDual ? (
          <>
            {avisoEnvio && (
              <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-2.5 mb-4">
                <p style={{ color: "var(--success)" }} className="text-sm font-medium">{avisoEnvio}</p>
              </div>
            )}
            {cargandoEnvios || ambitoMaestroGuia.cargando ? (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
            ) : enviosPendientes.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
                <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay evaluaciones disponibles</p>
                <p style={{ color: "var(--text-muted)" }} className="text-sm">Cuando tu Profesor Supervisor te envíe una, aparecerá aquí dentro de su plazo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enviosPendientes.map((envio) => {
                  const plantilla = plantillaEvaluacionPorId(envio.plantillaId);
                  const dias = diasParaCierre(envio);
                  const porCerrar = dias <= DIAS_ALERTA_CIERRE;
                  return (
                    <div key={envio.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 flex flex-col gap-3">
                      <div>
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{plantilla?.nombre ?? "Evaluación"}</p>
                        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{nombreEstudiante(envio.estudianteId)}</p>
                      </div>
                      <p
                        style={{ color: porCerrar ? "var(--danger)" : "var(--text-secondary)" }}
                        className="flex items-center gap-1.5 text-xs font-medium"
                      >
                        {porCerrar ? <AlertTriangle size={13} /> : <Clock size={13} />}
                        {dias <= 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`} · {envio.fechaFin}
                      </p>
                      <Link
                        href={`/dashboard/documentos/evaluaciones/realizar/${envio.plantillaId}?envioId=${envio.id}`}
                        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 mt-1"
                      >
                        <Wand2 size={15} /> Realizar
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : PLANTILLAS_EVALUACION.length === 0 ? (
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
                {puedeEnviar && (
                  <button
                    onClick={() => setPlantillaAEnviar({ id: p.id, nombre: p.nombre })}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                  >
                    <Send size={15} /> Enviar a un Centro Dual
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {plantillaAEnviar && usuario && (
        <ModalEnviarEvaluacion
          plantillaId={plantillaAEnviar.id}
          plantillaNombre={plantillaAEnviar.nombre}
          asignaciones={esAdmin ? asignacionesAdmin : ambitoProfesor.asignaciones}
          liceoId={usuario.liceoId}
          profesorUid={usuario.uid}
          profesorNombre={usuario.nombre}
          onCancelar={() => setPlantillaAEnviar(null)}
          onEnviado={(cantidad) => {
            setPlantillaAEnviar(null);
            setAvisoEnvio(`Evaluación enviada a ${cantidad} centro${cantidad === 1 ? "" : "s"} dual${cantidad === 1 ? "" : "es"}.`);
            setTimeout(() => setAvisoEnvio(""), 4000);
          }}
        />
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
