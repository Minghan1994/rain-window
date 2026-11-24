// Storm level, wind gusts, gust sprays and lightning.
import { state, TAU } from './state.js';
import { SIZE_UNIT, stormLevel } from './config.js';
import { spawnDrop } from './drops.js';
import { mistDot, mistRadius } from './water.js';
import { thunder } from './audio.js';

let gustTarget = 0, gustTimer = 0, nextFlash = 6, bolts = [];

function sprayBurst() {
  const { width: W, height: H, storm } = state;
  const cx = Math.random() * W, cy = Math.random() * H * 0.8, R = 120 + Math.random() * 200;
  for (let i = 0; i < 40 * storm; i++) {
    const a = Math.random() * TAU, r = R * Math.sqrt(Math.random());
    const d = spawnDrop(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r, SIZE_UNIT * (1 + Math.random() * 2.2));
    if (d) d.splat = 1.2;
  }
  for (let i = 0; i < 400 * storm; i++) {
    const a = Math.random() * TAU, r = R * 1.2 * Math.sqrt(Math.random());
    mistDot(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r, mistRadius());
  }
}

function lightning() {
  const t0 = performance.now() / 1000, near = Math.random();
  bolts = [[t0, 0.9 + near * 0.3]];
  for (let i = 0, t = t0; i < 2 + Math.random() * 4; i++) {
    t += 0.05 + Math.random() * 0.18;
    bolts.push([t, 0.2 + Math.random() * 0.8]);
  }
  thunder(0.6 + (1 - near) * 3, 0.4 + near * 0.6);
}

export function updateWeather(dt) {
  state.storm += (stormLevel(state.rain) - state.storm) * Math.min(1, dt * 0.8);

  gustTimer -= dt;
  if (gustTimer <= 0) {
    gustTimer = 0.8 + Math.random() * 2.5;
    const strong = Math.random() < 0.3;
    gustTarget = state.storm * (strong ? 1.1 + Math.random() * 0.6 : Math.random() * 0.5);
    if (strong && state.storm > 0.5) sprayBurst();
  }
  state.gust += (gustTarget - state.gust) * Math.min(1, dt * 0.9);

  nextFlash -= dt;
  if (nextFlash <= 0) {
    nextFlash = 7 + Math.random() * 16;
    if (state.storm > 0.35) lightning();
  }
  const t = performance.now() / 1000;
  let flash = 0;
  for (const [t0, level] of bolts) if (t >= t0) flash = Math.max(flash, level * Math.exp(-(t - t0) / 0.07));
  state.flash = flash * state.storm;
}
