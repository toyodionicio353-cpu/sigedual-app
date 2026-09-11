"use client";
import { useRef, useState } from "react";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { subirImagen, diagnosticarStorage, ErrorSubida } from "@/lib/storage/subirImagen";
import { ImagePlus, X, ArrowLeft, ArrowRight } from "lucide-react";
import { MAX_IMAGENES } from "@/lib/novedades/texto";
import { MAX_BYTES_IMAGEN, TIPOS_IMAGEN, esTipoImagenPermitido } from "@/lib/novedades/validar";
import type { ImagenNovedad } from "@/types";

/**
 * Fotografías de una novedad: hasta 5, y solo fotografías. Son
 * opcionales: una publicación puede ser solo texto.
 *
 * El filtro NO es "empieza por image/": un GIF es `image/gif` y pasaría.
 * Se comprueba contra una lista explícita de formatos, acá y otra vez en
 * el servidor, porque el `accept` de un input es una sugerencia que
 * cualquiera puede saltarse.
 */
export default function SubirFotos({
  imagenes, onCambiar, carpeta, deshabilitado,
}: {
  imagenes: ImagenNovedad[];
  onCambiar: (imagenes: ImagenNovedad[]) => void;
  /** Ruta en Storage bajo la que se agrupan las fotos de esta novedad. */
  carpeta: string;
  deshabilitado?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [diagnostico, setDiagnostico] = useState("");
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState("");

  const lleno = imagenes.length >= MAX_IMAGENES;

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (elegidos.length === 0) return;

    setError("");
    setDiagnostico("");
    const espacio = MAX_IMAGENES - imagenes.length;
    if (elegidos.length > espacio) {
      setError(`Solo caben ${espacio} ${espacio === 1 ? "fotografía más" : "fotografías más"}: el máximo es ${MAX_IMAGENES}.`);
      return;
    }
    for (const archivo of elegidos) {
      if (!esTipoImagenPermitido(archivo.type)) {
        setError("Solo se admiten fotografías JPG, PNG o WebP. No se permiten vídeos ni GIF.");
        return;
      }
      if (archivo.size > MAX_BYTES_IMAGEN) {
        setError(`"${archivo.name}" pesa más de 5 MB. Usa una imagen más liviana.`);
        return;
      }
    }

    setSubiendo(true);
    setProgreso(0);
    try {
      const nuevas: ImagenNovedad[] = [];
      for (let i = 0; i < elegidos.length; i++) {
        const archivo = elegidos[i];
        const extension = archivo.name.slice(archivo.name.lastIndexOf(".")).toLowerCase() || ".jpg";
        const ruta = `${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
        nuevas.push(await subirImagen(archivo, ruta, {
          // Progreso repartido entre todas las fotos de la tanda, para que
          // la barra no vuelva a cero con cada archivo.
          onProgreso: (p) => setProgreso(Math.round(((i + p / 100) / elegidos.length) * 100)),
        }));
      }
      onCambiar([...imagenes, ...nuevas]);
    } catch (err) {
      // Se muestra el código de Firebase: sin él, un fallo de permisos y
      // uno de red se ven igual y no hay forma de saber qué arreglar.
      setError(err instanceof ErrorSubida ? `${err.message} (${err.codigo})` : "No se pudo subir la fotografía.");
    } finally {
      setSubiendo(false);
      setProgreso(0);
    }
  }

  async function quitar(indice: number) {
    const foto = imagenes[indice];
    onCambiar(imagenes.filter((_, i) => i !== indice));
    // El archivo se borra de Storage para no dejar fotos huérfanas
    // ocupando espacio. Si falla, la publicación igual queda correcta.
    try { await deleteObject(ref(storage, foto.ruta)); } catch { /* ya no existe */ }
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= imagenes.length) return;
    const copia = [...imagenes];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onCambiar(copia);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span style={{ color: "var(--text-secondary)" }} className="text-xs">
          Fotografías ({imagenes.length} de {MAX_IMAGENES})
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={lleno || subiendo || deshabilitado}
          style={{ color: "var(--accent-light)" }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
        >
          <ImagePlus size={13} /> {subiendo ? `Subiendo ${progreso}%` : "Agregar fotografía"}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept={TIPOS_IMAGEN.join(",")}
        multiple
        onChange={alElegir}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {imagenes.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={subiendo || deshabilitado}
          style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-light)", color: "var(--text-muted)" }}
          className="rounded-xl py-8 flex flex-col items-center justify-center gap-2 text-xs disabled:opacity-50"
        >
          <ImagePlus size={20} />
          Agregar fotografías (opcional)
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {imagenes.map((img, i) => (
            <div
              key={img.ruta}
              style={{ border: "1px solid var(--border)" }}
              className="relative rounded-xl overflow-hidden aspect-square max-w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Fotografía ${i + 1}`} className="w-full h-full object-cover" />

              <span
                style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
                className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              >
                {i + 1}
              </span>

              {!deshabilitado && (
                <>
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    aria-label={`Quitar fotografía ${i + 1}`}
                    style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
                    className="absolute top-1 right-1 p-1 rounded-full"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      aria-label={`Mover la fotografía ${i + 1} antes`}
                      style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
                      className="p-1 rounded-full disabled:opacity-30"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === imagenes.length - 1}
                      aria-label={`Mover la fotografía ${i + 1} después`}
                      style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
                      className="p-1 rounded-full disabled:opacity-30"
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {lleno && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs">
          Llegaste al máximo de {MAX_IMAGENES} fotografías.
        </p>
      )}
      {error && (
        <div style={{ background: "var(--danger)11", border: "1px solid var(--danger)" }} className="rounded-lg p-3 flex flex-col gap-2">
          <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>
          <button
            type="button"
            onClick={async () => {
              setProbando(true);
              setDiagnostico("");
              const r = await diagnosticarStorage(carpeta);
              setDiagnostico(
                r.ok
                  ? "El almacenamiento responde bien. El problema es de esta imagen en concreto: prueba con otra, más liviana."
                  : `El almacenamiento no está aceptando archivos. Código: ${r.codigo}. ${r.mensaje}`
              );
              setProbando(false);
            }}
            disabled={probando}
            style={{ color: "var(--accent-light)" }}
            className="text-xs font-semibold hover:underline text-left disabled:opacity-50"
          >
            {probando ? "Probando..." : "Probar el almacenamiento"}
          </button>
          {diagnostico && (
            <p style={{ color: "var(--text-secondary)" }} className="text-xs">{diagnostico}</p>
          )}
        </div>
      )}
    </div>
  );
}
