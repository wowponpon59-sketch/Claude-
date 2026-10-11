// Interface : écrans, HUD, commandes tactiles et repères affichés au-dessus des objets.
import { POS, T, ROLES, PLAYER_COLORS, POST_R, other } from './config.js';

const $ = (id) => document.getElementById(id);

export const ICON = {
  solo: '<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3.3"/><path d="M4 18v-2.4a6 6 0 0 1 12 0V18z"/></svg>',
  duo: '<svg viewBox="0 0 26 20"><circle cx="8" cy="6" r="3"/><path d="M2.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/><circle cx="18" cy="6" r="3"/><path d="M12.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10h.5V4a1.5 1.5 0 0 1 3 0v6h.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6.8 6.8 0 0 1-5.6-2.9L3 14.2a1.5 1.5 0 0 1 2.3-1.9L8 15z"/></svg>',
};

// ---------- écrans ----------
export function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
export function overlay(id, on) { $(id).classList.toggle('active', on); }
export function setMsg(id, text, err = false) { const el = $(id); el.textContent = text || ''; el.classList.toggle('err', !!err); }

export function setPlayerColors(myId) {
  const r = document.documentElement.style;
  r.setProperty('--me', PLAYER_COLORS[myId].css);
  r.setProperty('--them', PLAYER_COLORS[other(myId)].css);
}

export function renderRoles(roles, myId) {
  const mine = roles[myId], theirs = roles[other(myId)];
  document.querySelectorAll('.role-card').forEach((c) => {
    const r = c.dataset.role;
    c.classList.toggle('mine', r === mine);
    c.classList.toggle('theirs', r === theirs);
    c.querySelector('.claim').textContent = r === mine ? 'Ton métier' : r === theirs ? 'Pris par ton partenaire' : 'Libre';
  });
  if (mine && theirs) setMsg('roles-msg', 'Les deux métiers sont choisis : la partie démarre…');
  else if (mine) setMsg('roles-msg', 'En attente du choix de ton partenaire…');
  else setMsg('roles-msg', 'Touche un métier pour le prendre.');
}

const fr = (n) => String(n).replace('.', ',');

export function fillCarnet(role) {
  $('carnet-title').textContent = role === 'chef' ? 'Carnet du Chef : les recettes' : 'Carnet de l’Ingénieur : les plans';
  const e = (title, text, duo = false) => `<div class="entry${duo ? ' duo' : ''}"><b>${title}</b>${text}</div>`;
  const html = role === 'chef'
    ? [
      e('Moulin', `1 blé donne 1 sac de farine en ${T.moulin} s.`),
      e('Pétrin', `Farine + eau + sel, puis pétrir : ${T.knead.chef} coups pour toi, ${T.knead.inge} pour l’Ingénieur. Donne une pâte.`),
      e('Four', `Enfourner la pâte, puis tirer <strong>les deux leviers en même temps</strong> (moins d’une seconde d’écart). Cuisson ${T.bake} s.`, true),
      e('Comptoir', `Livrer chaque pain avant la fin du ticket. Objectif du contrat : ${T.goal} pains.`),
      e('Ton partenaire', 'L’Ingénieur connaît les plans de montage du four : demande-lui où et comment.'),
    ]
    : [
      e('Caisse du four', 'Sur le quai, à droite. Elle se porte à deux, une poignée chacun ; avancez dans le même sens.', true),
      e('Zone de montage', 'Les bandes jaunes et noires au centre de l’atelier. Tu vois le four en transparence à l’endroit exact.'),
      e('Montage', `L’un tient la pièce à gauche (garder appuyé), l’autre visse à droite : ${T.screw.inge} coups pour toi, ${T.screw.chef} pour le Chef.`, true),
      e('Moulin', `Il se bloque tous les ${T.jamEvery} sacs. Tu le débloques en ${fr(T.unjam.inge)} s, le Chef en ${fr(T.unjam.chef)} s (garder appuyé).`),
      e('Ton partenaire', 'Le Chef connaît les recettes du pétrin : demande-lui ce qu’il faut y mettre.'),
    ];
  $('carnet-body').innerHTML = html.join('');
}

// ---------- HUD ----------
const ACTION_ICONS = {
  default: ICON.hand,
};

export function updateHud(st, myId, role) {
  const me = st.players[myId];
  $('contract-fill').style.width = `${(st.delivered / st.goal) * 100}%`;
  $('contract-count').textContent = `${st.delivered} / ${st.goal} pains`;
  $('contract-miss').textContent = st.missed ? `${st.missed} ratée${st.missed > 1 ? 's' : ''}` : '';

  const ordersEl = $('orders');
  const sig = st.orders.map((o) => o.id).join(',');
  if (ordersEl.dataset.sig !== sig) {
    ordersEl.dataset.sig = sig;
    ordersEl.innerHTML = st.orders.map((o) => `<div class="order" data-id="${o.id}"><span class="loaf"></span><span>Pain</span><span class="ob"><i></i></span></div>`).join('');
  }
  st.orders.forEach((o, i) => {
    const el = ordersEl.children[i];
    if (!el) return;
    const f = Math.max(0, o.t / o.life);
    el.querySelector('i').style.width = `${f * 100}%`;
    el.classList.toggle('late', f < 0.3);
  });

  $('objective').innerHTML = objective(st, role);
  $('role-name').textContent = ROLES[role].name;

  const btn = $('btn-action');
  const h = me.hint;
  btn.classList.toggle('duo', !!(h && h.kind === 'duo' && !h.off));
  btn.classList.toggle('off', !!(h && h.off));
  btn.classList.toggle('none', !h);
  $('action-label').textContent = h ? h.label : 'Action';
  const icon = h ? (h.kind === 'duo' ? ICON.duo : ICON.solo) : ICON.hand;
  const ic = $('action-icon');
  if (ic.dataset.k !== icon) { ic.innerHTML = icon; ic.dataset.k = icon; }
}

function objective(st, role) {
  const chef = role === 'chef';
  switch (st.phase) {
    case 'crate':
      return chef
        ? 'Le four est livré en kit sur le <b>quai</b>. Portez la caisse <b>à deux</b> jusqu’à la zone de montage : l’Ingénieur sait où.'
        : 'Le four est livré en kit sur le <b>quai</b>. Portez la caisse <b>à deux</b> jusqu’à la zone de montage (four bleu transparent).';
    case 'build':
      return chef
        ? 'Montez le four <b>à deux</b>. L’Ingénieur connaît la marche à suivre : écoute-le.'
        : 'Montez le four <b>à deux</b> : l’un <b>tient</b> à gauche (garder appuyé), l’autre <b>visse</b> à droite. Tu visses 2× plus vite.';
    case 'bake':
      return chef
        ? 'Pain : <b>blé → moulin</b> ; <b>farine + eau + sel → pétrin</b> ; <b>pâte → four</b>, puis les deux leviers ensemble. Livrez au comptoir.'
        : 'Produisez du pain et livrez les commandes au comptoir. Le Chef connaît les recettes : <b>demande-lui</b> !';
    case 'won':
      return '<b>Contrat rempli !</b>';
  }
  return '';
}

// ---------- notifications ----------
export function toast(text, tone = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  el.textContent = text;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

let arrowUntil = 0, arrowTarget = null;
export function pointTo(x, z, seconds = 3.5) {
  arrowTarget = { x, z };
  arrowUntil = performance.now() + seconds * 1000;
}

export function updateArrow(renderer) {
  const el = $('edge-arrow');
  if (!arrowTarget || performance.now() > arrowUntil) { el.classList.remove('on'); return; }
  const p = renderer.project(arrowTarget.x, 1, arrowTarget.z);
  const W = innerWidth, H = innerHeight, m = 40;
  if (!p) { el.classList.remove('on'); return; }
  const inside = p.x > m && p.x < W - m && p.y > m && p.y < H - m;
  let x = p.x, y = p.y, ang = Math.PI / 2;
  if (inside) { y = p.y - 70; ang = Math.PI / 2; }
  else {
    const cx = W / 2, cy = H / 2, dx = p.x - cx, dy = p.y - cy;
    const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
    x = cx + dx * s; y = cy + dy * s;
    ang = Math.atan2(dy, dx);
  }
  el.classList.add('on');
  el.style.transform = `translate(${x}px, ${y}px) rotate(${ang}rad)`;
}

// ---------- commandes ----------
export function createInput(onEvent) {
  const st = { mx: 0, mz: 0, held: false, events: [], keys: new Set(), stickId: null, ox: 0, oy: 0 };
  const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
  const R = 52;

  zone.addEventListener('pointerdown', (e) => {
    if (st.stickId !== null) return;
    st.stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    st.ox = e.clientX; st.oy = e.clientY;
    base.style.left = `${e.clientX - r.left}px`;
    base.style.top = `${e.clientY - r.top}px`;
    base.classList.add('on');
    zone.classList.add('used');
    knob.style.transform = '';
    e.preventDefault();
  });
  const moveStick = (e) => {
    if (e.pointerId !== st.stickId) return;
    let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, l / R), dead = 0.12;
    if (m < dead || l === 0) { st.mx = 0; st.mz = 0; return; }
    const s = Math.min(1, ((m - dead) / (1 - dead)) * 1.15);
    const n = Math.hypot(dx, dy);
    st.mx = (dx / n) * s;
    st.mz = (dy / n) * s;
  };
  const endStick = (e) => {
    if (e.pointerId !== st.stickId) return;
    st.stickId = null; st.mx = 0; st.mz = 0;
    base.classList.remove('on');
  };
  zone.addEventListener('pointermove', moveStick);
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  const btn = $('btn-action');
  let btnId = null;
  const down = () => { if (st.held) return; st.held = true; st.events.push('down'); btn.classList.add('pressed'); onEvent('down'); };
  const up = () => { if (!st.held) return; st.held = false; st.events.push('up'); btn.classList.remove('pressed'); onEvent('up'); };
  btn.addEventListener('pointerdown', (e) => { btnId = e.pointerId; btn.setPointerCapture(e.pointerId); down(); e.preventDefault(); });
  btn.addEventListener('pointerup', (e) => { if (e.pointerId === btnId) { btnId = null; up(); } });
  btn.addEventListener('pointercancel', (e) => { if (e.pointerId === btnId) { btnId = null; up(); } });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  // Clavier (test sur ordinateur) : ZQSD / WASD / flèches, Espace ou E pour agir.
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ((k === ' ' || k === 'e') && !e.repeat) { down(); e.preventDefault(); return; }
    st.keys.add(k);
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'e') { up(); return; }
    st.keys.delete(k);
  });
  addEventListener('blur', () => { st.keys.clear(); up(); });

  st.read = () => {
    let mx = st.mx, mz = st.mz;
    const K = st.keys;
    if (K.size) {
      let kx = 0, kz = 0;
      if (K.has('arrowleft') || K.has('a') || K.has('q')) kx -= 1;
      if (K.has('arrowright') || K.has('d')) kx += 1;
      if (K.has('arrowup') || K.has('w') || K.has('z')) kz -= 1;
      if (K.has('arrowdown') || K.has('s')) kz += 1;
      const l = Math.hypot(kx, kz);
      if (l) { mx = kx / l; mz = kz / l; }
    }
    const events = st.events;
    st.events = [];
    return { mx, mz, held: st.held, events };
  };
  st.inject = (e) => { if (e === 'down') down(); else up(); };
  return st;
}

// ---------- repères au-dessus des objets ----------
export class Labels {
  constructor() {
    this.root = $('labels');
    this.els = new Map();
  }
  el(id, cls = '') {
    let e = this.els.get(id);
    if (!e) {
      e = document.createElement('div');
      e.className = 'wl ' + cls;
      this.root.appendChild(e);
      this.els.set(id, e);
    }
    return e;
  }
  update(renderer, items) {
    const seen = new Set();
    for (const it of items) {
      const p = renderer.project(it.x, it.y, it.z);
      if (!p) continue;
      seen.add(it.id);
      const e = this.el(it.id);
      if (e.dataset.html !== it.html) { e.innerHTML = it.html; e.dataset.html = it.html; }
      e.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%)`;
      e.style.display = '';
    }
    for (const [id, e] of this.els) if (!seen.has(id)) e.style.display = 'none';
  }
  clear() { this.root.innerHTML = ''; this.els.clear(); }
}

const chip = (kind, text, extra = '') => `<div class="chip ${kind}${extra}"><span class="ic">${kind === 'duo' ? ICON.duo : ICON.solo}</span>${text}</div>`;
const gauge = (f, kind = 'solo', stuck = false) => `<div class="gauge ${kind}${stuck ? ' stuck' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></div>`;
const pill = (l, r) => `<div class="pill"><i class="${l || ''}"></i><i class="${r || ''}"></i></div>`;

export function worldLabels(st, myId, role, me) {
  const L = [];
  const add = (id, x, y, z, html) => L.push({ id, x, y, z, html });
  const pos = (id) => (id === myId ? me : st.players[id]);
  const near = (pt) => ['A', 'B'].find((id) => Math.hypot(pos(id).x - pt.x, pos(id).z - pt.z) < POST_R);

  add('ble', POS.ble.x, 1.6, POS.ble.z, chip('solo', 'Blé'));
  add('puits', POS.puits.x, 2.4, POS.puits.z, chip('solo', 'Puits'));
  add('sel', POS.sel.x, 1.3, POS.sel.z, chip('solo', 'Sel'));

  const m = st.moulin;
  let mh = chip('solo', 'Moulin', m.jam ? ' alert' : '');
  if (m.jam) mh += '<div class="wsub">Bloqué : garder appuyé pour débloquer</div>';
  else if (m.inp) mh += gauge(m.t / T.moulin);
  add('moulin', POS.moulin.x, 2.6, POS.moulin.z, mh);

  const P = st.petrin;
  let ph = chip('solo', 'Pétrin');
  if (P.out) ph += '<div class="wsub">Pâte prête</div>';
  else if (role === 'chef') {
    ph += `<div class="wsub">${['farine', 'eau', 'sel'].map((k) => `<span class="${P[k] ? 'ok' : 'no'}">${P[k] ? '✓' : '○'} ${k}</span>`).join(' · ')}</div>`;
  } else {
    const n = ['farine', 'eau', 'sel'].filter((k) => P[k]).length;
    ph += `<div class="wsub">Recette : ? · ${n}/3</div>`;
  }
  if (P.farine && P.eau && P.sel) ph += gauge(P.kneads / T.knead[role]);
  add('petrin', POS.petrin.x, 2.3, POS.petrin.z, ph);

  add('comptoir', POS.comptoir.x, 2.8, POS.comptoir.z, chip('solo', 'Livraison') + (st.orders.length ? `<div class="wsub">${st.orders.length} commande${st.orders.length > 1 ? 's' : ''}</div>` : ''));
  add('poubelle', POS.poubelle.x, 1.25, POS.poubelle.z, '<div class="wsub">Poubelle</div>');

  if (st.phase === 'crate') {
    const c = st.crate;
    const side = (s) => {
      const who = ['A', 'B'].find((id) => c.hand[id] === s);
      if (who) return who;
      const n = near({ x: c.x + (s === 'L' ? -1 : 1) * POS.handle, z: c.z });
      return n ? 'h' + n : '';
    };
    add('crate', c.x, 2.6, c.z, chip('duo', 'Four en kit') + pill(side('L'), side('R')));
    add('zone', POS.four.x, 0.4, POS.four.z, `<div class="wsub">${role === 'inge' ? 'Zone de montage du four' : 'Zone de montage'}</div>`);
  }
  if (st.phase === 'build') {
    const l = st.build.holder || (near(POS.postL) ? 'h' + near(POS.postL) : '');
    const rn = near(POS.postR);
    const r = rn ? (st.build.holder && st.build.holder !== rn ? rn : 'h' + rn) : '';
    add('chantier', POS.four.x, 2.7, POS.four.z, chip('duo', 'Montage') + pill(l, r) + gauge(st.build.progress, 'duo'));
    add('postL', POS.postL.x, 0.5, POS.postL.z, `<div class="wsub">${role === 'inge' ? 'Tenir' : '?'}</div>`);
    add('postR', POS.postR.x, 0.5, POS.postR.z, `<div class="wsub">${role === 'inge' ? 'Visser' : '?'}</div>`);
  }
  if (st.phase === 'bake' || st.phase === 'won') {
    const F = st.four;
    const lv = (s) => {
      if (F.leverBy[s]) return F.leverBy[s];
      const n = near(s === 'L' ? POS.postL : POS.postR);
      return n ? 'h' + n : '';
    };
    const one = !!(F.leverBy.L || F.leverBy.R);
    let fh = chip('duo', 'Four') + pill(lv('L'), lv('R'));
    if (F.bake > 0) fh += gauge(1 - F.bake / T.bake);
    else if (one) fh += gauge(0.5, 'duo', true);
    else if (F.out) fh += '<div class="wsub">Pain cuit</div>';
    else if (F.inp) fh += '<div class="wsub">Prêt : deux leviers</div>';
    add('four', POS.four.x, 2.9, POS.four.z, fh);
    add('postL', POS.postL.x, 0.5, POS.postL.z, '<div class="wsub">Levier</div>');
    add('postR', POS.postR.x, 0.5, POS.postR.z, '<div class="wsub">Levier</div>');
  }

  for (const id of ['A', 'B']) {
    const p = pos(id), sp = st.players[id];
    const mine = id === myId;
    let html = '';
    if (sp.wait) html += `<div class="bubble">${sp.wait}</div>`;
    const w = st.work[id];
    if (w) html += gauge(w.t / w.dur);
    html += `<div class="ptag ${id}">${mine ? 'Toi' : 'Partenaire'} · ${ROLES[st.roles[id]].short}</div>`;
    add('p' + id, p.x, 1.72, p.z, html);
  }
  return L;
}
