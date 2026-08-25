"use client";
import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query,
  Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// ─────────────────────────── TYPES ───────────────────────────────────
type Vista = "mes" | "semana" | "dia" | "agenda" | "timeline";
type EventoTipo =
  | "visita" | "reunion" | "evaluacion" | "capacitacion"
  | "firma" | "convenio" | "bitacora" | "documento" | "feriado" | "otro";
type EventoEstado =
  | "programado" | "confirmado" | "en_curso" | "completado" | "cancelado" | "reprogramado";
type EventoPrioridad = "baja" | "media" | "alta" | "critica";

interface Participante { uid: string; nombre: string; rol?: string; }
interface HistorialEntrada { accion: string; uid: string; nombre: string; ts: Timestamp; detalle?: string; }

interface Evento {
  id: string;
  codigo: string;
  titulo: string;
  descripcion?: string;
  tipo: EventoTipo;
  prioridad: EventoPrioridad;
  estado: EventoEstado;
  organizadorUid: string;
  organizadorNombre: string;
  participantes: Participante[];
  empresaNombre?: string;
  estudianteNombre?: string;
  profesorNombre?: string;
  convenioId?: string;
  documentoId?: string;
  evaluacionId?: string;
  ubicacion?: string;
  enlaceVirtual?: string;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  todoElDia: boolean;
  color: string;
  etiquetas: string[];
  observaciones?: string;
  liceoId: string;
  creadoPorUid: string;
  creadoPorNombre: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  historial: HistorialEntrada[];
}

// ─────────────────────── CONSTANTS ────────────────────────────────────
const TIPO_CFG: Record<EventoTipo, { label: string; icon: string; color: string }> = {
  visita:       { label: "Visita",       icon: "fa-route",           color: "#fb923c" },
  reunion:      { label: "Reunión",      icon: "fa-users",           color: "#a78bfa" },
  evaluacion:   { label: "Evaluación",   icon: "fa-clipboard-check", color: "#f472b6" },
  capacitacion: { label: "Capacitación", icon: "fa-chalkboard-user", color: "#34d399" },
  firma:        { label: "Firma",        icon: "fa-pen-nib",         color: "#f87171" },
  convenio:     { label: "Convenio",     icon: "fa-handshake",       color: "#06b6d4" },
  bitacora:     { label: "Bitácora",     icon: "fa-book-open",       color: "#fbbf24" },
  documento:    { label: "Documento",    icon: "fa-file-lines",      color: "#60a5fa" },
  feriado:      { label: "Feriado",      icon: "fa-flag",            color: "#64748b" },
  otro:         { label: "Otro",         icon: "fa-calendar",        color: "#94a3b8" },
};

const ESTADO_CFG: Record<EventoEstado, { label: string; color: string; bg: string }> = {
  programado:   { label: "Programado",   color: "#60a5fa", bg: "rgba(59,130,246,0.12)"  },
  confirmado:   { label: "Confirmado",   color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  en_curso:     { label: "En curso",     color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  completado:   { label: "Completado",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  cancelado:    { label: "Cancelado",    color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  reprogramado: { label: "Reprogramado", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

const PRIORIDAD_CFG: Record<EventoPrioridad, { label: string; color: string }> = {
  baja:    { label: "Baja",    color: "#64748b" },
  media:   { label: "Media",   color: "#3b82f6" },
  alta:    { label: "Alta",    color: "#f59e0b" },
  critica: { label: "Crítica", color: "#ef4444" },
};

const COLORES = [
  "#3b82f6","#8b5cf6","#ec4899","#ef4444","#f59e0b",
  "#22c55e","#06b6d4","#fb923c","#a78bfa","#34d399",
];

const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const HORAS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am - 21pm

// ─────────────────────── HELPERS ──────────────────────────────────────
function genCodigo() { return `EVT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }
function sod(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function esd(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }

function eventosEnDia(evs: Evento[], dia: Date): Evento[] {
  const s = sod(dia).getTime(), e = s + 86400000 - 1;
  return evs.filter(ev => ev.fechaInicio.toMillis() <= e && ev.fechaFin.toMillis() >= s);
}

function toInputDate(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toInputTime(ts: Timestamp): string {
  const d = ts.toDate();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fromInputs(date: string, time: string): Timestamp {
  const [y,m,d] = date.split("-").map(Number);
  const [h,mi] = time.split(":").map(Number);
  return Timestamp.fromDate(new Date(y, m-1, d, h||0, mi||0));
}
function durStr(fi: Timestamp, ff: Timestamp): string {
  const mins = Math.round((ff.toMillis()-fi.toMillis())/60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins/60), m = mins%60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
function timeLabel(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false});
}
function detectarConflictos(
  evs: Evento[], nuevo: { fi: Timestamp; ff: Timestamp; uid: string; participantes: Participante[]; todoElDia: boolean; eventoId?: string }
): Evento[] {
  if (nuevo.todoElDia) return [];
  const uids = [nuevo.uid, ...nuevo.participantes.map(p=>p.uid)];
  return evs.filter(e => {
    if (e.id === nuevo.eventoId) return false;
    if (e.estado === "cancelado") return false;
    if (e.todoElDia) return false;
    const overlap = e.fechaInicio.toMillis() < nuevo.ff.toMillis() && e.fechaFin.toMillis() > nuevo.fi.toMillis();
    if (!overlap) return false;
    const shared = [e.organizadorUid,...e.participantes.map(p=>p.uid)].some(u => uids.includes(u));
    return shared;
  });
}

// ─────────────── MINI CALENDAR ────────────────────────────────────────
function MiniCalendar({ fecha, onChange, eventos }: {
  fecha: Date; onChange: (d: Date) => void; eventos: Evento[];
}) {
  const [cur, setCur] = useState(new Date(fecha));
  const hoy = new Date();

  function grid() {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const last  = new Date(cur.getFullYear(), cur.getMonth()+1, 0);
    const cells: (Date|null)[] = [];
    for (let i=0;i<first.getDay();i++) cells.push(null);
    for (let d=1;d<=last.getDate();d++) cells.push(new Date(cur.getFullYear(),cur.getMonth(),d));
    while (cells.length%7!==0) cells.push(null);
    return cells;
  }

  return (
    <div style={{padding:"0 4px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setCur(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n;})}
          style={{width:24,height:24,border:"none",background:"rgba(255,255,255,0.06)",borderRadius:6,color:"#94a3b8",cursor:"pointer",fontSize:11}}>
          ‹
        </button>
        <span style={{color:"#e2e8f0",fontSize:12,fontWeight:700}}>
          {MESES[cur.getMonth()].slice(0,3)} {cur.getFullYear()}
        </span>
        <button onClick={()=>setCur(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n;})}
          style={{width:24,height:24,border:"none",background:"rgba(255,255,255,0.06)",borderRadius:6,color:"#94a3b8",cursor:"pointer",fontSize:11}}>
          ›
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:4}}>
        {["D","L","M","M","J","V","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",color:"#475569",fontSize:10,fontWeight:600,padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {grid().map((d,i)=>{
          if (!d) return <div key={i}/>;
          const isHoy = esd(d,hoy);
          const isSel = esd(d,fecha);
          const hasEv = eventosEnDia(eventos,d).length > 0;
          return (
            <button key={i} onClick={()=>{onChange(d);setCur(new Date(d));}}
              style={{
                width:"100%",height:26,border:"none",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:isHoy||isSel?700:400,
                background:isSel?"#3b82f6":isHoy?"rgba(59,130,246,0.2)":"transparent",
                color:isSel?"#fff":isHoy?"#60a5fa":"#94a3b8",
                position:"relative",
              }}>
              {d.getDate()}
              {hasEv&&!isSel&&<span style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:isHoy?"#60a5fa":"#3b82f6"}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────── MONTH VIEW ───────────────────────────────────────
function MonthView({ fecha, eventos, onDayClick, onEventClick, onDayDblClick }: {
  fecha: Date; eventos: Evento[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: Evento, ev: React.MouseEvent) => void;
  onDayDblClick: (d: Date) => void;
}) {
  const hoy = new Date();
  const first = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const last  = new Date(fecha.getFullYear(), fecha.getMonth()+1, 0);

  const cells: Date[] = [];
  const offset = first.getDay();
  for (let i=0;i<offset;i++) cells.push(new Date(fecha.getFullYear(), fecha.getMonth(), -offset+i+1));
  for (let d=1;d<=last.getDate();d++) cells.push(new Date(fecha.getFullYear(), fecha.getMonth(), d));
  while (cells.length%7!==0) cells.push(new Date(fecha.getFullYear(), fecha.getMonth()+1, cells.length-last.getDate()-offset+1));

  const semanas = [];
  for (let i=0;i<cells.length;i+=7) semanas.push(cells.slice(i,i+7));

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
      {/* Cabecera días */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #1f2937"}}>
        {DIAS.map(d=>(
          <div key={d} style={{padding:"10px 0",textAlign:"center",color:"#475569",fontSize:12,fontWeight:700,letterSpacing:"0.05em"}}>
            {d.toUpperCase()}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{flex:1,display:"grid",gridTemplateRows:`repeat(${semanas.length},1fr)`}}>
        {semanas.map((semana,si)=>(
          <div key={si} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:si<semanas.length-1?"1px solid #0f172a":"none"}}>
            {semana.map((dia,di)=>{
              const esMes = dia.getMonth()===fecha.getMonth();
              const isHoy = esd(dia,hoy);
              const evs   = eventosEnDia(eventos,dia);
              const MAX = 3;
              return (
                <div key={di}
                  onClick={()=>onDayClick(dia)}
                  onDoubleClick={()=>onDayDblClick(dia)}
                  style={{
                    borderRight: di<6?"1px solid #0f172a":"none",
                    padding:"6px 6px 4px",
                    cursor:"pointer",
                    background:"transparent",
                    minHeight:0,
                    display:"flex",flexDirection:"column",gap:2,
                    transition:"background 0.1s",
                  }}
                  onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.018)")}
                  onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                  {/* Número día */}
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                    <span style={{
                      width:24,height:24,borderRadius:"50%",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:12,fontWeight:isHoy?800:esMes?500:400,
                      background:isHoy?"#3b82f6":"transparent",
                      color:isHoy?"#fff":esMes?"#e2e8f0":"#374151",
                    }}>{dia.getDate()}</span>
                    {evs.length>0&&<span style={{fontSize:10,color:"#475569"}}></span>}
                  </div>
                  {/* Eventos */}
                  {evs.slice(0,MAX).map(ev=>(
                    <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev,e);}}
                      style={{
                        fontSize:10.5,fontWeight:600,
                        padding:"2px 6px",borderRadius:4,
                        background:ev.color+"22",
                        borderLeft:`3px solid ${ev.color}`,
                        color:ev.color,
                        overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",
                        cursor:"pointer",
                        transition:"opacity 0.1s",
                      }}
                      onMouseOver={e=>(e.currentTarget.style.opacity="0.8")}
                      onMouseOut={e=>(e.currentTarget.style.opacity="1")}>
                      {!ev.todoElDia&&<span style={{opacity:0.7,marginRight:3}}>{timeLabel(ev.fechaInicio)}</span>}
                      {ev.titulo}
                    </div>
                  ))}
                  {evs.length>MAX&&(
                    <div style={{fontSize:10,color:"#475569",padding:"1px 6px",cursor:"pointer"}}
                      onClick={e=>{e.stopPropagation();onDayClick(dia);}}>
                      +{evs.length-MAX} más
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── WEEK VIEW ────────────────────────────────────────
function WeekView({ fecha, eventos, onEventClick, onSlotDblClick }: {
  fecha: Date; eventos: Evento[];
  onEventClick: (e: Evento, ev: React.MouseEvent) => void;
  onSlotDblClick: (d: Date) => void;
}) {
  const hoy = new Date();
  const startW = new Date(fecha); startW.setDate(fecha.getDate()-fecha.getDay()); startW.setHours(0,0,0,0);
  const dias = Array.from({length:7},(_,i)=>{const d=new Date(startW);d.setDate(startW.getDate()+i);return d;});
  const HORA_INICIO = 7, HORA_FIN = 21;
  const TOTAL_MIN = (HORA_FIN - HORA_INICIO) * 60;
  const ROW_H = 56; // px per hour

  function posicion(ev: Evento) {
    const fi = ev.fechaInicio.toDate();
    const ff = ev.fechaFin.toDate();
    const startMin = fi.getHours()*60+fi.getMinutes();
    const endMin   = ff.getHours()*60+ff.getMinutes();
    const top    = ((startMin - HORA_INICIO*60) / TOTAL_MIN) * (ROW_H*(HORA_FIN-HORA_INICIO));
    const height = Math.max(((endMin-startMin)/TOTAL_MIN)*(ROW_H*(HORA_FIN-HORA_INICIO)), 20);
    return { top, height };
  }

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
      {/* Header días */}
      <div style={{display:"grid",gridTemplateColumns:"56px repeat(7,1fr)",borderBottom:"1px solid #1f2937",flexShrink:0}}>
        <div/>
        {dias.map((d,i)=>{
          const isHoy = esd(d,hoy);
          const evsTD = eventosEnDia(eventos,d).filter(e=>e.todoElDia);
          return (
            <div key={i} style={{padding:"8px 4px",textAlign:"center",borderLeft:"1px solid #1f2937"}}>
              <p style={{margin:0,fontSize:11,color:"#64748b",fontWeight:600}}>{DIAS[d.getDay()].toUpperCase()}</p>
              <div style={{
                width:30,height:30,borderRadius:"50%",
                background:isHoy?"#3b82f6":"transparent",
                color:isHoy?"#fff":"#e2e8f0",
                fontSize:15,fontWeight:isHoy?800:500,
                display:"flex",alignItems:"center",justifyContent:"center",
                margin:"4px auto 0",
              }}>{d.getDate()}</div>
              {evsTD.slice(0,2).map(ev=>(
                <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev,e);}}
                  style={{margin:"2px 2px 0",background:ev.color+"22",borderLeft:`2px solid ${ev.color}`,borderRadius:3,padding:"1px 4px",fontSize:10,color:ev.color,cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                  {ev.titulo}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {/* Scrollable body */}
      <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>
        <div style={{display:"grid",gridTemplateColumns:"56px repeat(7,1fr)",position:"relative"}}>
          {/* Hora labels */}
          <div>
            {HORAS.map(h=>(
              <div key={h} style={{height:ROW_H,borderBottom:"1px solid #0f172a",display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:8,paddingTop:2}}>
                <span style={{color:"#374151",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>{String(h).padStart(2,"0")}:00</span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {dias.map((dia,di)=>{
            const evs = eventosEnDia(eventos,dia).filter(e=>!e.todoElDia);
            return (
              <div key={di} style={{borderLeft:"1px solid #1f2937",position:"relative"}}>
                {HORAS.map(h=>(
                  <div key={h} style={{height:ROW_H,borderBottom:"1px solid #0f172a",cursor:"pointer"}}
                    onDoubleClick={()=>{const d=new Date(dia);d.setHours(h,0,0,0);onSlotDblClick(d);}}
                    onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.015)")}
                    onMouseOut={e=>(e.currentTarget.style.background="transparent")}/>
                ))}
                {/* Events positioned absolutely */}
                {evs.map(ev=>{
                  const {top,height} = posicion(ev);
                  if (top < 0 && top+height < 0) return null;
                  return (
                    <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev,e);}}
                      style={{
                        position:"absolute",
                        top:Math.max(0,top),
                        height:Math.min(height, ROW_H*(HORA_FIN-HORA_INICIO)-Math.max(0,top)),
                        left:4,right:4,
                        background:ev.color+"25",
                        borderLeft:`3px solid ${ev.color}`,
                        borderRadius:"0 5px 5px 0",
                        padding:"2px 6px",
                        cursor:"pointer",
                        overflow:"hidden",
                        zIndex:10,
                        transition:"opacity 0.1s",
                      }}
                      onMouseOver={e=>(e.currentTarget.style.opacity="0.85")}
                      onMouseOut={e=>(e.currentTarget.style.opacity="1")}>
                      <p style={{margin:0,fontSize:10.5,fontWeight:700,color:ev.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.titulo}</p>
                      <p style={{margin:0,fontSize:10,color:ev.color+"bb",whiteSpace:"nowrap"}}>{timeLabel(ev.fechaInicio)} – {timeLabel(ev.fechaFin)}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── DAY VIEW ─────────────────────────────────────────
function DayView({ fecha, eventos, onEventClick, onSlotDblClick }: {
  fecha: Date; eventos: Evento[];
  onEventClick: (e: Evento, ev: React.MouseEvent) => void;
  onSlotDblClick: (d: Date) => void;
}) {
  const HORA_INICIO = 7, HORA_FIN = 21, TOTAL_MIN = (HORA_FIN-HORA_INICIO)*60, ROW_H = 64;
  const evs = eventosEnDia(eventos, fecha).filter(e=>!e.todoElDia);
  const evsTD = eventosEnDia(eventos, fecha).filter(e=>e.todoElDia);

  function posicion(ev: Evento) {
    const fi = ev.fechaInicio.toDate(), ff = ev.fechaFin.toDate();
    const sm = fi.getHours()*60+fi.getMinutes(), em = ff.getHours()*60+ff.getMinutes();
    const top = ((sm-HORA_INICIO*60)/TOTAL_MIN)*(ROW_H*(HORA_FIN-HORA_INICIO));
    return { top, height: Math.max(((em-sm)/TOTAL_MIN)*(ROW_H*(HORA_FIN-HORA_INICIO)),24) };
  }

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
      <div style={{padding:"8px 20px",borderBottom:"1px solid #1f2937",flexShrink:0}}>
        {evsTD.map(ev=>(
          <div key={ev.id} onClick={e=>onEventClick(ev,e)} style={{display:"inline-flex",alignItems:"center",gap:6,background:ev.color+"20",border:`1px solid ${ev.color}30`,borderRadius:6,padding:"4px 10px",marginRight:8,cursor:"pointer"}}>
            <i className={`fa-solid ${TIPO_CFG[ev.tipo].icon}`} style={{color:ev.color,fontSize:11}}/>
            <span style={{color:ev.color,fontSize:12,fontWeight:600}}>{ev.titulo}</span>
          </div>
        ))}
        {evsTD.length===0&&<span style={{color:"#374151",fontSize:12}}>Sin eventos de todo el día</span>}
      </div>
      <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr",position:"relative"}}>
          <div>
            {HORAS.map(h=>(
              <div key={h} style={{height:ROW_H,borderBottom:"1px solid #0f172a",display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:10,paddingTop:3}}>
                <span style={{color:"#374151",fontSize:11}}>{String(h).padStart(2,"0")}:00</span>
              </div>
            ))}
          </div>
          <div style={{position:"relative",borderLeft:"1px solid #1f2937"}}>
            {HORAS.map(h=>(
              <div key={h} style={{height:ROW_H,borderBottom:"1px solid #0f172a",cursor:"pointer"}}
                onDoubleClick={()=>{const d=new Date(fecha);d.setHours(h,0,0,0);onSlotDblClick(d);}}
                onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.015)")}
                onMouseOut={e=>(e.currentTarget.style.background="transparent")}/>
            ))}
            {evs.map(ev=>{
              const {top,height}=posicion(ev);
              return (
                <div key={ev.id} onClick={e=>onEventClick(ev,e)}
                  style={{position:"absolute",top,height,left:8,right:8,background:ev.color+"25",borderLeft:`4px solid ${ev.color}`,borderRadius:"0 8px 8px 0",padding:"6px 12px",cursor:"pointer",zIndex:10}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:ev.color}}>{ev.titulo}</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:ev.color+"99"}}>{timeLabel(ev.fechaInicio)} – {timeLabel(ev.fechaFin)} · {durStr(ev.fechaInicio,ev.fechaFin)}</p>
                  {ev.ubicacion&&<p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}><i className="fa-solid fa-location-dot" style={{marginRight:4}}/>{ev.ubicacion}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── AGENDA VIEW ──────────────────────────────────────
function AgendaView({ fecha, eventos, onEventClick }: {
  fecha: Date; eventos: Evento[];
  onEventClick: (e: Evento, ev: React.MouseEvent) => void;
}) {
  const hoy = new Date();
  const dias: Date[] = [];
  for (let i=0;i<60;i++) { const d=new Date(fecha); d.setDate(fecha.getDate()+i); dias.push(d); }

  const grupos = dias.map(d=>({ dia:d, evs:eventosEnDia(eventos,d) })).filter(g=>g.evs.length>0);

  if (grupos.length===0) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <i className="fa-solid fa-calendar-xmark" style={{fontSize:40,color:"#1f2937"}}/>
      <p style={{color:"#374151",fontSize:14,fontWeight:600,margin:0}}>Sin eventos próximos</p>
      <p style={{color:"#1f2937",fontSize:12,margin:0}}>Los próximos 60 días están libres</p>
    </div>
  );

  function grupoLabel(d: Date): string {
    if (esd(d,hoy)) return "Hoy";
    const mañana = new Date(hoy); mañana.setDate(hoy.getDate()+1);
    if (esd(d,mañana)) return "Mañana";
    const diffDays = Math.floor((sod(d).getTime()-sod(hoy).getTime())/86400000);
    if (diffDays < 7) return DIAS_FULL[d.getDay()];
    if (diffDays < 14) return `Próxima semana · ${DIAS_FULL[d.getDay()]}`;
    return `${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  return (
    <div style={{flex:1,overflowY:"auto",padding:"0 0 40px",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>
      {grupos.map(({dia,evs})=>{
        const isHoy = esd(dia,hoy);
        const evsSorted = [...evs].sort((a,b)=>{
          if (a.todoElDia&&!b.todoElDia) return -1;
          if (!a.todoElDia&&b.todoElDia) return 1;
          return a.fechaInicio.toMillis()-b.fechaInicio.toMillis();
        });
        return (
          <div key={dia.toISOString()}>
            {/* Fecha header */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"20px 24px 8px",position:"sticky",top:0,background:"#0b1220",zIndex:5}}>
              <div style={{width:42,height:42,borderRadius:12,background:isHoy?"#3b82f6":"rgba(255,255,255,0.04)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:9,fontWeight:700,color:isHoy?"rgba(255,255,255,0.7)":"#475569",lineHeight:1}}>{DIAS[dia.getDay()].toUpperCase()}</span>
                <span style={{fontSize:18,fontWeight:800,color:isHoy?"#fff":"#e2e8f0",lineHeight:1.1}}>{dia.getDate()}</span>
              </div>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:isHoy?"#60a5fa":"#e2e8f0"}}>{grupoLabel(dia)}</p>
                <p style={{margin:0,fontSize:11,color:"#475569"}}>{MESES[dia.getMonth()]} {dia.getFullYear()} · {evs.length} evento{evs.length!==1?"s":""}</p>
              </div>
            </div>
            {/* Events */}
            {evsSorted.map(ev=>(
              <div key={ev.id} onClick={e=>onEventClick(ev,e)}
                style={{
                  display:"flex",alignItems:"center",gap:16,padding:"10px 24px 10px 80px",
                  cursor:"pointer",transition:"background 0.1s",borderBottom:"1px solid #0f172a",
                }}
                onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.025)")}
                onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:ev.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <p style={{margin:0,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{ev.titulo}</p>
                    <span style={{fontSize:10,padding:"1px 6px",borderRadius:20,background:ESTADO_CFG[ev.estado].bg,color:ESTADO_CFG[ev.estado].color,fontWeight:600}}>
                      {ESTADO_CFG[ev.estado].label}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:3,flexWrap:"wrap"}}>
                    {!ev.todoElDia&&<span style={{fontSize:12,color:"#64748b"}}><i className="fa-regular fa-clock" style={{marginRight:4}}/>{timeLabel(ev.fechaInicio)} – {timeLabel(ev.fechaFin)}</span>}
                    {ev.todoElDia&&<span style={{fontSize:12,color:"#64748b"}}>Todo el día</span>}
                    {ev.ubicacion&&<span style={{fontSize:12,color:"#64748b"}}><i className="fa-solid fa-location-dot" style={{marginRight:4}}/>{ev.ubicacion}</span>}
                    {ev.participantes.length>0&&<span style={{fontSize:12,color:"#64748b"}}><i className="fa-solid fa-users" style={{marginRight:4}}/>{ev.participantes.length} participante{ev.participantes.length!==1?"s":""}</span>}
                  </div>
                </div>
                <div style={{width:8,height:8,borderRadius:"50%",background:ev.color,flexShrink:0}}/>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────── TIMELINE VIEW ────────────────────────────────────
function TimelineView({ fecha, eventos, onEventClick }: {
  fecha: Date; eventos: Evento[];
  onEventClick: (e: Evento, ev: React.MouseEvent) => void;
}) {
  const DAYS = 14;
  const inicio = new Date(fecha); inicio.setDate(fecha.getDate()-fecha.getDay());
  const dias = Array.from({length:DAYS},(_,i)=>{const d=new Date(inicio);d.setDate(inicio.getDate()+i);return d;});
  const hoy = new Date();
  const DAY_W = 80;

  const tipos = Array.from(new Set(eventos.map(e=>e.tipo))) as EventoTipo[];

  return (
    <div style={{flex:1,overflowX:"auto",overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>
      <div style={{minWidth:DAYS*DAY_W+200}}>
        {/* Header días */}
        <div style={{display:"flex",borderBottom:"1px solid #1f2937",position:"sticky",top:0,background:"#0b1220",zIndex:10}}>
          <div style={{width:200,flexShrink:0,padding:"8px 16px",borderRight:"1px solid #1f2937"}}>
            <span style={{color:"#475569",fontSize:11,fontWeight:600}}>CATEGORÍA</span>
          </div>
          {dias.map((d,i)=>{
            const isHoy = esd(d,hoy);
            return (
              <div key={i} style={{width:DAY_W,flexShrink:0,textAlign:"center",padding:"6px 0",borderRight:"1px solid #0f172a",background:isHoy?"rgba(59,130,246,0.08)":"transparent"}}>
                <p style={{margin:0,fontSize:10,color:"#475569",fontWeight:600}}>{DIAS[d.getDay()]}</p>
                <p style={{margin:0,fontSize:14,fontWeight:isHoy?800:500,color:isHoy?"#60a5fa":"#94a3b8"}}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        {/* Rows por tipo */}
        {(Object.keys(TIPO_CFG) as EventoTipo[]).map(tipo=>{
          const evsTipo = eventos.filter(e=>e.tipo===tipo);
          if (evsTipo.length===0) return null;
          return (
            <div key={tipo} style={{display:"flex",borderBottom:"1px solid #0f172a",minHeight:48}}>
              <div style={{width:200,flexShrink:0,borderRight:"1px solid #1f2937",padding:"8px 16px",display:"flex",alignItems:"center",gap:8}}>
                <i className={`fa-solid ${TIPO_CFG[tipo].icon}`} style={{color:TIPO_CFG[tipo].color,fontSize:13,width:16}}/>
                <span style={{color:"#94a3b8",fontSize:12,fontWeight:600}}>{TIPO_CFG[tipo].label}</span>
              </div>
              {dias.map((dia,di)=>{
                const evsHoy = evsTipo.filter(e=>{
                  const fs=sod(dia).getTime(),fe=fs+86400000-1;
                  return e.fechaInicio.toMillis()<=fe&&e.fechaFin.toMillis()>=fs;
                });
                return (
                  <div key={di} style={{width:DAY_W,flexShrink:0,borderRight:"1px solid #0f172a",padding:3,position:"relative"}}>
                    {evsHoy.map(ev=>(
                      <div key={ev.id} onClick={e=>onEventClick(ev,e)}
                        style={{background:ev.color+"22",border:`1px solid ${ev.color}40`,borderRadius:4,padding:"2px 5px",marginBottom:2,cursor:"pointer",overflow:"hidden"}}>
                        <p style={{margin:0,fontSize:9,fontWeight:700,color:ev.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.titulo}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────── DETAIL PANEL ─────────────────────────────────────
function DetailPanel({ evento, onClose, onEdit, onDelete, onChangeEstado, usuario }: {
  evento: Evento | null; onClose: () => void;
  onEdit: () => void; onDelete: () => void;
  onChangeEstado: (e: EventoEstado) => void;
  usuario: { uid: string; nombre: string; rol: string } | null;
}) {
  if (!evento) return null;
  const tcfg = TIPO_CFG[evento.tipo];
  const ecfg = ESTADO_CFG[evento.estado];
  const pcfg = PRIORIDAD_CFG[evento.prioridad];
  const canEdit = usuario && (
    usuario.rol === "administrador" ||
    usuario.rol === "coordinador" ||
    evento.creadoPorUid === usuario.uid
  );

  return (
    <div style={{
      width:420,flexShrink:0,borderLeft:"1px solid #1f2937",
      display:"flex",flexDirection:"column",background:"#0d1520",
      overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{padding:"16px 20px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:40,height:40,borderRadius:11,background:evento.color+"22",border:`1px solid ${evento.color}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <i className={`fa-solid ${tcfg.icon}`} style={{color:evento.color,fontSize:16}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h2 style={{margin:0,fontSize:16,fontWeight:800,color:"#f1f5f9",lineHeight:1.2}}>{evento.titulo}</h2>
          <p style={{margin:"4px 0 0",fontSize:12,color:"#64748b"}}>{evento.codigo}</p>
        </div>
        <button onClick={onClose} style={{width:28,height:28,border:"none",background:"rgba(255,255,255,0.06)",borderRadius:8,color:"#64748b",cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
      </div>

      {/* Badges */}
      <div style={{padding:"12px 20px",borderBottom:"1px solid #1f2937",display:"flex",gap:8,flexWrap:"wrap"}}>
        <span style={{padding:"3px 10px",borderRadius:20,background:ecfg.bg,color:ecfg.color,fontSize:11,fontWeight:700}}>{ecfg.label}</span>
        <span style={{padding:"3px 10px",borderRadius:20,background:pcfg.color+"20",color:pcfg.color,fontSize:11,fontWeight:700}}>{pcfg.label}</span>
        <span style={{padding:"3px 10px",borderRadius:20,background:evento.color+"20",color:evento.color,fontSize:11,fontWeight:600}}>{tcfg.label}</span>
        {evento.todoElDia&&<span style={{padding:"3px 10px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"#94a3b8",fontSize:11}}>Todo el día</span>}
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>

        {/* Tiempo */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
          <p style={{margin:"0 0 6px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Horario</p>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <i className="fa-regular fa-clock" style={{color:"#64748b",fontSize:14}}/>
            <div>
              {evento.todoElDia
                ? <p style={{margin:0,color:"#e2e8f0",fontSize:13}}>Todo el día · {evento.fechaInicio.toDate().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</p>
                : <>
                    <p style={{margin:0,color:"#e2e8f0",fontSize:13}}>{evento.fechaInicio.toDate().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
                    <p style={{margin:"2px 0 0",color:"#64748b",fontSize:12}}>{timeLabel(evento.fechaInicio)} – {timeLabel(evento.fechaFin)} · {durStr(evento.fechaInicio,evento.fechaFin)}</p>
                  </>
              }
            </div>
          </div>
        </div>

        {/* Descripción */}
        {evento.descripcion&&(
          <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
            <p style={{margin:"0 0 6px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Descripción</p>
            <p style={{margin:0,color:"#94a3b8",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{evento.descripcion}</p>
          </div>
        )}

        {/* Ubicación / link */}
        {(evento.ubicacion||evento.enlaceVirtual)&&(
          <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
            {evento.ubicacion&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:evento.enlaceVirtual?8:0}}>
              <i className="fa-solid fa-location-dot" style={{color:"#64748b",fontSize:13,width:16}}/>
              <span style={{color:"#94a3b8",fontSize:13}}>{evento.ubicacion}</span>
            </div>}
            {evento.enlaceVirtual&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
              <i className="fa-solid fa-video" style={{color:"#64748b",fontSize:13,width:16}}/>
              <a href={evento.enlaceVirtual} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",fontSize:13,textDecoration:"none"}}>{evento.enlaceVirtual}</a>
            </div>}
          </div>
        )}

        {/* Organizador */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
          <p style={{margin:"0 0 8px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Organizador</p>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#3b82f620",display:"flex",alignItems:"center",justifyContent:"center",color:"#60a5fa",fontSize:12,fontWeight:700}}>
              {evento.organizadorNombre.charAt(0)}
            </div>
            <span style={{color:"#e2e8f0",fontSize:13}}>{evento.organizadorNombre}</span>
          </div>
        </div>

        {/* Participantes */}
        {evento.participantes.length>0&&(
          <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
            <p style={{margin:"0 0 8px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Participantes ({evento.participantes.length})</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {evento.participantes.map((p,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:11,fontWeight:700}}>
                    {p.nombre.charAt(0)}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:12}}>{p.nombre}</span>
                  {p.rol&&<span style={{color:"#374151",fontSize:11}}>{p.rol}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vínculos */}
        {(evento.empresaNombre||evento.estudianteNombre||evento.profesorNombre||evento.convenioId)&&(
          <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
            <p style={{margin:"0 0 8px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Vínculos</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {evento.empresaNombre&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
                <i className="fa-solid fa-building" style={{color:"#94a3b8",fontSize:12,width:16}}/>
                <span style={{color:"#94a3b8",fontSize:12}}>{evento.empresaNombre}</span>
              </div>}
              {evento.estudianteNombre&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
                <i className="fa-solid fa-graduation-cap" style={{color:"#94a3b8",fontSize:12,width:16}}/>
                <span style={{color:"#94a3b8",fontSize:12}}>{evento.estudianteNombre}</span>
              </div>}
              {evento.profesorNombre&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
                <i className="fa-solid fa-chalkboard-user" style={{color:"#94a3b8",fontSize:12,width:16}}/>
                <span style={{color:"#94a3b8",fontSize:12}}>{evento.profesorNombre}</span>
              </div>}
            </div>
          </div>
        )}

        {/* Etiquetas */}
        {evento.etiquetas.length>0&&(
          <div style={{padding:"14px 20px",borderBottom:"1px solid #0f172a"}}>
            <p style={{margin:"0 0 8px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Etiquetas</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {evento.etiquetas.map((t,i)=>(
                <span key={i} style={{padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"#94a3b8",fontSize:11}}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        {evento.historial.length>0&&(
          <div style={{padding:"14px 20px"}}>
            <p style={{margin:"0 0 8px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Historial</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {evento.historial.slice(-5).reverse().map((h,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#374151",flexShrink:0,marginTop:5}}/>
                  <div>
                    <p style={{margin:0,fontSize:11,color:"#64748b"}}>{h.accion}</p>
                    <p style={{margin:"1px 0 0",fontSize:10,color:"#374151"}}>{h.nombre} · {h.ts?.toDate().toLocaleString("es-CL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{padding:"12px 20px",borderTop:"1px solid #1f2937",display:"flex",gap:8}}>
        {canEdit&&<>
          <button onClick={onEdit} style={{flex:1,padding:"8px 0",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            <i className="fa-solid fa-pen" style={{marginRight:6,fontSize:11}}/>Editar
          </button>
          <button onClick={onDelete} style={{padding:"8px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,color:"#f87171",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            <i className="fa-solid fa-trash" style={{fontSize:11}}/>
          </button>
        </>}
        {!canEdit&&<button onClick={onClose} style={{flex:1,padding:"8px 0",background:"rgba(255,255,255,0.04)",border:"1px solid #1f2937",borderRadius:8,color:"#94a3b8",fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Cerrar</button>}
      </div>

      {/* Cambiar estado (admin) */}
      {canEdit&&(
        <div style={{padding:"0 20px 16px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {(Object.keys(ESTADO_CFG) as EventoEstado[]).filter(s=>s!==evento.estado).map(s=>(
            <button key={s} onClick={()=>onChangeEstado(s)}
              style={{padding:"4px 10px",border:`1px solid ${ESTADO_CFG[s].color}40`,borderRadius:20,background:ESTADO_CFG[s].bg,color:ESTADO_CFG[s].color,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              → {ESTADO_CFG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────── CREATE / EDIT MODAL ──────────────────────────────
interface FormEvento {
  titulo: string; descripcion: string; tipo: EventoTipo; prioridad: EventoPrioridad; estado: EventoEstado;
  fechaInicioDate: string; fechaInicioTime: string; fechaFinDate: string; fechaFinTime: string;
  todoElDia: boolean; color: string; ubicacion: string; enlaceVirtual: string;
  etiquetas: string; observaciones: string;
  empresaNombre: string; estudianteNombre: string; profesorNombre: string;
  participantesNombres: string;
}

const FORM_INICIAL: FormEvento = {
  titulo:"", descripcion:"", tipo:"reunion", prioridad:"media", estado:"programado",
  fechaInicioDate:"", fechaInicioTime:"09:00", fechaFinDate:"", fechaFinTime:"10:00",
  todoElDia:false, color:"#3b82f6", ubicacion:"", enlaceVirtual:"",
  etiquetas:"", observaciones:"",
  empresaNombre:"", estudianteNombre:"", profesorNombre:"",
  participantesNombres:"",
};

function CreateModal({ visible, eventoEditar, onClose, onSave, conflictos, usuario }: {
  visible: boolean; eventoEditar: Evento | null; onClose: () => void;
  onSave: (f: FormEvento) => Promise<void>;
  conflictos: Evento[]; usuario: { uid: string; nombre: string; rol: string } | null;
}) {
  const [form, setForm] = useState<FormEvento>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [errores, setErrores] = useState<Record<string,string>>({});
  const [tab, setTab] = useState<"basico"|"detalles"|"relaciones">("basico");

  useEffect(()=>{
    if (!visible) { setForm(FORM_INICIAL); setErrores({}); setTab("basico"); return; }
    if (eventoEditar) {
      setForm({
        titulo: eventoEditar.titulo,
        descripcion: eventoEditar.descripcion||"",
        tipo: eventoEditar.tipo,
        prioridad: eventoEditar.prioridad,
        estado: eventoEditar.estado,
        fechaInicioDate: toInputDate(eventoEditar.fechaInicio),
        fechaInicioTime: toInputTime(eventoEditar.fechaInicio),
        fechaFinDate: toInputDate(eventoEditar.fechaFin),
        fechaFinTime: toInputTime(eventoEditar.fechaFin),
        todoElDia: eventoEditar.todoElDia,
        color: eventoEditar.color,
        ubicacion: eventoEditar.ubicacion||"",
        enlaceVirtual: eventoEditar.enlaceVirtual||"",
        etiquetas: eventoEditar.etiquetas.join(", "),
        observaciones: eventoEditar.observaciones||"",
        empresaNombre: eventoEditar.empresaNombre||"",
        estudianteNombre: eventoEditar.estudianteNombre||"",
        profesorNombre: eventoEditar.profesorNombre||"",
        participantesNombres: eventoEditar.participantes.map(p=>p.nombre).join(", "),
      });
    }
  },[visible,eventoEditar]);

  function set(k: keyof FormEvento, v: string|boolean) { setForm(p=>({...p,[k]:v})); if(errores[k]) setErrores(p=>({...p,[k]:""})); }

  function validar(): boolean {
    const e: Record<string,string> = {};
    if (!form.titulo.trim()) e.titulo = "El título es obligatorio";
    if (!form.fechaInicioDate) e.fechaInicioDate = "Selecciona fecha de inicio";
    if (!form.fechaFinDate) e.fechaFinDate = "Selecciona fecha de término";
    if (!form.todoElDia) {
      const fi = fromInputs(form.fechaInicioDate, form.fechaInicioTime);
      const ff = fromInputs(form.fechaFinDate, form.fechaFinTime);
      if (ff.toMillis() <= fi.toMillis()) e.fechaFinDate = "La fecha de término debe ser posterior al inicio";
    }
    setErrores(e);
    return Object.keys(e).length===0;
  }

  async function handleSave() {
    if (!validar()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  if (!visible) return null;

  const inputStyle: React.CSSProperties = {
    width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.05)",
    border:"1px solid #1f2937",borderRadius:8,color:"#f1f5f9",fontSize:13,
    fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",
  };

  const labelStyle: React.CSSProperties = {
    display:"block",fontSize:11,fontWeight:700,color:"#475569",
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,
  };

  const tabs: {k: "basico"|"detalles"|"relaciones"; label: string}[] = [
    {k:"basico",label:"Básico"},{k:"detalles",label:"Detalles"},{k:"relaciones",label:"Relaciones"},
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}}/>
      <div style={{
        position:"relative",width:580,maxHeight:"90vh",
        background:"#111827",border:"1px solid #1f2937",borderRadius:20,
        boxShadow:"0 32px 80px rgba(0,0,0,0.6)",overflow:"hidden",
        display:"flex",flexDirection:"column",
      }} onClick={e=>e.stopPropagation()}>

        {/* Modal header */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:form.color+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <i className={`fa-solid ${TIPO_CFG[form.tipo].icon}`} style={{color:form.color,fontSize:15}}/>
          </div>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:800,color:"#f1f5f9"}}>{eventoEditar?"Editar evento":"Nuevo evento"}</h2>
            <p style={{margin:0,fontSize:11,color:"#475569"}}>{TIPO_CFG[form.tipo].label}</p>
          </div>
          <button onClick={onClose} style={{width:30,height:30,border:"none",background:"rgba(255,255,255,0.06)",borderRadius:8,color:"#64748b",cursor:"pointer",fontSize:15}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #1f2937",padding:"0 24px"}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{padding:"10px 0",marginRight:20,background:"transparent",border:"none",borderBottom:tab===t.k?"2px solid #3b82f6":"2px solid transparent",color:tab===t.k?"#f1f5f9":"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>

          {/* BÁSICO */}
          {tab==="basico"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Título */}
            <div>
              <label style={labelStyle}>Título *</label>
              <input value={form.titulo} onChange={e=>set("titulo",e.target.value)}
                placeholder="Ej: Visita de supervisión a Empresa XYZ"
                style={{...inputStyle,borderColor:errores.titulo?"#ef4444":"#1f2937"}}
              />
              {errores.titulo&&<p style={{margin:"4px 0 0",color:"#ef4444",fontSize:11}}>{errores.titulo}</p>}
            </div>

            {/* Tipo y color */}
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12}}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}
                  style={{...inputStyle,colorScheme:"dark",cursor:"pointer"}}>
                  {(Object.keys(TIPO_CFG) as EventoTipo[]).map(t=>(
                    <option key={t} value={t} style={{background:"#1a2236",color:"#f1f5f9"}}>{TIPO_CFG[t].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Color</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:4}}>
                  {COLORES.map(c=>(
                    <button key={c} onClick={()=>set("color",c)}
                      style={{width:22,height:22,borderRadius:"50%",background:c,border:form.color===c?`2px solid #fff`:`2px solid ${c}60`,cursor:"pointer",flexShrink:0}}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Prioridad */}
            <div>
              <label style={labelStyle}>Prioridad</label>
              <div style={{display:"flex",gap:8}}>
                {(Object.keys(PRIORIDAD_CFG) as EventoPrioridad[]).map(p=>(
                  <button key={p} onClick={()=>set("prioridad",p)}
                    style={{flex:1,padding:"6px 0",border:`1px solid ${form.prioridad===p?PRIORIDAD_CFG[p].color:PRIORIDAD_CFG[p].color+"40"}`,borderRadius:8,background:form.prioridad===p?PRIORIDAD_CFG[p].color+"20":"transparent",color:PRIORIDAD_CFG[p].color,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                    {PRIORIDAD_CFG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <label style={{...labelStyle,margin:0}}>Horario</label>
                <button onClick={()=>set("todoElDia",!form.todoElDia)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"2px 10px",border:"1px solid #1f2937",borderRadius:20,background:form.todoElDia?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)",color:form.todoElDia?"#60a5fa":"#94a3b8",fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  <span style={{width:14,height:14,borderRadius:"50%",border:form.todoElDia?"none":"1.5px solid #475569",background:form.todoElDia?"#3b82f6":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                    {form.todoElDia&&"✓"}
                  </span>
                  Todo el día
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{...labelStyle,marginBottom:3}}>Inicio *</label>
                  <input type="date" value={form.fechaInicioDate} onChange={e=>set("fechaInicioDate",e.target.value)}
                    style={{...inputStyle,colorScheme:"dark",borderColor:errores.fechaInicioDate?"#ef4444":"#1f2937"}}/>
                  {!form.todoElDia&&<input type="time" value={form.fechaInicioTime} onChange={e=>set("fechaInicioTime",e.target.value)} style={{...inputStyle,marginTop:6,colorScheme:"dark"}}/>}
                  {errores.fechaInicioDate&&<p style={{margin:"4px 0 0",color:"#ef4444",fontSize:11}}>{errores.fechaInicioDate}</p>}
                </div>
                <div>
                  <label style={{...labelStyle,marginBottom:3}}>Término *</label>
                  <input type="date" value={form.fechaFinDate} onChange={e=>set("fechaFinDate",e.target.value)}
                    style={{...inputStyle,colorScheme:"dark",borderColor:errores.fechaFinDate?"#ef4444":"#1f2937"}}/>
                  {!form.todoElDia&&<input type="time" value={form.fechaFinTime} onChange={e=>set("fechaFinTime",e.target.value)} style={{...inputStyle,marginTop:6,colorScheme:"dark"}}/>}
                  {errores.fechaFinDate&&<p style={{margin:"4px 0 0",color:"#ef4444",fontSize:11}}>{errores.fechaFinDate}</p>}
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea value={form.descripcion} onChange={e=>set("descripcion",e.target.value)}
                placeholder="Detalles del evento..." rows={3}
                style={{...inputStyle,resize:"vertical",minHeight:72}}/>
            </div>
          </div>}

          {/* DETALLES */}
          {tab==="detalles"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={form.estado} onChange={e=>set("estado",e.target.value)}
                style={{...inputStyle,colorScheme:"dark",cursor:"pointer"}}>
                {(Object.keys(ESTADO_CFG) as EventoEstado[]).map(s=>(
                  <option key={s} value={s} style={{background:"#1a2236",color:"#f1f5f9"}}>{ESTADO_CFG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ubicación</label>
              <input value={form.ubicacion} onChange={e=>set("ubicacion",e.target.value)}
                placeholder="Ej: Sala de reuniones, Planta 2" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Enlace virtual (meet, zoom, teams...)</label>
              <input value={form.enlaceVirtual} onChange={e=>set("enlaceVirtual",e.target.value)}
                placeholder="https://..." style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Etiquetas (separadas por coma)</label>
              <input value={form.etiquetas} onChange={e=>set("etiquetas",e.target.value)}
                placeholder="Ej: urgente, dual, 2026" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Observaciones</label>
              <textarea value={form.observaciones} onChange={e=>set("observaciones",e.target.value)}
                placeholder="Notas adicionales..." rows={3} style={{...inputStyle,resize:"vertical",minHeight:72}}/>
            </div>
          </div>}

          {/* RELACIONES */}
          {tab==="relaciones"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={labelStyle}>Empresa dual</label>
              <input value={form.empresaNombre} onChange={e=>set("empresaNombre",e.target.value)}
                placeholder="Nombre de la empresa" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Estudiante</label>
              <input value={form.estudianteNombre} onChange={e=>set("estudianteNombre",e.target.value)}
                placeholder="Nombre del estudiante" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Profesor supervisor</label>
              <input value={form.profesorNombre} onChange={e=>set("profesorNombre",e.target.value)}
                placeholder="Nombre del profesor" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Participantes adicionales (nombres, separados por coma)</label>
              <textarea value={form.participantesNombres} onChange={e=>set("participantesNombres",e.target.value)}
                placeholder="Ej: Juan Pérez, María González" rows={3} style={{...inputStyle,resize:"vertical",minHeight:72}}/>
            </div>
          </div>}

          {/* Conflictos */}
          {conflictos.length>0&&(
            <div style={{marginTop:12,padding:"12px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10}}>
              <p style={{margin:"0 0 6px",color:"#f87171",fontSize:12,fontWeight:700}}><i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}}/>Conflictos detectados ({conflictos.length})</p>
              {conflictos.slice(0,3).map(c=>(
                <p key={c.id} style={{margin:"2px 0",color:"#f87171",fontSize:11,opacity:0.8}}>· {c.titulo} — {timeLabel(c.fechaInicio)} a {timeLabel(c.fechaFin)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 24px",borderTop:"1px solid #1f2937",display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 18px",background:"transparent",border:"1px solid #1f2937",borderRadius:9,color:"#94a3b8",fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{padding:"8px 22px",background:saving?"rgba(59,130,246,0.3)":"#3b82f6",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:8}}>
            {saving&&<span style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.6s linear infinite"}}/>}
            {eventoEditar?"Guardar cambios":"Crear evento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── MAIN PAGE ────────────────────────────────
export default function CalendarioPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [eventos, setEventos]             = useState<Evento[]>([]);
  const [vista, setVista]                 = useState<Vista>("mes");
  const [fecha, setFecha]                 = useState(new Date());
  const [eventoSel, setEventoSel]         = useState<Evento | null>(null);
  const [modalVisible, setModalVisible]   = useState(false);
  const [eventoEditar, setEventoEditar]   = useState<Evento | null>(null);
  const [fechaModal, setFechaModal]       = useState<Date | null>(null);
  const [busqueda, setBusqueda]           = useState("");
  const [filtroCat, setFiltroCat]         = useState<EventoTipo | "todos">("todos");
  const [conflictos, setConflictos]       = useState<Evento[]>([]);
  const [formPrev, setFormPrev]           = useState<FormEvento | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Firestore listener ────────────────────────────────────────────
  useEffect(()=>{
    if (!usuario?.liceoId) return;
    const q = query(collection(db,"eventos"), where("liceoId","==",usuario.liceoId));
    const unsub = onSnapshot(q, snap=>{
      setEventos(snap.docs.map(d=>({id:d.id,...d.data()} as Evento)));
    },()=>{});
    return ()=>unsub();
  },[usuario?.liceoId]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(()=>{
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key==="n"||e.key==="N") { setEventoEditar(null); setModalVisible(true); }
      if (e.key==="/"||e.key===".") { searchRef.current?.focus(); e.preventDefault(); }
      if (e.key==="Escape") { setEventoSel(null); setModalVisible(false); }
      if (e.key==="1") setVista("mes");
      if (e.key==="2") setVista("semana");
      if (e.key==="3") setVista("dia");
      if (e.key==="4") setVista("agenda");
      if (e.key==="5") setVista("timeline");
      if (e.key==="j"||e.key==="ArrowRight") navFecha(1);
      if (e.key==="k"||e.key==="ArrowLeft") navFecha(-1);
      if (e.key==="t") setFecha(new Date());
    }
    document.addEventListener("keydown",handler);
    return ()=>document.removeEventListener("keydown",handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[vista]);

  function navFecha(dir: number) {
    setFecha(d=>{
      const n=new Date(d);
      if (vista==="mes")    n.setMonth(d.getMonth()+dir);
      else if (vista==="semana") n.setDate(d.getDate()+7*dir);
      else if (vista==="timeline") n.setDate(d.getDate()+14*dir);
      else n.setDate(d.getDate()+dir);
      return n;
    });
  }

  // ── Title label ───────────────────────────────────────────────────
  const tituloVista = useMemo(()=>{
    if (vista==="mes") return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    if (vista==="semana") {
      const s=new Date(fecha); s.setDate(fecha.getDate()-fecha.getDay());
      const e=new Date(s); e.setDate(s.getDate()+6);
      if (s.getMonth()===e.getMonth()) return `${s.getDate()}–${e.getDate()} de ${MESES[s.getMonth()]} ${s.getFullYear()}`;
      return `${s.getDate()} ${MESES[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MESES[e.getMonth()].slice(0,3)} ${e.getFullYear()}`;
    }
    if (vista==="dia") return fecha.toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    if (vista==="timeline") {
      const s=new Date(fecha); s.setDate(fecha.getDate()-fecha.getDay());
      const e=new Date(s); e.setDate(s.getDate()+13);
      return `${s.getDate()} ${MESES[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MESES[e.getMonth()].slice(0,3)} ${e.getFullYear()}`;
    }
    return "Próximos eventos";
  },[vista,fecha]);

  // ── Filtered events ───────────────────────────────────────────────
  const eventosFiltrados = useMemo(()=>{
    let evs = eventos;
    if (filtroCat!=="todos") evs = evs.filter(e=>e.tipo===filtroCat);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      evs = evs.filter(e=>
        e.titulo.toLowerCase().includes(q)||
        e.descripcion?.toLowerCase().includes(q)||
        e.ubicacion?.toLowerCase().includes(q)||
        e.empresaNombre?.toLowerCase().includes(q)||
        e.estudianteNombre?.toLowerCase().includes(q)||
        e.profesorNombre?.toLowerCase().includes(q)||
        e.etiquetas.some(t=>t.toLowerCase().includes(q))
      );
    }
    return evs;
  },[eventos,filtroCat,busqueda]);

  // ── Conflict check live ───────────────────────────────────────────
  useEffect(()=>{
    if (!formPrev||!formPrev.fechaInicioDate||!formPrev.fechaFinDate) { setConflictos([]); return; }
    const fi = fromInputs(formPrev.fechaInicioDate, formPrev.fechaInicioTime);
    const ff = fromInputs(formPrev.fechaFinDate, formPrev.fechaFinTime);
    const c = detectarConflictos(eventos, { fi, ff, uid: usuario?.uid||"", participantes:[], todoElDia: formPrev.todoElDia, eventoId: eventoEditar?.id });
    setConflictos(c);
  },[formPrev,eventos,usuario?.uid,eventoEditar]);

  // ── Save event ────────────────────────────────────────────────────
  async function guardarEvento(form: FormEvento) {
    if (!usuario) return;
    setFormPrev(form);
    const fi = form.todoElDia ? fromInputs(form.fechaInicioDate,"00:00") : fromInputs(form.fechaInicioDate,form.fechaInicioTime);
    const ff = form.todoElDia ? fromInputs(form.fechaFinDate,"23:59") : fromInputs(form.fechaFinDate,form.fechaFinTime);
    const etiquetas = form.etiquetas.split(",").map(s=>s.trim()).filter(Boolean);
    const participantes: Participante[] = form.participantesNombres.split(",").map(s=>s.trim()).filter(Boolean).map(n=>({uid:"ext",nombre:n}));

    const entrada: HistorialEntrada = {
      accion: eventoEditar ? "Evento modificado" : "Evento creado",
      uid: usuario.uid, nombre: usuario.nombre, ts: Timestamp.now(),
    };

    const data: Omit<Evento,"id"> = {
      codigo: eventoEditar?.codigo || genCodigo(),
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim()||undefined,
      tipo: form.tipo, prioridad: form.prioridad, estado: form.estado,
      organizadorUid: usuario.uid, organizadorNombre: usuario.nombre,
      participantes,
      empresaNombre: form.empresaNombre.trim()||undefined,
      estudianteNombre: form.estudianteNombre.trim()||undefined,
      profesorNombre: form.profesorNombre.trim()||undefined,
      ubicacion: form.ubicacion.trim()||undefined,
      enlaceVirtual: form.enlaceVirtual.trim()||undefined,
      fechaInicio: fi, fechaFin: ff, todoElDia: form.todoElDia,
      color: form.color, etiquetas,
      observaciones: form.observaciones.trim()||undefined,
      liceoId: usuario.liceoId, creadoPorUid: eventoEditar?.creadoPorUid||usuario.uid,
      creadoPorNombre: eventoEditar?.creadoPorNombre||usuario.nombre,
      creadoEn: eventoEditar?.creadoEn||Timestamp.now(),
      actualizadoEn: Timestamp.now(),
      historial: [...(eventoEditar?.historial||[]), entrada],
    };

    if (eventoEditar) {
      await updateDoc(doc(db,"eventos",eventoEditar.id), data as Record<string,unknown>);
    } else {
      await addDoc(collection(db,"eventos"), data);
      // Auto-notificación a participantes
      if (participantes.length>0) {
        const batch = writeBatch(db);
        participantes.filter(p=>p.uid&&p.uid!=="ext").forEach(p=>{
          const ref = doc(collection(db,"notificaciones",p.uid,"items"));
          batch.set(ref,{
            titulo:`Nuevo evento: ${form.titulo}`,
            descripcion:`${fi.toDate().toLocaleDateString("es-CL")} a las ${form.fechaInicioTime}`,
            tipo:"calendario", leida:false, archivada:false, timestamp:Timestamp.now(),
            color:"#3b82f6", icono:"fa-solid fa-calendar",
          });
        });
        await batch.commit().catch(()=>{});
      }
    }
    setModalVisible(false);
    setEventoEditar(null);
  }

  // ── Delete event ──────────────────────────────────────────────────
  async function eliminarEvento() {
    if (!eventoSel) return;
    if (!confirm(`¿Eliminar "${eventoSel.titulo}"? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db,"eventos",eventoSel.id));
    setEventoSel(null);
  }

  // ── Change estado ─────────────────────────────────────────────────
  async function cambiarEstado(estado: EventoEstado) {
    if (!eventoSel||!usuario) return;
    const entrada: HistorialEntrada = { accion:`Estado → ${ESTADO_CFG[estado].label}`, uid:usuario.uid, nombre:usuario.nombre, ts:Timestamp.now() };
    await updateDoc(doc(db,"eventos",eventoSel.id),{
      estado, actualizadoEn:Timestamp.now(),
      historial:[...(eventoSel.historial||[]),entrada],
    });
    setEventoSel(p=>p?{...p,estado,historial:[...(p.historial||[]),entrada]}:null);
  }

  // ── Open create modal ─────────────────────────────────────────────
  function abrirModal(dia?: Date) {
    setEventoEditar(null);
    if (dia) {
      const f: FormEvento = {
        ...FORM_INICIAL,
        fechaInicioDate: `${dia.getFullYear()}-${String(dia.getMonth()+1).padStart(2,"0")}-${String(dia.getDate()).padStart(2,"0")}`,
        fechaFinDate:    `${dia.getFullYear()}-${String(dia.getMonth()+1).padStart(2,"0")}-${String(dia.getDate()).padStart(2,"0")}`,
        fechaInicioTime: dia.getHours()>0?`${String(dia.getHours()).padStart(2,"0")}:00`:"09:00",
        fechaFinTime:    dia.getHours()>0?`${String(dia.getHours()+1).padStart(2,"0")}:00`:"10:00",
      };
      setFormPrev(f);
    }
    setFechaModal(dia||null);
    setModalVisible(true);
  }

  const VISTAS: {k:Vista;label:string;short:string}[] = [
    {k:"mes",label:"Mes",short:"1"},{k:"semana",label:"Semana",short:"2"},
    {k:"dia",label:"Día",short:"3"},{k:"agenda",label:"Agenda",short:"4"},
    {k:"timeline",label:"Timeline",short:"5"},
  ];

  const tiposConEventos = useMemo(()=>{
    const set = new Set(eventos.map(e=>e.tipo));
    return (Object.keys(TIPO_CFG) as EventoTipo[]).filter(t=>set.has(t));
  },[eventos]);

  const hoy = new Date();
  const eventosHoy = eventosEnDia(eventosFiltrados,hoy).length;

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'Inter',system-ui,sans-serif",background:"#0b1220"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.6);}`}</style>

      {/* ══ LEFT SIDEBAR ══ */}
      <aside style={{width:220,flexShrink:0,borderRight:"1px solid #1f2937",display:"flex",flexDirection:"column",padding:"16px 0",overflowY:"auto",scrollbarWidth:"none"}}>

        {/* Nuevo evento */}
        <div style={{padding:"0 16px 16px"}}>
          <button onClick={()=>abrirModal()}
            style={{width:"100%",padding:"9px 0",background:"#3b82f6",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 14px rgba(59,130,246,0.35)"}}>
            <i className="fa-solid fa-plus" style={{fontSize:11}}/>Nuevo evento<span style={{opacity:0.6,fontSize:10,marginLeft:2}}>N</span>
          </button>
        </div>

        {/* Mini calendar */}
        <div style={{padding:"0 12px 16px",borderBottom:"1px solid #1f2937"}}>
          <MiniCalendar fecha={fecha} onChange={d=>{setFecha(d);if(vista==="mes"||vista==="agenda")setVista(vista);else setVista("dia");}} eventos={eventosFiltrados}/>
        </div>

        {/* Hoy */}
        <div style={{padding:"14px 16px",borderBottom:"1px solid #1f2937"}}>
          <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>Hoy</p>
          <p style={{margin:0,fontSize:12,color:"#64748b"}}>
            {eventosHoy>0?<span style={{color:"#f1f5f9"}}><span style={{color:"#3b82f6",fontWeight:700}}>{eventosHoy}</span> evento{eventosHoy!==1?"s":""}</span>:<span style={{color:"#374151"}}>Sin eventos</span>}
          </p>
        </div>

        {/* Filtros tipo */}
        {tiposConEventos.length>0&&(
          <div style={{padding:"14px 16px",borderBottom:"1px solid #1f2937"}}>
            <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tipo</p>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <button onClick={()=>setFiltroCat("todos")}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",border:"none",background:filtroCat==="todos"?"rgba(255,255,255,0.06)":"transparent",borderRadius:7,cursor:"pointer",fontFamily:"'Inter',sans-serif",color:filtroCat==="todos"?"#f1f5f9":"#64748b",fontSize:12,textAlign:"left"}}>
                <i className="fa-solid fa-calendar-days" style={{fontSize:11,color:filtroCat==="todos"?"#3b82f6":"#374151",width:14}}/>
                Todos
              </button>
              {tiposConEventos.map(t=>(
                <button key={t} onClick={()=>setFiltroCat(filtroCat===t?"todos":t)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",border:"none",background:filtroCat===t?TIPO_CFG[t].color+"18":"transparent",borderRadius:7,cursor:"pointer",fontFamily:"'Inter',sans-serif",color:filtroCat===t?TIPO_CFG[t].color:"#64748b",fontSize:12,textAlign:"left"}}>
                  <i className={`fa-solid ${TIPO_CFG[t].icon}`} style={{fontSize:11,color:TIPO_CFG[t].color,width:14}}/>
                  {TIPO_CFG[t].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Atajos */}
        <div style={{padding:"14px 16px",marginTop:"auto"}}>
          <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>Atajos</p>
          {[["N","Nuevo evento"],["T","Ir a hoy"],["J/K","Navegar"],["1-5","Cambiar vista"],["/","Buscar"],["Esc","Cerrar"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:"#374151",fontSize:11}}>{v}</span>
              <kbd style={{background:"rgba(255,255,255,0.06)",border:"1px solid #1f2937",borderRadius:4,padding:"1px 5px",color:"#64748b",fontSize:10}}>{k}</kbd>
            </div>
          ))}
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ── Header ── */}
        <header style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:"1px solid #1f2937",flexShrink:0}}>
          {/* Nav fecha */}
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>navFecha(-1)} style={{width:30,height:30,border:"1px solid #1f2937",borderRadius:8,background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:14}}>‹</button>
            <button onClick={()=>setFecha(new Date())} style={{padding:"0 12px",height:30,border:"1px solid #1f2937",borderRadius:8,background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>Hoy</button>
            <button onClick={()=>navFecha(1)} style={{width:30,height:30,border:"1px solid #1f2937",borderRadius:8,background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:14}}>›</button>
          </div>

          {/* Título */}
          <h1 style={{margin:0,fontSize:16,fontWeight:800,color:"#f1f5f9",flex:"0 1 auto",minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {tituloVista}
          </h1>

          {/* Spacer */}
          <div style={{flex:1}}/>

          {/* Búsqueda */}
          <div style={{position:"relative"}}>
            <i className="fa-solid fa-magnifying-glass" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:12}}/>
            <input ref={searchRef} value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar eventos…"
              style={{paddingLeft:30,paddingRight:12,height:32,background:"rgba(255,255,255,0.04)",border:"1px solid #1f2937",borderRadius:8,color:"#f1f5f9",fontSize:12,fontFamily:"'Inter',sans-serif",outline:"none",width:200}}
              onFocus={e=>(e.target.style.borderColor="#3b82f6")}
              onBlur={e=>(e.target.style.borderColor="#1f2937")}
            />
          </div>

          {/* Selector vista */}
          <div style={{display:"flex",border:"1px solid #1f2937",borderRadius:9,overflow:"hidden"}}>
            {VISTAS.map(v=>(
              <button key={v.k} onClick={()=>setVista(v.k)}
                style={{padding:"0 13px",height:32,border:"none",background:vista===v.k?"rgba(59,130,246,0.15)":"transparent",color:vista===v.k?"#60a5fa":"#64748b",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",borderRight:v.k!=="timeline"?"1px solid #1f2937":"none"}}>
                {v.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Calendar body ── */}
        <div style={{flex:1,display:"flex",minHeight:0}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
            {vista==="mes"&&(
              <MonthView
                fecha={fecha} eventos={eventosFiltrados}
                onDayClick={d=>{setFecha(d);setVista("dia");}}
                onEventClick={(ev,_)=>setEventoSel(ev)}
                onDayDblClick={d=>abrirModal(d)}
              />
            )}
            {vista==="semana"&&(
              <WeekView
                fecha={fecha} eventos={eventosFiltrados}
                onEventClick={(ev,_)=>setEventoSel(ev)}
                onSlotDblClick={d=>abrirModal(d)}
              />
            )}
            {vista==="dia"&&(
              <DayView
                fecha={fecha} eventos={eventosFiltrados}
                onEventClick={(ev,_)=>setEventoSel(ev)}
                onSlotDblClick={d=>abrirModal(d)}
              />
            )}
            {vista==="agenda"&&(
              <AgendaView
                fecha={fecha} eventos={eventosFiltrados}
                onEventClick={(ev,_)=>setEventoSel(ev)}
              />
            )}
            {vista==="timeline"&&(
              <TimelineView
                fecha={fecha} eventos={eventosFiltrados}
                onEventClick={(ev,_)=>setEventoSel(ev)}
              />
            )}
          </div>

          {/* ── Detail panel ── */}
          {eventoSel&&(
            <DetailPanel
              evento={eventoSel}
              onClose={()=>setEventoSel(null)}
              onEdit={()=>{setEventoEditar(eventoSel);setModalVisible(true);}}
              onDelete={eliminarEvento}
              onChangeEstado={cambiarEstado}
              usuario={usuario}
            />
          )}
        </div>
      </div>

      {/* ══ CREATE / EDIT MODAL ══ */}
      <CreateModal
        visible={modalVisible}
        eventoEditar={eventoEditar}
        onClose={()=>{setModalVisible(false);setEventoEditar(null);}}
        onSave={guardarEvento}
        conflictos={conflictos}
        usuario={usuario}
      />
    </div>
  );
}
