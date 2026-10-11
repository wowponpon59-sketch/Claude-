# Two Supply — prototype 0.1

Jeu coopératif à deux téléphones : une usine agroalimentaire à relancer, où les grosses tâches ne se font qu'à deux.

**Jouer :** ouvrir `https://wowponpon59-sketch.github.io/Claude-/two-supply/` sur deux téléphones (iPhone ou Android).
Le premier touche « Créer une partie », le second scanne le QR code ou tape le code à 4 lettres.

## Contenu du prototype

- Chaîne du pain : blé → moulin → farine ; farine + eau + sel → pétrin → pâte ; pâte → four → pain → comptoir.
- Mécaniques à deux : porter la caisse du four, monter le four (l'un tient, l'autre visse), tirer les deux leviers ensemble.
- Métiers : Ingénieur (plans, montage et réparation rapides) et Chef de production (recettes, pétrissage rapide).
- Code visuel : pictogramme blanc = seul ; doré à bandes jaunes et noires = à deux.
- Incident : le moulin se bloque tous les 3 sacs.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `js/config.js` | Positions, durées, recettes |
| `js/sim.js` | Règles du jeu (tourne sur le téléphone hôte) |
| `js/move.js` | Déplacements et collisions |
| `js/gl.js` | Mini moteur 3D WebGL |
| `js/scene.js` | Décor, machines, personnages |
| `js/net.js` | Connexion entre téléphones (PeerJS) |
| `js/ui.js` | Écrans, HUD, commandes tactiles, repères |
| `js/main.js` | Boucle de jeu et liaison de l'ensemble |

Test sur un ordinateur : ajouter `?net=fake` à l'adresse et ouvrir deux onglets (clavier : ZQSD ou flèches, Espace pour agir).
