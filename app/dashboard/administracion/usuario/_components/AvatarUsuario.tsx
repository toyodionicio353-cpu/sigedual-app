"use client";
import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { Camera, Trash2, Loader2 } from "lucide-react";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO = 3 * 1024 * 1024; // 3 MB

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function AvatarUsuario({ avatarUrl, nombre }: { avatarUrl?: string; nombre: string }) {
  const { usuario, refrescarUsuario } = useAuth();
  const avisar = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<{ archivo: File; url: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError("Formato no permitido. Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setError("La imagen supera el tamaño máximo permitido (3 MB).");
      return;
    }
    setPrevia({ archivo, url: URL.createObjectURL(archivo) });
  }

  async function guardarFoto() {
    if (!usuario || !previa) return;
    setSubiendo(true);
    setError("");
    try {
      const referencia = ref(storage, `avatars/${usuario.uid}`);
      await uploadBytes(referencia, previa.archivo);
      const url = await getDownloadURL(referencia);
      await updateDoc(doc(db, "usuarios", usuario.uid), { avatarUrl: url, actualizadoEn: new Date().toISOString() });
      await refrescarUsuario();
      avisar("Foto de perfil actualizada.");
      URL.revokeObjectURL(previa.url);
      setPrevia(null);
    } catch {
      setError("No se pudo subir la foto. Inténtalo nuevamente.");
    } finally {
      setSubiendo(false);
    }
  }

  function cancelarPrevia() {
    if (previa) URL.revokeObjectURL(previa.url);
    setPrevia(null);
    setError("");
  }

  async function eliminarFoto() {
    if (!usuario || !avatarUrl) return;
    if (!confirm("¿Eliminar tu foto de perfil?")) return;
    setEliminando(true);
    try {
      await updateDoc(doc(db, "usuarios", usuario.uid), { avatarUrl: "", actualizadoEn: new Date().toISOString() });
      try {
        await deleteObject(ref(storage, `avatars/${usuario.uid}`));
      } catch {
        // el archivo puede no existir; no es crítico
      }
      await refrescarUsuario();
      avisar("Foto de perfil eliminada.");
    } catch {
      setError("No se pudo eliminar la foto. Inténtalo nuevamente.");
    } finally {
      setEliminando(false);
    }
  }

  const mostrar = previa?.url || avatarUrl;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div
        style={{ background: "var(--accent)", border: "3px solid var(--bg-card)" }}
        className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      >
        {mostrar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrar} alt={`Foto de perfil de ${nombre}`} className="w-full h-full object-cover" />
        ) : (
          <span style={{ color: "var(--text-on-accent)" }} className="text-2xl font-black">{iniciales(nombre)}</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {previa ? (
          <div className="flex gap-2">
            <button
              onClick={guardarFoto}
              disabled={subiendo}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {subiendo && <Loader2 size={13} className="animate-spin" />}
              {subiendo ? "Guardando..." : "Guardar foto"}
            </button>
            <button
              onClick={cancelarPrevia}
              disabled={subiendo}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors"
            >
              <Camera size={13} /> Cambiar foto
            </button>
            {avatarUrl && (
              <button
                onClick={eliminarFoto}
                disabled={eliminando}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--danger)" }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <Trash2 size={13} /> {eliminando ? "Eliminando..." : "Eliminar foto"}
              </button>
            )}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirArchivo} className="hidden" aria-label="Elegir foto de perfil" />
        {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}
        <p style={{ color: "var(--text-muted)" }} className="text-[11px]">JPG, PNG o WEBP. Máximo 3 MB.</p>
      </div>
    </div>
  );
}
