export const state = {
  width: 0,
  height: 0,
  dpr: 1,
  rain: 1,
  volume: 0.6,
  nature: 0.5,
  speed: 0.7,
  storm: 0,
  gust: 0,
  flash: 0,
};

export const canvas = (w = 1, h = 1) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const TAU = Math.PI * 2;
export const between = (a, b) => a + Math.random() * (b - a);
