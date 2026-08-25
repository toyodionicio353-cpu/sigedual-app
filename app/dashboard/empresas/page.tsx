"use client";
import { useEffect, useState, useMemo } from "react";
import { collection, query, where, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type Empresa = {
  id: string;
  codigoInterno: string;
  nombreComercial: string;
  razonSocial: string;
  rut: string;
  rubro: string;
  tipoEmpresa: string;
  estado: string;
  maestroGuia: string;
  especialidades: string[];
  cuposTotales: number;
  cuposOcupados: number;
  estudiantesActuales: number;
  convenioEstado: string;
  convenioVencimiento: string;
  ultimaVisita: string;
  proximaVisita: string;
  region: string;
  liceoId: string;
  creadoEn: string;
};

const ESTADO_COLOR: Record<string, string> = {
  activa: "#22c55e", inactiva: "#6b7280", suspendida: "#f59e0b", "en-revision": "#3b82f6",
};
const CONVENIO_COLOR: Record<string, string> = {
  vigente: "#22c55e", "proximo-vencer": "#f59e0b", vencido: "#ef4444", suspendido: "#6b7280",
};
const TIPO_COLOR: Record<string, string> = {
  "Gran Empresa": "#a78bfa", "Mediana Empresa": "#60a5fa", "Pequeña Empresa": "#34d399", "Microempresa": "#fbbf24",
};

const EMPRESAS_DEMO: Empresa[] = [
  { id:"emp1", codigoInterno:"EMP-001", nombreComercial:"Sodimac S.A.", razonSocial:"Sodimac S.A.", rut:"81.201.000-3", rubro:"Retail / Construcción", tipoEmpresa:"Gran Empresa", estado:"activa", maestroGuia:"Carlos Muñoz", especialidades:["Contabilidad","Administración"], cuposTotales:8, cuposOcupados:6, estudiantesActuales:6, convenioEstado:"vigente", convenioVencimiento:"2025-12-31", ultimaVisita:"2024-05-10", proximaVisita:"2024-07-15", region:"Metropolitana", liceoId:"", creadoEn:"2023-03-01" },
  { id:"emp2", codigoInterno:"EMP-002", nombreComercial:"Clínica Los Andes", razonSocial:"Clínica Los Andes SpA", rut:"96.512.310-5", rubro:"Salud", tipoEmpresa:"Mediana Empresa", estado:"activa", maestroGuia:"Ana Torres", especialidades:["Enfermería","Atención de Párvulos"], cuposTotales:6, cuposOcupados:4, estudiantesActuales:4, convenioEstado:"proximo-vencer", convenioVencimiento:"2024-08-30", ultimaVisita:"2024-04-22", proximaVisita:"2024-06-28", region:"Metropolitana", liceoId:"", creadoEn:"2023-01-15" },
  { id:"emp3", codigoInterno:"EMP-003", nombreComercial:"Taller Mecánico Pérez", razonSocial:"Pérez y Asociados Ltda.", rut:"78.912.441-2", rubro:"Mecánica Automotriz", tipoEmpresa:"Pequeña Empresa", estado:"activa", maestroGuia:"Mario Pérez", especialidades:["Mecánica"], cuposTotales:4, cuposOcupados:4, estudiantesActuales:4, convenioEstado:"vigente", convenioVencimiento:"2025-06-30", ultimaVisita:"2024-05-05", proximaVisita:"2024-07-01", region:"Valparaíso", liceoId:"", creadoEn:"2023-06-10" },
  { id:"emp4", codigoInterno:"EMP-004", nombreComercial:"Agrícola San Pedro", razonSocial:"Agrícola San Pedro S.A.", rut:"93.411.220-8", rubro:"Agricultura", tipoEmpresa:"Mediana Empresa", estado:"inactiva", maestroGuia:"—", especialidades:["Agropecuaria"], cuposTotales:5, cuposOcupados:0, estudiantesActuales:0, convenioEstado:"vencido", convenioVencimiento:"2024-01-31", ultimaVisita:"2023-11-10", proximaVisita:"—", region:"O'Higgins", liceoId:"", creadoEn:"2022-08-20" },
  { id:"emp5", codigoInterno:"EMP-005", nombreComercial:"Jardín Mis Primeros Pasos", razonSocial:"Jardín Infantil Mis Primeros Pasos Ltda.", rut:"77.331.009-1", rubro:"Educación Inicial", tipoEmpresa:"Microempresa", estado:"activa", maestroGuia:"Patricia Vega", especialidades:["Atención de Párvulos"], cuposTotales:3, cuposOcupados:2, estudiantesActuales:2, convenioEstado:"vigente", convenioVencimiento:"2025-03-31", ultimaVisita:"2024-05-18", proximaVisita:"2024-07-20", region:"Biobío", liceoId:"", creadoEn:"2023-09-05" },
];

const RUBROS = ["Todos","Retail / Construcción","Salud","Mecánica Automotriz","Agricultura","Educación Inicial","Tecnología","Logística","Gastronomía"];
const ESTADOS = ["todos","activa","inactiva","suspendida","en-revision"];
const CONVENIOS = ["todos","vigente","proximo-vencer","vencido","suspendido"];

const EMPTY_FORM = (e: Empresa) => ({
  nombreComercial: e.nombreComercial, razonSocial: e.razonSocial,
  rut: e.rut, rubro: e.rubro, tipoEmpresa: e.tipoEmpresa,
  estado: e.estado, maestroGuia: e.maestroGuia,
  cuposTotales: e.cuposTotales, region: e.region,
  convenioEstado: e.convenioEstado, convenioVencimiento: e.convenioVencimiento,
  proximaVisita: e.proximaVisita,
});

export default function EmpresasPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  // carga en tiempo real desde Firestore
  useEffect(() => {
    if (!usuario) return;
    setLoading(true);
    const q = ["administrador","coordinador","director","profesor"].includes(usuario.rol)
      ? query(collection(db,"empresas"), where("liceoId","==",usuario.liceoId))
      : query(collection(db,"empresas"));
    const unsub = onSnapshot(q, snap => {
      setEmpresas(snap.docs.map(d => ({ id:d.id, ...d.data() }) as Empresa));
      setLoading(false);
    }, () => {
      setEmpresas([]);
      setLoading(false);
    });
    return () => unsub();
  }, [usuario]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroConvenio, setFiltroConvenio] = useState("todos");
  const [filtroRubro, setFiltroRubro] = useState("Todos");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroRegion, setFiltroRegion] = useState("Todas");
  const [filtroEsp, setFiltroEsp] = useState("Todas");
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const porPagina = 10;

  // ── Modal editar ──
  const [modalEditar, setModalEditar] = useState(false);
  const [empresaEditId, setEmpresaEditId] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState<ReturnType<typeof EMPTY_FORM> | null>(null);

  function abrirEditar(e: Empresa, ev: React.MouseEvent) {
    ev.stopPropagation();
    setEmpresaEditId(e.id);
    setFormEdit(EMPTY_FORM(e));
    setModalEditar(true);
  }

  async function guardarEditar() {
    if (!formEdit || !empresaEditId) return;
    try {
      await updateDoc(doc(db, "empresas", empresaEditId), { ...formEdit });
    } catch {
      // si es un doc demo (no existe en Firestore), solo actualizamos local
      setEmpresas(prev => prev.map(e =>
        e.id === empresaEditId ? { ...e, ...formEdit } : e
      ));
    }
    setModalEditar(false);
    setEmpresaEditId(null);
    setFormEdit(null);
  }

  async function eliminarEmpresa(id: string, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!confirm("¿Eliminar esta empresa del sistema? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, "empresas", id));
    } catch {
      // doc demo → solo eliminar local
      setEmpresas(prev => prev.filter(e => e.id !== id));
    }
  }

  // ── Exportar Excel (.xlsx con estilos) ──
  async function exportarExcel() {
    try {
      const res = await fetch("/api/empresas/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresas: filtradas }),
      });
      if (!res.ok) throw new Error("Error generando Excel");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `empresas_duales_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo generar el archivo Excel. Intenta de nuevo.");
      console.error(err);
    }
  }

  // ── Exportar PDF / Imprimir ──
  function imprimirTabla() {
    const fecha = new Date().toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" });
    const hora  = new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" });

    const filas = filtradas.map((e, i) => {
      const estadoColor = e.estado==="activa"?"#15803d":e.estado==="inactiva"?"#475569":e.estado==="suspendida"?"#a16207":"#1d4ed8";
      const estadoBg    = e.estado==="activa"?"#dcfce7":e.estado==="inactiva"?"#f1f5f9":e.estado==="suspendida"?"#fef9c3":"#dbeafe";
      const convColor   = e.convenioEstado==="vigente"?"#15803d":e.convenioEstado==="vencido"?"#b91c1c":e.convenioEstado==="proximo-vencer"?"#a16207":"#475569";
      const convBg      = e.convenioEstado==="vigente"?"#dcfce7":e.convenioEstado==="vencido"?"#fee2e2":e.convenioEstado==="proximo-vencer"?"#fef9c3":"#f1f5f9";
      const pct         = e.cuposTotales > 0 ? Math.round((e.cuposOcupados/e.cuposTotales)*100) : 0;
      const barColor    = pct>=90?"#ef4444":pct>=70?"#f59e0b":"#22c55e";
      const rowBg       = i%2===0?"#ffffff":"#f8fafc";
      return `
        <tr style="background:${rowBg}">
          <td style="font-weight:700;color:#1e293b;font-size:9.5px">${e.codigoInterno}</td>
          <td>
            <div style="font-weight:700;color:#0f172a;font-size:10.5px;line-height:1.3">${e.nombreComercial}</div>
            <div style="color:#64748b;font-size:8.5px;margin-top:2px">${e.razonSocial}</div>
          </td>
          <td style="color:#334155;font-size:9.5px;font-family:monospace">${e.rut}</td>
          <td style="color:#334155;font-size:9.5px">${e.rubro}</td>
          <td style="color:#334155;font-size:9.5px">${e.maestroGuia||"—"}</td>
          <td style="color:#334155;font-size:9px;max-width:120px">${e.especialidades.join(", ")||"—"}</td>
          <td>
            <div style="display:flex;align-items:center;gap:5px">
              <div style="flex:1;height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;min-width:40px">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px"></div>
              </div>
              <span style="font-size:8.5px;color:#334155;font-weight:700;white-space:nowrap">${e.cuposOcupados}/${e.cuposTotales}</span>
            </div>
          </td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8.5px;font-weight:700;background:${estadoBg};color:${estadoColor};text-transform:capitalize">${e.estado}</span></td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8.5px;font-weight:700;background:${convBg};color:${convColor}">${e.convenioEstado==="proximo-vencer"?"Próx. vencer":e.convenioEstado}</span></td>
          <td style="color:#334155;font-size:9px">${e.ultimaVisita||"—"}</td>
          <td style="color:#334155;font-size:9px">${e.proximaVisita||"—"}</td>
          <td style="color:#334155;font-size:9px">${e.region}</td>
        </tr>`;
    }).join("");

    const totalActivas   = filtradas.filter(e=>e.estado==="activa").length;
    const totalConvenios = filtradas.filter(e=>e.convenioEstado==="vigente").length;
    const totalCupos     = filtradas.reduce((s,e)=>s+e.cuposTotales,0);
    const totalOcupados  = filtradas.reduce((s,e)=>s+e.cuposOcupados,0);
    const tasaOcup       = totalCupos>0?Math.round((totalOcupados/totalCupos)*100):0;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Empresas Duales — SIGEDUAL</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;font-size:11px;color:#0f172a;background:#fff}
    .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0d4f4a 100%);color:#fff;padding:28px 36px 24px;position:relative;overflow:hidden}
    .header::before{content:"";position:absolute;top:-50px;right:-50px;width:220px;height:220px;background:radial-gradient(circle,rgba(31,178,166,.20) 0%,transparent 70%);border-radius:50%}
    .header::after{content:"";position:absolute;bottom:-40px;left:35%;width:180px;height:180px;background:radial-gradient(circle,rgba(37,99,235,.15) 0%,transparent 70%);border-radius:50%}
    .hrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
    .logo{display:flex;align-items:center;gap:12px}
    .logo-box{width:46px;height:46px;background:linear-gradient(135deg,#1fb2a6,#2563eb);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 8px 20px rgba(31,178,166,.35)}
    .logo h1{font-size:21px;font-weight:800;letter-spacing:-.5px}
    .logo p{font-size:10px;color:rgba(255,255,255,.50);margin-top:2px}
    .meta{text-align:right;font-size:9.5px;color:rgba(255,255,255,.55);line-height:1.8}
    .meta strong{color:#fff}
    .htitle{font-size:26px;font-weight:800;letter-spacing:-.5px;margin-bottom:4px}
    .hsub{font-size:12px;color:rgba(255,255,255,.55)}
    .kpi-bar{display:flex;background:#f8fafc;border-bottom:3px solid #1fb2a6}
    .kpi{flex:1;padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center}
    .kpi:last-child{border-right:none}
    .kv{font-size:24px;font-weight:800;color:#0f172a;line-height:1;margin-bottom:3px}
    .kl{font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
    .kv.t{color:#0d9488}.kv.b{color:#2563eb}.kv.g{color:#15803d}.kv.a{color:#d97706}
    .stitle{padding:12px 36px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0}
    .sdot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#1fb2a6,#2563eb);flex-shrink:0}
    .slabel{font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.6px}
    .scount{margin-left:auto;font-size:9px;color:#64748b;background:#f1f5f9;padding:2px 9px;border-radius:20px;font-weight:600}
    .tw{padding:0 36px 28px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    thead tr{background:linear-gradient(135deg,#0f172a,#1e3a5f)}
    th{padding:9px 11px;text-align:left;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
    th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}
    td{padding:8px 11px;vertical-align:middle;border-bottom:1px solid #e2e8f0;color:#334155}
    tbody tr:last-child td{border-bottom:none}
    .footer{background:#f1f5f9;border-top:2px solid #e2e8f0;padding:12px 36px;display:flex;align-items:center;justify-content:space-between;font-size:8.5px;color:#94a3b8}
    .footer strong{color:#475569}
    @page{size:A4 landscape;margin:0}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
  <div class="header">
    <div class="hrow">
      <div class="logo">
        <div class="logo-box">🏢</div>
        <div><h1>SIGEDUAL</h1><p>Sistema Integrado de Gestión Formación Dual</p></div>
      </div>
      <div class="meta">
        <div>Generado por <strong>SIGEDUAL</strong></div>
        <div>Fecha: <strong>${fecha}</strong></div>
        <div>Hora: <strong>${hora}</strong></div>
        <div>Documento <strong>Oficial</strong></div>
      </div>
    </div>
    <div class="htitle">Reporte · Empresas Duales</div>
    <div class="hsub">Listado completo de empresas vinculadas al programa de formación dual</div>
  </div>

  <div class="kpi-bar">
    <div class="kpi"><div class="kv t">${filtradas.length}</div><div class="kl">Total empresas</div></div>
    <div class="kpi"><div class="kv g">${totalActivas}</div><div class="kl">Activas</div></div>
    <div class="kpi"><div class="kv b">${totalConvenios}</div><div class="kl">Conv. vigentes</div></div>
    <div class="kpi"><div class="kv">${totalCupos}</div><div class="kl">Cupos totales</div></div>
    <div class="kpi"><div class="kv">${totalOcupados}</div><div class="kl">Cupos ocupados</div></div>
    <div class="kpi"><div class="kv a">${tasaOcup}%</div><div class="kl">Tasa ocupación</div></div>
  </div>

  <div class="stitle">
    <div class="sdot"></div>
    <span class="slabel">Detalle de empresas</span>
    <span class="scount">${filtradas.length} registros</span>
  </div>

  <div class="tw">
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Empresa</th><th>RUT</th><th>Rubro</th>
          <th>Maestro guía</th><th>Especialidades</th><th style="min-width:80px">Cupos</th>
          <th>Estado</th><th>Convenio</th><th>Últ. visita</th><th>Próx. visita</th><th>Región</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </div>

  <div class="footer">
    <div>© ${new Date().getFullYear()} <strong>SIGEDUAL</strong> · Todos los derechos reservados</div>
    <div>Certificación Chile · Plataforma Educacional</div>
    <div>Reporte generado automáticamente · No requiere firma</div>
  </div>

  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=1200,height=800");
    if (!ventana) return;
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  const filtradas = useMemo(() => {
    return empresas.filter(e => {
      const texto = busqueda.toLowerCase();
      const matchBusqueda = !busqueda ||
        e.nombreComercial.toLowerCase().includes(texto) ||
        e.razonSocial.toLowerCase().includes(texto) ||
        e.rut.toLowerCase().includes(texto) ||
        e.rubro.toLowerCase().includes(texto) ||
        e.codigoInterno.toLowerCase().includes(texto);
      const matchEstado = filtroEstado === "todos" || e.estado === filtroEstado;
      const matchConvenio = filtroConvenio === "todos" || e.convenioEstado === filtroConvenio;
      const matchRubro   = filtroRubro   === "Todos"  || e.rubro       === filtroRubro;
      const matchTipo    = filtroTipo    === "Todos"  || e.tipoEmpresa === filtroTipo;
      const matchRegion  = filtroRegion  === "Todas"  || e.region      === filtroRegion;
      const matchEsp     = filtroEsp     === "Todas"  || (Array.isArray(e.especialidades) && e.especialidades.includes(filtroEsp));
      return matchBusqueda && matchEstado && matchConvenio && matchRubro && matchTipo && matchRegion && matchEsp;
    });
  }, [empresas, busqueda, filtroEstado, filtroConvenio, filtroRubro, filtroTipo, filtroRegion, filtroEsp]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginadas = filtradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  // KPIs
  const kpis = useMemo(() => {
    const activas = empresas.filter(e => e.estado === "activa");
    const cuposTotales = empresas.reduce((s, e) => s + e.cuposTotales, 0);
    const cuposOcupados = empresas.reduce((s, e) => s + e.cuposOcupados, 0);
    return {
      total: empresas.length,
      activas: activas.length,
      conCupos: empresas.filter(e => e.cuposTotales - e.cuposOcupados > 0).length,
      pendientes: empresas.filter(e => e.estado === "en-revision").length,
      visitaProxima: empresas.filter(e => e.proximaVisita !== "—" && e.proximaVisita > new Date().toISOString().slice(0,10)).length,
      conveniosVigentes: empresas.filter(e => e.convenioEstado === "vigente").length,
      conveniosPorVencer: empresas.filter(e => e.convenioEstado === "proximo-vencer").length,
      tasaOcupacion: cuposTotales > 0 ? Math.round((cuposOcupados / cuposTotales) * 100) : 0,
    };
  }, [empresas]);

  const KPI_CARDS = [
    { label:"Total Empresas",          value: kpis.total,              icon:"fa-solid fa-building",             color:"#3b82f6", bg:"rgba(59,130,246,0.10)" },
    { label:"Empresas Activas",        value: kpis.activas,            icon:"fa-solid fa-circle-check",         color:"#22c55e", bg:"rgba(34,197,94,0.10)"  },
    { label:"Con Cupos Disponibles",   value: kpis.conCupos,           icon:"fa-solid fa-door-open",            color:"#1fb2a6", bg:"rgba(31,178,166,0.10)" },
    { label:"Pendientes / Revisión",   value: kpis.pendientes,         icon:"fa-solid fa-hourglass-half",       color:"#f59e0b", bg:"rgba(245,158,11,0.10)" },
    { label:"Visita Próxima",          value: kpis.visitaProxima,      icon:"fa-solid fa-calendar-check",      color:"#a78bfa", bg:"rgba(167,139,250,0.10)"},
    { label:"Convenios Vigentes",      value: kpis.conveniosVigentes,  icon:"fa-solid fa-file-contract",        color:"#34d399", bg:"rgba(52,211,153,0.10)" },
    { label:"Conv. por Vencer",        value: kpis.conveniosPorVencer, icon:"fa-solid fa-triangle-exclamation", color:"#ef4444", bg:"rgba(239,68,68,0.10)"  },
    { label:"Tasa de Ocupación",       value: `${kpis.tasaOcupacion}%`,icon:"fa-solid fa-chart-pie",            color:"#60a5fa", bg:"rgba(96,165,250,0.10)" },
  ];

  function estadoBadge(estado: string, mapa: Record<string,string>, labelMap?: Record<string,string>) {
    const color = mapa[estado] ?? "#6b7280";
    const label = labelMap ? (labelMap[estado] ?? estado) : estado;
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:`${color}18`, border:`1px solid ${color}44`, color, fontSize:11, fontWeight:700, textTransform:"capitalize", whiteSpace:"nowrap" }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }} />
        {label}
      </span>
    );
  }

  const INPUT = { background:"#0f1929", border:"1px solid #1f2937", borderRadius:9, padding:"9px 14px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" as const };
  const SELECT = { ...INPUT, cursor:"pointer" };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1600, fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh" }}>

      {/* ── CABECERA ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div style={{ width:40, height:40, borderRadius:11, background:"linear-gradient(135deg,#1fb2a6,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <i className="fa-solid fa-building" style={{ color:"#fff", fontSize:17 }} />
            </div>
            <div>
              <h1 style={{ color:"#f1f5f9", fontSize:24, fontWeight:800, margin:0, lineHeight:1.1 }}>Empresas Duales</h1>
              <p style={{ color:"#475569", fontSize:13, margin:0 }}>Gestión de centros de formación dual</p>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={exportarExcel} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:9, color:"#94a3b8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.borderColor="#22c55e"} onMouseOut={e=>e.currentTarget.style.borderColor="#1f2937"}>
            <i className="fa-solid fa-file-excel" style={{ fontSize:12, color:"#22c55e" }} />Excel
          </button>
          <button onClick={imprimirTabla} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:9, color:"#94a3b8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.borderColor="#ef4444"} onMouseOut={e=>e.currentTarget.style.borderColor="#1f2937"}>
            <i className="fa-solid fa-file-pdf" style={{ fontSize:12, color:"#ef4444" }} />PDF
          </button>
          <button onClick={imprimirTabla} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:9, color:"#94a3b8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.borderColor="#374151"} onMouseOut={e=>e.currentTarget.style.borderColor="#1f2937"}>
            <i className="fa-solid fa-print" style={{ fontSize:12 }} />Imprimir
          </button>
          <button
            onClick={() => router.push("/dashboard/empresas/nueva")}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 20px", background:"linear-gradient(135deg,#1fb2a6,#2563eb)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 14px rgba(31,178,166,0.30)" }}
            onMouseOver={e=>e.currentTarget.style.opacity="0.9"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <i className="fa-solid fa-plus" style={{ fontSize:12 }} />Nueva Empresa
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
        {KPI_CARDS.slice(0,4).map(k => (
          <div key={k.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"18px 20px", transition:"border-color 0.15s,transform 0.15s", cursor:"default" }}
            onMouseOver={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor=k.color+"44";d.style.transform="translateY(-2px)";}}
            onMouseOut={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor="#1f2937";d.style.transform="translateY(0)";}}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className={k.icon} style={{ color:k.color, fontSize:16 }} />
              </div>
            </div>
            <p style={{ color:"#f1f5f9", fontSize:30, fontWeight:800, margin:"0 0 4px", lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280", fontSize:12, margin:0, fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
        {KPI_CARDS.slice(4).map(k => (
          <div key={k.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"18px 20px", transition:"border-color 0.15s,transform 0.15s", cursor:"default" }}
            onMouseOver={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor=k.color+"44";d.style.transform="translateY(-2px)";}}
            onMouseOut={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor="#1f2937";d.style.transform="translateY(0)";}}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className={k.icon} style={{ color:k.color, fontSize:16 }} />
              </div>
            </div>
            <p style={{ color:"#f1f5f9", fontSize:30, fontWeight:800, margin:"0 0 4px", lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280", fontSize:12, margin:0, fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── BARRA BÚSQUEDA + CONTROLES ── */}
      <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"16px 20px", marginBottom:20 }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          {/* Buscador */}
          <div style={{ flex:1, minWidth:220, position:"relative" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:13, pointerEvents:"none" }} />
            <input value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPaginaActual(1);}}
              placeholder="Buscar empresa, RUT, rubro..."
              style={{ ...INPUT, paddingLeft:38 }}
              onFocus={e=>e.currentTarget.style.borderColor="#2563eb"}
              onBlur={e=>e.currentTarget.style.borderColor="#1f2937"} />
          </div>

          {/* Filtro estado */}
          <select value={filtroEstado} onChange={e=>{setFiltroEstado(e.target.value);setPaginaActual(1);}} style={{ ...SELECT, width:"auto", minWidth:140 }}>
            {ESTADOS.map(s=><option key={s} value={s}>{s==="todos"?"Todos los estados":s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>

          {/* Filtro convenio */}
          <select value={filtroConvenio} onChange={e=>{setFiltroConvenio(e.target.value);setPaginaActual(1);}} style={{ ...SELECT, width:"auto", minWidth:160 }}>
            {CONVENIOS.map(c=><option key={c} value={c}>{c==="todos"?"Todos los convenios":c.charAt(0).toUpperCase()+c.slice(1).replace("-"," ")}</option>)}
          </select>

          {/* Filtros avanzados toggle */}
          <button onClick={()=>setFiltrosAbiertos(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", background:filtrosAbiertos?"rgba(37,99,235,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${filtrosAbiertos?"#3b82f6":"#1f2937"}`, borderRadius:9, color:filtrosAbiertos?"#3b82f6":"#94a3b8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            <i className="fa-solid fa-sliders" style={{ fontSize:12 }} />Filtros
          </button>

          {/* Vista toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:9, overflow:"hidden" }}>
            {(["tabla","tarjetas"] as const).map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{ padding:"9px 13px", background:vista===v?"rgba(37,99,235,0.15)":"transparent", border:"none", color:vista===v?"#3b82f6":"#64748b", cursor:"pointer", fontSize:12 }}>
                <i className={`fa-solid ${v==="tabla"?"fa-table-list":"fa-grip"}`} style={{ fontSize:13 }} />
              </button>
            ))}
          </div>

          <p style={{ color:"#475569", fontSize:12, margin:0, whiteSpace:"nowrap" }}>{filtradas.length} empresa{filtradas.length!==1?"s":""}</p>
        </div>

        {/* Filtros avanzados */}
        {filtrosAbiertos && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #1f2937", display:"flex", gap:12, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={{ color:"#64748b", fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Rubro</label>
              <select value={filtroRubro} onChange={e=>{setFiltroRubro(e.target.value);setPaginaActual(1);}} style={SELECT}>
                {RUBROS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={{ color:"#64748b", fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Tipo de empresa</label>
              <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setPaginaActual(1);}} style={SELECT}>
                <option value="Todos">Todos</option>
                <option>Microempresa</option>
                <option>Pequeña Empresa</option>
                <option>Mediana Empresa</option>
                <option>Gran Empresa</option>
              </select>
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={{ color:"#64748b", fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Región</label>
              <select value={filtroRegion} onChange={e=>{setFiltroRegion(e.target.value);setPaginaActual(1);}} style={SELECT}>
                <option value="Todas">Todas</option>
                <option>Metropolitana</option>
                <option>Valparaíso</option>
                <option>Biobío</option>
                <option>O'Higgins</option>
                <option>La Araucanía</option>
              </select>
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={{ color:"#64748b", fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Especialidad</label>
              <select value={filtroEsp} onChange={e=>{setFiltroEsp(e.target.value);setPaginaActual(1);}} style={SELECT}>
                <option value="Todas">Todas</option>
                <option>Contabilidad</option>
                <option>Mecánica</option>
                <option>Enfermería</option>
                <option>Agropecuaria</option>
                <option>Atención de Párvulos</option>
              </select>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button onClick={()=>{setFiltroEstado("todos");setFiltroConvenio("todos");setFiltroRubro("Todos");setFiltroTipo("Todos");setFiltroRegion("Todas");setFiltroEsp("Todas");setBusqueda("");setPaginaActual(1);}}
                style={{ padding:"9px 14px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.20)", borderRadius:9, color:"#ef4444", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
                <i className="fa-solid fa-rotate-left" style={{ fontSize:11 }} />Limpiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── VISTA TABLA ── */}
      {vista === "tabla" && (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1100 }}>
              <thead>
                <tr style={{ background:"#0d1520", borderBottom:"1px solid #1f2937" }}>
                  {["ID","Empresa","RUT","Rubro","Maestro Guía","Especialidades","Cupos","Estudiantes","Estado","Convenio","Última Visita","Próxima Visita",""].map(col=>(
                    <th key={col} style={{ padding:"12px 16px", textAlign:"left", color:"#475569", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginadas.length === 0 ? (
                  <tr><td colSpan={13} style={{ padding:"60px", textAlign:"center", color:"#374151" }}>
                    <i className="fa-solid fa-building" style={{ fontSize:32, display:"block", marginBottom:12, color:"#334155" }} />
                    <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:600, color:"#64748b" }}>No se encontraron empresas</p>
                    <p style={{ margin:"0 0 20px", fontSize:13, color:"#334155" }}>Agrega la primera empresa dual con el botón de abajo.</p>
                    <button onClick={()=>router.push("/dashboard/empresas/nueva")} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"linear-gradient(135deg,#1fb2a6,#2563eb)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
                      <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Empresa
                    </button>
                  </td></tr>
                ) : paginadas.map((e, i) => {
                  const cuposDisp = e.cuposTotales - e.cuposOcupados;
                  const pct = e.cuposTotales > 0 ? Math.round((e.cuposOcupados/e.cuposTotales)*100) : 0;
                  return (
                    <tr key={e.id} style={{ borderBottom:"1px solid #1a2236", cursor:"pointer", transition:"background 0.12s" }}
                      onMouseOver={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.025)"}
                      onMouseOut={ev=>ev.currentTarget.style.background="transparent"}
                      onClick={()=>router.push(`/dashboard/empresas/${e.id}`)}>
                      <td style={{ padding:"12px 16px", color:"#475569", fontSize:12, whiteSpace:"nowrap" }}>
                        <span style={{ fontFamily:"monospace", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:5, fontSize:11 }}>{e.codigoInterno}</span>
                      </td>
                      <td style={{ padding:"12px 16px", whiteSpace:"nowrap" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:9, background:`${TIPO_COLOR[e.tipoEmpresa]||"#3b82f6"}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <i className="fa-solid fa-building" style={{ color:TIPO_COLOR[e.tipoEmpresa]||"#3b82f6", fontSize:13 }} />
                          </div>
                          <div>
                            <p style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, margin:0, lineHeight:1.2 }}>{e.nombreComercial}</p>
                            <p style={{ color:"#475569", fontSize:11, margin:0 }}>{e.razonSocial}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", color:"#94a3b8", fontSize:12, whiteSpace:"nowrap", fontFamily:"monospace" }}>{e.rut}</td>
                      <td style={{ padding:"12px 16px", color:"#64748b", fontSize:12, whiteSpace:"nowrap" }}>{e.rubro}</td>
                      <td style={{ padding:"12px 16px", color:"#94a3b8", fontSize:12, whiteSpace:"nowrap" }}>{e.maestroGuia}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {e.especialidades.map(esp=>(
                            <span key={esp} style={{ background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.25)", color:"#60a5fa", borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:600, whiteSpace:"nowrap" }}>{esp}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", whiteSpace:"nowrap" }}>
                        <div>
                          <p style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, margin:"0 0 3px" }}>{cuposDisp} disp. / {e.cuposTotales} total</p>
                          <div style={{ width:80, height:5, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
                            <div style={{ width:`${pct}%`, height:"100%", borderRadius:3, background: pct>=100?"#ef4444":pct>=75?"#f59e0b":"#22c55e", transition:"width 0.3s" }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", textAlign:"center" }}>
                        <span style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{e.estudiantesActuales}</span>
                      </td>
                      <td style={{ padding:"12px 16px" }}>{estadoBadge(e.estado, ESTADO_COLOR)}</td>
                      <td style={{ padding:"12px 16px" }}>
                        {estadoBadge(e.convenioEstado, CONVENIO_COLOR, { vigente:"Vigente", "proximo-vencer":"Por vencer", vencido:"Vencido", suspendido:"Suspendido" })}
                      </td>
                      <td style={{ padding:"12px 16px", color:"#475569", fontSize:12, whiteSpace:"nowrap" }}>{e.ultimaVisita}</td>
                      <td style={{ padding:"12px 16px", color:e.proximaVisita==="—"?"#374151":"#94a3b8", fontSize:12, whiteSpace:"nowrap" }}>{e.proximaVisita}</td>
                      <td style={{ padding:"12px 16px" }} onClick={ev=>ev.stopPropagation()}>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={()=>router.push(`/dashboard/empresas/${e.id}`)}
                            style={{ width:30, height:30, borderRadius:7, background:"rgba(59,130,246,0.10)", border:"1px solid rgba(59,130,246,0.20)", color:"#3b82f6", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                            title="Ver ficha">
                            <i className="fa-solid fa-eye" style={{ fontSize:12 }} />
                          </button>
                          <button onClick={ev=>abrirEditar(e, ev)}
                            style={{ width:30, height:30, borderRadius:7, background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.20)", color:"#f59e0b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                            title="Editar">
                            <i className="fa-solid fa-pencil" style={{ fontSize:12 }} />
                          </button>
                          <button onClick={ev=>eliminarEmpresa(e.id, ev)}
                            style={{ width:30, height:30, borderRadius:7, background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.20)", color:"#ef4444", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                            title="Eliminar">
                            <i className="fa-solid fa-trash" style={{ fontSize:12 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderTop:"1px solid #1f2937" }}>
              <p style={{ color:"#475569", fontSize:12, margin:0 }}>
                Mostrando {(paginaActual-1)*porPagina+1}–{Math.min(paginaActual*porPagina,filtradas.length)} de {filtradas.length}
              </p>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setPaginaActual(p=>Math.max(1,p-1))} disabled={paginaActual===1}
                  style={{ padding:"6px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:7, color: paginaActual===1?"#374151":"#94a3b8", cursor: paginaActual===1?"not-allowed":"pointer", fontSize:12, fontFamily:"'Inter',sans-serif" }}>
                  ← Anterior
                </button>
                {Array.from({length:totalPaginas},(_,i)=>i+1).map(p=>(
                  <button key={p} onClick={()=>setPaginaActual(p)}
                    style={{ width:32, height:32, borderRadius:7, background: p===paginaActual?"linear-gradient(135deg,#1fb2a6,#2563eb)":"rgba(255,255,255,0.04)", border:`1px solid ${p===paginaActual?"transparent":"#1f2937"}`, color: p===paginaActual?"#fff":"#94a3b8", cursor:"pointer", fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight: p===paginaActual?700:400 }}>
                    {p}
                  </button>
                ))}
                <button onClick={()=>setPaginaActual(p=>Math.min(totalPaginas,p+1))} disabled={paginaActual===totalPaginas}
                  style={{ padding:"6px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:7, color: paginaActual===totalPaginas?"#374151":"#94a3b8", cursor: paginaActual===totalPaginas?"not-allowed":"pointer", fontSize:12, fontFamily:"'Inter',sans-serif" }}>
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA TARJETAS ── */}
      {vista === "tarjetas" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {paginadas.length === 0 ? (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:60, color:"#374151" }}>
              <i className="fa-solid fa-building" style={{ fontSize:40, display:"block", marginBottom:16, color:"#334155" }} />
              <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:600, color:"#64748b" }}>No se encontraron empresas</p>
              <p style={{ margin:"0 0 20px", fontSize:13, color:"#334155" }}>Agrega la primera empresa dual con el botón de abajo.</p>
              <button onClick={()=>router.push("/dashboard/empresas/nueva")} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"linear-gradient(135deg,#1fb2a6,#2563eb)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
                <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Empresa
              </button>
            </div>
          ) : paginadas.map(e => {
            const cuposDisp = e.cuposTotales - e.cuposOcupados;
            const pct = e.cuposTotales > 0 ? Math.round((e.cuposOcupados/e.cuposTotales)*100) : 0;
            const tipoColor = TIPO_COLOR[e.tipoEmpresa] ?? "#3b82f6";
            return (
              <div key={e.id}
                onClick={()=>router.push(`/dashboard/empresas/${e.id}`)}
                style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"20px", cursor:"pointer", transition:"border-color 0.15s,transform 0.15s" }}
                onMouseOver={ev=>{const d=ev.currentTarget as HTMLDivElement;d.style.borderColor=tipoColor+"44";d.style.transform="translateY(-3px)";}}
                onMouseOut={ev=>{const d=ev.currentTarget as HTMLDivElement;d.style.borderColor="#1f2937";d.style.transform="translateY(0)";}}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:42, height:42, borderRadius:11, background:`${tipoColor}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <i className="fa-solid fa-building" style={{ color:tipoColor, fontSize:17 }} />
                    </div>
                    <div>
                      <p style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>{e.nombreComercial}</p>
                      <p style={{ color:"#475569", fontSize:11, margin:0 }}>{e.codigoInterno} · {e.rut}</p>
                    </div>
                  </div>
                  {estadoBadge(e.estado, ESTADO_COLOR)}
                </div>

                <p style={{ color:"#64748b", fontSize:12, margin:"0 0 12px" }}>{e.rubro}</p>

                <div style={{ display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
                  {e.especialidades.map(esp=>(
                    <span key={esp} style={{ background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.20)", color:"#60a5fa", borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:600 }}>{esp}</span>
                  ))}
                </div>

                <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <p style={{ color:"#64748b", fontSize:11, margin:0 }}>Ocupación de cupos</p>
                    <p style={{ color:"#f1f5f9", fontSize:11, fontWeight:700, margin:0 }}>{pct}%</p>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", borderRadius:3, background: pct>=100?"#ef4444":pct>=75?"#f59e0b":"#22c55e" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                    <p style={{ color:"#475569", fontSize:10, margin:0 }}>{cuposDisp} disponibles</p>
                    <p style={{ color:"#475569", fontSize:10, margin:0 }}>{e.cuposTotales} totales</p>
                  </div>
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  {estadoBadge(e.convenioEstado, CONVENIO_COLOR, { vigente:"Convenio vigente","proximo-vencer":"Por vencer",vencido:"Vencido",suspendido:"Suspendido" })}
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ width:28, height:28, borderRadius:7, background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.20)", color:"#f59e0b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                      onClick={ev=>abrirEditar(e, ev)}>
                      <i className="fa-solid fa-pencil" style={{ fontSize:11 }} />
                    </button>
                    <button style={{ width:28, height:28, borderRadius:7, background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.20)", color:"#ef4444", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                      onClick={ev=>eliminarEmpresa(e.id, ev)}>
                      <i className="fa-solid fa-trash" style={{ fontSize:11 }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL EDITAR EMPRESA ══ */}
      {modalEditar && formEdit && (
        <div style={{ position:"fixed", inset:0, zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onMouseDown={e=>{ if((e.target as HTMLElement).dataset.backdrop) setModalEditar(false); }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }} data-backdrop="1" />
          <div style={{ position:"relative", width:"100%", maxWidth:660, background:"#111827", border:"1px solid #1f2937", borderRadius:18, boxShadow:"0 32px 80px rgba(0,0,0,0.60)", overflow:"hidden", maxHeight:"90vh", display:"flex", flexDirection:"column" }}>
            {/* header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"rgba(245,158,11,0.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <i className="fa-solid fa-pencil" style={{ color:"#f59e0b", fontSize:14 }} />
                </div>
                <p style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, margin:0 }}>Editar empresa</p>
              </div>
              <button onClick={()=>setModalEditar(false)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", color:"#475569", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{ fontSize:13 }} />
              </button>
            </div>

            {/* body */}
            <div style={{ overflowY:"auto", flex:1, padding:"24px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                {[
                  { label:"Nombre comercial", key:"nombreComercial", placeholder:"Sodimac S.A." },
                  { label:"Razón social",      key:"razonSocial",     placeholder:"Sodimac S.A." },
                  { label:"RUT empresa",       key:"rut",             placeholder:"81.201.000-3" },
                  { label:"Maestro guía",      key:"maestroGuia",     placeholder:"Nombre del maestro" },
                  { label:"Región",            key:"region",          placeholder:"Metropolitana" },
                  { label:"Próxima visita",    key:"proximaVisita",   placeholder:"AAAA-MM-DD" },
                ].map(f=>(
                  <div key={f.key}>
                    <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>{f.label}</p>
                    <input
                      value={(formEdit as Record<string,unknown>)[f.key] as string}
                      onChange={e=>setFormEdit(prev=>prev?({...prev,[f.key]:e.target.value}):prev)}
                      placeholder={f.placeholder}
                      style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box" }}
                      onFocus={e=>e.currentTarget.style.borderColor="#2563eb"}
                      onBlur={e=>e.currentTarget.style.borderColor="#1f2937"}
                    />
                  </div>
                ))}

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Rubro</p>
                  <input value={formEdit.rubro} onChange={e=>setFormEdit(prev=>prev?({...prev,rubro:e.target.value}):prev)} style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box" }} onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"} />
                </div>

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Tipo de empresa</p>
                  <select value={formEdit.tipoEmpresa} onChange={e=>setFormEdit(prev=>prev?({...prev,tipoEmpresa:e.target.value}):prev)}
                    style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", cursor:"pointer", boxSizing:"border-box" }}>
                    <option>Microempresa</option><option>Pequeña Empresa</option><option>Mediana Empresa</option><option>Gran Empresa</option>
                  </select>
                </div>

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Estado</p>
                  <select value={formEdit.estado} onChange={e=>setFormEdit(prev=>prev?({...prev,estado:e.target.value}):prev)}
                    style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", cursor:"pointer", boxSizing:"border-box" }}>
                    <option value="activa">Activa</option><option value="inactiva">Inactiva</option><option value="suspendida">Suspendida</option><option value="en-revision">En revisión</option>
                  </select>
                </div>

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Estado convenio</p>
                  <select value={formEdit.convenioEstado} onChange={e=>setFormEdit(prev=>prev?({...prev,convenioEstado:e.target.value}):prev)}
                    style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", cursor:"pointer", boxSizing:"border-box" }}>
                    <option value="vigente">Vigente</option><option value="proximo-vencer">Próximo a vencer</option><option value="vencido">Vencido</option><option value="suspendido">Suspendido</option>
                  </select>
                </div>

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Cupos totales</p>
                  <input type="number" min={0} value={formEdit.cuposTotales} onChange={e=>setFormEdit(prev=>prev?({...prev,cuposTotales:Number(e.target.value)}):prev)}
                    style={{ width:"100%", background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"10px 13px", color:"#f1f5f9", fontSize:13, outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box" }} onFocus={e=>e.currentTarget.style.borderColor="#2563eb"} onBlur={e=>e.currentTarget.style.borderColor="#1f2937"} />
                </div>
              </div>
            </div>

            {/* footer */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, padding:"18px 24px", borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>setModalEditar(false)} style={{ padding:"10px 20px", background:"rgba(255,255,255,0.04)", border:"1px solid #1f2937", borderRadius:9, color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Cancelar</button>
              <button onClick={guardarEditar} style={{ padding:"10px 24px", background:"linear-gradient(135deg,#f59e0b,#d97706)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
                <i className="fa-solid fa-floppy-disk" style={{ marginRight:7, fontSize:12 }} />Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
