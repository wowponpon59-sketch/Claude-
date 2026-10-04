import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeaders, parseMoves, parseTimeControl, openingFromHeaders, parseClock } from '../js/pgn.js';

const PGN = `[Event "Live Chess"]
[ECO "B90"]
[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3"]
[TimeControl "180+2"]

1. e4 {[%clk 0:03:01.9]} 1... c5 {[%clk 0:03:01]} 2. Nf3 {[%clk 0:03:02.5]} 2... d6 {[%clk 0:02:59.8]} 1-0`;

test('en-têtes', () => {
  const h = parseHeaders(PGN);
  assert.equal(h.ECO, 'B90');
  assert.equal(h.TimeControl, '180+2');
});

test('coups et horloges', () => {
  const moves = parseMoves(PGN);
  assert.deepEqual(moves.map(m => m.san), ['e4', 'c5', 'Nf3', 'd6']);
  assert.equal(moves[0].clock, 181.9);
  assert.equal(moves[3].clock, 179.8);
});

test('variantes et NAG ignorées', () => {
  const moves = parseMoves('1. e4 $1 (1. d4 d5) 1... e5!? 2. Nf3 *');
  assert.deepEqual(moves.map(m => m.san), ['e4', 'e5', 'Nf3']);
});

test('cadence', () => {
  assert.deepEqual(parseTimeControl('180+2'), { base: 180, inc: 2, daily: false });
  assert.equal(parseTimeControl('1/86400').daily, true);
  assert.equal(parseClock('[%clk 1:00:00]'), 3600);
});

test('nom d\'ouverture', () => {
  const o = openingFromHeaders(parseHeaders(PGN));
  assert.equal(o.name, 'Sicilian Defense Najdorf Variation');
  assert.equal(o.family, 'Sicilian Defense');
  const qg = openingFromHeaders({ ECOUrl: 'https://www.chess.com/openings/Queens-Gambit-Declined-Exchange-Variation' });
  assert.equal(qg.family, 'Queens Gambit');
});
