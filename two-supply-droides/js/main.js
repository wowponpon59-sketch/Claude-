// Two Supply — Droïdes (version 0.3) : relie modes de jeu, connexion, sauvegarde, simulation, caméra et rendu.
import { newState, restoreState, step, drainFx, forceBuild } from './sim.js';
import { createBot, botInput, botLabel } from './bot.js';
import { obstacles, moveCircle } from './move.js';
import { SPEED, LEVELS, SAVE_KEY } from './config.js';
import { height, genWorld } from './world.js';
import { Renderer } from './gl.js';
import { buildScene, updateScene } from './scene.js';
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
for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, unlockAudio, { passive: true });

// ---------- sauvegarde (sur le téléphone qui héberge la partie) ----------
const round = (k, v) => (k === 'fx' ? undefined : typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.st && d.st.v === 3 ? d : null;
  } catch (e) { return null; }
}
function saveGame() {
  if (!app.isHost || !app.sim || !app.playing) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), st: app.sim }, round));
    app.lastSave = performance.now();
  } catch (e) { /* stockage indisponible : on continue sans sauvegarde */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignoré */ } }

function showResume() {
  const d = readSave();
  app.saved = d;
  $('resume').hidden = !d;
  if (!d) return;
  const s = d.st, t = Math.round(s.time);
  const when = new Date(d.at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  $('resume-info').innerHTML = `<b>Partie sauvegardée</b> · niveau ${s.level + 1}/10 (${LEVELS[s.level].name}) · ${s.droids.length} droïdes · ${s.credits} crédits · ${Math.floor(t / 60)} min de jeu<br><span class="muted">${when}</span>`;
}
showResume();

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
$('btn-solo').addEventListener('click', () => playSolo(null));
$('btn-resume-solo').addEventListener('click', () => playSolo(app.saved && app.saved.st));
$('btn-host').addEventListener('click', () => hostGame(null));
$('btn-resume-duo').addEventListener('click', () => hostGame(app.saved && app.saved.st));
let delArmed = false;
$('btn-resume-del').addEventListener('click', () => {
  if (!delArmed) { delArmed = true; $('btn-resume-del').textContent = 'Toucher encore pour effacer'; setTimeout(() => { delArmed = false; $('btn-resume-del').textContent = 'Effacer la sauvegarde'; }, 3000); return; }
  clearSave(); showResume();
});

async function hostGame(saved) {
  unlockAudio(); goFullscreen();
  UI.setMsg('home-msg', 'Création de la partie…');
  $('btn-host').disabled = true; $('btn-resume-duo').disabled = true;
  try {
    const Peer = await getPeerClass(NET);
    const link = new Link(Peer);
    app.link = link; app.mode = 'duo';
    link.onMessage = hostMessage;
    link.onClose = lost;
    link.onOpen = () => startGame(saved);
    const code = await link.host();
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
    link.onClose = lost;
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
  } else app.sim = newState(app.mode);
  app.st = app.sim;
  app.wonShown = !!app.sim.won;
  if (app.link) app.link.send({ t: 'start', st: app.sim });
  beginGame(!!saved);
}

function beginGame(resumed) {
  app.playing = true;
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
const CMDS = new Set(['spec', 'take', 'put', 'putall', 'request', 'recipes', 'buy', 'wear']);
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
      for (const k of ['type', 'item', 'mach', 'outfit']) if (typeof m[k] === 'string' || m[k] === null) e[k] = m[k];
      if (Number.isFinite(m.n)) e.n = m.n;
      if (Array.isArray(m.sel)) e.sel = m.sel.filter((x) => typeof x === 'string').slice(0, 12);
      r.events.push(e);
      break;
    }
    case 'ping': if (app.sim) { const b = app.sim.players.B; handleFx({ k: 'call', text: 'Ton partenaire t’appelle !', x: b.x, z: b.z }); } break;
  }
}
function clientMessage(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'start') {
    genWorld(m.st.seed);
    app.st = m.st;
    beginGame(m.st.time > 5);
  } else if (m.t === 's' && app.playing) {
    try { app.st = JSON.parse(m.j); } catch (e) { return; }
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

function openMenu(kind, mach) {
  const st = app.st;
  if (kind === 'entrepot') { UI.fillEntrepot(st, app.myId, sendCmd); UI.overlay('screen-entrepot', true); }
  else if (kind === 'spec') { UI.fillSpec(st, app.myId, pickSpec); UI.overlay('screen-spec', true); }
  else if (kind === 'recettes' && mach && st.machines[mach]) { app.recMach = mach; UI.fillRecettes(st, mach, sendCmd); UI.overlay('screen-recettes', true); }
}

function handleFx(f) {
  switch (f.k) {
    case 'toast': UI.toast(f.text, f.tone); break;
    case 'sfx': play(f.s); break;
    case 'call':
      UI.toast(f.text, 'call');
      UI.pointTo(f.x, f.z);
      play('call');
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      break;
    case 'menu': if (!UI.isOverlay()) openMenu(f.menu); break;
    case 'level':
      play('won');
      UI.banner(`Niveau ${f.n}`, f.name);
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
function lost() { $('net-dot').classList.add('bad'); saveGame(); UI.overlay('screen-lost', true); }

// ---------- boutons ----------
$('btn-go').addEventListener('click', () => {
  UI.overlay('screen-howto', false);
  if (app.st && app.st.level === 0 && !app.st.machines.forge) UI.pointTo(-17, -10, 5);
});
$('btn-usine').addEventListener('click', () => { UI.fillUsine(app.st, app.usineTab, sendCmd); UI.overlay('screen-usine', true); });
$('btn-usine-close').addEventListener('click', () => UI.overlay('screen-usine', false));
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { app.usineTab = t.dataset.tab; UI.fillUsine(app.st, app.usineTab, sendCmd); }));
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
  UI.toast('Signal envoyé à ton partenaire.', 'info');
  if (app.isHost) app.pendingFx.push({ to: 'B', k: 'call', text: 'Ton partenaire t’appelle !', x: app.me.x, z: app.me.z });
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

    if (app.isHost) {
      const events = (frozen ? [] : inp.events).concat(app.localEvents);
      app.localEvents = [];
      const A = { x: me.x, z: me.z, rot: me.rot, mx, mz, held: inp.held && !frozen, events };
      let B;
      if (app.mode === 'solo') B = botInput(app.sim, app.bot, dt, A);
      else { const r = app.remote; B = { x: r.x, z: r.z, rot: r.rot, mx: r.mx, mz: r.mz, held: r.held, events: r.events }; r.events = []; }
      step(app.sim, dt, { A, B });
      for (const f of drainFx(app.sim)) {
        if (f.to === 'A' || f.to === 'all') handleFx(f);
        if (app.link && (f.to === 'B' || f.to === 'all') && f.k !== 'save') app.pendingFx.push(f);
      }
      // État compact (nombres arrondis) envoyé 10 fois par seconde
      if (app.link && now - app.lastSend > 100) {
        app.link.send({ t: 's', j: JSON.stringify(app.sim, round), fx: app.pendingFx });
        app.pendingFx = [];
        app.lastSend = now;
      }
      if (now - app.lastSave > 20000) saveGame();
    } else if (now - app.lastSend > 66) {
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
    updateScene(scene, st, { myId: app.myId, me, dt, time: clock });
    renderer.render(scene.root, dt);
    labels.update(renderer, UI.worldLabels(st, app.myId, me));
    UI.updateHud(st, app.myId, { bot: app.bot ? botLabel(app.bot) : '', me });
    UI.updateArrow(renderer);
    // Menus ouverts : mis à jour en direct
    menuT += dt;
    if (menuT > 0.25) {
      menuT = 0;
      const on = (id) => $(id).classList.contains('active');
      if (on('screen-usine')) UI.fillUsine(st, app.usineTab, sendCmd);
      if (on('screen-entrepot')) UI.fillEntrepot(st, app.myId, sendCmd);
      if (on('screen-recettes') && app.recMach) UI.fillRecettes(st, app.recMach, sendCmd);
      if (on('screen-spec')) UI.fillSpec(st, app.myId, pickSpec);
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
