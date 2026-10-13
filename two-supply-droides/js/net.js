// Connexion entre les deux téléphones.
// En vrai : PeerJS (WebRTC). Les téléphones se trouvent grâce à un serveur public,
// puis échangent directement entre eux (idéal sur le même Wi-Fi).
// En test (?net=fake) : un faux PeerJS qui passe par BroadcastChannel entre onglets.

const PREFIX = 'twosupply-v02-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function cleanCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('load ' + src));
    document.head.appendChild(s);
  });
}

export async function getPeerClass(mode) {
  if (mode === 'fake') return FakePeer;
  if (window.Peer) return window.Peer;
  const urls = [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  ];
  for (const u of urls) {
    try { await loadScript(u); if (window.Peer) return window.Peer; } catch (e) { /* essai suivant */ }
  }
  throw new Error('Impossible de charger le module de connexion. Vérifie la connexion internet.');
}

export class Link {
  constructor(PeerClass) {
    this.Peer = PeerClass;
    this.peer = null;
    this.conn = null;
    this.onMessage = () => {};
    this.onClose = () => {};
    this.onOpen = () => {};
    this.closed = false;
  }

  get open() { return !!(this.conn && this.conn.open); }

  send(msg) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(msg); } catch (e) { /* ignoré */ }
    }
  }

  _wire(conn) {
    this.conn = conn;
    conn.on('data', (d) => this.onMessage(d));
    conn.on('close', () => this._lost());
    conn.on('error', () => this._lost());
  }

  _lost() {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }

  // Hôte : réserve le code et attend l'invité. Résout avec le code.
  host() {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const attempt = () => {
        const code = makeCode();
        const peer = new this.Peer(PREFIX + code.toLowerCase(), { debug: 1 });
        let opened = false;
        peer.on('open', () => { opened = true; this.peer = peer; resolve(code); });
        peer.on('connection', (conn) => {
          if (this.conn && this.conn.open) { conn.on('open', () => conn.close()); return; }
          this.closed = false;
          this._wire(conn);
          conn.on('open', () => this.onOpen());
        });
        peer.on('error', (err) => {
          if (!opened && err && err.type === 'unavailable-id' && tries++ < 4) { peer.destroy(); attempt(); return; }
          if (!opened) reject(new Error(describe(err)));
        });
        peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* ignoré */ } });
      };
      attempt();
    });
  }

  // Invité : rejoint la partie d'après son code.
  join(code) {
    return new Promise((resolve, reject) => {
      const peer = new this.Peer({ debug: 1 });
      this.peer = peer;
      let done = false;
      const fail = (m) => { if (!done) { done = true; reject(new Error(m)); } };
      const timer = setTimeout(() => fail('Pas de réponse. Vérifie le code et que la partie est bien ouverte.'), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
        this._wire(conn);
        conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(); this.onOpen(); });
      });
      peer.on('error', (err) => { clearTimeout(timer); fail(describe(err)); });
    });
  }

  destroy() {
    this.closed = true;
    try { this.conn && this.conn.close(); } catch (e) { /* ignoré */ }
    try { this.peer && this.peer.destroy(); } catch (e) { /* ignoré */ }
  }
}

function describe(err) {
  const t = err && err.type;
  if (t === 'peer-unavailable') return 'Aucune partie avec ce code. Vérifie les 4 caractères.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Serveur de connexion injoignable. Vérifie la connexion internet.';
  if (t === 'browser-incompatible') return 'Ce navigateur ne permet pas le jeu à deux. Essaie Safari ou Chrome à jour.';
  return 'Connexion impossible (' + (t || (err && err.message) || 'inconnue') + ').';
}

// ---------- faux PeerJS pour les tests (deux onglets du même navigateur) ----------
class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; }
  emit(ev, ...a) { (this.h[ev] || []).forEach((fn) => fn(...a)); }
}

class FakeConn extends Emitter {
  constructor(peer, cid, remote) { super(); this.peer = peer; this.cid = cid; this.peerId = remote; this.open = false; }
  send(data) { this.peer.bus.postMessage({ k: 'data', cid: this.cid, from: this.peer.id, data: JSON.parse(JSON.stringify(data)) }); }
  close() { if (!this.open) return; this.open = false; this.peer.bus.postMessage({ k: 'close', cid: this.cid, from: this.peer.id }); this.emit('close'); }
}

export class FakePeer extends Emitter {
  constructor(id) {
    super();
    this.id = typeof id === 'string' ? id : 'anon-' + Math.random().toString(36).slice(2, 8);
    this.bus = new BroadcastChannel('twosupply-v02-fakepeer');
    this.conns = {};
    this.destroyed = false;
    this.bus.onmessage = (e) => this._rx(e.data);
    setTimeout(() => this.emit('open', this.id), 30);
  }
  _rx(m) {
    if (m.from === this.id) return;
    if (m.k === 'connect' && m.to === this.id) {
      const c = new FakeConn(this, m.cid, m.from);
      this.conns[m.cid] = c;
      this.emit('connection', c);
      this.bus.postMessage({ k: 'accept', cid: m.cid, from: this.id, to: m.from });
      setTimeout(() => { c.open = true; c.emit('open'); }, 20);
    } else if (m.k === 'accept' && m.to === this.id) {
      const c = this.conns[m.cid];
      if (c && !c.open) { c.open = true; c.emit('open'); }
    } else if (m.k === 'data' && this.conns[m.cid]) {
      this.conns[m.cid].emit('data', m.data);
    } else if (m.k === 'close' && this.conns[m.cid]) {
      const c = this.conns[m.cid];
      if (c.open) { c.open = false; c.emit('close'); }
    }
  }
  connect(to) {
    const cid = Math.random().toString(36).slice(2);
    const c = new FakeConn(this, cid, to);
    this.conns[cid] = c;
    this.bus.postMessage({ k: 'connect', cid, from: this.id, to });
    setTimeout(() => { if (!c.open) this.emit('error', { type: 'peer-unavailable' }); }, 1500);
    return c;
  }
  reconnect() {}
  destroy() { this.destroyed = true; Object.values(this.conns).forEach((c) => c.close()); this.bus.close(); }
}
