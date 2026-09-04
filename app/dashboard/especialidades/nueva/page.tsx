"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import TituloPagina from "@/components/TituloPagina";
import type { Especialidad } from "@/types";
import { CheckCircle2, Eye, GraduationCap } from "lucide-react";

export default function AgregarEspecialidadPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<"activa" | "inactiva">("activa");
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [creada, setCreada] = useState<Especialidad | null>(null);

  const puedeCrear = usuario?.rol === "administrador";

  async function guardar() {
    if (!usuario || guardando || !nombre.trim()) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const nueva = {
        nombre: nombre.trim(),
        liceoId: usuario.liceoId,
        estado,
        creadoEn: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "especialidades"), nueva);
      setCreada({ id: ref.id, ...nueva });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible registrar la especialidad. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeCrear) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <TituloPagina icon={<GraduationCap size={28} />}>Agregar especialidad</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Registra una nueva carrera técnico-profesional del establecimiento.
        </p>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) conConfirmacion(guardar); }}
          className="flex flex-col gap-4"
        >
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Nombre de la especialidad</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Contabilidad"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1.5">Estado</label>
            <div className="flex gap-2">
              {(["activa", "inactiva"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstado(e)}
                  style={{
                    background: estado === e ? "var(--accent)" : "var(--bg-base)",
                    border: `1px solid ${estado === e ? "var(--accent)" : "var(--border-light)"}`,
                    color: estado === e ? "var(--text-on-accent)" : "var(--text-secondary)",
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/dashboard/especialidades"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-medium"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={guardando || !nombre.trim()}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar especialidad"}
            </button>
          </div>
        </form>
      </div>

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una especialidad" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}

      {creada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
            <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Especialidad creada correctamente.</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Ya está disponible para asociarla a estudiantes y Centros Duales.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setCreada(null); setNombre(""); setEstado("activa"); }}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Agregar otra
              </button>
              <button
                onClick={() => router.push("/dashboard/especialidades")}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Eye size={15} />
                Ver especialidades
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
