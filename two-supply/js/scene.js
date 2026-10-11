// Construction de l'usine en 3D et mise à jour à partir de l'état du jeu.
import { Node, mesh, mat, box, cylinder, sphere, plane, ring, merge } from './gl.js';
import { POS, PLAYER_COLORS, T, POST_R } from './config.js';

const C = {
  concrete: [0.50, 0.51, 0.52], grass: [0.39, 0.43, 0.28], soil: [0.40, 0.31, 0.21], asphalt: [0.25, 0.26, 0.28],
  yellow: [0.95, 0.76, 0.08], brick: [0.56, 0.30, 0.22], steel: [0.64, 0.66, 0.69], darkSteel: [0.30, 0.32, 0.35],
  wood: [0.60, 0.44, 0.26], darkWood: [0.42, 0.30, 0.20], wheat: [0.88, 0.72, 0.34], stone: [0.55, 0.54, 0.50],
  water: [0.16, 0.36, 0.52], white: [0.94, 0.95, 0.96], skin: [0.92, 0.76, 0.62], boots: [0.14, 0.14, 0.16],
  green: [0.30, 0.42, 0.38],
};

// Petit générateur pseudo-aléatoire stable (le décor est identique sur les deux téléphones).
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// ---------- objets transportables ----------
const G = {};
function geo(key, make) { return G[key] || (G[key] = make()); }

export function itemNode(type) {
  const n = new Node();
  switch (type) {
    case 'ble': {
      const s = mesh(geo('ble', () => cylinder(0.11, 0.11, 0.55, 10)), mat(C.wheat));
      s.rot = [0, 0, Math.PI / 2]; s.pos = [0.27, 0.11, 0];
      const band = mesh(geo('band', () => cylinder(0.12, 0.12, 0.06, 10)), mat([0.45, 0.30, 0.16]));
      band.rot = [0, 0, Math.PI / 2]; band.pos = [0.03, 0.11, 0];
      n.add(s, band);
      break;
    }
    case 'eau': {
      n.add(mesh(geo('bucket', () => cylinder(0.17, 0.13, 0.26, 12)), mat([0.55, 0.57, 0.60])));
      n.add(mesh(geo('water', () => cylinder(0.155, 0.155, 0.01, 12)), mat(C.water)).at(0, 0.24, 0));
      break;
    }
    case 'sel': n.add(mesh(geo('salt', () => box(0.24, 0.2, 0.24)), mat([0.93, 0.94, 0.97]))); break;
    case 'farine': {
      n.add(mesh(geo('sack', () => box(0.3, 0.34, 0.22)), mat([0.92, 0.89, 0.81])));
      n.add(mesh(geo('sacktop', () => cylinder(0.06, 0.12, 0.1, 10)), mat([0.86, 0.82, 0.74])).at(0, 0.34, 0));
      break;
    }
    case 'pate': {
      const d = mesh(geo('dough', () => sphere(0.17, 14, 10, 0.12)), mat([0.95, 0.87, 0.69]));
      d.scl = [1, 0.75, 1];
      n.add(d);
      break;
    }
    case 'pain': {
      const b = mesh(geo('bread', () => sphere(0.16, 14, 10, 0.12)), mat([0.70, 0.43, 0.18]));
      b.scl = [1.55, 0.8, 1];
      n.add(b);
      break;
    }
  }
  n.type = type;
  return n;
}

function setItem(slot, type) {
  if ((slot.cur || null) === (type || null)) return;
  slot.children = [];
  slot.cur = type || null;
  if (type) slot.add(itemNode(type));
}

// ---------- personnage ----------
function worker(id) {
  const col = PLAYER_COLORS[id].rgb;
  const g = new Node();
  const body = new Node();
  body.add(mesh(geo('boots', () => box(0.42, 0.24, 0.3)), mat(C.boots)));
  body.add(mesh(geo('torso', () => cylinder(0.25, 0.29, 0.86, 14)), mat(col)).at(0, 0.22, 0));
  body.add(mesh(geo('arm', () => box(0.12, 0.55, 0.14)), mat(col)).at(-0.34, 0.5, 0.04));
  body.add(mesh(geo('arm', () => box(0.12, 0.55, 0.14)), mat(col)).at(0.34, 0.5, 0.04));
  body.add(mesh(geo('stripe', () => cylinder(0.262, 0.262, 0.07, 14)), mat([0.88, 0.9, 0.86], { emissive: [0.12, 0.12, 0.1] })).at(0, 0.66, 0));
  body.add(mesh(geo('head', () => sphere(0.2, 14, 10)), mat(C.skin)).at(0, 1.3, 0));
  body.add(mesh(geo('cap', () => cylinder(0.16, 0.215, 0.17, 14)), mat(C.white)).at(0, 1.34, 0));
  body.add(mesh(geo('mask', () => box(0.24, 0.11, 0.07)), mat([0.74, 0.86, 0.94])).at(0, 1.2, 0.18));
  const hand = new Node().at(0, 0.82, 0.42);
  body.add(hand);
  const shadow = mesh(geo('shadow', () => ring(0, 0.48, 24)), mat([0, 0, 0], { opacity: 0.28, unlit: 1 }));
  shadow.pos = [0, 0.015, 0];
  g.add(shadow, body);
  g.body = body;
  g.hand = hand;
  return g;
}

function duoRing() {
  const n = mesh(geo('duoring', () => ring(0.42, 0.56, 40)), mat(C.yellow, { opacity: 0.9, unlit: 1 }));
  n.pos = [0, 0.02, 0];
  return n;
}

// ---------- scène complète ----------
export function buildScene() {
  const root = new Node();
  const S = { root, targets: {}, slots: {}, anim: {} };

  // Sols
  root.add(mesh(plane(26, 18), mat(C.concrete, { pattern: 1 })));
  root.add(mesh(plane(5.4, 18), mat(C.grass, { pattern: 2 })).at(-9.3 - 0.0, 0.004, 0));
  root.add(mesh(plane(4.8, 5.4), mat(C.soil, { pattern: 3 })).at(-9.6, 0.008, -5.3));
  root.add(mesh(plane(4, 18), mat(C.asphalt, { pattern: 1 })).at(10, 0.004, 0));
  root.add(mesh(box(0.14, 0.01, 16), mat(C.yellow, { unlit: 1 })).at(8.05, 0.006, 0));
  for (let i = 0; i < 4; i++) root.add(mesh(box(2.6, 0.01, 0.1), mat([0.9, 0.9, 0.9], { unlit: 1 })).at(10.4, 0.006, -1 + i * 2.2));

  // Murs
  const wallMat = mat(C.brick);
  for (const w of POS.walls) root.add(mesh(box(w.w, 1.3, w.d), wallMat).at(w.x, 0, w.z));
  root.add(mesh(box(18.8, 2.4, 0.3), wallMat).at(2.7, 0, -8.2));
  root.add(mesh(box(5.4, 0.9, 0.2), mat([0.42, 0.36, 0.30])).at(-9.3, 0, -8.15));

  // Champ de blé (décor fusionné)
  {
    const r = rng(7), parts = [];
    const stalk = box(0.045, 1, 0.045), head = box(0.09, 0.2, 0.09);
    for (let i = 0; i < 280; i++) {
      const x = -11.8 + r() * 4.5, z = -7.8 + r() * 5.0;
      if (Math.abs(x - POS.ble.x) < 1.2 && Math.abs(z - POS.ble.z) < 1.0) continue;
      const h = 0.55 + r() * 0.35, ry = r() * 3;
      parts.push({ g: stalk, x, z, sy: h, ry });
      parts.push({ g: head, x, y: h, z, ry });
    }
    root.add(mesh(merge(parts), mat(C.wheat)));
  }

  const target = (key, node) => { S.targets[key] = node; return node; };

  // Gerbes de blé
  {
    const g = target('ble', new Node().at(POS.ble.x, 0, POS.ble.z));
    const sheaf = geo('sheaf', () => cylinder(0.3, 0.3, 1.4, 12));
    for (const [y, z] of [[0.3, -0.3], [0.3, 0.3], [0.8, 0]]) {
      const s = mesh(sheaf, mat(C.wheat));
      s.rot = [0, 0, Math.PI / 2]; s.pos = [0.7, y, z];
      g.add(s);
    }
    root.add(g);
  }
  // Puits
  {
    const g = target('puits', new Node().at(POS.puits.x, 0, POS.puits.z));
    g.add(mesh(cylinder(0.72, 0.76, 0.85, 18), mat(C.stone)));
    g.add(mesh(cylinder(0.6, 0.6, 0.02, 18), mat(C.water, { emissive: [0.02, 0.05, 0.08] })).at(0, 0.82, 0));
    g.add(mesh(box(0.12, 1.9, 0.12), mat(C.darkWood)).at(-0.68, 0, 0));
    g.add(mesh(box(0.12, 1.9, 0.12), mat(C.darkWood)).at(0.68, 0, 0));
    g.add(mesh(box(1.6, 0.12, 0.16), mat(C.darkWood)).at(0, 1.85, 0));
    g.add(itemNode('eau').at(0, 1.25, 0));
    root.add(g);
  }
  // Sel
  {
    const g = target('sel', new Node().at(POS.sel.x, 0, POS.sel.z));
    g.add(mesh(box(1.6, 0.35, 1.2), mat([0.58, 0.60, 0.62])));
    g.add(mesh(cylinder(0.02, 0.5, 0.5, 14), mat([0.95, 0.95, 0.97])).at(-0.25, 0.35, 0));
    g.add(mesh(cylinder(0.02, 0.35, 0.35, 14), mat([0.95, 0.95, 0.97])).at(0.4, 0.35, 0.15));
    root.add(g);
  }
  // Moulin
  {
    const g = target('moulin', new Node().at(POS.moulin.x, 0, POS.moulin.z));
    g.add(mesh(box(1.8, 1.0, 1.6), mat(C.green)));
    g.add(mesh(box(1.2, 0.7, 1.0), mat([0.40, 0.50, 0.47])).at(0, 1.0, -0.1));
    g.add(mesh(cylinder(0.6, 0.2, 0.6, 16), mat(C.steel)).at(0, 1.7, -0.1));
    const wheel = mesh(cylinder(0.55, 0.55, 0.12, 18), mat(C.darkSteel));
    const wheelPivot = new Node().at(0.96, 0.95, 0);
    wheel.rot = [0, 0, Math.PI / 2];
    wheelPivot.add(wheel, mesh(box(0.14, 0.9, 0.14), mat(C.yellow)).at(0, -0.45, 0));
    g.add(wheelPivot);
    g.add(mesh(box(0.7, 0.08, 0.5), mat(C.darkSteel)).at(0, 0.55, 0.95));
    const lamp = mesh(sphere(0.12, 10, 8), mat([0.2, 0.5, 0.25], { emissive: [0.05, 0.25, 0.08] }));
    lamp.pos = [-0.6, 1.1, 0.55];
    g.add(lamp);
    const out = new Node().at(0, 0.6, 0.95);
    g.add(out);
    S.slots.moulin = out;
    S.anim.wheel = wheelPivot;
    S.anim.lamp = lamp;
    root.add(g);
  }
  // Pétrin
  {
    const g = target('petrin', new Node().at(POS.petrin.x, 0, POS.petrin.z));
    g.add(mesh(box(1.8, 0.75, 1.4), mat(C.steel)));
    g.add(mesh(cylinder(0.62, 0.5, 0.4, 18), mat([0.74, 0.76, 0.79])).at(0, 0.75, -0.1));
    const dough = mesh(sphere(0.38, 14, 10), mat([0.95, 0.87, 0.69]));
    dough.pos = [0, 1.0, -0.1]; dough.scl = [1, 0.5, 1];
    g.add(dough);
    const arm = new Node().at(0, 1.05, -0.1);
    arm.add(mesh(box(0.08, 0.7, 0.08), mat(C.darkSteel)).at(0.2, 0, 0));
    arm.add(mesh(box(0.5, 0.08, 0.08), mat(C.darkSteel)).at(0, 0.66, 0));
    g.add(arm);
    const slots = {};
    [['farine', -0.55], ['eau', 0], ['sel', 0.55]].forEach(([k, x]) => {
      g.add(mesh(box(0.42, 0.04, 0.32), mat(C.darkSteel)).at(x, 0.75, 0.52));
      const s = new Node().at(x, 0.79, 0.52);
      g.add(s);
      slots[k] = s;
    });
    const out = new Node().at(0.85, 0.79, -0.1);
    g.add(out);
    S.slots.petrin = { ...slots, out };
    S.anim.arm = arm;
    S.anim.dough = dough;
    root.add(g);
  }
  // Tables
  POS.tables.forEach((t, i) => {
    const g = target('table' + i, new Node().at(t.x, 0, t.z));
    g.add(mesh(geo('tabletop', () => box(1.2, 0.08, 0.8)), mat(C.steel)).at(0, 0.8, 0));
    for (const [x, z] of [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]]) {
      g.add(mesh(geo('leg', () => box(0.06, 0.8, 0.06)), mat(C.darkSteel)).at(x, 0, z));
    }
    const s = new Node().at(0, 0.88, 0);
    g.add(s);
    S.slots['table' + i] = s;
    root.add(g);
  });
  // Poubelle
  {
    const g = target('poubelle', new Node().at(POS.poubelle.x, 0, POS.poubelle.z));
    g.add(mesh(cylinder(0.4, 0.35, 0.85, 14), mat([0.24, 0.36, 0.29])));
    g.add(mesh(cylinder(0.44, 0.44, 0.06, 14), mat([0.18, 0.27, 0.22])).at(0, 0.85, 0));
    root.add(g);
  }
  // Comptoir de livraison
  {
    const g = target('comptoir', new Node().at(POS.comptoir.x, 0, POS.comptoir.z));
    g.add(mesh(box(1.4, 1.0, 2.2), mat(C.darkWood)));
    g.add(mesh(box(1.55, 0.06, 2.35), mat([0.78, 0.75, 0.68])).at(0, 1.0, 0));
    g.add(mesh(box(0.1, 2.3, 0.1), mat(C.darkSteel)).at(0.55, 0, -0.9));
    g.add(mesh(box(0.08, 0.55, 1.5), mat([0.16, 0.44, 0.30], { emissive: [0.02, 0.06, 0.04] })).at(0.55, 1.75, -0.3));
    root.add(g);
  }

  // Zone de montage + fantôme du four (visible par l'Ingénieur)
  S.zone = mesh(plane(3.3, 2.3), mat([1, 1, 1], { stripes: 1, opacity: 0.85, unlit: 1 }));
  S.zone.pos = [POS.four.x, 0.012, POS.four.z];
  root.add(S.zone);
  S.ghost = mesh(box(2.4, 1.3, 1.6), mat([0.35, 0.62, 1.0], { opacity: 0.22, unlit: 1 }));
  S.ghost.pos = [POS.four.x, 0, POS.four.z];
  root.add(S.ghost);

  // Caisse du four en kit
  {
    const g = new Node();
    g.add(mesh(box(1.6, 1.1, 1.2), mat(C.wood)));
    g.add(mesh(box(1.62, 0.22, 1.22), mat([1, 1, 1], { stripes: 1 })).at(0, 0.72, 0));
    g.add(mesh(box(1.5, 0.05, 1.1), mat(C.darkWood)).at(0, 1.1, 0));
    g.add(mesh(box(0.3, 0.08, 0.5), mat(C.darkSteel)).at(-0.9, 0.7, 0));
    g.add(mesh(box(0.3, 0.08, 0.5), mat(C.darkSteel)).at(0.9, 0.7, 0));
    const sh = mesh(plane(2.0, 1.5), mat([0, 0, 0], { opacity: 0.22, unlit: 1 }));
    sh.pos = [0, 0.014, 0];
    g.add(sh);
    const rl = duoRing(), rr = duoRing();
    rl.pos = [-POS.handle, 0.02, 0]; rr.pos = [POS.handle, 0.02, 0];
    g.add(rl, rr);
    S.crate = g;
    S.crateRings = { L: rl, R: rr };
    S.targets.crateL = g; S.targets.crateR = g;
    g.pos = [POS.crate0.x, 0, POS.crate0.z];
    root.add(g);
  }

  // Chantier (caisse ouverte, four en cours de montage)
  {
    const g = new Node().at(POS.four.x, 0, POS.four.z);
    g.add(mesh(box(2.6, 0.18, 1.8), mat(C.wood)));
    g.add(mesh(box(1.6, 0.06, 1.1), mat(C.wood)).at(-0.2, 0, 1.4));
    const frame = new Node();
    for (const [x, z] of [[-1.15, -0.75], [1.15, -0.75], [-1.15, 0.75], [1.15, 0.75]]) {
      frame.add(mesh(geo('post', () => box(0.12, 1.3, 0.12)), mat(C.darkSteel)).at(x, 0.18, z));
    }
    g.add(frame);
    const body = mesh(box(2.3, 1.3, 1.5), mat(C.brick));
    body.pos = [0, 0.18, 0];
    g.add(body);
    S.chantier = g;
    S.anim.buildBody = body;
    S.anim.buildFrame = frame;
    S.targets.postL = g; S.targets.postR = g;
    root.add(g);
  }

  // Four
  {
    const g = new Node().at(POS.four.x, 0, POS.four.z);
    g.add(mesh(box(2.4, 1.3, 1.6), mat(C.brick)));
    g.add(mesh(box(2.5, 0.15, 1.7), mat([0.34, 0.32, 0.31])).at(0, 1.3, 0));
    g.add(mesh(cylinder(0.18, 0.2, 1.1, 12), mat(C.darkSteel)).at(0.7, 1.45, -0.4));
    const mouth = mesh(box(0.95, 0.55, 0.05), mat([0.08, 0.06, 0.05]));
    mouth.pos = [0, 0.35, 0.81];
    g.add(mouth);
    g.add(mesh(box(1.1, 0.06, 0.4), mat(C.darkSteel)).at(0, 0.33, 0.98));
    const out = new Node().at(0, 0.4, 1.0);
    g.add(out);
    S.slots.four = out;
    S.anim.mouth = mouth;
    const levers = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -1 : 1;
      const stand = new Node().at(sx * 1.42, 0, 0.1);
      stand.add(mesh(geo('stand', () => box(0.24, 0.95, 0.24)), mat([1, 1, 1], { stripes: 1 })));
      const pivot = new Node().at(0, 0.95, 0);
      pivot.add(mesh(geo('leverarm', () => box(0.07, 0.6, 0.07)), mat(C.darkSteel)));
      pivot.add(mesh(geo('knob', () => sphere(0.09, 10, 8)), mat([0.85, 0.15, 0.12])).at(0, 0.62, 0));
      stand.add(pivot);
      g.add(stand);
      levers[side] = pivot;
    }
    S.anim.levers = levers;
    S.four = g;
    S.targets.four = g;
    S.targets.leverL = g; S.targets.leverR = g;
    root.add(g);
  }
  // Repères au sol des postes à deux (montage et leviers)
  S.postRings = {};
  for (const side of ['L', 'R']) {
    const p = side === 'L' ? POS.postL : POS.postR;
    const r = duoRing();
    r.pos = [p.x, 0.02, p.z];
    root.add(r);
    S.postRings[side] = r;
  }

  // Joueurs
  S.players = { A: worker('A'), B: worker('B') };
  root.add(S.players.A, S.players.B);
  return S;
}

const lerp = (a, b, t) => a + (b - a) * t;
function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// view : { myId, me:{x,z,rot}, dt, time, role }
export function updateScene(S, st, view) {
  const k = 1 - Math.exp(-view.dt * 14);
  for (const id of ['A', 'B']) {
    const g = S.players[id], p = st.players[id];
    const tx = id === view.myId ? view.me.x : p.x;
    const tz = id === view.myId ? view.me.z : p.z;
    const tr = id === view.myId ? view.me.rot : p.rot;
    if (g.init) {
      g.pos[0] = id === view.myId ? tx : lerp(g.pos[0], tx, k);
      g.pos[2] = id === view.myId ? tz : lerp(g.pos[2], tz, k);
    } else { g.pos[0] = tx; g.pos[2] = tz; g.init = true; }
    const moving = Math.hypot(g.pos[0] - (g.px ?? g.pos[0]), g.pos[2] - (g.pz ?? g.pos[2])) > 0.002;
    g.px = g.pos[0]; g.pz = g.pos[2];
    g.rot[1] = angLerp(g.rot[1], tr, k);
    g.body.pos[1] = moving ? Math.abs(Math.sin(view.time * 12)) * 0.06 : 0;
    setItem(g.hand, p.holding);
  }

  // Caisse
  const crateOn = st.phase === 'crate';
  S.crate.visible = crateOn;
  if (crateOn) {
    S.crate.pos[0] = lerp(S.crate.pos[0], st.crate.x, k);
    S.crate.pos[2] = lerp(S.crate.pos[2], st.crate.z, k);
    const lifted = st.crate.hand.A && st.crate.hand.B;
    S.crate.children[0].pos[1] = lerp(S.crate.children[0].pos[1], lifted ? 0.25 : 0, k);
    for (const side of ['L', 'R']) {
      const who = ['A', 'B'].find((id) => st.crate.hand[id] === side);
      const near = ['A', 'B'].find((id) => !who && Math.hypot(st.players[id].x - (st.crate.x + (side === 'L' ? -1 : 1) * POS.handle), st.players[id].z - st.crate.z) < POST_R);
      paintRing(S.crateRings[side], who, near);
    }
  }
  S.zone.visible = st.phase === 'crate' || st.phase === 'build';
  S.ghost.visible = st.phase === 'crate' && view.role === 'inge';
  S.ghost.mesh.mat.opacity = 0.16 + 0.08 * Math.sin(view.time * 3);

  // Chantier
  S.chantier.visible = st.phase === 'build';
  if (st.phase === 'build') {
    const pr = st.build.progress;
    S.anim.buildBody.scl = [1, Math.max(0.05, pr), 1];
    S.anim.buildFrame.visible = pr < 1;
  }
  const four = st.phase === 'bake' || st.phase === 'won';
  S.four.visible = four;
  for (const side of ['L', 'R']) {
    const r = S.postRings[side];
    r.visible = st.phase === 'build' || four;
    if (!r.visible) continue;
    const post = side === 'L' ? POS.postL : POS.postR;
    let who = null;
    if (st.phase === 'build' && side === 'L') who = st.build.holder;
    if (four && st.four.leverBy[side]) who = st.four.leverBy[side];
    const near = ['A', 'B'].find((id) => Math.hypot(st.players[id].x - post.x, st.players[id].z - post.z) < POST_R);
    paintRing(r, who, near);
  }
  if (four) {
    const F = st.four;
    const glow = F.bake > 0 ? 0.55 + 0.25 * Math.sin(view.time * 10) : 0;
    S.anim.mouth.mesh.mat.emissive = [glow, glow * 0.45, glow * 0.08];
    for (const side of ['L', 'R']) {
      const pulled = (F.lever[side] > 0 && st.time - F.lever[side] < T.leverWindow) || (F.bake > T.bake - 0.6);
      S.anim.levers[side].rot[0] = lerp(S.anim.levers[side].rot[0], pulled ? 0.9 : -0.25, k);
    }
    setItem(S.slots.four, F.out);
  }

  // Machines
  const m = st.moulin;
  if (m.inp && !m.jam) S.anim.wheel.rot[0] += view.dt * 6;
  S.anim.lamp.mesh.mat.emissive = m.jam ? [0.9 * (0.6 + 0.4 * Math.sin(view.time * 12)), 0.05, 0.02] : [0.05, 0.25, 0.08];
  S.anim.lamp.mesh.mat.color = m.jam ? [0.6, 0.1, 0.08] : [0.2, 0.5, 0.25];
  setItem(S.slots.moulin, m.out);
  const P = st.petrin;
  setItem(S.slots.petrin.farine, P.farine ? 'farine' : null);
  setItem(S.slots.petrin.eau, P.eau ? 'eau' : null);
  setItem(S.slots.petrin.sel, P.sel ? 'sel' : null);
  setItem(S.slots.petrin.out, P.out);
  const full = P.farine && P.eau && P.sel;
  S.anim.dough.visible = full || P.kneads > 0;
  S.anim.arm.rot[1] = lerp(S.anim.arm.rot[1], P.kneads * 1.4, k);
  POS.tables.forEach((_, i) => setItem(S.slots['table' + i], st.tables[i]));

  // Surbrillance de ce que le joueur local va utiliser
  for (const key in S.targets) S.targets[key].glow(null);
  const h = st.players[view.myId].hint;
  if (h && !h.off && S.targets[h.key]) {
    const c = PLAYER_COLORS[view.myId].rgb;
    const pulse = 0.16 + 0.06 * Math.sin(view.time * 6);
    S.targets[h.key].glow([c[0] * pulse, c[1] * pulse, c[2] * pulse]);
  }
}

function paintRing(r, who, near) {
  const m = r.mesh.mat;
  if (who) { m.color = PLAYER_COLORS[who].rgb; m.opacity = 0.95; r.scl = [1.08, 1, 1.08]; }
  else if (near) { m.color = PLAYER_COLORS[near].rgb; m.opacity = 0.6; r.scl = [1, 1, 1]; }
  else { m.color = C.yellow; m.opacity = 0.9; r.scl = [1, 1, 1]; }
}
