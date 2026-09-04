"use client";
import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useFeedback } from "@/lib/preferencias/useFeedback";
import { ROL_LABEL } from "@/lib/roles";
import { validarRut, formatearRut, validarTelefonoChileno } from "@/lib/rut";
import TituloPagina from "@/components/TituloPagina";
import AvatarUsuario from "./_components/AvatarUsuario";
import CampoBloqueado from "./_components/CampoBloqueado";
import ModalSolicitud from "./_components/ModalSolicitud";
import type { TipoDatoSolicitud } from "@/types";
import { User, Phone, FileText, IdCard, Shield, KeyRound, Mail } from "lucide-react";

const NACIONALIDADES = ["Chilena", "Argentina", "Boliviana", "Colombiana", "Ecuatoriana", "Peruana", "Venezolana", "Otra"];
const LIMITE_DESCRIPCION = 280;

interface FormPerfil {
  run: string;
  fechaNacimiento: string;
  nacionalidad: string;
  direccion: string;
  numeroDireccion: string;
  depto: string;
  comuna: string;
  ciudad: string;
  region: string;
  telefono: string;
  telefonoSecundario: string;
  descripcion: string;
}

const FORM_VACIO: FormPerfil = {
  run: "", fechaNacimiento: "", nacionalidad: "",
  direccion: "", numeroDireccion: "", depto: "", comuna: "", ciudad: "", region: "",
  telefono: "", telefonoSecundario: "", descripcion: "",
};

function sanitizarTexto(texto: string): string {
  return texto.replace(/<[^>]*>/g, "").trim();
}

export default function MiPerfilPage() {
  const { usuario, user, refrescarUsuario } = useAuth();
  const avisar = useFeedback();

  const [form, setForm] = useState<FormPerfil>(FORM_VACIO);
  const [inicial, setInicial] = useState<FormPerfil>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof FormPerfil, string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);
  const [solicitud, setSolicitud] = useState<{ tipo: TipoDatoSolicitud; valor: string } | null>(null);

  useEffect(() => {
    if (!usuario) return;
    const cargado: FormPerfil = {
      run: usuario.run ?? "",
      fechaNacimiento: usuario.fechaNacimiento ?? "",
      nacionalidad: usuario.nacionalidad ?? "",
      direccion: usuario.direccion ?? "",
      numeroDireccion: usuario.numeroDireccion ?? "",
      depto: usuario.depto ?? "",
      comuna: usuario.comuna ?? "",
      ciudad: usuario.ciudad ?? "",
      region: usuario.region ?? "",
      telefono: usuario.telefono ?? "",
      telefonoSecundario: usuario.telefonoSecundario ?? "",
      descripcion: usuario.descripcion ?? "",
    };
    setForm(cargado);
    setInicial(cargado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.uid]);

  const hayCambios = useMemo(() => JSON.stringify(form) !== JSON.stringify(inicial), [form, inicial]);

  function set<K extends keyof FormPerfil>(campo: K, valor: FormPerfil[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validarCampo(campo: keyof FormPerfil, valor: string): string | undefined {
    if (campo === "run" && valor.trim() && !validarRut(valor)) return "Ingresa un RUT válido.";
    if ((campo === "telefono" || campo === "telefonoSecundario") && valor.trim() && !validarTelefonoChileno(valor)) {
      return "Ingresa un teléfono válido.";
    }
    if (campo === "fechaNacimiento" && valor) {
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime()) || fecha > new Date()) return "Ingresa una fecha de nacimiento válida.";
    }
    if (campo === "descripcion" && valor.length > LIMITE_DESCRIPCION) return `Máximo ${LIMITE_DESCRIPCION} caracteres.`;
    return undefined;
  }

  function alSalirDeCampo(campo: keyof FormPerfil) {
    const error = validarCampo(campo, form[campo]);
    setErrores((e) => ({ ...e, [campo]: error }));
    if (campo === "run" && form.run.trim() && !error) set("run", formatearRut(form.run));
  }

  function validarTodo(): boolean {
    const nuevos: Partial<Record<keyof FormPerfil, string>> = {};
    (Object.keys(form) as (keyof FormPerfil)[]).forEach((campo) => {
      const error = validarCampo(campo, form[campo]);
      if (error) nuevos[campo] = error;
    });
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function guardar() {
    if (!usuario || guardando) return;
    if (!validarTodo()) return;
    setGuardando(true);
    try {
      const datos = {
        ...form,
        run: form.run.trim() ? formatearRut(form.run) : "",
        descripcion: sanitizarTexto(form.descripcion),
        actualizadoEn: new Date().toISOString(),
      };
      await updateDoc(doc(db, "usuarios", usuario.uid), datos);
      await refrescarUsuario();
      setInicial({ ...form, run: datos.run, descripcion: datos.descripcion });
      avisar("Los cambios se guardaron correctamente.");
    } catch {
      avisar("No se pudieron guardar los cambios. Inténtalo nuevamente.", "error");
    } finally {
      setGuardando(false);
    }
  }

  function pedirCancelar() {
    if (hayCambios) setConfirmandoSalir(true);
  }

  function confirmarSalirSinGuardar() {
    setForm(inicial);
    setErrores({});
    setConfirmandoSalir(false);
  }

  if (!usuario) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  const verificado = user?.emailVerified;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <TituloPagina icon={<User size={28} />} className="mb-1">Mi perfil</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">
          Consulta y actualiza tu información personal. Los datos de rol y cuenta los administra tu institución.
        </p>
      </div>

      {/* Encabezado de perfil */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <AvatarUsuario avatarUrl={usuario.avatarUrl} nombre={usuario.nombre} />
          <div className="flex flex-col gap-1 min-w-0">
            <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold truncate">{usuario.nombre}</p>
            <p style={{ color: "var(--accent-light)" }} className="text-sm font-semibold">{ROL_LABEL[usuario.rol]}</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm truncate">{usuario.email}</p>
            <span
              style={{
                color: usuario.activo ? "var(--success)" : "var(--danger)",
                background: (usuario.activo ? "var(--success)" : "var(--danger)") + "22",
              }}
              className="inline-flex w-fit px-2.5 py-0.5 rounded-full text-[11px] font-semibold mt-1"
            >
              {usuario.activo ? "Cuenta activa" : "Cuenta inactiva"}
            </span>
          </div>
        </div>
      </div>

      {/* Información personal */}
      <Seccion icono={<IdCard size={17} />} titulo="Información personal">
        <CampoBloqueado
          label="Nombre completo"
          valor={usuario.nombre}
          explicacion="El nombre está administrado por el sistema y no puede modificarse directamente."
          accion={
            <BotonSolicitar onClick={() => setSolicitud({ tipo: "nombre", valor: usuario.nombre })} />
          }
        />

        <div className="grid sm:grid-cols-2 gap-4 pt-3">
          <Campo label="RUT" error={errores.run}>
            <input
              value={form.run}
              onChange={(e) => set("run", e.target.value)}
              onBlur={() => alSalirDeCampo("run")}
              placeholder="12.345.678-9"
              style={estiloInput(!!errores.run)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </Campo>
          <Campo label="Fecha de nacimiento" error={errores.fechaNacimiento}>
            <input
              type="date"
              value={form.fechaNacimiento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set("fechaNacimiento", e.target.value)}
              onBlur={() => alSalirDeCampo("fechaNacimiento")}
              style={estiloInput(!!errores.fechaNacimiento)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </Campo>
          <Campo label="Nacionalidad">
            <select
              value={form.nacionalidad}
              onChange={(e) => set("nacionalidad", e.target.value)}
              style={estiloInput(false)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            >
              <option value="">Sin especificar</option>
              {NACIONALIDADES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Campo>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-4">
          <Campo label="Dirección">
            <input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle" style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
          <Campo label="Número">
            <input value={form.numeroDireccion} onChange={(e) => set("numeroDireccion", e.target.value)} style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
          <Campo label="Departamento / casa (opcional)">
            <input value={form.depto} onChange={(e) => set("depto", e.target.value)} style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
          <Campo label="Comuna">
            <input value={form.comuna} onChange={(e) => set("comuna", e.target.value)} style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
          <Campo label="Ciudad">
            <input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
          <Campo label="Región">
            <input value={form.region} onChange={(e) => set("region", e.target.value)} style={estiloInput(false)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors" />
          </Campo>
        </div>
      </Seccion>

      {/* Información de contacto */}
      <Seccion icono={<Phone size={17} />} titulo="Información de contacto">
        <CampoBloqueado
          label="Correo electrónico"
          valor={usuario.email}
          explicacion="Se usa para iniciar sesión y recuperar tu cuenta, por eso permanece bloqueado."
          badge={
            <span
              style={{ color: verificado ? "var(--success)" : "var(--warning)", background: (verificado ? "var(--success)" : "var(--warning)") + "22" }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            >
              <Mail size={10} /> {verificado ? "Verificado" : "No verificado"}
            </span>
          }
          accion={<BotonSolicitar onClick={() => setSolicitud({ tipo: "correo", valor: usuario.email })} texto="Solicitar cambio de correo" />}
        />

        <div className="grid sm:grid-cols-2 gap-4 pt-3">
          <Campo label="Teléfono" error={errores.telefono}>
            <input
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              onBlur={() => alSalirDeCampo("telefono")}
              placeholder="+56 9 1234 5678"
              style={estiloInput(!!errores.telefono)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </Campo>
          <Campo label="Teléfono secundario (opcional)" error={errores.telefonoSecundario}>
            <input
              value={form.telefonoSecundario}
              onChange={(e) => set("telefonoSecundario", e.target.value)}
              onBlur={() => alSalirDeCampo("telefonoSecundario")}
              placeholder="+56 9 1234 5678"
              style={estiloInput(!!errores.telefonoSecundario)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </Campo>
        </div>
      </Seccion>

      {/* Sobre mí */}
      <Seccion icono={<FileText size={17} />} titulo="Sobre mí">
        <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-2">
          Cuéntanos brevemente sobre ti.
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value.slice(0, LIMITE_DESCRIPCION))}
            rows={3}
            placeholder="Ej: Estudiante de Técnico en Contabilidad interesado en administración y gestión financiera."
            style={estiloInput(!!errores.descripcion)}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors resize-none"
          />
        </label>
        <div className="flex items-center justify-between mt-1">
          {errores.descripcion ? (
            <p style={{ color: "var(--danger)" }} className="text-xs">{errores.descripcion}</p>
          ) : <span />}
          <p style={{ color: "var(--text-muted)" }} className="text-xs">{form.descripcion.length}/{LIMITE_DESCRIPCION}</p>
        </div>
      </Seccion>

      {/* Información de cuenta */}
      <Seccion icono={<Shield size={17} />} titulo="Información de cuenta">
        <CampoBloqueado label="Rol" valor={ROL_LABEL[usuario.rol]} explicacion="El rol determina tus permisos dentro de SIGEDUAL y solo puede ser modificado por un usuario autorizado." />
        {usuario.especialidad && (
          <CampoBloqueado label="Especialidad" valor={usuario.especialidad} explicacion="Asignada administrativamente por tu institución." />
        )}
        <CampoBloqueado label="Estado de cuenta" valor={usuario.activo ? "Activa" : "Inactiva"} explicacion="Solo un administrador puede cambiar el estado de tu cuenta." />
        <div className="py-3 first:pt-0 last:pb-0 border-t" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">Fecha de creación de la cuenta</span>
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mt-0.5">
            {usuario.creadoEn ? new Date(usuario.creadoEn).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
      </Seccion>

      {/* Seguridad */}
      <Seccion icono={<KeyRound size={17} />} titulo="Seguridad">
        <SeccionSeguridad email={usuario.email} />
      </Seccion>

      {/* Guardar / cancelar */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={pedirCancelar}
          disabled={!hayCambios}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={!hayCambios || guardando}
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {confirmandoSalir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setConfirmandoSalir(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="Salir sin guardar"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Salir sin guardar?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">Tienes cambios sin guardar en tu perfil. Si sales ahora, se perderán.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoSalir(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
                Continuar editando
              </button>
              <button onClick={confirmarSalirSinGuardar} style={{ background: "var(--danger)", color: "#fff" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold">
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {solicitud && (
        <ModalSolicitud datoSugerido={solicitud.tipo} valorActual={solicitud.valor} onCerrar={() => setSolicitud(null)} />
      )}
    </div>
  );
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: "var(--accent-light)" }}>{icono}</span>
        <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold uppercase tracking-wide">{titulo}</h2>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">
        <span className="block mb-1">{label}</span>
        {children}
      </label>
      {error && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{error}</p>}
    </div>
  );
}

function BotonSolicitar({ onClick, texto = "Solicitar modificación" }: { onClick: () => void; texto?: string }) {
  return (
    <button onClick={onClick} style={{ color: "var(--accent-light)" }} className="text-xs font-semibold hover:underline whitespace-nowrap">
      {texto}
    </button>
  );
}

function estiloInput(conError: boolean): React.CSSProperties {
  return {
    background: "var(--bg-base)",
    border: `1px solid ${conError ? "var(--danger)" : "var(--border-light)"}`,
    color: "var(--text-primary)",
  };
}

function SeccionSeguridad({ email }: { email: string }) {
  const avisar = useFeedback();
  const [enviando, setEnviando] = useState(false);

  async function cambiarContrasena() {
    setEnviando(true);
    try {
      await sendPasswordResetEmail(auth, email);
      avisar(`Te enviamos un correo a ${email} para cambiar tu contraseña.`);
    } catch {
      avisar("No se pudo enviar el correo. Inténtalo nuevamente.", "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Contraseña</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">Te enviaremos un correo con un enlace seguro para cambiarla. Nunca se muestra ni se guarda en texto plano.</p>
      </div>
      <button
        onClick={cambiarContrasena}
        disabled={enviando}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="px-4 py-2 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {enviando ? "Enviando..." : "Cambiar contraseña"}
      </button>
    </div>
  );
}
