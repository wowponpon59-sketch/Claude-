// Diagnostic global : statistiques et axes de progression à partir des parties traitées.
import { avg } from './games.js';
import { RESOURCES, openingResources } from './resources.js';

const pct = x => `${Math.round(x * 100)} %`;
const score = gs => (gs.length ? gs.reduce((s, g) => s + (g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0), 0) / gs.length : 0);
const count = (gs, r) => gs.filter(g => g.result === r).length;

function wdl(gs) {
  return { games: gs.length, wins: count(gs, 'win'), draws: count(gs, 'draw'), losses: count(gs, 'loss'), score: score(gs) };
}

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function openingTable(games, color) {
  const mine = games.filter(g => g.color === color);
  const rows = [];
  for (const [family, gs] of groupBy(mine, g => g.opening.family)) {
    const variations = [...groupBy(gs, g => g.opening.name).entries()]
      .map(([name, v]) => ({ name, games: v.length, score: score(v) }))
      .sort((a, b) => b.games - a.games);
    rows.push({ family, ...wdl(gs), variations, opening: gs[0].opening });
  }
  return rows.sort((a, b) => b.games - a.games);
}

export function summarize(games) {
  const byTime = {};
  for (const [tc, gs] of groupBy(games, g => g.timeClass)) {
    const sorted = [...gs].sort((a, b) => a.endTime - b.endTime);
    byTime[tc] = { ...wdl(gs), ratingStart: sorted[0].myRating, ratingEnd: sorted[sorted.length - 1].myRating };
  }
  const acc = games.map(g => g.accuracy).filter(a => typeof a === 'number');
  const losses = games.filter(g => g.result === 'loss');
  const terminations = {};
  for (const g of losses) terminations[g.myCode] = (terminations[g.myCode] || 0) + 1;
  const collapsePhases = { opening: 0, middlegame: 0, endgame: 0 };
  for (const g of losses) if (g.collapse) collapsePhases[g.collapse.phase]++;
  return {
    ...wdl(games),
    white: wdl(games.filter(g => g.color === 'w')),
    black: wdl(games.filter(g => g.color === 'b')),
    byTime,
    avgAccuracy: acc.length ? avg(acc) : null,
    accuracyGames: acc.length,
    lossTerminations: terminations,
    collapsePhases,
  };
}

// Chaque règle renvoie null ou un axe de progression.
export function diagnose(games) {
  const insights = [];
  const strengths = [];
  const all = games;
  const overall = score(all);
  const losses = all.filter(g => g.result === 'loss');
  const L = losses.length;
  const add = x => insights.push(x);

  // ---------- Ouvertures ----------
  for (const color of ['w', 'b']) {
    const rows = openingTable(all, color);
    const nColor = rows.reduce((s, r) => s + r.games, 0);
    const minGames = Math.max(3, Math.round(nColor * 0.05));
    const colorName = color === 'w' ? 'les Blancs' : 'les Noirs';
    for (const r of rows) {
      if (r.games < minGames) continue;
      if (r.score <= Math.min(0.42, overall - 0.1)) {
        add({
          id: `opening-${color}-${r.family}`,
          category: 'openings',
          severity: r.score < 0.3 ? 3 : 2,
          title: `${r.family} avec ${colorName} : ${pct(r.score)} de score`,
          detail: `${r.games} parties (${r.wins} V / ${r.draws} N / ${r.losses} D), contre ${pct(overall)} en moyenne. Variante la plus jouée : ${r.variations[0].name}.`,
          tips: [
            'Rejouez vos 3 dernières défaites dans cette ouverture et repérez le coup où vous sortez de la théorie.',
            'Apprenez les 6 à 8 premiers coups de la ligne principale et surtout les plans typiques qui suivent.',
            'Si l\'ouverture ne vous convient pas, remplacez-la par une ligne plus simple à jouer.',
          ],
          resources: [...openingResources(r.opening), ...(color === 'w' ? RESOURCES.repertoireWhite : RESOURCES.repertoireBlack)],
        });
      } else if (r.score >= Math.max(0.6, overall + 0.1)) {
        strengths.push(`${r.family} avec ${colorName} : ${pct(r.score)} sur ${r.games} parties.`);
      }
    }
    if (nColor >= 15 && rows.length / nColor > 0.45) {
      add({
        id: `repertoire-${color}`,
        category: 'openings',
        severity: 1,
        title: `Répertoire dispersé avec ${colorName}`,
        detail: `${rows.length} familles d'ouvertures différentes en ${nColor} parties : difficile d'accumuler de l'expérience dans chacune.`,
        tips: ['Choisissez une ouverture principale par coup adverse (contre 1.e4 et 1.d4 avec les Noirs) et tenez-vous-y quelques mois.'],
        resources: color === 'w' ? RESOURCES.repertoireWhite : RESOURCES.repertoireBlack,
      });
    }
  }

  const earlyCollapses = losses.filter(g => g.collapse && g.collapse.phase === 'opening');
  if (L >= 4 && earlyCollapses.length >= 2 && earlyCollapses.length / L >= 0.2) {
    add({
      id: 'opening-collapse',
      category: 'openings',
      severity: earlyCollapses.length / L >= 0.35 ? 3 : 2,
      title: 'Du matériel perdu dès l\'ouverture',
      detail: `${earlyCollapses.length} défaites sur ${L} (${pct(earlyCollapses.length / L)}) basculent avant le 13e coup avec une perte de matériel définitive.`,
      tips: [
        'Respectez les principes : développement, roque rapide, ne sortez pas la Dame trop tôt.',
        'Avant chaque coup d\'ouverture, vérifiez ce que menace le dernier coup adverse.',
        'Étudiez les pièges classiques des ouvertures que vous jouez.',
      ],
      resources: RESOURCES.openingPrinciples,
    });
  }

  const sw = score(all.filter(g => g.color === 'w'));
  const sb = score(all.filter(g => g.color === 'b'));
  const nw = all.filter(g => g.color === 'w').length;
  const nb = all.filter(g => g.color === 'b').length;
  if (nw >= 8 && nb >= 8 && Math.abs(sw - sb) >= 0.15) {
    const weakBlack = sb < sw;
    add({
      id: 'color-imbalance',
      category: 'openings',
      severity: 2,
      title: `Nettement moins performant avec les ${weakBlack ? 'Noirs' : 'Blancs'}`,
      detail: `Score de ${pct(sw)} avec les Blancs contre ${pct(sb)} avec les Noirs.`,
      tips: [weakBlack
        ? 'Consolidez une défense solide contre 1.e4 et une contre 1.d4.'
        : 'Avec les Blancs, choisissez un système qui mène à des positions que vous comprenez.'],
      resources: weakBlack ? RESOURCES.repertoireBlack : RESOURCES.repertoireWhite,
    });
  }

  // ---------- Gestion du temps ----------
  const timed = all.filter(g => g.clock);
  const timedLosses = timed.filter(g => g.result === 'loss');
  const timeouts = losses.filter(g => g.myCode === 'timeout');
  if (timedLosses.length >= 4 && timeouts.length / timedLosses.length >= 0.2) {
    const notLosing = timeouts.filter(g => g.finalDiff >= 0).length;
    add({
      id: 'time-timeouts',
      category: 'time',
      severity: timeouts.length / timedLosses.length >= 0.35 ? 3 : 2,
      title: 'Trop de défaites au temps',
      detail: `${timeouts.length} défaites sur ${timedLosses.length} (${pct(timeouts.length / timedLosses.length)}) se terminent au temps` +
        (notLosing ? `, dont ${notLosing} alors que vous n'étiez pas en retard de matériel.` : '.'),
      tips: [
        'Fixez-vous un budget : environ 1/40e du temps initial par coup en moyenne.',
        'Jouez les coups évidents (reprises, coups forcés) rapidement pour garder du temps pour les moments critiques.',
        'Quand il reste moins de 10 % du temps, simplifiez la position plutôt que de calculer.',
        'Envisagez une cadence avec incrément (ex. 10+5) pour vous entraîner.',
      ],
      resources: RESOURCES.time,
    });
  }

  if (timed.length >= 10) {
    const trouble = timed.filter(g => g.clock.timeTrouble);
    if (trouble.length / timed.length >= 0.35) {
      add({
        id: 'time-trouble',
        category: 'time',
        severity: 2,
        title: 'Zeitnot fréquent',
        detail: `Vous passez sous 10 % de votre temps dans ${pct(trouble.length / timed.length)} des parties ; votre score y est de ${pct(score(trouble))} contre ${pct(score(timed.filter(g => !g.clock.timeTrouble)))} sinon.`,
        tips: ['Repérez dans vos parties les coups où vous avez pensé plus de 10 % du temps total : étaient-ils vraiment critiques ?'],
        resources: RESOURCES.time,
      });
    }

    const openingRatios = timed.map(g => g.clock.openingUsedRatio).filter(v => v !== null);
    const openingAvg = avg(openingRatios);
    if (openingRatios.length >= 10 && openingAvg > 0.2) {
      add({
        id: 'time-opening-slow',
        category: 'time',
        severity: 2,
        title: 'Trop de temps consommé dans l\'ouverture',
        detail: `En moyenne ${pct(openingAvg)} de votre temps part dans les 10 premiers coups.`,
        tips: ['Mieux connaître vos ouvertures vous fera gagner du temps : révisez vos lignes avec la répétition espacée (Chessable).'],
        resources: [...RESOURCES.openingPrinciples, ...RESOURCES.repertoireWhite.slice(0, 1), ...RESOURCES.repertoireBlack.slice(0, 1)],
      });
    }

    const nonTimeoutLosses = timedLosses.filter(g => g.myCode !== 'timeout');
    const fastLosses = nonTimeoutLosses.filter(g => g.clock.finalRatio >= 0.5);
    if (nonTimeoutLosses.length >= 5 && fastLosses.length / nonTimeoutLosses.length >= 0.4) {
      add({
        id: 'time-too-fast',
        category: 'time',
        severity: 2,
        title: 'Vous perdez avec beaucoup de temps à la pendule',
        detail: `Dans ${pct(fastLosses.length / nonTimeoutLosses.length)} de vos défaites (hors temps), il vous restait plus de la moitié de votre temps.`,
        tips: [
          'Utilisez votre temps : avant chaque coup, listez les échecs, prises et menaces des deux camps.',
          'Faites une vérification anti-gaffe systématique : « quelle pièce ce coup laisse-t-il sans défense ? »',
        ],
        resources: RESOURCES.blunders,
      });
    }
  }

  const collapsesWithTime = losses.filter(g => g.collapse && g.collapse.spent !== null && g.clock && g.clock.avgSpent);
  if (collapsesWithTime.length >= 4) {
    const hasty = collapsesWithTime.filter(g => g.collapse.spent < g.clock.avgSpent * 0.6);
    if (hasty.length / collapsesWithTime.length >= 0.5) {
      add({
        id: 'time-hasty-blunders',
        category: 'time',
        severity: 3,
        title: 'Les coups décisifs sont joués trop vite',
        detail: `Dans ${hasty.length} défaites sur ${collapsesWithTime.length}, le coup qui fait basculer la partie a été joué plus vite que votre moyenne.`,
        tips: ['Quand la position est tendue (pièces en contact, échecs possibles), imposez-vous une pause de quelques secondes avant de jouer.'],
        resources: RESOURCES.blunders,
      });
    }
  }

  const flagWins = all.filter(g => g.result === 'win' && g.oppCode === 'timeout').length;
  if (all.length >= 10 && flagWins / Math.max(1, count(all, 'win')) >= 0.2) {
    strengths.push(`Bonne gestion de la pendule : ${flagWins} victoires au temps.`);
  }

  // ---------- Stratégie, tactique et finales ----------
  const middleCollapses = losses.filter(g => g.collapse && g.collapse.phase === 'middlegame');
  if (L >= 4 && middleCollapses.length / L >= 0.4) {
    add({
      id: 'tactics-middlegame',
      category: 'tactics',
      severity: 3,
      title: 'Pertes de matériel en milieu de partie',
      detail: `${middleCollapses.length} défaites sur ${L} (${pct(middleCollapses.length / L)}) basculent en milieu de partie sur une perte de matériel définitive : c'est le signe de gaffes ou de tactiques manquées.`,
      tips: [
        'Faites 15 à 20 minutes de problèmes tactiques par jour, en privilégiant la justesse sur la vitesse.',
        'Lancez l\'analyse Stockfish ci-dessous pour retrouver précisément ces erreurs et les rejouer en exercices.',
      ],
      resources: RESOURCES.tactics,
    });
  }

  const mated = losses.filter(g => g.myCode === 'checkmated');
  if (L >= 4 && mated.length / L >= 0.3) {
    add({
      id: 'king-safety',
      category: 'tactics',
      severity: 2,
      title: 'Sécurité du roi',
      detail: `${mated.length} défaites sur ${L} (${pct(mated.length / L)}) se terminent par un mat.`,
      tips: [
        'Roquez tôt et évitez d\'avancer les pions devant votre roi sans raison.',
        'Apprenez les motifs de mat classiques pour les voir venir (couloir, mat d\'Anastasia, mat étouffé…).',
      ],
      resources: RESOURCES.kingSafety,
    });
  }

  const winning = all.filter(g => g.hadWinningAdvantage);
  if (winning.length >= 3) {
    const converted = count(winning, 'win') / winning.length;
    if (converted < 0.75) {
      add({
        id: 'conversion',
        category: 'strategy',
        severity: converted < 0.6 ? 3 : 2,
        title: 'Difficulté à convertir les positions gagnantes',
        detail: `Avec au moins 3 points d'avance matérielle, vous ne gagnez que ${pct(converted)} des parties (${count(winning, 'win')} sur ${winning.length}).`,
        tips: [
          'Avec un avantage matériel, échangez les pièces (pas les pions) pour simplifier.',
          'Continuez à vérifier les menaces adverses : c\'est quand on gagne qu\'on se relâche.',
          'Activez votre roi en finale et poussez le pion passé.',
        ],
        resources: RESOURCES.conversion,
      });
    } else {
      strengths.push(`Bonne conversion : ${pct(converted)} de victoires avec un avantage matériel net.`);
    }
  }

  const losing = all.filter(g => g.hadLosingDeficit);
  if (losing.length >= 5) {
    const saved = losing.filter(g => g.result !== 'loss').length / losing.length;
    if (saved < 0.1) {
      add({
        id: 'defense',
        category: 'strategy',
        severity: 1,
        title: 'Peu de parties sauvées après un retard',
        detail: `Vous ne sauvez que ${pct(saved)} des parties où vous êtes en retard de 3 points ou plus.`,
        tips: ['En position perdante, compliquez : cherchez l\'activité, les échecs, le pat, la nulle par répétition.'],
        resources: RESOURCES.defense,
      });
    } else if (saved >= 0.25) {
      strengths.push(`Combatif : ${pct(saved)} de parties sauvées après un retard matériel.`);
    }
  }

  const endgames = all.filter(g => g.endgameReached && g.endgameEntryDiff !== null && Math.abs(g.endgameEntryDiff) <= 1);
  if (endgames.length >= 4) {
    const s = score(endgames);
    if (s < 0.45) {
      add({
        id: 'endgame',
        category: 'endgame',
        severity: 2,
        title: 'Finales équilibrées mal négociées',
        detail: `Score de ${pct(s)} dans les ${endgames.length} parties arrivées en finale avec un matériel équilibré.`,
        tips: [
          'Centralisez votre roi dès l\'entrée en finale.',
          'Maîtrisez les finales théoriques de base : opposition, Lucena, Philidor.',
        ],
        resources: RESOURCES.endgame,
      });
    } else if (s >= 0.6) {
      strengths.push(`Solide en finale : ${pct(s)} dans les finales équilibrées.`);
    }
  }

  const earlyResign = losses.filter(g => g.myCode === 'resigned' && g.finalDiff >= 0 && g.fullMoves < 60);
  if (earlyResign.length >= 2 && earlyResign.length / Math.max(1, L) >= 0.1) {
    add({
      id: 'resign',
      category: 'mental',
      severity: 1,
      title: 'Abandons à matériel égal',
      detail: `${earlyResign.length} abandons sans retard matériel. Parfois justifié (attaque de mat), mais vérifiez qu'il n'y avait pas de défense.`,
      tips: ['Avant d\'abandonner, demandez-vous ce que l\'adversaire doit encore trouver pour gagner.'],
      resources: RESOURCES.defense,
    });
  }

  const lowerRated = all.filter(g => g.oppRating <= g.myRating - 100);
  if (lowerRated.length >= 6 && score(lowerRated) < 0.55) {
    add({
      id: 'lower-rated',
      category: 'mental',
      severity: 1,
      title: 'Des points perdus contre des joueurs moins bien classés',
      detail: `Score de ${pct(score(lowerRated))} contre des adversaires classés au moins 100 points en dessous de vous (${lowerRated.length} parties).`,
      tips: ['Ne jouez pas « au classement » : chaque adversaire mérite la même vigilance.'],
      resources: RESOURCES.blunders,
    });
  }

  const tilt = tiltStats(all);
  if (tilt && tilt.afterLoss.length >= 8 && tilt.scoreAfterLoss <= overall - 0.1) {
    add({
      id: 'tilt',
      category: 'mental',
      severity: 2,
      title: 'Effet « tilt » après une défaite',
      detail: `Dans la partie qui suit une défaite (moins de 30 min après), votre score tombe à ${pct(tilt.scoreAfterLoss)} contre ${pct(overall)} en moyenne (${tilt.afterLoss.length} parties).`,
      tips: ['Après une défaite, faites une pause de 10 minutes ou quelques problèmes avant de relancer une partie.', 'Fixez-vous une limite : arrêtez la session après deux défaites consécutives.'],
      resources: RESOURCES.mindset,
    });
  }

  insights.sort((a, b) => b.severity - a.severity);
  return { insights, strengths };
}

export function tiltStats(games) {
  const sorted = [...games].sort((a, b) => a.endTime - b.endTime);
  const afterLoss = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.result === 'loss' && cur.timeClass === prev.timeClass && cur.endTime - prev.endTime <= 1800) afterLoss.push(cur);
  }
  return { afterLoss, scoreAfterLoss: score(afterLoss) };
}

export { score };
