// Génération du terrain vague : relief, débris à fouiller, décor, obstacles.
// La carte dépend d'une graine tirée à chaque nouvelle partie ; les deux téléphones
// reçoivent la même graine et construisent donc exactement le même monde.
import { WORLD, SLAB, NODE_TYPES, NODE_MIX, PLOTS, MACHINES, ENTREPOT, CORE, PAUSE, HEAVY, LAMP_POSTS } from './config.js';

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

export const POND = { x: -31, z: 25, r: 5 };

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

// Distance au rectangle de la dalle (0 dedans)
export function slabDist(x, z) {
  const dx = Math.max(SLAB.x0 - x, 0, x - SLAB.x1);
  const dz = Math.max(SLAB.z0 - z, 0, z - SLAB.z1);
  return Math.hypot(dx, dz);
}
// Couloir laissé libre entre le cœur d'assembleur et l'usine (pour le porter à deux)
const CORRIDOR = [{ x: CORE.x, z: CORE.z }, { x: SLAB.x1 - 2, z: SLAB.z0 + 2 }];
function corridorDist(x, z) {
  const [a, b] = CORRIDOR;
  const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
  return Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
}

// Passages dans les ruines : pour entrer ou sortir de la dalle (droïdes), gardés libres de tout obstacle.
export const GATES = [
  { in: { x: -3, z: -13.6 }, out: { x: -3, z: -17.4 } }, { in: { x: 15, z: -13.6 }, out: { x: 15, z: -17.4 } },
  { in: { x: -20.6, z: 0.5 }, out: { x: -24.4, z: 0.5 } }, { in: { x: 20.6, z: -4.2 }, out: { x: 24.4, z: -4.2 } },
  { in: { x: 20.6, z: 11 }, out: { x: 24.4, z: 11 } }, { in: { x: -12, z: 14.6 }, out: { x: -12, z: 18.4 } },
  { in: { x: 4.4, z: 14.6 }, out: { x: 4.4, z: 18.4 } },
];
const gateDist = (x, z) => Math.min(...GATES.map((g) => Math.hypot(x - g.out.x, z - g.out.z)));

export const NODES = [];
export const PROPS = [];
export const STATIC_OBS = [];
// Emplacements de départ des pièces lourdes (une par chantier de vraie machine), tirés avec la graine
export const PART_SPOTS = {};
export let SEED = 0;

// ---------- ruines de l'usine (sur les bords de la dalle) ----------
export const RUINS = [
  { kind: 'wall', x: -14, z: -15.3, w: 14, d: 0.5, h: 2.2 },
  { kind: 'wall', x: 6, z: -15.3, w: 8, d: 0.5, h: 1.4 },
  { kind: 'wall', x: -22.3, z: -9, w: 0.5, d: 10, h: 1.8 },
  { kind: 'wall', x: -22.3, z: 9, w: 0.5, d: 8, h: 1.2 },
  { kind: 'wall', x: 22.3, z: 4, w: 0.5, d: 6, h: 1.4 },
  { kind: 'pillar', x: -22, z: 16, r: 0.45, h: 3.2 },
  { kind: 'pillar', x: 22.2, z: -6, r: 0.45, h: 4.5 },
  { kind: 'pillar', x: -22, z: -15, r: 0.45, h: 5.2 },
  { kind: 'pillar', x: 22, z: 16, r: 0.45, h: 2.4 },
  { kind: 'pillar', x: -4, z: 16, r: 0.45, h: 1.6 },
];

export function genWorld(seed) {
  SEED = seed >>> 0;
  NODES.length = 0; PROPS.length = 0; STATIC_OBS.length = 0;
  for (const k of Object.keys(PART_SPOTS)) delete PART_SPOTS[k];
  const R = rng(SEED);
  const taken = [];
  const free = (x, z, r) => {
    if (Math.abs(x) > WORLD.half - 3 || Math.abs(z) > WORLD.half - 3) return false;
    if (slabDist(x, z) < 3 + r) return false;
    if (Math.hypot(x - CORE.x, z - CORE.z) < 5) return false;
    if (corridorDist(x, z) < 3.2 + r) return false;
    if (gateDist(x, z) < 5.5 + r) return false;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1 + r) return false;
    return taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r + 1.6);
  };
  const place = (type, x, z) => {
    taken.push({ x, z, r: NODE_TYPES[type].r });
    NODES.push({ id: NODES.length, type, x, z, rot: R() * Math.PI * 2 });
  };
  // Un débris de chaque matière près de l'usine, à une place différente à chaque partie
  const firstOf = {};
  for (const [type, def] of Object.entries(NODE_TYPES)) if (!firstOf[def.item] && type !== 'epave') firstOf[def.item] = type;
  const near = Object.values(firstOf);
  for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
  // (un point tiré n'importe où sur le tour de l'usine, pas seulement vers les coins)
  const W = SLAB.x1 - SLAB.x0, Dp = SLAB.z1 - SLAB.z0, per = 2 * (W + Dp);
  for (const type of near) {
    for (let g = 0; g < 400; g++) {
      const t = R() * per, d = 4 + R() * 8, side = (R() - 0.5) * 3;
      let x, z;
      if (t < W) { x = SLAB.x0 + t; z = SLAB.z0 - d; }
      else if (t < W + Dp) { x = SLAB.x1 + d; z = SLAB.z0 + (t - W); }
      else if (t < 2 * W + Dp) { x = SLAB.x1 - (t - W - Dp); z = SLAB.z1 + d; }
      else { x = SLAB.x0 - d; z = SLAB.z1 - (t - 2 * W - Dp); }
      x += side; z += side;
      if (!free(x, z, NODE_TYPES[type].r)) continue;
      place(type, x, z);
      break;
    }
  }
  // Le reste, au hasard sur tout le terrain vague
  const bag = [];
  for (const [type, n] of Object.entries(NODE_MIX)) for (let k = 0; k < n; k++) bag.push(type);
  for (const type of bag) {
    for (let g = 0; g < 300; g++) {
      const x = (R() * 2 - 1) * (WORLD.half - 3), z = (R() * 2 - 1) * (WORLD.half - 3);
      if (!free(x, z, NODE_TYPES[type].r)) continue;
      place(type, x, z);
      break;
    }
  }

  // Décor
  const D = rng(SEED ^ 0x9e3779b9);
  const decorFree = (x, z, r) => {
    if (Math.abs(x) > WORLD.half - 1 || Math.abs(z) > WORLD.half - 1) return false;
    if (slabDist(x, z) < 1 + r) return false;
    if (Math.hypot(x - CORE.x, z - CORE.z) < 4) return false;
    if (corridorDist(x, z) < 2.6 + r) return false;
    return NODES.every((n) => Math.hypot(n.x - x, n.z - z) > NODE_TYPES[n.type].r + r + 0.8);
  };
  for (let i = 0; i < 230; i++) {
    const x = (D() * 2 - 1) * (WORLD.half - 2), z = (D() * 2 - 1) * (WORLD.half - 2);
    const k = D();
    let kind;
    if (k < 0.22) kind = 'rubble';
    else if (k < 0.34) kind = 'barrel';
    else if (k < 0.42) kind = 'tires';
    else if (k < 0.56) kind = 'grass';
    else if (k < 0.64) kind = 'deadtree';
    else if (k < 0.72) kind = 'block';
    else if (k < 0.8) kind = 'shards';
    else if (k < 0.88) kind = 'pipe';
    else kind = 'rock';
    const r = { rubble: 0.8, barrel: 0.5, tires: 0.6, grass: 0.3, deadtree: 0.6, block: 1.0, shards: 0.5, pipe: 1.2, rock: 0.7 }[kind];
    if (!decorFree(x, z, r)) continue;
    const solid = ['block', 'deadtree', 'pipe', 'rock'].includes(kind);
    // Les obstacles du décor laissent libres les abords de l'usine et ses passages
    if (solid && (slabDist(x, z) < 3 + r || gateDist(x, z) < 5.5 + r)) continue;
    if (kind === 'deadtree' && slabDist(x, z) < 6) continue;
    PROPS.push({ kind, x, z, rot: D() * Math.PI * 2, s: 0.8 + D() * 0.5, r });
  }
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    const rr = 38.5 + Math.sin(a * 5) * 0.6;
    if (D() < 0.25) continue;
    PROPS.push({ kind: 'fence', x: Math.cos(a) * rr, z: Math.sin(a) * rr, rot: -a, s: 1, lean: (D() - 0.5) * 0.5 });
  }

  // Obstacles
  for (const n of NODES) STATIC_OBS.push({ c: true, x: n.x, z: n.z, r: NODE_TYPES[n.type].r * 0.75 });
  for (const p of PROPS) {
    if (['block', 'deadtree', 'pipe', 'rock'].includes(p.kind)) STATIC_OBS.push({ c: true, x: p.x, z: p.z, r: p.r * 0.7 * p.s });
  }
  for (const w of RUINS) {
    if (w.kind === 'wall') STATIC_OBS.push({ x: w.x, z: w.z, w: w.w, d: w.d });
    else STATIC_OBS.push({ c: true, x: w.x, z: w.z, r: w.r });
  }
  STATIC_OBS.push({ x: ENTREPOT.x, z: ENTREPOT.z, w: ENTREPOT.w, d: ENTREPOT.d });
  // Coin pause : canapés et table basse, comptoir du café, plante
  STATIC_OBS.push({ x: PAUSE.x, z: PAUSE.z, w: 2.2, d: 2.9 });
  STATIC_OBS.push({ x: PAUSE.x, z: PAUSE.z - 1.85, w: 1.1, d: 0.5 });
  STATIC_OBS.push({ c: true, x: PAUSE.x - 1.3, z: PAUSE.z + 1.75, r: 0.3 });
  for (const [x, z] of LAMP_POSTS) STATIC_OBS.push({ c: true, x, z, r: 0.2 });

  // Pièces lourdes : dans le terrain vague, plus loin pour les machines des derniers niveaux,
  // sur une place dégagée et sans mur entre elles et la dalle (pour les porter à deux)
  const Q = rng(SEED ^ 0x51ed27);
  const spots = [{ x: CORE.x, z: CORE.z }];
  const clearAround = (x, z) => STATIC_OBS.every((o) => (o.c ? Math.hypot(o.x - x, o.z - z) > o.r + 2.6 : Math.abs(o.x - x) > o.w / 2 + 2.6 || Math.abs(o.z - z) > o.d / 2 + 2.6));
  const wallFree = (x, z) => {
    const ex = Math.max(SLAB.x0 + 1, Math.min(SLAB.x1 - 1, x)), ez = Math.max(SLAB.z0 + 1, Math.min(SLAB.z1 - 1, z));
    for (let t = 0; t <= 1; t += 0.05) {
      const px = x + (ex - x) * t, pz = z + (ez - z) * t;
      if (RUINS.some((w) => (w.kind === 'wall' ? Math.abs(w.x - px) < w.w / 2 + 2.2 && Math.abs(w.z - pz) < w.d / 2 + 2.2 : Math.hypot(w.x - px, w.z - pz) < w.r + 2.2))) return false;
    }
    return true;
  };
  for (const p of PLOTS) {
    if (!HEAVY[p.type] || p.type === 'assembleur') continue;
    const far = p.level <= 2 ? [4.5, 8] : [5, 13];
    let best = null;
    for (let g = 0; g < 600 && !best; g++) {
      const a = Q() * Math.PI * 2, d = far[0] + Q() * (far[1] - far[0]);
      const cx = Math.max(SLAB.x0, Math.min(SLAB.x1, Math.cos(a) * 60)), cz = Math.max(SLAB.z0, Math.min(SLAB.z1, Math.sin(a) * 60));
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.abs(x) > WORLD.half - 4 || Math.abs(z) > WORLD.half - 4 || slabDist(x, z) < far[0] - 0.5) continue;
      if (gateDist(x, z) < 4 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) continue;
      if (spots.some((q) => Math.hypot(q.x - x, q.z - z) < 4.5) || !clearAround(x, z) || !wallFree(x, z)) continue;
      best = { x, z };
    }
    // Rien de libre (très rare) : à côté de l'usine, côté est
    if (!best) best = { x: SLAB.x1 + 4 + (spots.length % 4) * 0.5, z: SLAB.z0 + 3 + spots.length * 2.2 };
    spots.push(best);
    PART_SPOTS[p.id] = best;
  }
}

export function plotBox(p) { const m = MACHINES[p.type]; return { x: p.x, z: p.z, w: m.w, d: m.d }; }
export const PLOT_BY_ID = Object.fromEntries(PLOTS.map((p) => [p.id, p]));

// ---------- aménagement : les machines peuvent être déplacées sur la dalle ----------
// Les emplacements d'origine restent dans x0/z0 ; S.layout garde ceux choisis par les joueurs.
for (const p of PLOTS) { p.x0 = p.x; p.z0 = p.z; }
export function applyLayout(S) {
  for (const p of PLOTS) {
    const o = S && S.layout && S.layout[p.id];
    p.x = o ? o.x : p.x0; p.z = o ? o.z : p.z0;
  }
}
const overlap = (a, b, m) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + m;
// Peut-on poser cette machine ici ? Renvoie null si oui, sinon la raison.
export function placeWhy(S, id, x, z) {
  const p = PLOT_BY_ID[id];
  if (!p || !Number.isFinite(x) || !Number.isFinite(z)) return 'emplacement invalide';
  const m = MACHINES[p.type];
  const box = { x, z, w: m.w, d: m.d };
  // Place pour les postes à deux (gauche, droite) et le devant de la machine
  if (x - m.w / 2 - 1.3 < SLAB.x0 + 0.3 || x + m.w / 2 + 1.3 > SLAB.x1 - 0.3 || z - m.d / 2 - 0.6 < SLAB.z0 + 0.4 || z + m.d / 2 + 1.4 > SLAB.z1 - 0.3) return 'trop près du bord de la dalle';
  for (const q of PLOTS) if (q.id !== id && overlap(box, plotBox(q), 1.2)) return 'trop près : ' + MACHINES[q.type].name.toLowerCase();
  if (overlap(box, ENTREPOT, 1.4)) return 'trop près de l’entrepôt';
  if (overlap(box, { x: PAUSE.x, z: PAUSE.z - 0.4, w: 3.4, d: 4.6 }, 1.0)) return 'trop près du coin pause';
  for (const g of GATES) if (Math.abs(g.in.x - x) < m.w / 2 + 1.2 && Math.abs(g.in.z - z) < m.d / 2 + 1.2) return 'devant un passage des ruines';
  for (const w of RUINS) if (w.kind === 'wall' && overlap(box, w, 0.8)) return 'contre un mur';
  for (const [lx, lz] of LAMP_POSTS) if (Math.abs(lx - x) < m.w / 2 + 1.4 && Math.abs(lz - z) < m.d / 2 + 1.0) return 'contre un lampadaire';
  for (const pl of Object.values((S && S.players) || {})) if (Math.abs(pl.x - x) < m.w / 2 + 0.5 && Math.abs(pl.z - z) < m.d / 2 + 0.5) return 'quelqu’un est sur la place';
  return null;
}

// Points de départ des créatures
export const ANIMAL_HOMES = [
  { x: 30, z: -6 }, { x: -6, z: -28 }, { x: -31, z: -8 },
  { x: 8, z: 29 }, { x: -24, z: 30 }, { x: 31, z: 26 },
  { x: 14, z: -32 }, { x: -33, z: -30 },
];
