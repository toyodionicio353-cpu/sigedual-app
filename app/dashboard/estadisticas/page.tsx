"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ── Tipos ── */
interface DocBase { id:string; creadoEn?:{ seconds:number }; }
interface Estudiante extends DocBase { especialidad?:string; estado?:string; empresa?:string; }
interface Empresa    extends DocBase { rubro?:string; estado?:string; }
interface Visita     extends DocBase { estado?:string; }

/* ── Helpers ── */
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const NOW = new Date();

function contarPorMes(docs: DocBase[], mesesAtras = 6) {
  const result: number[] = Array(mesesAtras).fill(0);
  docs.forEach(d => {
    if (!d.creadoEn) return;
    const fecha = new Date(d.creadoEn.seconds * 1000);
    const diff = (NOW.getFullYear()*12+NOW.getMonth()) - (fecha.getFullYear()*12+fecha.getMonth());
    if (diff >= 0 && diff < mesesAtras) result[mesesAtras-1-diff]++;
  });
  return result;
}

function etiquetasMeses(n:number) {
  return Array.from({length:n},(_,i)=>{
    const d = new Date(NOW.getFullYear(), NOW.getMonth()-(n-1-i), 1);
    return MESES[d.getMonth()];
  });
}

/* ── Gráficos inline (SVG) ── */
function BarChart({ data, labels, color, height=120 }: { data:number[]; labels:string[]; color:string; height?:number }) {
  const max = Math.max(...data, 1);
  const w = 48;
  const gap = 8;
  const totalW = data.length*(w+gap);
  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${height+24}`} preserveAspectRatio="none">
      {data.map((v,i)=>{
        const barH = (v/max)*height;
        const x = i*(w+gap);
        return (
          <g key={i}>
            <rect x={x} y={height-barH} width={w} height={barH} rx={5} fill={color} fillOpacity={.85}/>
            <text x={x+w/2} y={height+16} textAnchor="middle" fill="#475569" fontSize="10" fontFamily="Inter,sans-serif">{labels[i]}</text>
            {v>0&&<text x={x+w/2} y={height-barH-4} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="Inter,sans-serif">{v}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments, size=120 }: { segments:{color:string;label:string;val:number}[]; size?:number }) {
  const total = segments.reduce((a,s)=>a+s.val,0)||1;
  const r = 44; const cx=size/2; const cy=size/2;
  let angle = -Math.PI/2;
  const slices = segments.map(s=>{
    const sweep = (s.val/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle+=sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    return {path:`M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`, color:s.color, label:s.label, val:s.val};
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill="#0f172a"/>
        {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} fillOpacity={.9}/>)}
        <circle cx={cx} cy={cy} r={28} fill="#111827"/>
        <text x={cx} y={cy+4} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700" fontFamily="Inter,sans-serif">{total}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {slices.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:10,height:10,borderRadius:3,background:s.color,display:"inline-block",flexShrink:0}}/>
            <span style={{color:"#94a3b8",fontSize:11}}>{s.label}</span>
            <span style={{color:"#f1f5f9",fontSize:11,fontWeight:700,marginLeft:"auto"}}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, labels, color, height=80 }: { data:number[]; labels:string[]; color:string; height?:number }) {
  const max = Math.max(...data, 1);
  const n = data.length;
  if(n<2) return null;
  const W=500, H=height;
  const pts = data.map((v,i)=>({ x: (i/(n-1))*W, y: H-(v/max)*H }));
  const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+20}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lg)"/>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#111827" strokeWidth="2"/>
          <text x={p.x} y={H+16} textAnchor="middle" fill="#475569" fontSize="10" fontFamily="Inter,sans-serif">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Página ── */
export default function EstadisticasPage() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [empresas,    setEmpresas]    = useState<Empresa[]>([]);
  const [visitas,     setVisitas]     = useState<Visita[]>([]);
  const [cargando,    setCargando]    = useState(true);

  useEffect(()=>{
    let done=0;
    const finish=()=>{ done++; if(done===3) setCargando(false); };
    const u1=onSnapshot(query(collection(db,"estudiantes")), s=>{ setEstudiantes(s.docs.map(d=>({id:d.id,...d.data()} as Estudiante))); finish(); }, finish);
    const u2=onSnapshot(query(collection(db,"empresas")),    s=>{ setEmpresas(s.docs.map(d=>({id:d.id,...d.data()} as Empresa)));    finish(); }, finish);
    const u3=onSnapshot(query(collection(db,"visitas")),     s=>{ setVisitas(s.docs.map(d=>({id:d.id,...d.data()} as Visita)));     finish(); }, finish);
    return ()=>{ u1(); u2(); u3(); };
  },[]);

  const n = 6;
  const labels = etiquetasMeses(n);
  const estPorMes = contarPorMes(estudiantes, n);
  const empPorMes = contarPorMes(empresas, n);
  const visPorMes = contarPorMes(visitas, n);

  const totalEst  = estudiantes.length;
  const totalEmp  = empresas.length;
  const totalVis  = visitas.length;
  const conEmpresa= estudiantes.filter(e=>e.empresa).length;

  const ESPECIALIDADES = ["Contabilidad","Mecánica","Atención de Párvulos","Enfermería","Agropecuaria"];
  const ESP_COLORS = ["#3b82f6","#f59e0b","#a78bfa","#f43f5e","#22c55e"];
  const segEsp = ESPECIALIDADES.map((esp,i)=>({
    color:ESP_COLORS[i], label:esp,
    val:estudiantes.filter(e=>e.especialidad===esp).length,
  })).filter(s=>s.val>0);

  const segVis = [
    {color:"#22c55e",label:"Realizadas",  val:visitas.filter(v=>v.estado==="realizada").length},
    {color:"#3b82f6",label:"Programadas", val:visitas.filter(v=>v.estado==="programada").length},
    {color:"#f59e0b",label:"Pendientes",  val:visitas.filter(v=>v.estado==="pendiente").length},
    {color:"#f43f5e",label:"Canceladas",  val:visitas.filter(v=>v.estado==="cancelada").length},
  ].filter(s=>s.val>0);

  const KPI_HEADER = [
    { label:"Estudiantes",  val:totalEst,  icon:"fa-user-graduate", color:"#3b82f6" },
    { label:"Empresas",     val:totalEmp,  icon:"fa-city",           color:"#a78bfa" },
    { label:"Visitas",      val:totalVis,  icon:"fa-route",          color:"#f59e0b" },
    { label:"Con empresa",  val:conEmpresa,icon:"fa-link",           color:"#22c55e" },
  ];

  return (
    <div style={{padding:"28px 36px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Encabezado */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
        <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <i className="fa-solid fa-chart-line" style={{color:"#fff",fontSize:18}}/>
        </div>
        <div>
          <h1 style={{color:"#f1f5f9",fontSize:26,fontWeight:800,margin:0}}>Estadísticas Generales</h1>
          <p style={{color:"#475569",fontSize:13,margin:0}}>Análisis completo del programa dual — datos en tiempo real.</p>
        </div>
        {cargando&&<span style={{marginLeft:"auto",color:"#475569",fontSize:12,display:"flex",alignItems:"center",gap:6}}><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Cargando…</span>}
      </div>

      {/* KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:14}}>
        {KPI_HEADER.map(k=>(
          <div key={k.label} style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,borderRadius:11,background:`${k.color}18`,border:`1px solid ${k.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <i className={`fa-solid ${k.icon}`} style={{color:k.color,fontSize:15}}/>
            </div>
            <div>
              <p style={{color:"#f1f5f9",fontSize:28,fontWeight:900,margin:0,lineHeight:1}}>{k.val}</p>
              <p style={{color:"#475569",fontSize:11,margin:"3px 0 0",textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bento charts */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>

        {/* Crecimiento estudiantes — ocupa 2 cols */}
        <div style={{gridColumn:"span 2",background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <i className="fa-solid fa-user-plus" style={{color:"#3b82f6",fontSize:13}}/>
            <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>Nuevos estudiantes por mes</span>
            <span style={{marginLeft:"auto",color:"#374151",fontSize:11}}>últimos 6 meses</span>
          </div>
          <BarChart data={estPorMes} labels={labels} color="#3b82f6"/>
        </div>

        {/* Distribución por especialidad — donut */}
        <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <i className="fa-solid fa-chart-pie" style={{color:"#a78bfa",fontSize:13}}/>
            <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>Por especialidad</span>
          </div>
          {segEsp.length>0
            ? <DonutChart segments={segEsp}/>
            : <p style={{color:"#374151",fontSize:12,textAlign:"center",paddingTop:30}}>Sin datos de especialidad.</p>
          }
        </div>

        {/* Visitas por mes — línea */}
        <div style={{gridColumn:"span 2",background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <i className="fa-solid fa-route" style={{color:"#f59e0b",fontSize:13}}/>
            <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>Visitas registradas por mes</span>
          </div>
          <LineChart data={visPorMes} labels={labels} color="#f59e0b"/>
        </div>

        {/* Estado de visitas — donut */}
        <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <i className="fa-solid fa-circle-half-stroke" style={{color:"#f59e0b",fontSize:13}}/>
            <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>Estado visitas</span>
          </div>
          {segVis.length>0
            ? <DonutChart segments={segVis}/>
            : <p style={{color:"#374151",fontSize:12,textAlign:"center",paddingTop:30}}>Sin visitas registradas.</p>
          }
        </div>

        {/* Empresas por mes — barras */}
        <div style={{gridColumn:"span 3",background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <i className="fa-solid fa-building-circle-arrow-right" style={{color:"#a78bfa",fontSize:13}}/>
            <span style={{color:"#f1f5f9",fontSize:14,fontWeight:700}}>Nuevas empresas incorporadas por mes</span>
            <span style={{marginLeft:"auto",color:"#374151",fontSize:11}}>últimos 6 meses</span>
          </div>
          <BarChart data={empPorMes} labels={labels} color="#a78bfa" height={80}/>
        </div>

        {/* Resumen final */}
        <div style={{gridColumn:"span 3",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[
            { label:"Ratio est./empresa", val:totalEmp>0?`${(totalEst/totalEmp).toFixed(1)}`:"-", desc:"estudiantes promedio por empresa", color:"#fb923c",icon:"fa-scale-balanced" },
            { label:"Tasa asignación",    val:totalEst>0?`${Math.round((conEmpresa/totalEst)*100)}%`:"-", desc:"estudiantes con empresa asignada", color:"#22c55e",icon:"fa-link" },
            { label:"Índice de visitas",  val:totalEst>0?`${(totalVis/totalEst).toFixed(1)}`:"-", desc:"visitas por estudiante", color:"#1fb2a6",icon:"fa-person-walking" },
          ].map(r=>(
            <div key={r.label} style={{background:"#111827",border:"1px solid #1f2937",borderRadius:14,padding:"20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:9,background:`${r.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className={`fa-solid ${r.icon}`} style={{color:r.color,fontSize:13}}/>
                </div>
                <span style={{color:"#475569",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{r.label}</span>
              </div>
              <p style={{color:"#f1f5f9",fontSize:30,fontWeight:900,margin:0,lineHeight:1}}>{r.val}</p>
              <p style={{color:"#374151",fontSize:11,margin:"8px 0 0"}}>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
