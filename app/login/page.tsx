"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Newspaper, ImageIcon, Megaphone } from "lucide-react";

const NOTICIAS_PLACEHOLDER = [
  { icon: Newspaper, titulo: "Noticias del programa dual" },
  { icon: ImageIcon, titulo: "Galería de actividades" },
  { icon: Megaphone, titulo: "Avisos y comunicados" },
];

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
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex flex-col lg:flex-row">
      {/* Tarjeta de login */}
      <div className="w-full lg:w-auto flex justify-center lg:justify-start px-4 pt-10 pb-8 lg:p-16">
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
          }}
          className="w-full max-w-sm rounded-2xl p-6 sm:p-10 shadow-2xl self-start lg:self-center"
        >
          {/* Logo + nombre */}
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/logo-icon.png"
              alt="Logo SIGEDUAL"
              width={48}
              height={48}
              className="w-12 h-12 object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-4xl font-bold tracking-tight leading-none">
                <span style={{ color: "var(--text-primary)" }}>SIG</span>
                <span style={{ color: "#C8102E" }}>e</span>
                <span style={{ color: "var(--text-primary)" }}>DUAL</span>
              </h1>
              <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-2 tracking-wide">
                Sistema Integral de Gestión Dual
              </p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)" }} className="pt-6">
            <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">
              Iniciar sesión
            </h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs mb-6">
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
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label style={{ color: "var(--text-secondary)" }} className="block text-sm">
                    Contraseña
                  </label>
                  <Link
                    href="/recuperar-password"
                    style={{ color: "var(--accent-light)" }}
                    className="text-xs hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
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
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
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
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <p style={{ color: "var(--text-secondary)" }} className="text-sm text-center mt-5">
              ¿No tienes cuenta?{" "}
              <Link href="/crear-cuenta" style={{ color: "var(--accent-light)" }} className="font-medium hover:underline">
                Crear cuenta
              </Link>
            </p>
          </div>

          {/* Sello de confianza */}
          <div
            style={{ borderTop: "1px solid var(--border)" }}
            className="flex items-center justify-center gap-2 mt-8 pt-5"
          >
            <p style={{ color: "var(--text-muted)" }} className="text-label text-[9px]">
              Plataforma verificada y protegida
            </p>
            <div
              style={{ border: "1px solid var(--text-muted)", color: "var(--text-muted)" }}
              className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
            >
              C
            </div>
          </div>
        </div>
      </div>

      {/* Noticias e imágenes (debajo en móvil, a la derecha en escritorio) */}
      <div className="flex-1 px-4 pb-10 lg:p-16 flex flex-col">
        <h3 style={{ color: "var(--text-secondary)" }} className="text-label text-xs mb-4">
          Noticias y novedades
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          {NOTICIAS_PLACEHOLDER.map(({ icon: Icon, titulo }, i) => (
            <div
              key={i}
              style={{ background: "var(--bg-card)", border: "1px dashed var(--border-light)" }}
              className="rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[140px]"
            >
              <Icon size={22} style={{ color: "var(--text-muted)" }} />
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-medium">
                {titulo}
              </p>
              <p style={{ color: "var(--text-muted)" }} className="text-label text-[10px] opacity-70">
                Próximamente
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
