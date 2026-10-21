# Dépôt de Vianney : jeu « Two Supply — Droïdes » (projet actif) et Coach Échecs

Ce dépôt contient deux choses :
- `two-supply-droides/` : **le projet en cours**, un jeu vidéo coopératif pour téléphones (version 0.4.2).
- La racine (`index.html`, `js/`, `server.js`, `test/`) : l'application Coach Échecs, à ne pas toucher sauf demande.
- `two-supply/` : la toute première version du jeu (v0.1, sur le pain). À garder intacte.

## Comment travailler avec Vianney (règles à respecter)

- **Toujours répondre en français**, simplement, sans jargon technique inutile.
- **Ne jamais modifier le code sans son accord.** À chaque message : analyser ce qu'il demande, poser des questions, proposer, puis **attendre sa validation** (« go », « oui », « tu peux lancer ») avant de toucher au code.
- Il préfère des questions numérotées (il répond « 1. oui 2. … »).
- Une fois validé : coder, tester, publier, puis faire un résumé court de ce qui a changé.
- Garder les anciennes versions : v0.1 dans `two-supply/`, les autres dans l'historique Git.

## Le jeu

- Lien public : https://wowponpon59-sketch.github.io/Claude-/two-supply-droides/
- **Publication** : GitHub Pages sert la branche `claude/chess-com-game-analyzer-ep3bsi`. Pour que Vianney voie un changement, il faut le pousser sur **cette branche** (ou la fusionner dedans). La branche `main` ne contient pas le jeu à jour.
- Site 100 % statique, sans étape de build ni dépendance : HTML + modules JavaScript + WebGL fait maison.
- Contraintes fixées par Vianney :
  - graphismes **procéduraux** uniquement (pas d'images) ;
  - mode **solo avec un coéquipier IA** (`js/bot.js`) et mode **à deux téléphones** ;
  - **iPhone (Safari) et Android** doivent jouer ensemble, via un lien ou un QR code ;
  - à chaque version, afficher le numéro sur l'accueil (`index.html`) et dans `js/config.js` (`VERSION`).
- Résumé des versions et des règles du jeu : `two-supply-droides/README.md` (à mettre à jour à chaque version).

## Organisation du code (`two-supply-droides/js/`)

| Fichier | Rôle |
| --- | --- |
| `config.js` | Toutes les données : matières, pièces, kits, recettes, machines, chantiers (PLOTS), droïdes et leurs niveaux, tenues, crédits, 20 niveaux et objectifs, constantes de temps (T) |
| `sim.js` | Règles du jeu. Simulation de référence, tournée par le téléphone hôte (ou le seul téléphone en solo) |
| `bot.js` | Coéquipier IA du mode solo |
| `world.js` | Carte aléatoire (graine), débris, décor, passages, obstacles fixes (dont le coin pause) |
| `move.js` | Déplacements et collisions |
| `gl.js` / `models.js` / `scene.js` | Moteur 3D, modèles procéduraux, mise à jour de la scène |
| `ui.js` | HUD, menus, étiquettes, commandes tactiles, blocage du zoom Safari |
| `net.js` | Connexion à deux (PeerJS) |
| `main.js` | Modes de jeu, sauvegarde, boucle, caméra |

Points importants :
- Le **niveau** dans le code est un index (0 = niveau 1). `DROIDS[x].lvl` et `RECIPES[x].lvl` sont des index ; `PLOTS[x].level` est le numéro affiché.
- **À deux** : l'hôte envoie tout l'état en JSON. PeerJS coupe au-delà d'environ 16 300 octets, donc les messages sont découpés en morceaux de 4 000 caractères (`net.js`). Ne pas casser ça.
- **Sauvegarde** : clé `twosupply-droides-save-v04` (format `{at, code, st}`, `st.v === 4`). Garder la compatibilité des sauvegardes existantes (ajouter des valeurs par défaut dans `restoreState`).
- Commandes envoyées par l'invité : liste blanche `CMDS` dans `main.js` (y ajouter toute nouvelle commande).
- Outils de debug dans la page : `window.__ts` (`app`, `tp(x, z, yaw)`, `advance(secondes)`, `forceBuild(id)`, `saveGame()`…), `?net=fake` pour jouer à deux dans deux onglets, `window.__cutLinks()` pour simuler une coupure.

## Règles du jeu validées par Vianney (0.4.2)

- 20 niveaux, en alternant une nouveauté et un niveau de « rodage » (objectifs faisables avec l'existant).
- Métiers : logistique et maintenance au niveau 3, agent de recherche au niveau 5 (objectif au niveau 6), ingénieur au niveau 7, chef de la maintenance au niveau 9, expert logistique au niveau 10, responsable qualité au niveau 13, adjoint qualité au niveau 14, puis production et process (16), achat (18), adjoint et chef de production (20). Les métiers à venir apparaissent sous cadenas « Niveau X ».
- Générateur (niveau 5) : 1 unité de charbon ou de bois toutes les 12 minutes de jeu, 5 au maximum. Après 1 heure de jeu, surchauffe et pause obligatoire de 30 minutes (décompte visible, même en revenant). 30 minutes sans jouer remettent le compteur à zéro.
- Qualité (niveau 13) : 20 % des pièces déclassées. Au contrôle, 1 sur 2 part au rebut (1 sur 3 avec le responsable qualité), jamais plus de 10 contrôles de suite sans rebut.
- Recycleur (niveau 11) : objets en trop cochés dans son menu. Il rend la moitié des matières premières (les demi-unités sont reportées) et garde une réserve de 10 (3 pour un kit). Les rebuts donnent 1 matière première.
- Pause automatique : une recette s'arrête à 20 pièces ou 3 kits en stock (10 pour un objet coché « en trop »), sauf si un objectif du niveau demande d'en produire.
- Coin pause à côté de l'entrepôt : les droïdes spécialisés sans tâche s'y assoient avec un café (6 places), les autres restent debout autour. Les droïdes standards attendent près de l'assembleur.
- Crédits gagnés en jouant. Tenues cumulables par métier ; on ne peut payer que 2 ou 3 tenues par métier avant le niveau 10 ; pack « L'intégrale » au niveau 10.
- Créatures : le coéquipier IA les rabat vers le joueur. Une fois encerclée, la créature reste bloquée 2 s ; on l'attrape à 2,6 m, et le bouton « Attraper » passe avant tout.
- Appel du partenaire : bord de l'écran qui clignote jusqu'à l'arrivée sur place (15 s au plus), message, flèche, vibration.
- Sauvegardes : automatiques (toutes les 20 s, à chaque niveau, en quittant), confirmation avant d'écraser une partie, bouton « Sauvegarder et quitter » dans le panneau Usine.

## Tests (`two-supply-droides/tests/`)

Toutes les commandes se lancent depuis la racine du dépôt.

- `node two-supply-droides/tests/partie-complete.test.mjs 777` : partie complète en 20 niveaux, sans navigateur (environ 2 à 3 minutes). Affiche « OK » et crée `tests/fixtures/*.json`. Tester plusieurs graines (11, 42, 2024…).
- `node two-supply-droides/tests/recyclage.test.mjs` : calcul du recyclage.
- `node two-supply-droides/tests/creatures.mjs` : capture des créatures en solo (objectif : au moins 9 fois sur 10).
- `node two-supply-droides/tests/droides-coinces.mjs` : droïdes bloqués (un agent de recherche coincé environ 5 s hors de l'usine, c'est connu).
- `node two-supply-droides/tests/navigateur.test.cjs` : tests navigateur avec Playwright et Chromium, plusieurs minutes. Il faut d'abord la partie complète, puis un serveur `python3 -m http.server 8765 --bind 127.0.0.1` lancé depuis la racine. Sans écran, le rendu tourne à environ 1 image/s : utiliser `__ts.advance()` et des attentes, pas des pauses fixes.
- **À vérifier** : au dernier lancement, l'étape « l'hôte reçoit l'appel » (partie à deux) a échoué une fois. Elle passait avant ; c'est peut-être un test instable, à regarder.
