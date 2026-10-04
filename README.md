# ♞ Coach Échecs

Application web qui récupère vos parties **chess.com**, repère ce que vous pouvez améliorer
(ouvertures, gestion du temps, tactique, stratégie, finales, mental) et vous propose un plan
d'entraînement avec des **problèmes** (Lichess, chess.com) et des **cours Chessable** adaptés.

## Lancer l'application

Il faut Node.js 18 ou plus récent (aucune dépendance à installer) :

```bash
npm start
# puis ouvrir http://localhost:8080
```

Saisissez votre pseudo chess.com, choisissez la période et les cadences, puis cliquez sur
**Analyser mes parties**. Tout tourne dans votre navigateur : seules les requêtes vers l'API
publique de chess.com sortent de votre machine.

> Le site est 100 % statique : vous pouvez aussi le publier tel quel (GitHub Pages, Netlify…).
> Il ne fonctionne pas en ouvrant `index.html` directement depuis le disque (`file://`),
> car les modules JavaScript et le moteur ont besoin d'un serveur HTTP.

## Ce que l'application analyse

| Domaine | Indicateurs |
|---|---|
| **Ouvertures** | score par ouverture et par couleur, ouvertures à problème, matériel perdu avant le 13e coup, répertoire trop dispersé, écart Blancs/Noirs |
| **Gestion du temps** | défaites au temps (y compris en position correcte), fréquence du zeitnot, temps passé dans l'ouverture, défaites avec beaucoup de temps restant, coups décisifs joués trop vite (horloges `%clk` du PGN) |
| **Tactique** | moment où la partie bascule (perte de matériel définitive), défaites par mat |
| **Stratégie** | conversion des positions gagnantes, capacité à sauver les positions perdues |
| **Finales** | score dans les finales à matériel équilibré |
| **Mental** | effet « tilt » après une défaite, points perdus contre des joueurs moins bien classés, abandons prématurés |

Chaque axe de progression est accompagné de conseils concrets et de liens : thèmes de problèmes
Lichess, Puzzle Rush, exercices chess.com, et cours Chessable (Woodpecker Method, Checkmate
Patterns Manual, 100 Endgames You Must Know, Preventing Blunders in Chess, Short & Sweet…).
Pour une ouverture précise, l'appli lance une recherche des cours Chessable correspondants.

### Analyse Stockfish et exercices personnalisés

Le bouton **Lancer l'analyse** fait tourner Stockfish dans le navigateur sur vos dernières
défaites. Chaque gaffe ou erreur (chute de probabilité de gain, mêmes seuils que Lichess)
devient un **exercice** : la position avant votre erreur, à résoudre sur un échiquier cliquable,
avec liens vers la partie, l'analyse Lichess et des problèmes du même thème.
Les erreurs sont classées (mat manqué, mat concédé, pièce en prise, tactique manquée, erreur de
jugement), ce qui affine les recommandations.

## Structure

```
index.html, css/style.css   interface
js/chesscom.js               API publique chess.com
js/pgn.js                    lecture des PGN (en-têtes, coups, horloges)
js/games.js                  reconstitution des parties (matériel, phases, temps par coup)
js/analysis.js               statistiques et diagnostic
js/engine.js                 Stockfish : évaluation, classement des erreurs
js/resources.js              exercices et cours associés à chaque axe
js/board.js                  échiquier des exercices
vendor/                      chess.js 1.4.0 (BSD-2), Stockfish.js 10 (GPL-3)
```

## Tests

```bash
npm test
```
