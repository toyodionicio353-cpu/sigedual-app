"use client";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { useNovedadesPublicas } from "@/lib/novedades/useNovedadesPublicas";
import TarjetaNovedad from "@/components/novedades/TarjetaNovedad";

/**
 * "Noticias y novedades" en la pantalla de acceso: las publicaciones
 * reales de todos los liceos, sin necesidad de iniciar sesión.
 *
 * Se muestran unas pocas y el resto queda en /novedades. El login no es
 * un portal de noticias: quien llega viene a entrar, y una lista larga
 * empujaría el formulario fuera de la pantalla.
 */
export default function NoticiasLogin({ limite = 4 }: { limite?: number }) {
  const { novedades, cargando } = useNovedadesPublicas();
  const visibles = novedades.slice(0, limite);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 style={{ color: "var(--text-secondary)" }} className="text-label text-xs">
          Noticias y novedades
        </h3>
        {novedades.length > limite && (
          <Link
            href="/novedades"
            style={{ color: "var(--accent-light)" }}
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            Ver todas <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {cargando ? (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">Cargando novedades...</p>
      ) : visibles.length === 0 ? (
        <div
          style={{ background: "var(--bg-card)", border: "1px dashed var(--border-light)" }}
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2"
        >
          <Newspaper size={20} style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }} className="text-xs font-medium">
            Todavía no hay publicaciones
          </p>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] opacity-70">
            Aquí aparecerán las novedades de los establecimientos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          {visibles.map((n) => <TarjetaNovedad key={n.id} novedad={n} compacta />)}
        </div>
      )}
    </section>
  );
}
