// Règles de la 0.5 : déplacer les machines (Aménager), pièces lourdes à deux (joueurs, ingénieurs), tenues des joueurs.
// Prérequis : partie-complete.test.mjs (sauvegardes tests/fixtures/*.json).
// Usage : node two-supply-droides/tests/regles-05.test.mjs   → affiche « OK » à la fin.
import * as SIM from '../js/sim.js';
import { readFileSync } from 'node:fs';
import { PLOTS, MACHINES, PART, ME_OUTFITS, SLAB } from '../js/config.js';
import { PLOT_BY_ID, placeWhy } from '../js/world.js';
import { obstacles } from '../js/move.js';
import assert from 'node:assert/strict';

const raw = (f) => JSON.parse(readFileSync(new URL('./fixtures/' + f, import.meta.url))).st;
const load = (f) => { const S = SIM.restoreState(raw(f)); S.clock = 1.9e12; return S; };
const dt = 1 / 30;
const far = { x: -30, z: 30, events: [] };
const step = (S, A, B = far) => { S.clock += 33; SIM.step(S, dt, { A, B }); SIM.drainFx(S); };
const run = (S, sec, A = { x: -12, z: 3, events: [] }, B = far) => { for (let i = 0; i < sec * 30; i++) { const gen = S.machines.generateur; if (gen && !gen.inp.charbon && S.power.energy < 1) gen.inp.charbon = 5; if (gen) gen.broken = null; step(S, A, B); } };
const label = (S, id = 'A') => (S.players[id].hint || {}).label || '';
const frontOf = (p) => ({ x: p.x, z: p.z + MACHINES[p.type].d / 2 + 0.6 });

// ---------- 1. Aménager : déplacer une machine, elle garde son contenu ----------
{
  const S = load('state-l14.json');
  const m = S.machines.ceramique, p = PLOT_BY_ID.ceramique;
  m.inp = { argile: 3, eau: 1 }; m.out = { isolant: 2 };
  const x0 = p.x, z0 = p.z;
  // sur l'entrepôt : refusé
  const A = { x: 0, z: 4, events: [{ c: 'move', mach: 'ceramique', x: 0, z: -1.5 }] };
  step(S, A);
  assert.equal(p.x, x0, 'refusé sur l’entrepôt');
  assert.ok(placeWhy(S, 'ceramique', 0, -1.5), 'placeWhy donne une raison');
  // première place libre sur la dalle
  let spot = null;
  for (let z = SLAB.z0 + 3; z < SLAB.z1 - 2 && !spot; z += 0.5) for (let x = SLAB.x0 + 3; x < SLAB.x1 - 3 && !spot; x += 0.5) if (Math.hypot(x - x0, z - z0) > 4 && !placeWhy(S, 'ceramique', x, z)) spot = { x, z };
  assert.ok(spot, 'une place libre existe');
  A.events = [{ c: 'move', mach: 'ceramique', x: spot.x, z: spot.z }];
  step(S, A);
  assert.deepEqual([p.x, p.z], [spot.x, spot.z], 'machine déplacée');
  assert.deepEqual(S.layout.ceramique, spot, 'aménagement gardé dans la partie');
  assert.equal(m.inp.argile, 3); assert.equal(m.out.isolant, 2);
  assert.ok(obstacles(S).some((o) => !o.c && o.x === spot.x && o.z === spot.z), 'l’obstacle suit la machine');
  // l'opérateur va à la nouvelle place
  const op = S.droids.find((d) => d.job === 'ceramique' && d.st !== 'idle');
  if (op) { run(S, 20); const f = SIM.front(p); assert.ok(Math.hypot(op.x - f.x, op.z - f.z) < 0.6, 'l’opérateur rejoint la machine déplacée'); }
  // sauvegarde et reprise : la machine reste à sa nouvelle place
  const R = SIM.restoreState(JSON.parse(JSON.stringify(S)));
  assert.deepEqual([PLOT_BY_ID.ceramique.x, PLOT_BY_ID.ceramique.z], [spot.x, spot.z], 'aménagement repris de la sauvegarde');
  SIM.restoreState(raw('state-l14.json'));
  assert.deepEqual([PLOT_BY_ID.ceramique.x, PLOT_BY_ID.ceramique.z], [x0, z0], 'une autre partie garde ses places d’origine');
  console.log('aménager : déplacée de', x0, z0, 'à', spot.x, spot.z);
}

// ---------- 2. Pièces lourdes et ingénieurs ----------
const setup = (mode, nEng) => {
  const S = load('state-l14.json');
  S.mode = mode;
  S.level = 17; S.goals = {};
  for (const d of S.droids) if (d.type === 'ingenieur') { d.type = 'logistique'; }
  const free = S.droids.filter((d) => d.type === 'ouvrier' && d.st === 'idle');
  for (let k = 0; k < nEng; k++) { const d = free[k] || S.droids.find((x) => x.type === 'ouvrier'); d.type = 'ingenieur'; d.st = 'work'; d.job = 'hq'; d.task = null; }
  // matériaux du four à l'entrepôt
  for (const [k, n] of Object.entries(MACHINES.four.cost)) S.stock[k] = (S.stock[k] || 0) + n + 2;
  return S;
};
{
  // a. un seul ingénieur : il livre et tient la pièce, mais ne monte pas seul ; il faut un joueur pour visser
  const S = setup('solo', 1);
  const c = S.parts.four, st = S.plots.four;
  assert.ok(!c.placed && SIM.partOut(S, 'four'), 'pièce lourde dans le terrain vague');
  SIM.debugPlacePart(S, 'four');
  // il livre, puis tient la pièce et appelle les joueurs (au bout de 45 s sans personne, il retourne à ses autres tâches)
  let g = 0; while (!String(st.holder).startsWith('E') && g++ < 30 * 60) run(S, 1 / 30 * 30);
  run(S, 5);
  assert.ok(st.ready && !st.built, 'un ingénieur seul ne monte pas la machine');
  assert.ok(String(st.holder).startsWith('E'), 'l’ingénieur tient la pièce à gauche : ' + st.holder);
  const pr = SIM.postR(PLOT_BY_ID.four);
  const A = { x: pr.x, z: pr.z, events: [] };
  for (let k = 0; k < 40 && !st.built; k++) { A.events = ['down']; step(S, A); A.events = ['up']; step(S, A); }
  assert.ok(st.built, 'un joueur visse pendant que l’ingénieur tient : machine montée');
  console.log('un ingénieur + un joueur : four à verre monté');
}
{
  // b. deux ingénieurs : ils vont chercher la pièce lourde, livrent et montent seuls
  const S = setup('solo', 2);
  const c = S.parts.four, t0 = S.time;
  let g = 0; while (!S.plots.four.built && g++ < 30 * 400) run(S, 1 / 30 * 30);
  assert.ok(c.placed, 'pièce ramenée par les deux ingénieurs');
  assert.ok(S.plots.four.built, 'machine montée par les deux ingénieurs');
  console.log('deux ingénieurs : pièce ramenée et four à verre monté en', Math.round(S.time - t0), 's');
}
{
  // c. à deux téléphones : un joueur tient seul une pièce, le partenaire est loin → un ingénieur vient prendre l'autre poignée
  const S = setup('duo', 1);
  const c = S.parts.four;
  const A = { x: c.x - PART.handle - 0.2, z: c.z, events: [], mx: 0, mz: 0 };
  step(S, A);
  assert.match(label(S), /^Saisir/, label(S));
  A.events = ['down']; step(S, A); A.events = [];
  assert.equal(c.hand.A, 'L');
  let g = 0; while (c.hand.E !== 'R' && g++ < 30 * 120) step(S, A);
  assert.equal(c.hand.E, 'R', 'un ingénieur aide à porter');
  const x0 = c.x;
  for (let i = 0; i < 30 * 2; i++) { A.mx = 1; A.mz = 0; step(S, A); }
  assert.ok(c.x > x0 + 1, 'le joueur dirige, l’ingénieur porte avec lui : ' + (c.x - x0).toFixed(2));
  console.log('à deux téléphones : un ingénieur aide le joueur seul');
}
{
  // d. le partenaire prend une poignée, les deux joueurs portent ; pièce posée sur son chantier
  const S = setup('duo', 0);
  const c = S.parts.four, target = PLOT_BY_ID.four;
  c.x = target.x; c.z = target.z - 2.9; // tout près, dans l'allée devant le chantier (pour le test)
  const A = { x: c.x - PART.handle - 0.2, z: c.z, events: ['down'], mx: 0, mz: 0 }, B = { x: c.x + PART.handle + 0.2, z: c.z, events: ['down'], mx: 0, mz: 0 };
  step(S, A, B); A.events = []; B.events = [];
  assert.ok(c.hand.A && c.hand.B, 'les deux joueurs tiennent la pièce');
  let g = 0; while (!c.placed && g++ < 30 * 20) { A.mz = B.mz = 1; step(S, A, B); }
  assert.ok(c.placed, 'pièce posée sur son chantier');
  console.log('deux joueurs : pièce posée');
}

// ---------- 3. Tenues des joueurs ----------
{
  const S = load('state-l14.json');
  S.credits = 300;
  const A = { x: 0, z: 4, events: [{ c: 'mebuy', outfit: 'casquette' }, { c: 'mebuy', outfit: 'cape' }] };
  step(S, A);
  const me = S.wardrobe.me.A;
  assert.equal(S.credits, 300 - ME_OUTFITS.casquette.price - ME_OUTFITS.cape.price, 'payé avec les crédits communs');
  assert.deepEqual(me.wear, { tete: 'casquette', dos: 'cape' }, 'tenues portées');
  A.events = [{ c: 'mecol', outfit: 'cape', n: 5 }, { c: 'mewear', outfit: 'casquette' }]; step(S, A);
  assert.equal(me.col.cape, 5, 'couleur choisie');
  assert.deepEqual(me.wear, { dos: 'cape' }, 'casquette enlevée');
  assert.deepEqual(S.wardrobe.me.B.wear, {}, 'le partenaire a ses propres tenues');
  A.events = [{ c: 'mewear', outfit: 'gilet' }]; step(S, A);
  assert.ok(!me.wear.corps, 'pas de tenue sans l’avoir achetée');
  console.log('tenues des joueurs : OK');
}
console.log('OK');
