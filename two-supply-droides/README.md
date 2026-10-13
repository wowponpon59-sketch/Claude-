# Two Supply — Droïdes (prototype 0.2)

Usine de droïdes dans un terrain vague, en solo (avec un coéquipier IA) ou à deux téléphones.

**Jouer :** `https://wowponpon59-sketch.github.io/Claude-/two-supply-droides/`

## Le principe

1. Fouiller les débris du terrain vague : fer (épaves), verre (vitres brisées), argile, calcaire, eau.
2. Vider son sac à l’entrepôt, apporter les matériaux aux chantiers, monter les machines à deux.
3. Ramener à deux le cœur d’assembleur, caché dans les épaves à l’est.
4. Produire le premier droïde : carcasse métallique (forge : 2 fer + 1 eau) + circuit de commande (1 verre + 1 calcaire).
5. Les droïdes remplacent les humains sur les machines, puis se spécialisent : agent logistique, agent de maintenance, ingénieur.
6. Capturer à deux les créatures de ferraille (l’un rabat, l’autre attrape) : +25 % de cadence pour toujours.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `js/config.js` | Matières, machines, recettes, droïdes, créatures, niveaux |
| `js/world.js` | Terrain vague : relief, débris, décor, obstacles (déterministe) |
| `js/sim.js` | Règles du jeu (téléphone hôte ou partie solo) |
| `js/bot.js` | Coéquipier IA du mode solo |
| `js/move.js` | Déplacements et collisions |
| `js/gl.js` | Moteur 3D WebGL : matières peintes, ombres, rendu filmique |
| `js/models.js` | Modèles 3D procéduraux |
| `js/scene.js` | Mise à jour du monde à partir de l’état |
| `js/net.js` | Connexion entre téléphones (PeerJS) |
| `js/ui.js` | HUD, menus, caméra tactile, repères |
| `js/main.js` | Modes de jeu, boucle, caméra troisième personne |

Test sur ordinateur : ZQSD ou flèches pour marcher, Espace pour agir, A et R pour tourner la caméra, molette pour zoomer.
Deux onglets sur le même ordinateur : ajouter `?net=fake` à l’adresse.
