"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, limit, doc, setDoc, getDoc } from "firebase/firestore";
import { ArrowLeft, Info } from "lucide-react";
import Select from "@/components/ui/Select";
import type { Rol, Liceo, CodigoAcceso } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "profesor", label: "Profesor Supervisor" },
  { value: "coordinador", label: "Coordinador" },
  { value: "centro_dual", label: "Centro Dual / Maestro Guía" },
  { value: "estudiante", label: "Estudiante" },
];

// Profesor Supervisor y Coordinador son staff del liceo: su correo debe
// pertenecer al dominio autorizado y usan el código que genera el
// administrador/director (Configuración → Seguridad). Estudiante y Centro
// Dual/Maestro Guía no tienen por qué usar el correo del liceo (una empresa
// Centro Dual tiene su propio dominio) — usan un código distinto, que
// genera el Profesor Supervisor (o cualquier staff del liceo) desde esa
// misma pantalla, y que identifica por sí solo a qué institución pertenecen.
const ROLES_STAFF: Rol[] = ["profesor", "coordinador"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface MaestroGuiaDisponible {
  id: string;
  nombre: string;
  centroDualNombre: string;
}

/** Busca a qué liceo pertenece un código "para Estudiantes y Centros
 * Duales" — ese código es autosuficiente (no depende del dominio del
 * correo), así una empresa Centro Dual con su propio dominio puede
 * registrarse igual. */
async function resolverLiceoPorCodigoExterno(codigo: string): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, "codigosAccesoExterno"), where("codigo", "==", codigo.toUpperCase()))
  );
  const ahora = Date.now();
  const vigente = snap.docs.find((d) => new Date((d.data() as CodigoAcceso).expiraEn).getTime() >= ahora);
  return vigente ? vigente.id : null;
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

  // Solo para rol "centro_dual": una cuenta de este tipo representa a UN
  // Maestro Guía real de un Centro Dual específico. Si se dejara escribir
  // el nombre libremente (como el resto de los roles), la cuenta quedaría
  // sin vínculo con ningún Centro Dual/Maestro Guía — y eso es justo el
  // problema reportado: sin ese vínculo, las reglas de Firestore no pueden
  // aislar la información de un centro dual de la de otro. Por eso acá se
  // elige de una lista real (nunca texto libre) y el nombre se deriva en
  // el servidor a partir de esa elección.
  const [maestroGuiaId, setMaestroGuiaId] = useState("");
  const [maestrosDisponibles, setMaestrosDisponibles] = useState<MaestroGuiaDisponible[]>([]);
  const [cargandoMaestros, setCargandoMaestros] = useState(false);
  const [errorMaestros, setErrorMaestros] = useState("");

  const esStaff = rol === "profesor" || rol === "coordinador";
  const esCentroDual = rol === "centro_dual";
  const esExterno = esCentroDual || rol === "estudiante";

  useEffect(() => {
    if (!esCentroDual) {
      setMaestrosDisponibles([]); setMaestroGuiaId(""); setErrorMaestros("");
      return;
    }
    if (codigo.trim().length < 4) {
      setMaestrosDisponibles([]); setErrorMaestros("");
      return;
    }
    const idTimeout = setTimeout(async () => {
      setCargandoMaestros(true);
      setErrorMaestros("");
      try {
        const params = new URLSearchParams({ codigo: codigo.trim() });
        const res = await fetch(`/api/crear-cuenta/maestros-guia?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMaestros(data.error ?? "No fue posible cargar los Maestros Guía de tu institución.");
          setMaestrosDisponibles([]);
          return;
        }
        setMaestrosDisponibles(data.maestros);
        if (data.maestros.length === 0) {
          setErrorMaestros("No hay Maestros Guía disponibles para vincular. Contacta a tu profesor supervisor.");
        }
      } catch {
        setErrorMaestros("No fue posible cargar los Maestros Guía de tu institución.");
      } finally {
        setCargandoMaestros(false);
      }
    }, 500);
    return () => clearTimeout(idTimeout);
  }, [esCentroDual, codigo]);

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
    if (esCentroDual) {
      if (!maestroGuiaId) {
        setError("Selecciona el Centro Dual / Maestro Guía al que representa esta cuenta.");
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
    if (!codigo.trim()) {
      setError(
        esStaff
          ? "Ingresa el código de verificación entregado por tu director o administrador."
          : "Ingresa el código entregado por tu profesor supervisor."
      );
      return;
    }

    setLoading(true);
    try {
      let liceoId: string;

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
        liceoId = liceo.id;
      } else {
        const liceoResuelto = await resolverLiceoPorCodigoExterno(codigo.trim());
        if (!liceoResuelto) {
          setError("El código es incorrecto o ya venció. Solicita uno nuevo a tu profesor supervisor.");
          setLoading(false);
          return;
        }
        liceoId = liceoResuelto;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      if (esCentroDual) {
        try {
          const idToken = await cred.user.getIdToken();
          const res = await fetch("/api/crear-cuenta/completar-centro-dual", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ maestroGuiaId, liceoId, email: email.trim() }),
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
          liceoId,
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
            ? "Necesitas el código entregado por tu profesor supervisor. Tu correo puede ser el que uses habitualmente."
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

          {esCentroDual ? (
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
                Centro Dual / Maestro Guía
              </label>
              <Select
                value={maestroGuiaId}
                onChange={setMaestroGuiaId}
                ariaLabel="Centro Dual / Maestro Guía"
                placeholder={cargandoMaestros ? "Cargando..." : "Selecciona a quién representa esta cuenta"}
                disabled={cargandoMaestros || maestrosDisponibles.length === 0}
                opciones={maestrosDisponibles.map((m) => ({ value: m.id, label: `${m.nombre} — ${m.centroDualNombre}` }))}
              />
              <p style={{ color: "var(--text-muted)" }} className="flex items-start gap-1.5 text-xs mt-2">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                {errorMaestros || "Ingresa el código de tu profesor supervisor para ver la lista. El nombre de tu cuenta se toma directamente de este registro, así la información de tu Centro Dual nunca se mezcla con la de otro."}
              </p>
            </div>
          ) : (
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
          </div>

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

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-sm mb-2">
              {esExterno ? "Código de tu profesor supervisor" : "Código de verificación"}
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
