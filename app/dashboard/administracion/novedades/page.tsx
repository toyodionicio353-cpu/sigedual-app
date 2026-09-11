"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { Megaphone, Trash2, Send, FileText, ExternalLink, Eye } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import EditorNovedad from "@/components/novedades/EditorNovedad";
import SubirFotos from "@/components/novedades/SubirFotos";
import { MAX_TITULO, caracteresUsados, resumen } from "@/lib/novedades/texto";
import {
  DURACIONES_DIAS, DURACIONES_DIAS_INDEPENDIENTE, MAX_POR_SEMESTRE,
  expiracionDesdeDias, idCupo, periodoDe, estaVigente,
  esEditorIndependiente, LICEO_SIGEDUAL,
} from "@/lib/novedades/semestre";
import { formatearFecha } from "@/lib/fecha";
import type { FuenteNovedad, ImagenNovedad, Novedad, SegmentoTexto } from "@/types";

const ROLES_OK = ["desarrollador", "director", "coordinador"];

export default function NuevaNovedadPage() {
  const { usuario } = useAuth();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState<SegmentoTexto[]>([]);
  const [fuente, setFuente] = useState<FuenteNovedad>("inter");
  const [imagenes, setImagenes] = useState<ImagenNovedad[]>([]);
  const [dias, setDias] = useState(60);

  const [mias, setMias] = useState<Novedad[]>([]);
  const [deOtros, setDeOtros] = useState<Novedad[]>([]);
  const [publicadasSemestre, setPublicadasSemestre] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // Carpeta de Storage fija para esta sesión de redacción: así las fotos
  // subidas antes de publicar quedan agrupadas y se pueden limpiar.
  const [borradorId] = useState(() => `novedad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const autorizado = usuario ? ROLES_OK.includes(usuario.rol) : false;
  // SIGEDUAL publica en su propio nombre, no como uno de los liceos.
  const independiente = esEditorIndependiente(usuario?.rol);
  const liceoId = independiente ? LICEO_SIGEDUAL : (usuario?.liceoId ?? "");

  const cargar = useCallback(async () => {
    if (!usuario || !autorizado) { setCargando(false); return; }
    setCargando(true);
    try {
      // Lo propio siempre completo: publicado, borradores e historial ya
      // vencido. Cada liceo administra lo suyo, y que una publicación de
      // otro se vea en público no significa que se pueda gestionar acá.
      const snapPropias = await getDocs(query(collection(db, "novedades"), where("liceoId", "==", liceoId)));
      const propias = snapPropias.docs.map((d) => ({ id: d.id, ...d.data() } as Novedad));
      setMias(propias.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? "")));

      if (independiente) {
        // SIGEDUAL ve además lo que los liceos tienen publicado AHORA
        // MISMO, para saber qué hay en el escaparate común. Su historial
        // vencido no: eso es de cada establecimiento.
        const snapOtras = await getDocs(query(collection(db, "novedades"), where("estado", "==", "publicada")));
        const ahora = new Date();
        setDeOtros(
          snapOtras.docs
            .map((d) => ({ id: d.id, ...d.data() } as Novedad))
            .filter((n) => n.liceoId !== liceoId && estaVigente(n.expiraEn, ahora))
            .sort((a, b) => (b.publicadoEn ?? "").localeCompare(a.publicadoEn ?? ""))
        );
      } else {
        setDeOtros([]);
      }

      // El editor independiente no tiene cupo semestral que consultar.
      if (!independiente) {
        const periodo = periodoDe();
        const cupo = await getDoc(doc(db, "cupos_novedades", idCupo(liceoId, periodo)));
        setPublicadasSemestre(cupo.exists() ? (cupo.data().publicadas as number) ?? 0 : 0);
      }
    } catch {
      setError("No se pudo cargar la información de novedades.");
    } finally {
      setCargando(false);
    }
  }, [usuario, autorizado, liceoId, independiente]);

  useEffect(() => { cargar(); }, [cargar]);

  const usados = caracteresUsados(descripcion);
  const restantes = Math.max(0, MAX_POR_SEMESTRE - publicadasSemestre);
  const sinCupo = !independiente && restantes === 0;

  // El título es obligatorio; el contenido puede ser texto, fotografías o
  // ambas cosas, pero no puede faltar todo: un título suelto no le dice
  // nada a quien lo lea en la sección pública.
  const hayContenido = usados > 0 || imagenes.length > 0;
  const puedePublicar = useMemo(
    () => titulo.trim().length > 0 && hayContenido && !sinCupo && !guardando,
    [titulo, hayContenido, sinCupo, guardando]
  );

  function limpiar() {
    setTitulo("");
    setDescripcion([]);
    setImagenes([]);
    setDias(60);
  }

  async function guardarBorrador() {
    if (!usuario || guardando) return;
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      // Un borrador NO consume cupo: solo se descuenta al publicar.
      await setDoc(doc(db, "novedades", borradorId), {
        liceoId, liceoNombre: "", titulo: titulo.trim(), descripcion, fuente, imagenes,
        estado: "borrador", creadoPor: usuario.uid, creadoPorNombre: usuario.nombre,
        creadoEn: new Date().toISOString(),
      });
      setAviso("Borrador guardado. No consume ninguno de tus anuncios del semestre.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el borrador.");
    } finally {
      setGuardando(false);
    }
  }

  async function publicar() {
    if (!usuario || !auth.currentUser || guardando) return;
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/novedades/publicar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          borradorId,
          titulo: titulo.trim(),
          descripcion,
          fuente,
          imagenes,
          expiraEn: expiracionDesdeDias(dias, new Date(), independiente).toISOString(),
        }),
      });
      const data = (await res.json()) as { error?: string; publicadas?: number };
      if (!res.ok) { setError(data.error || "No se pudo publicar la novedad."); return; }

      if (typeof data.publicadas === "number") setPublicadasSemestre(data.publicadas);
      setAviso("Publicación creada. Ya aparece en Noticias y novedades.");
      limpiar();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar la novedad.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(n: Novedad) {
    if (!usuario) return;
    if (!confirm(`¿Eliminar esta publicación?\n\nEsta acción quitará "${n.titulo}" de Noticias y novedades.`)) return;
    try {
      await deleteDoc(doc(db, "novedades", n.id));
      // Las fotos se borran de Storage para no dejarlas huérfanas.
      await Promise.all((n.imagenes ?? []).map((img) =>
        deleteObject(ref(storage, img.ruta)).catch(() => {})
      ));
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: "eliminar_novedad", recurso: "novedades", recursoId: n.id,
        resultado: "permitido", detalle: n.titulo,
      });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la publicación.");
    }
  }

  if (usuario && !autorizado) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <TituloPagina icon={<Megaphone size={28} />}>Nueva novedad</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1 mb-6">
        Las publicaciones aparecen en <strong>Noticias y novedades</strong>, la sección pública de SIGEDUAL que se ve desde la pantalla de acceso, junto a las de los demás liceos.
      </p>

      {/* Cupo del semestre. SIGEDUAL no lo tiene: ese cupo reparte un
          recurso entre establecimientos y SIGEDUAL no es uno de ellos. */}
      {independiente ? (
        <div
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          className="rounded-2xl p-4 mb-5"
        >
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider">
            Publicas como
          </p>
          <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold">SIGEDUAL</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-0.5">
            Sin límite de publicaciones y con plazos de hasta un año. El cupo de 20 por semestre es de cada establecimiento, no tuyo.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-card)",
            border: `1px solid ${sinCupo ? "var(--danger)" : "var(--border)"}`,
          }}
          className="rounded-2xl p-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider">
              Anuncios publicados este semestre
            </p>
            <p style={{ color: sinCupo ? "var(--danger)" : "var(--text-primary)" }} className="text-2xl font-black">
              {publicadasSemestre} / {MAX_POR_SEMESTRE}
            </p>
          </div>
          <p style={{ color: sinCupo ? "var(--danger)" : "var(--text-secondary)" }} className="text-sm">
            {sinCupo
              ? "Límite semestral alcanzado. El cupo se renueva al comenzar el próximo semestre."
              : `Te ${restantes === 1 ? "queda 1 anuncio disponible" : `quedan ${restantes} anuncios disponibles`}.`}
          </p>
        </div>
      )}

      {/* Formulario */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
        <div>
          <label htmlFor="titulo-novedad" style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">
            Título
          </label>
          <input
            id="titulo-novedad"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value.slice(0, MAX_TITULO))}
            placeholder="Ej: Postulación a Especialidades Técnico Profesionales 2027"
            style={inputStyle}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
          />
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">{titulo.length} / {MAX_TITULO}</p>
        </div>

        <SubirFotos imagenes={imagenes} onCambiar={setImagenes} carpeta={`novedades/${liceoId}/${borradorId}`} deshabilitado={guardando} />

        <EditorNovedad
          descripcion={descripcion}
          fuente={fuente}
          onCambiar={(c) => {
            if (c.descripcion) setDescripcion(c.descripcion);
            if (c.fuente) setFuente(c.fuente);
          }}
          deshabilitado={guardando}
        />

        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">
            Tiempo de publicación
          </label>
          <div className="w-56">
            <Select
              value={String(dias)}
              onChange={(v) => setDias(Number(v))}
              ariaLabel="Tiempo de publicación"
              disabled={guardando}
              opciones={(independiente ? DURACIONES_DIAS_INDEPENDIENTE : DURACIONES_DIAS).map((d) => ({
                value: String(d),
                label: d === 365 ? "1 año (máximo)" : d === 180 ? "6 meses" : d === 90 ? "3 meses" : d === 60 ? (independiente ? "2 meses" : "2 meses (máximo)") : `${d} días`,
              }))}
            />
          </div>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
            Dejará de verse el {formatearFecha(expiracionDesdeDias(dias, new Date(), independiente).toISOString())}.{" "}
            {independiente ? "Como SIGEDUAL puedes llegar hasta un año." : "Una publicación de un liceo nunca dura más de dos meses."}
          </p>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3 flex flex-col gap-1">
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            Necesitas un <strong>título</strong> y, además, texto o al menos una fotografía. Puedes publicar solo con fotos, solo con texto, o con ambas cosas.
          </p>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            Una vez publicada <strong>no se puede editar</strong>. Si hay un error, elimínala y crea otra.
          </p>
        </div>

        {error && <p style={{ color: "var(--danger)" }} className="text-sm">{error}</p>}
        {aviso && <p style={{ color: "var(--success)" }} className="text-sm">{aviso}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={publicar}
            disabled={!puedePublicar}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            <Send size={15} /> {guardando ? "Publicando..." : "Publicar novedad"}
          </button>
          <button
            onClick={guardarBorrador}
            disabled={guardando || (!titulo.trim() && usados === 0 && imagenes.length === 0)}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
          >
            <FileText size={15} /> Guardar borrador
          </button>
          <Link
            href="/novedades"
            target="_blank"
            style={{ color: "var(--accent-light)" }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline ml-auto"
          >
            Ver la sección pública <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Publicaciones del liceo */}
      <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mt-8 mb-3">
        {independiente ? "Tus publicaciones" : "Publicaciones de tu liceo"}
      </h2>

      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : mias.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }} className="text-sm">Todavía no has creado ninguna publicación.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mias.map((n) => {
            const vigente = n.estado === "publicada" && estaVigente(n.expiraEn);
            const etiqueta = n.estado === "borrador" ? "Borrador" : vigente ? "Publicada" : "Expirada";
            const color = n.estado === "borrador" ? "var(--text-muted)" : vigente ? "var(--success)" : "var(--warning)";
            return (
              <div
                key={n.id}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                className="rounded-xl p-3 flex items-center gap-3"
              >
                {n.imagenes?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.imagenes[0].url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div style={{ background: "var(--bg-surface)" }} className="w-12 h-12 rounded-lg flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">
                    {n.titulo || "(sin título)"}
                  </p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs truncate">
                    {resumen(n.descripcion ?? [], 80).texto || "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span style={{ color, background: `${color}22` }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {etiqueta}
                    </span>
                    {n.estado === "publicada" && (
                      <span style={{ color: "var(--text-muted)" }} className="text-[10px] inline-flex items-center gap-1">
                        <Eye size={10} /> {n.visualizaciones ?? 0}
                      </span>
                    )}
                    {n.expiraEn && (
                      <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
                        {vigente ? `Hasta el ${formatearFecha(n.expiraEn)}` : `Expiró el ${formatearFecha(n.expiraEn)}`}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => eliminar(n)}
                  title="Eliminar publicación"
                  aria-label={`Eliminar ${n.titulo}`}
                  style={{ color: "var(--danger)" }}
                  className="p-2 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lo que los liceos tienen publicado ahora mismo. Solo lectura: su
          historial y su gestión son de cada establecimiento. */}
      {independiente && deOtros.length > 0 && (
        <>
          <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mt-8 mb-1">
            Publicado por los liceos
          </h2>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">
            Lo que está vigente ahora mismo en la sección pública. Cada establecimiento administra lo suyo, así que desde aquí solo se consulta.
          </p>
          <div className="flex flex-col gap-2">
            {deOtros.map((n) => (
              <Link
                key={n.id}
                href={`/novedades/${n.id}`}
                target="_blank"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                className="rounded-xl p-3 flex items-center gap-3 hover:[border-color:var(--accent)] transition-colors"
              >
                {n.imagenes?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.imagenes[0].url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div style={{ background: "var(--bg-surface)" }} className="w-12 h-12 rounded-lg flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{n.titulo}</p>
                  <p style={{ color: "var(--accent-light)" }} className="text-xs font-semibold truncate">{n.liceoNombre || "Liceo"}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span style={{ color: "var(--text-muted)" }} className="text-[10px] inline-flex items-center gap-1">
                      <Eye size={10} /> {n.visualizaciones ?? 0}
                    </span>
                    {n.expiraEn && (
                      <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
                        Hasta el {formatearFecha(n.expiraEn)}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
