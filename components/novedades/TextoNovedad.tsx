import { FAMILIA_FUENTE } from "@/lib/novedades/validar";
import type { FuenteNovedad, SegmentoTexto } from "@/types";

/**
 * Dibuja la descripción de una novedad.
 *
 * Sin `dangerouslySetInnerHTML`: el contenido son segmentos de texto, así
 * que React los escapa solos. Es la razón de fondo por la que la
 * descripción nunca se guardó como HTML — esto se pinta en una página
 * pública, sin sesión, y una inyección ahí la vería cualquiera.
 */
export default function TextoNovedad({
  descripcion, fuente, className,
}: {
  descripcion: SegmentoTexto[];
  fuente: FuenteNovedad;
  className?: string;
}) {
  return (
    <div
      style={{ fontFamily: FAMILIA_FUENTE[fuente], whiteSpace: "pre-wrap" }}
      className={className}
    >
      {descripcion.map((s, i) =>
        s.negrita ? <strong key={i}>{s.texto}</strong> : <span key={i}>{s.texto}</span>
      )}
    </div>
  );
}
