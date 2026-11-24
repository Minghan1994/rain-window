import { state } from './state.js';
import { createRenderer } from './renderer.js';
import { background, refraction, blurred, curtain, resizeScene, drive, drawScene } from './scene.js';
import { water, resizeWater, drawWater } from './water.js';
import { drops, resetDrops, updateDrops, updateSizeCap } from './drops.js';
import { spray, resizeSpray, updateSpray } from './spray.js';
import { updateWeather } from './weather.js';
import { updateAudio } from './audio.js';
import { initUI } from './ui.js';

const renderer = createRenderer(document.getElementById('glass'), {
  water, background, refraction, blurred, curtain, spray,
});

function resize() {
  state.width = innerWidth;
  state.height = innerHeight;
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize();
  resizeScene();
  resizeSpray();
  resizeWater();
  resetDrops();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  requestAnimationFrame(frame);
  if (innerWidth !== state.width || innerHeight !== state.height) {
    if (innerWidth > 0 && innerHeight > 0) resize();
    return;
  }
  updateWeather(dt);
  updateSizeCap();
  drive(dt);
  drawScene(dt);
  updateDrops(dt);
  updateSpray(dt, drops);
  drawWater(drops);
  renderer.draw();
  updateAudio(dt);
}

initUI();
requestAnimationFrame(frame);
