import { fetchGames } from './chesscom.js';
import { processGame } from './games.js';
import { summarize, diagnose, openingTable } from './analysis.js';
import { Engine, analyzeGame, engineInsights, THEMES } from './engine.js';
import { PuzzleBoard, uciToSan } from './board.js';

const $ = id => document.getElementById(id);
const pct = x => `${Math.round(x * 100)} %`;

const CATEGORIES = {
  all: 'Tout',
  openings: 'Ouvertures',
  time: 'Gestion du temps',
  tactics: 'Tactique',
  strategy: 'Stratégie',
  endgame: 'Finales',
  mental: 'Mental',
};
const TIME_CLASSES = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', daily: 'Différé' };

const state = { games: [], insights: [], engineInsights: [], strengths: [], tab: 'all', puzzles: [], puzzleIndex: 0 };

function setStatus(el, text, error = false) {
  el.textContent = text;
  el.classList.toggle('error', error);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('username').value.trim();
  const classes = [...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value);
  if (!classes.length) return setStatus($('status'), 'Choisissez au moins une cadence.', true);
  $('go').disabled = true;
  try {
    setStatus($('status'), 'Récupération des parties…');
    const raw = await fetchGames(username, {
      months: Number($('months').value),
      maxGames: Number($('maxGames').value),
      filter: g => classes.includes(g.time_class) && (g.rules || 'chess') === 'chess',
      onProgress: (i, n) => setStatus($('status'), `Récupération des parties… (mois ${i}/${n})`),
    });
    setStatus($('status'), `Analyse de ${raw.length} parties…`);
    await new Promise(r => setTimeout(r, 20));
    const games = raw.map(g => processGame(g, username)).filter(g => g.valid && g.plies.length > 0);
    if (!games.length) throw new Error('Aucune partie trouvée pour ces critères.');
    state.games = games;
    state.engineInsights = [];
    state.puzzles = [];
    $('puzzles').hidden = true;
    setStatus($('engineStatus'), '');
    const { insights, strengths } = diagnose(games);
    state.insights = insights;
    state.strengths = strengths;
    render();
    setStatus($('status'), `${games.length} parties analysées.`);
    $('results').hidden = false;
  } catch (err) {
    setStatus($('status'), err.message || String(err), true);
  } finally {
    $('go').disabled = false;
  }
});

function render() {
  const s = summarize(state.games);
  renderOverview(s);
  renderInsights();
  renderStrengths();
  renderOpenings();
}

function renderOverview(s) {
  const tiles = [
    [s.games, 'parties'],
    [pct(s.score), 'score global'],
    [`${s.wins} / ${s.draws} / ${s.losses}`, 'victoires / nulles / défaites'],
    [pct(s.white.score), `avec les Blancs (${s.white.games})`],
    [pct(s.black.score), `avec les Noirs (${s.black.games})`],
  ];
  if (s.avgAccuracy !== null) tiles.push([`${s.avgAccuracy.toFixed(1)}`, `précision moyenne chess.com (${s.accuracyGames} parties)`]);
  $('overview').innerHTML = tiles.map(([v, l]) => `<div class="tile"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
  $('ratings').innerHTML = Object.entries(s.byTime).map(([tc, d]) => {
    const delta = d.ratingEnd - d.ratingStart;
    const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
    return `<span class="chip">${esc(TIME_CLASSES[tc] || tc)} : ${d.ratingStart} → <b>${d.ratingEnd}</b> <span class="${cls}">(${delta > 0 ? '+' : ''}${delta})</span> · ${d.games} parties · ${pct(d.score)}</span>`;
  }).join('');
}

function allInsights() {
  return [...state.engineInsights, ...state.insights].sort((a, b) => b.severity - a.severity);
}

function renderInsights() {
  const list = allInsights();
  const plan = [];
  const seen = new Set();
  for (const i of list) {
    if (seen.has(i.category)) continue;
    seen.add(i.category);
    plan.push(i);
    if (plan.length === 3) break;
  }
  $('plan').innerHTML = plan.length
    ? plan.map(i => {
      const first = i.resources.find(r => r.kind === 'puzzle');
      const course = i.resources.find(r => r.kind === 'chessable');
      return `<li><b>${esc(CATEGORIES[i.category])} — ${esc(i.title)}.</b> ${esc(i.tips[0] || i.detail)}` +
        (first ? ` Exercices : <a href="${esc(first.url)}" target="_blank" rel="noopener">${esc(first.label)}</a>.` : '') +
        (course ? ` Cours : <a href="${esc(course.url)}" target="_blank" rel="noopener">${esc(course.label)}</a>.` : '') + '</li>';
    }).join('')
    : '<li class="empty">Aucun point faible marqué sur cet échantillon : élargissez la période ou lancez l\'analyse Stockfish.</li>';

  const counts = {};
  for (const i of list) counts[i.category] = (counts[i.category] || 0) + 1;
  $('tabs').innerHTML = Object.entries(CATEGORIES)
    .filter(([k]) => k === 'all' || counts[k])
    .map(([k, label]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${esc(label)}${k === 'all' ? '' : ` (${counts[k]})`}</button>`)
    .join('');
  const shown = list.filter(i => state.tab === 'all' || i.category === state.tab);
  $('insights').innerHTML = shown.length ? shown.map(card).join('') : '<p class="empty">Rien à signaler dans cette catégorie.</p>';
}

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  state.tab = b.dataset.tab;
  renderInsights();
});

function card(i) {
  const sev = { 3: 'Priorité haute', 2: 'À travailler', 1: 'À surveiller' }[i.severity];
  const res = i.resources.map(r => {
    const badge = r.kind === 'chessable' ? `<span class="badge chessable">Chessable${r.note ? ' · ' + esc(r.note) : ''}</span>`
      : r.kind === 'puzzle' ? '<span class="badge">Exercices</span>' : '<span class="badge">Lecture</span>';
    return `<li>${badge}<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a></li>`;
  }).join('');
  return `<article class="card s${i.severity}">
    <div class="tag">${esc(CATEGORIES[i.category])} · ${sev}</div>
    <h3>${esc(i.title)}</h3>
    <p>${esc(i.detail)}</p>
    ${i.tips.length ? `<ul>${i.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <ul class="res">${res}</ul>
  </article>`;
}

function renderStrengths() {
  $('strengths').innerHTML = state.strengths.length
    ? state.strengths.map(s => `<li>${esc(s)}</li>`).join('')
    : '<li class="empty">Pas encore assez de parties pour dégager des points forts nets.</li>';
}

function renderOpenings() {
  for (const color of ['w', 'b']) {
    const rows = openingTable(state.games, color).slice(0, 12);
    const el = $(color === 'w' ? 'openingsW' : 'openingsB');
    if (!rows.length) { el.innerHTML = '<p class="empty">Aucune partie.</p>'; continue; }
    el.innerHTML = `<div class="table-scroll"><table>
      <thead><tr><th>Ouverture</th><th class="n">Parties</th><th class="n">V/N/D</th><th>Score</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.opening.url ? `<a href="${esc(r.opening.url)}" target="_blank" rel="noopener">${esc(r.family)}</a>` : esc(r.family)}</td>
        <td class="n">${r.games}</td>
        <td class="n">${r.wins}/${r.draws}/${r.losses}</td>
        <td><div class="bar ${r.score < 0.45 ? 'bad' : ''}" title="${pct(r.score)}"><span style="width:${Math.round(r.score * 100)}%"></span></div> ${pct(r.score)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }
}

// ---------- Analyse moteur ----------
let engine = null;

$('engineGo').addEventListener('click', async () => {
  const losses = state.games.filter(g => g.result === 'loss').slice(0, Number($('engineGames').value));
  if (!losses.length) return setStatus($('engineStatus'), 'Aucune défaite à analyser : bravo !');
  const depth = Number($('engineDepth').value);
  $('engineGo').disabled = true;
  try {
    if (!engine) {
      setStatus($('engineStatus'), 'Chargement de Stockfish…');
      engine = new Engine();
      await engine.init();
    }
    const errors = [];
    for (let k = 0; k < losses.length; k++) {
      const found = await analyzeGame(losses[k], engine, depth, (i, n) =>
        setStatus($('engineStatus'), `Partie ${k + 1}/${losses.length} : position ${i}/${n}…`));
      errors.push(...found);
    }
    state.engineInsights = engineInsights(errors, losses.length);
    state.puzzles = errors
      .filter(e => e.kind !== 'inaccuracy')
      .sort((a, b) => b.drop - a.drop);
    state.puzzleIndex = 0;
    renderInsights();
    const n = state.puzzles.length;
    setStatus($('engineStatus'), `${losses.length} défaites analysées : ${errors.filter(e => e.kind === 'blunder').length} gaffes, ${errors.filter(e => e.kind === 'mistake').length} erreurs, ${errors.filter(e => e.kind === 'inaccuracy').length} imprécisions. ${n} exercice(s) créé(s).`);
    $('puzzles').hidden = n === 0;
    if (n) showPuzzle();
  } catch (err) {
    setStatus($('engineStatus'), `Analyse impossible : ${err.message || err}`, true);
  } finally {
    $('engineGo').disabled = false;
  }
});

let board = null;

function showPuzzle() {
  const p = state.puzzles[state.puzzleIndex];
  const side = p.color === 'w' ? 'les Blancs' : 'les Noirs';
  $('puzzleCount').textContent = `Exercice ${state.puzzleIndex + 1} / ${state.puzzles.length} · ${THEMES[p.theme].label}`;
  $('puzzleTitle').textContent = `Vous jouez ${side} : trouvez le meilleur coup`;
  $('puzzleInfo').textContent = `Coup ${p.moveNumber} contre ${p.opponent} (${p.opening}). Dans la partie, vous avez joué ${p.played}.`;
  $('puzzleFeedback').textContent = '';
  $('puzzleFeedback').className = 'feedback';
  const lichessFen = p.fen.replace(/ /g, '_');
  $('puzzleLinks').innerHTML =
    `<a href="${esc(p.url)}" target="_blank" rel="noopener">Voir la partie</a>` +
    `<a href="https://lichess.org/analysis/standard/${esc(lichessFen)}" target="_blank" rel="noopener">Analyser sur Lichess</a>` +
    `<a href="https://lichess.org/training/${THEMES[p.theme].lichess}" target="_blank" rel="noopener">Problèmes similaires</a>`;
  board = new PuzzleBoard($('board'), {
    fen: p.fen,
    orientation: p.color,
    solution: p.best,
    onResult: correct => {
      const fb = $('puzzleFeedback');
      fb.textContent = correct ? 'Bravo, c\'est le meilleur coup !' : 'Ce n\'est pas le coup du moteur, réessayez.';
      fb.className = `feedback ${correct ? 'ok' : 'ko'}`;
    },
  });
}

$('prevPuzzle').addEventListener('click', () => {
  if (!state.puzzles.length) return;
  state.puzzleIndex = (state.puzzleIndex - 1 + state.puzzles.length) % state.puzzles.length;
  showPuzzle();
});
$('nextPuzzle').addEventListener('click', () => {
  if (!state.puzzles.length) return;
  state.puzzleIndex = (state.puzzleIndex + 1) % state.puzzles.length;
  showPuzzle();
});
$('solution').addEventListener('click', () => {
  const p = state.puzzles[state.puzzleIndex];
  if (!p || !board) return;
  board.showSolution();
  const fb = $('puzzleFeedback');
  fb.textContent = `Solution : ${uciToSan(p.fen, p.best)}`;
  fb.className = 'feedback';
});

const saved = (() => { try { return localStorage.getItem('chess-coach-user'); } catch { return null; } })();
if (saved) $('username').value = saved;
$('username').addEventListener('change', () => { try { localStorage.setItem('chess-coach-user', $('username').value.trim()); } catch { /* stockage indisponible */ } });
