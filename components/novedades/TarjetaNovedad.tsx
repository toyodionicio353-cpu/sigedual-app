"use client";
import Link from "next/link";
import { Eye, School, CalendarDays, Newspaper } from "lucide-react";
import { resumen } from "@/lib/novedades/texto";
import { formatearFecha } from "@/lib/fecha";
import type { Novedad } from "@/types";

/**
 * Tarjeta de una novedad en el listado público.
 *
 * Muestra un resumen de 200 caracteres, no el contenido completo: ese
 * límite es de visualización, el texto guardado puede llegar a 2500. "Ver
 * más" abre el detalle.
 */
export default function TarjetaNovedad({ novedad, compacta }: { novedad: Novedad; compacta?: boolean }) {
  const { texto, recortado } = resumen(novedad.descripcion ?? []);
  const portada = novedad.imagenes?.[0];

  return (
    <Link
      href={`/novedades/${novedad.id}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      className="rounded-2xl overflow-hidden flex flex-col hover:[border-color:var(--accent)] transition-colors"
    >
      {portada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portada.url}
          alt=""
          className={`w-full object-cover ${compacta ? "h-32" : "h-44"}`}
        />
      ) : (
        // Publicación solo de texto: una franja sobria con el acento de la
        // marca, para que la tarjeta siga leyéndose como una tarjeta y no
        // como un párrafo suelto.
        <div
          style={{ background: "var(--bg-surface)", borderBottom: "3px solid var(--accent)" }}
          className={`w-full flex items-center justify-center ${compacta ? "h-14" : "h-20"}`}
        >
          <Newspaper size={compacta ? 18 : 22} style={{ color: "var(--text-muted)" }} aria-hidden />
        </div>
      )}

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold leading-snug">
          {novedad.titulo}
        </h3>

        {/* De qué liceo viene: en una sección compartida entre todos los
            liceos, la procedencia no puede quedar implícita. */}
        <p style={{ color: "var(--accent-light)" }} className="text-xs font-semibold inline-flex items-center gap-1.5">
          <School size={11} className="flex-shrink-0" />
          <span className="truncate">{novedad.liceoNombre || "Liceo"}</span>
        </p>

        <p style={{ color: "var(--text-muted)" }} className="text-[11px] inline-flex items-center gap-1.5">
          <CalendarDays size={10} />
          {novedad.publicadoEn ? formatearFecha(novedad.publicadoEn) : ""}
        </p>

        {/* Una publicación puede ser solo fotografías: sin texto no se pinta
            un párrafo vacío que deje un hueco raro bajo la fecha. */}
        {texto ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1 flex-1">
            {texto}
            {recortado && (
              <span style={{ color: "var(--accent-light)" }} className="font-semibold ml-1">Ver más</span>
            )}
          </p>
        ) : (
          <span className="flex-1" />
        )}

        <p style={{ color: "var(--text-muted)" }} className="text-[11px] inline-flex items-center gap-1.5 mt-1">
          <Eye size={11} /> {(novedad.visualizaciones ?? 0).toLocaleString("es-CL")} visualizaciones
        </p>
      </div>
    </Link>
  );
}
