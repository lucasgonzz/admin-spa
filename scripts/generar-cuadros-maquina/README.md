# Generador de los cuadros de la máquina

> 🔴 **DEFERIDO desde el 31/8/2026 -- este generador NO produjo la tira que hoy se
> shippea en `public/demo/maquina/`.** La animación corregida de Claude Design cerró el
> loop de la máquina a 24,75s (antes 12s) y cambió el aspecto del encuadre a 1,5 (antes
> 1,65306, ver `marca/animacion-hero/README.md` del repo de conocimiento). El WebP animado
> que se shippeó sale de re-encodear con `ffmpeg` los 594 PNG que Lucas ya renderizó y
> aprobó (fuera de este repo -- ver "De dónde salió la tira que se shippea" más abajo),
> **no de correr `generar.mjs`**, que sigue escrito contra el diseño viejo
> (`escena-determinista.js`, con su cabecera de obsolescencia) y produciría una máquina
> distinta si se lo corriera tal cual.
>
> `machine.js` en esta misma carpeta **ya es la copia actualizada** (viene del repo de
> conocimiento, trae `initStatic()`/`renderAt()`/`LOOP_T` con las frecuencias correctas) y
> está lista para que `generar.mjs` la use en vez de `escena-determinista.js` -- ese
> repunte, más la verificación de que reproduce los PNG de Lucas byte a byte, quedó fuera
> del alcance de esta misión por tiempo. Es el próximo trabajo de esta carpeta.

La máquina que se ve en el centro de la escena hero de `/experiencia/:uuid` **no se
renderiza en vivo**: es un WebP animado con alfa que se muestra en un `<img>`. Acá vive
la herramienta para regenerarlo cuando cambie el diseño (una vez hecho el repunte de
arriba).

## De dónde salió la tira que se shippea (31/8/2026)

Sin pasar por este generador: Lucas exportó la escena corregida desde Claude Design junto
con 594 cuadros PNG ya renderizados (loop completo a 24 fps, dos resoluciones —
1200×800 y 600×400), y esos PNG se re-encodearon directo a WebP animado con `ffmpeg`,
partiendo siempre de la tira de **600×400** (la de 1200×800 no se usó: ver "Presupuesto"
más abajo, no entraba ni cerca).

**Comando exacto que produjo lo que hoy está en `public/demo/maquina/`** -- si los 594 PNG
del export desaparecen del disco de Lucas antes de que alguien mueva esto a un generador
de verdad, esto es lo único que queda para reproducirlo:

```bash
# escritorio -- 600x400, 12 fps, calidad 55 -- 1.991 KiB (tope 2.048 KiB)
ffmpeg -framerate 24 -i frames-600x400/f%04d.png \
  -vf "fps=12" -pix_fmt yuva420p \
  -c:v libwebp_anim -lossless 0 -q:v 55 -compression_level 4 -loop 0 -an \
  public/demo/maquina/maquina-escritorio.webp

# telefono -- 300x200, 6 fps, calidad 28 -- 799 KiB (tope 800 KiB, CASI SIN MARGEN)
ffmpeg -framerate 24 -i frames-600x400/f%04d.png \
  -vf "fps=6,scale=300:200:flags=lanczos" -pix_fmt yuva420p \
  -c:v libwebp_anim -lossless 0 -q:v 28 -compression_level 4 -loop 0 -an \
  public/demo/maquina/maquina-telefono.webp
```

`-compression_level 6` (el más alto) resultó **impracticable en esta máquina**: más de
15 minutos sin terminar sobre los 594 cuadros, contra menos de un minuto con
`-compression_level 4` para el mismo resultado -- si alguien vuelve a tocar este comando,
que no suba ese número sin medir cuánto tarda antes de confiar en que va a terminar.

🔴 **El perfil teléfono NO quedó en 360×240 como preveía el plan de la misión, y quedó sin
margen de presupuesto.** El loop de 24,75s a 594 cuadros no entraba en 800 KiB ni a 360×240
ni bajando fps solo -- hizo falta además recortar la resolución a 300×200 y la calidad a
28 (visible en degradés, sobre todo la pantalla de la máquina). El de escritorio sí entró
con solo bajar fps (12) y una calidad moderada (55), sin tocar resolución. Si el próximo
que toque esto necesita más margen en teléfono, la única palanca que queda es aceptar un
loop más corto (menos de 594 cuadros reales, no solo menos fps de muestreo) o pedir un
export con menos duración.

Esto **no es parte del build de la SPA**. Se corre a mano, cuando cambia el diseño de la
máquina, y su salida (`public/demo/maquina/`) se versiona.

```bash
cd scripts/generar-cuadros-maquina
npm install                 # playwright + three, sólo para esto
npx playwright install chromium

cd ../..
node scripts/generar-cuadros-maquina/generar.mjs
```

## Por qué existe

Lucas, 7/8/2026: *"sigue andando bastante lento… lo que quedaría hacer es o hacer que se
precargue mientras estoy viendo los dolores, o directamente montarlo como un video en
loop o como un GIF"*, y *"no me importa sacrificar el funcionamiento del scroll con tal
de que fluya y se aprecie bien"*.

La escena en vivo era WebGL con antialias, cuatro luces, geometrías extruidas con
`curveSegments: 22` y dos texturas, sesenta veces por segundo. Lo que quedó es dibujar
una imagen ya decodificada: órdenes de magnitud menos trabajo, y la fluidez deja de
depender de la máquina del lead.

Se perdió la reacción de la máquina al scroll (`power` y `suck`), a propósito. Se
conservó el resplandor del centro, que es CSS.

## Qué hay acá

| Archivo | Qué es |
|---|---|
| `escena-determinista.js` | 🔴 **OBSOLETO** (ver su propia cabecera): la reimplementación a mano de la escena que usaba `generar.mjs` hasta el 31/8/2026. Sus tres números clave (loop de 12s, frecuencias, aspecto 1,65306) ya no valen. No se borró todavía -- ver "DEFERIDO" arriba. |
| `machine.js` | La escena **actualizada**, copia textual de `marca/animacion-hero/machine.js` del repo de conocimiento. `generar.mjs` todavía NO la usa (ver "DEFERIDO" arriba) -- es el reemplazo listo para cuando alguien haga el repunte. |
| `generar.mjs` | Abre la escena en Chromium, le fija el reloj a mano de a pasos, guarda cada cuadro como WebP y escribe el manifiesto. **Hoy sigue importando `escena-determinista.js`** (obsoleto): correrlo tal cual generaría una máquina distinta de la que se shippea. |
| `comparar-con-el-original.mjs` | Mide cuánto se aparta el pre-render de la escena que había antes (la versión en vivo con three, borrada en la misión 12). Evidencia histórica, no herramienta de uso diario. |
| `ultimo-reporte.json` | Lo que devolvió la última corrida REAL de `generar.mjs` -- es de **antes** de esta misión (loop de 12s, 120 cuadros): no se regeneró, porque el generador no corrió esta vez. Los números de la tabla "Última corrida" más abajo son ese reporte viejo, no la tira que hoy se shippea. |

## Las dos cosas que hay que entender antes de tocar `escena-determinista.js` (obsoleto)

Esta sección describe cómo funcionaba **el generador viejo** (loop de 12s, aspecto
1,65306). Sigue acá como referencia de la técnica -- cuantización de frecuencias, doble
medición del cierre del loop -- porque `machine.js` la hereda con números distintos
(`LOOP_T = 24,75`, frecuencias ya cuantizadas de fábrica). No describe la tira que se
shippea hoy: esa se explica en "De dónde salió la tira que se shippea" más arriba.

**1. El loop tiene que cerrar.** La escena mezcla senos de frecuencias que no son
múltiplos entre sí y engranajes que acumulan rotación, así que el último cuadro no
empalma con el primero por sí solo. El generador viejo cuantizaba cada frecuencia al
armónico entero del loop más cercano y le daba a cada engranaje un número entero de pasos
de diente -- mismo criterio que ya trae `machine.js`, con `LOOP_T` distinto.

Eso se verificaba con **dos mediciones distintas, y hacían falta las dos**:

| Medición | Qué compara | Última corrida (loop de 12s, YA NO VIGENTE) |
|---|---|---|
| `cierre_en_el_render` | Los píxeles del render en `t = 0` contra `t = T`, en memoria, antes de comprimir. Prueba que la **cuantización** cierra. | **0 % de píxeles distintos** en las dos tiras (control contra la mitad del loop: 34 %, así que el cero no es una medición rota) |
| `cierre_en_los_archivos` | Los WebP **ya escritos**, decodificados como los va a decodificar el navegador: el salto `0119 → 0000` contra la distribución de los 119 saltos consecutivos. Prueba que **no se ve** el empalme. | escritorio: salto de 21,3 % contra un rango normal de 17,8-22,9 % → **percentil 86**. Teléfono: 30,5 % contra 25,8-31,5 % → percentil 85. |

Por qué las dos: el 0 % del render **no dice nada sobre lo que se ve**. Con la compresión
WebP en el medio, dos cuadros consecutivos cualesquiera difieren en un 18-23 % de sus
píxeles — o sea que un 21 % en el empalme no es un salto, es un cuadro más. Leer solo el
0 % daría una falsa sensación de exactitud bit a bit que no existe; leer solo el 21 %
sonaría a que el loop no cierra. Lo que importa es que el salto del cierre **se confunda
con los demás**, y eso es lo que dice el percentil. Para la tira que se shippea hoy no se
repitió esta medición del lado del generador -- se midió en cambio, a mano, que
`fraccion_borde` cierra sobre los píxeles reales del WebP shippeado (ver el commit de esta
misión).

**2. El aspecto de las tiras no era arbitrario, para ESE generador.** 1,6531 era el punto
exacto donde la escena en vivo dejaba de alejar la cámara con ese `ASPECTO` fijo. El
`machine.js` nuevo calcula la misma fórmula de cámara dentro de `initStatic(w, h)`, así
que **sigue siendo cierto en general** -- pero la tira que se shippea hoy se generó a
1,5 (decisión de Lucas, documentada en `marca/animacion-hero/README.md` del repo de
conocimiento), no a 1,65306. `manifiesto.json` en `public/demo/maquina/` es la fuente de
verdad del aspecto vigente, no este número.

## Presupuesto

**Lo que se shippeó el 31/8/2026** (WebP animado, un archivo por perfil -- no cuadros
sueltos, ver "De dónde salió la tira que se shippea" arriba):

| Perfil | Tamaño | Cuadros | fps | Peso | Presupuesto |
|---|---|---|---|---|---|
| escritorio | 600×400 | 594 (loop completo) | 12 | 1.991 KiB | 2.048 KiB |
| teléfono | 300×200 | 594 (loop completo) | 6 | 799 KiB | 800 KiB (**sin margen**) |

Para referencia histórica, lo que generaba el pipeline viejo (120 cuadros sueltos, loop de
12s, ya no vigente):

| Perfil | Tamaño | Cuadros | Peso | Presupuesto |
|---|---|---|---|---|
| escritorio | 640x387 | 120 @ 10 fps | 1352 kB | 2048 kB |
| teléfono | 320x194 | 120 @ 10 fps | 673 kB | 800 kB |

Si una tira se pasa del presupuesto, el criterio (viejo y nuevo) es el mismo: **bajar
cuadros por segundo antes que calidad** -- el movimiento es lento y tolera mejor menos
cuadros que compresión sucia. El generador viejo automatizaba esto con `FPS_CANDIDATOS`;
la tira nueva se ajustó a mano (ver el comando exacto arriba) porque no pasó por
`generar.mjs`. En teléfono no alcanzó con bajar fps sola: hizo falta además bajar
resolución y calidad -- ver el aviso 🔴 en "De dónde salió la tira que se shippea".
