"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { CampaniaInvitacionEmpresa, RespuestaCampaniaEmpresa, CentroDual, Especialidad, EstadoRespuestaCampania } from "@/types";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Wand2, Layers, Check, X, Eye,
} from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import CentroDualForm, { CENTRO_FORM_VACIO, type CentroDualFormValues } from "../../_components/CentroDualForm";
import MaestroGuiaForm, { MAESTRO_GUIA_FORM_VACIO, type MaestroGuiaFormValues } from "../../maestros/_components/MaestroGuiaForm";

const ESTADO_LABEL: Record<EstadoRespuestaCampania, string> = {
  recibido: "Recibido", revision: "En revisión", aprobado: "Aprobado",
  rechazado: "Rechazado", traspasado: "Traspasado", error: "Error", duplicado: "Duplicado",
};
const ESTADO_COLOR: Record<EstadoRespuestaCampania, string> = {
  recibido: "var(--text-muted)", revision: "var(--warning)", aprobado: "var(--accent-light)",
  rechazado: "var(--danger)", traspasado: "var(--success)", error: "var(--danger)", duplicado: "var(--warning)",
};

const CONCURRENCIA = 3;

function valoresCentroDesdeRespuesta(r: RespuestaCampaniaEmpresa): CentroDualFormValues {
  return {
    ...CENTRO_FORM_VACIO,
    nombre: r.empresa.razonSocial ?? "",
    rut: r.empresa.rut ?? "",
    tipo: r.empresa.tipo ?? "empresa",
    razonSocial: r.empresa.razonSocial ?? "",
    nombreComercial: r.empresa.nombreFantasia ?? "",
    direccion: r.empresa.direccion ?? "",
    comuna: r.empresa.comuna ?? "",
    ciudad: r.empresa.ciudad ?? "",
    region: r.empresa.region ?? "",
    telefono: r.empresa.telefono ?? "",
    email: r.empresa.email ?? "",
    sitioWeb: r.empresa.sitioWeb ?? "",
    contactoNombre: r.empresa.contactoNombre ?? "",
    contactoCargo: r.empresa.contactoCargo ?? "",
    contactoTelefono: r.empresa.contactoTelefono ?? "",
    contactoEmail: r.empresa.contactoEmail ?? "",
    capacidad: r.capacidad.cantidadEstudiantes != null ? String(r.capacidad.cantidadEstudiantes) : "",
  };
}

function valoresMaestroDesdeRespuesta(m: RespuestaCampaniaEmpresa["maestrosGuia"][number]): MaestroGuiaFormValues {
  const notas = [
    m.especialidad ? `Especialidad indicada: ${m.especialidad}` : "",
    m.disponibilidad ? `Disponibilidad: ${m.disponibilidad}` : "",
    m.observaciones ?? "",
  ].filter(Boolean).join("\n");
  return {
    ...MAESTRO_GUIA_FORM_VACIO,
    nombres: m.nombres,
    apellidoPaterno: m.apellidoPaterno ?? "",
    apellidoMaterno: m.apellidoMaterno ?? "",
    run: m.run ?? "",
    email: m.email ?? "",
    telefono: m.telefono ?? "",
    cargo: m.cargo ?? "",
    area: m.area ?? "",
    aniosExperiencia: m.aniosExperiencia ?? "",
    capacidad: m.capacidad ?? "",
    observaciones: notas,
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

export default function CampaniaEmpresaPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [campania, setCampania] = useState<CampaniaInvitacionEmpresa | null>(null);
  const [respuestas, setRespuestas] = useState<RespuestaCampaniaEmpresa[]>([]);
  const [duplicados, setDuplicados] = useState<Record<string, CentroDual | null>>({});
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [errorGeneral, setErrorGeneral] = useState("");

  const [respuestaRevisar, setRespuestaRevisar] = useState<RespuestaCampaniaEmpresa | null>(null);
  const [centroCreadoIdRevision, setCentroCreadoIdRevision] = useState<string | null>(null);
  const [centroDocRevision, setCentroDocRevision] = useState<CentroDual | null>(null);
  const [maestroActivoIdx, setMaestroActivoIdx] = useState<number | null>(null);
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [errorRevision, setErrorRevision] = useState("");

  async function cargar() {
    if (!usuario || !id) return;
    setLoading(true);
    const snapCampania = await getDoc(doc(db, "campanias_invitacion", id));
    if (!snapCampania.exists()) {
      setNoEncontrada(true);
      setLoading(false);
      return;
    }
    const c = { id: snapCampania.id, ...snapCampania.data() } as CampaniaInvitacionEmpresa;
    setCampania(c);

    const [snapResp, snapEsp] = await Promise.all([
      getDocs(query(collection(db, "respuestas_campania"), where("campaniaId", "==", id))),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", c.liceoId))),
    ]);
    const lista = snapResp.docs.map((d) => ({ id: d.id, ...d.data() } as RespuestaCampaniaEmpresa));
    lista.sort((a, b) => a.numero - b.numero);
    setRespuestas(lista);
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const res = await fetch(`/api/campanias/${id}/duplicados`, { headers: { Authorization: `Bearer ${token}` } });
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

  const centroIdParaMaestros = centroCreadoIdRevision ?? (respuestaRevisar ? duplicados[respuestaRevisar.id]?.id ?? null : null);

  useEffect(() => {
    if (!centroIdParaMaestros) {
      setCentroDocRevision(null);
      return;
    }
    getDoc(doc(db, "centros_duales", centroIdParaMaestros)).then((snap) => {
      setCentroDocRevision(snap.exists() ? ({ id: snap.id, ...snap.data() } as CentroDual) : null);
    });
  }, [centroIdParaMaestros]);

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

  async function autorellenarUno(r: RespuestaCampaniaEmpresa): Promise<void> {
    const token = await auth.currentUser?.getIdToken();
    const resCentro = await fetch(`/api/campanias/${id}/respuestas/${r.id}/autorellenar-centro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        valores: valoresCentroDesdeRespuesta(r),
        especialidades: r.capacidad.especialidades ?? [],
        areas: r.caracteristicas.areasDesempeno ?? [],
        caracteristicas: r.caracteristicas.ambiente ?? [],
        habilidades: r.caracteristicas.habilidadesValoradas ?? [],
      }),
    });
    const dataCentro = await resCentro.json();
    if (!resCentro.ok) {
      setRespuestas((lista) => lista.map((x) => (x.id === r.id ? { ...x, estado: "error", errorDetalle: dataCentro.error } : x)));
      return;
    }
    setRespuestas((lista) => lista.map((x) => (x.id === r.id ? { ...x, estado: "traspasado", centroDualIdResultado: dataCentro.centroDualId } : x)));

    for (const m of r.maestrosGuia) {
      await fetch(`/api/campanias/${id}/respuestas/${r.id}/autorellenar-maestro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ centroDualId: dataCentro.centroDualId, valores: valoresMaestroDesdeRespuesta(m), especialidades: [], areas: [] }),
      });
    }
  }

  async function traspasar(ids: string[]) {
    if (procesando || ids.length === 0) return;
    setProcesando(true);
    setErrorGeneral("");
    setProgreso({ hechos: 0, total: ids.length });
    try {
      const items = ids.map((rid) => respuestas.find((r) => r.id === rid)).filter((r): r is RespuestaCampaniaEmpresa => !!r);
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
    const res = await fetch(`/api/campanias/${id}/respuestas/${respuestaId}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado }),
    });
    if (res.ok) {
      setRespuestas((lista) => lista.map((r) => (r.id === respuestaId ? { ...r, estado } : r)));
    }
  }

  async function guardarCentroRevision(valores: CentroDualFormValues, especialidadesSel: string[], areas: string[], caracteristicas: string[], habilidades: string[]) {
    if (!respuestaRevisar || guardandoRevision) return;
    setGuardandoRevision(true);
    setErrorRevision("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const centroExistente = duplicados[respuestaRevisar.id];
      const res = await fetch(`/api/campanias/${id}/respuestas/${respuestaRevisar.id}/autorellenar-centro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ centroDualIdExistente: centroExistente?.id, valores, especialidades: especialidadesSel, areas, caracteristicas, habilidades }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorRevision(data.error ?? "No fue posible guardar el centro dual.");
        return;
      }
      setRespuestas((lista) => lista.map((r) => (r.id === respuestaRevisar.id ? { ...r, estado: "traspasado", centroDualIdResultado: data.centroDualId } : r)));
      setCentroCreadoIdRevision(data.centroDualId);
      if (respuestaRevisar.maestrosGuia.length === 0) setRespuestaRevisar(null);
    } catch (err) {
      setErrorRevision(err instanceof Error ? err.message : "No fue posible conectar con el servidor.");
    } finally {
      setGuardandoRevision(false);
    }
  }

  async function guardarMaestroRevision(valores: MaestroGuiaFormValues, centroDualId: string, especialidadesSel: string[], areas: string[]) {
    if (!respuestaRevisar || maestroActivoIdx === null || guardandoRevision) return;
    setGuardandoRevision(true);
    setErrorRevision("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/campanias/${id}/respuestas/${respuestaRevisar.id}/autorellenar-maestro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ centroDualId, valores, especialidades: especialidadesSel, areas }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorRevision(data.error ?? "No fue posible guardar el maestro guía.");
        return;
      }
      const esUltimo = maestroActivoIdx === respuestaRevisar.maestrosGuia.length - 1;
      setMaestroActivoIdx(esUltimo ? null : maestroActivoIdx + 1);
      if (esUltimo) setRespuestaRevisar(null);
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
          <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} /> Volver a Agregar centro
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
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">#{r.numero} — {r.empresa.razonSocial}</p>
                        <span style={{ color: ESTADO_COLOR[r.estado], background: `${ESTADO_COLOR[r.estado]}22` }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                          {ESTADO_LABEL[r.estado]}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                        {r.empresa.rut || "Sin RUT"} · Maestro guía: {r.maestrosGuia.map((m) => m.nombres).join(", ") || "—"}
                      </p>
                      {duplicado && r.estado !== "traspasado" && (
                        <p style={{ color: "var(--warning)" }} className="text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} /> Ya existe: {duplicado.nombre} — requiere revisión individual
                        </p>
                      )}
                      {r.estado === "error" && r.errorDetalle && (
                        <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{r.errorDetalle}</p>
                      )}
                      {r.estado === "traspasado" && r.centroDualIdResultado && (
                        <p style={{ color: "var(--success)" }} className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Listo{duplicado ? " — se actualizó el registro existente" : ""}</span>
                          <Link href={`/dashboard/centros/${r.centroDualIdResultado}`} style={{ color: "var(--accent-light)" }} className="inline-flex items-center gap-1 hover:underline">
                            <Eye size={12} /> Ver centro
                          </Link>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {duplicado && r.estado !== "traspasado" && (
                        <button onClick={() => { setRespuestaRevisar(r); setCentroCreadoIdRevision(null); setMaestroActivoIdx(null); }} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold">
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

      {respuestaRevisar && maestroActivoIdx === null && !centroCreadoIdRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">Actualizar centro dual existente</h2>
              <button onClick={() => setRespuestaRevisar(null)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorRevision && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorRevision}</p>
              </div>
            )}
            <CentroDualForm
              modo="editar"
              valoresIniciales={valoresCentroDesdeRespuesta(respuestaRevisar)}
              especialidadesIniciales={respuestaRevisar.capacidad.especialidades ?? []}
              areasIniciales={respuestaRevisar.caracteristicas.areasDesempeno ?? []}
              caracteristicasIniciales={respuestaRevisar.caracteristicas.ambiente ?? []}
              habilidadesIniciales={respuestaRevisar.caracteristicas.habilidadesValoradas ?? []}
              especialidadesDisponibles={especialidades}
              rutsOcupados={[]}
              guardando={guardandoRevision}
              onCancelar={() => setRespuestaRevisar(null)}
              onGuardar={guardarCentroRevision}
            />
          </div>
        </div>
      )}

      {respuestaRevisar && centroCreadoIdRevision && maestroActivoIdx === null && respuestaRevisar.maestrosGuia.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">Centro actualizado. Ahora completa a su Maestro Guía.</p>
            <button onClick={() => setMaestroActivoIdx(0)} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-full py-2.5 rounded-xl text-sm font-semibold">
              Continuar con Maestro Guía
            </button>
          </div>
        </div>
      )}

      {respuestaRevisar && maestroActivoIdx !== null && centroDocRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold">Maestro Guía {maestroActivoIdx + 1} de {respuestaRevisar.maestrosGuia.length}</h2>
              <button onClick={() => setRespuestaRevisar(null)} style={{ color: "var(--text-muted)" }} className="text-xs">Cerrar</button>
            </div>
            {errorRevision && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
                <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorRevision}</p>
              </div>
            )}
            <MaestroGuiaForm
              modo="crear"
              valoresIniciales={valoresMaestroDesdeRespuesta(respuestaRevisar.maestrosGuia[maestroActivoIdx])}
              centrosDisponibles={[centroDocRevision]}
              centroFijo={centroDocRevision}
              especialidadesIniciales={[]}
              areasIniciales={[]}
              especialidadesDisponibles={especialidades}
              rutsOcupadosPorCentro={[]}
              guardando={guardandoRevision}
              onCancelar={() => setRespuestaRevisar(null)}
              onGuardar={(valores, centroDualId, especialidadesSel, areas) => guardarMaestroRevision(valores, centroDualId, especialidadesSel, areas)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
