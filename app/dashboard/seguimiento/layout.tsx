"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

// ── Types ────────────────────────────────────────────────────────────────────
type TabId = "visitas"|"evaluaciones"|"bitacoras"|"informes"|"alertas";
type EstadoKey = "programada"|"realizada"|"pendiente"|"cancelada"|"en_proceso"|"aprobado"|"rechazado"|"borrador"|"activa"|"resuelta";
type PrioridadKey = "critica"|"alta"|"media"|"baja";
type PanelSub = "resumen"|"historial"|"adjuntos";

interface Visita    { id:string; empresa:string; estudiante:string; responsable:string; fecha:string; estado:EstadoKey; motivo:string; resultado:string; observaciones:string; asunto:string; }
interface EmpresaOpt { id:string; nombre:string; }
interface EstudianteOpt { id:string; nombres:string; apellidos:string; }
interface Evaluacion{ id:string; tipo:string; evaluador:string; estudiante:string; empresa:string; fecha:string; progreso:number; resultado:string; comentarios:string; }
interface Bitacora  { id:string; fecha:string; hora:string; usuario:string; accion:string; descripcion:string; adjuntos:string[]; comentarios:string[]; }
interface Informe   { id:string; nombre:string; tipo:string; estudiante:string; empresa:string; autor:string; fecha:string; estado:EstadoKey; }
interface Alerta    { id:string; titulo:string; prioridad:PrioridadKey; origen:string; estudiante:string; empresa:string; fecha:string; motivo:string; nivel_riesgo:"alto"|"medio"|"bajo"; estado:EstadoKey; responsable:string; acciones:string[]; }

// ── Palette & constants ───────────────────────────────────────────────────────
const EM: Record<EstadoKey,{c:string;bg:string;label:string}> = {
  programada:{c:"#3b82f6",bg:"rgba(59,130,246,.12)",label:"Programada"},realizada:{c:"#22c55e",bg:"rgba(34,197,94,.12)",label:"Realizada"},
  pendiente:{c:"#f59e0b",bg:"rgba(245,158,11,.12)",label:"Pendiente"},cancelada:{c:"#6b7280",bg:"rgba(107,114,128,.12)",label:"Cancelada"},
  en_proceso:{c:"#a78bfa",bg:"rgba(167,139,250,.12)",label:"En proceso"},aprobado:{c:"#22c55e",bg:"rgba(34,197,94,.12)",label:"Aprobado"},
  rechazado:{c:"#f43f5e",bg:"rgba(244,63,94,.12)",label:"Rechazado"},borrador:{c:"#94a3b8",bg:"rgba(148,163,184,.12)",label:"Borrador"},
  activa:{c:"#f43f5e",bg:"rgba(244,63,94,.12)",label:"Activa"},resuelta:{c:"#22c55e",bg:"rgba(34,197,94,.12)",label:"Resuelta"},
};
const PM: Record<PrioridadKey,{c:string;label:string}> = {
  critica:{c:"#f43f5e",label:"Crítica"},alta:{c:"#f97316",label:"Alta"},media:{c:"#f59e0b",label:"Media"},baja:{c:"#22c55e",label:"Baja"},
};
const BIT_COLORS: Record<string,string> = {
  "Visita registrada":"#3b82f6","Evaluación completada":"#a78bfa","Alerta generada":"#f43f5e","Informe creado":"#22c55e","Bitácora actualizada":"#f59e0b",
};
const TABS: {id:TabId;label:string;icon:string;color:string}[] = [
  {id:"visitas",label:"Visitas",icon:"fa-map-location-dot",color:"#3b82f6"},
  {id:"evaluaciones",label:"Evaluaciones",icon:"fa-star",color:"#a78bfa"},
  {id:"bitacoras",label:"Bitácoras",icon:"fa-book-open",color:"#f59e0b"},
  {id:"informes",label:"Informes",icon:"fa-file-lines",color:"#22c55e"},
  {id:"alertas",label:"Alertas",icon:"fa-triangle-exclamation",color:"#f43f5e"},
];
const NUEVO_LABEL: Record<TabId,string> = {
  visitas:"Nueva visita",evaluaciones:"Nueva evaluación",bitacoras:"Nueva entrada",informes:"Nuevo informe",alertas:"Nueva alerta",
};
const TODAY = new Date().toISOString().split("T")[0];

function fd(s:string){return s?new Date(s+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"short",year:"numeric"}):"—";}

// ── Micro-components ──────────────────────────────────────────────────────────
function Badge({estado}:{estado:EstadoKey}){const m=EM[estado]??EM.pendiente;return<span style={{color:m.c,background:m.bg,fontSize:11,fontWeight:600,borderRadius:99,padding:"3px 10px",whiteSpace:"nowrap"}}>{m.label}</span>;}

function RowInfo({icon,label,value}:{icon:string;label:string;value:string}){
  return<div style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-start"}}>
    <i className={`fa-solid ${icon}`} style={{color:"#374151",fontSize:11,marginTop:3,width:14,flexShrink:0}}/>
    <div><p style={{color:"#374151",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,margin:"0 0 2px"}}>{label}</p><p style={{color:"#f1f5f9",fontSize:13,margin:0,lineHeight:1.5}}>{value||"—"}</p></div>
  </div>;
}

function SubTabs({sub,setSub,items}:{sub:PanelSub;setSub:(t:PanelSub)=>void;items:{id:PanelSub;label:string}[]}){
  return<div style={{display:"flex",borderBottom:"1px solid #1f2937",padding:"0 4px"}}>
    {items.map(t=><button key={t.id} onClick={()=>setSub(t.id)} style={{padding:"9px 14px",border:"none",borderBottom:`2px solid ${sub===t.id?"#3b82f6":"transparent"}`,background:"transparent",color:sub===t.id?"#3b82f6":"#64748b",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>{t.label}</button>)}
  </div>;
}

function MiniTimeline({items}:{items:{accion:string;usuario:string;hora:string}[]}){
  return<div>{items.map((h,i)=><div key={i} style={{display:"flex",gap:10,paddingBottom:14}}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",marginTop:4}}/>
      {i<items.length-1&&<div style={{width:1,flex:1,background:"#1f2937",marginTop:3}}/>}
    </div>
    <div><p style={{color:"#f1f5f9",fontSize:12,fontWeight:600,margin:"0 0 1px"}}>{h.accion}</p><p style={{color:"#374151",fontSize:11,margin:0}}>{h.usuario} · {h.hora}</p></div>
  </div>)}</div>;
}

// ── Card components ───────────────────────────────────────────────────────────
function CardVisita({v,sel,setSel,hov,setHov}:{v:Visita;sel:string|null;setSel:(id:string|null)=>void;hov:string|null;setHov:(id:string|null)=>void}){
  const active=sel===v.id,over=hov===v.id;
  return<div onMouseEnter={()=>setHov(v.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setSel(active?null:v.id)}
    style={{background:active?"#0d1929":over?"#131d2e":"#111827",border:`1px solid ${active?"#3b82f644":"#1f2937"}`,borderLeft:`3px solid ${active?"#3b82f6":"transparent"}`,borderRadius:12,padding:"15px 18px",cursor:"pointer",marginBottom:8,transition:"all .15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
      <div style={{flex:1,paddingRight:12}}>
        <p style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.empresa||"Sin empresa"}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-user-graduate" style={{fontSize:10,color:"#374151",marginRight:4}}/>{v.estudiante}</span>
          {v.responsable&&<span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-chalkboard-user" style={{fontSize:10,color:"#374151",marginRight:4}}/>{v.responsable}</span>}
        </div>
      </div>
      <Badge estado={v.estado}/>
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{color:"#374151",fontSize:12}}><i className="fa-regular fa-calendar" style={{fontSize:10,marginRight:4}}/>{fd(v.fecha)}{v.motivo&&" · "+v.motivo}</span>
      <div style={{display:"flex",gap:4,opacity:active||over?1:0,transition:"opacity .15s"}}>
        {["fa-pen","fa-ellipsis"].map(ic=><button key={ic} onClick={e=>e.stopPropagation()} style={{width:28,height:28,borderRadius:7,border:"1px solid #1f2937",background:"transparent",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`fa-solid ${ic}`} style={{fontSize:11}}/></button>)}
      </div>
    </div>
    {v.asunto&&<div style={{marginTop:8}}><span style={{background:"rgba(59,130,246,.10)",color:"#3b82f6",fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:99,border:"1px solid rgba(59,130,246,.2)"}}><i className="fa-solid fa-tag" style={{fontSize:9,marginRight:4}}/>{v.asunto}</span></div>}
  </div>;
}

function CardEvaluacion({e,sel,setSel,hov,setHov}:{e:Evaluacion;sel:string|null;setSel:(id:string|null)=>void;hov:string|null;setHov:(id:string|null)=>void}){
  const active=sel===e.id,over=hov===e.id;
  const TC:Record<string,string>={Diagnóstica:"#3b82f6",Parcial:"#f59e0b",Final:"#22c55e"};
  const c=TC[e.tipo]??"#6b7280";
  return<div onMouseEnter={()=>setHov(e.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setSel(active?null:e.id)}
    style={{background:active?"#0d1929":over?"#131d2e":"#111827",border:`1px solid ${active?`${c}44`:"#1f2937"}`,borderLeft:`3px solid ${active?c:"transparent"}`,borderRadius:12,padding:"15px 18px",cursor:"pointer",marginBottom:8,transition:"all .15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
      <div style={{flex:1,paddingRight:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{color:c,background:`${c}18`,fontSize:11,fontWeight:700,borderRadius:99,padding:"2px 9px"}}>{e.tipo}</span>
          <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>{e.estudiante}</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-building" style={{fontSize:10,color:"#374151",marginRight:4}}/>{e.empresa}</span>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-chalkboard-user" style={{fontSize:10,color:"#374151",marginRight:4}}/>{e.evaluador}</span>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <p style={{color:"#f1f5f9",fontSize:20,fontWeight:900,margin:0,lineHeight:1}}>{e.resultado||"—"}</p>
        <p style={{color:"#374151",fontSize:10,fontWeight:600,margin:"2px 0 0"}}>NOTA</p>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1,height:4,background:"#0f172a",borderRadius:99}}><div style={{height:"100%",width:`${e.progreso||0}%`,background:(e.progreso||0)===100?"#22c55e":"#f59e0b",borderRadius:99}}/></div>
      <span style={{color:"#374151",fontSize:11,fontWeight:600}}>{e.progreso||0}%</span>
      <span style={{color:"#374151",fontSize:11}}>{fd(e.fecha)}</span>
    </div>
  </div>;
}

function CardBitacora({b,sel,setSel,hov,setHov,isLast}:{b:Bitacora;sel:string|null;setSel:(id:string|null)=>void;hov:string|null;setHov:(id:string|null)=>void;isLast:boolean}){
  const active=sel===b.id,over=hov===b.id;
  const dc=BIT_COLORS[b.accion]??"#6b7280";
  return<div style={{display:"flex",gap:0}}>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,width:24}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:dc,boxShadow:`0 0 6px ${dc}66`,marginTop:16,flexShrink:0,zIndex:1}}/>
      {!isLast&&<div style={{width:1.5,flex:1,background:"#1f2937",minHeight:24,marginTop:3}}/>}
    </div>
    <div onMouseEnter={()=>setHov(b.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setSel(active?null:b.id)}
      style={{flex:1,marginLeft:12,marginBottom:isLast?0:12,background:active?"#0d1929":over?"#131d2e":"#111827",border:`1px solid ${active?`${dc}44`:"#1f2937"}`,borderLeft:`3px solid ${active?dc:"transparent"}`,borderRadius:12,padding:"13px 16px",cursor:"pointer",transition:"all .15s"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
        <div>
          <span style={{color:dc,fontSize:12,fontWeight:700}}>{b.accion}</span>
          <span style={{color:"#374151",fontSize:12,margin:"0 6px"}}>·</span>
          <span style={{color:"#64748b",fontSize:12}}>{b.usuario}</span>
        </div>
        <span style={{color:"#374151",fontSize:11,flexShrink:0,marginLeft:8}}>{b.hora}</span>
      </div>
      <p style={{color:"#94a3b8",fontSize:13,margin:"0 0 6px",lineHeight:1.6}}>{(b.descripcion||"").length>110?(b.descripcion||"").slice(0,110)+"…":(b.descripcion||"")}</p>
      {(b.adjuntos||[]).length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(b.adjuntos||[]).map(a=><span key={a} style={{display:"flex",alignItems:"center",gap:3,background:"#1f2937",color:"#64748b",fontSize:10,padding:"2px 7px",borderRadius:99}}><i className={`fa-solid ${a.endsWith(".pdf")?"fa-file-pdf":"fa-image"}`} style={{fontSize:9}}/>{a}</span>)}</div>}
    </div>
  </div>;
}

function CardInforme({inf,sel,setSel,hov,setHov}:{inf:Informe;sel:string|null;setSel:(id:string|null)=>void;hov:string|null;setHov:(id:string|null)=>void}){
  const active=sel===inf.id,over=hov===inf.id;
  const TC:Record<string,string>={"Avance semestral":"#3b82f6","Final anual":"#22c55e","Diagnóstico":"#a78bfa","Incidente":"#f43f5e"};
  const tc=TC[inf.tipo]??"#6b7280";
  return<div onMouseEnter={()=>setHov(inf.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setSel(active?null:inf.id)}
    style={{background:active?"#0d1929":over?"#131d2e":"#111827",border:`1px solid ${active?"#22c55e44":"#1f2937"}`,borderLeft:`3px solid ${active?"#22c55e":"transparent"}`,borderRadius:12,padding:"15px 18px",cursor:"pointer",marginBottom:8,transition:"all .15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
      <div style={{flex:1,paddingRight:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><i className="fa-solid fa-file-lines" style={{color:tc,fontSize:13}}/><p style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inf.nombre}</p></div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-user-graduate" style={{fontSize:10,color:"#374151",marginRight:4}}/>{inf.estudiante}</span>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-pen-nib" style={{fontSize:10,color:"#374151",marginRight:4}}/>{inf.autor}</span>
        </div>
      </div>
      <Badge estado={inf.estado}/>
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{color:tc,background:`${tc}18`,fontSize:10,fontWeight:600,borderRadius:99,padding:"2px 8px"}}>{inf.tipo}</span>
        <span style={{color:"#374151",fontSize:11}}>{fd(inf.fecha)}</span>
      </div>
      <div style={{display:"flex",gap:4,opacity:active||over?1:0,transition:"opacity .15s"}}>
        {["fa-eye","fa-download","fa-ellipsis"].map(ic=><button key={ic} onClick={e=>e.stopPropagation()} style={{width:28,height:28,borderRadius:7,border:"1px solid #1f2937",background:"transparent",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`fa-solid ${ic}`} style={{fontSize:11}}/></button>)}
      </div>
    </div>
  </div>;
}

function CardAlerta({a,sel,setSel,hov,setHov}:{a:Alerta;sel:string|null;setSel:(id:string|null)=>void;hov:string|null;setHov:(id:string|null)=>void}){
  const active=sel===a.id,over=hov===a.id;
  const p=PM[a.prioridad]??PM.media,em=EM[a.estado]??EM.activa;
  const RC={alto:"#f43f5e",medio:"#f59e0b",bajo:"#22c55e"};
  const rc=RC[a.nivel_riesgo]??"#6b7280";
  return<div onMouseEnter={()=>setHov(a.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setSel(active?null:a.id)}
    style={{background:active?"#0d1929":over?"#131d2e":"#111827",border:`1px solid ${active?`${p.c}44`:"#1f2937"}`,borderLeft:`3px solid ${active?p.c:"transparent"}`,borderRadius:12,padding:"15px 18px",cursor:"pointer",marginBottom:8,transition:"all .15s",opacity:a.estado==="resuelta"?.65:1}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
      <div style={{flex:1,paddingRight:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:p.c,boxShadow:`0 0 5px ${p.c}88`,flexShrink:0}}/>
          <p style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:0}}>{a.titulo}</p>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-user-graduate" style={{fontSize:10,color:"#374151",marginRight:4}}/>{a.estudiante}</span>
          <span style={{color:"#64748b",fontSize:12}}><i className="fa-solid fa-building" style={{fontSize:10,color:"#374151",marginRight:4}}/>{a.empresa}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
        <Badge estado={a.estado}/>
        <span style={{color:p.c,background:`${p.c}18`,fontSize:10,fontWeight:700,borderRadius:99,padding:"2px 8px"}}>{p.label}</span>
      </div>
    </div>
    <p style={{color:"#64748b",fontSize:12,margin:"0 0 8px",lineHeight:1.5}}>{a.motivo}</p>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{color:rc,fontSize:11,fontWeight:600}}><i className="fa-solid fa-shield-halved" style={{fontSize:10,marginRight:4}}/>Riesgo {a.nivel_riesgo}</span>
      <span style={{color:"#374151",fontSize:11}}>{fd(a.fecha)}</span>
    </div>
  </div>;
}

// ── Panel derecho vacío ───────────────────────────────────────────────────────
function PanelVacio({tab}:{tab:TabId}){
  const t=TABS.find(x=>x.id===tab)!;
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",minHeight:300}}>
    <div style={{width:52,height:52,borderRadius:14,background:`${t.color}12`,border:`1px solid ${t.color}22`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
      <i className={`fa-solid ${t.icon}`} style={{color:t.color,fontSize:20}}/>
    </div>
    <p style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 6px"}}>Selecciona un registro</p>
    <p style={{color:"#374151",fontSize:12,margin:0,lineHeight:1.6}}>Haz clic en cualquier elemento<br/>de la lista para ver su detalle.</p>
  </div>;
}

// ── Paneles de detalle ────────────────────────────────────────────────────────
function PanelVisita({v,sub,setSub}:{v:Visita;sub:PanelSub;setSub:(t:PanelSub)=>void}){
  const hist=[{accion:"Visita creada",usuario:"Sistema",hora:"—"},{accion:"Responsable asignado",usuario:v.responsable||"—",hora:"—"},...(v.estado==="realizada"?[{accion:"Marcada como realizada",usuario:v.responsable||"—",hora:"—"}]:[]),...(v.estado==="cancelada"?[{accion:"Cancelada",usuario:v.responsable||"—",hora:"—"}]:[])];
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid #1f2937"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
        <div style={{flex:1,paddingRight:10}}><p style={{color:"#f1f5f9",fontSize:15,fontWeight:800,margin:"0 0 3px"}}>{v.empresa}</p><p style={{color:"#64748b",fontSize:12,margin:0}}>{v.estudiante}</p></div>
        <Badge estado={v.estado}/>
      </div>
      <button style={{width:"100%",padding:"8px",background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.2)",borderRadius:8,color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
        <i className="fa-solid fa-pen" style={{fontSize:10,marginRight:5}}/>Editar visita
      </button>
    </div>
    <SubTabs sub={sub} setSub={setSub} items={[{id:"resumen",label:"Resumen"},{id:"historial",label:"Historial"},{id:"adjuntos",label:"Adjuntos"}]}/>
    <div style={{padding:"16px 20px"}}>
      {sub==="resumen"&&<><RowInfo icon="fa-calendar" label="Fecha" value={fd(v.fecha)}/><RowInfo icon="fa-chalkboard-user" label="Responsable" value={v.responsable}/>{v.asunto&&<RowInfo icon="fa-tag" label="Asunto" value={v.asunto}/>}<RowInfo icon="fa-bullseye" label="Motivo" value={v.motivo}/><RowInfo icon="fa-clipboard-check" label="Resultado" value={v.resultado}/>
        {v.observaciones&&<div style={{background:"#0b1220",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px",marginTop:4}}><p style={{color:"#374151",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,margin:"0 0 6px"}}>Observaciones</p><p style={{color:"#94a3b8",fontSize:13,margin:0,lineHeight:1.7}}>{v.observaciones}</p></div>}</>}
      {sub==="historial"&&<MiniTimeline items={hist}/>}
      {sub==="adjuntos"&&<div style={{textAlign:"center",padding:"24px 0"}}><i className="fa-solid fa-folder-open" style={{fontSize:28,color:"#1f2937",display:"block",marginBottom:8}}/><p style={{color:"#374151",fontSize:13,margin:0}}>Sin adjuntos registrados.</p></div>}
    </div>
  </div>;
}

function PanelEvaluacion({e,sub,setSub}:{e:Evaluacion;sub:PanelSub;setSub:(t:PanelSub)=>void}){
  const TC:Record<string,string>={Diagnóstica:"#3b82f6",Parcial:"#f59e0b",Final:"#22c55e"};const c=TC[e.tipo]??"#6b7280";
  const hist=[{accion:"Evaluación creada",usuario:e.evaluador||"—",hora:"—"},...(e.progreso>0?[{accion:"Iniciada",usuario:e.evaluador||"—",hora:"—"}]:[]),...(e.progreso===100?[{accion:"Completada",usuario:e.evaluador||"—",hora:"—"}]:[])];
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid #1f2937"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><span style={{color:c,background:`${c}18`,fontSize:11,fontWeight:700,borderRadius:99,padding:"2px 8px"}}>{e.tipo}</span></div><p style={{color:"#f1f5f9",fontSize:15,fontWeight:800,margin:"0 0 3px"}}>{e.estudiante}</p><p style={{color:"#64748b",fontSize:12,margin:0}}>{e.empresa}</p></div>
        <div style={{textAlign:"right"}}><p style={{color:"#f1f5f9",fontSize:28,fontWeight:900,margin:0,lineHeight:1}}>{e.resultado||"—"}</p><p style={{color:"#374151",fontSize:10,fontWeight:600,margin:"2px 0 0"}}>NOTA</p></div>
      </div>
      <div style={{height:5,background:"#0f172a",borderRadius:99,marginBottom:4}}><div style={{height:"100%",width:`${e.progreso||0}%`,background:(e.progreso||0)===100?"#22c55e":"#f59e0b",borderRadius:99}}/></div>
      <p style={{color:"#374151",fontSize:11,margin:0,textAlign:"right"}}>{e.progreso||0}% completado</p>
    </div>
    <SubTabs sub={sub} setSub={setSub} items={[{id:"resumen",label:"Resumen"},{id:"historial",label:"Historial"}]}/>
    <div style={{padding:"16px 20px"}}>
      {sub==="resumen"&&<><RowInfo icon="fa-calendar" label="Fecha" value={fd(e.fecha)}/><RowInfo icon="fa-chalkboard-user" label="Evaluador" value={e.evaluador}/><RowInfo icon="fa-building" label="Empresa" value={e.empresa}/>
        {e.comentarios&&<div style={{background:"#0b1220",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px",marginTop:4}}><p style={{color:"#374151",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,margin:"0 0 6px"}}>Comentarios</p><p style={{color:"#94a3b8",fontSize:13,margin:0,lineHeight:1.7}}>{e.comentarios}</p></div>}</>}
      {sub==="historial"&&<MiniTimeline items={hist}/>}
    </div>
  </div>;
}

function PanelBitacora({b,sub,setSub}:{b:Bitacora;sub:PanelSub;setSub:(t:PanelSub)=>void}){
  const dc=BIT_COLORS[b.accion]??"#6b7280";
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid #1f2937"}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:36,height:36,borderRadius:10,background:`${dc}18`,border:`1px solid ${dc}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="fa-solid fa-book-open" style={{color:dc,fontSize:14}}/></div><div><p style={{color:dc,fontSize:13,fontWeight:700,margin:"0 0 2px"}}>{b.accion}</p><p style={{color:"#64748b",fontSize:12,margin:0}}>{b.usuario} · {b.fecha} {b.hora}</p></div></div>
    </div>
    <SubTabs sub={sub} setSub={setSub} items={[{id:"resumen",label:"Detalle"},{id:"adjuntos",label:`Adjuntos (${(b.adjuntos||[]).length})`}]}/>
    <div style={{padding:"16px 20px"}}>
      {sub==="resumen"&&<><p style={{color:"#94a3b8",fontSize:13,lineHeight:1.8,margin:"0 0 16px"}}>{b.descripcion}</p>
        {(b.comentarios||[]).length>0&&<>{(b.comentarios||[]).map((c,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8}}><div style={{width:6,height:6,borderRadius:"50%",background:"#1f2937",marginTop:6,flexShrink:0}}/><p style={{color:"#64748b",fontSize:12,margin:0,lineHeight:1.6}}>{c}</p></div>)}</>}</>}
      {sub==="adjuntos"&&((b.adjuntos||[]).length>0?<div style={{display:"flex",flexDirection:"column",gap:8}}>{(b.adjuntos||[]).map(a=><div key={a} style={{display:"flex",alignItems:"center",gap:10,background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 14px"}}><i className={`fa-solid ${a.endsWith(".pdf")?"fa-file-pdf":"fa-image"}`} style={{color:"#64748b",fontSize:14}}/><span style={{color:"#94a3b8",fontSize:12,flex:1}}>{a}</span></div>)}</div>:<div style={{textAlign:"center",padding:"24px 0"}}><i className="fa-solid fa-folder-open" style={{fontSize:28,color:"#1f2937",display:"block",marginBottom:8}}/><p style={{color:"#374151",fontSize:13,margin:0}}>Sin adjuntos.</p></div>)}
    </div>
  </div>;
}

function PanelInforme({inf,sub,setSub}:{inf:Informe;sub:PanelSub;setSub:(t:PanelSub)=>void}){
  const m=EM[inf.estado]??EM.borrador;
  const TC:Record<string,string>={"Avance semestral":"#3b82f6","Final anual":"#22c55e","Diagnóstico":"#a78bfa","Incidente":"#f43f5e"};const tc=TC[inf.tipo]??"#6b7280";
  const hist=[{accion:"Informe creado",usuario:inf.autor||"—",hora:"—"},...(inf.estado!=="borrador"?[{accion:"Enviado a revisión",usuario:inf.autor||"—",hora:"—"}]:[]),...(inf.estado==="aprobado"?[{accion:"Aprobado",usuario:"Director(a)",hora:"—"}]:[]),...(inf.estado==="rechazado"?[{accion:"Rechazado",usuario:"Director(a)",hora:"—"}]:[])];
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid #1f2937"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
        <div style={{flex:1,paddingRight:10}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{color:tc,background:`${tc}18`,fontSize:10,fontWeight:700,borderRadius:99,padding:"2px 8px"}}>{inf.tipo}</span></div><p style={{color:"#f1f5f9",fontSize:14,fontWeight:800,margin:"0 0 2px",lineHeight:1.3}}>{inf.nombre}</p></div>
        <Badge estado={inf.estado}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button style={{flex:1,padding:"8px",background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.2)",borderRadius:8,color:"#22c55e",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><i className="fa-solid fa-eye" style={{fontSize:10}}/>Vista previa</button>
        <button style={{padding:"8px 12px",background:"transparent",border:"1px solid #1f2937",borderRadius:8,color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}><i className="fa-solid fa-download" style={{fontSize:11}}/></button>
      </div>
    </div>
    <SubTabs sub={sub} setSub={setSub} items={[{id:"resumen",label:"Detalles"},{id:"historial",label:"Historial"}]}/>
    <div style={{padding:"16px 20px"}}>
      {sub==="resumen"&&<><RowInfo icon="fa-user-graduate" label="Estudiante" value={inf.estudiante}/><RowInfo icon="fa-building" label="Empresa" value={inf.empresa}/><RowInfo icon="fa-pen-nib" label="Autor" value={inf.autor}/><RowInfo icon="fa-calendar" label="Fecha" value={fd(inf.fecha)}/>
        <div style={{background:"#0b1220",border:`1px solid ${m.c}22`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:8}}><i className="fa-solid fa-circle-info" style={{color:m.c,fontSize:13}}/><p style={{color:"#94a3b8",fontSize:12,margin:0}}>{inf.estado==="borrador"?"Borrador: aún no enviado a revisión.":inf.estado==="aprobado"?"Aprobado por el director.":inf.estado==="rechazado"?"Rechazado. Revisar y corregir.":"En proceso de revisión."}</p></div></>}
      {sub==="historial"&&<MiniTimeline items={hist}/>}
    </div>
  </div>;
}

function PanelAlerta({a,sub,setSub,onResolver}:{a:Alerta;sub:PanelSub;setSub:(t:PanelSub)=>void;onResolver?:()=>void}){
  const p=PM[a.prioridad]??PM.media;const RC={alto:"#f43f5e",medio:"#f59e0b",bajo:"#22c55e"};const rc=RC[a.nivel_riesgo]??"#6b7280";
  return<div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid #1f2937"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,paddingRight:10}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><div style={{width:8,height:8,borderRadius:"50%",background:p.c,boxShadow:`0 0 6px ${p.c}88`,flexShrink:0}}/><span style={{color:p.c,fontSize:11,fontWeight:700}}>{p.label}</span><span style={{color:"#374151",fontSize:11}}>· Riesgo <span style={{color:rc,fontWeight:700}}>{a.nivel_riesgo}</span></span></div><p style={{color:"#f1f5f9",fontSize:14,fontWeight:800,margin:"0 0 2px"}}>{a.titulo}</p><p style={{color:"#64748b",fontSize:12,margin:0}}>{a.origen}</p></div>
        <Badge estado={a.estado}/>
      </div>
      {a.estado==="activa"&&onResolver&&<button onClick={onResolver} style={{width:"100%",padding:"9px",background:`${p.c}18`,border:`1px solid ${p.c}33`,borderRadius:9,color:p.c,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><i className="fa-solid fa-circle-check" style={{fontSize:11,marginRight:6}}/>Marcar como resuelta</button>}
    </div>
    <div style={{padding:"16px 20px"}}>
      <RowInfo icon="fa-user-graduate" label="Estudiante" value={a.estudiante}/><RowInfo icon="fa-building" label="Empresa" value={a.empresa}/><RowInfo icon="fa-person-chalkboard" label="Responsable" value={a.responsable}/><RowInfo icon="fa-calendar" label="Detectada" value={fd(a.fecha)}/>
      <div style={{background:"#0b1220",border:`1px solid ${p.c}22`,borderRadius:10,padding:"12px 14px",marginBottom:14}}><p style={{color:"#374151",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,margin:"0 0 6px"}}>Motivo</p><p style={{color:"#94a3b8",fontSize:13,margin:0,lineHeight:1.6}}>{a.motivo}</p></div>
      {(a.acciones||[]).length>0&&<><p style={{color:"#374151",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,margin:"0 0 8px"}}>Acciones sugeridas</p>{(a.acciones||[]).map((ac,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#0b1220",border:"1px solid #1f2937",borderRadius:8,padding:"9px 12px",marginBottom:6}}><i className="fa-solid fa-arrow-right" style={{color:p.c,fontSize:10}}/><span style={{color:"#f1f5f9",fontSize:12,flex:1}}>{ac}</span></div>)}</>}
    </div>
  </div>;
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
const IS: React.CSSProperties = {width:"100%",padding:"9px 12px",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,color:"#f1f5f9",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

function Campo({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return<div style={{marginBottom:14}}>
    <label style={{color:"#94a3b8",fontSize:11,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.5,display:"block",marginBottom:5}}>{label}{required&&<span style={{color:"#f43f5e",marginLeft:3}}>*</span>}</label>
    {children}
  </div>;
}

function ModalBase({titulo,color,onClose,onGuardar,guardando,children}:{titulo:string;color:string;onClose:()=>void;onGuardar:()=>void;guardando:boolean;children:React.ReactNode}){
  return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 50px rgba(0,0,0,.6)"}}>
      <div style={{padding:"20px 24px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#111827",zIndex:1}}>
        <h2 style={{color:"#f1f5f9",fontSize:15,fontWeight:800,margin:0}}>{titulo}</h2>
        <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:"1px solid #1f2937",background:"transparent",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:300}}>×</button>
      </div>
      <div style={{padding:"20px 24px"}}>{children}</div>
      <div style={{padding:"16px 24px",borderTop:"1px solid #1f2937",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"9px 18px",background:"transparent",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
        <button onClick={onGuardar} disabled={guardando} style={{padding:"9px 18px",background:guardando?"#1f2937":`linear-gradient(135deg,${color},${color}bb)`,border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:guardando?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,opacity:guardando?.7:1}}>
          {guardando?<><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Guardando…</>:<><i className="fa-solid fa-floppy-disk" style={{fontSize:11}}/>Guardar</>}
        </button>
      </div>
    </div>
  </div>;
}

// ── Modales de creación ───────────────────────────────────────────────────────
const ASUNTOS = ["Supervisión mensual","Evaluación inicial","Evaluación intermedia","Evaluación final","Seguimiento académico","Coordinación con empresa","Incidente o novedad","Cierre de práctica","Otro"];
const SEL_S: React.CSSProperties = {...IS, appearance:"none" as const, cursor:"pointer"};

function useListas(){
  const {usuario}=useAuth();
  const [empresas,    setEmpresas]    = useState<EmpresaOpt[]>([]);
  const [estudiantes, setEstudiantes] = useState<EstudianteOpt[]>([]);
  const [cargando,    setCargando]    = useState(true);
  useEffect(()=>{
    if(!usuario) return;
    let done=0;
    const tick=()=>{done++;if(done===2)setCargando(false);};
    const u1=onSnapshot(collection(db,"empresas"),
      s=>{
        const lista=s.docs
          .map(d=>({id:d.id,nombre:d.data().nombreComercial||d.data().razonSocial||d.data().nombre||""}))
          .filter(e=>e.nombre);
        lista.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
        setEmpresas(lista);tick();
      },()=>tick());
    const u2=onSnapshot(collection(db,"estudiantes"),
      s=>{
        const lista=s.docs.map(d=>({id:d.id,nombres:d.data().nombres||"",apellidos:d.data().apellidos||""}));
        lista.sort((a,b)=>a.apellidos.localeCompare(b.apellidos,"es"));
        setEstudiantes(lista);tick();
      },()=>tick());
    return()=>{u1();u2();};
  },[usuario?.uid]);
  return {empresas,estudiantes,cargando};
}

function SelectEmpresa({lista,cargando,value,onChange}:{lista:EmpresaOpt[];cargando:boolean;value:string;onChange:(v:string)=>void;required?:boolean}){
  if(cargando) return<div style={{...IS,color:"#374151",display:"flex",alignItems:"center",gap:8,boxSizing:"border-box"}}><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Cargando…</div>;
  return<select style={SEL_S} value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">{lista.length===0?"— Sin empresas registradas —":"— Selecciona una empresa —"}</option>
    {lista.map(e=><option key={e.id} value={e.nombre}>{e.nombre}</option>)}
  </select>;
}

function SelectEstudiante({lista,cargando,value,onChange}:{lista:EstudianteOpt[];cargando:boolean;value:string;onChange:(v:string)=>void;required?:boolean}){
  if(cargando) return<div style={{...IS,color:"#374151",display:"flex",alignItems:"center",gap:8,boxSizing:"border-box"}}><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Cargando…</div>;
  return<select style={SEL_S} value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">{lista.length===0?"— Sin estudiantes registrados —":"— Selecciona un estudiante —"}</option>
    {lista.map(e=><option key={e.id} value={`${e.nombres} ${e.apellidos}`.trim()}>{e.apellidos}, {e.nombres}</option>)}
  </select>;
}

function ModalNuevaVisita({onClose}:{onClose:()=>void}){
  const {empresas,estudiantes,cargando}=useListas();
  const [f,setF]=useState({empresa:"",estudiante:"",responsable:"",fecha:TODAY,estado:"programada",asunto:"Supervisión mensual",motivo:"",observaciones:""});
  const [g,setG]=useState(false);
  const up=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function guardar(){
    if(!f.empresa||!f.estudiante||!f.fecha){return;}
    setG(true);
    try{
      await addDoc(collection(db,"seguimiento_visitas"),{...f,resultado:"",creadoEn:serverTimestamp()});
      onClose();
    }catch(e){console.error(e);}finally{setG(false);}
  }
  return<ModalBase titulo="Nueva visita en terreno" color="#3b82f6" onClose={onClose} onGuardar={guardar} guardando={g}>
    <Campo label="Empresa" required><SelectEmpresa    lista={empresas}    cargando={cargando} value={f.empresa}    onChange={v=>up("empresa",v)}/></Campo>
    <Campo label="Estudiante" required><SelectEstudiante lista={estudiantes} cargando={cargando} value={f.estudiante} onChange={v=>up("estudiante",v)}/></Campo>
    <Campo label="Docente responsable"><input style={IS} value={f.responsable} onChange={e=>up("responsable",e.target.value)} placeholder="Prof. Nombre Apellido"/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Fecha" required><input type="date" style={IS} value={f.fecha} onChange={e=>up("fecha",e.target.value)}/></Campo>
      <Campo label="Estado"><select style={SEL_S} value={f.estado} onChange={e=>up("estado",e.target.value)}>{["programada","realizada","pendiente","cancelada"].map(s=><option key={s} value={s}>{EM[s as EstadoKey].label}</option>)}</select></Campo>
    </div>
    <Campo label="Asunto de la visita"><select style={SEL_S} value={f.asunto} onChange={e=>up("asunto",e.target.value)}>{ASUNTOS.map(a=><option key={a} value={a}>{a}</option>)}</select></Campo>
    <Campo label="Descripción / motivo detallado" required><input style={IS} value={f.motivo} onChange={e=>up("motivo",e.target.value)} placeholder="Describe el propósito específico de esta visita…"/></Campo>
    <Campo label="Observaciones"><textarea style={{...IS,minHeight:80,resize:"vertical" as const,lineHeight:1.6}} value={f.observaciones} onChange={e=>up("observaciones",e.target.value)} placeholder="Acuerdos con maestro guía, notas adicionales…"/></Campo>
  </ModalBase>;
}

function ModalNuevaEvaluacion({onClose}:{onClose:()=>void}){
  const {usuario}=useAuth();
  const {empresas,estudiantes,cargando}=useListas();
  const [f,setF]=useState({tipo:"Diagnóstica",evaluador:usuario?.nombre||"",estudiante:"",empresa:"",fecha:TODAY,resultado:"",comentarios:""});
  const [g,setG]=useState(false);
  const up=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function guardar(){
    if(!f.estudiante||!f.empresa){return;}
    setG(true);
    try{
      await addDoc(collection(db,"seguimiento_evaluaciones"),{...f,progreso:f.resultado?100:0,creadoEn:serverTimestamp()});
      onClose();
    }catch(e){console.error(e);}finally{setG(false);}
  }
  return<ModalBase titulo="Nueva evaluación" color="#a78bfa" onClose={onClose} onGuardar={guardar} guardando={g}>
    <Campo label="Tipo de evaluación"><select style={SEL_S} value={f.tipo} onChange={e=>up("tipo",e.target.value)}>{["Diagnóstica","Parcial","Final"].map(t=><option key={t} value={t}>{t}</option>)}</select></Campo>
    <Campo label="Estudiante" required><SelectEstudiante lista={estudiantes} cargando={cargando} value={f.estudiante} onChange={v=>up("estudiante",v)}/></Campo>
    <Campo label="Empresa" required><SelectEmpresa    lista={empresas}    cargando={cargando} value={f.empresa}    onChange={v=>up("empresa",v)}/></Campo>
    <Campo label="Evaluador"><input style={IS} value={f.evaluador} onChange={e=>up("evaluador",e.target.value)} placeholder="Prof. Nombre Apellido o Maestro Guía"/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Fecha" required><input type="date" style={IS} value={f.fecha} onChange={e=>up("fecha",e.target.value)}/></Campo>
      <Campo label="Nota obtenida"><input style={IS} value={f.resultado} onChange={e=>up("resultado",e.target.value)} placeholder="Ej: 6.5"/></Campo>
    </div>
    <Campo label="Comentarios y observaciones"><textarea style={{...IS,minHeight:90,resize:"vertical" as const,lineHeight:1.6}} value={f.comentarios} onChange={e=>up("comentarios",e.target.value)} placeholder="Fortalezas, áreas de mejora, recomendaciones..."/></Campo>
  </ModalBase>;
}

function ModalNuevaBitacora({onClose}:{onClose:()=>void}){
  const {usuario}=useAuth();
  const nombreUsuario=usuario?.nombre||"Sistema";
  const [f,setF]=useState({accion:"Visita registrada",descripcion:"",adjuntos:"",comentarios:""});
  const [g,setG]=useState(false);
  const up=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function guardar(){
    if(!f.descripcion){return;}
    const ahora=new Date();
    setG(true);
    try{
      await addDoc(collection(db,"seguimiento_bitacoras"),{
        accion:f.accion,descripcion:f.descripcion,usuario:nombreUsuario,
        fecha:ahora.toISOString().split("T")[0],hora:ahora.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}),
        adjuntos:f.adjuntos.split(",").map(a=>a.trim()).filter(Boolean),
        comentarios:f.comentarios.split("\n").map(c=>c.trim()).filter(Boolean),
        creadoEn:serverTimestamp(),
      });
      onClose();
    }catch(e){console.error(e);}finally{setG(false);}
  }
  return<ModalBase titulo="Nueva entrada en bitácora" color="#f59e0b" onClose={onClose} onGuardar={guardar} guardando={g}>
    <Campo label="Tipo de acción"><select style={SEL_S} value={f.accion} onChange={e=>up("accion",e.target.value)}>{Object.keys(BIT_COLORS).map(a=><option key={a} value={a}>{a}</option>)}</select></Campo>
    <Campo label="Descripción detallada" required><textarea style={{...IS,minHeight:100,resize:"vertical" as const,lineHeight:1.6}} value={f.descripcion} onChange={e=>up("descripcion",e.target.value)} placeholder="Describe con detalle lo que ocurrió o lo que se realizó..."/></Campo>
    <Campo label="Adjuntos (nombres separados por coma)"><input style={IS} value={f.adjuntos} onChange={e=>up("adjuntos",e.target.value)} placeholder="foto_visita.jpg, informe.pdf..."/></Campo>
    <Campo label="Comentarios adicionales (uno por línea)"><textarea style={{...IS,minHeight:70,resize:"vertical" as const,lineHeight:1.6}} value={f.comentarios} onChange={e=>up("comentarios",e.target.value)} placeholder="Observación 1&#10;Observación 2..."/></Campo>
  </ModalBase>;
}

function ModalNuevoInforme({onClose}:{onClose:()=>void}){
  const {usuario}=useAuth();
  const {empresas,estudiantes,cargando}=useListas();
  const [f,setF]=useState({nombre:"",tipo:"Avance semestral",estudiante:"",empresa:"",autor:usuario?.nombre||"",fecha:TODAY,estado:"borrador"});
  const [g,setG]=useState(false);
  const up=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function guardar(){
    if(!f.nombre||!f.estudiante){return;}
    setG(true);
    try{
      await addDoc(collection(db,"seguimiento_informes"),{...f,creadoEn:serverTimestamp()});
      onClose();
    }catch(e){console.error(e);}finally{setG(false);}
  }
  return<ModalBase titulo="Nuevo informe" color="#22c55e" onClose={onClose} onGuardar={guardar} guardando={g}>
    <Campo label="Título del informe" required><input style={IS} value={f.nombre} onChange={e=>up("nombre",e.target.value)} placeholder="Informe de Avance — Nombre Estudiante"/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Tipo de informe"><select style={SEL_S} value={f.tipo} onChange={e=>up("tipo",e.target.value)}>{["Avance semestral","Final anual","Diagnóstico","Incidente"].map(t=><option key={t} value={t}>{t}</option>)}</select></Campo>
      <Campo label="Estado inicial"><select style={SEL_S} value={f.estado} onChange={e=>up("estado",e.target.value)}>{["borrador","en_proceso","pendiente"].map(s=><option key={s} value={s}>{EM[s as EstadoKey].label}</option>)}</select></Campo>
    </div>
    <Campo label="Estudiante" required><SelectEstudiante lista={estudiantes} cargando={cargando} value={f.estudiante} onChange={v=>up("estudiante",v)}/></Campo>
    <Campo label="Empresa"><SelectEmpresa lista={empresas} cargando={cargando} value={f.empresa} onChange={v=>up("empresa",v)}/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Autor"><input style={IS} value={f.autor} onChange={e=>up("autor",e.target.value)} placeholder="Prof. Nombre Apellido"/></Campo>
      <Campo label="Fecha"><input type="date" style={IS} value={f.fecha} onChange={e=>up("fecha",e.target.value)}/></Campo>
    </div>
  </ModalBase>;
}

function ModalNuevaAlerta({onClose}:{onClose:()=>void}){
  const {usuario}=useAuth();
  const {empresas,estudiantes,cargando}=useListas();
  const [f,setF]=useState({titulo:"",prioridad:"media",origen:"Manual",estudiante:"",empresa:"",fecha:TODAY,motivo:"",nivel_riesgo:"medio",responsable:usuario?.nombre||"",acciones:""});
  const [g,setG]=useState(false);
  const up=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function guardar(){
    if(!f.titulo||!f.estudiante||!f.motivo){return;}
    setG(true);
    try{
      await addDoc(collection(db,"seguimiento_alertas"),{...f,acciones:f.acciones.split("\n").map(a=>a.trim()).filter(Boolean),estado:"activa",creadoEn:serverTimestamp()});
      onClose();
    }catch(e){console.error(e);}finally{setG(false);}
  }
  return<ModalBase titulo="Nueva alerta" color="#f43f5e" onClose={onClose} onGuardar={guardar} guardando={g}>
    <Campo label="Título de la alerta" required><input style={IS} value={f.titulo} onChange={e=>up("titulo",e.target.value)} placeholder="Ej: Inactividad prolongada detectada"/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Prioridad"><select style={SEL_S} value={f.prioridad} onChange={e=>up("prioridad",e.target.value)}>{(["critica","alta","media","baja"] as PrioridadKey[]).map(p=><option key={p} value={p}>{PM[p].label}</option>)}</select></Campo>
      <Campo label="Nivel de riesgo"><select style={SEL_S} value={f.nivel_riesgo} onChange={e=>up("nivel_riesgo",e.target.value)}>{["alto","medio","bajo"].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}</select></Campo>
    </div>
    <Campo label="Estudiante afectado" required><SelectEstudiante lista={estudiantes} cargando={cargando} value={f.estudiante} onChange={v=>up("estudiante",v)}/></Campo>
    <Campo label="Empresa"><SelectEmpresa lista={empresas} cargando={cargando} value={f.empresa} onChange={v=>up("empresa",v)}/></Campo>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Campo label="Origen"><input style={IS} value={f.origen} onChange={e=>up("origen",e.target.value)} placeholder="Manual, Sistema, Calendario..."/></Campo>
      <Campo label="Fecha"><input type="date" style={IS} value={f.fecha} onChange={e=>up("fecha",e.target.value)}/></Campo>
    </div>
    <Campo label="Motivo detallado" required><textarea style={{...IS,minHeight:80,resize:"vertical" as const,lineHeight:1.6}} value={f.motivo} onChange={e=>up("motivo",e.target.value)} placeholder="Describe el motivo de la alerta con el mayor detalle posible..."/></Campo>
    <Campo label="Responsable"><input style={IS} value={f.responsable} onChange={e=>up("responsable",e.target.value)} placeholder="Prof. Nombre Apellido"/></Campo>
    <Campo label="Acciones sugeridas (una por línea)"><textarea style={{...IS,minHeight:70,resize:"vertical" as const,lineHeight:1.6}} value={f.acciones} onChange={e=>up("acciones",e.target.value)} placeholder="Contactar al estudiante&#10;Coordinar visita urgente&#10;Notificar al maestro guía"/></Campo>
  </ModalBase>;
}

// ── Layout principal ──────────────────────────────────────────────────────────
export default function SeguimientoLayout({children}:{children:React.ReactNode}){
  const pathname = usePathname();
  const router   = useRouter();

  const tab: TabId = pathname.includes("/evaluaciones")?"evaluaciones"
    :pathname.includes("/bitacoras")?"bitacoras"
    :pathname.includes("/informes")?"informes"
    :pathname.includes("/alertas")?"alertas"
    :"visitas";

  // ── Firestore data ──────────────
  const [visitas,      setVisitas]      = useState<Visita[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [bitacoras,    setBitacoras]    = useState<Bitacora[]>([]);
  const [informes,     setInformes]     = useState<Informe[]>([]);
  const [alertas,      setAlertas]      = useState<Alerta[]>([]);
  const [cargando,     setCargando]     = useState(true);

  useEffect(()=>{
    const ord = (c:string) => query(collection(db,c), orderBy("creadoEn","desc"));
    const map  = (s:any)   => s.docs.map((d:any)=>({id:d.id,...d.data()}));
    const u1=onSnapshot(ord("seguimiento_visitas"),      s=>setVisitas(map(s)),      ()=>{});
    const u2=onSnapshot(ord("seguimiento_evaluaciones"), s=>setEvaluaciones(map(s)), ()=>{});
    const u3=onSnapshot(ord("seguimiento_bitacoras"),    s=>setBitacoras(map(s)),    ()=>{});
    const u4=onSnapshot(ord("seguimiento_informes"),     s=>setInformes(map(s)),     ()=>{});
    const u5=onSnapshot(ord("seguimiento_alertas"),      s=>setAlertas(map(s)),      ()=>{});
    setCargando(false);
    return ()=>{u1();u2();u3();u4();u5();};
  },[]);

  // ── UI state ──────────────
  const [busqueda,         setBusqueda]         = useState("");
  const [filtroEstado,     setFiltroEstado]     = useState("todos");
  const [filtroEstudiante, setFiltroEstudiante] = useState("");
  const [filtroEmpresa,    setFiltroEmpresa]    = useState("");
  const [filtroPeriodo,    setFiltroPeriodo]    = useState("todo");
  const [seleccionado,     setSeleccionado]     = useState<string|null>(null);
  const [panelSub,         setPanelSub]         = useState<PanelSub>("resumen");
  const [hoveredId,        setHoveredId]        = useState<string|null>(null);
  const [modalAbierto,     setModalAbierto]     = useState(false);

  function handleSelect(id:string|null){setSeleccionado(id);setPanelSub("resumen");}

  // ── Filtros ──────────────
  function mSearch(fields:string[]){if(!busqueda)return true;const q=busqueda.toLowerCase();return fields.some(f=>f.toLowerCase().includes(q));}
  function mPeriodo(fecha:string){if(filtroPeriodo==="todo")return true;const d=new Date(fecha+"T12:00:00"),now=new Date();if(filtroPeriodo==="semana"){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}if(filtroPeriodo==="mes")return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();if(filtroPeriodo==="año")return d.getFullYear()===now.getFullYear();return true;}

  const fV = useMemo(()=>visitas.filter(v=>mSearch([v.empresa,v.estudiante,v.responsable])&&(filtroEstado==="todos"||v.estado===filtroEstado)&&(!filtroEstudiante||v.estudiante?.toLowerCase().includes(filtroEstudiante.toLowerCase()))&&(!filtroEmpresa||v.empresa?.toLowerCase().includes(filtroEmpresa.toLowerCase()))&&mPeriodo(v.fecha)),[visitas,busqueda,filtroEstado,filtroEstudiante,filtroEmpresa,filtroPeriodo]);
  const fE = useMemo(()=>evaluaciones.filter(e=>mSearch([e.estudiante,e.empresa,e.evaluador])&&(!filtroEstudiante||e.estudiante?.toLowerCase().includes(filtroEstudiante.toLowerCase()))&&(!filtroEmpresa||e.empresa?.toLowerCase().includes(filtroEmpresa.toLowerCase()))&&mPeriodo(e.fecha)),[evaluaciones,busqueda,filtroEstudiante,filtroEmpresa,filtroPeriodo]);
  const fB = useMemo(()=>bitacoras.filter(b=>mSearch([b.accion,b.usuario,b.descripcion])&&mPeriodo(b.fecha)),[bitacoras,busqueda,filtroPeriodo]);
  const fI = useMemo(()=>informes.filter(i=>mSearch([i.nombre,i.estudiante,i.empresa,i.autor])&&(filtroEstado==="todos"||i.estado===filtroEstado)&&(!filtroEstudiante||i.estudiante?.toLowerCase().includes(filtroEstudiante.toLowerCase()))&&(!filtroEmpresa||i.empresa?.toLowerCase().includes(filtroEmpresa.toLowerCase()))&&mPeriodo(i.fecha)),[informes,busqueda,filtroEstado,filtroEstudiante,filtroEmpresa,filtroPeriodo]);
  const fA = useMemo(()=>alertas.filter(a=>mSearch([a.titulo,a.estudiante,a.empresa])&&(filtroEstado==="todos"||a.estado===filtroEstado)&&(!filtroEstudiante||a.estudiante?.toLowerCase().includes(filtroEstudiante.toLowerCase()))&&(!filtroEmpresa||a.empresa?.toLowerCase().includes(filtroEmpresa.toLowerCase()))),[alertas,busqueda,filtroEstado,filtroEstudiante,filtroEmpresa]);

  const counts: Record<TabId,number> = {visitas:fV.length,evaluaciones:fE.length,bitacoras:fB.length,informes:fI.length,alertas:fA.filter(a=>a.estado==="activa").length};

  async function resolverAlerta(id:string){
    try{await updateDoc(doc(db,"seguimiento_alertas",id),{estado:"resuelta"});}catch(e){console.error(e);}
  }

  const acTabMeta = TABS.find(t=>t.id===tab)!;
  const hayFiltros = !!(busqueda||filtroEstudiante||filtroEmpresa||filtroEstado!=="todos"||filtroPeriodo!=="todo");

  function renderPanel(){
    if(!seleccionado) return <PanelVacio tab={tab}/>;
    if(tab==="visitas")      {const v=visitas.find(x=>x.id===seleccionado);      if(v) return <PanelVisita      v={v}   sub={panelSub} setSub={setPanelSub}/>;}
    if(tab==="evaluaciones") {const e=evaluaciones.find(x=>x.id===seleccionado); if(e) return <PanelEvaluacion  e={e}   sub={panelSub} setSub={setPanelSub}/>;}
    if(tab==="bitacoras")    {const b=bitacoras.find(x=>x.id===seleccionado);    if(b) return <PanelBitacora    b={b}   sub={panelSub} setSub={setPanelSub}/>;}
    if(tab==="informes")     {const i=informes.find(x=>x.id===seleccionado);     if(i) return <PanelInforme     inf={i} sub={panelSub} setSub={setPanelSub}/>;}
    if(tab==="alertas")      {const a=alertas.find(x=>x.id===seleccionado);      if(a) return <PanelAlerta      a={a}   sub={panelSub} setSub={setPanelSub} onResolver={()=>resolverAlerta(a.id)}/>;}
    return <PanelVacio tab={tab}/>;
  }

  function renderLista(){
    const empty=(msg:string)=><div style={{textAlign:"center",padding:"50px 0"}}><i className={`fa-solid ${acTabMeta.icon}`} style={{fontSize:32,color:"#1f2937",display:"block",marginBottom:12}}/><p style={{color:"#374151",fontSize:13,margin:"0 0 16px"}}>{msg}</p><button onClick={()=>setModalAbierto(true)} style={{padding:"9px 18px",background:`${acTabMeta.color}18`,border:`1px solid ${acTabMeta.color}33`,borderRadius:9,color:acTabMeta.color,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><i className="fa-solid fa-plus" style={{fontSize:11,marginRight:6}}/>{NUEVO_LABEL[tab]}</button></div>;
    if(tab==="visitas")      return fV.length===0?empty("No hay visitas registradas aún."):fV.map(v=><CardVisita      key={v.id} v={v}   sel={seleccionado} setSel={handleSelect} hov={hoveredId} setHov={setHoveredId}/>);
    if(tab==="evaluaciones") return fE.length===0?empty("No hay evaluaciones registradas aún."):fE.map(e=><CardEvaluacion  key={e.id} e={e}   sel={seleccionado} setSel={handleSelect} hov={hoveredId} setHov={setHoveredId}/>);
    if(tab==="bitacoras")    return fB.length===0?empty("No hay entradas en la bitácora aún."):fB.map((b,i)=><CardBitacora   key={b.id} b={b}   sel={seleccionado} setSel={handleSelect} hov={hoveredId} setHov={setHoveredId} isLast={i===fB.length-1}/>);
    if(tab==="informes")     return fI.length===0?empty("No hay informes registrados aún."):fI.map(i=><CardInforme     key={i.id} inf={i} sel={seleccionado} setSel={handleSelect} hov={hoveredId} setHov={setHoveredId}/>);
    if(tab==="alertas")      return fA.length===0?empty("No hay alertas registradas aún."):[...fA].sort((a,b)=>{const o={critica:0,alta:1,media:2,baja:3};return o[a.prioridad]-o[b.prioridad];}).map(a=><CardAlerta key={a.id} a={a} sel={seleccionado} setSel={handleSelect} hov={hoveredId} setHov={setHoveredId}/>);
    return null;
  }

  return(
    <div style={{padding:"28px 36px",fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${acTabMeta.color},${acTabMeta.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background .3s"}}>
            <i className={`fa-solid ${acTabMeta.icon}`} style={{color:"#fff",fontSize:18}}/>
          </div>
          <div>
            <h1 style={{color:"#f1f5f9",fontSize:24,fontWeight:800,margin:0}}>Seguimiento</h1>
            <p style={{color:"#475569",fontSize:13,margin:0}}>Supervisión continua del programa de formación dual.</p>
          </div>
        </div>
        <button onClick={()=>setModalAbierto(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",background:`linear-gradient(135deg,${acTabMeta.color},${acTabMeta.color}bb)`,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"background .3s"}}>
          <i className="fa-solid fa-plus" style={{fontSize:11}}/>{NUEVO_LABEL[tab]}
        </button>
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:"1 1 220px",position:"relative"}}>
          <i className="fa-solid fa-magnifying-glass" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:12,pointerEvents:"none"}}/>
          <input placeholder="Buscar estudiante, empresa, responsable…" value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{width:"100%",padding:"9px 12px 9px 32px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,color:"#f1f5f9",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const}}/>
        </div>
        <input placeholder="Estudiante" value={filtroEstudiante} onChange={e=>setFiltroEstudiante(e.target.value)} style={{flex:"0 1 130px",padding:"9px 12px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,color:filtroEstudiante?"#f1f5f9":"#374151",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        <input placeholder="Empresa" value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)} style={{flex:"0 1 130px",padding:"9px 12px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,color:filtroEmpresa?"#f1f5f9":"#374151",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        {(tab==="visitas"||tab==="informes"||tab==="alertas")&&(
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{flex:"0 1 130px",padding:"9px 12px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,color:filtroEstado!=="todos"?"#f1f5f9":"#374151",fontSize:13,fontFamily:"inherit",outline:"none",appearance:"none" as const,cursor:"pointer"}}>
            <option value="todos">Estado</option>
            {(Object.keys(EM) as EstadoKey[]).map(s=><option key={s} value={s}>{EM[s].label}</option>)}
          </select>
        )}
        <select value={filtroPeriodo} onChange={e=>setFiltroPeriodo(e.target.value)} style={{flex:"0 1 120px",padding:"9px 12px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,color:filtroPeriodo!=="todo"?"#f1f5f9":"#374151",fontSize:13,fontFamily:"inherit",outline:"none",appearance:"none" as const,cursor:"pointer"}}>
          <option value="todo">Período</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="año">Este año</option>
        </select>
        {hayFiltros&&<button onClick={()=>{setBusqueda("");setFiltroEstudiante("");setFiltroEmpresa("");setFiltroEstado("todos");setFiltroPeriodo("todo");}} style={{padding:"9px 12px",background:"rgba(244,63,94,.08)",border:"1px solid rgba(244,63,94,.2)",borderRadius:9,color:"#f43f5e",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap" as const}}><i className="fa-solid fa-xmark" style={{fontSize:10}}/>Limpiar</button>}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:18,background:"#111827",border:"1px solid #1f2937",borderRadius:12,padding:4}}>
        {TABS.map(t=>{const active=tab===t.id;return(
          <button key={t.id} onClick={()=>{setSeleccionado(null);router.push(`/dashboard/seguimiento/${t.id}`);}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 12px",border:"none",borderRadius:9,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",background:active?"#1f2937":"transparent",color:active?t.color:"#6b7280",fontSize:13,fontWeight:600}}>
            <i className={`fa-solid ${t.icon}`} style={{fontSize:12}}/>{t.label}
            <span style={{background:active?`${t.color}22`:"#1f293799",color:active?t.color:"#374151",borderRadius:99,fontSize:10,fontWeight:700,padding:"1px 6px",lineHeight:"16px"}}>{counts[t.id]}</span>
          </button>
        );})}
      </div>

      {/* Split view */}
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{flex:"0 0 63%",minWidth:0}}>
          {cargando?<div style={{textAlign:"center",padding:"60px 0",color:"#374151"}}><i className="fa-solid fa-spinner fa-spin" style={{fontSize:24,display:"block",marginBottom:10,color:"#1f2937"}}/><p style={{margin:0,fontSize:13}}>Cargando datos…</p></div>:renderLista()}
        </div>
        <div style={{flex:"0 0 37%",minWidth:0,position:"sticky",top:24}}>{renderPanel()}</div>
      </div>

      <div style={{display:"none"}}>{children}</div>

      {/* Modales */}
      {modalAbierto&&tab==="visitas"      &&<ModalNuevaVisita      onClose={()=>setModalAbierto(false)}/>}
      {modalAbierto&&tab==="evaluaciones" &&<ModalNuevaEvaluacion  onClose={()=>setModalAbierto(false)}/>}
      {modalAbierto&&tab==="bitacoras"    &&<ModalNuevaBitacora    onClose={()=>setModalAbierto(false)}/>}
      {modalAbierto&&tab==="informes"     &&<ModalNuevoInforme     onClose={()=>setModalAbierto(false)}/>}
      {modalAbierto&&tab==="alertas"      &&<ModalNuevaAlerta      onClose={()=>setModalAbierto(false)}/>}
    </div>
  );
}
