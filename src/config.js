export const SIZE_UNIT = 3;
export const BASE_RADIUS = 4.6 * SIZE_UNIT;
export const MAX_DROPS = 2600;
export const RAIN_MAX = 2.5;

export const PHYSICS = {
  gravity: 150,
  drag: 3,
  wind: 17,
  pearlSpeed: 35,
  evaporation: 0.35,
  mergeReach: 0.75,
};

export const PRESETS = [
  { name: 'Mist', rain: 0.3, icon: 'mist' },
  { name: 'Drizzle', rain: 0.7, icon: 'drizzle' },
  { name: 'Rain', rain: 1.3, icon: 'rain' },
  { name: 'Storm', rain: 2.5, icon: 'storm' },
];

// Values that follow the rain amount, as [rain amount, value] points.
const BY_RAIN = {
  maxRadius: [[0, 6.5], [0.3, 8], [0.7, 11], [1.3, 14], [2.5, 18]],
  trailMin: [[0, 0.10], [0.3, 0.12], [0.7, 0.18], [1.3, 0.22], [2.5, 0.25]],
  trailMax: [[0, 0.22], [0.3, 0.25], [0.7, 0.30], [1.3, 0.35], [2.5, 0.40]],
  trailRate: [[0, 0.6], [0.3, 0.7], [0.7, 1], [1.3, 1.5], [2.5, 2.5]],
  dryShare: [[0, 0.8], [0.3, 0.7], [0.7, 0.5], [1.3, 0.25], [2.5, 0]],
  drySpeed: [[0, 1.3], [0.3, 1.2], [0.7, 1], [1.3, 0.6], [2.5, 0.2]],
  spray: [[0, 0.35], [0.3, 0.5], [0.7, 0.6], [1.3, 0.7], [2.5, 0.85]],
};

export function byRain(key, rain) {
  const pts = BY_RAIN[key];
  if (rain <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (rain <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (rain - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

export const stormLevel = rain => Math.max(0, Math.min(1, (rain - 1.6) / 0.9));
