"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Building2 } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import type { Liceo } from "@/types";

const LICEO_VACIO: Omit<Liceo, "id" | "dominioCorreo"> = {
  nombre: "", rbd: "", direccion: "", comuna: "", region: "", telefono: "", email: "",
};

export default function DatosLiceoPage() {
  const { usuario } = useAuth();
  const [liceo, setLiceo] = useState(LICEO_VACIO);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const puedeAcceder = usuario?.rol === "administrador" || usuario?.rol === "director";

  useEffect(() => {
    if (!usuario || !puedeAcceder) return;
    (async () => {
      setLoading(true);
      const liceoSnap = await getDoc(doc(db, "liceos", usuario.liceoId));
      if (liceoSnap.exists()) {
        const d = liceoSnap.data() as Liceo;
        setLiceo({
          nombre: d.nombre ?? "", rbd: d.rbd ?? "", direccion: d.direccion ?? "",
          comuna: d.comuna ?? "", region: d.region ?? "", telefono: d.telefono ?? "", email: d.email ?? "",
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function guardarLiceo() {
    if (!usuario) return;
    setGuardando(true);
    setMensaje("");
    try {
      await setDoc(doc(db, "liceos", usuario.liceoId), { id: usuario.liceoId, ...liceo }, { merge: true });
      setMensaje("Datos del liceo actualizados.");
    } catch {
      setMensaje("No se pudieron guardar los datos.");
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario) return null;

  if (!puedeAcceder) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={<Building2 size={28} />} className="mb-1">Datos del liceo</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
        Información institucional que aparecerá en documentos y comunicaciones generadas por el sistema.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { key: "nombre", label: "Nombre del liceo", span: true },
              { key: "rbd", label: "RBD" },
              { key: "telefono", label: "Teléfono" },
              { key: "direccion", label: "Dirección", span: true },
              { key: "comuna", label: "Comuna" },
              { key: "region", label: "Región" },
              { key: "email", label: "Correo de contacto", span: true },
            ].map(({ key, label, span }) => (
              <div key={key} className={span ? "sm:col-span-2" : ""}>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
                <input
                  type="text"
                  value={(liceo as Record<string, string>)[key]}
                  onChange={(e) => setLiceo((l) => ({ ...l, [key]: e.target.value }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                />
              </div>
            ))}
          </div>

          <button
            onClick={guardarLiceo}
            disabled={guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity mt-4"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          {mensaje && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-3">{mensaje}</p>}
        </div>
      )}
    </div>
  );
}
