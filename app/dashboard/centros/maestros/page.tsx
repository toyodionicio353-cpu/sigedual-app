"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { CentroDual, MaestroGuia } from "@/types";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function ListaMaestrosGuiaPage() {
  const { usuario } = useAuth();
  const [maestros, setMaestros] = useState<MaestroGuia[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCentroId, setFiltroCentroId] = useState("");

  const puedeAgregar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setLoading(true);
      const [snapMg, snapCentros] = await Promise.all([
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setMaestros(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setLoading(false);
    }
    cargar();
  }, [usuario]);

  function centroNombre(id: string): string {
    return centros.find((c) => c.id === id)?.nombre || "Centro no encontrado";
  }

  const filtrados = useMemo(() => {
    let base = maestros;
    if (filtroCentroId) base = base.filter((m) => m.centroDualId === filtroCentroId);
    if (busqueda.trim()) {
      const q = normalizar(busqueda);
      const qAlfanum = soloAlfanumerico(busqueda);
      base = base.filter((m) => {
        const nombreCompleto = `${m.nombres} ${m.apellidoPaterno} ${m.apellidoMaterno ?? ""}`;
        const coincideNombre = normalizar(nombreCompleto).includes(q);
        const coincideRut = qAlfanum.length > 0 && soloAlfanumerico(m.run).includes(qAlfanum);
        return coincideNombre || coincideRut;
      });
    }
    return [...base].sort((a, b) => `${a.nombres} ${a.apellidoPaterno}`.localeCompare(`${b.nombres} ${b.apellidoPaterno}`));
  }, [maestros, busqueda, filtroCentroId]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Maestros guía</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Personas de los centros duales que acompañan a los estudiantes.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href="/dashboard/centros"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={16} />
            Centros duales
          </Link>
          {puedeAgregar && (
            <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
        </div>
        <select
          value={filtroCentroId}
          onChange={(e) => setFiltroCentroId(e.target.value)}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
          className="px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
        >
          <option value="">Todos los centros</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : maestros.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay maestros guía registrados</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Registra el primer maestro guía asociado a un centro dual.</p>
          {puedeAgregar && (
            <Link href="/dashboard/centros/maestros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              + Agregar maestro guía
            </Link>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No encontramos maestros guía que coincidan con tu búsqueda.</p>
          <button onClick={() => { setBusqueda(""); setFiltroCentroId(""); }} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-5 py-2.5 rounded-xl text-sm font-medium mt-4">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          {filtrados.map((m, i) => (
            <Link
              key={m.id}
              href={`/dashboard/centros/maestros/${m.id}`}
              style={{ borderBottom: i < filtrados.length - 1 ? "1px solid var(--border)" : "none" }}
              className="flex items-center justify-between gap-3 px-5 py-4 hover:[background:var(--hover-overlay)] transition-colors"
            >
              <div className="min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{m.nombres} {m.apellidoPaterno} {m.apellidoMaterno}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{centroNombre(m.centroDualId)} · {m.cargo}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span style={{ color: m.estado === "activo" ? "var(--success)" : "var(--danger)", background: (m.estado === "activo" ? "var(--success)" : "var(--danger)") + "22" }} className="text-xs px-2 py-1 rounded-full">
                  {m.estado === "activo" ? "Activo" : "Inactivo"}
                </span>
                <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
