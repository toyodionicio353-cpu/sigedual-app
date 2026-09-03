"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Search } from "lucide-react";
import type { DocumentoGenerado, Estudiante, SegmentoDocumento, TipoModuloDocumento } from "@/types";
import type { ContextoResolucion, PlantillaDocumento } from "@/types/plantillas";
import { resolverCamposEstudiante, resolverCamposDocumento, type ResultadoCampo } from "@/lib/plantillas/resolverCampos";
import { crearDocumento, actualizarDocumento, NOMBRE_DUPLICADO } from "@/lib/documentos/guardarDocumento";

const NOMBRE_MAX = 40;

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const FUENTE_CAMPO = "var(--font-sans), sans-serif";

function SegmentoCampoView({ resultado, etiqueta }: { resultado?: ResultadoCampo; etiqueta?: string }) {
  if (resultado?.valor) {
    return (
      <span style={{ color: "var(--accent-light)", fontFamily: FUENTE_CAMPO }} className="font-medium">
        {resultado.valor}
      </span>
    );
  }
  return (
    <span style={{ color: "var(--text-muted)", fontFamily: FUENTE_CAMPO }} className="italic text-[13px]">
      ({resultado?.mensajeAusente ?? `falta ${etiqueta ?? "este dato"}`})
    </span>
  );
}

function SegmentoEditableView({ texto, negrita, onCambio }: { texto: string; negrita?: boolean; onCambio: (t: string) => void }) {
  const [editando, setEditando] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (editando && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editando]);

  return (
    <span
      ref={ref}
      contentEditable={editando}
      suppressContentEditableWarning
      onDoubleClick={() => setEditando(true)}
      onBlur={(e) => { setEditando(false); onCambio(e.currentTarget.textContent ?? ""); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
        if (e.key === "Escape") { e.preventDefault(); setEditando(false); e.currentTarget.textContent = texto; }
      }}
      style={{
        touchAction: "manipulation",
        cursor: editando ? "text" : "pointer",
        outline: editando ? "1px dashed var(--accent)" : "none",
        background: editando ? "var(--hover-overlay)" : "transparent",
        borderBottom: !editando ? "1px dashed var(--border)" : "none",
        fontWeight: negrita ? 700 : undefined,
      }}
      className="rounded transition-colors"
    >
      {texto}
    </span>
  );
}

interface EditorDocumentoProps {
  tipoModulo: TipoModuloDocumento;
  liceoId: string;
  usuarioUid: string;
  contexto: ContextoResolucion;
  plantilla?: PlantillaDocumento;
  documentoExistente?: DocumentoGenerado;
  onGuardado: (id: string) => void;
  onCancelar: () => void;
}

export default function EditorDocumento({
  tipoModulo, liceoId, usuarioUid, contexto, plantilla, documentoExistente, onGuardado, onCancelar,
}: EditorDocumentoProps) {
  const esEdicion = Boolean(documentoExistente);
  const plantillaId = plantilla?.id ?? documentoExistente?.plantillaId ?? "";
  const requiereEstudiante = plantilla?.requiereEstudiante ?? Boolean(documentoExistente?.estudianteId);
  const camposRequeridos = plantilla?.camposRequeridos ?? [];
  const alcanceUnicidadNombre = plantilla?.alcanceUnicidadNombre;

  const [nombre, setNombre] = useState(documentoExistente?.nombre ?? "");
  const [estudianteId, setEstudianteId] = useState(documentoExistente?.estudianteId ?? "");
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [contenido, setContenido] = useState<SegmentoDocumento[][]>(
    documentoExistente?.contenido ?? plantilla?.parrafos ?? []
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // Campos a nivel de documento (ej. fecha del convenio): en un documento ya
  // guardado se usa el valor congelado al crearlo, no se recalcula cada vez
  // que se reabre para editar.
  const resultadoCampos = useMemo(() => {
    const base: Record<string, ResultadoCampo> = {
      ...resolverCamposDocumento(),
      ...(estudianteId ? resolverCamposEstudiante(estudianteId, contexto) : {}),
    };
    if (documentoExistente) {
      for (const [clave, valor] of Object.entries(documentoExistente.campos)) {
        if (clave.startsWith("documento.") && valor) base[clave] = { valor };
      }
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudianteId, contexto, documentoExistente]);

  // Al elegir (o cambiar) el estudiante, se sellan los valores en los segmentos "campo" por su clave.
  // Los campos de documento (ej. fecha del convenio) no se re-sellan acá: quedan fijos desde su creación.
  useEffect(() => {
    if (!estudianteId) return;
    setContenido((prev) => prev.map((parrafo) =>
      parrafo.map((s) =>
        s.tipo === "campo" && s.clave && !s.clave.startsWith("documento.")
          ? { ...s, texto: resultadoCampos[s.clave]?.valor ?? "" }
          : s
      )
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudianteId]);

  const estudiantesElegibles = useMemo(() => {
    let base = contexto.estudiantes;
    if (plantilla?.elegibilidad) base = base.filter((e) => plantilla.elegibilidad!(contexto, e));
    if (!busquedaEstudiante.trim()) return base;
    const q = normalizar(busquedaEstudiante);
    return base.filter((e) => normalizar(`${e.nombres} ${e.apellidos} ${e.run}`).includes(q));
  }, [contexto, plantilla, busquedaEstudiante]);

  const estudianteSeleccionado: Estudiante | undefined = contexto.estudiantes.find((e) => e.id === estudianteId);

  function actualizarSegmento(indiceParrafo: number, indiceSegmento: number, texto: string) {
    setContenido((prev) => prev.map((parrafo, pi) =>
      pi !== indiceParrafo ? parrafo : parrafo.map((s, si) => (si === indiceSegmento ? { ...s, texto } : s))
    ));
  }

  function etiquetaCampo(clave?: string): string | undefined {
    if (!clave) return undefined;
    for (const parrafo of plantilla?.parrafos ?? documentoExistente?.contenido ?? []) {
      for (const s of parrafo) {
        if (s.tipo === "campo" && s.clave === clave) return s.texto;
      }
    }
    return undefined;
  }

  async function guardar() {
    if (guardando) return;
    setError("");
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) { setError("El nombre es obligatorio."); return; }
    if (nombreLimpio.length > NOMBRE_MAX) { setError(`El nombre no puede superar los ${NOMBRE_MAX} caracteres.`); return; }
    if (requiereEstudiante && !estudianteId) { setError("Selecciona un estudiante."); return; }

    const camposFaltantes = camposRequeridos.filter((clave) => !resultadoCampos[clave]?.valor);
    if (camposFaltantes.length > 0) {
      setError("Faltan datos requeridos para completar este documento. Revisa los avisos marcados en el texto.");
      return;
    }

    const campos: Record<string, string> = {};
    for (const parrafo of contenido) {
      for (const s of parrafo) {
        if (s.tipo !== "campo" || !s.clave) continue;
        const valor = resultadoCampos[s.clave]?.valor;
        if (valor) campos[s.clave] = valor;
      }
    }

    setGuardando(true);
    try {
      if (esEdicion && documentoExistente) {
        await actualizarDocumento({
          documentoId: documentoExistente.id,
          liceoId, tipoModulo,
          nombreAnterior: documentoExistente.nombre,
          nombreNuevo: nombreLimpio,
          estudianteId: estudianteId || undefined,
          campos, contenido, alcanceUnicidadNombre,
        });
        setAviso("Documento guardado correctamente.");
        onGuardado(documentoExistente.id);
      } else {
        const id = await crearDocumento({
          liceoId, tipoModulo, plantillaId, nombre: nombreLimpio,
          estudianteId: estudianteId || undefined,
          campos, contenido, creadoPor: usuarioUid, alcanceUnicidadNombre,
        });
        setAviso("Documento guardado correctamente.");
        onGuardado(id);
      }
    } catch (err) {
      if (err instanceof Error && err.message === NOMBRE_DUPLICADO) {
        setError("Ya existe un documento con este nombre. Elige otro nombre.");
      } else {
        setError("No fue posible guardar el documento. Intenta nuevamente.");
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl sm:text-3xl font-bold">
            {esEdicion ? "Editar documento" : "Nuevo documento"}
          </h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            {plantilla?.nombre ?? documentoExistente?.plantillaId}
          </p>
        </div>
        <button
          onClick={onCancelar}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver
        </button>
      </div>

      {aviso && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
          <p style={{ color: "var(--success)" }} className="text-sm font-medium">{aviso}</p>
        </div>
      )}
      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-4">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Nombre */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
        <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, NOMBRE_MAX))}
          placeholder="Ej: Convenio Dionisio Toyo"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        />
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 text-right">{nombre.length}/{NOMBRE_MAX}</p>
      </div>

      {/* Selector de estudiante */}
      {requiereEstudiante && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-2">Estudiante</label>
          {estudianteSeleccionado ? (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl">
              <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{estudianteSeleccionado.nombres} {estudianteSeleccionado.apellidos}</p>
              <button onClick={() => setEstudianteId("")} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline flex-shrink-0">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={busquedaEstudiante}
                  onChange={(e) => setBusquedaEstudiante(e.target.value)}
                  placeholder="Buscar estudiante..."
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                />
              </div>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                {estudiantesElegibles.slice(0, 30).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEstudianteId(e.id)}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    className="text-left px-3 py-2 rounded-lg text-sm hover:[border-color:var(--accent)] transition-colors"
                  >
                    {e.nombres} {e.apellidos} <span style={{ color: "var(--text-muted)" }}>· {e.run}</span>
                  </button>
                ))}
                {estudiantesElegibles.length === 0 && (
                  <p style={{ color: "var(--text-muted)" }} className="text-xs px-1 py-2">No hay estudiantes disponibles para esta plantilla.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Documento */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8 mb-6">
        <div className="flex flex-col gap-5">
          {contenido.map((parrafo, pi) => (
            <p
              key={pi}
              style={{ color: "var(--text-primary)", lineHeight: 1.7, fontFamily: "'Times New Roman', Times, serif" }}
              className="text-sm text-justify"
            >
              {parrafo.map((s, si) => {
                if (s.tipo === "campo") return <SegmentoCampoView key={si} resultado={resultadoCampos[s.clave ?? ""]} etiqueta={etiquetaCampo(s.clave)} />;
                return (
                  <SegmentoEditableView
                    key={si}
                    texto={s.texto}
                    negrita={s.tipo === "protegido"}
                    onCambio={(t) => actualizarSegmento(pi, si, t)}
                  />
                );
              })}
            </p>
          ))}
          {contenido.length === 0 && (
            <p style={{ color: "var(--text-muted)" }} className="text-sm">Esta plantilla todavía no tiene contenido configurado.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={guardar}
          disabled={guardando}
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
