// Modèles 3D procéduraux : terrain vague, débris, ruines, machines, humains, droïdes, créatures.
import { Node, mesh, meshes, mat, bake, box, cylinder, sphere, torus, plane, ring, lump, terrain, P } from './gl.js';
import { WORLD, SLAB, NODE_TYPES, MACHINES, ENTREPOT, CORE, DROIDS, PLAYER_COLORS, ITEMS } from './config.js';
import { height, noise, rng, NODES, PROPS, RUINS, POND } from './world.js';

export const C = {
  dirt: [0.56, 0.48, 0.39], grass: [0.50, 0.49, 0.31], wet: [0.37, 0.31, 0.26], sand: [0.70, 0.64, 0.54], rustdirt: [0.55, 0.42, 0.33],
  concrete: [0.44, 0.43, 0.41], steel: [0.58, 0.60, 0.63], dark: [0.20, 0.21, 0.23], rustMetal: [0.46, 0.43, 0.40],
  clay: [0.58, 0.24, 0.15], lime: [0.88, 0.85, 0.78], glass: [0.62, 0.86, 0.88], water: [0.10, 0.20, 0.22],
  wood: [0.40, 0.32, 0.25], rubber: [0.11, 0.11, 0.12], yellow: [0.90, 0.68, 0.14], copper: [0.76, 0.47, 0.27],
  skin: [0.88, 0.70, 0.56], white: [0.92, 0.92, 0.90], canvas: [0.45, 0.36, 0.26], green: [0.24, 0.55, 0.32],
};
const G = {}; // géométries partagées
const geo = (k, f) => G[k] || (G[k] = f());
const B = (w, h, d, y0 = 0) => geo(`b${w}|${h}|${d}|${y0}`, () => box(w, h, d, y0));
const CY = (rt, rb, h, s = 12, y0 = 0) => geo(`c${rt}|${rb}|${h}|${s}|${y0}`, () => cylinder(rt, rb, h, s, true, y0));
const SP = (r, ws = 12, hs = 8) => geo(`s${r}|${ws}|${hs}`, () => sphere(r, ws, hs, 0));
const TO = (R, r) => geo(`t${R}|${r}`, () => torus(R, r, 18, 8));
const vary = (c, rnd, k = 0.12) => { const f = 1 - k + rnd() * k * 2; return c.map((x) => Math.min(1, x * f)); };

// ---------- terrain ----------
export function buildGround() {
  const root = new Node();
  const r = rng(5);
  const cfn = (x, z, y) => {
    let c = C.dirt;
    const n1 = noise(x * 0.12 + 3, z * 0.12 - 2), n2 = noise(x * 0.5, z * 0.5);
    if (n1 > 0.58) c = mixc(C.dirt, C.grass, Math.min(1, (n1 - 0.58) * 5));
    if (z > 15) c = mixc(c, C.sand, Math.min(1, (z - 15) / 6));
    if (x > 17 && z < 2) c = mixc(c, C.rustdirt, Math.min(1, (x - 17) / 5));
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (pd < POND.r + 5) c = mixc(c, C.wet, Math.min(1, (POND.r + 5 - pd) / 4));
    const k = 0.9 + n2 * 0.2 + (r() - 0.5) * 0.04;
    return c.map((v) => v * k);
  };
  const chunks = terrain(WORLD.half * 2 + 8, 1, height, cfn);
  root.add(meshes(chunks, mat([1, 1, 1], { pattern: P.ground, cast: false })));
  // Dalle de l'usine (béton fissuré)
  const sw = SLAB.x1 - SLAB.x0, sd = SLAB.z1 - SLAB.z0;
  root.add(mesh(box(sw, 0.3, sd, -0.26), mat(C.concrete, { pattern: P.concrete, cast: false })).at((SLAB.x0 + SLAB.x1) / 2, 0, (SLAB.z0 + SLAB.z1) / 2));
  // Mare
  const w = mesh(ring(0, POND.r + 1.2, 40), mat(C.water, { pattern: P.water, opacity: 0.86, cast: false }));
  w.pos = [POND.x, -0.42, POND.z];
  root.add(w);
  return root;
}
function mixc(a, b, t) { return a.map((x, i) => x + (b[i] - x) * t); }

// ---------- ruines et décor (fusionnés par matière) ----------
export function buildDecor() {
  const root = new Node();
  const L = { concrete: [], rust: [], rubber: [], grass: [], wood: [], glass: [], rock: [], paint: [] };
  const r = rng(99);
  const y = (x, z) => height(x, z);
  for (const w of RUINS) {
    if (w.kind === 'wall') {
      const along = w.w > w.d ? 'x' : 'z', len = Math.max(w.w, w.d), n = Math.ceil(len / 1.2);
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * (len / n);
        const h = Math.max(0.4, w.h + (r() - 0.5) * 1.2 - (i % 4 === 3 ? 0.9 : 0));
        const px = along === 'x' ? w.x + t : w.x, pz = along === 'z' ? w.z + t : w.z;
        L.concrete.push({ g: B(along === 'x' ? len / n + 0.02 : w.w, h, along === 'z' ? len / n + 0.02 : w.d), p: [px, 0, pz], c: vary(C.concrete, r, 0.08) });
        if (r() < 0.4) L.rust.push({ g: B(0.04, 0.6, 0.04), p: [px + (r() - 0.5) * 0.4, h - 0.1, pz], r: [r() * 0.5, 0, r() * 0.5], c: C.rustMetal });
      }
    } else {
      L.concrete.push({ g: CY(w.r * 0.9, w.r, w.h, 10), p: [w.x, 0, w.z], c: vary(C.concrete, r, 0.06) });
      for (let k = 0; k < 3; k++) L.rust.push({ g: B(0.05, 0.9, 0.05), p: [w.x + (r() - 0.5) * 0.4, w.h - 0.2, w.z + (r() - 0.5) * 0.4], r: [r() * 0.6 - 0.3, 0, r() * 0.6 - 0.3], c: C.rustMetal });
    }
  }
  for (const p of PROPS) {
    const yy = y(p.x, p.z);
    switch (p.kind) {
      case 'rubble':
        for (let k = 0; k < 5; k++) L.concrete.push({ g: B(0.3 + r() * 0.5, 0.2 + r() * 0.3, 0.3 + r() * 0.4), p: [p.x + (r() - 0.5) * 1.2, yy - 0.05, p.z + (r() - 0.5) * 1.2], r: [r() * 0.6, r() * 3, r() * 0.6], c: vary(C.concrete, r, 0.1) });
        break;
      case 'barrel': {
        const lying = r() < 0.4;
        const tint = [[0.25, 0.35, 0.55], [0.55, 0.20, 0.15], [0.30, 0.40, 0.28], [0.5, 0.48, 0.45]][Math.floor(r() * 4)];
        const rot = lying ? [0, p.rot, Math.PI / 2] : [0, p.rot, 0];
        const pos = lying ? [p.x, yy + 0.3, p.z] : [p.x, yy, p.z];
        L.paint.push({ g: CY(0.3, 0.3, 0.9, 14, lying ? -0.45 : 0), p: pos, r: rot, c: tint });
        break;
      }
      case 'tires': {
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) L.rubber.push({ g: TO(0.32, 0.12), p: [p.x + (r() - 0.5) * 0.1, yy + 0.12 + k * 0.22, p.z], r: [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2], c: C.rubber });
        break;
      }
      case 'grass':
        for (let k = 0; k < 7; k++) L.grass.push({ g: CY(0.0, 0.035, 0.4 + r() * 0.4, 4), p: [p.x + (r() - 0.5) * 0.6, yy, p.z + (r() - 0.5) * 0.6], r: [(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6], c: vary([0.62, 0.58, 0.36], r, 0.15) });
        break;
      case 'deadtree': {
        const h = 2.4 + r() * 1.4;
        L.wood.push({ g: CY(0.1, 0.2, h, 8), p: [p.x, yy - 0.1, p.z], r: [(r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15], c: C.wood });
        for (let k = 0; k < 4; k++) {
          const a = r() * Math.PI * 2;
          L.wood.push({ g: CY(0.02, 0.07, 0.9 + r() * 0.8, 6), p: [p.x, yy + h * (0.45 + r() * 0.45), p.z], r: [Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9], c: C.wood });
        }
        break;
      }
      case 'block':
        L.concrete.push({ g: B(1.6 * p.s, 0.8, 1.0 * p.s), p: [p.x, yy - 0.1, p.z], r: [r() * 0.15, p.rot, r() * 0.12], c: vary(C.concrete, r, 0.08) });
        L.rust.push({ g: B(0.05, 0.5, 0.05), p: [p.x, yy + 0.6, p.z], r: [0.4, p.rot, 0.2], c: C.rustMetal });
        break;
      case 'shards':
        for (let k = 0; k < 4; k++) L.glass.push({ g: B(0.3 + r() * 0.4, 0.02, 0.25 + r() * 0.3), p: [p.x + (r() - 0.5) * 0.9, yy + 0.03, p.z + (r() - 0.5) * 0.9], r: [r() * 0.3, r() * 3, r() * 0.3], c: C.glass });
        break;
      case 'pipe':
        L.rust.push({ g: CY(0.45, 0.45, 2.4 * p.s, 14, -1.2 * p.s), p: [p.x, yy + 0.4, p.z], r: [0, p.rot, Math.PI / 2], c: vary(C.rustMetal, r) });
        break;
      case 'rock':
        L.rock.push({ g: geo('rock' + (Math.abs(p.x | 0) % 5), () => lump(0.7, (Math.abs(p.x | 0) % 5) + 2, 0.35, 12, 8, 0.7)), p: [p.x, yy + 0.1, p.z], r: [0, p.rot, 0], s: [p.s, p.s, p.s], c: vary([0.66, 0.62, 0.56], r, 0.1) });
        break;
      case 'fence': {
        const fy = y(p.x, p.z);
        L.rust.push({ g: B(0.08, 1.7, 0.08), p: [p.x, fy - 0.1, p.z], r: [p.lean, 0, 0], c: C.rustMetal });
        L.rust.push({ g: B(0.02, 0.02, 4.0), p: [p.x, fy + 1.3, p.z], r: [p.lean * 0.5, p.rot, 0], c: C.rustMetal });
        L.rust.push({ g: B(0.02, 0.02, 4.0), p: [p.x, fy + 0.7, p.z], r: [p.lean * 0.3, p.rot, 0.1], c: C.rustMetal });
        break;
      }
    }
  }
  const M = {
    concrete: mat([1, 1, 1], { pattern: P.concrete }),
    rust: mat([1, 1, 1], { pattern: P.rust }),
    rubber: mat([1, 1, 1], { pattern: P.rubber }),
    grass: mat([1, 1, 1], { pattern: P.ground, cast: false }),
    wood: mat([1, 1, 1], { pattern: P.wood }),
    glass: mat([1, 1, 1], { pattern: P.glass, opacity: 0.38, cast: false }),
    rock: mat([1, 1, 1], { pattern: P.rock }),
    paint: mat([1, 1, 1], { pattern: P.paint }),
  };
  for (const k of Object.keys(L)) if (L[k].length) root.add(meshes(bake(L[k]), M[k]));
  return root;
}

// ---------- débris à fouiller ----------
export function nodeModel(n) {
  const r = rng(n.id * 31 + 7);
  const parts = { rust: [], glass: [], clay: [], rock: [], rubber: [], paint: [], water: [], wood: [], sand: [], coal: [], plastic: [] };
  switch (n.type) {
    case 'epave': {
      const paint = [[0.30, 0.38, 0.55], [0.55, 0.25, 0.18], [0.35, 0.45, 0.32], [0.6, 0.58, 0.5]][Math.floor(r() * 4)];
      parts.rust.push({ g: B(3.4, 0.55, 1.6), p: [0, 0.32, 0], c: paint });
      parts.rust.push({ g: B(1.8, 0.62, 1.42), p: [-0.25, 0.86, 0], r: [0.05, 0, (r() - 0.5) * 0.12], c: paint });
      parts.rust.push({ g: B(0.9, 0.08, 1.3), p: [1.9, 0.3, 0.4], r: [0, 0.5, 0.6], c: paint });
      parts.glass.push({ g: B(0.05, 0.42, 1.2), p: [0.66, 0.95, 0], r: [0, 0, -0.35], c: C.glass });
      for (const [x, z] of [[-1.15, 0.78], [1.15, 0.78], [-1.15, -0.78]]) if (r() < 0.8) parts.rubber.push({ g: TO(0.3, 0.12), p: [x, 0.3, z], r: [Math.PI / 2, 0, 0], c: C.rubber });
      break;
    }
    case 'ferraille':
      for (let k = 0; k < 10; k++) (k % 3 ? parts.paint : parts.rust).push({ g: B(0.3 + r() * 1.1, 0.06 + r() * 0.12, 0.2 + r() * 0.6), p: [(r() - 0.5) * 1.1, 0.05 + k * 0.09, (r() - 0.5) * 1.1], r: [(r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7], c: vary([0.56, 0.62, 0.70], r, 0.15) });
      parts.paint.push({ g: B(0.12, 0.12, 1.6), p: [0.2, 0.55, 0.1], r: [0.3, 0.7, 0.2], c: [0.5, 0.55, 0.6] });
      parts.paint.push({ g: CY(0.06, 0.06, 1.3, 8, -0.65), p: [-0.4, 0.45, 0.3], r: [0, 1.2, Math.PI / 2 - 0.3], c: [0.6, 0.64, 0.7] });
      break;
    case 'vitres':
      for (let k = 0; k < 3; k++) {
        const a = (k - 1) * 0.5, x = (k - 1) * 0.7, lean = 0.25 + r() * 0.3;
        for (const [w, h, ox, oy] of [[1.1, 0.06, 0, 0], [1.1, 0.06, 0, 1.3], [0.06, 1.36, -0.53, 0], [0.06, 1.36, 0.53, 0]]) parts.paint.push({ g: B(w, h, 0.06), p: [x + ox * Math.cos(a), oy * Math.cos(lean) + 0.02, -ox * Math.sin(a) - oy * Math.sin(lean)], r: [-lean, a, 0], c: [0.55, 0.58, 0.6] });
        parts.glass.push({ g: B(1.0, 0.8 + r() * 0.4, 0.02), p: [x, 0.05, 0], r: [-lean, a, 0], c: C.glass });
      }
      for (let k = 0; k < 6; k++) parts.glass.push({ g: B(0.3 + r() * 0.3, 0.02, 0.2 + r() * 0.3), p: [(r() - 0.5) * 1.6, 0.03, 0.5 + r() * 0.5], r: [r() * 0.3, r() * 3, r() * 0.3], c: C.glass });
      break;
    case 'argile':
      parts.clay.push({ g: lump(1.25, n.id + 3, 0.3, 14, 9, 0.45), p: [0, 0, 0], c: C.clay });
      for (let k = 0; k < 3; k++) parts.clay.push({ g: lump(0.45, n.id + 11 + k, 0.35, 10, 7, 0.6), p: [(r() - 0.5) * 2.4, 0, (r() - 0.5) * 2.4], c: vary(C.clay, r) });
      parts.water.push({ g: ring(0, 0.8, 20), p: [1.0, 0.04, 0.9], c: [0.45, 0.22, 0.14] });
      parts.wood.push({ g: B(0.08, 0.9, 0.2), p: [-0.6, 0.6, 0.7], r: [0.5, 0.4, 0.2], c: [0.42, 0.33, 0.24] });
      break;
    case 'calcaire':
      for (let k = 0; k < 5; k++) {
        const s = 0.5 + r() * 0.5;
        parts.rock.push({ g: B(0.9 * s, 0.7 * s, 0.8 * s), p: [(r() - 0.5) * 1.6, -0.05, (r() - 0.5) * 1.6], r: [r() * 0.2, r() * 3, r() * 0.2], c: vary(C.lime, r, 0.05) });
      }
      parts.rock.push({ g: lump(0.5, n.id, 0.4, 10, 7, 0.8), p: [0.2, 0.55, 0.1], c: C.lime });
      break;
    case 'citerne':
      parts.rust.push({ g: CY(0.75, 0.75, 2.2, 16, -1.1), p: [0, 0.9, 0], r: [0, n.rot, Math.PI / 2 - 0.25], c: [0.5, 0.48, 0.44] });
      for (const x of [-0.6, 0.6]) parts.rust.push({ g: B(0.12, 0.5, 1.1), p: [x, 0, 0], r: [0, n.rot, 0], c: C.rustMetal });
      parts.water.push({ g: ring(0, 1.3, 24), p: [0.6, 0.04, 0.7], c: [1, 1, 1] });
      break;
    case 'cables': {
      parts.rust.push({ g: B(0.35, 0.35, 3.2), p: [0, 0.18, 0], r: [0, 0.3, 0.05], c: C.rustMetal });
      parts.rust.push({ g: B(0.2, 1.6, 0.2), p: [0.3, 0, -1.3], r: [0.6, 0.3, 0.2], c: C.rustMetal });
      for (const [x, z, s2] of [[-0.8, 0.6, 1], [0.7, 0.9, 0.8]]) {
        parts.wood.push({ g: CY(0.55 * s2, 0.55 * s2, 0.12, 16, -0.3 * s2), p: [x, 0.55 * s2, z], r: [Math.PI / 2, 0.4, 0], c: [0.45, 0.34, 0.24] });
        parts.wood.push({ g: CY(0.55 * s2, 0.55 * s2, 0.12, 16, 0.18 * s2), p: [x, 0.55 * s2, z], r: [Math.PI / 2, 0.4, 0], c: [0.45, 0.34, 0.24] });
        parts.paint.push({ g: CY(0.4 * s2, 0.4 * s2, 0.5 * s2, 16, -0.25 * s2), p: [x, 0.55 * s2, z], r: [Math.PI / 2, 0.4, 0], c: [0.85, 0.48, 0.18] });
      }
      for (let k = 0; k < 3; k++) parts.paint.push({ g: TO(0.35 + k * 0.08, 0.025), p: [-0.2 + k * 0.3, 0.03, -0.6], c: [0.88, 0.5, 0.2] });
      break;
    }
    case 'pneus':
      for (let k = 0; k < 7; k++) {
        const stack = k < 4;
        parts.rubber.push({ g: TO(0.38, 0.15), p: stack ? [-0.3 + (r() - 0.5) * 0.08, 0.15 + k * 0.28, -0.2] : [0.4 + (r() - 0.5) * 0.6, 0.3, 0.4 + (k - 5) * 0.5], r: stack ? [(r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15] : [Math.PI / 2 - 0.3, r() * 3, 0], c: C.rubber });
      }
      break;
    case 'dune':
      parts.sand.push({ g: lump(1.5, n.id + 7, 0.2, 14, 9, 0.38), p: [0, -0.05, 0], c: [0.86, 0.76, 0.5] });
      parts.sand.push({ g: lump(0.7, n.id + 2, 0.25, 10, 7, 0.4), p: [1.2, -0.05, 0.6], c: [0.9, 0.8, 0.55] });
      parts.wood.push({ g: B(0.06, 0.06, 1.1), p: [0.3, 0.55, -0.2], r: [0.4, 0.8, 0.5], c: [0.55, 0.45, 0.35] });
      break;
    case 'charbon': {
      parts.rust.push({ g: B(1.5, 0.8, 1.0, 0.25), p: [0, 0, 0], c: [0.4, 0.36, 0.33] });
      for (const [x, z] of [[-0.55, 0.52], [0.55, 0.52], [-0.55, -0.52], [0.55, -0.52]]) parts.rubber.push({ g: CY(0.2, 0.2, 0.08, 12, -0.04), p: [x, 0.2, z], r: [Math.PI / 2, 0, 0], c: [0.2, 0.2, 0.2] });
      parts.coal.push({ g: lump(0.62, n.id + 5, 0.4, 12, 8, 0.6), p: [0, 1.0, 0], c: [0.12, 0.12, 0.13] });
      parts.coal.push({ g: lump(0.55, n.id + 9, 0.45, 12, 8, 0.5), p: [1.1, 0, 0.7], c: [0.11, 0.11, 0.12] });
      parts.rust.push({ g: B(0.08, 0.08, 2.6), p: [-0.5, 0.02, 0], r: [0, 1.4, 0], c: C.rustMetal });
      break;
    }
    case 'bidons': {
      const cols = [[0.88, 0.3, 0.58], [0.2, 0.55, 0.85], [0.92, 0.92, 0.9], [0.95, 0.75, 0.2]];
      for (let k = 0; k < 6; k++) {
        const c = cols[k % 4], lying = k > 3;
        parts.plastic.push({ g: B(0.42, 0.55, 0.26), p: [(r() - 0.5) * 1.3, lying ? 0.13 : 0, (r() - 0.5) * 1.3], r: lying ? [Math.PI / 2, r() * 3, 0] : [0, r() * 3, 0], c });
        if (!lying) parts.plastic.push({ g: B(0.14, 0.12, 0.08), p: [0, 0.58, 0], c });
      }
      parts.plastic.push({ g: CY(0.3, 0.3, 0.85, 14), p: [0.6, 0, -0.5], c: [0.2, 0.55, 0.85] });
      break;
    }
    case 'palettes':
      for (let k = 0; k < 5; k++) {
        const y = k * 0.16, a = (r() - 0.5) * 0.2, x0 = (r() - 0.5) * 0.15;
        for (let j = 0; j < 5; j++) parts.wood.push({ g: B(0.18, 0.03, 1.2), p: [x0 - 0.5 + j * 0.25, y + 0.12, 0], r: [0, a, 0], c: vary([0.66, 0.52, 0.34], r, 0.12) });
        for (const z of [-0.5, 0, 0.5]) parts.wood.push({ g: B(1.2, 0.1, 0.12), p: [x0, y, z], r: [0, a, 0], c: vary([0.58, 0.45, 0.3], r, 0.1) });
      }
      parts.wood.push({ g: B(1.2, 0.03, 0.18), p: [0.9, 0.3, 0.7], r: [0.8, 0.5, 0.3], c: [0.64, 0.5, 0.33] });
      break;
  }
  const root = new Node();
  const body = new Node();
  const M = {
    rust: mat([1, 1, 1], { pattern: P.rust }), glass: mat([1, 1, 1], { pattern: P.glass, opacity: 0.4, cast: false }),
    clay: mat([1, 1, 1], { pattern: P.clay }), rock: mat([1, 1, 1], { pattern: P.rock }), rubber: mat([1, 1, 1], { pattern: P.rubber }),
    paint: mat([1, 1, 1], { pattern: P.paint }), water: mat(C.water, { pattern: P.water, cast: false }),
    wood: mat([1, 1, 1], { pattern: P.wood }), sand: mat([1, 1, 1], { pattern: P.ground }),
    coal: mat([1, 1, 1], { pattern: P.rock, rough: 0.3 }), plastic: mat([1, 1, 1], { pattern: P.plain, rough: 0.35 }),
  };
  for (const k of Object.keys(parts)) if (parts[k].length) (k === 'water' ? root : body).add(meshes(bake(parts[k]), M[k]));
  root.add(body);
  root.body = body;
  root.pos = [n.x, height(n.x, n.z), n.z];
  root.rot[1] = n.rot;
  return root;
}

// ---------- machines ----------
function light() { return mesh(SP(0.11, 10, 8), mat([0.2, 0.5, 0.25], { emissive: [0.1, 0.5, 0.15] })); }

export function machineModel(type) {
  const root = new Node();
  const m = MACHINES[type];
  const anim = {};
  const pad = mesh(B(m.w + 0.4, 0.1, m.d + 0.4), mat([0.5, 0.5, 0.5], { pattern: P.concrete }));
  root.add(pad);
  if (type === 'forge') {
    const bricks = new Node();
    bricks.add(mesh(B(2.5, 1.3, 1.9, 0.1), mat(C.clay, { pattern: P.clay })));
    const dome = mesh(SP(1.05, 14, 8), mat([0.6, 0.34, 0.22], { pattern: P.clay }));
    dome.pos = [0, 1.35, 0]; dome.scl = [1.15, 0.55, 0.88];
    bricks.add(dome);
    bricks.add(mesh(CY(0.22, 0.27, 2.3, 12), mat(C.rustMetal, { pattern: P.rust })).at(0.75, 1.2, -0.5));
    const mouth = mesh(B(0.8, 0.55, 0.05), mat([0.06, 0.04, 0.03]));
    mouth.pos = [0, 0.45, 0.96];
    bricks.add(mouth);
    bricks.add(mesh(B(0.5, 0.35, 0.3), mat(C.dark, { pattern: P.rust })).at(1.25, 0.1, 0.9));
    bricks.add(mesh(B(0.7, 0.2, 0.25), mat(C.dark, { pattern: P.paint })).at(1.25, 0.45, 0.9));
    bricks.add(mesh(B(0.9, 0.35, 0.5), mat(C.wood, { pattern: P.wood })).at(-1.15, 0.1, 0.85));
    const water = mesh(B(0.8, 0.02, 0.4), mat(C.water, { pattern: P.water, cast: false }));
    water.pos = [-1.15, 0.44, 0.85];
    bricks.add(water);
    root.add(bricks);
    anim.mouth = mouth;
  } else if (type === 'circuits') {
    root.add(mesh(B(2.6, 0.9, 1.7, 0.1), mat(C.steel, { pattern: P.paint })));
    root.add(mesh(CY(0.72, 0.8, 0.25, 18), mat(C.dark, { pattern: P.paint })).at(-0.3, 1.0, 0));
    const coil = mesh(TO(0.32, 0.06), mat([0.3, 0.1, 0.05], { emissive: [0, 0, 0] }));
    coil.pos = [-0.3, 1.45, 0];
    root.add(coil);
    const dome = mesh(geo('halfdome', () => sphere(0.72, 18, 10, 0)), mat(C.glass, { pattern: P.glass, opacity: 0.32, cast: false }));
    dome.pos = [-0.3, 1.2, 0]; dome.scl = [1, 0.85, 1];
    root.add(dome);
    for (let k = 0; k < 4; k++) root.add(mesh(B(0.5, 0.03, 0.35), mat(C.green, { emissive: [0.0, 0.05, 0.02] })).at(0.85, 1.0 + k * 0.05, -0.2 + (k % 2) * 0.05));
    root.add(mesh(B(0.06, 0.9, 0.06), mat(C.dark)).at(1.15, 1.0, -0.6));
    root.add(mesh(B(0.4, 0.08, 0.25), mat([0.9, 0.85, 0.6], { emissive: [0.4, 0.38, 0.25] })).at(1.0, 1.85, -0.6));
    anim.coil = coil;
  } else if (type === 'assembleur') {
    root.add(mesh(B(3.2, 0.3, 2.4, 0.05), mat(C.dark, { pattern: P.paint })));
    const y = mat(C.yellow, { pattern: P.paint });
    for (const x of [-1.45, 1.45]) root.add(mesh(B(0.22, 2.6, 0.22, 0.3), y).at(x, 0, -0.9));
    root.add(mesh(B(3.12, 0.25, 0.25), y).at(0, 2.8, -0.9));
    root.add(mesh(B(2.8, 0.15, 0.7), mat(C.rubber, { pattern: P.rubber })).at(0, 0.38, 0.55));
    const core = mesh(SP(0.32, 14, 10), mat([0.2, 0.8, 0.9], { emissive: [0.1, 0.55, 0.65] }));
    core.pos = [0, 1.0, -0.4];
    root.add(core);
    root.add(mesh(TO(0.42, 0.04), mat(C.steel, { pattern: P.paint })).at(0, 1.0, -0.4));
    const arm = new Node().at(0, 2.7, -0.9);
    arm.add(mesh(B(0.18, 0.18, 0.9, 0), mat(C.steel, { pattern: P.paint })).at(0, -0.1, 0.45));
    const fore = new Node().at(0, -0.1, 0.9);
    fore.add(mesh(B(0.14, 1.0, 0.14, -1.0), mat(C.steel, { pattern: P.paint })));
    fore.add(mesh(SP(0.1), mat([0.9, 0.3, 0.2], { emissive: [0.4, 0.1, 0.05] })).at(0, -1.05, 0));
    arm.add(fore);
    root.add(arm);
    anim.arm = arm; anim.core = core; anim.fore = fore;
  } else if (type === 'atelier') {
    root.add(mesh(CY(1.25, 1.3, 0.15, 24), mat(C.dark, { pattern: P.paint })).at(0, 0.1, 0));
    root.add(mesh(B(3.0, 2.2, 0.15, 0.1), mat([0.35, 0.38, 0.42], { pattern: P.paint })).at(0, 0, -1.15));
    for (let k = 0; k < 5; k++) root.add(mesh(B(0.07, 0.5 + (k % 2) * 0.2, 0.05), mat(C.steel)).at(-1.2 + k * 0.25, 1.2, -1.05));
    const screen = mesh(B(0.8, 0.5, 0.04), mat([0.1, 0.2, 0.3], { emissive: [0.1, 0.3, 0.5] }));
    screen.pos = [0.9, 1.3, -1.05];
    root.add(screen);
    const ringA = mesh(TO(1.0, 0.05), mat([0.6, 0.3, 0.9], { emissive: [0.25, 0.1, 0.45] }));
    ringA.pos = [0, 1.2, 0];
    root.add(ringA);
    anim.ring = ringA;
  } else if (type === 'trefileuse') {
    root.add(mesh(B(2.5, 0.7, 1.6, 0.1), mat([0.32, 0.42, 0.5], { pattern: P.paint })));
    const spool = new Node().at(-0.5, 1.35, 0);
    spool.add(mesh(CY(0.55, 0.55, 0.08, 18, -0.42), mat(C.dark, { pattern: P.paint })));
    spool.add(mesh(CY(0.55, 0.55, 0.08, 18, 0.34), mat(C.dark, { pattern: P.paint })));
    spool.add(mesh(CY(0.42, 0.42, 0.7, 18, -0.35), mat([0.88, 0.5, 0.2], { rough: 0.25 })));
    spool.rot = [Math.PI / 2, 0, 0];
    root.add(spool);
    root.add(mesh(B(0.5, 0.5, 0.5), mat(C.steel, { pattern: P.paint })).at(0.7, 0.8, 0));
    root.add(mesh(CY(0.03, 0.03, 1.0, 6, -0.5), mat([0.9, 0.55, 0.25], { rough: 0.2 })).at(0.15, 1.15, 0).rotY(0));
    root.add(mesh(B(0.35, 0.3, 0.6), mat([0.25, 0.25, 0.28], { pattern: P.paint })).at(1.0, 0.8, 0.5));
    anim.spool = spool;
  } else if (type === 'generateur') {
    root.add(mesh(B(2.3, 1.0, 1.5, 0.1), mat([0.22, 0.38, 0.28], { pattern: P.paint })));
    root.add(mesh(B(1.2, 0.5, 1.2), mat([0.18, 0.3, 0.22], { pattern: P.paint })).at(-0.3, 1.1, 0));
    const fly = new Node().at(1.3, 0.8, 0);
    fly.add(mesh(CY(0.6, 0.6, 0.12, 20, -0.06), mat(C.dark, { pattern: P.paint })));
    fly.add(mesh(B(1.1, 0.08, 0.13), mat(C.yellow, { pattern: P.paint })).at(0, 0, 0));
    fly.rot = [0, 0, Math.PI / 2];
    root.add(fly);
    const pipe = mesh(CY(0.13, 0.15, 1.6, 10), mat(C.rustMetal, { pattern: P.rust }));
    pipe.pos = [-0.8, 1.1, -0.45];
    root.add(pipe);
    const tip = mesh(CY(0.14, 0.14, 0.08, 10), mat([0.2, 0.1, 0.05], { emissive: [0, 0, 0] }));
    tip.pos = [-0.8, 2.7, -0.45];
    root.add(tip);
    root.add(mesh(B(0.8, 0.45, 0.6), mat(C.rustMetal, { pattern: P.rust })).at(-0.55, 0.1, 0.85));
    root.add(mesh(lump(0.3, 3, 0.4, 8, 6, 0.6), mat([0.12, 0.12, 0.13], { pattern: P.rock })).at(-0.55, 0.55, 0.85));
    anim.fly = fly; anim.tip = tip;
  } else if (type === 'fonderie') {
    root.add(mesh(B(2.4, 1.2, 1.9, 0.1), mat([0.5, 0.3, 0.24], { pattern: P.clay })));
    root.add(mesh(CY(0.3, 0.38, 2.6, 12), mat([0.45, 0.28, 0.22], { pattern: P.clay })).at(-0.8, 1.3, -0.5));
    const cru = mesh(CY(0.5, 0.42, 0.55, 16), mat([0.25, 0.22, 0.2], { pattern: P.rust }));
    cru.pos = [0.35, 1.3, 0.1];
    root.add(cru);
    const melt = mesh(CY(0.44, 0.44, 0.04, 16), mat([0.4, 0.15, 0.05], { emissive: [0.2, 0.05, 0] }));
    melt.pos = [0.35, 1.8, 0.1];
    root.add(melt);
    root.add(mesh(B(0.9, 0.12, 0.4), mat(C.steel, { pattern: P.paint })).at(0.4, 0.5, 1.05));
    for (let k = 0; k < 3; k++) root.add(mesh(B(0.32, 0.12, 0.16), mat([0.6, 0.64, 0.7], { rough: 0.3 })).at(0.15 + k * 0.25, 0.62, 1.05));
    anim.melt = melt;
  } else if (type === 'laminoir') {
    root.add(mesh(B(3.0, 0.5, 1.6, 0.1), mat([0.3, 0.33, 0.38], { pattern: P.paint })));
    for (const x of [-0.6, 0.6]) {
      root.add(mesh(B(0.2, 1.6, 1.5, 0.1), mat(C.yellow, { pattern: P.paint })).at(x, 0, 0));
    }
    const rollers = [];
    for (const y of [0.95, 1.4]) {
      const rl = mesh(CY(0.22, 0.22, 1.1, 16, -0.55), mat([0.62, 0.65, 0.7], { rough: 0.2 }));
      rl.pos = [0, y, 0]; rl.rot = [0, 0, Math.PI / 2];
      root.add(rl); rollers.push(rl);
    }
    root.add(mesh(B(1.0, 0.03, 0.9), mat([0.7, 0.72, 0.76], { rough: 0.2 })).at(-1.0, 0.62, 0));
    root.add(mesh(B(1.0, 0.03, 0.9), mat([0.7, 0.72, 0.76], { rough: 0.2 })).at(1.0, 0.62, 0));
    anim.rollers = rollers;
  } else if (type === 'qualite') {
    root.add(mesh(B(2.8, 0.15, 0.8), mat(C.rubber, { pattern: P.rubber })).at(0, 0.7, 0.3));
    root.add(mesh(B(2.8, 0.6, 0.8, 0.1), mat([0.85, 0.86, 0.88], { pattern: P.paint })).at(0, 0, 0.3));
    for (const x of [-0.5, 0.5]) root.add(mesh(B(0.12, 1.5, 0.12, 0.7), mat([0.85, 0.86, 0.88], { pattern: P.paint })).at(x, 0, 0.3));
    root.add(mesh(B(1.12, 0.15, 0.3), mat([0.85, 0.86, 0.88], { pattern: P.paint })).at(0, 2.2, 0.3));
    const beam = mesh(B(0.9, 0.04, 0.04), mat([0.2, 0.9, 0.4], { emissive: [0.1, 0.8, 0.3] }));
    beam.pos = [0, 1.4, 0.3];
    root.add(beam);
    root.add(mesh(B(0.8, 1.1, 0.5, 0.1), mat([0.25, 0.28, 0.32], { pattern: P.paint })).at(0.9, 0, -0.7));
    root.add(mesh(B(0.6, 0.4, 0.03), mat([0.1, 0.2, 0.15], { emissive: [0.1, 0.4, 0.2] })).at(0.9, 1.0, -0.44));
    root.add(mesh(B(0.6, 0.4, 0.6), mat([0.7, 0.2, 0.15], { pattern: P.paint })).at(-1.1, 0.1, -0.7));
    anim.beam = beam;
  } else if (type === 'recycleur') {
    root.add(mesh(B(2.0, 1.0, 1.6, 0.1), mat([0.3, 0.45, 0.3], { pattern: P.paint })));
    root.add(mesh(CY(0.95, 0.5, 0.8, 4), mat([0.35, 0.5, 0.35], { pattern: P.paint })).at(0, 1.1, 0).rotY(Math.PI / 4));
    const jaw = new Node().at(0, 1.15, 0);
    for (let k = 0; k < 4; k++) jaw.add(mesh(B(0.08, 0.25, 0.7), mat(C.steel, { rough: 0.3 })).at(-0.3 + k * 0.2, 0, 0));
    root.add(jaw);
    root.add(mesh(B(0.8, 0.5, 0.7), mat([0.25, 0.3, 0.35], { pattern: P.paint })).at(1.2, 0.1, 0.5));
    anim.jaw = jaw;
  } else if (type === 'four') {
    root.add(mesh(B(2.6, 0.5, 2.0, 0.1), mat([0.4, 0.38, 0.36], { pattern: P.concrete })));
    const dome = mesh(SP(1.1, 16, 10), mat([0.7, 0.62, 0.5], { pattern: P.clay }));
    dome.pos = [0, 0.6, 0]; dome.scl = [1.1, 0.95, 0.95];
    root.add(dome);
    root.add(mesh(CY(0.2, 0.24, 1.4, 12), mat(C.rustMetal, { pattern: P.rust })).at(0.5, 1.4, -0.5));
    const mouth = mesh(B(0.7, 0.45, 0.05), mat([0.06, 0.04, 0.03]));
    mouth.pos = [0, 0.75, 1.02];
    root.add(mouth);
    root.add(mesh(CY(0.45, 0.15, 0.6, 12), mat(C.steel, { pattern: P.paint })).at(-1.0, 1.0, 0.6));
    root.add(mesh(lump(0.3, 2, 0.2, 8, 6, 0.6), mat([0.86, 0.76, 0.5], { pattern: P.ground })).at(-1.0, 1.55, 0.6));
    anim.mouth = mouth;
  } else if (type === 'emballeuse') {
    root.add(mesh(B(3.0, 0.15, 0.9), mat(C.rubber, { pattern: P.rubber })).at(0, 0.8, 0.3));
    root.add(mesh(B(3.0, 0.7, 0.9, 0.1), mat([0.4, 0.42, 0.48], { pattern: P.paint })).at(0, 0, 0.3));
    const box1 = mesh(B(0.6, 0.45, 0.5), mat(C.wood, { pattern: P.wood }));
    box1.pos = [-0.6, 0.95, 0.3];
    root.add(box1);
    const arm = new Node().at(0.4, 2.0, -0.4);
    arm.add(mesh(B(0.12, 0.12, 0.8, 0), mat(C.yellow, { pattern: P.paint })).at(0, 0, 0));
    arm.add(mesh(B(0.5, 0.06, 0.2), mat(C.steel)).at(0, -0.1, 0.8));
    root.add(arm);
    root.add(mesh(B(0.12, 2.0, 0.12, 0.1), mat(C.yellow, { pattern: P.paint })).at(0.4, 0, -0.45));
    const stack = [];
    for (let k = 0; k < 4; k++) stack.push({ g: B(0.7, 0.05, 0.5), p: [1.2, 0.1 + k * 0.06, -0.6], c: [0.72, 0.56, 0.36] });
    root.add(meshes(bake(stack), mat([1, 1, 1], { pattern: P.wood })));
    anim.box = box1; anim.parm = arm;
  } else if (type === 'quai') {
    root.add(mesh(B(3.8, 0.6, 2.0, 0.1), mat([0.48, 0.4, 0.3], { pattern: P.wood })));
    root.add(mesh(B(1.8, 2.0, 1.8, 0.7), mat([0.25, 0.4, 0.6], { pattern: P.paint })).at(0.8, 0, -0.05));
    root.add(mesh(B(1.6, 0.04, 1.8), mat([0.12, 0.12, 0.13])).at(-0.1, 1.5, -0.05).rotY(0));
    const r2 = rng(11);
    const cr = [];
    for (let k = 0; k < 4; k++) cr.push({ g: B(0.5, 0.45, 0.5), p: [-1.4 + (k % 2) * 0.55, 0.7 + Math.floor(k / 2) * 0.46, -0.3 + (r2() - 0.5) * 0.2], c: vary([0.78, 0.62, 0.4], r2, 0.1) });
    root.add(meshes(bake(cr), mat([1, 1, 1], { pattern: P.wood })));
  }
  const lamp = light();
  lamp.pos = [m.w / 2 - 0.2, type === 'assembleur' ? 3.05 : type === 'quai' ? 2.8 : 2.0, -m.d / 2 + 0.3];
  root.add(lamp);
  anim.lamp = lamp;
  const smoke = new Node();
  for (let k = 0; k < 4; k++) smoke.add(mesh(SP(0.25, 8, 6), mat([0.3, 0.3, 0.3], { opacity: 0.45, cast: false })));
  smoke.pos = [0, 1.8, 0];
  smoke.visible = false;
  root.add(smoke);
  anim.smoke = smoke;
  root.anim = anim;
  return root;
}

// Chantier : dalle balisée, échafaudage qui monte avec l'avancement, fantôme de la machine
export function plotModel(type) {
  const m = MACHINES[type];
  const root = new Node();
  root.add(mesh(B(m.w + 0.6, 0.06, m.d + 0.6), mat([0.45, 0.45, 0.44], { pattern: P.concrete, cast: false })));
  const hz = mat([1, 1, 1], { pattern: P.hazard, cast: false });
  const frame = new Node();
  frame.add(mesh(B(m.w + 0.8, 0.1, 0.18), hz).at(0, 0, -(m.d / 2 + 0.35)));
  frame.add(mesh(B(m.w + 0.8, 0.1, 0.18), hz).at(0, 0, m.d / 2 + 0.35));
  frame.add(mesh(B(0.18, 0.1, m.d + 0.6), hz).at(-(m.w / 2 + 0.35), 0, 0));
  frame.add(mesh(B(0.18, 0.1, m.d + 0.6), hz).at(m.w / 2 + 0.35, 0, 0));
  root.add(frame);
  const ghost = mesh(B(m.w * 0.9, 2.0, m.d * 0.9), mat([0.35, 0.65, 1.0], { opacity: 0.16, unlit: 1, cast: false }));
  root.add(ghost);
  const scaffold = new Node();
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) scaffold.add(mesh(B(0.08, 2.4, 0.08), mat(C.rustMetal, { pattern: P.rust })).at(x * (m.w / 2), 0, z * (m.d / 2)));
  scaffold.add(mesh(B(m.w + 0.1, 0.08, 0.08), mat(C.yellow, { pattern: P.paint })).at(0, 2.3, m.d / 2));
  scaffold.add(mesh(B(m.w + 0.1, 0.08, 0.08), mat(C.yellow, { pattern: P.paint })).at(0, 2.3, -m.d / 2));
  root.add(scaffold);
  const body = mesh(B(m.w * 0.85, 1.6, m.d * 0.85), mat([0.55, 0.52, 0.48], { pattern: P.paint }));
  root.add(body);
  const piles = new Node();
  root.add(piles);
  root.parts = { ghost, scaffold, body, piles, frame };
  return root;
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function itemPile(item, n) {
  const def = ITEMS[item];
  const col = hexRgb(def.css);
  const pat = { fer: P.paint, verre: P.glass, argile: P.clay, calcaire: P.rock, sable: P.ground, charbon: P.rock, bois: P.wood, caoutchouc: P.rubber }[item] ?? (def.kind === 'kit' ? P.paint : P.plain);
  const parts = [];
  for (let k = 0; k < Math.min(n, 6); k++) parts.push({ g: B(0.28, 0.2, 0.28), p: [(k % 3) * 0.32 - 0.32, Math.floor(k / 3) * 0.21, 0], r: [0, k * 0.3, 0], c: col });
  if (!parts.length) return new Node();
  return meshes(bake(parts), mat([1, 1, 1], { pattern: pat, opacity: item === 'verre' ? 0.7 : 1 }));
}

export function entrepotModel() {
  const root = new Node();
  const fr = mat(C.steel, { pattern: P.paint });
  const W = ENTREPOT.w, D = ENTREPOT.d;
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) root.add(mesh(B(0.08, 2.0, 0.08), fr).at(x, 0, z));
  for (const y of [0.25, 1.0, 1.75]) root.add(mesh(B(W + 0.1, 0.06, D), mat([0.42, 0.4, 0.38], { pattern: P.rust })).at(0, y, 0));
  const r = rng(3);
  const crates = [];
  for (let k = 0; k < 9; k++) crates.push({ g: B(0.55, 0.45, 0.55), p: [-1.6 + (k % 5) * 0.8 + r() * 0.1, 0.31 + Math.floor(k / 5) * 0.75, (r() - 0.5) * 0.4], r: [0, r() * 0.3, 0], c: vary(C.wood, r, 0.15) });
  root.add(meshes(bake(crates), mat([1, 1, 1], { pattern: P.wood })));
  root.add(mesh(B(1.4, 0.5, 0.06), mat([0.9, 0.75, 0.2], { pattern: P.paint })).at(0, 2.05, D / 2 + 0.05));
  return root;
}

export function coreModel() {
  const root = new Node();
  const body = new Node();
  body.add(mesh(B(CORE.w, 1.1, CORE.d), mat([0.32, 0.34, 0.36], { pattern: P.paint })));
  body.add(mesh(B(CORE.w + 0.02, 0.22, CORE.d + 0.02), mat([1, 1, 1], { pattern: P.hazard })).at(0, 0.75, 0));
  body.add(mesh(B(0.7, 0.3, 0.04), mat([0.2, 0.8, 0.9], { emissive: [0.1, 0.6, 0.7] })).at(0, 0.4, CORE.d / 2 + 0.01));
  for (const s of [-1, 1]) body.add(mesh(B(0.3, 0.08, 0.5), mat(C.dark)).at(s * (CORE.w / 2 + 0.1), 0.7, 0));
  root.add(body);
  root.body = body;
  return root;
}

// ---------- humain (joueur) ----------
export function workerModel(id) {
  const col = PLAYER_COLORS[id].rgb;
  const root = new Node();
  const suit = mat(col, { pattern: P.paint, rough: 0.8 });
  const dark = mat([0.16, 0.16, 0.18], { rough: 0.9 });
  const hips = new Node().at(0, 0.92, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new Node().at(s * 0.12, 0, 0);
    leg.add(mesh(B(0.17, 0.82, 0.19, -0.82), mat(col.map((v) => v * 0.75), { pattern: P.paint })));
    leg.add(mesh(B(0.19, 0.14, 0.3, -0.92), dark).at(0, 0, 0.04));
    hips.add(leg); legs.push(leg);
  }
  const torso = new Node();
  torso.add(mesh(B(0.48, 0.62, 0.28), suit));
  torso.add(mesh(B(0.49, 0.07, 0.29), mat([0.85, 0.85, 0.8], { emissive: [0.15, 0.15, 0.12] })).at(0, 0.3, 0));
  const pack = new Node().at(0, 0.08, -0.22);
  pack.add(mesh(B(0.38, 0.46, 0.2), mat(C.canvas, { pattern: P.wood })));
  pack.add(mesh(B(0.4, 0.06, 0.22), mat([0.3, 0.24, 0.18])).at(0, 0.44, 0));
  torso.add(pack);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new Node().at(s * 0.31, 0.58, 0);
    arm.add(mesh(B(0.12, 0.56, 0.14, -0.56), suit));
    arm.add(mesh(SP(0.075, 8, 6), dark).at(0, -0.6, 0));
    torso.add(arm); arms.push(arm);
  }
  const head = new Node().at(0, 0.78, 0);
  head.add(mesh(SP(0.14, 12, 8), mat(C.skin, { rough: 0.7 })));
  const helmet = mesh(SP(0.165, 12, 8), mat([0.95, 0.95, 0.92], { pattern: P.paint, rough: 0.3 }));
  helmet.pos = [0, 0.05, 0]; helmet.scl = [1, 0.72, 1.05];
  head.add(helmet);
  head.add(mesh(CY(0.2, 0.2, 0.02, 14), mat([0.95, 0.95, 0.92], { pattern: P.paint })).at(0, 0.03, 0.02));
  head.add(mesh(B(0.08, 0.05, 0.04), mat([1, 1, 0.8], { emissive: [0.9, 0.85, 0.6] })).at(0, 0.1, 0.16));
  torso.add(head);
  hips.add(torso);
  root.add(hips);
  root.parts = { legs, arms, torso, pack, hips };
  return root;
}

// ---------- droïde ----------
export function droidModel() {
  const root = new Node();
  const paint = mat([0.9, 0.7, 0.15], { pattern: P.paint, rough: 0.4 });
  const steel = mat(C.steel, { pattern: P.paint, rough: 0.35 });
  const glow = mat([0.2, 0.2, 0.2], { emissive: [0.9, 0.6, 0.1] });
  const hips = new Node().at(0, 0.72, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new Node().at(s * 0.13, 0, 0);
    leg.add(mesh(CY(0.07, 0.08, 0.64, 8, -0.66), steel));
    leg.add(mesh(SP(0.09, 8, 6), steel).at(0, -0.33, 0));
    leg.add(mesh(B(0.15, 0.08, 0.24, -0.72), mat(C.dark)).at(0, 0, 0.04));
    hips.add(leg); legs.push(leg);
  }
  const body = new Node();
  const torso = mesh(SP(0.3, 14, 10), paint);
  torso.pos = [0, 0.32, 0]; torso.scl = [1, 1.12, 0.82];
  body.add(torso);
  const chest = mesh(B(0.2, 0.12, 0.04), glow);
  chest.pos = [0, 0.38, 0.24];
  body.add(chest);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new Node().at(s * 0.34, 0.5, 0);
    arm.add(mesh(SP(0.08, 8, 6), steel));
    arm.add(mesh(CY(0.045, 0.05, 0.5, 8, -0.52), steel));
    arm.add(mesh(SP(0.065, 8, 6), mat(C.dark)).at(0, -0.56, 0));
    body.add(arm); arms.push(arm);
  }
  const head = new Node().at(0, 0.78, 0);
  const skull = mesh(SP(0.19, 12, 9), steel);
  skull.scl = [1.15, 0.85, 1];
  head.add(skull);
  const visor = mesh(B(0.28, 0.08, 0.05), glow);
  visor.pos = [0, 0.0, 0.17];
  head.add(visor);
  head.add(mesh(CY(0.012, 0.012, 0.25, 4), steel).at(0.08, 0.12, 0));
  const tip = mesh(SP(0.035, 6, 4), glow);
  tip.pos = [0.08, 0.38, 0];
  head.add(tip);
  body.add(head);
  // Accessoires selon la spécialité
  const acc = {
    ouvrier: new Node().add(mesh(SP(0.2, 12, 6), mat(C.yellow, { pattern: P.paint })).at(0, 0.05, 0)),
    logistique: new Node().add(mesh(B(0.42, 0.36, 0.3), mat(C.wood, { pattern: P.wood })).at(0, 0.18, -0.38), mesh(B(0.12, 0.08, 0.16), mat([0.2, 0.4, 0.9], { emissive: [0.1, 0.25, 0.6] })).at(0.34, -0.1, 0.2)),
    maintenance: new Node().add(mesh(B(0.32, 0.18, 0.14), mat([0.75, 0.15, 0.12], { pattern: P.paint })).at(0.36, -0.45, 0.05), mesh(B(0.04, 0.32, 0.06), mat(C.steel)).at(-0.36, -0.3, 0.12)),
    ingenieur: new Node().add(mesh(B(0.26, 0.18, 0.02), mat([0.15, 0.1, 0.25], { emissive: [0.3, 0.15, 0.55] })).at(-0.3, -0.2, 0.25), mesh(TO(0.2, 0.03), mat([0.95, 0.95, 0.95], { pattern: P.paint })).at(0, 0.88, 0)),
    recherche: new Node().add(mesh(B(0.34, 0.4, 0.2), mat([0.2, 0.45, 0.42], { pattern: P.paint })).at(0, 0.15, -0.3), mesh(CY(0.0, 0.16, 0.08, 12), mat(C.steel, { rough: 0.2 })).at(0.12, 0.62, -0.32), mesh(SP(0.05, 6, 4), mat([0.2, 0.9, 0.8], { emissive: [0.2, 0.9, 0.8] })).at(0.12, 0.72, -0.32)),
    chefmaint: new Node().add(mesh(B(0.4, 0.22, 0.18), mat([0.8, 0.12, 0.1], { pattern: P.paint })).at(0.38, -0.42, 0.05), mesh(SP(0.2, 12, 6), mat([0.12, 0.45, 0.25], { pattern: P.paint })).at(0, 0.88, 0), mesh(B(0.04, 0.36, 0.06), mat(C.steel)).at(-0.36, -0.3, 0.12)),
    expert: new Node().add(mesh(B(0.5, 0.44, 0.34), mat([0.25, 0.35, 0.7], { pattern: P.paint })).at(0, 0.2, -0.4), mesh(B(0.16, 0.1, 0.2), mat([0.2, 0.4, 0.9], { emissive: [0.15, 0.3, 0.8] })).at(0.34, -0.1, 0.2)),
    qualite: new Node().add(mesh(TO(0.1, 0.02), mat(C.steel, { rough: 0.2 })).at(0.34, -0.4, 0.22), mesh(B(0.03, 0.18, 0.03), mat(C.dark)).at(0.34, -0.55, 0.22), mesh(B(0.3, 0.06, 0.05), mat([0.85, 0.2, 0.15], { emissive: [0.3, 0.05, 0.03] })).at(0, 0.5, 0.24)),
    production: new Node().add(mesh(CY(0.04, 0.045, 0.45, 8, -0.47), mat([0.95, 0.5, 0.15], { pattern: P.paint })).at(-0.26, 0.28, -0.12), mesh(CY(0.04, 0.045, 0.45, 8, -0.47), mat([0.95, 0.5, 0.15], { pattern: P.paint })).at(0.26, 0.28, -0.12), mesh(B(0.2, 0.2, 0.2), mat(C.dark, { pattern: P.paint })).at(0, 0.3, -0.3)),
    process: new Node().add(mesh(B(0.34, 0.08, 0.06), mat([0.3, 0.2, 0.7], { emissive: [0.35, 0.25, 0.9] })).at(0, 0.8, 0.2), mesh(B(0.24, 0.16, 0.02), mat([0.2, 0.15, 0.4], { emissive: [0.2, 0.15, 0.5] })).at(-0.3, -0.2, 0.25)),
    achat: new Node().add(mesh(B(0.32, 0.26, 0.26), mat([0.78, 0.6, 0.38], { pattern: P.wood })).at(0.34, -0.15, 0.12), mesh(B(0.2, 0.12, 0.02), mat([0.9, 0.4, 0.6], { emissive: [0.4, 0.1, 0.25] })).at(-0.3, -0.2, 0.25)),
    adjoint: new Node().add(mesh(B(0.24, 0.32, 0.02), mat([0.5, 0.38, 0.25], { pattern: P.wood })).at(-0.3, -0.15, 0.25), mesh(B(0.2, 0.24, 0.01), mat([0.95, 0.95, 0.92])).at(-0.3, -0.15, 0.265)),
    chef: new Node().add(mesh(CY(0.17, 0.2, 0.16, 14), mat([0.12, 0.12, 0.15], { pattern: P.paint })).at(0, 0.9, 0), mesh(CY(0.205, 0.205, 0.04, 14), mat([0.95, 0.75, 0.25], { rough: 0.2 })).at(0, 0.92, 0), mesh(SP(0.05, 8, 6), mat([0.95, 0.75, 0.25], { emissive: [0.4, 0.3, 0.05] })).at(0.12, 0.45, 0.25)),
  };
  acc.ouvrier.pos = [0, 0.9, 0];
  for (const k of Object.keys(acc)) { acc[k].visible = false; body.add(acc[k]); }
  // Tenues achetées avec les crédits
  const outfit = {
    casquette: new Node().add(mesh(SP(0.2, 12, 6), mat([0.85, 0.2, 0.2], { pattern: P.paint })).at(0, 0.86, 0), mesh(B(0.26, 0.03, 0.18), mat([0.85, 0.2, 0.2], { pattern: P.paint })).at(0, 0.86, 0.2)),
    casque: new Node().add(mesh(SP(0.23, 12, 6), mat([0.98, 0.8, 0.1], { pattern: P.paint, rough: 0.3 })).at(0, 0.86, 0), mesh(CY(0.3, 0.3, 0.03, 16), mat([0.98, 0.8, 0.1], { pattern: P.paint })).at(0, 0.86, 0)),
    tablier: new Node().add(mesh(B(0.44, 0.52, 0.03), mat([0.45, 0.28, 0.16], { pattern: P.wood, rough: 0.7 })).at(0, 0.05, 0.27)),
    gilet: new Node().add(mesh(B(0.64, 0.42, 0.52), mat([1.0, 0.45, 0.05], { pattern: P.paint })).at(0, 0.12, 0), mesh(B(0.65, 0.05, 0.53), mat([0.9, 0.9, 0.85], { emissive: [0.5, 0.5, 0.45] })).at(0, 0.32, 0), mesh(B(0.65, 0.05, 0.53), mat([0.9, 0.9, 0.85], { emissive: [0.5, 0.5, 0.45] })).at(0, 0.2, 0)),
    noeud: new Node().add(mesh(B(0.1, 0.08, 0.04), mat([0.75, 0.05, 0.1], { pattern: P.paint })).at(-0.06, 0.6, 0.22), mesh(B(0.1, 0.08, 0.04), mat([0.75, 0.05, 0.1], { pattern: P.paint })).at(0.06, 0.6, 0.22), mesh(SP(0.03, 6, 4), mat([0.6, 0.05, 0.08])).at(0, 0.6, 0.25)),
  };
  for (const k of Object.keys(outfit)) { outfit[k].visible = false; body.add(outfit[k]); }
  hips.add(body);
  root.add(hips);
  root.parts = { legs, arms, body, head, acc, paint, glow, hips, outfit };
  root.setType = (type) => {
    const d = DROIDS[type];
    paint.color = d.color;
    glow.emissive = d.color.map((v) => v * 0.9);
    for (const k of Object.keys(acc)) acc[k].visible = k === type;
    root.baseColor = d.color;
  };
  root.setOutfit = (o) => {
    for (const k of Object.keys(outfit)) outfit[k].visible = k === o;
    if (o === 'chrome') { paint.color = [0.86, 0.88, 0.92]; paint.rough = 0.12; }
    else if (o === 'or') { paint.color = [0.98, 0.76, 0.26]; paint.rough = 0.15; }
    else { paint.color = root.baseColor || paint.color; paint.rough = 0.4; }
  };
  return root;
}

// ---------- créatures ----------
export function animalModel(sp) {
  const root = new Node();
  const legs = [];
  const parts = {};
  if (sp === 'rouillard') {
    const body = new Node().at(0, 0.62, 0);
    body.add(mesh(geo('rouil', () => lump(0.42, 4, 0.3, 14, 10, 0.85)), mat([0.48, 0.42, 0.38], { pattern: P.rust })));
    for (let k = 0; k < 5; k++) {
      const a = k * 1.25;
      body.add(mesh(B(0.32, 0.05, 0.26), mat([0.4, 0.35, 0.3], { pattern: P.rust })).at(Math.cos(a) * 0.22, 0.3 - (k % 2) * 0.06, Math.sin(a) * 0.22 - 0.05));
    }
    const eye = mesh(SP(0.13, 12, 8), mat([0.9, 0.5, 0.1], { emissive: [1.0, 0.55, 0.1] }));
    eye.pos = [0, 0.08, 0.36];
    body.add(eye);
    body.add(mesh(TO(0.14, 0.03), mat(C.dark)).at(0, 0.08, 0.36));
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, z = (k % 3 - 1) * 0.25;
      const leg = new Node().at(s * 0.3, 0.55, z);
      leg.add(mesh(CY(0.025, 0.03, 0.75, 6, -0.75), mat(C.dark, { pattern: P.rust })));
      leg.rot = [0, 0, s * 0.45];
      root.add(leg); legs.push(leg);
    }
    root.add(body); parts.body = body;
  } else if (sp === 'vitrelle') {
    const body = new Node().at(0, 1.35, 0);
    const shell = mesh(SP(0.36, 16, 12), mat([0.55, 0.9, 0.85], { pattern: P.glass, opacity: 0.35, cast: false }));
    shell.scl = [0.85, 1.25, 0.85];
    body.add(shell);
    body.add(mesh(SP(0.15, 12, 8), mat([0.2, 0.9, 0.8], { emissive: [0.15, 0.8, 0.7] })));
    for (const y of [-0.22, 0, 0.22]) body.add(mesh(TO(0.3 - Math.abs(y) * 0.5, 0.025), mat(C.copper, { pattern: P.paint })).at(0, y, 0));
    const head = new Node().at(0, 0.55, 0.08);
    head.add(mesh(SP(0.12, 10, 8), mat(C.copper, { pattern: P.paint })));
    for (const s of [-1, 1]) head.add(mesh(SP(0.035, 6, 4), mat([0.3, 1, 0.9], { emissive: [0.3, 1, 0.9] })).at(s * 0.05, 0.02, 0.1));
    body.add(head);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const leg = new Node().at(Math.cos(a) * 0.15, 1.15, Math.sin(a) * 0.15);
      leg.add(mesh(CY(0.02, 0.025, 1.18, 6, -1.18), mat(C.copper, { pattern: P.paint })));
      leg.rot = [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3];
      root.add(leg); legs.push(leg);
    }
    root.add(body); parts.body = body;
  } else {
    const body = new Node().at(0, 0.55, 0);
    const hull = mesh(CY(0.24, 0.24, 1.2, 12, -0.6), mat([0.78, 0.45, 0.2], { pattern: P.paint }));
    hull.rot = [Math.PI / 2, 0, 0];
    body.add(hull);
    for (const z of [-0.6, 0.6]) body.add(mesh(SP(0.24, 12, 8), mat([0.78, 0.45, 0.2], { pattern: P.paint })).at(0, 0, z));
    for (let k = 0; k < 3; k++) body.add(mesh(B(0.04, 0.3 - k * 0.05, 0.35), mat(C.steel, { pattern: P.rust })).at(0, 0.28, -0.3 + k * 0.32));
    const head = new Node().at(0, 0.08, 0.82);
    head.add(mesh(B(0.3, 0.22, 0.25), mat(C.dark, { pattern: P.paint })));
    for (const s of [-1, 1]) head.add(mesh(SP(0.045, 6, 4), mat([0.2, 0.9, 1.0], { emissive: [0.2, 0.9, 1.0] })).at(s * 0.08, 0.13, 0.12));
    body.add(head);
    const tail = new Node().at(0, 0.05, -0.8);
    for (let k = 0; k < 5; k++) tail.add(mesh(SP(0.05, 6, 4), mat(C.dark)).at(0, 0, -k * 0.13));
    body.add(tail); parts.tail = tail;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new Node().at(x * 0.22, 0.45, z * 0.4);
      leg.add(mesh(CY(0.06, 0.06, 0.25, 8, -0.25), mat(C.steel, { pattern: P.paint })));
      leg.add(mesh(CY(0.03, 0.03, 0.45, 6, -0.47), mat([0.75, 0.77, 0.8], { rough: 0.2 })));
      root.add(leg); legs.push(leg);
    }
    root.add(body); parts.body = body;
  }
  root.parts = { legs, ...parts };
  return root;
}
