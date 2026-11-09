// 2D "doctor's lightboard": three backlit X-ray films (head CT, chest, abdomen)
// with plastic flecks and sourced call-outs. Drawn in a 1600×900 box that fills the screen.
import { el } from './scenery.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const BONE = '#eef4f5', SOFT = '#9fb2b7';

// panel frames (viewBox units)
export const PANELS = [
  { id: 'p1', x: 70, y: 120, w: 460, h: 640, cap: 'xPanel1' },
  { id: 'p2', x: 570, y: 120, w: 460, h: 640, cap: 'xPanel2' },
  { id: 'p3', x: 1070, y: 120, w: 460, h: 640, cap: 'xPanel3' },
];
// where each call-out points (viewBox units) and where its box sits (% of the board)
export const CALLOUTS = {
  brain: { pt: [300, 400], box: [6.2, 64], panel: 'p1' },
  lungs: { pt: [690, 380], box: [36.2, 15.5], panel: 'p2' },
  heart: { pt: [835, 470], box: [52.4, 15.5], panel: 'p2' },
  blood: { pt: [1345, 300], box: [68.6, 15.5], panel: 'p3' }, // abdominal aorta
  gut: { pt: [1250, 520], box: [68.6, 64], panel: 'p3' },
};

function film(svg, p) {
  const g = el('g', { id: `film-${p.id}` }, svg);
  // lightbox frame + backlit film
  el('rect', { x: p.x - 14, y: p.y - 14, width: p.w + 28, height: p.h + 28, rx: 6, fill: '#161b1d', stroke: '#2f383b' }, g);
  el('rect', { x: p.x, y: p.y, width: p.w, height: p.h, fill: 'url(#xr-back)' }, g);
  // clips
  for (const cx of [p.x + p.w * 0.28, p.x + p.w * 0.72]) el('rect', { x: cx - 18, y: p.y - 20, width: 36, height: 16, rx: 3, fill: '#4a5458', stroke: '#8b979b' }, g);
  const content = el('g', { 'clip-path': `url(#clip-${p.id})`, filter: 'url(#xr-soft)' }, g);
  return content;
}

function head(g, p) { // axial CT slice of the head
  const cx = p.x + p.w / 2, cy = p.y + p.h * 0.44;
  const r = rng(5);
  el('ellipse', { cx, cy, rx: 165, ry: 205, fill: '#1c2629' }, g);
  el('ellipse', { cx, cy, rx: 150, ry: 190, fill: 'url(#xr-brain)' }, g);
  // gyri: lots of soft curved folds
  let d = '';
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, rr = 40 + r() * 100;
    const x = cx + Math.cos(a) * rr * 0.95, y = cy + Math.sin(a) * rr * 1.18;
    const l = 14 + r() * 22, t = a + Math.PI / 2 + (r() - .5);
    d += `M${x} ${y} q${Math.cos(t) * l / 2 + (r() - .5) * 10} ${Math.sin(t) * l / 2 + (r() - .5) * 10} ${Math.cos(t) * l} ${Math.sin(t) * l} `;
  }
  el('path', { d, stroke: '#cfdde1', 'stroke-opacity': .35, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, g);
  // midline + ventricles (dark butterfly)
  el('path', { d: `M${cx} ${cy - 185} L${cx} ${cy + 185}`, stroke: '#0e1517', 'stroke-width': 3, opacity: .7 }, g);
  el('path', { d: `M${cx - 6} ${cy - 50} q-38 10 -34 60 q4 30 24 26 q10 -40 10 -86 Z M${cx + 6} ${cy - 50} q38 10 34 60 q-4 30 -24 26 q-10 -40 -10 -86 Z`, fill: '#0c1214' }, g);
  // skull: bright ring
  el('ellipse', { cx, cy, rx: 168, ry: 208, fill: 'none', stroke: BONE, 'stroke-width': 13 }, g);
  el('ellipse', { cx, cy, rx: 181, ry: 220, fill: 'none', stroke: SOFT, 'stroke-width': 5, 'stroke-opacity': .4 }, g);
}

function chest(g, p) { // PA chest radiograph
  const cx = p.x + p.w / 2, top = p.y + 70;
  // soft tissue silhouette
  el('path', { d: `M${cx - 210} ${p.y + p.h} L${cx - 200} ${top + 90} Q${cx - 180} ${top} ${cx - 60} ${top - 10} L${cx + 60} ${top - 10} Q${cx + 180} ${top} ${cx + 200} ${top + 90} L${cx + 210} ${p.y + p.h} Z`, fill: '#3b4a4f' }, g);
  // lungs = dark air spaces
  el('path', { d: `M${cx - 30} ${top + 40} Q${cx - 170} ${top + 30} ${cx - 175} ${top + 260} Q${cx - 175} ${top + 430} ${cx - 120} ${top + 440} Q${cx - 60} ${top + 400} ${cx - 30} ${top + 380} Z`, fill: '#101719' }, g);
  el('path', { d: `M${cx + 30} ${top + 40} Q${cx + 170} ${top + 30} ${cx + 175} ${top + 260} Q${cx + 175} ${top + 430} ${cx + 120} ${top + 440} Q${cx + 70} ${top + 420} ${cx + 30} ${top + 380} Z`, fill: '#101719' }, g);
  // lung markings
  const r = rng(9); let d = '';
  for (let i = 0; i < 40; i++) { const s = r() < .5 ? -1 : 1; const x = cx + s * (40 + r() * 110), y = top + 80 + r() * 320; d += `M${cx + s * 30} ${top + 200} Q${(x + cx) / 2} ${y - 30} ${x} ${y} `; }
  el('path', { d, stroke: SOFT, 'stroke-opacity': .18, 'stroke-width': 1.6, fill: 'none' }, g);
  // heart (bright soft mass, patient's left = viewer's right) + aortic knob
  el('path', { d: `M${cx - 40} ${top + 230} Q${cx - 70} ${top + 330} ${cx - 20} ${top + 410} Q${cx + 60} ${top + 450} ${cx + 125} ${top + 400} Q${cx + 150} ${top + 320} ${cx + 70} ${top + 240} Q${cx + 20} ${top + 210} ${cx - 40} ${top + 230} Z`, fill: '#a8bcc1', opacity: .85 }, g);
  el('ellipse', { cx: cx + 40, cy: top + 175, rx: 34, ry: 26, fill: '#b9cbd0', opacity: .85 }, g);
  el('path', { d: `M${cx + 6} ${top + 150} Q${cx + 50} ${top + 120} ${cx + 70} ${top + 180} L${cx + 50} ${top + 420}`, stroke: '#c4d4d8', 'stroke-width': 16, fill: 'none', opacity: .55 }, g); // aorta
  // spine
  for (let i = 0; i < 13; i++) el('rect', { x: cx - 20, y: top - 20 + i * 42, width: 40, height: 34, rx: 7, fill: '#cfdde0', opacity: .55 }, g);
  // ribs
  for (let i = 0; i < 10; i++) {
    const y = top + 20 + i * 40, w = 120 + Math.min(i, 5) * 12;
    for (const s of [-1, 1]) {
      el('path', { d: `M${cx + s * 22} ${y} Q${cx + s * (w + 40)} ${y - 30} ${cx + s * (w + 50)} ${y + 40} Q${cx + s * (w + 30)} ${y + 80} ${cx + s * w * 0.6} ${y + 95}`, stroke: BONE, 'stroke-opacity': .72, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, g);
    }
  }
  // clavicles + diaphragm
  for (const s of [-1, 1]) el('path', { d: `M${cx + s * 25} ${top + 10} Q${cx + s * 110} ${top - 5} ${cx + s * 190} ${top - 30}`, stroke: BONE, 'stroke-width': 13, fill: 'none', 'stroke-linecap': 'round' }, g);
  el('path', { d: `M${cx - 190} ${top + 470} Q${cx - 100} ${top + 380} ${cx} ${top + 440} Q${cx + 100} ${top + 390} ${cx + 190} ${top + 480} L${cx + 210} ${p.y + p.h} L${cx - 210} ${p.y + p.h} Z`, fill: '#8ea2a7', opacity: .75 }, g);
}

function abdomen(g, p) { // abdominal radiograph
  const cx = p.x + p.w / 2, top = p.y + 40;
  el('rect', { x: p.x, y: p.y, width: p.w, height: p.h, fill: '#2f3c40' }, g);
  // intestines: coiled soft loops with dark gas pockets
  const r = rng(13);
  let d = '';
  let x = cx - 120, y = top + 170;
  d += `M${x} ${y} `;
  for (let i = 0; i < 26; i++) {
    const nx = cx - 130 + r() * 260, ny = top + 150 + r() * 300;
    d += `Q${(x + nx) / 2 + (r() - .5) * 120} ${(y + ny) / 2 + (r() - .5) * 120} ${nx} ${ny} `;
    x = nx; y = ny;
  }
  el('path', { d, stroke: '#9fb3b8', 'stroke-width': 30, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .55 }, g);
  el('path', { d, stroke: '#0f1618', 'stroke-width': 12, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '18 26', opacity: .7 }, g);
  // colon frame
  el('path', { d: `M${cx - 150} ${top + 470} L${cx - 165} ${top + 120} Q${cx - 160} ${top + 80} ${cx - 110} ${top + 90} L${cx + 120} ${top + 85} Q${cx + 170} ${top + 85} ${cx + 165} ${top + 130} L${cx + 150} ${top + 460}`, stroke: '#a9bcc0', 'stroke-width': 34, fill: 'none', opacity: .45, 'stroke-linecap': 'round' }, g);
  // stomach gas bubble (upper left of the patient = viewer's right)
  el('ellipse', { cx: cx + 95, cy: top + 40, rx: 60, ry: 36, fill: '#0d1416', opacity: .8 }, g);
  // abdominal aorta, just beside the spine, splitting toward the legs
  el('path', { d: `M${cx + 42} ${p.y} L${cx + 42} ${top + 360} M${cx + 42} ${top + 360} Q${cx + 20} ${top + 420} ${cx - 40} ${top + 470} M${cx + 42} ${top + 360} Q${cx + 70} ${top + 420} ${cx + 110} ${top + 470}`, stroke: '#c9d8db', 'stroke-width': 16, fill: 'none', opacity: .5, 'stroke-linecap': 'round' }, g);
  // lumbar spine
  for (let i = 0; i < 6; i++) el('rect', { x: cx - 28, y: top + i * 66, width: 56, height: 52, rx: 9, fill: BONE, opacity: .6 }, g);
  // pelvis
  for (const s of [-1, 1]) {
    el('path', { d: `M${cx + s * 30} ${top + 400} Q${cx + s * 200} ${top + 330} ${cx + s * 205} ${top + 420} Q${cx + s * 190} ${top + 520} ${cx + s * 70} ${top + 560}`, stroke: BONE, 'stroke-width': 16, fill: 'none', 'stroke-linecap': 'round', opacity: .8 }, g);
    el('circle', { cx: cx + s * 150, cy: top + 575, r: 34, fill: 'none', stroke: BONE, 'stroke-width': 10, opacity: .75 }, g);
  }
  el('path', { d: `M${cx - 30} ${top + 405} Q${cx} ${top + 470} ${cx + 30} ${top + 405}`, stroke: BONE, 'stroke-width': 12, fill: 'none', opacity: .7 }, g);
}

// plastic flecks clustered around a point
function flecks(svg, id, cx, cy, n, spread, seed) {
  const g = el('g', { id, opacity: 0, filter: 'url(#xr-glow)' }, svg);
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 1.2, w = 5 + r() * 6, h = 3 + r() * 5;
    el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, fill: '#3fd3e8', transform: `rotate(${(r() * 180).toFixed(0)} ${x} ${y})` }, g);
  }
  return g;
}

export function buildBoard(root, portrait = false) {
  const W = portrait ? 620 : 1600, H = portrait ? 2300 : 900;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet', class: 'xboard-svg' }, root);
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <radialGradient id="xr-back" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#3a4d53"/><stop offset=".7" stop-color="#1a2427"/><stop offset="1" stop-color="#0d1315"/></radialGradient>
    <radialGradient id="xr-brain" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#7d9196"/><stop offset="1" stop-color="#4f6166"/></radialGradient>
    <radialGradient id="xr-wall" cx=".5" cy=".4" r=".9"><stop offset="0" stop-color="#151b1d"/><stop offset="1" stop-color="#070a0b"/></radialGradient>
    <filter id="xr-soft" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix in="n" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .12 0" result="na"/>
      <feComposite in="na" in2="b" operator="atop" result="nb"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="nb"/></feMerge>
    </filter>
    <filter id="xr-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${PANELS.map((p) => `<clipPath id="clip-${p.id}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>`).join('')}`;
  el('rect', { x: -2000, y: -1000, width: 5600, height: 5000, fill: 'url(#xr-wall)' }, svg);
  // header strip
  const hx0 = portrait ? 30 : 70, hx1 = portrait ? 590 : 1530;
  const hdr = el('text', { x: hx0, y: 78, class: 'xb-head' }, svg); hdr.textContent = 'RADIOLOGY';
  const pid = el('text', { x: hx1, y: portrait ? 112 : 78, class: 'xb-head', 'text-anchor': 'end', 'data-i18n': 'xPatient' }, svg); pid.textContent = 'PATIENT: YOU · AGE 20';
  el('line', { x1: hx0, y1: portrait ? 128 : 94, x2: hx1, y2: portrait ? 128 : 94, stroke: '#2f383b' }, svg);
  // each film lives in a group that is moved into place (side by side, or stacked on phones)
  const groups = {}, offs = {};
  PANELS.forEach((p) => {
    const [nx, ny] = portrait ? PORTRAIT_POS[p.id] : [p.x, p.y];
    offs[p.id] = [nx - p.x, ny - p.y];
    groups[p.id] = el('g', { transform: `translate(${nx - p.x} ${ny - p.y})` }, svg);
  });
  const contents = PANELS.map((p) => film(groups[p.id], p));
  head(contents[0], PANELS[0]); chest(contents[1], PANELS[1]); abdomen(contents[2], PANELS[2]);
  PANELS.forEach((p) => { const t = el('text', { x: p.x, y: p.y + p.h + 40, class: 'xb-cap', 'data-i18n': p.cap }, groups[p.id]); t.textContent = p.cap; });
  // flecks + leader lines per call-out
  const parts = {};
  let seed = 20;
  for (const k in CALLOUTS) {
    const c = CALLOUTS[k], g = groups[c.panel], [ox, oy] = offs[c.panel];
    const fl = flecks(g, `xf-${k}`, c.pt[0], c.pt[1], k === 'gut' ? 34 : 20, k === 'gut' ? 90 : 55, seed++);
    const pos = portrait ? PORTRAIT_BOX[k] : c.box;
    const bw = portrait ? 0.44 * W : 240, bh = portrait ? 150 : 80;
    const bx = pos[0] / 100 * W - ox, by = pos[1] / 100 * H - oy; // in the film group's own coordinates
    const line = el('path', { d: `M${c.pt[0]} ${c.pt[1]} L${bx + bw / 2} ${by + (by > c.pt[1] ? 0 : bh)}`, stroke: '#3fd3e8', 'stroke-width': 1.6, fill: 'none', opacity: 0 }, g);
    const ring = el('circle', { cx: c.pt[0], cy: c.pt[1], r: 16, fill: 'none', stroke: '#3fd3e8', 'stroke-width': 1.6, opacity: 0 }, g);
    const box = document.createElement('div'); box.className = 'xlabel xb-label'; box.style.left = pos[0] + '%'; box.style.top = pos[1] + '%';
    root.appendChild(box);
    parts[k] = { fl, line, ring, box };
  }
  return parts;
}

// phone layout: films stacked vertically in a 620 × 2300 board
export const PORTRAIT_BOARD = { W: 620, H: 2300, panelY: { p1: 150, p2: 870, p3: 1590 } };
const PORTRAIT_POS = { p1: [80, 150], p2: [80, 870], p3: [80, 1590] };
const PORTRAIT_BOX = { brain: [6, 27], lungs: [3, 39], heart: [53, 39], blood: [3, 70.4], gut: [53, 89.5] };
