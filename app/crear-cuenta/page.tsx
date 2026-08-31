"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, limit, doc, setDoc, getDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import type { Rol, Liceo, CodigoAcceso } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "profesor", label: "Profesor Supervisor" },
  { value: "coordinador", label: "Coordinador" },
  { value: "centro_dual", label: "Centro Dual / Maestro Guía" },
  { value: "estudiante", label: "Estudiante" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CrearCuentaPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Ingresa un correo válido (ejemplo: nombre@dominio.cl).");
      return;
    }
    if (!rol) {
      setError("Selecciona tu rol.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!codigo.trim()) {
      setError("Ingresa el código de verificación entregado por tu director o administrador.");
      return;
    }

    setLoading(true);
    try {
      const dominio = email.trim().split("@")[1]?.toLowerCase();

      const liceoSnap = await getDocs(
        query(collection(db, "liceos"), where("dominioCorreo", "==", dominio), limit(1))
      );
      if (liceoSnap.empty) {
        setError("Este dominio de correo no está autorizado. Contacta a tu director o administrador.");
        setLoading(false);
        return;
      }
      const liceo = { id: liceoSnap.docs[0].id, ...liceoSnap.docs[0].data() } as Liceo;

      const codigoSnap = await getDoc(doc(db, "codigosAcceso", liceo.id));
      if (!codigoSnap.exists()) {
        setError("Aún no hay un código de verificación activo para tu institución.");
        setLoading(false);
        return;
      }
      const codigoData = codigoSnap.data() as CodigoAcceso;
      const expirado = new Date(codigoData.expiraEn).getTime() < Date.now();
      if (codigoData.codigo.toUpperCase() !== codigo.trim().toUpperCase() || expirado) {
        setError("El código de verificación es incorrecto o ya venció. Solicita uno nuevo a tu director o administrador.");
        setLoading(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        nombre: nombre.trim(),
        rol,
        liceoId: liceo.id,
        activo: true,
        creadoEn: new Date().toISOString(),
      });

      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setError("Ya existe una cuenta con ese correo.");
      } else {
        setError("No pudimos crear tu cuenta. Intenta nuevamente.");
      }
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

        <h1 style={{ color: "#fff" }} className="text-2xl font-bold mb-1">
          Crear cuenta
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          Tu correo debe pertenecer al dominio autorizado de tu institución, y necesitas el
          código de verificación que entrega tu director o administrador.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="María González"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Correo institucional
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@tuliceo.cl"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
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
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: rol ? "var(--text-primary)" : "var(--text-muted)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            >
              <option value="" disabled>Selecciona tu rol</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value} style={{ background: "var(--bg-card)" }}>{r.label}</option>
              ))}
            </select>
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
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Código de verificación
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: 7K2QXT"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors uppercase"
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
            {loading ? "Creando cuenta..." : "Crear cuenta"}
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
      </div>
    </div>
  );
}
