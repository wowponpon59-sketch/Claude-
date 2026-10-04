// Analyse moteur avec Stockfish (exécuté localement dans un Web Worker).
import { Chess } from '../vendor/chess.js';
import { RESOURCES } from './resources.js';

export class Engine {
  constructor(path = 'vendor/stockfish.js') {
    this.worker = new Worker(path);
    this.listeners = [];
    this.worker.onmessage = e => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of [...this.listeners]) l(line);
    };
  }

  send(cmd) { this.worker.postMessage(cmd); }

  waitFor(pred) {
    return new Promise(resolve => {
      const l = line => {
        if (pred(line)) {
          this.listeners = this.listeners.filter(x => x !== l);
          resolve(line);
        }
      };
      this.listeners.push(l);
    });
  }

  async init() {
    const ok = this.waitFor(l => l === 'uciok');
    this.send('uci');
    await ok;
    this.send('setoption name Hash value 32');
    const ready = this.waitFor(l => l === 'readyok');
    this.send('isready');
    await ready;
  }

  // Score du point de vue du camp au trait : { cp } ou { mate }.
  async evaluate(fen, depth) {
    let score = null;
    const onInfo = line => {
      const m = /score (cp|mate) (-?\d+)/.exec(line);
      if (m && / pv /.test(line) && !/ (upper|lower)bound/.test(line)) score = { [m[1]]: Number(m[2]) };
    };
    this.listeners.push(onInfo);
    const done = this.waitFor(l => l.startsWith('bestmove'));
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const line = await done;
    this.listeners = this.listeners.filter(x => x !== onInfo);
    const best = line.split(' ')[1];
    return { score: score || { cp: 0 }, bestMove: best && best !== '(none)' ? best : null };
  }

  terminate() { this.worker.terminate(); }
}

// Probabilité de gain ramenée à [-1, 1] (formule utilisée par Lichess).
export function winChance(score) {
  if (score.mate !== undefined) return score.mate > 0 ? 1 : -1;
  const cp = Math.max(-1000, Math.min(1000, score.cp));
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

export function classifyDrop(drop) {
  if (drop >= 0.3) return 'blunder';
  if (drop >= 0.2) return 'mistake';
  if (drop >= 0.1) return 'inaccuracy';
  return null;
}

function negate(score) {
  return score.mate !== undefined ? { mate: -score.mate } : { cp: -score.cp };
}

function terminalEval(fen) {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { score: { mate: -1 }, bestMove: null };
  if (c.isDraw() || c.isStalemate()) return { score: { cp: 0 }, bestMove: null };
  return null;
}

export const THEMES = {
  missedMate: { label: 'Mat manqué', resources: 'kingSafety', lichess: 'mateIn2' },
  allowedMate: { label: 'Mat concédé', resources: 'kingSafety', lichess: 'defensiveMove' },
  hangingPiece: { label: 'Pièce laissée en prise', resources: 'blunders', lichess: 'hangingPiece' },
  missedTactic: { label: 'Tactique manquée', resources: 'tactics', lichess: 'fork' },
  positional: { label: 'Erreur de jugement / calcul', resources: 'strategy', lichess: 'middlegame' },
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function uciMove(chess, uci) {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  } catch {
    return null;
  }
}

function themeOf(before, after, ply, nextFen) {
  if (before.score.mate > 0 && !(after.mate > 0)) return 'missedMate';
  if (after.mate < 0) return 'allowedMate';
  if (after.oppBest) {
    const reply = uciMove(new Chess(nextFen), after.oppBest);
    if (reply && reply.captured && PIECE_VALUES[reply.captured] >= 3) return 'hangingPiece';
  }
  if (before.bestMove) {
    const best = uciMove(new Chess(ply.fenBefore), before.bestMove);
    if (best && (best.captured || best.san.includes('+'))) return 'missedTactic';
  }
  return 'positional';
}

// Analyse tous les coups d'une partie ; renvoie les erreurs du joueur.
export async function analyzeGame(game, engine, depth, onStep) {
  const fens = game.plies.map(p => p.fenBefore).concat(game.finalFen);
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    evals.push(terminalEval(fens[i]) || await engine.evaluate(fens[i], depth));
    if (onStep) onStep(i + 1, fens.length);
  }
  const errors = [];
  game.plies.forEach((ply, i) => {
    if (!ply.mine) return;
    const before = evals[i];
    const afterRaw = evals[i + 1];
    const after = { ...negate(afterRaw.score), oppBest: afterRaw.bestMove };
    const drop = winChance(before.score) - winChance(after);
    const kind = classifyDrop(drop);
    if (!kind || !before.bestMove || before.bestMove === ply.uci) return;
    const base = game.tc.base;
    errors.push({
      kind,
      drop,
      theme: themeOf(before, after, ply, fens[i + 1]),
      phase: ply.phase,
      moveNumber: ply.moveNumber,
      color: game.color,
      fen: ply.fenBefore,
      played: ply.san,
      best: before.bestMove,
      evalBefore: before.score,
      evalAfter: { cp: after.cp, mate: after.mate },
      inTimeTrouble: base && ply.clock !== null ? ply.clock < Math.max(base * 0.1, 10) : false,
      url: game.url,
      opponent: game.oppName,
      opening: game.opening.name,
    });
  });
  return errors;
}

// Axes de progression issus de l'analyse moteur.
export function engineInsights(errors, gamesAnalyzed) {
  const insights = [];
  if (!gamesAnalyzed) return insights;
  const blunders = errors.filter(e => e.kind === 'blunder');
  const perGame = blunders.length / gamesAnalyzed;
  const themeCounts = {};
  for (const e of errors.filter(e => e.kind !== 'inaccuracy')) themeCounts[e.theme] = (themeCounts[e.theme] || 0) + 1;
  const phaseCounts = { opening: 0, middlegame: 0, endgame: 0 };
  for (const e of blunders) phaseCounts[e.phase]++;
  const phaseNames = { opening: 'l\'ouverture', middlegame: 'le milieu de partie', endgame: 'la finale' };
  const worstPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];

  insights.push({
    id: 'engine-summary',
    category: 'tactics',
    severity: perGame >= 1 ? 3 : perGame >= 0.5 ? 2 : 1,
    title: `${perGame.toFixed(1)} gaffe(s) par partie selon Stockfish`,
    detail: `${blunders.length} gaffes et ${errors.filter(e => e.kind === 'mistake').length} erreurs sur ${gamesAnalyzed} parties analysées` +
      (blunders.length ? ` ; la plupart dans ${phaseNames[worstPhase[0]]} (${worstPhase[1]}).` : '.'),
    tips: ['Rejouez les exercices générés à partir de vos propres erreurs ci-dessous : ce sont les motifs qui vous coûtent des points.'],
    resources: worstPhase[0] === 'endgame' ? RESOURCES.endgame : worstPhase[0] === 'opening' ? RESOURCES.openingPrinciples : RESOURCES.tactics,
  });

  const sortedThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  for (const [theme, n] of sortedThemes.slice(0, 2)) {
    if (n < 2) continue;
    const t = THEMES[theme];
    insights.push({
      id: `engine-theme-${theme}`,
      category: theme === 'positional' ? 'strategy' : 'tactics',
      severity: 2,
      title: `Motif récurrent : ${t.label.toLowerCase()}`,
      detail: `${n} erreurs ou gaffes de ce type dans les parties analysées.`,
      tips: [],
      resources: RESOURCES[t.resources],
    });
  }

  const trouble = blunders.filter(e => e.inTimeTrouble).length;
  if (blunders.length >= 4 && trouble / blunders.length >= 0.4) {
    insights.push({
      id: 'engine-time-trouble',
      category: 'time',
      severity: 2,
      title: 'Les gaffes arrivent en zeitnot',
      detail: `${trouble} gaffes sur ${blunders.length} ont été jouées avec moins de 10 % du temps restant.`,
      tips: ['Gardez une réserve de temps pour la fin de partie : c\'est là que vos gaffes se concentrent.'],
      resources: RESOURCES.time,
    });
  }
  return insights;
}
