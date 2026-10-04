import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processGame } from '../js/games.js';
import { summarize, diagnose, openingTable, tiltStats } from '../js/analysis.js';
import { winChance, classifyDrop } from '../js/engine.js';
import { makeGame, ME, SCHOLAR, QUEEN_BLUNDER } from './fixtures.js';

test('partie traitée : résultat, couleur, mat', () => {
  const g = processGame(makeGame({ sans: SCHOLAR, myColor: 'b', myResult: 'checkmated', oppResult: 'win' }), ME);
  assert.equal(g.valid, true);
  assert.equal(g.color, 'b');
  assert.equal(g.result, 'loss');
  assert.equal(g.plies.length, 7);
  assert.equal(g.opening.family, 'Italian Game');
  assert.equal(g.plies.filter(p => p.mine).length, 3);
});

test('matériel et moment décisif', () => {
  const g = processGame(makeGame({ sans: QUEEN_BLUNDER, myColor: 'b', myResult: 'resigned', oppResult: 'win' }), ME);
  assert.equal(g.finalDiff, -9);
  assert.equal(g.hadLosingDeficit, true);
  assert.ok(g.collapse);
  assert.equal(g.collapse.phase, 'opening');
  assert.equal(g.plies[g.collapse.ply].san, 'Qh4');
});

test('horloge : temps passé par coup', () => {
  const g = processGame(makeGame({ sans: SCHOLAR, myColor: 'w', myResult: 'win', oppResult: 'checkmated', base: 180, inc: 2, spend: () => 10 }), ME);
  const mine = g.plies.filter(p => p.mine);
  assert.ok(mine.every(p => Math.abs(p.spent - 10) < 1e-9));
  assert.ok(g.clock.openingUsedRatio > 0);
});

test('diagnostic : défaites au temps et mats détectés', () => {
  const raw = [];
  for (let i = 0; i < 6; i++) {
    raw.push(makeGame({ sans: QUEEN_BLUNDER, myColor: 'w', myResult: 'timeout', oppResult: 'win', spend: k => (k < 8 ? 120 : 5) }));
    raw.push(makeGame({ sans: SCHOLAR, myColor: 'b', myResult: 'checkmated', oppResult: 'win' }));
    raw.push(makeGame({ sans: SCHOLAR, myColor: 'w', myResult: 'win', oppResult: 'checkmated' }));
  }
  const games = raw.map(r => processGame(r, ME));
  const s = summarize(games);
  assert.equal(s.games, 18);
  assert.equal(s.losses, 12);
  const { insights } = diagnose(games);
  const ids = insights.map(i => i.id);
  assert.ok(ids.includes('time-timeouts'), ids.join());
  assert.ok(ids.includes('king-safety'), ids.join());
  assert.ok(ids.includes('time-opening-slow'), ids.join());
  for (const i of insights) {
    assert.ok(i.resources.length > 0, i.id);
    assert.ok(i.resources.every(r => /^https:\/\//.test(r.url)), i.id);
  }
  assert.ok(insights.some(i => i.resources.some(r => r.kind === 'chessable')));
});

test('tableau des ouvertures', () => {
  const games = [
    makeGame({ sans: SCHOLAR, myColor: 'w', myResult: 'win', oppResult: 'checkmated' }),
    makeGame({ sans: SCHOLAR, myColor: 'w', myResult: 'agreed', oppResult: 'agreed' }),
  ].map(r => processGame(r, ME));
  const rows = openingTable(games, 'w');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 0.75);
});

test('tilt : parties qui suivent une défaite', () => {
  const games = [
    makeGame({ sans: SCHOLAR, myColor: 'b', myResult: 'checkmated', oppResult: 'win', endTime: 1000 }),
    makeGame({ sans: SCHOLAR, myColor: 'b', myResult: 'checkmated', oppResult: 'win', endTime: 1600 }),
    makeGame({ sans: SCHOLAR, myColor: 'w', myResult: 'win', oppResult: 'checkmated', endTime: 99999 }),
  ].map(r => processGame(r, ME));
  assert.equal(tiltStats(games).afterLoss.length, 1);
});

test('probabilité de gain et seuils', () => {
  assert.equal(winChance({ mate: 3 }), 1);
  assert.equal(winChance({ cp: 0 }), 0);
  assert.equal(classifyDrop(0.35), 'blunder');
  assert.equal(classifyDrop(0.05), null);
});
