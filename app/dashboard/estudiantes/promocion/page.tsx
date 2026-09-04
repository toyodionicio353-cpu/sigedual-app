"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Estudiante, Especialidad, HistorialCurso } from "@/types";
import { ArrowLeft, GraduationCap, CheckCircle2, RotateCcw } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const ANIO_ACTUAL = new Date().getFullYear();

function siguienteNivel(nivel: string): string | null {
  const i = NIVELES.indexOf(nivel);
  if (i === -1 || i === NIVELES.length - 1) return null;
  return NIVELES[i + 1];
}

type Decision = "aprobado" | "repitio";

export default function PromocionCursoPage() {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const [errorSistema, setErrorSistema] = useState("");

  const puedeGestionar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (usuario && puedeGestionar) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = usuario.rol === "profesor"
      ? query(collection(db, "estudiantes"), where("profesorId", "==", usuario.uid))
      : query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
    const [snapEst, snapEsp] = await Promise.all([
      getDocs(q),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
    ]);
    setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setLoading(false);
  }

  const pendientes = useMemo(() => {
    return estudiantes
      .filter((e) => e.estado === "activo")
      .filter((e) => {
        const anio = Number(e.anioAcademico);
        return !Number.isNaN(anio) && anio < ANIO_ACTUAL;
      })
      .sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`));
  }, [estudiantes]);

  function especialidadNombre(id: string): string {
    return especialidades.find((e) => e.id === id)?.nombre || "";
  }

  function elegir(id: string, decision: Decision) {
    setDecisiones((d) => ({ ...d, [id]: decision }));
  }

  async function confirmar(estudiante: Estudiante) {
    const decision = decisiones[estudiante.id];
    if (!usuario || !decision || confirmando) return;
    setConfirmando(estudiante.id);
    setErrorSistema("");
    try {
      const entradaHistorial: HistorialCurso = {
        anioAcademico: estudiante.anioAcademico || String(ANIO_ACTUAL - 1),
        nivel: estudiante.nivel,
        curso: estudiante.curso || "",
        especialidadId: estudiante.especialidadId,
        resultado: decision,
        confirmadoEn: new Date().toISOString(),
        confirmadoPor: usuario.uid,
      };
      const historial = [...(estudiante.historialCursos ?? []), entradaHistorial];

      let nuevoNivel = estudiante.nivel;
      let nuevoEstado = estudiante.estado;
      let nuevoCurso = estudiante.curso;

      if (decision === "aprobado") {
        const siguiente = siguienteNivel(estudiante.nivel);
        if (siguiente) {
          nuevoNivel = siguiente;
          nuevoCurso = "";
        } else {
          nuevoEstado = "egresado";
          nuevoCurso = "";
        }
      }

      await updateDoc(doc(db, "estudiantes", estudiante.id), {
        historialCursos: historial,
        nivel: nuevoNivel,
        curso: nuevoCurso,
        estado: nuevoEstado,
        anioAcademico: String(ANIO_ACTUAL),
        actualizadoEn: new Date().toISOString(),
      });

      setEstudiantes((prev) => prev.map((e) => (e.id === estudiante.id
        ? { ...e, historialCursos: historial, nivel: nuevoNivel, curso: nuevoCurso, estado: nuevoEstado, anioAcademico: String(ANIO_ACTUAL) }
        : e)));
      setConfirmados((prev) => new Set(prev).add(estudiante.id));
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible confirmar la promoción. Intenta nuevamente. (${detalle})`);
    } finally {
      setConfirmando(null);
    }
  }

  if (usuario && !puedeGestionar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<GraduationCap size={28} />}>Promoción de curso</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Confirma quiénes pasaron de nivel y quiénes repiten para el año académico {ANIO_ACTUAL}.
          </p>
        </div>
        <Link
          href="/dashboard/estudiantes"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : pendientes.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay promociones pendientes</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Todos los estudiantes activos están al día con el año académico {ANIO_ACTUAL}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pendientes.map((e) => {
            const decision = decisiones[e.id];
            const confirmado = confirmados.has(e.id);
            const siguiente = siguienteNivel(e.nivel);
            return (
              <div key={e.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{e.nombres} {e.apellidos}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                      {e.run} · Cursó {e.nivel} ({e.anioAcademico}) · {especialidadNombre(e.especialidadId) || "Sin especialidad"}
                    </p>
                  </div>

                  {confirmado ? (
                    <span style={{ color: "var(--success)", background: "var(--success)22" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0">
                      <CheckCircle2 size={13} />
                      Confirmado
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => elegir(e.id, "aprobado")}
                        style={{
                          background: decision === "aprobado" ? "var(--success)" : "var(--bg-surface)",
                          border: `1px solid ${decision === "aprobado" ? "var(--success)" : "var(--border)"}`,
                          color: decision === "aprobado" ? "#fff" : "var(--text-secondary)",
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      >
                        <GraduationCap size={13} />
                        {siguiente ? `Pasó a ${siguiente}` : "Egresó"}
                      </button>
                      <button
                        onClick={() => elegir(e.id, "repitio")}
                        style={{
                          background: decision === "repitio" ? "var(--warning)" : "var(--bg-surface)",
                          border: `1px solid ${decision === "repitio" ? "var(--warning)" : "var(--border)"}`,
                          color: decision === "repitio" ? "#1a1300" : "var(--text-secondary)",
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      >
                        <RotateCcw size={13} />
                        Repite {e.nivel}
                      </button>
                      <button
                        onClick={() => confirmar(e)}
                        disabled={!decision || confirmando === e.id}
                        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                        className="px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-40 transition-opacity"
                      >
                        {confirmando === e.id ? "Confirmando..." : "Confirmar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
