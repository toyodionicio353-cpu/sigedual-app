import Link from "next/link";
import { Eye } from "lucide-react";

/**
 * "Ver ficha": el mismo remate para todas las listas que llevan a una
 * ficha — estudiantes, centros duales, maestros guía, profesores, liceos.
 *
 * Existe porque cada listado se había rematado a su manera (una flecha
 * suelta, un "Ver", nada) y la acción es la misma en todas. Un solo
 * componente evita que el próximo listado invente un cuarto remate.
 *
 * Dos formas de usarlo:
 *
 *  - Con `href`: se dibuja como un enlace propio. Para filas que NO son
 *    un enlace completo (listado de estudiantes, asignaciones).
 *  - Sin `href`: se dibuja como un `span`. Para filas que YA son un
 *    `<Link>` entero — un enlace dentro de otro enlace no es HTML válido,
 *    y además la fila completa ya es clicable, que es más cómodo.
 */
export default function VerFicha({
  href,
  variante = "boton",
  className = "",
}: {
  href?: string;
  /** "boton" para filas y tablas; "enlace" para el pie de una tarjeta. */
  variante?: "boton" | "enlace";
  className?: string;
}) {
  const estilo = variante === "boton"
    ? {
        style: { background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--accent-light)" },
        clases: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors flex-shrink-0 w-fit",
      }
    : {
        style: { color: "var(--accent-light)" },
        clases: "flex items-center gap-1 text-xs font-semibold hover:underline w-fit",
      };

  const contenido = (
    <>
      <Eye size={13} />
      Ver ficha
    </>
  );

  if (href) {
    return (
      <Link href={href} style={estilo.style} className={`${estilo.clases} ${className}`}>
        {contenido}
      </Link>
    );
  }
  return (
    <span style={estilo.style} className={`${estilo.clases} ${className}`}>
      {contenido}
    </span>
  );
}
