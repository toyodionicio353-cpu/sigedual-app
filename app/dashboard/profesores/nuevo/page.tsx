"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearRut, validarRut } from "@/lib/rut";
import TituloPagina from "@/components/TituloPagina";
import { UserPlus } from "lucide-react";

export default function AgregarProfesorPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [run, setRun] = useState("");
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

  const rutValido = !run.trim() || validarRut(run);
  const puedeGuardar = nombre.trim() && email.trim() && password.trim().length >= 6 && rutValido;

  async function crearProfesor() {
    if (!usuario || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const nuevo: Record<string, unknown> = {
        uid: cred.user.uid,
        email: email.trim(),
        nombre: nombre.trim(),
        rol: "profesor",
        especialidad: especialidad.trim(),
        liceoId: usuario.liceoId,
        activo: true,
        creadoEn: new Date().toISOString(),
      };
      if (run.trim()) nuevo.run = formatearRut(run);
      await setDoc(doc(db, "usuarios", cred.user.uid), nuevo);
      router.push("/dashboard/profesores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear al profesor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-6">
        <TituloPagina icon={<UserPlus size={28} />}>Agregar profesor</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Crea la cuenta de acceso de un profesor supervisor.
        </p>
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
