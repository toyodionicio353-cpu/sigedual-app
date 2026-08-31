import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Construction } from "lucide-react";

export default function RecuperarPasswordPage() {
  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-sm rounded-2xl p-6 sm:p-10 shadow-2xl text-center"
      >
        <Image
          src="/logo-icon.png"
          alt="Logo SIGEDUAL"
          width={48}
          height={48}
          className="w-12 h-12 object-contain mx-auto mb-6"
        />

        <div
          style={{ background: "var(--bg-surface)", borderRadius: 14 }}
          className="w-14 h-14 flex items-center justify-center mx-auto mb-5"
        >
          <Construction size={24} style={{ color: "var(--accent-blue-light)" }} />
        </div>

        <h1 style={{ color: "#fff" }} className="text-lg font-semibold mb-2">
          Recuperar contraseña
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
          Esta sección está en construcción. Muy pronto podrás recuperar tu contraseña desde aquí.
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
    </div>
  );
}
