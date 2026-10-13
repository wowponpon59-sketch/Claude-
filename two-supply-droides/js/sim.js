// Simulation de référence (téléphone hôte, ou le seul téléphone en solo).
import {
  REACH, POST_R, SAC_MAX, CARRY_SPEED, T, SCREWS, ITEMS, NODE_TYPES, MACHINES, PLOTS, ENTREPOT,
  START, CORE, DROIDS, ANIMALS, ANIMAL_COUNT, LEVELS, other,
} from './config.js';
import { NODES, ANIMAL_HOMES, PLOT_BY_ID, plotBox } from './world.js';
import { boxDist, obstacles, moveBox, steer } from './move.js';

const IDS = ['A', 'B'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const fmt = (o) => Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ');

export function newState(mode = 'duo') {
  const S = {
    mode, time: 0, level: 0, goals: {}, won: false,
    players: { A: newPlayer(START.A), B: newPlayer(START.B) },
    nodes: NODES.map((n) => NODE_TYPES[n.type].qty),
    nodeT: NODES.map(() => 0),
    stock: {},
    plots: {},
    machines: {},
    core: { x: CORE.x, z: CORE.z, hand: { A: null, B: null }, placed: false, warn: 0 },
    droids: [],
    animals: [],
    work: { A: null, B: null },
    seq: 1,
    made: 0,
    animalT: 0,
    fx: [],
    cd: { A: 0, B: 0 },
  };
  for (const p of PLOTS) S.plots[p.id] = { del: {}, ready: false, prog: 0, holder: null, built: false };
  ANIMAL_HOMES.slice(0, ANIMAL_COUNT).forEach((h, i) => spawnAnimal(S, h, Object.keys(ANIMALS)[i % 3]));
  return S;
}

function newPlayer(p) {
  return { x: p.x, z: p.z, rot: Math.PI, sac: {}, locked: false, hint: null, wait: null };
}

function spawnAnimal(S, home, sp) {
  S.animals.push({ id: S.seq++, sp, x: home.x, z: home.z, rot: 0, st: 'wander', home: { ...home }, tx: home.x, tz: home.z, pause: 0, by: null, mach: null });
}

// ---------- effets ----------
function fx(S, to, k, extra = {}) { S.fx.push({ to, k, ...extra }); }
function toast(S, to, text, tone = 'info') { fx(S, to, 'toast', { text, tone }); }
function sfx(S, to, s) { fx(S, to, 'sfx', { s }); }
function call(S, to, text, x, z) {
  if (S.mode === 'solo' && to === 'B') return;
  if (S.cd[to] > 0) return;
  S.cd[to] = 4;
  fx(S, to, 'call', { text, x, z });
}
export function drainFx(S) { const l = S.fx; S.fx = []; return l; }

// ---------- utilitaires ----------
export function plotUnlocked(S, p) { return (p.level || 1) <= S.level + 1; }
function machineAt(S, id) { return S.machines[id]; }
export function front(p) { const m = MACHINES[p.type]; return { x: p.x, z: p.z + m.d / 2 + 0.9 }; }
export function postL(p) { const m = MACHINES[p.type]; return { x: p.x - m.w / 2 - 0.9, z: p.z }; }
export function postR(p) { const m = MACHINES[p.type]; return { x: p.x + m.w / 2 + 0.9, z: p.z }; }
const HQ = { x: ENTREPOT.x, z: ENTREPOT.z - ENTREPOT.d / 2 - 1.0 };
export function hqSpot(i) { return { x: ENTREPOT.x - 1.6 + (i % 4) * 1.1, z: ENTREPOT.z + ENTREPOT.d / 2 + 1.0 + Math.floor(i / 4) * 1.0 }; }
const sacCount = (p) => sum(p.sac);
function addSac(p, item, n) { p.sac[item] = (p.sac[item] || 0) + n; }
function addStock(S, item, n) { S.stock[item] = (S.stock[item] || 0) + n; }
function have(S, p, item) { return (p ? p.sac[item] || 0 : 0) + (S.stock[item] || 0); }
function canPay(S, p, cost) { return Object.entries(cost).every(([k, n]) => have(S, p, k) >= n); }
function pay(S, p, cost) {
  for (const [k, n] of Object.entries(cost)) {
    let left = n;
    if (p) { const t = Math.min(left, p.sac[k] || 0); p.sac[k] = (p.sac[k] || 0) - t; left -= t; }
    S.stock[k] = (S.stock[k] || 0) - left;
  }
}
function needOf(m) {
  const r = MACHINES[m.type].recipe;
  if (!r) return {};
  const out = {};
  for (const [k, n] of Object.entries(r.in)) out[k] = Math.max(0, n * 2 - (m.inp[k] || 0));
  return out;
}
function hasInputs(m) {
  const r = MACHINES[m.type].recipe;
  return r && Object.entries(r.in).every(([k, n]) => (m.inp[k] || 0) >= n);
}
export function cadence(m) { return 1 + T.animalBoost * m.animals.length; }
function missingFor(S, plotId) {
  const st = S.plots[plotId], cost = MACHINES[PLOT_BY_ID[plotId].type].cost, miss = {};
  for (const [k, n] of Object.entries(cost)) miss[k] = Math.max(0, n - (st.del[k] || 0));
  return miss;
}
function followers(S, id) { return S.droids.filter((d) => d.st === 'follow' && d.who === id); }

// ---------- ce que le joueur peut faire là où il est ----------
export function targets(S, id) {
  const p = S.players[id];
  const out = [];
  const add = (key, d, o) => out.push({ key, d, kind: 'solo', ...o });
  const full = sacCount(p) >= SAC_MAX;

  if (!S.core.placed && S.core.hand[id]) {
    return [{ key: 'core' + S.core.hand[id], d: 0, kind: 'duo', act: 'ungrab', label: 'Lâcher la caisse' }];
  }
  const fol = followers(S, id);
  const folOuvrier = fol.find((d) => d.type === 'ouvrier');
  const folSpec = fol.find((d) => d.type !== 'ouvrier');
  const myAnimal = S.animals.find((a) => a.st === 'caught' && a.by === id);

  // Débris
  NODES.forEach((n, i) => {
    const r = NODE_TYPES[n.type].r;
    const d = Math.max(0, dist(p, n) - r);
    if (d > REACH) return;
    const key = 'node' + i;
    if (S.nodes[i] <= 0) add(key, d, { off: true, label: `Vide : repousse dans ${Math.ceil(S.nodeT[i])} s` });
    else if (full) add(key, d, { off: true, label: 'Sac plein : va à l’entrepôt' });
    else add(key, d, { act: 'dig', node: i, label: `Fouiller : ${NODE_TYPES[n.type].name.toLowerCase()}` });
  });

  // Entrepôt
  {
    const d = boxDist(p, ENTREPOT);
    if (d <= REACH) {
      const need = {};
      for (const m of Object.values(S.machines)) for (const [k, n] of Object.entries(needOf(m))) need[k] = (need[k] || 0) + n;
      const avail = Object.entries(need).some(([k, n]) => n > 0 && (S.stock[k] || 0) > 0);
      if (folSpec) add('entrepot', d, { act: 'assignHQ', label: `Mettre au travail : ${DROIDS[folSpec.type].name.toLowerCase()}` });
      else if (sacCount(p) > 0) add('entrepot', d, { act: 'deposit', label: `Tout déposer (${sacCount(p)})` });
      else if (avail) add('entrepot', d, { act: 'fetch', label: 'Prendre pour les machines' });
      else add('entrepot', d, { off: true, label: 'Entrepôt : apporte des matériaux' });
    }
  }

  // Chantiers et machines
  for (const pl of PLOTS) {
    const st = S.plots[pl.id];
    const box = plotBox(pl);
    const d = boxDist(p, box);
    const near = d <= REACH;
    if (!plotUnlocked(S, pl)) { if (near) add(pl.id, d, { off: true, label: `Chantier débloqué au niveau ${pl.level}` }); continue; }
    if (!st.built) {
      if (st.ready) {
        const dl = dist(p, postL(pl)), dr = dist(p, postR(pl));
        if (dl <= POST_R && st.holder !== other(id)) add(pl.id + 'L', dl, { kind: 'duo', act: 'hold', plot: pl.id, label: st.holder === id ? 'Tenir… (garde appuyé)' : 'Tenir la pièce' });
        if (dr <= POST_R) add(pl.id + 'R', dr, { kind: 'duo', act: 'screw', plot: pl.id, label: 'Visser' });
        if (near && dl > POST_R && dr > POST_R) add(pl.id, d + 0.3, { off: true, kind: 'duo', label: 'Montage à deux : un côté tient, l’autre visse' });
        continue;
      }
      if (!near) continue;
      const miss = missingFor(S, pl.id);
      const can = Object.entries(miss).some(([k, n]) => n > 0 && have(S, p, k) > 0);
      if (can) add(pl.id, d, { act: 'deliver', plot: pl.id, label: 'Apporter les matériaux' });
      else if (sum(miss) > 0) add(pl.id, d, { off: true, label: 'Il manque : ' + fmt(miss) });
      else if (MACHINES[pl.type].core && !S.core.placed) add(pl.id, d, { off: true, kind: 'duo', label: 'Il manque le cœur d’assembleur' });
      continue;
    }
    if (!near) continue;
    const m = machineAt(S, pl.id);
    const rec = MACHINES[m.type].recipe;
    if (m.broken) { add(pl.id, d, { act: 'repair', label: 'Réparer la panne (garder appuyé)' }); continue; }
    if (myAnimal && m.animals.length < T.animalMax) { add(pl.id, d, { act: 'install', label: `Installer ${ANIMALS[myAnimal.sp].name} (+25 %)` }); continue; }
    if (!rec) {
      if (folOuvrier && !m.busy) add(pl.id, d, { act: 'specmenu', label: 'Spécialiser le droïde' });
      else if (m.busy) add(pl.id, d, { off: true, label: 'Formation en cours…' });
      else add(pl.id, d, { off: true, label: 'Amène un droïde standard' });
      continue;
    }
    if (folOuvrier && !m.operator) { add(pl.id, d, { act: 'assign', label: 'Affecter le droïde ici' }); continue; }
    if (m.out > 0 && !full) { add(pl.id, d, { act: 'collect', label: `Récupérer ${m.out} ${ITEMS[rec.out].name.toLowerCase()}` }); continue; }
    const need = needOf(m);
    if (Object.entries(need).some(([k, n]) => n > 0 && (p.sac[k] || 0) > 0)) { add(pl.id, d, { act: 'load', label: 'Charger la machine' }); continue; }
    const missing = Object.fromEntries(Object.entries(rec.in).map(([k, n]) => [k, Math.max(0, n - (m.inp[k] || 0))]));
    if (m.operator) add(pl.id, d, { off: true, label: hasInputs(m) ? 'Le droïde fait tourner la machine' : 'En attente : ' + fmt(missing) });
    else if (!hasInputs(m)) add(pl.id, d, { off: true, label: 'Il manque : ' + fmt(missing) });
    else if (rec.out !== 'droide' && m.out >= 3) add(pl.id, d, { off: true, label: 'Sortie pleine : récupère la production' });
    else add(pl.id, d, { act: 'operate', label: 'Actionner (garder appuyé)' });
  }

  // Droïdes
  for (const dr of S.droids) {
    const d = dist(p, dr);
    if (d > 1.5) continue;
    if (dr.st === 'idle') add('droid' + dr.id, d - 0.2, { act: 'take', droid: dr.id, label: `Emmener le droïde ${DROIDS[dr.type].name.toLowerCase()}` });
    else if ((dr.st === 'work' || dr.st === 'go') && fol.length === 0) add('droid' + dr.id, d + 1.0, { act: 'reprendre', droid: dr.id, label: 'Reprendre ce droïde' });
  }

  // Cœur d'assembleur (caisse à porter à deux)
  if (!S.core.placed) {
    const c = S.core;
    for (const side of ['L', 'R']) {
      const hp = { x: c.x + (side === 'L' ? -1 : 1) * CORE.handle, z: c.z };
      const d = dist(p, hp);
      if (d > POST_R || c.hand[other(id)] === side) continue;
      add('core' + side, d, { kind: 'duo', act: 'grab', side, label: 'Saisir la poignée' });
    }
  }

  // Créatures sauvages
  for (const a of S.animals) {
    if (a.st !== 'wander' && a.st !== 'flee' && a.st !== 'corner') continue;
    const d = dist(p, a);
    if (d > 2.0) continue;
    if (myAnimal) add('animal' + a.id, d, { off: true, kind: 'duo', label: 'Tu tiens déjà une créature' });
    else if (a.st === 'corner') add('animal' + a.id, d, { kind: 'duo', act: 'catch', animal: a.id, label: `Attraper le ${ANIMALS[a.sp].name}` });
    else add('animal' + a.id, d + 0.4, { off: true, kind: 'duo', label: 'Il esquive : prenez-le en tenaille à deux' });
  }

  if (!out.length && fol.length) out.push({ key: 'leave', d: 9, kind: 'solo', act: 'leave', label: fol.length > 1 ? 'Laisser les droïdes ici' : 'Laisser le droïde ici' });
  out.sort((a, b) => (a.off ? 0.6 : 0) + a.d - ((b.off ? 0.6 : 0) + b.d));
  return out;
}

// ---------- appui sur Action ----------
function press(S, id) {
  const p = S.players[id];
  const t = targets(S, id)[0];
  if (!t) return;
  if (t.off) { sfx(S, id, 'err'); return; }
  const o = other(id);
  switch (t.act) {
    case 'dig': S.work[id] = { kind: 'dig', key: t.key, node: t.node, t: 0 }; break;
    case 'operate': S.work[id] = { kind: 'operate', key: t.key }; break;
    case 'repair': S.work[id] = { kind: 'repair', key: t.key, t: 0 }; break;
    case 'deposit': {
      const n = sacCount(p);
      for (const [k, v] of Object.entries(p.sac)) if (v > 0) addStock(S, k, v);
      p.sac = {};
      sfx(S, id, 'drop');
      toast(S, id, `${n} déposé${n > 1 ? 's' : ''} à l’entrepôt`, 'good');
      break;
    }
    case 'fetch': {
      const need = {};
      for (const m of Object.values(S.machines)) for (const [k, n] of Object.entries(needOf(m))) need[k] = (need[k] || 0) + n;
      for (const [k, n] of Object.entries(need)) {
        const room = SAC_MAX - sacCount(p);
        const q = Math.min(n, S.stock[k] || 0, room);
        if (q > 0) { S.stock[k] -= q; addSac(p, k, q); }
      }
      sfx(S, id, 'pick');
      break;
    }
    case 'deliver': {
      const st = S.plots[t.plot];
      const miss = missingFor(S, t.plot);
      for (const [k, n] of Object.entries(miss)) {
        const q = Math.min(n, have(S, p, k));
        if (q > 0) { pay(S, p, { [k]: q }); st.del[k] = (st.del[k] || 0) + q; }
      }
      checkReady(S, t.plot);
      sfx(S, id, 'drop');
      if (!st.ready) {
        const left = missingFor(S, t.plot);
        toast(S, id, sum(left) ? 'Encore : ' + fmt(left) : 'Il manque le cœur d’assembleur (à ramener à deux)', 'info');
      }
      break;
    }
    case 'hold': S.plots[t.plot].holder = id; sfx(S, id, 'clong'); break;
    case 'screw': {
      const st = S.plots[t.plot];
      if (st.holder && st.holder !== id) {
        st.prog = Math.min(1, st.prog + 1 / SCREWS);
        sfx(S, 'all', 'tap');
        if (st.prog >= 1) build(S, t.plot);
      } else {
        toast(S, id, 'Quelqu’un doit tenir la pièce de l’autre côté !', 'warn');
        sfx(S, id, 'err');
        const pl = PLOT_BY_ID[t.plot], pt = postL(pl);
        call(S, o, 'Ton partenaire visse : va tenir la pièce de l’autre côté !', pt.x, pt.z);
      }
      break;
    }
    case 'collect': {
      const m = S.machines[t.key];
      const q = Math.min(m.out, SAC_MAX - sacCount(p));
      m.out -= q;
      addSac(p, MACHINES[m.type].recipe.out, q);
      sfx(S, id, 'pick');
      break;
    }
    case 'load': {
      const m = S.machines[t.key];
      for (const [k, n] of Object.entries(needOf(m))) {
        const q = Math.min(n, p.sac[k] || 0);
        if (q > 0) { p.sac[k] -= q; m.inp[k] = (m.inp[k] || 0) + q; }
      }
      sfx(S, id, 'drop');
      break;
    }
    case 'assign': {
      const m = S.machines[t.key];
      const dr = followers(S, id).find((d) => d.type === 'ouvrier');
      dr.st = 'go'; dr.job = t.key; dr.who = null;
      m.operator = dr.id;
      sfx(S, id, 'ok');
      toast(S, 'all', `Un droïde fait maintenant tourner : ${MACHINES[m.type].name.toLowerCase()}`, 'good');
      break;
    }
    case 'assignHQ': {
      const dr = followers(S, id).find((d) => d.type !== 'ouvrier');
      dr.st = 'work'; dr.job = 'hq'; dr.who = null; dr.task = null;
      sfx(S, id, 'ok');
      toast(S, 'all', `${DROIDS[dr.type].name} au travail !`, 'good');
      break;
    }
    case 'specmenu': fx(S, id, 'specmenu'); break;
    case 'install': {
      const m = S.machines[t.key];
      const a = S.animals.find((x) => x.st === 'caught' && x.by === id);
      a.st = 'installed'; a.mach = t.key; a.slot = m.animals.length; a.by = null;
      m.animals.push(a.sp);
      sfx(S, 'all', 'ok');
      toast(S, 'all', `${ANIMALS[a.sp].name} installé : cadence ${Math.round(cadence(m) * 100)} %`, 'good');
      S.animalT = T.bumpBack;
      break;
    }
    case 'take': {
      const dr = S.droids.find((d) => d.id === t.droid);
      dr.st = 'follow'; dr.who = id;
      sfx(S, id, 'pick');
      break;
    }
    case 'reprendre': {
      const dr = S.droids.find((d) => d.id === t.droid);
      releaseDroid(S, dr);
      dr.st = 'follow'; dr.who = id;
      sfx(S, id, 'pick');
      break;
    }
    case 'leave':
      for (const d of followers(S, id)) { d.st = 'idle'; d.who = null; }
      break;
    case 'grab': {
      const c = S.core;
      c.hand[id] = t.side;
      p.locked = true;
      sfx(S, id, 'clong');
      if (!c.hand[o]) call(S, o, 'Ton partenaire tient la caisse du cœur : il faut être deux pour la porter !', c.x, c.z);
      else { toast(S, 'all', 'Caisse soulevée ! Allez dans la même direction.', 'good'); sfx(S, 'all', 'clong'); }
      break;
    }
    case 'ungrab': S.core.hand[id] = null; p.locked = false; break;
    case 'catch': {
      const a = S.animals.find((x) => x.id === t.animal);
      a.st = 'caught'; a.by = id;
      sfx(S, 'all', 'ok');
      toast(S, 'all', `${ANIMALS[a.sp].name} capturé ! Amène-le sur une machine.`, 'good');
      break;
    }
  }
}

function release(S, id) {
  for (const st of Object.values(S.plots)) if (st.holder === id) st.holder = null;
  S.work[id] = null;
}

function releaseDroid(S, dr) {
  if (dr.job && S.machines[dr.job] && S.machines[dr.job].operator === dr.id) S.machines[dr.job].operator = null;
  if (dr.task && dr.task.load) { addStock(S, dr.task.item, dr.task.load); }
  dr.job = null; dr.task = null; dr.carry = null;
}

function checkReady(S, plotId) {
  const st = S.plots[plotId];
  const pl = PLOT_BY_ID[plotId];
  const ok = sum(missingFor(S, plotId)) === 0 && (!MACHINES[pl.type].core || S.core.placed);
  if (ok && !st.ready) {
    st.ready = true;
    toast(S, 'all', `${MACHINES[pl.type].name} : matériaux livrés. Montez-la à deux !`, 'good');
    sfx(S, 'all', 'ok');
  }
}

function build(S, plotId) {
  const st = S.plots[plotId], pl = PLOT_BY_ID[plotId];
  st.built = true; st.holder = null;
  S.machines[plotId] = { id: plotId, type: pl.type, inp: {}, out: 0, t: 0, operator: null, broken: false, wear: wearTime(), animals: [], busy: null, run: false };
  sfx(S, 'all', 'won');
  toast(S, 'all', `${MACHINES[pl.type].name} construite !`, 'good');
}
export function forceBuild(S, plotId) { const st = S.plots[plotId]; st.del = { ...MACHINES[PLOT_BY_ID[plotId].type].cost }; st.ready = true; build(S, plotId); }
function wearTime() { return T.pannes[0] + Math.random() * (T.pannes[1] - T.pannes[0]); }

// ---------- boucle ----------
export function step(S, dt, inputs) {
  S.time += dt;
  for (const id of IDS) {
    S.cd[id] = Math.max(0, S.cd[id] - dt);
    const p = S.players[id], inp = inputs[id];
    if (!inp) continue;
    if (!p.locked && Number.isFinite(inp.x) && Number.isFinite(inp.z)) { p.x = inp.x; p.z = inp.z; p.rot = inp.rot || 0; }
  }
  for (const id of IDS) {
    const inp = inputs[id];
    if (!inp || !inp.events) continue;
    for (const e of inp.events) {
      if (e === 'down') press(S, id);
      else if (e === 'up') release(S, id);
      else if (e && e.c === 'spec') specialize(S, id, e.type);
    }
  }
  for (const m of Object.values(S.machines)) m.manual = null;
  for (const id of IDS) holdWork(S, id, inputs[id] || {}, dt);
  carry(S, inputs, dt);
  machines(S, dt);
  droids(S, dt);
  animals(S, dt);
  nodes(S, dt);
  goals(S);
  for (const id of IDS) {
    const t = targets(S, id)[0];
    S.players[id].hint = t ? { key: t.key, label: t.label, kind: t.kind, off: !!t.off } : null;
  }
  waits(S);
}

function holdWork(S, id, inp, dt) {
  const p = S.players[id];
  const w = S.work[id];
  for (const [pid, st] of Object.entries(S.plots)) {
    if (st.holder === id && (!inp.held || dist(p, postL(PLOT_BY_ID[pid])) > POST_R)) st.holder = null;
  }
  if (!w) return;
  const t = targets(S, id)[0];
  if (!inp.held || !t || t.key !== w.key) { S.work[id] = null; return; }
  if (w.kind === 'dig') {
    if (t.act !== 'dig') { S.work[id] = null; return; }
    w.t += dt;
    if (w.t >= T.dig) {
      w.t = 0;
      const n = NODES[w.node];
      S.nodes[w.node] -= 1;
      addSac(p, NODE_TYPES[n.type].item, 1);
      sfx(S, id, 'pick');
      if (S.nodes[w.node] <= 0) { S.nodeT[w.node] = T.respawn; S.work[id] = null; }
      else if (sacCount(p) >= SAC_MAX) { S.work[id] = null; toast(S, id, 'Sac plein : va vider ton sac à l’entrepôt.', 'warn'); }
    }
  } else if (w.kind === 'operate') {
    if (t.act !== 'operate') { S.work[id] = null; return; }
    S.machines[w.key].manual = id;
  } else if (w.kind === 'repair') {
    w.t += dt;
    if (w.t >= T.repair) {
      S.work[id] = null;
      const m = S.machines[w.key];
      m.broken = false; m.wear = wearTime();
      sfx(S, id, 'ok');
      toast(S, 'all', `${MACHINES[m.type].name} réparée.`, 'good');
    }
  }
}

function carry(S, inputs, dt) {
  const c = S.core;
  if (c.placed) return;
  c.warn = Math.max(0, c.warn - dt);
  if (c.hand.A && c.hand.B) {
    const a = inputs.A || {}, b = inputs.B || {};
    const ax = a.mx || 0, az = a.mz || 0, bx = b.mx || 0, bz = b.mz || 0;
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    let vx = (ax + bx) / 2, vz = (az + bz) / 2;
    if (la > 0.25 && lb > 0.25 && (ax * bx + az * bz) / (la * lb) < -0.3) {
      vx = 0; vz = 0;
      if (c.warn <= 0) { toast(S, 'all', 'Vous tirez dans des sens opposés !', 'warn'); sfx(S, 'all', 'err'); }
      c.warn = 1.5;
    }
    const groupW = CORE.w + 2 * (CORE.handle - CORE.w / 2 + 0.4);
    const obs = obstacles(S).filter((o) => !o.core);
    [c.x, c.z] = moveBox(c.x, c.z, vx * CARRY_SPEED * dt, vz * CARRY_SPEED * dt, groupW, CORE.d, obs);
    const target = PLOT_BY_ID.assembleur;
    if (Math.hypot(c.x - target.x, c.z - target.z) < 2.2) {
      c.x = target.x; c.z = target.z; c.placed = true;
      for (const id of IDS) {
        const p = S.players[id];
        const post = c.hand[id] === 'L' ? postL(target) : postR(target);
        p.x = post.x; p.z = post.z; p.locked = false;
      }
      c.hand = { A: null, B: null };
      sfx(S, 'all', 'won');
      toast(S, 'all', 'Cœur d’assembleur en place !', 'good');
      checkReady(S, 'assembleur');
      return;
    }
  }
  for (const id of IDS) {
    const side = c.hand[id];
    if (!side) continue;
    const p = S.players[id];
    p.x = c.x + (side === 'L' ? -1 : 1) * CORE.handle;
    p.z = c.z;
    p.rot = side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  }
}

function machines(S, dt) {
  for (const m of Object.values(S.machines)) {
    const rec = MACHINES[m.type].recipe;
    m.run = false;
    if (!rec || m.broken) continue;
    const op = m.operator ? S.droids.find((d) => d.id === m.operator && d.st === 'work') : null;
    const full = rec.out !== 'droide' && m.out >= 3;
    if (!(op || m.manual) || !hasInputs(m) || full) continue;
    m.run = true;
    m.t += dt * cadence(m);
    if (S.level >= 1) {
      m.wear -= dt;
      if (m.wear <= 0) {
        m.broken = true;
        sfx(S, 'all', 'err');
        toast(S, 'all', `Panne : ${MACHINES[m.type].name.toLowerCase()} !`, 'bad');
        continue;
      }
    }
    if (m.t >= rec.time) {
      m.t = 0;
      for (const [k, n] of Object.entries(rec.in)) m.inp[k] -= n;
      if (rec.out === 'droide') {
        const pl = PLOT_BY_ID[m.id];
        const n = S.droids.filter((d) => d.st === 'idle').length;
        S.droids.push({ id: S.seq++, type: 'ouvrier', x: pl.x + MACHINES[m.type].w / 2 + 1.3, z: pl.z + 1.2 + (n % 3) * 0.9, rot: 0, st: 'idle', who: null, job: null, task: null, carry: null });
        S.made += 1;
        sfx(S, 'all', 'won');
        toast(S, 'all', S.made === 1 ? 'Premier droïde produit ! Emmène-le sur une machine.' : 'Nouveau droïde produit.', 'good');
      } else {
        m.out += 1;
        sfx(S, 'all', 'ding');
      }
    }
  }
}

// ---------- droïdes ----------
function droids(S, dt) {
  const obs = obstacles(S);
  const fcount = { A: 0, B: 0 };
  for (const d of S.droids) {
    d.moving = false;
    if (d.st === 'follow') {
      const p = S.players[d.who];
      const k = fcount[d.who]++;
      const back = 1.6 + k * 1.1;
      const tx = p.x - Math.sin(p.rot) * back, tz = p.z - Math.cos(p.rot) * back;
      if (Math.hypot(tx - d.x, tz - d.z) > 0.35) { steer(d, tx, tz, 4.8, dt, obs, 0.35); d.moving = true; }
    } else if (d.st === 'go' || (d.st === 'work' && d.type === 'ouvrier')) {
      const m = S.machines[d.job];
      if (!m) { d.st = 'idle'; continue; }
      const f = front(PLOT_BY_ID[d.job]);
      const r = Math.hypot(f.x - d.x, f.z - d.z);
      if (r > 0.3) { steer(d, f.x, f.z, 3.2, dt, obs, 0.35); d.moving = true; d.st = 'go'; }
      else { d.st = 'work'; d.rot = Math.PI; }
    } else if (d.st === 'spec') {
      d.t -= dt;
      if (d.t <= 0) {
        d.type = d.spec; d.spec = null;
        d.st = 'follow';
        const m = S.machines.atelier;
        if (m) m.busy = null;
        sfx(S, 'all', 'won');
        toast(S, 'all', `Nouveau ${DROIDS[d.type].name.toLowerCase()} ! Mets-le au travail à l’entrepôt.`, 'good');
      }
    } else if (d.st === 'work' && d.job === 'hq') {
      if (d.type === 'logistique') logistics(S, d, dt, obs);
      else if (d.type === 'maintenance') maintenance(S, d, dt, obs);
      else if (d.type === 'ingenieur') engineer(S, d, dt, obs);
    }
  }
}

function goTo(d, pt, dt, obs, speed = 3.9) {
  const r = Math.hypot(pt.x - d.x, pt.z - d.z);
  if (r > 0.35) { steer(d, pt.x, pt.z, speed, dt, obs, 0.35); d.moving = true; return false; }
  return true;
}
function hqIndex(S, d) { return S.droids.filter((x) => x.job === 'hq').indexOf(d); }

function logistics(S, d, dt, obs) {
  if (!d.task) {
    const busy = new Set(S.droids.filter((x) => x !== d && x.task).map((x) => x.task.sig));
    let task = null;
    for (const m of Object.values(S.machines)) {
      const rec = MACHINES[m.type].recipe;
      if (!rec || rec.out === 'droide' || m.out <= 0) continue;
      const asm = Object.values(S.machines).find((x) => x.type === 'assembleur' && (needOf(x)[rec.out] || 0) > 0);
      const t = { from: m.id, to: asm ? asm.id : 'hq', item: rec.out, sig: m.id + '>' + rec.out };
      if (!busy.has(t.sig)) { task = t; break; }
    }
    if (!task) {
      for (const m of Object.values(S.machines)) {
        for (const [k, n] of Object.entries(needOf(m))) {
          if (n <= 0 || (S.stock[k] || 0) <= 0) continue;
          const t = { from: 'hq', to: m.id, item: k, sig: 'hq>' + m.id + k };
          if (!busy.has(t.sig)) { task = t; break; }
        }
        if (task) break;
      }
    }
    if (!task) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
    d.task = { ...task, phase: 'pick', load: 0 };
  }
  const t = d.task;
  const spot = (where) => (where === 'hq' ? HQ : front(PLOT_BY_ID[where]));
  if (t.phase === 'pick') {
    if (!goTo(d, spot(t.from), dt, obs)) return;
    if (t.from === 'hq') {
      const m = S.machines[t.to];
      const q = Math.min(3, S.stock[t.item] || 0, m ? needOf(m)[t.item] || 0 : 0);
      if (q <= 0) { d.task = null; return; }
      S.stock[t.item] -= q; t.load = q;
    } else {
      const m = S.machines[t.from];
      const q = Math.min(3, m.out);
      if (q <= 0) { d.task = null; return; }
      m.out -= q; t.load = q;
    }
    d.carry = t.item; t.phase = 'drop';
  } else if (t.phase === 'drop') {
    if (!goTo(d, spot(t.to), dt, obs)) return;
    if (t.to === 'hq') addStock(S, t.item, t.load);
    else {
      const m = S.machines[t.to];
      const room = needOf(m)[t.item] || 0;
      const q = Math.min(room, t.load);
      m.inp[t.item] = (m.inp[t.item] || 0) + q;
      if (t.load - q > 0) addStock(S, t.item, t.load - q);
    }
    d.carry = null; d.task = null;
  }
}

function maintenance(S, d, dt, obs) {
  if (!d.task) {
    const taken = new Set(S.droids.filter((x) => x !== d && x.task).map((x) => x.task.sig));
    const m = Object.values(S.machines).find((x) => x.broken && !taken.has('fix' + x.id));
    if (!m) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
    d.task = { sig: 'fix' + m.id, mach: m.id, t: 0 };
  }
  const m = S.machines[d.task.mach];
  if (!m.broken) { d.task = null; return; }
  if (!goTo(d, front(PLOT_BY_ID[m.id]), dt, obs, 3.8)) return;
  d.task.t += dt;
  d.repairing = true;
  if (d.task.t >= T.repair) {
    m.broken = false; m.wear = wearTime();
    d.task = null; d.repairing = false;
    sfx(S, 'all', 'ok');
    toast(S, 'all', `L’agent de maintenance a réparé : ${MACHINES[m.type].name.toLowerCase()}.`, 'good');
  }
}

function engineer(S, d, dt, obs) {
  if (!d.task) {
    const pl = PLOTS.find((p) => plotUnlocked(S, p) && !S.plots[p.id].built && !MACHINES[p.type].core &&
      !S.droids.some((x) => x !== d && x.task && x.task.plot === p.id) &&
      (S.plots[p.id].ready || Object.entries(missingFor(S, p.id)).every(([k, n]) => (S.stock[k] || 0) >= n)));
    if (!pl) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
    d.task = { plot: pl.id, t: 0, sig: 'build' + pl.id };
  }
  const pl = PLOT_BY_ID[d.task.plot], st = S.plots[pl.id];
  if (st.built) { d.task = null; return; }
  if (!goTo(d, postR(pl), dt, obs, 3.6)) return;
  if (!st.ready) {
    const miss = missingFor(S, pl.id);
    for (const [k, n] of Object.entries(miss)) {
      const q = Math.min(n, S.stock[k] || 0);
      if (q > 0) { S.stock[k] -= q; st.del[k] = (st.del[k] || 0) + q; }
    }
    checkReady(S, pl.id);
    if (!st.ready) { d.task = null; return; }
  }
  d.task.t += dt;
  d.repairing = true;
  if (d.task.t >= 0.9) {
    d.task.t = 0;
    st.prog = Math.min(1, st.prog + 1 / (SCREWS * 1.5));
    if (st.prog >= 1) { build(S, pl.id); d.task = null; d.repairing = false; toast(S, 'all', 'L’ingénieur a monté une nouvelle machine.', 'good'); }
  }
}

function specialize(S, id, type) {
  const p = S.players[id];
  const def = DROIDS[type];
  const m = S.machines.atelier;
  if (!def || !def.cost || !m || m.busy) return;
  if (boxDist(p, plotBox(PLOT_BY_ID.atelier)) > REACH + 0.5) return;
  const dr = followers(S, id).find((d) => d.type === 'ouvrier');
  if (!dr) return;
  if (!canPay(S, p, def.cost)) { toast(S, id, 'Pas assez de matériaux : ' + fmt(def.cost), 'warn'); sfx(S, id, 'err'); return; }
  pay(S, p, def.cost);
  m.busy = dr.id;
  dr.st = 'spec'; dr.spec = type; dr.t = T.spec; dr.who = id;
  const pl = PLOT_BY_ID.atelier;
  dr.x = pl.x; dr.z = pl.z + 0.2;
  sfx(S, 'all', 'clong');
  toast(S, 'all', `Formation : ${def.name.toLowerCase()} (${def.kit.toLowerCase()})…`, 'info');
}

// ---------- créatures ----------
function animals(S, dt) {
  const obs = obstacles(S);
  const P = [S.players.A, S.players.B];
  for (const a of S.animals) {
    const def = ANIMALS[a.sp];
    a.moving = false;
    if (a.st === 'installed') continue;
    if (a.st === 'caught') {
      const p = S.players[a.by];
      const tx = p.x - Math.sin(p.rot) * 1.4 + Math.cos(p.rot) * 0.6, tz = p.z - Math.cos(p.rot) * 1.4 - Math.sin(p.rot) * 0.6;
      if (Math.hypot(tx - a.x, tz - a.z) > 0.3) { steer(a, tx, tz, 5, dt, obs, 0.35); a.moving = true; }
      continue;
    }
    const near = P.map((p) => ({ p, d: dist(p, a) })).filter((x) => x.d < 6.5);
    let cornered = false;
    if (near.length === 2) {
      const [u, v] = near;
      const cos = ((u.p.x - a.x) * (v.p.x - a.x) + (u.p.z - a.z) * (v.p.z - a.z)) / (u.d * v.d || 1);
      cornered = cos < -0.34;
    }
    if (cornered) {
      a.st = 'corner';
      a.x += (Math.random() - 0.5) * 0.04; a.z += (Math.random() - 0.5) * 0.04;
      const p = near[0].d < near[1].d ? near[0].p : near[1].p;
      a.rot = Math.atan2(p.x - a.x, p.z - a.z);
    } else if (near.length) {
      a.st = 'flee';
      let fx = 0, fz = 0;
      for (const { p, d } of near) { fx += (a.x - p.x) / (d * d + 0.1); fz += (a.z - p.z) / (d * d + 0.1); }
      const l = Math.hypot(fx, fz) || 1;
      steer(a, a.x + (fx / l) * 3, a.z + (fz / l) * 3, def.flee, dt, obs, 0.4);
      a.moving = true;
    } else {
      a.st = 'wander';
      if (a.pause > 0) { a.pause -= dt; continue; }
      const r = Math.hypot(a.tx - a.x, a.tz - a.z);
      if (r < 0.4) {
        const ang = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 6;
        a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr;
        a.pause = 1 + Math.random() * 3;
      } else { steer(a, a.tx, a.tz, def.speed, dt, obs, 0.4); a.moving = true; }
    }
  }
  const wild = S.animals.filter((a) => a.st !== 'installed').length;
  if (wild < ANIMAL_COUNT) {
    S.animalT -= dt;
    if (S.animalT <= 0) {
      const h = ANIMAL_HOMES[Math.floor(Math.random() * ANIMAL_HOMES.length)];
      spawnAnimal(S, h, Object.keys(ANIMALS)[Math.floor(Math.random() * 3)]);
      S.animalT = T.bumpBack;
    }
  }
}

function nodes(S, dt) {
  for (let i = 0; i < S.nodes.length; i++) {
    if (S.nodes[i] > 0) continue;
    S.nodeT[i] -= dt;
    if (S.nodeT[i] <= 0) S.nodes[i] = NODE_TYPES[NODES[i].type].qty;
  }
}

// ---------- objectifs ----------
export function goalStatus(S, gid) {
  const M = S.machines;
  switch (gid) {
    case 'forge': case 'circuits': case 'assembleur': case 'atelier': case 'forge2': case 'circuits2': return !!M[gid];
    case 'core': return S.core.placed;
    case 'droid1': return S.made >= 1;
    case 'assign2': return S.droids.filter((d) => d.type === 'ouvrier' && d.job && d.job !== 'hq').length >= 2;
    case 'animal': return S.animals.some((a) => a.st === 'installed');
    case 'logistique': case 'maintenance': case 'ingenieur': return S.droids.some((d) => d.type === gid);
    case 'droids8': return S.droids.length >= 8;
  }
  return false;
}

function goals(S) {
  if (S.won) return;
  const L = LEVELS[S.level];
  for (const g of L.goals) {
    if (!S.goals[g.id] && goalStatus(S, g.id)) {
      S.goals[g.id] = true;
      toast(S, 'all', 'Objectif atteint : ' + g.text, 'good');
    }
  }
  if (L.goals.every((g) => S.goals[g.id])) {
    if (S.level < LEVELS.length - 1) {
      S.level += 1;
      sfx(S, 'all', 'won');
      fx(S, 'all', 'level', { n: S.level + 1, name: LEVELS[S.level].name });
    } else {
      S.won = true;
      S.wonAt = S.time;
      fx(S, 'all', 'won');
    }
  }
}

function waits(S) {
  for (const id of IDS) {
    const p = S.players[id], o = other(id);
    p.wait = null;
    if (!S.core.placed && S.core.hand[id] && !S.core.hand[o]) p.wait = 'Il faut être deux !';
    for (const [pid, st] of Object.entries(S.plots)) {
      if (st.holder === id && dist(S.players[o], postR(PLOT_BY_ID[pid])) > POST_R) {
        p.wait = 'Il faut être deux !';
        const pr = postR(PLOT_BY_ID[pid]);
        call(S, o, 'Ton partenaire tient la pièce : va visser de l’autre côté !', pr.x, pr.z);
      }
    }
    for (const a of S.animals) {
      if (a.st === 'flee' && dist(p, a) < 3 && dist(S.players[o], a) > 6.5) {
        p.wait = 'Prenez-le en tenaille !';
        call(S, o, 'Ton partenaire chasse une créature : prends-la à revers !', a.x, a.z);
      }
    }
  }
}
