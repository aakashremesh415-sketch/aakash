// Portrait that looks at the cursor: a 2.5D depth warp in WebGL.
//
// One illustration + a hand-built depth map (R = depth, G = iris mask). Each pixel is
// sampled from a position offset by (depth × gaze), so nearer parts (nose, beard) move
// more than farther ones (ears, hair) and the flat background barely moves — the head
// turns smoothly toward any direction, not between a few fixed poses. The irises get an
// extra offset so the eyes lead the head. Falls back to the plain <img> without WebGL.

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D img;
uniform sampler2D depth;
uniform vec2 gaze;     // -1..1, where the face should look
uniform float zoom;    // slight overscan so edges never show
void main() {
  vec2 st = (uv - 0.5) / zoom + 0.5;
  vec4 d = texture2D(depth, st);
  float z = d.r;
  // Head turn: nearer pixels shift more; the pivot (0.3) keeps the torso almost still.
  vec2 shift = gaze * vec2(0.030, 0.022) * (z - 0.3);
  // Eyes: irises shift a little further, so the gaze leads the head.
  shift += gaze * vec2(0.0075, 0.0060) * d.g;
  gl_FragColor = texture2D(img, st - shift);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function texture(gl, unit, image) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return t;
}

/**
 * Mounts the effect on a portrait figure. Returns a controller with setGaze(x, y) (-1..1)
 * or null when WebGL isn't available (the static image then stays as it is).
 */
export async function mountPortrait(figure, { imageSrc, depthSrc }) {
  const holder = figure.querySelector(".portrait__face");
  const fallback = holder && holder.querySelector("img");
  if (!holder || !fallback) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "portrait__canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: false });
  if (!gl) return null;

  const [img, dep] = await Promise.all([loadImage(fallback.currentSrc || imageSrc), loadImage(depthSrc)]);

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  texture(gl, 0, img);
  texture(gl, 1, dep);
  gl.uniform1i(gl.getUniformLocation(prog, "img"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "depth"), 1);
  gl.uniform1f(gl.getUniformLocation(prog, "zoom"), 1.035);
  const uGaze = gl.getUniformLocation(prog, "gaze");

  const resize = () => {
    const r = holder.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(Math.min(r.width * dpr, img.naturalWidth)));
    if (canvas.width !== size) { canvas.width = canvas.height = size; gl.viewport(0, 0, size, size); }
  };

  let gaze = [0, 0];
  let queued = false;
  const draw = () => {
    queued = false;
    resize();
    gl.uniform2f(uGaze, gaze[0], gaze[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

  holder.appendChild(canvas);
  draw();
  figure.classList.add("is-gl");
  new ResizeObserver(request).observe(holder);
  canvas.addEventListener("webglcontextlost", () => figure.classList.remove("is-gl"));

  return {
    setGaze(x, y) { gaze = [x, y]; request(); },
  };
}
