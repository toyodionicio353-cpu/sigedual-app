"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearRut, validarRut } from "@/lib/rut";
import type { Usuario } from "@/types";
import { ArrowLeft, Pencil } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

export default function EditarProfesorPage() {
  const { uid } = useParams<{ uid: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [profesor, setProfesor] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState("");
  const [run, setRun] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const puedeEditar = usuario?.rol === "administrador";

  useEffect(() => {
    if (!usuario || !uid || !puedeEditar) return;
    async function cargar() {
      setLoading(true);
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (!snap.exists() || (snap.data() as Usuario).rol !== "profesor") {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const p = snap.data() as Usuario;
      setProfesor(p);
      setNombre(p.nombre ?? "");
      setRun(p.run ?? "");
      setEspecialidad(p.especialidad ?? "");
      setLoading(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, uid, puedeEditar]);

  const rutValido = !run.trim() || validarRut(run);
  const puedeGuardar = nombre.trim() && rutValido;

  async function guardar() {
    if (!profesor || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const cambios: Record<string, unknown> = {
        nombre: nombre.trim(),
        especialidad: especialidad.trim(),
      };
      if (run.trim()) cambios.run = formatearRut(run);
      await updateDoc(doc(db, "usuarios", profesor.uid), cambios);
      setMensaje("Cambios guardados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeEditar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado || !profesor) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Profesor supervisor no encontrado</p>
          <Link href="/dashboard/profesores" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a profesores
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Pencil size={28} />}>Editar profesor</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{profesor.email}</p>
        </div>
        <Link
          href={`/dashboard/profesores/${uid}`}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a la ficha
        </Link>
      </div>

      {mensaje && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--success)" }} className="text-sm font-medium">{mensaje}</p>
        </div>
      )}
      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre completo *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">RUT (opcional)</label>
          <input value={run} onChange={(e) => setRun(e.target.value)} placeholder="12.345.678-9"
            style={{ background: "var(--bg-base)", border: `1px solid ${!rutValido ? "var(--danger)" : "var(--border-light)"}`, color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          {!rutValido && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">RUT inválido.</p>}
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad (opcional)</label>
          <input value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Contabilidad"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={guardar}
            disabled={!puedeGuardar || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
