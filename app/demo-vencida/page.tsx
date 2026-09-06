"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useDemoDeLiceo } from "@/lib/demo/useDemoDeLiceo";
import { auth } from "@/lib/firebase";
import { Clock, Trash2 } from "lucide-react";

export default function DemoVencidaPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const demoLiceo = useDemoDeLiceo();
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");
  const [eliminado, setEliminado] = useState(false);

  const puedeEliminar = usuario?.rol === "director";

  async function eliminarDatos() {
    if (!usuario || eliminando) return;
    setEliminando(true);
    setError("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/demo/eliminar-datos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No fue posible eliminar los datos de la demostración.");
        setEliminando(false);
        return;
      }
      setEliminado(true);
    } catch {
      setError("No fue posible eliminar los datos de la demostración. Intenta nuevamente.");
      setEliminando(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-lg rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={36} height={36} className="w-9 h-9 object-contain flex-shrink-0" />
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: "var(--text-primary)" }}>SIG</span>
            <span style={{ color: "#C8102E" }}>e</span>
            <span style={{ color: "var(--text-primary)" }}>DUAL</span>
          </span>
        </div>

        <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mb-4">
          <Clock size={26} style={{ color: "var(--text-muted)" }} />
        </div>

        {eliminado ? (
          <>
            <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold mb-2">Datos de la demostración eliminados</h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Los datos registrados durante la prueba fueron eliminados. Las cuentas de acceso quedaron desactivadas.
            </p>
            <Link href="/login" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold">
              Ir a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold mb-2">Tu demostración de SIGEDUAL ha finalizado</h1>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Los 7 días de acceso gratuito de esta demostración han finalizado. Los datos registrados
              durante la prueba se mantienen disponibles de acuerdo con las condiciones de SIGEDUAL.
            </p>

            <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-1">¿Quieres continuar utilizando SIGEDUAL?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Puedes contratar un plan de SIGEDUAL para continuar trabajando con tu institución.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-2">
              <Link
                href="/planes"
                target="_blank"
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 text-center py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Contratar SIGEDUAL
              </Link>
              {puedeEliminar && (
                <button
                  onClick={() => setConfirmando(true)}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium hover:[border-color:var(--danger)] transition-colors"
                >
                  <Trash2 size={15} />
                  Eliminar datos de la demostración
                </button>
              )}
            </div>
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              "Contratar SIGEDUAL" te muestra los planes disponibles — la contratación en línea
              todavía no está activa.
            </p>
          </>
        )}

        {confirmando && !eliminado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => !eliminando && setConfirmando(false)}>
            <div
              role="dialog" aria-modal="true" aria-label="Eliminar datos de la demostración"
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            >
              <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Eliminar los datos de esta demostración?</h2>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-3">
                Esta acción eliminará los datos registrados durante la prueba, incluyendo estudiantes,
                maestros guía, empresas, asignaciones, registros y demás información creada durante la
                demostración.
              </p>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
                Los usuarios asociados no serán eliminados; serán desactivados.
              </p>
              {error && <p style={{ color: "var(--danger)" }} className="text-sm mb-4">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setConfirmando(false)} disabled={eliminando} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={eliminarDatos} disabled={eliminando} style={{ background: "var(--danger)", color: "#fff" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {eliminando ? "Eliminando..." : "Sí, eliminar datos"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
