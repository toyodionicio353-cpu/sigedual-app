"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { CentroDual } from "@/types";

const EMPTY: Omit<CentroDual, "id" | "liceoId" | "activo"> = {
  nombre: "", rut: "", direccion: "", comuna: "", telefono: "",
  email: "", maestroGuia: "", telefonoMaestro: "", emailMaestro: "", especialidades: [],
};

export default function CentrosPage() {
  const { usuario } = useAuth();
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId));
    const snap = await getDocs(q);
    setCentros(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
    setLoading(false);
  }

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "centros_duales", editId), { ...form });
      } else {
        await addDoc(collection(db, "centros_duales"), {
          ...form, liceoId: usuario.liceoId, activo: true,
        });
      }
      setModal(false); setForm(EMPTY); setEditId(null); cargar();
    } finally { setGuardando(false); }
  }

  function abrirEditar(c: CentroDual) {
    setForm({ nombre: c.nombre, rut: c.rut, direccion: c.direccion, comuna: c.comuna, telefono: c.telefono ?? "", email: c.email ?? "", maestroGuia: c.maestroGuia, telefonoMaestro: c.telefonoMaestro ?? "", emailMaestro: c.emailMaestro ?? "", especialidades: c.especialidades });
    setEditId(c.id); setModal(true);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este centro dual?")) return;
    await deleteDoc(doc(db, "centros_duales", id));
    cargar();
  }

  const filtrados = centros.filter((c) =>
    `${c.nombre} ${c.rut} ${c.maestroGuia}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Centros Duales</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{filtrados.length} centro(s) registrado(s)</p>
        </div>
        {puedeEditar && (
          <button onClick={() => { setForm(EMPTY); setEditId(null); setModal(true); }} style={{ background: "var(--accent-blue)" }} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            + Agregar centro
          </button>
        )}
      </div>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar centro, RUT o maestro guía..."
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="w-full px-4 py-3 rounded-xl text-sm mb-6 outline-none focus:border-blue-500 transition-colors" />

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay centros duales registrados aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map((c) => (
            <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 style={{ color: "var(--text-primary)" }} className="font-semibold">{c.nombre}</h3>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">RUT: {c.rut}</p>
                </div>
                <span style={{ background: c.activo ? "#22c55e22" : "#ef444422", color: c.activo ? "var(--success)" : "var(--danger)" }} className="text-xs px-2 py-1 rounded-full">
                  {c.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="space-y-1">
                <p style={{ color: "var(--text-secondary)" }} className="text-xs">📍 {c.direccion}, {c.comuna}</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-xs">👤 Maestro guía: {c.maestroGuia}</p>
                {c.telefono && <p style={{ color: "var(--text-secondary)" }} className="text-xs">📞 {c.telefono}</p>}
                {c.email && <p style={{ color: "var(--text-secondary)" }} className="text-xs">✉️ {c.email}</p>}
              </div>
              {puedeEditar && (
                <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => abrirEditar(c)} style={{ color: "var(--accent-blue-light)" }} className="text-xs hover:underline">Editar</button>
                  <button onClick={() => eliminar(c.id)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-lg rounded-2xl p-5 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-6">{editId ? "Editar centro" : "Agregar centro dual"}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: "nombre", label: "Nombre del centro", placeholder: "Empresa S.A." },
                { key: "rut", label: "RUT", placeholder: "76.123.456-7" },
                { key: "direccion", label: "Dirección", placeholder: "Av. Principal 123" },
                { key: "comuna", label: "Comuna", placeholder: "Santiago" },
                { key: "telefono", label: "Teléfono", placeholder: "+56 2 1234 5678" },
                { key: "email", label: "Correo", placeholder: "contacto@empresa.cl" },
                { key: "maestroGuia", label: "Maestro guía", placeholder: "Carlos Soto" },
                { key: "telefonoMaestro", label: "Teléfono maestro", placeholder: "+56 9 8765 4321" },
                { key: "emailMaestro", label: "Correo maestro", placeholder: "carlos@empresa.cl" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
                  <input value={(form as unknown as Record<string, string>)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(false); setEditId(null); }} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ background: "var(--accent-blue)" }} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50">
                {guardando ? "Guardando..." : editId ? "Guardar cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
