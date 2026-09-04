"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { estadoEfectivo, disponibilidadDe, camposFaltantes } from "@/lib/compatibilidad";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import type { Asignacion, CentroDual, EstadoAsignacion, Especialidad, Estudiante, MaestroGuia } from "@/types";
import { AlertCircle, ArrowLeft, Pencil, Trash2, ShieldAlert } from "lucide-react";

const ESTADO_CENTRO_LABEL: Record<string, string> = {
  activo: "Activo", inactivo: "Inactivo", en_revision: "En revisión",
};
const ESTADO_CENTRO_COLOR: Record<string, string> = {
  activo: "var(--success)", inactivo: "var(--danger)", en_revision: "var(--warning)",
};
const ESTADO_ASIGNACION_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};
const TIPO_LABEL: Record<string, string> = {
  empresa: "Empresa", institucion: "Institución", organizacion: "Organización", otro: "Otro",
};

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">{titulo}</p>
      {children}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{valor}</p>
    </div>
  );
}

export default function FichaCentroDualPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [maestrosGuia, setMaestrosGuia] = useState<MaestroGuia[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [denegado, setDenegado] = useState(false);

  const puedeEditar = Boolean(usuario && (usuario.rol === "administrador" || usuario.rol === "profesor"));
  const puedeEliminar = usuario?.rol === "administrador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const ambito = useAmbitoProfesor();

  useEffect(() => {
    if (!usuario || !id) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    if (usuario.rol === "profesor" && !ambito.idsCentros.includes(id)) {
      setDenegado(true);
      setLoading(false);
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: "ver_centro", recurso: "centros_duales", recursoId: id,
        resultado: "denegado", detalle: "Centro dual fuera del ámbito autorizado del profesor.",
      });
      return;
    }
    async function cargar() {
      setLoading(true);
      try {
        const snapCentro = await getDoc(doc(db, "centros_duales", id));
        if (!snapCentro.exists()) {
          setNoEncontrado(true);
          setLoading(false);
          return;
        }
        const c = { id: snapCentro.id, ...snapCentro.data() } as CentroDual;
        setCentro(c);

        const snapEsp = await getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId)));
        setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

        if (usuario!.rol === "profesor") {
          // Las reglas de Firestore no permiten leer asignaciones/estudiantes
          // de otros profesores: solo se muestran los propios de este centro.
          const asigDeEsteCentro = ambito.asignaciones.filter((a) => a.centroDualId === id);
          setAsignaciones(asigDeEsteCentro);
          setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", asigDeEsteCentro.map((a) => a.estudianteId)));
          setMaestrosGuia(await obtenerDocumentosPorId<MaestroGuia>("maestros_guia", ambito.idsMaestros));
        } else {
          const [snapAsig, snapEst, snapMg] = await Promise.all([
            getDocs(query(collection(db, "asignaciones"), where("centroDualId", "==", id))),
            getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
            getDocs(query(collection(db, "maestros_guia"), where("centroDualId", "==", id))),
          ]);
          setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
          setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
          setMaestrosGuia(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
        }
      } catch {
        setDenegado(true);
      } finally {
        setLoading(false);
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id, ambito.cargando, ambito.asignaciones, ambito.idsMaestros]);

  function especialidadNombre(espId: string): string {
    return especialidades.find((e) => e.id === espId)?.nombre || espId;
  }

  function estudianteNombre(estId: string): string {
    const e = estudiantes.find((x) => x.id === estId);
    return e ? `${e.nombres} ${e.apellidos}` : "Estudiante no encontrado";
  }

  async function eliminar() {
    if (!centro) return;
    if (asignaciones.length > 0) {
      alert("Este centro tiene asignaciones asociadas y no se puede eliminar, para proteger la trazabilidad histórica. Si ya no debe recibir estudiantes, cámbialo a \"Inactivo\" desde Editar.");
      return;
    }
    if (!confirm("¿Eliminar este centro dual? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "centros_duales", centro.id));
    router.push("/dashboard/centros");
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (denegado) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <ShieldAlert size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Acceso denegado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Este centro dual no está dentro de tu ámbito autorizado.</p>
          <Link href="/dashboard/centros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver a centros duales
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrado || !centro) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Centro dual no encontrado</p>
          <Link href="/dashboard/centros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a centros duales
          </Link>
        </div>
      </div>
    );
  }

  const estado = estadoEfectivo(centro);
  const disponibilidad = disponibilidadDe(centro, asignaciones);
  const asignacionesVigentes = asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa");
  const faltantes = camposFaltantes(centro);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{centro.nombre}</h1>
        {centro.nombreComercial && <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{centro.nombreComercial}</p>}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: ESTADO_CENTRO_COLOR[estado], background: ESTADO_CENTRO_COLOR[estado] + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {ESTADO_CENTRO_LABEL[estado]}
        </span>
        {puedeEditar && (
          <>
            <Link href={`/dashboard/centros/${centro.id}/editar`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-light)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors">
              <Pencil size={13} />
              Editar
            </Link>
            {puedeEliminar && (
              <button onClick={eliminar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--danger)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--danger)] transition-colors">
                <Trash2 size={13} />
                Eliminar
              </button>
            )}
          </>
        )}
      </div>

      {faltantes.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
          <AlertCircle size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            <span style={{ color: "var(--text-primary)" }} className="font-medium">Información incompleta. </span>
            Falta: {faltantes.join(", ")}.
          </p>
        </div>
      )}

      <Bloque titulo="Información general">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="RUT" valor={centro.rut || "No registrado"} />
          <Dato label="Tipo" valor={centro.tipo ? TIPO_LABEL[centro.tipo] : "No definido"} />
          <Dato label="Razón social" valor={centro.razonSocial || "No registrada"} />
        </div>
      </Bloque>

      <Bloque titulo="Ubicación">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Dirección" valor={centro.direccion} />
          <Dato label="Comuna" valor={centro.comuna} />
          <Dato label="Región" valor={centro.region || "No registrada"} />
        </div>
        {(centro.telefono || centro.email || centro.sitioWeb) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {centro.telefono && <Dato label="Teléfono" valor={centro.telefono} />}
            {centro.email && <Dato label="Correo" valor={centro.email} />}
            {centro.sitioWeb && <Dato label="Sitio web" valor={centro.sitioWeb} />}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Formación dual">
        <div className="flex flex-col gap-3">
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1.5">Especialidades</p>
            {centro.especialidades.length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin especialidades asociadas</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {centro.especialidades.map((espId) => (
                  <span key={espId} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">
                    {especialidadNombre(espId)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-1.5">Áreas de desempeño</p>
            {(centro.areasDesempeno ?? []).length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin áreas registradas</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(centro.areasDesempeno ?? []).map((a) => (
                  <span key={a} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Bloque>

      <Bloque titulo="Capacidad">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Capacidad total" valor={disponibilidad.capacidad != null ? `${disponibilidad.capacidad} estudiante(s)` : "Sin límite definido"} />
          <Dato label="Ocupados" valor={`${disponibilidad.ocupados} estudiante(s)`} />
          <Dato label="Disponibles" valor={disponibilidad.disponibles != null ? `${disponibilidad.disponibles} cupo(s)` : "Sin límite definido"} />
        </div>
      </Bloque>

      <Bloque titulo="Características">
        {(centro.caracteristicas ?? []).length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin características registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(centro.caracteristicas ?? []).map((c) => (
              <span key={c} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{c}</span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Habilidades">
        {(centro.habilidadesValoradas ?? []).length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin habilidades registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(centro.habilidadesValoradas ?? []).map((h) => (
              <span key={h} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{h}</span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Contacto">
        {!centro.contactoNombre && !centro.contactoEmail && !centro.contactoTelefono ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin contacto administrativo registrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dato label="Nombre" valor={centro.contactoNombre || "No registrado"} />
            <Dato label="Cargo" valor={centro.contactoCargo || "No registrado"} />
            <Dato label="Correo" valor={centro.contactoEmail || "No registrado"} />
            <Dato label="Teléfono" valor={centro.contactoTelefono || "No registrado"} />
          </div>
        )}
      </Bloque>

      <Bloque titulo="Maestros guía">
        {maestrosGuia.length > 0 ? (
          <div className="flex flex-col gap-2">
            {maestrosGuia.map((mg) => (
              <Link
                key={mg.id}
                href={`/dashboard/centros/maestros/${mg.id}`}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
              >
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{mg.nombres} {mg.apellidoPaterno} {mg.apellidoMaterno}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{mg.cargo}</p>
                </div>
                <span style={{ color: mg.estado === "activo" ? "var(--success)" : "var(--danger)", background: (mg.estado === "activo" ? "var(--success)" : "var(--danger)") + "22" }} className="text-xs px-2 py-1 rounded-full flex-shrink-0">
                  {mg.estado === "activo" ? "Activo" : "Inactivo"}
                </span>
              </Link>
            ))}
          </div>
        ) : centro.maestroGuia ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dato label="Nombre" valor={centro.maestroGuia} />
            <Dato label="Teléfono" valor={centro.telefonoMaestro || "No registrado"} />
          </div>
        ) : (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin maestros guía asociados.</p>
        )}
        {puedeEditar && (
          <Link href="/dashboard/centros/maestros/nuevo" style={{ color: "var(--accent-light)" }} className="inline-block text-xs font-medium hover:underline mt-3">
            + Agregar maestro guía
          </Link>
        )}
      </Bloque>

      <Bloque titulo="Asignaciones">
        {asignacionesVigentes.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Este centro no tiene estudiantes asignados actualmente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {asignacionesVigentes.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
              >
                <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{estudianteNombre(a.estudianteId)}</span>
                <span style={{ color: "var(--text-secondary)" }} className="text-xs flex-shrink-0">{ESTADO_ASIGNACION_LABEL[a.estado]}</span>
              </Link>
            ))}
          </div>
        )}
      </Bloque>
    </div>
  );
}
