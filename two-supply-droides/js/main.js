// Two Supply — Droïdes (version 0.4) : relie modes de jeu, connexion, sauvegarde, simulation, caméra et rendu.
import { newState, restoreState, step, drainFx, forceBuild, commandsOnly } from './sim.js';
import { createBot, botInput, botLabel } from './bot.js';
import { obstacles, moveCircle } from './move.js';
import { SPEED, LEVELS, SAVE_KEY, T, other, MACHINES } from './config.js';
import { height, genWorld, applyLayout, placeWhy, PLOT_BY_ID } from './world.js';
import { Renderer } from './gl.js';
import { buildScene, updateScene, dayNight } from './scene.js';
import { Link, getPeerClass, cleanCode } from './net.js';
import * as UI from './ui.js';
import { unlockAudio, play } from './audio.js';

const params = new URLSearchParams(location.search);
const NET = params.get('net') === 'fake' ? 'fake' : 'peer';
const $ = (id) => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches;

const app = {
  mode: null, link: null, isHost: true, myId: 'A', code: null,
  sim: null, st: null, playing: false, bot: null, saved: null,
  me: { x: 0, z: 0, rot: Math.PI }, wasLocked: false,
  remote: { x: NaN, z: NaN, rot: 0, mx: 0, mz: 0, held: false, events: [] },
  localEvents: [], pendingFx: [], lastSend: 0, usineTab: 'entrepot', recMach: null, lastSave: 0, wonShown: false,
};

// ---------- rendu ----------
let renderer = null, scene = null;
try {
  renderer = new Renderer($('gl'), { shadowSize: mobile ? 1024 : 2048, ratioCap: mobile ? 1.6 : 2 });
} catch (e) {
  UI.setMsg('home-msg', 'Ce téléphone ne permet pas l’affichage 3D (WebGL) : ' + e.message, true);
}
const labels = new UI.Labels();

// ---------- caméra : troisième personne, derrière le joueur, en plongée, avec zoom ----------
const cam = {
  yaw: Math.PI, pitch: 0.8, dist: 10.5, manualAt: -9, x: 0, z: 0, init: false,
  rotate(dx, dy) { this.yaw -= dx; this.pitch = Math.min(1.35, Math.max(0.42, this.pitch + dy)); this.manualAt = performance.now(); },
  zoomBy(f) { this.dist = Math.min(30, Math.max(5.5, this.dist * f)); },
};

const input = UI.createInput((e) => {
  if (!app.playing || app.isHost || !app.link) return;
  if (e === 'down' && UI.isOverlay()) return;
  app.link.send({ t: 'ev', e });
}, cam);
UI.bindHud();
UI.guardZoom();
for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, unlockAudio, { passive: true });

// ---------- sauvegarde (sur le téléphone qui héberge la partie) ----------
const round = (k, v) => (k === 'fx' ? undefined : typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.st && d.st.v === 4 ? d : null;
  } catch (e) { return null; }
}
function saveGame() {
  if (!app.isHost || !app.sim || !app.playing) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), code: app.mode === 'duo' ? app.code : null, st: app.sim }, round));
    app.lastSave = performance.now();
    UI.savedTick();
  } catch (e) { /* stockage indisponible : on continue sans sauvegarde */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignoré */ } }

function showResume() {
  const d = readSave();
  app.saved = d;
  $('resume').hidden = !d;
  if (!d) return;
  const lock = d.st.gen && d.st.gen.lockUntil > Date.now();
  $('resume-info').innerHTML = `<b>Partie sauvegardée</b> · ${saveSummary(d)}`
    + (lock ? `<br><b class="bad">Surchauffe : reprise dans <span id="resume-lock"></span></b>` : '');
}
function saveSummary(d) {
  const s = d.st, t = Math.round(s.time);
  const when = new Date(d.at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  return `niveau ${s.level + 1}/${LEVELS.length} (${LEVELS[s.level].name}) · ${s.droids.length} droïdes · ${s.credits} crédits · ${Math.floor(t / 60)} min de jeu<br><span class="muted">${when}</span>`;
}
showResume();
setInterval(() => {
  const el = document.getElementById('resume-lock');
  if (!el || !app.saved) return;
  const left = Math.max(0, app.saved.st.gen.lockUntil - Date.now());
  const sec = Math.ceil(left / 1000);
  el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}, 500);

// ---------- accueil ----------
function goFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
}
function joinUrl(code) { return `${location.origin}${location.pathname}?join=${code}${NET === 'fake' ? '&net=fake' : ''}`; }

function playSolo(saved) {
  unlockAudio(); goFullscreen();
  app.mode = 'solo'; app.isHost = true; app.myId = 'A';
  app.bot = createBot();
  startGame(saved);
}
// Nouvelle partie alors qu'une sauvegarde existe : on demande avant de l'écraser
function newGame(mode) {
  app.saved = readSave();
  if (!app.saved) { if (mode === 'solo') playSolo(null); else hostGame(null); return; }
  app.confirmMode = mode;
  $('confirm-info').innerHTML = saveSummary(app.saved);
  $('btn-confirm-resume').textContent = mode === 'solo' ? 'Reprendre ma partie (seul)' : 'Reprendre ma partie (à deux)';
  UI.overlay('screen-confirm', true);
}
$('btn-solo').addEventListener('click', () => newGame('solo'));
$('btn-host').addEventListener('click', () => newGame('duo'));
$('btn-confirm-cancel').addEventListener('click', () => UI.overlay('screen-confirm', false));
$('btn-confirm-resume').addEventListener('click', () => {
  UI.overlay('screen-confirm', false);
  if (app.confirmMode === 'solo') playSolo(app.saved && app.saved.st);
  else hostGame(app.saved && app.saved.st, app.saved && app.saved.code);
});
$('btn-confirm-new').addEventListener('click', () => {
  UI.overlay('screen-confirm', false);
  if (app.confirmMode === 'solo') playSolo(null); else hostGame(null);
});
$('btn-resume-solo').addEventListener('click', () => playSolo(app.saved && app.saved.st));
$('btn-resume-duo').addEventListener('click', () => hostGame(app.saved && app.saved.st, app.saved && app.saved.code));
let delArmed = false;
$('btn-resume-del').addEventListener('click', () => {
  if (!delArmed) { delArmed = true; $('btn-resume-del').textContent = 'Toucher encore pour effacer'; setTimeout(() => { delArmed = false; $('btn-resume-del').textContent = 'Effacer la sauvegarde'; }, 3000); return; }
  clearSave(); showResume();
});

async function hostGame(saved, prevCode) {
  unlockAudio(); goFullscreen();
  UI.setMsg('home-msg', 'Création de la partie…');
  $('btn-host').disabled = true; $('btn-resume-duo').disabled = true;
  try {
    const Peer = await getPeerClass(NET);
    const link = new Link(Peer);
    app.link = link; app.mode = 'duo';
    link.onMessage = hostMessage;
    link.onClose = partnerLost;
    link.onOpen = () => { if (!app.playing) startGame(saved); else partnerBack(); };
    const code = await link.host(prevCode);
    app.isHost = true; app.myId = 'A'; app.code = code;
    $('wait-code').textContent = code;
    const qr = $('qr');
    qr.innerHTML = '';
    const img = new Image();
    img.alt = 'QR code de la partie';
    img.onerror = () => { qr.textContent = 'QR code indisponible : utilise le code.'; };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(joinUrl(code))}`;
    qr.appendChild(img);
    UI.show('screen-wait');
    UI.setMsg('home-msg', '');
  } catch (e) {
    UI.setMsg('home-msg', e.message, true);
  } finally { $('btn-host').disabled = false; $('btn-resume-duo').disabled = false; }
}

$('btn-share').addEventListener('click', async () => {
  const url = joinUrl(app.code);
  try {
    if (navigator.share) await navigator.share({ title: 'Two Supply', text: `Rejoins ma partie Two Supply (code ${app.code})`, url });
    else { await navigator.clipboard.writeText(url); UI.setMsg('wait-msg', 'Lien copié : envoie-le à ton partenaire.'); }
  } catch (e) { /* annulé */ }
});
$('btn-cancel').addEventListener('click', () => { if (app.link) app.link.destroy(); app.link = null; UI.show('screen-home'); });

const codeInput = $('join-code');
codeInput.addEventListener('input', () => { codeInput.value = cleanCode(codeInput.value); });
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-join').addEventListener('click', () => join(codeInput.value, true));

async function join(raw, gesture) {
  const code = cleanCode(raw);
  if (code.length !== 4) { UI.setMsg('home-msg', 'Le code fait 4 caractères.', true); return; }
  if (gesture) { unlockAudio(); goFullscreen(); }
  UI.setMsg('home-msg', 'Connexion à la partie ' + code + '…');
  $('btn-join').disabled = true;
  try {
    const Peer = await getPeerClass(NET);
    const link = new Link(Peer);
    app.link = link; app.mode = 'duo';
    app.isHost = false; app.myId = 'B'; app.code = code;
    link.onMessage = clientMessage;
    link.onClose = hostLost;
    await link.join(code);
    link.send({ t: 'hello', v: 3 });
    UI.setMsg('home-msg', 'Connecté : la partie démarre…');
  } catch (e) {
    if (app.link) app.link.destroy();
    app.link = null;
    UI.setMsg('home-msg', e.message, true);
  } finally { $('btn-join').disabled = false; }
}

// ---------- démarrage ----------
function startGame(saved) {
  if (app.playing) return;
  if (saved) {
    app.sim = restoreState(JSON.parse(JSON.stringify(saved)));
    app.sim.mode = app.mode;
    const away = Date.now() - ((app.saved && app.saved.at) || Date.now());
    if (away >= T.restReset * 1000) app.sim.gen.play = 0;
  } else app.sim = newState(app.mode);
  app.st = app.sim;
  app.wonShown = !!app.sim.won;
  if (app.link) app.link.send({ t: 'start', st: app.sim });
  beginGame(!!saved);
}

function beginGame(resumed) {
  app.playing = true;
  app.paused = false;
  linkBack();
  if (!scene) scene = buildScene(app.st.mode === 'solo' ? 'solo' : 'duo');
  UI.setPlayerColors(app.myId);
  UI.show('');
  $('hud').hidden = false;
  if (resumed || app.st.time > 5) {
    const L = LEVELS[app.st.level];
    UI.banner(`Niveau ${app.st.level + 1}`, L.name);
  } else UI.overlay('screen-howto', true);
  $('howto-solo').classList.toggle('hidden', app.st.mode !== 'solo');
  const p = app.st.players[app.myId];
  app.me = { x: p.x, z: p.z, rot: p.rot };
  cam.init = false;
  labels.clear();
  keepAwake();
  saveGame();
}

// ---------- messages réseau ----------
const CMDS = new Set(['spec', 'take', 'put', 'putall', 'request', 'recipes', 'buy', 'wear', 'pack', 'ztake', 'zput', 'zputall', 'trash', 'move', 'mebuy', 'mewear', 'mecol']);
function hostMessage(m) {
  if (!m || typeof m !== 'object') return;
  const r = app.remote;
  switch (m.t) {
    case 'hello': if (app.playing) app.link.send({ t: 'start', st: app.sim }); break;
    case 'in':
      if (Number.isFinite(m.x) && Number.isFinite(m.z)) { r.x = m.x; r.z = m.z; r.rot = +m.r || 0; }
      r.mx = clamp1(m.mx); r.mz = clamp1(m.mz); r.held = !!m.h;
      break;
    case 'ev': if (m.e === 'down' || m.e === 'up') { r.events.push(m.e); r.held = m.e === 'down'; } break;
    case 'cmd': {
      if (!CMDS.has(m.c)) break;
      const e = { c: m.c };
      for (const k of ['type', 'item', 'mach', 'outfit', 'slot']) if (typeof m[k] === 'string' || m[k] === null) e[k] = m[k];
      if (Number.isFinite(m.n)) e.n = m.n;
      for (const k of ['x', 'z']) if (Number.isFinite(m[k])) e[k] = m[k];
      if (typeof m.on === 'boolean') e.on = m.on;
      if (Array.isArray(m.sel)) e.sel = m.sel.filter((x) => typeof x === 'string').slice(0, 12);
      r.events.push(e);
      break;
    }
    case 'ping': if (app.sim) { const b = app.sim.players.B; handleFx({ k: 'call', text: 'Ton partenaire t’appelle !', x: b.x, z: b.z, meet: true }); } break;
  }
}
function clientMessage(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'start' && m.st) {
    genWorld(m.st.seed);
    app.st = m.st;
    beginGame(m.st.time > 5);
  } else if (m.t === 's' && app.playing && m.st) {
    app.st = m.st;
    if (Array.isArray(m.fx)) m.fx.forEach(handleFx);
  }
}
const clamp1 = (v) => Math.max(-1, Math.min(1, +v || 0));

// Les commandes des menus passent par la simulation de l'hôte
function sendCmd(e) {
  if (app.isHost) app.localEvents.push(e);
  else if (app.link) app.link.send({ t: 'cmd', ...e });
  play('tap');
}
// Panneau Usine : « Déplacer » lance le mode Aménager (sur ce téléphone), le reste part à la simulation
function usineSend(e) {
  if (e.c !== 'place') { sendCmd(e); return; }
  if (!app.st.machines[e.mach]) return;
  app.placing = { mach: e.mach, x: 0, z: 0, why: '…' };
  UI.overlay('screen-usine', false);
  $('place-bar').hidden = false;
  play('tap');
}
function stopPlacing() { app.placing = null; $('place-bar').hidden = true; }
// Emplacement proposé : devant le joueur, à la grille de 50 cm
function updatePlacing(st, me) {
  const pl = app.placing;
  if (!pl) return null;
  if (!st.machines[pl.mach]) { stopPlacing(); return null; }
  const def = MACHINES[PLOT_BY_ID[pl.mach].type];
  const ahead = def.d / 2 + 1.6;
  pl.x = Math.round((me.x + Math.sin(me.rot) * ahead) * 2) / 2;
  pl.z = Math.round((me.z + Math.cos(me.rot) * ahead) * 2) / 2;
  pl.why = placeWhy(st, pl.mach, pl.x, pl.z);
  const msg = $('place-msg');
  msg.textContent = pl.why ? 'Impossible : ' + pl.why : `${def.name} : emplacement libre`;
  msg.className = pl.why ? 'bad' : 'good';
  $('btn-place-ok').disabled = !!pl.why;
  return { type: def.w ? PLOT_BY_ID[pl.mach].type : null, x: pl.x, z: pl.z, ok: !pl.why };
}
$('btn-place-ok').addEventListener('click', () => { const pl = app.placing; if (!pl || pl.why) return; sendCmd({ c: 'move', mach: pl.mach, x: pl.x, z: pl.z }); stopPlacing(); });
$('btn-place-cancel').addEventListener('click', () => { stopPlacing(); play('tap'); });

function openMenu(kind, mach) {
  const st = app.st;
  if (kind === 'entrepot') { UI.fillEntrepot(st, app.myId, sendCmd); UI.overlay('screen-entrepot', true); }
  else if (kind === 'spec') { UI.fillSpec(st, app.myId, pickSpec); UI.overlay('screen-spec', true); }
  else if (kind === 'recettes' && mach && st.machines[mach]) { app.recMach = mach; UI.fillRecettes(st, mach, sendCmd); UI.overlay('screen-recettes', true); }
  else if (kind === 'zone' && st.machines.zone) { UI.fillZone(st, app.myId, sendCmd); UI.overlay('screen-zone', true); }
}

function handleFx(f) {
  switch (f.k) {
    case 'toast': UI.toast(f.text, f.tone); break;
    case 'sfx': play(f.s); break;
    case 'call':
      UI.callAlert(f.text, other(app.myId));
      // Le bord clignote jusqu'à ce qu'on arrive sur place, 15 secondes au plus
      app.call = { x: f.x, z: f.z, meet: !!f.meet, from: performance.now(), until: performance.now() + 15000 };
      play('call');
      break;
    case 'menu': if (!UI.isOverlay()) openMenu(f.menu); break;
    case 'cred': UI.floatCredit(f.x, f.z, f.n); play('cred'); break;
    case 'overheat': play('overheat'); break;
    case 'level':
      play('won');
      UI.banner(`Niveau ${f.n}`, f.name);
      UI.fillLevelUp(f.n);
      UI.overlay('screen-levelup', true);
      break;
    case 'save': saveGame(); break;
    case 'won': if (!app.wonShown) { app.wonShown = true; play('won'); showWin(); } break;
  }
}

function pickSpec(type) {
  UI.overlay('screen-spec', false);
  sendCmd({ c: 'spec', type });
}

function showWin() {
  const s = app.st;
  const t = Math.round(s.wonAt || s.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  $('win-stats').textContent = `${s.droids.length} droïdes dans l’usine, ${Object.keys(s.machines).length} machines, ${s.stats.orders} commandes livrées, en ${mm} min ${ss} s.`;
  UI.overlay('screen-win', true);
}
// ---------- liaison coupée : pause, puis reconnexion automatique ----------
function showLost(title, text, waiting) {
  $('lost-title').textContent = title;
  $('lost-text').textContent = text;
  $('lost-spin').hidden = !waiting;
  $('net-dot').classList.add('bad');
  UI.overlay('screen-lost', true);
}
function linkBack() {
  $('net-dot').classList.remove('bad');
  UI.overlay('screen-lost', false);
}
// Hôte : la partie se met en pause et attend que le partenaire revienne (même code)
function partnerLost() {
  app.paused = true;
  Object.assign(app.remote, { held: false, mx: 0, mz: 0, events: [] });
  saveGame();
  showLost('Partenaire déconnecté', `La partie est en pause et sauvegardée. Ton partenaire revient tout seul dès que son téléphone se reconnecte (code ${app.code}).`, true);
}
function partnerBack() {
  app.paused = false;
  linkBack();
  UI.toast('Ton partenaire est de retour !', 'good');
  play('ok');
}
// Invité : il retente de rejoindre le même code pendant 2 minutes
let reconnecting = false;
async function hostLost() {
  if (reconnecting || !app.code) return;
  reconnecting = true;
  showLost('Connexion perdue', 'Reconnexion à la partie en cours…', true);
  const until = performance.now() + 120000;
  while (performance.now() < until) {
    try {
      const Peer = await getPeerClass(NET);
      const link = new Link(Peer);
      link.onMessage = clientMessage;
      link.onClose = hostLost;
      try { if (app.link) app.link.destroy(); } catch (e) { /* ignoré */ }
      app.link = link;
      await link.join(app.code, 7000);
      link.send({ t: 'hello', v: 3 });
      reconnecting = false;
      linkBack();
      UI.toast('Reconnecté !', 'good');
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  reconnecting = false;
  showLost('Connexion perdue', 'Impossible de rejoindre la partie. Si ton partenaire l’a relancée depuis l’accueil, retape son code.', false);
}

// ---------- boutons ----------
$('btn-go').addEventListener('click', () => {
  UI.overlay('screen-howto', false);
  if (app.st && app.st.level === 0 && !app.st.machines.forge) UI.pointTo(-17, -10, 5);
});
function openUsine(tab) {
  if (tab) app.usineTab = tab;
  UI.fillUsine(app.st, app.usineTab, usineSend, app.myId);
  quitReset();
  UI.overlay('screen-usine', true);
}
// « Sauvegarder et quitter » (l'invité quitte seulement : la sauvegarde est chez l'hôte)
let quitArmed = false, quitTimer = 0;
function quitReset() {
  quitArmed = false; clearTimeout(quitTimer);
  $('btn-quit').textContent = app.isHost ? 'Sauvegarder et quitter' : 'Quitter la partie';
  UI.setMsg('quit-note', app.isHost ? '' : 'La sauvegarde est sur le téléphone de ton partenaire.');
}
function goHome() { if (app.link) app.link.destroy(); location.href = location.pathname + (NET === 'fake' ? '?net=fake' : ''); }
$('btn-quit').addEventListener('click', () => {
  if (app.mode === 'duo' && !quitArmed) {
    quitArmed = true;
    $('btn-quit').textContent = 'Toucher encore pour quitter';
    UI.setMsg('quit-note', app.isHost ? 'La partie est sauvegardée ; celle de ton partenaire se mettra en pause.' : 'La sauvegarde est sur le téléphone de ton partenaire ; sa partie se mettra en pause.');
    quitTimer = setTimeout(quitReset, 4000);
    return;
  }
  saveGame();
  goHome();
});
$('btn-usine').addEventListener('click', () => openUsine(app.usineTab === 'org' || app.usineTab === 'vestiaire' ? 'entrepot' : null));
$('btn-team').addEventListener('click', () => openUsine('org'));
$('btn-vest').addEventListener('click', () => openUsine('vestiaire'));
$('btn-lock-team').addEventListener('click', () => openUsine('org'));
$('btn-lock-vest').addEventListener('click', () => openUsine('vestiaire'));
$('btn-lock-home').addEventListener('click', () => { saveGame(); goHome(); });
$('btn-zone-close').addEventListener('click', () => UI.overlay('screen-zone', false));
$('btn-lvl-ok').addEventListener('click', () => UI.overlay('screen-levelup', false));
$('btn-usine-close').addEventListener('click', () => UI.overlay('screen-usine', false));
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { app.usineTab = t.dataset.tab; UI.fillUsine(app.st, app.usineTab, usineSend, app.myId); }));
$('btn-spec-close').addEventListener('click', () => UI.overlay('screen-spec', false));
$('btn-entrepot-close').addEventListener('click', () => UI.overlay('screen-entrepot', false));
$('btn-recettes-close').addEventListener('click', () => UI.overlay('screen-recettes', false));
$('btn-ctx').addEventListener('click', (e) => { e.stopPropagation(); play('tap'); openMenu(e.currentTarget.dataset.kind, e.currentTarget.dataset.mach); });
$('btn-continue').addEventListener('click', () => UI.overlay('screen-win', false));
$('btn-rotate-ok').addEventListener('click', () => $('hud').classList.add('rot-ok'));
$('btn-home').addEventListener('click', () => { if (app.link) app.link.destroy(); location.href = location.pathname + (NET === 'fake' ? '?net=fake' : ''); });
let lastCall = 0;
$('btn-call').addEventListener('click', () => {
  if (!app.playing || performance.now() - lastCall < 1500) return;
  lastCall = performance.now();
  play('tap');
  // Solo : le coéquipier IA quitte le coin pause et vient te rejoindre
  if (app.mode === 'solo' && app.bot && app.sim) { app.bot.calledAt = app.sim.time; UI.toast('Le coéquipier IA arrive.', 'info'); return; }
  UI.toast('Signal envoyé à ton partenaire.', 'info');
  if (app.isHost) app.pendingFx.push({ to: 'B', k: 'call', text: 'Ton partenaire t’appelle !', x: app.me.x, z: app.me.z, meet: true });
  else if (app.link) app.link.send({ t: 'ping' });
});

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* ignoré */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && app.playing) keepAwake();
  if (document.visibilityState === 'hidden') saveGame();
});
addEventListener('pagehide', saveGame);

// ---------- qualité adaptative ----------
const perf = { t: 0, n: 0, level: 0 };
function adapt(dt) {
  perf.t += dt; perf.n += 1;
  if (perf.t < 3) return;
  const fps = perf.n / perf.t;
  perf.t = 0; perf.n = 0;
  if (fps < 32 && perf.level === 0) { renderer.ratioCap = 1.1; perf.level = 1; }
  else if (fps < 26 && perf.level === 1) { renderer.shadows = false; perf.level = 2; }
}

// ---------- boucle ----------
let last = performance.now(), clock = 0, menuT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  const st = app.st;
  if (app.playing && st && renderer && scene) {
    const inp = input.read();
    const locked = !!(st.gen && st.gen.lockUntil > Date.now());
    if (locked !== app.locked) {
      app.locked = locked;
      UI.overlay('screen-lock', locked);
      if (!locked && app.wasLockedOnce) UI.toast('Le générateur a refroidi : rechargez-le en charbon ou en bois.', 'warn');
      if (locked) app.wasLockedOnce = true;
    }
    if (locked) UI.fillLock(st.gen.lockUntil - Date.now());
    const frozen = UI.isOverlay();
    const jx = frozen ? 0 : inp.mx, jz = frozen ? 0 : inp.mz;
    // Joystick relatif à la caméra
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    let mx = rx * jx - fx * jz, mz = rz * jx - fz * jz;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const p = st.players[app.myId];
    const me = app.me;
    if (p.locked) { me.x = p.x; me.z = p.z; me.rot = p.rot; app.wasLocked = true; }
    else {
      if (app.wasLocked) { me.x = p.x; me.z = p.z; app.wasLocked = false; }
      [me.x, me.z] = moveCircle(me.x, me.z, mx * SPEED * dt, mz * SPEED * dt, obstacles(st));
      if (ml > 0.05) me.rot = Math.atan2(mx, mz);
    }
    // La caméra se replace doucement derrière le joueur quand il avance
    const forward = Math.max(0, -jz);
    if (forward > 0.2 && !p.locked && now - cam.manualAt > 1500) {
      let d = me.rot - cam.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cam.yaw += d * Math.min(1, dt * 1.4 * forward);
    }

    if (app.isHost && app.paused) {
      app.localEvents = [];
      if (now - app.lastSave > 20000) saveGame();
    } else if (app.isHost && locked) {
      // Pause obligatoire : le temps de jeu ne compte pas, seuls les achats du vestiaire passent
      const r = app.remote;
      commandsOnly(app.sim, { A: { events: app.localEvents }, B: { events: r.events } });
      app.localEvents = []; r.events = [];
      for (const f of drainFx(app.sim)) { if (f.to === 'A' || f.to === 'all') handleFx(f); if (app.link && (f.to === 'B' || f.to === 'all') && f.k !== 'save') app.pendingFx.push(f); }
      if (app.link && now - app.lastSend > 250) { app.link.send('{"t":"s","fx":' + JSON.stringify(app.pendingFx) + ',"st":' + JSON.stringify(app.sim, round) + '}'); app.pendingFx = []; app.lastSend = now; }
      if (now - app.lastSave > 20000) saveGame();
    } else if (app.isHost) {
      const events = (frozen ? [] : inp.events).concat(app.localEvents);
      app.localEvents = [];
      const A = { x: me.x, z: me.z, rot: me.rot, mx, mz, held: inp.held && !frozen, events };
      let B;
      if (app.mode === 'solo') B = botInput(app.sim, app.bot, dt, A);
      else { const r = app.remote; B = { x: r.x, z: r.z, rot: r.rot, mx: r.mx, mz: r.mz, held: r.held, events: r.events }; r.events = []; }
      app.sim.clock = Date.now();
      // Revenu après 30 minutes ou plus sans jouer (téléphone en veille) : le compteur d'une heure repart à zéro
      if (app.lastWall && Date.now() - app.lastWall >= T.restReset * 1000) app.sim.gen.play = 0;
      app.lastWall = Date.now();
      step(app.sim, dt, { A, B });
      for (const f of drainFx(app.sim)) {
        if (f.to === 'A' || f.to === 'all') handleFx(f);
        if (app.link && (f.to === 'B' || f.to === 'all') && f.k !== 'save') app.pendingFx.push(f);
      }
      // État compact (nombres arrondis) envoyé 10 fois par seconde
      if (app.link && now - app.lastSend > 100) {
        // Texte JSON prêt à l'emploi : la liaison le découpe s'il est trop gros
        app.link.send('{"t":"s","fx":' + JSON.stringify(app.pendingFx) + ',"st":' + JSON.stringify(app.sim, round) + '}');
        app.pendingFx = [];
        app.lastSend = now;
      }
      if (now - app.lastSave > 20000) saveGame();
    } else if (app.link && now - app.lastSend > 66) {
      app.link.send({ t: 'in', x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, r: Math.round(me.rot * 100) / 100, mx, mz, h: inp.held });
      app.lastSend = now;
    }

    // Caméra
    renderer.resize();
    const ty = height(me.x, me.z) + 1.2;
    if (!cam.init) { cam.x = me.x; cam.z = me.z; cam.init = true; }
    const kc = 1 - Math.exp(-dt * 10);
    cam.x += (me.x - cam.x) * kc; cam.z += (me.z - cam.z) * kc;
    const fwx = Math.sin(cam.yaw), fwz = Math.cos(cam.yaw);
    const hd = cam.dist * Math.cos(cam.pitch), vd = cam.dist * Math.sin(cam.pitch);
    const ex = cam.x - fwx * hd, ez = cam.z - fwz * hd;
    const ey = Math.max(ty + vd, height(ex, ez) + 1.5);
    renderer.setCamera([ex, ey, ez], [cam.x + fwx * 1.5, ty, cam.z + fwz * 1.5], innerHeight > innerWidth ? 1.05 : 0.85);
    // L'invité reçoit l'aménagement dans l'état : les machines se placent pareil sur les deux téléphones
    if (!app.isHost) applyLayout(st);
    const ghost = updatePlacing(st, me);
    updateScene(scene, st, { myId: app.myId, me, dt, time: clock, ghost });
    // Ciel autour de la caméra, jour et nuit selon le temps de jeu
    scene.sky.pos = [ex, 0, ez];
    dayNight(scene, renderer.env, st.time);
    renderer.render(scene.root, dt);
    labels.update(renderer, UI.worldLabels(st, app.myId, me));
    UI.updateHud(st, app.myId, { bot: app.bot ? botLabel(app.bot) : '', me });
    // Appel du partenaire : bord clignotant et flèche vers lui, jusqu'à ce qu'on soit sur place (15 s au plus)
    if (app.call) {
      const o = st.players[other(app.myId)], c = app.call;
      const gap = (q) => (Number.isFinite(q.x) && Number.isFinite(q.z) ? Math.hypot(me.x - q.x, me.z - q.z) : 1e9);
      // sur place, ou (simple appel « viens ») à côté du partenaire ; toujours visible au moins 1,5 s
      const there = now - c.from > 1500 && (gap(c) < 3.3 || (c.meet && gap(o) < 3));
      if (now > c.until || there) { app.call = null; UI.callStop(); }
      else UI.pointTo(o.x, o.z, 0.3);
    }
    UI.updateArrow(renderer);
    UI.updateFloaters(renderer);
    // Menus ouverts : mis à jour en direct
    menuT += dt;
    if (menuT > 0.25) {
      menuT = 0;
      const on = (id) => $(id).classList.contains('active');
      if (on('screen-usine')) UI.fillUsine(st, app.usineTab, usineSend, app.myId);
      if (on('screen-entrepot')) UI.fillEntrepot(st, app.myId, sendCmd);
      if (on('screen-recettes') && app.recMach) UI.fillRecettes(st, app.recMach, sendCmd);
      if (on('screen-spec')) UI.fillSpec(st, app.myId, pickSpec);
      if (on('screen-zone')) UI.fillZone(st, app.myId, sendCmd);
    }
    adapt(dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const j = params.get('join');
if (j) { codeInput.value = cleanCode(j); join(j, false); }

window.__ts = {
  app, cam, LEVELS, saveGame, readSave, openMenu,
  tp(x, z, yaw) { app.me.x = x; app.me.z = z; cam.init = false; if (yaw !== undefined) { cam.yaw = yaw; cam.manualAt = performance.now(); } },
  joy(mx, mz) { input.mx = mx; input.mz = mz; },
  press() { input.inject('down'); },
  release() { input.inject('up'); },
  renderer: () => renderer,
  forceBuild: (id) => forceBuild(app.sim, id),
  cmd: (e) => sendCmd(e),
  // Avance la simulation sans attendre le rendu (tests automatiques)
  advance(sec, held = false) {
    const n = Math.round(sec * 30);
    for (let i = 0; i < n; i++) {
      const A = { x: app.me.x, z: app.me.z, rot: app.me.rot, mx: 0, mz: 0, held, events: i === 0 && held ? ['down'] : [] };
      const B = app.mode === 'solo' ? botInput(app.sim, app.bot, 1 / 30, A) : { ...app.remote, events: [] };
      step(app.sim, 1 / 30, { A, B });
      for (const f of drainFx(app.sim)) if (f.to === 'A' || f.to === 'all') handleFx(f);
      const p = app.sim.players.A;
      if (p.locked) { app.me.x = p.x; app.me.z = p.z; }
    }
    if (held) step(app.sim, 1 / 30, { A: { x: app.me.x, z: app.me.z, rot: app.me.rot, held: false, events: ['up'] }, B: app.mode === 'solo' ? botInput(app.sim, app.bot, 1 / 30, {}) : { ...app.remote, events: [] } });
  },
};
