# PW Filament — tipografía de los títulos de pantalla

`pw-filament-es.woff2` es la fuente que usan los títulos (`--font-titulo`
en `app/globals.css`).

## No es el archivo original

Al PWFilament.ttf original **le faltaban todos los caracteres del
español**: las vocales acentuadas, la ñ, la ü y los signos de apertura
`¿` `¡`. Solo traía ASCII (103 glifos). Un título como "Formación" salía
con un cuadro vacío en medio, y eso afectaba a 1 de cada 4 títulos de
SIGEDUAL.

`componer-acentos.py` compone los 17 caracteres que faltaban **a partir
de los trazos de la propia fuente**, sin dibujar nada nuevo:

| Carácter | De dónde sale |
|---|---|
| á é í ó ú Á É Í Ó Ú | `slash` reducido al 26 % |
| ñ Ñ | `asciitilde` reducido al 55 % |
| ü Ü | dos copias de `period` |
| ¿ ¡ | `question` y `exclam` girados 180° |
| · | `period` subido a media altura |

La í y la Í se componen sobre una i **sin punto**: el punto se quita
descartando los contornos que están por encima de la altura de la x.
Dejarlo pondría dos marcas sobre la misma letra.

También se subió el tope de ascendentes de 802 a 1052: el original estaba
calculado para un alfabeto sin acentos, y el navegador recortaba la punta
de la Á y la Ñ.

## Volver a generarlo

Hace falta el PWFilament.ttf original:

    pip install "fonttools[woff]"
    python3 componer-acentos.py PWFilament.ttf pw-filament-es.ttf
    fonttools ttLib.woff2 compress -o pw-filament-es.woff2 pw-filament-es.ttf

## Licencia

PW Filament es de Peax Webdesign. En FontSpace figura como **freeware no
comercial**: el uso comercial requiere licenciarla con el autor. SIGEDUAL
se ofrece con planes de pago. Asegúrate de tener esa licencia, que además
cubra el derecho a modificar la fuente — componer los acentos es una
modificación.
