"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, limit, doc, setDoc, getDoc, orderBy } from "firebase/firestore";
import { ArrowLeft, Info, CheckCircle2 } from "lucide-react";
import Select from "@/components/ui/Select";
import type { Rol, Liceo, CodigoAcceso } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "profesor", label: "Profesor Supervisor" },
  { value: "coordinador", label: "Coordinador" },
  { value: "centro_dual", label: "Centro Dual" },
  { value: "estudiante", label: "Estudiante" },
];

// Profesor Supervisor y Coordinador son staff del liceo: su correo debe
// pertenecer al dominio autorizado y usan el código de verificación que
// genera el administrador/director (Configuración → Seguridad). Estudiante y
// Centro Dual no usan ningún código: eligen su institución y, con el correo
// que ya tienen registrado en su propia ficha (Estudiante.email /
// CentroDual.email), el servidor confirma que existen y deriva su nombre —
// así ninguna cuenta puede "inventarse" sin tener una ficha real.
const ROLES_STAFF: Rol[] = ["profesor", "coordinador"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LiceoOpcion {
  id: string;
  nombre: string;
}

export default function CrearCuentaPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const esStaff = rol === "profesor" || rol === "coordinador";
  const esCentroDual = rol === "centro_dual";
  const esEstudiante = rol === "estudiante";
  const esExterno = esCentroDual || esEstudiante;

  // Institución (solo para Estudiante / Centro Dual).
  const [liceos, setLiceos] = useState<LiceoOpcion[]>([]);
  const [cargandoLiceos, setCargandoLiceos] = useState(false);
  const [liceoId, setLiceoId] = useState("");

  // Verificación de ficha real (Estudiante/CentroDual) por institución+correo:
  // mientras no haya coincidencia, no se puede continuar, y el nombre nunca
  // se escribe a mano — se muestra el que ya está registrado en la ficha.
  const [verificando, setVerificando] = useState(false);
  const [verificado, setVerificado] = useState<{ id: string; nombre: string } | null>(null);
  const [errorVerificacion, setErrorVerificacion] = useState("");

  useEffect(() => {
    if (!esExterno) {
      setLiceos([]); setLiceoId("");
      return;
    }
    setCargandoLiceos(true);
    getDocs(query(collection(db, "liceos"), orderBy("nombre")))
      .then((snap) => {
        setLiceos(snap.docs.map((d) => ({ id: d.id, nombre: (d.data() as Liceo).nombre })));
      })
      .catch(() => setLiceos([]))
      .finally(() => setCargandoLiceos(false));
  }, [esExterno]);

  useEffect(() => {
    setVerificado(null);
    setErrorVerificacion("");
    if (!esExterno || !liceoId || !EMAIL_REGEX.test(email.trim())) {
      return;
    }
    const idTimeout = setTimeout(async () => {
      setVerificando(true);
      setErrorVerificacion("");
      try {
        const params = new URLSearchParams({ liceoId, email: email.trim() });
        const ruta = esEstudiante ? "verificar-estudiante" : "verificar-centro-dual";
        const res = await fetch(`/api/crear-cuenta/${ruta}?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorVerificacion(data.error ?? "Correo inválido.");
          setVerificado(null);
          return;
        }
        setVerificado({ id: esEstudiante ? data.estudianteId : data.centroDualId, nombre: data.nombre });
      } catch {
        setErrorVerificacion("No fue posible verificar el correo. Intenta nuevamente.");
      } finally {
        setVerificando(false);
      }
    }, 500);
    return () => clearTimeout(idTimeout);
  }, [esExterno, esEstudiante, liceoId, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!rol) {
      setError("Selecciona tu rol.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Ingresa un correo válido (ejemplo: nombre@dominio.cl).");
      return;
    }
    if (esExterno) {
      if (!liceoId) {
        setError("Selecciona tu institución.");
        return;
      }
      if (!verificado) {
        setError(errorVerificacion || "Ese correo no coincide con ninguna ficha registrada en tu institución.");
        return;
      }
    } else if (!nombre.trim()) {
      setError("Ingresa tu nombre completo.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (esStaff && !codigo.trim()) {
      setError("Ingresa el código de verificación entregado por tu director o administrador.");
      return;
    }

    setLoading(true);
    try {
      let liceoIdFinal: string;

      if (esStaff) {
        const dominio = email.trim().split("@")[1]?.toLowerCase();
        const liceoSnap = await getDocs(
          query(collection(db, "liceos"), where("dominioCorreo", "==", dominio), limit(1))
        );
        if (liceoSnap.empty) {
          setError("Este dominio de correo no está autorizado. Contacta a tu director o administrador.");
          setLoading(false);
          return;
        }
        const liceo = { id: liceoSnap.docs[0].id, ...liceoSnap.docs[0].data() } as Liceo;

        const codigoSnap = await getDoc(doc(db, "codigosAcceso", liceo.id));
        if (!codigoSnap.exists()) {
          setError("Aún no hay un código de verificación activo para tu institución.");
          setLoading(false);
          return;
        }
        const codigoData = codigoSnap.data() as CodigoAcceso;
        const expirado = new Date(codigoData.expiraEn).getTime() < Date.now();
        if (codigoData.codigo.toUpperCase() !== codigo.trim().toUpperCase() || expirado) {
          setError("El código de verificación es incorrecto o ya venció. Solicita uno nuevo a tu director o administrador.");
          setLoading(false);
          return;
        }
        liceoIdFinal = liceo.id;
      } else {
        liceoIdFinal = liceoId;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      if (esExterno && verificado) {
        try {
          const idToken = await cred.user.getIdToken();
          const ruta = esEstudiante ? "completar-estudiante" : "completar-centro-dual";
          const body = esEstudiante
            ? { estudianteId: verificado.id, liceoId: liceoIdFinal, email: email.trim() }
            : { centroDualId: verificado.id, liceoId: liceoIdFinal, email: email.trim() };
          const res = await fetch(`/api/crear-cuenta/${ruta}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            await cred.user.delete().catch(() => {});
            setError(data.error ?? "No fue posible completar tu cuenta. Intenta nuevamente.");
            setLoading(false);
            return;
          }
        } catch {
          await cred.user.delete().catch(() => {});
          setError("No fue posible completar tu cuenta. Intenta nuevamente.");
          setLoading(false);
          return;
        }
      } else {
        await setDoc(doc(db, "usuarios", cred.user.uid), {
          uid: cred.user.uid,
          email: email.trim(),
          nombre: nombre.trim(),
          rol,
          liceoId: liceoIdFinal,
          activo: true,
          creadoEn: new Date().toISOString(),
        });
      }

      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setError("Ya existe una cuenta con ese correo.");
      } else {
        setError("No pudimos crear tu cuenta. Intenta nuevamente.");
      }
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center px-4 py-10">
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-sm rounded-2xl p-6 sm:p-10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/logo-icon.png"
            alt="Logo SIGEDUAL"
            width={40}
            height={40}
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <span className="text-lg font-bold tracking-tight">
            <span style={{ color: "var(--text-primary)" }}>SIG</span>
            <span style={{ color: "#C8102E" }}>e</span>
            <span style={{ color: "var(--text-primary)" }}>DUAL</span>
          </span>
        </div>

        <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold mb-1">
          Crear cuenta
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          {esExterno
            ? "Selecciona tu institución e ingresa el correo con el que ya estás registrado — tu nombre se completará automáticamente."
            : "Tu correo debe pertenecer al dominio autorizado de tu institución, y necesitas el código de verificación que entrega tu director o administrador."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Rol
            </label>
            <Select
              value={rol}
              onChange={(v) => setRol(v as Rol)}
              ariaLabel="Rol"
              placeholder="Selecciona tu rol"
              opciones={ROLES}
            />
          </div>

          {esExterno && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
                Institución
              </label>
              <Select
                value={liceoId}
                onChange={setLiceoId}
                ariaLabel="Institución"
                placeholder={cargandoLiceos ? "Cargando..." : "Selecciona tu institución"}
                disabled={cargandoLiceos || liceos.length === 0}
                opciones={liceos.map((l) => ({ value: l.id, label: l.nombre }))}
              />
            </div>
          )}

          {!esExterno && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="María González"
                required
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>
          )}

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              {esExterno ? "Correo" : "Correo institucional"}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={esExterno ? "nombre@correo.cl" : "nombre@tuliceo.cl"}
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
            {esExterno && (
              <p
                style={{ color: verificado ? "var(--success)" : "var(--text-muted)" }}
                className="flex items-start gap-1.5 text-xs mt-2"
              >
                {verificado ? (
                  <>
                    <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
                    Encontramos tu ficha: {verificado.nombre}
                  </>
                ) : (
                  <>
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    {verificando
                      ? "Verificando..."
                      : errorVerificacion ||
                        (esEstudiante
                          ? "Usa el mismo correo que registraste en tu ficha de estudiante."
                          : "Usa el correo registrado para tu Centro Dual (no el de un Maestro Guía).")}
                  </>
                )}
              </p>
            )}
          </div>

          {esExterno && verificado && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                value={verificado.nombre}
                disabled
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-muted)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            />
          </div>

          {esStaff && (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
                Código de verificación
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: 7K2QXT"
                required
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors uppercase"
              />
            </div>
          )}

          {error && (
            <p style={{ color: "var(--danger)" }} className="text-sm text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <Link
          href="/login"
          style={{ color: "var(--text-secondary)" }}
          className="flex items-center justify-center gap-2 text-sm mt-6 hover:underline"
        >
          <ArrowLeft size={14} />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
