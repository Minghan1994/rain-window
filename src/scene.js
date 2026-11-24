// The forest outside: parallax layers, the rain curtain, and the car's speed.
import { state, canvas, TAU } from './state.js';

const VIEW_SCALE = 0.1;
const DRIVE_PACE = 0.4;

export const background = canvas();
export const refraction = canvas();
export const blurred = canvas();
export const curtain = canvas();

const bg = background.getContext('2d');
const rf = refraction.getContext('2d');
const bl = blurred.getContext('2d');
const ct = curtain.getContext('2d');

// far → near; top/h are fractions of the height, gap is px between trees, v is px/s at full speed
const LAYERS = [
  { col: [147, 165, 156], top: [0.30, 0.42], h: [0.14, 0.26], gap: 12, fill: 0.50, v: 16, blur: 2.5, fog: 0.40, kinds: 'c' },
  { col: [111, 133, 122], top: [0.22, 0.38], h: [0.22, 0.36], gap: 18, fill: 0.56, v: 50, blur: 3.5, fog: 0.30, kinds: 'ccd' },
  { col: [74, 96, 82], top: [0.08, 0.30], h: [0.40, 0.62], gap: 42, fill: 0.66, v: 130, blur: 5, fog: 0.2, kinds: 'ccdt' },
  { col: [44, 60, 50], top: [-0.25, 0.05], h: [0.9, 1.2], gap: 120, fill: 0.78, v: 320, blur: 8, fog: 0.06, kinds: 'ttc' },
  { col: [48, 66, 42], ground: true, fill: 0.88, v: 620, blur: 8, fog: 0 },
  { col: [20, 29, 23], trunks: true, gap: 560, v: 980, blur: 15, fog: 0 },
];

let layers = [];
let sky = {}, haze = {};
let speedTarget = 0.7, speedTimer = 10;
const streaks = [];

function seeded(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const shade = (c, f) => `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;

function gradient(g, stops) {
  const gr = g.createLinearGradient(0, 0, 0, state.height);
  for (const [at, color] of stops) gr.addColorStop(at, color);
  return gr;
}

function conifer(g, rnd, x, top, h, H) {
  const w = h * (0.3 + rnd() * 0.14);
  g.fillRect(x - w * 0.035, top + h * 0.5, w * 0.07, H * 2);
  const n = 6 + (rnd() * 5 | 0);
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / n, ty = top + h * (i / n) * 0.9, hw = w * f * 0.5 * (0.8 + rnd() * 0.4), th = h * 0.24;
    g.beginPath();
    g.moveTo(x + (rnd() - 0.5) * 2, ty);
    g.lineTo(x + hw, ty + th);
    g.lineTo(x + hw * 0.3, ty + th * 0.9);
    g.lineTo(x - hw * 0.3, ty + th * 0.92);
    g.lineTo(x - hw, ty + th * (0.95 + rnd() * 0.1));
    g.closePath();
    g.fill();
  }
}

function broadleaf(g, rnd, x, top, h, H) {
  g.fillRect(x - h * 0.02, top + h * 0.4, h * 0.04, H * 2);
  const n = 7 + (rnd() * 6 | 0);
  for (let i = 0; i < n; i++) {
    const r = h * (0.1 + rnd() * 0.12);
    g.beginPath();
    g.arc(x + (rnd() - 0.5) * h * 0.4, top + r + rnd() * h * 0.35, r, 0, TAU);
    g.fill();
  }
}

function tallTrunk(g, rnd, x, top, h, H) {
  const w = h * (0.025 + rnd() * 0.02);
  g.beginPath();
  g.moveTo(x - w * 0.35, top);
  g.lineTo(x + w * 0.35, top);
  g.lineTo(x + w * 0.5, H * 2);
  g.lineTo(x - w * 0.5, H * 2);
  g.fill();
  const n = 4 + (rnd() * 4 | 0);
  for (let i = 0; i < n; i++) {
    const r = h * (0.05 + rnd() * 0.07);
    g.beginPath();
    g.arc(x + (rnd() - 0.5) * h * 0.22, top + rnd() * h * 0.25, r, 0, TAU);
    g.fill();
  }
}

const TREES = { c: conifer, d: broadleaf, t: tallTrunk };

function layerItems(cfg, rnd, tw, H) {
  const items = [];
  if (cfg.trunks) {
    const n = Math.max(1, Math.round(tw / cfg.gap));
    for (let i = 0; i < n; i++) items.push({ k: 'trunk', x: (i + rnd() * 0.7) * tw / n, w: 22 + rnd() * 60, f: 0.8 + rnd() * 0.4 });
  } else if (cfg.ground) {
    for (let x = 0; x < tw; x += 2 + rnd() * 3) items.push({ k: 'grass', x, h: H * (0.04 + rnd() * rnd() * 0.12), lean: (rnd() - 0.5) * 18, f: 0.75 + rnd() * 0.6 });
    for (let i = 0; i < tw / 60; i++) items.push({ k: 'bush', x: rnd() * tw, r: H * (0.03 + rnd() * 0.05), f: 0.8 + rnd() * 0.4 });
  } else {
    const n = Math.round(tw / cfg.gap);
    for (let i = 0; i < n; i++) {
      items.push({
        k: cfg.kinds[rnd() * cfg.kinds.length | 0],
        x: rnd() * tw,
        top: H * (cfg.top[0] + rnd() * (cfg.top[1] - cfg.top[0])),
        h: H * (cfg.h[0] + rnd() * (cfg.h[1] - cfg.h[0])),
        f: 0.85 + rnd() * 0.3,
        seed: rnd() * 1e9 | 0,
      });
    }
    items.sort((a, b) => a.top - b.top);
  }
  return items;
}

function paintLayer(g, cfg, rnd, tw) {
  const H = state.height;
  const items = layerItems(cfg, rnd, tw, H);
  if (cfg.fill) {
    g.fillStyle = shade(cfg.col, cfg.ground ? 0.8 : 1);
    g.fillRect(-tw, H * cfg.fill, tw * 3, H);
  }
  for (const it of items) {
    for (const ox of [-tw, 0, tw]) {
      const x = it.x + ox;
      g.fillStyle = shade(cfg.col, it.f);
      if (TREES[it.k]) {
        TREES[it.k](g, seeded(it.seed || 1), x, it.top, it.h, H);
      } else if (it.k === 'trunk') {
        g.fillRect(x - it.w / 2, -10, it.w, H + 20);
        g.fillStyle = shade(cfg.col, it.f * 1.6);
        g.fillRect(x - it.w / 2, -10, it.w * 0.18, H + 20);
      } else if (it.k === 'grass') {
        const base = H * cfg.fill + 4;
        g.strokeStyle = shade(cfg.col, it.f);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, base);
        g.quadraticCurveTo(x + it.lean * 0.3, base - it.h * 0.6, x + it.lean, base - it.h);
        g.stroke();
      } else if (it.k === 'bush') {
        g.beginPath();
        g.arc(x, H * cfg.fill + it.r * 0.4, it.r, 0, TAU);
        g.fill();
      }
    }
  }
}

function buildForest() {
  const { width: W, height: H } = state;
  layers = LAYERS.map((cfg, i) => {
    const tw = Math.ceil(W * 1.4) + 200, pad = Math.ceil(cfg.blur * 3);
    const tmp = canvas(tw + pad * 2, H);
    const tg = tmp.getContext('2d');
    tg.translate(pad, 0);
    paintLayer(tg, cfg, seeded(1234 + i * 77), tw);

    const main = canvas(tw, H);
    const mg = main.getContext('2d');
    mg.filter = `blur(${cfg.blur}px)`;
    mg.drawImage(tmp, -pad, 0);

    const view = canvas(Math.ceil(tw * VIEW_SCALE), Math.ceil(H * VIEW_SCALE));
    const vg = view.getContext('2d');
    vg.filter = 'blur(1.5px)';
    vg.drawImage(tmp, pad, 0, tw, H, 0, 0, view.width, view.height);

    return { cfg, main, view, tw, off: Math.random() * tw };
  });
}

export function resizeScene() {
  const { width: W, height: H } = state;
  background.width = W; background.height = H;
  blurred.width = Math.ceil(W / 10); blurred.height = Math.ceil(H / 10);
  curtain.width = Math.ceil(W / 2); curtain.height = Math.ceil(H / 2);
  ct.setTransform(0.5, 0, 0, 0.5, 0, 0);
  refraction.width = Math.ceil(W * VIEW_SCALE); refraction.height = Math.ceil(H * VIEW_SCALE);
  rf.setTransform(VIEW_SCALE, 0, 0, VIEW_SCALE, 0, 0);
  const skyStops = [[0, '#a3b1ad'], [0.3, '#c6d0cc'], [0.55, '#b7c3be'], [1, '#8e9c93']];
  const hazeStops = [[0, '#cdd6d2'], [0.6, '#bcc8c2'], [1, '#a9b6ae']];
  sky = { bg: gradient(bg, skyStops), rf: gradient(rf, skyStops) };
  haze = { bg: gradient(bg, hazeStops), rf: gradient(rf, hazeStops) };
  buildForest();
}

export function drive(dt) {
  speedTimer -= dt;
  if (speedTimer <= 0) {
    speedTimer = 8 + Math.random() * 18;
    speedTarget = Math.random() < 0.15 ? 0 : 0.25 + Math.random() * 0.75;
  }
  state.speed += (speedTarget - state.speed) * Math.min(1, dt * 0.35);
  for (const L of layers) L.off = (L.off + state.speed * L.cfg.v * DRIVE_PACE * dt) % L.tw;
}

function drawCurtain(dt) {
  const { width: W, height: H, rain, storm, speed, gust } = state;
  const want = Math.round((rain * 50 + storm * 520) * W / 1000);
  while (streaks.length < want) streaks.push({ x: Math.random() * W * 1.4, y: Math.random() * H, near: Math.random() < 0.3, k: Math.random() });
  if (streaks.length > want) streaks.length = want;
  const slant = 0.12 + speed * 0.25 + gust * 0.55;
  ct.clearRect(0, 0, W, H);
  for (const near of [false, true]) {
    ct.beginPath();
    for (const s of streaks) {
      if (s.near !== near) continue;
      const v = (near ? 1500 : 900) * (0.8 + s.k * 0.4), len = (near ? 70 : 35) * (0.7 + s.k * 0.6);
      s.y += v * dt;
      s.x -= v * slant * dt;
      if (s.y > H + len || s.x < -len) { s.y = -Math.random() * 80; s.x = Math.random() * W * 1.4; }
      ct.moveTo(s.x, s.y);
      ct.lineTo(s.x + slant * len, s.y - len);
    }
    ct.strokeStyle = near ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)';
    ct.lineWidth = near ? 2.2 : 1.3;
    ct.stroke();
  }
}

export function drawScene(dt) {
  const { width: W, height: H } = state;
  bg.fillStyle = sky.bg; bg.fillRect(0, 0, W, H);
  rf.fillStyle = sky.rf; rf.fillRect(0, 0, W, H);
  for (const L of layers) {
    for (let x = -L.off; x < W; x += L.tw) {
      bg.drawImage(L.main, x, 0, L.tw, H);
      rf.drawImage(L.view, x, 0, L.tw, H);
    }
    if (L.cfg.fog) {
      bg.globalAlpha = rf.globalAlpha = L.cfg.fog;
      bg.fillStyle = haze.bg; bg.fillRect(0, 0, W, H);
      rf.fillStyle = haze.rf; rf.fillRect(0, 0, W, H);
      bg.globalAlpha = rf.globalAlpha = 1;
    }
  }
  bg.fillStyle = 'rgba(200,212,208,0.08)';
  bg.fillRect(0, 0, W, H);
  bl.drawImage(background, 0, 0, blurred.width, blurred.height);
  drawCurtain(dt);
}
