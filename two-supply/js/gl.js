// Mini moteur 3D WebGL : géométries simples, éclairage, brouillard, transparence.
// Suffisant pour un prototype en formes simples ; le vrai jeu passera sur Godot.

// ---------- matrices 4x4 (colonnes) ----------
export const m4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b, o = new Float32Array(16)) {
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(e, t, u) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1,
    ]);
  },
  // T * Ry * Rx * Rz * S
  compose(o, p, r, s) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]);
    const cy = Math.cos(r[1]), sy = Math.sin(r[1]);
    const cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    // R = Ry*Rx*Rz
    const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
    const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
    const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
    o[0] = r00 * s[0]; o[1] = r10 * s[0]; o[2] = r20 * s[0]; o[3] = 0;
    o[4] = r01 * s[1]; o[5] = r11 * s[1]; o[6] = r21 * s[1]; o[7] = 0;
    o[8] = r02 * s[2]; o[9] = r12 * s[2]; o[10] = r22 * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  },
  // Matrice normale : inverse transposée du bloc 3x3.
  normal3(m, o = new Float32Array(9)) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-9;
    const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
    const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    o[0] = A / det; o[1] = B / det; o[2] = C / det;
    o[3] = D / det; o[4] = E / det; o[5] = F / det;
    o[6] = G / det; o[7] = H / det; o[8] = I / det;
    return o;
  },
  apply(m, x, y, z) {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
      w,
    ];
  },
};

// ---------- géométries (origine au pied de l'objet) ----------
function finalize(pos, nrm, idx) {
  // Oriente chaque triangle selon les normales fournies.
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
    const ux = pos[i1] - pos[i0], uy = pos[i1 + 1] - pos[i0 + 1], uz = pos[i1 + 2] - pos[i0 + 2];
    const vx = pos[i2] - pos[i0], vy = pos[i2 + 1] - pos[i0 + 1], vz = pos[i2 + 2] - pos[i0 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ax = nrm[i0] + nrm[i1] + nrm[i2], ay = nrm[i0 + 1] + nrm[i1 + 1] + nrm[i2 + 1], az = nrm[i0 + 2] + nrm[i1 + 2] + nrm[i2 + 2];
    if (nx * ax + ny * ay + nz * az < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

export function box(w, h, d, y0 = 0) {
  const x = w / 2, z = d / 2, y1 = y0 + h;
  const faces = [
    [[1, 0, 0], [[x, y0, -z], [x, y1, -z], [x, y1, z], [x, y0, z]]],
    [[-1, 0, 0], [[-x, y0, z], [-x, y1, z], [-x, y1, -z], [-x, y0, -z]]],
    [[0, 1, 0], [[-x, y1, -z], [-x, y1, z], [x, y1, z], [x, y1, -z]]],
    [[0, -1, 0], [[-x, y0, z], [-x, y0, -z], [x, y0, -z], [x, y0, z]]],
    [[0, 0, 1], [[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]]],
    [[0, 0, -1], [[x, y0, -z], [-x, y0, -z], [-x, y1, -z], [x, y1, -z]]],
  ];
  const pos = [], nrm = [], idx = [];
  for (const [n, vs] of faces) {
    const b = pos.length / 3;
    for (const v of vs) { pos.push(...v); nrm.push(...n); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return finalize(pos, nrm, idx);
}

export function cylinder(rTop, rBot, h, seg = 16, caps = true, y0 = 0) {
  const pos = [], nrm = [], idx = [];
  const slope = (rBot - rTop) / h;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const l = Math.hypot(1, slope);
    pos.push(c * rBot, y0, s * rBot, c * rTop, y0 + h, s * rTop);
    nrm.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  if (caps) {
    for (const [y, r, ny] of [[y0 + h, rTop, 1], [y0, rBot, -1]]) {
      if (r <= 0) continue;
      const c0 = pos.length / 3;
      pos.push(0, y, 0); nrm.push(0, ny, 0);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nrm.push(0, ny, 0);
      }
      for (let i = 0; i < seg; i++) idx.push(c0, c0 + 1 + i, c0 + 2 + i);
    }
  }
  return finalize(pos, nrm, idx);
}

export function sphere(r, ws = 16, hs = 10, y0 = 0) {
  const pos = [], nrm = [], idx = [];
  for (let j = 0; j <= hs; j++) {
    const v = j / hs, phi = v * Math.PI;
    for (let i = 0; i <= ws; i++) {
      const u = i / ws, th = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      pos.push(x * r, y * r + y0, z * r); nrm.push(x, y, z);
    }
  }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = j * (ws + 1) + i, b = a + ws + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return finalize(pos, nrm, idx);
}

export function plane(w, d) {
  return finalize([-w / 2, 0, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2, w / 2, 0, -d / 2], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
}

export function ring(rIn, rOut, seg = 40, t0 = 0, tl = Math.PI * 2) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = t0 + (i / seg) * tl, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * rIn, 0, s * rIn, c * rOut, 0, s * rOut);
    nrm.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  return finalize(pos, nrm, idx);
}

// Fusionne plusieurs géométries placées (pour les décors nombreux).
export function merge(parts) {
  const pos = [], nrm = [], idx = [];
  for (const { g, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1 } of parts) {
    const b = pos.length / 3, c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i < g.pos.length; i += 3) {
      const px = g.pos[i] * sx, py = g.pos[i + 1] * sy, pz = g.pos[i + 2] * sz;
      pos.push(px * c + pz * s + x, py + y, -px * s + pz * c + z);
      const nx = g.nrm[i], ny = g.nrm[i + 1], nz = g.nrm[i + 2];
      nrm.push(nx * c + nz * s, ny, -nx * s + nz * c);
    }
    for (const k of g.idx) idx.push(k + b);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

// ---------- nœuds ----------
export class Node {
  constructor(mesh = null) {
    this.pos = [0, 0, 0];
    this.rot = [0, 0, 0];
    this.scl = [1, 1, 1];
    this.visible = true;
    this.children = [];
    this.mesh = mesh; // { geo, mat }
    this.world = m4.ident();
    this.local = m4.ident();
  }
  add(...nodes) { for (const n of nodes) this.children.push(n); return this; }
  at(x, y, z) { this.pos = [x, y, z]; return this; }
  rotY(a) { this.rot[1] = a; return this; }
  // Applique une teinte lumineuse à tous les maillages du nœud.
  glow(rgb) {
    const walk = (n) => { if (n.mesh) n.mesh.glow = rgb; n.children.forEach(walk); };
    walk(this);
  }
}

export function mat(color, o = {}) {
  return { color, emissive: o.emissive || [0, 0, 0], opacity: o.opacity ?? 1, stripes: o.stripes || 0, pattern: o.pattern || 0, unlit: o.unlit || 0 };
}

export function mesh(geo, material) { return new Node({ geo, mat: material, glow: null }); }

// ---------- rendu ----------
const VS = `
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNrm;
varying vec3 vN; varying vec3 vW;
void main(){ vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = uNrm * aNrm; gl_Position = uVP * w; }`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vN; varying vec3 vW;
uniform vec3 uColor; uniform vec3 uEmissive; uniform vec3 uLight; uniform vec3 uSky; uniform vec3 uGround;
uniform vec3 uFog; uniform vec3 uCam; uniform vec2 uFogRange;
uniform float uOpacity; uniform float uStripes; uniform float uPattern; uniform float uUnlit;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 base = uColor;
  if (uStripes > 0.5) {
    float s = step(0.5, fract((vW.x + vW.z) * 1.7 + vW.y * 1.7));
    base = mix(vec3(0.95, 0.74, 0.04), vec3(0.07, 0.07, 0.08), s);
  }
  if (uPattern > 0.5 && uPattern < 1.5) {
    vec2 g = abs(fract(vW.xz * 0.5) - 0.5);
    float line = step(0.488, max(g.x, g.y));
    base *= (1.0 - line * 0.14) * (0.95 + hash(floor(vW.xz * 0.5)) * 0.08);
  } else if (uPattern > 1.5 && uPattern < 2.5) {
    base *= 0.88 + hash(floor(vW.xz * 4.0)) * 0.18;
  } else if (uPattern > 2.5) {
    base *= 0.9 + 0.12 * step(0.5, fract(vW.z * 2.5));
  }
  vec3 col = base;
  if (uUnlit < 0.5) {
    vec3 n = normalize(vN);
    float d = max(dot(n, -uLight), 0.0);
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    vec3 v = normalize(uCam - vW);
    vec3 h = normalize(v - uLight);
    float sp = pow(max(dot(n, h), 0.0), 40.0) * 0.12;
    col = base * (amb + d * vec3(1.0, 0.95, 0.88) * 0.78) + sp;
  }
  col += uEmissive;
  float f = smoothstep(uFogRange.x, uFogRange.y, length(uCam - vW));
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, uOpacity);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.a = { pos: gl.getAttribLocation(prog, 'aPos'), nrm: gl.getAttribLocation(prog, 'aNrm') };
    this.u = {};
    for (const n of ['uModel', 'uVP', 'uNrm', 'uColor', 'uEmissive', 'uLight', 'uSky', 'uGround', 'uFog', 'uCam', 'uFogRange', 'uOpacity', 'uStripes', 'uPattern', 'uUnlit']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    this.cache = new WeakMap();
    this.env = {
      light: normalize([-0.45, -1, -0.35]),
      sky: [0.62, 0.66, 0.74],
      ground: [0.30, 0.27, 0.25],
      fog: [0.10, 0.12, 0.15],
      fogRange: [22, 42],
    };
    this.vp = m4.ident();
    this.cam = [0, 10, 10];
    this.nm = new Float32Array(9);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  resize(ratioCap = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, ratioCap);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }

  setCamera(eye, target, fov = 0.8) {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const proj = m4.perspective(fov, aspect, 0.5, 90);
    const view = m4.lookAt(eye, target, [0, 1, 0]);
    this.vp = m4.mul(proj, view);
    this.cam = eye;
  }

  // Coordonnées écran (px CSS) d'un point du monde.
  project(x, y, z) {
    const r = m4.apply(this.vp, x, y, z);
    if (r[3] <= 0) return null;
    return { x: (r[0] + 1) / 2 * this.canvas.clientWidth, y: (1 - r[1]) / 2 * this.canvas.clientHeight };
  }

  buffers(geo) {
    let b = this.cache.get(geo);
    if (b) return b;
    const gl = this.gl;
    const mk = (target, data) => { const buf = gl.createBuffer(); gl.bindBuffer(target, buf); gl.bufferData(target, data, gl.STATIC_DRAW); return buf; };
    b = { pos: mk(gl.ARRAY_BUFFER, geo.pos), nrm: mk(gl.ARRAY_BUFFER, geo.nrm), idx: mk(gl.ELEMENT_ARRAY_BUFFER, geo.idx), count: geo.idx.length };
    this.cache.set(geo, b);
    return b;
  }

  render(root) {
    const gl = this.gl, u = this.u, e = this.env;
    gl.clearColor(e.fog[0], e.fog[1], e.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform3fv(u.uLight, e.light);
    gl.uniform3fv(u.uSky, e.sky);
    gl.uniform3fv(u.uGround, e.ground);
    gl.uniform3fv(u.uFog, e.fog);
    gl.uniform3fv(u.uCam, this.cam);
    gl.uniform2fv(u.uFogRange, e.fogRange);
    gl.enableVertexAttribArray(this.a.pos);
    gl.enableVertexAttribArray(this.a.nrm);

    const opaque = [], clear = [];
    const walk = (n, parent) => {
      if (!n.visible) return;
      m4.compose(n.local, n.pos, n.rot, n.scl);
      m4.mul(parent, n.local, n.world);
      if (n.mesh) (n.mesh.mat.opacity < 1 ? clear : opaque).push(n);
      for (const c of n.children) walk(c, n.world);
    };
    walk(root, m4.ident());

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (const n of opaque) this.draw(n);
    if (clear.length) {
      const c = this.cam;
      clear.sort((a, b) => dist2(b.world, c) - dist2(a.world, c));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const n of clear) this.draw(n);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  draw(n) {
    const gl = this.gl, u = this.u, { geo, mat: m, glow } = n.mesh;
    const b = this.buffers(geo);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm);
    gl.vertexAttribPointer(this.a.nrm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.uniformMatrix4fv(u.uModel, false, n.world);
    gl.uniformMatrix3fv(u.uNrm, false, m4.normal3(n.world, this.nm));
    gl.uniform3fv(u.uColor, m.color);
    const em = glow ? [m.emissive[0] + glow[0], m.emissive[1] + glow[1], m.emissive[2] + glow[2]] : m.emissive;
    gl.uniform3fv(u.uEmissive, em);
    gl.uniform1f(u.uOpacity, m.opacity);
    gl.uniform1f(u.uStripes, m.stripes);
    gl.uniform1f(u.uPattern, m.pattern);
    gl.uniform1f(u.uUnlit, m.unlit);
    gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
  }
}

function normalize(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
function dist2(w, c) { const dx = w[12] - c[0], dy = w[13] - c[1], dz = w[14] - c[2]; return dx * dx + dy * dy + dz * dz; }
