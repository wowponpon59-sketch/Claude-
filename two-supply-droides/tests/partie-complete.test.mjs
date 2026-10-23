// Partie complète en 20 niveaux, sans navigateur (Node 18+), avec le coéquipier IA.
// Usage : node two-supply-droides/tests/partie-complete.test.mjs [graine]   → affiche « OK » à la fin.
// Écrit aussi tests/fixtures/state-l6.json, state-l14.json et state-late.json (sauvegardes utilisées par navigateur.test.cjs).
// Partie complète automatique (version 0.4, 20 niveaux) : joueur scripté + coéquipier IA.
import * as SIM from '../js/sim.js';
import { createBot, botInput } from '../js/bot.js';
import { NODES } from '../js/world.js';
import { PLOTS, NODE_TYPES, ENTREPOT, CORE, PART, MACHINES, RECIPES, LEVELS, T, SAC_MAX, DROIDS, OUTFITS, PACK, ITEMS } from '../js/config.js';
import { moveCircle, obstacles } from '../js/move.js';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });

const seed = +(process.argv[2] || 777);
const S = SIM.newState('solo', seed);
S.clock = 1.7e12;
const bot = createBot();
const A = { held: false, events: [], mx: 0, mz: 0, x: S.players.A.x, z: S.players.A.z, rot: 0 };
const PB = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
const FX = [];
const dt = 1 / 30;
let overheats = 0;
const tick = () => {
  S.clock += dt * 1000;
  const b = botInput(S, bot, dt, A);
  SIM.step(S, dt, { A, B: b });
  A.events = [];
  for (const f of SIM.drainFx(S)) { FX.push(f); if (f.k === 'overheat') { overheats += 1; log('SURCHAUFFE : pause de 30 minutes'); S.clock = S.gen.lockUntil + 1000; } }
  const p = S.players.A; if (p.locked) { A.x = p.x; A.z = p.z; }
};
const run = (sec) => { for (let i = 0; i < sec * 30; i++) tick(); };
const at = (x, z) => { A.x = x; A.z = z; tick(); };
const down = () => { A.events.push('down'); A.held = true; };
const up = () => { A.events.push('up'); A.held = false; };
const tap = () => { down(); tick(); up(); tick(); };
const cmd = (e) => { A.events.push(e); tick(); };
const label = () => (S.players.A.hint || {}).label || '';
const lvl = () => S.level + 1;
const log = (...a) => console.log(`[${S.time.toFixed(0)}s · niv ${lvl()}]`, ...a);
const sacN = () => Object.values(S.players.A.sac).reduce((a, b) => a + b, 0);
const frontOf = (id) => { const p = PB[id]; return { x: p.x, z: p.z + MACHINES[p.type].d / 2 + 0.6 }; };
const atHQ = () => at(ENTREPOT.x, ENTREPOT.z + ENTREPOT.d / 2 + 0.6);
const deposit = () => { atHQ(); if (sacN()) cmd({ c: 'putall' }); };
const nodesOf = (item) => NODES.map((n, i) => ({ n, i })).filter(({ n }) => NODE_TYPES[n.type].item === item).sort((a, b) => Math.hypot(a.n.x, a.n.z) - Math.hypot(b.n.x, b.n.z));
const add = (k, n) => { S.stock[k] = (S.stock[k] || 0) + n; };

let hijack = 0;
function gather(item, qty) {
  let got = 0, g = 0;
  for (const { n, i } of nodesOf(item)) {
    while (S.nodes[i] > 0 && got < qty && g++ < 400) {
      if (sacN() >= SAC_MAX) deposit();
      at(n.x + NODE_TYPES[n.type].r + 0.5, n.z);
      // un joueur voit le bouton passer à « Attraper » : il attend un peu au lieu d'appuyer
      for (let w = 0; w < 20 && /^Attraper/.test(label()); w++) { hijack++; run(0.5); }
      const b0 = S.players.A.sac[item] || 0;
      down(); run(0.75); up(); tick();
      got += (S.players.A.sac[item] || 0) - b0;
    }
    if (got >= qty) break;
  }
  assert.ok(got >= qty, `fouille ${item} ${got}/${qty}`);
  deposit();
}
function deliver(id) { const f = frontOf(id); at(f.x, f.z); assert.match(label(), /Apporter/, id + ': ' + label()); tap(); }
function assemble(id) {
  const L = SIM.postL(PB[id]);
  at(L.x, L.z);
  assert.match(label(), /Tenir/, 'poste ' + id + ': ' + label());
  down();
  let g = 0;
  while (!S.plots[id].built && g++ < 30 * 60) { A.x = L.x; A.z = L.z; tick(); }
  up(); tick();
  assert.ok(S.plots[id].built, 'machine montée avec le coéquipier : ' + id);
}
// Pièce lourde ramenée à deux avec le coéquipier IA : le joueur saisit une poignée, le coéquipier l'autre,
// puis le joueur dirige (passages dans les ruines, petit pas de côté quand ça coince)
let carried = 0;
function carryPart(id) {
  const c = S.parts[id];
  if (!c || c.placed) return;
  // Les ingénieurs (à deux) sont déjà en train de la ramener : on les laisse faire
  const engOn = () => c.eng || S.droids.some((d) => d.task && d.task.part === id);
  if (engOn()) {
    let w = 0; while (!c.placed && engOn() && w++ < 30 * 150) { fuel(); tick(); if (process.env.DBGP && w % 90 === 0) console.log('DBGP', id, c.x.toFixed(1), c.z.toFixed(1), JSON.stringify(c.eng), c.stuckT, c.ghostT, JSON.stringify(S.droids.filter((d) => d.task && d.task.part === id).map((d) => [d.id, d.x.toFixed(1), d.z.toFixed(1), d.task.kind, d.task.side, d.st]))); }
    if (c.placed) { log('pièce lourde ramenée par les ingénieurs :', id); return; }
    // les ingénieurs ont été appelés ailleurs : le joueur la ramène avec le coéquipier
  }
  at(c.x - PART.handle - 0.3, c.z);
  assert.match(label(), /^Saisir/, 'poignée ' + id + ' : ' + label());
  tap();
  let g = 0; while (!c.hand.B && g++ < 30 * 40) tick();
  assert.equal(c.hand.B, 'R', 'le coéquipier prend l’autre poignée : ' + id);
  g = 0; let side = 0, lx = c.x, lz = c.z, still = 0, turn = 1;
  const target = PB[id];
  while (!c.placed && g++ < 30 * 150) {
    const wp = SIM.partRoute(S, id);
    const dx = wp.x - c.x, dz = wp.z - c.z, l = Math.hypot(dx, dz) || 1;
    let mx = dx / l, mz = dz / l;
    if (side > 0) { side -= dt; [mx, mz] = [-mz * turn, mx * turn]; }
    A.mx = mx; A.mz = mz; tick();
    const mv = Math.hypot(c.x - lx, c.z - lz); lx = c.x; lz = c.z;
    still = mv < 0.01 ? still + dt : 0;
    if (still > 0.4 && side <= 0) { side = 1.2; turn = -turn; }
  }
  A.mx = A.mz = 0;
  assert.ok(c.placed, 'pièce lourde posée : ' + id + ' (' + c.x.toFixed(1) + ', ' + c.z.toFixed(1) + ')');
  carried++;
  log('pièce lourde ramenée :', id);
}
function buildPlot(id) {
  if (S.plots[id].built) return;
  carryPart(id);
  if (!S.plots[id].ready) {
    const cost = MACHINES[PB[id].type].cost;
    for (let tries = 0; tries < 3 && !S.plots[id].ready; tries++) {
      for (const [k, n] of Object.entries(cost)) add(k, Math.max(0, n - (S.plots[id].del[k] || 0)));
      deliver(id);
    }
  }
  assert.ok(S.plots[id].ready, id + ' prêt');
  if (!S.plots[id].built) assemble(id);
  log('construit :', MACHINES[PB[id].type].name);
}
function setRecipes(id, sel) { const f = frontOf(id); at(f.x, f.z); cmd({ c: 'recipes', mach: id, sel }); assert.deepEqual(S.machines[id].sel, sel, 'recettes ' + id); }
function feed(id, items, k = 1) { const m = S.machines[id]; for (const [it, n] of Object.entries(items)) m.inp[it] = (m.inp[it] || 0) + n * k; }
function fuel() {
  const gen = S.machines.generateur;
  if (gen && !gen.inp.charbon && !gen.inp.bois && S.power.energy < 1) gen.inp.charbon = 5;
  if (gen && gen.broken) fix('generateur');
}
function operate(id, until, max = 120) {
  const f = frontOf(id); at(f.x, f.z);
  let g = 0;
  down();
  while (!until() && g++ < max * 30) {
    const m = S.machines[id];
    if (m.broken) { up(); tick(); fix(id); at(f.x, f.z); down(); }
    const gen = S.machines.generateur;
    if (gen && (gen.broken || (!gen.inp.charbon && !gen.inp.bois && S.power.energy < 1)) && id !== 'generateur') { up(); tick(); fuel(); at(f.x, f.z); down(); }
    if (!m.operator && (!S.work.A || S.work.A.kind !== 'operate') && g % 15 === 0) { up(); tick(); at(f.x, f.z); if (/Actionner|Charger/.test(label())) down(); else { tick(); continue; } }
    A.x = f.x; A.z = f.z; tick();
  }
  up(); tick();
  if (!until()) console.log('DEBUG machine', JSON.stringify(S.machines[id]), 'power', JSON.stringify(S.power), 'label', label(), 'suiveurs', JSON.stringify(S.droids.filter((d) => d.st === 'follow').map((d) => ({ id: d.id, type: d.type, who: d.who, made: d.id }))));
  assert.ok(until(), 'production ' + id + ' (' + label() + ')');
}
function collect(id) {
  const m = S.machines[id];
  if (m.broken) fix(id);
  const f = frontOf(id); at(f.x, f.z);
  if (Object.keys(m.out).length) { assert.match(label(), /Récupérer|Affecter|Reprendre|Installer/, label()); if (/Récupérer/.test(label())) tap(); }
  deposit();
  // les pièces déclassées et les rebuts restent dans le sac : direction la zone
  if (S.machines.zone && Object.keys(S.players.A.sac).some((k) => ['decl', 'rebut'].includes(ITEMS[k].kind))) { const z = frontOf('zone'); at(z.x, z.z); assert.match(label(), /Déposer à la zone/, label()); tap(); }
}
// Produit n fois la recette rid (matières fournies) et attend la production réelle
function make(id, rid, n = 1) {
  if (S.machines[id].sel.join() !== rid) setRecipes(id, [rid]);
  const r = RECIPES[rid];
  const outKey = Object.keys(r.out)[0], q = r.out[outKey] * n;
  feed(id, r.in, n);
  const before = (S.stats.made[outKey] || 0), m0 = S.made;
  operate(id, () => (outKey === 'droide' ? S.made >= m0 + n : (S.stats.made[outKey] || 0) >= before + q), 40 * n + 20);
}
function fix(id) {
  const m = S.machines[id];
  if (m.broken === 'light') { const f = frontOf(id); at(f.x, f.z); down(); run(T.repair + 0.3); up(); tick(); }
  else if (m.broken === 'heavy') { const L = SIM.postL(PB[id]); at(L.x, L.z); down(); let g = 0; while (m.broken && g++ < 30 * 30) { A.x = L.x; A.z = L.z; tick(); } up(); tick(); }
  if (m.broken) { let g = 0; while (m.broken && g++ < 30 * 15) tick(); }
  assert.ok(!m.broken, 'réparé ' + id);
}
function newDroid() {
  const n0 = S.made;
  const m = S.machines.assembleur;
  if (m.sel.join() !== 'droide') setRecipes('assembleur', ['droide']);
  if (!((m.inp.carcasse || 0) >= 1 && (m.inp.circuit || 0) >= 1)) feed('assembleur', { carcasse: 1, circuit: 1 });
  operate('assembleur', () => S.made > n0, 60);
  return S.droids[S.droids.length - 1];
}
function take(d) {
  // on vise ce droïde-là (pas un autre qui passe à côté)
  const OFF = [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.45, 0.45], [-0.45, -0.45]];
  for (let k = 0; k < 18 && d.st !== 'follow'; k++) { const [ox, oz] = OFF[k % OFF.length]; at(d.x + ox, d.z + oz); if (/Emmener|Reprendre/.test(label()) && (S.players.A.hint || {}).key === 'droid' + d.id) tap(); else run(0.3); }
  assert.equal(d.st, 'follow', 'emmener : ' + label());
}
const KIT = Object.fromEntries(Object.entries(DROIDS).filter(([, d]) => d.kit).map(([k, d]) => [k, d.kit]));
const KIT_RECIPE = Object.fromEntries(Object.entries(RECIPES).filter(([, r]) => Object.keys(r.out)[0]?.startsWith('k_')).map(([rid, r]) => [Object.keys(r.out)[0], rid]));
function train(type) {
  const kit = KIT[type];
  if ((S.stock[kit] || 0) < 1) { make('etabli', KIT_RECIPE[kit], 1); collect('etabli'); }
  { let w = 0; while ((S.stock[kit] || 0) + (S.players.A.sac[kit] || 0) < 1 && w++ < 30 * 15) tick(); }
  assert.ok((S.stock[kit] || 0) + (S.players.A.sac[kit] || 0) >= 1, 'kit dispo ' + kit);
  const d = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || newDroid();
  take(d);
  const f = frontOf('atelier'); at(f.x, f.z); run(1.5);
  assert.match(label(), /Spécialiser/, 'atelier: ' + label());
  tap();
  assert.ok(FX.some((e) => e.k === 'menu' && e.menu === 'spec'), 'menu spécialisation');
  cmd({ c: 'spec', type });
  assert.equal(d.st, 'spec', 'formation ' + type);
  run(T.spec + 0.5);
  assert.equal(d.type, type);
  if (DROIDS[type].work === 'hq') {
    // l'adjoint qualité se met au travail à la zone des déclassés, les autres à l'entrepôt
    if (DROIDS[type].at) { const z = frontOf(DROIDS[type].at); at(z.x, z.z); } else atHQ();
    run(1.2); assert.match(label(), /Mettre au travail/, 'HQ: ' + label()); tap(); assert.equal(d.job, 'hq');
  }
  log('formé :', DROIDS[type].name);
  return d;
}
function assignAt(d, id) {
  if (S.machines[id] && S.machines[id].broken) fix(id);
  if (d.st !== 'follow') take(d);
  const f = frontOf(id); at(f.x + 0.4, f.z); run(1.5);
  assert.match(label(), /Affecter/, 'affecter ' + id + ': ' + label()); tap();
  run(5);
}
function capture() {
  const an = S.animals.filter((a) => (a.st === 'wander' || a.st === 'flee') && a.sp !== 'colosse').sort((a, b) => Math.hypot(a.x - A.x, a.z - A.z) - Math.hypot(b.x - A.x, b.z - A.z))[0];
  assert.ok(an, 'une créature à attraper');
  let caught = false;
  for (let i = 0; i < 30 * 120 && !caught; i++) {
    // comme un joueur : on sort de l'usine par une ouverture des ruines
    const wp = SIM.waypoint(A, an) || an;
    const dx = wp.x - A.x, dz = wp.z - A.z, l0 = Math.hypot(dx, dz) || 1, l = Math.hypot(an.x - A.x, an.z - A.z);
    const st = Math.min(l0, 4.6 / 30);
    [A.x, A.z] = moveCircle(A.x, A.z, dx / l0 * st, dz / l0 * st, obstacles(S));
    tick();
    if (/^Attraper/.test(label())) { tap(); caught = S.animals.some((a) => a.st === 'caught' && a.by === 'A'); }
    if (process.env.DBGA && i % 90 === 0) console.log('DBGA', i / 30, an.id, an.st, an.x.toFixed(1), an.z.toFixed(1), 'A', A.x.toFixed(1), A.z.toFixed(1), 'bot', bot.why, bot.ent.x.toFixed(1), bot.ent.z.toFixed(1), 'l', l.toFixed(1), 'work', JSON.stringify(S.work.A), 'tired', (an.tired||0).toFixed(1));
  }
  assert.ok(caught, 'créature capturée avec le coéquipier');
  const got = S.animals.find((a) => a.st === 'caught' && a.by === 'A');
  // (une machine peut tomber en panne au mauvais moment : on en essaie une autre)
  for (let k = 0; k < 5 && got.st !== 'installed'; k++) {
    const m = Object.values(S.machines).filter((x) => MACHINES[x.type].recipes.length && x.animals.length < T.animalMax && !x.broken)[k];
    if (!m) break;
    const f = frontOf(m.id); at(f.x - 0.8, f.z); run(2.5);
    if (/^Installer/.test(label())) tap();
  }
  assert.equal(got.st, 'installed', 'créature installée : ' + label());
}
// Joue les objectifs de rodage (et les objectifs chiffrés) jusqu'à les réussir
const MAKE_ITEM = { carcasse: ['forge', 'carcasse'], circuit: ['circuits', 'circuit'], isolant: ['ceramique', 'isolant'], fil: ['trefileuse', 'fil'], tole: ['laminoir', 'tole'], circuitA: ['circuits', 'circuitA'] };
function freeMachine() { return Object.values(S.machines).find((m) => MACHINES[m.type].recipes.length && !m.operator && m.sel.length && m.type !== 'qualite' && m.type !== 'recycleur'); }
function satisfy() {
  const L = LEVELS[S.level];
  for (const g of L.goals) {
    if (!g.c || S.goals[g.id]) continue;
    const [kind, n, item] = g.c;
    const lv0 = S.level;
    // l'objectif peut faire passer le niveau : les compteurs repartent alors de zéro
    const prog = () => (S.level !== lv0 || S.goals[g.id] ? n : SIM.goalProgress(S, g)[0]);
    let guard = 0;
    while (!S.goals[g.id] && prog() < n && guard++ < 60) {
      fuel();
      if (kind === 'made+' || kind === 'earn+' || kind === 'droids') newDroid();
      else if (kind === 'work') {
        const m = freeMachine(); assert.ok(m, 'machine libre pour un ouvrier');
        const d = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || newDroid();
        assignAt(d, m.id);
      } else if (kind === 'rep+') {
        const m = Object.values(S.machines).find((x) => MACHINES[x.type].recipes.length && !x.broken);
        m.broken = 'light';
        let w = 0; while (m.broken && w++ < 30 * 20) tick();
        if (m.broken) fix(m.id);
      } else if (kind === 'crea') capture();
      else if (kind === 'item+') { const [mid, rid] = MAKE_ITEM[item]; make(mid, rid, Math.ceil((n - prog()) / RECIPES[rid].out[item])); collect(mid); }
      else if (kind === 'ctrl+') { feed('qualite', { carcasse_d: 3, circuit_d: 3 }); operate('qualite', () => prog() >= n || !Object.keys(S.machines.qualite.inp).length, 60); collect('qualite'); }
      else if (kind === 'recyc+') { if (!S.machines.recycleur.sel.includes('recyc')) setRecipes('recycleur', [...S.machines.recycleur.sel, 'recyc']); feed('recycleur', { carcasse_r: 1, circuit_r: 1 }); operate('recycleur', () => prog() >= n, 60); collect('recycleur'); }
      else if (kind === 'surplus+') { const f = frontOf('recycleur'); at(f.x, f.z); cmd({ c: 'trash', mach: 'recycleur', item: 'isolant', on: true }); feed('recycleur', { isolant: n }); operate('recycleur', () => prog() >= n, 60); collect('recycleur'); cmd({ c: 'trash', mach: 'recycleur', item: 'isolant', on: false }); }
      else if (kind === 'orders+') deliverOrder();
      else if (kind === 'special+') deliverOrder(true);
      else if (kind === 'spec+') {
        // un métier débloqué qui n'a pas encore 3 droïdes
        const t = ['maintenance', 'logistique', 'recherche', 'chefmaint', 'ingenieur', 'expert'].find((x) => DROIDS[x].lvl <= S.level && SIM.typeCount(S, x) < 3);
        assert.ok(t, 'un métier à former'); train(t);
      }
      tick();
    }
    assert.ok(S.goals[g.id] || prog() >= n, `objectif ${g.id} (${prog()}/${n})`);
  }
}
// Commande : emballer les droïdes demandés (un droïde qui suit le joueur + un carton) et livrer les colis au quai
function packOne(t) {
  const emb = S.machines.emballeuse;
  if (!emb.operator) { const op = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || newDroid(); assignAt(op, 'emballeuse'); }
  emb.inp.carton = (emb.inp.carton || 0) + 1;
  const k = 'colis_' + t, n0 = S.stats.made[k] || 0;
  const f = frontOf('emballeuse');
  if (t === 'ouvrier') {
    // droïde standard : il suit le joueur jusqu'à l'emballeuse
    const d = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || newDroid();
    take(d);
    for (let k = 0; k < 3 && !/Emballer/.test(label()); k++) { if (S.machines.emballeuse.broken) fix('emballeuse'); at(f.x, f.z); run(1.2); }
    assert.match(label(), /Emballer/, 'emballeuse : ' + label());
    tap();
  } else {
    // droïde spécialisé demandé par la commande : « Faire venir » depuis l'emballeuse
    if (!S.droids.some((x) => x.type === t && x.st !== 'spec')) train(t);
    if (Object.keys(S.machines.emballeuse.out).length) collect('emballeuse');
    if (S.machines.emballeuse.broken) fix('emballeuse');
    // (« Faire venir » propose d'abord le premier métier attendu par les commandes : on recommence si besoin)
    for (let tries = 0; tries < 4 && (S.stats.made[k] || 0) === n0; tries++) {
      if (!S.droids.some((x) => x.type === t && x.st !== 'spec' && x.st !== 'pack')) train(t);
      if (Object.keys(S.machines.emballeuse.out).length) collect('emballeuse');
      if (!(S.machines.emballeuse.inp.carton > 0)) S.machines.emballeuse.inp.carton = 1;
      if (S.machines.emballeuse.broken) fix('emballeuse');
      at(f.x, f.z); run(0.5);
      // (la commande a pu expirer entre-temps : deliverOrder recommencera avec la suivante)
      if (!/Faire venir|Emballer/.test(label())) return;
      tap();
      let g = 0; while (S.droids.some((x) => x.st === 'pack') && g++ < 30 * 60) tick();
    }
  }
  assert.equal(S.stats.made[k], n0 + 1, 'colis emballé : ' + t);
}
function deliverOrder(special = false) {
  const o0 = S.stats.orders, s0 = S.stats.special || 0;
  const done = () => (special ? (S.stats.special || 0) > s0 : S.stats.orders > o0);
  let want = '';
  // (les colis peuvent partir vers une commande plus ancienne : on recommence jusqu'à ce qu'une commande soit satisfaite)
  for (let round = 0; round < 4 && !done(); round++) {
    // (si les commandes ordinaires prennent toutes les places, on en satisfait une pour laisser venir une spéciale)
    let g = 0; while (!SIM.activeOrders(S).some((o) => !special || o.special) && g++ < 30 * 400) { fuel(); tick(); if (special && g % (30 * 60) === 0 && SIM.activeOrders(S).length >= 2) deliverOrder(false); }
    const o = SIM.activeOrders(S).find((x) => !special || x.special);
    assert.ok(o, 'commande reçue' + (special ? ' (spéciale)' : ''));
    want = SIM.orderText(o, 'want');
    for (const [t, n] of Object.entries(o.left)) for (let k = 0; k < n; k++) packOne(t);
    g = 0; while (!done() && g++ < 30 * 20) tick(); // l'expert peut livrer tout seul
    if (done()) break;
    collect('emballeuse');
    atHQ();
    for (const k of Object.keys(S.stock)) if (k.startsWith('colis_')) cmd({ c: 'take', item: k, n: S.stock[k] });
    const q = frontOf('quai'); at(q.x, q.z);
    if (/Livrer/.test(label())) tap();
  }
  assert.ok(done(), 'commande satisfaite : ' + want);
  log('commande satisfaite :', want, '· total', S.stats.orders, '· crédits', S.credits);
}
const earnedAt = {};
function waitLevel(n, max = 30) {
  let g = 0; while (lvl() < n && g++ < max * 30) tick();
  assert.ok(lvl() >= n, 'niveau ' + n + ' (objectifs : ' + LEVELS[S.level].goals.filter((x) => !S.goals[x.id]).map((x) => x.id + (x.c ? ' ' + SIM.goalProgress(S, x).join('/') : '')) + ')');
  earnedAt[n] = S.stats.earned;
  log('NIVEAU', lvl(), LEVELS[S.level].name, '· crédits gagnés', S.stats.earned, '· droïdes', S.droids.length);
}

// ========== NIVEAU 1 ==========
assert.deepEqual(MACHINES.forge.recipes.filter((r) => Object.keys(RECIPES[r].out)[0].startsWith('k_')), [], 'la forge ne fait pas de kits');
for (const [k, n] of Object.entries({ argile: 10, calcaire: 5, eau: 2, fer: 5, verre: 4 })) gather(k, n);
carryPart('forge'); deliver('forge'); assemble('forge');
carryPart('circuits'); deliver('circuits'); assemble('circuits');
const core = S.parts.assembleur;
at(core.x - CORE.handle - 0.3, core.z); tap();
let g = 0; while (!core.hand.B && g++ < 30 * 40) tick();
assert.equal(core.hand.B, 'R', 'le coéquipier prend la caisse');
g = 0; let side = 0, lx = core.x, lz = core.z, still = 0;
const WPS = [{ x: 20, z: -13 }, { x: 4, z: -13.2 }, PB.assembleur]; let wi = 0;
while (!core.placed && g++ < 30 * 120) {
  if (wi < 2 && Math.hypot(WPS[wi].x - core.x, WPS[wi].z - core.z) < 1.2) wi++;
  const t = WPS[wi], dx = t.x - core.x, dz = t.z - core.z, l = Math.hypot(dx, dz);
  let mx = dx / l, mz = dz / l;
  if (side > 0) { side -= dt; [mx, mz] = [-mz, mx]; }
  A.mx = mx; A.mz = mz; tick();
  const mv = Math.hypot(core.x - lx, core.z - lz); lx = core.x; lz = core.z;
  still = mv < 0.01 ? still + dt : 0;
  if (still > 0.4 && side <= 0) side = 1.2;
}
A.mx = A.mz = 0;
assert.ok(core.placed, 'cœur posé');
gather('fer', 4); gather('verre', 2);
deliver('assembleur'); assemble('assembleur');
gather('fer', 2); gather('eau', 1); gather('verre', 1); gather('calcaire', 1);
atHQ(); cmd({ c: 'take', item: 'fer', n: 2 }); cmd({ c: 'take', item: 'eau', n: 1 });
let f = frontOf('forge'); at(f.x, f.z); assert.match(label(), /Charger/); tap();
assert.match(label(), /Actionner : carcasse/, label());
operate('forge', () => (S.machines.forge.out.carcasse || 0) >= 1);
collect('forge');
atHQ(); cmd({ c: 'take', item: 'verre', n: 1 }); cmd({ c: 'take', item: 'calcaire', n: 1 });
f = frontOf('circuits'); at(f.x, f.z); tap();
operate('circuits', () => (S.machines.circuits.out.circuit || 0) >= 1);
collect('circuits');
atHQ(); cmd({ c: 'take', item: 'carcasse', n: 1 }); cmd({ c: 'take', item: 'circuit', n: 1 });
f = frontOf('assembleur'); at(f.x, f.z); tap();
operate('assembleur', () => S.made >= 1);
waitLevel(2, 2);

// ========== NIVEAU 2 (rodage) ==========
assignAt(S.droids[0], 'forge');
satisfy();
waitLevel(3);

// ========== NIVEAU 3 ==========
buildPlot('etabli'); buildPlot('atelier');
// alternance de 1 : boîte à outils, scanner, boîte à outils, scanner
setRecipes('etabli', ['outils', 'scanner']);
feed('etabli', RECIPES.outils.in, 2); feed('etabli', RECIPES.scanner.in, 2);
const seq = [];
{ const f2 = frontOf('etabli'); at(f2.x, f2.z); down(); for (let i = 0; i < 30 * 60 && seq.length < 4; i++) { const before = { ...S.stats.made }; A.x = f2.x; A.z = f2.z; tick(); for (const k of ['k_outils', 'k_scanner']) if ((S.stats.made[k] || 0) > (before[k] || 0)) seq.push(k); if (S.machines.etabli.broken) { up(); fix('etabli'); at(f2.x, f2.z); down(); } } up(); tick(); }
log('alternance établi :', seq.join(' → '));
assert.deepEqual(seq, ['k_outils', 'k_scanner', 'k_outils', 'k_scanner'], 'alternance 1 + 1');
// s'il manque la matière d'une recette, on passe à la suivante
feed('etabli', RECIPES.scanner.in, 1);
{ const n0 = S.stats.made.k_scanner; make('etabli', 'scanner', 0); setRecipes('etabli', ['outils', 'scanner']); const f2 = frontOf('etabli'); at(f2.x, f2.z); down(); let w = 0; while (S.stats.made.k_scanner === n0 && w++ < 30 * 20) { A.x = f2.x; A.z = f2.z; tick(); } up(); tick(); assert.ok(S.stats.made.k_scanner > n0, 'passe à la recette suivante'); }
collect('etabli');
train('maintenance'); train('logistique');
waitLevel(4);

// ========== NIVEAU 4 ==========
buildPlot('ceramique');
// la logistique n'apporte que des matières premières
S.stock.circuit = 3; S.stock.carcasse = 3;
run(15);
assert.equal(S.machines.assembleur.inp.circuit || 0, 0, 'la logistique ne donne pas les circuits à l’assembleur');
satisfy();
waitLevel(5);

// ========== NIVEAU 5 : le courant ==========
assert.ok(S.power.battery > T.battery - 10, 'batterie de secours');
assert.ok(S.forceHeavyAt, 'panne lourde programmée');
buildPlot('generateur');
assert.equal(S.gen.play < 5, true, 'compteur de surchauffe démarré à la construction');
gather('charbon', 3);
atHQ(); cmd({ c: 'take', item: 'charbon', n: 3 });
f = frontOf('generateur'); at(f.x, f.z); assert.match(label(), /Charger le générateur/, label()); tap();
assert.equal(SIM.genUnits(S.machines.generateur) + S.stats.burned, 3, 'charbon chargé');
run(1);
assert.ok(S.stats.burned >= 1, 'le générateur brûle sa première unité');
const e0 = S.power.energy;
assert.ok(e0 > 340 && e0 <= 360, '1 unité = 6 minutes : ' + e0);
// 5 charbons et 5 bois au maximum
{
  const gen = S.machines.generateur;
  S.players.A.sac = { charbon: 9, bois: 9 };
  f = frontOf('generateur'); at(f.x, f.z); assert.match(label(), /Charger le générateur \(charbon/, label()); tap();
  assert.equal(SIM.genFill(S, gen, 'charbon'), 5, '5 charbons au plus');
  assert.equal(SIM.genFill(S, gen, 'bois'), 5, '5 bois au plus');
  assert.match(label(), /charbon 5\/5 · bois 5\/5/, label());
  deposit();
}
g = 0; while (!Object.values(S.machines).some((m) => m.broken === 'heavy') && g++ < 30 * 90) { if (!Object.values(S.machines).some((m) => m.run)) { feed('forge', { fer: 4, eau: 2 }); } tick(); }
const hv = Object.values(S.machines).find((m) => m.broken === 'heavy');
assert.ok(hv, 'panne lourde arrivée');
run(6); assert.equal(hv.broken, 'heavy', 'pas réparable par l’agent de maintenance');
fix(hv.id);
waitLevel(6);
writeFileSync(new URL('./fixtures/state-l6.json', import.meta.url), JSON.stringify({ at: Date.now(), code: null, st: JSON.parse(JSON.stringify(S)) }));

// ========== NIVEAU 6 (rodage) : agent de recherche ==========
assert.ok(DROIDS.recherche.lvl <= 4 && SIM.recipeAvail(S, 'detect'), 'agent de recherche disponible dès le niveau 5');
satisfy();
const dr = train('recherche');
atHQ(); cmd({ c: 'request', item: 'calcaire' });
assert.equal(S.request.item, 'calcaire');
const c0 = S.stock.calcaire || 0;
run(60);
assert.ok((S.stock.calcaire || 0) > c0 || !S.request, 'l’agent de recherche ramène la matière demandée');
cmd({ c: 'request', item: null });
waitLevel(7);

// ========== NIVEAU 7 : les bâtisseurs ==========
assert.equal(LEVELS[S.level].name, 'Les bâtisseurs');
buildPlot('trefileuse');
satisfy();
buildPlot('recycleur');
assert.deepEqual(SIM.machineRecipes(S, S.machines.recycleur), ['surplus'], 'recycleur au niveau 7 : objets en trop');
train('ingenieur');
waitLevel(8);

// ========== NIVEAU 8 (rodage) : nouvelles recettes de circuit ==========
assert.ok(SIM.machineRecipes(S, S.machines.circuits).includes('circuitF') && SIM.machineRecipes(S, S.machines.circuits).includes('circuitC'), 'recettes de circuit au cuivre et sur céramique');
make('circuits', 'circuitC', 2); collect('circuits');
// premières commandes : emballeuse et quai dès le niveau 8
assert.equal(LEVELS[S.level].name, 'Premières commandes');
add('plastique', 4); add('bois', 4);
buildPlot('emballeuse'); buildPlot('quai');
satisfy();
waitLevel(9);

// ========== NIVEAU 9 : métallurgie ==========
for (const [k, n] of Object.entries(MACHINES.fonderie.cost)) add(k, n + 2);
for (const [k, n] of Object.entries(MACHINES.laminoir.cost)) add(k, n + 2);
// Un seul ingénieur ne monte pas une machine tout seul : avec un deuxième, ils vont chercher les pièces lourdes et montent à deux
train('ingenieur');
assert.equal(S.droids.filter((d) => d.type === 'ingenieur').length, 2, 'deux ingénieurs');
{ const t0 = S.time; g = 0; while (!(S.machines.fonderie && S.machines.laminoir) && g++ < 30 * 400) { fuel(); tick(); } log('deux ingénieurs : fonderie et laminoir en', Math.round(S.time - t0), 's'); }
assert.ok(S.parts.fonderie.placed && S.parts.laminoir.placed, 'pièces lourdes ramenées par les ingénieurs');
assert.ok(S.machines.fonderie && S.machines.laminoir, 'les deux ingénieurs ont construit fonderie et laminoir');
const fr = SIM.machineRecipes(S, S.machines.forge);
assert.deepEqual(fr, ['carcasse', 'carcasseT', 'carcasseL'], 'recettes de carcasse au choix : ' + fr);
make('fonderie', 'lingot', 2); collect('fonderie');
satisfy();
add('fil', 2);
train('chefmaint');
waitLevel(10);
const earned10 = S.stats.earned;

// ========== NIVEAU 10 (rodage) : vestiaire et packs ==========
const cr = S.credits, ea = S.stats.earned;
cmd({ c: 'buy', type: 'maintenance', outfit: 'casquette' });
cmd({ c: 'buy', type: 'maintenance', outfit: 'tablier' });
assert.deepEqual(S.wardrobe.wear.maintenance, { tete: 'casquette', corps: 'tablier' }, 'tenues cumulées');
assert.equal(S.credits, cr - 85 + (S.stats.earned - ea), 'casquette + tablier = 85 crédits');
cmd({ c: 'wear', type: 'maintenance', outfit: 'tablier' });
assert.deepEqual(S.wardrobe.wear.maintenance, { tete: 'casquette' }, 'tablier retiré');
const pp = SIM.packPrice(S, 'maintenance');
assert.ok(pp > 0 && pp < 205, 'pack moins cher si déjà des vêtements : ' + pp);
assert.equal(SIM.packPrice(S, 'logistique'), 205);
S.credits += 300;
cmd({ c: 'pack', type: 'logistique' });
assert.ok(PACK.items.every((o) => S.wardrobe.owned['logistique:' + o]), 'pack l’intégrale acheté');
satisfy();
add('plastique', 1); add('tole', 1);
train('expert');
const asm = S.machines.assembleur; asm.inp = {};
add('carcasse', 2); add('circuit', 2);
g = 0; while (!((asm.inp.carcasse || 0) > 0 && (asm.inp.circuit || 0) > 0) && g++ < 30 * 40) tick();
assert.ok(asm.inp.carcasse > 0 && asm.inp.circuit > 0, 'l’expert approvisionne l’assembleur');
waitLevel(11);

// ========== NIVEAU 11 : deux lignes ==========
buildPlot('forge2'); buildPlot('circuits2');
// --- coin pause : les droïdes sans tâche s'assoient (6 places), les autres restent debout avec un café
{
  for (const m of Object.values(S.machines)) { m.broken = null; }
  let w = 0; while (w++ < 30 * 25) { fuel(); tick(); }
  const hq = S.droids.filter((d) => d.st === 'work' && d.job === 'hq');
  const sit = S.droids.filter((d) => d.pose === 'sit'), cafe = S.droids.filter((d) => d.pose === 'cafe');
  log('coin pause :', sit.length, 'assis,', cafe.length, 'debout, sur', hq.length, 'droïdes au QG');
  assert.ok(sit.length >= 1 && sit.length <= 6, 'droïdes assis au coin pause : ' + sit.length);
  assert.ok(new Set(sit.map((d) => d.seat)).size === sit.length, 'une place par droïde');
  for (const d of sit) assert.ok(Math.hypot(d.x - SIM.pauseSpot(d.seat).x, d.z - SIM.pauseSpot(d.seat).z) < 0.05, 'assis à sa place');
  // une panne : l'agent de maintenance se lève et va réparer
  const mt = S.droids.find((d) => d.type === 'maintenance' && d.pose);
  if (mt) {
    const m = S.machines.forge; m.broken = 'light';
    let k = 0; while (m.broken && k++ < 30 * 40) tick();
    assert.ok(!m.broken, 'la maintenance quitte le canapé et répare');
    log('maintenance : levée du coin pause et panne réparée');
  }
}
// --- pause automatique : 20 pièces à l'entrepôt → la recette s'arrête, elle repart quand le stock baisse
{
  const ci = S.machines.circuits;
  setRecipes('circuits', ['circuit']);
  if (!ci.operator) { const op = S.droids.find((d) => d.type === 'ouvrier' && d.st === 'idle') || newDroid(); assignAt(op, 'circuits'); }
  S.stock.circuit = 40; ci.inp = { verre: 6, calcaire: 6 }; ci.out = {}; ci.t = 0;
  if (S.machines.circuits2) S.machines.circuits2.sel = [];
  const made0 = S.stats.made.circuit || 0;
  run(30);
  assert.equal(S.stats.made.circuit || 0, made0, 'stock plein : la machine ne produit plus');
  assert.match(SIM.waitWhy(S, ci), /Stock plein \(20\)/, 'message stock plein : ' + SIM.waitWhy(S, ci));
  S.stock.circuit = 15;
  g = 0; while ((S.stats.made.circuit || 0) === made0 && g++ < 30 * 80) { fuel(); if (ci.broken) fix('circuits'); tick(); }
  assert.ok((S.stats.made.circuit || 0) > made0, 'le stock baisse : la machine repart');
  // kits : 3 au maximum
  S.stock.k_outils = 3;
  assert.equal(SIM.recipeCapped(S, 'outils'), 3, 'kits : pause à 3');
  S.stock.k_outils = 2;
  assert.equal(SIM.recipeCapped(S, 'outils'), 0, 'kits : repart sous 3');
  log('pause automatique : stock plein à 20 (3 kits), reprise quand il baisse');
}
// --- recyclage des objets en trop : réserve de 10 (3 pour les kits), la moitié des matières premières rendue
{
  const rc = S.machines.recycleur;
  assert.deepEqual(SIM.machineRecipes(S, rc), ['surplus'], 'recycleur : objets en trop (les rebuts viendront avec le contrôle qualité)');
  S.stock.isolant = 16; S.stock.k_outils = 6;
  const f = frontOf('recycleur'); at(f.x, f.z);
  cmd({ c: 'trash', mach: 'recycleur', item: 'isolant', on: true });
  cmd({ c: 'trash', mach: 'recycleur', item: 'k_outils', on: true });
  assert.deepEqual(rc.trash, ['isolant', 'k_outils']); assert.deepEqual(rc.sel, ['surplus'], 'recette ajoutée toute seule');
  assert.equal(SIM.capOf(S, 'isolant'), 10, 'un objet en trop n’est plus fabriqué au-delà de 10');
  if (!rc.operator) { const op = S.droids.find((d) => d.type === 'ouvrier' && d.st === 'idle') || newDroid(); assignAt(op, 'recycleur'); }
  const ar0 = S.stock.argile || 0, fe0 = S.stock.fer || 0, s0 = S.stats.surplus;
  let w = 0; while (((S.stock.isolant || 0) > 10 || (S.stock.k_outils || 0) > 3 || Object.keys(rc.inp).length || Object.keys(rc.out).length) && w++ < 30 * 240) { fuel(); tick(); }
  log('recycleur : isolants', S.stock.isolant, '· boîtes à outils', S.stock.k_outils, '· recyclés', S.stats.surplus - s0, '· argile +', (S.stock.argile || 0) - ar0, '· fer +', (S.stock.fer || 0) - fe0);
  assert.equal(S.stock.isolant, 10, 'réserve de 10 isolants gardée');
  assert.equal(S.stock.k_outils, 3, 'réserve de 3 kits gardée');
  assert.equal(S.stats.surplus - s0, 9, '6 isolants + 3 boîtes à outils recyclés');
  cmd({ c: 'trash', mach: 'recycleur', item: 'isolant', on: false });
  cmd({ c: 'trash', mach: 'recycleur', item: 'k_outils', on: false });
  assert.deepEqual(rc.sel, [], 'plus rien en trop : recette retirée');
}
if (lvl() === 11) satisfy();
waitLevel(12);

// ========== NIVEAU 12 (rodage) ==========
if (lvl() === 12) satisfy();
waitLevel(13);

// ========== NIVEAU 13 : qualité ==========
buildPlot('qualite'); buildPlot('zone');
assert.ok(SIM.qcActive(S), 'contrôle qualité actif');
// des pièces sortent déclassées
const d0 = Object.keys(S.stats.made).filter((k) => k.endsWith('_d')).reduce((a, k) => a + S.stats.made[k], 0);
const declN = () => Object.keys(S.stats.made).filter((k) => k.endsWith('_d')).reduce((a, k) => a + S.stats.made[k], 0);
S.stock.circuit = Math.min(S.stock.circuit || 0, 4);
for (const m of Object.values(S.machines)) delete m.out.circuit;
T.stockCap = 99; // (le test veut des déclassés : pas de pause « stock plein » ici)
for (let k = 0; k < 4 && declN() === d0; k++) { make('circuits', 'circuit', 12); collect('circuits'); }
T.stockCap = 20;
const d1 = declN();
log('déclassées sur 12 circuits :', d1 - d0);
assert.ok(d1 > d0, 'des pièces sortent déclassées');
// zone des déclassés : le menu permet de reprendre exactement ce qu'on veut
const z = S.machines.zone;
// (les déclassés d'autres machines arrivent dans la zone avec les droïdes logistiques)
for (let k = 0; k < 90 && !(Object.keys(z.inp).length > 0 || (S.stats.made.circuit_d || 0) > 0); k++) run(1);
const declIn = (box) => Object.keys(box).some((k) => ITEMS[k].kind === 'decl');
assert.ok(declIn(z.inp) || declIn(S.machines.qualite.inp) || S.stats.controlled > 0 || (S.stats.made.circuit_d || 0) > 0, 'déclassés rangés dans la zone (ou déjà au contrôle)');
z.inp.circuit_d = (z.inp.circuit_d || 0) + 2;
f = frontOf('zone'); at(f.x, f.z); cmd({ c: 'ztake', item: 'circuit_d', n: 2 });
assert.ok((S.players.A.sac.circuit_d || 0) >= 2, 'déclassés pris dans la zone');
f = frontOf('qualite'); at(f.x, f.z); assert.match(label(), /Charger|Actionner|Récupérer/, label()); if (/Charger/.test(label())) tap();
satisfy();
const r13 = Object.keys(S.stats.made).filter((k) => k.endsWith('_r')).reduce((a, k) => a + S.stats.made[k], 0);
log('contrôlées', S.stats.controlled, '· rebuts', r13);
assert.ok(r13 >= 1, 'des rebuts sortent du contrôle');
train('qualite');
const dq = S.droids.find((d) => d.type === 'qualite');
assignAt(dq, 'qualite');
waitLevel(14);
writeFileSync(new URL('./fixtures/state-l14.json', import.meta.url), JSON.stringify({ at: Date.now(), code: null, st: JSON.parse(JSON.stringify(S)) }));

// ========== NIVEAU 14 : le tri et adjoint qualité ==========
assert.ok(SIM.machineRecipes(S, S.machines.recycleur).includes('recyc'), 'rebuts au recycleur');
setRecipes('recycleur', ['recyc']);
add('tole', 2); add('caoutchouc', 2);
train('adjq');
// circuit complet de l'adjoint : déclassés → zone → contrôle → recycleur / entrepôt
const rc0 = S.stats.recycled, ct0 = S.stats.controlled;
S.machines.forge.out.carcasse_d = 3;
g = 0; while ((S.stats.controlled - ct0 < 3 || S.stats.recycled === rc0) && g++ < 30 * 150) { fuel(); tick(); }
log('adjoint qualité : contrôlées', S.stats.controlled - ct0, '· rebuts au recycleur', JSON.stringify(S.machines.recycleur.inp), '· zone', JSON.stringify(S.machines.zone.inp));
assert.ok(S.stats.controlled - ct0 >= 3, 'l’adjoint qualité amène les déclassés au contrôle');
satisfy();
waitLevel(15);

// ========== NIVEAU 15 (rodage) ==========
if (lvl() === 15) satisfy();
waitLevel(16);

// ========== NIVEAU 16 ==========
buildPlot('four');
make('four', 'silicium', 2); collect('four');
assert.ok(SIM.machineRecipes(S, S.machines.circuits).includes('circuitS'), 'circuit au silicium');
satisfy();
const dp = train('production');
assignAt(dp, freeMachine().id);
assert.ok(dp.job2, 'l’agent de production tient deux machines');
train('process');
waitLevel(17);

// ========== NIVEAU 17 (rodage) ==========
if (lvl() === 17) satisfy();
waitLevel(18);

// ========== NIVEAU 18 : expédition ==========
add('plastique', 4);
train('achat');
satisfy();
waitLevel(19);

// ========== NIVEAU 19 (rodage) ==========
if (lvl() === 19) satisfy();
waitLevel(20);

// ========== NIVEAU 20 ==========
add('circuitA', 4); add('plastique', 2); add('fil', 1); add('tole', 2); add('verre', 1);
train('adjoint'); train('chef');
// sauvegarde et reprise
const saved = JSON.parse(JSON.stringify(S));
writeFileSync(new URL('./fixtures/state-late.json', import.meta.url), JSON.stringify({ at: Date.now(), code: null, st: saved }));
const R = SIM.restoreState(JSON.parse(JSON.stringify(saved)));
for (let i = 0; i < 300; i++) SIM.step(R, dt, { A: { x: 0, z: 2, events: [] }, B: { x: 1, z: 2, events: [] } });
assert.equal(R.level, S.level, 'reprise de sauvegarde');
satisfy();
run(1);
assert.ok(S.won, 'PARTIE GAGNÉE (niveau ' + lvl() + ', objectifs restants : ' + LEVELS[S.level].goals.filter((x) => !S.goals[x.id]).map((x) => x.id) + ')');

// ========== surchauffe ==========
S.won = false;
const gen = S.machines.generateur;
gen.inp.charbon = 3;
S.gen.play = T.overheatAt - 0.5;
const oh0 = overheats;
S.clock = 1.8e12;
for (let i = 0; i < 30; i++) { S.clock += 33; const b = botInput(S, bot, dt, A); SIM.step(S, dt, { A, B: b }); for (const fx of SIM.drainFx(S)) if (fx.k === 'overheat') overheats += 1; }
assert.ok(overheats > oh0, 'surchauffe déclenchée après 1 heure');
assert.ok(S.gen.lockUntil - S.clock > 1790e3, 'pause de 30 minutes');
assert.equal(SIM.genUnits(gen), 0, 'générateur vidé');
assert.match(SIM.powerIssue(S), /surchauffe/);
const cr2 = S.credits; S.credits += 100;
SIM.commandsOnly(S, { A: { events: [{ c: 'buy', type: 'chef', outfit: 'casquette' }, 'down'] } });
assert.ok(S.wardrobe.owned['chef:casquette'], 'vestiaire accessible pendant la surchauffe');
S.clock = S.gen.lockUntil + 1;
assert.match(SIM.powerIssue(S) || '', /vide/, 'après la pause : générateur à recharger');

log('PARTIE TERMINÉE · crédits gagnés', S.stats.earned, '· droïdes', S.droids.length, '· machines', Object.keys(S.machines).length, '· surchauffes', overheats);
const types = {}; for (const d of S.droids) types[d.type] = (types[d.type] || 0) + 1;
console.log('équipe :', JSON.stringify(types));
console.log('CRÉDITS gagnés au début de chaque niveau :', JSON.stringify(earnedAt));
console.log('CRÉDITS avant le niveau 10 :', earned10);
console.log('bouton Attraper pendant une fouille :', hijack); console.log('OK');
