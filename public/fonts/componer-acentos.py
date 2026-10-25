"""
Compone las letras acentuadas que PW Filament no trae.

No se dibuja ningún trazo nuevo: cada acento sale de un trazo que YA está
en la fuente, escalado y colocado sobre la letra base. Así conserva el
grosor y el estilo de doble línea del resto, en vez de parecer pegado de
otra tipografía.

  acute (á)     <- slash, muy reducido: un acento agudo es justo eso,
                   un trazo inclinado
  tilde (ñ)     <- asciitilde, reducido
  dieresis (ü)  <- dos copias de period
  ¿ ¡           <- question y exclam girados 180°

La í y la Í se componen sobre una i SIN punto: el punto se quita
descartando los contornos que están por encima de la altura de la x, que
en esta fuente son exactamente los del punto. Dejarlo sería escribir la
letra con dos marcas encima.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.misc.transform import Transform

ENTRADA, SALIDA = sys.argv[1], sys.argv[2]
f = TTFont(ENTRADA)
glyf, hmtx = f["glyf"], f["hmtx"]

ESCALA_ACUTE = 0.26
ESCALA_TILDE = 0.55
ESCALA_DIERESIS = 0.95
AIRE = 55          # separación entre la letra y el acento
CORTE_PUNTO = 600  # por encima de esto, en la i, solo está el punto

def caja(g):
    g.recalcBounds(glyf)
    return (g.xMin, g.yMin, g.xMax, g.yMax)

def trazo(g):
    p = RecordingPen(); g.draw(p, glyf); return p

def sin_punto(nombre):
    """La misma letra, descartando los contornos del punto."""
    g = glyf[nombre]
    coords, endPts, flags = g.getCoordinates(glyf)
    pen = TTGlyphPen(None)
    ini = 0
    for fin in endPts:
        pts = coords[ini:fin + 1]
        fl = flags[ini:fin + 1]
        if min(p[1] for p in pts) < CORTE_PUNTO:      # no es el punto
            pen.moveTo(pts[0])
            i = 1
            while i < len(pts):
                if fl[i] & 1:
                    pen.lineTo(pts[i]); i += 1
                else:
                    ctrl = pts[i]
                    sig = pts[i + 1] if i + 1 < len(pts) else pts[0]
                    pen.qCurveTo(ctrl, sig if (i + 1 >= len(pts) or fl[i + 1] & 1) else None)
                    i += 2
            pen.closePath()
        ini = fin + 1
    g2 = pen.glyph(); g2.recalcBounds(glyf)
    return g2

def guardar(nombre, piezas, ancho):
    pen = TTGlyphPen(glyf)
    for g, tr in piezas:
        trazo(g).replay(TransformPen(pen, tr))
    g = pen.glyph(); g.recalcBounds(glyf)
    glyf[nombre] = g
    hmtx[nombre] = (ancho, g.xMin if g.numberOfContours else 0)

def poner_acento(base_glifo, ancho, marca, escala, nombre, centrar_en=None):
    bx0, by0, bx1, by1 = caja(base_glifo)
    mg = glyf[marca]
    mx0, my0, mx1, my1 = caja(mg)
    centro = centrar_en if centrar_en is not None else (bx0 + bx1) / 2
    ax = (mx0 + mx1) / 2 * escala
    ay = my0 * escala
    tr = Transform().translate(centro - ax, by1 + AIRE - ay).scale(escala, escala)
    guardar(nombre, [(base_glifo, Transform()), (mg, tr)], ancho)

def poner_dieresis(base_glifo, ancho, nombre):
    bx0, by0, bx1, by1 = caja(base_glifo)
    pg = glyf["period"]
    px0, py0, px1, py1 = caja(pg)
    e = ESCALA_DIERESIS
    sep = (px1 - px0) * e * 1.25
    centro = (bx0 + bx1) / 2
    piezas = [(base_glifo, Transform())]
    for dx in (-sep, sep):
        ax = (px0 + px1) / 2 * e
        ay = py0 * e
        piezas.append((pg, Transform().translate(centro + dx - ax, by1 + AIRE - ay).scale(e, e)))
    guardar(nombre, piezas, ancho)

MAPA = [
 (0x00E1, "a", "acute", "aacute"), (0x00E9, "e", "acute", "eacute"),
 (0x00ED, "i", "acute", "iacute"), (0x00F3, "o", "acute", "oacute"),
 (0x00FA, "u", "acute", "uacute"), (0x00FC, "u", "dieresis", "udieresis"),
 (0x00F1, "n", "tilde", "ntilde"),
 (0x00C1, "A", "acute", "Aacute"), (0x00C9, "E", "acute", "Eacute"),
 (0x00CD, "I", "acute", "Iacute"), (0x00D3, "O", "acute", "Oacute"),
 (0x00DA, "U", "acute", "Uacute"), (0x00DC, "U", "dieresis", "Udieresis"),
 (0x00D1, "N", "tilde", "Ntilde"),
]

for cp, base, tipo, nombre in MAPA:
    # La i y la I pierden el punto antes de recibir el acento.
    bg = sin_punto(base) if base in ("i", "I") else glyf[base]
    ancho = hmtx[base][0]
    centro = None
    if base in ("i", "I"):
        x0, _, x1, _ = caja(glyf[base])
        centro = (x0 + x1) / 2
    if tipo == "acute":
        poner_acento(bg, ancho, "slash", ESCALA_ACUTE, nombre, centro)
    elif tipo == "tilde":
        poner_acento(bg, ancho, "asciitilde", ESCALA_TILDE, nombre, centro)
    else:
        poner_dieresis(bg, ancho, nombre)

# ¿ y ¡ : la misma marca girada 180°, bajada para que cuelgue de la línea.
for cp, origen, nombre in [(0x00BF, "question", "questiondown"), (0x00A1, "exclam", "exclamdown")]:
    og = glyf[origen]
    x0, y0, x1, y1 = caja(og)
    tr = Transform().translate(x0 + x1, y1 * 0.78).scale(-1, -1)
    guardar(nombre, [(og, tr)], hmtx[origen][0])

# Punto medio: aparece como separador en algunos títulos. Es el mismo
# punto de la fuente, subido a media altura.
_pg = glyf["period"]
_px0, _py0, _px1, _py1 = caja(_pg)
_altura_x = caja(glyf["o"])[3]
guardar("periodcentered", [(_pg, Transform().translate(0, _altura_x / 2 - _py0))], hmtx["period"][0])

nuevos = {cp: n for cp, _, _, n in MAPA}
nuevos[0x00B7] = "periodcentered"
nuevos[0x00BF] = "questiondown"
nuevos[0x00A1] = "exclamdown"
for st in f["cmap"].tables:
    if st.platformID in (0, 3):
        st.cmap.update(nuevos)

f["maxp"].recalc(f)
f.save(SALIDA)
print(f"Compuestos {len(nuevos)} caracteres -> {SALIDA}")

# Los acentos de las mayúsculas suben más que el tope declarado por la
# fuente original (pensado para un alfabeto sin acentos). Sin subir ese
# tope, el navegador recorta la punta del acento en Á, Ó o Ñ.
MARGEN = 30
alto = max(
    glyf[n].yMax for n in glyf.keys()
    if glyf[n].numberOfContours and hasattr(glyf[n], "yMax")
)
tope = alto + MARGEN
if f["hhea"].ascent < tope:
    f["hhea"].ascent = tope
if f["OS/2"].usWinAscent < tope:
    f["OS/2"].usWinAscent = tope
f.save(SALIDA)
print(f"Tope de ascendentes ajustado a {tope} para que no se recorten los acentos")
