# Two Supply — Droïdes (version 0.3)

Usine de droïdes dans un terrain vague, en 10 niveaux, en solo (avec un coéquipier IA) ou à deux téléphones.

**Jouer :** `https://wowponpon59-sketch.github.io/Claude-/two-supply-droides/`

La version 0.2 reste dans l’historique Git (commit « prototype 0.2 »). La version 0.1 (pain) est dans `two-supply/`.

## Nouveautés de la 0.3

- **Carte différente à chaque partie** : les débris sont tirés au hasard (un débris de chaque matière reste près de l’usine).
- **11 matières premières** : fer, verre, argile, calcaire, eau, cuivre, caoutchouc, sable, charbon, plastique, bois, chacune avec sa couleur et son pictogramme.
- **Infos à moins de 8 m** : les étiquettes n’apparaissent que de près ; les joueurs et l’objectif en cours restent toujours visibles.
- **Entrepôt à la carte** : on choisit exactement ce qu’on prend et ce qu’on dépose.
- **Recettes au choix** : une même machine fait plusieurs produits ; avec plusieurs recettes cochées, l’opérateur alterne 2 de l’une puis 2 de l’autre.
- **10 niveaux** : métallurgie (fonderie, laminoir), courant (générateur au charbon ou au bois), deuxième ligne, contrôle qualité et recyclage, four à verre et électronique, emballage et commandes clients.
- **Pannes** dès 2 minutes de jeu ; **pannes lourdes** à partir du niveau 4, à réparer à deux (couper à gauche, réparer à droite) ou par le chef de la maintenance.
- **13 métiers de droïdes** : ouvrier, agent logistique (matières premières seulement), agent de maintenance, agent de recherche (fouille et ramène ce qui manque, ou ce qu’on lui demande), ingénieur, chef de la maintenance, agent logistique expert (pièces fabriquées), agent qualité, agent de production, ingénieur process, agent d’achat packaging, adjoint et chef de production. Chaque métier se forme avec un kit fabriqué dans les machines.
- **Crédits et vestiaire** : objectifs, niveaux et commandes rapportent des crédits pour habiller chaque métier (casquette, casque, tablier, gilet, nœud papillon, peinture chromée ou dorée).
- **Sauvegarde automatique** sur le téléphone hôte, avec « Reprendre seul » ou « Reprendre à deux » à l’accueil.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `js/config.js` | Matières, machines, recettes, droïdes, tenues, créatures, niveaux |
| `js/world.js` | Terrain vague : génération aléatoire des débris (graine), décor, passages, obstacles |
| `js/sim.js` | Règles du jeu (téléphone hôte ou partie solo) |
| `js/bot.js` | Coéquipier IA du mode solo |
| `js/move.js` | Déplacements et collisions |
| `js/gl.js` | Moteur 3D WebGL : matières peintes, ombres, rendu filmique |
| `js/models.js` | Modèles 3D procéduraux (machines, débris, droïdes et tenues) |
| `js/scene.js` | Mise à jour du monde à partir de l’état |
| `js/net.js` | Connexion entre téléphones (PeerJS) |
| `js/ui.js` | HUD, menus (entrepôt, recettes, formation, usine, vestiaire), caméra tactile, repères |
| `js/main.js` | Modes de jeu, sauvegarde, boucle, caméra troisième personne |

Test sur ordinateur : ZQSD ou flèches pour marcher, Espace pour agir, A et R pour tourner la caméra, molette pour zoomer.
Deux onglets sur le même ordinateur : ajouter `?net=fake` à l’adresse.
