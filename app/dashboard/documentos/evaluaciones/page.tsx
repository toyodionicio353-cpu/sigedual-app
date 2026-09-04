"use client";
import Link from "next/link";
import { PLANTILLAS_EVALUACION } from "@/lib/evaluaciones";
import TituloPagina from "@/components/TituloPagina";
import { ClipboardCheck, Wand2 } from "lucide-react";

export default function EvaluacionesPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <TituloPagina icon={<ClipboardCheck size={28} />}>Evaluaciones</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Evalúa el desempeño de un estudiante en su Centro Dual.
        </p>
      </div>

      {PLANTILLAS_EVALUACION.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No hay evaluaciones disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANTILLAS_EVALUACION.map((p) => (
            <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 flex flex-col gap-3">
              <div>
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{p.nombre}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{p.especialidad} · {p.nivel}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-[11px]">
                  Evaluación Maestro Guía
                </span>
                <span style={{ background: "var(--success)22", color: "var(--success)" }} className="px-2.5 py-1 rounded-full text-[11px]">
                  Activa
                </span>
              </div>
              <Link
                href={`/dashboard/documentos/evaluaciones/realizar/${p.id}`}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Wand2 size={15} /> Realizar evaluación
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
