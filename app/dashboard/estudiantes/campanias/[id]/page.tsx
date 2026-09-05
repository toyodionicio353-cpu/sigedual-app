"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { CampaniaInvitacionEstudiante, RespuestaCampaniaEstudiante, Estudiante, Especialidad, EstadoRespuestaCampania } from "@/types";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, AlertTriangle, Wand2, Layers, Check, X, Eye,
} from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import EstudianteForm, { ESTUDIANTE_FORM_VACIO, type EstudianteFormValues } from "../../_components/EstudianteForm";

const ESTADO_LABEL: Record<EstadoRespuestaCampania, string> = {
  recibido: "Recibido", revision: "En revisión", aprobado: "Aprobado",
  rechazado: "Rechazado", traspasado: "Traspasado", error: "Error", duplicado: "Duplicado",
};
const ESTADO_COLOR: Record<EstadoRespuestaCampania, string> = {
  recibido: "var(--text-muted)", revision: "var(--warning)", aprobado: "var(--accent-light)",
  rechazado: "var(--danger)", traspasado: "var(--success)", error: "var(--danger)", duplicado: "var(--warning)",
};

const CONCURRENCIA = 3;

function valoresEstudianteDesdeRespuesta(r: RespuestaCampaniaEstudiante): EstudianteFormValues {
  return {
    ...ESTUDIANTE_FORM_VACIO,
    run: r.run, nombres: r.nombres, apellidoPaterno: r.apellidoPaterno, apellidoMaterno: r.apellidoMaterno,
    fechaNacimiento: r.fechaNacimiento, sexo: r.sexo, nacionalidad: r.nacionalidad,
    email: r.email, telefono: r.telefono, direccion: r.direccion, comuna: r.comuna, ciudad: r.ciudad,
    anioAcademico: r.anioAcademico, nivel: r.nivel, curso: r.curso, especialidadId: r.especialidadId, jornada: r.jornada,
    estado: "activo",
    enfermedadesCronicas: r.enfermedadesCronicas, alergias: r.alergias,
    apoderadoNombre: r.apoderadoNombre, apoderadoRun: r.apoderadoRun, apoderadoParentesco: r.apoderadoParentesco,
    apoderadoTelefono: r.apoderadoTelefono, apoderadoEmail: r.apoderadoEmail,
    apoderadoDomicilio: r.apoderadoDomicilio, apoderadoCiudad: r.apoderadoCiudad,
    observaciones: r.observaciones,
  };
}

async function procesarConcurrencia<T>(items: T[], limite: number, fn: (item: T) => Promise<void>) {
  let indice = 0;
  async function trabajador() {
    while (indice < items.length) {
      const i = indice++;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
}

export default function CampaniaEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [campania, setCampania] = useState<CampaniaInvitacionEstudiante | null>(null);
  const [respuestas, setRespuestas] = useState<RespuestaCampaniaEstudiante[]>([]);
  const [duplicados, setDuplicados] = useState<Record<string, Estudiante | null>>({});
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [errorGeneral, setErrorGeneral] = useState("");

  const [respuestaRevisar, setRespuestaRevisar] = useState<RespuestaCampaniaEstudiante | null>(null);
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [errorRevision, setErrorRevision] = useState("");

  async function cargar() {
    if (!usuario || !id) return;
    setLoading(true);
    const snapCampania = await getDoc(doc(db, "campanias_invitacion_estudiante", id));
    if (!snapCampania.exists()) {
      setNoEncontrada(true);
      setLoading(false);
      return;
    }
    const c = { id: snapCampania.id, ...snapCampania.data() } as CampaniaInvitacionEstudiante;
    setCampania(c);

    const [snapResp, snapEsp] = await Promise.all([
      getDocs(query(collection(db, "respuestas_campania_estudiante"), where("campaniaId", "==", id))),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", c.liceoId))),
    ]);
    const lista = snapResp.docs.map((d) => ({ id: d.id, ...d.data() } as RespuestaCampaniaEstudiante));
    lista.sort((a, b) => a.numero - b.numero);
    setRespuestas(lista);
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const res = await fetch(`/api/campanias-estudiante/${id}/duplicados`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setDuplicados(data.duplicados ?? {});
        }
      }
    } catch {
      // La comparación con SIGEDUAL es informativa — su falla no bloquea la revisión.
    }

    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id]);

  const seleccionables = useMemo(
    () => respuestas.filter((r) => (r.estado === "recibido" || r.estado === "aprobado") && !duplicados[r.id]),
    [respuestas, duplicados]
  );

  function toggleSeleccion(respuestaId: string) {
    setSeleccion((sel) => {
      const nuevo = new Set(sel);
      if (nuevo.has(respuestaId)) nuevo.delete(respuestaId);
      else nuevo.add(respuestaId);
      return nuevo;
    });
  }

  function seleccionarTodos() {
    setSeleccion(new Set(seleccionables.map((r) => r.id)));
  }

  async function autorellenarUno(r: RespuestaCampaniaEstudiante): Promise<void> {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/campanias-estudiante/${id}/respuestas/${r.id}/autorellenar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ valores: valoresEstudianteDesdeRespuesta(r), otrosMedicos: r.informacionMedicaAdicional, rasgos: r.rasgos, habilidades: r.habilidades }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRespuestas((lista) => lista.map((x) => (x.id === r.id ? { ...x, estado: "error", errorDetalle: data.error } : x)));
      return;
    }
    setRespuestas((lista) => lista.map((x) => (x.id === r.id ? { ...x, estado: "traspasado", estudianteIdResultado: data.estudianteId } : x)));
  }

  async function traspasar(ids: string[]) {
    if (procesando || ids.length === 0) return;
    setProcesando(true);
    setErrorGeneral("");
    setProgreso({ hechos: 0, total: ids.length });
    try {
      const items = ids.map((rid) => respuestas.find((r) => r.id === rid)).filter((r): r is RespuestaCampaniaEstudiante => !!r);
      let hechos = 0;
      await procesarConcurrencia(items, CONCURRENCIA, async (r) => {
        await autorellenarUno(r);
        hechos += 1;
        setProgreso({ hechos, total: ids.length });
      });
      setSeleccion(new Set());
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No fue posible completar el traspaso.");
    } finally {
      setProcesando(false);
      setProgreso(null);
    }
  }

  async function cambiarEstado(respuestaId: string, estado: "revision" | "aprobado" | "rechazado") {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/campanias-estudiante/${id}/respuestas/${respuestaId}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado }),
    });
    if (res.ok) {
      setRespuestas((lista) => lista.map((r) => (r.id === respuestaId ? { ...r, estado } : r)));
    }
  }

  async function guardarRevision(valores: EstudianteFormValues, otrosMedicos: string[], rasgos: string[], habilidades: string[]) {
    if (!respuestaRevisar || guardandoRevision) return;
    setGuardandoRevision(true);
    setErrorRevision("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const estudianteExistente = duplicados[respuestaRevisar.id];
      const res = await fetch(`/api/campanias-estudiante/${id}/respuestas/${respuestaRevisar.id}/autorellenar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estudianteIdExistente: estudianteExistente?.id, valores, otrosMedicos, rasgos, habilidades }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorRevision(data.error ?? "No fue posible guardar el estudiante.");
        return;
      }
      setRespuestas((lista) => lista.map((r) => (r.id === respuestaRevisar.id ? { ...r, estado: "traspasado", estudianteIdResultado: data.estudianteId } : r)));
      setRespuestaRevisar(null);
    } catch (err) {
      setErrorRevision(err instanceof Error ? err.message : "No fue posible conectar con el servidor.");
    } finally {
      setGuardandoRevision(false);
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (noEncontrada || !campania) {
    return (
      <div className="p-4 md:p-8 max-w-4xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Formulario masivo no encontrado</p>
          <Link href="/dashboard/estudiantes/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} /> Volver a Agregar estudiante
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <TituloPagina icon={<Layers size={28} />}>{campania.nombre}</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          {campania.respuestasCount}/{campania.capacidad} respuestas · Generado por {campania.profesorNombre}
        </p>
      </div>

      {errorGeneral && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorGeneral}</p>
        </div>
      )}

      {respuestas.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Todavía no hay respuestas</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Comparte el enlace del formulario masivo para empezar a recibirlas.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button onClick={seleccionarTodos} disabled={procesando || seleccionables.length === 0} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              Seleccionar todos
            </button>
            <span style={{ color: "var(--text-muted)" }} className="text-xs">{seleccion.size} seleccionado(s)</span>
            <button
              onClick={() => traspasar(Array.from(seleccion))}
              disabled={procesando || seleccion.size === 0}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Wand2 size={13} /> Traspasar seleccionados
            </button>
            <button
              onClick={() => traspasar(seleccionables.map((r) => r.id))}
              disabled={procesando || seleccionables.length === 0}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Traspasar todos ({seleccionables.length})
            </button>
            {progreso && (
              <span style={{ color: "var(--text-muted)" }} className="text-xs">Procesando {progreso.hechos}/{progreso.total}...</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {respuestas.map((r) => {
              const duplicado = duplicados[r.id];
              const puedeSeleccionar = (r.estado === "recibido" || r.estado === "aprobado") && !duplicado;
              return (
                <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={seleccion.has(r.id)}
                      disabled={!puedeSeleccionar}
                      onChange={() => toggleSeleccion(r.id)}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">#{r.numero} — {r.nombres} {r.apellidoPaterno}</p>
                        <span style={{ color: ESTADO_COLOR[r.estado], background: `${ESTADO_COLOR[r.estado]}22` }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                          {ESTADO_LABEL[r.estado]}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                        {r.run} · {r.curso} · {especialidades.find((e) => e.id === r.especialidadId)?.nombre || "—"}
                      </p>
                      {duplicado && (
                        <p style={{ color: "var(--warning)" }} className="text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} /> Ya existe: {duplicado.nombres} {duplicado.apellidos} — requiere revisión individual
                        </p>
                      )}
                      {r.estado === "error" && r.errorDetalle && (
                        <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{r.errorDetalle}</p>
                      )}
                      {r.estado === "traspasado" && r.estudianteIdResultado && (
                        <Link href={`/dashboard/estudiantes/${r.estudianteIdResultado}`} style={{ color: "var(--accent-light)" }} className="text-xs mt-1 inline-flex items-center gap-1 hover:underline">
                          <Eye size={12} /> Ver estudiante
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {duplicado && r.estado !== "traspasado" && (
                        <button onClick={() => setRespuestaRevisar(r)} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold">
                          Revisar
                        </button>
                      )}
                      {(r.estado === "recibido" || r.estado === "revision") && (
                        <>
                          <button onClick={() => cambiarEstado(r.id, "aprobado")} title="Aprobar" style={{ color: "var(--success)" }} className="p-1.5"><Check size={15} /></button>
                          <button onClick={() => cambiarEstado(r.id, "rechazado")} title="Rechazar" style={{ color: "var(--danger)" }} className="p-1.5"><X size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {respuestaRevisar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">
                {duplicados[respuestaRevisar.id] ? "Actualizar estudiante existente" : "Autorrellenar Estudiante"}
              </h2>
              <button onClick={() => setRespuestaRevisar(null)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorRevision && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorRevision}</p>
              </div>
            )}
            <EstudianteForm
              modo="crear"
              valoresIniciales={valoresEstudianteDesdeRespuesta(respuestaRevisar)}
              otrosMedicosIniciales={respuestaRevisar.informacionMedicaAdicional ?? []}
              rasgosIniciales={respuestaRevisar.rasgos ?? []}
              habilidadesIniciales={respuestaRevisar.habilidades ?? []}
              especialidades={especialidades}
              runsOcupados={[]}
              guardando={guardandoRevision}
              onCancelar={() => setRespuestaRevisar(null)}
              onGuardar={guardarRevision}
            />
          </div>
        </div>
      )}
    </div>
  );
}
