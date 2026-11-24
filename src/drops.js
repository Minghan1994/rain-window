// Drop physics: sizes in 3-D (volume ∝ r³), weight against the glass's grip,
// wet paths, pearling trails, wind, merging and evaporation.
import { state, TAU } from './state.js';
import { SIZE_UNIT as K, BASE_RADIUS, MAX_DROPS, PHYSICS as P, byRain } from './config.js';
import { mistDot, mistRadius, fadeMist, wipeMist } from './water.js';

const WET_CELL = 6, WET_MEMORY = 40, GRID_CELL = 64;

export const drops = [];
let maxRadius = BASE_RADIUS;
let spawnAcc = 0, mistAcc = 0;
let wetTime = new Float32Array(0), wetW = 0, wetH = 0, now = 0;

export function updateSizeCap() {
  maxRadius = byRain('maxRadius', state.rain);
}

export function resetDrops() {
  const { width: W, height: H } = state;
  updateSizeCap();
  drops.length = 0;
  wetW = Math.ceil(W / WET_CELL);
  wetH = Math.ceil(H / WET_CELL);
  wetTime = new Float32Array(wetW * wetH).fill(-1e6);
  for (let i = 0; i < W * H / 9000; i++) spawnDrop(Math.random() * W, Math.random() * H);
}

export function spawnDrop(x, y, r) {
  if (drops.length > MAX_DROPS) return null;
  if (r === undefined) {
    const u = Math.random();
    r = u < 0.72 ? 1.4 + Math.random() * 1.3 : u < 0.95 ? 2.7 + Math.random() * 2 : 4.6 + Math.random() * 2;
    r = Math.min(maxRadius, r * K * maxRadius / BASE_RADIUS);
  }
  const grip = 2.5 + Math.random() * 1.8;
  const d = {
    x, y, r, vx: 0, vy: 0, moving: false, dead: false, parent: null,
    gripStatic: grip * grip, grip: 0, gripTimer: 0, still: 0,
    phase: Math.random() * TAU, wavelength: 50 + Math.random() * 110, sway: 0.2 + Math.random() * 0.3,
    trail: 0, nextTrail: 10, dry: 0,
    splat: 0, splatTime: 0, stretch: 0, stretchAngle: 0, wobble: 0, smear: 0, smearAngle: 0,
  };
  drops.push(d);
  return d;
}

// A raindrop landing: its splash grows with its mass and, in a storm, with the wind.
export function impact(d) {
  const { storm, speed, gust } = state;
  const u = d.r / K, energy = u * u * u * (1 + 1.2 * storm);
  d.splat = Math.min(1.1, 0.25 + 0.03 * energy);
  const reach = d.r * (1.6 + Math.min(4, 0.25 * energy));
  const lean = -(0.3 * speed + gust) * 0.6;
  const specks = Math.min(40, Math.round(energy * 0.25));
  for (let i = 0; i < specks; i++) {
    const a = Math.random() * TAU, dist = reach * (0.5 + Math.pow(Math.random(), 0.6) * 0.8);
    mistDot(d.x + (Math.cos(a) * 1.25 + lean) * dist, d.y + Math.sin(a) * 0.85 * dist,
      0.7 + Math.random() * Math.min(2.2, 0.6 + 0.02 * energy));
  }
  const flung = energy > 40 ? Math.min(5, Math.round(energy / 45 + Math.random() * 1.5)) : 0;
  for (let i = 0; i < flung; i++) {
    const a = Math.random() * TAU, dist = reach * (0.6 + Math.random() * 0.6);
    const f = spawnDrop(d.x + (Math.cos(a) * 1.3 + lean) * dist, d.y + Math.sin(a) * 0.8 * dist, d.r * (0.18 + Math.random() * 0.2));
    if (f) { f.parent = d; f.splat = 0.6; }
    d.r = Math.cbrt(Math.max(1, d.r ** 3 * 0.97));
  }
}

function merge(a, b) {
  const Va = a.r ** 3, Vb = b.r ** 3, V = Va + Vb, share = Vb / V, before = a.r;
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  a.x = (a.x * Va + b.x * Vb) / V;
  a.y = (a.y * Va + b.y * Vb) / V;
  a.r = Math.min(maxRadius, Math.cbrt(V));
  const stretch = Math.min(1.4, ((dist + before + b.r) / (2 * a.r) - 1) / 0.7);
  if (stretch > a.stretch) { a.stretch = stretch; a.stretchAngle = Math.atan2(dy, dx); a.wobble = 0; }
  if (a.moving || b.moving) {
    a.vx = (a.vx * Va + b.vx * Vb) / V + dx * 5 * share;
    a.vy = (a.vy * Va + b.vy * Vb) / V + 20 + 60 * share;
    a.moving = true; a.still = 0; a.gripTimer = 0;
  }
  b.dead = true;
}

function wetAt(x, y) {
  const cx = x / WET_CELL | 0, cy = y / WET_CELL | 0;
  if (cx < 0 || cy < 0 || cx >= wetW || cy >= wetH) return 0;
  return Math.exp(-(now - wetTime[cy * wetW + cx]) / WET_MEMORY);
}

function markWet(x, y, r) {
  const x0 = Math.max(0, (x - r) / WET_CELL | 0), x1 = Math.min(wetW - 1, (x + r) / WET_CELL | 0);
  const y0 = Math.max(0, (y - r) / WET_CELL | 0), y1 = Math.min(wetH - 1, (y + r) / WET_CELL | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) wetTime[cy * wetW + cx] = now;
}

function rainFall(dt, rain) {
  const { width: W, height: H, storm } = state;
  const boost = 1 + 1.8 * storm;
  mistAcc += rain * boost * W * H / 1500 * dt;
  while (mistAcc > 1) { mistAcc--; mistDot(Math.random() * W, Math.random() * H, mistRadius()); }
  spawnAcc += rain * boost * W * H / 42000 * dt;
  while (spawnAcc > 1) {
    spawnAcc--;
    const d = spawnDrop(Math.random() * W, Math.random() * H * 1.05 - H * 0.05);
    if (d) impact(d);
  }
}

function shedTrail(d, speed, braking, env) {
  d.trail = 0;
  d.nextTrail = -Math.log(1 - Math.random()) * d.r * 2.4 / (1 + (speed - P.pearlSpeed) / 60) / env.trailRate;
  let k = env.trailMin + (env.trailMax - env.trailMin) * Math.pow(Math.random(), 1.6);
  if (Math.random() < 0.1) k = env.trailMax * (1 + Math.random() * 0.25);
  if (braking) k *= 1.25;
  const uy = d.vy / speed;
  const side = (Math.random() < 0.5 ? -1 : 1) * d.r * Math.random() * 0.5;
  const count = Math.random() < 0.15 ? 2 + (Math.random() * 3 | 0) : 1;
  for (let i = 0; i < count; i++) {
    const rs = Math.max(1.3, d.r * k * (i ? 0.3 + Math.random() * 0.5 : 1));
    const jx = i ? (Math.random() - 0.5) * d.r * k * 4 : 0, jy = i ? (Math.random() - 0.5) * d.r * k * 4 : 0;
    const bead = spawnDrop(d.x + (Math.random() - 0.5) * d.r * 0.2 - uy * side * 0.3 + jx, d.y - d.r * 0.01 + jy, rs);
    if (!bead) break;
    bead.parent = d;
    bead.smear = speed / 600;
    bead.smearAngle = Math.atan2(-d.vx, d.vy);
    bead.dry = Math.random() < env.dryShare ? Math.random() * Math.random() * 1.6 : 0;
    d.r = Math.cbrt(Math.max(1, d.r ** 3 - rs ** 3));
  }
}

function stepDrop(d, dt, rain, env) {
  const { width: W, height: H, storm, speed, gust } = state;
  if (d.stretch > 0.01) { d.stretch *= Math.exp(-dt * 1.3); d.wobble += dt * 9; } else d.stretch = 0;
  if (d.splat > 0.02) { d.splat *= Math.exp(-dt * 3); d.splatTime += dt; } else d.splat = 0;
  if (d.smear > 0.02) d.smear *= Math.exp(-dt * 15); else d.smear = 0;

  d.r -= dt * (P.evaporation / d.r + d.dry * env.drySpeed);
  if (d.r < 1.2) { d.dead = true; return; }

  const u = d.r / K, u2 = u * u;
  const wet = wetAt(d.x, d.y + d.r);
  // Tiny drops sit in the still air against the glass; big ones stick out into the wind.
  const wind = speed + 0.5 * gust;
  const ax = -Math.min(P.wind * wind * wind * u2, 1.2 * P.gravity * u);
  const ay = P.gravity * u;

  if (!d.moving) {
    d.r = Math.min(maxRadius, d.r + dt * 0.05 * K * rain * Math.random());
    if (Math.hypot(1, ax / ay) * u2 > d.gripStatic * (1 - 0.5 * wet)) {
      d.moving = true; d.vy = 4; d.still = 0; d.gripTimer = 0;
    }
    return;
  }

  d.gripTimer -= dt;
  if (d.gripTimer <= 0) {
    d.gripTimer = 0.06 + Math.random() * 0.3;
    d.grip = d.gripStatic * (0.2 + Math.random() * 0.95);
    if (Math.random() < 0.08) { d.wavelength = 50 + Math.random() * 110; d.sway = 0.2 + Math.random() * 0.3; }
  }
  const pin = d.grip * (1 - 0.6 * wet) * (1 - 0.35 * storm);

  const heavy = Math.min(1, Math.max(0, (d.r - 0.3 * BASE_RADIUS) / (0.45 * BASE_RADIUS)));
  const look = d.r * 1.6, ahead = d.y + d.r * 1.4;
  const steer = (wetAt(d.x + look, ahead) - wetAt(d.x - look, ahead)) * Math.max(30, d.vy) * 1.3 * (1 - 0.7 * heavy);
  const side = d.sway * Math.sin(d.phase) * (1 - 0.92 * heavy);

  const speed0 = Math.hypot(d.vx, d.vy), push = Math.hypot(ax, ay);
  const fx = speed0 > 1 ? d.vx / speed0 : ax / push, fy = speed0 > 1 ? d.vy / speed0 : ay / push;
  const grip = Math.min(P.gravity * u * pin / u2, P.gravity * u * 2.5);
  const wander = 1.5 * (d.vy * side + steer - d.vx);
  let vx = d.vx + (ax - grip * fx - P.drag * d.vx + wander) * dt;
  let vy = d.vy + (ay - grip * fy - P.drag * d.vy) * dt;
  if (vx * fx + vy * fy <= 0 && grip > push) vx = vy = 0;
  d.vx = vx;
  d.vy = Math.max(-10, vy);

  if (Math.hypot(d.vx, d.vy) < 2) {
    d.still += dt;
    if (d.still > 0.5) {
      d.moving = false; d.vx = d.vy = 0;
      d.gripStatic = Math.max(d.gripStatic, u2 * (1.1 + Math.random() * 0.2));
      return;
    }
  } else d.still = 0;

  d.x += d.vx * dt;
  d.y += d.vy * dt;
  const speedNow = Math.hypot(d.vx, d.vy) || 1, step = speedNow * dt;
  d.phase += step / d.wavelength * TAU;
  if (speedNow > P.pearlSpeed) d.trail += step;
  if (d.trail > d.nextTrail) shedTrail(d, speedNow, push < grip, env);

  markWet(d.x, d.y, d.r * 0.8);
  wipeMist(d.x, d.y, d.r * 0.55, d.r * 0.8, Math.atan2(-d.vx, d.vy));
  if (d.y - d.r * 2 > H || d.x < -d.r * 2 || d.x > W + d.r * 2) d.dead = true;
}

function mergeDrops() {
  const grid = new Map();
  for (const d of drops) {
    if (d.dead) continue;
    const cx = Math.floor(d.x / GRID_CELL), cy = Math.floor(d.y / GRID_CELL);
    let me = d;
    search:
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const list = grid.get(gx * 100003 + gy);
        if (!list) continue;
        for (const o of list) {
          if (o.dead || o.parent === me || me.parent === o || (o.parent && o.parent === me.parent)) continue;
          const dx = o.x - me.x, dy = o.y - me.y, reach = (o.r + me.r) * P.mergeReach;
          if (dx * dx + dy * dy < reach * reach) {
            if (o.r >= me.r) { merge(o, me); me = null; } else merge(me, o);
            break search;
          }
        }
      }
    }
    if (me) {
      const key = Math.floor(me.x / GRID_CELL) * 100003 + Math.floor(me.y / GRID_CELL);
      let list = grid.get(key);
      if (!list) grid.set(key, list = []);
      list.push(me);
    }
  }
}

export function updateDrops(dt) {
  now = performance.now() / 1000;
  const amount = state.rain;
  const rain = amount * (0.75 + 0.25 * Math.sin(now / 23));
  rainFall(dt, rain);
  fadeMist(dt);
  const env = {
    trailMin: byRain('trailMin', amount), trailMax: byRain('trailMax', amount),
    trailRate: byRain('trailRate', amount), dryShare: byRain('dryShare', amount), drySpeed: byRain('drySpeed', amount),
  };
  for (const d of drops) if (!d.dead) stepDrop(d, dt, rain, env);
  mergeDrops();
  let kept = 0;
  for (const d of drops) if (!d.dead) drops[kept++] = d;
  drops.length = kept;
}
