import * as THREE from 'three';
import { createFish, BITE, DOT_FRAG } from './fish.js';
import { buildScenery, el, PLATE, ROD, MARKET_TARGET } from './scenery.js';
import { createWorld, HERO_FEET } from './people.js';
import { buildBoard } from './xray.js';
import { createPlayers } from './players.js';
import { initI18n, t } from './i18n.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = (s) => document.querySelector(s);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };

/* =========================================================
   STAGE — 1600×900 SVG space scaled by viewport height
   ========================================================= */
const stage = {};
function measure() {
  stage.vw = innerWidth; stage.vh = innerHeight;
  stage.w = stage.vh * 16 / 9; stage.left = (stage.vw - stage.w) / 2; stage.k = stage.vh / 900;
}
const stageToPx = (x, y) => ({ x: stage.left + x * stage.k + (PORTRAIT ? (800 - MF.x) * stage.k : 0), y: y * stage.k - (PORTRAIT ? (MF.y - 450) * stage.k : 0) });
measure();

buildScenery($('#bg-sea'), $('#bg'), $('#fg'));

// moving sea: each wave band is a separate GPU layer; nearer bands (higher t) move more
document.querySelectorAll('.wave-layer').forEach((layer) => {
  const t0 = +layer.dataset.t;
  const drift = (10 + t0 * 46) / 16;   // stage units → % of stage width
  const bob = (1 + t0 * 4) / 9;        // stage units → % of stage height
  gsap.fromTo(layer, { xPercent: -drift }, { xPercent: drift, duration: 4 + Math.random() * 3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -Math.random() * 7 });
  gsap.fromTo(layer, { yPercent: -bob }, { yPercent: bob, duration: 1.6 + Math.random() * 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -Math.random() * 3 });
});

/* =========================================================
   THREE
   ========================================================= */
const canvas = $('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const PR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#0b0e0f', 400, 800); // only pulled in for the crowd scene
const FOV = 35, CAM_Z = 6;
const camera = new THREE.PerspectiveCamera(FOV, stage.vw / stage.vh, 0.05, 80);
camera.position.set(0, 0, CAM_Z);
scene.add(camera); // camera-space props hang off the camera
const W2S = 900 / (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))); // world units → stage units at z = 0
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

const hemi = new THREE.HemisphereLight('#d6dee1', '#0b0e0f', 1.0); scene.add(hemi);
const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(-3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight('#9feaf5', 1.4); rim.position.set(3, 2.5, -4); scene.add(rim);

const fish = createFish({ pixelRatio: PR });
scene.add(fish.group);

// ---- microplastic fragments floating in the sea ----
const water = (() => {
  const n = 320, pos = [], seed = [];
  for (let i = 0; i < n; i++) {
    const d = 3.5 + Math.random() * 10;
    const ny = -0.98 + Math.random() * 1.12;      // stays below the horizon line
    const nx = (Math.random() * 2 - 1) * 1.15;
    pos.push(nx * TAN * d * 1.9, ny * TAN * d, CAM_Z - d);
    seed.push(Math.random());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: fish.U.uTime, uOpacity: { value: 1 }, uGlow: { value: 1 }, uColor: { value: new THREE.Color('#3fd3e8') }, uPR: { value: PR } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uOpacity, uPR; varying float vAlpha; varying float vSeed;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.18 + aSeed * 6.28) * 0.25;
        p.y += sin(uTime * 0.5 + aSeed * 12.0) * 0.06;   // bobbing with the swell
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (14.0 + aSeed * 18.0) * uPR * (6.0 / -mv.z);
        float far = smoothstep(14.0, 4.0, -mv.z);       // farther fragments fade into the dark
        vAlpha = uOpacity * (0.35 + 0.55 * far);
        vSeed = aSeed;
      }`,
    fragmentShader: DOT_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  scene.add(p);
  return p;
})();

// ---- people, props, map (scenes 3–7) ----
const world = createWorld({ uTime: fish.U.uTime, pixelRatio: PR });
scene.add(world.root);
camera.add(world.props.rig);
const hero = world.hero;
const PL = createPlayers({ root: world.root, uTime: fish.U.uTime, pixelRatio: PR, hero });
const heldMats = [];
[world.held.umbrella, world.held.bag].forEach((o) => o.traverse((m) => {
  if (m.material && !heldMats.includes(m.material)) { m.material.transparent = true; heldMats.push(m.material); }
}));

/* =========================================================
   STATE (everything GSAP animates lives here)
   ========================================================= */
const TABLE = { x: (PLATE.x - 800) / W2S - 0.19, y: (450 - PLATE.y) / W2S }; // fish centre on the plate (fish is flipped: head left)
const S = {
  x: 0, y: -1, z: -2.6, rx: 0, ry: 0, rz: 0, s: 0.55,
  swim: 0.1, idle: 0, glow: 1, dots: 1, water: 1, parallax: 1, cook: 0, eaten: 0, depth: 1,
  // scenes 3+
  people: 0, amb: 1, fishVis: 1, heroScale: 1, xray: 0, map: 0, rig: 0, held: 0, drop: 0, heroFleck: 0, handFleck: 0,
  reuse: 0, crowd: 0, shake: 0, fog: 0,
};
const L = { cast: 0, alpha: 0, tension: 0 };      // fishing line
const R = { bend: 0 };                             // rod rotation (deg)
const H = { ret: 0, connect: 0 };                  // HUD reveal
// phones (portrait): the wide 16:9 scenes don't fit, so the view pans to whatever is in focus.
// MF.x is the stage x (0–1600) to centre on; 3D and 2D layers are shifted together so they stay aligned.
const PORTRAIT = innerWidth / innerHeight < 0.85;
const MF = { x: 800, y: 450 };
const mob = (tl, x, at, dur = 1, y = 450) => { if (PORTRAIT) tl.to(MF, { x, y, duration: dur, ease: 'power2.inOut' }, at); return tl; };
// camera rig: orbit around the hero's eyes. theta = 0, r = 0 → POV; theta = π → in front of the hero
const C = { theta: 0, r: 0, h: 0, lx: 0, ly: 0, lz: 0 };
const REST = { lx: 0, lz: 0.07, rx: 0, rz: -0.07, headZ: 0 };
const A = { ...REST };                             // hero arm pose
const POV_HAND = { lx: -1.87, lz: -0.14 };          // left hand raised in front of the eyes
const SP = { hero: 0, mother: 0, father: 0, dog: 0, cat: 0, fr1: 0, fr2: 0, fr3: 0 }; // spotlights
const P = { umb: 0, sleeve: 0, umbOut: 0, bag: 0, open: 0, unwrap: 0, shopUp: 0, drop: 0, out: 0 }; // supermarket props
const M = { z: 0 };                                // walking up to the shelf (2D zoom)
const B = { japan: 0, usa: 0, usaS: 1, china: 0, chinaS: 1, india: 0, indiaS: 1 };      // map bars
const TA = { hand: 0, people: 0, props: 0, pin: 0, map: 0, players: 0 };
const PS = { factory: 0, burner: 0, crest: 0 };                                       // the big players                             // HUD tag groups
const XA = { brain: 0, lungs: 0, heart: 0, blood: 0, gut: 0 };                           // x-ray labels
let mode = 'intro';                                // intro → swim → catching → caught

const FRONT = { theta: Math.PI, r: 3.4, h: -0.55, lx: HERO_FEET.x, ly: HERO_FEET.y + 0.85, lz: HERO_FEET.z };

function swimPose(time) {
  const T = time * 0.28;
  const x = Math.sin(T) * 1.8, z = -2.7 + Math.sin(2 * T) * 0.6;
  const dx = Math.cos(T) * 1.8, dz = Math.cos(2 * T) * 1.2;
  // rx tilts the fish so we look down onto its back, as you would from a boat
  return { x, y: -1.0 + Math.sin(time * 0.8) * 0.05, z, rx: 0.75, ry: Math.atan2(-dz, dx), rz: Math.sin(time * 1.1) * 0.05 };
}

/* =========================================================
   HUD (pixel-space SVG over everything)
   ========================================================= */
const hud = $('#hud');
const hudLine = el('path', { fill: 'none', stroke: '#e3eaec', 'stroke-width': 1.1, 'stroke-opacity': .85 }, hud);
const ret = el('g', { opacity: 0 }, hud);
const retCorners = [0, 1, 2, 3].map(() => el('path', { fill: 'none', stroke: '#3fd3e8', 'stroke-width': 1.5 }, ret));
const retLabel = el('text', {}, ret);
const retSub = el('text', { 'fill-opacity': .6 }, ret);
const conn = el('g', { opacity: 0 }, hud);
const connLine = el('path', { fill: 'none', stroke: '#3fd3e8', 'stroke-width': 1.2 }, conn);
const connBox = el('rect', { width: 22, height: 22, fill: 'none', stroke: '#3fd3e8', 'stroke-width': 1.2 }, conn);
const connDot = el('circle', { r: 2.5, fill: '#3fd3e8' }, conn);
const rodEl = $('#rod');

const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
function toPx(local) {
  tmpV.copy(local).applyMatrix4(fish.group.matrixWorld).project(camera);
  return { x: (tmpV.x + 1) / 2 * stage.vw, y: (1 - tmpV.y) / 2 * stage.vh };
}
function worldPx(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x + 1) / 2 * stage.vw, y: (1 - tmpV.y) / 2 * stage.vh, behind: tmpV.z > 1 };
}
const P_HEAD = new THREE.Vector3(1.0, 0, 0), P_TAIL = new THREE.Vector3(-1.38, 0, 0);
const P_TOP = new THREE.Vector3(0.05, 0.27, 0), P_BOT = new THREE.Vector3(0, -0.2, 0);

// ---- generic leader-line tags (people, props, map) ----
function makeTag() {
  const g = el('g', { opacity: 0 }, hud);
  return { g, line: el('path', { stroke: '#3fd3e8', 'stroke-width': 1.2, fill: 'none' }, g), dot: el('circle', { r: 3, fill: '#3fd3e8' }, g), t1: el('text', { class: 'tag-title' }, g), t2: el('text', { 'fill-opacity': .7 }, g) };
}
function placeTag(tag, world, alpha, dx = 0, dy = -46, anchor = 'middle') {
  if (alpha < 0.002) { if (tag.shown) { tag.g.setAttribute('opacity', 0); tag.shown = false; } return; }
  const p = worldPx(world);
  if (p.behind) { tag.g.setAttribute('opacity', 0); return; }
  tag.shown = true;
  tag.g.setAttribute('opacity', alpha.toFixed(3));
  tag.dot.setAttribute('cx', p.x); tag.dot.setAttribute('cy', p.y);
  const ex = p.x + dx, ey = p.y + dy;
  tag.line.setAttribute('d', `M${p.x} ${p.y} L${ex} ${ey}`);
  for (const [tt, off] of [[tag.t1, -22], [tag.t2, -8]]) {
    tt.setAttribute('x', ex); tt.setAttribute('y', ey + (dy < 0 ? off : -off + 12)); tt.setAttribute('text-anchor', anchor);
  }
}
const TAGS = {};
['hand', 'hero', 'mother', 'father', 'dog', 'cat', 'fr1', 'fr2', 'fr3', 'umb', 'cbag', 'pack', 'cookie', 'sbag', 'pin', 'japan', 'usa', 'china', 'india', 'factory', 'burner', 'crest'].forEach((k) => { TAGS[k] = makeTag(); });
const TAG_TEXT = {
  hand: ['tgHand', 'tgHandSub'], hero: ['tgYou', 'tgYouSub'], mother: ['tgMother'], father: ['tgFather'], dog: ['tgDog'], cat: ['tgCat'],
  fr1: ['tgFriend'], fr2: ['tgFriend'], fr3: ['tgFriend'], umb: ['tgUmb'], cbag: ['tgCbag'], pack: ['tgPack'], cookie: ['tgCookie'], sbag: ['tgSbag'],
  pin: ['tgPin'], japan: ['tgJapan', 'tgJapanSub'], usa: ['tgUsa', 'tgUsaSub'], china: ['tgChina', 'tgChinaSub'], india: ['tgIndia', 'tgIndiaSub'],
  factory: ['tgFactory', 'tgFactorySub'], burner: ['tgBurner', 'tgBurnerSub'], crest: ['tgCrest', 'tgCrestSub'],
};
function tagTexts() {
  for (const k in TAGS) { const [a, b] = TAG_TEXT[k]; TAGS[k].t1.textContent = t(a); TAGS[k].t2.textContent = b ? t(b) : ''; }
}

// ---- the x-ray lightboard (2D) ----
const BOARD = buildBoard($('#xb-inner'), PORTRAIT);
const XB_SCALE = innerWidth / 620; // px per board unit on phones
if (PORTRAIT) {
  $('#xboard').classList.add('portrait');
  Object.assign($('#xb-inner').style, { width: '100vw', height: `${innerWidth * 2300 / 620}px` });
}
const XSRC = {
  brain: 'Nihart et al., 2025 · Nature Medicine', lungs: 'Jenner et al., 2022 · Sci. Total Environ.',
  heart: 'Marfella et al., 2024 · NEJM', blood: 'Leslie et al., 2022 · Environ. Int.', gut: 'Yan et al., 2022 · Environ. Sci. Technol.',
};
function xlabelTexts() {
  const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  for (const k in BOARD) BOARD[k].box.innerHTML = `<b>${t('x' + cap(k) + 'T')}</b>${t('x' + cap(k))}<i>${XSRC[k]}</i>`;
}

let lastBend = null;
function updateHud() {
  // rod + fishing line (only touch the rod's SVG when it actually moves, to avoid repaints)
  if (R.bend !== lastBend) { rodEl.setAttribute('transform', `rotate(${R.bend.toFixed(2)} ${ROD.baseX} ${ROD.baseY})`); lastBend = R.bend; }
  if (L.alpha > 0.001) {
    const a = THREE.MathUtils.degToRad(R.bend), dx = ROD.tipX - ROD.baseX, dy = ROD.tipY - ROD.baseY;
    const tip = stageToPx(ROD.baseX + dx * Math.cos(a) - dy * Math.sin(a), ROD.baseY + dx * Math.sin(a) + dy * Math.cos(a));
    const wPt = stageToPx(1010, 560);
    const m = toPx(fish.mouth);
    const ex = lerp(wPt.x, m.x, L.cast), ey = lerp(wPt.y, m.y, L.cast);
    const sag = (1 - L.tension) * 70 * stage.k;
    const cx = (tip.x + ex) / 2, cy = (tip.y + ey) / 2 + sag;
    hudLine.setAttribute('d', `M${tip.x} ${tip.y} Q${cx} ${cy} ${ex} ${ey}`);
  }
  hudLine.setAttribute('opacity', L.alpha);

  // reticle around the fish
  ret.setAttribute('opacity', H.ret);
  if (H.ret > 0.001) {
    const pts = [toPx(P_HEAD), toPx(P_TAIL), toPx(P_TOP), toPx(P_BOT)];
    const pad = 26;
    const x0 = Math.min(...pts.map((p) => p.x)) - pad, x1 = Math.max(...pts.map((p) => p.x)) + pad;
    const y0 = Math.min(...pts.map((p) => p.y)) - pad, y1 = Math.max(...pts.map((p) => p.y)) + pad;
    const c = 18 * H.ret;
    retCorners[0].setAttribute('d', `M${x0} ${y0 + c} V${y0} H${x0 + c}`);
    retCorners[1].setAttribute('d', `M${x1 - c} ${y0} H${x1} V${y0 + c}`);
    retCorners[2].setAttribute('d', `M${x1} ${y1 - c} V${y1} H${x1 - c}`);
    retCorners[3].setAttribute('d', `M${x0 + c} ${y1} H${x0} V${y1 - c}`);
    retLabel.setAttribute('x', x0); retLabel.setAttribute('y', y0 - 12);
    retSub.setAttribute('x', x0); retSub.setAttribute('y', y1 + 20);
  }

  // connector from the callout to one dot on the fish
  conn.setAttribute('opacity', H.connect > 0.001 ? 1 : 0);
  if (H.connect > 0.001) {
    const d = toPx(fish.hudDot);
    const box = $('#callout').getBoundingClientRect();
    const bx = box.left, by = box.top + 36;
    const k = H.connect;
    const kx = lerp(bx, d.x + 11, k), ky = lerp(by, d.y, k);
    const elbowX = lerp(bx, bx - 40, Math.min(1, k * 3));
    connLine.setAttribute('d', `M${bx} ${by} H${elbowX} L${kx} ${ky}`);
    connBox.setAttribute('x', d.x - 11); connBox.setAttribute('y', d.y - 11);
    connBox.setAttribute('opacity', k > 0.95 ? 1 : 0);
    connDot.setAttribute('cx', d.x); connDot.setAttribute('cy', d.y);
  }

  if (!S.people) return;
  // ---- scene 3+ tags ----
  placeTag(TAGS.hand, hero.armL.hand.getWorldPosition(tmpW), TA.hand, 120, -60, 'start');
  const above = (o, hgt) => tmpW.copy(o.root.position).setY(HERO_FEET.y + hgt * (o.root.scale.x || 1));
  placeTag(TAGS.hero, above(hero, 1.85 * S.heroScale), SP.hero * TA.people, 0, -40);
  for (const k of ['mother', 'father', 'fr1', 'fr2', 'fr3']) placeTag(TAGS[k], above(world.others[k], 1.9), SP[k] * TA.people, 0, -34);
  placeTag(TAGS.dog, above(world.others.dog, 0.7), SP.dog * TA.people, 0, -34);
  placeTag(TAGS.cat, above(world.others.cat, 0.6), SP.cat * TA.people, 0, -34);
  const pr = world.props;
  placeTag(TAGS.umb, pr.sleeve.getWorldPosition(tmpW).add(tmpV.set(0, 0.4, 0)), TA.props * P.sleeve * (1 - P.umbOut), -160, -40, 'end');
  placeTag(TAGS.cbag, pr.cookieBag.getWorldPosition(tmpW), TA.props * P.bag * (1 - P.open) * (1 - P.drop), -190, -80, 'end');
  placeTag(TAGS.pack, pr.packets[3].getWorldPosition(tmpW), TA.props * P.open * (1 - P.unwrap), -150, -50, 'end');
  placeTag(TAGS.cookie, pr.cookie.getWorldPosition(tmpW), TA.props * smooth(.5, 1, P.unwrap), 170, -70, 'start');
  placeTag(TAGS.sbag, pr.shopBag.getWorldPosition(tmpW).add(tmpV.set(0, -0.45, 0)), TA.props * P.shopUp * (1 - P.out), -230, -10, 'end');
  placeTag(TAGS.pin, world.tokyo, TA.pin, 0, -60);
  const bars = world.bars;
  for (const k of ['japan', 'usa', 'china', 'india']) placeTag(TAGS[k], bars[k].top(tmpW), bars[k].k * TA.map, 0, -36);
  for (const k of ['factory', 'burner', 'crest']) {
    const p = PL.players[k];
    tmpW.copy(p.g.position).setY(HERO_FEET.y + (p.tagY ?? Math.min(p.height, 3.6) + 0.2));
    if (k !== 'crest' && !PORTRAIT) tmpW.x += k === 'factory' ? -3.4 : 3.4; // keep the label on screen, over the building's inner half
    placeTag(TAGS[k], tmpW, PS[k] * TA.players, 0, -30);
  }
}

// x-ray board call-outs (opacity only; positions are fixed in the board)
const XA_ON = {};
function updateBoard() {
  for (const k in BOARD) {
    const a = XA[k];
    if (XA_ON[k] === a) continue;
    XA_ON[k] = a;
    const p = BOARD[k];
    p.fl.setAttribute('opacity', Math.min(1, a * 1.6));
    p.line.setAttribute('opacity', a); p.ring.setAttribute('opacity', a);
    p.box.style.opacity = a;
    p.box.style.transform = `translateY(${(1 - a) * 14}px)`;
  }
}

function ripple(px, py) {
  for (let i = 0; i < 3; i++) {
    const c = el('ellipse', { cx: px, cy: py, rx: 4, ry: 1.5, fill: 'none', stroke: '#e3eaec', 'stroke-width': 1.4 }, hud);
    gsap.to(c, { attr: { rx: 140 + i * 50, ry: 30 + i * 10 }, opacity: 0, duration: 1.4 + i * .3, delay: i * .15, ease: 'power2.out', onComplete: () => c.remove() });
  }
}

/* =========================================================
   LANGUAGE
   ========================================================= */
let sceneKey = 'scene1';
function setScene(k) {
  if (k === sceneKey) return;
  sceneKey = k;
  const lab = $('#scene-label');
  lab.dataset.i18n = k;
  gsap.fromTo(lab, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: .4 });
  lab.textContent = t(k);
}
initI18n(() => {
  retLabel.textContent = t('specimen');
  retSub.textContent = 'TOKYO BAY · 35.5°N 139.8°E';
  $('#scene-label').textContent = t(sceneKey);
  tagTexts();
  xlabelTexts();
});

/* =========================================================
   SMOOTH SCROLL
   ========================================================= */
const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
const toTop = () => { window.scrollTo(0, 0); lenis.scrollTo(0, { immediate: true, force: true }); };
toTop();
lenis.stop();
window.addEventListener('load', toTop);

/* =========================================================
   INITIAL STATES
   ========================================================= */
if (innerWidth > 760) {
  gsap.set('.card-left, .card-right', { yPercent: -50 });
  gsap.set('.card-center', { xPercent: -50, yPercent: -50 });
  gsap.set('.card-bottom', { xPercent: -50 });
}
gsap.set('#cooler-back, #cooler-front', { y: 700 });
gsap.set('#cooler-lid', { y: -900 });
gsap.set('#store-tray, #film', { opacity: 0 });
$('#plastic-items').setAttribute('filter', 'none');

/* =========================================================
   INTRO + CATCH (click)
   ========================================================= */
gsap.timeline({ delay: .2 })
  .to('#blackout', { opacity: 0, duration: 1.8, ease: 'power2.out' })
  .to(L, { alpha: 1, duration: 1 }, .6)
  .to('#catch-cta', { opacity: 1, duration: .8 }, 1.2)
  .call(() => { mode = 'swim'; document.body.classList.add('can-catch'); }, null, 1.2);

function catchFish() {
  if (mode !== 'swim') return;
  mode = 'catching';
  toTop();
  document.body.classList.remove('can-catch');
  Object.assign(S, swimPose(clock.getElapsedTime()));
  const startPx = toPx(fish.mouth);

  const HANG = { x: -0.6, y: 0.4, z: 0.6, rx: 0, rz: 1.25, ry: 0, s: 1 };
  gsap.timeline({ onComplete: unlockScroll })
    .to('#catch-cta', { opacity: 0, duration: .35 })
    .set('#catch-cta', { visibility: 'hidden' })
    .to(L, { cast: 1, tension: 1, duration: .55, ease: 'power3.out' }, 0)
    .to(R, { bend: -7, duration: .25, ease: 'power2.out', yoyo: true, repeat: 3 }, .45)
    .to(S, { swim: .4, duration: .3 }, .45)
    .call(() => ripple(startPx.x, startPx.y), null, .5)
    .to(S, { ...HANG, duration: 1.4, ease: 'power3.inOut' }, .9)
    .call(() => { const p = toPx(fish.mouth); ripple(p.x, Math.max(p.y, startPx.y)); }, null, 1.0)
    .to('#water-surface', { opacity: 0, duration: .6 }, .9)
    .to(S, { depth: 0, duration: .5, ease: 'power1.out' }, 1.0)
    .to('#dim', { opacity: .55, duration: 1.2 }, 1.4)
    .to('#sea-fg', { opacity: .35, duration: 1.2 }, 1.4)
    .to(S, { water: .25, duration: 1.2 }, 1.4)
    // present the fish flat, like a specimen
    .to(S, { rz: 0, ry: -0.12, swim: .05, idle: 1, duration: 1.1, ease: 'power2.inOut' }, 2.4)
    .to(L, { alpha: 0, duration: .5 }, 2.4)
    .to(S, { glow: 2.4, duration: 1 }, 2.6)
    .to(H, { ret: 1, duration: .6, ease: 'power2.out' }, 2.9)
    .to(MF, { x: PORTRAIT ? 660 : 800, duration: 1, ease: 'power2.inOut' }, 2.4)
    .fromTo('#callout', { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: .7, ease: 'power2.out' }, 3.1)
    .to(H, { connect: 1, duration: .8, ease: 'power2.inOut' }, 3.5)
    .fromTo('#scroll-cue', { autoAlpha: 0 }, { autoAlpha: 1, duration: .6 }, 4.2);
}
window.addEventListener('click', catchFish);
$('#catch-cta').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') catchFish(); });

function unlockScroll() {
  mode = 'caught';
  toTop();
  lenis.start();
  buildScrollTimelines();
}

/* ---------- "So what can I do?" — click to break free (4 clicks) ---------- */
let gateClicks = 0, unlocked2 = false;
const gateActive = () => !unlocked2 && ST.what && ST.what.progress > 0.6;
function shake(k) {
  gsap.fromTo(S, { shake: k }, { shake: 0, duration: 0.5 + k * 0.4, ease: 'power2.out' });
  gsap.fromTo('#c-what', { x: -18 * k }, { x: 0, duration: 0.7, ease: 'elastic.out(1.2, 0.25)' });
}
window.addEventListener('click', (e) => {
  if (!gateActive() || e.target.closest('.lang')) return;
  gateClicks++;
  shake(0.35 + gateClicks * 0.2);
  if (gateClicks === 2) {
    const h = $('#what-title');
    gsap.fromTo(h, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5 });
    h.dataset.i18n = 'whatSure'; h.textContent = t('whatSure');
  }
  if (gateClicks >= 4) { unlocked2 = true; document.body.classList.remove('gate'); setTimeout(unlockFinale, 650); }
});
function unlockFinale() {
  document.querySelectorAll('#track section.locked').forEach((sec) => sec.classList.remove('locked'));
  buildStory3();
  ScrollTrigger.refresh();
  lenis.resize(); // the page just got longer
  lenis.scrollTo(ST.players.start + innerHeight * 1.6, { duration: 2.6, easing: (x) => 1 - Math.pow(1 - x, 3) });
}
$('#restart-btn').addEventListener('click', (e) => { e.stopPropagation(); window.scrollTo(0, 0); location.reload(); });

// references for the final page
const REFS = [
  ['Tanaka & Takada (2016). Microplastic fragments and microbeads in digestive tracts of planktivorous fish from urban coastal waters. Scientific Reports.', 'https://link.springer.com/content/pdf/10.1038/srep34351.pdf'],
  ['Isobe et al. (2015). East Asian seas: a hot spot of pelagic microplastics. Marine Pollution Bulletin.', 'https://researchmap.jp/read0008573/published_papers/22044631'],
  ['Tsuji et al. (2026). Microplastics in stool, diet and inflammation in healthy Japanese people.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12981973/'],
  ['Plastic Waste Management Institute (2025). Material Flow Chart 2024.', 'https://pwmi.or.jp/pdf/panf2.pdf'],
  ['UNEP (2018). Single-use plastics: a roadmap for sustainability.', 'https://wedocs.unep.org/handle/20.500.11822/25496'],
  ['Heinrich Böll Stiftung. Plastic Atlas Japan special edition.', 'https://kr.boell.org/en/node/879'],
  ['Cox et al. (2019). Human consumption of microplastics. Environmental Science & Technology.', 'https://pubs.acs.org/doi/10.1021/acs.est.9b01517'],
  ['Zhang et al. (2021). You are what you eat: microplastics in the feces of young men living in Beijing. Science of the Total Environment.', 'https://www.sciencedirect.com/science/article/abs/pii/S0048969720378761'],
  ['Leslie et al. (2022). Discovery and quantification of plastic particle pollution in human blood. Environment International.', 'https://doi.org/10.1016/j.envint.2022.107199'],
  ['Zhang, Wang & Kannan (2019). PET and polycarbonate microplastics in pet food and feces. Environmental Science & Technology.', 'https://pubs.acs.org/doi/10.1021/acs.est.9b03912'],
  ['Marfella et al. (2024). Microplastics and nanoplastics in atheromas and cardiovascular events. NEJM.', 'https://www.nejm.org/doi/full/10.1056/NEJMoa2309822'],
  ['Jenner et al. (2022). Detection of microplastics in human lung tissue using μFTIR spectroscopy. Science of the Total Environment.', 'https://doi.org/10.1016/j.scitotenv.2022.154907'],
  ['Yan et al. (2022). Analysis of microplastics in human feces reveals a correlation with inflammatory bowel disease. Environmental Science & Technology.', 'https://pubs.acs.org/doi/10.1021/acs.est.1c03924'],
  ['Nihart et al. (2025). Bioaccumulation of microplastics in decedent human brains. Nature Medicine.', 'https://www.nature.com/articles/s41591-024-03453-1'],
  ['Mother Jones / The Guardian (2026). Scientists question microplastics-in-body studies.', 'https://www.motherjones.com/politics/2026/01/scary-research-findings-microplastics-human-health-flawed/'],
  ['Minderoo Foundation (2021). Plastic Waste Makers Index, via Statista.', 'https://www.statista.com/chart/24874/single-use-plastic-waste-generated-per-person-in-selected-countries/'],
  ['Ministry of the Environment, Japan. Effects of the plastic shopping bag fee.', 'https://www.env.go.jp/content/000050376.pdf'],
  ['Greenpeace East Asia (2024). Petrochemical production in South Korea, Japan and Taiwan.', 'https://www.greenpeace.org/eastasia/press/8698/new-research-finds-plastic-production-in-south-korea-japan-and-taiwan-as-major-contributors-to-plastic-climate-crisis/'],
  ['Down To Earth (2024). Japan sorts its plastic better than any country. It still recycles very little of it.', 'https://www.downtoearth.org.in/waste/epr-in-asia-pacific-japan-sorts-its-plastic-better-than-any-country-it-still-recycles-very-little-of-it'],
  ['The Diplomat (2023). Global plastics treaty will test Japan’s clean image.', 'https://thediplomat.com/2023/05/global-plastics-treaty-will-test-japans-clean-image/'],
  ['Eco-Business (2024). Global plastics treaty talks in Busan fail to reach agreement.', 'https://www.eco-business.com/news/global-plastics-treaty-talks-in-busan-fail-to-reach-agreement-and-adjourned-due-to-persisting-divergence'],
];
$('#ref-list').innerHTML = REFS.map(([txt, url]) => `<li>${txt} <a href="${url}" target="_blank" rel="noopener">link</a></li>`).join('');

/* =========================================================
   SCROLL TIMELINES
   ========================================================= */
const scrubTL = (trigger) => gsap.timeline({
  defaults: { ease: 'none', immediateRender: false },
  scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: true },
});
const cardIn = (tl, sel, at, d = .6) => tl.fromTo(sel, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: d, ease: 'power2.out' }, at);
const cardOut = (tl, sel, at, d = .5) => tl.fromTo(sel, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -40, duration: d, ease: 'power2.in' }, at);
const fromTo = (tl, obj, from, to, at, dur = 1, ease = 'none') => tl.fromTo(obj, { ...from }, { ...to, duration: dur, ease }, at);

let stStore, stTable, stEat, eatSnaps = [];
const ST = {};

function buildScrollTimelines() {
  /* ---------- 01b: into the cooler → tray → table ---------- */
  const a = scrubTL('#s-store');
  stStore = a.scrollTrigger;
  a.fromTo(['#callout', '#scroll-cue'], { autoAlpha: 1 }, { autoAlpha: 0, duration: .5 }, 0)
    .fromTo(H, { ret: 1, connect: 1 }, { ret: 0, connect: 0, duration: .5 }, 0)
    .fromTo(S, { x: -0.6, y: 0.4, z: 0.6, rz: 0, ry: -0.12, s: 1, idle: 1, glow: 2.4 },
      { x: 0, y: 1.0, z: 0, rz: 1.35, ry: 0, s: .72, idle: 0, glow: 1.4, duration: 1.6, ease: 'power2.inOut' }, .2)
    .fromTo('#dim', { opacity: .55 }, { opacity: .75, duration: 1 }, .2)
    .fromTo('#cooler-back, #cooler-front', { y: 700 }, { y: 0, duration: 2, ease: 'power2.out' }, .8)
    .fromTo(S, { y: 1.0 }, { y: -3.2, duration: 1.3, ease: 'power2.in' }, 2.4)
    .fromTo('#cooler-tag', { opacity: 0 }, { opacity: 1, duration: .5 }, 2.2);
  cardIn(a, '#c-store', 1.2);
  mob(a, 800, 0.4, 1.2);   // phone: re-centre for the cooler
  cardOut(a, '#c-store', 4.5);
  a.fromTo('#cooler-lid', { y: -900 }, { y: 0, duration: 1.2, ease: 'power2.in' }, 3.8)
    .fromTo('#blackout', { opacity: 0 }, { opacity: 1, duration: .6 }, 5.0)
    // ---- swap worlds while the screen is black ----
    .set(['#sea-bg', '#sea-fg', '#waves-back', '#water-surface', '#cooler-back', '#cooler-front', '#cooler-lid'], { autoAlpha: 0 }, 5.65)
    .set(['#table-bg', '#store-tray', '#film'], { opacity: 1 }, 5.65)
    .set('#dim', { opacity: 0 }, 5.65)
    .set(S, { x: TABLE.x, y: TABLE.y, z: 0, rx: 0, ry: Math.PI, rz: 0, s: 1, swim: 0, water: 0, parallax: 0, glow: 1 }, 5.65)
    .set(MF, { x: PORTRAIT ? 860 : 800 }, 5.65)
    .fromTo('#blackout', { opacity: 1 }, { opacity: 0, duration: .8 }, 5.8)
    .fromTo('#film-tag', { opacity: 0 }, { opacity: 1, duration: .4 }, 6.4);
  cardIn(a, '#c-tray', 6.0);
  cardOut(a, '#c-tray', 8.3);
  a.fromTo('#film', { x: 0, y: 0, rotation: 0, opacity: 1 }, { x: 560, y: -420, rotation: 16, opacity: 0, svgOrigin: `${PLATE.x} ${PLATE.y}`, duration: 1.4, ease: 'power2.in' }, 7.5)
    .fromTo('#store-tray', { opacity: 1 }, { opacity: 0, duration: .8 }, 8.6)
    .fromTo('#plate', { opacity: 0 }, { opacity: 1, duration: .8 }, 8.6)
    .fromTo(S, { cook: 0 }, { cook: 1, duration: 1.2 }, 8.4)
    .fromTo('#natural-items', { opacity: 0 }, { opacity: 1, duration: 1 }, 8.8)
    .fromTo('#plastic-items', { opacity: 0 }, { opacity: 1, duration: 1 }, 9.2)
    .fromTo('#steam', { opacity: 0 }, { opacity: 1, duration: .6 }, 9.4)
    .to({}, { duration: .4 }, 10);

  /* ---------- 02: the table ---------- */
  const b = scrubTL('#s-table');
  stTable = b.scrollTrigger;
  cardIn(b, '#c-t1', .2); cardOut(b, '#c-t1', 2.4);
  cardIn(b, '#c-t2', 2.9); cardOut(b, '#c-t2', 5.1);
  cardIn(b, '#c-t3', 5.6); cardOut(b, '#c-t3', 7.6);
  b.set('#plastic-items', { attr: { filter: 'url(#f-glow)' } }, 5.7)
    .fromTo(S, { glow: 1 }, { glow: 2.2, duration: .6 }, 5.7);
  ['#tag-soy', '#tag-pet', '#tag-tray', '#tag-sleeve', '#tag-bag'].forEach((id, i) => {
    b.fromTo(id, { opacity: 0 }, { opacity: 1, duration: .35 }, 6.0 + i * .3);
  });
  cardIn(b, '#c-t4', 8.0); cardOut(b, '#c-t4', 9.9);
  b.to({}, { duration: .3 }, 10.4);

  /* ---------- 02b: bite by bite ---------- */
  const c = scrubTL('#s-eat');
  stEat = c.scrollTrigger;
  const tags = ['#tag-soy', '#tag-pet', '#tag-tray', '#tag-sleeve', '#tag-bag'];
  c.fromTo(tags, { opacity: 1 }, { opacity: 0, duration: .3 }, 0)
    .fromTo('#steam', { opacity: 1 }, { opacity: 0, duration: .3 }, 0);
  cardIn(c, '#c-t5', 0, .4);
  const BITES = 5, SEG = 2, OFF = .4;
  for (let i = 0; i < BITES; i++) {
    const s0 = OFF + i * SEG;
    const localMid = BITE.head - (i + 0.5) / BITES * BITE.span;
    const wx = TABLE.x - localMid; // fish is flipped (ry = π)
    const tx = 800 + wx * W2S, ty = 450 - TABLE.y * W2S - 6;
    c.fromTo('#eat-sticks', { x: 1700, y: 1300 }, { x: tx, y: ty, duration: .7, ease: 'power2.out' }, s0)
      .fromTo('#stick-a', { rotation: 0 }, { rotation: -2.5, transformOrigin: '100% 100%', duration: .15 }, s0 + .7)
      .fromTo(S, { eaten: i / BITES }, { eaten: (i + 1) / BITES, duration: .3, ease: 'power1.out' }, s0 + .75)
      .fromTo('#morsel', { opacity: 0 }, { opacity: 1, duration: .1 }, s0 + .8)
      .fromTo('#eat-sticks', { x: tx, y: ty }, { x: 820, y: 1380, duration: .8, ease: 'power2.in' }, s0 + 1.05)
      .fromTo('#stick-a', { rotation: -2.5 }, { rotation: 0, transformOrigin: '100% 100%', duration: .1 }, s0 + 1.8)
      .fromTo('#morsel', { opacity: 1 }, { opacity: 0, duration: .05 }, s0 + 1.85);
  }
  const END = OFF + BITES * SEG;
  cardOut(c, '#c-t5', END + .1, .4);
  cardIn(c, '#c-t6', END + .5, .7);
  c.to({}, { duration: .2 }, END + 1.4);
  const total = c.duration();
  eatSnaps = [0, ...Array.from({ length: BITES }, (_, i) => (OFF + (i + 1) * SEG) / total), 1];

  /* ---------- 03: your hand → the camera turns around to you ---------- */
  const h = scrubTL('#s-hand');
  ST.hand = h.scrollTrigger;
  cardOut(h, '#c-t6', 0, .5);
  h.set(S, { people: 1 }, 0)
    .fromTo(A, { ...REST }, { ...REST, ...POV_HAND, duration: 1.9, ease: 'power2.out' }, .3)
    .fromTo(C, { r: 0, h: 0 }, { r: 0.32, h: 0.04, duration: 1.9, ease: 'power2.out' }, .3) // step back a little so the hand isn't in your face
    .fromTo(S, { handFleck: 0 }, { handFleck: 1, duration: 1 }, 1.6)
    .fromTo(TA, { hand: 0 }, { hand: 1, duration: .5 }, 2.3);
  cardIn(h, '#c-hand', 2.6);
  mob(h, 600, 1.0, 1.4, 650); // phone: follow the hand up (and lift it above the text card)
  mob(h, 800, 5.8, 2.4);      // …and back to centre during the turn
  cardOut(h, '#c-hand', 5.3);
  h.fromTo(TA, { hand: 1 }, { hand: 0, duration: .4 }, 5.3)
    // the turn: from your eyes, around you, to face you
    .fromTo(C, { theta: 0, r: 0.32, h: 0.04, lx: 0, ly: 0, lz: 0 }, { ...FRONT, duration: 4, ease: 'power2.inOut' }, 5.6)
    .fromTo('#table-bg', { opacity: 1 }, { opacity: 0, duration: 1.1 }, 5.7)
    .set(S, { fishVis: 0 }, 6.4)
    .fromTo(S, { amb: 1 }, { amb: 0.1, duration: 2.4 }, 5.8)
    .fromTo(A, { ...REST, ...POV_HAND }, { ...REST, duration: 2, ease: 'power2.inOut' }, 6.0)
    .fromTo(SP, { hero: 0 }, { hero: 1, duration: 1.4 }, 6.3)
    .fromTo(S, { heroFleck: 0 }, { heroFleck: 1, duration: 1.2 }, 8.2)
    .fromTo(TA, { people: 0 }, { people: 1, duration: .5 }, 9.2)
    .to({}, { duration: .3 }, 9.8);

  /* ---------- 03b: you, your family, your friends ---------- */
  const p = scrubTL('#s-people');
  ST.people = p.scrollTrigger;
  cardIn(p, '#c-you', .3); cardOut(p, '#c-you', 2.6);
  const WIDE = { theta: Math.PI, r: 6.4, h: -0.3, lx: HERO_FEET.x, ly: HERO_FEET.y + 0.75, lz: HERO_FEET.z + 0.6 };
  p.fromTo(C, { ...FRONT }, { ...WIDE, duration: 1.6, ease: 'power2.inOut' }, 2.4);
  // family, one by one from the dark (screen right)
  ['mother', 'father', 'dog', 'cat'].forEach((k, i) => p.fromTo(SP, { [k]: 0 }, { [k]: 1, duration: .6 }, 3.3 + i * .6));
  mob(p, 1180, 3.0, 1.2);  // phone: family (right)
  mob(p, 400, 6.5, 1.4);   // phone: friends (left)
  mob(p, 800, 10.6, 1.2);  // phone: back to you
  cardIn(p, '#c-family', 3.5); cardOut(p, '#c-family', 6.6);
  // friends (screen left)
  ['fr1', 'fr2', 'fr3'].forEach((k, i) => p.fromTo(SP, { [k]: 0 }, { [k]: 1, duration: .6 }, 6.9 + i * .6));
  cardIn(p, '#c-friends', 7.1); cardOut(p, '#c-friends', 10.3);
  p.fromTo(SP, { mother: 1, father: 1, dog: 1, cat: 1, fr1: 1, fr2: 1, fr3: 1 }, { mother: 0, father: 0, dog: 0, cat: 0, fr1: 0, fr2: 0, fr3: 0, duration: 1 }, 10.6)
    .fromTo(C, { ...WIDE }, { ...FRONT, duration: 1.4, ease: 'power2.inOut' }, 10.7)
    .to({}, { duration: .3 }, 12);

  /* ---------- 04: plastic everywhere (supermarket POV) ---------- */
  const m = scrubTL('#s-market');
  ST.market = m.scrollTrigger;
  const POV2 = { theta: Math.PI * 2, r: 0, h: 0, lx: 0, ly: 0, lz: 0 };
  m.fromTo(TA, { people: 1 }, { people: 0, duration: .4 }, 0)
    .fromTo(C, { ...FRONT }, { ...POV2, duration: 2.2, ease: 'power2.inOut' }, .1)
    .fromTo(SP, { hero: 1 }, { hero: 0, duration: 1 }, .8)
    .fromTo('#market-bg', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.4)
    .fromTo(S, { amb: 0.1 }, { amb: 0.85, duration: 1 }, 1.4)
    .set(S, { rig: 1 }, 2.0)
    .fromTo(TA, { props: 0 }, { props: 1, duration: .3 }, 2.1)
    // umbrella + sleeve
    .fromTo(P, { umb: 0 }, { umb: 1, duration: 1, ease: 'power2.out' }, 2.2)
    .fromTo(P, { sleeve: 0 }, { sleeve: 1, duration: 1, ease: 'power2.inOut' }, 3.6)
    .fromTo(P, { umbOut: 0 }, { umbOut: 1, duration: .7, ease: 'power2.in' }, 5.0);
  cardIn(m, '#c-umb', 2.4); cardOut(m, '#c-umb', 5.3);
  // walk up to the shelf, spot the cookies, take them
  m.fromTo(M, { z: 0 }, { z: 1, duration: 1.6, ease: 'power2.inOut' }, 5.9)
    .fromTo('#market-hl', { opacity: 0 }, { opacity: 1, duration: .4 }, 7.5)
    .fromTo('#market-target', { opacity: 1 }, { opacity: 0, duration: .2 }, 8.2)
    .fromTo('#market-hl', { opacity: 1 }, { opacity: 0, duration: .3 }, 8.3)
    .fromTo(P, { bag: 0 }, { bag: 1, duration: 1, ease: 'power2.out' }, 8.2)
    // bag → bags → cookie, and back again
    .fromTo(P, { open: 0 }, { open: 1, duration: 1, ease: 'power2.inOut' }, 9.4)
    .fromTo(P, { unwrap: 0 }, { unwrap: 1, duration: .9, ease: 'power2.inOut' }, 10.7)
    .fromTo(P, { unwrap: 1 }, { unwrap: 0, duration: .8, ease: 'power2.inOut' }, 12.2)
    .fromTo(P, { open: 1 }, { open: 0, duration: .8, ease: 'power2.inOut' }, 13.0);
  cardIn(m, '#c-cookie', 8.4); cardOut(m, '#c-cookie', 13.6);
  // into the shopping bag: the bag comes up first, then the cookies drop in
  m.fromTo(P, { shopUp: 0 }, { shopUp: 1, duration: .8, ease: 'power2.out' }, 14.0)
    .fromTo(P, { drop: 0 }, { drop: 1, duration: 1.2, ease: 'power2.in' }, 14.9)
    .fromTo(P, { out: 0 }, { out: 1, duration: .6, ease: 'power2.in' }, 16.3)
    .fromTo(TA, { props: 1 }, { props: 0, duration: .3 }, 16.3);
  cardIn(m, '#c-bag', 14.2); cardOut(m, '#c-bag', 16.6);
  // turn around again: you, holding the umbrella and the bag
  m.set(S, { rig: 0, held: 1 }, 17.0)
    .fromTo(A, { ...REST }, { ...REST, lx: -0.18, duration: 1 }, 17.0)
    .fromTo(C, { ...POV2 }, { ...FRONT, theta: Math.PI * 3, duration: 2.2, ease: 'power2.inOut' }, 17.05)
    .fromTo('#market-bg', { opacity: 1 }, { opacity: 0, duration: 1.2 }, 17.2)
    .fromTo(S, { amb: 0.85 }, { amb: 0.1, duration: 1.2 }, 17.2)
    .fromTo(SP, { hero: 0 }, { hero: 1, duration: 1 }, 17.9)
    .to({}, { duration: .3 }, 19.5);

  /* ---------- 05: Japan and the world ---------- */
  const j = scrubTL('#s-map');
  ST.map = j.scrollTrigger;
  // lower and from the side, so bar heights are easy to compare
  const MAPV = { theta: Math.PI * 3 - 0.3, r: PORTRAIT ? 21 : 13, h: PORTRAIT ? 6.5 : 4.2, lx: -3.3, ly: HERO_FEET.y + 0.4, lz: HERO_FEET.z + 1.0 };
  j.fromTo(C, { ...FRONT, theta: Math.PI * 3 }, { ...MAPV, duration: 3, ease: 'power2.inOut' }, 0)
    .fromTo(S, { heroScale: 1, amb: 0.1, map: 0 }, { heroScale: 0.001, amb: 0.75, map: 1, duration: 1.8 }, 1.0)
    .fromTo(SP, { hero: 1 }, { hero: 0, duration: 1 }, .8)
    .fromTo(TA, { pin: 0, map: 0 }, { pin: 1, map: 1, duration: .5 }, 2.6)
    .fromTo(B, { japan: 0 }, { japan: 1, duration: 1.4, ease: 'power2.out' }, 3.0);
  mob(j, 575, 2.2, 1.2);   // phone: Japan
  mob(j, 990, 6.3, 1.4);   // phone: the other countries
  mob(j, 800, 10.8, 1.0);
  cardIn(j, '#c-map1', 3.4); cardOut(j, '#c-map1', 6.3);
  [['usa', 6.6], ['china', 7.6], ['india', 8.6]].forEach(([k, at]) => {
    j.fromTo(B, { [k + 'S']: 1 }, { [k + 'S']: 0, duration: .7, ease: 'power2.out' }, at)        // country slides in
      .fromTo(B, { [k]: 0 }, { [k]: 1, duration: .6, ease: 'power2.out' }, at + .6);           // then its bar rises
  });
  cardIn(j, '#c-map2', 7.0); cardOut(j, '#c-map2', 10.8);
  j.to({}, { duration: .3 }, 11.8);

  /* ---------- 06: why does it matter? → into the body → the x-ray board ---------- */
  const w = scrubTL('#s-why');
  ST.why = w.scrollTrigger;
  const CHEST = { theta: Math.PI * 3, r: 0.12, h: -0.42, lx: HERO_FEET.x, ly: HERO_FEET.y + 1.15, lz: HERO_FEET.z };
  const WIDEF = { ...FRONT, theta: Math.PI * 3, r: 4.2, h: -0.45 };
  w.fromTo(C, { ...MAPV }, { ...FRONT, theta: Math.PI * 3, duration: 1.2, ease: 'power2.inOut' }, 0)
    .fromTo(S, { heroScale: 0.001, amb: 0.75, map: 0.999 }, { heroScale: 1, amb: 0.1, map: 0, duration: .9 }, .1)
    .fromTo(B, { japan: 1, usa: 1, china: 1, india: 1 }, { japan: 0, usa: 0, china: 0, india: 0, duration: .5 }, 0)
    .fromTo(TA, { pin: 1, map: 1 }, { pin: 0, map: 0, duration: .3 }, 0)
    .fromTo(SP, { hero: 0 }, { hero: 1, duration: .6 }, .7);
  cardIn(w, '#c-why', 1.3); cardOut(w, '#c-why', 3.0);
  w.set(S, { held: 0 }, 3.1)
    // fast zoom straight into the chest
    .fromTo(C, { ...FRONT, theta: Math.PI * 3 }, { ...CHEST, duration: .8, ease: 'power3.in' }, 3.2)
    .fromTo('#flash', { opacity: 0 }, { opacity: 1, duration: .25 }, 3.75)
    .fromTo('#xboard', { autoAlpha: 0 }, { autoAlpha: 1, duration: .05 }, 4.0)
    .fromTo('#xb-inner', { scale: 1.35 }, { scale: 1, duration: 1, ease: 'power2.out' }, 4.0)
    .fromTo('#flash', { opacity: 1 }, { opacity: 0, duration: .7 }, 4.05);
  ['brain', 'lungs', 'heart', 'blood', 'gut'].forEach((k, i) => w.fromTo(XA, { [k]: 0 }, { [k]: 1, duration: .5 }, 5.0 + i * .8));
  if (PORTRAIT) { // phone: the films are stacked, so scroll the board down to each film in turn
    const maxY = innerWidth * 2300 / 620 - innerHeight;
    const toFilm = (y) => -Math.min(maxY, Math.max(0, (y - 40) * XB_SCALE));
    w.fromTo('#xb-inner', { y: 0 }, { y: toFilm(870), duration: .7, ease: 'power2.inOut' }, 5.45)
      .fromTo('#xb-inner', { y: toFilm(870) }, { y: toFilm(1590), duration: .7, ease: 'power2.inOut' }, 7.05);
  }
  cardIn(w, '#c-xnote', 9.0); cardOut(w, '#c-xnote', 11.6);
  // zoom back out of the body
  w.fromTo('#xb-inner', { scale: 1 }, { scale: 0.55, duration: .8, ease: 'power2.in' }, 12.0)
    .fromTo('#xboard', { autoAlpha: 1 }, { autoAlpha: 0, duration: .6 }, 12.2)
    .fromTo(C, { ...CHEST }, { ...WIDEF, duration: 1.4, ease: 'power2.out' }, 12.2)
    .fromTo(XA, { brain: 1, lungs: 1, heart: 1, blood: 1, gut: 1 }, { brain: 0, lungs: 0, heart: 0, blood: 0, gut: 0, duration: .2 }, 12.8)
    .to({}, { duration: .2 }, 13.8);

  /* ---------- 07: so what can I do? ---------- */
  const q = scrubTL('#s-what');
  ST.what = q.scrollTrigger;
  q.set(S, { held: 1 }, 0)
    .fromTo(S, { drop: 0 }, { drop: 1, duration: 1.4, ease: 'power2.in' }, 2.3) // drops as the hands start to lift
    .fromTo(A, { ...REST, lx: -0.18 }, { lx: -0.5, lz: 0.7, rx: -0.5, rz: -0.7, headZ: 0.16, duration: 1.2, ease: 'back.out(1.6)' }, 2.3);
  cardIn(q, '#c-what', 3.4, .8);
  q.to({}, { duration: .4 }, 6.4);

  ScrollTrigger.refresh();
}

/* ---------- scenes 8–11 (built only after the click gate) ---------- */
function buildStory3() {
  const WIDEF = { theta: Math.PI * 3, r: 4.2, h: -0.45, lx: HERO_FEET.x, ly: HERO_FEET.y + 0.85, lz: HERO_FEET.z };
  const FRONT2 = { ...WIDEF, r: 4.4 };
  const SHRUG = { lx: -0.5, lz: 0.7, rx: -0.5, rz: -0.7, headZ: 0.16 };

  /* 08: the big players */
  const b = scrubTL('#s-players');
  ST.players = b.scrollTrigger;
  const PLAY = { theta: Math.PI * 3, r: 16.5, h: 2.4, lx: 0, ly: 1.4, lz: 10 }; // far back: you look small
  b.fromTo('#c-what', { autoAlpha: 1 }, { autoAlpha: 0, duration: .4 }, 0)
    .fromTo(A, { ...SHRUG }, { ...REST, duration: 1, ease: 'power2.inOut' }, .2)
    .fromTo(C, { ...WIDEF }, { ...PLAY, duration: 2, ease: 'power2.inOut' }, .3)
    .fromTo(TA, { players: 0 }, { players: 1, duration: .3 }, 2.4)
    .fromTo(PS, { factory: 0 }, { factory: 1, duration: 1.2, ease: 'power2.out' }, 2.6);
  cardIn(b, '#c-pl1', 2.9); cardOut(b, '#c-pl1', 5.2);
  b.fromTo(PS, { burner: 0 }, { burner: 1, duration: 1.2, ease: 'power2.out' }, 5.4);
  mob(b, 175, 2.4, 1.2);   // phone: the factory (left)
  mob(b, 1425, 5.2, 1.4);  // phone: the incinerator (right)
  mob(b, 800, 8.0, 1.2);   // phone: back to the centre for the crest
  cardIn(b, '#c-pl2', 5.7); cardOut(b, '#c-pl2', 8.0);
  b.fromTo(PS, { crest: 0 }, { crest: 1, duration: 1.6, ease: 'power2.out' }, 8.2);
  cardIn(b, '#c-pl3', 8.6); cardOut(b, '#c-pl3', 11.0);
  cardIn(b, '#c-small', 11.3, .8); cardOut(b, '#c-small', 13.6);
  b.to({}, { duration: .3 }, 14);

  /* 09: small switches */
  const r = scrubTL('#s-reuse');
  ST.reuse = r.scrollTrigger;
  r.fromTo(PS, { factory: 1, burner: 1, crest: 1 }, { factory: 0, burner: 0, crest: 0, duration: 1.2, ease: 'power2.in' }, .1)
    .fromTo(TA, { players: 1 }, { players: 0, duration: .3 }, .1)
    .fromTo(C, { ...PLAY }, { ...FRONT2, duration: 1.6, ease: 'power2.inOut' }, .3)
    .fromTo(S, { reuse: 0 }, { reuse: 1, duration: 1.4, ease: 'back.out(1.4)' }, 1.6)
    .fromTo(A, { ...REST }, { ...REST, lx: -0.3, rz: -0.14, duration: 1 }, 1.6);
  cardIn(r, '#c-reuse1', 1.3); cardOut(r, '#c-reuse1', 5.2);
  cardIn(r, '#c-reuse2', 5.4); cardOut(r, '#c-reuse2', 8.6);
  r.to({}, { duration: .3 }, 9.6);

  /* 10: together — one by one, the crowd joins */
  const c = scrubTL('#s-crowd');
  ST.crowd = c.scrollTrigger;
  const CROWD = { theta: Math.PI * 3, r: 9, h: 3.6, lx: 0, ly: -1.6, lz: 14 };
  // only create the people this camera will actually see
  const tc = camera.clone();
  tc.position.set(Math.sin(CROWD.theta) * CROWD.r, CROWD.h, CAM_Z + Math.cos(CROWD.theta) * CROWD.r);
  tc.aspect = innerWidth / innerHeight; tc.updateProjectionMatrix();
  tc.lookAt(CROWD.lx, CROWD.ly, CROWD.lz); tc.updateMatrixWorld();
  PL.buildCrowd(tc); // high, looking out to the horizon
  c.fromTo(C, { ...FRONT2 }, { ...CROWD, duration: 3, ease: 'power2.inOut' }, 0)
    .fromTo(S, { crowd: 0 }, { crowd: 1, duration: 7.4 }, 1.0)
    .fromTo(S, { amb: 0.1 }, { amb: 0.75, duration: 7.4 }, 1.0)
    .fromTo(S, { fog: 0 }, { fog: 1, duration: 2.5 }, 0)
    .fromTo(TA, { people: 0 }, { people: 1, duration: .4 }, 2.8);
  cardIn(c, '#c-crowd1', .6); cardOut(c, '#c-crowd1', 3.8);
  cardIn(c, '#c-crowd2', 4.6); cardOut(c, '#c-crowd2', 8.8);
  c.to({}, { duration: .3 }, 9.2);

  /* 11: the end */
  const f = scrubTL('#s-final');
  ST.final = f.scrollTrigger;
  f.fromTo('#blackout', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0)
    .fromTo('#final', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.3)
    .fromTo('.final-links', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: .8 }, 2.0)
    .fromTo('.final-refs', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: .8 }, 2.3)
    .to({}, { duration: .3 }, 5.6);
}

/* ---------- bite snapping (directional, Lenis-driven) ---------- */
let snapTimer = 0, snapping = false;
lenis.on('scroll', () => {
  updateMarker();
  if (snapping || !stEat) return;
  clearTimeout(snapTimer);
  snapTimer = setTimeout(trySnap, 140);
});
function trySnap() {
  if (!stEat || !stEat.isActive) return;
  const p = stEat.progress;
  let i = 0;
  while (i < eatSnaps.length - 2 && p > eatSnaps[i + 1]) i++;
  const lo = eatSnaps[i], hi = eatSnaps[i + 1];
  const frac = (p - lo) / (hi - lo);
  if (frac < 0.002 || frac > 0.998) return;
  const target = lenis.direction >= 0 ? (frac > .1 ? hi : lo) : (frac < .9 ? lo : hi);
  snapping = true;
  lenis.scrollTo(stEat.start + target * (stEat.end - stEat.start), {
    duration: 1.1,
    easing: (x) => 1 - Math.pow(1 - x, 3),
    onComplete: () => { snapping = false; },
  });
  setTimeout(() => { snapping = false; }, 1400);
}

function updateMarker() {
  if (!stStore) return;
  const order = [[ST.final, 'scene11'], [ST.crowd, 'scene10'], [ST.reuse, 'scene9'], [ST.players, 'scene8'], [ST.what, 'scene7'], [ST.why, 'scene6'], [ST.map, 'scene5'], [ST.market, 'scene4'], [ST.people, 'scene3b'], [ST.hand, 'scene3'], [stEat, 'scene2b'], [stTable, 'scene2']];
  for (const [st, k] of order) if (st && st.progress > 0) return setScene(k);
  if (stStore.progress > .05) return setScene('scene1b');
  setScene('scene1');
}

/* =========================================================
   MOUSE PARALLAX
   ========================================================= */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = e.clientX / innerWidth - .5;
  mouse.ty = e.clientY / innerHeight - .5;
});

/* =========================================================
   RESIZE + LOOP
   ========================================================= */
let lastShift = null;
const stageEls = [$('#stage-bg'), $('#stage-fg')];
function resize() {
  measure();
  renderer.setSize(stage.vw, stage.vh, false);
  camera.aspect = stage.vw / stage.vh;
  camera.updateProjectionMatrix();
  hud.setAttribute('viewBox', `0 0 ${stage.vw} ${stage.vh}`);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const numEl = $('#ingest-num');
let lastCount = -1, lastZoom = -1;
const marketZoom = $('#market-zoom');
const headW = new THREE.Vector3(), bagPos = new THREE.Vector3(), ringPos = new THREE.Vector3();

function applyWorld(time) {
  world.root.visible = S.people > 0.5;
  if (!world.root.visible) return;
  // hero pose
  hero.armL.piv.rotation.set(A.lx, 0, A.lz);
  hero.armR.piv.rotation.set(A.rx, 0, A.rz);
  hero.headGroup.rotation.z = A.headZ;
  hero.root.scale.setScalar(Math.max(0.001, S.heroScale));
  hero.root.visible = S.heroScale > 0.01;
  hero.headGroup.getWorldPosition(headW);
  hero.headGroup.visible = camera.position.distanceTo(headW) > 0.34; // hide your own head in POV
  // spotlights + flecks revealed with the light
  for (const k in world.spots) world.spots[k].set(SP[k]); // (not `in SP`: GSAP adds a _gsap key to it)
  for (const k in world.others) { const o = world.others[k]; o.root.visible = SP[k] > 0.001; o.fleck.uniforms.uOpacity.value = SP[k]; }
  hero.fleck.uniforms.uOpacity.value = S.heroFleck;
  hero.handFleck.uniforms.uOpacity.value = Math.max(S.handFleck, S.heroFleck);
  // held items + the drop
  const hu = world.held;
  hu.umbrella.visible = hu.bag.visible = S.held > 0.5 && S.drop < 0.999;
  hu.umbrella.position.y = -0.88 - S.drop * 0.3; hu.umbrella.rotation.z = S.drop * 1.25;
  hu.bag.position.y = -0.02 - S.drop * 0.4; hu.bag.rotation.z = S.drop * 0.5;
  const fade = 1 - smooth(0.55, 1, S.drop);
  heldMats.forEach((mt) => { mt.opacity = fade * (mt.userData.baseOpacity ?? (mt.userData.baseOpacity = mt.opacity)); });
  // supermarket props (camera space)
  const pr = world.props;
  pr.rig.visible = S.rig > 0.5;
  if (PORTRAIT) pr.rig.position.set(-0.2, 0, -0.95); // phone: step back so the whole bag / umbrella fits
  if (pr.rig.visible) {
    pr.umbrella.visible = P.umb > 0.001 && P.umbOut < 0.999;
    pr.umbrella.position.set(0.25 - P.umbOut * 1.8, -0.45 - (1 - P.umb) * 1.5 + P.umbOut * 0.3, -1.6);
    pr.umbrella.rotation.set(0, time * 0.3, 0.12 + P.umbOut * 0.5);
    pr.sleeve.visible = P.sleeve > 0.001;
    pr.sleeve.position.y = 0.01 - (1 - P.sleeve) * 0.95;
    // the bag starts exactly where it sat on the (zoomed) shelf, then comes forward
    pr.cookieBag.visible = P.bag > 0.001 && P.out < 0.999;
    // ...and at the end it lifts above the shopping bag's opening, then drops in
    bagPos.set(lerp(0.25, 0.2, P.bag), lerp(0, -0.05, P.bag) + P.shopUp * 0.4 - P.drop * 0.6 - P.out * 1.5, -1.7 - P.open * 0.5);
    pr.cookieBag.position.copy(bagPos);
    pr.cookieBag.rotation.set(0, Math.sin(time * 0.8) * 0.18 * P.bag * (1 - P.shopUp), 0);
    pr.cookieBag.scale.setScalar(lerp(0.5, 1, P.bag) * lerp(1, 0.5, P.shopUp));
    const n = pr.packets.length;
    pr.packets.forEach((pk, i) => {
      const ang = (i / n) * Math.PI * 2 + 0.3;
      ringPos.set(0.2 + Math.cos(ang) * 0.46, -0.05 + Math.sin(ang) * 0.32, -1.45);
      pk.position.lerpVectors(bagPos, ringPos, P.open);
      let sc = 0.3 + 0.55 * P.open;
      if (i === 0) { pk.position.lerp(tmpW.set(0.2, -0.05, -1.15), P.unwrap); sc *= 1 + P.unwrap * 0.5; }
      pk.scale.setScalar(sc);
      pk.rotation.set(0.2, Math.sin(time + i) * 0.3, ang * 0.15);
      pk.visible = P.open > 0.02 && !(i === 0 && P.unwrap > 0.55);
    });
    pr.cookie.visible = P.unwrap > 0.45;
    pr.cookie.position.set(0.2, -0.05, -1.1);
    pr.cookie.scale.setScalar(Math.max(0.001, smooth(0.45, 1, P.unwrap) * 1.7));
    pr.cookie.rotation.set(0.3, time * 0.8, 0);
    pr.shopBag.visible = P.shopUp > 0.001 && P.out < 0.999;
    pr.shopBag.position.set(0.2, -1.6 + P.shopUp * 1.78 - P.out * 1.5, -1.45);
    pr.shopBag.rotation.set(0.35, 0, 0); // tipped toward you so you see into the opening
  }
  // walking up to the shelf: zoom the 2D aisle around the cookie bag
  if (M.z !== lastZoom) {
    lastZoom = M.z;
    const s = 1 + 2.6 * M.z, c = MARKET_TARGET;
    const px = lerp(c.x, PORTRAIT ? 830 : 1010, M.z), py = lerp(c.y, 450, M.z);
    marketZoom.setAttribute('transform', `translate(${(px - c.x * s).toFixed(2)} ${(py - c.y * s).toFixed(2)}) scale(${s.toFixed(4)})`);
  }
  // map + bars
  for (const k in PL.players) PL.setPlayer(k, PS[k]);
  PL.setReuse(S.reuse);
  PL.setCrowd(S.crowd);
  world.setMap(S.map);
  const bars = world.bars;
  bars.japan.set(B.japan, 0); bars.usa.set(B.usa, B.usaS); bars.china.set(B.china, B.chinaS); bars.india.set(B.india, B.indiaS);
}

gsap.ticker.add(() => {
  const time = clock.getElapsedTime();
  fish.U.uTime.value = time;

  if (mode === 'swim' || mode === 'intro') Object.assign(S, swimPose(time));

  fish.group.visible = S.fishVis > 0.5;
  fish.group.position.set(S.x, S.y + Math.sin(time * 1.2) * 0.03 * S.idle, S.z);
  fish.group.rotation.set(S.rx, S.ry + Math.sin(time * .6) * .16 * S.idle, S.rz);
  fish.group.scale.setScalar(S.s);
  fish.U.uSwim.value = S.swim;
  fish.U.uEaten.value = S.eaten;
  fish.setCook(S.cook);
  fish.bones.visible = S.cook > .5;
  fish.dots.material.uniforms.uGlow.value = S.glow;
  fish.U.uDepth.value = S.depth;
  fish.dots.material.uniforms.uOpacity.value = S.dots * (1 - 0.4 * S.depth);
  water.visible = S.water > 0.001;
  water.material.uniforms.uOpacity.value = S.water;
  scene.fog.near = lerp(400, 12, S.fog); scene.fog.far = lerp(800, 52, S.fog);
  hemi.intensity = 1.0 * S.amb; key.intensity = 2.4 * S.amb; rim.intensity = 1.4 * S.amb;

  // camera rig (+ mouse parallax in the sea scene)
  mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
  camera.position.set(
    Math.sin(C.theta) * C.r + mouse.x * .35 * S.parallax,
    C.h - mouse.y * .18 * S.parallax,
    CAM_Z + Math.cos(C.theta) * C.r,
  );
  if (S.shake > 0.001) { camera.position.x += (Math.random() - .5) * S.shake * 0.3; camera.position.y += (Math.random() - .5) * S.shake * 0.3; }
  camera.lookAt(C.lx, C.ly, C.lz);
  // phone pan: shift the 3D image and the 2D stages by the same number of pixels
  if (PORTRAIT) {
    const shift = (800 - MF.x) * stage.k, shiftY = (MF.y - 450) * stage.k;
    camera.projectionMatrix.elements[8] = -2 * shift / stage.vw;
    camera.projectionMatrix.elements[9] = -2 * shiftY / stage.vh;
    const key = shift.toFixed(1) + ',' + shiftY.toFixed(1);
    if (key !== lastShift) {
      lastShift = key;
      stageEls.forEach((s) => { s.style.transform = `translate(calc(-50% + ${shift.toFixed(1)}px), ${(-shiftY).toFixed(1)}px)`; });
    }
  }
  camera.updateMatrixWorld();

  document.body.classList.toggle('gate', !!gateActive());
  applyWorld(time);
  fish.group.updateMatrixWorld();
  renderer.render(scene, camera);
  updateHud();
  updateBoard();

  if (S.eaten > 0 || lastCount > 0) {
    const n = fish.ingestedCount();
    if (n !== lastCount) { numEl.textContent = n; lastCount = n; }
  }
});
