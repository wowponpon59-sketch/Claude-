// Capture des créatures en solo : 3 façons de jouer (foncer, s'arrêter près de la bête, approcher calmement),
// 30 essais chacune. Objectif : le bouton « Attraper » apparaît au moins 9 fois sur 10.
// Usage : node two-supply-droides/tests/creatures.mjs
import * as SIM from '../js/sim.js';
import { createBot, botInput } from '../js/bot.js';
import { moveCircle, obstacles } from '../js/move.js';
const dt = 1 / 30;
function trial(seed, style) {
  const S = SIM.newState('solo', seed); S.clock = 1.7e12;
  const bot = createBot();
  const an = S.animals[(seed/7) % S.animals.length]; for (let k = 0; k < (seed % 5) * 90; k++) SIM.step(S, dt, {});
  const A = { x: an.x + 9, z: an.z + 2, rot: 0, mx: 0, mz: 0, held: false, events: [] };
  S.players.A.x = A.x; S.players.A.z = A.z; S.players.B.x = A.x + 1; S.players.B.z = A.z + 1;
  bot.init = false;
  let seen = 0, firstBtn = null, run = 0, best = 0;
  for (let i = 0; i < 30 * 60; i++) {
    const wp = SIM.waypoint(A, an) || an; const dx = wp.x - A.x, dz = wp.z - A.z, l = Math.hypot(dx, dz) || 1; const la = Math.hypot(an.x - A.x, an.z - A.z);
    let sp = 4.6;
    if (style === 'stop' && la < 2.5) sp = 0;              // s'arrête près de la bête et attend le bouton
    if (style === 'calm') sp = la < 4 ? 2.0 : 4.6;           // ralentit à l'approche
    const st = Math.min(Math.max(0, l - 0.3), sp * dt);
    [A.x, A.z] = moveCircle(A.x, A.z, dx / l * st, dz / l * st, obstacles(S));
    const b = botInput(S, bot, dt, A);
    SIM.step(S, dt, { A, B: b }); A.events = [];
    const h = S.players.A.hint;
    if (h && /Attraper/.test(h.label)) { seen++; run++; best = Math.max(best, run); if (firstBtn === null) firstBtn = i / 30; } else run = 0;
  }
  return firstBtn === null ? null : [firstBtn, best / 30];
}
for (const style of ['chase', 'stop', 'calm']) {
  const res = [];
  for (let s = 1; s <= 30; s++) res.push(trial(s * 7, style));
  const ok = res.filter((x) => x !== null);
  const avg = (f) => (ok.reduce((a, b) => a + f(b), 0) / ok.length).toFixed(2);
  console.log(style.padEnd(6), `bouton « Attraper » vu dans ${ok.length}/30 essais`, ok.length ? `· apparaît après ${avg((x) => x[0])} s · reste affiché au mieux ${avg((x) => x[1])} s d'affilée (min ${Math.min(...ok.map((x) => x[1])).toFixed(2)} s)` : '');
}
