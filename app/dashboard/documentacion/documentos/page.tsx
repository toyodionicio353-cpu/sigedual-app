"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Usuario } from "@/types";

// ─── Variables/constantes disponibles para insertar en un documento ──
const VARIABLES: { token: string; label: string }[] = [
  { token: "nombre_estudiante", label: "Nombre del estudiante" },
  { token: "run_estudiante", label: "RUN del estudiante" },
  { token: "curso", label: "Curso" },
  { token: "fecha", label: "Fecha actual" },
];

// ─── Tipos ───────────────────────────────────────────────────────────
interface DocumentoGuardado {
  id: string;
  titulo: string;
  contenido: string;
  colorTag: string;
  formatoId?: string;
  liceoId: string;
  creadoPorUid: string;
  creadoPorNombre: string;
  creadoEn?: any;
  actualizadoEn?: any;
}

interface Formato {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  icono: string;
  contenido: string;
}

// ─── Formatos base (plantillas institucionales) ─────────────────────
const FORMATOS: Formato[] = [
  {
    id: "convenio",
    nombre: "Convenio de Formación Dual",
    descripcion: "Acuerdo formal entre el liceo y la empresa colaboradora.",
    color: "#2563EB",
    icono: "fa-handshake",
    contenido: `<h1>CONVENIO DE FORMACIÓN DUAL</h1><p><strong>Entre</strong> el Liceo Técnico y la Empresa ______________, se acuerda lo siguiente:</p><p>1. Objeto del convenio.</p><p>2. Duración de la práctica dual.</p><p>3. Obligaciones del estudiante.</p><p>4. Obligaciones de la empresa.</p><p>5. Obligaciones del establecimiento educacional.</p><p>Firman en señal de conformidad las partes involucradas.</p>`,
  },
  {
    id: "informe-visita",
    nombre: "Informe de Visita",
    descripcion: "Registro de seguimiento en el centro de práctica.",
    color: "#38BDF8",
    icono: "fa-clipboard-list",
    contenido: `<h1>INFORME DE VISITA</h1><p><strong>Fecha:</strong> __/__/____</p><p><strong>Estudiante:</strong> ______________</p><p><strong>Empresa:</strong> ______________</p><p><strong>Observaciones generales:</strong></p><p>______________________________________________</p><p><strong>Compromisos y acuerdos:</strong></p><p>______________________________________________</p>`,
  },
  {
    id: "evaluacion",
    nombre: "Evaluación del Estudiante",
    descripcion: "Pauta de evaluación del desempeño en la práctica.",
    color: "#8B5CF6",
    icono: "fa-star",
    contenido: `<h1>EVALUACIÓN DEL ESTUDIANTE</h1><p><strong>Estudiante:</strong> ______________</p><p><strong>Período evaluado:</strong> ______________</p><p><strong>Criterios:</strong></p><p>- Puntualidad y asistencia</p><p>- Responsabilidad</p><p>- Competencias técnicas</p><p>- Trabajo en equipo</p><p><strong>Observaciones del maestro guía:</strong></p><p>______________________________________________</p>`,
  },
  {
    id: "bitacora",
    nombre: "Bitácora de Formación",
    descripcion: "Registro diario de actividades del estudiante.",
    color: "#22C55E",
    icono: "fa-book",
    contenido: `<h1>BITÁCORA DE FORMACIÓN</h1><p><strong>Semana del:</strong> __/__/____ al __/__/____</p><p><strong>Lunes:</strong> ______________</p><p><strong>Martes:</strong> ______________</p><p><strong>Miércoles:</strong> ______________</p><p><strong>Jueves:</strong> ______________</p><p><strong>Viernes:</strong> ______________</p>`,
  },
  {
    id: "registro-empresa",
    nombre: "Registro de Empresa",
    descripcion: "Ficha de datos de la empresa colaboradora.",
    color: "#F59E0B",
    icono: "fa-building",
    contenido: `<h1>REGISTRO DE EMPRESA</h1><p><strong>Razón social:</strong> ______________</p><p><strong>RUT:</strong> ______________</p><p><strong>Dirección:</strong> ______________</p><p><strong>Rubro:</strong> ______________</p><p><strong>Maestro guía asignado:</strong> ______________</p><p><strong>Contacto:</strong> ______________</p>`,
  },
];

function formatearFecha(ts: any): string {
  try {
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function textoPlano(html: string, max = 220): string {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!div) return "";
  div.innerHTML = html;
  return (div.textContent || "").slice(0, max);
}

// ─── Miniatura tipo hoja ─────────────────────────────────────────────
function MiniaturaHoja({ titulo, colorTag, textoPreview }: { titulo: string; colorTag: string; textoPreview: string }) {
  const lineas = (textoPreview || "").split(/\s+/).filter(Boolean);
  return (
    <div className="doc-preview">
      <div className="doc-preview-topbar" style={{ background: colorTag }} />
      <div className="doc-preview-page">
        <p className="doc-preview-title">{titulo || "Sin título"}</p>
        <div className="doc-preview-rule" />
        {[0, 1, 2].map(i => (
          <div key={i} className="doc-preview-line" style={{ width: `${86 - i * 14}%` }} />
        ))}
        <div className="doc-preview-table">
          <span /><span /><span />
        </div>
        {lineas.length === 0 && <p className="doc-preview-empty">Documento vacío</p>}
      </div>
    </div>
  );
}

// ─── Modal de confirmación ────────────────────────────────────────────
function ConfirmarEliminar({ titulo, onCancelar, onConfirmar }: { titulo: string; onCancelar: () => void; onConfirmar: () => void }) {
  return (
    <div className="doc-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div className="doc-modal">
        <div className="doc-modal-icon"><i className="fa-solid fa-trash" /></div>
        <p className="doc-modal-title">¿Eliminar este documento?</p>
        <p className="doc-modal-sub">“{titulo || "Sin título"}” se eliminará de forma permanente.</p>
        <div className="doc-modal-actions">
          <button className="doc-btn doc-btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="doc-btn doc-btn-danger" onClick={onConfirmar}>
            <i className="fa-solid fa-trash" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: generar un documento por cada estudiante de un curso ─────
function GenerarPorCursoModal({
  usuario, onCancelar, onGenerar,
}: {
  usuario: Usuario;
  onCancelar: () => void;
  onGenerar: (curso: string, estudiantes: { nombres: string; apellidos: string; run: string; curso: string }[]) => Promise<void>;
}) {
  const [cargando, setCargando] = useState(true);
  const [todos, setTodos] = useState<{ nombres: string; apellidos: string; run: string; curso: string }[]>([]);
  const [cursoSel, setCursoSel] = useState("");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId ?? "default")));
      setTodos(snap.docs.map(d => d.data() as any));
      setCargando(false);
    })();
  }, [usuario]);

  const cursos = useMemo(() => [...new Set(todos.map(e => e.curso).filter(Boolean))].sort(), [todos]);
  const cantidad = useMemo(() => todos.filter(e => e.curso === cursoSel).length, [todos, cursoSel]);

  async function confirmar() {
    if (!cursoSel) return;
    setGenerando(true);
    await onGenerar(cursoSel, todos.filter(e => e.curso === cursoSel));
    setGenerando(false);
  }

  return (
    <div className="doc-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div className="doc-modal doc-modal-wide">
        <div className="doc-modal-icon"><i className="fa-solid fa-users" /></div>
        <p className="doc-modal-title">Generar documento por curso</p>
        <p className="doc-modal-sub">Se creará una copia de este documento por cada estudiante del curso elegido, reemplazando las variables como [nombre_estudiante].</p>

        {cargando ? (
          <p className="doc-modal-sub"><i className="fa-solid fa-circle-notch fa-spin" /> Cargando cursos…</p>
        ) : cursos.length === 0 ? (
          <p className="doc-modal-sub">No hay estudiantes registrados con curso asignado.</p>
        ) : (
          <>
            <select className="doc-select" value={cursoSel} onChange={e => setCursoSel(e.target.value)}>
              <option value="">Selecciona un curso…</option>
              {cursos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {cursoSel && (
              <p className="doc-modal-hint">
                <i className="fa-solid fa-circle-info" /> Se generarán {cantidad} documento{cantidad === 1 ? "" : "s"}.
              </p>
            )}
          </>
        )}

        <div className="doc-modal-actions">
          <button className="doc-btn doc-btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="doc-btn doc-btn-primary" onClick={confirmar} disabled={!cursoSel || generando}>
            <i className={`fa-solid ${generando ? "fa-circle-notch fa-spin" : "fa-users"}`} /> {generando ? "Generando…" : "Generar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor de documento ──────────────────────────────────────────────
function Editor({
  activo, usuario, onVolver, onGuardado, onGenerarPorCurso,
}: {
  activo: DocumentoGuardado;
  usuario: Usuario;
  onVolver: () => void;
  onGuardado: (id: string, titulo: string, contenido: string) => void;
  onGenerarPorCurso: (titulo: string, contenido: string, colorTag: string, curso: string, estudiantes: { nombres: string; apellidos: string; run: string; curso: string }[]) => Promise<number>;
}) {
  const [titulo, setTitulo] = useState(activo.titulo);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [menuVariables, setMenuVariables] = useState(false);
  const [modalCurso, setModalCurso] = useState(false);
  const [generadoOk, setGeneradoOk] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (contentRef.current) contentRef.current.innerHTML = activo.contenido || "<p><br/></p>";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo.id]);

  async function guardar() {
    setGuardando(true);
    const contenido = contentRef.current?.innerHTML ?? activo.contenido;
    await onGuardado(activo.id, titulo, contenido);
    dirty.current = false;
    setGuardando(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 1600);
  }

  async function volver() {
    if (dirty.current) await guardar();
    onVolver();
  }

  function exec(cmd: string) {
    document.execCommand(cmd);
    contentRef.current?.focus();
  }

  function imprimir() {
    window.print();
  }

  function insertarVariable(token: string) {
    contentRef.current?.focus();
    document.execCommand("insertText", false, `[${token}]`);
    dirty.current = true;
    setMenuVariables(false);
  }

  async function generarPorCurso(curso: string, estudiantes: { nombres: string; apellidos: string; run: string; curso: string }[]) {
    const contenidoActual = contentRef.current?.innerHTML ?? activo.contenido;
    const n = await onGenerarPorCurso(titulo, contenidoActual, activo.colorTag || "#2563EB", curso, estudiantes);
    setModalCurso(false);
    setGeneradoOk(n);
    setTimeout(() => setGeneradoOk(null), 2400);
  }

  return (
    <div>
      <div className="doc-editor-toolbar no-print">
        <button className="doc-btn doc-btn-ghost" onClick={volver}>
          <i className="fa-solid fa-arrow-left" /> Volver
        </button>
        <div className="doc-editor-toolbar-fmt">
          <button className="doc-fmt-btn" onMouseDown={e => { e.preventDefault(); exec("bold"); }}><i className="fa-solid fa-bold" /></button>
          <button className="doc-fmt-btn" onMouseDown={e => { e.preventDefault(); exec("italic"); }}><i className="fa-solid fa-italic" /></button>
          <button className="doc-fmt-btn" onMouseDown={e => { e.preventDefault(); exec("underline"); }}><i className="fa-solid fa-underline" /></button>
          <button className="doc-fmt-btn" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><i className="fa-solid fa-list-ul" /></button>
        </div>

        <div className="doc-variables-wrap">
          <button className="doc-btn doc-btn-ghost" onClick={() => setMenuVariables(v => !v)}>
            <i className="fa-solid fa-code" /> Constantes
          </button>
          {menuVariables && (
            <div className="doc-variables-menu">
              {VARIABLES.map(v => (
                <button key={v.token} className="doc-variables-item" onMouseDown={e => { e.preventDefault(); insertarVariable(v.token); }}>
                  <span className="doc-variables-token">[{v.token}]</span>
                  <span className="doc-variables-label">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="doc-btn doc-btn-ghost" onClick={() => setModalCurso(true)}>
          <i className="fa-solid fa-users" /> Generar por curso
        </button>

        <div style={{ flex: 1 }} />
        {guardadoOk && <span className="doc-saved-tag"><i className="fa-solid fa-circle-check" /> Guardado</span>}
        {generadoOk !== null && (
          <span className="doc-saved-tag"><i className="fa-solid fa-circle-check" /> {generadoOk} documento{generadoOk === 1 ? "" : "s"} generado{generadoOk === 1 ? "" : "s"}</span>
        )}
        <button className="doc-btn doc-btn-ghost" onClick={guardar} disabled={guardando}>
          <i className={`fa-solid ${guardando ? "fa-circle-notch fa-spin" : "fa-floppy-disk"}`} /> Guardar
        </button>
        <button className="doc-btn doc-btn-primary" onClick={imprimir}>
          <i className="fa-solid fa-print" /> Imprimir
        </button>
      </div>

      <div className="doc-editor-sheet-wrap">
        <div className="print-area doc-editor-sheet">
          <input
            className="doc-editor-title"
            value={titulo}
            onChange={e => { setTitulo(e.target.value); dirty.current = true; }}
            placeholder="Título del documento"
          />
          <div
            ref={contentRef}
            className="doc-editor-content"
            contentEditable
            suppressContentEditableWarning
            onInput={() => { dirty.current = true; }}
          />
        </div>
      </div>

      {modalCurso && (
        <GenerarPorCursoModal
          usuario={usuario}
          onCancelar={() => setModalCurso(false)}
          onGenerar={generarPorCurso}
        />
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────
export default function DocumentosPage() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<"guardados" | "formatos">("guardados");
  const [documentos, setDocumentos] = useState<DocumentoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<"reciente" | "alfabetico">("reciente");
  const [activo, setActivo] = useState<DocumentoGuardado | null>(null);
  const [aEliminar, setAEliminar] = useState<DocumentoGuardado | null>(null);

  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db, "documentos"), where("liceoId", "==", usuario.liceoId ?? "default"));
    const unsub = onSnapshot(q, snap => {
      setDocumentos(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setCargando(false);
    }, () => setCargando(false));
    return () => unsub();
  }, [usuario]);

  const listaFiltrada = useMemo(() => {
    let lista = documentos.filter(d => d.titulo?.toLowerCase().includes(busqueda.toLowerCase()));
    lista = lista.slice().sort((a, b) => {
      if (orden === "alfabetico") return (a.titulo || "").localeCompare(b.titulo || "");
      const ta = a.actualizadoEn?.toMillis ? a.actualizadoEn.toMillis() : 0;
      const tb = b.actualizadoEn?.toMillis ? b.actualizadoEn.toMillis() : 0;
      return tb - ta;
    });
    return lista;
  }, [documentos, busqueda, orden]);

  async function crearDocumentoNuevo() {
    if (!usuario) return;
    const ref = await addDoc(collection(db, "documentos"), {
      titulo: "Nuevo documento",
      contenido: "<p><br/></p>",
      colorTag: "#2563EB",
      liceoId: usuario.liceoId ?? "default",
      creadoPorUid: usuario.uid,
      creadoPorNombre: usuario.nombre,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    });
    setActivo({
      id: ref.id, titulo: "Nuevo documento", contenido: "<p><br/></p>", colorTag: "#2563EB",
      liceoId: usuario.liceoId ?? "default", creadoPorUid: usuario.uid, creadoPorNombre: usuario.nombre,
    });
  }

  async function usarFormato(f: Formato) {
    if (!usuario) return;
    const titulo = `${f.nombre} — Nueva copia`;
    const ref = await addDoc(collection(db, "documentos"), {
      titulo,
      contenido: f.contenido,
      colorTag: f.color,
      formatoId: f.id,
      liceoId: usuario.liceoId ?? "default",
      creadoPorUid: usuario.uid,
      creadoPorNombre: usuario.nombre,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    });
    setActivo({
      id: ref.id, titulo, contenido: f.contenido, colorTag: f.color, formatoId: f.id,
      liceoId: usuario.liceoId ?? "default", creadoPorUid: usuario.uid, creadoPorNombre: usuario.nombre,
    });
  }

  async function guardarCambios(id: string, titulo: string, contenido: string) {
    await updateDoc(doc(db, "documentos", id), { titulo, contenido, actualizadoEn: serverTimestamp() });
  }

  function reemplazarVariables(html: string, e: { nombres: string; apellidos: string; run: string; curso: string }): string {
    const hoy = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
    return html
      .replaceAll("[nombre_estudiante]", `${e.nombres ?? ""} ${e.apellidos ?? ""}`.trim())
      .replaceAll("[run_estudiante]", e.run ?? "")
      .replaceAll("[curso]", e.curso ?? "")
      .replaceAll("[fecha]", hoy);
  }

  async function generarPorCurso(
    tituloBase: string, contenidoBase: string, colorTag: string, curso: string,
    estudiantes: { nombres: string; apellidos: string; run: string; curso: string }[],
  ): Promise<number> {
    if (!usuario) return 0;
    for (const e of estudiantes) {
      const nombreCompleto = `${e.nombres ?? ""} ${e.apellidos ?? ""}`.trim();
      await addDoc(collection(db, "documentos"), {
        titulo: `${tituloBase} — ${nombreCompleto}`,
        contenido: reemplazarVariables(contenidoBase, e),
        colorTag,
        liceoId: usuario.liceoId ?? "default",
        creadoPorUid: usuario.uid,
        creadoPorNombre: usuario.nombre,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });
    }
    return estudiantes.length;
  }

  async function eliminar(d: DocumentoGuardado) {
    await deleteDoc(doc(db, "documentos", d.id));
    setAEliminar(null);
    if (activo?.id === d.id) setActivo(null);
  }

  function imprimirDesdeCard(d: DocumentoGuardado) {
    setActivo(d);
    setTimeout(() => window.print(), 150);
  }

  // ── Vista editor ──
  if (activo && usuario) {
    return (
      <div className="doc-root">
        <style dangerouslySetInnerHTML={{ __html: DOC_STYLES }} />
        <Editor
          activo={activo}
          usuario={usuario}
          onVolver={() => setActivo(null)}
          onGuardado={async (id, titulo, contenido) => {
            await guardarCambios(id, titulo, contenido);
            setDocumentos(prev => prev.map(d => d.id === id ? { ...d, titulo, contenido } : d));
          }}
          onGenerarPorCurso={generarPorCurso}
        />
      </div>
    );
  }

  // ── Vista principal (grilla) ──
  return (
    <div className="doc-root no-print">
      <style dangerouslySetInnerHTML={{ __html: DOC_STYLES }} />

      <div className="doc-header">
        <div className="doc-header-title">
          <i className="fa-solid fa-folder-open" />
          <div>
            <h1>Documentación</h1>
            <p>Centro de gestión documental de SIGEDUAL</p>
          </div>
        </div>
        {tab === "guardados" && (
          <button className="doc-btn doc-btn-primary" onClick={crearDocumentoNuevo}>
            <i className="fa-solid fa-file-circle-plus" /> Crear documento
          </button>
        )}
      </div>

      <div className="doc-tabbar">
        <button className={`doc-tab ${tab === "guardados" ? "active" : ""}`} onClick={() => setTab("guardados")}>
          <i className="fa-solid fa-file-lines" /> Guardados
        </button>
        <button className={`doc-tab ${tab === "formatos" ? "active" : ""}`} onClick={() => setTab("formatos")}>
          <i className="fa-solid fa-layer-group" /> Formatos
        </button>
      </div>

      {tab === "guardados" && (
        <>
          <div className="doc-toolbar">
            <div className="doc-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input placeholder="Buscar documentos..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <button className="doc-order-btn" onClick={() => setOrden(o => o === "reciente" ? "alfabetico" : "reciente")}>
              <i className={`fa-solid ${orden === "reciente" ? "fa-arrow-down-wide-short" : "fa-arrow-down-a-z"}`} />
              {orden === "reciente" ? "Más reciente" : "Alfabético"}
            </button>
          </div>

          {cargando ? (
            <div className="doc-empty"><i className="fa-solid fa-circle-notch fa-spin" /><p>Cargando documentos…</p></div>
          ) : listaFiltrada.length === 0 ? (
            <div className="doc-empty">
              <div className="doc-empty-icon"><i className="fa-solid fa-file-lines" /></div>
              <p className="doc-empty-title">No tienes documentos guardados</p>
              <p className="doc-empty-sub">Los documentos que crees o utilices desde un formato aparecerán aquí.</p>
              <button className="doc-btn doc-btn-primary" onClick={crearDocumentoNuevo}>
                <i className="fa-solid fa-file-circle-plus" /> Crear documento
              </button>
            </div>
          ) : (
            <div className="doc-grid">
              {listaFiltrada.map(d => (
                <div key={d.id} className="doc-card" onClick={() => setActivo(d)}>
                  <MiniaturaHoja titulo={d.titulo} colorTag={d.colorTag || "#2563EB"} textoPreview={textoPlano(d.contenido)} />
                  <div className="doc-card-body">
                    <p className="doc-card-title" title={d.titulo}>{d.titulo || "Sin título"}</p>
                    <p className="doc-card-date">Modificado: {formatearFecha(d.actualizadoEn)}</p>
                    <div className="doc-card-actions">
                      <button className="doc-card-action" onClick={e => { e.stopPropagation(); imprimirDesdeCard(d); }}>
                        <i className="fa-solid fa-print" /> Imprimir
                      </button>
                      <button className="doc-card-action danger" onClick={e => { e.stopPropagation(); setAEliminar(d); }}>
                        <i className="fa-solid fa-trash" /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "formatos" && (
        <div className="doc-grid">
          {FORMATOS.map(f => (
            <div key={f.id} className="doc-card">
              <MiniaturaHoja titulo={f.nombre} colorTag={f.color} textoPreview={textoPlano(f.contenido)} />
              <div className="doc-card-body">
                <p className="doc-card-title">{f.nombre}</p>
                <p className="doc-card-desc">{f.descripcion}</p>
                <div className="doc-card-actions">
                  <button className="doc-btn doc-btn-primary doc-btn-full" onClick={() => usarFormato(f)}>
                    <i className="fa-solid fa-file-circle-plus" /> Usar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {aEliminar && (
        <ConfirmarEliminar
          titulo={aEliminar.titulo}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={() => eliminar(aEliminar)}
        />
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────
const DOC_STYLES = `
.doc-root { padding: 28px 32px 60px; font-family: 'Inter', sans-serif; }
.doc-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
.doc-header-title { display: flex; align-items: center; gap: 14px; }
.doc-header-title > i { font-size: 22px; color: var(--accent-blue-light); background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.3); width: 46px; height: 46px; border-radius: 12px; display:flex; align-items:center; justify-content:center; }
.doc-header-title h1 { font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0; }
.doc-header-title p { font-size: 12.5px; color: var(--text-muted); margin: 2px 0 0; }

.doc-tabbar { display: flex; gap: 20px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
.doc-tab { display: flex; align-items: center; gap: 10px; padding: 14px 26px; background: transparent; border: none; color: var(--text-muted); font-size: 15.5px; font-weight: 700; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; transition: color .15s, border-color .15s, background .15s; border-radius: 10px 10px 0 0; font-family: inherit; }
.doc-tab i { font-size: 15px; }
.doc-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.03); }
.doc-tab.active { color: var(--accent-blue-light); border-bottom-color: var(--accent-blue-light); background: rgba(37,99,235,0.08); }

.doc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.doc-search { display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 9px 14px; flex: 1; min-width: 220px; max-width: 640px; }
.doc-search i { color: var(--text-muted); font-size: 13px; }
.doc-search input { background: none; border: none; outline: none; color: var(--text-primary); font-size: 13px; width: 100%; font-family: inherit; }
.doc-order-btn { display:flex; align-items:center; gap:8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 9px 14px; color: var(--text-secondary); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: border-color .15s, color .15s; }
.doc-order-btn:hover { border-color: var(--border-light); color: var(--text-primary); }

.doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
.doc-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; cursor: pointer; transition: transform .15s, border-color .15s, box-shadow .15s; display: flex; flex-direction: column; }
.doc-card:hover { border-color: var(--accent-blue-light); transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.28); }

.doc-preview { background: var(--bg-surface); padding: 14px; }
.doc-preview-topbar { height: 4px; border-radius: 3px; margin-bottom: 10px; opacity: .85; }
.doc-preview-page { background: #f8fafc; border-radius: 6px; padding: 12px 12px 14px; aspect-ratio: 3/4; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
.doc-preview-title { font-size: 10px; font-weight: 800; color: #1e293b; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-preview-rule { height: 2px; background: #cbd5e1; margin: 2px 0 4px; }
.doc-preview-line { height: 5px; background: #cbd5e1; border-radius: 2px; }
.doc-preview-table { display: flex; gap: 4px; margin-top: auto; }
.doc-preview-table span { flex: 1; height: 16px; background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 2px; }
.doc-preview-empty { font-size: 9px; color: #94a3b8; margin-top: auto; }

.doc-card-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px; }
.doc-card-title { font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-card-date { font-size: 11.5px; color: var(--text-muted); margin: 0 0 8px; }
.doc-card-desc { font-size: 11.5px; color: var(--text-muted); margin: 0 0 8px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.doc-card-actions { display: flex; gap: 8px; }
.doc-card-action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 8px; padding: 7px 0; color: var(--text-secondary); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s, color .15s, border-color .15s; }
.doc-card-action:hover { background: rgba(37,99,235,0.12); color: var(--accent-blue-light); border-color: rgba(37,99,235,0.35); }
.doc-card-action.danger:hover { background: rgba(239,68,68,0.12); color: var(--danger); border-color: rgba(239,68,68,0.35); }

.doc-btn { display: flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 9px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; border: 1px solid transparent; transition: background .15s, border-color .15s, opacity .15s; white-space: nowrap; }
.doc-btn:disabled { opacity: .6; cursor: not-allowed; }
.doc-btn-primary { background: var(--accent-blue); color: #fff; }
.doc-btn-primary:hover { background: var(--accent-blue-hover); }
.doc-btn-ghost { background: rgba(255,255,255,0.04); border-color: var(--border); color: var(--text-secondary); }
.doc-btn-ghost:hover { border-color: var(--border-light); color: var(--text-primary); }
.doc-btn-danger { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.4); color: var(--danger); }
.doc-btn-danger:hover { background: rgba(239,68,68,0.22); }
.doc-btn-full { width: 100%; justify-content: center; }

.doc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 70px 20px; color: var(--text-muted); gap: 6px; }
.doc-empty-icon { width: 54px; height: 54px; border-radius: 14px; background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--accent-blue-light); margin-bottom: 10px; }
.doc-empty-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.doc-empty-sub { font-size: 12.5px; color: var(--text-muted); margin: 0 0 16px; max-width: 320px; }

.doc-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 16px; }
.doc-modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 26px 28px; max-width: 360px; width: 100%; text-align: center; }
.doc-modal-icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); display: flex; align-items: center; justify-content: center; color: var(--danger); font-size: 18px; margin: 0 auto 14px; }
.doc-modal-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
.doc-modal-sub { font-size: 12.5px; color: var(--text-muted); margin: 0 0 20px; }
.doc-modal-actions { display: flex; gap: 10px; }
.doc-modal-actions .doc-btn { flex: 1; justify-content: center; }
.doc-modal-wide { max-width: 420px; }
.doc-modal-wide .doc-modal-icon { background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.35); color: var(--accent-blue-light); }
.doc-select { width: 100%; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; color: var(--text-primary); font-size: 13px; font-family: inherit; margin-bottom: 12px; cursor: pointer; }
.doc-modal-hint { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--accent-blue-light); background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.25); border-radius: 8px; padding: 8px 12px; margin: 0 0 18px; text-align: left; }

.doc-editor-toolbar { display: flex; align-items: center; gap: 10px; padding: 16px 32px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.doc-editor-toolbar-fmt { display: flex; gap: 4px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 4px; }
.doc-fmt-btn { width: 30px; height: 28px; border: none; background: transparent; color: var(--text-secondary); border-radius: 6px; cursor: pointer; font-size: 12px; }
.doc-fmt-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.doc-saved-tag { display: flex; align-items: center; gap: 6px; color: #22c55e; font-size: 12px; font-weight: 600; }

.doc-variables-wrap { position: relative; }
.doc-variables-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 6px; min-width: 240px; box-shadow: 0 12px 32px rgba(0,0,0,0.4); }
.doc-variables-item { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; background: none; border: none; border-radius: 7px; padding: 8px 10px; cursor: pointer; text-align: left; font-family: inherit; }
.doc-variables-item:hover { background: rgba(37,99,235,0.12); }
.doc-variables-token { font-size: 12.5px; font-weight: 700; color: var(--accent-blue-light); font-family: monospace; }
.doc-variables-label { font-size: 11px; color: var(--text-muted); }

.doc-editor-sheet-wrap { display: flex; justify-content: center; padding: 30px 20px 60px; }
.doc-editor-sheet { background: #ffffff; color: #111827; width: 100%; max-width: 780px; min-height: 70vh; border-radius: 8px; padding: 48px 56px; box-shadow: 0 10px 40px rgba(0,0,0,0.35); }
.doc-editor-title { width: 100%; border: none; outline: none; font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 18px; font-family: inherit; }
.doc-editor-content { min-height: 50vh; font-size: 14.5px; line-height: 1.7; color: #1e293b; outline: none; }
.doc-editor-content h1 { font-size: 20px; margin: 0 0 12px; }
.doc-editor-content p { margin: 0 0 10px; }

@media (max-width: 900px) { .doc-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } .doc-editor-sheet { padding: 30px 24px; } }
@media (max-width: 560px) { .doc-root { padding: 18px 16px 50px; } .doc-header { flex-direction: column; align-items: flex-start; } .doc-toolbar { flex-direction: column; align-items: stretch; } .doc-search { max-width: none; } }

@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
  .no-print { display: none !important; }
}
`;
