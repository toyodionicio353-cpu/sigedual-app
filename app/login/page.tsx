"use client";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
      if (!snap.exists()) throw new Error("Usuario no encontrado en el sistema.");
      router.replace("/dashboard");
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ background: "var(--bg-base)" }}
      className="min-h-screen flex items-center justify-center px-4"
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
        }}
        className="w-full max-w-sm rounded-2xl p-6 sm:p-10 shadow-2xl"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 style={{ color: "#fff" }} className="text-3xl font-bold tracking-tight">
            SIGEDUAL
          </h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-2">
            Sistema Integral de Gestión Dual
          </p>
          <p style={{ color: "var(--accent-blue-light)" }} className="text-xs mt-1">
            Prueba de despliegue ✔
          </p>
        </div>

        <h2 style={{ color: "#fff" }} className="text-xl font-semibold mb-1">
          Iniciar sesión
        </h2>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          Ingresa tus credenciales para continuar
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@liceo.cl"
              required
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-light)",
                color: "var(--text-primary)",
              }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-light)",
                color: "var(--text-primary)",
              }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <p style={{ color: "var(--danger)" }} className="text-sm text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: "var(--accent-blue)" }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
