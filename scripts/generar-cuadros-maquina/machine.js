/**
 * 🔴 COPIA TEXTUAL de `marca/animacion-hero/machine.js` del repo de conocimiento
 * (`lucasgonzz/claude-comerciocity`), traída acá el 31/8/2026 en reemplazo de
 * `escena-determinista.js` (borrado en el mismo commit). Antes esta carpeta mantenía una
 * REIMPLEMENTACIÓN a mano de la escena, con su propia cuantización de frecuencias y su
 * propio aspecto de cámara -- una copia paralela que dos correcciones del diseño (la de
 * esta misión y la anterior) dejaron desincronizada sin que nada avisara. Esta versión de
 * `machine.js` ya trae `initStatic(canvas, w, h)` + `renderAt(t, {power, suck})` con las
 * frecuencias ya cuantizadas de fábrica (`LOOP_T = 24.75`, ver la tabla `F` más abajo), así
 * que no hace falta reimplementar nada: alcanza con importarla.
 *
 * Para regenerar la tira con un diseño nuevo: pisar este archivo con la versión nueva de
 * `marca/animacion-hero/machine.js` (byte a byte, sin editar nada acá) y correr
 * `generar.mjs` de nuevo.
 */
import * as THREE from 'three';

const BLUE = 0x1B6FF5, INDIGO = 0x3A31FC, ORANGE = 0xFA7E06;

let renderer, scene, camera, root, clock, canvasEl;
let gears = [], leds = [], intakeRing, outputRing, logoGroup, screenMat;
let power = 0, suck = 0;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const range = (v, a, b) => clamp01((v - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

// --- loop cerrado: toda frecuencia es multiplo entero de W0 = 2*PI/T
export const LOOP_T = 24.75;
const W0 = (Math.PI * 2) / LOOP_T;   // 0.2538661
const F = {
  rotY:   W0 * 1,    // 0.2539  (era 0.30)
  rotX:   W0 * 1,    // 0.2539  (era 0.22)
  flota:  W0 * 2,    // 0.5077  (era 0.58)
  azul:   W0 * 9,    // 2.2848  (era 2.40)
  leds:   W0 * 16,   // 4.0619  (era 4.00)
  aroOut: W0 * 17,   // 4.3157  (era 4.20)
  aroIn:  W0 * 20    // 5.0773  (era 5.00)
};
const GEAR_W = W0;                   // 1 vuelta entera por ciclo

function M(name, o) { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; }

const mats = {
  cuerpo: M('cuerpo_blanco', { color: 0xF6F8FB, roughness: 0.36, metalness: 0.04 }),
  cuerpoLado: M('cuerpo_gris', { color: 0xE3E8EF, roughness: 0.42, metalness: 0.05 }),
  bisel: M('bisel', { color: 0x0D1521, roughness: 0.34, metalness: 0.3 }),
  aluminio: M('aluminio', { color: 0xC3CBD6, roughness: 0.26, metalness: 0.88 }),
  azul: M('luz_azul', { color: 0x1B6FF5, emissive: BLUE, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.1 }),
  indigo: M('luz_indigo', { color: 0x3A31FC, emissive: INDIGO, emissiveIntensity: 0.7, roughness: 0.32, metalness: 0.1 }),
  naranja: M('naranja', { color: 0xFA7E06, emissive: ORANGE, emissiveIntensity: 0.45, roughness: 0.34, metalness: 0.15 }),
  logoBlanco: M('logo_blanco', { color: 0xFFFFFF, roughness: 0.22, metalness: 0.05 })
};

function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 360;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 360);
  grad.addColorStop(0, '#0E6BFA');
  grad.addColorStop(0.55, '#2A56F8');
  grad.addColorStop(1, '#3A31FC');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 360);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w, h, d, r, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), {
    depth: Math.max(d - bevel * 2, 0.01), bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 14
  });
  g.center();
  return g;
}

function mesh(name, geom, material) { const m = new THREE.Mesh(geom, material); m.name = name; return m; }

function gearGeom(r, teeth, tooth, hole) {
  const s = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [[a + step * 0.03, r], [a + step * 0.17, r + tooth], [a + step * 0.33, r + tooth],
     [a + step * 0.47, r], [a + step * 0.75, r]].forEach(([ang, rad], k) => {
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  s.holes.push(new THREE.Path().absarc(0, 0, hole, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 22 });
  g.center();
  return g;
}

// ---- isotipo ComercioCity construido en 3D (arcos + barras + flecha)
function buildLogo(R) {
  const g = new THREE.Group(); g.name = 'isotipo_comerciocity';
  const tube = R * 0.16;

  const arcs = [
    ['arco_superior', 55, 130],
    ['arco_izquierdo', 137, 223],
    ['arco_inferior', 230, 330]
  ];
  arcs.forEach(([name, a0, a1]) => {
    const span = (a1 - a0) * D2R;
    const m = mesh(name, new THREE.TorusGeometry(R, tube, 12, 64, span), mats.logoBlanco);
    m.rotation.z = a0 * D2R;
    g.add(m);
  });

  const s = R / 103;
  [['barra_1', -38.5, -38, 52], ['barra_2', 0, -25.5, 77], ['barra_3', 38.5, -14.5, 99]].forEach(([name, cx, cy, hh]) => {
    const b = mesh(name, slab(28 * s, hh * s, tube * 1.6, 3 * s, 0.006), mats.logoBlanco);
    b.position.set(cx * s, cy * s, 0);
    g.add(b);
  });

  const tri = new THREE.Shape();
  tri.moveTo(12 * R / 103, -13 * R / 103);
  tri.lineTo(-14.5 * R / 103, -2 * R / 103);
  tri.lineTo(2.5 * R / 103, 15 * R / 103);
  tri.closePath();
  const ag = new THREE.ExtrudeGeometry(tri, { depth: tube * 1.4, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  ag.center();
  const arrow = mesh('flecha_marca', ag, mats.naranja);
  arrow.position.set(65 * s, 51 * s, 0);
  g.add(arrow);

  return g;
}

function buildMachine() {
  const g = new THREE.Group(); g.name = 'plataforma_comerciocity';
  const W = 2.7, H = 2.0, D = 1.05;

  const body = mesh('carcasa', slab(W, H, D, 0.24, 0.05), mats.cuerpo);
  g.add(body);

  const back = mesh('carcasa_trasera', slab(W - 0.16, H - 0.16, 0.1, 0.2, 0.02), mats.cuerpoLado);
  back.position.z = -(D / 2 + 0.03);
  g.add(back);

  const bezel = mesh('bisel_pantalla', slab(2.3, 1.62, 0.1, 0.18, 0.02), mats.bisel);
  bezel.position.z = D / 2 + 0.02;
  g.add(bezel);

  screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture(), emissiveMap: screenTexture(), emissive: 0xffffff,
    emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.0
  });
  screenMat.name = 'pantalla';
  const screen = mesh('pantalla', slab(2.06, 1.38, 0.05, 0.12, 0.012), screenMat);
  screen.position.z = D / 2 + 0.075;
  g.add(screen);

  logoGroup = buildLogo(0.5);
  logoGroup.position.set(0, 0.02, D / 2 + 0.12);
  g.add(logoGroup);

  // LEDs en el borde inferior
  for (let i = 0; i < 7; i++) {
    const led = mesh('led_' + (i + 1), new THREE.SphereGeometry(0.036, 18, 14), i === 3 ? mats.naranja : mats.azul);
    led.position.set(-0.54 + i * 0.18, -(H / 2 - 0.11), D / 2 + 0.04);
    led.userData.phase = i * 0.55;
    leds.push(led); g.add(led);
  }

  // engranajes semiocultos en la cara superior
  [['engranaje_mayor', 0.34, 16, 0.07, 0.09, -0.72, 0.62], ['engranaje_menor', 0.24, 12, 0.06, 0.07, 0.68, -0.78]].forEach(
    ([name, r, t, th, hole, x, spd]) => {
      const m = mesh(name, gearGeom(r, t, th, hole), mats.aluminio);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, H / 2 + 0.05, 0.02);
      m.userData.spd = spd;
      gears.push(m); g.add(m);
    });

  // entrada (izquierda)
  const funnel = mesh('boca_entrada', new THREE.CylinderGeometry(0.66, 0.32, 0.72, 40, 1, true), mats.aluminio);
  funnel.rotation.z = Math.PI / 2;
  funnel.position.x = -(W / 2 + 0.3);
  funnel.material.side = THREE.DoubleSide;
  g.add(funnel);

  intakeRing = mesh('aro_entrada', new THREE.TorusGeometry(0.66, 0.05, 16, 44), mats.azul);
  intakeRing.rotation.y = Math.PI / 2;
  intakeRing.position.x = -(W / 2 + 0.65);
  g.add(intakeRing);

  const throat = mesh('garganta', new THREE.CylinderGeometry(0.3, 0.3, 0.24, 28), mats.cuerpoLado);
  throat.rotation.z = Math.PI / 2;
  throat.position.x = -(W / 2 + 0.01);
  g.add(throat);

  // salida (derecha)
  const outPipe = mesh('boca_salida', new THREE.CylinderGeometry(0.3, 0.44, 0.6, 36), mats.aluminio);
  outPipe.rotation.z = -Math.PI / 2;
  outPipe.position.x = W / 2 + 0.28;
  g.add(outPipe);

  outputRing = mesh('aro_salida', new THREE.TorusGeometry(0.44, 0.045, 16, 40), mats.indigo);
  outputRing.rotation.y = Math.PI / 2;
  outputRing.position.x = W / 2 + 0.58;
  g.add(outputRing);

  [[-0.9, -0.36], [0.9, -0.36], [-0.9, 0.36], [0.9, 0.36]].forEach(([x, z], i) => {
    const foot = mesh('pata_' + (i + 1), new THREE.CylinderGeometry(0.1, 0.13, 0.2, 20), mats.cuerpoLado);
    foot.position.set(x, -(H / 2 + 0.08), z);
    g.add(foot);
  });

  return g;
}

function lights() {
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xCBD6E8, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(3.2, 4.4, 5.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xBFD4FF, 1.5);
  rim.position.set(-5, 1.8, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xE8ECF6, 1.1);
  fill.position.set(-3.4, -2.2, 3); scene.add(fill);
}

function resize() {
  if (!canvasEl) return;
  const w = canvasEl.clientWidth || 1, h = canvasEl.clientHeight || 1;
  renderer.setSize(w, h, false);
  const a = w / h;
  camera.aspect = a;
  camera.fov = 34;
  camera.position.z = Math.max(8.1 / a, 4.9) * 1.04;
  camera.updateProjectionMatrix();
}

function applyFrame(t, power, suck, absoluteGears) {
  const spin = 0.5 + suck * 5;
  gears.forEach(m => {
    if (absoluteGears) m.rotation.z = Math.sign(m.userData.spd) * GEAR_W * t;
    else m.rotation.z += m.userData.spd * spin * 0.016;
  });

  const base = 0.25 + power * 0.75;
  mats.azul.emissiveIntensity = base * (1 + suck * 1.1) + Math.sin(t * F.azul) * 0.08 * power;
  mats.indigo.emissiveIntensity = base * 0.85;
  mats.naranja.emissiveIntensity = 0.2 + power * 0.5;
  if (screenMat) screenMat.emissiveIntensity = 0.22 + power * 0.34;

  leds.forEach((l, i) => {
    l.scale.setScalar(0.8 + power * (0.2 + Math.sin(t * F.leds + l.userData.phase) * 0.2));
  });
  intakeRing.scale.setScalar(1 + suck * 0.1 + Math.sin(t * F.aroIn) * 0.025 * suck);
  outputRing.scale.setScalar(1 + Math.sin(t * F.aroOut) * 0.03 * power);

  root.rotation.y = Math.sin(t * F.rotY) * 0.2 + (1 - power) * 0.28;
  root.rotation.x = -0.05 + Math.sin(t * F.rotX) * 0.04;
  root.position.y = Math.sin(t * F.flota) * 0.045;
  root.scale.setScalar(0.84 + power * 0.16);
}

let lastW = 0, lastH = 0;
function tick() {
  // el hueco del duenio cambia la caja del canvas sin disparar 'resize'
  if (canvasEl.clientWidth !== lastW || canvasEl.clientHeight !== lastH) {
    lastW = canvasEl.clientWidth; lastH = canvasEl.clientHeight;
    resize();
  }
  applyFrame(clock.getElapsedTime(), power, suck, false);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Render determinista para el export: estado fijo (encendida, sin succion).
export function renderAt(t, opts = {}) {
  applyFrame(t, opts.power ?? 1, opts.suck ?? 0, true);
  renderer.render(scene, camera);
}

export function initStatic(canvas, w, h) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
  camera.position.set(0.1, 0.45, Math.max(8.1 / (w / h), 4.9) * 1.04);
  camera.lookAt(0, 0, 0);

  gears = []; leds = [];
  lights();
  root = buildMachine();
  scene.add(root);
  return { renderer, scene, camera };
}

export function init(canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0.1, 0.45, 8.4);
  camera.lookAt(0, 0, 0);

  lights();
  root = buildMachine();
  scene.add(root);

  clock = new THREE.Clock();
  resize();
  addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  tick();
}

export function setProgress(p) {
  power = smooth(range(p, 0.02, 0.2));
  suck = smooth(range(p, 0.50, 0.64)) * (1 - smooth(range(p, 0.82, 0.94)) * 0.7);
}

// Donde termina el objeto dibujado, como fraccion de la altura del canvas medida
// desde arriba. Proyecta la caja real del grupo con la camara vigente, asi que
// sigue cualquier cambio de aspect, fov o posicion de camara.
export function visibleBottomFraction() {
  if (!root || !camera) return 0.578;
  // El bloque aterriza cuando la maquina ya esta a escala plena y sin flotacion:
  // congelamos ese estado para medir, y despues restauramos.
  const sx = root.scale.x, py = root.position.y;
  root.scale.setScalar(1);
  root.position.y = 0;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(sx);
  root.position.y = py;
  root.updateMatrixWorld(true);
  if (box.isEmpty()) return 0.578;
  let lowest = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    v.project(camera);                 // NDC: y = +1 arriba, -1 abajo
    const fromTop = (1 - v.y) / 2;     // 0 = borde superior del canvas
    if (fromTop > lowest) lowest = fromTop;
  }
  return Math.min(Math.max(lowest, 0), 1);
}

window.CCMachine = { init, setProgress, initStatic, renderAt, visibleBottomFraction, LOOP_T };
