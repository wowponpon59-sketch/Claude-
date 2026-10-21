// Recyclage des objets en trop : la moitié des matières premières, demi-unités reportées.
// Usage : node two-supply-droides/tests/recyclage.test.mjs   → « OK »
import * as SIM from '../js/sim.js';
import assert from 'node:assert/strict';
const S = SIM.newState('solo', 5);
S.level = 10; S.power.battery = 1e6;
SIM.forceBuild(S, 'recycleur');
const rc = S.machines.recycleur;
S.droids.push({ id: 999, type: 'ouvrier', x: 8.5, z: 9.1, rot: 0, st: 'work', who: null, job: 'recycleur', job2: null, task: null, carry: null });
rc.operator = 999;
const ev = (e) => ({ A: { x: 8.5, z: 9.5, events: [e] }, B: { x: 9.5, z: 9.5, events: [] } });
for (const k of ['isolant', 'k_outils', 'k_scanner']) SIM.step(S, 1 / 30, ev({ c: 'trash', mach: 'recycleur', item: k, on: true }));
assert.deepEqual(rc.sel, ['surplus']);
rc.inp = { isolant: 4, k_outils: 2, k_scanner: 2 };
const outs = {};
for (let i = 0; i < 30 * 60 && Object.keys(rc.inp).length; i++) {
  SIM.step(S, 1 / 30, {});
  for (const [k, n] of Object.entries(rc.out)) { outs[k] = (outs[k] || 0) + n; }
  rc.out = {};
}
console.log('8 objets recyclés →', JSON.stringify(outs), 'reste en attente', JSON.stringify(rc.frac));
assert.deepEqual(outs, { argile: 2, eau: 1, fer: 2, calcaire: 2, verre: 3 });
assert.equal(S.stats.surplus, 8);
console.log('OK');
