// Transforme une partie brute de l'API chess.com en enregistrement analysable.
import { Chess } from '../vendor/chess.js';
import { parseHeaders, parseMoves, parseTimeControl, openingFromHeaders } from './pgn.js';

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const DRAW_CODES = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

export const OPENING_LAST_MOVE = 12;

function material(chess) {
  const m = { w: 0, b: 0, wPieces: 0, bPieces: 0 };
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      m[sq.color] += VALUES[sq.type];
      if (sq.type !== 'p') m[sq.color + 'Pieces'] += VALUES[sq.type];
    }
  }
  return m;
}

function phaseOf(moveNumber, isEndgame) {
  if (isEndgame) return 'endgame';
  return moveNumber <= OPENING_LAST_MOVE ? 'opening' : 'middlegame';
}

export function processGame(raw, username) {
  const me = username.toLowerCase();
  const isWhite = raw.white.username.toLowerCase() === me;
  const color = isWhite ? 'w' : 'b';
  const mine = isWhite ? raw.white : raw.black;
  const opp = isWhite ? raw.black : raw.white;
  const headers = parseHeaders(raw.pgn || '');
  const tc = parseTimeControl(raw.time_control || headers.TimeControl);

  let result;
  if (mine.result === 'win') result = 'win';
  else if (opp.result === 'win') result = 'loss';
  else if (DRAW_CODES.has(mine.result)) result = 'draw';
  else result = 'draw';

  const record = {
    url: raw.url,
    endTime: raw.end_time,
    timeClass: raw.time_class,
    rules: raw.rules,
    rated: raw.rated,
    tc,
    color,
    myRating: mine.rating,
    oppRating: opp.rating,
    oppName: opp.username,
    result,
    myCode: mine.result,
    oppCode: opp.result,
    opening: openingFromHeaders(headers),
    accuracy: raw.accuracies ? raw.accuracies[isWhite ? 'white' : 'black'] : null,
    initialFen: raw.initial_setup || headers.FEN || undefined,
    plies: [],
    endgameEntryDiff: null,
    valid: true,
  };

  if (raw.rules && raw.rules !== 'chess') { record.valid = false; return record; }

  const moves = parseMoves(raw.pgn || '');
  let chess;
  try {
    chess = record.initialFen ? new Chess(record.initialFen) : new Chess();
  } catch {
    record.valid = false;
    return record;
  }
  let prevClock = { w: tc.base, b: tc.base };
  let endgameReached = false;

  for (let i = 0; i < moves.length; i++) {
    const fenBefore = chess.fen();
    const side = chess.turn();
    const moveNumber = chess.moveNumber();
    let mv;
    try {
      mv = chess.move(moves[i].san);
    } catch {
      break;
    }
    const mat = material(chess);
    if (!endgameReached && mat.wPieces <= 13 && mat.bPieces <= 13) {
      endgameReached = true;
      record.endgameEntryDiff = color === 'w' ? mat.w - mat.b : mat.b - mat.w;
    }
    const clock = moves[i].clock;
    let spent = null;
    if (clock !== null && prevClock[side] !== null && !tc.daily) {
      spent = Math.max(0, prevClock[side] - clock + tc.inc);
    }
    if (clock !== null) prevClock[side] = clock;
    const diff = color === 'w' ? mat.w - mat.b : mat.b - mat.w;
    record.plies.push({
      san: mv.san,
      uci: mv.from + mv.to + (mv.promotion || ''),
      side,
      mine: side === color,
      moveNumber,
      fenBefore,
      clock,
      spent,
      diff,
      phase: phaseOf(moveNumber, endgameReached),
    });
  }
  record.fullMoves = record.plies.length ? record.plies[record.plies.length - 1].moveNumber : 0;
  record.finalFen = chess.fen();
  record.endgameReached = endgameReached;
  annotate(record);
  return record;
}

// Indicateurs dérivés d'une partie : matériel, horloge, moment décisif.
function annotate(g) {
  const plies = g.plies;
  const diffs = plies.map(p => p.diff);
  g.maxAdvantage = diffs.length ? Math.max(0, ...diffs) : 0;
  g.maxDeficit = diffs.length ? Math.min(0, ...diffs) : 0;
  g.finalDiff = diffs.length ? diffs[diffs.length - 1] : 0;

  // Avantage "solide" : au moins +3 conservé pendant 4 demi-coups consécutifs.
  g.hadWinningAdvantage = hasStreak(diffs, d => d >= 3, 4);
  g.hadLosingDeficit = hasStreak(diffs, d => d <= -3, 4);

  // Moment où la partie a basculé : premier demi-coup après lequel on reste à -3 ou pire.
  g.collapse = null;
  for (let i = 0; i < plies.length; i++) {
    if (diffs[i] <= -3 && diffs.slice(i).every(d => d <= -2)) {
      // Le coup fautif est mon dernier coup avant (ou à) ce moment.
      let k = i;
      while (k >= 0 && !plies[k].mine) k--;
      if (k < 0) k = i;
      g.collapse = { ply: k, phase: plies[k].phase, moveNumber: plies[k].moveNumber, spent: plies[k].spent };
      break;
    }
  }

  // Horloge
  const my = plies.filter(p => p.mine);
  g.myMoves = my.length;
  const base = g.tc.base;
  if (base && !g.tc.daily && my.some(p => p.clock !== null)) {
    const clocks = my.filter(p => p.clock !== null);
    const last = clocks[clocks.length - 1];
    g.clock = {
      final: last.clock,
      finalRatio: last.clock / base,
      minRatio: Math.min(...clocks.map(p => p.clock)) / base,
      openingUsedRatio: openingUsed(my, base),
      avgSpent: avg(my.map(p => p.spent).filter(v => v !== null)),
      timeTrouble: clocks.some(p => p.clock < Math.max(base * 0.1, 10)),
    };
  } else {
    g.clock = null;
  }
}

function openingUsed(myPlies, base) {
  const first = myPlies.filter(p => p.moveNumber <= 10 && p.spent !== null);
  if (!first.length) return null;
  return first.reduce((s, p) => s + p.spent, 0) / base;
}

function hasStreak(arr, pred, len) {
  let run = 0;
  for (const v of arr) {
    run = pred(v) ? run + 1 : 0;
    if (run >= len) return true;
  }
  return false;
}

export function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
