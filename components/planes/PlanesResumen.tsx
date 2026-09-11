"use client";
import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { usePlanesComerciales } from "@/lib/planesComerciales/usePlanesComerciales";
import { formatearCLP, ETIQUETA_PERIODICIDAD, SUFIJO_PERIODICIDAD, DESCRIPCION_ACCESO } from "@/lib/planesComerciales";

/**
 * Resumen de los Planes SIGEDUAL para mostrarlos sin sesión iniciada.
 *
 * Es a propósito más escueto que la página /planes: acá solo van nombre,
 * precio y una línea. Quien quiere comparar de verdad entra a la página
 * completa; el login no es el lugar para una tabla comparativa, y llenarlo
 * de detalle competiría con lo que la persona vino a hacer, que es entrar.
 *
 * No muestra ningún botón de contratar: el sistema de pagos está
 * desactivado y ofrecer aquí una compra que no existe sería mentir.
 */
export default function PlanesResumen({ limite = 3 }: { limite?: number }) {
  const { planes, cargando } = usePlanesComerciales();

  // Los "inactivo" no se ofrecen; el orden lo decide Administración.
  const visibles = planes
    .filter((p) => p.estado !== "inactivo")
    .sort((a, b) => a.orden - b.orden)
    .slice(0, limite);

  // Sin planes publicados no se deja un hueco ni un aviso de error: la
  // sección simplemente no aparece.
  if (cargando || visibles.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 style={{ color: "var(--text-secondary)" }} className="text-label text-xs">
          Planes SIGEDUAL
        </h3>
        <Link
          href="/planes"
          style={{ color: "var(--accent-light)" }}
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          Ver detalle <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3 gap-3">
        {visibles.map((plan) => (
          <Link
            key={plan.id}
            href="/planes"
            style={{
              background: "var(--bg-card)",
              border: plan.recomendado ? "1.5px solid var(--accent)" : "1px solid var(--border)",
            }}
            className="rounded-2xl p-4 flex flex-col gap-1 relative hover:[border-color:var(--accent)] transition-colors"
          >
            {plan.recomendado && (
              <span
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="absolute -top-2 right-3 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              >
                <Star size={9} /> Recomendado
              </span>
            )}

            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">{plan.nombre}</p>

            <p className="leading-none">
              <span style={{ color: "var(--text-primary)" }} className="text-xl font-black">
                {formatearCLP(plan.precio)}
              </span>
              <span style={{ color: "var(--text-muted)" }} className="text-[11px] ml-1">
                {SUFIJO_PERIODICIDAD[plan.periodicidad]}
              </span>
            </p>

            <p style={{ color: "var(--text-muted)" }} className="text-[10px]">
              {ETIQUETA_PERIODICIDAD[plan.periodicidad]}
            </p>

            <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1 line-clamp-2">
              {plan.descripcion || DESCRIPCION_ACCESO[plan.periodicidad]}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
