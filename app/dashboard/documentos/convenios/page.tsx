"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  PLANTILLA_ID, PLANTILLA_NOMBRE, CLAVE_A_ETIQUETA, FIRMAS_CONVENIO,
  plantillaConvenioAprendizaje, valoresDesdeEstudiante, valoresDesdeCentro, valoresDesdeLiceo,
} from "@/lib/convenio-aprendizaje";
import type { CentroDual, ConvenioParrafo, ConvenioRealizado, Especialidad, Estudiante, Liceo } from "@/types";
import { FileText, FolderCheck, Wand2, Save, X, Plus, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function ConveniosPage() {
  const { usuario } = useAuth();

  const [tab, setTab] = useState<"plantillas" | "realizados">("plantillas");
  const [vista, setVista] = useState<"lista" | "editor" | "ver">("lista");

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [realizados, setRealizados] = useState<ConvenioRealizado[]>([]);
  const [loading, setLoading] = useState(true);

  const [parrafos, setParrafos] = useState<ConvenioParrafo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [estudianteId, setEstudianteId] = useState("");
  const [centroDualId, setCentroDualId] = useState("");
  const [realizadoActivo, setRealizadoActivo] = useState<ConvenioRealizado | null>(null);

  const [modalRellenar, setModalRellenar] = useState(false);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [fechaConvenioTmp, setFechaConvenioTmp] = useState("");
  const [fechaInicioTmp, setFechaInicioTmp] = useState("");
  const [fechaTerminoTmp, setFechaTerminoTmp] = useState("");

  const [tokenEditando, setTokenEditando] = useState<string | null>(null);
  const [tokenValorTmp, setTokenValorTmp] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const [snapEst, snapEsp, snapCentros, snapConv, snapLiceo] = await Promise.all([
      getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId))),
      getDocs(query(collection(db, "convenios"), where("liceoId", "==", usuario.liceoId))),
      getDoc(doc(db, "liceos", usuario.liceoId)),
    ]);
    setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
    setRealizados(snapConv.docs.map((d) => ({ id: d.id, ...d.data() } as ConvenioRealizado)));
    if (snapLiceo.exists()) setLiceo({ id: snapLiceo.id, ...snapLiceo.data() } as Liceo);
    setLoading(false);
  }

  function abrirPlantilla() {
    setParrafos(plantillaConvenioAprendizaje());
    setValores(liceo ? valoresDesdeLiceo(liceo) : {});
    setEstudianteId("");
    setCentroDualId("");
    setAviso("");
    setVista("editor");
  }

  function verRealizado(r: ConvenioRealizado) {
    setRealizadoActivo(r);
    setVista("ver");
  }

  function volverALista() {
    setVista("lista");
    setRealizadoActivo(null);
  }

  const estudiantesFiltrados = useMemo(() => {
    if (!busquedaEstudiante.trim()) return estudiantes;
    const q = normalizar(busquedaEstudiante);
    return estudiantes.filter((e) => normalizar(`${e.nombres} ${e.apellidos} ${e.run}`).includes(q));
  }, [estudiantes, busquedaEstudiante]);

  function aplicarRellenoFicha() {
    let nuevos: Record<string, string> = {};
    const est = estudiantes.find((e) => e.id === estudianteId);
    const centro = centros.find((c) => c.id === centroDualId);
    if (est) nuevos = { ...nuevos, ...valoresDesdeEstudiante(est, especialidades) };
    if (centro) nuevos = { ...nuevos, ...valoresDesdeCentro(centro) };
    if (liceo) nuevos = { ...nuevos, ...valoresDesdeLiceo(liceo) };
    if (fechaConvenioTmp) nuevos.fechaConvenio = fechaConvenioTmp;
    if (fechaInicioTmp) nuevos.fechaInicioPractica = fechaInicioTmp;
    if (fechaTerminoTmp) nuevos.fechaTerminoPractica = fechaTerminoTmp;
    setValores((prev) => ({ ...prev, ...nuevos }));
    setModalRellenar(false);
  }

  function abrirEditorToken(clave: string) {
    setTokenEditando(clave);
    setTokenValorTmp(valores[clave] ?? "");
  }

  function guardarToken() {
    if (!tokenEditando) return;
    setValores((prev) => ({ ...prev, [tokenEditando]: tokenValorTmp }));
    setTokenEditando(null);
  }

  function actualizarTexto(parrafoId: string, indiceSegmento: number, valor: string) {
    setParrafos((prev) => prev.map((p) => {
      if (p.id !== parrafoId) return p;
      const segmentos = p.segmentos.map((s, i) => (i === indiceSegmento ? { ...s, valor } : s));
      return { ...p, segmentos };
    }));
  }

  function eliminarParrafo(parrafoId: string) {
    setParrafos((prev) => prev.filter((p) => p.id !== parrafoId));
  }

  function agregarClausula() {
    setParrafos((prev) => [...prev, { id: `clausula-${Date.now()}`, segmentos: [{ tipo: "texto", valor: "" }] }]);
  }

  async function guardarConvenio() {
    if (!usuario || !estudianteId || !centroDualId || guardando) return;
    const est = estudiantes.find((e) => e.id === estudianteId);
    const centro = centros.find((c) => c.id === centroDualId);
    if (!est || !centro) return;
    setGuardando(true);
    setAviso("");
    try {
      const parrafosResueltos: ConvenioParrafo[] = parrafos.map((p) => ({
        id: p.id,
        esTitulo: p.esTitulo,
        segmentos: p.segmentos.map((s) =>
          s.tipo === "token"
            ? { tipo: "texto" as const, valor: valores[s.valor] || `[${CLAVE_A_ETIQUETA[s.valor] ?? s.valor}]` }
            : s
        ),
      }));
      await addDoc(collection(db, "convenios"), {
        plantillaId: PLANTILLA_ID,
        plantillaNombre: PLANTILLA_NOMBRE,
        estudianteId: est.id,
        estudianteNombre: `${est.nombres} ${est.apellidos}`,
        centroDualId: centro.id,
        centroNombre: centro.nombre,
        liceoId: usuario.liceoId,
        parrafos: parrafosResueltos,
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      });
      setAviso("Convenio guardado exitosamente en Realizados.");
      await cargar();
      setTab("realizados");
      setVista("lista");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  // --- Vista: documento (editor de plantilla o visor de realizado) ---
  if (vista === "editor" || vista === "ver") {
    const parrafosVista = vista === "editor" ? parrafos : (realizadoActivo?.parrafos ?? []);
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <h1 style={{ color: "var(--text-primary)" }} className="text-2xl sm:text-3xl font-bold">
              {vista === "editor" ? PLANTILLA_NOMBRE : realizadoActivo?.plantillaNombre}
            </h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
              {vista === "editor"
                ? "Documento prueba — edita el texto libremente y rellena las variables."
                : `${realizadoActivo?.estudianteNombre} · ${realizadoActivo?.centroNombre}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={volverALista} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
              <ArrowLeft size={16} />
              Volver
            </button>
            {vista === "editor" && (
              <button onClick={() => setModalRellenar(true)} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                <Wand2 size={16} />
                Rellenar ficha
              </button>
            )}
          </div>
        </div>

        {vista === "editor" && (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 mb-4 text-xs" >
            <p style={{ color: "var(--text-secondary)" }}>
              {estudianteId && centroDualId
                ? <><span style={{ color: "var(--text-primary)" }} className="font-medium">Vinculado a: </span>{estudiantes.find((e) => e.id === estudianteId)?.nombres} {estudiantes.find((e) => e.id === estudianteId)?.apellidos} · {centros.find((c) => c.id === centroDualId)?.nombre}</>
                : "Aún no está vinculado a un estudiante ni centro dual. Usa \"Rellenar ficha\" para autocompletar las variables y poder guardarlo."}
            </p>
          </div>
        )}

        {aviso && (
          <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
            <p style={{ color: "var(--success)" }} className="text-sm font-medium">{aviso}</p>
          </div>
        )}

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
          <div className="flex flex-col gap-5">
            {parrafosVista.map((p) => (
              <div key={p.id} className="group relative">
                <p
                  style={{
                    color: "var(--text-primary)",
                    textAlign: p.esTitulo ? "center" : "justify",
                    fontWeight: p.esTitulo ? 700 : 400,
                    fontSize: p.esTitulo ? "1.15rem" : "0.875rem",
                    letterSpacing: p.esTitulo ? "0.02em" : undefined,
                    lineHeight: 1.7,
                  }}
                >
                  {p.segmentos.map((s, i) =>
                    s.tipo === "token" ? (
                      <button
                        key={i}
                        type="button"
                        disabled={vista !== "editor"}
                        onClick={() => abrirEditorToken(s.valor)}
                        style={{
                          background: "var(--accent)" + "22",
                          color: "var(--accent-light)",
                          border: "1px solid " + "var(--accent)" + "55",
                        }}
                        className="inline-flex mx-0.5 px-1.5 py-0.5 rounded-md text-[13px] font-semibold align-baseline hover:opacity-80 transition-opacity disabled:cursor-default disabled:hover:opacity-100"
                      >
                        {valores[s.valor] || `[${CLAVE_A_ETIQUETA[s.valor] ?? s.valor}]`}
                      </button>
                    ) : vista === "editor" ? (
                      <span
                        key={i}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => actualizarTexto(p.id, i, e.currentTarget.textContent ?? "")}
                        style={{ outline: "none" }}
                        className="hover:[background:var(--hover-overlay)] rounded transition-colors"
                      >
                        {s.valor}
                      </span>
                    ) : (
                      <span key={i}>{s.valor}</span>
                    )
                  )}
                </p>
                {vista === "editor" && (
                  <button
                    onClick={() => eliminarParrafo(p.id)}
                    style={{ color: "var(--text-muted)" }}
                    className="absolute -right-1 -top-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:[color:var(--danger)] transition-opacity"
                    title="Eliminar párrafo"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}

            {vista === "editor" && (
              <button
                onClick={agregarClausula}
                style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-light)", color: "var(--text-secondary)" }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
              >
                <Plus size={14} />
                Agregar cláusula
              </button>
            )}
          </div>

          {/* Bloque de firmas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
            {FIRMAS_CONVENIO.map((f) => {
              const valorTexto = vista === "editor" ? valores[f.claveRut] : undefined;
              return (
                <div key={f.claveRut} className="text-center">
                  <div style={{ borderTop: "1px solid var(--text-muted)" }} className="mt-8 pt-2">
                    <p style={{ color: "var(--text-primary)" }} className="text-xs font-medium">{f.titulo}</p>
                    <button
                      type="button"
                      disabled={vista !== "editor"}
                      onClick={() => abrirEditorToken(f.claveRut)}
                      style={{ color: "var(--accent-light)" }}
                      className="text-xs mt-1 hover:opacity-80 transition-opacity disabled:cursor-default"
                    >
                      RUT: {vista === "editor" ? (valorTexto || `[${CLAVE_A_ETIQUETA[f.claveRut]}]`) : "—"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {vista === "editor" && (
          <div className="flex justify-end mt-6">
            <button
              onClick={guardarConvenio}
              disabled={!estudianteId || !centroDualId || guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              title={!estudianteId || !centroDualId ? "Usa \"Rellenar ficha\" para vincular un estudiante y un centro dual antes de guardar" : undefined}
            >
              <Save size={16} />
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}

        {/* Modal: Rellenar ficha */}
        {modalRellenar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">Rellenar ficha</h2>
                <button onClick={() => setModalRellenar(false)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estudiante</label>
                  <input
                    value={busquedaEstudiante}
                    onChange={(e) => setBusquedaEstudiante(e.target.value)}
                    placeholder="Buscar estudiante..."
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors mb-2"
                  />
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                    {estudiantesFiltrados.slice(0, 20).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEstudianteId(e.id)}
                        style={{
                          background: estudianteId === e.id ? "var(--accent)" : "var(--bg-surface)",
                          color: estudianteId === e.id ? "var(--text-on-accent)" : "var(--text-primary)",
                          border: `1px solid ${estudianteId === e.id ? "var(--accent)" : "var(--border)"}`,
                        }}
                        className="text-left px-3 py-2 rounded-lg text-xs transition-colors"
                      >
                        {e.nombres} {e.apellidos} <span style={{ opacity: 0.7 }}>· {e.run}</span>
                      </button>
                    ))}
                    {estudiantesFiltrados.length === 0 && (
                      <p style={{ color: "var(--text-muted)" }} className="text-xs px-1 py-2">Sin resultados.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centro dual / Empresa</label>
                  <select
                    value={centroDualId}
                    onChange={(e) => setCentroDualId(e.target.value)}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                  >
                    <option value="">Selecciona un centro dual</option>
                    {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha convenio</label>
                    <input type="date" value={fechaConvenioTmp} onChange={(e) => setFechaConvenioTmp(e.target.value)}
                      style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
                  </div>
                  <div>
                    <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Inicio práctica</label>
                    <input type="date" value={fechaInicioTmp} onChange={(e) => setFechaInicioTmp(e.target.value)}
                      style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
                  </div>
                  <div>
                    <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Término práctica</label>
                    <input type="date" value={fechaTerminoTmp} onChange={(e) => setFechaTerminoTmp(e.target.value)}
                      style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
                  </div>
                </div>

                <p style={{ color: "var(--text-muted)" }} className="text-xs">
                  El liceo, la comuna y el RUT del director se completan automáticamente desde los datos de tu liceo.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setModalRellenar(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={aplicarRellenoFicha} disabled={!estudianteId && !centroDualId} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">Aplicar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: editar valor de una variable */}
        {tokenEditando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-5 sm:p-6 shadow-2xl">
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold mb-1">Editar variable</h2>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">{CLAVE_A_ETIQUETA[tokenEditando] ?? tokenEditando}</p>
              <input
                autoFocus
                value={tokenValorTmp}
                onChange={(e) => setTokenValorTmp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardarToken()}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => setTokenEditando(null)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={guardarToken} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2 rounded-xl text-sm font-semibold">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Vista: lista (Plantillas / Realizados) ---
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Convenios</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Genera y consulta los convenios de aprendizaje de tus estudiantes.</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("plantillas")}
          style={{
            background: tab === "plantillas" ? "var(--accent)" : "var(--bg-card)",
            color: tab === "plantillas" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${tab === "plantillas" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <FileText size={16} />
          Plantillas
        </button>
        <button
          onClick={() => setTab("realizados")}
          style={{
            background: tab === "realizados" ? "var(--accent)" : "var(--bg-card)",
            color: tab === "realizados" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${tab === "realizados" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <FolderCheck size={16} />
          Realizados
          {realizados.length > 0 && (
            <span style={{ background: tab === "realizados" ? "var(--text-on-accent)" : "var(--accent)", color: tab === "realizados" ? "var(--accent)" : "var(--text-on-accent)" }} className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold">
              {realizados.length}
            </span>
          )}
        </button>
      </div>

      {tab === "plantillas" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={abrirPlantilla}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            className="rounded-2xl p-5 text-left hover:[border-color:var(--accent)] transition-colors"
          >
            <div style={{ background: "var(--accent)" + "22" }} className="w-10 h-10 rounded-xl flex items-center justify-center mb-3">
              <FileText size={18} style={{ color: "var(--accent-light)" }} />
            </div>
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Convenio de Aprendizaje</p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">Documento prueba</p>
          </button>
        </div>
      ) : realizados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Todavía no hay convenios realizados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Abre una plantilla, rellena la ficha con un estudiante y un centro dual, y guárdala.</p>
          <button onClick={() => setTab("plantillas")} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Ir a Plantillas
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {realizados
            .slice()
            .sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""))
            .map((r) => (
              <button
                key={r.id}
                onClick={() => verRealizado(r)}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                className="rounded-2xl p-4 flex items-center justify-between gap-3 text-left hover:[border-color:var(--accent)] transition-colors"
              >
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{r.plantillaNombre} — {r.estudianteNombre}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{r.centroNombre} · {r.creadoEn ? new Date(r.creadoEn).toLocaleDateString("es-CL") : ""}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
