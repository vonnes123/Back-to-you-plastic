// Procedural iwashi (Japanese sardine / anchovy).
// Local space: head at +x (x = 1), tail fork at about x = -1.38, flank faces +z.
// Shared shader uniforms drive swimming (bend), cooking (colour) and eating (discard).
import * as THREE from 'three';

export const BODY = { L: 2.0, H: 0.46, W: 0.24 };
export const BITE = { head: 0.6, span: 1.42 }; // eaten region: x in [head - span, head]

// Thickness profile along the body, u = 0 (tail) … 1 (snout)
function rawProfile(u) {
  return Math.pow(Math.max(u, 0), 0.5) * Math.pow(Math.max(1 - u, 0), 0.62);
}
let PMAX = 0;
for (let i = 0; i <= 200; i++) PMAX = Math.max(PMAX, rawProfile(i / 200));
export function radius(u) {
  return rawProfile(u) / PMAX + 0.09 * Math.pow(1 - u, 3);
}
// Surface point for body parameters (u along length, v around)
export function surface(u, v, inflate = 1) {
  const r = radius(u) * inflate;
  const s = Math.sin(v), c = Math.cos(v);
  const x = -BODY.L / 2 + u * BODY.L;
  const y = s * r * (BODY.H / 2) * (s < 0 ? 1.08 : 0.92) - 0.012 * u * u; // slightly deeper belly
  const z = c * r * (BODY.W / 2);
  return new THREE.Vector3(x, y, z);
}

// ---------- shader chunks shared by fish materials and dots ----------
export const BEND_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uSwim;
  uniform float uSwimSpeed;
  vec3 fishBend(vec3 p) {
    float t = clamp((1.0 - p.x) / 2.4, 0.0, 1.0);
    float a = uSwim * pow(t, 1.6);
    p.z += sin(p.x * 2.6 - uTime * uSwimSpeed) * a;
    return p;
  }
`;

function patchMaterial(mat, U, { body = false } = {}) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND_GLSL}\nvarying vec3 vLocal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLocal = transformed;\ntransformed = fishBend(transformed);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uCook; uniform float uEaten; uniform float uBiteHead; uniform float uBiteSpan; uniform float uDepth;
        varying vec3 vLocal;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uEaten > 0.001) {
          float headEdge = uBiteHead + sin(vLocal.y * 38.0) * 0.018;
          float edge = uBiteHead - uEaten * uBiteSpan + sin(vLocal.y * 55.0) * 0.028 + sin(vLocal.z * 70.0 + vLocal.y * 21.0) * 0.016;
          if (vLocal.x < headEdge && vLocal.x > edge) discard;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${body ? `
        // gill line
        float gx = 0.6 - 2.2 * vLocal.y * vLocal.y;
        diffuseColor.rgb *= 1.0 - 0.55 * smoothstep(0.012, 0.0, abs(vLocal.x - gx));
        ` : ''}
        if (uCook > 0.0) {
          float n = vnoise(vLocal.xy * 38.0);
          float n2 = vnoise(vLocal.xy * 11.0 + 7.0) * 0.65 + vnoise(vLocal.xy * 27.0 + 3.0) * 0.35;
          vec3 cooked = mix(vec3(0.36, 0.33, 0.30), vec3(0.72, 0.69, 0.64), smoothstep(0.04, -0.14, vLocal.y));
          cooked *= 0.82 + 0.18 * n;
          cooked = mix(cooked, vec3(0.1, 0.09, 0.085), smoothstep(0.6, 0.85, n2) * 0.75);
          float s = fract((vLocal.x + vLocal.y * 0.7) * 3.6);
          float mark = 1.0 - smoothstep(0.0, 0.06, abs(s - 0.5));
          cooked = mix(cooked, vec3(0.07, 0.065, 0.06), mark * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, cooked, uCook);
        }`)
      // underwater: sink the colours toward the dark sea and flatten the highlights
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 sea = vec3(0.05, 0.11, 0.12);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(sea, vec3(0.32, 0.44, 0.46), lum * 0.8), uDepth * 0.6);`);
  };
  mat.customProgramCacheKey = () => (body ? 'fish-body' : 'fish-part');
  return mat;
}

// ---------- geometry ----------
function bodyGeometry(segU = 96, segV = 32) {
  const pos = [], col = [], idx = [];
  const dark = new THREE.Color('#2f363b'), mid = new THREE.Color('#6d777c'), belly = new THREE.Color('#d3d8da');
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    for (let j = 0; j <= segV; j++) {
      const v = Math.PI / 2 + (j / segV) * Math.PI * 2; // seam on the dorsal line
      const p = surface(u, v);
      pos.push(p.x, p.y, p.z);
      const s = Math.sin(v);
      const c = new THREE.Color();
      if (s > 0.15) c.copy(dark).lerp(mid, THREE.MathUtils.smoothstep(0.15 - s, -0.85, 0) * 0.6);
      else c.copy(mid).lerp(belly, THREE.MathUtils.smoothstep(-s + 0.15, 0, 0.6));
      col.push(c.r, c.g, c.b);
    }
  }
  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j, b = a + row, c2 = b + 1, d = a + 1;
      idx.push(a, b, d, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // smooth the dorsal seam: average normals of duplicated seam vertices
  const n = g.attributes.normal;
  for (let i = 0; i <= segU; i++) {
    const a = i * row, b = i * row + segV;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}

function tailGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.04, 0.03);
  s.quadraticCurveTo(-0.1, 0.07, -0.3, 0.22);
  s.quadraticCurveTo(-0.23, 0.07, -0.18, 0.0);
  s.quadraticCurveTo(-0.23, -0.07, -0.3, -0.22);
  s.quadraticCurveTo(-0.1, -0.07, 0.04, -0.03);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 12);
  g.translate(-BODY.L / 2 + 0.02, 0, 0);
  return g;
}
function finGeometry(points, tx, ty, tz = 0, rotX = 0) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  if (rotX) g.rotateX(rotX);
  g.translate(tx, ty, tz);
  return g;
}

function bonesGroup() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#e4e0d6', roughness: 0.55, metalness: 0.0, emissive: '#2a2925' });
  const spineLen = 1.62;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, spineLen, 8), mat);
  spine.rotation.z = Math.PI / 2;
  spine.position.set(-0.95 + spineLen / 2 - 0.02, -0.005, 0);
  grp.add(spine);
  const ribGeo = new THREE.CylinderGeometry(0.0045, 0.0018, 1, 5);
  ribGeo.translate(0, 0.5, 0);
  for (let x = -0.86; x <= 0.56; x += 0.055) {
    const u = (x + 1) / 2;
    const h = radius(u) * BODY.H / 2;
    for (const dir of [1, -1]) {
      const rib = new THREE.Mesh(ribGeo, mat);
      rib.position.set(x, -0.005, 0);
      rib.scale.y = h * (dir > 0 ? 0.82 : 0.9);
      rib.rotation.z = dir > 0 ? 0.42 : Math.PI - 0.42; // slanted toward the tail
      grp.add(rib);
    }
  }
  grp.visible = false;
  return grp;
}

// ---------- plastic dots on the fish ----------
const DOT_VERT = /* glsl */ `
  ${BEND_GLSL}
  attribute float aSeed;
  uniform float uSize, uPixelRatio, uEaten, uBiteHead, uBiteSpan, uOpacity;
  varying float vAlpha; varying float vSeed;
  void main() {
    vec3 p = position;
    float at = (uBiteHead - p.x) / uBiteSpan;
    float k = (at >= 0.0 && at <= 1.0) ? clamp((uEaten - at) * 4.0, 0.0, 1.0) : 0.0;
    k = k * k * (3.0 - 2.0 * k);
    p = fishBend(p);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 target = vec3((aSeed - 0.5) * 0.5, -1.15, -1.6);
    mv.xyz = mix(mv.xyz, target, k);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.8 + aSeed * 0.5) * (1.0 + k * 1.2) * (6.0 / -mv.z);
    vAlpha = (1.0 - smoothstep(0.75, 1.0, k)) * uOpacity;
    vSeed = aSeed;
  }
`;
// Plastic fragment: a small tumbling square / rectangle with a faint glow.
// Needs uTime + varyings vAlpha, vSeed from the vertex shader.
export const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uGlow; uniform float uTime;
  varying float vAlpha; varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float spin = (vSeed > 0.5 ? 1.0 : -1.0) * (0.25 + vSeed * 0.5);
    float a = vSeed * 6.2831 + uTime * spin;
    float c = cos(a), s = sin(a);
    p = mat2(c, -s, s, c) * p;
    vec2 ext = vec2(0.17, 0.17 * (0.45 + 0.55 * fract(vSeed * 7.31)));
    vec2 d = abs(p) - ext;
    float box = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    float core = 1.0 - smoothstep(0.0, 0.02, box);
    float edge = 1.0 - smoothstep(0.0, 0.035, abs(box + 0.02));
    float halo = (1.0 - smoothstep(0.0, 0.2, box)) * 0.2 * uGlow;
    vec3 col = mix(uColor * 0.85, vec3(0.86, 0.97, 1.0), edge * 0.6);
    float alpha = (core + halo) * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function dotsOnFish(U, count, pixelRatio) {
  const pos = [], seeds = [];
  let tries = 0;
  while (pos.length / 3 < count && tries < 20000) {
    tries++;
    const u = 0.04 + Math.random() * 0.9;
    if (Math.random() > radius(u) / 1.05) continue; // area-ish weighting
    const v = Math.random() * Math.PI * 2;
    const p = surface(u, v, 1.04);
    pos.push(p.x, p.y, p.z);
    seeds.push(Math.random());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uSize: { value: 19 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1 },
      uGlow: { value: 1 },
      uColor: { value: new THREE.Color('#3fd3e8') },
    },
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.renderOrder = 2;
  pts.frustumCulled = false;
  return pts;
}

// ---------- assemble ----------
export function createFish({ pixelRatio = 1, dotCount = 120 } = {}) {
  const U = {
    uTime: { value: 0 },
    uSwim: { value: 0.1 },
    uSwimSpeed: { value: 6.5 },
    uCook: { value: 0 },
    uEaten: { value: 0 },
    uBiteHead: { value: BITE.head },
    uBiteSpan: { value: BITE.span },
    uDepth: { value: 1 },
  };

  const group = new THREE.Group();

  const bodyMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.32 }), U, { body: true });
  const body = new THREE.Mesh(bodyGeometry(), bodyMat);
  group.add(body);

  const finMat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#7f898d', metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }), U);
  const tail = new THREE.Mesh(tailGeometry(), finMat);
  group.add(tail);
  const dorsal = new THREE.Mesh(finGeometry([[-0.1, 0], [0.12, 0], [-0.04, 0.09]], 0.02, 0.18), finMat);
  group.add(dorsal);
  const anal = new THREE.Mesh(finGeometry([[-0.1, 0], [0.08, 0], [-0.08, -0.06]], -0.5, -0.12), finMat);
  group.add(anal);
  for (const side of [1, -1]) {
    const pec = new THREE.Mesh(finGeometry([[0, 0], [-0.17, 0.03], [-0.15, -0.05]], 0.5, -0.06, side * 0.07, side * 0.35), finMat);
    group.add(pec);
  }

  // eyes
  const eyeU = 0.9, eyeP = surface(eyeU, 0);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#050606', metalness: 0.9, roughness: 0.12 });
  const ringMat = new THREE.MeshStandardMaterial({ color: '#c9cdcf', metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), eyeMat);
    eye.position.set(eyeP.x, 0.03, side * (eyeP.z - 0.012));
    eye.scale.z = 0.6;
    group.add(eye);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.036, 0.05, 24), ringMat);
    ring.position.set(eyeP.x, 0.03, side * (eyeP.z - 0.004));
    if (side < 0) ring.rotation.y = Math.PI;
    group.add(ring);
  }

  const bones = bonesGroup();
  group.add(bones);

  const dots = dotsOnFish(U, dotCount, pixelRatio);
  group.add(dots);

  // dot local positions, for HUD targeting and the "ingested" counter
  const dp = dots.geometry.attributes.position.array;
  const dotX = [];
  let hudDot = new THREE.Vector3(0.1, 0, BODY.W / 2), best = Infinity;
  for (let i = 0; i < dp.length; i += 3) {
    dotX.push(dp[i]);
    const score = Math.abs(dp[i] - 0.15) + Math.abs(dp[i + 1] - 0.04) * 2 + (dp[i + 2] > 0.05 ? 0 : 10);
    if (score < best) { best = score; hudDot = new THREE.Vector3(dp[i], dp[i + 1], dp[i + 2]); }
  }

  function setCook(k) {
    U.uCook.value = k;
    bodyMat.metalness = 0.55 * (1 - k);
    bodyMat.roughness = 0.32 + 0.45 * k;
    finMat.color.set('#7f898d').lerp(new THREE.Color('#3a3631'), k);
    eyeMat.color.set('#050606').lerp(new THREE.Color('#d8d6cf'), k * 0.85); // cooked eye turns white
  }

  function ingestedCount() {
    let n = 0;
    for (const x of dotX) {
      const at = (BITE.head - x) / BITE.span;
      if (at >= 0 && at <= 1 && U.uEaten.value - at > 0.12) n++;
    }
    return n;
  }

  return {
    group, body, bones, dots, U, setCook, ingestedCount,
    mouth: new THREE.Vector3(BODY.L / 2 + 0.01, -0.01, 0),
    hudDot,
  };
}
