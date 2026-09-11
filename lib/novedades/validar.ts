import type { FuenteNovedad, ImagenNovedad, SegmentoTexto } from "@/types";
import { MAX_CARACTERES, MAX_IMAGENES, MAX_TITULO, caracteresUsados, normalizarDescripcion } from "./texto";
import { expiracionMaxima } from "./semestre";

export const FUENTES: FuenteNovedad[] = ["arial", "times", "inter", "georgia", "verdana"];

export const ETIQUETA_FUENTE: Record<FuenteNovedad, string> = {
  arial: "Arial",
  times: "Times New Roman",
  inter: "Inter",
  georgia: "Georgia",
  verdana: "Verdana",
};

/** Familia CSS de cada fuente permitida. Con respaldos reales: si la
 * tipografía no está instalada, el texto no debe caer en una cualquiera. */
export const FAMILIA_FUENTE: Record<FuenteNovedad, string> = {
  arial: 'Arial, Helvetica, "Liberation Sans", sans-serif',
  times: '"Times New Roman", Times, "Liberation Serif", serif',
  inter: 'var(--font-sans), Inter, system-ui, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  verdana: 'Verdana, Geneva, "DejaVu Sans", sans-serif',
};

/** Solo fotografías. Nada de vídeo, GIF ni animaciones: un GIF es
 * `image/gif`, así que no basta con mirar si empieza por "image/". */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export const EXTENSIONES_IMAGEN = [".jpg", ".jpeg", ".png", ".webp"];
/** Tope por archivo. Una foto de más de 5 MB en una tarjeta de novedades
 * solo sirve para que la página tarde en cargar. */
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

export function esTipoImagenPermitido(tipo: string): boolean {
  return (TIPOS_IMAGEN as readonly string[]).includes(tipo);
}

export interface DatosNovedadValidados {
  titulo: string;
  descripcion: SegmentoTexto[];
  fuente: FuenteNovedad;
  imagenes: ImagenNovedad[];
  expiraEn: string;
}

/**
 * Valida una novedad antes de publicarla. Se usa en el servidor, que es
 * donde la validación cuenta: el navegador ya avisa mientras se escribe,
 * pero cualquiera puede saltarse ese aviso.
 *
 * Devuelve el primer problema encontrado, o los datos ya normalizados.
 */
export function validarNovedad(
  bruto: {
    titulo?: unknown;
    descripcion?: unknown;
    fuente?: unknown;
    imagenes?: unknown;
    expiraEn?: unknown;
  },
  ahora: Date = new Date()
): { error: string } | { datos: DatosNovedadValidados } {
  const titulo = typeof bruto.titulo === "string" ? bruto.titulo.trim() : "";
  if (!titulo) return { error: "La publicación necesita un título." };
  if (titulo.length > MAX_TITULO) {
    return { error: `El título no puede superar los ${MAX_TITULO} caracteres.` };
  }

  if (!Array.isArray(bruto.descripcion)) return { error: "Falta el contenido de la publicación." };
  const segmentos: SegmentoTexto[] = [];
  for (const s of bruto.descripcion) {
    if (!s || typeof s !== "object") return { error: "El contenido tiene un formato inválido." };
    const trozo = s as { texto?: unknown; negrita?: unknown };
    if (typeof trozo.texto !== "string") return { error: "El contenido tiene un formato inválido." };
    segmentos.push({ texto: trozo.texto, negrita: trozo.negrita === true });
  }
  const descripcion = normalizarDescripcion(segmentos);
  const usados = caracteresUsados(descripcion);
  if (usados > MAX_CARACTERES) {
    return { error: `El contenido supera el límite: ${usados} de ${MAX_CARACTERES} caracteres (sin contar espacios).` };
  }

  const fuente = bruto.fuente as FuenteNovedad;
  if (!FUENTES.includes(fuente)) return { error: "La tipografía elegida no está permitida." };

  if (!Array.isArray(bruto.imagenes)) {
    return { error: "Las fotografías tienen un formato inválido." };
  }
  if (bruto.imagenes.length > MAX_IMAGENES) {
    return { error: `No se pueden publicar más de ${MAX_IMAGENES} fotografías.` };
  }
  const imagenes: ImagenNovedad[] = [];
  for (const img of bruto.imagenes) {
    if (!img || typeof img !== "object") return { error: "Alguna fotografía tiene un formato inválido." };
    const foto = img as { url?: unknown; ruta?: unknown };
    if (typeof foto.url !== "string" || typeof foto.ruta !== "string" || !foto.url || !foto.ruta) {
      return { error: "Alguna fotografía quedó sin subir correctamente. Vuelve a intentarlo." };
    }
    // La extensión se comprueba también acá: el tipo declarado por el
    // navegador al subir no llega hasta este punto, y no se debe confiar
    // en que el cliente ya filtró.
    const ruta = foto.ruta.toLowerCase();
    if (!EXTENSIONES_IMAGEN.some((ext) => ruta.endsWith(ext))) {
      return { error: "Solo se admiten fotografías (JPG, PNG o WebP). No se permiten vídeos ni GIF." };
    }
    imagenes.push({ url: foto.url, ruta: foto.ruta });
  }

  // Una publicación puede ser solo texto, solo fotografías, o ambas cosas
  // — pero no puede estar vacía: un título suelto no comunica nada a quien
  // lo lea en la sección pública.
  if (usados === 0 && imagenes.length === 0) {
    return { error: "La publicación necesita al menos un texto o una fotografía." };
  }

  if (typeof bruto.expiraEn !== "string" || !bruto.expiraEn) {
    return { error: "Falta la fecha de término de la publicación." };
  }
  const expira = new Date(bruto.expiraEn);
  if (Number.isNaN(expira.getTime())) return { error: "La fecha de término no es válida." };
  if (expira.getTime() <= ahora.getTime()) {
    return { error: "La fecha de término tiene que ser posterior a hoy." };
  }
  // Un margen de un minuto absorbe la diferencia entre el reloj del
  // navegador que propuso la fecha y el del servidor que la comprueba.
  if (expira.getTime() > expiracionMaxima(ahora).getTime() + 60_000) {
    return { error: "Una publicación no puede permanecer más de dos meses." };
  }

  return { datos: { titulo, descripcion, fuente, imagenes, expiraEn: expira.toISOString() } };
}
