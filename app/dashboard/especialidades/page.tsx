"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import TituloPagina from "@/components/TituloPagina";
import { GraduationCap } from "lucide-react";
import type { Especialidad } from "@/types";

export default function EspecialidadesPage() {
  const { usuario } = useAuth();
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador";

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId));
    const snap = await getDocs(q);
    setEspecialidades(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
    setLoading(false);
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !usuario) return;
    setGuardando(true);
    await addDoc(collection(db, "especialidades"), { nombre: nombre.trim(), liceoId: usuario.liceoId });
    setNombre(""); cargar();
    setGuardando(false);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta especialidad?")) return;
    await deleteDoc(doc(db, "especialidades", id));
    cargar();
  }

  if (!["administrador", "coordinador", "director"].includes(usuario?.rol ?? "")) {
    return <div className="p-4 md:p-8"><p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <TituloPagina icon={<GraduationCap size={28} />}>Especialidades</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Carreras técnico-profesionales del establecimiento</p>
      </div>

      {puedeEditar && (
        <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la especialidad (ej: Contabilidad)"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          <button type="submit" disabled={guardando || !nombre.trim()} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 sm:w-auto w-full">
            {guardando ? "Agregando..." : "Agregar"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : especialidades.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay especialidades registradas aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {especialidades.map((esp) => (
            <div key={esp.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎓</span>
                <p style={{ color: "var(--text-primary)" }} className="font-medium text-sm">{esp.nombre}</p>
              </div>
              {puedeEditar && (
                <button onClick={() => eliminar(esp.id)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
