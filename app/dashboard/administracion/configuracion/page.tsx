"use client";
import { useMemo, useState } from "react";
import { usePreferencias } from "@/lib/preferencias/context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import { INDICE_BUSQUEDA, type CategoriaConfig } from "./_data/indiceBusqueda";
import AparienciaSeccion from "./_components/AparienciaSeccion";
import InteraccionSeccion from "./_components/InteraccionSeccion";
import IdiomaSeccion from "./_components/IdiomaSeccion";
import NotificacionesSeccion from "./_components/NotificacionesSeccion";
import PrivacidadSeccion from "./_components/PrivacidadSeccion";
import { Search, SlidersHorizontal, Palette, MousePointerClick, Globe, Bell, ShieldCheck, RotateCcw } from "lucide-react";

const CATEGORIAS: { id: CategoriaConfig; label: string; icon: React.ReactNode; Componente: React.ComponentType }[] = [
  { id: "apariencia", label: "Apariencia", icon: <Palette size={17} />, Componente: AparienciaSeccion },
  { id: "interaccion", label: "Interacción", icon: <MousePointerClick size={17} />, Componente: InteraccionSeccion },
  { id: "idioma", label: "Idioma y región", icon: <Globe size={17} />, Componente: IdiomaSeccion },
  { id: "notificaciones", label: "Notificaciones", icon: <Bell size={17} />, Componente: NotificacionesSeccion },
  { id: "privacidad", label: "Privacidad y datos", icon: <ShieldCheck size={17} />, Componente: PrivacidadSeccion },
];

export default function ConfiguracionPage() {
  const { restablecer } = usePreferencias();
  const avisar = useFeedback();
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaConfig>("apariencia");
  const [busqueda, setBusqueda] = useState("");
  const [modalRestablecer, setModalRestablecer] = useState(false);
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return INDICE_BUSQUEDA.filter(
      (e) => e.titulo.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q) || e.keywords.some((k) => k.includes(q))
    );
  }, [busqueda]);

  function irAResultado(id: string, categoria: CategoriaConfig) {
    setBusqueda("");
    setCategoriaActiva(categoria);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid var(--accent)";
      el.style.outlineOffset = "4px";
      el.style.borderRadius = "10px";
      setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 1600);
    }, 60);
  }

  function confirmarRestablecer() {
    restablecer();
    setModalRestablecer(false);
    avisar("Preferencias restauradas.");
  }

  const CategoriaActivaInfo = CATEGORIAS.find((c) => c.id === categoriaActiva)!;
  const ContenidoActivo = CategoriaActivaInfo.Componente;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <TituloPagina icon={<SlidersHorizontal size={28} />} className="mb-1">Configuración</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">
          Centro de preferencias del sistema. Personaliza tu experiencia en SIGEDUAL sin afectar los datos académicos ni la configuración de otros usuarios.
        </p>
      </div>

      {/* Buscador */}
      <div className="relative mb-6">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl">
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar configuración..."
            aria-label="Buscar configuración"
            style={{ color: "var(--text-primary)" }}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        {busqueda.trim() && (
          <div
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 14 }}
            className="absolute left-0 right-0 mt-1.5 z-20 shadow-2xl max-h-72 overflow-y-auto"
          >
            {resultados.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-5">No se encontraron configuraciones para tu búsqueda.</p>
            ) : (
              resultados.map((r) => (
                <button
                  key={r.id}
                  onClick={() => irAResultado(r.id, r.categoria)}
                  className="w-full text-left px-4 py-2.5 hover:[background:var(--hover-overlay)] transition-colors flex items-center justify-between gap-3"
                >
                  <span>
                    <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium block">{r.titulo}</span>
                    <span style={{ color: "var(--text-muted)" }} className="text-xs">{r.descripcion}</span>
                  </span>
                  <span style={{ color: "var(--text-muted)" }} className="text-xs flex-shrink-0">
                    {CATEGORIAS.find((c) => c.id === r.categoria)?.label}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selector de categoría en móvil/tablet */}
      <div className="lg:hidden mb-5">
        <Select
          value={categoriaActiva}
          onChange={(v) => setCategoriaActiva(v as CategoriaConfig)}
          ariaLabel="Categoría de configuración"
          opciones={CATEGORIAS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar de categorías en escritorio */}
        <nav className="hidden lg:flex flex-col gap-1 w-56 flex-shrink-0 sticky top-4">
          {CATEGORIAS.map((c) => {
            const activo = c.id === categoriaActiva;
            return (
              <button
                key={c.id}
                onClick={() => setCategoriaActiva(c.id)}
                style={{
                  background: activo ? "var(--accent)" : "transparent",
                  color: activo ? "var(--text-on-accent)" : "var(--text-secondary)",
                  borderRadius: 10,
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left hover:[background:var(--hover-overlay)] transition-colors"
              >
                <span style={{ color: activo ? "var(--text-on-accent)" : "var(--accent-light)" }}>{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </nav>

        {/* Contenido */}
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
          className="flex-1 min-w-0 p-5 sm:p-6"
        >
          <ContenidoActivo />
        </div>
      </div>

      {/* Restablecer configuración */}
      <div className="flex justify-end mt-8">
        <button
          onClick={() => setModalRestablecer(true)}
          style={{ color: "var(--text-muted)" }}
          className="inline-flex items-center gap-2 text-xs font-medium hover:[color:var(--danger)] transition-colors"
        >
          <RotateCcw size={13} />
          Restablecer configuración
        </button>
      </div>

      {modalRestablecer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setModalRestablecer(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Restablecer configuración"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Restablecer configuración?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Se restauran únicamente tus preferencias personales de interfaz (tema, densidad, notificaciones, etc.). No se eliminan estudiantes, empresas, profesores, evaluaciones, documentos ni ningún otro dato académico o de usuarios.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalRestablecer(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button onClick={confirmarRestablecer} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold">
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
