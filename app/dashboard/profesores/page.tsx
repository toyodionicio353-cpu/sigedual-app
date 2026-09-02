"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Usuario } from "@/types";

export default function ProfesoresPage() {
  const { usuario } = useAuth();
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId), where("rol", "==", "profesor"));
    const snap = await getDocs(q);
    setProfesores(snap.docs.map((d) => d.data() as Usuario));
    setLoading(false);
  }

  const filtrados = profesores.filter((p) =>
    `${p.nombre} ${p.especialidad} ${p.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (!["administrador", "coordinador", "director"].includes(usuario?.rol ?? "")) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Profesores Supervisores</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{filtrados.length} profesor(es)</p>
      </div>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, especialidad o correo..."
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="w-full px-4 py-3 rounded-xl text-sm mb-6 outline-none focus:[border-color:var(--accent)] transition-colors" />

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay profesores registrados.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2">Crea usuarios con rol "Profesor Supervisor" en la sección Usuarios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map((p) => (
            <div key={p.uid} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm">
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ color: "var(--text-primary)" }} className="font-semibold text-sm">{p.nombre}</p>
                  <p style={{ color: "var(--accent-light)" }} className="text-xs">{p.especialidad || "Sin especialidad asignada"}</p>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs">✉️ {p.email}</p>
              <div className="mt-3">
                <span style={{ color: p.activo ? "var(--success)" : "var(--danger)", background: (p.activo ? "var(--success)" : "var(--danger)") + "22" }}
                  className="text-xs px-3 py-1 rounded-full">{p.activo ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
