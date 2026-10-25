# Tipografía de los títulos — PW Filament

Los títulos de pantalla usan **PW Filament**. El archivo de la fuente **no
está en el repositorio** y hay que dejarlo acá con uno de estos nombres:

    public/fonts/pw-filament.woff2   (preferido)
    public/fonts/pw-filament.woff
    public/fonts/pw-filament.ttf

Basta con uno. Si no hay ninguno, la aplicación **no se rompe**: los
títulos se ven con la tipografía anterior (Space Grotesk).

## Por qué no está incluida

PW Filament es de Peax Webdesign y su licencia es **gratuita solo para uso
personal**. SIGEDUAL se ofrece con planes de pago, o sea uso comercial, así
que hace falta una licencia comercial del autor. Subir el archivo al
repositorio sería redistribuirla, y eso la licencia no lo permite.

Antes de poner el archivo acá, consigue la licencia comercial.

## Convertir a woff2

Si el autor entrega un .ttf o .otf, conviene convertirlo a woff2: pesa
bastante menos y carga antes. Se puede con `fonttools`:

    pip install "fonttools[woff]"
    fonttools ttLib.woff2 compress -o pw-filament.woff2 PWFilament.ttf
