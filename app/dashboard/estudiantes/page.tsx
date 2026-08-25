"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Estudiante } from "@/types";

/* ─── helpers de estilo ─────────────────────────────────────────────────── */
const INP: React.CSSProperties = {
  width: "100%", background: "#0b1120", border: "1px solid #1f2a3a",
  borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14,
  outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
};
const SEL: React.CSSProperties = { ...INP, cursor: "pointer" };

const EMPTY: Omit<Estudiante, "id" | "creadoEn"> = {
  run: "", nombres: "", apellidos: "", email: "", telefono: "",
  curso: "", nivel: "", especialidadId: "", liceoId: "",
  centroDualId: "", profesorId: "", estado: "activo",
};

/* ─── máx 2 nombres ────────────────────────────────────────────────────── */
function dosNombres(nombres: string) {
  const partes = nombres.trim().split(/\s+/);
  return partes.slice(0, 2).join(" ");
}

export default function EstudiantesPage() {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading]         = useState(true);

  /* filtros */
  const [busqueda,       setBusqueda]       = useState("");
  const [filtroCurso,    setFiltroCurso]    = useState("todos");
  const [filtroEsp,      setFiltroEsp]      = useState("todos");
  const [filtroEstado,   setFiltroEstado]   = useState("todos");
  const [filtroDual,     setFiltroDual]     = useState("todos"); // todos | con | sin

  /* modal */
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(EMPTY);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "coordinador" ||
                      usuario?.rol === "director"      || usuario?.rol === "profesor";

  /* ── carga ── */
  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    let q;
    if (["administrador","coordinador","director"].includes(usuario.rol)) {
      q = query(collection(db,"estudiantes"), where("liceoId","==",usuario.liceoId));
    } else if (usuario.rol === "profesor") {
      q = query(collection(db,"estudiantes"), where("profesorId","==",usuario.uid));
    } else {
      q = query(collection(db,"estudiantes"), where("liceoId","==",usuario.liceoId));
    }
    const snap = await getDocs(q);
    setEstudiantes(snap.docs.map(d => ({ id:d.id, ...d.data() }) as Estudiante));
    setLoading(false);
  }

  /* ── guardar (crear / editar) ── */
  async function guardar() {
    if (!form.apellidos.trim() || !form.nombres.trim() || !form.run.trim()) {
      alert("Apellidos, Nombres y RUN son obligatorios.");
      return;
    }
    if (!usuario) return;
    setGuardando(true);
    try {
      if (editId) {
        await updateDoc(doc(db,"estudiantes",editId), { ...form });
        await registrarAuditoria({ tipo:"editar", modulo:"Estudiantes", actor:usuario.nombre, detalle:`Estudiante editado: ${form.nombres} ${form.apellidos}`, liceoId:usuario.liceoId, uid:usuario.uid });
      } else {
        await addDoc(collection(db,"estudiantes"), {
          ...form,
          liceoId: usuario.liceoId,
          profesorId: usuario.uid,
          creadoEn: new Date().toISOString(),
        });
        await registrarAuditoria({ tipo:"crear", modulo:"Estudiantes", actor:usuario.nombre, detalle:`Nuevo estudiante registrado: ${form.nombres} ${form.apellidos}`, liceoId:usuario.liceoId, uid:usuario.uid });
      }
      setModal(false);
      setForm(EMPTY);
      setEditId(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  function abrirEditar(e: Estudiante) {
    setForm({
      run: e.run, nombres: e.nombres, apellidos: e.apellidos,
      email: e.email ?? "", telefono: e.telefono ?? "",
      curso: e.curso, nivel: e.nivel,
      especialidadId: e.especialidadId, liceoId: e.liceoId,
      centroDualId: e.centroDualId ?? "", profesorId: e.profesorId ?? "",
      estado: e.estado,
    });
    setEditId(e.id);
    setModal(true);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este estudiante? Esta acción no se puede deshacer.")) return;
    const est = estudiantes.find(e=>e.id===id);
    await deleteDoc(doc(db,"estudiantes",id));
    if (est) await registrarAuditoria({ tipo:"eliminar", modulo:"Estudiantes", actor:usuario!.nombre, detalle:`Estudiante eliminado: ${est.nombres} ${est.apellidos}`, liceoId:usuario!.liceoId, uid:usuario!.uid });
    cargar();
  }

  /* ── listas únicas para selects de filtro ── */
  const cursos = useMemo(() =>
    [...new Set(estudiantes.map(e => e.curso).filter(Boolean))].sort(), [estudiantes]);
  const especialidades = useMemo(() =>
    [...new Set(estudiantes.map(e => e.especialidadId).filter(Boolean))].sort(), [estudiantes]);

  /* ── filtrado + ordenamiento alfabético por apellido ── */
  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase();
    return estudiantes
      .filter(e => {
        const matchBusq = !busqueda ||
          e.apellidos.toLowerCase().includes(texto) ||
          e.nombres.toLowerCase().includes(texto)   ||
          e.run.toLowerCase().includes(texto);
        const matchCurso  = filtroCurso  === "todos" || e.curso          === filtroCurso;
        const matchEsp    = filtroEsp    === "todos" || e.especialidadId === filtroEsp;
        const matchEstado = filtroEstado === "todos" || e.estado         === filtroEstado;
        const matchDual   = filtroDual   === "todos" ||
          (filtroDual === "con" &&  e.centroDualId) ||
          (filtroDual === "sin" && !e.centroDualId);
        return matchBusq && matchCurso && matchEsp && matchEstado && matchDual;
      })
      /* orden alfabético por apellidos, luego nombres */
      .sort((a, b) => {
        const ap = a.apellidos.localeCompare(b.apellidos, "es");
        return ap !== 0 ? ap : a.nombres.localeCompare(b.nombres, "es");
      });
  }, [estudiantes, busqueda, filtroCurso, filtroEsp, filtroEstado, filtroDual]);

  /* ── KPIs ── */
  const kpis = [
    { label:"Total estudiantes", value: estudiantes.length,                             color:"#1fb2a6", bg:"rgba(31,178,166,.12)", icon:"fa-users" },
    { label:"Con Centro Dual",   value: estudiantes.filter(e=> e.centroDualId).length,  color:"#22c55e", bg:"rgba(34,197,94,.12)",   icon:"fa-building" },
    { label:"Sin Centro Dual",   value: estudiantes.filter(e=>!e.centroDualId).length,  color:"#f59e0b", bg:"rgba(245,158,11,.12)",  icon:"fa-circle-exclamation" },
    { label:"Activos",           value: estudiantes.filter(e=> e.estado==="activo").length, color:"#3b82f6", bg:"rgba(59,130,246,.12)", icon:"fa-user-check" },
  ];

  const estadoCfg: Record<string,{label:string;color:string;bg:string}> = {
    activo:   { label:"Activo",   color:"#22c55e", bg:"rgba(34,197,94,.12)"  },
    inactivo: { label:"Inactivo", color:"#ef4444", bg:"rgba(239,68,68,.12)"  },
    egresado: { label:"Egresado", color:"#f59e0b", bg:"rgba(245,158,11,.12)" },
  };

  /* ── colores estado dual ── */
  const dualCfg = (e: Estudiante) => e.centroDualId
    ? { label:"Con Dual", color:"#22c55e", bg:"rgba(34,197,94,.12)" }
    : { label:"Sin Dual", color:"#f59e0b", bg:"rgba(245,158,11,.12)" };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1400, fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh" }}>

      {/* ── CABECERA ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#1fb2a6,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <i className="fa-solid fa-users" style={{ color:"#fff", fontSize:18 }} />
          </div>
          <div>
            <h1 style={{ color:"#f1f5f9", fontSize:26, fontWeight:800, margin:0, lineHeight:1.1 }}>Estudiantes</h1>
            <p style={{ color:"#475569", fontSize:13, margin:0 }}>Gestión de estudiantes en formación dual</p>
          </div>
        </div>
        {puedeEditar && (
          <button
            onClick={() => { setForm(EMPTY); setEditId(null); setModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"linear-gradient(135deg,#1fb2a6,#2563eb)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}
          >
            <i className="fa-solid fa-plus" style={{ fontSize:12 }} />
            Agregar estudiante
          </button>
        )}
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:26 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"18px 20px" }}>
            <div style={{ width:38, height:38, borderRadius:10, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <i className={`fa-solid ${k.icon}`} style={{ color:k.color, fontSize:16 }} />
            </div>
            <p style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:"0 0 4px", lineHeight:1 }}>{k.value}</p>
            <p style={{ color:"#6b7280", fontSize:12, margin:0, fontWeight:500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"16px 20px", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:12 }}>
          {/* buscador */}
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#0b1220", border:"1px solid #1f2937", borderRadius:9, padding:"0 14px", height:42 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color:"#475569", fontSize:13 }} />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por apellido, nombre o RUN…"
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#f1f5f9", fontSize:13, fontFamily:"'Inter',sans-serif" }}
            />
            {busqueda && (
              <button onClick={()=>setBusqueda("")} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:0, lineHeight:1 }}>
                <i className="fa-solid fa-xmark" style={{ fontSize:13 }} />
              </button>
            )}
          </div>

          {/* curso */}
          <select value={filtroCurso} onChange={e=>setFiltroCurso(e.target.value)}
            style={{ ...SEL, height:42, padding:"0 14px", fontSize:13 }}>
            <option value="todos">Todos los cursos</option>
            {cursos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* especialidad */}
          <select value={filtroEsp} onChange={e=>setFiltroEsp(e.target.value)}
            style={{ ...SEL, height:42, padding:"0 14px", fontSize:13 }}>
            <option value="todos">Toda especialidad</option>
            {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* estado dual */}
          <select value={filtroDual} onChange={e=>setFiltroDual(e.target.value)}
            style={{ ...SEL, height:42, padding:"0 14px", fontSize:13 }}>
            <option value="todos">Con/Sin Dual</option>
            <option value="con">Con Centro Dual</option>
            <option value="sin">Sin Centro Dual</option>
          </select>

          {/* estado alumno */}
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
            style={{ ...SEL, height:42, padding:"0 14px", fontSize:13 }}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="egresado">Egresado</option>
          </select>
        </div>
      </div>

      {/* subtítulo lista */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>
          Mostrando <strong style={{ color:"#f1f5f9" }}>{filtrados.length}</strong> estudiante{filtrados.length!==1?"s":""} · ordenados alfabéticamente por apellido
        </p>
        {(busqueda||filtroCurso!=="todos"||filtroEsp!=="todos"||filtroEstado!=="todos"||filtroDual!=="todos") && (
          <button onClick={()=>{ setBusqueda(""); setFiltroCurso("todos"); setFiltroEsp("todos"); setFiltroEstado("todos"); setFiltroDual("todos"); }}
            style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"1px solid #1f2937", borderRadius:8, color:"#64748b", fontSize:12, padding:"5px 12px", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            <i className="fa-solid fa-xmark" style={{ fontSize:11 }} />Limpiar filtros
          </button>
        )}
      </div>

      {/* ── TABLA ── */}
      {loading ? (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"56px 24px", textAlign:"center" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ color:"#1fb2a6", fontSize:28, marginBottom:14, display:"block" }} />
          <p style={{ color:"#475569", fontSize:14, margin:0 }}>Cargando estudiantes…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:"72px 24px", textAlign:"center" }}>
          <i className="fa-solid fa-users-slash" style={{ color:"#334155", fontSize:36, marginBottom:16, display:"block" }} />
          <p style={{ color:"#64748b", fontSize:15, fontWeight:600, margin:"0 0 6px" }}>No se encontraron estudiantes</p>
          <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>
            {busqueda ? "Intenta con otro término de búsqueda." : "Agrega el primer estudiante con el botón de abajo."}
          </p>
          {puedeEditar && !busqueda && (
            <button onClick={()=>{ setForm(EMPTY); setEditId(null); setModal(true); }} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",background:"linear-gradient(135deg,#1fb2a6,#2563eb)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 14px rgba(31,178,166,.28)" }}>
              <i className="fa-solid fa-plus" style={{fontSize:12}}/>Agregar Estudiante
            </button>
          )}
        </div>
      ) : (
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, overflow:"hidden" }}>
          {/* leyenda ficha */}
          <div style={{ display:"flex", alignItems:"center", gap:20, padding:"12px 20px", borderBottom:"1px solid #1f2937", background:"rgba(255,255,255,.01)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <i className="fa-solid fa-eye" style={{ color:"#1fb2a6", fontSize:12 }} />
              <span style={{ color:"#64748b", fontSize:11 }}>Tiene ficha</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <i className="fa-solid fa-eye-slash" style={{ color:"#475569", fontSize:12 }} />
              <span style={{ color:"#64748b", fontSize:11 }}>Sin ficha</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:14, height:10, background:"rgba(245,158,11,.15)", border:"1px solid rgba(245,158,11,.3)", borderRadius:2 }} />
              <span style={{ color:"#64748b", fontSize:11 }}>Fila resaltada = sin ficha dual</span>
            </div>
          </div>

          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"rgba(255,255,255,.02)", borderBottom:"1px solid #1f2937" }}>
                {[
                  { label:"#",            align:"center", w:50 },
                  { label:"Apellidos",    align:"left",   w:"auto" },
                  { label:"Nombres",      align:"left",   w:"auto" },
                  { label:"RUN",          align:"left",   w:130 },
                  { label:"Especialidad", align:"left",   w:"auto" },
                  { label:"Curso",        align:"left",   w:160 },
                  { label:"Estado",       align:"center", w:110 },
                  { label:"Dual",         align:"center", w:110 },
                  { label:"Ficha",        align:"center", w:72 },
                  { label:"Acciones",     align:"center", w:100 },
                ].map(h => (
                  <th key={h.label} style={{ textAlign:h.align as React.CSSProperties["textAlign"], padding:"13px 14px", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.4px", width:h.w }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e, idx) => {
                const sinFicha = !e.centroDualId;
                const estadoCfgE = estadoCfg[e.estado] ?? estadoCfg.activo;
                const dual = dualCfg(e);
                const rowBg = sinFicha
                  ? "rgba(245,158,11,.09)"
                  : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,.01)";
                const rowHover = sinFicha ? "rgba(245,158,11,.16)" : "rgba(255,255,255,.04)";

                return (
                  <tr
                    key={e.id}
                    style={{ borderBottom:"1px solid #1f2937", background:rowBg, transition:"background .12s" }}
                    onMouseOver={ev => ev.currentTarget.style.background = rowHover}
                    onMouseOut={ev  => ev.currentTarget.style.background = rowBg}
                  >
                    {/* # orden alfabético */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:"50%", background:"rgba(31,178,166,.12)", color:"#1fb2a6", fontSize:12, fontWeight:700 }}>
                        {idx + 1}
                      </span>
                    </td>

                    {/* apellidos */}
                    <td style={{ padding:"0 14px", height:50, fontSize:14, color:"#f1f5f9", fontWeight:700 }}>
                      {e.apellidos || "—"}
                      {sinFicha && (
                        <i className="fa-solid fa-triangle-exclamation" style={{ color:"#f59e0b", fontSize:10, marginLeft:7 }} title="Sin ficha dual" />
                      )}
                    </td>

                    {/* nombres (máx 2) */}
                    <td style={{ padding:"0 14px", height:50, fontSize:14, color:"#cbd5e1" }}>
                      {dosNombres(e.nombres) || "—"}
                    </td>

                    {/* RUN */}
                    <td style={{ padding:"0 14px", height:50, fontSize:13, color:"#64748b", fontFamily:"monospace" }}>
                      {e.run || "—"}
                    </td>

                    {/* especialidad */}
                    <td style={{ padding:"0 14px", height:50, fontSize:13, color:"#94a3b8" }}>
                      {e.especialidadId || "—"}
                    </td>

                    {/* curso */}
                    <td style={{ padding:"0 14px", height:50, fontSize:13, color:"#94a3b8" }}>
                      {e.curso || "—"}
                      {e.nivel && <span style={{ color:"#475569", marginLeft:5 }}>· {e.nivel}</span>}
                    </td>

                    {/* estado activo/inactivo/egresado */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color:estadoCfgE.color, background:estadoCfgE.bg, borderRadius:20, padding:"3px 11px", fontSize:11, fontWeight:700 }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:estadoCfgE.color, flexShrink:0, display:"inline-block" }} />
                        {estadoCfgE.label}
                      </span>
                    </td>

                    {/* dual */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, color:dual.color, background:dual.bg, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:dual.color, flexShrink:0, display:"inline-block" }} />
                        {dual.label}
                      </span>
                    </td>

                    {/* ficha — ojo normal si tiene, ojo tachado si no */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      {sinFicha ? (
                        <span title="Sin ficha dual" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, background:"rgba(71,85,105,.12)", color:"#475569", cursor:"default" }}>
                          <i className="fa-solid fa-eye-slash" style={{ fontSize:14 }} />
                        </span>
                      ) : (
                        <button
                          title="Ver ficha del estudiante"
                          onClick={() => window.open(`/dashboard/estudiantes/${e.id}`, "_blank")}
                          style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, background:"rgba(31,178,166,.12)", color:"#1fb2a6", border:"none", cursor:"pointer" }}
                          onMouseOver={ev => ev.currentTarget.style.background="rgba(31,178,166,.24)"}
                          onMouseOut={ev  => ev.currentTarget.style.background="rgba(31,178,166,.12)"}
                        >
                          <i className="fa-solid fa-eye" style={{ fontSize:14 }} />
                        </button>
                      )}
                    </td>

                    {/* acciones */}
                    <td style={{ padding:"0 14px", height:50, textAlign:"center" }}>
                      {puedeEditar ? (
                        <div style={{ display:"inline-flex", gap:6 }}>
                          <button
                            onClick={() => abrirEditar(e)}
                            title="Editar estudiante"
                            style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(245,158,11,.12)", border:"none", borderRadius:8, color:"#f59e0b", cursor:"pointer" }}
                            onMouseOver={ev => ev.currentTarget.style.background="rgba(245,158,11,.24)"}
                            onMouseOut={ev  => ev.currentTarget.style.background="rgba(245,158,11,.12)"}
                          >
                            <i className="fa-solid fa-pencil" style={{ fontSize:12 }} />
                          </button>
                          <button
                            onClick={() => eliminar(e.id)}
                            title="Eliminar estudiante"
                            style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(239,68,68,.12)", border:"none", borderRadius:8, color:"#ef4444", cursor:"pointer" }}
                            onMouseOver={ev => ev.currentTarget.style.background="rgba(239,68,68,.24)"}
                            onMouseOut={ev  => ev.currentTarget.style.background="rgba(239,68,68,.12)"}
                          >
                            <i className="fa-solid fa-trash" style={{ fontSize:12 }} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color:"#334155", fontSize:11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* pie tabla */}
          <div style={{ padding:"12px 20px", borderTop:"1px solid #1f2937", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ color:"#475569", fontSize:12, margin:0 }}>
              {filtrados.length} estudiante{filtrados.length!==1?"s":""} · {filtrados.filter(e=>!e.centroDualId).length} sin ficha dual
            </p>
            <p style={{ color:"#334155", fontSize:11, margin:0 }}>Ordenado alfabéticamente por apellidos</p>
          </div>
        </div>
      )}

      {/* ══ MODAL AGREGAR / EDITAR ══ */}
      {modal && (
        <div style={{ position:"fixed", inset:0, zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onMouseDown={ev => { if ((ev.target as HTMLElement).dataset.backdrop) { setModal(false); setEditId(null); } }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.70)", backdropFilter:"blur(4px)" }} data-backdrop="1" />
          <div style={{ position:"relative", width:"100%", maxWidth:600, background:"#111827", border:"1px solid #1f2937", borderRadius:18, boxShadow:"0 32px 80px rgba(0,0,0,.60)", overflow:"hidden", maxHeight:"92vh", display:"flex", flexDirection:"column" }}>

            {/* header modal */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid #1f2937" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"rgba(31,178,166,.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <i className={`fa-solid ${editId?"fa-pencil":"fa-user-plus"}`} style={{ color:"#1fb2a6", fontSize:14 }} />
                </div>
                <p style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, margin:0 }}>
                  {editId ? "Editar estudiante" : "Agregar estudiante"}
                </p>
              </div>
              <button onClick={()=>{ setModal(false); setEditId(null); }}
                style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,.04)", border:"1px solid #1f2937", color:"#475569", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="fa-solid fa-xmark" style={{ fontSize:13 }} />
              </button>
            </div>

            {/* body */}
            <div style={{ overflowY:"auto", flex:1, padding:24 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {[
                  { key:"apellidos",     label:"Apellidos *",          placeholder:"González Pérez" },
                  { key:"nombres",       label:"Nombres *",            placeholder:"Juan Andrés" },
                  { key:"run",           label:"RUN *",                placeholder:"12.345.678-9" },
                  { key:"email",         label:"Correo electrónico",   placeholder:"juan@email.com" },
                  { key:"telefono",      label:"Teléfono",             placeholder:"+56 9 1234 5678" },
                  { key:"especialidadId",label:"Especialidad",         placeholder:"Contabilidad" },
                  { key:"curso",         label:"Curso",                placeholder:"4° Medio A" },
                  { key:"nivel",         label:"Nivel",                placeholder:"4° Medio" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</p>
                    <input
                      value={(form as unknown as Record<string,string>)[key]}
                      onChange={ev => setForm(f => ({ ...f, [key]: ev.target.value }))}
                      placeholder={placeholder}
                      style={INP}
                      onFocus={ev  => ev.currentTarget.style.borderColor="#1fb2a6"}
                      onBlur={ev   => ev.currentTarget.style.borderColor="#1f2a3a"}
                    />
                  </div>
                ))}

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Estado</p>
                  <select value={form.estado} onChange={ev => setForm(f => ({ ...f, estado: ev.target.value as Estudiante["estado"] }))} style={SEL}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="egresado">Egresado</option>
                  </select>
                </div>

                <div>
                  <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.4px" }}>Centro Dual</p>
                  <input
                    value={form.centroDualId}
                    onChange={ev => setForm(f => ({ ...f, centroDualId: ev.target.value }))}
                    placeholder="ID del centro dual (opcional)"
                    style={INP}
                    onFocus={ev => ev.currentTarget.style.borderColor="#1fb2a6"}
                    onBlur={ev  => ev.currentTarget.style.borderColor="#1f2a3a"}
                  />
                </div>
              </div>
            </div>

            {/* footer */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, padding:"18px 24px", borderTop:"1px solid #1f2937" }}>
              <button onClick={()=>{ setModal(false); setEditId(null); }}
                style={{ padding:"10px 20px", background:"rgba(255,255,255,.04)", border:"1px solid #1f2937", borderRadius:9, color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding:"10px 24px", background: guardando?"#1e3a6e":"linear-gradient(135deg,#1fb2a6,#2563eb)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor: guardando?"not-allowed":"pointer", fontFamily:"'Inter',sans-serif", opacity: guardando?0.7:1 }}>
                <i className={`fa-solid ${guardando?"fa-spinner fa-spin":"fa-floppy-disk"}`} style={{ marginRight:7, fontSize:12 }} />
                {guardando ? "Guardando…" : editId ? "Guardar cambios" : "Agregar estudiante"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
