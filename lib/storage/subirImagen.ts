import { ref, uploadBytesResumable, getDownloadURL, type StorageError } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Subida de imágenes a Firebase Storage.
 *
 * Existe sobre todo por una razón: cuando una subida falla, Firebase
 * entrega un código exacto (`storage/unauthorized`,
 * `storage/bucket-not-found`, …) y cada uno tiene una causa y una
 * solución distintas. Antes ese error se descartaba con un `catch` vacío
 * y al usuario le quedaba "no se pudo subir, inténtalo nuevamente", que
 * no dice nada y no se puede arreglar a ciegas.
 */

export interface ResultadoSubida {
  url: string;
  ruta: string;
}

/** Error de subida ya traducido, conservando el código original para
 * poder reportarlo. */
export class ErrorSubida extends Error {
  codigo: string;
  /** true cuando volver a intentarlo puede funcionar (corte de red).
   * false cuando hay que arreglar algo antes (permisos, plan, reglas). */
  reintentable: boolean;

  constructor(mensaje: string, codigo: string, reintentable: boolean) {
    super(mensaje);
    this.name = "ErrorSubida";
    this.codigo = codigo;
    this.reintentable = reintentable;
  }
}

function traducir(err: unknown): ErrorSubida {
  const codigo = (err as StorageError)?.code ?? "desconocido";

  // El error crudo va a la consola del navegador: un fallo de CORS o un
  // 404 del bucket dejan ahí detalles (la URL exacta, la cabecera que
  // falta) que el SDK no expone en su objeto de error, y que son justo lo
  // que hace falta para saber qué configurar.
  if (typeof console !== "undefined") {
    console.error("[SIGEDUAL] Falló la subida a Firebase Storage:", codigo, err);
  }

  switch (codigo) {
    case "storage/unauthorized":
      return new ErrorSubida(
        "Las reglas de Firebase Storage están rechazando la subida. Hay que permitir la escritura para usuarios autenticados en la Consola de Firebase → Storage → Reglas.",
        codigo, false
      );
    case "storage/unauthenticated":
      return new ErrorSubida(
        "Tu sesión expiró. Cierra sesión, vuelve a entrar e inténtalo de nuevo.",
        codigo, false
      );
    case "storage/bucket-not-found":
    case "storage/project-not-found":
      return new ErrorSubida(
        "El almacenamiento de archivos no está habilitado en este proyecto de Firebase. Hay que activarlo en la Consola → Storage (requiere el plan Blaze).",
        codigo, false
      );
    case "storage/quota-exceeded":
      return new ErrorSubida(
        "Se agotó la cuota de almacenamiento del proyecto de Firebase.",
        codigo, false
      );
    case "storage/retry-limit-exceeded":
      return new ErrorSubida(
        "La subida se quedó en 0% y no avanzó. Esto casi nunca es la imagen: lo habitual es que el almacenamiento no esté habilitado en el proyecto de Firebase, o que al bucket le falte la configuración de CORS para aceptar subidas desde el sitio web.",
        codigo, false
      );
    case "storage/canceled":
      return new ErrorSubida("La subida se canceló.", codigo, true);
    case "storage/invalid-argument":
      return new ErrorSubida("El archivo no es válido para subir.", codigo, false);
    case "storage/unknown":
      return new ErrorSubida(
        "Firebase rechazó la subida sin dar un motivo. Las causas habituales son que el almacenamiento no esté habilitado en el proyecto, o que falte la configuración de CORS del bucket.",
        codigo, false
      );
    default:
      return new ErrorSubida(
        err instanceof Error && err.message ? err.message : "No se pudo subir la imagen.",
        codigo, true
      );
  }
}

export interface OpcionesSubida {
  /** 0 a 100. Permite mostrar el avance real en vez de un "Subiendo...". */
  onProgreso?: (porcentaje: number) => void;
  /** Reintentos ante fallos de red. No se reintenta lo que no tiene
   * sentido reintentar: si las reglas rechazan la escritura, insistir
   * solo hace esperar al usuario para darle el mismo error. */
  reintentos?: number;
}

/** Sube un archivo y devuelve su URL pública y su ruta en Storage. */
export async function subirImagen(
  archivo: File,
  ruta: string,
  opciones: OpcionesSubida = {}
): Promise<ResultadoSubida> {
  const { onProgreso, reintentos = 2 } = opciones;

  for (let intento = 0; ; intento++) {
    try {
      const referencia = ref(storage, ruta);
      const tarea = uploadBytesResumable(referencia, archivo, {
        contentType: archivo.type,
        // Un año de caché: la ruta lleva marca de tiempo, así que una
        // imagen nunca cambia de contenido bajo la misma ruta.
        cacheControl: "public, max-age=31536000, immutable",
      });

      await new Promise<void>((resolver, rechazar) => {
        tarea.on(
          "state_changed",
          (snap) => {
            if (onProgreso && snap.totalBytes > 0) {
              onProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          (err) => rechazar(err),
          () => resolver()
        );
      });

      return { url: await getDownloadURL(referencia), ruta };
    } catch (err) {
      const traducido = traducir(err);
      if (!traducido.reintentable || intento >= reintentos) throw traducido;
      await new Promise((r) => setTimeout(r, 600 * (intento + 1)));
    }
  }
}

/**
 * Comprueba si Storage responde, subiendo un archivo mínimo a la MISMA
 * ruta donde irían las imágenes reales.
 *
 * La ruta importa: las reglas de Storage se definen por ruta, así que
 * probar en otra carpeta podría fallar por permisos aunque la verdadera
 * funcione — y daría un diagnóstico engañoso, que es peor que no tener
 * diagnóstico.
 *
 * Sirve para distinguir "esta imagen falló" de "el almacenamiento no está
 * disponible", que no se puede adivinar desde el mensaje de una subida
 * suelta.
 */
export async function diagnosticarStorage(
  carpeta: string
): Promise<{ ok: true } | { ok: false; codigo: string; mensaje: string }> {
  try {
    // Un PNG transparente de 1x1: es una imagen de verdad, así que pasa
    // cualquier regla que exija `contentType` de imagen.
    const bytes = Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    ), (c) => c.charCodeAt(0));
    const prueba = new File([bytes], "diagnostico.png", { type: "image/png" });
    const referencia = ref(storage, `${carpeta}/__diagnostico_${Date.now()}.png`);
    await uploadBytesResumable(referencia, prueba, { contentType: "image/png" });
    return { ok: true };
  } catch (err) {
    const traducido = traducir(err);
    return { ok: false, codigo: traducido.codigo, mensaje: traducido.message };
  }
}
