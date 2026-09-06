"use client";
import Link from "next/link";
import Image from "next/image";
import { CreditCard, ArrowLeft } from "lucide-react";

/**
 * Sección "Pago" — visualmente preparada, intencionalmente inactiva. No hay
 * ninguna pasarela conectada ni transacción posible desde acá (ver punto 8
 * del pedido de "sección comercial"). Cuando exista el sistema de pagos
 * real, este es el lugar donde debería vivir el resumen de contratación
 * (plan, período, precio, datos de facturación, método de pago,
 * confirmación) sin tener que rediseñar la página.
 */
export default function PagoPage() {
  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 sm:p-10 shadow-2xl text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={36} height={36} className="w-9 h-9 object-contain flex-shrink-0" />
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: "var(--text-primary)" }}>SIG</span>
            <span style={{ color: "#C8102E" }}>e</span>
            <span style={{ color: "var(--text-primary)" }}>DUAL</span>
          </span>
        </div>

        <div style={{ background: "var(--bg-surface)", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={26} style={{ color: "var(--text-muted)" }} />
        </div>

        <span
          style={{ background: "var(--accent)22", color: "var(--accent-light)" }}
          className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3"
        >
          Próximamente
        </span>

        <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold mb-2">Pago</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          Esta sección estará disponible próximamente. SIGEDUAL está preparando su sistema de
          contratación y pagos.
        </p>

        <Link href="/planes" style={{ color: "var(--text-secondary)" }} className="flex items-center justify-center gap-2 text-sm hover:underline">
          <ArrowLeft size={14} />
          Volver a Planes SIGEDUAL
        </Link>
      </div>
    </div>
  );
}
