// Scène : assemble le monde et le met à jour à partir de l'état du jeu.
import { Node, mesh, mat, ring } from './gl.js';
import { PLOTS, MACHINES, ENTREPOT, CORE, PLAYER_COLORS, POST_R, ITEM_ORDER, PAUSE } from './config.js';
import { NODES, height } from './world.js';
import { NODE_TYPES } from './config.js';
import {
  buildGround, buildDecor, nodeModel, machineModel, plotModel, entrepotModel, coreModel,
  workerModel, droidModel, animalModel, itemPile, pauseModel,
} from './models.js';
import { postL, postR, plotUnlocked } from './sim.js';

const YELLOW = [0.96, 0.75, 0.06];

function duoRing() {
  const n = mesh(ring(0.45, 0.6, 40), mat(YELLOW, { opacity: 0.9, unlit: 1, cast: false }));
  return n;
}
function paintRing(r, who, near) {
  const m = r.mesh.mat;
  if (who) { m.color = PLAYER_COLORS[who].rgb; m.opacity = 0.95; r.scl = [1.1, 1, 1.1]; }
  else if (near) { m.color = PLAYER_COLORS[near].rgb; m.opacity = 0.6; r.scl = [1, 1, 1]; }
  else { m.color = YELLOW; m.opacity = 0.9; r.scl = [1, 1, 1]; }
}

export function buildScene(mode = 'duo') {
  const root = new Node();
  const S = { root, targets: {}, droids: new Map(), animals: new Map(), plots: {}, machines: {}, nodes: [], rings: {} };
  root.add(buildGround(), buildDecor());

  NODES.forEach((n, i) => {
    const m = nodeModel(n);
    root.add(m);
    S.nodes[i] = m;
    S.targets['node' + i] = m;
  });

  const ent = entrepotModel();
  ent.pos = [ENTREPOT.x, 0, ENTREPOT.z];
  root.add(ent);
  S.targets.entrepot = ent;
  S.pause = pauseModel();
  S.pause.pos = [PAUSE.x, 0, PAUSE.z];
  root.add(S.pause);

  for (const p of PLOTS) {
    const pm = plotModel(p.type);
    pm.pos = [p.x, 0, p.z];
    const mm = machineModel(p.type);
    mm.pos = [p.x, 0, p.z];
    mm.visible = false;
    root.add(pm, mm);
    S.plots[p.id] = pm;
    S.machines[p.id] = mm;
    for (const side of ['L', 'R']) {
      const r = duoRing();
      const pt = side === 'L' ? postL(p) : postR(p);
      r.pos = [pt.x, 0.03, pt.z];
      root.add(r);
      S.rings[p.id + side] = r;
    }
  }

  S.core = coreModel();
  S.core.pos = [CORE.x, height(CORE.x, CORE.z), CORE.z];
  root.add(S.core);
  for (const side of ['L', 'R']) {
    const r = duoRing();
    root.add(r);
    S.rings['core' + side] = r;
  }

  let B;
  if (mode === 'solo') {
    B = droidModel();
    B.setType('ouvrier');
    B.parts.paint.color = PLAYER_COLORS.B.rgb;
    B.parts.glow.emissive = [0.2, 0.85, 1.0];
    B.parts.acc.ouvrier.visible = false;
  } else B = workerModel('B');
  S.players = { A: workerModel('A'), B };
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
const groundY = (x, z) => height(x, z);

function walk(model, speed, time, dt) {
  const P = model.parts;
  model.phase = (model.phase || 0) + speed * dt * 2.6;
  const s = Math.sin(model.phase) * Math.min(1, speed / 3);
  if (P.legs.length === 2) {
    P.legs[0].rot[0] = s * 0.7; P.legs[1].rot[0] = -s * 0.7;
    if (P.arms) { P.arms[0].rot[0] = -s * 0.6; P.arms[1].rot[0] = s * 0.6; }
    if (P.hips) P.hips.pos[1] = (P.hips.base ?? (P.hips.base = P.hips.pos[1])) + Math.abs(Math.cos(model.phase)) * 0.04 * Math.min(1, speed / 3);
  } else {
    P.legs.forEach((l, i) => { l.rot[0] = Math.sin(model.phase + i * 1.7) * 0.35 * Math.min(1, speed / 2); });
  }
}

function place(model, x, z, rot, k, init) {
  if (!model.init || init) { model.pos[0] = x; model.pos[2] = z; model.init = true; }
  else { model.pos[0] = lerp(model.pos[0], x, k); model.pos[2] = lerp(model.pos[2], z, k); }
  model.pos[1] = groundY(model.pos[0], model.pos[2]);
  if (rot !== undefined) model.rot[1] = angLerp(model.rot[1], rot, k);
}
function speedOf(model, dt) {
  const v = Math.hypot(model.pos[0] - (model.px ?? model.pos[0]), model.pos[2] - (model.pz ?? model.pos[2])) / Math.max(dt, 1e-3);
  model.px = model.pos[0]; model.pz = model.pos[2];
  model.v = lerp(model.v || 0, v, 0.3);
  return model.v;
}

// view : { myId, me, dt, time }
export function updateScene(S, st, view) {
  const k = 1 - Math.exp(-view.dt * 12);
  // Joueurs
  for (const id of ['A', 'B']) {
    const g = S.players[id], p = st.players[id];
    const mine = id === view.myId;
    const x = mine ? view.me.x : p.x, z = mine ? view.me.z : p.z, rot = mine ? view.me.rot : p.rot;
    if (mine && !p.locked) { g.pos[0] = x; g.pos[2] = z; g.pos[1] = groundY(x, z); g.rot[1] = angLerp(g.rot[1], rot, 1 - Math.exp(-view.dt * 18)); g.init = true; }
    else place(g, x, z, rot, k);
    const v = speedOf(g, view.dt);
    walk(g, v, view.time, view.dt);
    const load = Object.values(p.sac).reduce((a, b) => a + b, 0);
    const ps = 0.8 + load * 0.05;
    if (g.parts.pack) g.parts.pack.scl = [ps, ps, ps];
    const carrying = !st.core.placed && st.core.hand[id];
    const work = st.work[id];
    if (carrying) { g.parts.arms[0].rot[0] = -1.3; g.parts.arms[1].rot[0] = -1.3; }
    else if (work) {
      const a = -0.9 + Math.sin(view.time * 14) * 0.35;
      g.parts.arms[0].rot[0] = a; g.parts.arms[1].rot[0] = -0.9 - Math.sin(view.time * 14) * 0.35;
    } else {
      for (const [pid, pst] of Object.entries(st.plots)) if (pst.holder === id) { g.parts.arms[0].rot[0] = -1.4; g.parts.arms[1].rot[0] = -1.4; }
    }
  }

  // Débris
  NODES.forEach((n, i) => {
    const frac = st.nodes[i] / NODE_TYPES[n.type].qty;
    const m = S.nodes[i];
    const target = st.nodes[i] > 0 ? 0.45 + 0.55 * frac : 0.22;
    m.body.scl[1] = lerp(m.body.scl[1], target, k);
  });

  // Chantiers et machines
  for (const p of PLOTS) {
    const pst = st.plots[p.id], pm = S.plots[p.id], mm = S.machines[p.id];
    const unlocked = plotUnlocked(st, p);
    pm.visible = !pst.built;
    mm.visible = pst.built;
    const { ghost, scaffold, body, piles, frame } = pm.parts;
    frame.visible = unlocked;
    ghost.visible = unlocked && !pst.ready;
    ghost.mesh.mat.opacity = 0.1 + 0.06 * Math.sin(view.time * 3);
    scaffold.visible = unlocked && pst.ready;
    body.visible = unlocked && pst.ready && pst.prog > 0;
    body.scl[1] = Math.max(0.05, pst.prog);
    const sig = JSON.stringify(pst.del);
    if (piles.sig !== sig) {
      piles.sig = sig;
      piles.children = [];
      let i = 0;
      for (const it of ITEM_ORDER) {
        const n = pst.del[it] || 0;
        if (!n || pst.ready) continue;
        const pile = itemPile(it, Math.ceil(n / 2));
        pile.pos = [-MACHINES[p.type].w / 2 + 0.5 + (i % 3) * 1.1, 0.06, -MACHINES[p.type].d / 2 + 0.5 + Math.floor(i / 3) * 0.8];
        piles.add(pile);
        i++;
      }
    }
    const heavyM = pst.built && st.machines[p.id] && st.machines[p.id].broken === 'heavy';
    for (const side of ['L', 'R']) {
      const r = S.rings[p.id + side];
      r.visible = (unlocked && pst.ready && !pst.built) || heavyM;
      if (!r.visible) continue;
      const pt = side === 'L' ? postL(p) : postR(p);
      const who = heavyM ? (side === 'L' ? st.machines[p.id].cut : (['A', 'B'].find((id) => st.work[id] && st.work[id].kind === 'fixheavy' && st.work[id].mach === p.id) || null)) : (side === 'L' ? pst.holder : null);
      const near = ['A', 'B'].find((id) => Math.hypot(st.players[id].x - pt.x, st.players[id].z - pt.z) < POST_R);
      paintRing(r, who, near);
    }
    if (pst.built) {
      const m = st.machines[p.id], a = mm.anim;
      const run = m.run;
      if (a.mouth) a.mouth.mesh.mat.emissive = run ? [1.0, 0.45 + 0.15 * Math.sin(view.time * 9), 0.08] : [0.12, 0.04, 0.0];
      if (a.coil) a.coil.mesh.mat.emissive = run ? [1.0, 0.35, 0.1] : [0, 0, 0];
      if (a.arm) {
        a.arm.rot[1] = run ? Math.sin(view.time * 2.2) * 0.7 : lerp(a.arm.rot[1], 0, k);
        a.fore.rot[0] = run ? 0.3 + Math.sin(view.time * 4) * 0.3 : 0;
        const pulse = 0.4 + 0.25 * Math.sin(view.time * (run ? 6 : 2));
        a.core.mesh.mat.emissive = [0.1 * pulse * 2, 0.6 * pulse * 1.6, 0.7 * pulse * 1.6];
      }
      if (a.ring) { a.ring.rot[1] += view.dt * (m.busy ? 3 : 0.3); a.ring.pos[1] = 1.2 + (m.busy ? Math.sin(view.time * 4) * 0.3 : 0); }
      if (a.spool && run) a.spool.rot[1] += view.dt * 5;
      if (a.fly) { if (run) a.fly.rot[0] += view.dt * 9; a.tip.mesh.mat.emissive = run ? [0.9, 0.35 + 0.1 * Math.sin(view.time * 13), 0.05] : [0, 0, 0]; }
      if (a.melt) a.melt.mesh.mat.emissive = run ? [1.0, 0.45 + 0.1 * Math.sin(view.time * 5), 0.05] : [0.25, 0.06, 0.0];
      if (a.rollers && run) for (const [i, rl] of a.rollers.entries()) rl.rot[1] += view.dt * (i ? -6 : 6);
      if (a.beam) a.beam.pos[1] = run ? 1.0 + 0.8 * (0.5 + 0.5 * Math.sin(view.time * 4)) : 1.4;
      if (a.jaw) a.jaw.pos[1] = 1.15 + (run ? Math.abs(Math.sin(view.time * 8)) * 0.15 : 0);
      if (a.box) a.box.pos[0] = run ? -1.2 + ((view.time * 0.6) % 1) * 2.4 : -0.6;
      if (a.parm) a.parm.rot[1] = run ? Math.sin(view.time * 3) * 0.6 : 0;
      if (a.tool) a.tool.rot[0] = run ? -0.6 + Math.abs(Math.sin(view.time * 7)) * 0.9 : 0;
      if (a.piles) {
        const sig = JSON.stringify(m.inp);
        if (a.piles.sig !== sig) {
          a.piles.sig = sig;
          a.piles.children = [];
          let i = 0;
          for (const it of ITEM_ORDER) {
            const n = m.inp[it] || 0;
            if (!n || i >= 6) continue;
            const pile = itemPile(it, n);
            pile.pos = [-0.9 + (i % 3) * 0.95, 0, -0.45 + Math.floor(i / 3) * 0.8];
            a.piles.add(pile);
            i++;
          }
        }
      }
      // Surchauffe du générateur : il rougeoie et fume noir pendant la pause obligatoire
      const hot = m.type === 'generateur' && st.gen && st.gen.lockUntil > Date.now();
      const lamp = a.lamp.mesh.mat;
      if (m.broken || hot) { const b = Math.sin(view.time * 10) > 0 ? 1 : 0.2; lamp.color = [0.8, 0.1, 0.05]; lamp.emissive = [b, 0.05, 0.02]; }
      else if (run) { lamp.color = [0.2, 0.8, 0.3]; lamp.emissive = [0.15, 0.9, 0.25]; }
      else if (m.nopower) { const b = Math.sin(view.time * 4) > 0 ? 0.7 : 0.1; lamp.color = [0.3, 0.4, 0.9]; lamp.emissive = [0.1, 0.2, b]; }
      else { lamp.color = [0.8, 0.6, 0.1]; lamp.emissive = [0.6, 0.4, 0.05]; }
      if (hot && a.tip) a.tip.mesh.mat.emissive = [1.0, 0.2 + 0.1 * Math.sin(view.time * 20), 0.02];
      a.smoke.visible = !!(m.broken || hot);
      if (m.broken || hot) a.smoke.children.forEach((s, i) => {
        s.mesh.mat.color = m.broken === 'heavy' || hot ? [0.12, 0.12, 0.12] : [0.35, 0.35, 0.35];
        const t = (view.time * (m.broken === 'heavy' || hot ? 0.9 : 0.6) + i / 4) % 1;
        s.pos = [Math.sin(i * 2 + view.time) * 0.3, t * 2.2, Math.cos(i * 3) * 0.3];
        const sc = 0.6 + t * 1.4; s.scl = [sc, sc, sc];
        s.mesh.mat.opacity = 0.5 * (1 - t);
      });
    }
  }

  // Cœur d'assembleur
  S.core.visible = !st.core.placed;
  if (!st.core.placed) {
    place(S.core, st.core.x, st.core.z, undefined, k);
    const lifted = st.core.hand.A && st.core.hand.B;
    S.core.body.pos[1] = lerp(S.core.body.pos[1], lifted ? 0.35 : 0, k);
  }
  for (const side of ['L', 'R']) {
    const r = S.rings['core' + side];
    r.visible = !st.core.placed;
    if (!r.visible) continue;
    const hx = S.core.pos[0] + (side === 'L' ? -1 : 1) * CORE.handle, hz = S.core.pos[2];
    r.pos = [hx, groundY(hx, hz) + 0.04, hz];
    const who = ['A', 'B'].find((id) => st.core.hand[id] === side);
    const near = ['A', 'B'].find((id) => Math.hypot(st.players[id].x - hx, st.players[id].z - hz) < POST_R);
    paintRing(r, who, near);
  }

  // Droïdes
  const seen = new Set();
  for (const d of st.droids) {
    seen.add(d.id);
    let m = S.droids.get(d.id);
    if (!m) { m = droidModel(); S.root.add(m); S.droids.set(d.id, m); S.targets['droid' + d.id] = m; }
    if (m.type !== d.type) { m.setType(d.type); m.type = d.type; m.outfitK = undefined; }
    const wear = (st.wardrobe && st.wardrobe.wear[d.type]) || null;
    const ofit = d.type + JSON.stringify(wear);
    if (m.outfitK !== ofit) { m.setOutfit(d.type, wear); m.outfitK = ofit; }
    m.visible = d.st !== 'spec';
    place(m, d.x, d.z, d.rot, k);
    const v = speedOf(m, view.dt);
    walk(m, v, view.time, view.dt);
    const busy = (d.st === 'work' && st.machines[d.job] && st.machines[d.job].run) || d.repairing;
    if (busy && v < 0.3) {
      m.parts.arms[0].rot[0] = -1.0 + Math.sin(view.time * 9) * 0.4;
      m.parts.arms[1].rot[0] = -1.0 - Math.sin(view.time * 9) * 0.4;
    }
    if (d.carry && m.parts.arms) { m.parts.arms[0].rot[0] = -1.2; m.parts.arms[1].rot[0] = -1.2; }
    // Coin pause : assis sur le canapé ou debout, une tasse de café qu'il porte de temps en temps à la bouche
    const P = m.parts;
    P.mug.visible = !!d.pose;
    if (d.pose === 'sit') {
      P.hips.pos[1] = (P.hips.base ?? 0.72) - 0.26;
      P.legs[0].rot[0] = -1.15; P.legs[1].rot[0] = -1.15;
    }
    if (d.pose) {
      const ph = (view.time * 0.8 + d.id * 1.37) % 6;
      const sip = ph < 1.2 ? Math.sin((ph / 1.2) * Math.PI) : 0;
      P.arms[1].rot[0] = -0.95 - sip * 1.15;
      P.arms[0].rot[0] = d.pose === 'sit' ? -0.3 : 0.05;
      P.head.rot[0] = sip * -0.25;
    } else P.head.rot[0] = 0;
    P.mug.rot[0] = -P.arms[1].rot[0];
  }
  // Vapeur de la machine à café
  S.pause.anim.steam.children.forEach((s, i) => {
    const t = (view.time * 0.5 + i / 3) % 1;
    s.pos = [Math.sin(view.time * 1.3 + i * 2) * 0.05, t * 0.6, Math.cos(i * 3) * 0.04];
    const sc = 0.5 + t * 1.3; s.scl = [sc, sc, sc];
    s.mesh.mat.opacity = 0.45 * (1 - t);
  });
  for (const [id, m] of S.droids) if (!seen.has(id)) { m.visible = false; }

  // Créatures
  const seenA = new Set();
  for (const a of st.animals) {
    seenA.add(a.id);
    let m = S.animals.get(a.id);
    if (!m) { m = animalModel(a.sp); S.root.add(m); S.animals.set(a.id, m); S.targets['animal' + a.id] = m; }
    let x = a.x, z = a.z, rot = a.rot;
    if (a.st === 'installed' && a.mach) {
      const p = PLOTS.find((q) => q.id === a.mach), mw = MACHINES[p.type].w;
      x = p.x - mw / 2 - 0.9; z = p.z - 0.6 + a.slot * 1.2; rot = Math.PI / 2;
    }
    place(m, x, z, rot, k);
    const v = speedOf(m, view.dt);
    walk(m, a.st === 'installed' ? 0.6 : v, view.time, view.dt);
    const P = m.parts;
    if (P.body) P.body.pos[1] = (P.body.base ?? (P.body.base = P.body.pos[1])) + (a.st === 'corner' ? Math.sin(view.time * 30) * 0.03 : Math.sin(view.time * 3 + a.id) * 0.03);
    if (P.tail) P.tail.rot[1] = Math.sin(view.time * 4 + a.id) * 0.5;
  }
  for (const [id, m] of S.animals) if (!seenA.has(id)) m.visible = false;

  // Surbrillance de la cible du joueur local
  clearGlow(S);
  for (const key in S.targets) S.targets[key].glow(null);
  const h = st.players[view.myId].hint;
  if (h && !h.off) {
    let key = h.key;
    const pid0 = key.replace(/[LR]$/, '');
    if (st.plots[pid0]) {
      const pid = pid0;
      const node = st.plots[pid] && st.plots[pid].built ? S.machines[pid] : S.plots[pid];
      key = null;
      const c = PLAYER_COLORS[view.myId].rgb, pulse = 0.12 + 0.05 * Math.sin(view.time * 6);
      node.glow([c[0] * pulse, c[1] * pulse, c[2] * pulse]);
    } else if (/^core[LR]$/.test(key)) key = null, S.core.glow(PLAYER_COLORS[view.myId].rgb.map((v) => v * 0.15));
    if (key && S.targets[key]) {
      const c = PLAYER_COLORS[view.myId].rgb, pulse = 0.12 + 0.05 * Math.sin(view.time * 6);
      S.targets[key].glow([c[0] * pulse, c[1] * pulse, c[2] * pulse]);
    }
  }
}

// Remet à zéro les surbrillances des machines (elles ne sont pas dans targets)
export function clearGlow(S) {
  for (const p of PLOTS) { S.plots[p.id].glow(null); S.machines[p.id].glow(null); }
  S.core.glow(null);
}
