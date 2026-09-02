"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { LifeBuoy, Mail, Phone, MapPin, Clock, Info, Pencil, Check } from "lucide-react";
import type { Soporte } from "@/types";

const VACIO: Omit<Soporte, "liceoId"> = {
  nombre: "", cargo: "", correo: "", telefono: "", direccion: "", horario: "", notas: "",
};

export default function SoportePage() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<Omit<Soporte, "liceoId">>(VACIO);
  const [form, setForm] = useState<Omit<Soporte, "liceoId">>(VACIO);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador";

  useEffect(() => {
    if (usuario) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const snap = await getDoc(doc(db, "soporte", usuario.liceoId));
    if (snap.exists()) {
      const d = snap.data() as Soporte;
      const cargados = {
        nombre: d.nombre ?? "", cargo: d.cargo ?? "", correo: d.correo ?? "",
        telefono: d.telefono ?? "", direccion: d.direccion ?? "", horario: d.horario ?? "", notas: d.notas ?? "",
      };
      setDatos(cargados);
      setForm(cargados);
    }
    setLoading(false);
  }

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, "soporte", usuario.liceoId), { liceoId: usuario.liceoId, ...form }, { merge: true });
      setDatos(form);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    setForm(datos);
    setEditando(false);
  }

  if (!usuario) return null;

  const CAMPOS: { key: keyof typeof VACIO; label: string; icon: React.ReactNode; span?: boolean }[] = [
    { key: "correo", label: "Correo electrónico", icon: <Mail size={14} /> },
    { key: "telefono", label: "Teléfono de contacto", icon: <Phone size={14} /> },
    { key: "direccion", label: "Dirección", icon: <MapPin size={14} /> },
    { key: "horario", label: "Horario de atención", icon: <Clock size={14} /> },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <div style={{ background: "#14b8a622", borderRadius: 12 }} className="w-11 h-11 flex items-center justify-center flex-shrink-0">
          <LifeBuoy size={20} style={{ color: "#14b8a6" }} />
        </div>
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Contacto de soporte</h1>
      </div>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8 ml-14">
        Información de contacto del administrador del sistema.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Encargado */}
          {editando ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 flex flex-col gap-3">
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre del encargado</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Cargo</label>
                <input
                  value={form.cargo}
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 flex items-center gap-4">
              <div style={{ background: "#14b8a6", borderRadius: 12 }} className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{(datos.nombre || "?").charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold truncate">{datos.nombre || "Sin definir"}</p>
                <p style={{ color: "#14b8a6" }} className="text-sm truncate">{datos.cargo || "Sin definir"}</p>
              </div>
            </div>
          )}

          {/* Campos de contacto */}
          <div className="grid sm:grid-cols-2 gap-4">
            {CAMPOS.map(({ key, label, icon }) => (
              <div key={key} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ color: "#14b8a6" }}>{icon}</span>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wider">{label}</p>
                </div>
                {editando ? (
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors mt-1"
                  />
                ) : (
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{datos[key] || "—"}</p>
                )}
              </div>
            ))}
          </div>

          {/* Notas */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info size={14} style={{ color: "#14b8a6" }} />
              <p style={{ color: "var(--text-muted)" }} className="text-xs font-semibold uppercase tracking-wider">Notas adicionales</p>
            </div>
            {editando ? (
              <textarea
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={3}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors mt-1 resize-none"
              />
            ) : (
              <p style={{ color: "var(--text-primary)" }} className="text-sm">{datos.notas || "—"}</p>
            )}
          </div>

          {/* Acciones (solo director/administrador) */}
          {puedeEditar && (
            <div className="flex gap-3">
              {editando ? (
                <>
                  <button
                    onClick={cancelar}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardar}
                    disabled={guardando}
                    style={{ background: "var(--accent-blue)" }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    <Check size={15} />
                    {guardando ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditando(true)}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-blue-500/50 transition-colors"
                >
                  <Pencil size={15} />
                  Editar información
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
