"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Building2, Bell, SlidersHorizontal } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import PaginaVacia from "@/components/PaginaVacia";
import type { Liceo } from "@/types";

const LICEO_VACIO: Omit<Liceo, "id" | "dominioCorreo"> = {
  nombre: "", rbd: "", direccion: "", comuna: "", region: "", telefono: "", email: "",
};

interface Notificaciones {
  mensajesNuevos: boolean;
  documentosNuevos: boolean;
}

const NOTIFICACIONES_DEFAULT: Notificaciones = { mensajesNuevos: true, documentosNuevos: true };

export default function ConfiguracionPage() {
  const { usuario } = useAuth();
  const [liceo, setLiceo] = useState(LICEO_VACIO);
  const [notificaciones, setNotificaciones] = useState<Notificaciones>(NOTIFICACIONES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [guardandoLiceo, setGuardandoLiceo] = useState(false);
  const [mensajeLiceo, setMensajeLiceo] = useState("");

  const puedeAcceder = usuario?.rol === "administrador" || usuario?.rol === "director";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const liceoSnap = await getDoc(doc(db, "liceos", usuario.liceoId));
    if (liceoSnap.exists()) {
      const d = liceoSnap.data() as Liceo;
      setLiceo({
        nombre: d.nombre ?? "", rbd: d.rbd ?? "", direccion: d.direccion ?? "",
        comuna: d.comuna ?? "", region: d.region ?? "", telefono: d.telefono ?? "", email: d.email ?? "",
      });
    }
    const prefSnap = await getDoc(doc(db, "usuarios", usuario.uid));
    const prefs = prefSnap.exists() ? prefSnap.data().notificaciones : null;
    if (prefs) setNotificaciones({ ...NOTIFICACIONES_DEFAULT, ...prefs });
    setLoading(false);
  }

  useEffect(() => {
    if (usuario && puedeAcceder) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function guardarLiceo() {
    if (!usuario) return;
    setGuardandoLiceo(true);
    setMensajeLiceo("");
    try {
      await setDoc(doc(db, "liceos", usuario.liceoId), { id: usuario.liceoId, ...liceo }, { merge: true });
      setMensajeLiceo("Datos del liceo actualizados.");
    } catch {
      setMensajeLiceo("No se pudieron guardar los datos.");
    } finally {
      setGuardandoLiceo(false);
    }
  }

  async function cambiarNotificacion(clave: keyof Notificaciones) {
    if (!usuario) return;
    const nuevas = { ...notificaciones, [clave]: !notificaciones[clave] };
    setNotificaciones(nuevas);
    await setDoc(doc(db, "usuarios", usuario.uid), { notificaciones: nuevas }, { merge: true });
  }

  if (!usuario) return null;

  if (!puedeAcceder) {
    return (
      <PaginaVacia
        icon={<SlidersHorizontal size={28} />}
        titulo="Configuración"
        descripcion="Ajustes generales de la aplicación para tu institución."
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={<SlidersHorizontal size={28} />} className="mb-1">Configuración</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
        Ajustes generales de la aplicación para tu institución.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Datos del liceo */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} style={{ color: "var(--accent-light)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">Datos del liceo</h2>
            </div>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              Esta información aparecerá en documentos y comunicaciones generadas por el sistema.
            </p>

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
              disabled={guardandoLiceo}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity mt-4"
            >
              {guardandoLiceo ? "Guardando..." : "Guardar cambios"}
            </button>
            {mensajeLiceo && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-3">{mensajeLiceo}</p>}
          </div>

          {/* Notificaciones */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bell size={18} style={{ color: "var(--accent-light)" }} />
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">Notificaciones</h2>
            </div>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              Elige qué avisos quieres recibir dentro de SIGEDUAL.
            </p>

            <div className="flex flex-col gap-3">
              {[
                { key: "mensajesNuevos" as const, label: "Mensajes nuevos" },
                { key: "documentosNuevos" as const, label: "Documentos nuevos" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span style={{ color: "var(--text-primary)" }} className="text-sm">{label}</span>
                  <button
                    onClick={() => cambiarNotificacion(key)}
                    style={{ background: notificaciones[key] ? "var(--accent)" : "var(--bg-surface)", border: "1px solid var(--border-light)" }}
                    className="w-11 h-6 rounded-full relative transition-colors"
                  >
                    <span
                      style={{ background: "#fff", left: notificaciones[key] ? 22 : 3, top: 2 }}
                      className="absolute w-4 h-4 rounded-full transition-all"
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
