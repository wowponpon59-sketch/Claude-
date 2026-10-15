// Simulation de référence (téléphone hôte, ou le seul téléphone en solo).
import {
  REACH, POST_R, SAC_MAX, CARRY_SPEED, OUT_MAX, T, SCREWS, ITEMS, NODE_TYPES, MACHINES, PLOTS, ENTREPOT,
  START, CORE, DROIDS, ANIMALS, ANIMAL_COUNT, LEVELS, RECIPES, QC_MAP, RAW, RAW_LEVEL, OUTFITS, CREDITS,
  SLAB, WORLD, isRaw, other,
} from './config.js';
import { NODES, ANIMAL_HOMES, PLOT_BY_ID, plotBox, genWorld, slabDist, GATES } from './world.js';
import { boxDist, obstacles, moveBox, steer } from './move.js';

const IDS = ['A', 'B'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const lc = (k) => ITEMS[k].name.toLowerCase();
export const fmt = (o) => Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${lc(k)}`).join(', ');

export function newState(mode = 'duo', seed = (Math.random() * 4294967296) >>> 0) {
  genWorld(seed);
  const S = {
    v: 3, seed, mode, time: 0, level: 0, goals: {}, won: false,
    players: { A: newPlayer(START.A), B: newPlayer(START.B) },
    nodes: NODES.map((n) => NODE_TYPES[n.type].qty),
    nodeT: NODES.map(() => 0),
    stock: {}, plots: {}, machines: {},
    core: { x: CORE.x, z: CORE.z, hand: { A: null, B: null }, placed: false, warn: 0 },
    droids: [], animals: [],
    work: { A: null, B: null },
    seq: 1, made: 0, animalT: 0,
    stats: { made: {}, controlled: 0, recycled: 0, orders: 0, heavyFixed: 0, burned: 0 },
    power: { battery: 0, energy: 0, out: false, warned: false },
    orders: [], orderT: 15,
    credits: 0, wardrobe: { owned: {}, wear: {} },
    request: null, forceHeavyAt: null, adjT: 0, chefT: 0,
    fx: [], cd: { A: 0, B: 0 },
  };
  for (const p of PLOTS) S.plots[p.id] = { del: {}, ready: false, prog: 0, holder: null, built: false };
  ANIMAL_HOMES.slice(0, ANIMAL_COUNT).forEach((h, i) => spawnAnimal(S, h, Object.keys(ANIMALS)[i % 3]));
  return S;
}

function newPlayer(p) { return { x: p.x, z: p.z, rot: Math.PI, sac: {}, locked: false, hint: null, wait: null }; }

function spawnAnimal(S, home, sp) {
  S.animals.push({ id: S.seq++, sp, x: home.x, z: home.z, rot: 0, st: 'wander', home: { ...home }, tx: home.x, tz: home.z, pause: 0, by: null, mach: null });
}

// Remet en ordre un état chargé depuis une sauvegarde
export function restoreState(S) {
  genWorld(S.seed);
  S.fx = []; S.cd = { A: 0, B: 0 }; S.work = { A: null, B: null };
  for (const id of IDS) Object.assign(S.players[id], { x: START[id].x, z: START[id].z, locked: false, hint: null, wait: null });
  S.core.hand = { A: null, B: null };
  for (const st of Object.values(S.plots)) st.holder = null;
  for (const m of Object.values(S.machines)) { m.manual = null; m.cut = null; m.run = false; }
  for (const d of S.droids) {
    if (d.task && d.task.load) addStock(S, d.task.item, d.task.load);
    if (d.st === 'follow') { d.st = 'idle'; d.who = null; }
    d.task = null; d.carry = null; d.repairing = false;
  }
  for (const a of S.animals) if (a.st === 'caught') { a.st = 'wander'; a.by = null; }
  return S;
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
export function front(p) { const m = MACHINES[p.type]; return { x: p.x, z: p.z + m.d / 2 + 0.9 }; }
export function postL(p) { const m = MACHINES[p.type]; return { x: p.x - m.w / 2 - 0.9, z: p.z }; }
export function postR(p) { const m = MACHINES[p.type]; return { x: p.x + m.w / 2 + 0.9, z: p.z }; }
const HQ = { x: ENTREPOT.x, z: ENTREPOT.z - ENTREPOT.d / 2 - 1.0 };
export function hqSpot(i) { return { x: ENTREPOT.x - 1.65 + (i % 4) * 1.1, z: ENTREPOT.z + ENTREPOT.d / 2 + 1.0 + Math.floor(i / 4) * 1.0 }; }
const sacCount = (p) => sum(p.sac);
function addSac(p, item, n) { p.sac[item] = (p.sac[item] || 0) + n; if (p.sac[item] <= 0) delete p.sac[item]; }
function addStock(S, item, n) { S.stock[item] = (S.stock[item] || 0) + n; if (S.stock[item] <= 0) delete S.stock[item]; }
function have(S, p, item) { return (p ? p.sac[item] || 0 : 0) + (S.stock[item] || 0); }
function pay(S, p, cost) {
  for (const [k, n] of Object.entries(cost)) {
    let left = n;
    if (p) { const t = Math.min(left, p.sac[k] || 0); addSac(p, k, -t); left -= t; }
    addStock(S, k, -left);
  }
}
export const hasType = (S, type) => Object.values(S.machines).some((m) => m.type === type);
export const qcOn = (S) => hasType(S, 'qualite');
export const needPower = (S) => S.level >= 3;
export function powerIssue(S) {
  if (!needPower(S)) return null;
  const gen = Object.values(S.machines).find((m) => m.type === 'generateur');
  if (gen) {
    if (gen.broken) return 'générateur en panne';
    return S.power.energy > 0.05 || (gen.inp.charbon || 0) + (gen.inp.bois || 0) > 0 ? null : 'générateur vide (charbon ou bois)';
  }
  return S.power.battery > 0 ? null : 'construisez le générateur';
}
export function recipeAvail(S, rid) {
  const r = RECIPES[rid];
  if (!r || r.lvl > S.level) return false;
  if (r.need && !hasType(S, r.need)) return false;
  if (r.until && hasType(S, r.until)) return false;
  return true;
}
export function machineRecipes(S, m) { return MACHINES[m.type].recipes.filter((rid) => recipeAvail(S, rid)); }
export const isProd = (m) => MACHINES[m.type].recipes.length > 0;
function outName(S, rid, item) { return !RECIPES[rid].qc && QC_MAP[item] && qcOn(S) ? QC_MAP[item] : item; }

export function needOf(S, m) {
  const out = {};
  if (MACHINES[m.type].fuel) {
    out.charbon = Math.max(0, 6 - (m.inp.charbon || 0));
    out.bois = Math.max(0, 4 - (m.inp.bois || 0));
    return out;
  }
  const target = {};
  for (const rid of m.sel) for (const [k, n] of Object.entries(RECIPES[rid].in)) target[k] = (target[k] || 0) + n * 2;
  for (const [k, n] of Object.entries(target)) out[k] = Math.max(0, n - (m.inp[k] || 0));
  return out;
}
function canMake(S, m, rid) {
  const r = RECIPES[rid];
  if (!Object.entries(r.in).every(([k, n]) => (m.inp[k] || 0) >= n)) return false;
  for (const k of Object.keys(r.out)) if (k !== 'droide' && (m.out[outName(S, rid, k)] || 0) >= OUT_MAX) return false;
  return true;
}
function pickRecipe(S, m) {
  if (!m.sel.length) return null;
  if (!m.sel.includes(m.cur)) { m.cur = m.sel[0]; m.done = 0; m.t = 0; }
  if (canMake(S, m, m.cur)) return m.cur;
  const i0 = m.sel.indexOf(m.cur);
  for (let k = 1; k < m.sel.length; k++) {
    const rid = m.sel[(i0 + k) % m.sel.length];
    if (canMake(S, m, rid)) { m.cur = rid; m.done = 0; m.t = 0; return rid; }
  }
  return null;
}
export function missingIn(S, m) {
  const rid = m.sel.includes(m.cur) ? m.cur : m.sel[0];
  if (!rid) return {};
  const out = {};
  for (const [k, n] of Object.entries(RECIPES[rid].in)) out[k] = Math.max(0, n - (m.inp[k] || 0));
  return out;
}
export function cadence(m, S) {
  let b = 1 + T.animalBoost * m.animals.length;
  if (S) {
    const proc = S.droids.filter((d) => d.type === 'process' && d.st === 'work').length;
    const chef = S.droids.some((d) => d.type === 'chef' && d.st === 'work');
    b *= 1 + 0.15 * Math.min(2, proc) + (chef ? 0.25 : 0);
  }
  return b;
}
function missingFor(S, plotId) {
  const st = S.plots[plotId], cost = MACHINES[PLOT_BY_ID[plotId].type].cost, miss = {};
  for (const [k, n] of Object.entries(cost)) miss[k] = Math.max(0, n - (st.del[k] || 0));
  return miss;
}
function followers(S, id) { return S.droids.filter((d) => d.st === 'follow' && d.who === id); }
function operatorOf(S, m) { return S.droids.find((d) => d.st === 'work' && (d.job === m.id || d.job2 === m.id)); }
function returnInputs(S, m) {
  const keep = {};
  for (const rid of m.sel) for (const k of Object.keys(RECIPES[rid].in)) keep[k] = true;
  const back = {};
  for (const [k, n] of Object.entries(m.inp)) if (!keep[k] && n > 0) { back[k] = n; addStock(S, k, n); delete m.inp[k]; }
  return back;
}
export function activeOrders(S) { return S.orders.filter((o) => o.left > 0); }

// ---------- ce que le joueur peut faire là où il est ----------
export function targets(S, id) {
  const p = S.players[id];
  const out = [];
  const add = (key, d, o) => out.push({ key, d, kind: 'solo', ...o });
  const full = sacCount(p) >= SAC_MAX;

  if (!S.core.placed && S.core.hand[id]) return [{ key: 'core' + S.core.hand[id], d: 0, kind: 'duo', act: 'ungrab', label: 'Lâcher la caisse' }];
  const fol = followers(S, id);
  const folHQ = fol.find((d) => DROIDS[d.type].work === 'hq');
  const myAnimal = S.animals.find((a) => a.st === 'caught' && a.by === id);

  NODES.forEach((n, i) => {
    const d = Math.max(0, dist(p, n) - NODE_TYPES[n.type].r);
    if (d > REACH) return;
    const key = 'node' + i;
    if (S.nodes[i] <= 0) add(key, d, { off: true, label: `Vide : repousse dans ${Math.ceil(S.nodeT[i])} s` });
    else if (full) add(key, d, { off: true, label: 'Sac plein : va à l’entrepôt' });
    else add(key, d, { act: 'dig', node: i, label: `Fouiller : ${NODE_TYPES[n.type].name.toLowerCase()}` });
  });

  {
    const d = boxDist(p, ENTREPOT);
    if (d <= REACH) {
      if (folHQ) add('entrepot', d, { act: 'assignHQ', label: `Mettre au travail : ${DROIDS[folHQ.type].name.toLowerCase()}` });
      else if (sacCount(p) > 0) add('entrepot', d, { act: 'deposit', label: `Tout déposer (${sacCount(p)})` });
      else add('entrepot', d, { act: 'menu', menu: 'entrepot', label: 'Ouvrir l’entrepôt' });
    }
  }

  for (const pl of PLOTS) {
    const st = S.plots[pl.id];
    const d = boxDist(p, plotBox(pl));
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
    const m = S.machines[pl.id];
    const def = MACHINES[m.type];
    if (m.broken === 'heavy') {
      const dl = dist(p, postL(pl)), dr = dist(p, postR(pl));
      if (dl <= POST_R) add(pl.id + 'L', dl, { kind: 'duo', act: 'cut', mach: pl.id, label: m.cut === id ? 'Courant coupé (garde appuyé)' : 'Couper le courant (garder)' });
      if (dr <= POST_R) add(pl.id + 'R', dr, { kind: 'duo', act: 'fixheavy', mach: pl.id, label: 'Réparer (garder appuyé)' });
      if (near && dl > POST_R && dr > POST_R) add(pl.id, d + 0.3, { off: true, kind: 'duo', label: 'Panne lourde : couper à gauche, réparer à droite' });
      continue;
    }
    if (!near) continue;
    if (m.broken) { add(pl.id, d, { act: 'repair', label: 'Réparer la panne (garder appuyé)' }); continue; }
    if (myAnimal && isProd(m) && m.animals.length < T.animalMax) { add(pl.id, d, { act: 'install', label: `Installer ${ANIMALS[myAnimal.sp].name} (+25 %)` }); continue; }
    if (m.type === 'atelier') {
      const ouv = fol.find((x) => x.type === 'ouvrier');
      if (ouv && !m.busy) add(pl.id, d, { act: 'menu', menu: 'spec', label: 'Spécialiser le droïde' });
      else if (m.busy) add(pl.id, d, { off: true, label: 'Formation en cours…' });
      else add(pl.id, d, { off: true, label: 'Amène un droïde standard' });
      continue;
    }
    if (m.type === 'quai') {
      const act = activeOrders(S);
      if ((p.sac.colis || 0) > 0 && act.length) add(pl.id, d, { act: 'ship', label: `Livrer ${Math.min(p.sac.colis, sum(Object.fromEntries(act.map((o) => [o.id, o.left]))))} colis` });
      else if (act.length) add(pl.id, d, { off: true, label: `Commandes : ${act.map((o) => o.left).join(' + ')} colis à livrer` });
      else add(pl.id, d, { off: true, label: 'Pas de commande pour l’instant' });
      continue;
    }
    if (def.fuel) {
      const need = needOf(S, m);
      if (['charbon', 'bois'].some((k) => need[k] > 0 && (p.sac[k] || 0) > 0)) add(pl.id, d, { act: 'load', label: 'Remplir le générateur' });
      else add(pl.id, d, { off: true, label: `Générateur : ${m.inp.charbon || 0} charbon, ${m.inp.bois || 0} bois` });
      continue;
    }
    if (S.work[id] && S.work[id].kind === 'operate' && S.work[id].key === pl.id) {
      const rr = pickRecipe(S, m);
      const pw = powerIssue(S);
      add(pl.id, d, { act: 'operate', label: pw ? 'Pas de courant : ' + pw : rr ? `En marche : ${RECIPES[rr].name.toLowerCase()}` : sum(missingIn(S, m)) ? 'En pause : il manque ' + fmt(missingIn(S, m)) : 'En pause : sortie pleine' });
      continue;
    }
    const worker = fol.find((x) => DROIDS[x.type].work === 'machine' && (!DROIDS[x.type].only || DROIDS[x.type].only === m.type));
    if (worker && !m.operator) { add(pl.id, d, { act: 'assign', label: `Affecter : ${DROIDS[worker.type].name.toLowerCase()}` }); continue; }
    if (sum(m.out) > 0 && !full) { add(pl.id, d, { act: 'collect', label: 'Récupérer : ' + fmt(m.out) }); continue; }
    const need = needOf(S, m);
    if (Object.entries(need).some(([k, n]) => n > 0 && (p.sac[k] || 0) > 0)) { add(pl.id, d, { act: 'load', label: 'Charger la machine' }); continue; }
    if (!m.sel.length) { add(pl.id, d, { off: true, label: 'Choisis une recette (bouton Recettes)' }); continue; }
    const rid = pickRecipe(S, m);
    if (m.operator) add(pl.id, d, { off: true, label: rid ? 'Le droïde fait tourner la machine' : 'En attente : ' + fmt(missingIn(S, m)) });
    else if (!rid) add(pl.id, d, { off: true, label: sum(missingIn(S, m)) ? 'Il manque : ' + fmt(missingIn(S, m)) : 'Sortie pleine : récupère la production' });
    else if (powerIssue(S)) add(pl.id, d, { off: true, label: 'Pas de courant : ' + powerIssue(S) });
    else add(pl.id, d, { act: 'operate', label: `Actionner : ${RECIPES[rid].name.toLowerCase()}` });
  }

  for (const dr of S.droids) {
    const d = dist(p, dr);
    if (d > 1.5) continue;
    if (dr.st === 'idle') add('droid' + dr.id, d - 0.2, { act: 'take', droid: dr.id, label: `Emmener : ${DROIDS[dr.type].name.toLowerCase()}` });
    else if ((dr.st === 'work' || dr.st === 'go') && fol.length === 0) add('droid' + dr.id, d + 1.0, { act: 'reprendre', droid: dr.id, label: 'Reprendre ce droïde' });
  }

  if (!S.core.placed) {
    const c = S.core;
    for (const side of ['L', 'R']) {
      const d = dist(p, { x: c.x + (side === 'L' ? -1 : 1) * CORE.handle, z: c.z });
      if (d > POST_R || c.hand[other(id)] === side) continue;
      add('core' + side, d, { kind: 'duo', act: 'grab', side, label: 'Saisir la poignée' });
    }
  }

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
    case 'cut': S.work[id] = { kind: 'cut', key: t.key, mach: t.mach }; S.machines[t.mach].cut = id; sfx(S, id, 'clong');
      if (!(S.work[o] && S.work[o].kind === 'fixheavy')) call(S, o, 'Ton partenaire a coupé le courant : va réparer de l’autre côté !', postR(PLOT_BY_ID[t.mach]).x, postR(PLOT_BY_ID[t.mach]).z);
      break;
    case 'fixheavy': S.work[id] = { kind: 'fixheavy', key: t.key, mach: t.mach }; break;
    case 'menu': fx(S, id, 'menu', { menu: t.menu }); break;
    case 'deposit': {
      const n = sacCount(p);
      for (const [k, v] of Object.entries(p.sac)) if (v > 0) addStock(S, k, v);
      p.sac = {};
      sfx(S, id, 'drop');
      toast(S, id, `${n} déposé${n > 1 ? 's' : ''} à l’entrepôt`, 'good');
      break;
    }
    case 'deliver': {
      const st = S.plots[t.plot];
      for (const [k, n] of Object.entries(missingFor(S, t.plot))) {
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
        const pt = postL(PLOT_BY_ID[t.plot]);
        call(S, o, 'Ton partenaire visse : va tenir la pièce de l’autre côté !', pt.x, pt.z);
      }
      break;
    }
    case 'collect': {
      const m = S.machines[t.key];
      for (const [k, n] of Object.entries(m.out)) {
        const q = Math.min(n, SAC_MAX - sacCount(p));
        if (q <= 0) break;
        m.out[k] -= q; if (!m.out[k]) delete m.out[k];
        addSac(p, k, q);
      }
      sfx(S, id, 'pick');
      break;
    }
    case 'load': {
      const m = S.machines[t.key];
      for (const [k, n] of Object.entries(needOf(S, m))) {
        const q = Math.min(n, p.sac[k] || 0);
        if (q > 0) { addSac(p, k, -q); m.inp[k] = (m.inp[k] || 0) + q; }
      }
      sfx(S, id, 'drop');
      break;
    }
    case 'assign': {
      const m = S.machines[t.key];
      const dr = followers(S, id).find((x) => DROIDS[x.type].work === 'machine' && (!DROIDS[x.type].only || DROIDS[x.type].only === m.type));
      assignDroid(S, dr, m);
      sfx(S, id, 'ok');
      break;
    }
    case 'assignHQ': {
      const dr = followers(S, id).find((d) => DROIDS[d.type].work === 'hq');
      dr.st = 'work'; dr.job = 'hq'; dr.who = null; dr.task = null;
      sfx(S, id, 'ok');
      toast(S, 'all', `${DROIDS[dr.type].name} au travail !`, 'good');
      break;
    }
    case 'install': {
      const m = S.machines[t.key];
      const a = S.animals.find((x) => x.st === 'caught' && x.by === id);
      a.st = 'installed'; a.mach = t.key; a.slot = m.animals.length; a.by = null;
      m.animals.push(a.sp);
      sfx(S, 'all', 'ok');
      toast(S, 'all', `${ANIMALS[a.sp].name} installé : cadence ${Math.round(cadence(m, S) * 100)} %`, 'good');
      S.animalT = T.bumpBack;
      break;
    }
    case 'ship': shipColis(S, p, null); break;
    case 'take': { const dr = S.droids.find((d) => d.id === t.droid); dr.st = 'follow'; dr.who = id; sfx(S, id, 'pick'); break; }
    case 'reprendre': { const dr = S.droids.find((d) => d.id === t.droid); releaseDroid(S, dr); dr.st = 'follow'; dr.who = id; sfx(S, id, 'pick'); break; }
    case 'leave': for (const d of followers(S, id)) { d.st = 'idle'; d.who = null; } break;
    case 'grab': {
      const c = S.core;
      c.hand[id] = t.side; p.locked = true;
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

function assignDroid(S, dr, m) {
  dr.st = 'go'; dr.job = m.id; dr.job2 = null; dr.who = null;
  m.operator = dr.id;
  let msg = `${DROIDS[dr.type].name} affecté : ${MACHINES[m.type].name.toLowerCase()}`;
  if (dr.type === 'production') {
    const pm = PLOT_BY_ID[m.id];
    const m2 = Object.values(S.machines).filter((x) => x !== m && isProd(x) && !x.operator)
      .sort((a, b) => dist(PLOT_BY_ID[a.id], pm) - dist(PLOT_BY_ID[b.id], pm))[0];
    if (m2) { m2.operator = dr.id; dr.job2 = m2.id; msg += ` et ${MACHINES[m2.type].name.toLowerCase()}`; }
  }
  toast(S, 'all', msg, 'good');
}

function shipColis(S, p, d) {
  let n = p ? p.sac.colis || 0 : d.task.load;
  let shipped = 0;
  for (const o of activeOrders(S)) {
    const q = Math.min(n, o.left);
    o.left -= q; n -= q; shipped += q;
    if (o.left === 0) {
      S.credits += o.reward; S.stats.orders += 1;
      sfx(S, 'all', 'won');
      toast(S, 'all', `Commande livrée : +${o.reward} crédits`, 'good');
    }
    if (n <= 0) break;
  }
  if (p) addSac(p, 'colis', -shipped);
  else d.task.load -= shipped;
  S.orders = S.orders.filter((o) => o.left > 0);
  if (shipped && p) toast(S, 'all', `${shipped} colis livré${shipped > 1 ? 's' : ''}`, 'good');
}

function release(S, id) {
  for (const st of Object.values(S.plots)) if (st.holder === id) st.holder = null;
  for (const m of Object.values(S.machines)) if (m.cut === id) m.cut = null;
  S.work[id] = null;
}

function releaseDroid(S, dr) {
  for (const j of [dr.job, dr.job2]) if (j && S.machines[j] && S.machines[j].operator === dr.id) S.machines[j].operator = null;
  if (dr.task && dr.task.load && dr.task.item) addStock(S, dr.task.item, dr.task.load);
  dr.job = null; dr.job2 = null; dr.task = null; dr.carry = null; dr.repairing = false;
}

function checkReady(S, plotId) {
  const st = S.plots[plotId], pl = PLOT_BY_ID[plotId];
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
  const m = { id: plotId, type: pl.type, inp: {}, out: {}, sel: [], cur: null, done: 0, t: 0, operator: null, broken: null, fixT: 0, cut: null, wear: wearTime(), animals: [], busy: null, run: false };
  S.machines[plotId] = m;
  const first = machineRecipes(S, m)[0];
  if (first) m.sel = [first];
  sfx(S, 'all', 'won');
  toast(S, 'all', `${MACHINES[pl.type].name} construite !`, 'good');
  if (pl.type === 'qualite') toast(S, 'all', 'Norme qualité : carcasses et circuits sortent désormais « à contrôler ».', 'warn');
  if (pl.type === 'laminoir') toast(S, 'all', 'Nouvelle méthode : les carcasses se font maintenant avec des tôles.', 'info');
  if (pl.type === 'quai') S.orderT = 10;
}
export function forceBuild(S, plotId) { const st = S.plots[plotId]; st.del = { ...MACHINES[PLOT_BY_ID[plotId].type].cost }; st.ready = true; build(S, plotId); }
function wearTime() { return T.wear[0] + Math.random() * (T.wear[1] - T.wear[0]); }

// ---------- commandes des menus ----------
function command(S, id, e) {
  const p = S.players[id];
  const nearHQ = boxDist(p, ENTREPOT) <= REACH + 1.5;
  switch (e.c) {
    case 'spec': specialize(S, id, e.type); break;
    case 'take': {
      if (!nearHQ || !ITEMS[e.item]) return;
      const q = Math.max(0, Math.min(e.n | 0, S.stock[e.item] || 0, SAC_MAX - sacCount(p)));
      if (q) { addStock(S, e.item, -q); addSac(p, e.item, q); sfx(S, id, 'pick'); }
      break;
    }
    case 'put': {
      if (!nearHQ || !ITEMS[e.item]) return;
      const q = Math.max(0, Math.min(e.n | 0, p.sac[e.item] || 0));
      if (q) { addSac(p, e.item, -q); addStock(S, e.item, q); sfx(S, id, 'drop'); }
      break;
    }
    case 'putall': if (nearHQ) { for (const [k, v] of Object.entries(p.sac)) addStock(S, k, v); p.sac = {}; sfx(S, id, 'drop'); } break;
    case 'request':
      if (e.item === null) { S.request = null; toast(S, 'all', 'Agent de recherche : il choisit tout seul ce qui manque.', 'info'); }
      else if (RAW.includes(e.item)) { S.request = { item: e.item, left: 10 }; toast(S, 'all', `Agent de recherche : 10 ${lc(e.item)} demandés.`, 'info'); }
      break;
    case 'recipes': {
      const m = S.machines[e.mach];
      if (!m || !Array.isArray(e.sel)) return;
      const avail = machineRecipes(S, m);
      const prev = m.sel.join();
      m.sel = avail.filter((rid) => e.sel.includes(rid));
      if (m.sel.join() !== prev) m.done = 0;
      if (!m.sel.includes(m.cur)) { m.cur = m.sel[0] || null; m.t = 0; }
      const back = returnInputs(S, m);
      if (sum(back)) toast(S, id, 'Rangé à l’entrepôt : ' + fmt(back), 'info');
      break;
    }
    case 'buy': {
      const o = OUTFITS[e.outfit], key = e.type + ':' + e.outfit;
      if (!o || !DROIDS[e.type] || e.type === 'ouvrier' || S.wardrobe.owned[key]) return;
      if (S.credits < o.price) { toast(S, id, 'Pas assez de crédits', 'warn'); return; }
      S.credits -= o.price; S.wardrobe.owned[key] = true; S.wardrobe.wear[e.type] = e.outfit;
      sfx(S, 'all', 'ok');
      toast(S, 'all', `${o.name} pour les ${DROIDS[e.type].name.toLowerCase()}s !`, 'good');
      break;
    }
    case 'wear':
      if (!DROIDS[e.type]) return;
      if (e.outfit === null) delete S.wardrobe.wear[e.type];
      else if (S.wardrobe.owned[e.type + ':' + e.outfit]) S.wardrobe.wear[e.type] = e.outfit;
      break;
  }
}

function specialize(S, id, type) {
  const p = S.players[id];
  const def = DROIDS[type];
  const m = S.machines.atelier;
  if (!def || !def.kit || !m || m.busy || def.lvl > S.level) return;
  if (boxDist(p, plotBox(PLOT_BY_ID.atelier)) > REACH + 1.5) return;
  const dr = followers(S, id).find((d) => d.type === 'ouvrier');
  if (!dr) return;
  if (have(S, p, def.kit) < 1) { toast(S, id, `Il faut un kit : ${lc(def.kit)}`, 'warn'); sfx(S, id, 'err'); return; }
  pay(S, p, { [def.kit]: 1 });
  m.busy = dr.id;
  dr.st = 'spec'; dr.spec = type; dr.t = T.spec; dr.who = id;
  const pl = PLOT_BY_ID.atelier;
  dr.x = pl.x; dr.z = pl.z + 0.2;
  sfx(S, 'all', 'clong');
  toast(S, 'all', `Formation : ${def.name.toLowerCase()}…`, 'info');
}

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
      else if (e && typeof e === 'object' && e.c) command(S, id, e);
    }
  }
  for (const m of Object.values(S.machines)) m.manual = null;
  for (const id of IDS) holdWork(S, id, inputs[id] || {}, dt);
  carry(S, inputs, dt);
  recipesCheck(S);
  machines(S, dt);
  pannes(S);
  droids(S, dt);
  animals(S, dt);
  nodes(S, dt);
  orders(S, dt);
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
  for (const m of Object.values(S.machines)) {
    if (m.cut === id && (!inp.held || dist(p, postL(PLOT_BY_ID[m.id])) > POST_R || m.broken !== 'heavy')) m.cut = null;
  }
  if (!w) return;
  if (w.kind === 'operate') {
    const m = S.machines[w.key];
    // Tant qu'on garde appuyé près de la machine, elle reste en marche (en pause si sortie pleine ou matière manquante)
    if (!inp.held || !m || m.broken || m.operator || boxDist(p, plotBox(PLOT_BY_ID[w.key])) > REACH + 0.3) { S.work[id] = null; return; }
    m.manual = id;
    return;
  }
  const t = targets(S, id)[0];
  if (!inp.held || !t || t.key !== w.key) { S.work[id] = null; return; }
  if (w.kind === 'dig') {
    if (t.act !== 'dig') { S.work[id] = null; return; }
    w.t += dt;
    if (w.t >= T.dig) {
      w.t = 0;
      S.nodes[w.node] -= 1;
      addSac(p, NODE_TYPES[NODES[w.node].type].item, 1);
      sfx(S, id, 'pick');
      if (S.nodes[w.node] <= 0) { S.nodeT[w.node] = T.respawn; S.work[id] = null; }
      else if (sacCount(p) >= SAC_MAX) { S.work[id] = null; toast(S, id, 'Sac plein : va vider ton sac à l’entrepôt.', 'warn'); }
    }
  } else if (w.kind === 'repair') {
    w.t += dt;
    if (w.t >= T.repair) { S.work[id] = null; fixMachine(S, S.machines[w.key], 'Réparée'); }
  } else if (w.kind === 'fixheavy') {
    const m = S.machines[w.mach];
    if (m.broken !== 'heavy') { S.work[id] = null; return; }
    if (m.cut && m.cut !== id) {
      m.fixT += dt;
      if (m.fixT >= T.heavyRepair) { S.work[id] = null; S.stats.heavyFixed += 1; fixMachine(S, m, 'Panne lourde réparée à deux'); }
    } else {
      const pl = postL(PLOT_BY_ID[m.id]);
      call(S, other(id), 'Ton partenaire répare : va couper le courant de l’autre côté !', pl.x, pl.z);
    }
  }
}

function fixMachine(S, m, msg) {
  m.broken = null; m.fixT = 0; m.cut = null; m.wear = wearTime();
  sfx(S, 'all', 'ok');
  toast(S, 'all', `${msg} : ${MACHINES[m.type].name.toLowerCase()}.`, 'good');
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
    if (Math.hypot(c.x - target.x, c.z - target.z) < 2.4) {
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

// Recettes devenues indisponibles (nouvelle méthode) ou machines sans recette choisie
function recipesCheck(S) {
  for (const m of Object.values(S.machines)) {
    if (!isProd(m)) continue;
    const avail = machineRecipes(S, m);
    const sel = [];
    let changed = false;
    for (const rid of m.sel) {
      if (avail.includes(rid)) sel.push(rid);
      else { changed = true; const r = RECIPES[rid].repl; if (r && avail.includes(r) && !sel.includes(r)) sel.push(r); }
    }
    if (changed) { m.sel = sel; if (!sel.includes(m.cur)) { m.cur = sel[0] || null; m.done = 0; m.t = 0; } returnInputs(S, m); }
  }
}

function machines(S, dt) {
  const want = [];
  for (const m of Object.values(S.machines)) {
    m.run = false; m.nopower = false;
    if (!isProd(m) || m.broken) continue;
    const op = operatorOf(S, m);
    if (!(op || m.manual)) continue;
    const rid = pickRecipe(S, m);
    if (!rid) continue;
    want.push([m, rid]);
  }
  const gen = Object.values(S.machines).find((x) => x.type === 'generateur');
  if (gen) gen.run = false;
  let powered = true;
  if (needPower(S) && want.length) {
    const rate = 0.3 + 0.1 * want.length;
    const P = S.power;
    if (gen) {
      if (gen.broken) powered = false;
      else {
        if (P.energy < rate * dt) {
          const f = (gen.inp.charbon || 0) > 0 ? 'charbon' : (gen.inp.bois || 0) > 0 ? 'bois' : null;
          if (f) { gen.inp[f] -= 1; P.energy += T.fuel[f]; S.stats.burned += 1; }
        }
        if (P.energy >= rate * dt) {
          P.energy -= rate * dt; gen.run = true;
          if (S.time >= T.panneStart) gen.wear -= dt;
          if (gen.wear <= 0) breakdown(S, gen);
        } else powered = false;
      }
    } else if (P.battery > 0) P.battery = Math.max(0, P.battery - dt);
    else powered = false;
    if (!powered && !P.out) {
      P.out = true;
      sfx(S, 'all', 'err');
      toast(S, 'all', gen ? (gen.broken ? 'Générateur en panne : plus de courant !' : 'Générateur vide : ajoutez du charbon ou du bois !') : 'Batterie vide : construisez le générateur !', 'bad');
    }
    if (powered) P.out = false;
  }
  for (const [m, rid] of want) {
    if (!powered) { m.nopower = true; continue; }
    const r = RECIPES[rid];
    m.run = true;
    m.t += dt * cadence(m, S);
    if (S.time >= T.panneStart) {
      m.wear -= dt;
      if (m.wear <= 0) { breakdown(S, m); continue; }
    }
    if (m.t < r.time) continue;
    m.t = 0;
    for (const [k, n] of Object.entries(r.in)) { m.inp[k] -= n; if (!m.inp[k]) delete m.inp[k]; }
    for (const [k, n] of Object.entries(r.out)) {
      if (k === 'droide') { spawnDroid(S, m); continue; }
      let item = outName(S, rid, k);
      if (r.qc) {
        S.stats.controlled += n;
        const rate = S.droids.some((d) => d.type === 'qualite' && d.st === 'work' && d.job === m.id) ? T.defect / 2 : T.defect;
        if (Math.random() < rate) { item = 'rebut'; toast(S, 'all', 'Pièce défectueuse : un rebut à recycler.', 'warn'); }
      }
      if (rid === 'recyc') S.stats.recycled += 1;
      m.out[item] = (m.out[item] || 0) + n;
      S.stats.made[item] = (S.stats.made[item] || 0) + n;
    }
    sfx(S, 'all', 'ding');
    m.done = m.sel.length > 1 ? m.done + 1 : 0;
    if (m.sel.length > 1 && m.done >= 2) {
      m.cur = m.sel[(m.sel.indexOf(m.cur) + 1) % m.sel.length];
      m.done = 0;
    }
  }
}

function spawnDroid(S, m) {
  const pl = PLOT_BY_ID[m.id];
  const n = S.droids.filter((d) => d.st === 'idle').length;
  S.droids.push({ id: S.seq++, type: 'ouvrier', x: pl.x + MACHINES[m.type].w / 2 + 1.3, z: pl.z + 1.2 + (n % 3) * 0.9, rot: 0, st: 'idle', who: null, job: null, job2: null, task: null, carry: null });
  S.made += 1;
  sfx(S, 'all', 'won');
  toast(S, 'all', S.made === 1 ? 'Premier droïde produit ! Emmène-le sur une machine.' : 'Nouveau droïde produit.', 'good');
}

function breakdown(S, m, forceHeavy = false) {
  const heavy = forceHeavy || (S.level >= T.heavyFrom && Math.random() < (S.level >= 6 ? 0.45 : 0.35));
  m.broken = heavy ? 'heavy' : 'light';
  m.fixT = 0; m.cut = null; m.run = false;
  sfx(S, 'all', 'err');
  const name = MACHINES[m.type].name.toLowerCase();
  toast(S, 'all', heavy ? `Panne lourde : ${name} ! Il faut être deux (ou le chef de la maintenance).` : `Panne : ${name} !`, 'bad');
}

function pannes(S) {
  if (S.forceHeavyAt !== null && S.time >= S.forceHeavyAt) {
    const list = Object.values(S.machines).filter((m) => isProd(m) && !m.broken);
    const m = list.find((x) => x.run) || list[0];
    if (m) { breakdown(S, m, true); S.forceHeavyAt = null; } else S.forceHeavyAt = S.time + 10;
  }
}

// ---------- droïdes ----------
function droids(S, dt) {
  const obs = obstacles(S);
  const fcount = { A: 0, B: 0 };
  for (const d of S.droids) {
    d.moving = false; d.repairing = false;
    if (d.st === 'follow') {
      const p = S.players[d.who];
      const k = fcount[d.who]++;
      const back = 1.6 + k * 1.1;
      const tx = p.x - Math.sin(p.rot) * back, tz = p.z - Math.cos(p.rot) * back;
      if (Math.hypot(tx - d.x, tz - d.z) > 0.35) { steer(d, tx, tz, 4.8, dt, obs, 0.35); d.moving = true; }
    } else if (d.st === 'go' || (d.st === 'work' && DROIDS[d.type].work === 'machine')) {
      const m = S.machines[d.job];
      if (!m) { d.st = 'idle'; continue; }
      const f = front(PLOT_BY_ID[d.job]);
      if (Math.hypot(f.x - d.x, f.z - d.z) > 0.3) { steer(d, f.x, f.z, 3.4, dt, obs, 0.35); d.moving = true; d.st = 'go'; }
      else { d.st = 'work'; d.rot = Math.PI; }
    } else if (d.st === 'spec') {
      d.t -= dt;
      if (d.t <= 0) {
        d.type = d.spec; d.spec = null;
        d.st = 'follow';
        if (S.machines.atelier) S.machines.atelier.busy = null;
        sfx(S, 'all', 'won');
        const w = DROIDS[d.type].work === 'hq' ? 'Mets-le au travail à l’entrepôt.' : 'Affecte-le à une machine.';
        toast(S, 'all', `Nouveau : ${DROIDS[d.type].name.toLowerCase()} ! ${w}`, 'good');
      }
    } else if (d.st === 'work' && d.job === 'hq') {
      const fn = BRAINS[d.type];
      if (fn) fn(S, d, dt, obs);
      else goTo(d, hqSpot(hqIndex(S, d)), dt, obs);
    }
  }
}

const onSlab = (p) => slabDist(p.x, p.z) < 0.5;
// Segment qui coupe la dalle (élargie de e) ?
function segHitsSlab(p, q, e) {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dz = q.z - p.z;
  for (const [pp, dd, lo, hi] of [[p.x, dx, SLAB.x0 - e, SLAB.x1 + e], [p.z, dz, SLAB.z0 - e, SLAB.z1 + e]]) {
    if (Math.abs(dd) < 1e-9) { if (pp < lo || pp > hi) return false; continue; }
    let a = (lo - pp) / dd, b = (hi - pp) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}
// Dehors, pour aller d'un côté à l'autre de l'usine : on longe les ruines par les coins
function aroundSlab(d, pt) {
  const E = 0.8;
  if (!segHitsSlab(d, pt, E)) return null;
  const sd = slabDist(d.x, d.z);
  if (sd < 1.6) {
    const nx = Math.max(SLAB.x0, Math.min(SLAB.x1, d.x)), nz = Math.max(SLAB.z0, Math.min(SLAB.z1, d.z));
    const vx = d.x - nx, vz = d.z - nz, l = Math.hypot(vx, vz) || 1;
    return { x: nx + (vx / l) * 2.6, z: nz + (vz / l) * 2.6 };
  }
  const M = 3;
  const corners = [{ x: SLAB.x0 - M, z: SLAB.z0 - M }, { x: SLAB.x1 + M, z: SLAB.z0 - M }, { x: SLAB.x1 + M, z: SLAB.z1 + M }, { x: SLAB.x0 - M, z: SLAB.z1 + M }];
  let best = null, bd = 1e9;
  for (const c of corners) {
    const dc = Math.hypot(c.x - d.x, c.z - d.z);
    if (dc < 1 || segHitsSlab(d, c, E)) continue;
    const cost = dc + Math.hypot(pt.x - c.x, pt.z - c.z);
    if (cost < bd) { bd = cost; best = c; }
  }
  return best;
}
export function waypoint(d, pt) {
  const a = onSlab(d), b = onSlab(pt);
  if (!a && !b) return aroundSlab(d, pt);
  if (a === b) return null;
  let best = null, bd = 1e9;
  for (const g of GATES) {
    const c = a ? Math.hypot(d.x - g.in.x, d.z - g.in.z) + Math.hypot(g.out.x - pt.x, g.out.z - pt.z) : Math.hypot(d.x - g.out.x, d.z - g.out.z) + Math.hypot(g.in.x - pt.x, g.in.z - pt.z);
    if (c < bd) { bd = c; best = g; }
  }
  const first = a ? best.in : best.out, second = a ? best.out : best.in;
  // Déjà dans le passage : on le franchit ; sinon on va à son entrée
  const vx = second.x - first.x, vz = second.z - first.z, l2 = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(1, ((d.x - first.x) * vx + (d.z - first.z) * vz) / l2));
  const seg = Math.hypot(d.x - (first.x + vx * t), d.z - (first.z + vz * t));
  if (seg < 1.0) return second;
  return a ? first : aroundSlab(d, first) || first;
}
function goTo(d, pt, dt, obs, speed = 3.9) {
  const wp = waypoint(d, pt);
  if (wp) { steer(d, wp.x, wp.z, speed, dt, obs, 0.35); d.moving = true; return false; }
  const r = Math.hypot(pt.x - d.x, pt.z - d.z);
  if (r > 0.35) { steer(d, pt.x, pt.z, speed, dt, obs, 0.35); d.moving = true; return false; }
  return true;
}
function hqIndex(S, d) { return S.droids.filter((x) => x.job === 'hq').indexOf(d); }
const busySigs = (S, d) => new Set(S.droids.filter((x) => x !== d && x.task && x.task.sig).map((x) => x.task.sig));
const spotOf = (where) => (where === 'hq' ? HQ : where === 'quai' ? front(PLOT_BY_ID.quai) : front(PLOT_BY_ID[where]));

// Porte des objets d'un point à un autre (tâche { from, to, item, phase, load })
function haul(S, d, dt, obs, max) {
  const t = d.task;
  if (t.phase === 'pick') {
    if (!goTo(d, spotOf(t.from), dt, obs)) return;
    let q;
    if (t.from === 'hq') { q = Math.min(max, S.stock[t.item] || 0, t.want || max); if (q > 0) addStock(S, t.item, -q); }
    else { const m = S.machines[t.from]; q = Math.min(max, m.out[t.item] || 0, t.want || max); if (q > 0) { m.out[t.item] -= q; if (!m.out[t.item]) delete m.out[t.item]; } }
    if (!q) { d.task = null; return; }
    t.load = q; d.carry = t.item; t.phase = 'drop';
  } else {
    if (!goTo(d, spotOf(t.to), dt, obs)) return;
    if (t.to === 'hq') addStock(S, t.item, t.load);
    else if (t.to === 'quai') { shipColis(S, null, d); if (t.load > 0) addStock(S, t.item, t.load); }
    else {
      const m = S.machines[t.to];
      const q = m ? Math.min(needOf(S, m)[t.item] || 0, t.load) : 0;
      if (q) m.inp[t.item] = (m.inp[t.item] || 0) + q;
      if (t.load - q > 0) addStock(S, t.item, t.load - q);
    }
    t.load = 0; d.carry = null; d.task = null;
  }
}

const BRAINS = {
  // Matières premières : entrepôt → machines ; production → entrepôt. Jamais de pièce fabriquée vers une machine.
  logistique(S, d, dt, obs) {
    if (!d.task) {
      const busy = busySigs(S, d);
      const cands = [];
      for (const m of Object.values(S.machines)) {
        const miss = missingIn(S, m);
        for (const [k, n] of Object.entries(needOf(S, m))) {
          if (n <= 0 || !isRaw(k) || !(S.stock[k] > 0)) continue;
          const sig = 'raw>' + m.id + k;
          if (!busy.has(sig)) cands.push({ score: (miss[k] > 0 || MACHINES[m.type].fuel ? 3 : 2), task: { from: 'hq', to: m.id, item: k, want: n, sig } });
        }
        for (const [k, n] of Object.entries(m.out)) {
          if (n <= 0) continue;
          const sig = 'out>' + m.id + k;
          if (!busy.has(sig)) cands.push({ score: n >= OUT_MAX - 1 ? 2.5 : 1, task: { from: m.id, to: 'hq', item: k, sig } });
        }
      }
      cands.sort((a, b) => b.score - a.score);
      if (!cands.length) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
      d.task = { ...cands[0].task, phase: 'pick', load: 0 };
    }
    haul(S, d, dt, obs, 4);
  },
  // Pièces fabriquées : vers la machine qui en aura besoin le plus tôt, et colis vers le quai
  expert(S, d, dt, obs) {
    if (!d.task) {
      const busy = busySigs(S, d);
      const cands = [];
      for (const m of Object.values(S.machines)) {
        if (!m.sel.length) continue;
        const miss = missingIn(S, m);
        for (const [k, n] of Object.entries(needOf(S, m))) {
          if (n <= 0 || isRaw(k)) continue;
          const sig = 'part>' + m.id + k;
          if (busy.has(sig)) continue;
          const src = Object.values(S.machines).find((x) => x !== m && (x.out[k] || 0) > 0);
          const from = src ? src.id : (S.stock[k] || 0) > 0 ? 'hq' : null;
          if (!from) continue;
          const have = m.inp[k] || 0;
          cands.push({ score: (miss[k] > 0 ? 10 : 5) - have + (m.type === 'assembleur' ? 0.5 : 0), task: { from, to: m.id, item: k, want: n, sig } });
        }
      }
      const left = activeOrders(S).reduce((a, o) => a + o.left, 0);
      if (left > 0 && S.machines.quai && !busy.has('ship')) {
        const src = Object.values(S.machines).find((x) => (x.out.colis || 0) > 0);
        const from = src ? src.id : (S.stock.colis || 0) > 0 ? 'hq' : null;
        if (from) cands.push({ score: 12, task: { from, to: 'quai', item: 'colis', want: left, sig: 'ship' } });
      }
      cands.sort((a, b) => b.score - a.score);
      if (!cands.length) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
      d.task = { ...cands[0].task, phase: 'pick', load: 0 };
    }
    haul(S, d, dt, obs, 4);
  },
  maintenance(S, d, dt, obs) { repairBrain(S, d, dt, obs, false); },
  chefmaint(S, d, dt, obs) { repairBrain(S, d, dt, obs, true); },
  ingenieur(S, d, dt, obs) {
    if (!d.task) {
      const pl = PLOTS.find((p) => plotUnlocked(S, p) && !S.plots[p.id].built && !MACHINES[p.type].core &&
        !S.droids.some((x) => x !== d && x.task && x.task.plot === p.id) &&
        (S.plots[p.id].ready || Object.entries(missingFor(S, p.id)).some(([k, n]) => n > 0 && (S.stock[k] || 0) > 0)));
      if (!pl) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
      d.task = { plot: pl.id, t: 0, sig: 'build' + pl.id };
    }
    const pl = PLOT_BY_ID[d.task.plot], st = S.plots[pl.id];
    if (st.built) { d.task = null; return; }
    if (!goTo(d, postR(pl), dt, obs, 3.6)) return;
    if (!st.ready) {
      for (const [k, n] of Object.entries(missingFor(S, pl.id))) {
        const q = Math.min(n, S.stock[k] || 0);
        if (q > 0) { addStock(S, k, -q); st.del[k] = (st.del[k] || 0) + q; }
      }
      checkReady(S, pl.id);
      if (!st.ready) { d.task = null; return; }
    }
    d.task.t += dt; d.repairing = true;
    if (d.task.t >= 0.9) {
      d.task.t = 0;
      st.prog = Math.min(1, st.prog + 1 / (SCREWS * 1.5));
      if (st.prog >= 1) { build(S, pl.id); d.task = null; toast(S, 'all', 'L’ingénieur a monté une nouvelle machine.', 'good'); }
    }
  },
  // Fouille le terrain vague et ramène la matière qui manque le plus (ou celle demandée)
  recherche(S, d, dt, obs) {
    if (!d.task) {
      const item = researchTarget(S);
      const nodes = item ? NODES.map((n, i) => ({ n, i })).filter(({ n, i }) => NODE_TYPES[n.type].item === item && S.nodes[i] > 0) : [];
      if (!nodes.length) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
      nodes.sort((a, b) => dist(a.n, d) - dist(b.n, d));
      const { n, i } = nodes[0];
      const r = NODE_TYPES[n.type].r + 0.6, a = Math.atan2(d.x - n.x, d.z - n.z);
      d.task = { phase: 'go', node: i, item, load: 0, t: 0, spot: { x: n.x + Math.sin(a) * r, z: n.z + Math.cos(a) * r } };
    }
    const t = d.task;
    if (t.phase === 'go') {
      if (S.nodes[t.node] <= 0) { d.task = null; return; }
      if (goTo(d, t.spot, dt, obs, 4.2) || (d.stuckT = (dist(d, t.spot) < 1.4 ? (d.stuckT || 0) + dt : 0)) > 1) { t.phase = 'dig'; d.stuckT = 0; }
    } else if (t.phase === 'dig') {
      d.repairing = true;
      t.t += dt;
      if (t.t >= 0.8) {
        t.t = 0;
        if (S.nodes[t.node] > 0) {
          S.nodes[t.node] -= 1; t.load += 1;
          if (S.nodes[t.node] <= 0) S.nodeT[t.node] = T.respawn;
        }
        if (t.load >= 6 || S.nodes[t.node] <= 0) { t.phase = 'back'; d.carry = t.item; }
      }
    } else if (goTo(d, HQ, dt, obs, 4.2)) {
      addStock(S, t.item, t.load);
      if (S.request && S.request.item === t.item) { S.request.left -= t.load; if (S.request.left <= 0) { S.request = null; toast(S, 'all', 'Demande terminée : l’agent de recherche repasse en automatique.', 'info'); } }
      d.task = null; d.carry = null;
    }
  },
  achat(S, d, dt, obs) {
    const emb = S.machines.emballeuse;
    if (!d.task) {
      if (!emb || (emb.inp.carton || 0) >= 2 || !(S.stock.plastique > 0) || !emb.sel.includes('colis')) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
      addStock(S, 'plastique', -1);
      d.task = { phase: 'buy', sig: 'achat' };
    }
    if (d.task.phase === 'buy') {
      if (goTo(d, S.machines.quai ? front(PLOT_BY_ID.quai) : HQ, dt, obs)) { d.task.phase = 'drop'; d.carry = 'carton'; }
    } else if (goTo(d, front(PLOT_BY_ID.emballeuse), dt, obs)) {
      if (emb) emb.inp.carton = (emb.inp.carton || 0) + 3;
      d.task = null; d.carry = null;
    }
  },
  adjoint(S, d, dt, obs) {
    goTo(d, hqSpot(hqIndex(S, d)), dt, obs);
    S.adjT -= dt;
    if (S.adjT > 0) return;
    S.adjT = 3;
    const free = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle');
    const m = Object.values(S.machines).find((x) => isProd(x) && !x.operator && !x.broken && x.sel.length);
    if (free && m) { assignDroid(S, free, m); toast(S, 'all', 'L’adjoint de production a placé un ouvrier.', 'info'); }
  },
  chef(S, d, dt, obs) {
    goTo(d, hqSpot(hqIndex(S, d)), dt, obs);
    S.chefT -= dt;
    if (S.chefT > 0) return;
    S.chefT = 2;
    const asm = S.machines.assembleur;
    if (asm && activeOrders(S).length && recipeAvail(S, 'caisse') && !asm.sel.includes('caisse')) {
      asm.sel.push('caisse');
      toast(S, 'all', 'Chef de production : l’assembleur lance des droïdes à livrer.', 'info');
    }
  },
};

function repairBrain(S, d, dt, obs, chief) {
  if (!d.task) {
    const busy = busySigs(S, d);
    const list = Object.values(S.machines).filter((x) => x.broken && (chief || x.broken === 'light') && !busy.has('fix' + x.id));
    list.sort((a, b) => (b.broken === 'heavy') - (a.broken === 'heavy'));
    const m = list[0];
    if (!m) { goTo(d, hqSpot(hqIndex(S, d)), dt, obs); return; }
    d.task = { sig: 'fix' + m.id, mach: m.id, t: 0 };
  }
  const m = S.machines[d.task.mach];
  if (!m.broken) { d.task = null; return; }
  if (!goTo(d, front(PLOT_BY_ID[m.id]), dt, obs, 3.8)) return;
  d.task.t += dt; d.repairing = true;
  const need = m.broken === 'heavy' ? T.heavyRepair + 1 : T.repair;
  if (d.task.t >= need) {
    if (m.broken === 'heavy') S.stats.heavyFixed += 1;
    d.task = null;
    fixMachine(S, m, chief ? 'Le chef de la maintenance a réparé' : 'L’agent de maintenance a réparé');
  }
}

export function researchTarget(S) {
  if (S.request) return S.request.item;
  const known = RAW.filter((k) => RAW_LEVEL[k] <= S.level);
  const demand = {};
  for (const m of Object.values(S.machines)) for (const [k, n] of Object.entries(needOf(S, m))) if (isRaw(k)) demand[k] = (demand[k] || 0) + n;
  for (const p of PLOTS) {
    if (!plotUnlocked(S, p) || S.plots[p.id].built) continue;
    for (const [k, n] of Object.entries(missingFor(S, p.id))) if (isRaw(k)) demand[k] = (demand[k] || 0) + n;
  }
  let best = null, bestScore = -1e9;
  for (const k of known) {
    const score = (demand[k] || 0) - (S.stock[k] || 0) + (6 - Math.min(6, S.stock[k] || 0)) * 0.2;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
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
      // En tenaille, ou essoufflée et entourée de près par les deux joueurs
      cornered = cos < -0.34 || (a.tired > 4 && u.d < 3.2 && v.d < 3.2);
    }
    if (cornered) {
      a.st = 'corner';
      a.x += (Math.random() - 0.5) * 0.04; a.z += (Math.random() - 0.5) * 0.04;
      const p = near[0].d < near[1].d ? near[0].p : near[1].p;
      a.rot = Math.atan2(p.x - a.x, p.z - a.z);
    } else if (near.length) {
      a.st = 'flee';
      let fx2 = 0, fz2 = 0;
      for (const { p, d } of near) {
        // Joueur collé à la créature : elle continue tout droit au lieu de tourner en rond
        if (d < 0.6) { fx2 += Math.sin(a.rot) * 2; fz2 += Math.cos(a.rot) * 2; continue; }
        fx2 += (a.x - p.x) / (d * d + 0.1); fz2 += (a.z - p.z) / (d * d + 0.1);
      }
      const l = Math.hypot(fx2, fz2) || 1;
      let vx = fx2 / l, vz = fz2 / l;
      // Au bord du terrain, il longe la clôture au lieu de s'y coincer
      const lim = WORLD.half - 4;
      if ((a.x > lim && vx > 0) || (a.x < -lim && vx < 0)) vx = 0;
      if ((a.z > lim && vz > 0) || (a.z < -lim && vz < 0)) vz = 0;
      if (Math.hypot(vx, vz) < 0.3) {
        const r1 = { x: -fz2 / l, z: fx2 / l }, r2 = { x: fz2 / l, z: -fx2 / l };
        const c = (r) => -(r.x * a.x + r.z * a.z);
        ({ x: vx, z: vz } = c(r1) > c(r2) ? r1 : r2);
      }
      const vl = Math.hypot(vx, vz) || 1;
      // Il s'essouffle s'il fuit longtemps
      a.tired = (a.tired || 0) + dt;
      const sp = def.flee * (a.tired > 4 ? 0.72 : 1);
      steer(a, a.x + (vx / vl) * 3, a.z + (vz / vl) * 3, sp, dt, obs, 0.4);
      a.moving = true;
    } else {
      a.st = 'wander';
      a.tired = Math.max(0, (a.tired || 0) - dt * 0.5);
      if (a.pause > 0) { a.pause -= dt; continue; }
      if (Math.hypot(a.tx - a.x, a.tz - a.z) < 0.4) {
        const ang = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 6;
        a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr;
        a.pause = 1 + Math.random() * 3;
      } else { steer(a, a.tx, a.tz, def.speed, dt, obs, 0.4); a.moving = true; }
    }
  }
  if (S.animals.filter((a) => a.st !== 'installed').length < ANIMAL_COUNT) {
    S.animalT -= dt;
    if (S.animalT <= 0) {
      spawnAnimal(S, ANIMAL_HOMES[Math.floor(Math.random() * ANIMAL_HOMES.length)], Object.keys(ANIMALS)[Math.floor(Math.random() * 3)]);
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

// ---------- commandes clients ----------
function orders(S, dt) {
  if (!S.machines.quai) return;
  for (const o of S.orders) o.t -= dt;
  const lost = S.orders.filter((o) => o.t <= 0 && o.left > 0);
  if (lost.length) { S.orders = S.orders.filter((o) => o.t > 0); toast(S, 'all', 'Commande perdue : le client est parti.', 'bad'); sfx(S, 'all', 'err'); }
  S.orderT -= dt;
  if (S.orderT <= 0 && S.orders.length < 2) {
    const qty = S.level >= 9 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
    S.orders.push({ id: S.seq++, qty, left: qty, t: 300, life: 300, reward: 20 * qty + 20 });
    S.orderT = 75;
    sfx(S, 'all', 'order');
    toast(S, 'all', `Nouvelle commande : ${qty} droïde${qty > 1 ? 's' : ''} à livrer en colis.`, 'info');
  }
}

// ---------- objectifs ----------
export function goalStatus(S, gid) {
  const M = S.machines, st = S.stats, has = (t) => S.droids.some((d) => d.type === t);
  switch (gid) {
    case 'core': return S.core.placed;
    case 'droid1': return S.made >= 1;
    case 'assign2': return S.droids.filter((d) => d.type === 'ouvrier' && d.job && d.job !== 'hq').length >= 2;
    case 'animal': return S.animals.some((a) => a.st === 'installed');
    case 'fil4': return (st.made.fil || 0) >= 4;
    case 'fuel': return st.burned >= 1;
    case 'heavy': return st.heavyFixed >= 1;
    case 'droids6': return S.droids.length >= 6;
    case 'tole4': return (st.made.tole || 0) >= 4;
    case 'made10': return S.made >= 10;
    case 'ctrl6': return st.controlled >= 6;
    case 'recyc2': return st.recycled >= 2;
    case 'qualiteD': return has('qualite');
    case 'silicium2': return (st.made.silicium || 0) >= 2;
    case 'circuitA1': return (st.made.circuitA || 0) >= 1;
    case 'orders3': return st.orders >= 3;
    case 'droids15': return S.droids.length >= 15;
    case 'orders8': return st.orders >= 8;
  }
  if (PLOT_BY_ID[gid]) return !!M[gid];
  if (DROIDS[gid]) return has(gid);
  return false;
}

function goals(S) {
  if (S.won) return;
  const L = LEVELS[S.level];
  for (const g of L.goals) {
    if (!S.goals[g.id] && goalStatus(S, g.id)) {
      S.goals[g.id] = true;
      S.credits += CREDITS.goal;
      toast(S, 'all', `Objectif atteint : ${g.text} (+${CREDITS.goal} crédits)`, 'good');
    }
  }
  if (L.goals.every((g) => S.goals[g.id])) {
    S.credits += CREDITS.level;
    if (S.level < LEVELS.length - 1) {
      S.level += 1;
      sfx(S, 'all', 'won');
      fx(S, 'all', 'level', { n: S.level + 1, name: LEVELS[S.level].name });
      fx(S, 'all', 'save');
      if (S.level === 3) {
        S.power.battery = T.battery;
        S.forceHeavyAt = S.time + 45;
        toast(S, 'all', 'L’usine passe sur batterie de secours : construisez le générateur à temps !', 'warn');
      }
    } else {
      S.won = true; S.wonAt = S.time;
      fx(S, 'all', 'won'); fx(S, 'all', 'save');
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
    for (const m of Object.values(S.machines)) {
      if (m.cut === id && !(S.work[o] && S.work[o].kind === 'fixheavy' && S.work[o].mach === m.id)) p.wait = 'Il faut être deux !';
      const w = S.work[id];
      if (w && w.kind === 'fixheavy' && w.mach === m.id && m.cut !== o) p.wait = 'Il faut être deux !';
    }
    for (const a of S.animals) {
      if (a.st === 'flee' && dist(p, a) < 3 && dist(S.players[o], a) > 6.5) {
        p.wait = 'Prenez-le en tenaille !';
        call(S, o, 'Ton partenaire chasse une créature : prends-la à revers !', a.x, a.z);
      }
    }
  }
}
