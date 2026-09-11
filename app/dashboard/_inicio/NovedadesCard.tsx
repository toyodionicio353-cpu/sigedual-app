"use client";
import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import { useNovedadesPublicas } from "@/lib/novedades/useNovedadesPublicas";
import TarjetaNovedad from "@/components/novedades/TarjetaNovedad";

/**
 * "Noticias y novedades" dentro del panel.
 *
 * La sección ya existía en el login, pero al iniciar sesión desaparecía:
 * quien usa SIGEDUAL a diario no tenía forma de enterarse de lo que
 * publican los establecimientos. Muestra lo mismo que ve el público —
 * publicaciones vigentes de todos los liceos— sin abrir una entrada nueva
 * en el Sidebar.
 */
export default function NovedadesCard({ limite = 2 }: { limite?: number }) {
  const { novedades, cargando } = useNovedadesPublicas();
  const visibles = novedades.slice(0, limite);

  // Sin publicaciones no se ocupa espacio del panel con un recuadro vacío.
  if (cargando || visibles.length === 0) return null;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Newspaper size={16} style={{ color: "var(--accent-light)" }} />
          <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">Noticias y novedades</h2>
        </div>
        <Link
          href="/novedades"
          style={{ color: "var(--accent-light)" }}
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          Ver todas <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibles.map((n) => <TarjetaNovedad key={n.id} novedad={n} compacta />)}
      </div>
    </div>
  );
}
