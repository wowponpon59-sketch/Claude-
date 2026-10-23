// Règles de la 0.7.1 : livrer un chantier et former un droïde seulement avec ce qu'on a dans le sac,
// conditionneur (droïde + carton → colis), emballeuse limitée aux cartons, débris répartis tout autour de l'usine.
// Prérequis : partie-complete.test.mjs (sauvegardes tests/fixtures/*.json).
// Usage : node two-supply-droides/tests/regles-071.test.mjs   → affiche « OK » à la fin.
import * as SIM from '../js/sim.js';
import { readFileSync } from 'node:fs';
import { MACHINES, SLAB } from '../js/config.js';
import { PLOT_BY_ID, NODES, genWorld } from '../js/world.js';
import assert from 'node:assert/strict';

const raw = () => JSON.parse(readFileSync(new URL('./fixtures/state-l14.json', import.meta.url))).st;
const load = () => { const S = SIM.restoreState(raw()); S.clock = 1.9e12; S.mode = 'solo'; for (const m of Object.values(S.machines)) { m.broken = null; m.wear = 9999; } S.truckT = 9999; S.giantLvl = S.level; return S; };
const dt = 1 / 30;
const step = (S, A) => { S.clock += 33; SIM.step(S, dt, { A, B: { x: -30, z: 30, events: [] } }); SIM.drainFx(S); };
const label = (S) => (S.players.A.hint || {}).label || '';
const frontOf = (id) => { const p = PLOT_BY_ID[id]; return { x: p.x, z: p.z + MACHINES[p.type].d / 2 + 0.6 }; };
const press = (S, A) => { A.events = ['down']; step(S, A); A.events = ['up']; step(S, A); A.events = []; };

// ---------- 1. Livrer un chantier : seulement ce qui est dans le sac ----------
{
  const S = load();
  S.level = 15; S.goals = {};
  SIM.debugPlacePart(S, 'four');
  for (const [k, n] of Object.entries(MACHINES.four.cost)) S.stock[k] = n + 5;
  S.players.A.sac = {};
  const f = frontOf('four'), A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  assert.match(label(S), /Il manque .*prends-les à l’entrepôt/, 'sac vide : on ne livre pas depuis l’entrepôt · ' + label(S));
  press(S, A);
  assert.deepEqual(S.plots.four.del, {}, 'rien de livré');
  S.players.A.sac = { argile: 2 };
  step(S, A);
  assert.match(label(S), /Apporter/, label(S));
  const st0 = S.stock.argile;
  press(S, A);
  assert.equal(S.plots.four.del.argile, 2, 'livré depuis le sac');
  assert.equal(S.stock.argile, st0, 'l’entrepôt n’a pas bougé');
  assert.ok(!S.players.A.sac.argile, 'sac vidé');
  console.log('livraison depuis le sac : OK');
}

// ---------- 2. Former un droïde : le kit doit être dans le sac ----------
{
  const S = load();
  const d = { id: 9300, type: 'ouvrier', x: 3, z: -7, rot: 0, st: 'follow', who: 'A', job: null, job2: null, task: null, carry: null, lv: S.level };
  S.droids.push(d);
  for (const x of S.droids) if (x.type === 'recherche' && x !== d) x.type = 'ouvrier';
  S.stock.k_detect = 2; S.players.A.sac = {};
  S.machines.atelier.busy = null;
  const f = frontOf('atelier'), A = { x: f.x, z: f.z, events: [{ c: 'spec', type: 'recherche' }] };
  step(S, A);
  assert.equal(d.st, 'follow', 'kit resté à l’entrepôt : pas de formation');
  S.players.A.sac = { k_detect: 1 };
  A.events = [{ c: 'spec', type: 'recherche' }]; step(S, A);
  assert.equal(d.st, 'spec', 'kit dans le sac : formation');
  assert.equal(S.stock.k_detect, 2, 'kit pris dans le sac, pas à l’entrepôt');
  console.log('kit depuis le sac : OK');
}

// ---------- 3. Conditionneur : droïde + carton → colis ; l'emballeuse ne fait que les cartons ----------
{
  const S = load();
  assert.deepEqual(MACHINES.emballeuse.recipes, ['carton'], 'emballeuse : cartons');
  assert.deepEqual(MACHINES.conditionneur.recipes, ['colis'], 'conditionneur : mise en carton');
  const c = S.machines.conditionneur;
  assert.ok(c, 'conditionneur construit au niveau 8');
  c.inp = { carton: 1 }; c.out = {}; c.operator = 1;
  const d = { id: 9301, type: 'ouvrier', x: 3, z: -7, rot: 0, st: 'follow', who: 'A', job: null, job2: null, task: null, carry: null, lv: S.level };
  S.droids.push(d);
  const f = frontOf('conditionneur'), A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  assert.match(label(S), /Emballer : droïde standard/, label(S));
  press(S, A);
  assert.equal(c.out.colis_ouvrier, 1, 'colis au conditionneur');
  // à l'emballeuse, un droïde ne se met pas en carton
  const e = frontOf('emballeuse'); const d2 = { ...d, id: 9302 }; S.droids.push(d2); S.machines.emballeuse.inp.carton = 1;
  A.x = e.x; A.z = e.z; step(S, A);
  assert.doesNotMatch(label(S), /Emballer/, 'pas de mise en carton à l’emballeuse · ' + label(S));
  console.log('conditionneur : OK');
}

// ---------- 4. Ancienne sauvegarde (0.7) : le chantier du conditionneur apparaît ----------
{
  const st = raw();
  delete st.plots.conditionneur; delete st.parts.conditionneur; delete st.machines.conditionneur;
  const S = SIM.restoreState(st);
  assert.ok(S.plots.conditionneur && !S.plots.conditionneur.built, 'chantier du conditionneur');
  assert.ok(S.parts.conditionneur && !S.parts.conditionneur.placed, 'sa pièce lourde dans le terrain vague');
  console.log('ancienne sauvegarde : OK');
}

// ---------- 5. Carte : les débris proches de l'usine sont répartis tout autour (pas seulement aux coins) ----------
{
  const zone = (n) => {
    const cx = Math.max(SLAB.x0, Math.min(SLAB.x1, n.x)), cz = Math.max(SLAB.z0, Math.min(SLAB.z1, n.z));
    const corner = (cx === SLAB.x0 || cx === SLAB.x1) && (cz === SLAB.z0 || cz === SLAB.z1);
    return corner ? 'coin' : 'bord';
  };
  let bord = 0, coin = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    genWorld(seed);
    for (const n of NODES.slice(0, 11)) (zone(n) === 'coin' ? coin++ : bord++);
    seen.add(NODES.slice(0, 11).map((n) => n.type + Math.round(n.x) + Math.round(n.z)).join());
  }
  assert.equal(seen.size, 40, 'une carte différente à chaque partie');
  assert.ok(bord > coin, `débris proches surtout le long des bords (${bord} au bord, ${coin} aux coins)`);
  console.log('carte : débris proches', bord, 'le long des bords,', coin, 'aux coins');
}
console.log('OK');
