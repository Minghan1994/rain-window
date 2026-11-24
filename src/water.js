// The water map: every drop and droplet stamped into one canvas for the shader.
// R/G hold the surface tilt, B the thickness, alpha a soft falloff that lets drops merge.
import { state, canvas, TAU } from './state.js';
import { SIZE_UNIT } from './config.js';

const VISIBLE = 0.34;
const STAMP = 96, STAMP_COUNT = 16;

export const mist = canvas();
export const water = canvas();
const mc = mist.getContext('2d');
const wc = water.getContext('2d');

// Same profile as codrops' drop-alpha.png: a gaussian with a sharp top edge.
const stamps = Array.from({ length: STAMP_COUNT }, (_, i) => {
  const c = canvas(STAMP, STAMP), g = c.getContext('2d');
  const img = g.createImageData(STAMP, STAMP), p = img.data;
  const thickness = 0.15 + 0.85 * i / (STAMP_COUNT - 1), h = STAMP / 2;
  for (let y = 0; y < STAMP; y++) {
    for (let x = 0; x < STAMP; x++) {
      const nx = (x + 0.5) / h - 1, ny = (y + 0.5) / h - 1, k = (y * STAMP + x) * 4;
      const top = ny < -0.47 ? Math.max(0, 1 - (-0.47 - ny) / 0.15) : 1;
      const alpha = Math.exp(-(nx * nx + ny * ny) / (2 * 0.288 * 0.288)) * top;
      if (alpha < 0.004) continue;
      const tx = Math.max(-1, Math.min(1, nx / VISIBLE)), ty = Math.max(-1, Math.min(1, ny / VISIBLE));
      p[k] = (0.5 - ty * 0.5) * 255;
      p[k + 1] = (0.5 - tx * 0.5) * 255;
      p[k + 2] = thickness * 255;
      p[k + 3] = alpha * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
});

const stampFor = r => stamps[Math.min(STAMP_COUNT - 1, r / (6 * SIZE_UNIT) * STAMP_COUNT | 0)];

export const mistRadius = () => 0.7 + Math.random() * Math.random() * 1.8;

export function mistDot(x, y, r) {
  const s = r / VISIBLE;
  mc.drawImage(stamps[0], x - s, y - s * 1.1, s * 2, s * 2.2);
}

export function resizeWater() {
  const { width: W, height: H } = state;
  mist.width = W; mist.height = H;
  water.width = W; water.height = H;
  for (let i = 0; i < W * H / 110; i++) mistDot(Math.random() * W, Math.random() * H, mistRadius());
}

export function fadeMist(dt) {
  mc.globalCompositeOperation = 'destination-out';
  mc.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.04)})`;
  mc.fillRect(0, 0, state.width, state.height);
  mc.globalCompositeOperation = 'source-over';
}

export function wipeMist(x, y, rx, ry, angle) {
  mc.globalCompositeOperation = 'destination-out';
  mc.fillStyle = '#000';
  mc.beginPath();
  mc.ellipse(x, y, rx, ry, angle, 0, TAU);
  mc.fill();
  mc.globalCompositeOperation = 'source-over';
}

function dropShape(d) {
  const speed = d.moving ? Math.hypot(d.vx, d.vy) : 0, st = Math.min(0.5, speed / 350);
  const stretch = d.stretch * 0.7 * (1 + 0.15 * Math.sin(d.wobble));
  if (d.splat > 0.02) {
    const s = d.splat, o = Math.cos(d.splatTime * 20) * Math.min(1, s) * 0.12;
    return [0, 1 + 0.55 * s + o, 1.5 * (1 + 0.45 * s - o)];
  }
  if (stretch > st) return [d.stretchAngle - Math.PI / 2, 1 / Math.sqrt(1 + stretch), 1 + stretch];
  if (st > 0.02) return [Math.atan2(-d.vx, d.vy), 1 - st * 0.3, 1.5 + st * 0.8];
  if (d.smear > 0.02) return [d.smearAngle, 1, 1.5 * (1 + d.smear)];
  return [0, 1, 1.5];
}

export function drawWater(drops) {
  wc.setTransform(1, 0, 0, 1, 0, 0);
  wc.clearRect(0, 0, state.width, state.height);
  wc.drawImage(mist, 0, 0);
  for (const d of drops) {
    const [angle, sx, sy] = dropShape(d);
    const s = d.r / VISIBLE, c = Math.cos(angle), n = Math.sin(angle);
    wc.setTransform(c * sx, n * sx, -n * sy, c * sy, d.x, d.y);
    wc.drawImage(stampFor(d.r), -s, -s, s * 2, s * 2);
  }
  wc.setTransform(1, 0, 0, 1, 0, 0);
}
