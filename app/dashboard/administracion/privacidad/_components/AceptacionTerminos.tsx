"use client";
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { CheckCircle2 } from "lucide-react";

/** Zona de aceptación, conceptualmente separada de la sola lectura del
 * documento. Se asocia al usuario autenticado y registra fecha/hora reales
 * en su propio documento (usuarios/{uid}) — no se inventa una versión del
 * documento ni una fecha de entrada en vigencia que no fue entregada. */
export default function AceptacionTerminos() {
  const { usuario, refrescarUsuario } = useAuth();
  const avisar = useFeedback();
  const [marcado, setMarcado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!usuario) return null;

  const yaAceptado = usuario.terminosAceptados?.aceptado;

  async function aceptar() {
    if (!usuario || !marcado || guardando) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, "usuarios", usuario.uid), {
        terminosAceptados: { aceptado: true, fecha: new Date().toISOString() },
      });
      await refrescarUsuario();
      avisar("Aceptación registrada correctamente.");
    } catch {
      avisar("No se pudo registrar tu aceptación. Inténtalo nuevamente.", "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6 print:hidden">
      {yaAceptado ? (
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Ya aceptaste este documento.</p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
              {new Date(usuario.terminosAceptados!.fecha).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>
      ) : (
        <>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marcado}
              onChange={(e) => setMarcado(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0"
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ color: "var(--text-primary)" }} className="text-sm">
              Declaro haber leído y acepto los Términos, Condiciones y Política de Privacidad de SIGEDUAL.
            </span>
          </label>
          <button
            onClick={aceptar}
            disabled={!marcado || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {guardando ? "Guardando..." : "Aceptar y continuar"}
          </button>
        </>
      )}
    </div>
  );
}
