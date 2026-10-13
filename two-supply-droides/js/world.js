// Génération du terrain vague : relief, débris à fouiller, décor, obstacles.
// Tout est déterministe : les deux téléphones construisent exactement le même monde.
import { WORLD, SLAB, NODE_TYPES, PLOTS, MACHINES, ENTREPOT, CORE } from './config.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export const POND = { x: -28, z: 3, r: 5.5 };

// Relief doux ; la dalle de l'usine reste plate.
export function height(x, z) {
  const dx = Math.max(SLAB.x0 - x, 0, x - SLAB.x1);
  const dz = Math.max(SLAB.z0 - z, 0, z - SLAB.z1);
  const out = Math.min(1, Math.hypot(dx, dz) / 6);
  let h = (noise(x * 0.07, z * 0.07) - 0.5) * 1.6 + (noise(x * 0.23 + 7, z * 0.23 - 3) - 0.5) * 0.45;
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 3) h -= 0.9 * (1 - Math.min(1, Math.max(0, (pd - POND.r * 0.5) / (POND.r * 0.5 + 3))));
  return h * out;
}

// ---------- débris à fouiller ----------
const R = rng(20261012);
const NODES_RAW = [];
const taken = [];
function free(x, z, r) {
  if (Math.abs(x) > WORLD.half - 3 || Math.abs(z) > WORLD.half - 3) return false;
  if (x > SLAB.x0 - 3 && x < SLAB.x1 + 3 && z > SLAB.z0 - 3 && z < SLAB.z1 + 3) return false;
  if (Math.hypot(x - CORE.x, z - CORE.z) < 5) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1) return false;
  return taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r + 1.6);
}
function place(type, x, z) {
  const r = NODE_TYPES[type].r;
  taken.push({ x, z, r });
  NODES_RAW.push({ type, x, z, rot: R() * Math.PI * 2 });
}
function scatter(type, n, x0, x1, z0, z1) {
  let k = 0, guard = 0;
  while (k < n && guard++ < 500) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
    if (!free(x, z, NODE_TYPES[type].r)) continue;
    place(type, x, z);
    k++;
  }
}
// Premiers débris, proches de l'usine
place('ferraille', 18.5, 4);
place('argile', -18.5, -3.5);
place('calcaire', -4, 15);
place('vitres', 4, -15.5);
place('citerne', -18.5, 8);
// Zones thématiques
scatter('epave', 5, 19, 37, -36, -4);
scatter('ferraille', 4, 18, 37, -36, -2);
scatter('vitres', 6, -18, 14, -37, -17);
scatter('ferraille', 1, -18, 14, -37, -17);
scatter('argile', 4, -37, -19, -16, 18);
scatter('citerne', 3, -37, -19, -16, 18);
scatter('calcaire', 6, -8, 32, 17, 37);
scatter('argile', 1, -8, 32, 17, 37);

export const NODES = NODES_RAW.map((n, i) => ({ id: i, ...n }));

// ---------- décor ----------
const D = rng(777);
export const PROPS = [];
function prop(kind, x, z, extra = {}) { PROPS.push({ kind, x, z, rot: D() * Math.PI * 2, s: 0.8 + D() * 0.5, ...extra }); }
function decorFree(x, z, r) {
  if (Math.abs(x) > WORLD.half - 1 || Math.abs(z) > WORLD.half - 1) return false;
  if (x > SLAB.x0 - 1 && x < SLAB.x1 + 1 && z > SLAB.z0 - 1 && z < SLAB.z1 + 1) return false;
  if (Math.hypot(x - CORE.x, z - CORE.z) < 4) return false;
  return NODES.every((n) => Math.hypot(n.x - x, n.z - z) > NODE_TYPES[n.type].r + r + 0.8);
}
for (let i = 0; i < 260; i++) {
  const x = (D() * 2 - 1) * (WORLD.half - 2), z = (D() * 2 - 1) * (WORLD.half - 2);
  const k = D();
  let kind;
  if (k < 0.22) kind = 'rubble';
  else if (k < 0.36) kind = 'barrel';
  else if (k < 0.46) kind = 'tires';
  else if (k < 0.58) kind = 'grass';
  else if (k < 0.66) kind = 'deadtree';
  else if (k < 0.74) kind = 'block';
  else if (k < 0.82) kind = 'shards';
  else if (k < 0.9) kind = 'pipe';
  else kind = 'rock';
  const r = { rubble: 0.8, barrel: 0.5, tires: 0.6, grass: 0.3, deadtree: 0.6, block: 1.0, shards: 0.5, pipe: 1.2, rock: 0.7 }[kind];
  if (!decorFree(x, z, r)) continue;
  if (kind === 'deadtree' && Math.hypot(x, z) < 20) continue;
  prop(kind, x, z, { r });
}
// Clôture effondrée autour du site
for (let a = 0; a < Math.PI * 2; a += 0.11) {
  const rr = 38.5 + Math.sin(a * 5) * 0.6;
  if (D() < 0.25) continue;
  PROPS.push({ kind: 'fence', x: Math.cos(a) * rr, z: Math.sin(a) * rr, rot: -a, s: 1, lean: (D() - 0.5) * 0.5 });
}

// ---------- ruines de l'usine (sur la dalle) ----------
export const RUINS = [
  { kind: 'wall', x: -10, z: -11.2, w: 10, d: 0.5, h: 2.2 },
  { kind: 'wall', x: -15.2, z: -6, w: 0.5, d: 9, h: 1.8 },
  { kind: 'wall', x: 15.2, z: 7, w: 0.5, d: 7, h: 1.2 },
  { kind: 'pillar', x: -15, z: 11, r: 0.45, h: 3.2 },
  { kind: 'pillar', x: 15.2, z: -2.5, r: 0.45, h: 4.5 },
  { kind: 'pillar', x: -15, z: -11, r: 0.45, h: 5.2 },
  { kind: 'pillar', x: 15, z: 11, r: 0.45, h: 2.4 },
  { kind: 'pillar', x: 0, z: 11, r: 0.45, h: 1.6 },
];

// ---------- obstacles ----------
export const STATIC_OBS = [];
for (const n of NODES) STATIC_OBS.push({ c: true, x: n.x, z: n.z, r: NODE_TYPES[n.type].r * 0.75 });
for (const p of PROPS) {
  if (['block', 'deadtree', 'pipe', 'rock'].includes(p.kind)) STATIC_OBS.push({ c: true, x: p.x, z: p.z, r: p.r * 0.7 * p.s });
}
for (const w of RUINS) {
  if (w.kind === 'wall') STATIC_OBS.push({ x: w.x, z: w.z, w: w.w, d: w.d });
  else STATIC_OBS.push({ c: true, x: w.x, z: w.z, r: w.r });
}
STATIC_OBS.push({ x: ENTREPOT.x, z: ENTREPOT.z, w: ENTREPOT.w, d: ENTREPOT.d });

export function plotBox(p) { const m = MACHINES[p.type]; return { x: p.x, z: p.z, w: m.w, d: m.d }; }
export const PLOT_BY_ID = Object.fromEntries(PLOTS.map((p) => [p.id, p]));

// Points de départ des créatures
export const ANIMAL_HOMES = [
  { x: 26, z: -12 }, { x: -6, z: -27 }, { x: -27, z: -9 },
  { x: 10, z: 27 }, { x: -24, z: 22 }, { x: 30, z: 18 },
  { x: 24, z: -32 }, { x: -32, z: 28 },
];
