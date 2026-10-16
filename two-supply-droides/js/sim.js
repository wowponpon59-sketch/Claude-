// Simulation de référence (téléphone hôte, ou le seul téléphone en solo).
import {
  REACH, POST_R, SAC_MAX, CARRY_SPEED, OUT_MAX, T, SCREWS, ITEMS, NODE_TYPES, MACHINES, PLOTS, ENTREPOT,
  START, CORE, DROIDS, ANIMALS, ANIMAL_COUNT, LEVELS, RECIPES, QC_BASES, RAW, RAW_LEVEL, OUTFITS, PACK, CREDITS,
  SLAB, WORLD, isRaw, isDecl, isRebut, other,
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
    v: 4, seed, mode, time: 0, level: 0, goals: {}, won: false,
    players: { A: newPlayer(START.A), B: newPlayer(START.B) },
    nodes: NODES.map((n) => NODE_TYPES[n.type].qty),
    nodeT: NODES.map(() => 0),
    stock: {}, plots: {}, machines: {},
    core: { x: CORE.x, z: CORE.z, hand: { A: null, B: null }, placed: false, warn: 0 },
    droids: [], animals: [],
    work: { A: null, B: null },
    seq: 1, made: 0, animalT: 0,
    stats: { made: {}, controlled: 0, recycled: 0, orders: 0, heavyFixed: 0, burned: 0, repairs: 0, earned: 0 },
    lv0: null,
    power: { battery: 0, energy: 0, out: false, warned: false },
    gen: { play: 0, lockUntil: 0 },
    qcRun: 0, clock: 0,
    orders: [], orderT: 15,
    credits: 0, wardrobe: { owned: {}, wear: {} },
    request: null, forceHeavyAt: null, adjT: 0, chefT: 0,
    fx: [], cd: { A: 0, B: 0 },
  };
  for (const p of PLOTS) S.plots[p.id] = { del: {}, ready: false, prog: 0, holder: null, built: false };
  S.lv0 = snapshot(S);
  ANIMAL_HOMES.slice(0, ANIMAL_COUNT).forEach((h, i) => spawnAnimal(S, h, Object.keys(ANIMALS)[i % 3]));
  return S;
}

// Compteurs au début du niveau : les objectifs de rodage comptent ce qui se passe pendant le niveau
function snapshot(S) {
  return { made: S.made, earned: S.stats.earned, repairs: S.stats.repairs, ctrl: S.stats.controlled, recyc: S.stats.recycled, orders: S.stats.orders, items: { ...S.stats.made } };
}
const nowMs = (S) => S.clock || Date.now();

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
  S.gen = S.gen || { play: 0, lockUntil: 0 };
  S.qcRun = S.qcRun || 0;
  if (!S.lv0) S.lv0 = snapshot(S);
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
// Le contrôle qualité démarre quand le poste et la zone des déclassés existent
export const qcActive = (S) => hasType(S, 'qualite') && hasType(S, 'zone');
export const needPower = (S) => S.level >= 4;
export const genUnits = (m) => (m.inp.charbon || 0) + (m.inp.bois || 0);
// Unités dans le générateur, en comptant celle qui brûle : 5 au maximum (1 heure)
export const genFill = (S, m) => genUnits(m) + (S.power.energy > 0 ? 1 : 0);
export function powerIssue(S) {
  if (!needPower(S)) return null;
  const gen = S.machines.generateur;
  if (gen) {
    if (S.gen.lockUntil > nowMs(S)) return 'générateur en surchauffe';
    if (gen.broken) return 'générateur en panne';
    return S.power.energy > 0.05 || genUnits(gen) > 0 ? null : 'générateur vide (charbon ou bois)';
  }
  return S.power.battery > 0 ? null : 'construisez le générateur';
}
export function recipeAvail(S, rid) {
  const r = RECIPES[rid];
  if (!r || r.lvl > S.level) return false;
  if (r.need && !r.need.every((t) => hasType(S, t))) return false;
  return true;
}
// Prix du pack « L'intégrale » pour un métier (les vêtements déjà achetés ne sont pas refacturés)
export function packPrice(S, type) {
  const miss = PACK.items.filter((o) => !S.wardrobe.owned[type + ':' + o]);
  if (!miss.length) return 0;
  const full = PACK.items.reduce((a, o) => a + OUTFITS[o].price, 0);
  const sub = miss.reduce((a, o) => a + OUTFITS[o].price, 0);
  return Math.round(PACK.price * sub / full);
}
export function machineRecipes(S, m) { return MACHINES[m.type].recipes.filter((rid) => recipeAvail(S, rid)); }
export const isProd = (m) => MACHINES[m.type].recipes.length > 0;
// Recette « n'importe quelle pièce » (contrôle, recyclage) : la première pièce de la bonne sorte présente
function anyItem(S, m, kind) {
  for (const [k, n] of Object.entries(m.inp)) {
    if (n <= 0 || ITEMS[k].kind !== kind) continue;
    const b = ITEMS[k].base;
    const outs = kind === 'decl' ? [b, b + '_r'] : Object.keys(QC_BASES[b].back);
    if (outs.every((o) => (m.out[o] || 0) < OUT_MAX)) return k;
  }
  return null;
}

export function needOf(S, m) {
  const out = {};
  if (MACHINES[m.type].fuel) {
    const free = Math.max(0, T.genCap - genFill(S, m));
    out.charbon = free; out.bois = free;
    return out;
  }
  if (MACHINES[m.type].store) return out;
  const target = {};
  for (const rid of m.sel) {
    const r = RECIPES[rid];
    if (r.any) { for (const k of Object.keys(ITEMS)) if (ITEMS[k].kind === r.any) target[k] = 4; continue; }
    for (const [k, n] of Object.entries(r.in)) target[k] = (target[k] || 0) + n * 2;
  }
  for (const [k, n] of Object.entries(target)) out[k] = Math.max(0, n - (m.inp[k] || 0));
  return out;
}
function canMake(S, m, rid) {
  const r = RECIPES[rid];
  if (r.any) return !!anyItem(S, m, r.any);
  if (!Object.entries(r.in).every(([k, n]) => (m.inp[k] || 0) >= n)) return false;
  for (const k of Object.keys(r.out)) if (k !== 'droide' && (m.out[k] || 0) >= OUT_MAX) return false;
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
  if (!rid || RECIPES[rid].any) return {};
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
  for (const rid of m.sel) {
    const r = RECIPES[rid];
    if (r.any) { for (const k of Object.keys(m.inp)) if (ITEMS[k].kind === r.any) keep[k] = true; }
    for (const k of Object.keys(r.in)) keep[k] = true;
  }
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
      const dep = depositable(p);
      if (folHQ) add('entrepot', d, { act: 'assignHQ', label: `Mettre au travail : ${DROIDS[folHQ.type].name.toLowerCase()}` });
      else if (dep > 0) add('entrepot', d, { act: 'deposit', label: `Tout déposer (${dep})` });
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
    if (def.store) {
      const nd = declCount(p);
      if (nd > 0) add(pl.id, d, { act: 'zoneput', label: `Déposer les déclassés (${nd})` });
      else add(pl.id, d, { act: 'menu', menu: 'zone', label: 'Ouvrir la zone des déclassés' });
      continue;
    }
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
      const free = T.genCap - genFill(S, m);
      if (free > 0 && ['charbon', 'bois'].some((k) => (p.sac[k] || 0) > 0)) add(pl.id, d, { act: 'load', label: `Charger le générateur (${genFill(S, m)}/${T.genCap})` });
      else add(pl.id, d, { off: true, label: `Générateur : ${genFill(S, m)}/${T.genCap} unités${free > 0 ? ' · apporte du charbon ou du bois' : ''}` });
      continue;
    }
    if (S.work[id] && S.work[id].kind === 'operate' && S.work[id].key === pl.id) {
      const rr = pickRecipe(S, m);
      const pw = powerIssue(S);
      add(pl.id, d, { act: 'operate', label: pw ? 'Pas de courant : ' + pw : rr ? `En marche : ${RECIPES[rr].name.toLowerCase()}` : 'En pause : ' + waitWhy(S, m) });
      continue;
    }
    const worker = fol.find((x) => DROIDS[x.type].work === 'machine' && (!DROIDS[x.type].only || DROIDS[x.type].only === m.type));
    if (worker && !m.operator) { add(pl.id, d, { act: 'assign', label: `Affecter : ${DROIDS[worker.type].name.toLowerCase()}` }); continue; }
    if (sum(m.out) > 0 && !full) { add(pl.id, d, { act: 'collect', label: 'Récupérer : ' + fmt(m.out) }); continue; }
    const need = needOf(S, m);
    if (Object.entries(need).some(([k, n]) => n > 0 && (p.sac[k] || 0) > 0)) { add(pl.id, d, { act: 'load', label: 'Charger la machine' }); continue; }
    if (!m.sel.length) { add(pl.id, d, { off: true, label: 'Choisis une recette (bouton Recettes)' }); continue; }
    const rid = pickRecipe(S, m);
    if (m.operator) add(pl.id, d, { off: true, label: rid ? 'Le droïde fait tourner la machine' : 'En attente : ' + waitWhy(S, m) });
    else if (!rid) add(pl.id, d, { off: true, label: waitWhy(S, m) });
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

// Pourquoi une machine ne peut pas produire
export function waitWhy(S, m) {
  const r = RECIPES[m.sel.includes(m.cur) ? m.cur : m.sel[0]];
  if (!r) return 'aucune recette choisie';
  if (r.any) {
    const has = Object.entries(m.inp).some(([k, n]) => n > 0 && ITEMS[k].kind === r.any);
    if (!has) return r.any === 'decl' ? 'rien à contrôler : apporte des pièces déclassées' : 'rien à recycler : apporte des rebuts';
    return 'sortie pleine : récupère la production';
  }
  const miss = missingIn(S, m);
  return sum(miss) ? 'il manque ' + fmt(miss) : 'sortie pleine : récupère la production';
}
const declCount = (p) => Object.entries(p.sac).reduce((a, [k, n]) => a + (isDecl(k) ? n : 0), 0);
const depositable = (p) => sacCount(p) - declCount(p);
// Crédits gagnés (avec un « +n » au-dessus de l'endroit)
function earn(S, n, at) {
  S.credits += n; S.stats.earned += n;
  if (at) fx(S, 'all', 'cred', { n, x: at.x, z: at.z });
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
      const n = depositable(p);
      for (const [k, v] of Object.entries(p.sac)) if (v > 0 && !isDecl(k)) { addStock(S, k, v); delete p.sac[k]; }
      sfx(S, id, 'drop');
      toast(S, id, `${n} déposé${n > 1 ? 's' : ''} à l’entrepôt`, 'good');
      if (declCount(p)) toast(S, id, 'Les pièces déclassées vont à la zone des déclassés.', 'warn');
      break;
    }
    case 'zoneput': {
      const z = S.machines[t.key];
      for (const [k, v] of Object.entries(p.sac)) if (isDecl(k)) { z.inp[k] = (z.inp[k] || 0) + v; delete p.sac[k]; }
      sfx(S, id, 'drop');
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
      if (MACHINES[m.type].fuel) {
        for (const k of ['charbon', 'bois']) {
          const q = Math.min(T.genCap - genFill(S, m), p.sac[k] || 0);
          if (q > 0) { addSac(p, k, -q); m.inp[k] = (m.inp[k] || 0) + q; }
        }
        sfx(S, id, 'drop');
        break;
      }
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
      earn(S, CREDITS.creature, PLOT_BY_ID[m.id]);
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
      earn(S, o.reward, PLOT_BY_ID.quai); S.stats.orders += 1;
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
  if ((pl.type === 'qualite' || pl.type === 'zone') && qcActive(S)) toast(S, 'all', 'Contrôle qualité en place : 1 pièce sur 5 sortira déclassée. Rangez-les dans la zone des déclassés, puis contrôlez-les.', 'warn');
  if (pl.type === 'generateur') { S.gen.play = 0; toast(S, 'all', 'Générateur : 1 charbon ou 1 bois toutes les 12 minutes. Attention, il surchauffe après 1 heure de jeu.', 'info'); }
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
      if (isDecl(e.item)) { toast(S, id, 'Les pièces déclassées vont à la zone des déclassés.', 'warn'); return; }
      const q = Math.max(0, Math.min(e.n | 0, p.sac[e.item] || 0));
      if (q) { addSac(p, e.item, -q); addStock(S, e.item, q); sfx(S, id, 'drop'); }
      break;
    }
    case 'putall': if (nearHQ) { for (const [k, v] of Object.entries(p.sac)) if (!isDecl(k)) { addStock(S, k, v); delete p.sac[k]; } sfx(S, id, 'drop'); } break;
    case 'ztake': case 'zput': case 'zputall': {
      const z = S.machines.zone;
      if (!z || boxDist(p, plotBox(PLOT_BY_ID.zone)) > REACH + 1.5) return;
      if (e.c === 'zputall') { for (const [k, v] of Object.entries(p.sac)) if (isDecl(k)) { z.inp[k] = (z.inp[k] || 0) + v; delete p.sac[k]; } sfx(S, id, 'drop'); return; }
      if (!isDecl(e.item)) return;
      if (e.c === 'ztake') {
        const q = Math.max(0, Math.min(e.n | 0, z.inp[e.item] || 0, SAC_MAX - sacCount(p)));
        if (q) { z.inp[e.item] -= q; if (!z.inp[e.item]) delete z.inp[e.item]; addSac(p, e.item, q); sfx(S, id, 'pick'); }
      } else {
        const q = Math.max(0, Math.min(e.n | 0, p.sac[e.item] || 0));
        if (q) { addSac(p, e.item, -q); z.inp[e.item] = (z.inp[e.item] || 0) + q; sfx(S, id, 'drop'); }
      }
      break;
    }
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
      if (!o || !DROIDS[e.type] || e.type === 'ouvrier' || DROIDS[e.type].lvl > S.level || S.wardrobe.owned[key]) return;
      if (S.credits < o.price) { toast(S, id, 'Pas assez de crédits', 'warn'); return; }
      S.credits -= o.price; S.wardrobe.owned[key] = true;
      (S.wardrobe.wear[e.type] = S.wardrobe.wear[e.type] || {})[o.slot] = e.outfit;
      sfx(S, 'all', 'ok');
      toast(S, 'all', `${o.name} : ${DROIDS[e.type].name.toLowerCase()} !`, 'good');
      break;
    }
    case 'pack': {
      if (!DROIDS[e.type] || e.type === 'ouvrier' || S.level < PACK.lvl || DROIDS[e.type].lvl > S.level) return;
      const price = packPrice(S, e.type);
      if (!price) return;
      if (S.credits < price) { toast(S, id, 'Pas assez de crédits', 'warn'); return; }
      S.credits -= price;
      for (const o of PACK.items) S.wardrobe.owned[e.type + ':' + o] = true;
      const w = (S.wardrobe.wear[e.type] = S.wardrobe.wear[e.type] || {});
      w.tete = w.tete || 'casque'; w.corps = w.corps || 'gilet'; w.cou = w.cou || 'noeud';
      sfx(S, 'all', 'won');
      toast(S, 'all', `${PACK.name} : ${DROIDS[e.type].name.toLowerCase()} entièrement habillé !`, 'good');
      break;
    }
    case 'wear': {
      if (!DROIDS[e.type]) return;
      const w = (S.wardrobe.wear[e.type] = S.wardrobe.wear[e.type] || {});
      if (e.outfit === null && typeof e.slot === 'string') delete w[e.slot];
      else if (OUTFITS[e.outfit] && S.wardrobe.owned[e.type + ':' + e.outfit]) {
        const sl = OUTFITS[e.outfit].slot;
        if (w[sl] === e.outfit) delete w[sl]; else w[sl] = e.outfit;
      }
      break;
    }
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

// Pendant la surchauffe, seuls le vestiaire et l'organigramme restent accessibles
const LOCKED_OK = new Set(['buy', 'pack', 'wear']);
export function commandsOnly(S, inputs) {
  for (const id of IDS) {
    const inp = inputs[id];
    if (!inp || !inp.events) continue;
    for (const e of inp.events) if (e && typeof e === 'object' && LOCKED_OK.has(e.c)) command(S, id, e);
  }
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
  generator(S, dt);
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
  const heavy = m.broken === 'heavy';
  m.broken = null; m.fixT = 0; m.cut = null; m.wear = wearTime();
  S.stats.repairs += 1;
  earn(S, heavy ? CREDITS.heavy : CREDITS.repair, PLOT_BY_ID[m.id]);
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

// Générateur : 1 unité toutes les 12 minutes de jeu, surchauffe après 1 heure (pause obligatoire de 30 minutes)
function generator(S, dt) {
  const gen = S.machines.generateur;
  if (!gen) return;
  gen.run = false;
  const P = S.power;
  if (P.energy <= 0 && genUnits(gen) > 0) {
    const f = (gen.inp.charbon || 0) > 0 ? 'charbon' : 'bois';
    gen.inp[f] -= 1; if (!gen.inp[f]) delete gen.inp[f];
    P.energy += T.genUnit; S.stats.burned += 1;
  }
  if (P.energy > 0 && !gen.broken) { P.energy = Math.max(0, P.energy - dt); gen.run = true; }
  S.gen.play += dt;
  if (S.gen.play >= T.overheatAt) {
    S.gen.play = 0;
    S.gen.lockUntil = nowMs(S) + T.overheatLock * 1000;
    gen.inp = {}; P.energy = 0;
    sfx(S, 'all', 'err');
    fx(S, 'all', 'overheat');
    fx(S, 'all', 'save');
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
  const gen = S.machines.generateur;
  let powered = true;
  if (needPower(S) && want.length) {
    const P = S.power;
    if (gen) powered = !gen.broken && P.energy > 0;
    else if (P.battery > 0) P.battery = Math.max(0, P.battery - dt);
    else powered = false;
    if (gen && gen.run && S.time >= T.panneStart) { gen.wear -= dt; if (gen.wear <= 0) breakdown(S, gen); }
    if (!powered && !P.out) {
      P.out = true;
      sfx(S, 'all', 'err');
      toast(S, 'all', gen ? (gen.broken ? 'Générateur en panne : plus de courant !' : 'Générateur vide : chargez-le en charbon ou en bois !') : 'Batterie vide : construisez le générateur !', 'bad');
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
    if (r.any) produceAny(S, m, r);
    else {
      for (const [k, n] of Object.entries(r.in)) { m.inp[k] -= n; if (!m.inp[k]) delete m.inp[k]; }
      for (const [k, n] of Object.entries(r.out)) {
        if (k === 'droide') { spawnDroid(S, m); continue; }
        // Une fois le contrôle qualité en place, 20 % des pièces sortent déclassées
        let nd = 0;
        if (QC_BASES[k] && qcActive(S) && !MACHINES[m.type].noDecl) for (let i = 0; i < n; i++) if (Math.random() < T.declRate) nd += 1;
        if (n - nd > 0) m.out[k] = (m.out[k] || 0) + n - nd;
        if (nd) { m.out[k + '_d'] = (m.out[k + '_d'] || 0) + nd; S.stats.made[k + '_d'] = (S.stats.made[k + '_d'] || 0) + nd; }
        S.stats.made[k] = (S.stats.made[k] || 0) + n;
      }
    }
    sfx(S, 'all', 'ding');
    // Plusieurs recettes cochées : 1 de chaque, à tour de rôle
    if (m.sel.length > 1) { m.cur = m.sel[(m.sel.indexOf(m.cur) + 1) % m.sel.length]; m.done = 0; }
  }
}

// Contrôle d'une pièce déclassée, ou recyclage d'un rebut
function produceAny(S, m, r) {
  const k = anyItem(S, m, r.any);
  if (!k) return;
  m.inp[k] -= 1; if (!m.inp[k]) delete m.inp[k];
  const b = ITEMS[k].base;
  if (r.any === 'decl') {
    S.stats.controlled += 1;
    earn(S, CREDITS.ctrl, PLOT_BY_ID[m.id]);
    const resp = S.droids.some((d) => d.type === 'qualite' && d.st === 'work' && d.job === m.id);
    const rebut = Math.random() < (resp ? T.rebutRateResp : T.rebutRate) || S.qcRun >= T.rebutMaxRun - 1;
    if (rebut) {
      S.qcRun = 0;
      m.out[b + '_r'] = (m.out[b + '_r'] || 0) + 1;
      S.stats.made[b + '_r'] = (S.stats.made[b + '_r'] || 0) + 1;
      toast(S, 'all', `Contrôle : ${ITEMS[b].name.toLowerCase()} refusé${['carcasse', 'tole', 'silicium'].includes(b) ? 'e' : ''} → rebut à recycler.`, 'warn');
    } else {
      S.qcRun += 1;
      m.out[b] = (m.out[b] || 0) + 1;
    }
  } else {
    S.stats.recycled += 1;
    for (const [rk, rn] of Object.entries(QC_BASES[b].back)) m.out[rk] = (m.out[rk] || 0) + rn;
  }
}

function spawnDroid(S, m) {
  const pl = PLOT_BY_ID[m.id];
  const n = S.droids.filter((d) => d.st === 'idle').length;
  S.droids.push({ id: S.seq++, type: 'ouvrier', x: pl.x + MACHINES[m.type].w / 2 + 1.3, z: pl.z + 1.2 + (n % 3) * 0.9, rot: 0, st: 'idle', who: null, job: null, job2: null, task: null, carry: null });
  S.made += 1;
  earn(S, CREDITS.droid, pl);
  sfx(S, 'all', 'won');
  toast(S, 'all', S.made === 1 ? 'Premier droïde produit ! Emmène-le sur une machine.' : 'Nouveau droïde produit.', 'good');
}

function breakdown(S, m, forceHeavy = false) {
  const heavy = forceHeavy || (S.level >= T.heavyFrom && Math.random() < (S.level >= 12 ? 0.45 : 0.35));
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
const hasAdjq = (S) => S.droids.some((x) => x.type === 'adjq' && x.st === 'work');
function hqIndex(S, d) { return S.droids.filter((x) => x.job === 'hq').indexOf(d); }
const busySigs = (S, d) => new Set(S.droids.filter((x) => x !== d && x.task && x.task.sig).map((x) => x.task.sig));
const spotOf = (where) => (where === 'hq' ? HQ : front(PLOT_BY_ID[where]));

// Porte des objets d'un point à un autre (tâche { from, to, item, phase, load })
function haul(S, d, dt, obs, max) {
  const t = d.task;
  if (t.phase === 'pick') {
    if (!goTo(d, spotOf(t.from), dt, obs)) return;
    let q;
    if (t.from === 'hq') { q = Math.min(max, S.stock[t.item] || 0, t.want || max); if (q > 0) addStock(S, t.item, -q); }
    else {
      const m = S.machines[t.from];
      const box = m && MACHINES[m.type].store ? m.inp : m ? m.out : {};
      q = Math.min(max, box[t.item] || 0, t.want || max);
      if (q > 0) { box[t.item] -= q; if (!box[t.item]) delete box[t.item]; }
    }
    if (!q) { d.task = null; return; }
    t.load = q; d.carry = t.item; t.phase = 'drop';
  } else {
    if (!goTo(d, spotOf(t.to), dt, obs)) return;
    if (t.to === 'hq') addStock(S, t.item, t.load);
    else if (t.to === 'quai') { shipColis(S, null, d); if (t.load > 0) addStock(S, t.item, t.load); }
    else {
      const m = S.machines[t.to];
      const q = !m ? 0 : MACHINES[m.type].store ? t.load : Math.min(needOf(S, m)[t.item] || 0, t.load);
      if (q) m.inp[t.item] = (m.inp[t.item] || 0) + q;
      if (t.load - q > 0) { if (isDecl(t.item) && S.machines.zone) S.machines.zone.inp[t.item] = (S.machines.zone.inp[t.item] || 0) + t.load - q; else addStock(S, t.item, t.load - q); }
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
        if (m.type === 'qualite' && hasAdjq(S)) continue;
        for (const [k, n] of Object.entries(m.out)) {
          if (n <= 0) continue;
          if (isDecl(k) && !S.machines.zone) continue;
          const sig = 'out>' + m.id + k;
          if (!busy.has(sig)) cands.push({ score: n >= OUT_MAX - 1 ? 2.5 : 1, task: { from: m.id, to: isDecl(k) ? 'zone' : 'hq', item: k, sig } });
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
  // Circuit qualité : déclassées → contrôle → rebuts au recycleur, bonnes pièces à l'entrepôt
  adjq(S, d, dt, obs) {
    if (!d.task) {
      const busy = busySigs(S, d);
      const q = S.machines.qualite, z = S.machines.zone, rc = S.machines.recycleur;
      const cands = [];
      const push = (score, task) => { if (!busy.has(task.sig)) cands.push({ score, task }); };
      if (q) {
        for (const [k, n] of Object.entries(q.out)) {
          if (n <= 0) continue;
          if (isRebut(k)) push(9, { from: 'qualite', to: rc ? 'recycleur' : 'hq', item: k, sig: 'aq>' + k });
          else push(8, { from: 'qualite', to: 'hq', item: k, sig: 'aq>' + k });
        }
        const room = Math.max(0, 6 - Object.entries(q.inp).reduce((a, [k, n]) => a + (isDecl(k) ? n : 0), 0));
        if (room > 0 && z) for (const [k, n] of Object.entries(z.inp)) if (n > 0) push(7, { from: 'zone', to: 'qualite', item: k, want: room, sig: 'az>' + k });
      }
      for (const m of Object.values(S.machines)) {
        if (m.type === 'qualite' || MACHINES[m.type].store) continue;
        for (const [k, n] of Object.entries(m.out)) if (n > 0 && isDecl(k) && z) push(6, { from: m.id, to: 'zone', item: k, sig: 'ad>' + m.id + k });
      }
      if (rc) for (const [k, n] of Object.entries(S.stock)) if (n > 0 && isRebut(k) && (rc.inp[k] || 0) < 4) push(5, { from: 'hq', to: 'recycleur', item: k, want: 4, sig: 'ar>' + k });
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
// Avancement d'un objectif chiffré : [fait, à faire]
export function goalProgress(S, g) {
  if (!g.c) return null;
  const [kind, n, item] = g.c, st = S.stats, b = S.lv0 || snapshot(S);
  let v = 0;
  switch (kind) {
    case 'made+': v = S.made - b.made; break;
    case 'earn+': v = st.earned - b.earned; break;
    case 'rep+': v = st.repairs - b.repairs; break;
    case 'ctrl+': v = st.controlled - b.ctrl; break;
    case 'recyc+': v = st.recycled - b.recyc; break;
    case 'orders+': v = st.orders - b.orders; break;
    case 'item+': v = (st.made[item] || 0) - (b.items[item] || 0); break;
    case 'work': v = S.droids.filter((d) => d.st === 'work').length; break;
    case 'crea': v = S.animals.filter((a) => a.st === 'installed').length; break;
    case 'droids': v = S.droids.length; break;
  }
  return [Math.max(0, Math.min(n, v)), n];
}

export function goalStatus(S, gid) {
  const g = LEVELS[S.level].goals.find((x) => x.id === gid);
  if (g && g.c) { const [v, n] = goalProgress(S, g); return v >= n; }
  const M = S.machines, st = S.stats, has = (t) => S.droids.some((d) => d.type === t);
  switch (gid) {
    case 'core': return S.core.placed;
    case 'droid1': return S.made >= 1;
    case 'fuel': return st.burned >= 1;
    case 'heavy': return st.heavyFixed >= 1;
    case 'qualiteD': return has('qualite');
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
      earn(S, CREDITS.goal);
      toast(S, 'all', `Objectif atteint : ${g.text} (+${CREDITS.goal} crédits)`, 'good');
    }
  }
  if (L.goals.every((g) => S.goals[g.id])) {
    earn(S, CREDITS.level);
    if (S.level < LEVELS.length - 1) {
      S.level += 1;
      S.lv0 = snapshot(S);
      sfx(S, 'all', 'won');
      fx(S, 'all', 'level', { n: S.level + 1, name: LEVELS[S.level].name });
      fx(S, 'all', 'save');
      if (S.level === T.heavyFrom) {
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
