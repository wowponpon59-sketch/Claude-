// Coéquipier piloté par l'ordinateur (mode solo) : il suit le joueur
// et se place tout seul de l'autre côté dès qu'une tâche demande deux personnes.
import { POST_R, CORE, SPEED, PLOTS } from './config.js';
import { PLOT_BY_ID } from './world.js';
import { postL, postR } from './sim.js';
import { obstacles, steer } from './move.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createBot() {
  return { held: false, tap: 0, pressed: false, ent: { x: 0, z: 0, rot: 0 }, init: false, why: '' };
}

export function botInput(S, bot, dt, aIn) {
  const me = S.players.B, A = S.players.A;
  if (!bot.init) { bot.ent.x = me.x; bot.ent.z = me.z; bot.init = true; }
  if (me.locked) { bot.ent.x = me.x; bot.ent.z = me.z; }
  const events = [];
  let goal = null, hold = false, tapNow = false, mirror = null, why = 'suit';

  const c = S.core;
  const readyPlot = PLOTS.find((p) => {
    const st = S.plots[p.id];
    return st.ready && !st.built && (dist(A, postL(p)) <= POST_R + 0.3 || dist(A, postR(p)) <= POST_R + 0.3);
  });
  const holdsOne = S.animals.some((a) => a.st === 'caught' && a.by === 'A');
  const hunting = holdsOne ? null : S.animals.find((a) => ['wander', 'flee', 'corner'].includes(a.st) && dist(A, a) < 7);

  if (!c.placed && (c.hand.A || c.hand.B)) {
    why = 'caisse';
    if (c.hand.B) {
      if (c.hand.A) mirror = { mx: aIn.mx || 0, mz: aIn.mz || 0 };
      else tapNow = true; // le joueur a lâché : on lâche aussi
    } else {
      const side = c.hand.A === 'L' ? 'R' : 'L';
      goal = { x: c.x + (side === 'L' ? -1 : 1) * CORE.handle, z: c.z };
      if (dist(bot.ent, goal) < 0.5) tapNow = true;
    }
  } else if (readyPlot) {
    why = 'montage';
    const st = S.plots[readyPlot.id];
    const aLeft = dist(A, postL(readyPlot)) <= POST_R + 0.3;
    goal = aLeft ? postR(readyPlot) : postL(readyPlot);
    const there = dist(bot.ent, goal) < 0.5;
    if (there) {
      if (aLeft) { if (st.holder === 'A') { bot.tap -= dt; if (bot.tap <= 0) { tapNow = true; bot.tap = 0.32; } } }
      else hold = true;
    }
  } else if (hunting) {
    why = 'créature';
    const a = hunting;
    const dx = a.x - A.x, dz = a.z - A.z, l = Math.hypot(dx, dz) || 1;
    goal = { x: a.x + (dx / l) * 2.6, z: a.z + (dz / l) * 2.6 };
  } else {
    const back = 2.2, side = 1.3;
    goal = { x: A.x - Math.sin(A.rot) * back + Math.cos(A.rot) * side, z: A.z - Math.cos(A.rot) * back - Math.sin(A.rot) * side };
    if (dist(bot.ent, goal) < 1.2) goal = null;
  }
  bot.why = why;

  let mx = 0, mz = 0;
  if (mirror) { mx = mirror.mx; mz = mirror.mz; }
  else if (goal && !me.locked) {
    const x0 = bot.ent.x, z0 = bot.ent.z;
    const far = dist(bot.ent, goal);
    // Coincé ou trop loin : il « rejoint » directement (comme un coéquipier de jeu vidéo).
    bot.stuck = far > 1 && far > (bot.lastFar ?? 1e9) - 0.02 ? (bot.stuck || 0) + dt : 0;
    bot.lastFar = far;
    if (far > 22 || bot.stuck > 1.5) {
      bot.ent.x = goal.x; bot.ent.z = goal.z; bot.stuck = 0; bot.lastFar = 0;
    }
    const speed = far > 6 ? SPEED * 1.15 : SPEED;
    steer(bot.ent, goal.x, goal.z, speed, dt, obstacles(S), 0.4);
    const vx = bot.ent.x - x0, vz = bot.ent.z - z0, v = Math.hypot(vx, vz);
    if (v > 1e-4) { mx = vx / v; mz = vz / v; bot.ent.rot = Math.atan2(mx, mz); }
  }

  // Appuis : maintien (tenir) ou petits coups (visser, saisir, lâcher)
  if (bot.pressed) { events.push('up'); bot.pressed = false; bot.held = false; }
  if (hold && !bot.held) { events.push('down'); bot.held = true; }
  else if (!hold && bot.held && !bot.pressed) { events.push('up'); bot.held = false; }
  if (tapNow && !bot.held) { events.push('down'); bot.pressed = true; bot.held = true; }

  if (!Number.isFinite(bot.ent.x) || !Number.isFinite(bot.ent.z)) { bot.ent.x = A.x + 1; bot.ent.z = A.z + 1; }
  return { x: bot.ent.x, z: bot.ent.z, rot: bot.ent.rot, mx, mz, held: bot.held, events };
}

export function botLabel(bot) {
  return { caisse: 'porte la caisse', montage: 'monte avec toi', créature: 'prend la créature à revers', suit: 'te suit' }[bot.why] || '';
}

