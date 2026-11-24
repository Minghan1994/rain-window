// Road spray on the outside of the glass: it builds up (faster when driving, heavier
// low on the window) and drops on the same side sweep it away.
import { state, canvas } from './state.js';

const SCALE = 0.25, REGROW_SECONDS = 10;

export const spray = canvas();
const sc = spray.getContext('2d');

const brush = (() => {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.9)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
})();

function fillDown(top, bottom) {
  const g = sc.createLinearGradient(0, 0, 0, state.height);
  g.addColorStop(0, `rgba(255,255,255,${top})`);
  g.addColorStop(1, `rgba(255,255,255,${bottom})`);
  sc.fillStyle = g;
  sc.fillRect(0, 0, state.width, state.height);
}

export function resizeSpray() {
  spray.width = Math.ceil(state.width * SCALE);
  spray.height = Math.ceil(state.height * SCALE);
  sc.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  fillDown(0.45, 0.95);
}

export function updateSpray(dt, drops) {
  const a = Math.min(1, dt / REGROW_SECONDS * (0.3 + 1.1 * state.speed));
  fillDown(a * 0.3, a);
  sc.globalCompositeOperation = 'destination-out';
  for (const d of drops) {
    if (d.r < 2) continue;
    const e = d.r * (d.moving ? 0.95 : 1);
    sc.globalAlpha = d.moving ? 1 : 0.2;
    sc.drawImage(brush, d.x - e, d.y - e * 1.3, e * 2, e * 2.6);
  }
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = 'source-over';
}
