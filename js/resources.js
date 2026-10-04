// Ressources d'entraînement associées à chaque axe de progression.
// Les cours Chessable listés ici ont des URL vérifiées ; pour une ouverture
// précise on passe par une recherche restreinte au site chessable.com.

const lichess = (theme, label) => ({ kind: 'puzzle', label, url: `https://lichess.org/training/${theme}` });
const chessable = (label, path, note) => ({ kind: 'chessable', label, url: `https://www.chessable.com/${path}`, note });

export const RESOURCES = {
  tactics: [
    lichess('hangingPiece', 'Problèmes : pièces en prise'),
    lichess('fork', 'Problèmes : fourchettes'),
    lichess('pin', 'Problèmes : clouages'),
    { kind: 'puzzle', label: 'Problèmes classés chess.com', url: 'https://www.chess.com/puzzles/rated' },
    chessable('The Woodpecker Method (version gratuite)', 'course/214143/', 'Gratuit'),
    chessable('The Woodpecker Method', 'the-woodpecker-method/course/10582/'),
  ],
  blunders: [
    lichess('hangingPiece', 'Problèmes : pièces en prise'),
    lichess('defensiveMove', 'Problèmes : coups défensifs'),
    chessable('Preventing Blunders in Chess (leçon gratuite)', 'preventing-blunders-in-chess-sample-lesson/course/377724/', 'Gratuit'),
    chessable('Preventing Blunders in Chess', 'preventing-blunders-in-chess/course/258968/'),
    chessable('Survive & Thrive: How to Blunder Less and Defend Better', 'survive-thrive-how-to-blunder-less-and-defend-better/course/80629/'),
  ],
  kingSafety: [
    lichess('mateIn1', 'Problèmes : mat en 1'),
    lichess('mateIn2', 'Problèmes : mat en 2'),
    lichess('backRankMate', 'Problèmes : mat du couloir'),
    lichess('kingsideAttack', 'Problèmes : attaque sur l\'aile roi'),
    chessable('The Checkmate Patterns Manual', 'the-checkmate-patterns-manual/course/243265/'),
    chessable('Basic Checkmate Patterns', 'basic-checkmate-patterns/course/45122/'),
  ],
  openingPrinciples: [
    lichess('opening', 'Problèmes tactiques de l\'ouverture'),
    chessable("Smithy's Opening Fundamentals", 'smithys-opening-fundamentals/course/21302/', 'Gratuit'),
    chessable('Opening Principles (leçon gratuite)', 'opening-compass-free-lesson/course/188698/', 'Gratuit'),
  ],
  repertoireWhite: [
    chessable('Short & Sweet: 1.e4 for Club Players', 'short-sweet-1-e4-for-beginners/course/103336/'),
    chessable("Short & Sweet: Wesley So's 1.e4", 'course/59857/', 'Gratuit'),
    chessable("Lifetime Repertoires: Sethuraman's 1.e4 – Part 1", 'lifetime-repertoires-sethuramans-1e4-part-1/course/66235/'),
  ],
  repertoireBlack: [
    chessable("Short & Sweet: Sielecki's Caro-Kann", 'course/95549/', 'Gratuit'),
  ],
  strategy: [
    lichess('middlegame', 'Problèmes de milieu de partie'),
    lichess('quietMove', 'Problèmes : coups tranquilles'),
    chessable("Beginner's Guide To Chess Strategy", 'beginners-guide-to-chess-strategy/course/252476/'),
    chessable('Chess Strategy: Simplified', 'chess-strategy-simplified/course/347911/'),
    chessable('The Woodpecker Method 2: Positional Play', 'the-woodpecker-method-2-positional-play/course/250319/'),
  ],
  conversion: [
    lichess('advantage', 'Problèmes : concrétiser un avantage'),
    lichess('crushing', 'Problèmes : position gagnante'),
    chessable('Chess Strategy: Simplified', 'chess-strategy-simplified/course/347911/'),
  ],
  endgame: [
    lichess('endgame', 'Problèmes de finale'),
    lichess('rookEndgame', 'Problèmes : finales de tours'),
    lichess('pawnEndgame', 'Problèmes : finales de pions'),
    { kind: 'puzzle', label: 'Exercices de finales chess.com (Practice)', url: 'https://www.chess.com/practice' },
    chessable('100 Basic Endgames You Must Know', '100-basic-endgames-you-must-know-a-starters-guide-to-chess-endgames/course/408855/'),
    chessable('100 Endgames You Must Know', '100-endgames-you-must-know/course/5193/'),
    chessable('Endgame Expertise: Rook Endgames', 'endgame-expertise-rook-endgames/course/124613/'),
  ],
  time: [
    lichess('short', 'Problèmes courts (vitesse de calcul)'),
    { kind: 'puzzle', label: 'Puzzle Rush chess.com', url: 'https://www.chess.com/puzzles/rush' },
    { kind: 'puzzle', label: 'Puzzle Storm Lichess', url: 'https://lichess.org/storm' },
    chessable('The Woodpecker Method (version gratuite)', 'course/214143/', 'Gratuit'),
  ],
  defense: [
    lichess('defensiveMove', 'Problèmes : coups défensifs'),
    lichess('equality', 'Problèmes : revenir à l\'égalité'),
    chessable('Survive & Thrive: How to Blunder Less and Defend Better', 'survive-thrive-how-to-blunder-less-and-defend-better/course/80629/'),
  ],
  mindset: [
    { kind: 'article', label: 'Chessable : analyser ses propres parties', url: 'https://www.chessable.com/blog/how-to-analyse-your-own-games-part-two/' },
  ],
};

// Liens propres à une ouverture donnée.
export function openingResources(opening) {
  const out = [];
  if (opening.url) out.push({ kind: 'article', label: `Théorie chess.com : ${opening.name}`, url: opening.url });
  out.push({
    kind: 'article',
    label: `Explorateur Lichess : ${opening.family}`,
    url: `https://lichess.org/opening/${encodeURIComponent(opening.family.replace(/ /g, '_'))}`,
  });
  out.push({ kind: 'puzzle', label: 'Problèmes tactiques de l\'ouverture', url: 'https://lichess.org/training/opening' });
  out.push({
    kind: 'chessable',
    label: `Cours Chessable sur « ${opening.family} »`,
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:chessable.com course ${opening.family}`)}`,
    note: 'Recherche',
  });
  return out;
}
