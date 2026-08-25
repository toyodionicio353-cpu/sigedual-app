"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Verificacion {
  codigo: string;
  firmante: string;
  email: string;
  liceoId: string;
  liceoNombre?: string;
  documentoNombre: string;
  cargo?: string;
  timestamp: { toDate: () => Date } | null;
  estado: "valida" | "revocada";
}

export default function VerificarPage({ params }: { params: { codigo: string } }) {
  const codigo = (params.codigo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [status, setStatus] = useState<"loading" | "valid" | "revoked" | "notfound">("loading");
  const [data, setData] = useState<Verificacion | null>(null);

  useEffect(() => {
    if (!codigo) { setStatus("notfound"); return; }
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "verificaciones"), where("codigo", "==", codigo))
        );
        if (snap.empty) { setStatus("notfound"); return; }
        const d = snap.docs[0].data() as Verificacion;
        setData(d);
        setStatus(d.estado === "revocada" ? "revoked" : "valid");
      } catch {
        setStatus("notfound");
      }
    })();
  }, [codigo]);

  const fmtDate = (ts: Verificacion["timestamp"]) => {
    if (!ts) return "—";
    try {
      return ts.toDate().toLocaleString("es-CL", {
        weekday: "long", day: "2-digit", month: "long",
        year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, Arial, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ background: "#0f172a", padding: "14px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 14 }}>SG</div>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>SIGEDUAL</div>
          <div style={{ color: "#64748b", fontSize: 11 }}>Sistema Integral de Gestión Dual</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ color: "#475569", fontSize: 12 }}>Verificación de Firma Electrónica</div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 620 }}>

          {/* Loading */}
          {status === "loading" && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#64748b", fontSize: 14 }}>Verificando firma...</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* VALID */}
          {status === "valid" && data && (
            <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
              {/* Green banner */}
              <div style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", padding: "28px 32px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 56, height: 56, background: "rgba(255,255,255,.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Firma Electrónica Válida</div>
                  <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>Este documento ha sido firmado y registrado en SIGEDUAL</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ padding: "28px 32px" }}>
                <div style={{ display: "grid", gap: 20 }}>

                  {/* Firmante */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "#eff6ff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Firmante</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{data.firmante}</div>
                      {data.email && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{data.email}</div>}
                      {data.cargo && <div style={{ fontSize: 12, color: "#64748b" }}>{data.cargo}</div>}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  {/* Documento */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "#f0fdf4", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Documento firmado</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{data.documentoNombre}</div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  {/* Fecha */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "#fefce8", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Fecha y hora de firma</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>{fmtDate(data.timestamp)}</div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  {/* Código */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "#f8f0ff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Código de verificación</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e3a6e", letterSpacing: "3px", fontFamily: "Courier New, monospace" }}>{data.codigo}</div>
                    </div>
                  </div>

                  {/* Institución */}
                  {(data.liceoNombre || data.liceoId) && (
                    <>
                      <div style={{ height: 1, background: "#f1f5f9" }} />
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ width: 40, height: 40, background: "#fff1f2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Institución</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{data.liceoNombre ?? data.liceoId}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Verified badge */}
                <div style={{ marginTop: 24, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{ fontSize: 12, color: "#15803d" }}>Firma verificada y registrada en los servidores de SIGEDUAL. Este registro es inmutable.</span>
                </div>
              </div>
            </div>
          )}

          {/* REVOKED */}
          {status === "revoked" && data && (
            <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
              <div style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", padding: "28px 32px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 56, height: 56, background: "rgba(255,255,255,.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Firma Revocada</div>
                  <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>Esta firma fue anulada por la institución emisora</div>
                </div>
              </div>
              <div style={{ padding: "28px 32px" }}>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
                  <strong style={{ color: "#0f172a" }}>Firmante original:</strong> {data.firmante}
                </p>
                <p style={{ color: "#64748b", fontSize: 14 }}>
                  <strong style={{ color: "#0f172a" }}>Documento:</strong> {data.documentoNombre}
                </p>
              </div>
            </div>
          )}

          {/* NOT FOUND */}
          {status === "notfound" && (
            <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
              <div style={{ background: "linear-gradient(135deg,#475569,#334155)", padding: "28px 32px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 56, height: 56, background: "rgba(255,255,255,.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Código no encontrado</div>
                  <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>No existe ninguna firma con este código en SIGEDUAL</div>
                </div>
              </div>
              <div style={{ padding: "28px 32px" }}>
                <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                  <p style={{ color: "#854d0e", fontSize: 13, margin: 0 }}>
                    Código consultado: <strong style={{ fontFamily: "monospace", letterSpacing: "2px" }}>{codigo || "—"}</strong>
                  </p>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                  Este código no está registrado en nuestra base de datos. Verifique que lo haya ingresado correctamente.
                  Si el problema persiste, contacte a la institución que emitió el documento.
                </p>
              </div>
            </div>
          )}

          {/* Manual lookup */}
          {status !== "loading" && status !== "valid" && (
            <ManualLookup initialCode={codigo} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: "#0f172a", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#475569", fontSize: 12 }}>© {new Date().getFullYear()} SIGEDUAL — Sistema Integral de Gestión Dual</span>
        <span style={{ color: "#334155", fontSize: 11 }}>Verificación de firma electrónica</span>
      </footer>
    </div>
  );
}

// ── Manual lookup component ──────────────────────────────────────────
function ManualLookup({ initialCode }: { initialCode: string }) {
  const [input, setInput] = useState(initialCode);
  const go = () => {
    const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean) window.location.href = `/verificar/${clean}`;
  };
  return (
    <div style={{ marginTop: 20, background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <p style={{ color: "#0f172a", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Buscar otro código</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && go()}
          placeholder="Ej: A3F9KX2B7QM1"
          style={{ flex: 1, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "Courier New, monospace", letterSpacing: "1.5px", outline: "none", color: "#1e3a6e" }}
        />
        <button onClick={go}
          style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 20px", cursor: "pointer" }}>
          Verificar
        </button>
      </div>
    </div>
  );
}
