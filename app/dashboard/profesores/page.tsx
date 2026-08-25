"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

/* ─── tipos ─────────────────────────────────────────────────────────────── */
type Profesor = {
  id: string;
  codigoInterno: string;
  nombres: string;
  apellidos: string;
  run: string;
  especialidad: string;
  telefono: string;
  correo: string;
  correoPersonal: string;
  cargo: string;
  departamento: string;
  estado: string;
  tipoContrato: string;
  jornada: string;
  estudiantesAsignados: number;
  empresasAsignadas: number;
  visitasPendientes: number;
  evaluacionesPendientes: number;
  ultimaActividad: string;
  liceoId: string;
  creadoEn: string;
};

/* ─── demos ─────────────────────────────────────────────────────────────── */
const DEMO: Profesor[] = [
  { id:"p1", codigoInterno:"PRF-001", nombres:"Carlos Andrés", apellidos:"Martínez Rojas", run:"14.567.890-2", especialidad:"Contabilidad", telefono:"+56 9 8712 3456", correo:"c.martinez@liceo.cl", correoPersonal:"cmartinez@gmail.com", cargo:"Profesor Supervisor", departamento:"Contabilidad", estado:"activo", tipoContrato:"Planta", jornada:"Completa", estudiantesAsignados:8, empresasAsignadas:3, visitasPendientes:2, evaluacionesPendientes:1, ultimaActividad:"2024-06-10", liceoId:"", creadoEn:"2022-03-01" },
  { id:"p2", codigoInterno:"PRF-002", nombres:"Ana Belén", apellidos:"Torres Soto", run:"16.234.567-K", especialidad:"Enfermería", telefono:"+56 9 7623 4512", correo:"a.torres@liceo.cl", correoPersonal:"atorres@gmail.com", cargo:"Profesora Supervisora", departamento:"Salud", estado:"activo", tipoContrato:"Contrata", jornada:"Completa", estudiantesAsignados:5, empresasAsignadas:2, visitasPendientes:4, evaluacionesPendientes:3, ultimaActividad:"2024-06-08", liceoId:"", creadoEn:"2023-01-10" },
  { id:"p3", codigoInterno:"PRF-003", nombres:"Jorge Luis", apellidos:"Vega Fuentes", run:"12.345.678-9", especialidad:"Mecánica Automotriz", telefono:"+56 9 6512 7834", correo:"j.vega@liceo.cl", correoPersonal:"jvega@gmail.com", cargo:"Profesor Supervisor", departamento:"Mecánica", estado:"licencia", tipoContrato:"Planta", jornada:"Parcial", estudiantesAsignados:3, empresasAsignadas:1, visitasPendientes:0, evaluacionesPendientes:2, ultimaActividad:"2024-05-20", liceoId:"", creadoEn:"2021-08-15" },
  { id:"p4", codigoInterno:"PRF-004", nombres:"Patricia Soledad", apellidos:"Muñoz Vera", run:"17.891.234-5", especialidad:"Atención de Párvulos", telefono:"+56 9 9812 3456", correo:"p.munoz@liceo.cl", correoPersonal:"pmunoz@gmail.com", cargo:"Profesora Supervisora", departamento:"Ed. Parvularia", estado:"activo", tipoContrato:"Honorarios", jornada:"Completa", estudiantesAsignados:6, empresasAsignadas:2, visitasPendientes:1, evaluacionesPendientes:0, ultimaActividad:"2024-06-12", liceoId:"", creadoEn:"2023-06-01" },
];

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  activo:     { label: "Activo",     color: "#22c55e", bg: "rgba(34,197,94,.12)"   },
  inactivo:   { label: "Inactivo",   color: "#6b7280", bg: "rgba(107,114,128,.12)" },
  licencia:   { label: "Licencia",   color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  suspendido: { label: "Suspendido", color: "#ef4444", bg: "rgba(239,68,68,.12)"   },
};

/* ─── helpers ────────────────────────────────────────────────────────────── */
const SEL: React.CSSProperties = {
  background:"#0b1220", border:"1px solid #1f2937", borderRadius:9,
  padding:"0 14px", color:"#f1f5f9", fontSize:13, outline:"none",
  fontFamily:"'Inter',sans-serif", cursor:"pointer", height:42, boxSizing:"border-box",
};

function cargaColor(p: Profesor) {
  const total = p.estudiantesAsignados + p.empresasAsignadas + p.visitasPendientes;
  if (total >= 15) return { dot:"#ef4444", label:"Alta"  };
  if (total >= 7)  return { dot:"#f59e0b", label:"Media" };
  return              { dot:"#22c55e", label:"Baja"  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════════════════════ */
export default function ProfesoresPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [vista, setVista]           = useState<"tabla"|"tarjetas">("tabla");
  const [busqueda, setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado]   = useState("todos");
  const [filtroEsp, setFiltroEsp]         = useState("todos");
  const [pagina, setPagina]               = useState(1);
  const POR_PAGINA = 10;

  /* modales */
  const [modalEditar,  setModalEditar]  = useState(false);
  const [profEdit,     setProfEdit]     = useState<Profesor | null>(null);
  const [modalVisita,  setModalVisita]  = useState(false);
  const visVacia = { fecha:"", hora:"", profesor:"", empresa:"", estudiante:"", resultado:"Satisfactorio", observaciones:"" };
  const [formVis, setFormVis] = useState(visVacia);

  /* modal agregar */
  const [modalAgregar, setModalAgregar] = useState(false);
  const formNuevoVacio = { apellidos:"", nombres:"", run:"", correo:"", correoPersonal:"", telefono:"", especialidad:"", cargo:"Profesor Supervisor", departamento:"", tipoContrato:"Planta", jornada:"Completa", estado:"activo" };
  const [formNuevo, setFormNuevo] = useState(formNuevoVacio);
  const [guardando, setGuardando] = useState(false);

  /* carga Firestore */
  useEffect(() => {
    if (!usuario) return;
    const q = query(collection(db,"usuarios"),
      where("liceoId","==",usuario.liceoId),
      where("rol","==","profesor"));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d=>({ id:d.id, ...d.data() }) as Profesor);
      setProfesores(lista);
      setLoading(false);
    }, () => { setProfesores([]); setLoading(false); });
    return () => unsub();
  }, [usuario]);

  /* filtros */
  const especialidades = useMemo(() =>
    [...new Set(profesores.map(p=>p.especialidad).filter(Boolean))].sort(), [profesores]);

  const filtrados = useMemo(() => {
    const t = busqueda.toLowerCase();
    return profesores
      .filter(p => {
        const mb = !busqueda || `${p.apellidos} ${p.nombres} ${p.run} ${p.correo}`.toLowerCase().includes(t);
        const me = filtroEstado === "todos" || p.estado === filtroEstado;
        const mf = filtroEsp    === "todos" || p.especialidad === filtroEsp;
        return mb && me && mf;
      })
      .sort((a,b) => a.apellidos.localeCompare(b.apellidos,"es"));
  }, [profesores, busqueda, filtroEstado, filtroEsp]);

  const paginados = filtrados.slice((pagina-1)*POR_PAGINA, pagina*POR_PAGINA);
  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);

  /* KPIs */
  const kpis = [
    { icon:"fa-chalkboard-user", label:"Total Profesores",       value: profesores.length,                                    color:"#1fb2a6", bg:"rgba(31,178,166,.12)"  },
    { icon:"fa-circle-check",    label:"Activos",                 value: profesores.filter(p=>p.estado==="activo").length,     color:"#22c55e", bg:"rgba(34,197,94,.12)"   },
    { icon:"fa-location-dot",    label:"Visitas Pendientes",      value: profesores.reduce((s,p)=>s+p.visitasPendientes,0),    color:"#f59e0b", bg:"rgba(245,158,11,.12)"  },
    { icon:"fa-user-graduate",   label:"Estudiantes Supervisados",value: profesores.reduce((s,p)=>s+p.estudiantesAsignados,0), color:"#3b82f6", bg:"rgba(59,130,246,.12)"  },
    { icon:"fa-building",        label:"Empresas Asignadas",      value: profesores.reduce((s,p)=>s+p.empresasAsignadas,0),    color:"#a78bfa", bg:"rgba(167,139,250,.12)" },
    { icon:"fa-calendar-days",   label:"Visitas del Mes",         value: profesores.reduce((s,p)=>s+p.visitasPendientes,0),    color:"#34d399", bg:"rgba(52,211,153,.12)"  },
    { icon:"fa-file-pen",        label:"Evaluaciones Pendientes", value: profesores.reduce((s,p)=>s+p.evaluacionesPendientes,0),color:"#fb923c",bg:"rgba(251,146,60,.12)"  },
    { icon:"fa-gauge-high",      label:"Promedio de Carga",
      value: profesores.length > 0
        ? `${Math.round(profesores.reduce((s,p)=>s+p.estudiantesAsignados,0)/profesores.length)}`
        : "0",
      color:"#f472b6", bg:"rgba(244,114,182,.12)" },
  ];

  async function guardarNuevo() {
    if (!formNuevo.apellidos.trim() || !formNuevo.nombres.trim()) {
      alert("Apellidos y Nombres son obligatorios."); return;
    }
    setGuardando(true);
    try {
      await addDoc(collection(db,"usuarios"), {
        ...formNuevo,
        rol:"profesor",
        liceoId: usuario?.liceoId ?? "",
        estudiantesAsignados:0, empresasAsignadas:0,
        visitasPendientes:0, evaluacionesPendientes:0,
        ultimaActividad:"",
        codigoInterno:`PRF-${Date.now().toString().slice(-5)}`,
        creadoEn: serverTimestamp(),
      });
      setFormNuevo(formNuevoVacio);
      setModalAgregar(false);
    } catch { alert("Error al guardar. Intenta de nuevo."); }
    setGuardando(false);
  }

  async function eliminar(id: string, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!confirm("¿Eliminar este profesor del sistema?")) return;
    try { await deleteDoc(doc(db,"usuarios",id)); }
    catch { setProfesores(prev=>prev.filter(p=>p.id!==id)); }
  }

  async function guardarEditar() {
    if (!profEdit) return;
    try { await updateDoc(doc(db,"usuarios",profEdit.id), { ...profEdit }); }
    catch { setProfesores(prev=>prev.map(p=>p.id===profEdit.id?profEdit:p)); }
    setModalEditar(false);
    setProfEdit(null);
  }

  /* ── Excel profesional vía API ── */
  async function exportarExcel() {
    try {
      const res = await fetch("/api/profesores/exportar-excel", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ profesores: filtrados }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `profesores_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch { alert("No se pudo generar el Excel. Verifica tu conexión."); }
  }

  /* ── Reporte PDF / Imprimir ── */
  function generarReporte() {
    const fecha  = new Date().toLocaleDateString("es-CL",{ day:"2-digit", month:"long", year:"numeric" });
    const hora   = new Date().toLocaleTimeString("es-CL",{ hour:"2-digit", minute:"2-digit" });
    const activos = filtrados.filter(p=>p.estado==="activo").length;
    const totalEst = filtrados.reduce((s,p)=>s+p.estudiantesAsignados,0);
    const totalEmp = filtrados.reduce((s,p)=>s+p.empresasAsignadas,0);
    const totalVis = filtrados.reduce((s,p)=>s+p.visitasPendientes,0);
    const totalEval= filtrados.reduce((s,p)=>s+p.evaluacionesPendientes,0);

    const filas = filtrados.map((p,i)=>{
      const cfg = ESTADO_CFG[p.estado]??ESTADO_CFG.activo;
      const carga = cargaColor(p);
      const rowBg = i%2===0?"#ffffff":"#f8fafc";
      return `<tr style="background:${rowBg}">
        <td style="font-weight:700;color:#1fb2a6;font-size:9px">${p.codigoInterno}</td>
        <td><div style="font-weight:700;color:#0f172a;font-size:10.5px">${p.apellidos}</div><div style="color:#64748b;font-size:8.5px">${p.nombres}</div></td>
        <td style="font-family:monospace;font-size:9px;color:#334155">${p.run||"—"}</td>
        <td style="font-size:9px;color:#334155">${p.especialidad||"—"}</td>
        <td style="font-size:9px;color:#334155">${p.correo||"—"}</td>
        <td style="font-size:9px;color:#334155">${p.telefono||"—"}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:#3b82f6">${p.estudiantesAsignados}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:#a78bfa">${p.empresasAsignadas}</td>
        <td style="text-align:center;font-size:10px;font-weight:700;color:${p.visitasPendientes>0?"#f59e0b":"#22c55e"}">${p.visitasPendientes}</td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:700;color:${carga.dot}"><span style="width:7px;height:7px;border-radius:50%;background:${carga.dot};display:inline-block"></span>${carga.label}</span></td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8.5px;font-weight:700;background:${cfg.bg.replace("rgba","rgb").replace(",.12)",")")};color:${cfg.color}">${cfg.label}</span></td>
        <td style="font-size:8.5px;color:#64748b">${p.ultimaActividad||"—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>Profesores Supervisores — SIGEDUAL</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#0f172a}
      .hdr{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0b2a2a 100%);color:#fff;padding:28px 36px 22px;position:relative;overflow:hidden}
      .hdr::before{content:"";position:absolute;top:-50px;right:-50px;width:220px;height:220px;background:radial-gradient(circle,rgba(31,178,166,.18) 0%,transparent 70%);border-radius:50%}
      .hdr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
      .logo{display:flex;align-items:center;gap:12px}
      .logo-box{width:46px;height:46px;background:linear-gradient(135deg,#1fb2a6,#2563eb);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px}
      .logo h1{font-size:20px;font-weight:800}
      .logo p{font-size:10px;color:rgba(255,255,255,.50);margin-top:2px}
      .meta{text-align:right;font-size:9.5px;color:rgba(255,255,255,.55);line-height:1.8}
      .meta strong{color:#fff}
      .htitle{font-size:24px;font-weight:800;margin-bottom:4px}
      .hsub{font-size:11px;color:rgba(255,255,255,.55)}
      .kpi-bar{display:flex;background:#f8fafc;border-bottom:3px solid #1fb2a6}
      .kpi{flex:1;padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center}
      .kpi:last-child{border-right:none}
      .kv{font-size:22px;font-weight:800;line-height:1;margin-bottom:3px}
      .kl{font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
      .kv.t{color:#0d9488}.kv.g{color:#15803d}.kv.b{color:#2563eb}.kv.a{color:#d97706}.kv.v{color:#7c3aed}
      .stitle{padding:10px 36px 8px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0}
      .sdot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#1fb2a6,#2563eb);flex-shrink:0}
      .slabel{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
      .scount{margin-left:auto;font-size:9px;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:20px;font-weight:600}
      .tw{padding:0 36px 24px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      thead tr{background:linear-gradient(135deg,#0f172a,#1e3a5f)}
      th{padding:9px 11px;text-align:left;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
      th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}
      td{padding:8px 11px;vertical-align:middle;border-bottom:1px solid #e2e8f0}
      tbody tr:last-child td{border-bottom:none}
      .footer{background:#f1f5f9;border-top:2px solid #e2e8f0;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;font-size:8.5px;color:#94a3b8}
      .footer strong{color:#475569}
      @page{size:A4 landscape;margin:0}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="hdr">
      <div class="hdr-row">
        <div class="logo">
          <div class="logo-box">👨‍🏫</div>
          <div><h1>SIGEDUAL</h1><p>Sistema Integrado de Gestión Formación Dual</p></div>
        </div>
        <div class="meta">
          <div>Generado por <strong>SIGEDUAL</strong></div>
          <div>Fecha: <strong>${fecha}</strong></div>
          <div>Hora: <strong>${hora}</strong></div>
          <div>Documento <strong>Oficial</strong></div>
        </div>
      </div>
      <div class="htitle">Reporte · Profesores Supervisores</div>
      <div class="hsub">Listado completo de profesores supervisores del programa de formación dual</div>
    </div>
    <div class="kpi-bar">
      <div class="kpi"><div class="kv t">${filtrados.length}</div><div class="kl">Total profesores</div></div>
      <div class="kpi"><div class="kv g">${activos}</div><div class="kl">Activos</div></div>
      <div class="kpi"><div class="kv b">${totalEst}</div><div class="kl">Estudiantes supervisados</div></div>
      <div class="kpi"><div class="kv v">${totalEmp}</div><div class="kl">Empresas asignadas</div></div>
      <div class="kpi"><div class="kv a">${totalVis}</div><div class="kl">Visitas pendientes</div></div>
      <div class="kpi"><div class="kv" style="color:#ef4444">${totalEval}</div><div class="kl">Evaluaciones pend.</div></div>
    </div>
    <div class="stitle">
      <div class="sdot"></div>
      <span class="slabel">Detalle de profesores supervisores</span>
      <span class="scount">${filtrados.length} registros</span>
    </div>
    <div class="tw">
      <table>
        <thead><tr>
          <th>ID</th><th>Apellidos / Nombres</th><th>RUN</th><th>Especialidad</th>
          <th>Correo inst.</th><th>Teléfono</th><th>Estudiantes</th><th>Empresas</th>
          <th>Vis. Pend.</th><th>Carga</th><th>Estado</th><th>Últ. actividad</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div class="footer">
      <div>© ${new Date().getFullYear()} <strong>SIGEDUAL</strong> · Todos los derechos reservados</div>
      <div>Certificación Chile · Plataforma Educacional</div>
      <div>Reporte generado automáticamente · No requiere firma</div>
    </div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

    const v = window.open("","_blank","width=1200,height=800");
    if(!v) return;
    v.document.open(); v.document.write(html); v.document.close();
  }

  /* ── render ── */
  return (
    <div style={{ padding:"28px 32px", maxWidth:1500, fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh" }}>

      {/* CABECERA */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:46, height:46, borderRadius:13, background:"linear-gradient(135deg,#1fb2a6,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 6px 18px rgba(31,178,166,.30)" }}>
            <i className="fa-solid fa-chalkboard-user" style={{ color:"#fff", fontSize:19 }} />
          </div>
          <div>
            <h1 style={{ color:"#f1f5f9", fontSize:26, fontWeight:800, margin:0, lineHeight:1.1 }}>Profesores Supervisores</h1>
            <p style={{ color:"#475569", fontSize:13, margin:0 }}>Gestión y seguimiento de profesores supervisores de SIGEDUAL</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          {/* acciones secundarias */}
          <button onClick={()=>setModalVisita(true)}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.25)", borderRadius:9, color:"#f59e0b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background="rgba(245,158,11,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(245,158,11,.12)"}>
            <i className="fa-solid fa-calendar-plus" style={{ fontSize:12 }} />Programar Visita
          </button>
          <button onClick={generarReporte}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(99,102,241,.12)", border:"1px solid rgba(99,102,241,.25)", borderRadius:9, color:"#818cf8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background="rgba(99,102,241,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(99,102,241,.12)"}>
            <i className="fa-solid fa-file-chart-column" style={{ fontSize:12 }} />Generar Reporte
          </button>
          <button onClick={exportarExcel}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(34,197,94,.12)", border:"1px solid rgba(34,197,94,.25)", borderRadius:9, color:"#22c55e", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background="rgba(34,197,94,.22)"} onMouseOut={e=>e.currentTarget.style.background="rgba(34,197,94,.12)"}>
            <i className="fa-solid fa-file-excel" style={{ fontSize:12 }} />Exportar Excel
          </button>
          {/* separador */}
          <div style={{ width:1, height:32, background:"#1f2937" }} />
          {/* botón principal */}
          <button onClick={()=>setModalAgregar(true)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"linear-gradient(135deg,#1fb2a6,#2563eb)", border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}
            onMouseOver={e=>e.currentTarget.style.opacity="0.9"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <i className="fa-solid fa-plus" style={{ fontSize:12 }} />Agregar Profesor
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:24 }}>
        {kpis.slice(0,4).map(k=>(
          <div key={k.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"18px 20px", transition:"border-color .15s,transform .15s", cursor:"default" }}
            onMouseOver={e=>{ (e.currentTarget as HTMLDivElement).style.borderColor=k.color+"55"; (e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)"; }}
            onMouseOut={e=>{  (e.currentTarget as HTMLDivElement).style.borderColor="#1f2937";    (e.currentTarget as HTMLDivElement).style.transform="translateY(0)"; }}>
            <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color:k.color, fontSize:16 }} />
            </div>
            <p style={{ color:"#f1f5f9", fontSize:30, fontWeight:800, margin:"0 0 3px", lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280", fontSize:11, margin:0, fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:26 }}>
        {kpis.slice(4).map(k=>(
          <div key={k.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"18px 20px", transition:"border-color .15s,transform .15s", cursor:"default" }}
            onMouseOver={e=>{ (e.currentTarget as HTMLDivElement).style.borderColor=k.color+"55"; (e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)"; }}
            onMouseOut={e=>{  (e.currentTarget as HTMLDivElement).style.borderColor="#1f2937";    (e.currentTarget as HTMLDivElement).style.transform="translateY(0)"; }}>
            <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color:k.color, fontSize:16 }} />
            </div>
            <p style={{ color:"#f1f5f9", fontSize:30, fontWeight:800, margin:"0 0 3px", lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280", fontSize:11, margin:0, fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"16px 20px", marginBottom:18 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"0 14px", height:42 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color:"#475569", fontSize:13 }} />
            <input value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPagina(1);}} placeholder="Buscar por apellido, RUN, correo…"
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#f1f5f9", fontSize:13, fontFamily:"'Inter',sans-serif" }} />
            {busqueda && <button onClick={()=>setBusqueda("")} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",lineHeight:1 }}><i className="fa-solid fa-xmark" style={{fontSize:12}}/></button>}
          </div>
          <select value={filtroEstado} onChange={e=>{setFiltroEstado(e.target.value);setPagina(1);}} style={SEL}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="licencia">Licencia</option>
            <option value="suspendido">Suspendido</option>
          </select>
          <select value={filtroEsp} onChange={e=>{setFiltroEsp(e.target.value);setPagina(1);}} style={SEL}>
            <option value="todos">Toda especialidad</option>
            {especialidades.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <div style={{ display:"flex", gap:8 }}>
            {(["tabla","tarjetas"] as const).map(v=>(
              <button key={v} onClick={()=>setVista(v)}
                style={{ flex:1, height:42, borderRadius:9, border:"1px solid #1f2937", background:vista===v?"rgba(31,178,166,.15)":"#0b1220", color:vista===v?"#1fb2a6":"#475569", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif" }}>
                <i className={`fa-solid ${v==="tabla"?"fa-table-list":"fa-grip"}`} />
              </button>
            ))}
          </div>
          {(busqueda||filtroEstado!=="todos"||filtroEsp!=="todos") && (
            <button onClick={()=>{setBusqueda("");setFiltroEstado("todos");setFiltroEsp("todos");setPagina(1);}}
              style={{ height:42, padding:"0 14px", background:"none", border:"1px solid #1f2937", borderRadius:9, color:"#64748b", fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
              <i className="fa-solid fa-xmark" style={{marginRight:5,fontSize:11}}/>Limpiar
            </button>
          )}
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>
          Mostrando <strong style={{color:"#f1f5f9"}}>{filtrados.length}</strong> profesor{filtrados.length!==1?"es":""} · ordenados alfabéticamente
        </p>
      </div>

      {/* CONTENIDO */}
      {loading ? (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"56px", textAlign:"center" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ color:"#1fb2a6", fontSize:28, display:"block", marginBottom:14 }} />
          <p style={{ color:"#475569", fontSize:14, margin:0 }}>Cargando profesores…</p>
        </div>

      ) : filtrados.length === 0 ? (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"72px", textAlign:"center" }}>
          <i className="fa-solid fa-chalkboard-user" style={{ color:"#334155", fontSize:36, display:"block", marginBottom:16 }} />
          <p style={{ color:"#64748b", fontSize:15, fontWeight:600, margin:"0 0 6px" }}>No se encontraron profesores</p>
          <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>Agrega el primer Profesor Supervisor con el botón de abajo.</p>
          <button onClick={()=>setModalAgregar(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"linear-gradient(135deg,#1fb2a6,#2563eb)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
            <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Profesor
          </button>
        </div>

      ) : vista === "tabla" ? (
        /* ── VISTA TABLA ── */
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:980, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"rgba(255,255,255,.02)", borderBottom:"1px solid #1f2937" }}>
                {["Nº","Apellidos","Nombres","RUN","Especialidad","Correo","Estudiantes","Empresas","Vis. Pend.","Carga","Estado","Acciones"].map(h=>(
                  <th key={h} style={{ padding:"12px 14px", fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.4px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((p,idx)=>{
                const cfg   = ESTADO_CFG[p.estado] ?? ESTADO_CFG.activo;
                const carga = cargaColor(p);
                const rowBg = idx%2===0?"transparent":"rgba(255,255,255,.01)";
                return (
                  <tr key={p.id}
                    style={{ borderBottom:"1px solid #1f2937", background:rowBg, transition:"background .12s" }}>
                    {/* # */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:"50%", background:"rgba(31,178,166,.12)", color:"#1fb2a6", fontSize:11, fontWeight:700 }}>
                        {(pagina-1)*POR_PAGINA+idx+1}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50, color:"#f1f5f9", fontSize:14, fontWeight:700, whiteSpace:"nowrap" }}>{p.apellidos}</td>
                    <td style={{ padding:"0 14px", height:50, color:"#cbd5e1", fontSize:13, whiteSpace:"nowrap" }}>{p.nombres}</td>
                    <td style={{ padding:"0 14px", height:50, color:"#64748b", fontSize:12, fontFamily:"monospace", whiteSpace:"nowrap" }}>{p.run||"—"}</td>
                    <td style={{ padding:"0 14px", height:50, whiteSpace:"nowrap" }}>
                      <span style={{ background:"rgba(59,130,246,.12)", border:"1px solid rgba(59,130,246,.20)", color:"#60a5fa", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{p.especialidad||"—"}</span>
                    </td>
                    <td style={{ padding:"0 14px", height:50, color:"#64748b", fontSize:12, whiteSpace:"nowrap" }}>{p.correo||"—"}</td>
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color:"#3b82f6", fontSize:13, fontWeight:700 }}>
                        <i className="fa-solid fa-user-graduate" style={{fontSize:10}}/>{p.estudiantesAsignados}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color:"#a78bfa", fontSize:13, fontWeight:700 }}>
                        <i className="fa-solid fa-building" style={{fontSize:10}}/>{p.empresasAsignadas}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color: p.visitasPendientes>0?"#f59e0b":"#22c55e", fontSize:13, fontWeight:700 }}>
                        <i className="fa-solid fa-location-dot" style={{fontSize:10}}/>{p.visitasPendientes}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50 }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:carga.dot }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:carga.dot }}/>
                        {carga.label}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50 }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color:cfg.color, background:cfg.bg, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.color }}/>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding:"0 14px", height:50 }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:"inline-flex", gap:6 }}>
                        <button title="Ver ficha" onClick={()=>router.push(`/dashboard/profesores/${p.id}`)}
                          style={{ width:30, height:30, borderRadius:8, background:"rgba(31,178,166,.12)", border:"none", color:"#1fb2a6", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                          onMouseOver={e=>e.currentTarget.style.background="rgba(31,178,166,.24)"} onMouseOut={e=>e.currentTarget.style.background="rgba(31,178,166,.12)"}>
                          <i className="fa-solid fa-eye" style={{fontSize:12}}/>
                        </button>
                        <button title="Editar" onClick={ev=>{ev.stopPropagation();setProfEdit(p);setModalEditar(true);}}
                          style={{ width:30, height:30, borderRadius:8, background:"rgba(245,158,11,.12)", border:"none", color:"#f59e0b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                          onMouseOver={e=>e.currentTarget.style.background="rgba(245,158,11,.24)"} onMouseOut={e=>e.currentTarget.style.background="rgba(245,158,11,.12)"}>
                          <i className="fa-solid fa-pencil" style={{fontSize:12}}/>
                        </button>
                        <button title="Eliminar" onClick={ev=>eliminar(p.id,ev)}
                          style={{ width:30, height:30, borderRadius:8, background:"rgba(239,68,68,.12)", border:"none", color:"#ef4444", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
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

          </div>{/* fin scroll */}
          {/* paginación */}
          {totalPags > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderTop:"1px solid #1f2937" }}>
              <p style={{ color:"#475569", fontSize:12, margin:0 }}>Pág. {pagina} de {totalPags} · {filtrados.length} registros</p>
              <div style={{ display:"flex", gap:6 }}>
                {Array.from({length:totalPags},(_,i)=>i+1).map(n=>(
                  <button key={n} onClick={()=>setPagina(n)}
                    style={{ width:32, height:32, borderRadius:8, border:"1px solid #1f2937", background:pagina===n?"rgba(31,178,166,.20)":"#0b1220", color:pagina===n?"#1fb2a6":"#475569", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding:"12px 20px", borderTop:"1px solid #1f2937", display:"flex", justifyContent:"space-between" }}>
            <p style={{ color:"#475569", fontSize:12, margin:0 }}>{filtrados.length} profesor{filtrados.length!==1?"es":""}</p>
            <p style={{ color:"#334155", fontSize:11, margin:0 }}>Ordenado alfabéticamente por apellidos</p>
          </div>
        </div>

      ) : (
        /* ── VISTA TARJETAS ── */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {filtrados.map((p,idx)=>{
            const cfg   = ESTADO_CFG[p.estado] ?? ESTADO_CFG.activo;
            const carga = cargaColor(p);
            return (
              <div key={p.id}
                style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:16, padding:20, cursor:"pointer", transition:"border-color .15s,transform .15s" }}
                onMouseOver={ev=>{(ev.currentTarget as HTMLDivElement).style.borderColor="#1fb2a655";(ev.currentTarget as HTMLDivElement).style.transform="translateY(-3px)";}}
                onMouseOut={ev=>{(ev.currentTarget as HTMLDivElement).style.borderColor="#1f2937";(ev.currentTarget as HTMLDivElement).style.transform="translateY(0)";}}
                onClick={()=>router.push(`/dashboard/profesores/${p.id}`)}>
                {/* avatar + badge */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,#1fb2a6,#2563eb)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:700, color:"#fff" }}>
                      {p.apellidos.charAt(0)}{p.nombres.charAt(0)}
                    </div>
                    <div>
                      <p style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0, lineHeight:1.3 }}>{p.apellidos}</p>
                      <p style={{ color:"#94a3b8", fontSize:12, margin:0 }}>{p.nombres}</p>
                    </div>
                  </div>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:cfg.color, background:cfg.bg, borderRadius:20, padding:"3px 9px", fontSize:10, fontWeight:700 }}>
                    <span style={{ width:5,height:5,borderRadius:"50%",background:cfg.color }}/>{cfg.label}
                  </span>
                </div>
                {/* especialidad */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                  <span style={{ background:"rgba(59,130,246,.12)", border:"1px solid rgba(59,130,246,.20)", color:"#60a5fa", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{p.especialidad||"Sin especialidad"}</span>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700, color:carga.dot }}>
                    <span style={{ width:7,height:7,borderRadius:"50%",background:carga.dot }}/>Carga {carga.label}
                  </span>
                </div>
                {/* métricas */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
                  {[
                    { icon:"fa-user-graduate", val:p.estudiantesAsignados, label:"Est.",   color:"#3b82f6" },
                    { icon:"fa-building",       val:p.empresasAsignadas,   label:"Emp.",   color:"#a78bfa" },
                    { icon:"fa-location-dot",   val:p.visitasPendientes,   label:"Vis.",   color:p.visitasPendientes>0?"#f59e0b":"#22c55e" },
                  ].map(m=>(
                    <div key={m.label} style={{ background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
                      <i className={`fa-solid ${m.icon}`} style={{ color:m.color, fontSize:13, display:"block", marginBottom:4 }}/>
                      <p style={{ color:"#f1f5f9", fontSize:16, fontWeight:800, margin:0, lineHeight:1 }}>{m.val}</p>
                      <p style={{ color:"#475569", fontSize:9, margin:0, fontWeight:500 }}>{m.label}</p>
                    </div>
                  ))}
                </div>
                {/* RUN + acciones */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:12, borderTop:"1px solid #1f2937" }}>
                  <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace" }}>{p.run||"Sin RUN"}</span>
                  <div style={{ display:"flex", gap:6 }} onClick={e=>e.stopPropagation()}>
                    <button title="Editar" onClick={()=>{setProfEdit(p);setModalEditar(true);}}
                      style={{ width:28,height:28,borderRadius:7,background:"rgba(245,158,11,.12)",border:"none",color:"#f59e0b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <i className="fa-solid fa-pencil" style={{fontSize:11}}/>
                    </button>
                    <button title="Eliminar" onClick={ev=>eliminar(p.id,ev)}
                      style={{ width:28,height:28,borderRadius:7,background:"rgba(239,68,68,.12)",border:"none",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <i className="fa-solid fa-trash" style={{fontSize:11}}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL AGREGAR PROFESOR ══ */}
      {modalAgregar && (
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalAgregar(false); }}>
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.70)",backdropFilter:"blur(4px)" }} data-backdrop="1"/>
          <div style={{ position:"relative",width:"100%",maxWidth:680,background:"#111827",border:"1px solid #1f2937",borderRadius:18,boxShadow:"0 32px 80px rgba(0,0,0,.60)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"92vh" }}>
            {/* header */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"rgba(31,178,166,.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <i className="fa-solid fa-chalkboard-user" style={{ color:"#1fb2a6",fontSize:14 }}/>
                </div>
                <p style={{ color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0 }}>Agregar Profesor Supervisor</p>
              </div>
              <button onClick={()=>setModalAgregar(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{fontSize:13}}/>
              </button>
            </div>
            {/* body */}
            <div style={{ overflowY:"auto",flex:1,padding:24 }}>
              {/* datos personales */}
              <p style={{ color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6 }}>
                <i className="fa-solid fa-user" style={{color:"#1fb2a6",fontSize:11}}/> Datos personales
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20 }}>
                {([
                  ["apellidos","Apellidos *","text"],["nombres","Nombres *","text"],
                  ["run","RUN","text"],["telefono","Teléfono","tel"],
                  ["correo","Correo institucional","email"],["correoPersonal","Correo personal","email"],
                ] as [keyof typeof formNuevo,string,string][]).map(([k,lbl,type])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input type={type} value={formNuevo[k]} onChange={e=>setFormNuevo(p=>({...p,[k]:e.target.value}))}
                      style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box" }}
                      onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
              </div>
              {/* datos laborales */}
              <p style={{ color:"#475569",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6 }}>
                <i className="fa-solid fa-briefcase" style={{color:"#1fb2a6",fontSize:11}}/> Información laboral
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Especialidad</p>
                  <input value={formNuevo.especialidad} onChange={e=>setFormNuevo(p=>({...p,especialidad:e.target.value}))}
                    placeholder="Ej: Contabilidad, Enfermería…"
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box" }}
                    onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Cargo</p>
                  <select value={formNuevo.cargo} onChange={e=>setFormNuevo(p=>({...p,cargo:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option>Profesor Supervisor</option><option>Profesora Supervisora</option>
                    <option>Coordinador Dual</option><option>Jefe de Especialidad</option>
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Departamento</p>
                  <input value={formNuevo.departamento} onChange={e=>setFormNuevo(p=>({...p,departamento:e.target.value}))}
                    placeholder="Ej: Contabilidad, Salud…"
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box" }}
                    onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Tipo de contrato</p>
                  <select value={formNuevo.tipoContrato} onChange={e=>setFormNuevo(p=>({...p,tipoContrato:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option>Planta</option><option>Contrata</option><option>Honorarios</option>
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Jornada</p>
                  <select value={formNuevo.jornada} onChange={e=>setFormNuevo(p=>({...p,jornada:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option>Completa</option><option>Parcial</option>
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 5px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Estado</p>
                  <select value={formNuevo.estado} onChange={e=>setFormNuevo(p=>({...p,estado:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                    <option value="licencia">Licencia</option><option value="suspendido">Suspendido</option>
                  </select>
                </div>
              </div>
            </div>
            {/* footer */}
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10,padding:"16px 24px",borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>{ setModalAgregar(false); setFormNuevo(formNuevoVacio); }}
                style={{ padding:"10px 20px",background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
                Cancelar
              </button>
              <button onClick={guardarNuevo} disabled={guardando}
                style={{ padding:"10px 24px",background:guardando?"#334155":"linear-gradient(135deg,#1fb2a6,#2563eb)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:guardando?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
                {guardando
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{fontSize:11}}/>Guardando…</>
                  : <><i className="fa-solid fa-floppy-disk" style={{fontSize:11}}/>Guardar profesor</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL PROGRAMAR VISITA ══ */}
      {modalVisita && (
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalVisita(false); }}>
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.70)",backdropFilter:"blur(4px)" }} data-backdrop="1"/>
          <div style={{ position:"relative",width:"100%",maxWidth:600,background:"#111827",border:"1px solid #1f2937",borderRadius:18,boxShadow:"0 32px 80px rgba(0,0,0,.60)",overflow:"hidden",display:"flex",flexDirection:"column" }}>
            {/* header */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"rgba(245,158,11,.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <i className="fa-solid fa-calendar-plus" style={{ color:"#f59e0b",fontSize:14 }}/>
                </div>
                <p style={{ color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0 }}>Programar visita</p>
              </div>
              <button onClick={()=>setModalVisita(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{fontSize:13}}/>
              </button>
            </div>
            {/* body */}
            <div style={{ padding:24 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {([
                  ["fecha","Fecha *","date"],
                  ["hora","Hora *","time"],
                  ["empresa","Empresa *","text"],
                  ["estudiante","Estudiante","text"],
                ] as [keyof typeof visVacia, string, string][]).map(([k,lbl,type])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input type={type} value={formVis[k]} onChange={e=>setFormVis(p=>({...p,[k]:e.target.value}))}
                      style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box" }}
                      onFocus={e=>e.currentTarget.style.borderColor="#f59e0b"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Profesor</p>
                  <select value={formVis.profesor} onChange={e=>setFormVis(p=>({...p,profesor:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option value="">— Seleccionar profesor —</option>
                    {profesores.filter(p=>p.estado==="activo").map(p=>(
                      <option key={p.id} value={p.id}>{p.apellidos} {p.nombres}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Resultado esperado</p>
                  <select value={formVis.resultado} onChange={e=>setFormVis(p=>({...p,resultado:e.target.value}))}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option>Satisfactorio</option><option>Con observaciones</option><option>Insatisfactorio</option>
                  </select>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Observaciones</p>
                  <textarea value={formVis.observaciones} onChange={e=>setFormVis(p=>({...p,observaciones:e.target.value}))} rows={3}
                    placeholder="Notas previas a la visita…"
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",resize:"vertical",boxSizing:"border-box" }}
                    onFocus={e=>e.currentTarget.style.borderColor="#f59e0b"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                </div>
              </div>
            </div>
            {/* footer */}
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10,padding:"16px 24px",borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>setModalVisita(false)} style={{ padding:"10px 20px",background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>Cancelar</button>
              <button onClick={()=>{
                if(!formVis.fecha||!formVis.empresa){ alert("Fecha y Empresa son obligatorios."); return; }
                alert(`Visita programada para el ${formVis.fecha} a las ${formVis.hora} en ${formVis.empresa}.`);
                setFormVis(visVacia); setModalVisita(false);
              }} style={{ padding:"10px 24px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
                <i className="fa-solid fa-calendar-check" style={{ marginRight:7,fontSize:12 }}/>Programar visita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDICIÓN RÁPIDA ══ */}
      {modalEditar && profEdit && (
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalEditar(false); }}>
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.70)",backdropFilter:"blur(4px)" }} data-backdrop="1"/>
          <div style={{ position:"relative",width:"100%",maxWidth:620,background:"#111827",border:"1px solid #1f2937",borderRadius:18,boxShadow:"0 32px 80px rgba(0,0,0,.60)",overflow:"hidden",maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"rgba(245,158,11,.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <i className="fa-solid fa-pencil" style={{ color:"#f59e0b",fontSize:14 }}/>
                </div>
                <p style={{ color:"#f1f5f9",fontSize:15,fontWeight:700,margin:0 }}>Editar profesor</p>
              </div>
              <button onClick={()=>setModalEditar(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid #1f2937",color:"#475569",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{fontSize:13}}/>
              </button>
            </div>
            <div style={{ overflowY:"auto",flex:1,padding:24 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                {([
                  ["apellidos","Apellidos"],["nombres","Nombres"],["run","RUN"],
                  ["especialidad","Especialidad"],["cargo","Cargo"],["departamento","Departamento"],
                  ["telefono","Teléfono"],["correo","Correo institucional"],
                ] as [keyof Profesor,string][]).map(([k,lbl])=>(
                  <div key={k}>
                    <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>{lbl}</p>
                    <input value={String(profEdit[k]??"")} onChange={e=>setProfEdit(prev=>prev?({...prev,[k]:e.target.value}):prev)}
                      style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box" }}
                      onFocus={e=>e.currentTarget.style.borderColor="#1fb2a6"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}/>
                  </div>
                ))}
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Estado</p>
                  <select value={profEdit.estado} onChange={e=>setProfEdit(p=>p?({...p,estado:e.target.value}):p)}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                    <option value="licencia">Licencia</option><option value="suspendido">Suspendido</option>
                  </select>
                </div>
                <div>
                  <p style={{ color:"#64748b",fontSize:11,fontWeight:600,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.4px" }}>Tipo contrato</p>
                  <select value={profEdit.tipoContrato} onChange={e=>setProfEdit(p=>p?({...p,tipoContrato:e.target.value}):p)}
                    style={{ width:"100%",background:"#0b1220",border:"1px solid #1f2937",borderRadius:9,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",cursor:"pointer",boxSizing:"border-box" }}>
                    <option>Planta</option><option>Contrata</option><option>Honorarios</option>
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
