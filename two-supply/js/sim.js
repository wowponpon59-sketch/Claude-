// Simulation de référence. Elle tourne sur le téléphone hôte ;
// l'invité reçoit l'état 20 fois par seconde.
import { POS, T, ITEMS, REACH, POST_R, CARRY_SPEED, other } from './config.js';
import { boxDist, obstacles, moveBox } from './move.js';

const IDS = ['A', 'B'];

export function newState(roles) {
  return {
    phase: 'crate', // crate → build → bake → won
    time: 0,
    roles: { ...roles },
    players: {
      A: newPlayer(POS.startA),
      B: newPlayer(POS.startB),
    },
    crate: { x: POS.crate0.x, z: POS.crate0.z, hand: { A: null, B: null }, warn: 0 },
    build: { progress: 0, holder: null },
    four: { inp: null, bake: 0, out: null, lever: { L: -99, R: -99 }, leverBy: { L: null, R: null } },
    moulin: { inp: null, t: 0, out: null, uses: 0, jam: false },
    petrin: { farine: false, eau: false, sel: false, kneads: 0, out: null },
    tables: POS.tables.map(() => null),
    work: { A: null, B: null }, // action maintenue en cours : { key, item?, fix?, t, dur }
    orders: [],
    orderSeq: 0,
    nextOrder: 0,
    delivered: 0,
    missed: 0,
    goal: T.goal,
    bakeStart: 0,
    wonAt: 0,
    fx: [],
    cd: { A: 0, B: 0 },
  };
}

function newPlayer(p) {
  return { x: p.x, z: p.z, rot: Math.PI, holding: null, locked: false, hint: null, wait: null };
}

// ---------- effets envoyés aux écrans ----------
function fx(S, to, k, extra = {}) { S.fx.push({ to, k, ...extra }); }
function toast(S, to, text, tone = 'info') { fx(S, to, 'toast', { text, tone }); }
function sfx(S, to, s) { fx(S, to, 'sfx', { s }); }
function call(S, to, text, x, z) {
  if (S.cd[to] > 0) return;
  S.cd[to] = 4;
  fx(S, to, 'call', { text, x, z });
}

// ---------- ce que le joueur peut faire, à l'endroit où il est ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function targets(S, id) {
  const p = S.players[id];
  const role = S.roles[id];
  const h = p.holding;
  const out = [];
  const add = (key, d, o) => out.push({ key, d, kind: 'solo', ...o });

  // La caisse saisie : on ne peut que la lâcher.
  if (S.phase === 'crate' && S.crate.hand[id]) {
    return [{ key: 'crate' + S.crate.hand[id], d: 0, kind: 'duo', act: 'ungrab', label: 'Lâcher la caisse' }];
  }

  for (const [key, item] of [['ble', 'ble'], ['puits', 'eau'], ['sel', 'sel']]) {
    const d = boxDist(p, POS[key]);
    if (d > REACH) continue;
    if (h) add(key, d, { off: true, label: 'Mains pleines' });
    else add(key, d, { act: 'harvest', item, label: { ble: 'Récolter le blé', eau: "Puiser de l'eau", sel: 'Ramasser du sel' }[key] });
  }

  {
    const d = boxDist(p, POS.moulin), m = S.moulin;
    if (d <= REACH) {
      if (m.jam) add('moulin', d, { act: 'unjam', label: 'Débloquer le moulin' });
      else if (m.out && !h) add('moulin', d, { act: 'take', label: 'Prendre la farine' });
      else if (m.out) add('moulin', d, { off: true, label: 'Mains pleines' });
      else if (m.inp) add('moulin', d, { off: true, label: 'Le moulin tourne…' });
      else if (h === 'ble') add('moulin', d, { act: 'put', label: 'Verser le blé' });
      else add('moulin', d, { off: true, label: 'Le moulin attend du blé' });
    }
  }

  {
    const d = boxDist(p, POS.petrin), P = S.petrin;
    if (d <= REACH) {
      const full = P.farine && P.eau && P.sel;
      if (P.out) add('petrin', d, h ? { off: true, label: 'Mains pleines' } : { act: 'take', label: 'Prendre la pâte' });
      else if (full) add('petrin', d, { act: 'knead', label: 'Pétrir' });
      else if (h && ['farine', 'eau', 'sel'].includes(h) && !P[h]) add('petrin', d, { act: 'put', label: 'Ajouter ' + ITEMS[h].de });
      else if (role === 'chef') {
        const miss = ['farine', 'eau', 'sel'].filter((k) => !P[k]).map((k) => ITEMS[k].name).join(', ');
        add('petrin', d, { off: true, label: 'Il manque : ' + miss });
      } else add('petrin', d, { off: true, label: 'Recette inconnue : demande au Chef' });
    }
  }

  POS.tables.forEach((t, i) => {
    const d = boxDist(p, t);
    if (d > REACH) return;
    const it = S.tables[i];
    if (h && !it) add('table' + i, d, { act: 'tput', i, label: 'Poser ' + ITEMS[h].de });
    else if (!h && it) add('table' + i, d, { act: 'ttake', i, label: 'Prendre ' + ITEMS[it].de });
  });

  if (h) {
    const d = boxDist(p, POS.poubelle);
    if (d <= REACH) add('poubelle', d, { act: 'trash', label: 'Jeter ' + ITEMS[h].de });
  }

  {
    const d = boxDist(p, POS.comptoir);
    if (d <= REACH) {
      if (h === 'pain') add('comptoir', d, S.orders.length ? { act: 'deliver', label: 'Livrer le pain' } : { off: true, label: 'Aucune commande en attente' });
      else add('comptoir', d, { off: true, label: S.phase === 'bake' ? 'Le client attend du pain' : 'Comptoir de livraison' });
    }
  }

  if (S.phase === 'crate') {
    const c = S.crate;
    for (const side of ['L', 'R']) {
      const hp = { x: c.x + (side === 'L' ? -1 : 1) * POS.handle, z: c.z };
      const d = dist(p, hp);
      if (d > POST_R) continue;
      if (c.hand[other(id)] === side) continue;
      add('crate' + side, d, h ? { kind: 'duo', off: true, label: 'Mains pleines' } : { kind: 'duo', act: 'grab', side, label: 'Saisir la poignée' });
    }
  }

  if (S.phase === 'build') {
    const dl = dist(p, POS.postL), dr = dist(p, POS.postR);
    if (dl <= POST_R) add('postL', dl, { kind: 'duo', act: 'hold', label: S.build.holder === id ? 'Tenir… (garde appuyé)' : 'Tenir la pièce' });
    if (dr <= POST_R) add('postR', dr, { kind: 'duo', act: 'screw', label: 'Visser' });
  }

  if (S.phase === 'bake' || S.phase === 'won') {
    const F = S.four;
    const d = dist(p, POS.front);
    if (d <= POST_R + 0.2) {
      if (F.out) add('four', d, h ? { off: true, label: 'Mains pleines' } : { act: 'take', label: 'Sortir le pain' });
      else if (F.bake > 0) add('four', d, { off: true, label: 'Cuisson en cours…' });
      else if (F.inp) add('four', d, { off: true, kind: 'duo', label: 'Tirez les deux leviers !' });
      else if (h === 'pate') add('four', d, { act: 'put', label: 'Enfourner la pâte' });
      else add('four', d, { off: true, label: 'Le four attend de la pâte' });
    }
    for (const side of ['L', 'R']) {
      const post = side === 'L' ? POS.postL : POS.postR;
      const dd = dist(p, post);
      if (dd > POST_R) continue;
      if (F.inp && F.bake <= 0 && !F.out) add('lever' + side, dd, { kind: 'duo', act: 'lever', side, label: 'Tirer le levier' });
      else add('lever' + side, dd, { kind: 'duo', off: true, label: F.bake > 0 ? 'Cuisson en cours…' : "Enfournez d'abord la pâte" });
    }
  }

  out.sort((a, b) => (a.off ? 0.6 : 0) + a.d - ((b.off ? 0.6 : 0) + b.d));
  return out;
}

// ---------- appui sur le bouton Action ----------
function press(S, id) {
  const p = S.players[id];
  const role = S.roles[id];
  const t = targets(S, id)[0];
  if (!t) return;
  if (t.off) { sfx(S, id, 'err'); return; }
  const o = other(id);
  switch (t.act) {
    case 'harvest':
      S.work[id] = { key: t.key, item: t.item, t: 0, dur: T.harvest[t.item] };
      break;
    case 'unjam':
      S.work[id] = { key: 'moulin', fix: true, t: 0, dur: T.unjam[role] };
      break;
    case 'take': {
      const m = t.key === 'moulin' ? S.moulin : t.key === 'petrin' ? S.petrin : S.four;
      p.holding = m.out;
      m.out = null;
      sfx(S, id, 'pick');
      break;
    }
    case 'put':
      if (t.key === 'moulin') { S.moulin.inp = 'ble'; S.moulin.t = 0; }
      else if (t.key === 'petrin') S.petrin[p.holding] = true;
      else if (t.key === 'four') S.four.inp = 'pate';
      p.holding = null;
      sfx(S, id, 'drop');
      break;
    case 'knead': {
      const P = S.petrin;
      P.kneads += 1;
      sfx(S, id, 'tap');
      if (P.kneads >= T.knead[role]) {
        Object.assign(P, { farine: false, eau: false, sel: false, kneads: 0, out: 'pate' });
        sfx(S, id, 'ok');
      }
      break;
    }
    case 'tput': S.tables[t.i] = p.holding; p.holding = null; sfx(S, id, 'drop'); break;
    case 'ttake': p.holding = S.tables[t.i]; S.tables[t.i] = null; sfx(S, id, 'pick'); break;
    case 'trash': p.holding = null; sfx(S, id, 'drop'); break;
    case 'deliver':
      p.holding = null;
      S.orders.shift();
      S.delivered += 1;
      sfx(S, 'all', 'ok');
      if (S.delivered >= S.goal) {
        S.phase = 'won';
        S.wonAt = S.time;
        S.orders = [];
        fx(S, 'all', 'won');
      } else toast(S, 'all', `Pain livré ! ${S.delivered}/${S.goal}`, 'good');
      break;
    case 'grab': {
      const c = S.crate;
      c.hand[id] = t.side;
      p.locked = true;
      sfx(S, id, 'clong');
      if (!c.hand[o]) call(S, o, 'Ton partenaire attend à la caisse : il faut être deux pour la porter !', c.x, c.z);
      else {
        toast(S, 'all', 'Caisse soulevée ! Allez dans la même direction.', 'good');
        sfx(S, 'all', 'clong');
      }
      break;
    }
    case 'ungrab':
      S.crate.hand[id] = null;
      p.locked = false;
      break;
    case 'hold':
      S.build.holder = id;
      sfx(S, id, 'clong');
      break;
    case 'screw':
      if (S.build.holder && S.build.holder !== id) {
        S.build.progress = Math.min(1, S.build.progress + 1 / T.screw[role]);
        sfx(S, 'all', 'tap');
        if (S.build.progress >= 1) finishBuild(S);
      } else {
        toast(S, id, 'Quelqu’un doit tenir la pièce de l’autre côté !', 'warn');
        sfx(S, id, 'err');
        call(S, o, 'Ton partenaire visse : va tenir la pièce de l’autre côté !', POS.postL.x, POS.postL.z);
      }
      break;
    case 'lever': {
      const F = S.four;
      const side = t.side, os = side === 'L' ? 'R' : 'L';
      F.lever[side] = S.time;
      F.leverBy[side] = id;
      sfx(S, id, 'tap');
      if (S.time - F.lever[os] <= T.leverWindow && F.leverBy[os] !== id) {
        F.bake = T.bake;
        F.lever = { L: -99, R: -99 };
        F.leverBy = { L: null, R: null };
        sfx(S, 'all', 'clong');
        toast(S, 'all', 'Four lancé !', 'good');
      } else {
        const post = os === 'L' ? POS.postL : POS.postR;
        call(S, o, 'Ton partenaire tire un levier : tire l’autre en même temps !', post.x, post.z);
      }
      break;
    }
  }
}

function release(S, id) {
  if (S.build.holder === id) S.build.holder = null;
  if (S.work[id]) S.work[id] = null;
}

function finishBuild(S) {
  S.phase = 'bake';
  S.build.holder = null;
  S.bakeStart = S.time;
  S.nextOrder = 2;
  sfx(S, 'all', 'ok');
  toast(S, 'all', 'Four monté ! Place à la production de pain.', 'good');
}

// ---------- boucle ----------
export function step(S, dt, inputs) {
  S.time += dt;
  for (const id of IDS) {
    S.cd[id] = Math.max(0, S.cd[id] - dt);
    const p = S.players[id], inp = inputs[id];
    if (!inp) continue;
    if (!p.locked && Number.isFinite(inp.x) && Number.isFinite(inp.z)) {
      p.x = inp.x; p.z = inp.z; p.rot = inp.rot || 0;
    }
  }
  for (const id of IDS) {
    const inp = inputs[id];
    if (!inp || !inp.events) continue;
    for (const e of inp.events) {
      if (e === 'down') press(S, id);
      else if (e === 'up') release(S, id);
    }
  }
  for (const id of IDS) continuous(S, id, inputs[id] || {}, dt);
  carry(S, inputs, dt);
  machines(S, dt);
  orders(S, dt);
  for (const id of IDS) {
    const t = targets(S, id)[0];
    const p = S.players[id];
    p.hint = t ? { key: t.key, label: t.label, kind: t.kind, off: !!t.off } : null;
  }
  waits(S);
}

function continuous(S, id, inp, dt) {
  const p = S.players[id];
  const w = S.work[id];
  if (w) {
    const t = targets(S, id)[0];
    const still = inp.held && t && t.key === w.key && (w.fix ? t.act === 'unjam' : t.act === 'harvest');
    if (!still) S.work[id] = null;
    else {
      w.t += dt;
      if (w.t >= w.dur) {
        S.work[id] = null;
        if (w.fix) {
          S.moulin.jam = false;
          sfx(S, id, 'ok');
          toast(S, 'all', 'Moulin débloqué !', 'good');
        } else {
          p.holding = w.item;
          sfx(S, id, 'pick');
        }
      }
    }
  }
  if (S.build.holder === id && (!inp.held || dist(p, POS.postL) > POST_R)) S.build.holder = null;
}

function carry(S, inputs, dt) {
  if (S.phase !== 'crate') return;
  const c = S.crate;
  c.warn = Math.max(0, c.warn - dt);
  if (c.hand.A && c.hand.B) {
    const a = inputs.A || {}, b = inputs.B || {};
    const ax = a.mx || 0, az = a.mz || 0, bx = b.mx || 0, bz = b.mz || 0;
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    let vx = (ax + bx) / 2, vz = (az + bz) / 2;
    if (la > 0.25 && lb > 0.25 && (ax * bx + az * bz) / (la * lb) < -0.3) {
      vx = 0; vz = 0;
      if (c.warn <= 0) {
        toast(S, 'all', 'Vous tirez dans des sens opposés !', 'warn');
        sfx(S, 'all', 'err');
      }
      c.warn = 1.5;
    }
    const groupW = POS.crate.w + 2 * (POS.handle - POS.crate.w / 2 + 0.35);
    const obs = obstacles(null);
    [c.x, c.z] = moveBox(c.x, c.z, vx * CARRY_SPEED * dt, vz * CARRY_SPEED * dt, groupW, POS.crate.d, obs);
    if (Math.hypot(c.x - POS.four.x, c.z - POS.four.z) < T.placeDist) {
      c.x = POS.four.x; c.z = POS.four.z;
      for (const id of IDS) {
        const post = c.hand[id] === 'L' ? POS.postL : POS.postR;
        const p = S.players[id];
        p.x = post.x; p.z = post.z; p.locked = false;
      }
      c.hand = { A: null, B: null };
      S.phase = 'build';
      sfx(S, 'all', 'ok');
      toast(S, 'all', 'Caisse en place ! Montez le four : l’un tient, l’autre visse.', 'good');
      return;
    }
  }
  for (const id of IDS) {
    const side = c.hand[id];
    if (!side) continue;
    const p = S.players[id];
    p.x = c.x + (side === 'L' ? -1 : 1) * POS.handle;
    p.z = c.z;
    p.rot = side === 'L' ? Math.PI / 2 : -Math.PI / 2;
  }
}

function machines(S, dt) {
  const m = S.moulin;
  if (m.inp && !m.jam) {
    m.t += dt;
    if (m.t >= T.moulin) {
      m.inp = null; m.t = 0; m.out = 'farine'; m.uses += 1;
      sfx(S, 'all', 'ding');
      if (m.uses % T.jamEvery === 0) {
        m.jam = true;
        sfx(S, 'all', 'err');
        toast(S, 'all', 'Le moulin s’est bloqué ! L’Ingénieur le débloque plus vite.', 'warn');
      }
    }
  }
  const F = S.four;
  if (F.bake > 0) {
    F.bake -= dt;
    if (F.bake <= 0) {
      F.bake = 0; F.inp = null; F.out = 'pain';
      sfx(S, 'all', 'ding');
      toast(S, 'all', 'Pain cuit ! Sortez-le du four.', 'good');
    }
  }
  for (const side of ['L', 'R']) {
    if (F.lever[side] > 0 && S.time - F.lever[side] > T.leverWindow) {
      const by = F.leverBy[side];
      F.lever[side] = -99;
      F.leverBy[side] = null;
      if (by) {
        toast(S, by, 'Raté : tirez les deux leviers en même temps !', 'warn');
        sfx(S, by, 'err');
      }
    }
  }
}

function orders(S, dt) {
  if (S.phase !== 'bake') return;
  S.nextOrder -= dt;
  if (S.nextOrder <= 0 && S.orders.length < T.maxOrders) {
    S.orders.push({ id: ++S.orderSeq, t: T.orderLife, life: T.orderLife });
    S.nextOrder = T.orderEvery;
    sfx(S, 'all', 'order');
    toast(S, 'all', 'Nouvelle commande : un pain de campagne.', 'info');
  }
  for (const o of S.orders) o.t -= dt;
  const before = S.orders.length;
  S.orders = S.orders.filter((o) => o.t > 0);
  if (S.orders.length < before) {
    S.missed += before - S.orders.length;
    toast(S, 'all', 'Commande perdue : le client est parti.', 'bad');
    sfx(S, 'all', 'err');
  }
}

function waits(S) {
  for (const id of IDS) {
    const p = S.players[id], o = other(id), op = S.players[o];
    p.wait = null;
    if (S.phase === 'crate' && S.crate.hand[id] && !S.crate.hand[o]) p.wait = 'Il faut être deux !';
    if (S.phase === 'build' && S.build.holder === id && dist(op, POS.postR) > POST_R) {
      p.wait = 'Il faut être deux !';
      call(S, o, 'Ton partenaire tient la pièce : va visser de l’autre côté !', POS.postR.x, POS.postR.z);
    }
    const F = S.four;
    for (const side of ['L', 'R']) {
      if (F.leverBy[side] === id && F.lever[side] > 0) p.wait = 'Il faut être deux !';
    }
  }
}

// Effets à distribuer : l'appelant vide la liste après envoi.
export function drainFx(S) {
  const list = S.fx;
  S.fx = [];
  return list;
}
