"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LiceoInfo { id: string; nombre: string; dominio: string; codigo: string; codigoExpiraEn: any; }

const INPUT_BASE: React.CSSProperties = {
  width:"100%", background:"#0b1220", border:"1.5px solid #1f2937",
  borderRadius:11, padding:"13px 16px 13px 44px", color:"#f1f5f9",
  fontSize:15, outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  transition:"border-color .15s",
};

type Paso = "email" | "datos";

export default function RegistroPage() {
  const router = useRouter();
  const year = new Date().getFullYear();

  const [email, setEmail]       = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [liceo, setLiceo]       = useState<LiceoInfo|null>(null);
  const [paso, setPaso]         = useState<Paso>("email");

  const [nombre, setNombre]       = useState("");
  const [apellidos, setApellidos] = useState("");
  const [password, setPass]       = useState("");
  const [passConf, setPassConf]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [codigo, setCodigo]       = useState("");
  const [rol, setRol]             = useState("profesor");

  const [error, setError]   = useState("");
  const [creando, setCreando] = useState(false);
  const [ok, setOk]           = useState(false);

  /* Paso 1: buscar liceo por dominio */
  async function buscarLiceo(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr(""); setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) { setEmailErr("Ingresa un correo electrónico válido."); return; }
    const dominio = trimmed.split("@")[1];
    setBuscando(true);
    try {
      const q = query(collection(db,"liceos"), where("dominio","==",dominio));
      const snap = await getDocs(q);
      if (snap.empty) {
        setEmailErr(`El dominio @${dominio} no está vinculado a ningún liceo en SIGEDUAL. Contacta al administrador.`);
      } else {
        const data = snap.docs[0].data() as Omit<LiceoInfo,"id">;
        setLiceo({ id: snap.docs[0].id, ...data });
        setEmail(trimmed); // guardar email normalizado para que Firebase Auth lo reciba limpio
        setPaso("datos");
      }
    } catch(err: any) { setEmailErr(err?.message ?? "Error al verificar el correo."); }
    setBuscando(false);
  }

  /* Verificar si el código está vigente */
  function codigoVigente(l: LiceoInfo): boolean {
    if (!l.codigo || !l.codigoExpiraEn) return false;
    const expira = l.codigoExpiraEn?.toDate ? l.codigoExpiraEn.toDate() : new Date(l.codigoExpiraEn);
    return new Date() < expira;
  }

  /* Paso 2: crear cuenta */
  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim())      { setError("El nombre es obligatorio."); return; }
    if (!apellidos.trim())   { setError("Los apellidos son obligatorios."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== passConf){ setError("Las contraseñas no coinciden."); return; }
    if (!codigo.trim())      { setError("El código del liceo es obligatorio."); return; }
    if (!liceo) return;

    // Re-consultar liceo para obtener código actualizado
    const q = query(collection(db,"liceos"), where("dominio","==",email.split("@")[1]));
    const snap = await getDocs(q);
    if (snap.empty) { setError("Liceo no encontrado."); return; }
    const liceoActual = { id: snap.docs[0].id, ...snap.docs[0].data() } as LiceoInfo;

    if (!codigoVigente(liceoActual)) {
      setError("El código del liceo ha expirado. Solicita uno nuevo al director del establecimiento.");
      return;
    }
    if (liceoActual.codigo.toUpperCase() !== codigo.trim().toUpperCase()) {
      setError("El código ingresado no es correcto. Verifica con el director del liceo.");
      return;
    }

    setCreando(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Usar setDoc con el UID como ID del documento para que auth-context
      // lo encuentre directamente con getDoc(doc(db,"usuarios",uid))
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid:         cred.user.uid,
        nombre:      nombre.trim() + " " + apellidos.trim(),
        email:       email.trim().toLowerCase(),
        rol,
        liceoId:     liceo.id,
        liceoNombre: liceo.nombre,
        activo:      true,
        creadoEn:    serverTimestamp(),
        creadoPor:   "auto-registro",
      });
      setOk(true);
      setTimeout(()=>router.replace("/dashboard"), 2500);
    } catch(err: any) {
      const code = err?.code ?? "";
      if (code === "auth/email-already-in-use") setError("Este correo ya tiene una cuenta registrada. Inicia sesión.");
      else if (code === "auth/weak-password")   setError("Contraseña demasiado débil. Usa al menos 6 caracteres.");
      else if (code === "auth/invalid-email")   setError("El correo electrónico no es válido. Vuelve atrás y verifica que esté bien escrito.");
      else setError(err?.message ?? "Error al crear la cuenta. Intenta nuevamente.");
    }
    setCreando(false);
  }

  /* Éxito */
  if (ok) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b1220",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{textAlign:"center",padding:40}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(31,178,166,.15)",border:"2px solid #1fb2a6",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
          <i className="fa-solid fa-check" style={{color:"#1fb2a6",fontSize:26}}/>
        </div>
        <h2 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 10px"}}>¡Cuenta creada!</h2>
        <p style={{color:"#475569",fontSize:14,margin:0}}>Redirigiendo al sistema…</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",background:"#0b1220",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:480,minHeight:"100vh",display:"flex",alignItems:"stretch",padding:"10px 0 10px 10px",flexShrink:0}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"44px 44px 30px",background:"#111827",border:"1px solid #1f2937",borderRadius:20}}>
          <div>
            {/* Logo */}
            <div style={{marginBottom:36,textAlign:"center"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#1fb2a6,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(31,178,166,.3)"}}>
                  <i className="fa-solid fa-graduation-cap" style={{color:"#fff",fontSize:22}}/>
                </div>
                <div>
                  <h1 style={{color:"#fff",fontSize:32,fontWeight:900,letterSpacing:1,lineHeight:1,margin:0}}>SIGEDUAL</h1>
                  <p style={{color:"#64748b",fontSize:11,marginTop:5}}>Sistema Integrado de Gestión de Formación Dual</p>
                </div>
              </div>
              <div style={{height:1,background:"linear-gradient(to right,transparent,#1f2937,transparent)"}}/>
            </div>

            {/* Título del paso */}
            <div style={{marginBottom:26}}>
              {paso==="email" ? (
                <>
                  <h2 style={{color:"#f1f5f9",fontSize:24,fontWeight:700,margin:0}}>Crear cuenta</h2>
                  <p style={{color:"#64748b",fontSize:14,marginTop:8}}>Ingresa tu correo institucional para comenzar.</p>
                </>
              ) : (
                <>
                  <button onClick={()=>{setPaso("email");setLiceo(null);setError("");}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",padding:0,fontSize:13,display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
                    <i className="fa-solid fa-arrow-left" style={{fontSize:11}}/> Volver
                  </button>
                  <h2 style={{color:"#f1f5f9",fontSize:24,fontWeight:700,margin:0}}>Completa tu perfil</h2>
                  {liceo&&(
                    <div style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:10,background:"rgba(31,178,166,.1)",border:"1px solid rgba(31,178,166,.25)",borderRadius:99,padding:"5px 12px"}}>
                      <i className="fa-solid fa-school" style={{color:"#1fb2a6",fontSize:11}}/>
                      <span style={{color:"#1fb2a6",fontSize:12,fontWeight:600}}>{liceo.nombre}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{background:"rgba(244,63,94,.08)",border:"1px solid rgba(244,63,94,.2)",borderRadius:10,padding:"12px 16px",display:"flex",gap:10,alignItems:"flex-start",marginBottom:20}}>
                <i className="fa-solid fa-circle-xmark" style={{color:"#f43f5e",fontSize:14,flexShrink:0,marginTop:1}}/>
                <p style={{color:"#f87171",fontSize:13,margin:0}}>{error}</p>
              </div>
            )}

            {/* ── PASO 1 ── */}
            {paso==="email" && (
              <form onSubmit={buscarLiceo} style={{display:"flex",flexDirection:"column",gap:20}} noValidate>
                <div>
                  <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Correo institucional</label>
                  <div style={{position:"relative"}}>
                    <i className="fa-solid fa-envelope" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:emailErr?"#f87171":"#475569",fontSize:14,pointerEvents:"none"}}/>
                    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailErr("");}} placeholder="nombre@liceo.cl"
                      style={{...INPUT_BASE,borderColor:emailErr?"#ef4444":"#1f2937"}}
                      onFocus={e=>{if(!emailErr)e.currentTarget.style.borderColor="#2563eb";}}
                      onBlur={e=>{if(!emailErr)e.currentTarget.style.borderColor="#1e2d45";}}/>
                  </div>
                  {emailErr&&(
                    <div style={{display:"flex",alignItems:"flex-start",gap:6,marginTop:7}}>
                      <i className="fa-solid fa-circle-xmark" style={{color:"#ef4444",fontSize:13,flexShrink:0,marginTop:1}}/>
                      <p style={{color:"#f87171",fontSize:12,margin:0}}>{emailErr}</p>
                    </div>
                  )}
                </div>

                <div style={{background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.15)",borderRadius:10,padding:"12px 16px",display:"flex",gap:9,alignItems:"flex-start"}}>
                  <i className="fa-solid fa-circle-info" style={{color:"#3b82f6",fontSize:13,flexShrink:0,marginTop:1}}/>
                  <p style={{color:"#64748b",fontSize:12,margin:0,lineHeight:1.6}}>
                    Tu correo institucional vincula tu cuenta con el liceo correcto. Si no tienes uno, contacta al director de tu establecimiento.
                  </p>
                </div>

                <button type="submit" disabled={buscando}
                  style={{width:"100%",padding:"14px 0",background:buscando?"#1e3a6e":"linear-gradient(135deg,#1fb2a6,#2563eb)",borderRadius:11,border:"none",color:"#fff",fontSize:16,fontWeight:700,cursor:buscando?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit"}}>
                  {buscando?<><i className="fa-solid fa-circle-notch fa-spin" style={{fontSize:15}}/>Verificando…</>:<><i className="fa-solid fa-arrow-right" style={{fontSize:15}}/>Continuar</>}
                </button>
              </form>
            )}

            {/* ── PASO 2 ── */}
            {paso==="datos" && (
              <form onSubmit={crearCuenta} style={{display:"flex",flexDirection:"column",gap:16}} noValidate>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Nombre(s)</label>
                    <div style={{position:"relative"}}>
                      <i className="fa-solid fa-user" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:13,pointerEvents:"none"}}/>
                      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Marta" style={INPUT_BASE}
                        onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}/>
                    </div>
                  </div>
                  <div>
                    <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Apellidos</label>
                    <div style={{position:"relative"}}>
                      <i className="fa-solid fa-user" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:13,pointerEvents:"none"}}/>
                      <input value={apellidos} onChange={e=>setApellidos(e.target.value)} placeholder="Sánchez" style={INPUT_BASE}
                        onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}/>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Perfil en el liceo</label>
                  <div style={{position:"relative"}}>
                    <i className="fa-solid fa-id-badge" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:13,pointerEvents:"none"}}/>
                    <select value={rol} onChange={e=>setRol(e.target.value)}
                      style={{...INPUT_BASE,cursor:"pointer",appearance:"none",paddingRight:36}}
                      onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}>
                      <option value="profesor">Profesor supervisor</option>
                      <option value="coordinador">Coordinador dual</option>
                      <option value="centro_dual">Centro dual</option>
                    </select>
                    <i className="fa-solid fa-chevron-down" style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:11,pointerEvents:"none"}}/>
                  </div>
                </div>

                <div>
                  <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Contraseña</label>
                  <div style={{position:"relative"}}>
                    <i className="fa-solid fa-lock" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:13,pointerEvents:"none"}}/>
                    <input type={showPass?"text":"password"} value={password} onChange={e=>setPass(e.target.value)} placeholder="Mínimo 6 caracteres"
                      style={{...INPUT_BASE,paddingRight:48}}
                      onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}/>
                    <button type="button" onClick={()=>setShowPass(v=>!v)}
                      style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",cursor:"pointer",color:"#475569",padding:4}}>
                      <i className={`fa-solid ${showPass?"fa-eye-slash":"fa-eye"}`} style={{fontSize:14}}/>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>Confirmar contraseña</label>
                  <div style={{position:"relative"}}>
                    <i className="fa-solid fa-lock" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:13,pointerEvents:"none"}}/>
                    <input type={showPass?"text":"password"} value={passConf} onChange={e=>setPassConf(e.target.value)} placeholder="Repite tu contraseña"
                      style={INPUT_BASE}
                      onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}/>
                  </div>
                </div>

                {/* Código rotativo */}
                <div>
                  <label style={{color:"#94a3b8",fontSize:13,fontWeight:600,display:"block",marginBottom:8}}>
                    Código del liceo
                    <span style={{color:"#f59e0b",fontSize:11,fontWeight:500,marginLeft:8}}>entregado por el director · válido 5 min</span>
                  </label>
                  <div style={{position:"relative"}}>
                    <i className="fa-solid fa-key" style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#f59e0b",fontSize:13,pointerEvents:"none"}}/>
                    <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej. A3XK" maxLength={6}
                      style={{...INPUT_BASE,letterSpacing:6,fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,paddingLeft:44}}
                      onFocus={e=>e.currentTarget.style.borderColor="#f59e0b"} onBlur={e=>e.currentTarget.style.borderColor="#1e2d45"}/>
                  </div>
                </div>

                <button type="submit" disabled={creando}
                  style={{width:"100%",padding:"14px 0",background:creando?"#1e3a6e":"linear-gradient(135deg,#1fb2a6,#2563eb)",borderRadius:11,border:"none",color:"#fff",fontSize:16,fontWeight:700,cursor:creando?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit",marginTop:4}}>
                  {creando?<><i className="fa-solid fa-circle-notch fa-spin" style={{fontSize:15}}/>Creando cuenta…</>:<><i className="fa-solid fa-user-plus" style={{fontSize:15}}/>Crear mi cuenta</>}
                </button>
              </form>
            )}
          </div>

          <div style={{marginTop:24,textAlign:"center"}}>
            <p style={{color:"#475569",fontSize:13,margin:0}}>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" style={{color:"#1fb2a6",fontWeight:600,textDecoration:"none"}}
                onMouseOver={e=>(e.currentTarget.style.color="#5eead4")} onMouseOut={e=>(e.currentTarget.style.color="#1fb2a6")}>
                Iniciar sesión
              </Link>
            </p>
          </div>
          <div style={{marginTop:20,textAlign:"center"}}>
            <div style={{height:1,background:"linear-gradient(to right,transparent,#1f2937,transparent)",marginBottom:18}}/>
            <p style={{color:"#334155",fontSize:11,margin:0}}>© {year} SIGEDUAL · Todos los derechos reservados</p>
          </div>
        </div>
      </div>
      <div style={{flex:1,minHeight:"100vh",background:"#0b1220"}}/>
    </div>
  );
}
