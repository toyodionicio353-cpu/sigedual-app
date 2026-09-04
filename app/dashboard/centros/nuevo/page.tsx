"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import CentroDualForm, { CENTRO_FORM_VACIO, type CentroDualFormValues } from "../_components/CentroDualForm";
import InvitacionEmpresaSeccion from "../_components/InvitacionEmpresaSeccion";
import type { CentroDual, Especialidad } from "@/types";
import { CheckCircle2, Eye, Building2 } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import { sincronizarIndiceRutCentro } from "@/lib/invitaciones/indiceRut";

export default function AgregarCentroDualPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [rutsOcupados, setRutsOcupados] = useState<string[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [creado, setCreado] = useState<CentroDual | null>(null);

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargandoDatos(true);
      const [snapEsp, snapCentros] = await Promise.all([
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setRutsOcupados(
        snapCentros.docs
          .map((d) => (d.data() as CentroDual).rut)
          .filter((r): r is string => Boolean(r))
          .map((r) => normalizarRut(r))
      );
      setCargandoDatos(false);
    }
    cargar();
  }, [usuario]);

  async function guardar(
    form: CentroDualFormValues,
    especialidadesSel: string[],
    areas: string[],
    caracteristicas: string[],
    habilidades: string[]
  ) {
    if (!usuario || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const nuevo = {
        nombre: form.nombre.trim(),
        rut: form.rut.trim() ? normalizarRut(form.rut) : "",
        tipo: form.tipo,
        razonSocial: form.razonSocial.trim(),
        nombreComercial: form.nombreComercial.trim(),
        direccion: form.direccion.trim(),
        comuna: form.comuna.trim(),
        ciudad: form.ciudad.trim(),
        region: form.region.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        sitioWeb: form.sitioWeb.trim(),
        contactoNombre: form.contactoNombre.trim(),
        contactoCargo: form.contactoCargo.trim(),
        contactoTelefono: form.contactoTelefono.trim(),
        contactoEmail: form.contactoEmail.trim(),
        liceoId: usuario.liceoId,
        especialidades: especialidadesSel,
        areasDesempeno: areas,
        caracteristicas,
        habilidadesValoradas: habilidades,
        capacidad: form.capacidad.trim() ? Number(form.capacidad) : undefined,
        estado: form.estado,
        activo: form.estado === "activo",
        creadoEn: new Date().toISOString(),
        creadoPor: usuario.uid,
      };
      const ref = await addDoc(collection(db, "centros_duales"), nuevo);
      if (nuevo.rut) {
        await sincronizarIndiceRutCentro(ref.id, usuario.liceoId, nuevo.rut);
      }
      setCreado({ id: ref.id, ...nuevo } as CentroDual);
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible registrar el centro dual. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <TituloPagina icon={<Building2 size={28} />}>Agregar centro dual</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Registra la información necesaria para incorporar un nuevo centro al sistema.
        </p>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {!cargandoDatos && (
        <CentroDualForm
          modo="crear"
          valoresIniciales={CENTRO_FORM_VACIO}
          especialidadesIniciales={[]}
          areasIniciales={[]}
          caracteristicasIniciales={[]}
          habilidadesIniciales={[]}
          especialidadesDisponibles={especialidades}
          rutsOcupados={rutsOcupados}
          guardando={guardando}
          onCancelar={() => router.push("/dashboard/centros")}
          onGuardar={(...args) => conConfirmacion(() => guardar(...args))}
        />
      )}

      <InvitacionEmpresaSeccion />

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="un centro dual" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}

      {creado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
            <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Centro dual creado correctamente.</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Ahora puedes asociar maestros guía, gestionar sus cupos y utilizar este centro en las asignaciones.
            </p>
            <div className="flex gap-3">
              <Link
                href="/dashboard/centros"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Volver a centros duales
              </Link>
              <Link
                href={`/dashboard/centros/${creado.id}`}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Eye size={15} />
                Ver centro
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
