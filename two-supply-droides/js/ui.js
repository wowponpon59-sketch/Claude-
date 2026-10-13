// Interface : écrans, HUD, commandes tactiles, caméra et repères au-dessus des objets.
import {
  ITEMS, ITEM_ORDER, SAC_MAX, NODE_TYPES, MACHINES, PLOTS, ENTREPOT, CORE, DROIDS, SPEC_ORDER, ORG,
  ANIMALS, LEVELS, POST_R, PLAYER_COLORS, T, other,
} from './config.js';
import { NODES, height } from './world.js';
import { postL, postR, plotUnlocked, cadence, goalStatus } from './sim.js';

const $ = (id) => document.getElementById(id);

export const ICON = {
  solo: '<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3.3"/><path d="M4 18v-2.4a6 6 0 0 1 12 0V18z"/></svg>',
  duo: '<svg viewBox="0 0 26 20"><circle cx="8" cy="6" r="3"/><path d="M2.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/><circle cx="18" cy="6" r="3"/><path d="M12.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10h.5V4a1.5 1.5 0 0 1 3 0v6h.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6.8 6.8 0 0 1-5.6-2.9L3 14.2a1.5 1.5 0 0 1 2.3-1.9L8 15z"/></svg>',
};

// Pictogrammes des matières
export function itemIcon(k) {
  const c = ITEMS[k].css;
  const paths = {
    fer: `<path d="M3 15l3-7h12l3 7z" fill="${c}"/><path d="M6 8h12l-1-2H7z" fill="#b07a55"/>`,
    verre: `<path d="M6 3l9 2-3 16-7-5z" fill="${c}" opacity=".85"/><path d="M15 5l4 3-5 9z" fill="#b8eef0" opacity=".9"/>`,
    argile: `<path d="M4 17c0-6 4-10 8-10s8 4 8 10z" fill="${c}"/><circle cx="9" cy="12" r="1.3" fill="#8a4426"/>`,
    calcaire: `<path d="M4 9l6-4 9 3 1 9-8 3-8-3z" fill="${c}"/><path d="M10 5l2 15" stroke="#b5ad9a" stroke-width="1"/>`,
    eau: `<path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="${c}"/>`,
    carcasse: `<rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M5 12h14" stroke="${c}" stroke-width="2"/>`,
    circuit: `<rect x="6" y="6" width="12" height="12" rx="1.5" fill="${c}"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="#9fd8b4" stroke-width="1.4"/>`,
  };
  return `<svg class="mi" viewBox="0 0 24 24" aria-label="${ITEMS[k].name}">${paths[k]}</svg>`;
}
const count = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const listItems = (o, cls = '') => ITEM_ORDER.filter((k) => (o[k] || 0) > 0).map((k) => `<span class="it ${cls}">${itemIcon(k)}${o[k]}</span>`).join('');

// ---------- écrans ----------
export function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
export function overlay(id, on) { $(id).classList.toggle('active', on); }
export function isOverlay() { return [...document.querySelectorAll('.screen.overlay.active')].length > 0; }
export function setMsg(id, text, err = false) { const el = $(id); el.textContent = text || ''; el.classList.toggle('err', !!err); }
export function setPlayerColors(myId) {
  const r = document.documentElement.style;
  r.setProperty('--me', PLAYER_COLORS[myId].css);
  r.setProperty('--them', PLAYER_COLORS[other(myId)].css);
}

// ---------- HUD ----------
let levelOpen = false;
export function bindHud() {
  $('level-card').addEventListener('click', () => { levelOpen = !levelOpen; $('level-card').classList.toggle('open', levelOpen); });
}

export function updateHud(st, myId, extra) {
  const me = st.players[myId];
  const L = LEVELS[st.level];
  const done = L.goals.filter((g) => st.goals[g.id]).length;
  $('level-name').textContent = `Niveau ${st.level + 1} · ${L.name}`;
  $('level-count').textContent = `${done}/${L.goals.length}`;
  const next = L.goals.find((g) => !st.goals[g.id]);
  $('level-next').textContent = st.won ? 'Prototype terminé : bravo !' : next ? next.text : '';
  const gl = L.goals.map((g) => `<li class="${st.goals[g.id] ? 'ok' : ''}">${g.text}</li>`).join('');
  if ($('level-goals').dataset.sig !== gl) { $('level-goals').innerHTML = gl; $('level-goals').dataset.sig = gl; }

  const sac = count(me.sac);
  const sacHtml = `<span class="lbl">Sac ${sac}/${SAC_MAX}</span>${listItems(me.sac) || '<span class="empty">vide</span>'}`;
  if ($('sac').dataset.sig !== sacHtml) { $('sac').innerHTML = sacHtml; $('sac').dataset.sig = sacHtml; }
  $('sac').classList.toggle('full', sac >= SAC_MAX);

  const stock = listItems(st.stock) || '<span class="empty">vide</span>';
  const sh = `<span class="lbl">Entrepôt</span>${stock}`;
  if ($('stock').dataset.sig !== sh) { $('stock').innerHTML = sh; $('stock').dataset.sig = sh; }

  $('mode-name').textContent = st.mode === 'solo' ? `Solo · coéquipier IA : ${extra.bot || 'te suit'}` : 'À deux';

  const btn = $('btn-action');
  const h = me.hint;
  btn.classList.toggle('duo', !!(h && h.kind === 'duo' && !h.off));
  btn.classList.toggle('off', !!(h && h.off));
  btn.classList.toggle('none', !h);
  $('action-label').textContent = h ? h.label : 'Action';
  const icon = h ? (h.kind === 'duo' ? ICON.duo : ICON.solo) : ICON.hand;
  const ic = $('action-icon');
  if (ic.dataset.k !== icon) { ic.innerHTML = icon; ic.dataset.k = icon; }
  $('btn-call').classList.toggle('hidden', st.mode === 'solo');
}

// ---------- panneau Usine ----------
export function fillUsine(st, tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  let html = '';
  if (tab === 'entrepot') {
    html += `<div class="block"><h4>Entrepôt</h4><div class="items big">${listItems(st.stock) || '<span class="empty">Vide : fouillez les débris et déposez ici.</span>'}</div></div>`;
    html += '<div class="block"><h4>Machines</h4>';
    const ms = Object.values(st.machines);
    if (!ms.length) html += '<p class="muted">Aucune machine construite pour l’instant.</p>';
    for (const m of ms) {
      const def = MACHINES[m.type];
      const state = m.broken ? '<b class="bad">En panne</b>' : m.run ? '<b class="good">En marche</b>' : 'À l’arrêt';
      const op = m.operator ? 'droïde ouvrier' : m.busy ? 'formation en cours' : 'personne';
      html += `<div class="mrow"><div><b>${def.name}</b><span class="muted"> · ${def.desc}</span></div><div class="muted">${state} · cadence ${Math.round(cadence(m) * 100)} % · opérateur : ${op}${m.animals.length ? ' · ' + m.animals.map((a) => ANIMALS[a].name).join(', ') : ''}</div></div>`;
    }
    html += '</div><div class="block"><h4>Recettes</h4>';
    for (const k of ['forge', 'circuits', 'assembleur']) html += `<div class="mrow"><b>${MACHINES[k].name}</b> <span class="muted">${MACHINES[k].desc} · ${MACHINES[k].recipe.time} s à 100 %</span></div>`;
    html += `<div class="mrow"><b>Créatures</b> <span class="muted">Chaque créature installée ajoute ${Math.round(T.animalBoost * 100)} % de cadence, pour toujours (${T.animalMax} max par machine).</span></div></div>`;
  } else if (tab === 'org') {
    const n = (id) => st.droids.filter((d) => d.type === id).length;
    const card = (o) => {
      const dispo = o.status === 'dispo';
      const cnt = dispo ? n(o.id) : 0;
      const color = DROIDS[o.id] ? DROIDS[o.id].css : '#7c8590';
      return `<div class="org-card ${dispo ? '' : 'prevu'}" style="--c:${color}"><b>${o.name}</b><span>${o.kit}</span><em>${dispo ? (cnt ? cnt + ' dans l’usine' : 'Disponible') : 'Prochaine version'}</em></div>`;
    };
    const by = Object.fromEntries(ORG.map((o) => [o.id, o]));
    const rows = [['chef'], ['adjoint'], ['process', 'ingenieur'], ['production', 'logistique', 'achat', 'maintenance'], ['ouvrier']];
    html += '<p class="muted">Vos droïdes deviennent vos employés. Chaque poste se forme à l’atelier de spécialisation à partir d’un droïde standard et d’un kit.</p><div class="org">';
    for (const r of rows) html += `<div class="org-row">${r.map((id) => card(by[id])).join('')}</div>`;
    html += '</div>';
  } else if (tab === 'betes') {
    html += '<p class="muted">Créatures du terrain vague, mi-vivantes mi-ferraille. Seul, impossible de les attraper : l’un les rabat, l’autre les attrape. Une fois installées sur une machine, elles augmentent sa cadence pour toujours.</p>';
    for (const [k, a] of Object.entries(ANIMALS)) {
      const n = st.animals.filter((x) => x.sp === k && x.st === 'installed').length;
      html += `<div class="mrow"><b>${a.name}</b> <span class="muted">${a.desc} · installés : ${n}</span></div>`;
    }
  }
  $('usine-body').innerHTML = html;
}

// ---------- menu de spécialisation ----------
export function fillSpec(st, myId, onPick) {
  const p = st.players[myId];
  const have = (k) => (p.sac[k] || 0) + (st.stock[k] || 0);
  const body = $('spec-body');
  body.innerHTML = SPEC_ORDER.map((type) => {
    const d = DROIDS[type];
    const ok = Object.entries(d.cost).every(([k, n]) => have(k) >= n);
    const cost = Object.entries(d.cost).map(([k, n]) => `<span class="it ${have(k) >= n ? '' : 'miss'}">${itemIcon(k)}${n}</span>`).join('');
    return `<button class="spec-card" data-type="${type}" ${ok ? '' : 'disabled'} style="--c:${d.css}"><b>${d.name}</b><span class="muted">${d.desc}</span><span class="kit">${d.kit} : ${cost}</span>${ok ? '' : '<em>Il manque des matériaux (sac + entrepôt)</em>'}</button>`;
  }).join('');
  body.querySelectorAll('.spec-card').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) onPick(b.dataset.type); }));
}

// ---------- notifications ----------
export function toast(text, tone = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  el.textContent = text;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3400);
  setTimeout(() => el.remove(), 3900);
}
export function banner(title, sub) {
  const el = $('banner');
  el.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

let arrowUntil = 0, arrowTarget = null;
export function pointTo(x, z, seconds = 4) { arrowTarget = { x, z }; arrowUntil = performance.now() + seconds * 1000; }
export function updateArrow(renderer) {
  const el = $('edge-arrow');
  if (!arrowTarget || performance.now() > arrowUntil) { el.classList.remove('on'); return; }
  const p = renderer.project(arrowTarget.x, height(arrowTarget.x, arrowTarget.z) + 1, arrowTarget.z);
  const W = innerWidth, H = innerHeight, m = 44;
  let x, y, ang;
  if (p && p.x > m && p.x < W - m && p.y > m && p.y < H - m) { x = p.x; y = p.y - 60; ang = Math.PI / 2; }
  else {
    const cx = W / 2, cy = H / 2;
    let dx, dy;
    if (p) { dx = p.x - cx; dy = p.y - cy; }
    else { const q = renderer.project(arrowTarget.x, 0, arrowTarget.z); dx = 0; dy = H; if (q) { dx = cx - q.x; dy = cy - q.y; } }
    const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
    x = cx + dx * s; y = cy + dy * s; ang = Math.atan2(dy, dx);
  }
  el.classList.add('on');
  el.style.transform = `translate(${x}px, ${y}px) rotate(${ang}rad)`;
}

// ---------- commandes : joystick, bouton, caméra ----------
export function createInput(onEvent, cam) {
  const st = { mx: 0, mz: 0, held: false, events: [], keys: new Set(), stickId: null, ox: 0, oy: 0, looks: new Map(), pinch: 0 };
  const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob'), look = $('look-zone');
  const R = 52;
  zone.addEventListener('pointerdown', (e) => {
    if (st.stickId !== null) return;
    st.stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    st.ox = e.clientX; st.oy = e.clientY;
    base.style.left = `${e.clientX - r.left}px`; base.style.top = `${e.clientY - r.top}px`;
    base.classList.add('on'); zone.classList.add('used');
    knob.style.transform = '';
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== st.stickId) return;
    let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, l / R), dead = 0.12;
    if (m < dead || l === 0) { st.mx = 0; st.mz = 0; return; }
    const s = Math.min(1, ((m - dead) / (1 - dead)) * 1.15), n = Math.hypot(dx, dy);
    st.mx = (dx / n) * s; st.mz = (dy / n) * s;
  });
  const endStick = (e) => { if (e.pointerId !== st.stickId) return; st.stickId = null; st.mx = 0; st.mz = 0; base.classList.remove('on'); };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  // Caméra : glisser pour tourner, pincer pour zoomer
  look.addEventListener('pointerdown', (e) => { look.setPointerCapture(e.pointerId); st.looks.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.preventDefault(); });
  look.addEventListener('pointermove', (e) => {
    const prev = st.looks.get(e.pointerId);
    if (!prev) return;
    if (st.looks.size >= 2) {
      const pts = [...st.looks.values()];
      const d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      st.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const q = [...st.looks.values()];
      const d1 = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
      if (d0 > 10) cam.zoomBy(d0 / d1);
      return;
    }
    cam.rotate((e.clientX - prev.x) * 0.0075, (e.clientY - prev.y) * 0.004);
    st.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const endLook = (e) => st.looks.delete(e.pointerId);
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);
  addEventListener('wheel', (e) => { cam.zoomBy(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: true });
  $('btn-zin').addEventListener('click', () => cam.zoomBy(0.8));
  $('btn-zout').addEventListener('click', () => cam.zoomBy(1.25));

  const btn = $('btn-action');
  let btnId = null;
  const down = () => { if (st.held) return; st.held = true; st.events.push('down'); btn.classList.add('pressed'); onEvent('down'); };
  const up = () => { if (!st.held) return; st.held = false; st.events.push('up'); btn.classList.remove('pressed'); onEvent('up'); };
  btn.addEventListener('pointerdown', (e) => { btnId = e.pointerId; btn.setPointerCapture(e.pointerId); down(); e.preventDefault(); });
  btn.addEventListener('pointerup', (e) => { if (e.pointerId === btnId) { btnId = null; up(); } });
  btn.addEventListener('pointercancel', (e) => { if (e.pointerId === btnId) { btnId = null; up(); } });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ((k === ' ' || k === 'e') && !e.repeat) { down(); e.preventDefault(); return; }
    if (k === 'a' && !e.repeat) cam.rotate(-0.25, 0);
    if (k === 'r' && !e.repeat) cam.rotate(0.25, 0);
    st.keys.add(k);
  });
  addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'e') { up(); return; } st.keys.delete(k); });
  addEventListener('blur', () => { st.keys.clear(); up(); });

  st.read = () => {
    let mx = st.mx, mz = st.mz;
    const K = st.keys;
    if (K.size) {
      let kx = 0, kz = 0;
      if (K.has('arrowleft') || K.has('q')) kx -= 1;
      if (K.has('arrowright') || K.has('d')) kx += 1;
      if (K.has('arrowup') || K.has('z') || K.has('w')) kz -= 1;
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

// ---------- repères dans le monde ----------
export class Labels {
  constructor() { this.root = $('labels'); this.els = new Map(); }
  update(renderer, items) {
    const seen = new Set();
    for (const it of items) {
      const p = renderer.project(it.x, it.y, it.z);
      if (!p) continue;
      seen.add(it.id);
      let e = this.els.get(it.id);
      if (!e) { e = document.createElement('div'); e.className = 'wl'; this.root.appendChild(e); this.els.set(it.id, e); }
      if (e.dataset.html !== it.html) { e.innerHTML = it.html; e.dataset.html = it.html; }
      e.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%)`;
      e.style.zIndex = String(1000 - Math.round(p.depth * 10));
      e.style.display = '';
    }
    for (const [id, e] of this.els) if (!seen.has(id)) e.style.display = 'none';
  }
  clear() { this.root.innerHTML = ''; this.els.clear(); }
}

const chip = (kind, text, extra = '') => `<div class="chip ${kind}${extra}"><span class="ic">${kind === 'duo' ? ICON.duo : ICON.solo}</span>${text}</div>`;
const gauge = (f, kind = '') => `<div class="gauge ${kind}"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></div>`;
const pill = (l, r) => `<div class="pill"><i class="${l || ''}"></i><i class="${r || ''}"></i></div>`;
const sub = (html) => `<div class="wsub">${html}</div>`;

export function worldLabels(st, myId, me, focus) {
  const L = [];
  const add = (id, x, y, z, html) => L.push({ id, x, y, z, html });
  const pos = (id) => (id === myId ? me : st.players[id]);
  const near = (pt) => ['A', 'B'].find((id) => Math.hypot(pos(id).x - pt.x, pos(id).z - pt.z) < POST_R);
  const within = (x, z, r) => Math.hypot(x - focus.x, z - focus.z) < r;

  NODES.forEach((n, i) => {
    if (!within(n.x, n.z, 15)) return;
    const t = NODE_TYPES[n.type], q = st.nodes[i];
    const y = height(n.x, n.z) + (n.type === 'epave' ? 1.9 : 1.5);
    add('n' + i, n.x, y, n.z, chip('solo', `${itemIcon(t.item)} ${t.name}`, q ? '' : ' dim') + sub(q ? `${q} à fouiller` : `vide · ${Math.ceil(st.nodeT[i])} s`));
  });

  if (within(ENTREPOT.x, ENTREPOT.z, 22)) add('entrepot', ENTREPOT.x, 2.6, ENTREPOT.z, chip('solo', 'Entrepôt') + sub(listItems(st.stock) || 'vide'));

  for (const p of PLOTS) {
    if (!within(p.x, p.z, 26)) continue;
    const ps = st.plots[p.id], base = MACHINES[p.type], def = { ...base, name: p.id.endsWith('2') ? base.name + ' n°2' : base.name };
    if (!plotUnlocked(st, p)) { if (within(p.x, p.z, 7)) add('p' + p.id, p.x, 1.0, p.z, sub(`${def.name} · niveau ${p.level}`)); continue; }
    if (!ps.built) {
      if (ps.ready) {
        const l = ps.holder || (near(postL(p)) ? 'h' + near(postL(p)) : '');
        const rn = near(postR(p));
        const r = rn ? (ps.holder && ps.holder !== rn ? rn : 'h' + rn) : '';
        add('p' + p.id, p.x, 3.0, p.z, chip('duo', def.name) + pill(l, r) + gauge(ps.prog, 'duo') + sub('Montage à deux : tenir à gauche, visser à droite'));
      } else {
        const miss = {};
        for (const [k, n] of Object.entries(def.cost)) miss[k] = Math.max(0, n - (ps.del[k] || 0));
        const coreTxt = def.core && !st.core.placed ? ' · + cœur d’assembleur' : '';
        add('p' + p.id, p.x, 2.4, p.z, chip('solo', `Chantier : ${def.name}`) + sub(count(miss) ? 'Il manque ' + listItems(miss) + coreTxt : 'Matériaux livrés' + coreTxt));
      }
      continue;
    }
    const m = st.machines[p.id];
    const rec = def.recipe;
    let html = chip('solo', `${def.name} · ${Math.round(cadence(m) * 100)} %`, m.broken ? ' alert' : '');
    if (m.broken) html += sub('Panne : garder appuyé pour réparer');
    else if (rec) {
      const inp = Object.keys(rec.in).map((k) => `<span class="it ${(m.inp[k] || 0) >= rec.in[k] ? '' : 'miss'}">${itemIcon(k)}${m.inp[k] || 0}</span>`).join('');
      const out = rec.out !== 'droide' && m.out ? ` → ${itemIcon(rec.out)}${m.out}` : '';
      html += sub(inp + out + (m.operator ? ' · droïde' : ''));
      if (m.run || m.t > 0) html += gauge(m.t / rec.time);
    } else html += sub(m.busy ? 'Formation en cours…' : 'Amène un droïde standard');
    add('p' + p.id, p.x, p.type === 'assembleur' ? 3.5 : 2.7, p.z, html);
  }

  if (!st.core.placed && within(st.core.x, st.core.z, 30)) {
    const c = st.core;
    const side = (s) => {
      const who = ['A', 'B'].find((id) => c.hand[id] === s);
      if (who) return who;
      const n = near({ x: c.x + (s === 'L' ? -1 : 1) * CORE.handle, z: c.z });
      return n ? 'h' + n : '';
    };
    add('core', c.x, height(c.x, c.z) + 2.0, c.z, chip('duo', 'Cœur d’assembleur') + pill(side('L'), side('R')) + sub('À porter à deux jusqu’à l’assembleur'));
  }

  for (const d of st.droids) {
    if (!within(d.x, d.z, 12) || d.st === 'spec') continue;
    const def = DROIDS[d.type];
    const what = d.st === 'idle' ? ' · libre' : d.st === 'follow' ? ' · te suit' : '';
    add('d' + d.id, d.x, height(d.x, d.z) + 1.55, d.z, `<div class="dtag" style="--c:${def.css}">${def.name}${what}</div>`);
  }

  for (const a of st.animals) {
    if (!within(a.x, a.z, 16) || a.st === 'installed') continue;
    const def = ANIMALS[a.sp];
    const y = height(a.x, a.z) + (a.sp === 'vitrelle' ? 2.4 : 1.4);
    let s = '';
    if (a.st === 'corner') s = sub('Encerclé : attrape-le !');
    else if (a.st === 'flee') s = sub('Il fuit : prenez-le en tenaille');
    else if (a.st === 'caught') s = sub('Capturé : installe-le sur une machine');
    add('a' + a.id, a.x, y, a.z, chip('duo', def.name) + s);
  }

  for (const id of ['A', 'B']) {
    const p = pos(id), sp = st.players[id];
    const mine = id === myId;
    let html = '';
    if (sp.wait) html += `<div class="bubble">${sp.wait}</div>`;
    const w = st.work[id];
    if (w && w.kind === 'dig') html += gauge(w.t / T.dig);
    if (w && w.kind === 'repair') html += gauge(w.t / T.repair);
    const who = mine ? 'Toi' : st.mode === 'solo' ? 'Coéquipier IA' : 'Partenaire';
    html += `<div class="ptag ${id}">${who}</div>`;
    add('pl' + id, p.x, height(p.x, p.z) + 2.1, p.z, html);
  }
  return L;
}
