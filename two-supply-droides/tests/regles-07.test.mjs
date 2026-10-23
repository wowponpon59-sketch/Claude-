// Règles de la 0.7 : améliorations des machines (installées par un ingénieur, 3 niveaux, visibles),
// commandes urgentes, Colosse à attraper à deux en même temps, camion de livraison à décharger à deux.
// Prérequis : partie-complete.test.mjs (sauvegardes tests/fixtures/*.json).
// Usage : node two-supply-droides/tests/regles-07.test.mjs   → affiche « OK » à la fin.
import * as SIM from '../js/sim.js';
import { createBot, botInput } from '../js/bot.js';
import { readFileSync } from 'node:fs';
import { UPGRADES, TRUCK, ANIMALS } from '../js/config.js';
import { PLOT_BY_ID } from '../js/world.js';
import assert from 'node:assert/strict';

const load = () => { const S = SIM.restoreState(JSON.parse(readFileSync(new URL('./fixtures/state-l14.json', import.meta.url))).st); S.clock = 1.9e12; S.mode = 'duo'; return S; };
const dt = 1 / 30;
const idle = { x: -12, z: 3, events: [] }, far = { x: -30, z: 30, events: [] };
const step = (S, A = idle, B = far) => { S.clock += 33; SIM.step(S, dt, { A, B }); return SIM.drainFx(S); };
const calm = (S) => { for (const m of Object.values(S.machines)) { m.broken = null; m.wear = 9999; } S.truckT = 9999; S.giantLvl = S.level; S.truck = null; S.animals = S.animals.filter((a) => a.sp !== 'colosse' || a.st === 'installed'); };
const label = (S, id = 'A') => (S.players[id].hint || {}).label || '';

// ---------- 1. Améliorations : demandées au menu Recettes, installées par un ingénieur ----------
{
  const S = load(); calm(S);
  if (!S.droids.some((d) => d.type === 'ingenieur' && d.st === 'work')) S.droids.push({ id: 9100, type: 'ingenieur', x: 0, z: 3, rot: 0, st: 'work', who: null, job: 'hq', job2: null, task: null, carry: null, lv: S.level });
  const m = S.machines.ceramique;
  const c0 = SIM.cadence(m, S);
  for (let lvl = 0; lvl < 3; lvl++) {
    for (const [k, n] of Object.entries(UPGRADES[lvl].cost)) S.stock[k] = (S.stock[k] || 0) + n;
    step(S, { ...idle, events: [{ c: 'upgrade', mach: 'ceramique' }] });
    assert.ok(m.upWant, 'amélioration demandée');
    let g = 0; while ((m.up || 0) === lvl && g++ < 30 * 90) step(S);
    assert.equal(m.up, lvl + 1, 'installée par l’ingénieur : niveau ' + (lvl + 1));
  }
  assert.ok(Math.abs(SIM.cadence(m, S) - c0 * 1.2) < 1e-6, 'cadence +20 %');
  step(S, { ...idle, events: [{ c: 'upgrade', mach: 'ceramique' }] });
  assert.ok(!m.upWant, 'pas plus de 3 niveaux');
  // sortie doublée : une recette d'isolants (×2) en donne 4
  m.inp = { argile: 2, eau: 1 }; m.out = {}; m.sel = ['isolant']; m.cur = 'isolant'; m.t = 0;
  S.stock.isolant = 0; for (const x of Object.values(S.machines)) delete x.out.isolant;
  const gen = S.machines.generateur; if (gen) { gen.inp = { charbon: 5 }; gen.broken = null; } S.gen.lockUntil = 0;
  if (!m.operator) { S.droids.push({ id: 9101, type: 'ouvrier', x: 0, z: 0, rot: 0, st: 'work', who: null, job: 'ceramique', job2: null, task: null, carry: null, lv: S.level }); m.operator = 9101; }
  const made0 = S.stats.made.isolant || 0;
  let g = 0; while ((S.stats.made.isolant || 0) === made0 && g++ < 30 * 30) step(S);
  assert.equal((S.stats.made.isolant || 0) - made0, 4, 'sortie doublée');
  console.log('améliorations : 3 niveaux installés, cadence +20 %, sortie doublée');
}

// ---------- 2. Commandes urgentes : 3 minutes, prime double ----------
{
  const S = load(); calm(S);
  let urgent = 0;
  for (let k = 0; k < 80; k++) { S.orders = []; S.orderT = 0; step(S); const o = S.orders[0]; if (o && o.urgent) { urgent++; assert.equal(o.life, 180); } }
  assert.ok(urgent > 5 && urgent < 60, 'commandes urgentes de temps en temps : ' + urgent + '/80');
  console.log('commandes urgentes :', urgent, 'sur 80');
}

// ---------- 3. Le Colosse : une fois par niveau, à encercler et attraper à deux en même temps ----------
{
  const S = load(); calm(S);
  S.giantLvl = -1; S.giantT = 0.01;
  const fx = step(S);
  const g = S.animals.find((a) => a.sp === 'colosse');
  assert.ok(g && ANIMALS.colosse.giant, 'un Colosse apparaît');
  assert.ok(fx.some((f) => f.k === 'giant'), 'flèche vers le Colosse');
  // les deux joueurs l'encerclent (de part et d'autre, tout près)
  const A = { x: g.x - 2.4, z: g.z, events: [] }, B = { x: g.x + 2.4, z: g.z, events: [] };
  g.tired = 5;
  let k = 0; while (g.st !== 'corner' && k++ < 30 * 10) { A.x = g.x - 2.4; A.z = g.z; B.x = g.x + 2.4; B.z = g.z; step(S, A, B); }
  assert.equal(g.st, 'corner', 'Colosse encerclé');
  assert.match(label(S, 'A'), /Attraper le Colosse/, label(S, 'A'));
  // un seul appuie : pas attrapé
  A.events = ['down']; step(S, A, B); A.events = ['up']; step(S, A, B);
  assert.notEqual(g.st, 'caught', 'seul, on ne l’attrape pas');
  B.events = ['down']; step(S, A, B); B.events = ['up']; step(S, A, B);
  assert.equal(g.st, 'caught', 'à deux en même temps : attrapé');
  // installé sur une machine : +100 %
  const m = Object.values(S.machines).find((x) => SIM.isProd(x) && x.animals.length < 2 && !x.broken), c0 = SIM.cadence(m, S);
  const holder = g.by, P = holder === 'A' ? A : B;
  const pf = SIM.front(PLOT_BY_ID[m.id]);
  P.x = pf.x - 0.8; P.z = pf.z; for (let i = 0; i < 30 * 3; i++) step(S, A, B);
  if (/Installer Colosse/.test(label(S, holder))) { P.events = ['down']; step(S, A, B); P.events = ['up']; step(S, A, B); }
  assert.equal(g.st, 'installed', 'Colosse installé : ' + label(S, holder));
  // (la cadence se multiplie par les autres bonus : on compare au total des créatures)
  const k0 = 1 + 0.25 * (m.animals.length - 1);
  assert.ok(Math.abs(SIM.cadence(m, S) / c0 - (k0 + 1) / k0) < 1e-6, '+100 % de cadence : ' + c0.toFixed(2) + ' → ' + SIM.cadence(m, S).toFixed(2));
  console.log('Colosse : encerclé, attrapé à deux, installé (+100 %)');
}

// ---------- 4. Le Colosse avec le coéquipier IA (solo) ----------
{
  const S = load(); calm(S); S.mode = 'solo';
  S.giantLvl = -1; S.giantT = 0.01; step(S);
  const g = S.animals.find((a) => a.sp === 'colosse');
  const bot = createBot();
  const A = { x: g.x - 3, z: g.z, rot: 0, events: [] };
  g.tired = 5;
  let caught = false;
  for (let i = 0; i < 30 * 40 && !caught; i++) {
    const dx = g.x - A.x, dz = g.z - A.z, l = Math.hypot(dx, dz) || 1;
    if (l > 2.2) { A.x += (dx / l) * 4.6 / 30; A.z += (dz / l) * 4.6 / 30; }
    const B = botInput(S, bot, dt, A);
    step(S, A, B);
    A.events = [];
    if (/^Attraper le Colosse/.test(label(S))) A.events = ['down', 'up'];
    caught = g.st === 'caught';
  }
  assert.ok(caught, 'le coéquipier IA attrape le Colosse avec le joueur');
  console.log('Colosse en solo : attrapé avec le coéquipier IA');
}

// ---------- 5. Camion de livraison : déchargé à deux ----------
{
  const S = load(); calm(S);
  S.truckT = 0.01; step(S);
  const tr = S.truck;
  assert.ok(tr, 'un camion arrive');
  const stock0 = Object.values(S.stock).reduce((a, b) => a + b, 0);
  const L = SIM.truckPost(tr, 'L'), R = SIM.truckPost(tr, 'R');
  const A = { x: L.x, z: L.z, events: ['down'], held: true }, B = { x: R.x, z: R.z, events: [], held: false };
  step(S, A, B); A.events = [];
  assert.ok(S.players.A.wait, 'seul : il faut être deux');
  for (let i = 0; i < 30 * 2; i++) step(S, A, B);
  assert.ok(S.truck && Object.values(S.truck.items).reduce((a, b) => a + b, 0) === TRUCK.n, 'seul, rien ne se décharge');
  B.events = ['down']; B.held = true; step(S, A, B); B.events = [];
  let g = 0; while (S.truck && g++ < 30 * 15) step(S, A, B);
  assert.ok(!S.truck, 'camion déchargé et reparti');
  const stock1 = Object.values(S.stock).reduce((a, b) => a + b, 0);
  // (les agents logistiques puisent dans l'entrepôt en même temps : on vérifie surtout que le camion s'est vidé)
  assert.ok(stock1 - stock0 >= TRUCK.n / 2, 'matières à l’entrepôt : +' + (stock1 - stock0));
  console.log('camion : déchargé à deux,', stock1 - stock0, 'matières');
}
// ---------- 6. Camion en solo : le coéquipier IA réceptionne pendant que le joueur décharge ----------
{
  const S = load(); calm(S); S.mode = 'solo';
  S.truckT = 0.01; step(S);
  const tr = S.truck, L = SIM.truckPost(tr, 'L');
  const bot = createBot();
  const A = { x: L.x, z: L.z, rot: 0, events: [], held: false };
  let g = 0;
  while (S.truck && g++ < 30 * 40) {
    const B = botInput(S, bot, dt, A);
    if (g === 20) { A.events = ['down']; A.held = true; } else A.events = [];
    step(S, A, B);
  }
  assert.ok(!S.truck, 'camion déchargé avec le coéquipier IA');
  console.log('camion en solo : déchargé avec le coéquipier IA');
}
console.log('OK');
