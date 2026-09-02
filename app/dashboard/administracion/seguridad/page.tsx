"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, RefreshCw, Copy, Check } from "lucide-react";
import type { CodigoAcceso } from "@/types";

const HORAS_VALIDEZ = 24;

function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function SeguridadPage() {
  const { usuario } = useAuth();
  const [dominio, setDominio] = useState("");
  const [dominioGuardado, setDominioGuardado] = useState("");
  const [codigoActual, setCodigoActual] = useState<CodigoAcceso | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardandoDominio, setGuardandoDominio] = useState(false);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const puedeAcceder = usuario?.rol === "administrador" || usuario?.rol === "director";

  useEffect(() => {
    if (usuario && puedeAcceder) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const liceoSnap = await getDoc(doc(db, "liceos", usuario.liceoId));
    const dominioActual = liceoSnap.exists() ? (liceoSnap.data().dominioCorreo ?? "") : "";
    setDominio(dominioActual);
    setDominioGuardado(dominioActual);

    const codigoSnap = await getDoc(doc(db, "codigosAcceso", usuario.liceoId));
    setCodigoActual(codigoSnap.exists() ? (codigoSnap.data() as CodigoAcceso) : null);
    setLoading(false);
  }

  async function guardarDominio() {
    if (!usuario) return;
    setGuardandoDominio(true);
    setMensaje("");
    try {
      await setDoc(
        doc(db, "liceos", usuario.liceoId),
        { id: usuario.liceoId, dominioCorreo: dominio.trim().toLowerCase() },
        { merge: true }
      );
      setDominioGuardado(dominio.trim().toLowerCase());
      setMensaje("Dominio actualizado.");
    } catch {
      setMensaje("No se pudo guardar el dominio.");
    } finally {
      setGuardandoDominio(false);
    }
  }

  async function generarNuevoCodigo() {
    if (!usuario) return;
    setGenerandoCodigo(true);
    try {
      const nuevo: CodigoAcceso = {
        liceoId: usuario.liceoId,
        codigo: generarCodigo(),
        generadoPor: usuario.uid,
        expiraEn: new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000).toISOString(),
        actualizadoEn: new Date().toISOString(),
      };
      await setDoc(doc(db, "codigosAcceso", usuario.liceoId), nuevo);
      setCodigoActual(nuevo);
    } finally {
      setGenerandoCodigo(false);
    }
  }

  function copiarCodigo() {
    if (!codigoActual) return;
    navigator.clipboard.writeText(codigoActual.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  if (!usuario) return null;

  if (!puedeAcceder) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const expirado = codigoActual ? new Date(codigoActual.expiraEn).getTime() < Date.now() : true;

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold mb-1">Seguridad</h1>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
        Controla qué correos pueden crear una cuenta en tu institución y comparte el código de
        verificación con quienes deban registrarse.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Dominio autorizado */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
            <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Dominio de correo autorizado</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              Solo los correos con este dominio podrán crear una cuenta y ver la información de tu institución.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={dominio}
                onChange={(e) => setDominio(e.target.value)}
                placeholder="tuliceo.cl"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={guardarDominio}
                disabled={guardandoDominio || dominio.trim().toLowerCase() === dominioGuardado}
                style={{ background: "var(--accent-blue)" }}
                className="px-5 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {guardandoDominio ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {mensaje && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-3">{mensaje}</p>}
          </div>

          {/* Código de verificación */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} style={{ color: "var(--accent-blue-light)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">Código de verificación</h2>
            </div>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              Entrégalo solo a la persona que deba crear una cuenta. Es válido por {HORAS_VALIDEZ} horas.
            </p>

            {codigoActual && !expirado ? (
              <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 flex items-center justify-between gap-3 mb-4">
                <span style={{ color: "var(--text-primary)" }} className="text-2xl font-mono font-bold tracking-[0.2em]">
                  {codigoActual.codigo}
                </span>
                <button onClick={copiarCodigo} style={{ color: "var(--text-muted)" }} className="p-2 hover:text-white transition-colors" title="Copiar código">
                  {copiado ? <Check size={18} style={{ color: "var(--success)" }} /> : <Copy size={18} />}
                </button>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">
                {codigoActual ? "El código anterior venció." : "Aún no has generado un código."}
              </p>
            )}

            <button
              onClick={generarNuevoCodigo}
              disabled={generandoCodigo}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-blue-500/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={generandoCodigo ? "animate-spin" : ""} />
              {codigoActual && !expirado ? "Generar nuevo código" : "Generar código"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
