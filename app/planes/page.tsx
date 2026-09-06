"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlanesComerciales } from "@/lib/planesComerciales/usePlanesComerciales";
import { useCaracteristicasComerciales } from "@/lib/planesComerciales/useCaracteristicasComerciales";
import { formatearCLP, ETIQUETA_PERIODICIDAD, SUFIJO_PERIODICIDAD, DESCRIPCION_ACCESO } from "@/lib/planesComerciales";
import type { PlanComercial } from "@/types";
import { Star, Check, ArrowLeft } from "lucide-react";

function TarjetaPlan({ plan, onElegir }: { plan: PlanComercial; onElegir: () => void }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: plan.recomendado ? "2px solid var(--accent)" : "1px solid var(--border)",
      }}
      className="rounded-2xl p-6 flex flex-col relative"
    >
      {plan.recomendado && (
        <span
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide"
        >
          <Star size={11} /> Recomendado
        </span>
      )}

      <h3 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">{plan.nombre}</h3>
      <p style={{ color: "var(--text-secondary)" }} className="text-xs mb-4">{ETIQUETA_PERIODICIDAD[plan.periodicidad]}</p>

      <div className="mb-4">
        <span style={{ color: "var(--text-primary)" }} className="text-3xl font-black">{formatearCLP(plan.precio)}</span>
        <span style={{ color: "var(--text-muted)" }} className="text-sm ml-1">{SUFIJO_PERIODICIDAD[plan.periodicidad]}</span>
      </div>

      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-1">{plan.descripcion || DESCRIPCION_ACCESO[plan.periodicidad]}</p>
      {plan.textoDestacado && (
        <p style={{ color: "var(--accent-light)" }} className="text-xs font-semibold mt-1 mb-2">{plan.textoDestacado}</p>
      )}
      {plan.informacionAdicional && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">{plan.informacionAdicional}</p>
      )}

      <div className="flex-1" />

      <button
        onClick={onElegir}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        className="mt-5 w-full py-3 rounded-xl text-sm font-semibold cursor-not-allowed"
      >
        Elegir plan
      </button>
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] text-center mt-2">Contratación próximamente</p>
    </div>
  );
}

export default function PlanesPage() {
  const { planes, cargando } = usePlanesComerciales();
  const { items: caracteristicas } = useCaracteristicasComerciales();
  const [mostrarProximamente, setMostrarProximamente] = useState(false);

  const planesVisibles = planes.filter((p) => p.estado !== "inactivo").sort((a, b) => a.orden - b.orden);

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={36} height={36} className="w-9 h-9 object-contain flex-shrink-0" />
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: "var(--text-primary)" }}>SIG</span>
            <span style={{ color: "#C8102E" }}>e</span>
            <span style={{ color: "var(--text-primary)" }}>DUAL</span>
          </span>
        </div>
        <Link href="/login" style={{ color: "var(--text-secondary)" }} className="text-sm font-medium hover:underline">
          Iniciar sesión
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl sm:text-4xl font-black mb-3">Planes SIGEDUAL</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm sm:text-base">
            SIGEDUAL es la plataforma para administrar la Formación Profesional Dual de tu institución.
            Es el mismo servicio en los tres planes — la única diferencia es el período de contratación.
          </p>
        </div>

        {cargando ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm text-center">Cargando planes...</p>
        ) : planesVisibles.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-10 text-center max-w-md mx-auto">
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Todavía no hay planes publicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {planesVisibles.map((plan) => (
              <TarjetaPlan key={plan.id} plan={plan} onElegir={() => setMostrarProximamente(true)} />
            ))}
          </div>
        )}

        {caracteristicas.length > 0 && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-4 text-center">¿Qué incluye SIGEDUAL?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {caracteristicas.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check size={15} style={{ color: "var(--success)" }} className="flex-shrink-0" />
                  <span style={{ color: "var(--text-secondary)" }} className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {mostrarProximamente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setMostrarProximamente(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Contratación próximamente"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">Contratación próximamente</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Actualmente estamos preparando el sistema de contratación y pagos de SIGEDUAL. Esta opción estará disponible próximamente.
            </p>
            <button
              onClick={() => setMostrarProximamente(false)}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 flex items-center justify-center gap-4">
        <Link href="/login" style={{ color: "var(--text-muted)" }} className="inline-flex items-center gap-1.5 text-xs hover:underline">
          <ArrowLeft size={12} /> Volver a SIGEDUAL
        </Link>
        <span style={{ color: "var(--text-muted)" }} className="text-xs">·</span>
        <Link href="/pago" style={{ color: "var(--text-muted)" }} className="text-xs hover:underline">
          Ver proceso de pago (próximamente)
        </Link>
      </footer>
    </div>
  );
}
