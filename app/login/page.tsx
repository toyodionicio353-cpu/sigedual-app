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
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panel de marca (solo visible en pantallas grandes) */}
      <div
        style={{
          background:
            "radial-gradient(circle at 30% 20%, var(--bg-card-hover), var(--bg-base) 70%)",
          borderRight: "1px solid var(--border)",
        }}
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      >
        <div
          style={{ background: "var(--accent-blue)", opacity: 0.15 }}
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl"
        />
        <div
          style={{ background: "var(--accent-blue-hover)", opacity: 0.1 }}
          className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div
              style={{ background: "var(--accent-blue)", borderRadius: 12 }}
              className="w-11 h-11 flex items-center justify-center"
            >
              <span className="text-white font-black text-lg">SG</span>
            </div>
            <span style={{ color: "#fff" }} className="text-xl font-bold tracking-tight">
              SIGEDUAL
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 style={{ color: "#fff" }} className="text-3xl font-bold leading-tight mb-4">
            Gestiona la formación dual en un solo lugar
          </h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-base">
            Estudiantes, centros, profesores, especialidades y documentos, todo conectado y
            disponible desde cualquier dispositivo.
          </p>
        </div>

        <p style={{ color: "var(--text-muted)" }} className="relative text-xs">
          Sistema Integral de Gestión Dual
        </p>
      </div>

      {/* Formulario */}
      <div className="flex min-h-screen lg:min-h-0 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          {/* Logo (solo visible en móvil/tablet) */}
          <div className="text-center mb-8 lg:hidden">
            <div
              style={{ background: "var(--accent-blue)", borderRadius: 14 }}
              className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-white font-black text-xl">SG</span>
            </div>
            <h1 style={{ color: "#fff" }} className="text-2xl font-bold tracking-tight">
              SIGEDUAL
            </h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
              Sistema Integral de Gestión Dual
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
                  background: "var(--bg-card)",
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
                  background: "var(--bg-card)",
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
    </div>
  );
}
