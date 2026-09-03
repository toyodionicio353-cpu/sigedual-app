"use client";
import { useMemo, useState } from "react";
import { Search, MoreVertical, FileStack, Inbox } from "lucide-react";

export interface ItemBiblioteca {
  id: string;
  nombre: string;
  tipo?: string;
  fecha?: string;
  estado?: string;
  autor?: string;
  subtitulo?: string;
  previewLineas?: string[];
}

interface AccionMenu {
  label: string;
  onClick: (item: ItemBiblioteca) => void;
}

interface BibliotecaDocumentalProps {
  titulo: string;
  descripcion: string;
  placeholderBusqueda: string;
  labelTabCreados: string;
  labelPlural: string;
  plantillas: ItemBiblioteca[];
  creados: ItemBiblioteca[];
  cargando?: boolean;
  accionPrincipal?: { label: string; onClick: () => void };
  acciones?: AccionMenu[];
}

type Orden = "recientes" | "antiguos" | "az" | "za";

const ORDEN_OPCIONES: { value: Orden; label: string }[] = [
  { value: "recientes", label: "Más recientes" },
  { value: "antiguos", label: "Más antiguos" },
  { value: "az", label: "Nombre A-Z" },
  { value: "za", label: "Nombre Z-A" },
];

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function VistaPreviaDocumento({ lineas }: { lineas?: string[] }) {
  const contenido = lineas && lineas.length > 0 ? lineas : ["", "", "", "", ""];
  return (
    <div
      style={{ background: "#f4f4f2", border: "1px solid var(--border)" }}
      className="aspect-[3/4] w-full rounded-lg overflow-hidden flex flex-col p-3 gap-1.5"
    >
      {lineas && lineas.length > 0 ? (
        contenido.map((linea, i) => (
          <p key={i} style={{ color: "#3a3a3a" }} className={`text-[9px] leading-tight ${i === 0 ? "font-bold text-[10px]" : ""}`}>
            {linea}
          </p>
        ))
      ) : (
        <div className="flex-1 flex flex-col gap-1.5 pt-1">
          <div style={{ background: "#d9d9d6" }} className="h-2 w-3/4 rounded-sm" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ background: "#e4e4e1" }} className="h-1.5 rounded-sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuTarjeta({ item, acciones, abierto, onToggle }: { item: ItemBiblioteca; acciones: AccionMenu[]; abierto: boolean; onToggle: () => void }) {
  if (acciones.length === 0) return null;
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onToggle}
        style={{ color: "var(--text-muted)" }}
        className="p-1 rounded-lg hover:[background:var(--hover-overlay)] transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="absolute right-0 top-full mt-1 w-40 rounded-xl shadow-2xl overflow-hidden z-40 py-1"
          >
            {acciones.map((a) => (
              <button
                key={a.label}
                onClick={() => { a.onClick(item); onToggle(); }}
                style={{ color: "var(--text-primary)" }}
                className="flex items-center gap-2 px-3.5 py-2 text-sm w-full text-left hover:[background:var(--hover-overlay)] transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function BibliotecaDocumental({
  titulo, descripcion, placeholderBusqueda, labelTabCreados, labelPlural,
  plantillas, creados, cargando = false, accionPrincipal, acciones = [],
}: BibliotecaDocumentalProps) {
  const [tab, setTab] = useState<"plantillas" | "creados">("plantillas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  const itemsBase = tab === "plantillas" ? plantillas : creados;

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return itemsBase;
    const q = normalizar(busqueda);
    return itemsBase.filter((it) => normalizar(`${it.nombre} ${it.tipo ?? ""} ${it.subtitulo ?? ""} ${it.autor ?? ""} ${it.estado ?? ""}`).includes(q));
  }, [itemsBase, busqueda]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    switch (orden) {
      case "az":
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case "za":
        arr.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
      case "antiguos":
        arr.sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
        break;
      default:
        arr.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
    }
    return arr;
  }, [filtrados, orden]);

  const hayBusqueda = busqueda.trim().length > 0;

  return (
    <div className="p-4 md:p-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{titulo}</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{descripcion}</p>
        </div>
        {accionPrincipal && (
          <button
            onClick={accionPrincipal.onClick}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0"
          >
            {accionPrincipal.label}
          </button>
        )}
      </div>

      {/* Selector de contenido */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("plantillas")}
          style={{
            background: tab === "plantillas" ? "var(--accent)" : "var(--bg-card)",
            color: tab === "plantillas" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${tab === "plantillas" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <FileStack size={16} />
          Plantillas
        </button>
        <button
          onClick={() => setTab("creados")}
          style={{
            background: tab === "creados" ? "var(--accent)" : "var(--bg-card)",
            color: tab === "creados" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${tab === "creados" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Inbox size={16} />
          {labelTabCreados}
        </button>
      </div>

      {/* Buscador y orden */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={placeholderBusqueda}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors flex-shrink-0"
        >
          {ORDEN_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Contenido */}
      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : itemsBase.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">
            Todavía no hay {labelPlural} disponibles{tab === "plantillas" ? "" : " en esta sección"}.
          </p>
          {accionPrincipal && (
            <button
              onClick={accionPrincipal.onClick}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4"
            >
              {accionPrincipal.label}
            </button>
          )}
        </div>
      ) : ordenados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Search size={22} style={{ color: "var(--text-muted)" }} />
          </div>
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No se encontraron {labelPlural}.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">Prueba modificando la búsqueda o los filtros.</p>
          <button onClick={() => setBusqueda("")} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">
            {hayBusqueda ? `${ordenados.length} ${labelPlural} encontrado(s)` : `${ordenados.length} ${labelPlural}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ordenados.map((item) => (
              <div
                key={item.id}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                className="rounded-2xl overflow-hidden hover:[border-color:var(--accent)] transition-colors flex flex-col"
              >
                <div className="p-3 pb-0">
                  <VistaPreviaDocumento lineas={item.previewLineas} />
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold leading-snug line-clamp-2 flex-1">{item.nombre}</p>
                    <MenuTarjeta
                      item={item}
                      acciones={acciones}
                      abierto={menuAbierto === item.id}
                      onToggle={() => setMenuAbierto((prev) => (prev === item.id ? null : item.id))}
                    />
                  </div>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">
                    {[item.tipo, item.fecha, item.estado].filter(Boolean).join(" · ") || "Sin información adicional"}
                  </p>
                  {item.autor && (
                    <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">{item.autor}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
