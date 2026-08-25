"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

/* ─── tipo ───────────────────────────────────────────────────────────────── */
type MaestroGuia = {
  id: string; codigoInterno: string; nombres: string; apellidos: string; run: string;
  empresa: string; empresaId: string; cargo: string; departamento: string; area: string;
  especialidadSupervisada: string; telefono: string; correo: string; estado: string;
  estudiantesAsignados: number; evaluacionesPendientes: number; visitasProgramadas: number;
  incidenciasRegistradas: number; promedioEvaluacion: number; ultimaActividad: string;
  liceoId: string; creadoEn: string;
};

/* ─── helpers visuales ───────────────────────────────────────────────────── */
const ESTADO_CFG: Record<string,{label:string;color:string;bg:string}> = {
  activo:     { label:"Activo",     color:"#22c55e", bg:"rgba(34,197,94,.12)"   },
  inactivo:   { label:"Inactivo",   color:"#6b7280", bg:"rgba(107,114,128,.12)" },
  suspendido: { label:"Suspendido", color:"#ef4444", bg:"rgba(239,68,68,.12)"   },
};
const SEL: React.CSSProperties = {
  background:"#0b1220", border:"1px solid #1f2937", borderRadius:9,
  padding:"0 14px", color:"#f1f5f9", fontSize:13, outline:"none",
  fontFamily:"'Inter',sans-serif", cursor:"pointer", height:42, boxSizing:"border-box",
};
const INP: React.CSSProperties = {
  width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9,
  padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none",
  fontFamily:"'Inter',sans-serif", boxSizing:"border-box",
};
const ESPECIALIDADES = ["Contabilidad","Mecánica","Agropecuaria","Enfermería","Atención de Párvulos","Administración","Informática","Turismo"];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MaestrosGuiaPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [maestros, setMaestros] = useState<MaestroGuia[]>([]);
  const [loading, setLoading]   = useState(true);
  const [vista, setVista]       = useState<"tabla"|"tarjetas">("tabla");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroEsp,    setFiltroEsp]    = useState("todas");
  const [pagina, setPagina]             = useState(1);
  const POR_PAGINA = 10;

  /* modales */
  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalEditar,  setModalEditar]  = useState(false);
  const [mgEdit,       setMgEdit]       = useState<MaestroGuia|null>(null);
  const [guardando,    setGuardando]    = useState(false);

  const FORM_VACIO = {
    apellidos:"", nombres:"", run:"", correo:"", telefono:"",
    empresa:"", empresaId:"", cargo:"Maestro Guía", departamento:"",
    area:"", especialidadSupervisada:"Contabilidad", estado:"activo",
  };
  const [formNuevo, setFormNuevo] = useState(FORM_VACIO);

  /* Firestore */
  useEffect(()=>{
    if(!usuario) return;
    const q = query(collection(db,"maestros_guia"), where("liceoId","==",usuario.liceoId));
    const unsub = onSnapshot(q, snap=>{
      setMaestros(snap.docs.map(d=>({ id:d.id,...d.data() }) as MaestroGuia));
      setLoading(false);
    }, ()=>{ setMaestros([]); setLoading(false); });
    return ()=>unsub();
  },[usuario]);

  /* filtros */
  const especialidades = useMemo(()=>[...new Set(maestros.map(m=>m.especialidadSupervisada).filter(Boolean))].sort(),[maestros]);

  const filtrados = useMemo(()=>{
    const t = busqueda.toLowerCase();
    return maestros.filter(m=>{
      const mb = !busqueda || `${m.apellidos} ${m.nombres} ${m.run} ${m.empresa} ${m.correo}`.toLowerCase().includes(t);
      const me = filtroEstado==="todos" || m.estado===filtroEstado;
      const mf = filtroEsp==="todas" || m.especialidadSupervisada===filtroEsp;
      return mb && me && mf;
    }).sort((a,b)=>a.apellidos.localeCompare(b.apellidos,"es"));
  },[maestros,busqueda,filtroEstado,filtroEsp]);

  const paginados  = filtrados.slice((pagina-1)*POR_PAGINA, pagina*POR_PAGINA);
  const totalPags  = Math.ceil(filtrados.length/POR_PAGINA);

  /* KPIs */
  const kpis = [
    { icon:"fa-id-badge",       label:"Total Maestros Guía",       value:maestros.length,                                            color:"#1fb2a6", bg:"rgba(31,178,166,.12)"  },
    { icon:"fa-circle-check",   label:"Activos",                   value:maestros.filter(m=>m.estado==="activo").length,              color:"#22c55e", bg:"rgba(34,197,94,.12)"   },
    { icon:"fa-building",       label:"Empresas Asociadas",         value:new Set(maestros.map(m=>m.empresaId).filter(Boolean)).size,  color:"#a78bfa", bg:"rgba(167,139,250,.12)" },
    { icon:"fa-user-graduate",  label:"Estudiantes Supervisados",   value:maestros.reduce((s,m)=>s+m.estudiantesAsignados,0),          color:"#3b82f6", bg:"rgba(59,130,246,.12)"  },
    { icon:"fa-file-pen",       label:"Evaluaciones Pendientes",    value:maestros.reduce((s,m)=>s+m.evaluacionesPendientes,0),         color:"#fb923c", bg:"rgba(251,146,60,.12)"  },
    { icon:"fa-calendar-check", label:"Visitas Programadas",         value:maestros.reduce((s,m)=>s+m.visitasProgramadas,0),            color:"#34d399", bg:"rgba(52,211,153,.12)"  },
    { icon:"fa-triangle-exclamation",label:"Incidencias Registradas",value:maestros.reduce((s,m)=>s+m.incidenciasRegistradas,0),       color:"#ef4444", bg:"rgba(239,68,68,.12)"   },
    { icon:"fa-star",           label:"Promedio Evaluación",
      value: maestros.length>0 ? (maestros.reduce((s,m)=>s+(m.promedioEvaluacion||0),0)/maestros.length).toFixed(1) : "—",
      color:"#f59e0b", bg:"rgba(245,158,11,.12)" },
  ];

  /* acciones */
  async function eliminar(id:string, ev:React.MouseEvent) {
    ev.stopPropagation();
    if(!confirm("¿Eliminar este Maestro Guía del sistema?")) return;
    try { await deleteDoc(doc(db,"maestros_guia",id)); }
    catch { setMaestros(prev=>prev.filter(m=>m.id!==id)); }
  }

  async function guardarNuevo() {
    if(!formNuevo.apellidos.trim()||!formNuevo.nombres.trim()){ alert("Apellidos y Nombres son obligatorios."); return; }
    setGuardando(true);
    try {
      await addDoc(collection(db,"maestros_guia"),{
        ...formNuevo, liceoId:usuario?.liceoId??"",
        estudiantesAsignados:0, evaluacionesPendientes:0, visitasProgramadas:0,
        incidenciasRegistradas:0, promedioEvaluacion:0, ultimaActividad:"",
        codigoInterno:`MG-${Date.now().toString().slice(-5)}`,
        creadoEn:serverTimestamp(),
      });
      setFormNuevo(FORM_VACIO); setModalAgregar(false);
    } catch { alert("Error al guardar. Intenta de nuevo."); }
    setGuardando(false);
  }

  async function guardarEditar() {
    if(!mgEdit) return;
    try { await updateDoc(doc(db,"maestros_guia",mgEdit.id),{...mgEdit}); }
    catch { setMaestros(prev=>prev.map(m=>m.id===mgEdit.id?mgEdit:m)); }
    setModalEditar(false); setMgEdit(null);
  }

  /* Excel */
  async function exportarExcel() {
    try {
      const res = await fetch("/api/maestros-guia/exportar-excel",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ maestros:filtrados }),
      });
      if(!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href=URL.createObjectURL(blob); a.download=`maestros_guia_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch { alert("No se pudo generar el Excel."); }
  }

  /* PDF */
  function generarReporte() {
    const fecha = new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"long",year:"numeric"});
    const hora  = new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
    const activos = filtrados.filter(m=>m.estado==="activo").length;
    const totalEst = filtrados.reduce((s,m)=>s+m.estudiantesAsignados,0);
    const filas = filtrados.map((m,i)=>{
      const cfg = ESTADO_CFG[m.estado]??ESTADO_CFG.activo;
      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
        <td style="font-weight:700;color:#1fb2a6;font-size:9px">${m.codigoInterno||"—"}</td>
        <td><div style="font-weight:700;color:#0f172a;font-size:10px">${m.apellidos}</div><div style="color:#64748b;font-size:8.5px">${m.nombres}</div></td>
        <td style="font-family:monospace;font-size:9px;color:#334155">${m.run||"—"}</td>
        <td style="font-size:9px;color:#334155">${m.empresa||"—"}</td>
        <td style="font-size:9px;color:#334155">${m.cargo||"—"}</td>
        <td style="font-size:9px;color:#334155">${m.especialidadSupervisada||"—"}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:#3b82f6">${m.estudiantesAsignados}</td>
        <td style="font-size:9px;color:#334155">${m.telefono||"—"}</td>
        <td><span style="padding:2px 8px;border-radius:20px;font-size:8px;font-weight:700;background:${cfg.bg.replace("rgba","rgb").replace(",.12)",")") };color:${cfg.color}">${cfg.label}</span></td>
        <td style="font-size:8.5px;color:#64748b">${m.ultimaActividad||"—"}</td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Maestros Guía — SIGEDUAL</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#0f172a}
    .hdr{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0b2a2a 100%);color:#fff;padding:28px 36px 22px;position:relative;overflow:hidden}
    .hdr::before{content:"";position:absolute;top:-50px;right:-50px;width:220px;height:220px;background:radial-gradient(circle,rgba(31,178,166,.18) 0%,transparent 70%);border-radius:50%}
    .hdr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .logo{display:flex;align-items:center;gap:12px}
    .logo-box{width:46px;height:46px;background:linear-gradient(135deg,#1fb2a6,#2563eb);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px}
    .logo h1{font-size:20px;font-weight:800}.logo p{font-size:10px;color:rgba(255,255,255,.5);margin-top:2px}
    .meta{text-align:right;font-size:9.5px;color:rgba(255,255,255,.55);line-height:1.8}.meta strong{color:#fff}
    .htitle{font-size:24px;font-weight:800;margin-bottom:4px}.hsub{font-size:11px;color:rgba(255,255,255,.55)}
    .kpi-bar{display:flex;background:#f8fafc;border-bottom:3px solid #1fb2a6}
    .kpi{flex:1;padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center}.kpi:last-child{border-right:none}
    .kv{font-size:22px;font-weight:800;line-height:1;margin-bottom:3px}.kl{font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase}
    .tw{padding:0 36px 24px}table{width:100%;border-collapse:collapse;margin-top:14px}
    thead tr{background:linear-gradient(135deg,#0f172a,#1e3a5f)}
    th{padding:9px 11px;text-align:left;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;white-space:nowrap}
    td{padding:8px 11px;vertical-align:middle;border-bottom:1px solid #e2e8f0}
    .footer{background:#f1f5f9;border-top:2px solid #e2e8f0;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;font-size:8.5px;color:#94a3b8}
    .footer strong{color:#475569}@page{size:A4 landscape;margin:0}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
    <div class="hdr"><div class="hdr-row"><div class="logo"><div class="logo-box">👨‍💼</div>
    <div><h1>SIGEDUAL</h1><p>Sistema Integrado de Gestión Formación Dual</p></div></div>
    <div class="meta"><div>Generado por <strong>SIGEDUAL</strong></div><div>Fecha: <strong>${fecha}</strong></div>
    <div>Hora: <strong>${hora}</strong></div><div>Documento <strong>Oficial</strong></div></div></div>
    <div class="htitle">Reporte · Maestros Guía</div>
    <div class="hsub">Listado completo de Maestros Guía del programa de formación dual</div></div>
    <div class="kpi-bar">
      <div class="kpi"><div class="kv" style="color:#0d9488">${filtrados.length}</div><div class="kl">Total</div></div>
      <div class="kpi"><div class="kv" style="color:#15803d">${activos}</div><div class="kl">Activos</div></div>
      <div class="kpi"><div class="kv" style="color:#2563eb">${totalEst}</div><div class="kl">Estudiantes</div></div>
      <div class="kpi"><div class="kv" style="color:#d97706">${filtrados.reduce((s,m)=>s+m.evaluacionesPendientes,0)}</div><div class="kl">Eval. Pend.</div></div>
      <div class="kpi"><div class="kv" style="color:#dc2626">${filtrados.reduce((s,m)=>s+m.incidenciasRegistradas,0)}</div><div class="kl">Incidencias</div></div>
    </div>
    <div class="tw"><table><thead><tr>
      <th>ID</th><th>Apellidos / Nombres</th><th>RUN</th><th>Empresa</th><th>Cargo</th>
      <th>Especialidad</th><th>Estudiantes</th><th>Teléfono</th><th>Estado</th><th>Últ. Actividad</th>
    </tr></thead><tbody>${filas}</tbody></table></div>
    <div class="footer">
      <div>© ${new Date().getFullYear()} <strong>SIGEDUAL</strong> · Todos los derechos reservados</div>
      <div>Reporte generado automáticamente · No requiere firma</div>
    </div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
    const v=window.open("","_blank","width=1200,height=800");
    if(!v) return; v.document.open(); v.document.write(html); v.document.close();
  }

  /* ── render ── */
  return (
    <div style={{ padding:"28px 32px", maxWidth:1500, fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh" }}>

      {/* CABECERA */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:46, height:46, borderRadius:13, background:"linear-gradient(135deg,#1fb2a6,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 6px 18px rgba(31,178,166,.30)" }}>
            <i className="fa-solid fa-id-badge" style={{ color:"#fff", fontSize:19 }}/>
          </div>
          <div>
            <h1 style={{ color:"#f1f5f9", fontSize:26, fontWeight:800, margin:0, lineHeight:1.1 }}>Maestros Guía</h1>
            <p style={{ color:"#475569", fontSize:13, margin:0 }}>Supervisores de estudiantes en empresas duales</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={generarReporte} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 16px",background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.25)",borderRadius:9,color:"#818cf8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background="rgba(99,102,241,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(99,102,241,.12)"}>
            <i className="fa-solid fa-file-pdf" style={{fontSize:12}}/>Generar PDF
          </button>
          <button onClick={exportarExcel} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 16px",background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.25)",borderRadius:9,color:"#22c55e",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background="rgba(34,197,94,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(34,197,94,.12)"}>
            <i className="fa-solid fa-file-excel" style={{fontSize:12}}/>Exportar Excel
          </button>
          <div style={{ width:1, height:32, background:"#1f2937" }}/>
          <button onClick={()=>setModalAgregar(true)} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 20px",background:"linear-gradient(135deg,#1fb2a6,#a78bfa)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}
            onMouseOver={e=>e.currentTarget.style.opacity="0.9"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Maestro Guía
          </button>
        </div>
      </div>

      {/* KPIs — fila 1 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:13 }}>
        {kpis.slice(0,4).map(k=>(
          <div key={k.label} style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",transition:"border-color .15s,transform .15s" }}
            onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=k.color+"55";(e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)"}}
            onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="#1f2937";(e.currentTarget as HTMLDivElement).style.transform="translateY(0)"}}>
            <div style={{ width:38,height:38,borderRadius:10,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color:k.color,fontSize:16 }}/>
            </div>
            <p style={{ color:"#f1f5f9",fontSize:30,fontWeight:800,margin:"0 0 3px",lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280",fontSize:11,margin:0,fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>
      {/* KPIs — fila 2 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:26 }}>
        {kpis.slice(4).map(k=>(
          <div key={k.label} style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",transition:"border-color .15s,transform .15s" }}
            onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=k.color+"55";(e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)"}}
            onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="#1f2937";(e.currentTarget as HTMLDivElement).style.transform="translateY(0)"}}>
            <div style={{ width:38,height:38,borderRadius:10,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color:k.color,fontSize:16 }}/>
            </div>
            <p style={{ color:"#f1f5f9",fontSize:30,fontWeight:800,margin:"0 0 3px",lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280",fontSize:11,margin:0,fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"16px 20px",marginBottom:18 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"0 14px",height:42 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color:"#475569",fontSize:13 }}/>
            <input value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPagina(1);}} placeholder="Buscar por apellido, RUN, empresa…"
              style={{ flex:1,background:"transparent",border:"none",outline:"none",color:"#f1f5f9",fontSize:13,fontFamily:"'Inter',sans-serif" }}/>
            {busqueda && <button onClick={()=>setBusqueda("")} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer" }}><i className="fa-solid fa-xmark" style={{fontSize:12}}/></button>}
          </div>
          <select value={filtroEstado} onChange={e=>{setFiltroEstado(e.target.value);setPagina(1);}} style={SEL}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="suspendido">Suspendido</option>
          </select>
          <select value={filtroEsp} onChange={e=>{setFiltroEsp(e.target.value);setPagina(1);}} style={SEL}>
            <option value="todas">Toda especialidad</option>
            {especialidades.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <div style={{ display:"flex",gap:8 }}>
            {(["tabla","tarjetas"] as const).map(v=>(
              <button key={v} onClick={()=>setVista(v)}
                style={{ flex:1,height:42,borderRadius:9,border:"1px solid #1f2937",background:vista===v?"rgba(31,178,166,.15)":"#0b1220",color:vista===v?"#1fb2a6":"#475569",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif" }}>
                <i className={`fa-solid ${v==="tabla"?"fa-table-list":"fa-grip"}`}/>
              </button>
            ))}
          </div>
          {(busqueda||filtroEstado!=="todos"||filtroEsp!=="todas") && (
            <button onClick={()=>{setBusqueda("");setFiltroEstado("todos");setFiltroEsp("todas");setPagina(1);}}
              style={{ height:42,padding:"0 14px",background:"none",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap" }}>
              <i className="fa-solid fa-xmark" style={{marginRight:5,fontSize:11}}/>Limpiar
            </button>
          )}
        </div>
      </div>

      <p style={{ color:"#94a3b8",fontSize:13,margin:"0 0 12px" }}>
        Mostrando <strong style={{color:"#f1f5f9"}}>{filtrados.length}</strong> maestro{filtrados.length!==1?"s":""} guía · ordenados alfabéticamente
      </p>

      {/* CONTENIDO */}
      {loading ? (
        <div style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:56,textAlign:"center" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ color:"#1fb2a6",fontSize:28,display:"block",marginBottom:14 }}/>
          <p style={{ color:"#475569",fontSize:14,margin:0 }}>Cargando Maestros Guía…</p>
        </div>
      ) : filtrados.length===0 ? (
        <div style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:72,textAlign:"center" }}>
          <i className="fa-solid fa-id-badge" style={{ color:"#334155",fontSize:36,display:"block",marginBottom:16 }}/>
          <p style={{ color:"#64748b",fontSize:15,fontWeight:600,margin:"0 0 6px" }}>No se encontraron Maestros Guía</p>
          <p style={{ color:"#334155",fontSize:13,margin:"0 0 20px" }}>Agrega el primer Maestro Guía con el botón superior derecho.</p>
          <button onClick={()=>setModalAgregar(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"linear-gradient(135deg,#1fb2a6,#a78bfa)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
            <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Maestro Guía
          </button>
        </div>
      ) : vista==="tabla" ? (

        /* ── VISTA TABLA ── */
        <div style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",minWidth:1100,borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"rgba(255,255,255,.02)",borderBottom:"1px solid #1f2937" }}>
                  {["Nº","ID","Apellidos","Nombres","RUN","Empresa","Cargo","Especialidad","Estudiantes","Teléfono","Estado","Acciones"].map(h=>(
                    <th key={h} style={{ padding:"12px 14px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.4px",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginados.map((m,idx)=>{
                  const cfg = ESTADO_CFG[m.estado]??ESTADO_CFG.activo;
                  const rowBg = idx%2===0?"transparent":"rgba(255,255,255,.01)";
                  return (
                    <tr key={m.id} style={{ borderBottom:"1px solid #1f2937",background:rowBg,transition:"background .12s" }}
                      onMouseOver={ev=>ev.currentTarget.style.background="rgba(31,178,166,.05)"}
                      onMouseOut={ev=>ev.currentTarget.style.background=rowBg}>
                      <td style={{ padding:"0 14px",height:50,textAlign:"center" }}>
                        <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:"rgba(31,178,166,.12)",color:"#1fb2a6",fontSize:11,fontWeight:700 }}>
                          {(pagina-1)*POR_PAGINA+idx+1}
                        </span>
                      </td>
                      <td style={{ padding:"0 14px",height:50,color:"#1fb2a6",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>{m.codigoInterno||"—"}</td>
                      <td style={{ padding:"0 14px",height:50,color:"#f1f5f9",fontSize:14,fontWeight:700,whiteSpace:"nowrap" }}>{m.apellidos}</td>
                      <td style={{ padding:"0 14px",height:50,color:"#cbd5e1",fontSize:13,whiteSpace:"nowrap" }}>{m.nombres}</td>
                      <td style={{ padding:"0 14px",height:50,color:"#64748b",fontSize:12,fontFamily:"monospace",whiteSpace:"nowrap" }}>{m.run||"—"}</td>
                      <td style={{ padding:"0 14px",height:50,color:"#94a3b8",fontSize:12,whiteSpace:"nowrap" }}>{m.empresa||"—"}</td>
                      <td style={{ padding:"0 14px",height:50,color:"#64748b",fontSize:12,whiteSpace:"nowrap" }}>{m.cargo||"—"}</td>
                      <td style={{ padding:"0 14px",height:50,whiteSpace:"nowrap" }}>
                        <span style={{ background:"rgba(167,139,250,.12)",border:"1px solid rgba(167,139,250,.20)",color:"#a78bfa",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600 }}>{m.especialidadSupervisada||"—"}</span>
                      </td>
                      <td style={{ padding:"0 14px",height:50,textAlign:"center" }}>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:5,color:"#3b82f6",fontSize:13,fontWeight:700 }}>
                          <i className="fa-solid fa-user-graduate" style={{fontSize:10}}/>{m.estudiantesAsignados}
                        </span>
                      </td>
                      <td style={{ padding:"0 14px",height:50,color:"#64748b",fontSize:12,whiteSpace:"nowrap" }}>{m.telefono||"—"}</td>
                      <td style={{ padding:"0 14px",height:50 }}>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:5,color:cfg.color,background:cfg.bg,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700 }}>
                          <span style={{ width:6,height:6,borderRadius:"50%",background:cfg.color }}/>{cfg.label}
                        </span>
                      </td>
                      <td style={{ padding:"0 14px",height:50 }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:"inline-flex",gap:6 }}>
                          <button title="Ver ficha" onClick={()=>router.push(`/dashboard/maestros-guia/${m.id}`)}
                            style={{ width:30,height:30,borderRadius:8,background:"rgba(31,178,166,.12)",border:"none",color:"#1fb2a6",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                            onMouseOver={e=>e.currentTarget.style.background="rgba(31,178,166,.24)"} onMouseOut={e=>e.currentTarget.style.background="rgba(31,178,166,.12)"}>
                            <i className="fa-solid fa-eye" style={{fontSize:12}}/>
                          </button>
                          <button title="Editar" onClick={()=>{setMgEdit(m);setModalEditar(true);}}
                            style={{ width:30,height:30,borderRadius:8,background:"rgba(245,158,11,.12)",border:"none",color:"#f59e0b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                            onMouseOver={e=>e.currentTarget.style.background="rgba(245,158,11,.24)"} onMouseOut={e=>e.currentTarget.style.background="rgba(245,158,11,.12)"}>
                            <i className="fa-solid fa-pencil" style={{fontSize:12}}/>
                          </button>
                          <button title="Eliminar" onClick={ev=>eliminar(m.id,ev)}
                            style={{ width:30,height:30,borderRadius:8,background:"rgba(239,68,68,.12)",border:"none",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                            onMouseOver={e=>e.currentTarget.style.background="rgba(239,68,68,.24)"} onMouseOut={e=>e.currentTarget.style.background="rgba(239,68,68,.12)"}>
                            <i className="fa-solid fa-trash" style={{fontSize:12}}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPags>1 && (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderTop:"1px solid #1f2937" }}>
              <p style={{ color:"#475569",fontSize:12,margin:0 }}>Pág. {pagina} de {totalPags} · {filtrados.length} registros</p>
              <div style={{ display:"flex",gap:6 }}>
                {Array.from({length:totalPags},(_,i)=>i+1).map(n=>(
                  <button key={n} onClick={()=>setPagina(n)}
                    style={{ width:32,height:32,borderRadius:8,border:"1px solid #1f2937",background:pagina===n?"rgba(31,178,166,.20)":"#0b1220",color:pagina===n?"#1fb2a6":"#475569",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding:"12px 20px",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-between" }}>
            <p style={{ color:"#475569",fontSize:12,margin:0 }}>{filtrados.length} maestro{filtrados.length!==1?"s":""} guía</p>
            <p style={{ color:"#334155",fontSize:11,margin:0 }}>Ordenado alfabéticamente por apellidos</p>
          </div>
        </div>

      ) : (
        /* ── VISTA TARJETAS ── */
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16 }}>
          {filtrados.map(m=>{
            const cfg = ESTADO_CFG[m.estado]??ESTADO_CFG.activo;
            return (
              <div key={m.id} style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:20,cursor:"pointer",transition:"border-color .15s,transform .15s" }}
                onMouseOver={ev=>{(ev.currentTarget as HTMLDivElement).style.borderColor="#1fb2a655";(ev.currentTarget as HTMLDivElement).style.transform="translateY(-3px)"}}
                onMouseOut={ev=>{(ev.currentTarget as HTMLDivElement).style.borderColor="#1f2937";(ev.currentTarget as HTMLDivElement).style.transform="translateY(0)"}}
                onClick={()=>router.push(`/dashboard/maestros-guia/${m.id}`)}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#1fb2a6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#fff" }}>
                      {m.apellidos.charAt(0)}{m.nombres.charAt(0)}
                    </div>
                    <div>
                      <p style={{ color:"#f1f5f9",fontSize:14,fontWeight:700,margin:0,lineHeight:1.3 }}>{m.apellidos}</p>
                      <p style={{ color:"#94a3b8",fontSize:12,margin:0 }}>{m.nombres}</p>
                    </div>
                  </div>
                  <span style={{ display:"inline-flex",alignItems:"center",gap:4,color:cfg.color,background:cfg.bg,borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700 }}>
                    <span style={{ width:5,height:5,borderRadius:"50%",background:cfg.color }}/>{cfg.label}
                  </span>
                </div>
                <p style={{ color:"#64748b",fontSize:12,margin:"0 0 10px" }}>{m.empresa||"Sin empresa asignada"}</p>
                <span style={{ background:"rgba(167,139,250,.12)",border:"1px solid rgba(167,139,250,.20)",color:"#a78bfa",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600 }}>{m.especialidadSupervisada||"—"}</span>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"14px 0" }}>
                  {[
                    { icon:"fa-user-graduate",val:m.estudiantesAsignados,label:"Est.",color:"#3b82f6" },
                    { icon:"fa-file-pen",val:m.evaluacionesPendientes,label:"Eval.",color:"#fb923c" },
                  ].map(x=>(
                    <div key={x.label} style={{ background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"8px 10px",textAlign:"center" }}>
                      <i className={`fa-solid ${x.icon}`} style={{ color:x.color,fontSize:13,display:"block",marginBottom:4 }}/>
                      <p style={{ color:"#f1f5f9",fontSize:16,fontWeight:800,margin:0,lineHeight:1 }}>{x.val}</p>
                      <p style={{ color:"#475569",fontSize:9,margin:0 }}>{x.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:12,borderTop:"1px solid #1f2937" }} onClick={e=>e.stopPropagation()}>
                  <span style={{ color:"#475569",fontSize:11,fontFamily:"monospace" }}>{m.run||"Sin RUN"}</span>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>{setMgEdit(m);setModalEditar(true);}} style={{ width:28,height:28,borderRadius:7,background:"rgba(245,158,11,.12)",border:"none",color:"#f59e0b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <i className="fa-solid fa-pencil" style={{fontSize:11}}/>
                    </button>
                    <button onClick={ev=>eliminar(m.id,ev)} style={{ width:28,height:28,borderRadius:7,background:"rgba(239,68,68,.12)",border:"none",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <i className="fa-solid fa-trash" style={{fontSize:11}}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL AGREGAR ══ */}
      {modalAgregar && (
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalAgregar(false); }}>
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.72)",backdropFilter:"blur(4px)" }} data-backdrop="1"/>
          <div style={{ position:"relative",width:"100%",maxWidth:700,background:"#111827",border:"1px solid #1f2937",borderRadius:18,boxShadow:"0 32px 80px rgba(0,0,0,.60)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"92vh" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"rgba(31,178,166,.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <i className="fa-solid fa-id-badge" style={{ color:"#1fb2a6",fontSize:14 }}/>
                </div>
                <p style={{ color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0 }}>Agregar Maestro Guía</p>
              </div>
              <button onClick={()=>setModalAgregar(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{fontSize:13}}/>
              </button>
            </div>
            <div style={{ overflowY:"auto",flex:1,padding:24 }}>
              <p style={{ color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6 }}>
                <i className="fa-solid fa-user" style={{color:"#1fb2a6",fontSize:11}}/> Datos personales
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20 }}>
                {([["apellidos","Apellidos *","text"],["nombres","Nombres *","text"],["run","RUN","text"],["telefono","Teléfono","tel"],["correo","Correo","email"]] as [keyof typeof formNuevo,string,string][]).map(([k,lbl,type])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input type={type} value={formNuevo[k]} onChange={e=>setFormNuevo(p=>({...p,[k]:e.target.value}))} style={INP}
                      onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
              </div>
              <p style={{ color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6 }}>
                <i className="fa-solid fa-building" style={{color:"#1fb2a6",fontSize:11}}/> Información laboral
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {([["empresa","Empresa","text"],["cargo","Cargo","text"],["departamento","Departamento","text"],["area","Área","text"]] as [keyof typeof formNuevo,string,string][]).map(([k,lbl,type])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input type={type} value={formNuevo[k]} onChange={e=>setFormNuevo(p=>({...p,[k]:e.target.value}))} style={INP}
                      onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Especialidad que supervisa</p>
                  <select value={formNuevo.especialidadSupervisada} onChange={e=>setFormNuevo(p=>({...p,especialidadSupervisada:e.target.value}))} style={{ ...INP,cursor:"pointer" }}>
                    {ESPECIALIDADES.map(e=><option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Estado</p>
                  <select value={formNuevo.estado} onChange={e=>setFormNuevo(p=>({...p,estado:e.target.value}))} style={{ ...INP,cursor:"pointer" }}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="suspendido">Suspendido</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10,padding:"16px 24px",borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>setModalAgregar(false)} style={{ padding:"10px 20px",background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>Cancelar</button>
              <button onClick={guardarNuevo} disabled={guardando}
                style={{ padding:"10px 24px",background:guardando?"#334155":"linear-gradient(135deg,#1fb2a6,#a78bfa)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:guardando?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
                {guardando?<><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Guardando…</>:<><i className="fa-solid fa-floppy-disk" style={{fontSize:11}}/>Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDITAR ══ */}
      {modalEditar && mgEdit && (
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalEditar(false); }}>
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.72)",backdropFilter:"blur(4px)" }} data-backdrop="1"/>
          <div style={{ position:"relative",width:"100%",maxWidth:660,background:"#111827",border:"1px solid #1f2937",borderRadius:18,boxShadow:"0 32px 80px rgba(0,0,0,.60)",overflow:"hidden",maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"rgba(245,158,11,.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <i className="fa-solid fa-pencil" style={{ color:"#f59e0b",fontSize:14 }}/>
                </div>
                <p style={{ color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0 }}>Editar Maestro Guía</p>
              </div>
              <button onClick={()=>setModalEditar(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{fontSize:13}}/>
              </button>
            </div>
            <div style={{ overflowY:"auto",flex:1,padding:24 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                {([["apellidos","Apellidos"],["nombres","Nombres"],["run","RUN"],["empresa","Empresa"],["cargo","Cargo"],["departamento","Departamento"],["area","Área"],["telefono","Teléfono"],["correo","Correo"]] as [keyof MaestroGuia,string][]).map(([k,lbl])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input value={String(mgEdit[k]??"")} onChange={e=>setMgEdit(prev=>prev?({...prev,[k]:e.target.value}):prev)} style={INP}
                      onFocus={e=>e.currentTarget.style.borderColor="#f59e0b"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Especialidad</p>
                  <select value={mgEdit.especialidadSupervisada} onChange={e=>setMgEdit(p=>p?({...p,especialidadSupervisada:e.target.value}):p)} style={{ ...INP,cursor:"pointer" }}>
                    {ESPECIALIDADES.map(e=><option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Estado</p>
                  <select value={mgEdit.estado} onChange={e=>setMgEdit(p=>p?({...p,estado:e.target.value}):p)} style={{ ...INP,cursor:"pointer" }}>
                    <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="suspendido">Suspendido</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10,padding:"18px 24px",borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>setModalEditar(false)} style={{ padding:"10px 20px",background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>Cancelar</button>
              <button onClick={guardarEditar} style={{ padding:"10px 24px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
                <i className="fa-solid fa-floppy-disk" style={{marginRight:7,fontSize:12}}/>Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
