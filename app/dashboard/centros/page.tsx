"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estadoEfectivo } from "@/lib/compatibilidad";
import type { CentroDual } from "@/types";
import { Eye, Pencil } from "lucide-react";

const ESTADO_LABEL: Record<string, string> = { activo: "Activo", inactivo: "Inactivo", en_revision: "En revisión" };
const ESTADO_COLOR: Record<string, string> = { activo: "var(--success)", inactivo: "var(--danger)", en_revision: "var(--warning)" };

export default function CentrosPage() {
  const { usuario } = useAuth();
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

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

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este centro dual? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "centros_duales", id));
    cargar();
  }

  const filtrados = centros.filter((c) =>
    `${c.nombre} ${c.rut ?? ""} ${c.maestroGuia ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Centros Duales</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{filtrados.length} centro(s) registrado(s)</p>
        </div>
        {puedeEditar && (
          <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center">
            + Agregar centro
          </Link>
        )}
      </div>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar centro, RUT o maestro guía..."
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="w-full px-4 py-3 rounded-xl text-sm mb-6 outline-none focus:[border-color:var(--accent)] transition-colors" />

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay centros duales registrados aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map((c) => {
            const estado = estadoEfectivo(c);
            return (
              <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-6 hover:[border-color:var(--accent)] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 style={{ color: "var(--text-primary)" }} className="font-semibold">{c.nombre}</h3>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">RUT: {c.rut || "No registrado"}</p>
                  </div>
                  <span style={{ background: ESTADO_COLOR[estado] + "22", color: ESTADO_COLOR[estado] }} className="text-xs px-2 py-1 rounded-full flex-shrink-0">
                    {ESTADO_LABEL[estado]}
                  </span>
                </div>
                <div className="space-y-1">
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs">📍 {c.direccion}, {c.comuna}</p>
                  {c.telefono && <p style={{ color: "var(--text-secondary)" }} className="text-xs">📞 {c.telefono}</p>}
                  {c.email && <p style={{ color: "var(--text-secondary)" }} className="text-xs">✉️ {c.email}</p>}
                </div>
                <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <Link href={`/dashboard/centros/${c.id}`} style={{ color: "var(--accent-light)" }} className="flex items-center gap-1.5 text-xs hover:underline">
                    <Eye size={13} />
                    Ver ficha
                  </Link>
                  {puedeEditar && (
                    <>
                      <Link href={`/dashboard/centros/${c.id}/editar`} style={{ color: "var(--text-secondary)" }} className="flex items-center gap-1.5 text-xs hover:underline">
                        <Pencil size={13} />
                        Editar
                      </Link>
                      <button onClick={() => eliminar(c.id)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
