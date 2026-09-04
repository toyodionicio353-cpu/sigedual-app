"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PARTES_LEGALES, TOTAL_PARTES_PLANEADAS } from "@/lib/legal/contenido";
import type { BloqueLegal } from "@/lib/legal/tipos";
import { buscarEnDocumento, resaltar } from "@/lib/legal/busqueda";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Menu, X, ArrowUp, Printer } from "lucide-react";

function irA(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.style.outline = "2px solid var(--accent)";
  el.style.outlineOffset = "4px";
  setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 1600);
}

function BloqueRenderer({ bloque, query }: { bloque: BloqueLegal; query: string }) {
  if (bloque.tipo === "parrafo") {
    return (
      <p style={{ color: "var(--text-secondary)" }} className="text-sm leading-relaxed mb-3 max-w-[68ch]">
        {resaltar(bloque.texto, query)}
      </p>
    );
  }
  if (bloque.tipo === "lista") {
    return (
      <ul className="list-disc pl-5 mb-3 flex flex-col gap-1.5 max-w-[68ch]">
        {bloque.items.map((item, i) => (
          <li key={i} style={{ color: "var(--text-secondary)" }} className="text-sm leading-relaxed">
            {resaltar(item, query)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="list-disc pl-5 mb-3 flex flex-col gap-2.5 max-w-[68ch]">
      {bloque.items.map((item, i) => (
        <li key={i} style={{ color: "var(--text-secondary)" }} className="text-sm leading-relaxed">
          <span style={{ color: "var(--text-primary)" }} className="font-semibold">{resaltar(item.termino, query)}</span>
          {": "}
          {resaltar(item.descripcion, query)}
        </li>
      ))}
    </ul>
  );
}

export default function DocumentoLegal() {
  const [busqueda, setBusqueda] = useState("");
  const [indiceMovilAbierto, setIndiceMovilAbierto] = useState(false);
  const [parteExpandida, setParteExpandida] = useState<string | null>(PARTES_LEGALES[0]?.id ?? null);
  const [mostrarVolverArriba, setMostrarVolverArriba] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alDesplazar() {
      setMostrarVolverArriba((contenedorRef.current?.scrollTop ?? window.scrollY) > 400);
    }
    const el = contenedorRef.current;
    (el ?? window).addEventListener("scroll", alDesplazar);
    return () => (el ?? window).removeEventListener("scroll", alDesplazar);
  }, []);

  const resultados = useMemo(() => buscarEnDocumento(PARTES_LEGALES, busqueda), [busqueda]);

  function irAResultado(parteId: string, seccionId: string) {
    setBusqueda("");
    setIndiceMovilAbierto(false);
    setParteExpandida(parteId);
    setTimeout(() => irA(seccionId), 60);
  }

  const NavContenido = (
    <nav aria-label="Índice del documento" className="flex flex-col gap-0.5">
      {PARTES_LEGALES.map((parte) => {
        const abierta = parteExpandida === parte.id;
        return (
          <div key={parte.id}>
            <button
              onClick={() => setParteExpandida(abierta ? null : parte.id)}
              style={{ color: "var(--text-primary)" }}
              className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold hover:[background:var(--hover-overlay)] transition-colors"
            >
              <span className="truncate">Parte {parte.numero} — {parte.titulo}</span>
              {abierta ? <ChevronUp size={13} className="flex-shrink-0" /> : <ChevronDown size={13} className="flex-shrink-0" />}
            </button>
            {abierta && (
              <div className="flex flex-col gap-0.5 pl-3 mb-1">
                {parte.secciones.length === 0 && (
                  <span style={{ color: "var(--text-muted)" }} className="text-xs px-2.5 py-1">Pendiente de incorporación.</span>
                )}
                {parte.secciones.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => irAResultado(parte.id, s.id)}
                    style={{ color: "var(--text-secondary)" }}
                    className="text-left px-2.5 py-1.5 rounded-lg text-xs hover:[background:var(--hover-overlay)] hover:[color:var(--text-primary)] transition-colors truncate"
                  >
                    {s.numero} {s.titulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Buscador + índice móvil */}
      <div className="lg:hidden print:hidden flex flex-col gap-2">
        <Buscador busqueda={busqueda} setBusqueda={setBusqueda} resultados={resultados} onIr={irAResultado} />
        <button
          onClick={() => setIndiceMovilAbierto(true)}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          <Menu size={16} /> Índice del documento
        </button>
      </div>

      {indiceMovilAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden flex" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setIndiceMovilAbierto(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)" }}
            className="w-[85%] max-w-xs h-full overflow-y-auto p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Índice</h2>
              <button onClick={() => setIndiceMovilAbierto(false)} aria-label="Cerrar índice" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            {NavContenido}
          </div>
        </div>
      )}

      {/* Índice de escritorio */}
      <aside className="hidden lg:block w-64 flex-shrink-0 print:hidden">
        <div className="sticky top-4 flex flex-col gap-3">
          <Buscador busqueda={busqueda} setBusqueda={setBusqueda} resultados={resultados} onIr={irAResultado} />
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-3 max-h-[70vh] overflow-y-auto">
            {NavContenido}
          </div>
          <button
            onClick={() => window.print()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
          >
            <Printer size={14} /> Imprimir documento
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {PARTES_LEGALES.map((parte, i) => (
          <article key={parte.id} id={parte.id} className="mb-10 scroll-mt-4">
            <header className="mb-5 pb-3" style={{ borderBottom: "2px solid var(--accent)" }}>
              <p style={{ color: "var(--accent-light)" }} className="text-xs font-bold uppercase tracking-wide mb-1">
                Parte {parte.numero} de {TOTAL_PARTES_PLANEADAS}
              </p>
              <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif" }} className="text-lg sm:text-xl font-bold leading-snug">
                {parte.titulo}
              </h2>
              {!parte.completo && (
                <span style={{ color: "var(--warning)", background: "var(--warning-bg)" }} className="inline-block mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                  Contenido pendiente de completar
                </span>
              )}
            </header>

            {parte.secciones.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm italic">Esta parte todavía no ha sido incorporada.</p>
            ) : (
              parte.secciones.map((seccion) => (
                <section key={seccion.id} id={seccion.id} className="mb-6 scroll-mt-4">
                  <h3 style={{ color: "var(--text-primary)" }} className="text-sm sm:text-base font-bold mb-2">
                    {seccion.numero} {seccion.titulo}
                  </h3>
                  {seccion.bloques.map((bloque, bi) => (
                    <BloqueRenderer key={bi} bloque={bloque} query={busqueda} />
                  ))}
                </section>
              ))
            )}

            <div className="flex items-center justify-between mt-6 print:hidden">
              {i > 0 ? (
                <button onClick={() => irA(PARTES_LEGALES[i - 1].id)} style={{ color: "var(--text-secondary)" }} className="inline-flex items-center gap-1 text-xs font-medium hover:[color:var(--text-primary)] transition-colors">
                  <ChevronLeft size={14} /> Parte {PARTES_LEGALES[i - 1].numero}
                </button>
              ) : <span />}
              {i < PARTES_LEGALES.length - 1 ? (
                <button onClick={() => irA(PARTES_LEGALES[i + 1].id)} style={{ color: "var(--text-secondary)" }} className="inline-flex items-center gap-1 text-xs font-medium hover:[color:var(--text-primary)] transition-colors">
                  Parte {PARTES_LEGALES[i + 1].numero} <ChevronRight size={14} />
                </button>
              ) : <span />}
            </div>
          </article>
        ))}
      </div>

      {mostrarVolverArriba && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="print:hidden fixed bottom-6 right-6 w-11 h-11 rounded-full shadow-2xl flex items-center justify-center z-40 hover:opacity-90 transition-opacity"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}

function Buscador({
  busqueda, setBusqueda, resultados, onIr,
}: {
  busqueda: string;
  setBusqueda: (v: string) => void;
  resultados: ReturnType<typeof buscarEnDocumento>;
  onIr: (parteId: string, seccionId: string) => void;
}) {
  return (
    <div className="relative">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 py-2.5 rounded-xl">
        <Search size={15} style={{ color: "var(--text-muted)" }} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en el documento..."
          aria-label="Buscar en el documento"
          style={{ color: "var(--text-primary)" }}
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" style={{ color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        )}
      </div>
      {busqueda.trim().length >= 2 && (
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 14 }}
          className="absolute left-0 right-0 mt-1.5 z-20 shadow-2xl max-h-72 overflow-y-auto"
        >
          {resultados.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-xs text-center py-4 px-3">Sin coincidencias.</p>
          ) : (
            resultados.map((r, i) => (
              <button
                key={`${r.seccionId}-${i}`}
                onClick={() => onIr(r.parteId, r.seccionId)}
                className="w-full text-left px-3 py-2 hover:[background:var(--hover-overlay)] transition-colors"
              >
                <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">Parte {r.parteNumero} · {r.seccionNumero} {r.seccionTitulo}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5 line-clamp-2">{r.fragmento}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
