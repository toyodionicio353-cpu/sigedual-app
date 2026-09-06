"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, RefreshCw, Copy, Check, GraduationCap } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import type { CodigoAcceso } from "@/types";

const HORAS_VALIDEZ = 24;

function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Tarjeta reutilizable para un código de acceso (staff o externo) — mismo
 * comportamiento, distinta colección y distinto texto. */
function TarjetaCodigo({ titulo, descripcion, icon, codigo, expirado, generando, onGenerar }: {
  titulo: string;
  descripcion: string;
  icon: React.ReactNode;
  codigo: CodigoAcceso | null;
  expirado: boolean;
  generando: boolean;
  onGenerar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">{titulo}</h2>
      </div>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">{descripcion}</p>

      {codigo && !expirado ? (
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 flex items-center justify-between gap-3 mb-4">
          <span style={{ color: "var(--text-primary)" }} className="text-2xl font-mono font-bold tracking-[0.2em]">
            {codigo.codigo}
          </span>
          <button onClick={copiar} style={{ color: "var(--text-muted)" }} className="p-2 hover:[color:var(--text-primary)] transition-colors" title="Copiar código">
            {copiado ? <Check size={18} style={{ color: "var(--success)" }} /> : <Copy size={18} />}
          </button>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">
          {codigo ? "El código anterior venció." : "Aún no has generado un código."}
        </p>
      )}

      <button
        onClick={onGenerar}
        disabled={generando}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50"
      >
        <RefreshCw size={15} className={generando ? "animate-spin" : ""} />
        {codigo && !expirado ? "Generar nuevo código" : "Generar código"}
      </button>
    </div>
  );
}

export default function SeguridadPage() {
  const { usuario } = useAuth();
  const [dominio, setDominio] = useState("");
  const [dominioGuardado, setDominioGuardado] = useState("");
  const [codigoStaff, setCodigoStaff] = useState<CodigoAcceso | null>(null);
  const [codigoExterno, setCodigoExterno] = useState<CodigoAcceso | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardandoDominio, setGuardandoDominio] = useState(false);
  const [generandoStaff, setGenerandoStaff] = useState(false);
  const [generandoExterno, setGenerandoExterno] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Dominio autorizado y código de Profesor Supervisor/Coordinador: solo
  // quien administra la institución. El código para Estudiantes/Centro
  // Dual lo puede generar cualquier staff del liceo (empieza por el
  // Profesor Supervisor, que es quien trata directamente con ellos).
  const puedeGestionarInstitucion = usuario?.rol === "administrador" || usuario?.rol === "director";
  const puedeGenerarCodigoExterno = puedeGestionarInstitucion || usuario?.rol === "coordinador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (usuario && puedeGenerarCodigoExterno) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    if (puedeGestionarInstitucion) {
      const liceoSnap = await getDoc(doc(db, "liceos", usuario.liceoId));
      const dominioActual = liceoSnap.exists() ? (liceoSnap.data().dominioCorreo ?? "") : "";
      setDominio(dominioActual);
      setDominioGuardado(dominioActual);

      const codigoSnap = await getDoc(doc(db, "codigosAcceso", usuario.liceoId));
      setCodigoStaff(codigoSnap.exists() ? (codigoSnap.data() as CodigoAcceso) : null);
    }

    const codigoExternoSnap = await getDoc(doc(db, "codigosAccesoExterno", usuario.liceoId));
    setCodigoExterno(codigoExternoSnap.exists() ? (codigoExternoSnap.data() as CodigoAcceso) : null);
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

  async function generarCodigoStaff() {
    if (!usuario) return;
    setGenerandoStaff(true);
    try {
      const nuevo: CodigoAcceso = {
        liceoId: usuario.liceoId,
        codigo: generarCodigo(),
        generadoPor: usuario.uid,
        expiraEn: new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000).toISOString(),
        actualizadoEn: new Date().toISOString(),
      };
      await setDoc(doc(db, "codigosAcceso", usuario.liceoId), nuevo);
      setCodigoStaff(nuevo);
    } finally {
      setGenerandoStaff(false);
    }
  }

  async function generarCodigoParaExternos() {
    if (!usuario) return;
    setGenerandoExterno(true);
    try {
      const nuevo: CodigoAcceso = {
        liceoId: usuario.liceoId,
        codigo: generarCodigo(),
        generadoPor: usuario.uid,
        expiraEn: new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000).toISOString(),
        actualizadoEn: new Date().toISOString(),
      };
      await setDoc(doc(db, "codigosAccesoExterno", usuario.liceoId), nuevo);
      setCodigoExterno(nuevo);
    } finally {
      setGenerandoExterno(false);
    }
  }

  if (!usuario) return null;

  if (!puedeGenerarCodigoExterno) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const staffExpirado = codigoStaff ? new Date(codigoStaff.expiraEn).getTime() < Date.now() : true;
  const externoExpirado = codigoExterno ? new Date(codigoExterno.expiraEn).getTime() < Date.now() : true;

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={<ShieldCheck size={28} />} className="mb-1">Seguridad</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
        Controla qué correos pueden crear una cuenta en tu institución y comparte los códigos de
        verificación con quienes deban registrarse.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {puedeGestionarInstitucion && (
            <>
              {/* Dominio autorizado */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
                <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Dominio de correo autorizado</h2>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
                  Solo los correos con este dominio podrán crear una cuenta de Profesor Supervisor o
                  Coordinador. Estudiantes y Centros Duales usan su propio correo — no dependen de este dominio.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={dominio}
                    onChange={(e) => setDominio(e.target.value)}
                    placeholder="tuliceo.cl"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                  />
                  <button
                    onClick={guardarDominio}
                    disabled={guardandoDominio || dominio.trim().toLowerCase() === dominioGuardado}
                    style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                    className="px-5 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {guardandoDominio ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {mensaje && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-3">{mensaje}</p>}
              </div>

              <TarjetaCodigo
                titulo="Código para Profesor Supervisor / Coordinador"
                descripcion={`Entrégalo solo a quien deba crear una cuenta de staff con ese correo institucional. Válido por ${HORAS_VALIDEZ} horas.`}
                icon={<ShieldCheck size={18} style={{ color: "var(--accent-light)" }} />}
                codigo={codigoStaff}
                expirado={staffExpirado}
                generando={generandoStaff}
                onGenerar={generarCodigoStaff}
              />
            </>
          )}

          <TarjetaCodigo
            titulo="Código para Estudiantes y Centros Duales"
            descripcion={`Compártelo con estudiantes y empresas Centro Dual/Maestro Guía para que creen su cuenta — no necesitan un correo del dominio del liceo. Válido por ${HORAS_VALIDEZ} horas.`}
            icon={<GraduationCap size={18} style={{ color: "var(--accent-light)" }} />}
            codigo={codigoExterno}
            expirado={externoExpirado}
            generando={generandoExterno}
            onGenerar={generarCodigoParaExternos}
          />
        </div>
      )}
    </div>
  );
}
