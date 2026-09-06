"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import TituloPagina from "@/components/TituloPagina";
import { formatearFecha } from "@/lib/fecha";
import type { Liceo } from "@/types";
import { Package, ExternalLink } from "lucide-react";

const ETIQUETA_PLAN: Record<NonNullable<Liceo["planEstado"]>, string> = {
  demo: "Demostración",
  sin_plan: "Sin plan contratado",
  activo: "Plan activo",
  cancelado: "Plan cancelado",
  vencido: "Plan vencido",
};

const ETIQUETA_ESTADO: Record<NonNullable<Liceo["planEstado"]>, string> = {
  demo: "Activo (prueba gratuita)",
  sin_plan: "Contratación próximamente",
  activo: "Activo",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export default function PlanSigedualPage() {
  const { usuario } = useAuth();
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    getDoc(doc(db, "liceos", usuario.liceoId)).then((snap) => {
      setLiceo(snap.exists() ? ({ id: snap.id, ...snap.data() } as Liceo) : null);
      setCargando(false);
    });
  }, [usuario]);

  if (!usuario) return null;
  if (!["administrador", "director"].includes(usuario.rol)) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const planEstado = liceo?.planEstado ?? "sin_plan";
  const tienePlanContratado = Boolean(liceo?.planContratadoId);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={<Package size={28} />} className="mb-1">Plan SIGEDUAL</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
        Mi Plan — estado de la suscripción de tu institución en SIGEDUAL.
      </p>

      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-y-3 text-sm mb-6">
            <dt style={{ color: "var(--text-muted)" }}>Plan actual</dt>
            <dd style={{ color: "var(--text-primary)" }} className="font-semibold">
              {tienePlanContratado ? liceo?.planContratadoNombre : ETIQUETA_PLAN[planEstado]}
            </dd>
            <dt style={{ color: "var(--text-muted)" }}>Estado</dt>
            <dd style={{ color: "var(--text-primary)" }} className="font-semibold">{ETIQUETA_ESTADO[planEstado]}</dd>
            {tienePlanContratado && liceo?.planFechaInicio && (
              <>
                <dt style={{ color: "var(--text-muted)" }}>Fecha de inicio</dt>
                <dd style={{ color: "var(--text-primary)" }}>{formatearFecha(liceo.planFechaInicio)}</dd>
              </>
            )}
            {tienePlanContratado && liceo?.planFechaTermino && (
              <>
                <dt style={{ color: "var(--text-muted)" }}>Fecha de término</dt>
                <dd style={{ color: "var(--text-primary)" }}>{formatearFecha(liceo.planFechaTermino)}</dd>
              </>
            )}
          </dl>

          {!tienePlanContratado && planEstado !== "demo" && (
            <Link
              href="/planes"
              target="_blank"
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mb-4"
            >
              <ExternalLink size={15} />
              Ver planes disponibles
            </Link>
          )}

          <div>
            <button
              disabled
              title="La gestión de suscripciones en línea todavía no está disponible en SIGEDUAL."
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed"
            >
              Cancelar plan
            </button>
          </div>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-3">
            Pendiente de integración: la administración de planes, facturación y pagos en línea de
            SIGEDUAL todavía no está disponible. Este panel queda preparado para conectarse a ese
            sistema una vez exista.
          </p>
        </div>
      )}
    </div>
  );
}
