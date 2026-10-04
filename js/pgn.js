// Lecture des PGN fournis par chess.com (en-têtes, coups, horloges %clk).

export function parseHeaders(pgn) {
  const headers = {};
  const re = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m;
  while ((m = re.exec(pgn)) !== null) headers[m[1]] = m[2];
  return headers;
}

export function parseClock(text) {
  const m = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Renvoie [{ san, clock }] dans l'ordre des demi-coups.
export function parseMoves(pgn) {
  const body = pgn.replace(/^\[.*\]\s*$/gm, '');
  const moves = [];
  let i = 0;
  let depth = 0; // profondeur des variantes, ignorées
  while (i < body.length) {
    const ch = body[i];
    if (ch === '{') {
      const end = body.indexOf('}', i);
      const comment = body.slice(i + 1, end === -1 ? body.length : end);
      if (depth === 0 && moves.length) {
        const clk = parseClock(comment);
        if (clk !== null) moves[moves.length - 1].clock = clk;
      }
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth--; i++; continue; }
    if (ch === ';') {
      const end = body.indexOf('\n', i);
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    if (/\s/.test(ch)) { i++; continue; }
    let j = i;
    while (j < body.length && !/[\s{}();]/.test(body[j])) j++;
    const token = body.slice(i, j);
    i = j;
    if (depth > 0) continue;
    if (/^\d+\.+$/.test(token) || /^\$\d+$/.test(token)) continue;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    const san = token.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (san) moves.push({ san, clock: null });
  }
  return moves;
}

// "600+5" -> { base: 600, inc: 5 } ; "1/86400" (daily) -> { daily: true }
export function parseTimeControl(tc) {
  if (!tc || tc === '-') return { base: null, inc: 0, daily: false };
  if (tc.includes('/')) return { base: null, inc: 0, daily: true, perMove: Number(tc.split('/')[1]) };
  const [base, inc] = tc.split('+').map(Number);
  return { base, inc: inc || 0, daily: false };
}

const FAMILY_WORDS = new Set(['Defense', 'Defence', 'Game', 'Opening', 'Attack', 'Gambit', 'System', 'Variation']);

// "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3" -> noms lisibles
export function openingFromHeaders(headers) {
  const eco = headers.ECO || '?';
  const url = headers.ECOUrl || '';
  let slug = url.split('/openings/')[1] || '';
  slug = decodeURIComponent(slug.split('?')[0]);
  if (!slug) return { eco, name: 'Ouverture inconnue', family: 'Ouverture inconnue', url: null };
  const words = slug.split('-');
  const nameWords = [];
  for (const w of words) {
    if (/^\d+\./.test(w) || /^\d+\.\.\./.test(w)) break;
    nameWords.push(w);
  }
  const name = (nameWords.length ? nameWords : words).join(' ');
  let familyWords = [];
  for (const w of nameWords) {
    familyWords.push(w);
    if (FAMILY_WORDS.has(w)) break;
  }
  if (familyWords.length === nameWords.length && familyWords.length > 3) familyWords = familyWords.slice(0, 3);
  return { eco, name, family: familyWords.join(' ') || name, url };
}
