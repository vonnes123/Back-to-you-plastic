// 2D SVG scenery, drawn in a 1600×900 "stage" that scales with viewport height
// (the same way the 3D camera's vertical FOV does), so 2D and 3D stay aligned.
// Grayscale ink style; anything plastic is drawn in the palette blue.

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
// deterministic random so the art is identical on every load
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const C = {
  ink: '#0b0e0f', ink2: '#14181a', line: '#aeb5b8', paper: '#e6e7e3',
  plastic: '#08869c', plasticDeep: '#154f66', plasticLine: '#e3f2fa', glow: '#3fd3e8',
};
export const HORIZON = 330;
export const PLATE = { x: 880, y: 430 }; // centre of plate / tray (stage coords)
export const ROD = { baseX: 1520, baseY: 1010, tipX: 1050, tipY: 215 };

function defs(svg) {
  const d = el('defs', {}, svg);
  d.innerHTML = `
    <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#090b0c"/><stop offset=".75" stop-color="#1f2325"/><stop offset="1" stop-color="#34393b"/>
    </linearGradient>
    <linearGradient id="g-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2f31"/><stop offset=".35" stop-color="#16191b"/><stop offset="1" stop-color="#090b0c"/>
    </linearGradient>
    <linearGradient id="g-surface" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1e20" stop-opacity="0"/><stop offset=".25" stop-color="#15191b" stop-opacity=".28"/><stop offset="1" stop-color="#0b0e0f" stop-opacity=".55"/>
    </linearGradient>
    <radialGradient id="g-moon"><stop offset="0" stop-color="#e9ecec" stop-opacity=".22"/><stop offset="1" stop-color="#e9ecec" stop-opacity="0"/></radialGradient>
    <pattern id="p-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#cfd5d7" stroke-width=".7" stroke-opacity=".09"/>
    </pattern>
    <pattern id="p-hatch-dark" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#000" stroke-width="1.1" stroke-opacity=".35"/>
    </pattern>
    <pattern id="p-eps" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2.4" fill="#e3f2fa" fill-opacity=".1"/><circle cx="12" cy="11" r="2.8" fill="#e3f2fa" fill-opacity=".08"/>
      <circle cx="10" cy="3" r="1.4" fill="#000" fill-opacity=".12"/>
    </pattern>
    <pattern id="p-rice" width="26" height="22" patternUnits="userSpaceOnUse">
      <ellipse cx="6" cy="6" rx="4.5" ry="2.2" transform="rotate(25 6 6)" fill="none" stroke="#9aa0a0" stroke-width=".8"/>
      <ellipse cx="18" cy="14" rx="4.5" ry="2.2" transform="rotate(-30 18 14)" fill="none" stroke="#9aa0a0" stroke-width=".8"/>
      <ellipse cx="7" cy="18" rx="4" ry="2" transform="rotate(70 7 18)" fill="none" stroke="#9aa0a0" stroke-width=".8"/>
    </pattern>
    <filter id="f-ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="3.5"/>
    </filter>
    <filter id="f-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feColorMatrix in="b" values="0 0 0 0 .25  0 0 0 0 .83  0 0 0 0 .91  0 0 0 .9 0" result="c"/>
      <feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

// a full-stage <svg> that moves as one composited layer
function waveLayer(parent, t) {
  const s = el('svg', { viewBox: '0 0 1600 900', preserveAspectRatio: 'xMidYMid meet', class: 'wave-layer', 'data-t': t.toFixed(3) }, parent);
  return s;
}

// ======================= SEA (background) =======================
function seaBackground(svg) {
  const g = el('g', { id: 'sea-bg' }, svg);
  const r = rng(7);
  el('rect', { x: -1400, y: -600, width: 4400, height: HORIZON + 600, fill: 'url(#g-sky)' }, g);
  el('rect', { x: -1400, y: -600, width: 4400, height: HORIZON + 600, fill: 'url(#p-hatch)' }, g);
  // moon
  el('circle', { cx: 1190, cy: 150, r: 150, fill: 'url(#g-moon)' }, g);
  el('circle', { cx: 1190, cy: 150, r: 38, fill: '#dfe3e3', opacity: .9 }, g);
  el('circle', { cx: 1178, cy: 142, r: 38, fill: 'url(#p-hatch-dark)', opacity: .5 }, g);
  // ink cloud streaks
  let cd = '';
  for (let i = 0; i < 26; i++) {
    const y = 60 + r() * 200, x = -300 + r() * 2200, w = 80 + r() * 260;
    cd += `M${x} ${y} q${w / 2} ${-3 - r() * 4} ${w} 0 `;
  }
  el('path', { d: cd, stroke: '#cfd5d7', 'stroke-opacity': .12, 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g);
  // distant coast + Fuji
  el('path', {
    d: `M-1400 ${HORIZON} L-1400 ${HORIZON - 26} C-1100 ${HORIZON - 40} -900 ${HORIZON - 18} -700 ${HORIZON - 30} C-500 ${HORIZON - 44} -300 ${HORIZON - 22} -150 ${HORIZON - 34}
        C0 ${HORIZON - 46} 120 ${HORIZON - 30} 200 ${HORIZON - 36} L330 ${HORIZON - 118} C350 ${HORIZON - 126} 372 ${HORIZON - 126} 392 ${HORIZON - 118}
        L560 ${HORIZON - 30} C640 ${HORIZON - 22} 700 ${HORIZON - 14} 760 ${HORIZON - 8} L800 ${HORIZON} Z`,
    fill: '#191d1f', stroke: '#596165', 'stroke-width': 1,
  }, g);
  el('path', { d: `M330 ${HORIZON - 118} C350 ${HORIZON - 126} 372 ${HORIZON - 126} 392 ${HORIZON - 118} L420 ${HORIZON - 92} L404 ${HORIZON - 97} L392 ${HORIZON - 86} L376 ${HORIZON - 98} L360 ${HORIZON - 88} L346 ${HORIZON - 100} L304 ${HORIZON - 92} Z`, fill: '#9ca3a5', opacity: .55 }, g);
  // sea
  el('rect', { x: -1400, y: HORIZON, width: 4400, height: 1200, fill: 'url(#g-sea)' }, g);
  el('line', { x1: -1400, y1: HORIZON, x2: 3000, y2: HORIZON, stroke: '#7f888b', 'stroke-width': 1, 'stroke-opacity': .6 }, g);
  // wave strokes with perspective — grouped into bands, each band its own <svg> layer
  const BANDS = 8;
  const bandSvgs = Array.from({ length: BANDS }, (_, i) => waveLayer(document.getElementById('waves-back'), (i + .5) / BANDS));
  const rows = 42;
  for (let k = 0; k < rows; k++) {
    const t = k / (rows - 1);
    const band = bandSvgs[Math.min(BANDS - 1, Math.floor(t * BANDS))];
    const y = HORIZON + 4 + 600 * Math.pow(t, 1.9);
    let d = '', dm = '';
    let x = -1400 + r() * 60;
    while (x < 3000) {
      const len = (16 + r() * 50) * (1 + t * 5);
      const amp = 1 + t * 7;
      const seg = `M${x.toFixed(1)} ${(y + (r() - .5) * 6 * t).toFixed(1)} q${(len / 2).toFixed(1)} ${(-amp).toFixed(1)} ${len.toFixed(1)} 0 `;
      if (Math.abs(x - 1190) < 70 + t * 120 && r() > .2) dm += seg; else if (r() > .25) d += seg;
      x += len + (10 + r() * 60) * (1 + t * 3);
    }
    el('path', { d, stroke: '#a7b0b3', 'stroke-opacity': (.1 + .28 * t).toFixed(2), 'stroke-width': (.7 + 2.4 * t).toFixed(2), fill: 'none', 'stroke-linecap': 'round' }, band);
    if (dm) el('path', { d: dm, stroke: '#e3e8e8', 'stroke-opacity': (.45 - .2 * t).toFixed(2), 'stroke-width': (.9 + 2.2 * t).toFixed(2), fill: 'none', 'stroke-linecap': 'round' }, band);
  }
  return g;
}

// ======================= SEA (foreground: surface, boat, rod) =======================
function seaForeground(svg) {
  const g = el('g', { id: 'sea-fg' }, svg);
  const r = rng(21);
  // translucent water surface over the 3D fish (makes it read as "under water");
  // lives in its own HTML layer (#water-surface) beneath the fg svg
  const surfHost = document.getElementById('water-surface');
  const gradSvg = el('svg', { viewBox: '0 0 1600 900', preserveAspectRatio: 'xMidYMid meet' }, surfHost);
  defs(gradSvg);
  el('rect', { x: -1400, y: HORIZON + 30, width: 4400, height: 900, fill: 'url(#g-surface)' }, gradSvg);
  // strokes that pass OVER the fish, split into depth bands so each band can move
  const BANDS = 10, bands = Array.from({ length: BANDS }, () => '');
  for (let i = 0; i < 300; i++) {
    const t = r();
    const y = HORIZON + 40 + 520 * Math.pow(t, 1.6);
    const x = -900 + r() * 3400, len = (24 + r() * 70) * (1 + t * 3);
    bands[Math.min(BANDS - 1, Math.floor(t * BANDS))] += `M${x.toFixed(0)} ${y.toFixed(0)} q${(len / 2).toFixed(0)} ${(-2 - t * 6).toFixed(1)} ${len.toFixed(0)} 0 `;
  }
  bands.forEach((d, i) => {
    const t = (i + .5) / BANDS;
    const layer = waveLayer(surfHost, t);
    el('path', { d, stroke: '#c9d1d3', 'stroke-opacity': (.22 + .2 * t).toFixed(2), 'stroke-width': (1.2 + 1.6 * t).toFixed(1), fill: 'none', 'stroke-linecap': 'round' }, layer);
  });

  // boat gunwale (POV from the boat)
  const boat = el('g', { id: 'boat', filter: 'url(#f-ink)' }, g);
  el('path', { d: 'M-1400 1000 L-1400 842 C-400 818 300 806 800 806 C1300 806 2000 818 3000 842 L3000 1000 Z', fill: '#0c0f10', stroke: '#8c9497', 'stroke-width': 2 }, boat);
  el('path', { d: 'M-1400 870 C-400 846 300 836 800 836 C1300 836 2000 846 3000 870', fill: 'none', stroke: '#5b6366', 'stroke-width': 1.4 }, boat);
  el('path', { d: 'M-1400 842 C-400 818 300 806 800 806 C1300 806 2000 818 3000 842 L3000 1000 L-1400 1000 Z', fill: 'url(#p-hatch)' }, boat);
  // rope coil + cleat
  const rope = el('g', { transform: 'translate(300 828)' }, boat);
  for (let i = 0; i < 5; i++) el('ellipse', { cx: 0, cy: -6 - i * 2, rx: 70 - i * 9, ry: 16 - i * 2, fill: 'none', stroke: '#9aa2a5', 'stroke-width': 3, 'stroke-opacity': .7 - i * .08 }, rope);
  el('rect', { x: 1080, y: 798, width: 90, height: 14, rx: 6, fill: '#22282a', stroke: '#8c9497', 'stroke-width': 1.5 }, boat);

  // rod (pivots at its base so it can bend/bob)
  const rod = el('g', { id: 'rod' }, g);
  const { baseX, baseY, tipX, tipY } = ROD;
  const ang = Math.atan2(tipY - baseY, tipX - baseX), nx = -Math.sin(ang), ny = Math.cos(ang);
  const w0 = 13, w1 = 2.2;
  el('path', {
    d: `M${baseX + nx * w0} ${baseY + ny * w0} L${tipX + nx * w1} ${tipY + ny * w1} L${tipX - nx * w1} ${tipY - ny * w1} L${baseX - nx * w0} ${baseY - ny * w0} Z`,
    fill: '#101314', stroke: '#c5ccce', 'stroke-width': 1.5,
  }, rod);
  // guides
  for (const t of [.2, .42, .62, .8]) {
    const x = baseX + (tipX - baseX) * t, y = baseY + (tipY - baseY) * t;
    el('circle', { cx: x + nx * 9, cy: y + ny * 9, r: 3.5, fill: 'none', stroke: '#c5ccce', 'stroke-width': 1.2 }, rod);
  }
  // reel
  const rx = baseX + (tipX - baseX) * .1, ry = baseY + (tipY - baseY) * .1;
  el('circle', { cx: rx + nx * 30, cy: ry + ny * 30, r: 26, fill: '#121516', stroke: '#c5ccce', 'stroke-width': 1.8 }, rod);
  el('circle', { cx: rx + nx * 30, cy: ry + ny * 30, r: 9, fill: 'none', stroke: '#c5ccce', 'stroke-width': 1.2 }, rod);
  return g;
}

// ======================= COOLER (EPS box) =======================
function coolerBack(svg) {
  const g = el('g', { id: 'cooler-back' }, svg);
  // inside of the box, seen from above-front
  el('path', { d: 'M470 470 L1130 470 L1220 600 L380 600 Z', fill: '#0a3f4f' }, g);
  el('path', { d: 'M470 470 L1130 470 L1130 520 L470 520 Z', fill: C.plasticDeep }, g); // inner back wall
  el('path', { d: 'M470 470 L1130 470 L1220 600 L380 600 Z', fill: 'url(#p-eps)' }, g);
  // ice
  const r = rng(3);
  for (let i = 0; i < 22; i++) {
    const x = 470 + r() * 680, y = 530 + r() * 60, s = 18 + r() * 26;
    el('path', { d: `M${x} ${y} l${s} ${-s * .3} l${s * .5} ${s * .6} l${-s * .7} ${s * .45} Z`, fill: '#d9e3e6', 'fill-opacity': .55, stroke: '#ffffff', 'stroke-opacity': .7, 'stroke-width': 1 }, g);
  }
  // back + side rims
  el('path', { d: 'M440 450 L1160 450 L1130 470 L470 470 Z', fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.4 }, g);
  el('path', { d: 'M440 450 L470 470 L380 600 L340 600 Z', fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.4 }, g);
  el('path', { d: 'M1160 450 L1130 470 L1220 600 L1260 600 Z', fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.4 }, g);
  return g;
}
function coolerFront(svg) {
  const g = el('g', { id: 'cooler-front' }, svg);
  el('path', { d: 'M340 600 L1260 600 L1290 1100 L310 1100 Z', fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.6 }, g);
  el('path', { d: 'M340 600 L1260 600 L1290 1100 L310 1100 Z', fill: 'url(#p-eps)' }, g);
  el('path', { d: 'M340 600 L1260 600 L1262 628 L338 628 Z', fill: '#0b97ae', stroke: C.plasticLine, 'stroke-width': 1 }, g);
  // hand-hold groove + stencil text
  el('rect', { x: 700, y: 690, width: 200, height: 26, rx: 13, fill: C.plasticDeep, stroke: C.plasticLine, 'stroke-opacity': .5 }, g);
  const t = el('text', { x: 800, y: 790, 'text-anchor': 'middle', class: 'label', 'font-size': 30, fill: C.plasticLine, 'fill-opacity': .55, 'letter-spacing': 8 }, g);
  t.textContent = '鮮魚 / FRESH FISH';
  // label tag
  const tag = el('g', { id: 'cooler-tag', opacity: 0 }, g);
  el('line', { x1: 1260, y1: 660, x2: 1350, y2: 610, stroke: C.glow, 'stroke-width': 1.5 }, tag);
  el('circle', { cx: 1260, cy: 660, r: 4, fill: C.glow }, tag);
  const lt = el('text', { x: 1358, y: 606, class: 'label', 'data-i18n': 'lblEps' }, tag);
  lt.textContent = 'EPS · EXPANDED POLYSTYRENE';
  return g;
}
function coolerLid(svg) {
  const g = el('g', { id: 'cooler-lid' }, svg);
  el('path', { d: 'M420 430 L1180 430 L1290 610 L310 610 Z', fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.6 }, g);
  el('path', { d: 'M420 430 L1180 430 L1290 610 L310 610 Z', fill: 'url(#p-eps)' }, g);
  el('path', { d: 'M310 610 L1290 610 L1290 650 L310 650 Z', fill: '#0b97ae', stroke: C.plasticLine, 'stroke-width': 1.2 }, g);
  return g;
}

// ======================= TRAY + FILM =======================
function tray(svg, { id, x, y, w, h, scale = 1, rot = 0 }) {
  const g = el('g', { id, transform: `translate(${x} ${y}) rotate(${rot}) scale(${scale})` }, svg);
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 34, fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.8 }, g);
  el('rect', { x: -w / 2 + 30, y: -h / 2 + 30, width: w - 60, height: h - 60, rx: 18, fill: '#07758a', stroke: C.plasticLine, 'stroke-opacity': .55 }, g);
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 34, fill: 'url(#p-eps)' }, g);
  let d = '';
  for (let i = 1; i < 9; i++) { const yy = -h / 2 + 30 + (h - 60) * i / 9; d += `M${-w / 2 + 50} ${yy} L${w / 2 - 50} ${yy} `; }
  el('path', { d, stroke: '#000', 'stroke-opacity': .18, 'stroke-width': 3 }, g);
  return g;
}
function film(svg) {
  const g = el('g', { id: 'film' }, svg);
  const inner = el('g', { id: 'film-inner', transform: `translate(${PLATE.x} ${PLATE.y})` }, g);
  el('rect', { x: -430, y: -190, width: 860, height: 380, rx: 40, fill: C.plasticLine, 'fill-opacity': .13, stroke: C.plasticLine, 'stroke-opacity': .7, 'stroke-width': 1.5 }, inner);
  el('path', { d: 'M-400 -150 L-160 170 M-300 -175 L-40 175 M120 -180 L300 60 M200 -180 L400 120', stroke: '#ffffff', 'stroke-opacity': .25, 'stroke-width': 10, 'stroke-linecap': 'round' }, inner);
  el('path', { d: 'M-380 -60 q40 -20 90 6 M240 140 q50 10 110 -20 M-120 150 q30 -14 60 0 M300 -150 q-30 20 -70 10', stroke: '#ffffff', 'stroke-opacity': .5, 'stroke-width': 1.4, fill: 'none' }, inner);
  // price sticker (paper, not plastic)
  const st = el('g', { transform: 'translate(220 70) rotate(-6)' }, inner);
  el('rect', { x: 0, y: 0, width: 190, height: 98, fill: '#ecebe5', stroke: '#222', 'stroke-width': 1 }, st);
  el('rect', { x: 0, y: 0, width: 190, height: 24, fill: '#2b2f31' }, st);
  const t1 = el('text', { x: 10, y: 17, class: 'label', 'font-size': 12, fill: '#ecebe5' }, st); t1.textContent = '真いわし · MAIWASHI';
  const t2 = el('text', { x: 10, y: 58, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 30, 'font-weight': 500, fill: '#111' }, st); t2.textContent = '¥198';
  let bc = '';
  for (let i = 0; i < 30; i++) { const xx = 118 + i * 2.3; if ((i * 7) % 5 > 1) bc += `M${xx} 36 L${xx} 84 `; }
  el('path', { d: bc, stroke: '#111', 'stroke-width': 1.3 }, st);
  const t3 = el('text', { x: 10, y: 86, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#333' }, st); t3.textContent = '国産 · 消費期限 11.10';
  // tag
  const tag = el('g', { id: 'film-tag', opacity: 0 }, g);
  el('line', { x1: PLATE.x - 380, y1: PLATE.y - 160, x2: PLATE.x - 450, y2: PLATE.y - 250, stroke: C.glow, 'stroke-width': 1.5 }, tag);
  el('circle', { cx: PLATE.x - 380, cy: PLATE.y - 160, r: 4, fill: C.glow }, tag);
  const lt = el('text', { x: PLATE.x - 450, y: PLATE.y - 260, class: 'label', 'text-anchor': 'middle', 'data-i18n': 'lblFilm' }, tag);
  lt.textContent = 'TRAY · EPS   /   WRAP · PE';
  return g;
}

// ======================= TABLE (background) =======================
function plasticTag(parent, id, x, y, tx, ty, key, text, anchor = 'start') {
  const g = el('g', { class: 'ptag', id, opacity: 0 }, parent);
  el('line', { x1: x, y1: y, x2: tx, y2: ty, stroke: C.glow, 'stroke-width': 1.5 }, g);
  el('circle', { cx: x, cy: y, r: 4, fill: C.glow }, g);
  const t = el('text', { x: tx + (anchor === 'end' ? -8 : 8), y: ty + 4, class: 'label', 'text-anchor': anchor, 'data-i18n': key }, g);
  t.textContent = text;
  return g;
}

function tableBackground(svg) {
  const g = el('g', { id: 'table-bg', opacity: 0 }, svg);
  const r = rng(11);
  // dark wood
  el('rect', { x: -1400, y: -600, width: 4400, height: 2100, fill: '#121516' }, g);
  for (let i = 0; i < 70; i++) {
    const y = -100 + i * 16 + r() * 8;
    let d = `M-1400 ${y.toFixed(0)} `;
    for (let x = -1400; x < 3000; x += 200) d += `Q${x + 100} ${(y + (r() - .5) * 14).toFixed(0)} ${x + 200} ${(y + (r() - .5) * 6).toFixed(0)} `;
    el('path', { d, stroke: '#3b4245', 'stroke-opacity': (.15 + r() * .35).toFixed(2), 'stroke-width': (.6 + r() * 1.6).toFixed(1), fill: 'none' }, g);
  }
  el('rect', { x: -1400, y: -600, width: 4400, height: 2100, fill: 'url(#p-hatch)' }, g);
  // placemat (woven straw, natural)
  const mat = el('g', { filter: 'url(#f-ink)' }, g);
  el('rect', { x: 300, y: 200, width: 1260, height: 760, rx: 10, fill: '#1b1f20', stroke: '#6b7477', 'stroke-width': 1.5 }, mat);
  let md = '';
  for (let y = 214; y < 960; y += 12) md += `M314 ${y} L1546 ${y} `;
  el('path', { d: md, stroke: '#3b4245', 'stroke-width': 1, 'stroke-opacity': .7 }, mat);

  // ---- natural items (grayscale) ----
  const plate = el('g', { id: 'plate', opacity: 0, filter: 'url(#f-ink)' }, g);
  el('rect', { x: PLATE.x - 420, y: PLATE.y - 180, width: 840, height: 360, rx: 22, fill: '#0a0c0d', opacity: .6, transform: 'translate(10 14)' }, plate);
  el('rect', { x: PLATE.x - 420, y: PLATE.y - 180, width: 840, height: 360, rx: 22, fill: '#d8d9d5', stroke: '#222', 'stroke-width': 2 }, plate);
  el('rect', { x: PLATE.x - 390, y: PLATE.y - 150, width: 780, height: 300, rx: 14, fill: '#e4e5e1', stroke: '#9a9e9e', 'stroke-width': 1.2 }, plate);
  el('rect', { x: PLATE.x - 420, y: PLATE.y - 180, width: 840, height: 360, rx: 22, fill: 'url(#p-hatch-dark)', opacity: .25 }, plate);
  // grated daikon + shiso leaf on the plate
  el('path', { d: `M${PLATE.x + 270} ${PLATE.y + 110} q20 -40 60 -20 q30 30 0 50 q-40 14 -60 -30 Z`, fill: '#f2f2ef', stroke: '#777', 'stroke-width': 1 }, plate);
  el('path', { d: `M${PLATE.x + 240} ${PLATE.y + 130} q40 -70 110 -60 q-10 70 -110 60 Z M${PLATE.x + 245} ${PLATE.y + 127} L${PLATE.x + 340} ${PLATE.y + 76}`, fill: '#4a5150', stroke: '#1d2121', 'stroke-width': 1.4 }, plate);

  const natural = el('g', { id: 'natural-items', opacity: 0, filter: 'url(#f-ink)' }, g);
  // rice bowl
  el('circle', { cx: 600, cy: 760, r: 128, fill: '#0c0e0f', opacity: .55, transform: 'translate(8 12)' }, natural);
  el('circle', { cx: 600, cy: 760, r: 128, fill: '#202526', stroke: '#c6cccd', 'stroke-width': 2 }, natural);
  el('circle', { cx: 600, cy: 760, r: 108, fill: '#e7e8e4' }, natural);
  el('circle', { cx: 600, cy: 760, r: 108, fill: 'url(#p-rice)' }, natural);
  el('path', { d: 'M512 700 A108 108 0 0 1 700 690', stroke: '#fff', 'stroke-width': 3, fill: 'none', opacity: .6 }, natural);
  // miso soup
  el('circle', { cx: 1180, cy: 760, r: 122, fill: '#0c0e0f', opacity: .55, transform: 'translate(8 12)' }, natural);
  el('circle', { cx: 1180, cy: 760, r: 122, fill: '#26201c', stroke: '#c6cccd', 'stroke-width': 2 }, natural);
  el('circle', { cx: 1180, cy: 760, r: 102, fill: '#4b4540' }, natural);
  el('circle', { cx: 1180, cy: 760, r: 102, fill: 'url(#p-hatch-dark)', opacity: .5 }, natural);
  for (const [x, y, a] of [[1150, 730, 12], [1210, 770, -20], [1170, 800, 35], [1230, 720, 5]]) el('rect', { x: x - 13, y: y - 13, width: 26, height: 26, rx: 3, fill: '#e3e3dc', transform: `rotate(${a} ${x} ${y})` }, natural);
  el('path', { d: 'M1120 760 q20 -14 40 4 q14 14 34 0 M1190 700 q14 10 30 0', stroke: '#1d2420', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, natural);
  // resting chopsticks + rest
  el('rect', { x: 448, y: 878, width: 46, height: 18, rx: 9, fill: '#3d4344', stroke: '#c6cccd', 'stroke-width': 1.2 }, natural);
  el('path', { d: 'M430 880 L1060 868 L1060 873 L430 888 Z M430 894 L1062 880 L1062 885 L430 902 Z', fill: '#2e2a26', stroke: '#c6cccd', 'stroke-width': 1.2 }, natural);

  // ---- plastic items (solid palette blue) ----
  const plastic = el('g', { id: 'plastic-items', opacity: 0 }, g);
  const P = { fill: C.plastic, stroke: C.plasticLine, 'stroke-width': 1.6 };
  // soy-sauce fish (tare-bin)
  const soy = el('g', { id: 'pi-soy', transform: 'translate(1390 300) rotate(-18)' }, plastic);
  el('path', { d: 'M-60 0 C-40 -22 30 -24 52 -6 L64 -16 L64 16 L52 6 C30 24 -40 22 -60 0 Z', ...P }, soy);
  el('rect', { x: -84, y: -8, width: 26, height: 16, rx: 4, ...P }, soy);
  el('circle', { cx: -34, cy: -4, r: 3, fill: C.plasticLine }, soy);
  el('path', { d: 'M-20 -14 q4 14 0 28 M0 -15 q4 15 0 30', stroke: C.plasticLine, 'stroke-opacity': .5, fill: 'none' }, soy);
  // PET bottle lying down
  const pet = el('g', { id: 'pi-pet', transform: 'translate(1360 120) rotate(-12)' }, plastic);
  el('path', { d: 'M-170 -46 L90 -46 C120 -46 128 -20 150 -16 L176 -16 L176 16 L150 16 C128 20 120 46 90 46 L-170 46 C-182 46 -186 34 -186 0 C-186 -34 -182 -46 -170 -46 Z', ...P }, pet);
  el('rect', { x: 176, y: -20, width: 30, height: 40, rx: 4, fill: C.plasticDeep, stroke: C.plasticLine, 'stroke-width': 1.6 }, pet);
  el('rect', { x: -110, y: -46, width: 150, height: 92, fill: C.plasticDeep, stroke: C.plasticLine, 'stroke-width': 1.2 }, pet);
  const pl = el('text', { x: -35, y: 7, 'text-anchor': 'middle', class: 'label', 'font-size': 18, fill: C.plasticLine }, pet); pl.textContent = '緑茶';
  el('path', { d: 'M-160 -30 L-160 30 M-140 -32 L-140 32 M60 -40 L60 40 M80 -40 L80 40', stroke: C.plasticLine, 'stroke-opacity': .35 }, pet);
  el('path', { d: 'M-150 -34 L70 -34', stroke: '#fff', 'stroke-opacity': .45, 'stroke-width': 4, 'stroke-linecap': 'round' }, pet);
  // chopstick sleeve
  const sleeve = el('g', { id: 'pi-sleeve', transform: 'translate(1320 860) rotate(-8)' }, plastic);
  el('path', { d: 'M-150 -16 L150 -16 L162 -6 L150 16 L-150 16 L-160 0 Z', ...P }, sleeve);
  el('path', { d: 'M-110 -16 L-118 16 M90 -16 L96 16', stroke: C.plasticLine, 'stroke-opacity': .5 }, sleeve);
  const sl = el('text', { x: 0, y: 5, 'text-anchor': 'middle', class: 'label', 'font-size': 13, fill: C.plasticLine }, sleeve); sl.textContent = 'おてもと';
  // empty tray from the store, with crumpled wrap
  tray(plastic, { id: 'pi-tray', x: 470, y: 120, w: 340, h: 150, scale: 1, rot: 8 });
  el('path', { d: 'M380 90 q30 -30 70 -10 q40 -24 70 6 q30 30 -10 50 q-40 30 -80 4 q-50 6 -50 -50 Z', fill: C.plasticLine, 'fill-opacity': .22, stroke: C.plasticLine, 'stroke-width': 1.4 }, plastic);
  // konbini bag, crumpled, half off the right edge
  const bag = el('g', { id: 'pi-bag', transform: 'translate(1590 560) rotate(14)' }, plastic);
  el('path', { d: 'M-80 -120 L-40 -150 L-20 -110 L30 -112 L50 -150 L90 -118 L110 40 C100 110 -60 120 -100 60 Z', ...P }, bag);
  el('path', { d: 'M-60 -80 q30 40 10 120 M20 -90 q-10 60 30 130 M70 -60 q-20 30 0 80', stroke: C.plasticLine, 'stroke-opacity': .45, fill: 'none', 'stroke-width': 1.4 }, bag);

  // tags (shown one by one)
  const tags = el('g', { id: 'plastic-tags' }, g);
  plasticTag(tags, 'tag-soy', 1340, 316, 1300, 240, 'lblSoy', 'SOY FISH · PE', 'end');
  plasticTag(tags, 'tag-pet', 1250, 150, 1170, 60, 'lblPet', 'PET BOTTLE · PET', 'end');
  plasticTag(tags, 'tag-sleeve', 1220, 870, 1140, 960, 'lblSleeve', 'CHOPSTICK SLEEVE · PP', 'end');
  plasticTag(tags, 'tag-tray', 600, 150, 690, 60, 'lblTray', 'FOOD TRAY · EPS');
  plasticTag(tags, 'tag-bag', 1530, 470, 1450, 430, 'lblBag', 'SHOPPING BAG · PE', 'end');
  return g;
}

// tray under the fish during the store beat (background, sits where the plate will be)
function storeTray(svg) {
  return tray(svg, { id: 'store-tray', x: PLATE.x, y: PLATE.y, w: 820, h: 340 });
}

// ======================= EATING (foreground) =======================
function steam(svg) {
  const g = el('g', { id: 'steam', opacity: 0 }, svg);
  for (const [x, dl] of [[PLATE.x - 120, 0], [PLATE.x + 20, .6], [PLATE.x + 160, 1.2]]) {
    const p = el('path', { d: `M${x} ${PLATE.y - 60} c-24 -40 24 -70 0 -110 c-24 -40 24 -70 0 -110`, stroke: '#eef2f2', 'stroke-opacity': .35, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', class: 'steam-line' }, g);
    p.style.animationDelay = `${dl}s`;
  }
  return g;
}
function eatSticks(svg) {
  // tips at the group origin; sticks run toward the viewer (bottom right)
  const g = el('g', { id: 'eat-sticks', transform: 'translate(1700 1300)' }, svg);
  const morsel = el('g', { id: 'morsel', opacity: 0 }, g);
  el('ellipse', { cx: 0, cy: 0, rx: 30, ry: 18, fill: '#8b8580', stroke: '#1d1f20', 'stroke-width': 1.5 }, morsel);
  el('path', { d: 'M-24 -4 q20 -12 46 0', stroke: '#2a2826', 'stroke-width': 3, fill: 'none' }, morsel);
  for (const [x, y, a] of [[-12, 4, 20], [8, -6, -35], [16, 8, 60]]) el('rect', { x: x - 3.5, y: y - 2.5, width: 7, height: 5, fill: C.glow, filter: 'url(#f-glow)', transform: `rotate(${a} ${x} ${y})` }, morsel);
  const stick = (dy, id) => {
    const s = el('g', { id }, g);
    el('path', { d: `M-4 ${dy - 3} L520 ${dy + 300 - 9} L520 ${dy + 300 + 9} L-4 ${dy + 3} Z`, fill: '#2e2a26', stroke: '#d0d6d7', 'stroke-width': 1.6 }, s);
    return s;
  };
  stick(-10, 'stick-a');
  stick(10, 'stick-b');
  return g;
}

// ======================= SUPERMARKET (background, POV down an aisle) =======================
function supermarket(svg) {
  const outer = el('g', { id: 'market-bg', opacity: 0 }, svg);
  el('rect', { x: -1400, y: -600, width: 4400, height: 2100, fill: '#0e1112' }, outer);
  const g = el('g', { id: 'market-zoom' }, outer); // main.js scales this to "walk up" to a shelf
  const r = rng(99);
  const VX = 800, VY = 400;                       // vanishing point
  const BW = { x0: 600, x1: 1000, y0: 300, y1: 500 }; // back wall
  el('rect', { x: -1400, y: -600, width: 4400, height: 2100, fill: '#0e1112' }, g);
  // ceiling + light strips
  el('path', { d: `M-1400 -600 L3000 -600 L${BW.x1} ${BW.y0} L${BW.x0} ${BW.y0} Z`, fill: '#15191a' }, g);
  for (let i = 0; i < 6; i++) {
    const t = i / 6, t2 = (i + .45) / 6;
    const lerpP = (k, x0, y0) => [x0 + (VX - x0) * k, y0 + (VY - y0) * k];
    const [ax, ay] = lerpP(Math.pow(t, .55), 640, -120), [bx, by] = lerpP(Math.pow(t, .55), 960, -120);
    const [cx, cy] = lerpP(Math.pow(t2, .55), 960, -120), [dx, dy] = lerpP(Math.pow(t2, .55), 640, -120);
    el('path', { d: `M${ax} ${ay} L${bx} ${by} L${cx} ${cy} L${dx} ${dy} Z`, fill: '#e6eaea', opacity: .75 - t * .5 }, g);
  }
  // floor with tiles
  el('path', { d: `M-1400 1500 L3000 1500 L${BW.x1} ${BW.y1} L${BW.x0} ${BW.y1} Z`, fill: '#1b1f20' }, g);
  let fd = '';
  for (let i = -8; i <= 8; i++) fd += `M${VX + i * 260} 1300 L${VX + i * 25} ${BW.y1} `;
  for (let i = 1; i < 12; i++) { const y = BW.y1 + Math.pow(i / 12, 2.1) * 800; fd += `M-1400 ${y} L3000 ${y} `; }
  el('path', { d: fd, stroke: '#3a4144', 'stroke-width': 1.2, fill: 'none' }, g);
  // back wall + sign
  el('rect', { x: BW.x0, y: BW.y0, width: BW.x1 - BW.x0, height: BW.y1 - BW.y0, fill: '#202627', stroke: '#6b7477' }, g);
  el('rect', { x: 690, y: 320, width: 220, height: 44, fill: '#0d1011', stroke: '#c6cccd' }, g);
  const sign = el('text', { x: 800, y: 350, 'text-anchor': 'middle', class: 'label', 'font-size': 18 }, g); sign.textContent = 'お菓子 · SNACKS';
  // shelves on both sides, products: grey = other, blue = plastic-wrapped
  for (const side of [-1, 1]) {
    const xN = side < 0 ? BW.x0 : BW.x1;        // near the back wall
    const xF = side < 0 ? -700 : 2300;          // near the viewer
    el('path', { d: `M${xF} -200 L${xN} ${BW.y0} L${xN} ${BW.y1} L${xF} 1250 Z`, fill: '#121617', stroke: '#596165' }, g);
    for (let s = 0; s < 5; s++) {
      const k0 = s / 5, k1 = (s + 1) / 5;
      const yNear = (k) => -200 + (1250 + 200) * k, yBack = (k) => BW.y0 + (BW.y1 - BW.y0) * k;
      // shelf board line
      el('path', { d: `M${xF} ${yNear(k1)} L${xN} ${yBack(k1)}`, stroke: '#7b8487', 'stroke-width': 2 }, g);
      // products along the shelf, in perspective
      for (let p = 0; p < 26; p++) {
        const u0 = Math.pow(p / 26, .6), u1 = Math.pow((p + .8) / 26, .6);
        const x0 = xF + (xN - xF) * u0, x1 = xF + (xN - xF) * u1;
        const b0 = yNear(k1) + (yBack(k1) - yNear(k1)) * u0, b1 = yNear(k1) + (yBack(k1) - yNear(k1)) * u1;
        const hgt0 = (yNear(k1) - yNear(k0)) * (1 - u0) + (yBack(k1) - yBack(k0)) * u0;
        const hgt1 = (yNear(k1) - yNear(k0)) * (1 - u1) + (yBack(k1) - yBack(k0)) * u1;
        const f = .45 + r() * .4;
        const plastic = r() < .62;
        el('path', {
          d: `M${x0} ${b0} L${x1} ${b1} L${x1} ${b1 - hgt1 * f} L${x0} ${b0 - hgt0 * f} Z`,
          fill: plastic ? C.plastic : ['#3a4042', '#555c5f', '#2a2f31'][Math.floor(r() * 3)],
          stroke: plastic ? C.plasticLine : '#8b9497', 'stroke-width': .8, 'stroke-opacity': .6,
        }, g);
      }
    }
  }
  // the cookie bag we will pick (right shelf, middle row)
  const T = MARKET_TARGET;
  const tgt = el('g', { id: 'market-target' }, g);
  el('rect', { x: T.x - 40, y: T.y - 44, width: 80, height: 82, fill: '#121617' }, tgt);
  el('path', { d: `M${T.x - 26} ${T.y - 38} L${T.x + 26} ${T.y - 38} Q${T.x + 30} ${T.y} ${T.x + 26} ${T.y + 36} L${T.x - 26} ${T.y + 36} Q${T.x - 30} ${T.y} ${T.x - 26} ${T.y - 38} Z`, fill: C.plastic, stroke: C.plasticLine, 'stroke-width': .9 }, tgt);
  el('rect', { x: T.x - 15, y: T.y - 8, width: 30, height: 16, fill: '#1c2224' }, tgt);
  el('path', { d: `M${T.x - 26} ${T.y - 33} L${T.x + 26} ${T.y - 33} M${T.x - 26} ${T.y + 31} L${T.x + 26} ${T.y + 31}`, stroke: C.plasticLine, 'stroke-width': .6, 'stroke-opacity': .7 }, tgt);
  // highlight brackets
  const hl = el('g', { id: 'market-hl', opacity: 0 }, g);
  const b = 8, x0 = T.x - 34, x1 = T.x + 34, y0 = T.y - 46, y1 = T.y + 44;
  el('path', {
    d: `M${x0} ${y0 + b} V${y0} H${x0 + b} M${x1 - b} ${y0} H${x1} V${y0 + b} M${x1} ${y1 - b} V${y1} H${x1 - b} M${x0 + b} ${y1} H${x0} V${y1 - b}`,
    stroke: C.glow, 'stroke-width': 2, fill: 'none', 'vector-effect': 'non-scaling-stroke',
  }, hl);
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: C.glow, opacity: .08 }, hl);
  const lt = el('text', { x: x0, y: y0 - 6, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 6, fill: C.glow, 'letter-spacing': .6, 'data-i18n': 'tgCbag' }, hl);
  lt.textContent = 'SNACK BAG · PP';
  return outer;
}
export const MARKET_TARGET = { x: 1412, y: 461 };

export function buildScenery(bgSea, bg, fg) {
  defs(bgSea); defs(bg); defs(fg);
  seaBackground(bgSea);
  supermarket(bg);
  // background (behind the 3D canvas)
  coolerBack(bg);
  tableBackground(bg);
  storeTray(bg);
  // foreground (over the 3D canvas)
  seaForeground(fg);
  coolerFront(fg);
  coolerLid(fg);
  film(fg);
  steam(fg);
  eatSticks(fg);
}
