// Droïdes coincés ? 6 minutes de jeu sur la sauvegarde de fin de partie (tests/fixtures/state-late.json).
// Usage : node two-supply-droides/tests/droides-coinces.mjs
import * as SIM from '../js/sim.js';
import { readFileSync } from 'node:fs';
import { PAUSE } from '../js/config.js';
const file = process.argv[2] || 'fixtures/state-late.json';
const S = SIM.restoreState(JSON.parse(readFileSync(new URL('./' + file, import.meta.url))).st);
S.clock = 1.9e12; S.gen.play = 0;
const dt = 1 / 30, last = new Map(), stuckT = new Map();
let worst = 0, episodes = 0, nearPause = 0, sitMax = 0, cafeMax = 0;
for (let i = 0; i < 30 * 360; i++) {
  S.clock += 33;
  const gen = S.machines.generateur; if (gen && !gen.inp.charbon && S.power.energy < 1) gen.inp.charbon = 5; if (gen && gen.broken) gen.broken = null;
  SIM.step(S, dt, { A: { x: -1, z: 4, events: [] }, B: { x: 1, z: 4, events: [] } });
  SIM.drainFx(S);
  sitMax = Math.max(sitMax, S.droids.filter((d) => d.pose === 'sit').length);
  cafeMax = Math.max(cafeMax, S.droids.filter((d) => d.pose === 'cafe').length);
  for (const d of S.droids) {
    if (!(d.st === 'work' && d.job === 'hq') || d.pose) { stuckT.set(d.id, 0); continue; }
    const p = last.get(d.id) || { x: d.x, z: d.z };
    const mv = Math.hypot(d.x - p.x, d.z - p.z);
    last.set(d.id, { x: d.x, z: d.z });
    const t = mv < 0.002 && (d.task || d.seat != null) ? (stuckT.get(d.id) || 0) + dt : 0;
    if (t > 5 && (stuckT.get(d.id) || 0) <= 5) { episodes++; if (Math.hypot(d.x - PAUSE.x, d.z - PAUSE.z) < 4) nearPause++; console.log('coincé', d.type, d.x.toFixed(1), d.z.toFixed(1), JSON.stringify(d.task && { to: d.task.to, from: d.task.from, ph: d.task.phase }), 'seat', d.seat, 'sat', d.sat); }
    stuckT.set(d.id, t); worst = Math.max(worst, t);
  }
}
console.log('épisodes coincés > 5 s :', episodes, '(dont près du coin pause :', nearPause, ') · pire', worst.toFixed(1), 's · assis max', sitMax, '· debout max', cafeMax, '· droïdes', S.droids.length);
