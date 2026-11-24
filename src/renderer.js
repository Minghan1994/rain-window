// WebGL compositing: melts the water map, refracts through it, and lays the
// rain curtain, road spray, storm light and lightning over the view.
import { state } from './state.js';
import { byRain } from './config.js';

const VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

const FRAGMENT = `precision mediump float;
uniform sampler2D uWater, uBackground, uRefraction, uBlurred, uCurtain, uSpray;
uniform vec2 uRes, uSize;
uniform float uTime, uStorm, uFlash, uSprayAmount;

void main() {
  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;

  vec2 sheet = vec2(sin(uv.y * 34.0 - uTime * 4.5 + sin(uv.x * 21.0 + uTime * 0.7) * 1.5) * 0.004
                  + sin(uv.y * 90.0 - uTime * 9.0 + uv.x * 13.0) * 0.0012, 0.0) * uStorm;
  vec3 bg = mix(texture2D(uBackground, uv + sheet).rgb, texture2D(uBlurred, uv + sheet * 2.0).rgb, uStorm * 0.75);
  bg = mix(bg, vec3(0.86, 0.9, 0.93), texture2D(uCurtain, uv + sheet).a * 0.85);
  vec3 sprayed = mix(texture2D(uBlurred, uv).rgb, vec3(0.8, 0.84, 0.82), 0.32);
  bg = mix(bg, sprayed, texture2D(uSpray, uv).a * uSprayAmount);

  vec4 w = texture2D(uWater, uv);
  float water = clamp(w.a * 6.0 - 3.0, 0.0, 1.0);
  vec2 tilt = (vec2(w.g, w.r) - 0.5) * 2.0;
  vec3 seen = texture2D(uRefraction, uv + tilt * (60.0 + w.b * 120.0) / uSize).rgb * 1.12 + 0.07;
  vec3 col = mix(bg, seen, water);

  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - smoothstep(0.35, 0.95, length(q)) * (0.32 + 0.2 * uStorm);
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(grey), 0.35 * uStorm) * mix(vec3(1.0), vec3(0.88, 0.94, 1.08), uStorm);
  col *= 1.0 - 0.28 * uStorm;
  col *= 1.0 + uFlash * 1.3;
  col = mix(col, vec3(0.93, 0.96, 1.0), uFlash * 0.12);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createRenderer(canvas, sources) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

  const uniform = name => gl.getUniformLocation(prog, name);
  const textures = Object.entries(sources).map(([name, image], unit) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniform('u' + name[0].toUpperCase() + name.slice(1)), unit);
    return { tex, image, unit };
  });

  return {
    resize() {
      canvas.width = state.width * state.dpr;
      canvas.height = state.height * state.dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniform('uRes'), canvas.width, canvas.height);
      gl.uniform2f(uniform('uSize'), state.width, state.height);
    },
    draw() {
      gl.uniform1f(uniform('uStorm'), state.storm);
      gl.uniform1f(uniform('uFlash'), state.flash);
      gl.uniform1f(uniform('uSprayAmount'), byRain('spray', state.rain));
      gl.uniform1f(uniform('uTime'), (performance.now() / 1000) % 1000);
      for (const { tex, image, unit } of textures) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
