"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const year = new Date().getFullYear();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!email.trim()) {
      setEmailError("Debes ingresar tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        setEmailError("No existe una cuenta con ese correo electrónico.");
      } else {
        setEmailError("Error al enviar el correo. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#0b1220",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* ── LADO IZQUIERDO: formulario ── */}
      <div style={{
        width: "100%",
        maxWidth: 460,
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        padding: "10px 0 10px 10px",
        flexShrink: 0,
      }}>
        <div style={{
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
        }}>
          <div>
            {/* Logo centrado */}
            <div style={{ marginBottom: 40, textAlign: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 15,
                  background: "linear-gradient(135deg, #1fb2a6, #2563eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(31,178,166,0.35)",
                }}>
                  <i className="fa-solid fa-graduation-cap" style={{ color: "#fff", fontSize: 24 }} />
                </div>
                <div>
                  <h1 style={{ color: "#ffffff", fontSize: 36, fontWeight: 900, letterSpacing: "1px", lineHeight: 1, margin: 0 }}>
                    SIGEDUAL
                  </h1>
                  <p style={{ color: "#64748b", fontSize: 12, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                    Sistema Integrado de Gestión de Formación Dual
                  </p>
                </div>
              </div>
              <div style={{ height: 1, background: "linear-gradient(to right, transparent, #1f2937, transparent)", marginTop: 8 }} />
            </div>

            {/* Título sección */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
              }}>
                <i className="fa-solid fa-key" style={{ color: "#3b82f6", fontSize: 22 }} />
              </div>
              <h2 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Recuperar contraseña
              </h2>
              <p style={{ color: "#64748b", fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>

            {/* Confirmación o formulario */}
            {enviado ? (
              <div style={{
                background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.30)",
                borderRadius: 12, padding: "24px 20px", textAlign: "center",
              }}>
                <i className="fa-solid fa-circle-check" style={{ color: "#10b981", fontSize: 36, display: "block", marginBottom: 14 }} />
                <p style={{ color: "#10b981", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>¡Correo enviado!</p>
                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                  Revisa tu bandeja de entrada en <strong style={{ color: "#f1f5f9" }}>{email}</strong>. El enlace expira en 1 hora.
                </p>
                <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>Si no ves el correo, revisa tu carpeta de spam.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }} noValidate>
                <div>
                  <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, letterSpacing: "0.3px" }}>
                    Correo electrónico
                  </label>
                  <div style={{ position: "relative" }}>
                    <i className="fa-solid fa-envelope" style={{
                      position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                      color: emailError ? "#f87171" : "#475569", fontSize: 14, pointerEvents: "none",
                    }} />
                    <input
                      type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                      placeholder="correo@liceo.cl"
                      style={{
                        width: "100%", background: "#0b1220",
                        border: `1.5px solid ${emailError ? "#ef4444" : "#1f2937"}`,
                        borderRadius: 11, padding: "13px 16px 13px 44px",
                        color: "#f1f5f9", fontSize: 15, outline: "none",
                        transition: "border-color 0.15s", boxSizing: "border-box",
                      }}
                      onFocus={e => { if (!emailError) e.currentTarget.style.borderColor = "#2563eb"; }}
                      onBlur={e => { if (!emailError) e.currentTarget.style.borderColor = "#1f2937"; }}
                    />
                  </div>
                  {emailError && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                      <i className="fa-solid fa-circle-xmark" style={{ color: "#ef4444", fontSize: 13 }} />
                      <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{emailError}</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: "100%", padding: "14px 0",
                    background: loading ? "#1e3a6e" : "linear-gradient(135deg, #1fb2a6 0%, #2563eb 100%)",
                    borderRadius: 11, border: "none", color: "#fff",
                    fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                    transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  }}
                  onMouseOver={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
                  onMouseOut={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  {loading ? (
                    <><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 15 }} />Enviando...</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane" style={{ fontSize: 15 }} />Enviar enlace de recuperación</>
                  )}
                </button>
              </form>
            )}

            <div style={{ marginTop: 28, textAlign: "center" }}>
              <Link href="/login"
                style={{ color: "#3b82f6", fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                onMouseOver={e => (e.currentTarget.style.color = "#60a5fa")}
                onMouseOut={e => (e.currentTarget.style.color = "#3b82f6")}
              >
                <i className="fa-solid fa-arrow-left" style={{ fontSize: 13 }} />
                Volver al inicio de sesión
              </Link>
            </div>
          </div>

          {/* Pie */}
          <div style={{ marginTop: 48, textAlign: "center" }}>
            <div style={{ height: 1, background: "linear-gradient(to right, transparent, #1f2937, transparent)", marginBottom: 18 }} />
            <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>
              © {year} SIGEDUAL · Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>

      {/* ── LADO DERECHO: vacío ── */}
      <div style={{ flex: 1, minHeight: "100vh", background: "#0b1220" }} />
    </div>
  );
}
