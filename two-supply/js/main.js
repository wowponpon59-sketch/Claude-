// Two Supply — prototype 0.1 : relie connexion, simulation, rendu et interface.
import { newState, step, drainFx } from './sim.js';
import { obstacles, moveCircle } from './move.js';
import { SPEED, POS, other } from './config.js';
import { Renderer } from './gl.js';
import { buildScene, updateScene } from './scene.js';
import { Link, getPeerClass, cleanCode } from './net.js';
import * as UI from './ui.js';
import { unlockAudio, play } from './audio.js';

const params = new URLSearchParams(location.search);
const NET = params.get('net') === 'fake' ? 'fake' : 'peer';
const $ = (id) => document.getElementById(id);

const app = {
  link: null, isHost: false, myId: 'A', code: null,
  lobby: { A: null, B: null }, starting: false,
  sim: null, st: null, playing: false,
  me: { x: 0, z: 0, rot: Math.PI }, wasLocked: false,
  remote: { x: NaN, z: NaN, rot: 0, mx: 0, mz: 0, held: false, events: [] },
  pendingFx: [], lastSend: 0, cam: null,
};

// ---------- rendu ----------
let renderer = null, scene = null;
try {
  renderer = new Renderer($('gl'));
  scene = buildScene();
} catch (e) {
  UI.setMsg('home-msg', 'Ce téléphone ne permet pas l’affichage 3D (WebGL) : ' + e.message, true);
}
const labels = new UI.Labels();

// ---------- commandes ----------
const input = UI.createInput((e) => {
  if (!app.playing || app.isHost || !app.link) return;
  if (e === 'down' && anyOverlay()) return;
  app.link.send({ t: 'ev', e });
});
const anyOverlay = () => ['screen-howto', 'screen-carnet', 'screen-win', 'screen-lost'].some((id) => $(id).classList.contains('active'));

for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, unlockAudio, { passive: true });

// ---------- accueil ----------
function goFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
}

function joinUrl(code) {
  return `${location.origin}${location.pathname}?join=${code}${NET === 'fake' ? '&net=fake' : ''}`;
}

$('btn-host').addEventListener('click', async () => {
  unlockAudio(); goFullscreen();
  UI.setMsg('home-msg', 'Création de la partie…');
  $('btn-host').disabled = true;
  try {
    const Peer = await getPeerClass(NET);
    const link = new Link(Peer);
    app.link = link;
    link.onMessage = hostMessage;
    link.onClose = lost;
    link.onOpen = () => {
      UI.show('screen-roles');
      UI.setPlayerColors('A');
      sendLobby();
    };
    const code = await link.host();
    app.isHost = true; app.myId = 'A'; app.code = code;
    $('wait-code').textContent = code;
    const url = joinUrl(code);
    const qr = $('qr');
    qr.innerHTML = '';
    const img = new Image();
    img.alt = 'QR code de la partie';
    img.onerror = () => { qr.textContent = 'QR code indisponible : utilise le code.'; };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(url)}`;
    qr.appendChild(img);
    UI.show('screen-wait');
    UI.setMsg('home-msg', '');
  } catch (e) {
    UI.setMsg('home-msg', e.message, true);
  } finally {
    $('btn-host').disabled = false;
  }
});

$('btn-share').addEventListener('click', async () => {
  const url = joinUrl(app.code);
  try {
    if (navigator.share) await navigator.share({ title: 'Two Supply', text: `Rejoins ma partie Two Supply (code ${app.code})`, url });
    else { await navigator.clipboard.writeText(url); UI.setMsg('wait-msg', 'Lien copié : envoie-le à ton partenaire.'); }
  } catch (e) { /* partage annulé */ }
});

$('btn-cancel').addEventListener('click', () => { if (app.link) app.link.destroy(); app.link = null; UI.show('screen-home'); });

const codeInput = $('join-code');
codeInput.addEventListener('input', () => { codeInput.value = cleanCode(codeInput.value); });
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-join').addEventListener('click', () => join(codeInput.value));

async function join(raw) {
  const code = cleanCode(raw);
  if (code.length !== 4) { UI.setMsg('home-msg', 'Le code fait 4 caractères.', true); return; }
  unlockAudio(); goFullscreen();
  UI.setMsg('home-msg', 'Connexion à la partie ' + code + '…');
  $('btn-join').disabled = true;
  try {
    const Peer = await getPeerClass(NET);
    const link = new Link(Peer);
    app.link = link;
    app.isHost = false; app.myId = 'B'; app.code = code;
    link.onMessage = clientMessage;
    link.onClose = lost;
    await link.join(code);
    UI.setPlayerColors('B');
    UI.show('screen-roles');
    UI.renderRoles(app.lobby, 'B');
    link.send({ t: 'hello', v: 1 });
    UI.setMsg('home-msg', '');
  } catch (e) {
    if (app.link) app.link.destroy();
    app.link = null;
    UI.setMsg('home-msg', e.message, true);
  } finally {
    $('btn-join').disabled = false;
  }
}

// ---------- choix des métiers ----------
document.querySelectorAll('.role-card').forEach((card) => {
  card.addEventListener('click', () => {
    const role = card.dataset.role;
    if (app.isHost) pickRole('A', role);
    else if (app.link) app.link.send({ t: 'role', role });
  });
});

function sendLobby() {
  if (app.link) app.link.send({ t: 'lobby', roles: app.lobby });
  UI.renderRoles(app.lobby, app.myId);
}

function pickRole(id, role) {
  if (app.starting) return;
  if (app.lobby[other(id)] === role) return;
  app.lobby[id] = role;
  sendLobby();
  if (app.lobby.A && app.lobby.B) {
    app.starting = true;
    setTimeout(startGame, 1200);
  }
}

function startGame() {
  app.sim = newState(app.lobby);
  app.st = app.sim;
  app.link.send({ t: 'start', roles: app.lobby, st: app.sim });
  beginGame();
}

function beginGame() {
  app.playing = true;
  app.starting = false;
  const role = app.lobby[app.myId];
  UI.setPlayerColors(app.myId);
  UI.fillCarnet(role);
  UI.show('');
  $('hud').hidden = false;
  UI.overlay('screen-win', false);
  UI.overlay('screen-howto', true);
  const p = app.st.players[app.myId];
  app.me = { x: p.x, z: p.z, rot: p.rot };
  app.cam = null;
  labels.clear();
  keepAwake();
}

// ---------- messages ----------
function hostMessage(m) {
  if (!m || typeof m !== 'object') return;
  const r = app.remote;
  switch (m.t) {
    case 'hello': sendLobby(); if (app.playing) app.link.send({ t: 'start', roles: app.lobby, st: app.sim }); break;
    case 'role': if (m.role === 'inge' || m.role === 'chef') pickRole('B', m.role); break;
    case 'in':
      if (Number.isFinite(m.x) && Number.isFinite(m.z)) { r.x = m.x; r.z = m.z; r.rot = +m.r || 0; }
      r.mx = clamp1(m.mx); r.mz = clamp1(m.mz); r.held = !!m.h;
      break;
    case 'ev':
      if (m.e === 'down' || m.e === 'up') { r.events.push(m.e); r.held = m.e === 'down'; }
      break;
    case 'ping':
      if (app.sim) { const b = app.sim.players.B; handleFx({ k: 'call', text: 'Ton partenaire t’appelle !', x: b.x, z: b.z }); }
      break;
    case 'replay': if (app.sim && app.sim.phase === 'won') restart(); break;
  }
}

function clientMessage(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'lobby':
      app.lobby = m.roles;
      if (!app.playing) { UI.show('screen-roles'); UI.renderRoles(app.lobby, app.myId); }
      break;
    case 'start':
      app.lobby = m.roles;
      app.st = m.st;
      beginGame();
      break;
    case 's':
      app.st = m.st;
      if (Array.isArray(m.fx)) m.fx.forEach(handleFx);
      break;
  }
}

const clamp1 = (v) => Math.max(-1, Math.min(1, +v || 0));

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
    case 'won': play('won'); showWin(); break;
  }
}

function showWin() {
  const s = app.st;
  const t = Math.round(s.wonAt || s.time);
  const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  $('win-stats').textContent = `${s.delivered} pains livrés en ${mm} min ${ss} s · ${s.missed} commande${s.missed > 1 ? 's' : ''} ratée${s.missed > 1 ? 's' : ''}.`;
  UI.overlay('screen-win', true);
}

function restart() {
  app.sim = newState(app.lobby);
  app.st = app.sim;
  app.pendingFx = [];
  app.link.send({ t: 'start', roles: app.lobby, st: app.sim });
  beginGame();
  UI.overlay('screen-howto', false);
}

function lost() {
  $('net-dot').classList.add('bad');
  UI.overlay('screen-lost', true);
}

// ---------- boutons du HUD ----------
$('btn-go').addEventListener('click', () => {
  UI.overlay('screen-howto', false);
  if (app.st && app.st.phase === 'crate') UI.pointTo(app.st.crate.x, app.st.crate.z, 7);
});
$('btn-carnet').addEventListener('click', () => UI.overlay('screen-carnet', true));
$('btn-carnet-close').addEventListener('click', () => UI.overlay('screen-carnet', false));
$('btn-rotate-ok').addEventListener('click', () => $('hud').classList.add('rot-ok'));
$('btn-replay').addEventListener('click', () => {
  if (app.isHost) restart();
  else if (app.link) { app.link.send({ t: 'replay' }); $('win-stats').textContent = 'Demande envoyée : la partie redémarre…'; }
});
$('btn-home').addEventListener('click', () => {
  if (app.link) app.link.destroy();
  location.href = location.pathname + (NET === 'fake' ? '?net=fake' : '');
});
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && app.playing) keepAwake(); });

// ---------- boucle ----------
let last = performance.now(), clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  const st = app.st;
  if (app.playing && st && renderer) {
    const inp = input.read();
    const frozen = anyOverlay();
    const mx = frozen ? 0 : inp.mx, mz = frozen ? 0 : inp.mz;
    const p = st.players[app.myId];
    const me = app.me;
    if (p.locked) {
      me.x = p.x; me.z = p.z; me.rot = p.rot; app.wasLocked = true;
    } else {
      if (app.wasLocked) { me.x = p.x; me.z = p.z; app.wasLocked = false; }
      [me.x, me.z] = moveCircle(me.x, me.z, mx * SPEED * dt, mz * SPEED * dt, obstacles(st));
      if (mx || mz) me.rot = Math.atan2(mx, mz);
    }

    if (app.isHost) {
      const r = app.remote;
      const events = frozen ? [] : inp.events;
      step(app.sim, dt, {
        A: { x: me.x, z: me.z, rot: me.rot, mx, mz, held: inp.held && !frozen, events },
        B: { x: r.x, z: r.z, rot: r.rot, mx: r.mx, mz: r.mz, held: r.held, events: r.events },
      });
      r.events = [];
      for (const f of drainFx(app.sim)) {
        if (f.to === 'A' || f.to === 'all') handleFx(f);
        if (f.to === 'B' || f.to === 'all') app.pendingFx.push(f);
      }
      if (now - app.lastSend > 50) {
        app.link.send({ t: 's', st: app.sim, fx: app.pendingFx });
        app.pendingFx = [];
        app.lastSend = now;
      }
    } else if (now - app.lastSend > 50) {
      app.link.send({ t: 'in', x: me.x, z: me.z, r: me.rot, mx, mz, h: inp.held });
      app.lastSend = now;
    }

    // Caméra qui suit le joueur
    renderer.resize();
    const portrait = innerHeight > innerWidth;
    const tx = Math.max(-7.5, Math.min(7.5, me.x)), tz = Math.max(-4.5, Math.min(4.6, me.z));
    if (!app.cam) app.cam = { x: tx, z: tz };
    const kc = 1 - Math.exp(-dt * 5);
    app.cam.x += (tx - app.cam.x) * kc;
    app.cam.z += (tz - app.cam.z) * kc;
    const h = portrait ? 17 : 11.5, back = portrait ? 9 : 7.6;
    renderer.setCamera([app.cam.x, h, app.cam.z + back], [app.cam.x, 0, app.cam.z - 0.6], portrait ? 0.95 : 0.8);
    const role = app.lobby[app.myId];
    updateScene(scene, st, { myId: app.myId, me, dt, time: clock, role });
    renderer.render(scene.root);
    labels.update(renderer, UI.worldLabels(st, app.myId, role, me));
    UI.updateHud(st, app.myId, role);
    UI.updateArrow(renderer);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Lien d'invitation : ?join=CODE
const j = params.get('join');
if (j) { codeInput.value = cleanCode(j); join(j); }

// Accès de test (scripts automatiques).
window.__ts = {
  app,
  tp(x, z) { app.me.x = x; app.me.z = z; },
  joy(mx, mz) { input.mx = mx; input.mz = mz; },
  press() { input.inject('down'); },
  release() { input.inject('up'); },
};
