// Scenes 3–7: rounded pictogram people, pets, spotlights, props, organs, Japan map.
// World layout: the protagonist ("hero") stands with feet at HERO_FEET, facing −z,
// so the default camera (0, 0, 6) sits exactly at their eyes (POV).
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DOT_FRAG } from './fish.js';

export const HERO_FEET = new THREE.Vector3(0, -1.6, 6.03);
const PLASTIC = '#08869c', ICE = '#e3f2fa';

/* ---------------- materials ---------------- */
const clay = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.02 });
const plasticMat = (opacity = 1) => new THREE.MeshStandardMaterial({
  color: PLASTIC, roughness: 0.28, metalness: 0.05, emissive: PLASTIC, emissiveIntensity: 0.35,
  transparent: opacity < 1, opacity, side: THREE.DoubleSide,
});

/* ---------------- plastic flecks on any mesh ---------------- */
const FLECK_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uSize, uPR, uOpacity;
  varying float vAlpha; varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPR * (0.7 + aSeed * 0.6) / -mv.z, 2.5 * uPR, 30.0 * uPR);
    vAlpha = uOpacity;
    vSeed = aSeed;
  }`;
export function fleckMaterial(uTime, pr, size = 26) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime, uPR: { value: pr }, uSize: { value: size }, uOpacity: { value: 0 }, uGlow: { value: 1.2 }, uColor: { value: new THREE.Color('#3fd3e8') } },
    vertexShader: FLECK_VERT, fragmentShader: DOT_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
function addFlecks(mesh, count, mat) {
  const sampler = new MeshSurfaceSampler(mesh).build();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), pos = [], seed = [];
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n);
    p.addScaledVector(n, 0.012);
    pos.push(p.x, p.y, p.z); seed.push(Math.random());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 3;
  mesh.add(pts);
  return pts;
}

/* ---------------- primitives ---------------- */
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat);
const sphere = (r, mat, w = 28, h = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
function cap(r, mat, cover = 0.5, tiltBack = 0.35) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * cover), mat);
  m.rotation.x = -tiltBack;
  return m;
}

/* ---------------- a person ---------------- */
// opts: { color, hair: 'short'|'bob'|'long'|'bald', height, build, dress, glasses, baseballCap, ponytail, backpack, headphones, tote, hood }
export function makePerson(opts = {}) {
  const o = { color: '#bcc1c3', hair: 'short', height: 1, build: 1, ...opts };
  const mat = clay(o.color), dark = clay('#2c3134'), mid = clay('#6c7477');
  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(o.height); root.add(body);
  const meshes = [];
  const add = (m, parent = body) => { parent.add(m); meshes.push(m); return m; };

  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = add(capsule(0.068, 0.56, mat)); leg.position.set(s * 0.082 * o.build, 0.36, 0); legs.push(leg);
  }
  // torso: one smooth lathed shape — rounded hips, slight waist, broad rounded shoulders
  const torsoProfile = [
    [0.0, 0.70], [0.09, 0.705], [0.14, 0.73], [0.158, 0.78], [0.155, 0.9], [0.158, 1.02], [0.172, 1.16],
    [0.186, 1.27], [0.184, 1.33], [0.165, 1.385], [0.12, 1.42], [0.06, 1.435], [0.0, 1.44],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = add(new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 64), mat));
  torso.scale.set(1.12 * o.build, 1, 0.7);
  if (o.dress) {
    const pts = [new THREE.Vector2(0.001, 0.5), new THREE.Vector2(0.31, 0.5), new THREE.Vector2(0.27, 0.62), new THREE.Vector2(0.2, 0.9), new THREE.Vector2(0.16, 1.02)];
    const dress = add(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat)); dress.scale.z = 0.8;
  }
  // head
  const headGroup = new THREE.Group(); headGroup.position.y = 1.56; body.add(headGroup);
  const head = add(sphere(0.13, mat, 36, 28), headGroup);
  // hair
  if (o.hair === 'short') { const h = add(cap(0.137, dark, 0.46, 0.45), headGroup); h.position.y = 0.012; }
  if (o.hair === 'bob' || o.hair === 'long') { const h = add(cap(0.148, dark, 0.62, 0.55), headGroup); h.position.y = 0.005; }
  if (o.hair === 'long') { const b = add(capsule(0.11, 0.16, dark), headGroup); b.scale.z = 0.5; b.position.set(0, -0.12, -0.08); }
  if (o.ponytail) { const p = add(capsule(0.04, 0.16, dark), headGroup); p.position.set(0, -0.02, -0.17); p.rotation.x = 0.55; }
  if (o.baseballCap) {
    const c = add(cap(0.142, mid, 0.45, 0.2), headGroup); c.position.y = 0.02;
    const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 28), mid), headGroup);
    brim.scale.z = 0.8; brim.position.set(0, 0.06, 0.11); brim.rotation.x = 0.12;
  }
  if (o.glasses) {
    const gm = clay('#111414');
    for (const s of [-1, 1]) { const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 8, 24), gm), headGroup); ring.position.set(s * 0.048, 0.012, 0.124); }
    const bridge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), gm), headGroup); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.016, 0.128);
  }
  if (o.headphones) { // worn on the head: a band over the top + two ear cups
    const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.011, 10, 40, Math.PI), dark), headGroup); band.position.y = 0.005;
    for (const s of [-1, 1]) {
      const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 24), dark), headGroup);
      cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.138, 0.0, 0);
    }
  }
  if (o.backpack) {
    const bp = add(new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.32, 0.12, 4, 0.05), mid)); bp.position.set(0, 1.1, -0.165);
  }
  // arms: pivot at the shoulder, so posing = rotating the pivot. Rounded ends, no hands.
  const arm = (s) => {
    const piv = new THREE.Group(); piv.position.set(s * 0.222 * o.build, 1.34, 0); body.add(piv);
    const a = add(capsule(0.05, 0.5, mat), piv); a.position.y = -0.28;
    const hand = new THREE.Group(); hand.position.y = -0.56; piv.add(hand); // where held items attach
    piv.rotation.z = s * 0.07;
    return { piv, hand, mesh: a };
  };
  const armL = arm(1), armR = arm(-1);   // local +x is the person's left (they face +z)
  if (o.tote) { // small crossbody bag on the hip, strap across the chest
    const bag = add(new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.13, 0.06, 4, 0.025), mid)); bag.position.set(-0.11, 0.86, 0.13);
    const strapCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.14, 1.37, 0.0), new THREE.Vector3(0.1, 1.3, 0.13), new THREE.Vector3(-0.02, 1.08, 0.13), new THREE.Vector3(-0.11, 0.92, 0.13)]);
    add(new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 30, 0.008, 6), mid));
  }
  return { root, body, headGroup, head, torso, legs, armL, armR, meshes, mats: [mat, dark, mid] };
}

/* ---------------- pets ---------------- */
export function makeDog(color = '#a9aeb0') {
  const mat = clay(color), dark = clay('#3a4043');
  const root = new THREE.Group(); const meshes = [];
  const add = (m) => { root.add(m); meshes.push(m); return m; };
  const body = add(capsule(0.12, 0.3, mat)); body.rotation.x = Math.PI / 2; body.position.y = 0.32;
  for (const [x, z] of [[-0.07, 0.13], [0.07, 0.13], [-0.07, -0.13], [0.07, -0.13]]) { const l = add(capsule(0.035, 0.16, mat)); l.position.set(x, 0.13, z); }
  const head = add(sphere(0.11, mat)); head.position.set(0, 0.48, 0.25);
  const snout = add(sphere(0.055, mat)); snout.position.set(0, 0.45, 0.35); snout.scale.set(1, 0.85, 1.1);
  const nose = add(sphere(0.018, dark)); nose.position.set(0, 0.47, 0.405);
  for (const s of [-1, 1]) { const ear = add(sphere(1, dark)); ear.scale.set(0.03, 0.075, 0.05); ear.position.set(s * 0.1, 0.47, 0.23); ear.rotation.z = s * 0.3; }
  const tail = add(capsule(0.022, 0.13, mat)); tail.position.set(0, 0.42, -0.24); tail.rotation.x = -0.7;
  return { root, meshes, mats: [mat, dark], torso: body };
}
export function makeCat(color = '#8e9497') {
  const mat = clay(color);
  const root = new THREE.Group(); const meshes = [];
  const add = (m) => { root.add(m); meshes.push(m); return m; };
  const body = add(capsule(0.09, 0.18, mat)); body.rotation.x = Math.PI / 2 - 0.5; body.position.set(0, 0.2, 0);
  for (const [x, z] of [[-0.05, 0.08], [0.05, 0.08]]) { const l = add(capsule(0.024, 0.13, mat)); l.position.set(x, 0.09, z); }
  const head = add(sphere(0.085, mat)); head.position.set(0, 0.38, 0.1);
  for (const s of [-1, 1]) { const ear = add(new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.07, 12), mat)); ear.position.set(s * 0.05, 0.47, 0.1); ear.rotation.z = -s * 0.25; }
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, -0.12), new THREE.Vector3(0.05, 0.06, -0.25), new THREE.Vector3(0.14, 0.12, -0.22), new THREE.Vector3(0.18, 0.3, -0.18)]);
  add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.02, 8), mat));
  return { root, meshes, mats: [mat], torso: body };
}

/* ---------------- spotlight with a visible cone + floor pool ---------------- */
const CONE_VERT = /* glsl */ `
  uniform float uH; varying float vY; varying vec3 vN; varying vec3 vV;
  void main() {
    vY = -position.y / uH;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CONE_FRAG = /* glsl */ `
  uniform float uK; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(abs(dot(vN, vV)), 1.6);
    float a = (1.0 - vY * 0.8) * 0.16 * uK * f;
    gl_FragColor = vec4(uColor, a);
  }`;
const POOL_FRAG = /* glsl */ `
  uniform float uK; uniform vec3 uColor; varying vec2 vUv;
  void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.2, 1.0, d)) * 0.32 * uK); }`;

export function makeSpot(parent, target, { width = 0.75, color = '#eaf3f5', H = 4.2 } = {}) {
  const light = new THREE.SpotLight(color, 0, 14, Math.atan(width / H) * 1.25, 0.6, 0);
  light.position.set(target.x, target.y + H, target.z - 1.5); // a little toward the camera, so faces catch the light
  light.target.position.copy(target);
  parent.add(light, light.target);
  const coneGeo = new THREE.ConeGeometry(width, H, 40, 1, true); coneGeo.translate(0, -H / 2, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uH: { value: H }, uColor: { value: new THREE.Color(color) } },
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  cone.position.set(target.x, target.y + H, target.z); cone.renderOrder = 5;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(width * 2.4, width * 2.4), new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(target.x, HERO_FEET.y + 0.002, target.z);
  parent.add(cone, pool);
  const spot = { light, cone, pool, k: 0, max: 3.2 };
  spot.set = (k) => {
    spot.k = k;
    light.intensity = k * spot.max;
    cone.material.uniforms.uK.value = k; pool.material.uniforms.uK.value = k;
    cone.visible = pool.visible = light.visible = k > 0.001;
  };
  return spot;
}

/* ---------------- props ---------------- */
function umbrella() {
  const g = new THREE.Group();
  const canvasMat = clay('#2a2f32'), metal = new THREE.MeshStandardMaterial({ color: '#a7aeb1', metalness: 0.8, roughness: 0.3 });
  const pts = [new THREE.Vector2(0.004, 0), new THREE.Vector2(0.03, 0.06), new THREE.Vector2(0.055, 0.25), new THREE.Vector2(0.05, 0.5), new THREE.Vector2(0.02, 0.62), new THREE.Vector2(0.004, 0.66)];
  const canopy = new THREE.Mesh(new THREE.LatheGeometry(pts, 8), canvasMat); canopy.position.y = 0.04; g.add(canopy);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.86, 8), metal); shaft.position.y = 0.43; g.add(shaft);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 10, 24, Math.PI), clay('#1b1f21')); handle.position.set(0.045, 0.86, 0); g.add(handle); // J-hook curving up and over
  return g;
}
function umbrellaSleeve() {
  const pts = [new THREE.Vector2(0.004, 0), new THREE.Vector2(0.045, 0.05), new THREE.Vector2(0.07, 0.25), new THREE.Vector2(0.07, 0.75)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), plasticMat(0.55));
  m.position.y = 0.01;
  return m;
}
// pillow-shaped bag (snack bag / individual wrapper): a soft rounded box with crimped ends
function pillow(w, h, d, mat) {
  const g = new THREE.Group();
  const geo = new RoundedBoxGeometry(w, h * 0.94, d, 5, Math.min(d * 0.49, w * 0.2));
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { // puff the middle out, pinch toward the crimped ends
    v.fromBufferAttribute(p, i);
    const k = 1 - Math.pow(Math.abs(v.y) / (h * 0.47), 2);
    p.setZ(i, v.z * (0.35 + 0.65 * Math.max(0, k)));
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, mat); g.add(body);
  for (const s of [-1, 1]) {
    const crimp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, h * 0.05, d * 0.18), mat);
    crimp.position.y = s * h * 0.49; g.add(crimp);
  }
  return g;
}
function cookieMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 32), clay('#b8afa2'));
  m.rotation.x = Math.PI / 2; g.add(m);
  for (let i = 0; i < 6; i++) { const c = sphere(0.009, clay('#3b3430'), 8, 6); const a = i * 1.1; c.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.012); g.add(c); }
  return g;
}
function shopBag() {
  const g = new THREE.Group();
  const mat = plasticMat(0.72);
  mat.depthWrite = false;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.2, 8, 20), mat); body.scale.z = 0.45; body.position.y = -0.22; g.add(body);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 20, Math.PI), mat); h.position.set(s * 0.05, -0.04, 0); g.add(h); }
  return g;
}

/* ---------------- Japan map + bars ---------------- */
// simplified coastlines (lon, lat)
const JAPAN = {
  hokkaido: [[140.0, 41.4], [139.9, 42.2], [140.4, 43.3], [141.4, 43.3], [141.6, 44.4], [141.7, 45.4], [142.1, 45.4], [143.0, 44.6], [144.3, 44.1], [145.3, 44.35], [145.3, 43.6], [145.8, 43.4], [144.4, 42.95], [143.3, 42.0], [142.4, 42.3], [141.4, 42.55], [140.9, 42.1], [141.1, 41.8], [140.6, 41.75]],
  honshu: [[141.45, 41.45], [141.45, 40.55], [142.05, 39.5], [141.6, 38.4], [140.95, 37.85], [141.0, 36.95], [140.65, 36.1], [140.9, 35.7], [140.35, 35.1], [139.85, 34.95], [139.85, 35.45], [139.6, 35.35], [139.15, 35.15], [138.85, 34.6], [138.45, 35.0], [137.6, 34.65], [136.85, 34.3], [136.1, 33.45], [135.15, 33.85], [135.1, 34.25], [135.4, 34.7], [134.3, 34.7], [133.4, 34.45], [132.4, 34.3], [131.95, 33.95], [130.9, 33.95], [131.2, 34.35], [131.85, 34.75], [132.7, 35.45], [133.4, 35.5], [134.4, 35.6], [135.3, 35.55], [135.9, 35.75], [136.1, 36.25], [136.7, 36.9], [136.9, 37.4], [137.35, 37.5], [137.0, 36.85], [137.5, 36.75], [138.25, 37.15], [138.85, 37.8], [139.45, 38.35], [139.85, 39.1], [140.05, 39.85], [139.9, 40.55], [140.3, 41.25], [140.75, 41.05], [140.9, 40.85], [141.25, 41.15]],
  shikoku: [[132.45, 33.3], [132.95, 32.75], [133.25, 33.4], [134.15, 33.25], [134.75, 33.8], [134.6, 34.2], [133.7, 34.4], [133.0, 34.05], [132.6, 33.95]],
  kyushu: [[130.9, 33.9], [131.55, 33.65], [131.9, 33.15], [131.85, 32.45], [131.45, 31.55], [131.05, 31.0], [130.65, 31.1], [130.2, 31.45], [130.35, 32.15], [130.15, 32.75], [129.65, 33.15], [129.85, 33.55], [130.35, 33.6]],
};
const LON0 = 139.7, LAT0 = 35.7, MAPK = 0.5, COSL = Math.cos(36 * Math.PI / 180);
export function lonLatToWorld(lon, lat) {
  return new THREE.Vector3(-(lon - LON0) * MAPK * COSL + HERO_FEET.x, HERO_FEET.y, (lat - LAT0) * MAPK + HERO_FEET.z);
}
function makeMap() {
  const g = new THREE.Group();
  const fill = new THREE.MeshStandardMaterial({ color: '#2a3134', roughness: 0.8, transparent: true, opacity: 1 });
  const lineMat = new THREE.LineBasicMaterial({ color: '#b9c3c6', transparent: true, opacity: 1 });
  for (const key in JAPAN) {
    const pts = JAPAN[key].map(([lon, lat]) => lonLatToWorld(lon, lat));
    // shape in (x, -z) so it can be extruded upward after rotating
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, fill); mesh.position.y = HERO_FEET.y - 0.06; g.add(mesh);
    const lp = pts.map((p) => new THREE.Vector3(p.x, HERO_FEET.y + 0.004, p.z)); lp.push(lp[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), lineMat));
  }
  // faint grid
  const grid = new THREE.GridHelper(40, 40, '#2b3335', '#1a2022');
  grid.position.set(-2, HERO_FEET.y - 0.065, 7); grid.material.transparent = true; grid.material.opacity = 0.6; g.add(grid);
  g.visible = false;
  return { group: g, fill, lineMat, grid };
}
// simplified outlines (lon, lat) for the comparison countries — shown as tiles, not to geographic scale
const COUNTRY = {
  usa: [[-124.7, 48.4], [-124.1, 46.2], [-124.2, 42], [-122.4, 37.8], [-120.5, 34.5], [-117.1, 32.5], [-114.7, 32.7], [-111, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.5, 29.6], [-103.3, 29], [-101.4, 29.8], [-99.5, 27.5], [-97.2, 25.9], [-97.4, 27.8], [-94.7, 29.4], [-90, 29.2], [-89.2, 30.3], [-85.4, 29.7], [-83, 29], [-82.7, 27.5], [-81.1, 25.2], [-80.1, 26.6], [-81.4, 30.7], [-80.8, 32.1], [-75.5, 35.2], [-76.3, 37], [-74, 40.5], [-70, 41.7], [-70.7, 43], [-67, 44.8], [-67.8, 47.1], [-69.2, 47.4], [-71.5, 45], [-75, 45], [-76.8, 43.6], [-79.2, 43.4], [-82.5, 41.7], [-83.1, 42.2], [-82.4, 43], [-84.7, 46.5], [-89, 48], [-95.2, 49], [-123, 49]],
  china: [[73.6, 39.5], [75, 37.3], [78, 35.5], [79.5, 32.5], [78.8, 31], [81, 30.2], [85, 28.3], [88, 27.9], [92, 27.8], [97, 28.2], [98.6, 25], [97.5, 24], [101, 21.5], [104, 22.7], [106.7, 21.9], [108, 21.5], [110, 20.3], [111, 21.4], [113.5, 22.2], [117, 23.4], [119.5, 25.6], [121.5, 28.5], [122, 30.8], [120.8, 32.5], [119.2, 34.6], [120.2, 36], [122.5, 37], [121, 37.8], [118.9, 37.5], [117.8, 38.6], [121.5, 40.9], [124.3, 40], [126, 41.5], [128.2, 42], [130.6, 42.4], [131.3, 44.9], [133, 48.2], [130.6, 48.9], [127.4, 50], [125.5, 52.8], [120.8, 53.3], [119.5, 50], [116.6, 49.9], [115.5, 47.6], [119, 46.7], [112, 45.1], [111, 43.4], [105, 41.7], [100, 42.6], [96.4, 42.7], [95.3, 44.3], [91.1, 45.2], [90.6, 47.7], [87.8, 49.2], [85.5, 47.1], [82.6, 45.4], [80.2, 42.2], [76, 40.4]],
  india: [[68.2, 23.7], [70.3, 21], [72.7, 20.8], [73, 19], [74, 15.8], [75.5, 12.5], [76.5, 9.5], [77.5, 8.1], [78.2, 9], [79.9, 10.3], [80.2, 13.1], [80.3, 15.9], [82.3, 16.6], [84.9, 19.3], [86.9, 21.4], [88.6, 21.6], [89, 22.1], [89.1, 26.5], [92, 25.2], [92.4, 22.5], [93.5, 24], [94.6, 25.3], [95.3, 27], [97.3, 28.2], [96.1, 29.4], [94.2, 29.2], [92, 26.9], [89.7, 26.7], [88.1, 27.9], [85, 27.3], [81, 30.2], [78.9, 31.3], [79, 32.5], [78, 34.8], [77.6, 35.5], [74.7, 37], [73.8, 34.3], [74.6, 32.5], [73.5, 29.9], [71, 27.8], [69.5, 26.7], [70.5, 25.5]],
};
function countryTile(poly, size) {
  const latC = poly.reduce((s, p) => s + p[1], 0) / poly.length, c = Math.cos(latC * Math.PI / 180);
  let pts = poly.map(([lon, lat]) => new THREE.Vector2(-lon * c, lat)); // east → −x, north → +z
  const box = new THREE.Box2().setFromPoints(pts), ctr = box.getCenter(new THREE.Vector2()), sz = box.getSize(new THREE.Vector2());
  const k = size / Math.max(sz.x, sz.y);
  pts = pts.map((p) => p.sub(ctr).multiplyScalar(k));
  const g = new THREE.Group();
  const fill = new THREE.MeshStandardMaterial({ color: '#2a3134', roughness: 0.8, transparent: true });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y))), { depth: 0.06, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, fill); mesh.position.y = -0.06; g.add(mesh);
  const line = new THREE.LineBasicMaterial({ color: '#b9c3c6', transparent: true });
  const lp = pts.map((p) => new THREE.Vector3(p.x, 0.004, p.y)); lp.push(lp[0].clone());
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), line));
  g.setOpacity = (a) => { fill.opacity = a; line.opacity = a; };
  return g;
}
// a bar (optionally standing on a country outline); slide moves the whole thing in from the right
function makeBar(x, z, hMax, poly = null, size = 2.4) {
  const group = new THREE.Group(); group.position.set(x, HERO_FEET.y, z);
  const tile = poly ? countryTile(poly, size) : null;
  if (tile) group.add(tile);
  const geo = new THREE.BoxGeometry(0.5, 1, 0.5); geo.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: PLASTIC, emissive: PLASTIC, emissiveIntensity: 0.5, roughness: 0.35, transparent: true, opacity: 0.92 }));
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: ICE, transparent: true })));
  mesh.scale.y = 0.0001; group.add(mesh);
  const bar = { group, mesh, hMax, k: 0 };
  bar.set = (k, slide = 0) => {
    bar.k = k;
    mesh.scale.y = Math.max(0.0001, k * hMax);
    mesh.visible = k > 0.001;
    group.position.x = x - slide * 12;
    group.visible = slide < 0.999 && (k > 0.001 || tile);
    if (tile) tile.setOpacity(Math.min(1, (1 - slide) * 1.5) * (k > 0.001 || slide < 1 ? 1 : 0));
  };
  bar.top = (v) => mesh.getWorldPosition(v).setY(HERO_FEET.y + mesh.scale.y + 0.05);
  return bar;
}

/* =====================================================================
   WORLD
   ===================================================================== */
export function createWorld({ uTime, pixelRatio }) {
  const root = new THREE.Group(); root.visible = false;
  const fleck = (size) => fleckMaterial(uTime, pixelRatio, size);

  // ---------- the hero (you, ~20 years old: hoodie, backpack) ----------
  const hero = makePerson({ color: '#d2d6d7', hair: 'short', backpack: true });
  hero.root.position.copy(HERO_FEET); hero.root.rotation.y = Math.PI;
  hero.fleck = fleck(42);
  addFlecks(hero.torso, 40, hero.fleck); addFlecks(hero.head, 12, hero.fleck);
  hero.legs.forEach((l) => addFlecks(l, 12, hero.fleck));
  addFlecks(hero.armR.mesh, 12, hero.fleck);
  hero.handFleck = fleck(20);          // the POV arm is very close to the camera → smaller flecks
  addFlecks(hero.armL.mesh, 46, hero.handFleck);
  root.add(hero.root);

  // ---------- family (screen-right once the camera faces the hero) ----------
  const placed = (obj, x, z, ry) => { obj.root.position.set(x, HERO_FEET.y, z); obj.root.rotation.y = Math.PI + ry; root.add(obj.root); return obj; };
  const mother = placed(makePerson({ color: '#b3b8ba', hair: 'bob', dress: true, height: 0.96 }), -1.45, 6.75, -0.3);
  const father = placed(makePerson({ color: '#a8adb0', hair: 'short', glasses: true, height: 1.07, build: 1.12 }), -2.25, 7.15, -0.35);
  const dog = placed(makeDog(), -1.0, 6.0, -0.6);
  const cat = placed(makeCat(), -2.7, 6.45, -0.2);
  // ---------- friends (screen-left) ----------
  const fr1 = placed(makePerson({ color: '#b6bbbd', hair: 'long', ponytail: true, tote: true, height: 0.95 }), 1.4, 6.7, 0.3);
  const fr2 = placed(makePerson({ color: '#adb2b4', hair: 'short', baseballCap: true, height: 1.03 }), 2.1, 7.2, 0.35);
  const fr3 = placed(makePerson({ color: '#b0b5b7', hair: 'short', glasses: true, headphones: true }), 2.75, 6.5, 0.45);
  const others = { mother, father, dog, cat, fr1, fr2, fr3 };
  for (const k in others) {
    const o = others[k]; o.fleck = fleck(38);
    o.meshes.forEach((m) => { if (!['TorusGeometry', 'CylinderGeometry', 'TubeGeometry'].includes(m.geometry.type)) addFlecks(m, k === 'dog' || k === 'cat' ? 6 : 8, o.fleck); });
  }

  // ---------- spotlights ----------
  const at = (o, dy = 0) => new THREE.Vector3(o.root.position.x, HERO_FEET.y + dy, o.root.position.z);
  const spots = {
    hero: makeSpot(root, at(hero), { width: 0.85 }),
    mother: makeSpot(root, at(mother), { width: 0.7 }), father: makeSpot(root, at(father), { width: 0.75 }),
    dog: makeSpot(root, at(dog), { width: 0.5 }), cat: makeSpot(root, at(cat), { width: 0.45 }),
    fr1: makeSpot(root, at(fr1), { width: 0.7 }), fr2: makeSpot(root, at(fr2), { width: 0.7 }), fr3: makeSpot(root, at(fr3), { width: 0.7 }),
  };
  Object.values(spots).forEach((s) => s.set(0));

  // ---------- items the hero carries ----------
  const held = { umbrella: umbrella(), sleeve: umbrellaSleeve(), bag: shopBag() };
  held.umbrella.add(held.sleeve);
  held.umbrella.position.set(-0.045, -0.88, 0.02); // handle in the left hand, tip near the floor
  hero.armL.hand.add(held.umbrella);
  held.bag.position.set(0, -0.02, 0);
  hero.armR.hand.add(held.bag);
  held.umbrella.visible = held.bag.visible = false;

  // ---------- camera-space props for the supermarket POV ----------
  const rig = new THREE.Group(); // added to the camera by main.js
  const propUmb = umbrella(); const propSleeve = umbrellaSleeve(); propUmb.add(propSleeve);
  propUmb.position.set(0.25, -0.45, -1.6); propUmb.rotation.z = 0.12; rig.add(propUmb);
  const bagMat = plasticMat(1);
  const cookieBag = pillow(0.5, 0.62, 0.14, bagMat); cookieBag.position.set(0.2, -0.05, -1.7); rig.add(cookieBag);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), clay('#1c2224')); label.position.z = 0.072; cookieBag.add(label);
  const packets = [];
  for (let i = 0; i < 6; i++) {
    const pk = pillow(0.17, 0.17, 0.04, plasticMat(0.9)); pk.position.copy(cookieBag.position); pk.visible = false; rig.add(pk); packets.push(pk);
  }
  const cookie = cookieMesh(); cookie.visible = false; rig.add(cookie);
  const propShopBag = shopBag(); propShopBag.scale.setScalar(1.5); propShopBag.position.set(0.2, -1.6, -1.7); rig.add(propShopBag);
  rig.visible = false;
  const props = { rig, umbrella: propUmb, sleeve: propSleeve, cookieBag, packets, cookie, shopBag: propShopBag };

  // ---------- map ----------
  const map = makeMap(); root.add(map.group);
  const tokyo = lonLatToWorld(139.7, 35.7);
  const centre = lonLatToWorld(137.8, 36.3);
  const bars = {
    japan: makeBar(centre.x, centre.z, 2.45),
    usa: makeBar(-4.3, 6.4, 3.5, COUNTRY.usa, 2.7),
    china: makeBar(-7.3, 6.4, 1.25, COUNTRY.china, 2.5),
    india: makeBar(-10.0, 6.4, 0.26, COUNTRY.india, 1.9),
  };
  Object.values(bars).forEach((b) => { map.group.add(b.group); b.set(0, 1); });
  function setMap(k) {
    map.group.visible = k > 0.001;
    map.fill.opacity = k; map.lineMat.opacity = k; map.grid.material.opacity = 0.6 * k;
  }

  // tidy flags for main.js
  function setPersonFlecks(o, k) { o.fleck.uniforms.uOpacity.value = k; }

  return {
    root, hero, others, spots, held, props, map, bars, setMap, tokyo, centre, setPersonFlecks,
  };
}
