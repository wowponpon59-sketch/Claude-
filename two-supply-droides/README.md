# Two Supply — Droïdes (version 0.7.1)

Usine de droïdes dans un terrain vague, en 20 niveaux, en solo (avec un coéquipier IA) ou à deux téléphones.

**Jouer :** `https://wowponpon59-sketch.github.io/Claude-/two-supply-droides/`

Les versions 0.2 et 0.3 restent dans l’historique Git. La version 0.1 (pain) est dans `two-supply/`.

## Nouveautés de la 0.7.1

- **Livrer depuis le sac** : pour livrer les matériaux d’un chantier ou payer le kit d’une formation, il faut les avoir dans son sac (avant, ce qui était à l’entrepôt comptait aussi). Les ingénieurs, eux, prennent toujours à l’entrepôt.
- **Conditionneur** (niveau 8, avec sa pièce lourde) : il met les droïdes dans un carton ; le colis se livre au quai. L’emballeuse ne fait plus que les cartons. L’objectif du niveau 8 devient « Construire le conditionneur ». « Faire venir », la recette automatique, l’agent d’achat et le chef de production travaillent avec le conditionneur.
- **Carte** : les débris placés près de l’usine (un par matière) sont maintenant répartis tout autour, et plus seulement vers les coins : les abords changent vraiment d’une partie à l’autre.

## Nouveautés de la 0.7

- **Améliorations des machines** (menu Recettes) : 3 niveaux — cadence +20 %, pannes −30 %, sortie doublée (pas pour les droïdes ni les colis). On la demande, un ingénieur prend les pièces à l’entrepôt et vient l’installer. Les étoiles au-dessus de la machine et dans son nom montrent son niveau.
- **Commandes urgentes** (à partir du niveau 10) : 3 minutes au chrono, prime double (⚡ en haut à gauche).
- **Le Colosse** : une créature géante rôde une fois par niveau à partir du niveau 5 (5 minutes). Il faut l’encercler de près à deux, puis appuyer **en même temps** sur « Attraper ». Installé sur une machine : +100 % de cadence (+25 crédits). En solo, le coéquipier IA appuie avec toi.
- **Camion de livraison** (à partir du niveau 3, toutes les 7 minutes) : il se gare devant un passage des ruines avec 14 matières premières ; l’un décharge, l’autre réceptionne (garder appuyé tous les deux). Il repart au bout de 3 minutes. En solo, le coéquipier IA réceptionne.

## Nouveautés de la 0.6

- **Vous êtes les directeurs** : des clients passent des commandes au hasard (droïdes standards, puis à partir du niveau 10 des commandes ★ spéciales qui demandent un droïde spécialisé). Elles s’affichent en haut à gauche avec le temps qui reste.
- **Emballage** dès le niveau 8 (emballeuse et quai) : on amène un droïde à l’emballeuse, avec un carton il en sort en colis, qu’on livre au quai. La recette « Emballer un droïde standard » le fait toute seule avec les droïdes standards libres. Pour une commande spéciale, le bouton « Faire venir » à l’emballeuse appelle le droïde demandé. L’ancien « droïde en caisse » disparaît (les caisses des sauvegardes deviennent des colis).
- **Objectifs** : « Satisfaire X commandes » aux niveaux 8, 10, 15, 18, 19 et 20, et une commande spéciale au niveau 18. « Recycler 2 objets en trop » passe au niveau 11.
- **3 droïdes au plus par métier** (les droïdes standards ne sont pas limités).
- **Durée de vie** : 3 niveaux après sa fabrication, un droïde devient obsolète. Il travaille à 60 % ; amené au recycleur, il rend une carcasse et un circuit (et libère sa place dans le métier).

## Nouveautés de la 0.5

- **Pièces lourdes** : chaque vraie machine (pas la zone des déclassés ni le quai) a sa pièce lourde, posée dans le terrain vague à une place différente à chaque partie, à ramener à deux avant le montage, comme le cœur d’assembleur. Les petits débris (rochers, fûts) ne bloquent plus quand on porte à deux.
- **Ingénieurs** : un ingénieur seul livre les matériaux et tient la pièce, mais il faut un joueur pour visser. Avec deux ingénieurs, ils vont chercher la pièce lourde, livrent et montent la machine tout seuls. À deux téléphones, si tu tiens une pièce seul et que ton partenaire est loin, un ingénieur vient prendre l’autre poignée.
- **Aménager** (panneau Usine) : on choisit une machine, on marche jusqu’au nouvel emplacement sur la dalle (fantôme vert ou rouge), puis « Poser ici ». Elle garde son contenu, ses créatures et son opérateur.
- **Vestiaire › Moi** : chaque joueur habille son personnage (casquette, casque, lunettes de soudeur, casque audio, nœud papillon, écharpe, tablier, gilet fluo, sac à dos, cape, gants), avec 10 couleurs au choix.
- **Graphismes** : ciel avec soleil et nuages, cycle jour et nuit (12 minutes, dont environ 2 de nuit, étoiles), lampadaires qui éclairent la nuit, métal brossé, boulons, tuyaux, pupitres de commande et marquages sur les machines, fumée des cheminées quand elles tournent, étincelles en cas de panne, allées jaunes et flaques sur la dalle, herbes et fleurs dans le terrain vague. Le nombre d’objets dessinés reste celui de la 0.4.3.

## Nouveautés de la 0.4.3

- **Pannes** : une machine à l’arrêt s’use aussi (5 fois moins vite qu’en marche), donc les pannes arrivent même quand le stock est plein. Il y en a un peu plus à chaque niveau (+4 % par niveau). Le niveau 8 (« Réparer 3 pannes ») est de nouveau faisable à deux.
- **Générateur** : 5 charbons **et** 5 bois au maximum, 1 unité brûlée toutes les 6 minutes (10 unités = 1 heure). La surchauffe n’est plus annoncée à l’avance : on la découvre quand elle arrive.
- **Noms des machines et bâtiments** visibles seulement tout près (à moins de 3 m de leur bord). Les bulles « à récupérer », les joueurs et l’objectif restent visibles de loin.
- **Zone des déclassés** : déclassés **et rebuts** sont toujours rangés à part, jamais à l’entrepôt des bonnes pièces, même avant l’adjoint qualité. L’adjoint qualité se met au travail à la zone des déclassés.
- **Coéquipier IA** : il attend assis sur le canapé du coin pause avec un café ; il vient pour les tâches à deux (montage, panne lourde, caisse, créature) ou quand on appuie sur le bouton d’appel (il te suit alors 1 minute).
- **Recycleur au niveau 7** (fer, caoutchouc, fil de cuivre) ; le niveau 11 demande 6 carcasses à la place.
- **« Former 2 droïdes spécialisés »** remplace « Produire 4, 5 ou 6 droïdes » aux niveaux 6, 10, 12 et 17.
- **Droïdes moins coincés** : ils contournent par les coins le coin pause, l’entrepôt et les machines qui barrent leur chemin.
- **Plus fluide en fin de partie** : ce qui est hors de l’écran n’est plus dessiné, les droïdes éloignés sont simplifiés et chaque droïde compte deux fois moins de morceaux (environ deux fois moins d’objets dessinés au niveau 20).

## Nouveautés de la 0.4.2

- **Métiers plus tôt** : agent de recherche dès le niveau 5 (objectif au niveau 6), agent logistique expert au niveau 10 ; le niveau 7 devient « Les bâtisseurs » (ingénieur).
- **Recycleur au niveau 11** : on coche les objets en trop dans son menu (pièces et kits) ; il rend la moitié des matières premières qui ont servi à les fabriquer et laisse toujours 10 objets à l’entrepôt (3 pour un kit). L’agent logistique expert les lui apporte. Les rebuts arrivent avec le contrôle qualité ; le niveau 14 devient « Le tri ».
- **Pause automatique** : une recette s’arrête quand l’entrepôt a 20 de ces pièces ou 3 de ces kits (10 pour un objet coché « en trop ») et repart dès que le stock baisse. Pas de pause tant qu’un objectif du niveau demande d’en produire.
- **Coin pause** à côté de l’entrepôt : les droïdes spécialisés sans tâche s’assoient sur les canapés avec un café (6 places), les autres restent debout autour ; ils se lèvent dès qu’il y a du travail.

## Correctifs de la 0.4.1

- **Créatures en solo** : le coéquipier IA rabat la créature vers toi et ne la lâche plus tant que tu restes dans les parages ; une fois encerclée, elle reste bloquée au moins 2 secondes ; on l’attrape à 2,6 m (au lieu de 2 m) et le bouton « Attraper » passe avant les débris, chantiers et machines voisins.
- **Appel du partenaire** : le bord de l’écran clignote jusqu’à ce que tu arrives sur place, 15 secondes au plus.
- **Zoom de Safari** bloqué pendant le jeu (joystick + bouton, double tape) ; si la page est quand même zoomée, un bouton « Recadrer l’écran » apparaît.
- **Sauvegardes** : le bloc « Reprendre » n’apparaît plus sans sauvegarde ; « Jouer seul » ou « Créer une partie à deux » demandent confirmation avant d’écraser une partie ; repère « Partie sauvegardée ✓ » ; bouton « Sauvegarder et quitter » dans le panneau Usine.

## Nouveautés de la 0.4

- **Connexion à deux corrigée** : l’état de l’usine est découpé en petits messages (la liaison se coupait vers le niveau 7). Si la liaison saute, la partie se met en pause et le téléphone invité se reconnecte tout seul, avec le même code.
- **20 niveaux** : une nouveauté, puis un niveau de « rodage » pour profiter de l’usine (produire, faire travailler les droïdes, réparer, capturer, gagner des crédits). Le courant arrive au niveau 5.
- **Établi des kits** : tous les kits de métier s’y fabriquent ; la forge ne fait plus que des carcasses et l’atelier de circuits que des circuits, avec de nouvelles recettes au choix au fil du jeu.
- **Four à céramique** : l’argile devient des isolants céramiques (générateur, circuits, kits).
- **Alternance de 1** : plusieurs recettes cochées, la machine en fait 1 de chaque ; s’il manque une matière, elle passe à la suivante.
- **Bulles « à récupérer »** au-dessus des machines, visibles de loin.
- **Contrôle qualité** : 20 % des pièces sortent déclassées ; zone des déclassés ; au contrôle, 1 sur 2 part au rebut (1 sur 3 avec le responsable qualité) ; le recyclage redonne la matière première. Nouveau métier : adjoint qualité.
- **Générateur** : 5 unités de charbon ou de bois, 1 brûlée toutes les 12 minutes de jeu ; après 1 heure de jeu, surchauffe et pause obligatoire de 30 minutes (décompte visible même en revenant plus tard ; organigramme et vestiaire restent ouverts). 30 minutes sans jouer remettent le compteur à zéro.
- **Métiers à venir** sous cadenas (« ??? · Niveau X ») et annonce de tout ce qui est débloqué à chaque niveau.
- **Crédits en jouant** (+2 par droïde, +1 par contrôle, +3 ou +6 par panne réparée, +5 par créature) et **tenues cumulables** aux couleurs de chaque métier, avec le pack « L’intégrale » à partir du niveau 10.
- **Boutons Équipe et Vestiaire** en haut de l’écran ; appel du partenaire plus visible (bord de l’écran qui clignote, message au centre, flèche, vibration sur Android).

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

## Tests

Les scripts de test sont dans `tests/` (partie complète en 20 niveaux, règles de la 0.4.3, 0.5, 0.6, 0.7 et 0.7.1, navigateur, créatures, recyclage, droïdes coincés). Le mode d'emploi est dans `CLAUDE.md`, à la racine du dépôt.
