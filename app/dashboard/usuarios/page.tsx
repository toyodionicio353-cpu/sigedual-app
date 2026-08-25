"use client";
import { useEffect, useState, useMemo } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Rol } from "@/types";

interface UsuarioDoc {
  id: string; uid: string; nombre: string; email: string;
  rol: Rol; activo: boolean; liceoId: string;
  creadoEn?: any; especialidad?: string; contrasena?: string;
  ultimoAcceso?: string;
}

const ROL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  administrador: { label: "Administrador", color: "#f43f5e", bg: "rgba(244,63,94,.12)" },
  coordinador:   { label: "Coordinador",   color: "#a78bfa", bg: "rgba(167,139,250,.12)" },
  director:      { label: "Director",      color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  profesor:      { label: "Profesor",      color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  centro_dual:   { label: "Centro Dual",   color: "#34d399", bg: "rgba(52,211,153,.12)" },
  estudiante:    { label: "Estudiante",    color: "#6b7280", bg: "rgba(107,114,128,.12)" },
};
const ROLES: Rol[] = ["administrador","coordinador","director","profesor","centro_dual","estudiante"];
const ESPECIALIDADES = ["Contabilidad","Mecánica","Atención de Párvulos","Enfermería","Agropecuaria"];
const AVATAR_COLORS  = ["#1fb2a6","#3b82f6","#a78bfa","#f59e0b","#ef4444","#34d399"];
const FORM_VACIO = { nombre:"", email:"", rol:"profesor" as Rol, especialidad:"", contrasena:"", activo:true };

function iniciales(nombre?: string) {
  return (nombre || "?").split(" ").slice(0,2).map(p => p[0] || "").join("").toUpperCase() || "?";
}
function avatarColor(nombre?: string) {
  const ci = (nombre?.length ?? 0) % AVATAR_COLORS.length;
  return `linear-gradient(135deg,${AVATAR_COLORS[ci]},${AVATAR_COLORS[(ci+2)%AVATAR_COLORS.length]})`;
}

export default function UsuariosPage() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<UsuarioDoc[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Modales
  const [modalForm, setModalForm]         = useState(false);
  const [modalFicha, setModalFicha]       = useState<UsuarioDoc|null>(null);
  const [modalEliminar, setModalEliminar] = useState<UsuarioDoc|null>(null);

  const [editItem, setEditItem] = useState<UsuarioDoc|null>(null);
  const [form, setForm]         = useState({ ...FORM_VACIO });
  const [verPass, setVerPass]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm]   = useState("");

  // Estado modal eliminar (2 pasos)
  const [delPaso, setDelPaso]   = useState<1|2>(1);
  const [delPass, setDelPass]   = useState("");
  const [delCodigo, setDelCodigo]   = useState("");
  const [delCodigoGen, setDelCodigoGen] = useState("");
  const [delErr, setDelErr]     = useState("");
  const [delando, setDelando]   = useState(false);

  const INPUT: React.CSSProperties = {
    width:"100%", background:"#0b1220", border:"1px solid #1f2937",
    borderRadius:8, padding:"9px 12px", color:"#f1f5f9", fontSize:13,
    fontFamily:"'Inter',sans-serif", outline:"none", boxSizing:"border-box",
  };
  const SEL: React.CSSProperties = { ...INPUT, cursor:"pointer" };
  const LBL: React.CSSProperties = {
    color:"#6b7280", fontSize:10, fontWeight:700,
    textTransform:"uppercase", letterSpacing:.8, display:"block", marginBottom:5,
  };

  useEffect(() => {
    if (!usuario) return;
    // Administrador ve todos los usuarios; otros roles solo ven su liceo
    const q = usuario.rol === "administrador"
      ? query(collection(db, "usuarios"))
      : query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId));
    return onSnapshot(q, snap =>
      setLista(snap.docs.map(d => ({ id:d.id, ...d.data() } as UsuarioDoc)))
    );
  }, [usuario?.uid]);

  const filtrados = useMemo(() => {
    let r = lista;
    if (busqueda) {
      const b = busqueda.toLowerCase();
      r = r.filter(u => (u.nombre||"").toLowerCase().includes(b) || (u.email||"").toLowerCase().includes(b));
    }
    if (filtroRol !== "todos") r = r.filter(u => u.rol === filtroRol);
    if (filtroEstado === "activo")   r = r.filter(u => u.activo);
    if (filtroEstado === "inactivo") r = r.filter(u => !u.activo);
    return r;
  }, [lista, busqueda, filtroRol, filtroEstado]);

  // ── ABRIR MODALES ──────────────────────────────────────────────────
  function abrirNuevo() {
    setEditItem(null); setForm({...FORM_VACIO}); setErrForm(""); setVerPass(false); setModalForm(true);
  }
  function abrirEditar(u: UsuarioDoc) {
    setEditItem(u);
    setForm({ nombre:u.nombre||"", email:u.email||"", rol:u.rol, especialidad:u.especialidad||"", contrasena:u.contrasena||"", activo:u.activo??true });
    setErrForm(""); setVerPass(false); setModalForm(true);
  }
  function abrirEliminar(u: UsuarioDoc) {
    setModalEliminar(u);
    setDelPaso(1); setDelPass(""); setDelCodigo(""); setDelCodigoGen(""); setDelErr("");
  }

  // ── GUARDAR USUARIO ─────────────────────────────────────────────────
  async function guardar() {
    setErrForm("");
    if (!form.nombre.trim()) { setErrForm("El nombre es obligatorio."); return; }
    if (!form.email.trim())  { setErrForm("El correo es obligatorio."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErrForm("El correo no tiene formato válido."); return; }
    setGuardando(true);
    try {
      const datos = {
        nombre:      form.nombre.trim(),
        email:       form.email.trim(),
        rol:         form.rol,
        especialidad:form.especialidad,
        contrasena:  form.contrasena,
        activo:      form.activo,
      };
      if (editItem) {
        await updateDoc(doc(db,"usuarios",editItem.id), datos);
      } else {
        await addDoc(collection(db,"usuarios"), {
          ...datos, liceoId:usuario?.liceoId??"", uid:"", creadoEn:serverTimestamp(),
        });
      }
      setModalForm(false);
    } catch(err: any) {
      setErrForm(err?.message ?? "Error al guardar. Revisa los permisos de Firestore.");
    }
    setGuardando(false);
  }

  // ── TOGGLE ACTIVO ───────────────────────────────────────────────────
  async function toggleActivo(u: UsuarioDoc, e: React.MouseEvent) {
    e.stopPropagation();
    await updateDoc(doc(db,"usuarios",u.id), { activo:!u.activo });
  }

  // ── ELIMINAR ────────────────────────────────────────────────────────
  function confirmarPaso1() {
    if (!delPass.trim()) { setDelErr("Ingresa tu contraseña de administrador."); return; }
    // Genera código de 6 dígitos y simula envío
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    setDelCodigoGen(codigo);
    setDelErr("");
    setDelPaso(2);
  }
  async function confirmarPaso2() {
    if (delCodigo !== delCodigoGen) { setDelErr("El código no coincide. Intenta de nuevo."); return; }
    if (!modalEliminar) return;
    setDelando(true);
    try {
      await deleteDoc(doc(db,"usuarios",modalEliminar.id));
      setModalEliminar(null);
    } catch(err: any) {
      setDelErr(err?.message ?? "Error al eliminar.");
    }
    setDelando(false);
  }

  const activos = lista.filter(u => u.activo).length;

  // ── RENDER ───────────────────────────────────────────────────────────
  return (
    <div style={{padding:"28px 32px",fontFamily:"'Inter',system-ui,sans-serif",maxWidth:1300}}>

      {/* ENCABEZADO */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#f43f5e,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <i className="fa-solid fa-users-gear" style={{color:"#fff",fontSize:18}}/>
          </div>
          <div>
            <h1 style={{color:"#f1f5f9",fontSize:26,fontWeight:800,margin:0,lineHeight:1.1}}>Usuarios</h1>
            <p style={{color:"#475569",fontSize:13,margin:0}}>{activos} activos · {lista.length} en total</p>
          </div>
        </div>
        <button onClick={abrirNuevo} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 18px",background:"#f1f5f9",border:"none",borderRadius:9,color:"#0f172a",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          <i className="fa-solid fa-plus" style={{fontSize:11}}/> Nuevo usuario
        </button>
      </div>

      {/* FILTROS */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1f2937",borderRadius:9,padding:"0 14px",height:38,flex:1,minWidth:200}}>
          <i className="fa-solid fa-magnifying-glass" style={{color:"#374151",fontSize:12}}/>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo…"
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#f1f5f9",fontSize:13,fontFamily:"inherit"}}/>
        </div>
        <select value={filtroRol} onChange={e=>setFiltroRol(e.target.value)} style={{...SEL,height:38,padding:"0 12px",width:"auto",minWidth:150}}>
          <option value="todos">Todos los roles</option>
          {ROLES.map(r=><option key={r} value={r}>{ROL_CFG[r].label}</option>)}
        </select>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{...SEL,height:38,padding:"0 12px",width:"auto",minWidth:140}}>
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* TABLA */}
      <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"auto"}}>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:"36px 200px 200px 120px 150px 160px 90px 148px",padding:"12px 20px",borderBottom:"1px solid #1f2937",minWidth:1120,gap:12}}>
          {["#","Usuario","Correo","Rol","Especialidad","Contraseña","Estado","Acciones"].map(h=>(
            <span key={h} style={{color:"#475569",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{h}</span>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div style={{padding:"48px 20px",textAlign:"center"}}>
            <i className="fa-solid fa-users-slash" style={{color:"#1f2937",fontSize:30,display:"block",marginBottom:10}}/>
            <p style={{color:"#374151",fontSize:14,fontWeight:600,margin:"0 0 4px"}}>Sin resultados</p>
            <p style={{color:"#374151",fontSize:12,margin:0}}>Ajusta los filtros o crea un usuario nuevo</p>
          </div>
        ) : filtrados.map((u, i) => (
          <FilaUsuario
            key={u.id}
            u={u} idx={i}
            total={filtrados.length}
            onEditar={()=>abrirEditar(u)}
            onVerFicha={()=>setModalFicha(u)}
            onEliminar={()=>abrirEliminar(u)}
            onToggleActivo={e=>toggleActivo(u,e)}
          />
        ))}
      </div>

      {/* ── MODAL CREAR/EDITAR ─────────────────────────────────────── */}
      {modalForm && (
        <div onClick={()=>setModalForm(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid #1f2937",borderRadius:16,width:"100%",maxWidth:500,boxShadow:"0 24px 60px rgba(0,0,0,.6)",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{padding:"18px 22px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#0f172a",zIndex:1}}>
              <h2 style={{color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0}}>{editItem?"Editar usuario":"Nuevo usuario"}</h2>
              <button onClick={()=>setModalForm(false)} style={{background:"transparent",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer"}}><i className="fa-solid fa-xmark"/></button>
            </div>

            <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:14}}>
              {errForm && (
                <div style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.3)",borderRadius:8,padding:"10px 14px",display:"flex",gap:8}}>
                  <i className="fa-solid fa-circle-exclamation" style={{color:"#f43f5e",fontSize:13,marginTop:1,flexShrink:0}}/>
                  <span style={{color:"#fca5a5",fontSize:12,lineHeight:1.5}}>{errForm}</span>
                </div>
              )}

              <div><label style={LBL}>Nombre completo *</label>
                <input autoFocus value={form.nombre} onChange={e=>{setErrForm("");setForm(f=>({...f,nombre:e.target.value}));}} placeholder="Ej: Juan Pérez González" style={INPUT}/>
              </div>
              <div><label style={LBL}>Correo electrónico *</label>
                <input type="email" value={form.email} onChange={e=>{setErrForm("");setForm(f=>({...f,email:e.target.value}));}} placeholder="correo@liceo.cl" style={INPUT}/>
              </div>
              <div><label style={LBL}>Contraseña</label>
                <div style={{position:"relative"}}>
                  <input type={verPass?"text":"password"} value={form.contrasena} onChange={e=>setForm(f=>({...f,contrasena:e.target.value}))} placeholder="Contraseña del usuario" style={{...INPUT,paddingRight:40}}/>
                  <button type="button" onClick={()=>setVerPass(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#475569",cursor:"pointer",padding:4}}>
                    <i className={`fa-solid ${verPass?"fa-eye-slash":"fa-eye"}`} style={{fontSize:13}}/>
                  </button>
                </div>
              </div>
              <div><label style={LBL}>Rol</label>
                <select value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value as Rol}))} style={SEL}>
                  {ROLES.map(r=><option key={r} value={r}>{ROL_CFG[r].label}</option>)}
                </select>
              </div>
              <div><label style={LBL}>Especialidad</label>
                <select value={form.especialidad} onChange={e=>setForm(f=>({...f,especialidad:e.target.value}))} style={SEL}>
                  <option value="">Sin especialidad</option>
                  {ESPECIALIDADES.map(e=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              {editItem && (
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div onClick={()=>setForm(f=>({...f,activo:!f.activo}))} style={{width:40,height:22,borderRadius:99,background:form.activo?"#1fb2a6":"#1f2937",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:form.activo?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                  </div>
                  <span style={{color:"#94a3b8",fontSize:13,cursor:"pointer"}} onClick={()=>setForm(f=>({...f,activo:!f.activo}))}>{form.activo?"Usuario activo":"Usuario desactivado"}</span>
                </div>
              )}
            </div>

            <div style={{padding:"14px 22px",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"flex-end",gap:8,position:"sticky",bottom:0,background:"#0f172a"}}>
              <button onClick={()=>setModalForm(false)} style={{padding:"8px 16px",background:"transparent",border:"1px solid #374151",borderRadius:8,color:"#6b7280",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{padding:"8px 20px",background:guardando?"#374151":"#f1f5f9",border:"none",borderRadius:8,color:guardando?"#6b7280":"#0f172a",fontSize:13,fontWeight:700,cursor:guardando?"default":"pointer",fontFamily:"inherit"}}>
                {guardando?<><i className="fa-solid fa-spinner fa-spin" style={{marginRight:6}}/>Guardando…</>:editItem?"Guardar cambios":"Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FICHA ────────────────────────────────────────────── */}
      {modalFicha && (
        <div onClick={()=>setModalFicha(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid #1f2937",borderRadius:16,width:"100%",maxWidth:480,boxShadow:"0 24px 60px rgba(0,0,0,.6)"}}>
            <div style={{padding:"18px 22px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <h2 style={{color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0}}>Ficha de usuario</h2>
              <button onClick={()=>setModalFicha(null)} style={{background:"transparent",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer"}}><i className="fa-solid fa-xmark"/></button>
            </div>
            <div style={{padding:"22px"}}>
              {/* Avatar */}
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                <div style={{width:52,height:52,borderRadius:"50%",background:avatarColor(modalFicha.nombre),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700,flexShrink:0}}>
                  {iniciales(modalFicha.nombre)}
                </div>
                <div>
                  <p style={{color:"#f1f5f9",fontSize:16,fontWeight:700,margin:0}}>{modalFicha.nombre||"Sin nombre"}</p>
                  <p style={{color:"#475569",fontSize:12,margin:"2px 0 0"}}>{modalFicha.email||"—"}</p>
                </div>
              </div>
              {/* Datos */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {[
                  ["Rol",          ROL_CFG[modalFicha.rol]?.label ?? modalFicha.rol],
                  ["Especialidad", modalFicha.especialidad||"—"],
                  ["Estado",       modalFicha.activo?"Activo":"Inactivo"],
                  ["liceoId",      modalFicha.liceoId||"—"],
                  ["Creado",       modalFicha.creadoEn?.toDate?.()?.toLocaleDateString("es-CL") ?? "—"],
                  ["Último acceso",modalFicha.ultimoAcceso||"—"],
                ].map(([k,v])=>(
                  <div key={k} style={{background:"#111827",borderRadius:10,padding:"12px 14px"}}>
                    <p style={{color:"#475569",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,margin:"0 0 4px"}}>{k}</p>
                    <p style={{color:"#f1f5f9",fontSize:13,margin:0}}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"14px 22px",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>{setModalFicha(null);abrirEditar(modalFicha);}} style={{padding:"8px 16px",background:"transparent",border:"1px solid #374151",borderRadius:8,color:"#94a3b8",fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                <i className="fa-solid fa-pen" style={{fontSize:11}}/>Editar
              </button>
              <button onClick={()=>setModalFicha(null)} style={{padding:"8px 16px",background:"#1f2937",border:"none",borderRadius:8,color:"#f1f5f9",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ─────────────────────────────────────────── */}
      {modalEliminar && (
        <div onClick={()=>setModalEliminar(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid #374151",borderRadius:16,width:"100%",maxWidth:440,boxShadow:"0 24px 60px rgba(0,0,0,.6)"}}>
            <div style={{padding:"18px 22px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:"rgba(244,63,94,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className="fa-solid fa-trash" style={{color:"#f43f5e",fontSize:13}}/>
              </div>
              <h2 style={{color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0}}>Eliminar usuario</h2>
            </div>

            <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:14}}>
              {delPaso === 1 && <>
                <p style={{color:"#94a3b8",fontSize:13,margin:0,lineHeight:1.6}}>
                  Vas a eliminar a <strong style={{color:"#f1f5f9"}}>{modalEliminar.nombre}</strong>. Esta acción es permanente.<br/>
                  Ingresa tu contraseña de administrador para continuar.
                </p>
                {delErr && <p style={{color:"#f87171",fontSize:12,margin:0}}>{delErr}</p>}
                <div>
                  <label style={LBL}>Tu contraseña de administrador</label>
                  <input type="password" value={delPass} onChange={e=>{setDelErr("");setDelPass(e.target.value);}} placeholder="••••••••" style={INPUT} autoFocus/>
                </div>
              </>}

              {delPaso === 2 && <>
                <p style={{color:"#94a3b8",fontSize:13,margin:0,lineHeight:1.6}}>
                  Se ha generado un código de verificación. Compártelo con el usuario para confirmar la eliminación.
                </p>
                <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:10,padding:"14px 18px",textAlign:"center"}}>
                  <p style={{color:"#475569",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,margin:"0 0 6px"}}>Código de verificación</p>
                  <p style={{color:"#f1f5f9",fontSize:28,fontWeight:800,letterSpacing:8,margin:0,fontFamily:"monospace"}}>{delCodigoGen}</p>
                </div>
                {delErr && <p style={{color:"#f87171",fontSize:12,margin:0}}>{delErr}</p>}
                <div>
                  <label style={LBL}>Ingresa el código para confirmar</label>
                  <input value={delCodigo} onChange={e=>{setDelErr("");setDelCodigo(e.target.value);}} placeholder="000000" maxLength={6}
                    style={{...INPUT,textAlign:"center",fontSize:18,letterSpacing:6,fontFamily:"monospace"}} autoFocus/>
                </div>
              </>}
            </div>

            <div style={{padding:"14px 22px",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-between",gap:8}}>
              <button onClick={()=>setModalEliminar(null)} style={{padding:"8px 16px",background:"transparent",border:"1px solid #374151",borderRadius:8,color:"#6b7280",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
              {delPaso===1
                ? <button onClick={confirmarPaso1} style={{padding:"8px 20px",background:"rgba(244,63,94,.15)",border:"1px solid rgba(244,63,94,.3)",borderRadius:8,color:"#f43f5e",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Continuar</button>
                : <button onClick={confirmarPaso2} disabled={delando} style={{padding:"8px 20px",background:"#f43f5e",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:delando?"default":"pointer",fontFamily:"inherit"}}>
                    {delando?<><i className="fa-solid fa-spinner fa-spin" style={{marginRight:6}}/>Eliminando…</>:"Eliminar definitivamente"}
                  </button>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fila separada para evitar re-renders innecesarios ─────────────────
function FilaUsuario({ u, idx, total, onEditar, onVerFicha, onEliminar, onToggleActivo }: {
  u: UsuarioDoc; idx: number; total: number;
  onEditar: ()=>void; onVerFicha: ()=>void; onEliminar: ()=>void;
  onToggleActivo: (e: React.MouseEvent)=>void;
}) {
  const [verPass, setVerPass] = useState(false);
  const rc = ROL_CFG[u.rol] ?? ROL_CFG.estudiante;

  // Divide el nombre en dos líneas si tiene más de 2 palabras
  const palabras = (u.nombre||"Sin nombre").trim().split(" ").filter(Boolean);
  const mitad = Math.ceil(palabras.length / 2);
  const linea1 = palabras.slice(0, mitad).join(" ");
  const linea2 = palabras.length > 2 ? palabras.slice(mitad).join(" ") : "";

  // Divide el correo en usuario@dominio
  const [correoUser, correoDom] = (u.email||"—").split("@");

  const BTN: React.CSSProperties = {
    width:30, height:30, background:"transparent", border:"1px solid #1f2937",
    borderRadius:8, color:"#6b7280", fontSize:11, cursor:"pointer",
    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    transition:"all .12s",
  };

  return (
    <div
      style={{display:"grid",gridTemplateColumns:"36px 200px 200px 120px 150px 160px 90px 148px",padding:"14px 20px",borderBottom:idx<total-1?"1px solid #0f172a":"none",alignItems:"center",minWidth:1120,gap:12}}
      onMouseOver={e=>e.currentTarget.style.background="#0f172a"}
      onMouseOut={e=>e.currentTarget.style.background="transparent"}>

      {/* # */}
      <span style={{color:"#374151",fontSize:12,fontVariantNumeric:"tabular-nums"}}>{idx+1}</span>

      {/* Nombre */}
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:avatarColor(u.nombre),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,flexShrink:0}}>
          {iniciales(u.nombre)}
        </div>
        <div style={{minWidth:0}}>
          <p style={{color:"#f1f5f9",fontSize:13,fontWeight:600,margin:0,lineHeight:1.3}}>{linea1}</p>
          {linea2 && <p style={{color:"#94a3b8",fontSize:12,fontWeight:400,margin:"1px 0 0",lineHeight:1.3}}>{linea2}</p>}
        </div>
      </div>

      {/* Correo */}
      <div style={{minWidth:0}}>
        <p style={{color:"#6b7280",fontSize:12,margin:0,lineHeight:1.3}}>{correoUser}</p>
        {correoDom && <p style={{color:"#374151",fontSize:11,margin:"1px 0 0",lineHeight:1.3}}>@{correoDom}</p>}
      </div>

      {/* Rol */}
      <div>
        <span style={{background:rc.bg,color:rc.color,fontSize:11,fontWeight:700,borderRadius:99,padding:"4px 10px",display:"inline-block",border:`1px solid ${rc.color}22`,lineHeight:1.4}}>
          {rc.label}
        </span>
      </div>

      {/* Especialidad */}
      <p style={{color:"#6b7280",fontSize:12,margin:0,lineHeight:1.4}}>{u.especialidad||"—"}</p>

      {/* Contraseña */}
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
        <span style={{color:"#94a3b8",fontSize:12,fontFamily:"monospace",letterSpacing:2,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {u.contrasena ? (verPass ? u.contrasena : "••••••••") : "—"}
        </span>
        {u.contrasena && (
          <button
            onClick={e=>{e.stopPropagation();setVerPass(v=>!v);}}
            title={verPass?"Ocultar":"Mostrar"}
            style={{...BTN,width:26,height:26,flexShrink:0}}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.color="#3b82f6";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
            <i className={`fa-solid ${verPass?"fa-eye-slash":"fa-eye"}`} style={{fontSize:10}}/>
          </button>
        )}
      </div>

      {/* Estado */}
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:u.activo?"#22c55e":"#374151",flexShrink:0,boxShadow:u.activo?"0 0 6px #22c55e66":"none"}}/>
        <span style={{color:u.activo?"#86efac":"#4b5563",fontSize:12,fontWeight:u.activo?500:400}}>
          {u.activo?"Activo":"Inactivo"}
        </span>
      </div>

      {/* Acciones */}
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        <button onClick={e=>{e.stopPropagation();onVerFicha();}} title="Ver ficha" style={BTN}
          onMouseOver={e=>{e.currentTarget.style.borderColor="#a78bfa";e.currentTarget.style.color="#a78bfa";}}
          onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
          <i className="fa-solid fa-eye" style={{fontSize:11}}/>
        </button>
        <button onClick={e=>{e.stopPropagation();onEditar();}} title="Editar" style={BTN}
          onMouseOver={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.color="#3b82f6";}}
          onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
          <i className="fa-solid fa-pen" style={{fontSize:11}}/>
        </button>
        <button onClick={onToggleActivo} title={u.activo?"Desactivar acceso":"Activar acceso"} style={BTN}
          onMouseOver={e=>{e.currentTarget.style.borderColor=u.activo?"#f59e0b":"#22c55e";e.currentTarget.style.color=u.activo?"#f59e0b":"#22c55e";}}
          onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
          <i className={`fa-solid ${u.activo?"fa-lock":"fa-lock-open"}`} style={{fontSize:11}}/>
        </button>
        <button onClick={e=>{e.stopPropagation();onEliminar();}} title="Eliminar usuario" style={BTN}
          onMouseOver={e=>{e.currentTarget.style.borderColor="#f43f5e";e.currentTarget.style.color="#f43f5e";}}
          onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
          <i className="fa-solid fa-trash" style={{fontSize:11}}/>
        </button>
      </div>
    </div>
  );
}
