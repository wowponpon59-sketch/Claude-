// Petit échiquier cliquable pour résoudre les exercices tirés de vos parties.
import { Chess } from '../vendor/chess.js';

const GLYPHS = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};
const FILES = 'abcdefgh';

export class PuzzleBoard {
  constructor(el, { fen, orientation, solution, onResult }) {
    this.el = el;
    this.chess = new Chess(fen);
    this.orientation = orientation;
    this.solution = solution;
    this.onResult = onResult;
    this.selected = null;
    this.locked = false;
    this.highlight = [];
    this.render();
  }

  squares() {
    const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
    const files = [...FILES];
    if (this.orientation === 'b') { ranks.reverse(); files.reverse(); }
    return ranks.flatMap(r => files.map(f => f + r));
  }

  render() {
    this.el.innerHTML = '';
    this.el.classList.add('board');
    const targets = this.selected ? this.chess.moves({ square: this.selected, verbose: true }).map(m => m.to) : [];
    for (const sq of this.squares()) {
      const piece = this.chess.get(sq);
      const btn = document.createElement('button');
      btn.type = 'button';
      const dark = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 0;
      btn.className = `sq ${dark ? 'dark' : 'light'}`;
      if (sq === this.selected) btn.classList.add('selected');
      if (targets.includes(sq)) btn.classList.add('target');
      if (this.highlight.includes(sq)) btn.classList.add('hl');
      btn.dataset.square = sq;
      btn.setAttribute('aria-label', piece ? `${sq} ${piece.color === 'w' ? 'blanc' : 'noir'} ${piece.type}` : sq);
      if (piece) {
        const span = document.createElement('span');
        span.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
        span.textContent = GLYPHS[piece.color + piece.type];
        btn.appendChild(span);
      }
      btn.addEventListener('click', () => this.click(sq));
      this.el.appendChild(btn);
    }
  }

  click(sq) {
    if (this.locked) return;
    const piece = this.chess.get(sq);
    if (this.selected) {
      const from = this.selected;
      this.selected = null;
      const legal = this.chess.moves({ square: from, verbose: true }).find(m => m.to === sq);
      if (legal) return this.tryMove(from, sq);
    }
    if (piece && piece.color === this.chess.turn()) this.selected = sq;
    this.render();
  }

  tryMove(from, to) {
    const promotion = this.solution.length > 4 && this.solution.slice(0, 4) === from + to ? this.solution[4] : 'q';
    const uci = from + to + (this.isPromotion(from, to) ? promotion : '');
    const correct = uci === this.solution;
    this.chess.move({ from, to, promotion: this.isPromotion(from, to) ? promotion : undefined });
    this.highlight = [from, to];
    this.locked = true;
    this.render();
    this.onResult(correct, uci);
    if (!correct) {
      setTimeout(() => { this.chess.undo(); this.locked = false; this.highlight = []; this.render(); }, 900);
    }
  }

  isPromotion(from, to) {
    const p = this.chess.get(from);
    return p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
  }

  showSolution() {
    if (this.locked && this.highlight.length) return;
    const from = this.solution.slice(0, 2);
    const to = this.solution.slice(2, 4);
    this.chess.move({ from, to, promotion: this.solution[4] });
    this.highlight = [from, to];
    this.locked = true;
    this.render();
  }
}

export function uciToSan(fen, uci) {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}
