"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";

export default function AgregarProfesorPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (usuario && usuario.rol !== "administrador") {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const puedeGuardar = nombre.trim() && email.trim() && password.trim().length >= 6;

  async function crearProfesor() {
    if (!usuario || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        nombre: nombre.trim(),
        rol: "profesor",
        especialidad: especialidad.trim(),
        liceoId: usuario.liceoId,
        activo: true,
        creadoEn: new Date().toISOString(),
      });
      router.push("/dashboard/profesores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear al profesor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Agregar profesor</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Crea la cuenta de acceso de un profesor supervisor.
          </p>
        </div>
        <Link
          href="/dashboard/profesores"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a profesores
        </Link>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre completo *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María González"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Correo electrónico *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="profesor@liceo.cl"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Contraseña temporal *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad (opcional)</label>
          <input value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Contabilidad"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={crearProfesor}
            disabled={!puedeGuardar || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Creando..." : "Crear profesor"}
          </button>
        </div>
      </div>
    </div>
  );
}
