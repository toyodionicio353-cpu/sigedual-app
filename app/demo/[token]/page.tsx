"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { REGIONES } from "@/app/dashboard/liceos/_components/LiceoForm";
import Select from "@/components/ui/Select";
import { ArrowLeft, Clock, CheckCircle2 } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EstadoCarga = "cargando" | "lista" | "no_disponible" | "ya_reclamada";

export default function DemoPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [motivoNoDisponible, setMotivoNoDisponible] = useState("");

  const [nombreInstitucion, setNombreInstitucion] = useState("");
  const [comuna, setComuna] = useState("");
  const [region, setRegion] = useState("");
  const [nombreDirector, setNombreDirector] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function validar() {
      try {
        const res = await fetch(`/api/demo/${token}`);
        const data = await res.json();
        if (res.status === 404) {
          setMotivoNoDisponible("Este enlace de demostración no existe.");
          setEstadoCarga("no_disponible");
          return;
        }
        if (data.reclamada) {
          setEstadoCarga("ya_reclamada");
          return;
        }
        if (!res.ok || data.estado !== "activa") {
          setMotivoNoDisponible(
            data.estado === "vencida"
              ? "Este enlace de demostración ya venció."
              : "Este enlace de demostración ya no está disponible."
          );
          setEstadoCarga("no_disponible");
          return;
        }
        setEstadoCarga("lista");
      } catch {
        setMotivoNoDisponible("No fue posible validar el enlace. Intenta nuevamente.");
        setEstadoCarga("no_disponible");
      }
    }
    validar();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nombreInstitucion.trim()) return setError("Ingresa el nombre de la institución.");
    if (!comuna.trim()) return setError("Ingresa la comuna.");
    if (!region) return setError("Selecciona la región.");
    if (!nombreDirector.trim()) return setError("Ingresa tu nombre completo.");
    if (!EMAIL_REGEX.test(email.trim())) return setError("Ingresa un correo válido.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirmarPassword) return setError("Las contraseñas no coinciden.");

    setEnviando(true);
    try {
      const resReclamo = await fetch(`/api/demo/${token}/reclamar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreInstitucion: nombreInstitucion.trim(), comuna: comuna.trim(), region, email: email.trim() }),
      });
      const datosReclamo = await resReclamo.json();
      if (!resReclamo.ok) {
        setError(datosReclamo.error ?? "No fue posible registrar la institución.");
        setEnviando(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        nombre: nombreDirector.trim(),
        rol: "director",
        liceoId: datosReclamo.liceoId,
        activo: true,
        creadoEn: new Date().toISOString(),
      });

      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(code === "auth/email-already-in-use" ? "Ya existe una cuenta con ese correo." : "No fue posible crear tu acceso. Intenta nuevamente.");
      setEnviando(false);
    }
  }

  if (estadoCarga === "cargando") {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Validando enlace de demostración...</p>
      </div>
    );
  }

  if (estadoCarga === "no_disponible") {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center">
          <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold mb-2">Enlace no disponible</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">{motivoNoDisponible}</p>
          <Link href="/login" style={{ color: "var(--accent-light)" }} className="text-sm font-semibold hover:underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (estadoCarga === "ya_reclamada") {
    return (
      <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center">
          <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          </div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-xl font-bold mb-2">Esta demostración ya está activa</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
            Ya se registró una institución con este enlace. Si eres parte de ella, inicia sesión con tu cuenta.
          </p>
          <Link href="/login" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={40} height={40} className="w-10 h-10 object-contain flex-shrink-0" />
          <span className="text-lg font-bold tracking-tight">
            <span style={{ color: "var(--text-primary)" }}>SIG</span>
            <span style={{ color: "#C8102E" }}>e</span>
            <span style={{ color: "var(--text-primary)" }}>DUAL</span>
          </span>
        </div>

        <div style={{ background: "var(--accent)22", border: "1px solid var(--accent)" }} className="rounded-xl px-3 py-2 mb-5 inline-flex items-center gap-2">
          <Clock size={14} style={{ color: "var(--accent-light)" }} />
          <span style={{ color: "var(--accent-light)" }} className="text-xs font-bold uppercase tracking-wide">Demostración gratuita de SIGEDUAL</span>
        </div>

        <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold mb-1">Activa tu prueba de 7 días</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          Completa estos datos para crear tu institución y tu acceso de director. Tu período de
          prueba ya comenzó a correr desde que se generó este enlace.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Nombre de la institución</label>
            <input
              type="text" value={nombreInstitucion} onChange={(e) => setNombreInstitucion(e.target.value)}
              placeholder="Liceo Bicentenario..." required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Comuna</label>
              <input
                type="text" value={comuna} onChange={(e) => setComuna(e.target.value)} required
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Región</label>
              <Select value={region} onChange={setRegion} ariaLabel="Región" placeholder="Selecciona" opciones={REGIONES.map((r) => ({ value: r, label: r }))} />
            </div>
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Tu nombre completo</label>
            <input
              type="text" value={nombreDirector} onChange={(e) => setNombreDirector(e.target.value)} required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Correo</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="director@tuinstitucion.cl" required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Contraseña</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">Confirmar</label>
              <input
                type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} required
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
          </div>

          {error && <p style={{ color: "var(--danger)" }} className="text-sm text-center">{error}</p>}

          <button
            type="submit" disabled={enviando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="w-full py-3 rounded-xl font-semibold text-sm mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {enviando ? "Creando tu demo..." : "Comenzar mi demostración"}
          </button>
        </form>

        <Link href="/login" style={{ color: "var(--text-secondary)" }} className="flex items-center justify-center gap-2 text-sm mt-6 hover:underline">
          <ArrowLeft size={14} />
          Ya tengo una cuenta
        </Link>
      </div>
    </div>
  );
}
