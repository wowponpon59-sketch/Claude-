// Règles de la 0.6 : commandes de directeur (standards et spéciales), emballage (droïde + carton → colis), livraison au quai,
// 3 droïdes au plus par métier, durée de vie (obsolètes au bout de 3 niveaux, recyclés en pièces), anciennes sauvegardes.
// Prérequis : partie-complete.test.mjs (sauvegardes tests/fixtures/*.json).
// Usage : node two-supply-droides/tests/regles-06.test.mjs   → affiche « OK » à la fin.
import * as SIM from '../js/sim.js';
import { readFileSync } from 'node:fs';
import { MACHINES, MAX_PER_TYPE, T, DROIDS } from '../js/config.js';
import { PLOT_BY_ID } from '../js/world.js';
import assert from 'node:assert/strict';

const raw = () => JSON.parse(readFileSync(new URL('./fixtures/state-l14.json', import.meta.url))).st;
const load = () => { const S = SIM.restoreState(raw()); S.clock = 1.9e12; S.mode = 'solo'; return S; };
const dt = 1 / 30;
const far = { x: -30, z: 30, events: [] };
const step = (S, A, B = far) => { S.clock += 33; SIM.step(S, dt, { A, B }); SIM.drainFx(S); };
const label = (S) => (S.players.A.hint || {}).label || '';
const frontOf = (id) => { const p = PLOT_BY_ID[id]; return { x: p.x, z: p.z + MACHINES[p.type].d / 2 + 0.6 }; };
const press = (S, A) => { A.events = ['down']; step(S, A); A.events = ['up']; step(S, A); A.events = []; };
const calm = (S) => { for (const m of Object.values(S.machines)) { m.broken = null; m.wear = 9999; } };

// ---------- 1. Commandes : standards au début, spéciales à partir du niveau 10 ----------
{
  const S = load();
  assert.ok(S.machines.quai && S.machines.conditionneur, 'quai et conditionneur construits (niveau 8)');
  let special = 0, total = 0;
  for (let k = 0; k < 60; k++) { S.orders = []; S.orderT = 0; step(S, { x: -12, z: 3, events: [] }); const o = S.orders[0]; if (!o) continue; total++; if (o.special) { special++; assert.ok(Object.keys(o.want).some((t) => t !== 'ouvrier'), 'spéciale : un métier'); } }
  assert.ok(total >= 55 && special > 5 && special < total, `commandes spéciales de temps en temps (${special}/${total})`);
  console.log('commandes :', special, 'spéciales sur', total);
}

// ---------- 2. Emballer à la main un droïde qui suit, livrer au quai ----------
{
  const S = load(); calm(S);
  const emb = S.machines.conditionneur;
  emb.inp = { carton: 2 }; emb.out = {}; emb.operator = null;
  S.orders = [{ id: 999, want: { ouvrier: 1 }, left: { ouvrier: 1 }, special: false, t: 300, life: 300, reward: 38 }]; S.orderT = 999;
  const d = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || S.droids.find((x) => x.type === 'ouvrier');
  SIM.restoreState(S); // (rien ne doit changer)
  d.st = 'follow'; d.who = 'A'; d.job = null;
  emb.operator = S.droids.find((x) => x !== d && x.type === 'ouvrier').id; // un opérateur : le joueur peut emballer un droïde standard
  const n0 = S.droids.length, f = frontOf('conditionneur'), A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  assert.match(label(S), /Emballer : droïde standard/, label(S));
  press(S, A);
  assert.equal(S.droids.length, n0 - 1, 'le droïde est dans le carton');
  assert.equal(emb.out.colis_ouvrier, 1, 'un colis sort du conditionneur');
  assert.equal(emb.inp.carton, 1, 'un carton utilisé');
  step(S, A); press(S, A); // récupérer
  assert.equal(S.players.A.sac.colis_ouvrier, 1, 'colis dans le sac');
  const q = frontOf('quai'); A.x = q.x; A.z = q.z; step(S, A);
  assert.match(label(S), /Livrer 1 colis/, label(S));
  const o0 = S.stats.orders, c0 = S.credits;
  press(S, A);
  assert.equal(S.stats.orders, o0 + 1, 'commande satisfaite');
  assert.ok(S.credits >= c0 + 38, 'récompense');
  console.log('emballage à la main et livraison : OK');
}

// ---------- 3. Recette « Emballer un droïde standard » : un droïde libre entre dans la machine ----------
{
  const S = load(); calm(S);
  const emb = S.machines.conditionneur;
  emb.inp = { carton: 3 }; emb.out = {}; emb.sel = ['colis']; emb.cur = 'colis';
  // deux droïdes standards : un opérateur et un libre (près de l'assembleur)
  const mk = (id, st) => ({ id, type: 'ouvrier', x: 3, z: -7, rot: 0, st, who: null, job: st === 'work' ? 'conditionneur' : null, job2: null, task: null, carry: null, lv: S.level });
  for (const x of S.droids) if (x.job === 'conditionneur') x.job = null;
  S.droids.push(mk(9998, 'work'), mk(9999, 'idle'));
  emb.operator = 9998;
  for (const m of Object.values(S.machines)) if (m.type === 'assembleur') m.sel = []; // pas de nouveau droïde pendant le test
  const n0 = S.droids.length;
  let g = 0; while (!emb.out.colis_ouvrier && g++ < 30 * 30) step(S, { x: -12, z: 3, events: [] });
  assert.equal(emb.out.colis_ouvrier, 1, 'la recette emballe un droïde standard');
  assert.equal(S.droids.length, n0 - 1, 'un droïde standard libre est entré dans le conditionneur');
  console.log('recette d’emballage : OK');
}

// ---------- 4. Commande spéciale : « Faire venir » le droïde demandé ----------
{
  const S = load(); calm(S);
  const emb = S.machines.conditionneur;
  emb.inp = { carton: 1 }; emb.out = {};
  const t = 'logistique';
  S.orders = [{ id: 998, want: { [t]: 1 }, left: { [t]: 1 }, special: true, t: 300, life: 300, reward: 65 }]; S.orderT = 999;
  const f = frontOf('conditionneur'), A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  assert.match(label(S), /Faire venir : agent logistique/, label(S));
  press(S, A);
  let g = 0; while (!emb.out['colis_' + t] && g++ < 30 * 60) step(S, { x: -12, z: 3, events: [] });
  assert.equal(emb.out['colis_' + t], 1, 'l’agent logistique est venu se faire emballer');
  // l'agent logistique expert (ou le joueur) le livre ; ici on le donne au joueur
  emb.out = {}; S.players.A.sac = { ['colis_' + t]: 1 };
  const q = frontOf('quai'); A.x = q.x; A.z = q.z; step(S, A);
  const s0 = S.stats.special;
  press(S, A);
  assert.equal(S.stats.special, s0 + 1, 'commande spéciale satisfaite');
  console.log('commande spéciale : OK');
}

// ---------- 5. Trois droïdes au plus par métier ----------
{
  const S = load(); calm(S);
  const t = 'maintenance';
  let id = 9000;
  const mk = (type, st) => { const d = { id: id++, type, x: 3, z: -7, rot: 0, st, who: null, job: st === 'work' ? 'hq' : null, job2: null, task: null, carry: null, lv: S.level }; S.droids.push(d); return d; };
  while (SIM.typeCount(S, t) < MAX_PER_TYPE) mk(t, 'work');
  const d = mk('ouvrier', 'follow'); d.who = 'A';
  S.stock.k_outils = 2;
  const f = frontOf('atelier'), A = { x: f.x, z: f.z, events: [{ c: 'spec', type: t }] };
  step(S, A);
  assert.equal(d.type, 'ouvrier', 'pas de 4e agent de maintenance');
  assert.equal(S.stock.k_outils, 2, 'kit pas consommé');
  console.log('limite de', MAX_PER_TYPE, 'par métier : OK');
}

// ---------- 6. Durée de vie : obsolète au bout de 3 niveaux, recyclé en pièces ----------
{
  const S = load(); calm(S);
  const d = S.droids.find((x) => x.type === 'logistique');
  d.lv = S.level - T.life;
  step(S, { x: -12, z: 3, events: [] });
  assert.ok(d.old, 'obsolète au bout de ' + T.life + ' niveaux');
  // machine avec un opérateur obsolète : moins vite
  const op = S.droids.find((x) => x.st === 'work' && S.machines[x.job] && MACHINES[S.machines[x.job].type].recipes.length);
  op.old = false;
  const m = S.machines[op.job], c1 = SIM.cadence(m, S);
  op.old = true;
  assert.ok(SIM.cadence(m, S) < c1 * 0.7, 'opérateur obsolète : cadence réduite');
  // au recycleur : il rend une carcasse et un circuit
  const rc = S.machines.recycleur; rc.out = {};
  d.st = 'follow'; d.who = 'A'; d.task = null;
  const f = frontOf('recycleur'), A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  assert.match(label(S), /Recycler : agent logistique obsolète/, label(S));
  const n0 = S.droids.length;
  press(S, A);
  assert.equal(S.droids.length, n0 - 1, 'droïde recyclé');
  assert.deepEqual([rc.out.carcasse, rc.out.circuit], [1, 1], 'une carcasse et un circuit récupérés');
  console.log('durée de vie et recyclage : OK');
}

// ---------- 7. Anciennes sauvegardes (0.5) : caisses et colis deviennent des colis de droïdes standards ----------
{
  const st = raw();
  st.stock.caisse = 2; st.stock.colis = 1; delete st.stats.special;
  st.orders = [{ id: 1, qty: 2, left: 2, t: 100, life: 300, reward: 60 }];
  for (const d of st.droids) delete d.lv;
  const S = SIM.restoreState(st);
  assert.equal(S.stock.colis_ouvrier, 3, 'caisses et colis convertis');
  assert.ok(!S.stock.caisse && !S.stock.colis);
  assert.deepEqual(S.orders, [], 'anciennes commandes oubliées');
  assert.ok(S.droids.every((d) => d.lv === S.level), 'âge des droïdes initialisé');
  console.log('anciennes sauvegardes : OK');
}
console.log('OK');
