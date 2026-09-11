"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, School, CalendarDays } from "lucide-react";
import TextoNovedad from "@/components/novedades/TextoNovedad";
import { estaVigente } from "@/lib/novedades/semestre";
import { formatearFecha } from "@/lib/fecha";
import type { Novedad } from "@/types";

/** Recuerda qué novedades ya contó este navegador, para que recargar no
 * infle el contador. No identifica a nadie ni guarda direcciones IP. */
const CLAVE_VISTAS = "sigedual_novedades_vistas";

function yaContada(id: string): boolean {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? "{}") as Record<string, number>;
    const cuando = guardado[id];
    // Se vuelve a contar pasadas 12 horas: una visita de hoy y otra de
    // mañana son dos visitas, pero cinco recargas seguidas no.
    return typeof cuando === "number" && Date.now() - cuando < 12 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function marcarContada(id: string) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? "{}") as Record<string, number>;
    guardado[id] = Date.now();
    localStorage.setItem(CLAVE_VISTAS, JSON.stringify(guardado));
  } catch { /* navegación privada o almacenamiento bloqueado */ }
}

export default function DetalleNovedadPage() {
  const { id } = useParams<{ id: string }>();
  const [novedad, setNovedad] = useState<Novedad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [foto, setFoto] = useState(0);
  const contada = useRef(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "novedades", id));
        if (cancelado) return;
        if (!snap.exists()) { setNovedad(null); return; }
        const datos = { id: snap.id, ...snap.data() } as Novedad;
        // Un borrador o una novedad expirada no son públicos, aunque
        // alguien conserve el enlace.
        if (datos.estado !== "publicada" || !estaVigente(datos.expiraEn)) { setNovedad(null); return; }
        setNovedad(datos);

        if (!contada.current && !yaContada(id)) {
          contada.current = true;
          marcarContada(id);
          // Sin await: contar la visita no debe retrasar la lectura.
          fetch(`/api/novedades/${id}/visita`, { method: "POST" }).catch(() => {});
        }
      } catch {
        if (!cancelado) setNovedad(null);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [id]);

  if (cargando) {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (!novedad) {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center p-6">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-10 text-center max-w-sm">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">
            Esta publicación ya no está disponible
          </p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-5">
            Puede haber expirado o haber sido retirada por su establecimiento.
          </p>
          <Link href="/novedades" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">
            <ArrowLeft size={15} /> Ver otras novedades
          </Link>
        </div>
      </div>
    );
  }

  const fotos = novedad.imagenes ?? [];
  const actual = fotos[foto];

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <Link href="/novedades" style={{ color: "var(--text-muted)" }} className="inline-flex items-center gap-1.5 text-xs hover:underline">
          <ArrowLeft size={12} /> Noticias y novedades
        </Link>

        {actual && (
          <div style={{ border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={actual.url} alt={`Fotografía ${foto + 1} de ${fotos.length}`} className="w-full max-h-[28rem] object-contain" style={{ background: "var(--bg-surface)" }} />

            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFoto((f) => (f - 1 + fotos.length) % fotos.length)}
                  aria-label="Fotografía anterior"
                  style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setFoto((f) => (f + 1) % fotos.length)}
                  aria-label="Fotografía siguiente"
                  style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
                >
                  <ChevronRight size={16} />
                </button>
                <span
                  style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
                  className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                >
                  {foto + 1} / {fotos.length}
                </span>
              </>
            )}
          </div>
        )}

        {fotos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fotos.map((f, i) => (
              <button
                key={f.ruta}
                onClick={() => setFoto(i)}
                aria-label={`Ver fotografía ${i + 1}`}
                style={{ border: i === foto ? "2px solid var(--accent)" : "1px solid var(--border)" }}
                className="rounded-lg overflow-hidden flex-shrink-0 w-16 h-16"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-xl sm:text-2xl font-bold leading-snug">
            {novedad.titulo}
          </h1>
          <div className="flex items-center gap-3 flex-wrap mt-2">
            <span style={{ color: "var(--accent-light)" }} className="text-sm font-semibold inline-flex items-center gap-1.5">
              <School size={13} /> {novedad.liceoNombre || "Liceo"}
            </span>
            <span style={{ color: "var(--text-muted)" }} className="text-xs inline-flex items-center gap-1.5">
              <CalendarDays size={11} /> {novedad.publicadoEn ? formatearFecha(novedad.publicadoEn) : ""}
            </span>
            <span style={{ color: "var(--text-muted)" }} className="text-xs inline-flex items-center gap-1.5">
              <Eye size={11} /> {(novedad.visualizaciones ?? 0).toLocaleString("es-CL")} visualizaciones
            </span>
          </div>
        </div>

        <TextoNovedad
          descripcion={novedad.descripcion ?? []}
          fuente={novedad.fuente ?? "inter"}
          className="text-sm leading-relaxed [color:var(--text-secondary)]"
        />

        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-5 text-center">
          <Link href="/login" style={{ color: "var(--text-muted)" }} className="text-xs hover:underline">
            Volver a SIGEDUAL
          </Link>
        </div>
      </div>
    </div>
  );
}
