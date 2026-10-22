// Moteur 3D WebGL maison (v2) : couleurs par sommet, matières peintes dans le shader
// (béton, terre, rouille, verre, métal peint, roche, argile, eau, bois, caoutchouc),
// ombres portées, brouillard et rendu de couleur filmique.

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
  ortho(l, r, b, t, n, f) {
    return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
  },
  lookAt(e, t, u) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1,
    ]);
  },
  compose(o, p, r, s) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
    const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
    const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
    o[0] = r00 * s[0]; o[1] = r10 * s[0]; o[2] = r20 * s[0]; o[3] = 0;
    o[4] = r01 * s[1]; o[5] = r11 * s[1]; o[6] = r21 * s[1]; o[7] = 0;
    o[8] = r02 * s[2]; o[9] = r12 * s[2]; o[10] = r22 * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  },
  normal3(m, o = new Float32Array(9)) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-9;
    o[0] = A / det; o[1] = B / det; o[2] = C / det;
    o[3] = -(b * i - c * h) / det; o[4] = (a * i - c * g) / det; o[5] = -(a * h - b * g) / det;
    o[6] = (b * f - c * e) / det; o[7] = -(a * f - c * d) / det; o[8] = (a * e - b * d) / det;
    return o;
  },
  apply(m, x, y, z) {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  },
};

// ---------- géométries (origine au pied, sauf sphère) ----------
function finalize(pos, nrm, idx) {
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
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), l = Math.hypot(1, slope);
    pos.push(c * rBot, y0, s * rBot, c * rTop, y0 + h, s * rTop);
    nrm.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  if (caps) {
    for (const [y, r, ny] of [[y0 + h, rTop, 1], [y0, rBot, -1]]) {
      if (r <= 0) continue;
      const c0 = pos.length / 3;
      pos.push(0, y, 0); nrm.push(0, ny, 0);
      for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nrm.push(0, ny, 0); }
      for (let i = 0; i < seg; i++) idx.push(c0, c0 + 1 + i, c0 + 2 + i);
    }
  }
  return finalize(pos, nrm, idx);
}

export function sphere(r, ws = 16, hs = 10, y0 = 0) {
  const pos = [], nrm = [], idx = [];
  for (let j = 0; j <= hs; j++) {
    const phi = (j / hs) * Math.PI;
    for (let i = 0; i <= ws; i++) {
      const th = (i / ws) * Math.PI * 2;
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

export function torus(R, r, seg = 20, tube = 8) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = (i / seg) * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= tube; j++) {
      const v = (j / tube) * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
      pos.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
      nrm.push(cv * cu, sv, cv * su);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
    const a = i * (tube + 1) + j, b = a + tube + 1;
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

// Boule cabossée (rochers, buttes, corps de créatures) avec normales recalculées.
export function lump(r, seed = 1, rough = 0.25, ws = 14, hs = 9, squash = 1) {
  const g = sphere(r, ws, hs, 0);
  const p = g.pos;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bumps = Array.from({ length: 6 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, 0.5 + rnd()]);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] / r, y = p[i + 1] / r, z = p[i + 2] / r;
    let k = 1;
    for (const [bx, by, bz, f] of bumps) k += Math.sin((x * bx + y * by + z * bz) * 3 * f + f * 5) * rough / 3;
    p[i] *= k; p[i + 1] = p[i + 1] * k * squash; p[i + 2] *= k;
  }
  // seam : souder les sommets de la couture et recalculer des normales lisses
  const n = new Float32Array(p.length);
  for (let t = 0; t < g.idx.length; t += 3) {
    const a = g.idx[t] * 3, b = g.idx[t + 1] * 3, c = g.idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    const ox = g.nrm[i], oy = g.nrm[i + 1], oz = g.nrm[i + 2];
    let nx = n[i] / l, ny = n[i + 1] / l, nz = n[i + 2] / l;
    if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    n[i] = nx; n[i + 1] = ny; n[i + 2] = nz;
  }
  g.nrm = n;
  return g;
}

// Grille de terrain : hauteur(x, z) et couleur(x, z, y) fournies par l'appelant.
export function terrain(size, step, hfn, cfn) {
  const n = Math.round(size / step) + 1, half = size / 2;
  const chunks = [];
  const rows = Math.floor(60000 / n) - 1;
  for (let r0 = 0; r0 < n - 1; r0 += rows) {
    const r1 = Math.min(n - 1, r0 + rows);
    const pos = [], nrm = [], col = [], idx = [];
    for (let j = r0; j <= r1; j++) for (let i = 0; i < n; i++) {
      const x = -half + i * step, z = -half + j * step, y = hfn(x, z);
      const hx = hfn(x + 0.5, z) - hfn(x - 0.5, z), hz = hfn(x, z + 0.5) - hfn(x, z - 0.5);
      const l = Math.hypot(hx, 1, hz);
      pos.push(x, y, z); nrm.push(-hx / l, 1 / l, -hz / l);
      col.push(...cfn(x, z, y));
    }
    for (let j = 0; j < r1 - r0; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + n;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = finalize(pos, nrm, idx);
    g.col = new Float32Array(col);
    chunks.push(g);
  }
  return chunks;
}

// Assemble des pièces placées (rotation complète) en quelques géométries colorées.
const tmpM = new Float32Array(16), tmpN = new Float32Array(9);
export function bake(parts) {
  const chunks = [];
  let pos = [], nrm = [], col = [], idx = [];
  const flush = () => {
    if (!idx.length) return;
    chunks.push({ pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: new Uint16Array(idx) });
    pos = []; nrm = []; col = []; idx = [];
  };
  for (const pt of parts) {
    const g = pt.g;
    if (pos.length / 3 + g.pos.length / 3 > 60000) flush();
    m4.compose(tmpM, pt.p || [0, 0, 0], pt.r || [0, 0, 0], pt.s || [1, 1, 1]);
    m4.normal3(tmpM, tmpN);
    const b = pos.length / 3, c = pt.c || [1, 1, 1];
    for (let i = 0; i < g.pos.length; i += 3) {
      const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
      pos.push(tmpM[0] * x + tmpM[4] * y + tmpM[8] * z + tmpM[12], tmpM[1] * x + tmpM[5] * y + tmpM[9] * z + tmpM[13], tmpM[2] * x + tmpM[6] * y + tmpM[10] * z + tmpM[14]);
      const nx = g.nrm[i], ny = g.nrm[i + 1], nz = g.nrm[i + 2];
      const ax = tmpN[0] * nx + tmpN[3] * ny + tmpN[6] * nz, ay = tmpN[1] * nx + tmpN[4] * ny + tmpN[7] * nz, az = tmpN[2] * nx + tmpN[5] * ny + tmpN[8] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      nrm.push(ax / l, ay / l, az / l);
      if (g.col) col.push(g.col[i] * c[0], g.col[i + 1] * c[1], g.col[i + 2] * c[2]);
      else col.push(c[0], c[1], c[2]);
    }
    for (const k of g.idx) idx.push(k + b);
  }
  flush();
  return chunks;
}

// ---------- nœuds ----------
export class Node {
  constructor(m = null) {
    this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1];
    this.visible = true; this.children = []; this.mesh = m;
    this.world = m4.ident(); this.local = m4.ident();
  }
  add(...nodes) { for (const n of nodes) this.children.push(n); return this; }
  at(x, y, z) { this.pos = [x, y, z]; return this; }
  rotY(a) { this.rot[1] = a; return this; }
  glow(rgb) { const w = (n) => { if (n.mesh) n.mesh.glow = rgb; n.children.forEach(w); }; w(this); }
}

// Patterns : 0 uni, 1 béton, 2 terre, 3 rouille, 4 verre, 5 métal peint usé, 6 roche, 7 argile,
// 8 eau, 9 bois, 10 caoutchouc, 11 bandes de danger
export const P = { plain: 0, concrete: 1, ground: 2, rust: 3, glass: 4, paint: 5, rock: 6, clay: 7, water: 8, wood: 9, rubber: 10, hazard: 11 };
export function mat(color, o = {}) {
  return {
    color, emissive: o.emissive || [0, 0, 0], opacity: o.opacity ?? 1, pattern: o.pattern || 0,
    unlit: o.unlit || 0, rough: o.rough ?? 0.6, cast: o.cast ?? true, scale: o.scale || 1,
  };
}
export function mesh(geo, material) { return new Node({ geo, mat: material, glow: null }); }
// Plusieurs morceaux (issus de bake) sous un même nœud
export function meshes(chunks, material) { const n = new Node(); for (const g of chunks) n.add(mesh(g, material)); return n; }

// ---------- shaders ----------
const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol;
uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNrm; uniform mat4 uShadowVP; uniform float uScale;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec3 vC; varying vec4 vS;
void main(){ vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vL = aPos * uScale; vN = uNrm * aNrm; vC = aCol; vS = uShadowVP * w; gl_Position = uVP * w; }`;

const FS = `
precision highp float;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec3 vC; varying vec4 vS;
uniform vec3 uColor; uniform vec3 uEmissive; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround;
uniform vec3 uFog; uniform vec3 uCam; uniform vec2 uFogRange;
uniform float uOpacity; uniform float uPattern; uniform float uUnlit; uniform float uRough; uniform float uTime;
uniform float uShadowOn; uniform float uTexel; uniform sampler2D uShadow;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
vec2 tp(vec3 p, vec3 n){ vec3 a = abs(n); return a.y > max(a.x, a.z) ? p.xz : (a.x > a.z ? p.zy : p.xy); }
float unpack(vec4 c){ return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
float shadowAt(float bias){
  vec3 p = vS.xyz / vS.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    float d = unpack(texture2D(uShadow, p.xy + vec2(float(x), float(y)) * uTexel));
    s += (p.z - bias > d) ? 0.0 : 1.0;
  }
  return s / 9.0;
}
vec3 lin(vec3 c){ return c * c; }
void main(){
  vec3 n = normalize(vN);
  vec3 base = lin(uColor * vC);
  float rough = uRough, spec = 0.04, alpha = uOpacity;
  vec2 uv = tp(vL, n);
  if (uPattern > 0.5 && uPattern < 1.5) {
    float f = fbm(uv * 1.3), stain = fbm(uv * 0.22 + 3.0);
    base *= (0.78 + 0.38 * f) * mix(1.0, 0.68, smoothstep(0.55, 0.8, stain));
    vec2 g = abs(fract(uv * 0.33) - 0.5);
    base *= 1.0 - 0.16 * step(0.488, max(g.x, g.y));
    base *= 1.0 - 0.22 * smoothstep(0.012, 0.0, abs(fbm(uv * 0.5 + 7.0) - 0.5));
    rough = 0.85;
  } else if (uPattern > 1.5 && uPattern < 2.5) {
    base *= 0.68 + 0.5 * fbm(uv * 0.8) + 0.12 * vn(uv * 7.0);
    rough = 0.95;
  } else if (uPattern > 2.5 && uPattern < 3.5) {
    float r = fbm(uv * 2.0 + 1.7), pit = vn(uv * 15.0);
    vec3 rust = lin(vec3(0.50, 0.25, 0.11)) * (0.65 + 0.7 * pit);
    float k = smoothstep(0.38, 0.68, r);
    base = mix(base, rust, k);
    spec = mix(0.3, 0.03, k); rough = mix(0.35, 0.9, k);
  } else if (uPattern > 3.5 && uPattern < 4.5) {
    float fr = pow(1.0 - max(dot(n, normalize(uCam - vW)), 0.0), 3.0);
    alpha = clamp(uOpacity + fr * 0.55, 0.0, 1.0); spec = 0.8; rough = 0.08;
    base *= 0.85 + 0.3 * vn(uv * 3.0);
  } else if (uPattern > 4.5 && uPattern < 5.5) {
    float w = fbm(uv * 2.6 + 5.0);
    float scr = smoothstep(0.76, 0.8, vn(vec2(uv.x * 22.0, uv.y * 1.5))) * smoothstep(0.45, 0.7, vn(uv * 1.3 + 9.0));
    base = mix(base, lin(vec3(0.62, 0.63, 0.65)), scr * 0.35);
    base = mix(base, lin(vec3(0.45, 0.24, 0.12)), smoothstep(0.68, 0.84, w));
    spec = 0.14; rough = 0.45;
  } else if (uPattern > 5.5 && uPattern < 6.5) {
    base *= 0.76 + 0.32 * fbm(uv * 1.8) + 0.12 * vn(vec2(uv.x * 0.7, uv.y * 5.0));
    rough = 0.92;
  } else if (uPattern > 6.5 && uPattern < 7.5) {
    float f = fbm(uv * 1.6);
    base *= 0.66 + 0.55 * f;
    spec = 0.06 + 0.2 * smoothstep(0.55, 0.85, f); rough = 0.35;
  } else if (uPattern > 7.5 && uPattern < 8.5) {
    float t = uTime * 0.5;
    float w1 = vn(uv * 1.4 + vec2(t, t * 0.6)), w2 = vn(uv * 3.3 - vec2(t * 1.2, -t * 0.5));
    n = normalize(n + vec3((w1 - 0.5) * 0.35, 0.0, (w2 - 0.5) * 0.35));
    float fr = pow(1.0 - max(dot(n, normalize(uCam - vW)), 0.0), 4.0);
    base = mix(base, lin(uSky) * 0.8, 0.12 + fr * 0.45); spec = 1.0; rough = 0.04; alpha = 0.9;
  } else if (uPattern > 8.5 && uPattern < 9.5) {
    base *= 0.62 + 0.5 * vn(vec2(uv.x * 12.0, uv.y * 1.3));
    rough = 0.9;
  } else if (uPattern > 9.5 && uPattern < 10.5) {
    base *= 0.85 + 0.2 * vn(uv * 9.0); spec = 0.03; rough = 0.95;
  } else if (uPattern > 10.5) {
    float s = step(0.5, fract((vL.x + vL.z + vL.y) * 1.7));
    base = lin(mix(vec3(0.96, 0.75, 0.05), vec3(0.08, 0.08, 0.09), s));
  }
  vec3 col;
  if (uUnlit > 0.5) col = base;
  else {
    float ndl = dot(n, -uSun);
    float sh = uShadowOn > 0.5 ? shadowAt(0.0012 + 0.0025 * (1.0 - abs(ndl))) : 1.0;
    float d = max(ndl, 0.0) * sh;
    vec3 amb = mix(lin(uGround), lin(uSky), n.y * 0.5 + 0.5) * 0.6;
    vec3 v = normalize(uCam - vW), h = normalize(v - uSun);
    float sp = pow(max(dot(n, h), 0.0), mix(90.0, 6.0, rough)) * spec * 5.0 * sh;
    col = base * (amb + d * lin(uSunCol) * 1.45) + sp * lin(uSunCol);
  }
  col += lin(uEmissive) * 1.6;
  float f = smoothstep(uFogRange.x, uFogRange.y, length(uCam - vW));
  col = mix(col, lin(uFog), f);
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  gl_FragColor = vec4(sqrt(clamp(col, 0.0, 1.0)), alpha);
}`;

const VS_D = `
attribute vec3 aPos;
uniform mat4 uModel; uniform mat4 uVP;
void main(){ gl_Position = uVP * uModel * vec4(aPos, 1.0); }`;
const FS_D = `
precision highp float;
void main(){
  vec4 e = fract(gl_FragCoord.z * vec4(1.0, 255.0, 65025.0, 16581375.0));
  e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  gl_FragColor = e;
}`;

export class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    this.prog = this.program(VS, FS, ['uModel', 'uVP', 'uNrm', 'uShadowVP', 'uScale', 'uColor', 'uEmissive', 'uSun', 'uSunCol', 'uSky', 'uGround', 'uFog', 'uCam', 'uFogRange', 'uOpacity', 'uPattern', 'uUnlit', 'uRough', 'uTime', 'uShadowOn', 'uTexel', 'uShadow']);
    this.depth = this.program(VS_D, FS_D, ['uModel', 'uVP']);
    this.cache = new WeakMap();
    this.env = {
      sun: norm([-0.55, -0.75, -0.38]),
      sunCol: [1.0, 0.86, 0.68],
      sky: [0.62, 0.66, 0.70],
      ground: [0.33, 0.28, 0.24],
      fog: [0.60, 0.56, 0.52],
      fogRange: [30, 75],
    };
    this.vp = m4.ident(); this.cam = [0, 10, 10]; this.target = [0, 0, 0];
    this.nm = new Float32Array(9);
    this.time = 0;
    this.shadowSize = opts.shadowSize || 2048;
    this.shadows = opts.shadows !== false;
    this.ratioCap = opts.ratioCap || 2;
    this.initShadow();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  program(vs, fs, uniforms) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
    return { p, u, a: { pos: gl.getAttribLocation(p, 'aPos'), nrm: gl.getAttribLocation(p, 'aNrm'), col: gl.getAttribLocation(p, 'aCol') } };
  }

  initShadow() {
    const gl = this.gl, S = this.shadowSize;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowTex, 0);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.shadows = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowVP = m4.ident();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.ratioCap);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  setCamera(eye, target, fov = 0.9) {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.vp = m4.mul(m4.perspective(fov, aspect, 0.3, 140), m4.lookAt(eye, target, [0, 1, 0]));
    this.cam = eye; this.target = target;
  }

  project(x, y, z) {
    const r = m4.apply(this.vp, x, y, z);
    if (r[3] <= 0 || r[2] > 1) return null;
    return { x: (r[0] + 1) / 2 * this.canvas.clientWidth, y: (1 - r[1]) / 2 * this.canvas.clientHeight, depth: r[3] };
  }

  buffers(geo) {
    let b = this.cache.get(geo);
    if (b) return b;
    const gl = this.gl;
    const mk = (target, data) => { const buf = gl.createBuffer(); gl.bindBuffer(target, buf); gl.bufferData(target, data, gl.STATIC_DRAW); return buf; };
    b = { pos: mk(gl.ARRAY_BUFFER, geo.pos), nrm: mk(gl.ARRAY_BUFFER, geo.nrm), col: geo.col ? mk(gl.ARRAY_BUFFER, geo.col) : null, idx: mk(gl.ELEMENT_ARRAY_BUFFER, geo.idx), count: geo.idx.length };
    this.cache.set(geo, b);
    return b;
  }

  render(root, dt = 0) {
    const gl = this.gl, e = this.env;
    this.time += dt;
    // Vue de la lumière (carte d'ombres) : elle suit la caméra
    const S = 30, res = this.shadowSize;
    if (this.shadows) {
      const t = this.target, L = e.sun;
      const snap = (2 * S) / res;
      const tx = Math.round(t[0] / snap) * snap, tz = Math.round(t[2] / snap) * snap;
      const eye = [tx - L[0] * 70, -L[1] * 70, tz - L[2] * 70];
      this.shadowVP = m4.mul(m4.ortho(-S, S, -S, S, 5, 150), m4.lookAt(eye, [tx, 0, tz], [0, 1, 0]));
    }
    // Tri des objets : ce qui est hors de l'écran n'est pas dessiné, ce qui est hors de la zone d'ombre ne projette pas d'ombre.
    // Un nœud avec cullR (rayon en mètres) est testé avec tout son contenu.
    const camP = planes(this.vp), shP = this.shadows ? planes(this.shadowVP) : null;
    const tg = this.target;
    const opaque = [], clear = [], casters = [];
    const walk = (n, parent, main, shad) => {
      if (!n.visible) return;
      m4.compose(n.local, n.pos, n.rot, n.scl);
      m4.mul(parent, n.local, n.world);
      if (n.cullR) {
        const w = n.world, r = n.cullR;
        if (main) main = sphereIn(camP, w[12], w[13], w[14], r);
        // Petits objets (droïdes, créatures…) : ombre seulement près de la caméra
        if (shad) shad = sphereIn(shP, w[12], w[13], w[14], r) && (r > 2.5 || Math.hypot(w[12] - tg[0], w[14] - tg[2]) < 20);
        if (!main && !shad) return;
      }
      if (n.mesh) {
        if (main) (n.mesh.mat.opacity < 1 || n.mesh.mat.pattern === P.water ? clear : opaque).push(n);
        if (shad && n.mesh.mat.cast && !n.mesh.mat.unlit && n.mesh.mat.opacity >= 1) casters.push(n);
      }
      for (const c of n.children) walk(c, n.world, main, shad);
    };
    walk(root, m4.ident(), true, this.shadows);

    // 1. Carte d'ombres
    if (this.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
      gl.viewport(0, 0, res, res);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const D = this.depth;
      gl.useProgram(D.p);
      gl.uniformMatrix4fv(D.u.uVP, false, this.shadowVP);
      gl.enableVertexAttribArray(D.a.pos);
      gl.disable(gl.BLEND);
      gl.cullFace(gl.FRONT);
      for (const n of casters) {
        const b = this.buffers(n.mesh.geo);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
        gl.vertexAttribPointer(D.a.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
        gl.uniformMatrix4fv(D.u.uModel, false, n.world);
        gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.cullFace(gl.BACK);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // 2. Scène
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const fc = e.fog;
    gl.clearColor(fc[0], fc[1], fc[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const M = this.prog, u = M.u;
    gl.useProgram(M.p);
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniformMatrix4fv(u.uShadowVP, false, this.shadowVP);
    gl.uniform3fv(u.uSun, e.sun);
    gl.uniform3fv(u.uSunCol, e.sunCol);
    gl.uniform3fv(u.uSky, e.sky);
    gl.uniform3fv(u.uGround, e.ground);
    gl.uniform3fv(u.uFog, e.fog);
    gl.uniform3fv(u.uCam, this.cam);
    gl.uniform2fv(u.uFogRange, e.fogRange);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uShadowOn, this.shadows ? 1 : 0);
    gl.uniform1f(u.uTexel, 1 / this.shadowSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadow, 0);
    gl.enableVertexAttribArray(M.a.pos);
    gl.enableVertexAttribArray(M.a.nrm);
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
    this.drawCalls = opaque.length + clear.length;
    this.shadowCalls = casters.length;
  }

  draw(n) {
    const gl = this.gl, M = this.prog, u = M.u, { geo, mat: m, glow } = n.mesh;
    const b = this.buffers(geo);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.vertexAttribPointer(M.a.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm);
    gl.vertexAttribPointer(M.a.nrm, 3, gl.FLOAT, false, 0, 0);
    if (b.col) {
      gl.enableVertexAttribArray(M.a.col);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.col);
      gl.vertexAttribPointer(M.a.col, 3, gl.FLOAT, false, 0, 0);
    } else {
      gl.disableVertexAttribArray(M.a.col);
      gl.vertexAttrib3f(M.a.col, 1, 1, 1);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.uniformMatrix4fv(u.uModel, false, n.world);
    gl.uniformMatrix3fv(u.uNrm, false, m4.normal3(n.world, this.nm));
    gl.uniform1f(u.uScale, m.scale);
    gl.uniform3fv(u.uColor, m.color);
    gl.uniform3fv(u.uEmissive, glow ? [m.emissive[0] + glow[0], m.emissive[1] + glow[1], m.emissive[2] + glow[2]] : m.emissive);
    gl.uniform1f(u.uOpacity, m.opacity);
    gl.uniform1f(u.uPattern, m.pattern);
    gl.uniform1f(u.uUnlit, m.unlit);
    gl.uniform1f(u.uRough, m.rough);
    gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
  }
}

// Plans du champ de vision d'une matrice (colonnes) : un objet est visible s'il n'est derrière aucun plan
function planes(m) {
  const out = [];
  for (const [i, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const a = m[3] + sg * m[i], b = m[7] + sg * m[4 + i], c = m[11] + sg * m[8 + i], d = m[15] + sg * m[12 + i];
    const l = Math.hypot(a, b, c) || 1;
    out.push([a / l, b / l, c / l, d / l]);
  }
  return out;
}
function sphereIn(pl, x, y, z, r) {
  for (const p of pl) if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
  return true;
}
function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
function dist2(w, c) { const dx = w[12] - c[0], dy = w[13] - c[1], dz = w[14] - c[2]; return dx * dx + dy * dy + dz * dz; }
