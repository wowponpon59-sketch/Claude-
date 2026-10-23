// Règles de la 0.4.3 : pannes même quand le stock est plein, zone des déclassés (déclassés et rebuts à part),
// adjoint qualité mis au travail à la zone, coéquipier IA au canapé (et qui vient quand on l'appelle), générateur 5 + 5.
// Prérequis : partie-complete.test.mjs (sauvegardes tests/fixtures/*.json).
// Usage : node two-supply-droides/tests/regles-043.test.mjs   → affiche « OK » à la fin.
import * as SIM from '../js/sim.js';
import { createBot, botInput } from '../js/bot.js';
import { readFileSync } from 'node:fs';
import { PLOTS, MACHINES, LEVELS, ENTREPOT, T } from '../js/config.js';
import assert from 'node:assert/strict';

const load = (f) => { const S = SIM.restoreState(JSON.parse(readFileSync(new URL('./fixtures/' + f, import.meta.url))).st); S.clock = 1.9e12; return S; };
const PB = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
const frontOf = (id) => { const p = PB[id]; return { x: p.x, z: p.z + MACHINES[p.type].d / 2 + 0.6 }; };
const dt = 1 / 30;
const step = (S, A, B) => { S.clock += 33; SIM.step(S, dt, { A, B: B || { x: 30, z: 30, events: [] } }); SIM.drainFx(S); };
const label = (S) => (S.players.A.hint || {}).label || '';

// ---------- 1. Niveau 8 à deux : stock plein, les machines s'arrêtent… mais les pannes arrivent quand même ----------
{
  const S = load('state-l6.json');
  S.level = 7; S.goals = {}; S.lv0 = null; S.lv0 = JSON.parse(JSON.stringify({ made: S.made, earned: S.stats.earned, repairs: S.stats.repairs, ctrl: 0, recyc: 0, surplus: 0, orders: 0, spec: 0, items: { ...S.stats.made } }));
  for (const k of ['carcasse', 'circuit', 'isolant', 'k_outils', 'k_scanner', 'k_detect']) S.stock[k] = 40;
  for (const m of Object.values(S.machines)) { m.broken = null; m.wear = 60; }
  const r0 = S.stats.repairs;
  let broke = 0;
  const A = { x: 0, z: 3, events: [] };
  for (let i = 0; i < 30 * 300; i++) {
    const gen = S.machines.generateur; if (gen && !gen.inp.charbon && S.power.energy < 1) gen.inp.charbon = 5;
    const before = Object.values(S.machines).filter((m) => m.broken).length;
    step(S, A, { x: 1, z: 3, events: [] });
    broke += Math.max(0, Object.values(S.machines).filter((m) => m.broken).length - before);
  }
  const run = Object.values(S.machines).filter((m) => m.run).length;
  console.log('niveau 8, stock plein : machines en marche', run, '· pannes en 5 min', broke, '· réparées', S.stats.repairs - r0);
  assert.ok(broke >= 3, 'au moins 3 pannes en 5 minutes même à l’arrêt : ' + broke);
  // (les pannes lourdes attendent les joueurs : on ne compte ici que les pannes qui arrivent)
}

// ---------- 2. Zone des déclassés : déclassés et rebuts à part, avant même l'adjoint qualité ----------
{
  const S = load('state-l14.json');
  assert.ok(!S.droids.some((d) => d.type === 'adjq'), 'pas encore d’adjoint qualité');
  const z = S.machines.zone;
  const z0 = { ...z.inp };
  S.players.A.sac = { circuit_d: 2, carcasse_r: 1, fer: 3 };
  const A = { x: ENTREPOT.x, z: ENTREPOT.z + ENTREPOT.d / 2 + 0.6, events: [] };
  step(S, A);
  assert.match(label(S), /Tout déposer \(3\)/, 'entrepôt : seulement les bonnes pièces · ' + label(S));
  A.events = ['down']; step(S, A); A.events = ['up']; step(S, A);
  assert.deepEqual(S.players.A.sac, { circuit_d: 2, carcasse_r: 1 }, 'déclassés et rebuts restent dans le sac');
  A.events = [{ c: 'put', item: 'carcasse_r', n: 1 }]; step(S, A);
  assert.ok(!(S.stock.carcasse_r > 0), 'l’entrepôt refuse les rebuts');
  const f = frontOf('zone'); A.x = f.x; A.z = f.z; A.events = []; step(S, A);
  assert.match(label(S), /Déposer à la zone des déclassés \(3\)/, label(S));
  A.events = ['down']; step(S, A); A.events = ['up']; step(S, A);
  assert.equal(z.inp.circuit_d, (z0.circuit_d || 0) + 2, 'déclassés déposés à la zone');
  assert.equal(z.inp.carcasse_r, (z0.carcasse_r || 0) + 1, 'rebut déposé à la zone');
  // les rebuts du poste qualité partent à la zone (avec l'agent logistique), pas à l'entrepôt
  if (S.droids.some((d) => d.type === 'logistique' && d.st === 'work')) {
    S.machines.qualite.out = { circuit_r: 2 };
    const r0 = z.inp.circuit_r || 0;
    for (let i = 0; i < 30 * 60 && (S.machines.qualite.out.circuit_r || 0) > 0; i++) step(S, A);
    for (let i = 0; i < 30 * 20; i++) step(S, A);
    assert.ok(!(S.stock.circuit_r > 0), 'aucun rebut à l’entrepôt');
    assert.ok((z.inp.circuit_r || 0) > r0 || (S.machines.recycleur.inp.circuit_r || 0) > 0, 'rebuts rangés à la zone (ou au recycleur)');
    console.log('rebuts du contrôle : zone', z.inp.circuit_r || 0, '· recycleur', S.machines.recycleur.inp.circuit_r || 0);
  }
  // ancienne sauvegarde avec des déclassés à l'entrepôt : ils passent à la zone
  const raw = JSON.parse(readFileSync(new URL('./fixtures/state-l14.json', import.meta.url))).st;
  raw.stock.tole_d = 3; raw.stock.fil_r = 2;
  const R = SIM.restoreState(raw);
  assert.ok(!R.stock.tole_d && !R.stock.fil_r && R.machines.zone.inp.tole_d >= 3 && R.machines.zone.inp.fil_r >= 2, 'sauvegarde : déclassés déplacés à la zone');
  console.log('zone des déclassés : OK');
}

// ---------- 3. Adjoint qualité : mis au travail à la zone des déclassés ----------
{
  const S = load('state-l14.json');
  const d = S.droids.find((x) => x.type === 'ouvrier' && x.st === 'idle') || S.droids.find((x) => x.type === 'ouvrier');
  d.type = 'adjq'; d.st = 'follow'; d.who = 'A'; d.job = null;
  const A = { x: ENTREPOT.x, z: ENTREPOT.z + ENTREPOT.d / 2 + 0.6, events: [] };
  S.players.A.sac = {};
  step(S, A);
  assert.doesNotMatch(label(S), /Mettre au travail/, 'pas à l’entrepôt · ' + label(S));
  const f = frontOf('zone'); A.x = f.x; A.z = f.z; step(S, A);
  assert.match(label(S), /Mettre au travail : adjoint qualité/, label(S));
  A.events = ['down']; step(S, A); A.events = ['up']; step(S, A);
  assert.equal(d.st, 'work'); assert.equal(d.job, 'hq');
  console.log('adjoint qualité : mis au travail à la zone');
}

// ---------- 4. Coéquipier IA : au canapé, il vient pour un montage à deux ou quand on l'appelle ----------
{
  const S = load('state-l14.json');
  S.mode = 'solo';
  const bot = createBot();
  const A = { x: -17, z: 3, rot: 0, events: [] };
  const seat = SIM.pauseSpot(0);
  let B;
  for (let i = 0; i < 30 * 25; i++) { B = botInput(S, bot, dt, A); step(S, A, B); }
  assert.ok(Math.hypot(B.x - seat.x, B.z - seat.z) < 0.05 && bot.seated, `assis au canapé (${B.x.toFixed(2)}, ${B.z.toFixed(2)})`);
  assert.ok(!S.droids.some((d) => d.seat === 0), 'sa place n’est pas prise par un droïde');
  // appel : il rejoint le joueur
  bot.calledAt = S.time;
  for (let i = 0; i < 30 * 15; i++) { B = botInput(S, bot, dt, A); step(S, A, B); }
  assert.ok(Math.hypot(B.x - A.x, B.z - A.z) < 4, 'appelé, il rejoint le joueur : ' + Math.hypot(B.x - A.x, B.z - A.z).toFixed(1));
  // fin de l'appel : retour au canapé
  bot.calledAt = -1e9;
  for (let i = 0; i < 30 * 25; i++) { B = botInput(S, bot, dt, A); step(S, A, B); }
  assert.ok(bot.seated, 'retour au canapé');
  // chantier prêt : il vient tenir/visser de l'autre côté
  S.level = 15; S.goals = {};
  const pid = PB.four;
  {
    const st = S.plots[pid.id];
    st.del = { ...MACHINES[pid.type].cost }; st.ready = true;
    const L = SIM.postL(pid); A.x = L.x; A.z = L.z;
    let k = 0; while (!S.plots[pid.id].built && k++ < 30 * 40) { A.events = k === 1 ? ['down'] : []; A.held = true; B = botInput(S, bot, dt, A); step(S, A, B); }
    assert.ok(S.plots[pid.id].built, 'machine montée avec le coéquipier venu du canapé');
    console.log('coéquipier IA : canapé, appel, montage à deux');
  }
}

// ---------- 5. Générateur : 5 charbons et 5 bois, 10 unités = 1 heure ----------
{
  assert.equal(T.genCap * 2 * T.genUnit, 3600, '10 unités = 1 heure');
  const S = load('state-l6.json');
  const gen = S.machines.generateur;
  gen.inp = {}; S.power.energy = 0;
  S.players.A.sac = { charbon: 7, bois: 2 };
  const f = frontOf('generateur'); const A = { x: f.x, z: f.z, events: [] };
  step(S, A);
  A.events = ['down']; step(S, A); A.events = ['up']; step(S, A);
  assert.equal(SIM.genFill(S, gen, 'charbon'), 5, '5 charbons');
  assert.equal(SIM.genFill(S, gen, 'bois'), 2, '2 bois');
  assert.equal(S.players.A.sac.charbon, 2, '2 charbons restent dans le sac');
  assert.doesNotMatch(SIM.genText(S, gen), /surchauffe/, 'pas d’annonce de surchauffe');
  console.log('générateur :', SIM.genText(S, gen));
}

// ---------- 6. Niveaux : recycleur au niveau 7, « Former 2 droïdes spécialisés » au lieu de « Produire 6 droïdes » ----------
{
  assert.equal(PB.recycleur.level, 7, 'recycleur au niveau 7');
  assert.ok(LEVELS[6].goals.some((g) => g.id === 'recycleur'), 'objectif recycleur au niveau 7');
  assert.ok(!LEVELS.some((L) => L.goals.some((g) => g.c && g.c[0] === 'made+' && g.c[1] >= 4)), 'plus d’objectif « Produire 4 à 6 droïdes »');
  assert.ok(LEVELS.filter((L) => L.goals.some((g) => g.c && g.c[0] === 'spec+')).length >= 4, 'objectifs « Former 2 droïdes spécialisés »');
}
console.log('OK');
