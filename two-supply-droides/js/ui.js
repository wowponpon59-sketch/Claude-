// Interface : écrans, HUD, menus, commandes tactiles, caméra et repères au-dessus des objets.
import {
  ITEMS, ITEM_ORDER, RAW, RAW_LEVEL, SAC_MAX, NODE_TYPES, MACHINES, PLOTS, ENTREPOT, CORE, DROIDS, SPEC_ORDER,
  ANIMALS, LEVELS, POST_R, PLAYER_COLORS, T, RECIPES, OUTFITS, PACK, LOOKS, SLOTS, QC_BASES, LABEL_RANGE, ANIMAL_RANGE, REACH, PAUSE, RAW_CONTENT, RECYCLABLE, other,
} from './config.js';
import { NODES, height, PLOT_BY_ID, plotBox } from './world.js';
import { postL, postR, plotUnlocked, cadence, recipeAvail, activeOrders, needPower, isProd, genFill, genText, apart, goalProgress, packPrice, waitWhy, anyMatch, recipeCapped, reserveOf } from './sim.js';
import { boxDist } from './move.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const ICON = {
  solo: '<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3.3"/><path d="M4 18v-2.4a6 6 0 0 1 12 0V18z"/></svg>',
  duo: '<svg viewBox="0 0 26 20"><circle cx="8" cy="6" r="3"/><path d="M2.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/><circle cx="18" cy="6" r="3"/><path d="M12.5 18v-2.2a5.5 5.5 0 0 1 11 0V18z"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10h.5V4a1.5 1.5 0 0 1 3 0v6h.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6.8 6.8 0 0 1-5.6-2.9L3 14.2a1.5 1.5 0 0 1 2.3-1.9L8 15z"/></svg>',
};

// ---------- pictogrammes : une forme et une couleur par matière ----------
const RBADGE = '<circle cx="18.5" cy="5.5" r="4.6" fill="#ef5a50" stroke="#15171a" stroke-width="1"/><path d="M16.6 3.6l3.8 3.8M20.4 3.6l-3.8 3.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>';
const QBADGE = '<circle cx="18.5" cy="5.5" r="4.6" fill="#f5c400" stroke="#15171a" stroke-width="1"/><path d="M17.1 4.4a1.5 1.5 0 1 1 2.1 1.4c-.5.3-.7.6-.7 1.1M18.5 8.2v.1" stroke="#15171a" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
const SHAPES = {
  fer: (c) => `<path d="M4 5h16v3.4h-5.6v7.2H20V19H4v-3.4h5.6V8.4H4z" fill="${c}" stroke="#4d5a68" stroke-width=".8"/><circle cx="6" cy="6.7" r=".9" fill="#4d5a68"/><circle cx="18" cy="17.3" r=".9" fill="#4d5a68"/>`,
  verre: (c) => `<path d="M5 20L9 3l4 9z" fill="${c}" opacity=".9"/><path d="M12 20l3-14 5 9z" fill="${c}" opacity=".65"/><path d="M9 5l-2 9" stroke="#fff" stroke-width="1" opacity=".8"/>`,
  argile: (c) => `<path d="M3 18c1-6 4.5-10 9-10s8 4 9 10z" fill="${c}"/><path d="M5.5 15.5c2-1.5 4-1.6 6.5-.6s4.6.9 6.5-.4" stroke="#7a2412" stroke-width="1.4" fill="none"/><ellipse cx="10" cy="11" rx="2.2" ry="1" fill="#e3836a" opacity=".8"/>`,
  calcaire: (c) => `<path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z" fill="${c}" stroke="#9d9584" stroke-width="1"/><path d="M12 3v18M4 7.6l16 8.8" stroke="#b7ae99" stroke-width=".8"/>`,
  eau: (c) => `<path d="M12 2.5c4.2 6 6.3 9.2 6.3 12.3a6.3 6.3 0 0 1-12.6 0c0-3.1 2.1-6.3 6.3-12.3z" fill="${c}"/><path d="M9 15a3 3 0 0 0 2 3" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  cuivre: (c) => `<path d="M12 4a8 8 0 1 0 7.6 5.5M12 8a4 4 0 1 0 3.8 2.8" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="19.6" cy="9.4" r="1.6" fill="#ffd27a"/>`,
  caoutchouc: (c) => `<circle cx="12" cy="12" r="7.8" fill="none" stroke="${c}" stroke-width="4.4"/><circle cx="12" cy="12" r="10" fill="none" stroke="#a7adb6" stroke-width="1" stroke-dasharray="2.2 2"/><circle cx="12" cy="12" r="3" fill="#a7adb6"/>`,
  sable: (c) => `<path d="M2 19c3-7 6-10 10-10s7 3 10 10z" fill="${c}"/><g fill="#b39443"><circle cx="9" cy="15" r=".8"/><circle cx="13" cy="13" r=".8"/><circle cx="15" cy="16.5" r=".8"/><circle cx="11" cy="17.5" r=".8"/></g>`,
  charbon: (c) => `<path d="M3 16l3-7 5 1 2-4 6 3 2 7-6 4-8-1z" fill="${c}" stroke="#8b919b" stroke-width="1.1"/><path d="M11 10l2 5-5 2" stroke="#55595f" stroke-width=".9" fill="none"/><circle cx="16" cy="15" r="1.4" fill="#ff7a1a"/>`,
  plastique: (c) => `<path d="M6 7h9l3 3v10H6z" fill="${c}"/><path d="M8 7V4h5v3" stroke="${c}" stroke-width="2" fill="none"/><path d="M15 4h3v3" stroke="#f4a6cb" stroke-width="1.6" fill="none"/><rect x="8.5" y="11" width="6" height="5" rx="1" fill="#f9c9df" opacity=".8"/>`,
  bois: (c) => `<rect x="3" y="7" width="18" height="10" rx="1.5" fill="${c}"/><path d="M5 10c3 1 6-1 9 0s4 1 5 0M5 14c3 1 5-1 8 0s4 1 6 0" stroke="#6e4a22" stroke-width="1" fill="none"/><circle cx="16" cy="12" r="1.2" fill="none" stroke="#6e4a22" stroke-width=".9"/>`,
  carcasse: (c) => `<rect x="5" y="4" width="14" height="16" rx="4" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M5 11h14M12 4v16" stroke="${c}" stroke-width="1.6"/>`,
  circuit: (c) => `<rect x="6" y="6" width="12" height="12" rx="1.5" fill="${c}"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="#9fd8b4" stroke-width="1.4"/><rect x="9.5" y="9.5" width="5" height="5" fill="#1e6b3f"/>`,
  fil: (c) => `<rect x="4" y="5" width="3" height="14" rx="1" fill="#6b5a46"/><rect x="17" y="5" width="3" height="14" rx="1" fill="#6b5a46"/><rect x="7" y="7" width="10" height="10" fill="${c}"/><path d="M7 9h10M7 11h10M7 13h10M7 15h10" stroke="#a85a12" stroke-width=".8"/>`,
  lingot: (c) => `<path d="M3 17l3-8h12l3 8z" fill="${c}" stroke="#4d5a68" stroke-width=".8"/><path d="M6 9h12l1.2 3H4.8z" fill="#c3cfdb"/>`,
  tole: (c) => `<path d="M3 16l4-4h14l-4 4z" fill="#7f8c9a"/><path d="M3 13l4-4h14l-4 4z" fill="${c}"/><path d="M3 10l4-4h14l-4 4z" fill="#dbe3ec"/>`,
  silicium: (c) => `<circle cx="12" cy="12" r="8.5" fill="${c}"/><path d="M6 9h12M5 12h14M6 15h12M9 5v14M12 3.5v17M15 5v14" stroke="#c9c1ff" stroke-width=".7"/><path d="M8 19.5h8" stroke="#2a1f8a" stroke-width="2"/>`,
  circuitA: (c) => `<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="${c}"/><path d="M9 3v2.5M12 3v2.5M15 3v2.5M9 18.5V21M12 18.5V21M15 18.5V21M3 9h2.5M3 15h2.5M18.5 9H21M18.5 15H21" stroke="#ffe38a" stroke-width="1.4"/><path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2l-2.5 1.4.6-2.8L8 10.9l2.8-.3z" fill="#7a5600"/>`,
  isolant: (c) => `<rect x="10.5" y="2" width="3" height="20" rx="1" fill="#6b7480"/><g fill="${c}" stroke="#2b5fb8" stroke-width="1.1"><ellipse cx="12" cy="6" rx="7" ry="2.2"/><ellipse cx="12" cy="11" rx="8" ry="2.4"/><ellipse cx="12" cy="16" rx="7" ry="2.2"/></g>`,
  carton: (c) => `<path d="M3 9l9-4 9 4v10l-9 3-9-3z" fill="${c}"/><path d="M3 9l9 4 9-4M12 13v9" stroke="#8a6232" stroke-width="1"/><path d="M7.5 7l9 4" stroke="#e8c896" stroke-width="1.3"/>`,
  caisse: (c) => `<rect x="3" y="5" width="18" height="15" rx="1.5" fill="${c}"/><path d="M3 9h18M3 16h18" stroke="#8a5f17" stroke-width="1.2"/><circle cx="12" cy="12.5" r="2.6" fill="#3a2a10"/><rect x="10" y="12" width="4" height="1" fill="#ffd27a"/>`,
  colis: (c) => `<rect x="3" y="6" width="18" height="14" rx="1.5" fill="${c}"/><path d="M12 6v14" stroke="#9c6e31" stroke-width="3"/><path d="M15 10h4m-2-2l2 2-2 2" stroke="#3b6fd6" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
};
export function itemIcon(k) {
  const def = ITEMS[k];
  if (!def) return '';
  let inner;
  if (def.kind === 'kit') {
    inner = `<rect x="3" y="7" width="18" height="13" rx="2.5" fill="${def.css}" stroke="#15171a" stroke-width=".8"/><path d="M9 7V5h6v2" stroke="${def.css}" stroke-width="2" fill="none"/><text x="12" y="17.2" text-anchor="middle" font-size="8.5" font-weight="800" font-family="Barlow, sans-serif" fill="${k === 'k_lecteur' || k === 'k_planning' ? '#15171a' : '#fff'}">${def.glyph}</text>`;
  } else if (def.kind === 'decl') {
    inner = `<g opacity=".75">${SHAPES[def.base](def.css)}</g>` + QBADGE;
  } else if (def.kind === 'rebut') {
    inner = `<g opacity=".55" filter="grayscale(1)">${SHAPES[def.base]('#7d8288')}</g>` + RBADGE;
  } else {
    inner = SHAPES[k](def.css);
  }
  return `<svg class="mi" viewBox="0 0 24 24" role="img" aria-label="${esc(def.name)}"><title>${esc(def.name)}</title>${inner}</svg>`;
}
const count = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export const listItems = (o, cls = '') => ITEM_ORDER.filter((k) => (o[k] || 0) > 0).map((k) => `<span class="it ${cls}">${itemIcon(k)}${o[k]}</span>`).join('');
const recipeLine = (rid) => {
  const r = RECIPES[rid];
  if (r.any === 'decl') return `<span class="it">${itemIcon('circuit_d')}</span><span class="arrow">→</span><span class="it">${itemIcon('circuit')}</span><span class="muted">ou</span><span class="it">${itemIcon('circuit_r')}</span>`;
  if (r.any === 'rebut') return `<span class="it">${itemIcon('carcasse_r')}</span><span class="arrow">→</span><span class="it">${itemIcon('fer')}</span><span class="muted">matière d’origine</span>`;
  if (r.any === 'surplus') return `<span class="it">${itemIcon('isolant')}</span><span class="arrow">→</span><span class="it">${itemIcon('argile')}</span><span class="muted">la moitié des matières</span>`;
  const side = (o) => Object.entries(o).map(([k, n]) => (k === 'droide' ? `<span class="it">🤖 ${n}</span>` : `<span class="it">${itemIcon(k)}${n}</span>`)).join('');
  return `${side(r.in)}<span class="arrow">→</span>${side(r.out)}`;
};
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
const setHtml = (el, html) => { if (el.dataset.sig !== html) { el.innerHTML = html; el.dataset.sig = html; } };

export function updateHud(st, myId, extra) {
  const me = st.players[myId];
  const L = LEVELS[st.level];
  const done = L.goals.filter((g) => st.goals[g.id]).length;
  const gtext = (g) => { const pr = !st.goals[g.id] && goalProgress(st, g); return g.text + (pr ? ` (${pr[0]}/${pr[1]})` : ''); };
  $('level-name').textContent = `Niveau ${st.level + 1}/${LEVELS.length} · ${L.name}`;
  $('level-count').textContent = `${done}/${L.goals.length}`;
  const next = L.goals.find((g) => !st.goals[g.id]);
  $('level-next').textContent = st.won ? 'Usine terminée : bravo !' : next ? gtext(next) : '';
  setHtml($('level-goals'), (L.rodage ? '<li class="tagr">Rodage : profitez de votre usine</li>' : '') + L.goals.map((g) => `<li class="${st.goals[g.id] ? 'ok' : ''}">${gtext(g)}</li>`).join(''));

  const sac = count(me.sac);
  setHtml($('sac'), `<span class="lbl">Sac ${sac}/${SAC_MAX}</span>${listItems(me.sac) || '<span class="empty">vide</span>'}`);
  $('sac').classList.toggle('full', sac >= SAC_MAX);
  setHtml($('stock'), `<span class="lbl">Entrepôt</span>${listItems(st.stock) || '<span class="empty">vide</span>'}`);
  $('credits').textContent = `${st.credits} crédits`;
  $('btn-vest').classList.toggle('dot', canBuy(st));

  const pw = $('power');
  if (needPower(st)) {
    const gen = st.machines.generateur;
    let txt, bad = false;
    if (gen) {
      // La surchauffe n'est pas annoncée à l'avance : on la découvre quand elle arrive
      bad = gen.broken || (genFill(st, gen, 'charbon') + genFill(st, gen, 'bois') === 0);
      txt = gen.broken ? 'Générateur en panne' : `Générateur · ${genText(st, gen)}`;
    } else {
      bad = st.power.battery <= 0;
      txt = bad ? 'Plus de courant : construis le générateur' : `Batterie · ${clock(st.power.battery)}`;
    }
    pw.hidden = false;
    pw.textContent = '⚡ ' + txt;
    pw.classList.toggle('bad', bad);
  } else pw.hidden = true;

  $('mode-name').textContent = st.mode === 'solo' ? `Solo · IA : ${extra.bot || 'en pause café'}` : 'À deux';

  const btn = $('btn-action');
  const h = me.hint;
  btn.classList.toggle('duo', !!(h && h.kind === 'duo' && !h.off));
  btn.classList.toggle('off', !!(h && h.off));
  btn.classList.toggle('none', !h);
  $('action-label').textContent = h ? h.label : 'Action';
  const icon = h ? (h.kind === 'duo' ? ICON.duo : ICON.solo) : ICON.hand;
  const ic = $('action-icon');
  if (ic.dataset.k !== icon) { ic.innerHTML = icon; ic.dataset.k = icon; }
  $('btn-call').classList.remove('hidden');

  // Bouton contextuel : recettes d'une machine ou menu de l'entrepôt
  const ctx = contextOf(st, extra.me);
  const cb = $('btn-ctx');
  cb.hidden = !ctx;
  if (ctx) { cb.textContent = ctx.label; cb.dataset.kind = ctx.kind; cb.dataset.mach = ctx.mach || ''; }
}

// Une tenue est-elle à portée de crédits ?
function canBuy(st) {
  for (const t of SPEC_ORDER) {
    if (DROIDS[t].lvl > st.level) continue;
    for (const [o, def] of Object.entries(OUTFITS)) if (!st.wardrobe.owned[t + ':' + o] && st.credits >= def.price) return true;
  }
  return false;
}

export function contextOf(st, me) {
  if (boxDist(me, ENTREPOT) <= REACH + 0.6) return { kind: 'entrepot', label: 'Entrepôt' };
  if (st.machines.zone && boxDist(me, plotBox(PLOT_BY_ID.zone)) <= REACH + 0.6) return { kind: 'zone', label: 'Déclassés' };
  let best = null, bd = REACH + 0.6;
  for (const m of Object.values(st.machines)) {
    if (!isProd(m)) continue;
    const d = boxDist(me, plotBox(PLOT_BY_ID[m.id]));
    if (d <= bd) { bd = d; best = m; }
  }
  return best ? { kind: 'recettes', label: 'Recettes', mach: best.id } : null;
}

// ---------- menu de l'entrepôt ----------
export function fillEntrepot(st, myId, send) {
  const p = st.players[myId];
  const keys = ITEM_ORDER.filter((k) => !apart(k) && ((st.stock[k] || 0) > 0 || (p.sac[k] || 0) > 0));
  const room = SAC_MAX - count(p.sac);
  let html = `<p class="sub">Sac : ${count(p.sac)}/${SAC_MAX}. Prends exactement ce dont tu as besoin.</p>`;
  html += '<div class="erows">';
  if (!keys.length) html += '<p class="muted">L’entrepôt et ton sac sont vides.</p>';
  for (const k of keys) {
    const s = st.stock[k] || 0, b = p.sac[k] || 0;
    html += `<div class="erow"><span class="ename">${itemIcon(k)}<b>${ITEMS[k].name}</b></span><span class="enum">${s}<small>stock</small></span><span class="enum">${b}<small>sac</small></span>
      <span class="ebtns"><button data-a="take" data-k="${k}" data-n="1" ${s && room ? '' : 'disabled'}>+1</button><button data-a="take" data-k="${k}" data-n="5" ${s && room ? '' : 'disabled'}>+5</button><button data-a="put" data-k="${k}" data-n="99" ${b ? '' : 'disabled'}>Déposer</button></span></div>`;
  }
  html += '</div>';
  if (keys.some((k) => p.sac[k])) html += '<button class="btn small-btn" data-a="putall">Tout déposer</button>';
  if (ITEM_ORDER.some((k) => apart(k) && p.sac[k])) html += '<p class="muted">Les déclassés et les rebuts de ton sac vont à la zone des déclassés.</p>';
  if (st.droids.some((d) => d.type === 'recherche')) {
    const known = RAW.filter((k) => RAW_LEVEL[k] <= st.level);
    const req = st.request;
    html += `<div class="block"><h4>Agent de recherche</h4><p class="muted">${req ? `Il cherche : ${ITEMS[req.item].name.toLowerCase()} (encore ${req.left}).` : 'Il ramène tout seul la matière qui manque le plus.'}</p><div class="chips">
      <button class="pick ${req ? '' : 'on'}" data-a="req" data-k="">Automatique</button>${known.map((k) => `<button class="pick ${req && req.item === k ? 'on' : ''}" data-a="req" data-k="${k}">${itemIcon(k)}${ITEMS[k].name}</button>`).join('')}</div></div>`;
  }
  const body = $('entrepot-body');
  if (body.dataset.sig === html) return;
  body.dataset.sig = html;
  body.innerHTML = html;
  body.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.a, k = b.dataset.k;
    if (a === 'take') send({ c: 'take', item: k, n: +b.dataset.n });
    else if (a === 'put') send({ c: 'put', item: k, n: +b.dataset.n });
    else if (a === 'putall') send({ c: 'putall' });
    else if (a === 'req') send({ c: 'request', item: k || null });
  }));
}

// ---------- menu de la zone des déclassés ----------
export function fillZone(st, myId, send) {
  const p = st.players[myId], z = st.machines.zone;
  if (!z) return;
  const keys = ITEM_ORDER.filter((k) => apart(k) && ((z.inp[k] || 0) > 0 || (p.sac[k] || 0) > 0));
  const room = SAC_MAX - count(p.sac);
  let html = '<p class="sub">Pièces déclassées en attente de contrôle, et rebuts à recycler. Au poste qualité, 1 sur 2 part au rebut (1 sur 3 avec le responsable qualité).</p><div class="erows">';
  if (!keys.length) html += '<p class="muted">Aucune pièce déclassée ni rebut pour l’instant.</p>';
  for (const k of keys) {
    const s = z.inp[k] || 0, b = p.sac[k] || 0;
    html += `<div class="erow"><span class="ename">${itemIcon(k)}<b>${ITEMS[k].name}</b></span><span class="enum">${s}<small>zone</small></span><span class="enum">${b}<small>sac</small></span>
      <span class="ebtns"><button data-a="ztake" data-k="${k}" data-n="1" ${s && room ? '' : 'disabled'}>+1</button><button data-a="ztake" data-k="${k}" data-n="5" ${s && room ? '' : 'disabled'}>+5</button><button data-a="zput" data-k="${k}" data-n="99" ${b ? '' : 'disabled'}>Déposer</button></span></div>`;
  }
  html += '</div>';
  if (keys.some((k) => p.sac[k])) html += '<button class="btn small-btn" data-a="zputall">Tout déposer</button>';
  const body = $('zone-body');
  if (body.dataset.sig === html) return;
  body.dataset.sig = html;
  body.innerHTML = html;
  body.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.a;
    if (a === 'zputall') send({ c: 'zputall' });
    else send({ c: a, item: b.dataset.k, n: +b.dataset.n });
  }));
}

// ---------- menu des recettes ----------
export function fillRecettes(st, machId, send) {
  const m = st.machines[machId];
  if (!m) return;
  const def = MACHINES[m.type];
  const pl = PLOT_BY_ID[machId];
  $('recettes-title').textContent = def.name + (pl.id.endsWith('2') ? ' n°2' : '');
  let html = '<p class="sub">Coche ce que la machine fabrique. Avec plusieurs recettes cochées, elle en fait 1 de chaque à tour de rôle ; s’il manque une matière, elle passe à la suivante.</p><div class="rrows">';
  for (const rid of def.recipes) {
    const r = RECIPES[rid];
    const ok = recipeAvail(st, rid);
    const on = m.sel.includes(rid);
    const missing = (r.need || []).filter((t) => !Object.values(st.machines).some((x) => x.type === t));
    const lock = !ok ? (r.lvl > st.level ? `Niveau ${r.lvl + 1}` : `Après : ${missing.map((t) => MACHINES[t].name.toLowerCase()).join(' et ')}`) : '';
    html += `<button class="rrow ${on ? 'on' : ''}" data-r="${rid}" ${ok ? '' : 'disabled'}><span class="box">${on ? '✓' : ''}</span><span class="rname"><b>${r.name}</b><small>${r.time} s${lock ? ' · ' + lock : ''}</small></span><span class="rline">${recipeLine(rid)}</span></button>`;
  }
  html += '</div>';
  if (m.type === 'recycleur') html += trashHtml(st, m);
  const body = $('recettes-body');
  if (body.dataset.sig === html) return;
  body.dataset.sig = html;
  body.innerHTML = html;
  body.querySelectorAll('.rrow').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    const rid = b.dataset.r;
    const sel = m.sel.includes(rid) ? m.sel.filter((x) => x !== rid) : [...m.sel, rid];
    send({ c: 'recipes', mach: machId, sel });
  }));
  body.querySelectorAll('.tbtn').forEach((b) => b.addEventListener('click', () => {
    send({ c: 'trash', mach: machId, item: b.dataset.k, on: !b.classList.contains('on') });
  }));
}
// Fractions lisibles : ½, ¼, 1 ½…
const frac = (v) => {
  const w = Math.floor(v + 1e-6), f = Math.round((v - w) * 4);
  const fs = ['', '¼', '½', '¾'][f] || '';
  return (w ? String(w) : '') + (w && fs ? ' ' : '') + fs || '0';
};
// Recycleur : on coche les objets en trop ; il en garde toujours une réserve à l'entrepôt
function trashHtml(st, m) {
  if (!recipeAvail(st, 'surplus')) return '';
  const trash = m.trash || [];
  const keys = RECYCLABLE.filter((k) => trash.includes(k) || (st.stock[k] || 0) > 0 || (m.inp[k] || 0) > 0);
  let h = `<h4 class="trash-h">Objets en trop</h4><p class="sub">Coche ce qui ne te sert plus : le recycleur rend la moitié des matières premières qui ont servi à le fabriquer. Il en laisse toujours ${T.recReserve} à l’entrepôt (${Math.min(T.recReserve, T.kitCap)} pour un kit), et la machine qui le fabrique s’arrête à ${T.recReserve}.</p>`;
  if (!keys.length) return h + '<p class="muted">Rien à l’entrepôt pour l’instant.</p>';
  h += '<div class="tgrid">' + keys.map((k) => {
    const on = trash.includes(k);
    const back = Object.entries(RAW_CONTENT[k]).map(([rk, v]) => `<span class="it">${itemIcon(rk)}${frac(v / 2)}</span>`).join('');
    return `<button class="tbtn ${on ? 'on' : ''}" data-k="${k}"><span class="box">${on ? '✓' : ''}</span><span class="tname">${itemIcon(k)}<b>${ITEMS[k].name}</b><small>${st.stock[k] || 0} à l’entrepôt · garde ${reserveOf(k)}</small></span><span class="rline"><span class="muted">1 →</span>${back}</span></button>`;
  }).join('') + '</div>';
  return h;
}

// ---------- menu de spécialisation ----------
const LOCK = '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10.5" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>';
const lockedCard = (lvl, cls = 'spec-card') => `<div class="${cls} locked">${LOCK}<b>???</b><em>Niveau ${lvl + 1}</em></div>`;
export function fillSpec(st, myId, onPick) {
  const p = st.players[myId];
  const have = (k) => (p.sac[k] || 0) + (st.stock[k] || 0);
  const body = $('spec-body');
  const html = SPEC_ORDER.map((type) => {
    const d = DROIDS[type];
    if (d.lvl > st.level) return lockedCard(d.lvl);
    const ok = have(d.kit) >= 1;
    const note = ok ? '' : '<em>Kit à fabriquer à l’établi des kits</em>';
    return `<button class="spec-card" data-type="${type}" ${ok ? '' : 'disabled'} style="--c:${d.css}"><b>${d.name}</b><span class="muted">${d.desc}</span><span class="kit">${itemIcon(d.kit)} ${ITEMS[d.kit].name} · ${have(d.kit)} dispo</span>${note}</button>`;
  }).join('');
  if (body.dataset.sig === html) return;
  body.dataset.sig = html;
  body.innerHTML = html;
  body.querySelectorAll('.spec-card').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) onPick(b.dataset.type); }));
}

// ---------- panneau Usine ----------
export function fillUsine(st, tab, send) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  let html = '';
  if (tab === 'entrepot') {
    html += `<div class="block"><h4>Entrepôt</h4><div class="items big">${listItems(st.stock) || '<span class="empty">Vide : fouillez les débris et déposez ici.</span>'}</div></div><div class="block"><h4>Machines</h4>`;
    const ms = Object.values(st.machines);
    if (!ms.length) html += '<p class="muted">Aucune machine construite pour l’instant.</p>';
    for (const m of ms) {
      const def = MACHINES[m.type];
      const name = def.name + (m.id.endsWith('2') ? ' n°2' : '');
      const state = m.broken ? `<b class="bad">${m.broken === 'heavy' ? 'Panne lourde' : 'En panne'}</b>` : m.run ? '<b class="good">En marche</b>' : m.nopower ? '<b class="bad">Sans courant</b>' : 'À l’arrêt';
      const op = m.operator ? DROIDS[(st.droids.find((d) => d.id === m.operator) || { type: 'ouvrier' }).type].name.toLowerCase() : 'personne';
      const recs = m.sel.map((r) => RECIPES[r].name.toLowerCase()).join(', ');
      const extra = isProd(m) ? ` · cadence ${Math.round(cadence(m, st) * 100)} % · opérateur : ${op}${recs ? ' · ' + recs : ''}` : '';
      html += `<div class="mrow"><div><b>${name}</b><span class="muted"> · ${def.desc}</span></div><div class="muted">${state}${extra}${m.animals.length ? ' · ' + m.animals.map((a) => ANIMALS[a].name).join(', ') : ''}</div></div>`;
    }
    html += '</div>';
  } else if (tab === 'org') {
    const n = (id) => st.droids.filter((d) => d.type === id).length;
    const card = (id) => {
      const d = DROIDS[id];
      const lvl = d.lvl ?? 0;
      if (lvl > st.level) return lockedCard(lvl, 'org-card');
      const cnt = n(id);
      return `<div class="org-card" style="--c:${d.css}"><b>${d.name}</b><span>${d.kit ? ITEMS[d.kit].name : 'Droïde standard'}</span><em>${cnt ? cnt + ' dans l’usine' : 'Disponible'}</em></div>`;
    };
    const rows = [['chef'], ['adjoint'], ['process', 'ingenieur', 'chefmaint', 'expert'], ['production', 'qualite', 'adjq', 'logistique'], ['maintenance', 'recherche', 'achat'], ['ouvrier']];
    html += '<p class="muted">Vos droïdes sont vos employés. Chaque poste se forme à l’atelier de spécialisation, à partir d’un droïde standard et d’un kit fabriqué dans vos machines.</p><div class="org">';
    for (const r of rows) html += `<div class="org-row">${r.map(card).join('')}</div>`;
    html += '</div>';
  } else if (tab === 'betes') {
    html += '<p class="muted">Créatures du terrain vague, mi-vivantes mi-ferraille. Seul, impossible de les attraper : l’un les rabat, l’autre les attrape. Installées sur une machine, elles augmentent sa cadence de 25 %, pour toujours (2 au maximum par machine).</p>';
    for (const [k, a] of Object.entries(ANIMALS)) {
      const c = st.animals.filter((x) => x.sp === k && x.st === 'installed').length;
      html += `<div class="mrow"><b>${a.name}</b> <span class="muted">${a.desc} · installés : ${c}</span></div>`;
    }
  } else if (tab === 'vestiaire') {
    html += `<p class="muted">Les crédits se gagnent avec les objectifs, les niveaux, les commandes et en faisant tourner l’usine. Les tenues se cumulent : une par emplacement, aux couleurs du métier. Touche une tenue achetée pour la mettre ou l’enlever.</p><p class="credits-line">Crédits : <b>${st.credits}</b></p>`;
    for (const t of SPEC_ORDER) {
      const D = DROIDS[t];
      if (D.lvl > st.level) { html += `<div class="vrow locked">${LOCK}<b>???</b><em>Niveau ${D.lvl + 1}</em></div>`; continue; }
      const wear = st.wardrobe.wear[t] || {}, look = LOOKS[t];
      html += `<div class="vrow" style="--c:${D.css}"><div class="vhead"><b>${D.name}</b><span class="muted">${look.style}</span></div>`;
      const pp = packPrice(st, t);
      const nMiss = PACK.items.filter((o) => !st.wardrobe.owned[t + ':' + o]).length;
      if (st.level >= PACK.lvl && pp) html += `<button class="pick pack" data-a="pack" data-t="${t}" ${st.credits >= pp ? '' : 'disabled'}>${PACK.name} : ${nMiss === PACK.items.length ? 'les 5 vêtements' : nMiss > 1 ? `les ${nMiss} vêtements qui manquent` : 'le vêtement qui manque'} · ${pp} crédits</button>`;
      else if (st.level < PACK.lvl) html += `<p class="muted small">${PACK.name} (tous les vêtements d’un coup) : à partir du niveau ${PACK.lvl + 1}</p>`;
      for (const [sl, slName] of Object.entries(SLOTS)) {
        html += `<div class="slot"><span class="slname">${slName}</span><div class="chips">`;
        for (const [o, def] of Object.entries(OUTFITS)) {
          if (def.slot !== sl) continue;
          const sw = look[o] ? `<i class="sw" style="background:${look[o]}"></i>` : o === 'chrome' ? '<i class="sw" style="background:linear-gradient(135deg,#eef2f6,#9aa3ad)"></i>' : o === 'or' ? '<i class="sw" style="background:linear-gradient(135deg,#ffe28a,#c99a1e)"></i>' : '';
          const owned = st.wardrobe.owned[t + ':' + o];
          if (owned) html += `<button class="pick ${wear[sl] === o ? 'on' : ''}" data-a="wear" data-t="${t}" data-o="${o}">${sw}${def.name}</button>`;
          else html += `<button class="pick buy" data-a="buy" data-t="${t}" data-o="${o}" ${st.credits >= def.price ? '' : 'disabled'}>${sw}${def.name} · ${def.price}</button>`;
        }
        html += '</div></div>';
      }
      html += '</div>';
    }
  }
  const body = $('usine-body');
  if (body.dataset.sig === html) return;
  body.dataset.sig = html;
  body.innerHTML = html;
  body.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    if (b.dataset.a === 'buy') send({ c: 'buy', type: b.dataset.t, outfit: b.dataset.o });
    else if (b.dataset.a === 'pack') send({ c: 'pack', type: b.dataset.t });
    else send({ c: 'wear', type: b.dataset.t, outfit: b.dataset.o || null });
  }));
}

// ---------- notifications ----------
export function toast(text, tone = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  el.textContent = text;
  box.prepend(el);
  while (box.children.length > 2) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3400);
  setTimeout(() => el.remove(), 3900);
}
export function banner(title, sub) {
  const el = $('banner');
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
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
    let dx = 0, dy = H;
    if (p) { dx = p.x - cx; dy = p.y - cy; }
    else { const q = renderer.project(arrowTarget.x, 0, arrowTarget.z); if (q) { dx = cx - q.x; dy = cy - q.y; } }
    const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
    x = cx + dx * s; y = cy + dy * s; ang = Math.atan2(dy, dx);
  }
  el.classList.add('on');
  el.style.transform = `translate(${x}px, ${y}px) rotate(${ang}rad)`;
}

// « +2 » au-dessus de l'endroit où l'on gagne des crédits
const floaters = [];
export function floatCredit(x, z, n) {
  const el = document.createElement('div');
  el.className = 'cred';
  el.textContent = `+${n}`;
  $('labels').appendChild(el);
  floaters.push({ el, x, z, t0: performance.now() });
}
export function updateFloaters(renderer) {
  const now = performance.now();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], t = (now - f.t0) / 1400;
    if (t >= 1) { f.el.remove(); floaters.splice(i, 1); continue; }
    const p = renderer.project(f.x, height(f.x, f.z) + 3.2 + t * 1.6, f.z);
    if (!p) { f.el.style.display = 'none'; continue; }
    f.el.style.display = '';
    f.el.style.opacity = String(1 - t * t);
    f.el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%)`;
  }
}

// Tout ce qu'un niveau débloque
export function unlocksOf(n) {
  const i = n - 1, out = [];
  const plots = PLOTS.filter((p) => p.level === n);
  const seen = new Set();
  for (const p of plots) { const nm = MACHINES[p.type].name + (p.id.endsWith('2') ? ' n°2' : ''); if (!seen.has(nm)) { seen.add(nm); out.push(['Machine', nm]); } }
  for (const [t, d] of Object.entries(DROIDS)) if (d.lvl === i) out.push(['Métier', d.name]);
  for (const [rid, r] of Object.entries(RECIPES)) {
    const byLvl = r.lvl === i && r.lvl > 0;
    const byMachine = r.lvl <= i && (r.need || []).some((t) => PLOTS.some((p) => p.type === t && p.level === n) && (r.need || []).every((u) => PLOTS.some((p) => p.type === u && p.level <= n)));
    if ((byLvl || byMachine) && !Object.keys(r.out)[0]?.startsWith('k_')) out.push(['Recette', r.name]);
    else if (byLvl) out.push(['Kit', r.name]);
  }
  for (const [k, l] of Object.entries(RAW_LEVEL)) if (l === i && i > 0) out.push(['Matière utile', ITEMS[k].name]);
  if (i === PACK.lvl) out.push(['Vestiaire', `${PACK.name} : tous les vêtements d’un métier d’un coup`]);
  if (i === T.heavyFrom) out.push(['Attention', 'pannes lourdes à réparer à deux']);
  return out;
}
export function fillLevelUp(n) {
  const L = LEVELS[n - 1];
  $('lvl-title').textContent = `Niveau ${n} · ${L.name}`;
  const u = unlocksOf(n);
  $('lvl-sub').textContent = L.rodage ? (u.length ? 'Niveau de rodage : profitez de votre usine. Et une nouveauté :' : 'Niveau de rodage : profitez de votre usine pour atteindre ces objectifs.') : 'Nouveautés débloquées :';
  $('lvl-body').innerHTML = (u.length ? `<ul class="unl">${u.map(([k, v]) => `<li><span class="ut">${k}</span>${esc(v)}</li>`).join('')}</ul>` : '')
    + `<h4>Objectifs</h4><ul class="unl goals">${L.goals.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul>`;
}

// Appel terminé (arrivé sur place ou 15 s écoulées) : le bord arrête de clignoter
export function callStop() { $('call-flash').classList.remove('on'); $('call-msg').classList.remove('on'); }

// Petit repère « Partie sauvegardée ✓ »
let tickT = 0;
export function savedTick() {
  const el = $('save-tick');
  clearTimeout(tickT);
  el.classList.remove('fade'); el.classList.add('on');
  tickT = setTimeout(() => { el.classList.add('fade'); tickT = setTimeout(() => el.classList.remove('on', 'fade'), 550); }, 1800);
}

// ---------- Safari : pas de zoom de la page pendant le jeu ----------
const zoomed = () => !!(window.visualViewport && window.visualViewport.scale > 1.05);
export function guardZoom() {
  // Tant que la page n'est pas zoomée, on bloque tous les gestes de zoom ; si elle l'est déjà, on laisse dézoomer
  const stop = (e) => { if (!zoomed() && e.cancelable) e.preventDefault(); };
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  // Deux doigts à l'écran (joystick + bouton) : jamais de pincement
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) stop(e); }, { passive: false });
  // Les commandes du jeu ne déclenchent ni zoom, ni double tape, ni loupe
  for (const id of ['stick-zone', 'look-zone', 'btn-action']) $(id).addEventListener('touchstart', stop, { passive: false });
  // Secours : la page est quand même zoomée → bouton « Recadrer l'écran » dans la partie visible
  const vv = window.visualViewport, fix = $('btn-unzoom');
  if (!vv) return;
  const place = () => {
    const z = zoomed();
    fix.hidden = !z;
    if (z) fix.style.transform = `translate(${vv.offsetLeft + vv.width / 2}px, ${vv.offsetTop + 14 / vv.scale}px) scale(${1 / vv.scale}) translateX(-50%)`;
  };
  vv.addEventListener('resize', place);
  vv.addEventListener('scroll', place);
  fix.addEventListener('click', () => {
    const meta = document.querySelector('meta[name=viewport]');
    const base = meta.getAttribute('content');
    meta.setAttribute('content', base.replace('maximum-scale=1,', 'maximum-scale=1.01,'));
    setTimeout(() => { meta.setAttribute('content', base); window.scrollTo(0, 0); place(); }, 80);
  });
  place();
}

// Appel du partenaire : bord de l'écran qui clignote, grand message, vibration
export function callAlert(text, them) {
  const fl = $('call-flash');
  fl.style.setProperty('--cc', PLAYER_COLORS[them].css);
  fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
  const msg = $('call-msg');
  msg.textContent = text;
  msg.classList.remove('on'); void msg.offsetWidth; msg.classList.add('on');
  try { if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 300]); } catch (e) { /* ignoré */ }
  // iPhone (Safari) : pas de vibration pour les sites ; un interrupteur caché déclenche un petit retour haptique sur les modèles récents
  try { const lb = $('haptic-label'); for (let k = 0; k < 3; k++) setTimeout(() => lb.click(), k * 140); } catch (e) { /* ignoré */ }
}

// Écran de surchauffe
export function fillLock(leftMs) {
  const s = Math.max(0, Math.ceil(leftMs / 1000));
  $('lock-count').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- commandes : joystick, bouton, caméra ----------
export function createInput(onEvent, cam) {
  const st = { mx: 0, mz: 0, held: false, events: [], keys: new Set(), stickId: null, ox: 0, oy: 0, looks: new Map() };
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

// Où se trouve l'objectif en cours (pour le repère toujours visible)
const ITEM_PLOT = { carcasse: 'forge', circuit: 'circuits', isolant: 'ceramique', fil: 'trefileuse', tole: 'laminoir', circuitA: 'circuits' };
export function objectiveSpot(st) {
  if (st.won) return null;
  const g = LEVELS[st.level].goals.find((x) => !st.goals[x.id]);
  if (!g) return null;
  const at = (id) => (st.machines[id] || PLOT_BY_ID[id] ? { x: PLOT_BY_ID[id].x, z: PLOT_BY_ID[id].z } : null);
  if (g.id === 'core' && !st.core.placed) return { x: st.core.x, z: st.core.z };
  if (PLOT_BY_ID[g.id]) return at(g.id);
  if ((DROIDS[g.id] || g.id === 'qualiteD') && st.machines.atelier) return at('atelier');
  if (g.id === 'fuel') return at('generateur');
  if (g.id === 'heavy') { const m = Object.values(st.machines).find((x) => x.broken === 'heavy'); return m ? at(m.id) : null; }
  if (!g.c) return null;
  const [kind, , item] = g.c;
  if (kind === 'made+' || kind === 'droids') return at('assembleur');
  if (kind === 'item+') return at(ITEM_PLOT[item]);
  if (kind === 'ctrl+') return at('qualite');
  if (kind === 'recyc+' || kind === 'surplus+') return at('recycleur');
  if (kind === 'spec+') return at('atelier');
  if (kind === 'orders+') return at('quai');
  return null;
}

// Bulles « à récupérer » au-dessus des machines (visibles de loin)
const BUBBLE_RANGE = 25;

export function worldLabels(st, myId, me) {
  const L = [];
  const add = (id, x, y, z, html) => L.push({ id, x, y, z, html });
  const pos = (id) => (id === myId ? me : st.players[id]);
  const near = (pt) => ['A', 'B'].find((id) => Math.hypot(pos(id).x - pt.x, pos(id).z - pt.z) < POST_R);
  const within = (x, z, extra = 0) => Math.hypot(x - me.x, z - me.z) < LABEL_RANGE + extra;
  // Bâtiments et machines : le nom n'apparaît que tout près (à moins de 3 m de leur bord)
  const close = (box) => boxDist(me, box) < LABEL_RANGE;

  NODES.forEach((n, i) => {
    if (!within(n.x, n.z, NODE_TYPES[n.type].r)) return;
    const t = NODE_TYPES[n.type], q = st.nodes[i];
    const y = height(n.x, n.z) + (n.type === 'epave' ? 1.9 : 1.6);
    add('n' + i, n.x, y, n.z, chip('solo', `${itemIcon(t.item)} ${t.name}`, q ? '' : ' dim') + sub(q ? `${q} à fouiller` : `vide · ${Math.ceil(st.nodeT[i])} s`));
  });

  if (close(ENTREPOT)) {
    const keys = ITEM_ORDER.filter((k) => (st.stock[k] || 0) > 0);
    const top = Object.fromEntries(keys.slice(0, 5).map((k) => [k, st.stock[k]]));
    add('entrepot', ENTREPOT.x, 2.6, ENTREPOT.z, chip('solo', 'Entrepôt') + sub(keys.length ? listItems(top) + (keys.length > 5 ? ` <small>+${keys.length - 5}</small>` : '') : 'vide'));
  }

  for (const p of PLOTS) {
    if (!close(plotBox(p))) continue;
    const ps = st.plots[p.id], def = MACHINES[p.type];
    const name = def.name + (p.id.endsWith('2') ? ' n°2' : '');
    if (!plotUnlocked(st, p)) { add('p' + p.id, p.x, 1.0, p.z, sub(`${name} · niveau ${p.level}`)); continue; }
    if (!ps.built) {
      if (ps.ready) {
        const l = ps.holder || (near(postL(p)) ? 'h' + near(postL(p)) : '');
        const rn = near(postR(p));
        const r = rn ? (ps.holder && ps.holder !== rn ? rn : 'h' + rn) : '';
        add('p' + p.id, p.x, 3.0, p.z, chip('duo', name) + pill(l, r) + gauge(ps.prog, 'duo') + sub('Montage à deux : tenir à gauche, visser à droite'));
      } else {
        const miss = {};
        for (const [k, n] of Object.entries(def.cost)) miss[k] = Math.max(0, n - (ps.del[k] || 0));
        const coreTxt = def.core && !st.core.placed ? ' · + cœur d’assembleur' : '';
        add('p' + p.id, p.x, 2.4, p.z, chip('solo', `Chantier : ${name}`) + sub(count(miss) ? 'Il manque ' + listItems(miss) + coreTxt : 'Matériaux livrés' + coreTxt));
      }
      continue;
    }
    const m = st.machines[p.id];
    const prod = isProd(m);
    let html = chip(m.broken === 'heavy' ? 'duo' : 'solo', prod ? `${name} · ${Math.round(cadence(m, st) * 100)} %` : name, m.broken ? ' alert' : '');
    if (m.broken === 'heavy') {
      const fixer = ['A', 'B'].find((id) => st.work[id] && st.work[id].kind === 'fixheavy' && st.work[id].mach === p.id);
      html += pill(m.cut || '', fixer || '') + gauge(m.fixT / T.heavyRepair, 'duo') + sub('Panne lourde : couper à gauche, réparer à droite');
    } else if (m.broken) html += sub('Panne : garder appuyé pour réparer');
    else if (m.type === 'generateur') {
      const hot = st.gen.lockUntil > Date.now();
      html += sub(hot ? '<b class="bad">Surchauffe : il refroidit</b>' : `${itemIcon('charbon')}${genFill(st, m, 'charbon')}/${T.genCap} ${itemIcon('bois')}${genFill(st, m, 'bois')}/${T.genCap}` + (m.run ? ' · en marche' : ''));
    }
    else if (m.type === 'zone') html += sub(listItems(m.inp) || 'Vide : déposez ici les pièces déclassées');
    else if (m.type === 'quai') { const o = activeOrders(st); html += sub(o.length ? o.map((x) => `${itemIcon('colis')}${x.left} · ${clock(x.t)}`).join(' &nbsp; ') : 'Pas de commande'); }
    else if (m.type === 'atelier') html += sub(m.busy ? 'Formation en cours…' : 'Amène un droïde standard');
    else if (!m.sel.length) html += sub('Aucune recette : bouton Recettes');
    else {
      const r = RECIPES[m.sel.includes(m.cur) ? m.cur : m.sel[0]];
      const inp = r.any ? (listItems(Object.fromEntries(Object.entries(m.inp).filter(([k]) => anyMatch(m, r.any, k)))) || `<span class="it miss">${r.any === 'decl' ? 'aucune pièce déclassée' : r.any === 'surplus' ? 'aucun objet en trop' : 'aucun rebut'}</span>`)
        : Object.keys(r.in).map((k) => `<span class="it ${(m.inp[k] || 0) >= r.in[k] ? '' : 'miss'}">${itemIcon(k)}${m.inp[k] || 0}</span>`).join('');
      const outs = listItems(m.out);
      html += sub(`${r.name}${m.sel.length > 1 ? ` <small>(+${m.sel.length - 1})</small>` : ''}`) + sub(inp + (outs ? ' → ' + outs : '') + (m.operator ? ' · droïde' : '') + (m.nopower ? ' · <b class="bad">sans courant</b>' : ''));
      if (m.run || m.t > 0) html += gauge(m.t / r.time);
      const cap = m.sel.every((rid) => recipeCapped(st, rid)) ? recipeCapped(st, m.sel[0]) : 0;
      if (cap) html += sub(`<b class="warn">Stock plein (${cap}) : en pause</b>`);
    }
    add('p' + p.id, p.x, ['assembleur', 'quai'].includes(p.type) ? 3.5 : 2.8, p.z, html);
  }

  for (const m of Object.values(st.machines)) {
    const n = count(m.out);
    if (!n) continue;
    const p = PLOT_BY_ID[m.id];
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d > BUBBLE_RANGE) continue;
    const keys = ITEM_ORDER.filter((k) => (m.out[k] || 0) > 0).slice(0, 3);
    const y = ['assembleur', 'quai'].includes(p.type) ? 3.5 : 2.8;
    add('o' + m.id, p.x, y + (close(plotBox(p)) ? 1.9 : 0.4), p.z, `<div class="outb">${keys.map((k) => `<span class="it">${itemIcon(k)}${m.out[k]}</span>`).join('')}</div>`);
  }

  if (!st.core.placed && within(st.core.x, st.core.z, ANIMAL_RANGE - LABEL_RANGE)) {
    const c = st.core;
    const side = (s) => {
      const who = ['A', 'B'].find((id) => c.hand[id] === s);
      if (who) return who;
      const n = near({ x: c.x + (s === 'L' ? -1 : 1) * CORE.handle, z: c.z });
      return n ? 'h' + n : '';
    };
    add('core', c.x, height(c.x, c.z) + 2.0, c.z, chip('duo', 'Cœur d’assembleur') + pill(side('L'), side('R')) + sub('À porter à deux jusqu’à l’assembleur'));
  }

  if (within(PAUSE.x, PAUSE.z, 2)) {
    const n = st.droids.filter((d) => d.pose).length;
    add('pause', PAUSE.x, 2.2, PAUSE.z, chip('solo', 'Coin pause') + sub(n ? `${n} droïde${n > 1 ? 's' : ''} en pause café` : 'Les droïdes sans tâche viennent y prendre un café'));
  }

  for (const d of st.droids) {
    // Étiquettes des droïdes : seulement tout près, pour ne pas surcharger l'usine
    const dd = Math.hypot(d.x - me.x, d.z - me.z);
    if (d.st === 'spec' || dd > (d.st === 'idle' || d.st === 'follow' ? 4.5 : 2.6)) continue;
    const def = DROIDS[d.type];
    const what = d.st === 'idle' ? ' · libre' : d.st === 'follow' ? ' · te suit' : d.pose ? ' · en pause' : '';
    add('d' + d.id, d.x, height(d.x, d.z) + (d.pose === 'sit' ? 1.3 : 1.55), d.z, `<div class="dtag" style="--c:${def.css}">${def.name}${what}</div>`);
  }

  for (const a of st.animals) {
    if (!within(a.x, a.z, ANIMAL_RANGE - LABEL_RANGE) || a.st === 'installed') continue;
    const def = ANIMALS[a.sp];
    const y = height(a.x, a.z) + (a.sp === 'vitrelle' ? 2.4 : 1.4);
    let s = '';
    if (a.st === 'corner') s = sub('Encerclé : attrape-le !');
    else if (a.st === 'flee') s = sub('Il fuit : prenez-le en tenaille');
    else if (a.st === 'caught') s = sub('Capturé : installe-le sur une machine');
    add('a' + a.id, a.x, y, a.z, chip('duo', def.name) + s);
  }

  // Toujours visibles : les joueurs et l'objectif en cours
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
  const obj = objectiveSpot(st);
  if (obj) {
    const d = Math.hypot(obj.x - me.x, obj.z - me.z);
    if (d > 4) add('obj', obj.x, height(obj.x, obj.z) + 3.4, obj.z, `<div class="objm">Objectif · ${Math.round(d)} m</div>`);
  }
  return L;
}
