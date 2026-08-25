"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Mascota, {
  type TipoMascota,
  type AnimacionMascota,
  mascotaGuardada,
  guardarMascota,
} from "@/components/Mascota";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passError, setPassError] = useState("");
  const [emptyError, setEmptyError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mascota, setMascota] = useState<TipoMascota>("cerdito");
  const [anim, setAnim] = useState<AnimacionMascota>("idle");

  useEffect(() => { setMascota(mascotaGuardada()); }, []);

  const [exito, setExito] = useState(false);

  function elegirMascota(tipo: TipoMascota) {
    setMascota(tipo);
    guardarMascota(tipo);
    setAnim("happy");
  }

  // happy (al elegir mascota o al entrar) y jump (antes de redirigir) no loopean
  const animSinLoop = anim === "happy" || anim === "jump";
  function alTerminarAnim() {
    if (anim === "jump") {
      router.replace("/dashboard");
    } else if (anim === "happy" && exito) {
      setAnim("jump");
    } else {
      setAnim("idle");
    }
  }

  const year = new Date().getFullYear();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setPassError("");
    setEmptyError(false);

    if (!email.trim() || !password.trim()) {
      setEmptyError(true);
      setAnim("confused");
      return;
    }

    setLoading(true);
    setAnim("walk");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Busca por email para encontrar el documento correcto (sin importar su ID)
      const q = query(collection(db, "usuarios"), where("email", "==", email.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setEmailError("Usuario no encontrado en el sistema.");
        setAnim("confused");
        return;
      }

      const data = snap.docs[0].data();
      if (data?.activo === false) {
        setEmailError("Tu cuenta está desactivada. Contacta al administrador.");
        setAnim("hurt");
        return;
      }

      // La mascota celebra y salta; al terminar el salto se redirige al dashboard
      setExito(true);
      setAnim("happy");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-email" ||
        code === "auth/user-disabled"
      ) {
        setEmailError("Usuario incorrecto o no registrado.");
        setAnim("confused");
      } else if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setPassError("Contraseña incorrecta.");
        setAnim("hurt");
      } else {
        setPassError("Error al iniciar sesión. Intenta nuevamente.");
        setAnim("hurt");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#0b1220",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── LADO IZQUIERDO: formulario ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          minHeight: "100vh",
          display: "flex",
          alignItems: "stretch",
          padding: "10px 0 10px 10px",
          flexShrink: 0,
        }}
      >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 44px 30px",
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 20,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Cabecera ── */}
        <div>
          {/* Logo mark + nombre */}
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 15,
                  background: "linear-gradient(135deg, #1fb2a6, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(31,178,166,0.35)",
                }}
              >
                <i className="fa-solid fa-graduation-cap" style={{ color: "#fff", fontSize: 24 }} />
              </div>
              <div>
                <h1
                  style={{
                    color: "#ffffff",
                    fontSize: 36,
                    fontWeight: 900,
                    letterSpacing: "1px",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  SIGEDUAL
                </h1>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 500,
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  Sistema Integrado de Gestión de Formación Dual
                </p>
              </div>
            </div>

            {/* Línea divisora */}
            <div style={{ height: 1, background: "linear-gradient(to right, transparent, #1f2937, transparent)", marginTop: 8 }} />
          </div>

          {/* Saludo */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              Bienvenido de vuelta
            </h2>
            <p style={{ color: "#64748b", fontSize: 15, marginTop: 8 }}>
              Inicia sesión para acceder al sistema
            </p>
          </div>

          {/* Alerta campos vacíos */}
          {emptyError && (
            <div
              style={{
                background: "rgba(234,179,8,0.12)",
                border: "1px solid rgba(234,179,8,0.35)",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <i className="fa-solid fa-triangle-exclamation" style={{ color: "#eab308", fontSize: 15, flexShrink: 0 }} />
              <p style={{ color: "#eab308", fontSize: 13, fontWeight: 500, margin: 0 }}>
                Es obligatorio rellenar todos los campos para continuar.
              </p>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }} noValidate>
            {/* Campo email */}
            <div>
              <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Correo electrónico
              </label>
              <div style={{ position: "relative" }}>
                <i
                  className="fa-solid fa-envelope"
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: emailError ? "#f87171" : "#475569",
                    fontSize: 14,
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); setEmptyError(false); if (anim === "confused" || anim === "hurt") setAnim("idle"); }}
                  placeholder="correo@liceo.cl"
                  style={{
                    width: "100%",
                    background: "#0b1220",
                    border: `1.5px solid ${emailError ? "#ef4444" : "#1f2937"}`,
                    borderRadius: 11,
                    padding: "13px 16px 13px 44px",
                    color: "#f1f5f9",
                    fontSize: 15,
                    outline: "none",
                    transition: "border-color 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { if (!emailError) e.currentTarget.style.borderColor = "#2563eb"; }}
                  onBlur={e => { if (!emailError) e.currentTarget.style.borderColor = "#1e2d45"; }}
                />
              </div>
              {emailError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                  <i className="fa-solid fa-circle-xmark" style={{ color: "#ef4444", fontSize: 13 }} />
                  <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{emailError}</p>
                </div>
              )}
            </div>

            {/* Campo contraseña */}
            <div>
              <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <i
                  className="fa-solid fa-lock"
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: passError ? "#f87171" : "#475569",
                    fontSize: 14,
                    pointerEvents: "none",
                  }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPassError(""); setEmptyError(false); if (anim === "confused" || anim === "hurt") setAnim("idle"); }}
                  placeholder="••••••••••"
                  style={{
                    width: "100%",
                    background: "#0b1220",
                    border: `1.5px solid ${passError ? "#ef4444" : "#1e2d45"}`,
                    borderRadius: 11,
                    padding: "13px 48px 13px 44px",
                    color: "#f1f5f9",
                    fontSize: 15,
                    outline: "none",
                    transition: "border-color 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { if (!passError) e.currentTarget.style.borderColor = "#2563eb"; }}
                  onBlur={e => { if (!passError) e.currentTarget.style.borderColor = "#1e2d45"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#475569",
                    padding: 4,
                  }}
                >
                  <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} style={{ fontSize: 14 }} />
                </button>
              </div>
              {passError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                  <i className="fa-solid fa-circle-xmark" style={{ color: "#ef4444", fontSize: 13 }} />
                  <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{passError}</p>
                </div>
              )}
            </div>

            {/* ¿Olvidó su contraseña? */}
            <div style={{ textAlign: "right", marginTop: -8 }}>
              <Link
                href="/recuperar-contrasena"
                style={{ color: "#3b82f6", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
                onMouseOver={e => (e.currentTarget.style.color = "#60a5fa")}
                onMouseOut={e => (e.currentTarget.style.color = "#3b82f6")}
              >
                ¿Olvidó su contraseña?
              </Link>
            </div>

            {/* Botón ingresar */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 0",
                background: loading
                  ? "#1e3a6e"
                  : "linear-gradient(135deg, #1fb2a6 0%, #2563eb 100%)",
                borderRadius: 11,
                border: "none",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.3px",
                transition: "opacity 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginTop: 4,
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseOut={e => { e.currentTarget.style.opacity = "1"; }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 15 }} />
                  Ingresando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket" style={{ fontSize: 15 }} />
                  Ingresar
                </>
              )}
            </button>
          </form>
        </div>

        {/* Crear cuenta */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            ¿No tienes cuenta?{" "}
            <Link href="/registro"
              style={{ color: "#1fb2a6", fontWeight: 600, textDecoration: "none" }}
              onMouseOver={e => (e.currentTarget.style.color = "#5eead4")}
              onMouseOut={e => (e.currentTarget.style.color = "#1fb2a6")}
            >
              Crear cuenta
            </Link>
          </p>
        </div>

        {/* ── Pie ── */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ height: 1, background: "linear-gradient(to right, transparent, #1f2937, transparent)", marginBottom: 18 }} />
          <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>
            © {year} SIGEDUAL · Todos los derechos reservados
          </p>
        </div>
      </div>
      </div>

      {/* ── LADO DERECHO: mascota SIGEDUAL ── */}
      <div
        style={{
          flex: 1,
          minHeight: "100vh",
          background: "#0b1220",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        {/* Mascota principal, reacciona al login */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Mascota
            tipo={mascota}
            animacion={anim}
            loop={!animSinLoop}
            onFin={alTerminarAnim}
          />
          {/* Sombra bajo la mascota */}
          <div
            style={{
              width: 110,
              height: 14,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              marginTop: -6,
            }}
          />
        </div>

        {/* Selector de mascota */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#64748b", fontSize: 13, fontWeight: 600, marginBottom: 14, letterSpacing: "0.4px" }}>
            Elige tu compañero
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            {(["cerdito", "osito"] as TipoMascota[]).map((tipo) => {
              const activo = mascota === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => elegirMascota(tipo)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "14px 22px 10px",
                    background: activo ? "rgba(31,178,166,0.12)" : "#111827",
                    border: `1.5px solid ${activo ? "#1fb2a6" : "#1f2937"}`,
                    borderRadius: 14,
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  <Mascota tipo={tipo} animacion="idle" escala={0.45} />
                  <span
                    style={{
                      color: activo ? "#5eead4" : "#64748b",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {tipo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
