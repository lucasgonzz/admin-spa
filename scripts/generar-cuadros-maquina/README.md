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
1200×800 y 600×400), y esos PNG se re-encodearon directo a WebP animado con `ffmpeg`:

```bash
ffmpeg -framerate 24 -i frames/f%04d.png \
  -vf "fps=12[,scale=360:240:flags=lanczos]" -pix_fmt yuva420p \
  -c:v libwebp_anim -lossless 0 -q:v <calidad> -compression_level 4 -loop 0 -an \
  public/demo/maquina/maquina-<perfil>.webp
```

`-compression_level 6` (el más alto) resultó **impracticable en esta máquina**: más de
15 minutos sin terminar sobre los 594 cuadros, contra menos de un minuto con
`-compression_level 4` para el mismo resultado -- si alguien vuelve a tocar este comando,
que no suba ese número sin medir cuánto tarda antes de confiar en que va a terminar.

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
| `escena-determinista.js` | La escena. **Es la última copia viva de la geometría**: el módulo que la renderizaba en la SPA se borró. El diseño original sigue en `marca/animacion-hero/machine.js` del repo de conocimiento. |
| `generar.mjs` | Abre la escena en Chromium, le fija el reloj a mano de a pasos, guarda cada cuadro como WebP y escribe el manifiesto. |
| `comparar-con-el-original.mjs` | Mide cuánto se aparta el pre-render de la escena que había antes. Evidencia, no herramienta de uso diario. |
| `ultimo-reporte.json` | Lo que devolvió la última corrida de `generar.mjs`. |

## Las dos cosas que hay que entender antes de tocar esto

**1. El loop tiene que cerrar.** La escena mezcla senos de frecuencias que no son
múltiplos entre sí y engranajes que acumulan rotación, así que el último cuadro no
empalma con el primero por sí solo. El generador cuantiza cada frecuencia al armónico
entero del loop más cercano y le da a cada engranaje un número entero de pasos de diente.

Eso se verifica con **dos mediciones distintas, y hacen falta las dos**:

| Medición | Qué compara | Última corrida |
|---|---|---|
| `cierre_en_el_render` | Los píxeles del render en `t = 0` contra `t = T`, en memoria, antes de comprimir. Prueba que la **cuantización** cierra. | **0 % de píxeles distintos** en las dos tiras (control contra la mitad del loop: 34 %, así que el cero no es una medición rota) |
| `cierre_en_los_archivos` | Los WebP **ya escritos**, decodificados como los va a decodificar el navegador: el salto `0119 → 0000` contra la distribución de los 119 saltos consecutivos. Prueba que **no se ve** el empalme. | escritorio: salto de 21,3 % contra un rango normal de 17,8-22,9 % → **percentil 86**. Teléfono: 30,5 % contra 25,8-31,5 % → percentil 85. |

Por qué las dos: el 0 % del render **no dice nada sobre lo que se ve**. Con la compresión
WebP en el medio, dos cuadros consecutivos cualesquiera difieren en un 18-23 % de sus
píxeles — o sea que un 21 % en el empalme no es un salto, es un cuadro más. Leer solo el
0 % daría una falsa sensación de exactitud bit a bit que no existe; leer solo el 21 %
sonaría a que el loop no cierra. Lo que importa es que el salto del cierre **se confunda
con los demás**, y eso es lo que dice el percentil.

**2. El aspecto de las tiras no es arbitrario.** Es el punto exacto donde la escena
original dejaba de alejar la cámara (1,6531), lo que hace que dibujar la tira con
`contain` reproduzca el encuadre viejo en cualquier tamaño de pantalla. El porqué
completo está en el comentario `ENCUADRE` de `escena-determinista.js`. Cambiarlo sin leer
eso deja la máquina de otro tamaño respecto del resto de la escena, y nada avisa.

## Presupuesto

| Perfil | Tamaño | Cuadros | Peso | Presupuesto |
|---|---|---|---|---|
| escritorio | 640x387 | 120 @ 10 fps | 1352 kB | 2048 kB |
| teléfono | 320x194 | 120 @ 10 fps | 673 kB | 800 kB |

Si una tira se pasa del presupuesto, el generador **baja los cuadros por segundo, no la
calidad**: el movimiento es lento y tolera mejor menos cuadros que compresión sucia. Los
candidatos están en `FPS_CANDIDATOS` y gana el primero que entre.
