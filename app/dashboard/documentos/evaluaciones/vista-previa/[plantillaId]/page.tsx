"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { plantillaEvaluacionPorId } from "@/lib/evaluaciones";
import { NIVELES_LOGRO } from "@/lib/evaluaciones/tipos";
import TituloPagina from "@/components/TituloPagina";
import LeyendaNiveles from "@/components/evaluaciones/LeyendaNiveles";
import { ArrowLeft, Eye } from "lucide-react";

function NivelesSoloLectura() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {NIVELES_LOGRO.map((n) => (
        <span key={n.value} className="flex items-center gap-1.5" title={n.descripcion}>
          <span style={{ border: "1px solid var(--border-light)", color: "transparent" }} className="w-3.5 h-3.5 rounded-full inline-block" />
          <span style={{ color: "var(--text-muted)" }} className="text-sm">{n.label}</span>
        </span>
      ))}
      <LeyendaNiveles />
    </div>
  );
}

export default function VistaPreviaEvaluacionPage() {
  const { plantillaId } = useParams<{ plantillaId: string }>();
  const plantilla = plantillaEvaluacionPorId(plantillaId);

  if (!plantilla) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Evaluación no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/documentos/evaluaciones" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <TituloPagina icon={<Eye size={28} />}>Vista previa</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{plantilla.nombre} · {plantilla.especialidad} · {plantilla.nivel}</p>
        </div>
      </div>

      <div style={{ background: "var(--warning)22", border: "1px solid var(--warning)" }} className="rounded-xl px-4 py-3 mb-6">
        <p style={{ color: "var(--text-secondary)" }} className="text-xs">Esta es una vista previa de solo lectura — no se puede completar ni guardar desde aquí.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-2">{plantilla.titulo}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p style={{ color: "var(--text-secondary)" }}>Estudiante: <span style={{ color: "var(--text-muted)" }} className="italic">(se completa al seleccionar)</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Empresa/Centro Dual: <span style={{ color: "var(--text-muted)" }} className="italic">(automático)</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Maestro Guía: <span style={{ color: "var(--text-muted)" }} className="italic">(automático)</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Fecha: <span style={{ color: "var(--text-muted)" }} className="italic">(hoy, editable)</span></p>
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Logros en las actividades — {plantilla.porcentajeLogros}%</p>
          <div className="flex flex-col gap-6">
            {plantilla.categoriasLogros.map((cat) => (
              <div key={cat.id}>
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-3">{cat.titulo}</p>
                {cat.permiteTareasDinamicas ? (
                  <p style={{ color: "var(--text-muted)" }} className="text-xs italic">El Maestro Guía agrega aquí las tareas adicionales que correspondan.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {cat.criterios.map((criterio) => (
                      <div key={criterio.id}>
                        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                        <NivelesSoloLectura />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Desarrollo Personal — {plantilla.porcentajeDesarrolloPersonal}%</p>
          <div className="flex flex-col gap-4">
            {plantilla.criteriosDesarrolloPersonal.map((criterio) => (
              <div key={criterio.id}>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-2">{criterio.texto}</p>
                <NivelesSoloLectura />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-3">Observaciones</p>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-lg h-20" />
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-5">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-4">Resultado</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <p style={{ color: "var(--text-secondary)" }}>Logros en actividades: <span style={{ color: "var(--text-muted)" }}>—%</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Desarrollo personal: <span style={{ color: "var(--text-muted)" }}>—%</span></p>
            <p style={{ color: "var(--text-secondary)" }}>Promedio general: <span style={{ color: "var(--text-muted)" }}>—%</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
