"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import CentroDualForm, { type CentroDualFormValues } from "../../_components/CentroDualForm";
import type { CentroDual, Especialidad } from "@/types";
import { ArrowLeft, Pencil } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

export default function EditarCentroDualPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [centroOriginal, setCentroOriginal] = useState<CentroDual | null>(null);
  const [valores, setValores] = useState<CentroDualFormValues | null>(null);
  const [especialidadesSel, setEspecialidadesSel] = useState<string[]>([]);
  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [caracteristicasSel, setCaracteristicasSel] = useState<string[]>([]);
  const [habilidadesSel, setHabilidadesSel] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [rutsOcupados, setRutsOcupados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [mensaje, setMensaje] = useState("");

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario || !id || !puedeEditar) return;
    async function cargar() {
      setLoading(true);
      const [snapCentro, snapEsp, snapTodos] = await Promise.all([
        getDoc(doc(db, "centros_duales", id)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      if (!snapCentro.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const c = { id: snapCentro.id, ...snapCentro.data() } as CentroDual;
      setCentroOriginal(c);
      setValores({
        nombre: c.nombre ?? "", rut: c.rut ?? "", tipo: c.tipo ?? "empresa",
        razonSocial: c.razonSocial ?? "", nombreComercial: c.nombreComercial ?? "",
        direccion: c.direccion ?? "", comuna: c.comuna ?? "", ciudad: c.ciudad ?? "", region: c.region ?? "",
        telefono: c.telefono ?? "", email: c.email ?? "", sitioWeb: c.sitioWeb ?? "",
        contactoNombre: c.contactoNombre ?? "", contactoCargo: c.contactoCargo ?? "",
        contactoTelefono: c.contactoTelefono ?? "", contactoEmail: c.contactoEmail ?? "",
        capacidad: c.capacidad != null ? String(c.capacidad) : (c.cuposDisponibles != null ? String(c.cuposDisponibles) : ""),
        estado: c.estado ?? (c.activo === false ? "inactivo" : "activo"),
      });
      setEspecialidadesSel(c.especialidades ?? []);
      setAreasSel(c.areasDesempeno ?? []);
      setCaracteristicasSel(c.caracteristicas ?? []);
      setHabilidadesSel(c.habilidadesValoradas ?? []);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setRutsOcupados(
        snapTodos.docs
          .filter((d) => d.id !== id)
          .map((d) => (d.data() as CentroDual).rut)
          .filter((r): r is string => Boolean(r))
          .map((r) => normalizarRut(r))
      );
      setLoading(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id, puedeEditar]);

  async function guardar(
    form: CentroDualFormValues,
    nuevasEspecialidades: string[],
    nuevasAreas: string[],
    nuevasCaracteristicas: string[],
    nuevasHabilidades: string[]
  ) {
    if (!usuario || !id || !centroOriginal || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    setMensaje("");
    try {
      await updateDoc(doc(db, "centros_duales", id), {
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
        especialidades: nuevasEspecialidades,
        areasDesempeno: nuevasAreas,
        caracteristicas: nuevasCaracteristicas,
        habilidadesValoradas: nuevasHabilidades,
        capacidad: form.capacidad.trim() ? Number(form.capacidad) : undefined,
        estado: form.estado,
        activo: form.estado === "activo",
        actualizadoEn: new Date().toISOString(),
      });
      setMensaje("Cambios guardados correctamente.");
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No se pudieron guardar los cambios. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeEditar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading || !valores) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado) {
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

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Pencil size={28} />}>Editar centro dual</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Actualiza los datos de {centroOriginal?.nombre}.</p>
        </div>
        <Link
          href={`/dashboard/centros/${id}`}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a la ficha
        </Link>
      </div>

      {mensaje && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--success)" }} className="text-sm font-medium">{mensaje}</p>
        </div>
      )}
      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      <CentroDualForm
        modo="editar"
        valoresIniciales={valores}
        especialidadesIniciales={especialidadesSel}
        areasIniciales={areasSel}
        caracteristicasIniciales={caracteristicasSel}
        habilidadesIniciales={habilidadesSel}
        especialidadesDisponibles={especialidades}
        rutsOcupados={rutsOcupados}
        guardando={guardando}
        onCancelar={() => router.push(`/dashboard/centros/${id}`)}
        onGuardar={guardar}
      />
    </div>
  );
}
