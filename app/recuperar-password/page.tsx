"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { ArrowLeft, MailCheck } from "lucide-react";
import type { Rol } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "estudiante", label: "Estudiante" },
  { value: "profesor", label: "Profesor" },
  { value: "centro_dual", label: "Centro Dual / Maestro Guía" },
  { value: "coordinador", label: "Coordinador" },
  { value: "director", label: "Director" },
  { value: "administrador", label: "Administrador" },
];

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      try {
        const q = query(collection(db, "usuarios"), where("email", "==", email.trim()), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const usuario = snap.docs[0].data();
          if (usuario.rol !== rol) {
            setError("El rol seleccionado no coincide con el de tu cuenta.");
            setLoading(false);
            return;
          }
        }
      } catch {
        // Si no se puede verificar el rol contra la base de datos, se continúa
        // igualmente: Firebase valida por su cuenta si el correo existe.
      }

      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch {
      setError("No pudimos procesar la solicitud. Verifica el correo ingresado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-sm rounded-2xl p-6 sm:p-10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/logo-icon.png"
            alt="Logo SIGEDUAL"
            width={40}
            height={40}
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <span style={{ color: "#fff" }} className="text-lg font-bold tracking-tight uppercase">
            SIGEDUAL
          </span>
        </div>

        {!enviado ? (
          <>
            <h1 style={{ color: "#fff" }} className="text-2xl font-bold mb-1">
              Recuperar contraseña
            </h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Ingresa tu correo y tu rol para verificar tu identidad. Te enviaremos un enlace
              para crear una nueva contraseña.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  Rol
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as Rol)}
                  required
                  style={{
                    background: "var(--bg-base)",
                    border: "1px solid var(--border-light)",
                    color: rol ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="" disabled>
                    Selecciona tu rol
                  </option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value} style={{ background: "var(--bg-card)" }}>
                      {r.label}
                    </option>
                  ))}
                </select>
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
                {loading ? "Verificando..." : "Enviar enlace de recuperación"}
              </button>
            </form>

            <Link
              href="/login"
              style={{ color: "var(--text-secondary)" }}
              className="flex items-center justify-center gap-2 text-sm mt-6 hover:underline"
            >
              <ArrowLeft size={14} />
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <div className="text-center">
            <div
              style={{ background: "var(--bg-surface)", borderRadius: 14 }}
              className="w-14 h-14 flex items-center justify-center mx-auto mb-5"
            >
              <MailCheck size={24} style={{ color: "var(--accent-blue-light)" }} />
            </div>
            <h1 style={{ color: "#fff" }} className="text-xl font-bold mb-2">
              Revisa tu correo
            </h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
              Si <span style={{ color: "var(--text-primary)" }}>{email}</span> está registrado en
              SIGEDUAL, te enviamos un enlace para crear una nueva contraseña.
            </p>
            <Link
              href="/login"
              style={{ background: "var(--accent-blue)" }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <ArrowLeft size={16} />
              Volver a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
