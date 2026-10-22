"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, ChevronRight, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAmbitoMaestroGuia } from "@/lib/permisos/useAmbitoMaestroGuia";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { formatearFecha } from "@/lib/fecha";
import { nombreCompleto } from "@/lib/estudiantes/nombre";
import TituloPagina from "@/components/TituloPagina";
import type { Asignacion, Estudiante } from "@/types";

/** Asignaciones que representan a alguien que hoy está en el centro. Una
 * finalizada o cancelada es historial, no "mi estudiante". */
const VIGENTES: Asignacion["estado"][] = ["asignada", "activa", "en_proceso"];

/**
 * Los estudiantes que el liceo asignó a este Centro Dual.
 *
 * Es la puerta de entrada del rol centro_dual a su propia gente: desde
 * acá se entra a la ficha de cada uno. No lista a nadie más — el ámbito
 * sale de `useAmbitoMaestroGuia`, el mismo que usan el resto de las
 * pantallas y las reglas de Firestore.
 */
export default function MisEstudiantesPage() {
  const { usuario } = useAuth();
  const { asignaciones, cargando: cargandoAmbito } = useAmbitoMaestroGuia();

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  const vigentes = useMemo(
    () => asignaciones.filter((a) => VIGENTES.includes(a.estado)),
    [asignaciones]
  );
  const ids = useMemo(
    () => Array.from(new Set(vigentes.map((a) => a.estudianteId))).join(","),
    [vigentes]
  );

  useEffect(() => {
    if (cargandoAmbito) return;
    const lista = ids ? ids.split(",") : [];
    if (lista.length === 0) { setEstudiantes([]); setCargando(false); return; }
    let cancelado = false;
    setCargando(true);
    obtenerDocumentosPorId<Estudiante>("estudiantes", lista)
      .then((docs) => { if (!cancelado) setEstudiantes(docs); })
      .catch(() => { if (!cancelado) setEstudiantes([]); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [ids, cargandoAmbito]);

  if (usuario && usuario.rol !== "centro_dual") {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">
          Esta vista es del Centro Dual. Los estudiantes del liceo están en Estudiantes → Lista de estudiantes.
        </p>
      </div>
    );
  }

  const ocupado = cargando || cargandoAmbito;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6">
      <div>
        <TituloPagina icon={<Users size={26} />}>Mis estudiantes</TituloPagina>
        <p style={{ color: "var(--text-muted)" }} className="text-sm mt-2">
          Los estudiantes que el liceo asignó a tu centro. Entra a cada uno para ver sus faltas,
          avisar de una ausencia o dejar una observación.
        </p>
      </div>

      {ocupado && <p style={{ color: "var(--text-muted)" }} className="text-sm">Cargando...</p>}

      {!ocupado && estudiantes.length === 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-8 text-center">
          <GraduationCap size={24} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-secondary)" }} className="text-sm font-medium">
            Todavía no tienes estudiantes asignados
          </p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
            Las asignaciones las hace el liceo. Cuando te asignen a alguien, aparecerá acá.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {estudiantes.map((e) => {
          const asignacion = vigentes.find((a) => a.estudianteId === e.id);
          return (
            <Link
              key={e.id}
              href={`/dashboard/centros/estudiantes/${e.id}`}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}
              className="p-4 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors"
            >
              <span
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              >
                {(e.nombres?.[0] ?? "") + (e.apellidoPaterno?.[0] ?? e.apellidos?.[0] ?? "")}
              </span>
              <span className="min-w-0 flex-1">
                <span style={{ color: "var(--text-primary)" }} className="text-sm font-semibold block truncate">
                  {nombreCompleto(e)}
                </span>
                <span style={{ color: "var(--text-muted)" }} className="text-xs block truncate">
                  {[e.nivel, e.curso].filter(Boolean).join(" · ") || "Sin curso registrado"}
                </span>
                {asignacion?.fechaInicio && (
                  <span style={{ color: "var(--text-muted)" }} className="text-[11px] block truncate">
                    Desde el {formatearFecha(asignacion.fechaInicio)}
                  </span>
                )}
              </span>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
