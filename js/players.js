// Scenes 8–10: the "big players" (plastic industry, incineration/"recycling", national economic interests),
// reusable items for the hero, and the crowd that slowly joins in.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HERO_FEET, makeSpot } from './people.js';
import { DOT_FRAG } from './fish.js';

const G = HERO_FEET.y;
const PLASTIC = '#08869c';
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05, ...o });

/* ---------- smoke: grey sprites drifting up out of a chimney ---------- */
function smoke(uTime, pr, height = 2.4, count = 70) {
  const pos = [], seed = [];
  for (let i = 0; i < count; i++) { pos.push(0, 0, 0); seed.push(Math.random()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime, uPR: { value: pr }, uOpacity: { value: 0 }, uH: { value: height } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uPR, uH; varying float vA;
      void main() {
        float t = fract(uTime * 0.07 + aSeed);
        vec3 p = vec3(sin(aSeed * 40.0) * 0.25 * t + t * 0.6, t * uH, cos(aSeed * 31.0) * 0.25 * t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (40.0 + 140.0 * t) * uPR / -mv.z * 6.0;
        vA = (1.0 - t) * smoothstep(0.0, 0.1, t);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * 0.22 * vA * uOpacity; gl_FragColor = vec4(vec3(0.6, 0.64, 0.65), a); }`,
    transparent: true, depthWrite: false,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  return p;
}

/* ---------- flecks streaming along a line (plastic flowing in or out) ---------- */
function stream(uTime, pr, from, to, count = 40) {
  const pos = [], seed = [];
  for (let i = 0; i < count; i++) { pos.push(0, 0, 0); seed.push(Math.random()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime, uPR: { value: pr }, uOpacity: { value: 0 }, uGlow: { value: 1.2 }, uColor: { value: new THREE.Color('#3fd3e8') }, uA: { value: from }, uB: { value: to } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uPR, uOpacity; uniform vec3 uA, uB; varying float vAlpha; varying float vSeed;
      void main() {
        float t = fract(uTime * 0.18 + aSeed);
        vec3 p = mix(uA, uB, t) + vec3(sin(aSeed * 50.0), sin(t * 9.0 + aSeed * 20.0) * 0.6 + 0.4 * sin(t * 3.14159), cos(aSeed * 37.0)) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 34.0 * uPR / -mv.z * (0.7 + aSeed * 0.6);
        vAlpha = uOpacity * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.85, 1.0, t));
        vSeed = aSeed;
      }`,
    fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  return p;
}

/* ---------- 01: plastic factory ---------- */
function factory(uTime, pr) {
  const g = new THREE.Group();
  const m = mat('#8c9497'), d = mat('#4a5255'), win = mat('#20272a');
  const hall = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.3, 1.8, 3, 0.06), m); hall.position.y = 0.65; g.add(hall);
  for (let i = 0; i < 4; i++) { // saw-tooth roof
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.65, 0); s.lineTo(0.65, 0.45); s.closePath();
    const t = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false }), m);
    t.position.set(-1.3 + i * 0.65, 1.3, -0.9); g.add(t);
  }
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32), win); w.position.set(-1.05 + i * 0.52, 0.85, 0.905); g.add(w); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), win); door.position.set(-0.3, 0.3, 0.905); g.add(door);
  const stacks = [];
  for (const [x, h] of [[0.7, 2.7], [1.08, 2.2]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, h, 24), d); c.position.set(x, 1.1 + h / 2, -0.3); g.add(c);
    const sm = smoke(uTime, pr, 2.6); sm.position.set(x, 1.1 + h, -0.3); g.add(sm); stacks.push(sm);
  }
  for (const x of [-1.65, -2.1]) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 6, 20), m); s.position.set(x, 0.8, 0.1); g.add(s); }
  // what it makes: a growing pile of blue plastic out front, fed by a stream
  const pile = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(PLASTIC, { emissive: PLASTIC, emissiveIntensity: 0.45 }));
  pile.scale.y = 0.55; pile.position.set(-0.3, 0, 1.45); g.add(pile);
  const flow = stream(uTime, pr, new THREE.Vector3(-0.3, 0.35, 0.95), new THREE.Vector3(-0.3, 0.25, 1.5), 40); g.add(flow);
  return { g, fx: [...stacks, flow], height: 4.0 };
}

/* ---------- 02: incinerator / "thermal recycling" plant ---------- */
function incinerator(uTime, pr) {
  const g = new THREE.Group();
  const m = mat('#7f878a'), d = mat('#495154'), win = mat('#1d2427');
  const hall = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.5, 1.9, 3, 0.06), m); hall.position.y = 0.75; g.add(hall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.4, 40, 1, false, 0, Math.PI), m);
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.45); roof.position.y = 1.5; g.add(roof);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 5.2, 28), d); stack.position.set(0.85, 2.6, -0.45); g.add(stack);
  for (const y of [4.3, 4.7]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.025, 8, 28), mat('#c9d1d3')); band.rotation.x = Math.PI / 2; band.position.set(0.85, y, -0.45); g.add(band); }
  const sm = smoke(uTime, pr, 3.2, 90); sm.position.set(0.85, 5.2, -0.45); g.add(sm);
  // furnace mouth: a white-hot glow
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: '#f4fbfc' }));
  mouth.position.set(-0.35, 0.42, 0.955); g.add(mouth);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.7), win); frame.position.set(-0.35, 0.42, 0.952); g.add(frame);
  // plastic being fed in
  const feed = stream(uTime, pr, new THREE.Vector3(-0.35, 0.2, 2.2), new THREE.Vector3(-0.35, 0.42, 0.96), 46); g.add(feed);
  return { g, fx: [sm, feed], mouth, height: 5.4 };
}

/* ---------- 03: the paulownia crest (emblem used by the Government of Japan), drawn flat in 2D ---------- */
function crestTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cx = S / 2, cy = S / 2;
  // disc + rings
  const bg = g.createRadialGradient(cx, cy * 0.9, 40, cx, cy, S / 2);
  bg.addColorStop(0, '#2d3739'); bg.addColorStop(1, '#101618');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, 500, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#9aa6a9'; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, 488, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#5d696c'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 456, 0, Math.PI * 2); g.stroke();
  const INK = '#dfe5e6', VEIN = '#1b2224';
  // leaves: base at the centre, pointing down / down-left / down-right
  const base = { x: cx, y: cy + 70 };
  const leaf = (ang, len, w) => {
    g.save(); g.translate(base.x, base.y); g.rotate(ang);
    g.fillStyle = INK; g.beginPath();
    g.moveTo(0, 0); g.bezierCurveTo(w, len * 0.2, w * 0.9, len * 0.8, 0, len); g.bezierCurveTo(-w * 0.9, len * 0.8, -w, len * 0.2, 0, 0); g.fill();
    g.strokeStyle = VEIN; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 20); g.lineTo(0, len - 30); g.stroke();
    g.lineWidth = 5;
    for (let i = 1; i <= 3; i++) { const y = len * (0.25 + i * 0.16); for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(0, y); g.lineTo(sgn * w * 0.55, y - 46); g.stroke(); } }
    g.restore();
  };
  leaf(0, 300, 120); leaf(0.95, 270, 108); leaf(-0.95, 270, 108);
  // flower stalks: 5 – 7 – 5
  const flower = (x, y, r) => {
    g.fillStyle = INK;
    for (const [dx, dy] of [[0, -r * 0.9], [-r * 0.85, r * 0.35], [r * 0.85, r * 0.35]]) { g.beginPath(); g.arc(x + dx, y + dy, r * 0.62, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill();
  };
  const stalk = (topX, topY, n) => {
    g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.moveTo(base.x, base.y - 10);
    g.quadraticCurveTo((base.x + topX) / 2, base.y - 120, topX, topY); g.stroke();
    for (let i = 0; i < n; i++) {
      const t = 1 - i / (n - 1) * 0.72;
      const px = base.x + (topX - base.x) * t, py = base.y - 10 + (topY - base.y + 10) * t;
      flower(px + (i === 0 ? 0 : (i % 2 ? -1 : 1) * 46), py, 26);
    }
  };
  stalk(cx, cy - 330, 7); stalk(cx - 230, cy - 230, 5); stalk(cx + 230, cy - 230, 5);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
function crest() {
  const g = new THREE.Group();
  const R = 3.8;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.MeshBasicMaterial({ map: crestTexture(), transparent: true, toneMapped: false, color: '#c9d0d1' }));
  g.add(plane);
  return { g, fx: [], height: 2 * R + 1, tagY: 4.6 + R };
}

/* ---------- reusable items (natural materials, not plastic) ---------- */
function tote() {
  const g = new THREE.Group(); const m = mat('#d9d3c6', { roughness: 0.9 });
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.32, 0.05, 3, 0.02), m); b.position.y = -0.2; g.add(b);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 20, Math.PI), m); h.position.y = -0.04; g.add(h);
  return g;
}
function bottle() {
  const g = new THREE.Group();
  const steel = mat('#c3cacc', { metalness: 0.85, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 24), steel); body.position.y = -0.11; g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 20), mat('#2b3033')); cap.position.y = 0.02; g.add(cap);
  return g;
}

/* ---------- the crowd: ~2000 low-poly people drawn with GPU instancing ---------- */
function crowdParts() {
  const prof = [[0, 0.7], [0.14, 0.73], [0.157, 0.82], [0.16, 1.0], [0.18, 1.2], [0.185, 1.33], [0.15, 1.4], [0.07, 1.435], [0, 1.44]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(prof, 12); torso.scale(1.1, 1, 0.7);
  const leg = new THREE.CapsuleGeometry(0.06, 0.55, 2, 6);
  const arm = new THREE.CapsuleGeometry(0.045, 0.48, 2, 6);
  const head = new THREE.SphereGeometry(0.13, 10, 8);
  const hair = new THREE.SphereGeometry(0.137, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const toteG = new THREE.BoxGeometry(0.24, 0.27, 0.05);
  const bottleG = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
  const M = (x, y, z, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
  // [geometry, local matrices per person, material key, which people (all / odd / even)]
  return [
    [torso, [M(0, 0, 0)], 'body', 'all'],
    [leg, [M(-0.08, 0.36, 0), M(0.08, 0.36, 0)], 'body', 'all'],
    [arm, [M(0.22, 1.06, 0, 0, 0.08), M(-0.22, 1.06, 0, 0, -0.08)], 'body', 'all'],
    [head, [M(0, 1.56, 0)], 'body', 'all'],
    [hair, [M(0, 1.57, 0, -0.42)], 'hair', 'all'],
    [toteG, [M(-0.25, 0.66, 0.02)], 'cloth', 'odd'],
    [bottleG, [M(-0.24, 0.72, 0.03)], 'steel', 'even'],
  ];
}

/* ===================================================================== */
export function createPlayers({ root, uTime, pixelRatio, hero }) {
  const pr = pixelRatio;
  // ---- the big players, placed around the hero (camera faces +z toward them) ----
  const fac = factory(uTime, pr), inc = incinerator(uTime, pr), cr = crest();
  // big, filling each side of the screen and running off its edge
  const BIG = 2.1;
  fac.g.position.set(8.4, G, 8.2); fac.g.rotation.y = Math.PI + 0.3; fac.g.scale.setScalar(BIG); fac.height *= BIG; fac.tagY = 5.2;  // screen-left
  inc.g.position.set(-8.4, G, 8.2); inc.g.rotation.y = Math.PI - 0.3; inc.g.scale.setScalar(BIG); inc.height *= BIG; inc.tagY = 5.2; // screen-right
  cr.g.position.set(0, G + 4.6, 18); cr.g.rotation.y = Math.PI;           // far behind the hero, the biggest
  const players = { factory: fac, burner: inc, crest: cr };
  const spots = {
    factory: makeSpot(root, new THREE.Vector3(8.4, G, 8.2), { width: 4.6, H: 11 }),
    burner: makeSpot(root, new THREE.Vector3(-8.4, G, 8.2), { width: 4.6, H: 11 }),
    crest: makeSpot(root, new THREE.Vector3(0, G, 18), { width: 4.2, H: 10 }),
  };
  for (const k in players) { root.add(players[k].g); players[k].g.visible = false; spots[k].set(0); spots[k].max = 4.5; }
  function setPlayer(k, v) {
    const p = players[k];
    p.g.visible = v > 0.001;
    const e = 1 - Math.pow(1 - Math.min(1, v), 3);
    p.base = p.base ?? p.g.position.y;
    p.g.position.y = p.base - (1 - e) * (p.height + 0.5); // rises up out of the floor
    p.fx.forEach((f) => { f.material.uniforms.uOpacity.value = v; });
    spots[k].set(v);
  }

  // ---- reusable items for the hero ----
  const reuse = { tote: tote(), bottle: bottle() };
  hero.armR.hand.add(reuse.tote);
  hero.armL.hand.add(reuse.bottle);
  function setReuse(k) {
    for (const key in reuse) {
      const it = reuse[key];
      it.visible = k > 0.001;
      it.scale.setScalar(Math.max(0.001, k));
      it.rotation.y = (1 - k) * 5;
      it.position.y = (1 - k) * 0.6;
    }
  }
  setReuse(0);

  // ---- the crowd: a widening wedge behind you that runs back to the horizon ----
  // built once the final crowd camera is known, keeping only people that camera can see
  let people = [], N = 0, meshes = [];
  const proj = new THREE.Vector3();
  function buildCrowd(cam) {
  if (meshes.length) return;
  people = [];
  for (let row = 0; row < 46; row++) {
    const z = HERO_FEET.z + 1.4 + row * 1.08;
    const half = 1.8 + row * 0.78;
    const n = Math.round((2 * half) / 0.82);
    for (let c = 0; c < n; c++) {
      const x = -half + (2 * half) * (c + 0.5) / n + (Math.random() - 0.5) * 0.35;
      if (row < 2 && Math.abs(x) < 0.55) continue; // leave room around you
      people.push({ x, z: z + (Math.random() - 0.5) * 0.5, ry: Math.PI + (Math.random() - 0.5) * 0.6, s: 0.9 + Math.random() * 0.2 });
    }
  }
  // reveal nearest first, so the wave spreads outward from you
  people.forEach((p) => { p.d = Math.hypot(p.x, p.z - HERO_FEET.z) + Math.random() * 0.6; });
  people = people.filter((p) => {
    for (const y of [0.1, 1.7]) {
      proj.set(p.x, G + y, p.z).project(cam);
      if (proj.z < 1 && Math.abs(proj.x) < 1.04 && Math.abs(proj.y) < 1.04) return true;
    }
    return false;
  });
  people.sort((a, b) => a.d - b.d);
  N = people.length;
  const cmats = {
    body: mat('#ffffff'), hair: mat('#2c3134'),
    cloth: mat('#d9d3c6', { roughness: 0.9 }), steel: mat('#c3cacc', { metalness: 0.85, roughness: 0.25 }),
  };
  const tones = ['#c6cbcd', '#b4b9bb', '#a9aeb0', '#bcc1c3'].map((h) => new THREE.Color(h));
  meshes = crowdParts().map(([geo, locals, mk, who]) => {
    const idx = people.map((_, i) => i).filter((i) => who === 'all' || (who === 'odd' ? i % 2 : !(i % 2)));
    const im = new THREE.InstancedMesh(geo, cmats[mk], idx.length * locals.length);
    im.frustumCulled = false;
    let k = 0;
    if (mk === 'body') for (const i of idx) for (let l = 0; l < locals.length; l++) im.setColorAt(k++, tones[i % tones.length]);
    im.count = 0;
    root.add(im);
    return { im, locals, idx };
  });
  lastK = -1; setCrowd(0);
  }
  const mP = new THREE.Matrix4(), mT = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let lastK = -1;
  function setCrowd(k) {
    if (k === lastK || !meshes.length) return;
    lastK = k;
    const vis = new Float32Array(N);
    let shown = 0;
    for (let i = 0; i < N; i++) {
      // near people appear one at a time; further back they arrive in growing waves
      const t0 = Math.pow(i / N, 0.55) * 0.92;
      let v = Math.min(1, Math.max(0, (k - t0) / 0.04));
      vis[i] = v * v * (3 - 2 * v);
      if (vis[i] > 0.001) shown = i + 1;
    }
    for (const { im, locals, idx } of meshes) {
      let n = 0;
      for (const i of idx) {
        if (i >= shown) break;
        const p = people[i], v = Math.max(0.001, vis[i]);
        q.setFromAxisAngle(up, p.ry);
        mP.compose(pos.set(p.x, G, p.z), q, scl.set(p.s, p.s * v, p.s));
        for (const L of locals) im.setMatrixAt(n++, mT.multiplyMatrices(mP, L));
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }
  return { players, spots, setPlayer, setReuse, setCrowd, buildCrowd };
}
