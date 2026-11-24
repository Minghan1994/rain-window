// The control island (presets and dot meters), keyboard shortcuts, and saved settings.
import { state } from './state.js';
import { PRESETS, RAIN_MAX } from './config.js';
import { toggleSound, applyVolume, applyNatureVolume, soundOn } from './audio.js';

const DOTS = 16;
const IDLE_MS = 3000;

const island = document.getElementById('island');
const head = document.getElementById('islandHead');
const presetsEl = island.querySelector('.presets');

const save = (key, v) => { try { localStorage.setItem(key, v); } catch (e) {} };
const load = key => { try { return parseFloat(localStorage.getItem(key)); } catch (e) { return NaN; } };

const weatherOf = rain => rain < 0.5 ? PRESETS[0] : rain < 1 ? PRESETS[1] : rain < 1.8 ? PRESETS[2] : PRESETS[3];

function weatherIcon(kind, size) {
  const cloud = '<path d="M7.5 17.5h9.2a3.8 3.8 0 0 0 .4-7.6 5.6 5.6 0 0 0-10.8 1.1A3.3 3.3 0 0 0 7.5 17.5z" fill="currentColor"/>';
  const line = 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"';
  const below = {
    mist: `<path d="M5 20.3h9.5M8.5 23h9.5" ${line}/>`,
    drizzle: '<circle cx="9.5" cy="20.6" r="1" fill="currentColor"/><circle cx="14.5" cy="21.8" r="1" fill="currentColor"/>',
    rain: `<path d="M9.2 19.6l-1 2.6M12.7 19.6l-1 2.6M16.2 19.6l-1 2.6" ${line}/>`,
    storm: `<path d="M13 18.6l-2.3 2.8h2.5l-1.7 2.6" ${line} stroke-linejoin="round"/><path d="M8.6 19.6l-.9 2.2M17.2 19.6l-.9 2.2" ${line}/>`,
  }[kind];
  return `<svg viewBox="2 4.5 20 20.5" width="${size}" height="${size}" aria-hidden="true">${cloud}${below}</svg>`;
}

const speakerIcon = on => `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/>${on
  ? '<path d="M15.3 9.2a4 4 0 0 1 0 5.6M17.8 6.8a7.5 7.5 0 0 1 0 10.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
  : '<path d="M16 9.8l4.4 4.4M20.4 9.8L16 14.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'}</svg>`;

function dotMeter(host, label, max, get, set, withMute) {
  host.innerHTML = `<div class="mh"><span class="ml">${withMute ? '<button class="mute"></button>' : ''}${label}</span><span class="mv"></span></div>
    <div class="dots" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100">${'<i></i>'.repeat(DOTS)}</div>`;
  const dots = host.querySelector('.dots'), cells = [...dots.children], value = host.querySelector('.mv');
  const mute = host.querySelector('.mute');
  const at = x => {
    const r = dots.getBoundingClientRect();
    return Math.max(0, Math.min(1, Math.ceil((x - r.left) / r.width * DOTS) / DOTS));
  };
  let dragging = false;
  dots.addEventListener('pointerdown', e => {
    dragging = true;
    dots.setPointerCapture(e.pointerId);
    let f = at(e.clientX);
    if (f === 1 / DOTS && Math.round(get() / max * DOTS) === 1) f = 0;
    set(f * max);
  });
  dots.addEventListener('pointermove', e => { if (dragging) set(at(e.clientX) * max); });
  for (const ev of ['pointerup', 'pointercancel']) dots.addEventListener(ev, () => { dragging = false; });
  dots.addEventListener('keydown', e => {
    const step = max / DOTS;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(Math.min(max, get() + step));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(Math.max(0, get() - step));
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  if (mute) mute.addEventListener('click', () => { toggleSound(); refresh(); });

  return () => {
    const f = get() / max, lit = Math.round(f * DOTS);
    cells.forEach((c, i) => c.classList.toggle('on', i < lit));
    value.textContent = Math.round(f * 100) + '%';
    dots.setAttribute('aria-valuenow', Math.round(f * 100));
    if (mute) {
      mute.innerHTML = speakerIcon(soundOn());
      mute.setAttribute('aria-label', soundOn() ? 'Mute' : 'Sound on');
    }
  };
}

function setRain(v) { state.rain = v; save('rain-amount', v); refresh(); }
function setVolume(v) { state.volume = v; save('rain-volume', v); applyVolume(); refresh(); }
function setNature(v) { state.nature = v; save('rain-nature', v); applyNatureVolume(); refresh(); }

let meters = [];

function refresh() {
  const { rain } = state, w = weatherOf(rain);
  head.querySelector('.ico').innerHTML = weatherIcon(w.icon, 22);
  head.querySelector('.name').textContent = rain < 0.05 ? 'Clear' : w.name;
  head.querySelector('.sub').textContent = Math.round(rain / RAIN_MAX * 100) + '%';
  const lit = Math.round(rain / RAIN_MAX * 8);
  head.querySelectorAll('.mini i').forEach((c, i) => c.classList.toggle('on', i < lit));
  presetsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', PRESETS[i] === w && rain >= 0.05));
  meters.forEach(update => update());
}

let idleTimer;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => island.matches(':hover') ? wake() : document.body.classList.add('idle'), IDLE_MS);
}

function setOpen(open) {
  island.classList.toggle('open', open);
  head.setAttribute('aria-expanded', open);
}

export function initUI() {
  for (const [key, field] of [['rain-amount', 'rain'], ['rain-volume', 'volume'], ['rain-nature', 'nature']]) {
    const v = load(key);
    if (!isNaN(v)) state[field] = v;
  }

  presetsEl.innerHTML = PRESETS.map((p, i) =>
    `<button data-i="${i}"><span class="t">${p.name}</span>${weatherIcon(p.icon, 26)}<span class="n">${Math.round(p.rain / RAIN_MAX * 100)}%</span></button>`).join('');
  presetsEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setRain(PRESETS[+b.dataset.i].rain);
  });
  head.querySelector('.mini').innerHTML = '<i></i>'.repeat(8);

  meters = [
    dotMeter(document.getElementById('mRain'), 'Rain', RAIN_MAX, () => state.rain, setRain),
    dotMeter(document.getElementById('mVol'), 'Volume', 1, () => state.volume, setVolume, true),
    dotMeter(document.getElementById('mNature'), 'Birds & insects', 1, () => state.nature, setNature),
  ];
  refresh();

  island.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setOpen(true); });
  island.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') setOpen(false); });
  island.addEventListener('pointerdown', e => e.stopPropagation());
  island.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setOpen(false); head.focus(); }
    e.stopPropagation();
  });
  head.addEventListener('click', () => setOpen(!island.classList.contains('open')));

  addEventListener('mousemove', wake);
  addEventListener('pointerdown', () => { toggleSound(); refresh(); wake(); });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') setRain(Math.min(RAIN_MAX, state.rain + 0.25));
    else if (e.key === 'ArrowDown') setRain(Math.max(0, state.rain - 0.25));
    else if (e.key === 'f' || e.key === 'F') {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    } else if (e.key === 's' || e.key === 'S') { toggleSound(); refresh(); }
    else return;
    wake();
  });
  wake();
}
