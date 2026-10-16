// Petits sons synthétisés (aucun fichier à charger).
let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function play(name) {
  switch (name) {
    case 'pick': tone(520, 0.08, 'triangle', 0.1); tone(780, 0.08, 'triangle', 0.08, 0.05); break;
    case 'drop': tone(420, 0.1, 'triangle', 0.1, 0, 0.7); break;
    case 'tap': tone(900, 0.04, 'square', 0.05); break;
    case 'ok': tone(660, 0.12, 'triangle', 0.12); tone(990, 0.18, 'triangle', 0.1, 0.1); break;
    case 'err': tone(180, 0.18, 'sawtooth', 0.06); break;
    case 'clong': tone(240, 0.35, 'square', 0.06, 0, 0.98); tone(360, 0.35, 'square', 0.05, 0.12, 0.98); break;
    case 'ding': tone(1320, 0.3, 'sine', 0.1); break;
    case 'order': tone(880, 0.1, 'sine', 0.1); tone(1175, 0.14, 'sine', 0.1, 0.11); break;
    case 'call': // sonnerie en deux coups, plus forte
      for (const w of [0, 0.9]) { tone(880, 0.16, 'square', 0.16, w); tone(1175, 0.16, 'square', 0.16, w + 0.18); tone(880, 0.16, 'square', 0.16, w + 0.36); }
      break;
    case 'overheat': tone(220, 0.5, 'sawtooth', 0.14, 0, 0.5); tone(160, 0.7, 'sawtooth', 0.12, 0.45, 0.6); break;
    case 'cred': tone(1320, 0.07, 'triangle', 0.06); tone(1760, 0.08, 'triangle', 0.05, 0.06); break;
    case 'won': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.12)); break;
  }
}
