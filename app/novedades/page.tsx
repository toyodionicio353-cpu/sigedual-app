"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Newspaper } from "lucide-react";
import { useNovedadesPublicas } from "@/lib/novedades/useNovedadesPublicas";
import TarjetaNovedad from "@/components/novedades/TarjetaNovedad";
import Select from "@/components/ui/Select";

/**
 * Noticias y novedades: escaparate público de SIGEDUAL, común a todos los
 * liceos. No pide sesión ni registro — solo se mira.
 */
export default function NovedadesPage() {
  const { novedades, cargando } = useNovedadesPublicas();
  const [liceo, setLiceo] = useState("");

  // Se ofrecen solo los liceos que efectivamente tienen algo publicado:
  // un desplegable con instituciones sin novedades solo lleva a pantallas
  // vacías.
  const liceos = useMemo(() => {
    const vistos = new Map<string, string>();
    novedades.forEach((n) => { if (n.liceoId) vistos.set(n.liceoId, n.liceoNombre || "Liceo"); });
    return Array.from(vistos, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [novedades]);

  const visibles = liceo ? novedades.filter((n) => n.liceoId === liceo) : novedades;

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={40} height={40} className="w-10 h-10 object-contain" />
          <div>
            <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold leading-none">
              Noticias y novedades
            </h1>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1.5">
              Publicaciones de los establecimientos que usan SIGEDUAL
            </p>
          </div>
        </div>

        {liceos.length > 1 && (
          <div className="w-full sm:w-72">
            <Select
              value={liceo}
              onChange={setLiceo}
              ariaLabel="Filtrar por liceo"
              opciones={[
                { value: "", label: "Todos los liceos" },
                ...liceos.map((l) => ({ value: l.id, label: l.nombre })),
              ]}
            />
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        {cargando ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando novedades...</p>
        ) : visibles.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-10 text-center max-w-md mx-auto">
            <Newspaper size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">
              Todavía no hay publicaciones
            </p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
              Cuando un establecimiento publique una novedad, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibles.map((n) => <TarjetaNovedad key={n.id} novedad={n} />)}
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 text-center">
        <Link href="/login" style={{ color: "var(--text-muted)" }} className="inline-flex items-center gap-1.5 text-xs hover:underline">
          <ArrowLeft size={12} /> Volver a SIGEDUAL
        </Link>
      </footer>
    </div>
  );
}
