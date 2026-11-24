// All sound is synthesized: rain, road, drips, thunder, crickets and birds.
import { state, between } from './state.js';

let audio = null;
let levelTimer = 0;

export const soundOn = () => !!(audio && audio.on);

function noise(ac, brown) {
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w;
  }
  return buf;
}

function reverb(ac, seconds, decay) {
  const len = ac.sampleRate * seconds, buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function start() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  master.gain.setTargetAtTime(state.volume, ac.currentTime, 1);

  const white = noise(ac, false), brown = noise(ac, true);
  const loop = buf => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const filter = (type, f) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; return n; };

  const rain = ac.createGain(); rain.gain.value = 0.05;
  loop(white).connect(filter('highpass', 500)).connect(filter('lowpass', 2600)).connect(rain).connect(master);
  const road = ac.createGain(); road.gain.value = 0.2;
  loop(brown).connect(filter('lowpass', 160)).connect(road).connect(master);

  const nature = ac.createGain(); nature.gain.value = state.nature * 0.9;
  const verb = ac.createConvolver(); verb.buffer = reverb(ac, 2.5, 3);
  const wet = ac.createGain(); wet.gain.value = 0.35;
  nature.connect(master);
  nature.connect(verb).connect(wet).connect(master);

  const crickets = Array.from({ length: 3 }, () => ({
    f: between(3800, 5200), pan: between(-0.8, 0.8), gain: between(0.05, 0.09),
    pulses: 2 + (Math.random() * 3 | 0), rate: between(22, 34), gap: between(0.45, 1.1),
    next: ac.currentTime + between(0.5, 4), on: true, flip: between(6, 20),
  }));
  const songs = ['whistle', 'trill', 'chirps', 'warble'];
  const birds = songs.map(song => ({
    song, f: between(2300, 4200), pan: between(-0.9, 0.9), dist: between(0.2, 1),
    notes: 2 + (Math.random() * 3 | 0), next: ac.currentTime + between(2, 12),
  }));

  audio = { ac, master, rain, road, nature, white, brown, crickets, birds, on: true };
  setInterval(scheduleNature, 250);
}

export function toggleSound() {
  if (!audio) return start();
  audio.on = !audio.on;
  if (audio.on) audio.ac.resume();
  audio.master.gain.setTargetAtTime(audio.on ? state.volume : 0, audio.ac.currentTime, 0.4);
}

export function applyVolume() {
  if (!audio) { if (state.volume > 0) start(); return; }
  if (!audio.on && state.volume > 0) { audio.on = true; audio.ac.resume(); }
  audio.master.gain.setTargetAtTime(audio.on ? state.volume : 0, audio.ac.currentTime, 0.15);
}

export function applyNatureVolume() {
  if (!audio) { if (state.nature > 0) start(); return; }
  audio.nature.gain.setTargetAtTime(state.nature * 0.9, audio.ac.currentTime, 0.3);
}

function drip() {
  const { ac } = audio, t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = audio.white;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = 1400 + Math.random() * 4200;
  bp.Q.value = 3 + Math.random() * 7;
  const g = ac.createGain(), v = 0.015 + Math.random() * 0.07;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.07);
  s.connect(bp).connect(g).connect(audio.master);
  s.start(t, Math.random() * 3, 0.15);
}

export function updateAudio(dt) {
  if (!soundOn()) return;
  const { rain, storm, speed } = state;
  if (Math.random() < rain * (9 + 14 * storm) * dt) drip();
  levelTimer -= dt;
  if (levelTimer <= 0) {
    levelTimer = 0.5;
    const t = audio.ac.currentTime;
    audio.rain.gain.setTargetAtTime(0.015 + 0.04 * rain + 0.06 * storm, t, 0.6);
    audio.road.gain.setTargetAtTime(0.04 + 0.32 * speed, t, 1.2);
  }
}

export function thunder(delay, power) {
  if (!soundOn()) return;
  const { ac } = audio, t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = audio.brown; s.playbackRate.value = 0.55;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900 * power + 200, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 3.5);
  const g = ac.createGain(), len = 3.5 + Math.random() * 3;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.9 * power, t + 0.08 + (1 - power) * 0.5);
  for (let k = 1; k < 6; k++) g.gain.linearRampToValueAtTime(power * (0.3 + Math.random() * 0.6) * (1 - k / 7), t + k * len / 7);
  g.gain.linearRampToValueAtTime(0, t + len);
  s.connect(lp).connect(g).connect(audio.master);
  s.start(t, Math.random() * 2, len + 0.1);
}

function place(pan, dist) {
  const { ac } = audio, g = ac.createGain();
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 - dist * 5500;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  g.connect(lp).connect(p).connect(audio.nature);
  return g;
}

function tone(dest, t, dur, f1, f2, amp, vibrato = 0) {
  const { ac } = audio, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  if (vibrato) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = between(25, 45); lg.gain.value = vibrato;
    l.connect(lg).connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + Math.min(0.02, dur * 0.25));
  g.gain.setValueAtTime(amp, t + dur * 0.6);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function chirp(c, t) {
  const { ac } = audio, o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
  const level = c.gain * (1 - state.storm);
  o.frequency.value = c.f; p.pan.value = c.pan;
  g.gain.setValueAtTime(0, t);
  for (let k = 0; k < c.pulses; k++) {
    const s = t + k / c.rate;
    g.gain.linearRampToValueAtTime(level, s + 0.004);
    g.gain.setValueAtTime(level, s + 0.014);
    g.gain.linearRampToValueAtTime(0, s + 0.022);
  }
  o.connect(g).connect(p).connect(audio.nature);
  o.start(t); o.stop(t + c.pulses / c.rate + 0.05);
}

function sing(b, t) {
  const amp = 0.2 * (1.15 - b.dist), v = place(b.pan, b.dist);
  if (b.song === 'whistle') {
    let f = b.f;
    for (let i = 0; i < b.notes; i++) {
      const d = between(0.22, 0.36);
      tone(v, t, d, f, f * between(0.82, 0.95), amp, 18);
      t += d + between(0.06, 0.14);
      f *= between(0.84, 0.97);
    }
  } else if (b.song === 'trill') {
    let f = b.f * 1.15;
    for (let i = 0; i < 6 + b.notes * 2; i++) { tone(v, t, 0.04, f, f * 1.25, amp * 0.8); t += 0.066; f *= 0.985; }
  } else if (b.song === 'chirps') {
    for (let i = 0; i < b.notes; i++) { tone(v, t, 0.07, b.f * 1.6, b.f * 0.8, amp); t += between(0.13, 0.2); }
  } else {
    let f = b.f;
    for (let i = 0; i < 10 + b.notes * 3; i++) {
      const f2 = Math.min(6000, Math.max(1800, f * between(0.8, 1.25)));
      tone(v, t, 0.06, f, f2, amp * between(0.5, 1), 40);
      t += 0.062;
      f = f2;
    }
  }
}

function scheduleNature() {
  const now = audio.ac.currentTime, ahead = now + 1;
  for (const c of audio.crickets) {
    if (c.next < now) c.next = now + 0.1;
    while (c.next < ahead) {
      c.flip -= c.gap;
      if (c.flip <= 0) { c.on = !c.on; c.flip = c.on ? between(6, 25) : between(3, 15); }
      if (c.on) chirp(c, c.next);
      c.next += c.gap * between(0.95, 1.05);
    }
  }
  const hush = Math.max(0.15, 1.2 - state.rain * 0.55);
  for (const b of audio.birds) {
    if (b.next < now) b.next = now + between(0.5, 3);
    if (b.next < ahead) {
      sing(b, b.next);
      b.next += between(4, 16) / hush;
      if (Math.random() < 0.1) { b.pan = between(-0.9, 0.9); b.dist = between(0.2, 1); }
    }
  }
}
