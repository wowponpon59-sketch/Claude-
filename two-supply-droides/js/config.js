// Two Supply — Droïdes (version 0.5)
// Repère : x vers l'est, z vers le sud, y vers le haut. Unité : mètre.

export const VERSION = '0.5';
export const SAVE_KEY = 'twosupply-droides-save-v04';

export const WORLD = { half: 40 };
export const SLAB = { x0: -22, x1: 22, z0: -15, z1: 16 };

export const PLAYER_R = 0.4;
export const SPEED = 4.6;
export const CARRY_SPEED = 2.6;
export const REACH = 1.1;      // joueur → bord d'un objet
export const POST_R = 1.1;     // joueur → poste à deux
export const SAC_MAX = 12;
export const LABEL_RANGE = 3;  // noms des machines, bâtiments et débris : seulement à moins de 3 m de leur bord
export const ANIMAL_RANGE = 8; // créatures : à moins de 8 m
export const OUT_MAX = 4;      // sortie maximale d'une machine, par produit

export const PLAYER_COLORS = {
  A: { rgb: [0.20, 0.50, 0.95], css: '#3a86f0', name: 'bleu' },
  B: { rgb: [0.97, 0.50, 0.16], css: '#f7822a', name: 'orange' },
};

// ---------- objets ----------
// kind : raw (matière première), part (pièce fabriquée), kit (kit de spécialisation), decl (pièce déclassée), rebut
export const ITEMS = {
  fer: { name: 'Fer', kind: 'raw', css: '#93a7bd' },
  verre: { name: 'Verre', kind: 'raw', css: '#79e3ea' },
  argile: { name: 'Argile', kind: 'raw', css: '#b8432a' },
  calcaire: { name: 'Calcaire', kind: 'raw', css: '#ece6d4' },
  eau: { name: 'Eau', kind: 'raw', css: '#2f8fe8' },
  cuivre: { name: 'Cuivre', kind: 'raw', css: '#f0902c' },
  caoutchouc: { name: 'Caoutchouc', kind: 'raw', css: '#3b3b42' },
  sable: { name: 'Sable', kind: 'raw', css: '#ecd27a' },
  charbon: { name: 'Charbon', kind: 'raw', css: '#26262b' },
  plastique: { name: 'Plastique', kind: 'raw', css: '#e8509e' },
  bois: { name: 'Bois', kind: 'raw', css: '#a8793f' },

  carcasse: { name: 'Carcasse', kind: 'part', css: '#b9c2cc' },
  circuit: { name: 'Circuit', kind: 'part', css: '#36b36a' },
  isolant: { name: 'Isolant céramique', kind: 'part', css: '#eef3f8' },
  fil: { name: 'Fil de cuivre', kind: 'part', css: '#f0902c' },
  lingot: { name: 'Lingot', kind: 'part', css: '#8796a8' },
  tole: { name: 'Tôle', kind: 'part', css: '#a9b7c7' },
  silicium: { name: 'Plaque de silicium', kind: 'part', css: '#7b6cf0' },
  circuitA: { name: 'Circuit avancé', kind: 'part', css: '#e6b422' },
  carton: { name: 'Carton', kind: 'part', css: '#c99a5b' },
  caisse: { name: 'Droïde en caisse', kind: 'part', css: '#d9a441' },
  colis: { name: 'Colis', kind: 'part', css: '#d9b27a' },

  k_scanner: { name: 'Scanner de stock', kind: 'kit', css: '#3f99ff', glyph: 'S' },
  k_outils: { name: 'Boîte à outils', kind: 'kit', css: '#e04a3a', glyph: 'O' },
  k_detect: { name: 'Détecteur', kind: 'kit', css: '#22c3b4', glyph: 'D' },
  k_tablette: { name: 'Tablette de plans', kind: 'kit', css: '#b366ff', glyph: 'T' },
  k_valise: { name: 'Valise d’expert', kind: 'kit', css: '#1f8f4e', glyph: 'V' },
  k_terminal: { name: 'Terminal logistique', kind: 'kit', css: '#2b4fd6', glyph: 'L' },
  k_lecteur: { name: 'Lecteur qualité', kind: 'kit', css: '#f2f2f2', glyph: 'Q' },
  k_chariot: { name: 'Chariot de tri', kind: 'kit', css: '#e2463f', glyph: 'R' },
  k_bras: { name: 'Bras multi-outils', kind: 'kit', css: '#ff7a1a', glyph: 'B' },
  k_flux: { name: 'Analyseur de flux', kind: 'kit', css: '#5b4bd8', glyph: 'F' },
  k_achat: { name: 'Terminal d’achat', kind: 'kit', css: '#ff6fb1', glyph: 'A' },
  k_planning: { name: 'Planning de production', kind: 'kit', css: '#c7ced6', glyph: 'P' },
  k_pilotage: { name: 'Poste de pilotage', kind: 'kit', css: '#f2c14e', glyph: 'C' },
};
// Pièces qui peuvent sortir « déclassées » (une fois le contrôle qualité en place), et ce que donne leur rebut au recyclage
export const QC_BASES = {
  carcasse: { decl: 'Carcasse déclassée', rebut: 'Rebut de carcasse', back: { fer: 1 } },
  circuit: { decl: 'Circuit déclassé', rebut: 'Rebut de circuit', back: { verre: 1 } },
  circuitA: { decl: 'Circuit avancé déclassé', rebut: 'Rebut de circuit avancé', back: { sable: 1, cuivre: 1 } },
  fil: { decl: 'Fil de cuivre déclassé', rebut: 'Rebut de fil', back: { cuivre: 1 } },
  lingot: { decl: 'Lingot déclassé', rebut: 'Rebut de lingot', back: { fer: 1 } },
  tole: { decl: 'Tôle déclassée', rebut: 'Rebut de tôle', back: { fer: 1 } },
  silicium: { decl: 'Plaque de silicium déclassée', rebut: 'Rebut de silicium', back: { sable: 1 } },
  isolant: { decl: 'Isolant déclassé', rebut: 'Rebut d’isolant', back: { argile: 1 } },
  verre: { decl: 'Verre déclassé', rebut: 'Rebut de verre', back: { sable: 1 } },
  carton: { decl: 'Carton déclassé', rebut: 'Rebut de carton', back: { bois: 1 } },
};
for (const [b, q] of Object.entries(QC_BASES)) {
  ITEMS[b + '_d'] = { name: q.decl, kind: 'decl', base: b, css: ITEMS[b].css };
  ITEMS[b + '_r'] = { name: q.rebut, kind: 'rebut', base: b, css: ITEMS[b].css };
}
export const RAW = ['fer', 'verre', 'argile', 'calcaire', 'eau', 'cuivre', 'caoutchouc', 'sable', 'charbon', 'plastique', 'bois'];
export const ITEM_ORDER = Object.keys(ITEMS);
export const isRaw = (k) => ITEMS[k] && ITEMS[k].kind === 'raw';
export const isDecl = (k) => ITEMS[k] && ITEMS[k].kind === 'decl';
export const isRebut = (k) => ITEMS[k] && ITEMS[k].kind === 'rebut';
// Niveau (index 0 = niveau 1) à partir duquel une matière est utile : sert à l'agent de recherche
export const RAW_LEVEL = { fer: 0, verre: 0, argile: 0, calcaire: 0, eau: 0, caoutchouc: 4, charbon: 4, bois: 4, cuivre: 6, plastique: 8, sable: 15 };

// ---------- débris à fouiller ----------
export const NODE_TYPES = {
  epave: { name: 'Épave rouillée', item: 'fer', qty: 6, r: 1.6 },
  ferraille: { name: 'Tas de ferraille', item: 'fer', qty: 4, r: 1.1 },
  vitres: { name: 'Vitres brisées', item: 'verre', qty: 4, r: 1.2 },
  argile: { name: 'Butte d’argile', item: 'argile', qty: 6, r: 1.3 },
  calcaire: { name: 'Blocs de calcaire', item: 'calcaire', qty: 5, r: 1.2 },
  citerne: { name: 'Citerne percée', item: 'eau', qty: 8, r: 1.1 },
  cables: { name: 'Câbles arrachés', item: 'cuivre', qty: 4, r: 1.2 },
  pneus: { name: 'Tas de pneus', item: 'caoutchouc', qty: 5, r: 1.1 },
  dune: { name: 'Dune de sable', item: 'sable', qty: 8, r: 1.4 },
  charbon: { name: 'Wagonnet de charbon', item: 'charbon', qty: 6, r: 1.2 },
  bidons: { name: 'Bidons en plastique', item: 'plastique', qty: 5, r: 1.1 },
  palettes: { name: 'Palettes en bois', item: 'bois', qty: 5, r: 1.1 },
};
// Proportion de chaque type sur la carte (tirage aléatoire à chaque partie)
export const NODE_MIX = { epave: 6, ferraille: 6, vitres: 6, argile: 6, calcaire: 5, citerne: 4, cables: 6, pneus: 5, dune: 5, charbon: 6, bidons: 5, palettes: 5 };

export const T = {
  dig: 0.7,
  stockCap: 20,         // une recette se met en pause quand l'entrepôt a 20 de ces pièces…
  kitCap: 3,            // … ou 3 de ces kits ; elle repart dès que le stock baisse
  recReserve: 10,       // le recycleur laisse toujours 10 objets en trop à l'entrepôt (3 pour un kit)
  respawn: 70,
  repair: 3,
  heavyRepair: 5,
  spec: 6,
  panneStart: 120,      // premières pannes dès 2 minutes de jeu
  wear: [70, 130],      // secondes de fonctionnement avant une panne
  idleWear: 0.2,        // une machine à l'arrêt s'use 5 fois moins vite (mais elle s'use)
  panneGrow: 0.04,      // +4 % de pannes à chaque niveau (×1,8 au niveau 20)
  heavyFrom: 4,         // niveau 5 (index 4) : pannes lourdes
  animalBoost: 0.25,
  animalMax: 2,
  bumpBack: 90,
  battery: 150,         // batterie de secours à l'arrivée du courant (secondes)
  genCap: 5,            // le générateur contient 5 charbons et 5 bois
  genUnit: 360,         // 1 unité brûlée toutes les 6 minutes de jeu (10 unités = 1 heure)
  overheatAt: 3600,     // surchauffe après 1 heure de jeu avec le générateur
  overheatLock: 1800,   // pause obligatoire de 30 minutes (temps réel)
  restReset: 1800,      // 30 minutes sans jouer : le compteur repart de zéro
  declRate: 0.2,        // 20 % des pièces sortent déclassées
  rebutRate: 0.5,       // au contrôle : 1 déclassée sur 2 part au rebut
  rebutRateResp: 1 / 3, // 1 sur 3 avec le responsable qualité
  rebutMaxRun: 10,      // jamais plus de 10 contrôles d'affilée sans rebut
};
export const SCREWS = 10;

// ---------- recettes ----------
// lvl : niveau minimal (index), need : machine(s) qui doivent exister, any : prend n'importe quelle pièce de cette sorte
export const RECIPES = {
  carcasse: { name: 'Carcasse', in: { fer: 2, eau: 1 }, out: { carcasse: 1 }, time: 8, lvl: 0 },
  carcasseT: { name: 'Carcasse en tôle', in: { tole: 2, eau: 1 }, out: { carcasse: 1 }, time: 6, lvl: 0, need: ['laminoir'] },
  carcasseL: { name: 'Carcasse moulée', in: { lingot: 1, plastique: 1 }, out: { carcasse: 1 }, time: 5, lvl: 0, need: ['fonderie'] },

  circuit: { name: 'Circuit', in: { verre: 1, calcaire: 1 }, out: { circuit: 1 }, time: 8, lvl: 0 },
  circuitF: { name: 'Circuit au cuivre', in: { fil: 1, verre: 1 }, out: { circuit: 1 }, time: 6, lvl: 0, need: ['trefileuse'] },
  circuitC: { name: 'Circuit sur céramique', in: { isolant: 1, fil: 1 }, out: { circuit: 1 }, time: 5, lvl: 0, need: ['ceramique', 'trefileuse'] },
  circuitS: { name: 'Circuit au silicium (×2)', in: { silicium: 1, fil: 1 }, out: { circuit: 2 }, time: 8, lvl: 0, need: ['four'] },
  circuitA: { name: 'Circuit avancé', in: { silicium: 1, fil: 2, plastique: 1 }, out: { circuitA: 1 }, time: 9, lvl: 15, need: ['four'] },

  outils: { name: 'Boîte à outils', in: { fer: 2, calcaire: 1 }, out: { k_outils: 1 }, time: 6, lvl: 2 },
  scanner: { name: 'Scanner de stock', in: { circuit: 1, verre: 2 }, out: { k_scanner: 1 }, time: 6, lvl: 2 },
  detect: { name: 'Détecteur', in: { circuit: 1, fer: 2, verre: 1 }, out: { k_detect: 1 }, time: 6, lvl: 4 },
  tablette: { name: 'Tablette de plans', in: { circuit: 2, isolant: 1 }, out: { k_tablette: 1 }, time: 6, lvl: 6 },
  valise: { name: 'Valise d’expert', in: { k_outils: 1, tole: 2, fil: 2 }, out: { k_valise: 1 }, time: 8, lvl: 8 },
  terminal: { name: 'Terminal logistique', in: { circuit: 2, tole: 1, plastique: 1 }, out: { k_terminal: 1 }, time: 7, lvl: 9 },
  lecteur: { name: 'Lecteur qualité', in: { circuit: 1, plastique: 1, verre: 1 }, out: { k_lecteur: 1 }, time: 6, lvl: 12 },
  chariot: { name: 'Chariot de tri', in: { tole: 2, caoutchouc: 2, isolant: 1 }, out: { k_chariot: 1 }, time: 7, lvl: 13 },
  bras: { name: 'Bras multi-outils', in: { circuitA: 1, tole: 2 }, out: { k_bras: 1 }, time: 8, lvl: 15 },
  flux: { name: 'Analyseur de flux', in: { circuitA: 1, fil: 1, isolant: 1 }, out: { k_flux: 1 }, time: 7, lvl: 15 },
  achatT: { name: 'Terminal d’achat', in: { circuit: 1, plastique: 2 }, out: { k_achat: 1 }, time: 6, lvl: 17 },
  planning: { name: 'Planning de production', in: { circuitA: 1, plastique: 2, fil: 1 }, out: { k_planning: 1 }, time: 7, lvl: 19 },
  pilotage: { name: 'Poste de pilotage', in: { circuitA: 2, tole: 2, verre: 1 }, out: { k_pilotage: 1 }, time: 8, lvl: 19 },

  droide: { name: 'Droïde standard', in: { carcasse: 1, circuit: 1 }, out: { droide: 1 }, time: 10, lvl: 0 },
  caisse: { name: 'Droïde à livrer (en caisse)', in: { carcasse: 1, circuit: 1, bois: 1 }, out: { caisse: 1 }, time: 10, lvl: 17 },

  isolant: { name: 'Isolants céramiques (×2)', in: { argile: 2, eau: 1 }, out: { isolant: 2 }, time: 6, lvl: 3 },
  fil: { name: 'Fil de cuivre (×2)', in: { cuivre: 1 }, out: { fil: 2 }, time: 5, lvl: 6 },
  lingot: { name: 'Lingot', in: { fer: 1, charbon: 1 }, out: { lingot: 1 }, time: 5, lvl: 8 },
  tole: { name: 'Tôles (×2)', in: { lingot: 1 }, out: { tole: 2 }, time: 5, lvl: 8 },
  ctrl: { name: 'Contrôler les pièces déclassées', in: {}, out: {}, any: 'decl', time: 3, lvl: 12 },
  recyc: { name: 'Recycler les rebuts', in: {}, out: {}, any: 'rebut', time: 4, lvl: 12 },
  surplus: { name: 'Recycler les objets en trop', in: {}, out: {}, any: 'surplus', time: 4, lvl: 6 },
  verreF: { name: 'Verre fondu (×2)', in: { sable: 2, charbon: 1 }, out: { verre: 2 }, time: 6, lvl: 15 },
  silicium: { name: 'Plaque de silicium', in: { sable: 1, calcaire: 1, charbon: 1 }, out: { silicium: 1 }, time: 7, lvl: 15 },
  carton: { name: 'Cartons (×2)', in: { bois: 1, plastique: 1 }, out: { carton: 2 }, time: 4, lvl: 17 },
  colis: { name: 'Colis (emballer un droïde)', in: { caisse: 1, carton: 1 }, out: { colis: 1 }, time: 5, lvl: 17 },
};

// ---------- machines ----------
const KIT_RECIPES = ['outils', 'scanner', 'detect', 'tablette', 'valise', 'terminal', 'lecteur', 'chariot', 'bras', 'flux', 'achatT', 'planning', 'pilotage'];
export const MACHINES = {
  forge: { name: 'Forge', w: 3.2, d: 2.4, recipes: ['carcasse', 'carcasseT', 'carcasseL'], cost: { argile: 6, calcaire: 3, eau: 2, fer: 3 }, desc: 'Carcasses' },
  circuits: { name: 'Atelier de circuits', w: 3.2, d: 2.4, recipes: ['circuit', 'circuitF', 'circuitC', 'circuitS', 'circuitA'], cost: { argile: 4, calcaire: 2, verre: 4, fer: 2 }, desc: 'Circuits' },
  assembleur: { name: 'Assembleur de droïdes', w: 3.6, d: 2.8, core: true, noDecl: true, recipes: ['droide', 'caisse'], cost: { fer: 4, verre: 2 }, desc: 'Carcasse + circuit → droïde' },
  etabli: { name: 'Établi des kits', w: 3.2, d: 2.2, noDecl: true, recipes: KIT_RECIPES, cost: { fer: 4, argile: 3, verre: 2, circuit: 1 }, desc: 'Kits de spécialisation des droïdes' },
  atelier: { name: 'Atelier de spécialisation', w: 3.4, d: 2.6, recipes: [], cost: { fer: 6, verre: 3, circuit: 2, carcasse: 2 }, desc: 'Droïde standard + kit → employé spécialisé' },
  ceramique: { name: 'Four à céramique', w: 3.0, d: 2.4, recipes: ['isolant'], cost: { argile: 6, calcaire: 3, fer: 2, eau: 2 }, desc: 'Argile → isolants céramiques' },
  generateur: { name: 'Générateur', w: 2.8, d: 2.2, recipes: [], fuel: true, cost: { fer: 6, isolant: 4, caoutchouc: 2, argile: 3 }, desc: '5 charbons et 5 bois au maximum : 1 unité brûlée toutes les 6 minutes' },
  trefileuse: { name: 'Tréfileuse', w: 2.8, d: 2.0, recipes: ['fil'], cost: { fer: 4, cuivre: 3, caoutchouc: 2 }, desc: 'Cuivre → fil de cuivre' },
  fonderie: { name: 'Fonderie', w: 3.0, d: 2.4, recipes: ['lingot'], cost: { argile: 8, calcaire: 4, fer: 4, charbon: 2 }, desc: 'Fer + charbon → lingot' },
  laminoir: { name: 'Laminoir', w: 3.4, d: 2.0, recipes: ['tole'], cost: { fer: 6, lingot: 3, caoutchouc: 2, fil: 2 }, desc: 'Lingot → tôles' },
  qualite: { name: 'Poste de contrôle qualité', w: 3.0, d: 2.2, noDecl: true, recipes: ['ctrl'], cost: { tole: 4, verre: 3, circuit: 2, plastique: 2 }, desc: 'Déclassé → bonne pièce ou rebut' },
  zone: { name: 'Zone des déclassés', w: 3.6, d: 2.2, recipes: [], store: true, cost: { bois: 4, fer: 2 }, desc: 'Stocke les pièces déclassées et les rebuts, à part des bonnes pièces' },
  recycleur: { name: 'Recycleur', w: 2.8, d: 2.2, noDecl: true, recipes: ['surplus', 'recyc'], cost: { fer: 5, caoutchouc: 2, fil: 2 }, desc: 'Objets en trop et rebuts → matières premières' },
  four: { name: 'Four à verre', w: 3.0, d: 2.4, recipes: ['verreF', 'silicium'], cost: { argile: 6, calcaire: 4, tole: 2, sable: 4 }, desc: 'Sable fondu : verre et silicium' },
  emballeuse: { name: 'Emballeuse', w: 3.2, d: 2.2, recipes: ['carton', 'colis'], cost: { tole: 4, bois: 4, plastique: 3, caoutchouc: 2 }, desc: 'Cartons et colis' },
  quai: { name: 'Quai d’expédition', w: 4.0, d: 2.2, recipes: [], cost: { bois: 6, tole: 2, fer: 4 }, desc: 'Livrez les colis aux clients' },
};

// level : niveau (à partir de 1) où le chantier apparaît
export const PLOTS = [
  { id: 'forge', type: 'forge', x: -17, z: -10, level: 1 },
  { id: 'circuits', type: 'circuits', x: -8.5, z: -10, level: 1 },
  { id: 'assembleur', type: 'assembleur', x: 0, z: -10, level: 1 },
  { id: 'atelier', type: 'atelier', x: 8.5, z: -10, level: 3 },
  { id: 'etabli', type: 'etabli', x: 17, z: -10, level: 3 },
  { id: 'generateur', type: 'generateur', x: -17, z: -1.5, level: 5 },
  { id: 'ceramique', type: 'ceramique', x: -8.5, z: -1.5, level: 4 },
  { id: 'trefileuse', type: 'trefileuse', x: 8.5, z: -1.5, level: 7 },
  { id: 'forge2', type: 'forge', x: 17, z: -1.5, level: 11 },
  { id: 'fonderie', type: 'fonderie', x: -17, z: 7, level: 9 },
  { id: 'laminoir', type: 'laminoir', x: -8.5, z: 7, level: 9 },
  { id: 'qualite', type: 'qualite', x: 0, z: 7, level: 13 },
  { id: 'recycleur', type: 'recycleur', x: 8.5, z: 7, level: 7 },
  { id: 'circuits2', type: 'circuits', x: 17, z: 7, level: 11 },
  { id: 'four', type: 'four', x: -17, z: 13, level: 16 },
  { id: 'zone', type: 'zone', x: 0, z: 13, level: 13 },
  { id: 'emballeuse', type: 'emballeuse', x: 8.5, z: 13, level: 18 },
  { id: 'quai', type: 'quai', x: 17, z: 13, level: 18 },
];

export const ENTREPOT = { x: 0, z: -1.5, w: 4.2, d: 1.8 };
export const START = { A: { x: -1.2, z: 2.4 }, B: { x: 1.2, z: 2.8 } };
// Coin pause, à côté de l'entrepôt : les droïdes spécialisés sans tâche y prennent un café
export const PAUSE = { x: 4.4, z: -0.6 };
export const CORE = { x: 32, z: -27, w: 1.8, d: 1.3, handle: 1.45 };
// Lampadaires autour de la dalle (ils éclairent la nuit)
export const LAMP_POSTS = [[-21, -13.8], [-21, -4.5], [-21, 6], [-21.2, 15.2], [-9, -14.4], [8, -14.4], [21, -12], [21, 1.5], [21.2, 15.2], [-6.5, 15.3], [12, 15.3]];
// Pièces lourdes : chaque vraie machine a la sienne, posée dans le terrain vague (place différente à chaque partie),
// à ramener à deux (joueurs, ou deux ingénieurs) avant le montage. Le cœur d'assembleur est celle de l'assembleur.
export const PART = { w: CORE.w, d: CORE.d, handle: CORE.handle };
export const HEAVY = {
  assembleur: { name: 'Cœur d’assembleur', col: [0.2, 0.8, 0.9] }, forge: { name: 'Enclume de la forge', col: [0.75, 0.32, 0.18] },
  circuits: { name: 'Banc de soudure', col: [0.2, 0.7, 0.4] }, etabli: { name: 'Étau géant', col: [0.55, 0.42, 0.3] },
  atelier: { name: 'Bras de montage', col: [0.6, 0.3, 0.9] }, ceramique: { name: 'Cuve en céramique', col: [0.85, 0.55, 0.4] },
  generateur: { name: 'Turbine du générateur', col: [0.25, 0.6, 0.35] }, trefileuse: { name: 'Bobine de tréfilage', col: [0.9, 0.55, 0.2] },
  fonderie: { name: 'Creuset de la fonderie', col: [0.9, 0.35, 0.1] }, laminoir: { name: 'Cylindres du laminoir', col: [0.7, 0.72, 0.78] },
  qualite: { name: 'Scanner de contrôle', col: [0.9, 0.9, 0.95] }, recycleur: { name: 'Broyeur du recycleur', col: [0.35, 0.55, 0.35] },
  four: { name: 'Voûte du four à verre', col: [0.85, 0.75, 0.5] }, emballeuse: { name: 'Plieuse à cartons', col: [0.8, 0.62, 0.38] },
};
export const needsPart = (type) => !!HEAVY[type];

// ---------- droïdes : de l'ouvrier au chef de production ----------
// work : 'machine' (affecté à une machine) ou 'hq' (mis au travail à l'entrepôt) ; lvl : niveau (index) où le métier se débloque
export const DROIDS = {
  ouvrier: { name: 'Ouvrier', color: [0.95, 0.70, 0.15], css: '#f2b326', work: 'machine', desc: 'Fait tourner une machine à la place d’un humain.' },
  logistique: { name: 'Agent logistique', color: [0.25, 0.60, 1.0], css: '#3f99ff', kit: 'k_scanner', lvl: 2, work: 'hq', desc: 'Apporte les matières premières aux machines et range la production.' },
  maintenance: { name: 'Agent de maintenance', color: [0.30, 0.85, 0.45], css: '#4cd975', kit: 'k_outils', lvl: 2, work: 'hq', desc: 'Répare tout seul les pannes légères.' },
  recherche: { name: 'Agent de recherche', color: [0.13, 0.76, 0.70], css: '#22c3b4', kit: 'k_detect', lvl: 4, work: 'hq', desc: 'Fouille le terrain vague et ramène à l’entrepôt la matière qui manque.' },
  ingenieur: { name: 'Ingénieur', color: [0.70, 0.40, 1.0], css: '#b366ff', kit: 'k_tablette', lvl: 6, work: 'hq', desc: 'Livre les matériaux et monte les nouvelles machines tout seul.' },
  chefmaint: { name: 'Chef de la maintenance', color: [0.12, 0.56, 0.31], css: '#1f8f4e', kit: 'k_valise', lvl: 8, work: 'hq', desc: 'Répare les pannes lourdes (et légères) tout seul.' },
  expert: { name: 'Agent logistique expert', color: [0.17, 0.31, 0.84], css: '#2b4fd6', kit: 'k_terminal', lvl: 9, work: 'hq', desc: 'Distribue les pièces fabriquées à la machine qui en aura besoin le plus tôt.' },
  qualite: { name: 'Responsable qualité', color: [0.95, 0.95, 0.95], css: '#f2f2f2', kit: 'k_lecteur', lvl: 12, work: 'machine', only: 'qualite', desc: 'Tient le poste de contrôle : 1 rebut sur 3 déclassées au lieu de 1 sur 2.' },
  adjq: { name: 'Adjoint qualité', color: [0.89, 0.27, 0.25], css: '#e2463f', kit: 'k_chariot', lvl: 13, work: 'hq', at: 'zone', desc: 'Se met au travail à la zone des déclassés : amène les déclassées au contrôle, les rebuts au recycleur et les bonnes pièces à l’entrepôt.' },
  production: { name: 'Agent de production', color: [1.0, 0.48, 0.10], css: '#ff7a1a', kit: 'k_bras', lvl: 15, work: 'machine', desc: 'Fait tourner deux machines à la fois.' },
  process: { name: 'Ingénieur process', color: [0.36, 0.29, 0.85], css: '#5b4bd8', kit: 'k_flux', lvl: 15, work: 'hq', desc: 'Optimise les flux : +15 % de cadence sur toute l’usine.' },
  achat: { name: 'Agent d’achat packaging', color: [1.0, 0.44, 0.69], css: '#ff6fb1', kit: 'k_achat', lvl: 17, work: 'hq', desc: 'Commande les cartons : contre 1 plastique, il en livre 3 à l’emballeuse.' },
  adjoint: { name: 'Adjoint de production', color: [0.78, 0.81, 0.84], css: '#c7ced6', kit: 'k_planning', lvl: 19, work: 'hq', desc: 'Place tout seul les ouvriers libres sur les machines sans opérateur.' },
  chef: { name: 'Chef de production', color: [0.95, 0.76, 0.31], css: '#f2c14e', kit: 'k_pilotage', lvl: 19, work: 'hq', desc: 'Pilote l’usine : +25 % de cadence et lance les droïdes à livrer quand des commandes attendent.' },
};
export const SPEC_ORDER = ['logistique', 'maintenance', 'recherche', 'ingenieur', 'chefmaint', 'expert', 'qualite', 'adjq', 'production', 'process', 'achat', 'adjoint', 'chef'];

// ---------- tenues : elles se cumulent, une par emplacement ----------
export const SLOTS = { tete: 'Tête', corps: 'Corps', cou: 'Cou', peinture: 'Peinture' };
export const OUTFITS = {
  casquette: { name: 'Casquette', slot: 'tete', price: 40 },
  tablier: { name: 'Tablier', slot: 'corps', price: 45 },
  casque: { name: 'Casque de chantier', slot: 'tete', price: 55 },
  gilet: { name: 'Gilet', slot: 'corps', price: 60 },
  noeud: { name: 'Nœud papillon', slot: 'cou', price: 75 },
  chrome: { name: 'Peinture chromée', slot: 'peinture', price: 120 },
  or: { name: 'Peinture dorée', slot: 'peinture', price: 200 },
};
// « L'intégrale » : les 5 vêtements d'un métier (sans les peintures), à partir du niveau 10
export const PACK = { name: 'L’intégrale', items: ['casquette', 'tablier', 'casque', 'gilet', 'noeud'], price: 205, lvl: 9 };
// Tenues des joueurs (onglet « Moi » du vestiaire) : achetées une fois avec les crédits, couleur au choix, cumulables (une par emplacement)
export const ME_SLOTS = { tete: 'Tête', yeux: 'Yeux', oreilles: 'Oreilles', cou: 'Cou', corps: 'Corps', dos: 'Dos', mains: 'Mains' };
export const ME_OUTFITS = {
  casquette: { name: 'Casquette', slot: 'tete', price: 40 },
  casque: { name: 'Casque de chantier', slot: 'tete', price: 55 },
  lunettes: { name: 'Lunettes de soudeur', slot: 'yeux', price: 50 },
  audio: { name: 'Casque audio', slot: 'oreilles', price: 60 },
  noeud: { name: 'Nœud papillon', slot: 'cou', price: 45 },
  echarpe: { name: 'Écharpe', slot: 'cou', price: 45 },
  tablier: { name: 'Tablier', slot: 'corps', price: 45 },
  gilet: { name: 'Gilet fluo', slot: 'corps', price: 60 },
  sac: { name: 'Sac à dos à outils', slot: 'dos', price: 70 },
  cape: { name: 'Cape', slot: 'dos', price: 90 },
  gants: { name: 'Gants', slot: 'mains', price: 35 },
};
export const ME_COLORS = ['#e23b3b', '#f7822a', '#f2c14e', '#3fb950', '#22c3b4', '#3a86f0', '#8a4be0', '#ff6fb1', '#f2f2f2', '#2a2a2a'];
// Couleur proposée au premier achat
export const ME_DEFAULT_COL = { casquette: 0, casque: 2, lunettes: 9, audio: 9, noeud: 0, echarpe: 6, tablier: 9, gilet: 1, sac: 3, cape: 6, gants: 2 };

// Couleurs et style de chaque métier : casquette, casque, tablier, gilet (+ bandes), nœud
export const LOOKS = {
  logistique: { casquette: '#2f6fe0', casque: '#2f6fe0', tablier: '#6b7380', gilet: '#ff8a1f', bande: '#2f6fe0', noeud: '#2f6fe0', style: 'gilet orange fluo à bandes bleues' },
  maintenance: { casquette: '#2fae55', casque: '#2fae55', tablier: '#7a4a25', gilet: '#2fae55', bande: '#f5c400', noeud: '#2fae55', style: 'casquette de mécano, tablier en cuir' },
  recherche: { casquette: '#7d7f45', casque: '#d8c08a', tablier: '#d8c08a', gilet: '#7d7f45', bande: '#22c3b4', noeud: '#22c3b4', style: 'tenue d’explorateur' },
  ingenieur: { casquette: '#8a4be0', casque: '#f2f2f2', tablier: '#f2f2f2', gilet: '#8a4be0', bande: '#f2f2f2', noeud: '#8a4be0', style: 'blouse blanche et violet' },
  chefmaint: { casquette: '#1f6f3e', casque: '#1f6f3e', tablier: '#2a2a2a', gilet: '#1f6f3e', bande: '#f5c400', noeud: '#f5c400', style: 'vert sombre et jaune' },
  expert: { casquette: '#1d2f7a', casque: '#1d2f7a', tablier: '#6b7380', gilet: '#e6ff2a', bande: '#1d2f7a', noeud: '#1d2f7a', style: 'gilet jaune fluo, bleu nuit' },
  qualite: { casquette: '#f5f5f5', casque: '#f5f5f5', tablier: '#f5f5f5', gilet: '#f5f5f5', bande: '#e23b3b', noeud: '#e23b3b', style: 'tout en blanc, liseré rouge' },
  adjq: { casquette: '#e2463f', casque: '#f5f5f5', tablier: '#cfd4da', gilet: '#e2463f', bande: '#f5f5f5', noeud: '#f5f5f5', style: 'rouge et blanc' },
  production: { casquette: '#ff7a1a', casque: '#ff7a1a', tablier: '#7a4a25', gilet: '#ff7a1a', bande: '#1a1a1a', noeud: '#1a1a1a', style: 'orange et noir' },
  process: { casquette: '#4b3fc4', casque: '#4b3fc4', tablier: '#f2f2f2', gilet: '#4b3fc4', bande: '#c0c7d0', noeud: '#c0c7d0', style: 'indigo et argent' },
  achat: { casquette: '#ff6fb1', casque: '#ff6fb1', tablier: '#f7c6dc', gilet: '#ff6fb1', bande: '#f5f5f5', noeud: '#ff6fb1', style: 'rose bonbon' },
  adjoint: { casquette: '#8d99a6', casque: '#8d99a6', tablier: '#5f6873', gilet: '#8d99a6', bande: '#1d2f7a', noeud: '#1d2f7a', style: 'gris acier et bleu marine' },
  chef: { casquette: '#e8b923', casque: '#e8b923', tablier: '#1a1a1a', gilet: '#1a1a1a', bande: '#e8b923', noeud: '#d42a2a', style: 'noir et or, nœud rouge' },
};
// Crédits : objectifs, niveaux, et en faisant tourner l'usine
export const CREDITS = { goal: 10, level: 30, droid: 2, ctrl: 1, repair: 3, heavy: 6, creature: 5 };

// Créatures du terrain vague (inventées) : capturées à deux, elles boostent une machine pour toujours.
export const ANIMALS = {
  rouillard: { name: 'Rouillard', desc: 'Boule de plaques rouillées sur six pattes fines, un grand œil ambré.', speed: 1.3, flee: 4.9 },
  vitrelle: { name: 'Vitrelle', desc: 'Corps de verre sur trois échasses, côtes de cuivre et cœur lumineux.', speed: 1.1, flee: 5.1 },
  pistoche: { name: 'Pistoche', desc: 'Long et bas, pattes à pistons, ailerons de tôle et queue en câble.', speed: 1.5, flee: 4.8 },
};
export const ANIMAL_COUNT = 6;

// ---------- 20 niveaux : une nouveauté, puis du rodage ----------
// c : [sorte, n] — sortes suivies d'un « + » : compté pendant le niveau seulement
export const LEVELS = [
  { name: 'À mains nues', goals: [
    { id: 'forge', text: 'Construire la forge' },
    { id: 'circuits', text: 'Construire l’atelier de circuits' },
    { id: 'core', text: 'Ramener à deux le cœur d’assembleur (épaves, au nord-est)' },
    { id: 'assembleur', text: 'Construire l’assembleur de droïdes' },
    { id: 'droid1', text: 'Produire le premier droïde' },
  ] },
  { name: 'Premières séries', rodage: true, goals: [
    { id: 'r2a', text: 'Produire 3 droïdes', c: ['made+', 3] },
    { id: 'r2b', text: 'Avoir 2 droïdes au travail', c: ['work', 2] },
    { id: 'r2c', text: 'Gagner 25 crédits', c: ['earn+', 25] },
  ] },
  { name: 'Premiers employés', goals: [
    { id: 'etabli', text: 'Construire l’établi des kits' },
    { id: 'atelier', text: 'Construire l’atelier de spécialisation' },
    { id: 'maintenance', text: 'Former un agent de maintenance (boîte à outils)' },
    { id: 'logistique', text: 'Former un agent logistique (scanner de stock)' },
  ] },
  { name: 'Terre cuite', goals: [
    { id: 'ceramique', text: 'Construire le four à céramique' },
    { id: 'r4a', text: 'Produire 4 isolants céramiques', c: ['item+', 4, 'isolant'] },
    { id: 'r4b', text: 'Installer une créature sur une machine', c: ['crea', 1] },
    { id: 'r4c', text: 'Réparer 2 pannes', c: ['rep+', 2] },
  ] },
  { name: 'Le courant', goals: [
    { id: 'generateur', text: 'Construire le générateur avant la fin de la batterie' },
    { id: 'fuel', text: 'Charger le générateur en charbon ou en bois' },
    { id: 'heavy', text: 'Réparer une panne lourde (à deux)' },
  ] },
  { name: 'Sous tension', rodage: true, goals: [
    { id: 'r6a', text: 'Former 2 droïdes spécialisés', c: ['spec+', 2] },
    { id: 'r6b', text: 'Avoir 4 droïdes au travail', c: ['work', 4] },
    { id: 'r6c', text: 'Gagner 35 crédits', c: ['earn+', 35] },
    { id: 'recherche', text: 'Former un agent de recherche (détecteur)' },
  ] },
  { name: 'Les bâtisseurs', goals: [
    { id: 'trefileuse', text: 'Construire la tréfileuse' },
    { id: 'r7a', text: 'Produire 4 fils de cuivre', c: ['item+', 4, 'fil'] },
    { id: 'recycleur', text: 'Construire le recycleur' },
    { id: 'ingenieur', text: 'Former un ingénieur (tablette de plans)' },
  ] },
  { name: 'Nouveaux circuits', rodage: true, goals: [
    { id: 'r8a', text: 'Produire 6 circuits', c: ['item+', 6, 'circuit'] },
    { id: 'r8b', text: 'Avoir 8 droïdes dans l’usine', c: ['droids', 8] },
    { id: 'r8c', text: 'Réparer 3 pannes', c: ['rep+', 3] },
    { id: 'r8d', text: 'Recycler 2 objets en trop (bouton Recettes du recycleur)', c: ['surplus+', 2] },
  ] },
  { name: 'Métallurgie', goals: [
    { id: 'fonderie', text: 'Construire la fonderie' },
    { id: 'laminoir', text: 'Construire le laminoir' },
    { id: 'r9a', text: 'Produire 4 tôles', c: ['item+', 4, 'tole'] },
    { id: 'chefmaint', text: 'Former un chef de la maintenance (valise d’expert)' },
  ] },
  { name: 'La cadence', rodage: true, goals: [
    { id: 'r10a', text: 'Former 2 droïdes spécialisés', c: ['spec+', 2] },
    { id: 'r10b', text: 'Avoir 6 droïdes au travail', c: ['work', 6] },
    { id: 'r10c', text: 'Gagner 45 crédits', c: ['earn+', 45] },
    { id: 'expert', text: 'Former un agent logistique expert (terminal logistique)' },
  ] },
  { name: 'Deux lignes', goals: [
    { id: 'forge2', text: 'Construire une deuxième forge' },
    { id: 'circuits2', text: 'Construire un deuxième atelier de circuits' },
    { id: 'r11a', text: 'Produire 6 carcasses', c: ['item+', 6, 'carcasse'] },
  ] },
  { name: 'La grande série', rodage: true, goals: [
    { id: 'r12a', text: 'Former 2 droïdes spécialisés', c: ['spec+', 2] },
    { id: 'r12b', text: 'Avoir 3 créatures installées', c: ['crea', 3] },
    { id: 'r12c', text: 'Réparer 4 pannes', c: ['rep+', 4] },
  ] },
  { name: 'Qualité', goals: [
    { id: 'qualite', text: 'Construire le poste de contrôle qualité' },
    { id: 'zone', text: 'Construire la zone des déclassés' },
    { id: 'r13a', text: 'Contrôler 6 pièces déclassées', c: ['ctrl+', 6] },
    { id: 'qualiteD', text: 'Former un responsable qualité' },
  ] },
  { name: 'Le tri', goals: [
    { id: 'r14a', text: 'Recycler 2 rebuts', c: ['recyc+', 2] },
    { id: 'r14b', text: 'Contrôler 6 pièces déclassées', c: ['ctrl+', 6] },
    { id: 'adjq', text: 'Former un adjoint qualité (chariot de tri)' },
  ] },
  { name: 'Zéro défaut', rodage: true, goals: [
    { id: 'r15a', text: 'Contrôler 12 pièces déclassées', c: ['ctrl+', 12] },
    { id: 'r15b', text: 'Avoir 10 droïdes au travail', c: ['work', 10] },
    { id: 'r15c', text: 'Gagner 60 crédits', c: ['earn+', 60] },
  ] },
  { name: 'Électronique', goals: [
    { id: 'four', text: 'Construire le four à verre' },
    { id: 'r16a', text: 'Produire un circuit avancé', c: ['item+', 1, 'circuitA'] },
    { id: 'production', text: 'Former un agent de production' },
    { id: 'process', text: 'Former un ingénieur process' },
  ] },
  { name: 'Haute technologie', rodage: true, goals: [
    { id: 'r17a', text: 'Former 2 droïdes spécialisés', c: ['spec+', 2] },
    { id: 'r17b', text: 'Avoir 4 créatures installées', c: ['crea', 4] },
    { id: 'r17c', text: 'Réparer 5 pannes', c: ['rep+', 5] },
  ] },
  { name: 'Expédition', goals: [
    { id: 'emballeuse', text: 'Construire l’emballeuse' },
    { id: 'quai', text: 'Construire le quai d’expédition' },
    { id: 'achat', text: 'Former un agent d’achat packaging' },
    { id: 'r18a', text: 'Livrer 3 commandes', c: ['orders+', 3] },
  ] },
  { name: 'Clients fidèles', rodage: true, goals: [
    { id: 'r19a', text: 'Livrer 4 commandes', c: ['orders+', 4] },
    { id: 'r19b', text: 'Avoir 12 droïdes au travail', c: ['work', 12] },
    { id: 'r19c', text: 'Gagner 150 crédits', c: ['earn+', 150] },
  ] },
  { name: 'La grande usine', goals: [
    { id: 'adjoint', text: 'Former un adjoint de production' },
    { id: 'chef', text: 'Former un chef de production' },
    { id: 'r20a', text: 'Avoir 15 droïdes dans l’usine', c: ['droids', 15] },
    { id: 'r20b', text: 'Livrer 5 commandes', c: ['orders+', 5] },
  ] },
];

export const other = (id) => (id === 'A' ? 'B' : 'A');

// ---------- recyclage des objets en trop ----------
// Matières premières contenues dans une unité d'objet, d'après sa recette de base (récursif)
export const RAW_CONTENT = {};
function rawOf(k) {
  if (RAW_CONTENT[k]) return RAW_CONTENT[k];
  if (ITEMS[k].kind === 'raw') return { [k]: 1 };
  const rid = Object.keys(RECIPES).find((id) => !RECIPES[id].any && RECIPES[id].out[k]);
  const out = {};
  if (rid) {
    const r = RECIPES[rid], per = r.out[k];
    for (const [ik, n] of Object.entries(r.in)) for (const [rk, v] of Object.entries(rawOf(ik))) out[rk] = (out[rk] || 0) + (v * n) / per;
  }
  return (RAW_CONTENT[k] = out);
}
// Ce qu'on peut cocher « en trop » au recycleur : pièces fabriquées (sauf colis et droïdes en caisse) et kits
export const RECYCLABLE = Object.keys(ITEMS).filter((k) => (ITEMS[k].kind === 'part' && !['colis', 'caisse'].includes(k)) || ITEMS[k].kind === 'kit');
for (const k of RECYCLABLE) rawOf(k);
