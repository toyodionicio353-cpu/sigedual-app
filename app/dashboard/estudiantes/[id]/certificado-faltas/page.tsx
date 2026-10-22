"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ETIQUETA_JORNADA_CORTA, formatearDias, porFechaDescendente, resumirFaltas } from "@/lib/faltas/calculo";
import { formatearFecha } from "@/lib/fecha";
import type { Asignacion, CentroDual, Especialidad, Estudiante, FaltaDual, Liceo } from "@/types";

/**
 * Certificado de faltas a la Formación Dual, para entregar al estudiante y
 * a su apoderado.
 *
 * Se dibuja como el documento en papel que es —fondo blanco, tipografía
 * con serifa, márgenes de hoja— y no con la interfaz de la aplicación: lo
 * que se entrega tiene que leerse como un certificado, no como una
 * pantalla. Los números no se escriben a mano: salen del mismo cálculo que
 * alimenta el centro de faltas, así el certificado nunca contradice lo que
 * muestra el sistema.
 */
export default function CertificadoFaltasPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();

  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [faltas, setFaltas] = useState<FaltaDual[]>([]);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [especialidad, setEspecialidad] = useState<Especialidad | null>(null);
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [denegado, setDenegado] = useState(false);

  useEffect(() => {
    if (!usuario || !id) return;
    (async () => {
      setCargando(true);
      try {
        const [snapEst, snapFaltas, snapAsig] = await Promise.all([
          getDoc(doc(db, "estudiantes", id)),
          getDocs(query(collection(db, "faltas_dual"), where("estudianteId", "==", id))),
          getDocs(query(collection(db, "asignaciones"), where("estudianteId", "==", id))),
        ]);
        if (!snapEst.exists()) { setDenegado(true); return; }
        const est = { id: snapEst.id, ...snapEst.data() } as Estudiante;
        setEstudiante(est);
        setFaltas(snapFaltas.docs.map((d) => ({ id: d.id, ...d.data() } as FaltaDual)).sort(porFechaDescendente));

        const asignaciones = snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));
        const vigente = asignaciones.find((a) => a.estado === "en_proceso" || a.estado === "asignada") ?? asignaciones[0];

        const [snapCentro, snapEsp, snapLiceo] = await Promise.all([
          vigente ? getDoc(doc(db, "centros_duales", vigente.centroDualId)) : Promise.resolve(null),
          est.especialidadId ? getDoc(doc(db, "especialidades", est.especialidadId)) : Promise.resolve(null),
          est.liceoId ? getDoc(doc(db, "liceos", est.liceoId)) : Promise.resolve(null),
        ]);
        if (snapCentro?.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
        if (snapEsp?.exists()) setEspecialidad({ id: snapEsp.id, ...snapEsp.data() } as Especialidad);
        if (snapLiceo?.exists()) setLiceo({ id: snapLiceo.id, ...snapLiceo.data() } as Liceo);
      } catch {
        setDenegado(true);
      } finally {
        setCargando(false);
      }
    })();
  }, [usuario, id]);

  if (cargando) {
    return <div className="p-8"><p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p></div>;
  }

  if (denegado || !estudiante) {
    return (
      <div className="p-4 md:p-8">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-10 text-center max-w-sm mx-auto">
          <ShieldAlert size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">No se pudo abrir el certificado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">No tienes permiso para ver a este estudiante, o la ficha ya no existe.</p>
        </div>
      </div>
    );
  }

  const resumen = resumirFaltas(faltas);
  const contadas = faltas.filter((f) => f.estado === "confirmada");
  const nombre = `${estudiante.nombres} ${estudiante.apellidos}`.trim();
  const hoy = formatearFecha(new Date().toISOString());

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Link
        href={`/dashboard/estudiantes/${id}`}
        style={{ color: "var(--text-muted)" }}
        className="inline-flex items-center gap-1.5 text-xs hover:underline mb-4"
      >
        <ArrowLeft size={12} /> Volver a la ficha
      </Link>

      {/* La hoja. Colores fijos a propósito: un certificado se ve igual sea
          cual sea el tema de quien lo abre, y se entrega en blanco. */}
      <article
        style={{
          background: "#FFFFFF", color: "#111111",
          border: "1px solid var(--border)",
          fontFamily: '"Times New Roman", Times, serif',
        }}
        className="rounded-xl p-8 sm:p-12 leading-relaxed"
      >
        <header className="text-center mb-8">
          <p className="text-sm font-bold uppercase tracking-wide">{liceo?.nombre ?? "Liceo"}</p>
          {especialidad && <p className="text-sm">Especialidad {especialidad.nombre}</p>}
          <h1 className="text-xl font-bold mt-6 uppercase tracking-wide">
            Certificado de Faltas a la Formación Dual
          </h1>
        </header>

        <p className="mb-4 text-justify">
          El establecimiento certifica que el/la estudiante <strong>{nombre}</strong>
          {estudiante.run ? <> , RUN <strong>{estudiante.run}</strong></> : null}
          {estudiante.nivel || estudiante.curso ? <>, de <strong>{[estudiante.nivel, estudiante.curso].filter(Boolean).join(" ")}</strong></> : null}
          {centro ? <>, quien realiza su Formación Dual en <strong>{centro.nombre}</strong></> : null}
          , registra a la fecha las siguientes inasistencias a su Centro de Aprendizaje en Alternancia Dual:
        </p>

        <table className="w-full my-6 text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #111", padding: "8px 12px" }}>Total de días de inasistencia</td>
              <td style={{ border: "1px solid #111", padding: "8px 12px", fontWeight: 700 }}>{formatearDias(resumen.diasTotales)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #111", padding: "8px 12px" }}>Días que debe recuperar</td>
              <td style={{ border: "1px solid #111", padding: "8px 12px", fontWeight: 700 }}>{formatearDias(resumen.diasARecuperar)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #111", padding: "8px 12px" }}>Días ya recuperados</td>
              <td style={{ border: "1px solid #111", padding: "8px 12px", fontWeight: 700 }}>{formatearDias(resumen.diasRecuperados)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #111", padding: "8px 12px" }}>Días pendientes de recuperar</td>
              <td style={{ border: "1px solid #111", padding: "8px 12px", fontWeight: 700 }}>{formatearDias(resumen.diasPendientes)}</td>
            </tr>
          </tbody>
        </table>

        {contadas.length > 0 && (
          <>
            <p className="font-bold mb-2 text-sm">Detalle de las inasistencias</p>
            <table className="w-full mb-6 text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Fecha", "Jornada", "Justificada", "Situación"].map((h) => (
                    <th key={h} style={{ border: "1px solid #111", padding: "6px 10px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contadas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ border: "1px solid #111", padding: "6px 10px" }}>{formatearFecha(f.fecha)}</td>
                    <td style={{ border: "1px solid #111", padding: "6px 10px" }}>{ETIQUETA_JORNADA_CORTA[f.jornada]}</td>
                    <td style={{ border: "1px solid #111", padding: "6px 10px" }}>{f.justificada ? "Sí" : "No"}</td>
                    <td style={{ border: "1px solid #111", padding: "6px 10px" }}>
                      {!f.requiereRecuperacion ? "No requiere recuperación" : f.recuperada ? "Recuperada" : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {resumen.porConfirmar > 0 && (
          <p className="text-xs mb-4" style={{ color: "#555" }}>
            Nota: existen {resumen.porConfirmar} ausencia(s) informada(s) por el Centro Dual que aún no han sido confirmadas por el establecimiento, y por lo tanto no se incluyen en este certificado.
          </p>
        )}

        <p className="mb-10 text-justify">
          Se extiende el presente certificado a solicitud del interesado, para ser entregado al estudiante y a su apoderado.
        </p>

        <p className="text-sm mb-12">{liceo?.comuna ? `${liceo.comuna}, ` : ""}{hoy}</p>

        <div className="flex justify-end">
          <div className="text-center" style={{ minWidth: 260 }}>
            <p style={{ borderTop: "1px solid #111" }} className="pt-1 text-sm">
              {usuario?.nombre ?? ""}
            </p>
            <p className="text-xs">Profesor(a) Supervisor(a) / Jefe de Especialidad</p>
          </div>
        </div>
      </article>

      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-4">
        Los datos salen del registro de faltas y se actualizan solos: este certificado siempre refleja lo que hay en el sistema al momento de abrirlo.
      </p>
    </div>
  );
}
