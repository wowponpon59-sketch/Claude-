// Fabrique des parties au format de l'API chess.com pour les tests.
import { Chess } from '../vendor/chess.js';

export const ME = 'TestUser';

function fmtClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
}

let counter = 0;

// sans : coups SAN ; spend(i) : secondes passées sur le demi-coup i
export function makeGame({ sans, myColor = 'w', myResult, oppResult, base = 600, inc = 0, spend = () => 5,
  eco = 'https://www.chess.com/openings/Italian-Game-Two-Knights-Defense-4.Ng5', endTime, accuracy, oppRating = 1500 }) {
  const chess = new Chess();
  const clocks = { w: base, b: base };
  let movetext = '';
  sans.forEach((san, i) => {
    const side = chess.turn();
    const num = chess.moveNumber();
    chess.move(san);
    clocks[side] = Math.max(0, clocks[side] - spend(i) + inc);
    movetext += `${side === 'w' ? `${num}. ` : `${num}... `}${san} {[%clk ${fmtClock(clocks[side])}]} `;
  });
  const me = { username: ME, rating: 1500, result: myResult };
  const opp = { username: `Opp${counter}`, rating: oppRating, result: oppResult };
  const white = myColor === 'w' ? me : opp;
  const black = myColor === 'w' ? opp : me;
  const pgn = `[Event "Live Chess"]\n[Site "Chess.com"]\n[White "${white.username}"]\n[Black "${black.username}"]\n` +
    `[ECO "C57"]\n[ECOUrl "${eco}"]\n[TimeControl "${base}${inc ? '+' + inc : ''}"]\n\n${movetext}1-0\n`;
  counter++;
  return {
    url: `https://www.chess.com/game/live/${counter}`,
    pgn,
    time_control: `${base}${inc ? '+' + inc : ''}`,
    end_time: endTime ?? 1700000000 + counter * 3600,
    rated: true,
    time_class: 'blitz',
    rules: 'chess',
    white,
    black,
    accuracies: accuracy ? { white: accuracy, black: accuracy } : undefined,
  };
}

// Mat du berger subi avec les Noirs.
export const SCHOLAR = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
// Les Noirs perdent la Dame tôt puis la partie continue.
export const QUEEN_BLUNDER = ['e4', 'e5', 'Nf3', 'Qh4', 'Nxh4', 'Nc6', 'Nf3', 'Nf6', 'd3', 'Bc5', 'Be2', 'O-O', 'O-O', 'd6', 'c3', 'Be6'];
