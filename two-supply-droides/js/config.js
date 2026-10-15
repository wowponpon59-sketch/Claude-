// Two Supply — Droïdes (prototype 0.3)
// Repère : x vers l'est, z vers le sud, y vers le haut. Unité : mètre.

export const VERSION = '0.3';
export const SAVE_KEY = 'twosupply-droides-save-v03';

export const WORLD = { half: 40 };
export const SLAB = { x0: -22, x1: 22, z0: -15, z1: 16 };

export const PLAYER_R = 0.4;
export const SPEED = 4.6;
export const CARRY_SPEED = 2.6;
export const REACH = 1.1;      // joueur → bord d'un objet
export const POST_R = 1.1;     // joueur → poste à deux
export const SAC_MAX = 12;
export const LABEL_RANGE = 8;  // les infos ne s'affichent qu'à moins de 8 m
export const OUT_MAX = 4;      // sortie maximale d'une machine, par produit

export const PLAYER_COLORS = {
  A: { rgb: [0.20, 0.50, 0.95], css: '#3a86f0', name: 'bleu' },
  B: { rgb: [0.97, 0.50, 0.16], css: '#f7822a', name: 'orange' },
};

// ---------- objets ----------
// kind : raw (matière première), part (pièce fabriquée), kit (kit de spécialisation)
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
  fil: { name: 'Fil de cuivre', kind: 'part', css: '#f0902c' },
  lingot: { name: 'Lingot', kind: 'part', css: '#8796a8' },
  tole: { name: 'Tôle', kind: 'part', css: '#a9b7c7' },
  silicium: { name: 'Plaque de silicium', kind: 'part', css: '#7b6cf0' },
  circuitA: { name: 'Circuit avancé', kind: 'part', css: '#e6b422' },
  carcasseB: { name: 'Carcasse à contrôler', kind: 'part', css: '#b9c2cc', check: true },
  circuitB: { name: 'Circuit à contrôler', kind: 'part', css: '#36b36a', check: true },
  rebut: { name: 'Rebut', kind: 'part', css: '#8a8f96' },
  carton: { name: 'Carton', kind: 'part', css: '#c99a5b' },
  caisse: { name: 'Droïde en caisse', kind: 'part', css: '#d9a441' },
  colis: { name: 'Colis', kind: 'part', css: '#d9b27a' },

  k_scanner: { name: 'Scanner de stock', kind: 'kit', css: '#3f99ff', glyph: 'S' },
  k_outils: { name: 'Boîte à outils', kind: 'kit', css: '#e04a3a', glyph: 'O' },
  k_tablette: { name: 'Tablette de plans', kind: 'kit', css: '#b366ff', glyph: 'T' },
  k_detect: { name: 'Détecteur', kind: 'kit', css: '#22c3b4', glyph: 'D' },
  k_valise: { name: 'Valise d’expert', kind: 'kit', css: '#1f8f4e', glyph: 'V' },
  k_terminal: { name: 'Terminal logistique', kind: 'kit', css: '#2b4fd6', glyph: 'L' },
  k_lecteur: { name: 'Lecteur qualité', kind: 'kit', css: '#f2f2f2', glyph: 'Q' },
  k_bras: { name: 'Bras multi-outils', kind: 'kit', css: '#ff7a1a', glyph: 'B' },
  k_flux: { name: 'Analyseur de flux', kind: 'kit', css: '#5b4bd8', glyph: 'F' },
  k_achat: { name: 'Terminal d’achat', kind: 'kit', css: '#ff6fb1', glyph: 'A' },
  k_planning: { name: 'Planning de production', kind: 'kit', css: '#c7ced6', glyph: 'P' },
  k_pilotage: { name: 'Poste de pilotage', kind: 'kit', css: '#f2c14e', glyph: 'C' },
};
export const RAW = ['fer', 'verre', 'argile', 'calcaire', 'eau', 'cuivre', 'caoutchouc', 'sable', 'charbon', 'plastique', 'bois'];
export const ITEM_ORDER = Object.keys(ITEMS);
export const isRaw = (k) => ITEMS[k] && ITEMS[k].kind === 'raw';
// Niveau (index 0 = niveau 1) à partir duquel une matière est utile : sert à l'agent de recherche
export const RAW_LEVEL = { fer: 0, verre: 0, argile: 0, calcaire: 0, eau: 0, cuivre: 2, caoutchouc: 2, charbon: 3, bois: 3, plastique: 5, sable: 7 };

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
export const NODE_MIX = { epave: 6, ferraille: 6, vitres: 6, argile: 5, calcaire: 5, citerne: 4, cables: 6, pneus: 5, dune: 5, charbon: 6, bidons: 5, palettes: 5 };

export const T = {
  dig: 0.7,
  respawn: 70,
  repair: 3,
  heavyRepair: 5,
  spec: 6,
  panneStart: 120,      // premières pannes dès 2 minutes de jeu
  wear: [70, 130],      // secondes de fonctionnement avant une panne
  heavyFrom: 3,         // niveau 4 (index 3) : pannes lourdes
  animalBoost: 0.25,
  animalMax: 2,
  bumpBack: 90,
  battery: 150,         // batterie de secours au niveau 4 (secondes de marche)
  fuel: { charbon: 30, bois: 15 },
  defect: 0.2,
};
export const SCREWS = 10;

// ---------- recettes ----------
// lvl : niveau minimal (index), need : machine qui doit exister, until : disparaît quand cette machine existe
export const RECIPES = {
  carcasse: { name: 'Carcasse', in: { fer: 2, eau: 1 }, out: { carcasse: 1 }, time: 8, lvl: 0, until: 'laminoir', repl: 'carcasseT' },
  carcasseT: { name: 'Carcasse (tôle)', in: { tole: 2, eau: 1 }, out: { carcasse: 1 }, time: 6, lvl: 0, need: 'laminoir' },
  outils: { name: 'Boîte à outils', in: { fer: 2, calcaire: 1 }, out: { k_outils: 1 }, time: 6, lvl: 1 },
  valise: { name: 'Valise d’expert', in: { k_outils: 1, tole: 2, fil: 2 }, out: { k_valise: 1 }, time: 8, lvl: 4 },
  bras: { name: 'Bras multi-outils', in: { circuitA: 1, tole: 2 }, out: { k_bras: 1 }, time: 8, lvl: 7 },

  circuit: { name: 'Circuit', in: { verre: 1, calcaire: 1 }, out: { circuit: 1 }, time: 8, lvl: 0 },
  circuitA: { name: 'Circuit avancé', in: { silicium: 1, fil: 2, plastique: 1 }, out: { circuitA: 1 }, time: 9, lvl: 7 },
  scanner: { name: 'Scanner de stock', in: { circuit: 1, verre: 2 }, out: { k_scanner: 1 }, time: 6, lvl: 1 },
  detect: { name: 'Détecteur', in: { circuit: 1, fer: 2, verre: 1 }, out: { k_detect: 1 }, time: 6, lvl: 2 },
  tablette: { name: 'Tablette de plans', in: { circuit: 2, fil: 1 }, out: { k_tablette: 1 }, time: 6, lvl: 2 },
  terminal: { name: 'Terminal logistique', in: { circuit: 2, tole: 1, plastique: 1 }, out: { k_terminal: 1 }, time: 7, lvl: 5 },
  lecteur: { name: 'Lecteur qualité', in: { circuit: 1, plastique: 1, verre: 1 }, out: { k_lecteur: 1 }, time: 6, lvl: 6 },
  flux: { name: 'Analyseur de flux', in: { circuitA: 1, fil: 1, verre: 1 }, out: { k_flux: 1 }, time: 7, lvl: 7 },
  achatT: { name: 'Terminal d’achat', in: { circuit: 1, plastique: 2 }, out: { k_achat: 1 }, time: 6, lvl: 8 },
  planning: { name: 'Planning de production', in: { circuitA: 1, plastique: 2, fil: 1 }, out: { k_planning: 1 }, time: 7, lvl: 9 },
  pilotage: { name: 'Poste de pilotage', in: { circuitA: 2, tole: 2, verre: 1 }, out: { k_pilotage: 1 }, time: 8, lvl: 9 },

  droide: { name: 'Droïde standard', in: { carcasse: 1, circuit: 1 }, out: { droide: 1 }, time: 10, lvl: 0 },
  caisse: { name: 'Droïde à livrer (en caisse)', in: { carcasse: 1, circuit: 1, bois: 1 }, out: { caisse: 1 }, time: 10, lvl: 8 },

  fil: { name: 'Fil de cuivre', in: { cuivre: 1 }, out: { fil: 2 }, time: 5, lvl: 2 },
  lingot: { name: 'Lingot', in: { fer: 1, charbon: 1 }, out: { lingot: 1 }, time: 5, lvl: 4 },
  tole: { name: 'Tôle', in: { lingot: 1 }, out: { tole: 2 }, time: 5, lvl: 4 },
  ctrlC: { name: 'Contrôler les carcasses', in: { carcasseB: 1 }, out: { carcasse: 1 }, time: 3, lvl: 6, qc: true },
  ctrlK: { name: 'Contrôler les circuits', in: { circuitB: 1 }, out: { circuit: 1 }, time: 3, lvl: 6, qc: true },
  recyc: { name: 'Recycler un rebut', in: { rebut: 1 }, out: { fer: 1 }, time: 4, lvl: 6 },
  verreF: { name: 'Verre fondu', in: { sable: 2, charbon: 1 }, out: { verre: 2 }, time: 6, lvl: 7 },
  silicium: { name: 'Plaque de silicium', in: { sable: 1, calcaire: 1, charbon: 1 }, out: { silicium: 1 }, time: 7, lvl: 7 },
  carton: { name: 'Cartons', in: { bois: 1, plastique: 1 }, out: { carton: 2 }, time: 4, lvl: 8 },
  colis: { name: 'Colis (emballer un droïde)', in: { caisse: 1, carton: 1 }, out: { colis: 1 }, time: 5, lvl: 8 },
};
// Une fois le poste qualité construit, ces pièces sortent « à contrôler »
export const QC_MAP = { carcasse: 'carcasseB', circuit: 'circuitB' };

// ---------- machines ----------
export const MACHINES = {
  forge: { name: 'Forge', w: 3.2, d: 2.4, recipes: ['carcasse', 'carcasseT', 'outils', 'valise', 'bras'], cost: { argile: 6, calcaire: 3, eau: 2, fer: 3 }, desc: 'Carcasses et outils' },
  circuits: { name: 'Atelier de circuits', w: 3.2, d: 2.4, recipes: ['circuit', 'circuitA', 'scanner', 'detect', 'tablette', 'terminal', 'lecteur', 'flux', 'achatT', 'planning', 'pilotage'], cost: { argile: 4, calcaire: 2, verre: 4, fer: 2 }, desc: 'Circuits et kits électroniques' },
  assembleur: { name: 'Assembleur de droïdes', w: 3.6, d: 2.8, core: true, recipes: ['droide', 'caisse'], cost: { fer: 4, verre: 2 }, desc: 'Carcasse + circuit → droïde' },
  atelier: { name: 'Atelier de spécialisation', w: 3.4, d: 2.6, recipes: [], cost: { fer: 6, verre: 3, circuit: 2, carcasse: 2 }, desc: 'Droïde standard + kit → employé spécialisé' },
  trefileuse: { name: 'Tréfileuse', w: 2.8, d: 2.0, recipes: ['fil'], cost: { fer: 4, cuivre: 3, caoutchouc: 2 }, desc: 'Cuivre → fil de cuivre' },
  generateur: { name: 'Générateur', w: 2.8, d: 2.2, recipes: [], fuel: true, cost: { fer: 6, fil: 4, caoutchouc: 2, argile: 3 }, desc: 'Brûle charbon ou bois pour alimenter l’usine' },
  fonderie: { name: 'Fonderie', w: 3.0, d: 2.4, recipes: ['lingot'], cost: { argile: 8, calcaire: 4, fer: 4, charbon: 2 }, desc: 'Fer + charbon → lingot' },
  laminoir: { name: 'Laminoir', w: 3.4, d: 2.0, recipes: ['tole'], cost: { fer: 6, lingot: 3, caoutchouc: 2, fil: 2 }, desc: 'Lingot → tôles' },
  qualite: { name: 'Poste de contrôle qualité', w: 3.0, d: 2.2, recipes: ['ctrlC', 'ctrlK'], cost: { tole: 4, verre: 3, circuit: 2, plastique: 2 }, desc: 'Trie les pièces : bonnes ou rebuts' },
  recycleur: { name: 'Recycleur', w: 2.8, d: 2.2, recipes: ['recyc'], cost: { tole: 4, caoutchouc: 2, fil: 2 }, desc: 'Rebut → fer' },
  four: { name: 'Four à verre', w: 3.0, d: 2.4, recipes: ['verreF', 'silicium'], cost: { argile: 6, calcaire: 4, tole: 2, sable: 4 }, desc: 'Sable fondu : verre et silicium' },
  emballeuse: { name: 'Emballeuse', w: 3.2, d: 2.2, recipes: ['carton', 'colis'], cost: { tole: 4, bois: 4, plastique: 3, caoutchouc: 2 }, desc: 'Cartons et colis' },
  quai: { name: 'Quai d’expédition', w: 4.0, d: 2.2, recipes: [], cost: { bois: 6, tole: 2, fer: 4 }, desc: 'Livrez les colis aux clients' },
};

export const PLOTS = [
  { id: 'forge', type: 'forge', x: -17, z: -10, level: 1 },
  { id: 'circuits', type: 'circuits', x: -8.5, z: -10, level: 1 },
  { id: 'assembleur', type: 'assembleur', x: 0, z: -10, level: 1 },
  { id: 'atelier', type: 'atelier', x: 8.5, z: -10, level: 2 },
  { id: 'trefileuse', type: 'trefileuse', x: 17, z: -10, level: 3 },
  { id: 'generateur', type: 'generateur', x: -17, z: -1.5, level: 4 },
  { id: 'fonderie', type: 'fonderie', x: -8.5, z: -1.5, level: 5 },
  { id: 'laminoir', type: 'laminoir', x: 8.5, z: -1.5, level: 5 },
  { id: 'forge2', type: 'forge', x: 17, z: -1.5, level: 6 },
  { id: 'circuits2', type: 'circuits', x: -17, z: 7, level: 6 },
  { id: 'qualite', type: 'qualite', x: 0, z: 7, level: 7 },
  { id: 'recycleur', type: 'recycleur', x: 8.5, z: 7, level: 7 },
  { id: 'four', type: 'four', x: -8.5, z: 7, level: 8 },
  { id: 'emballeuse', type: 'emballeuse', x: 17, z: 7, level: 9 },
  { id: 'quai', type: 'quai', x: 17, z: 13, level: 9 },
];

export const ENTREPOT = { x: 0, z: -1.5, w: 4.2, d: 1.8 };
export const START = { A: { x: -1.2, z: 2.4 }, B: { x: 1.2, z: 2.8 } };
export const CORE = { x: 32, z: -27, w: 1.8, d: 1.3, handle: 1.45 };

// ---------- droïdes : de l'ouvrier au chef de production ----------
// work : 'machine' (affecté à une machine) ou 'hq' (mis au travail à l'entrepôt)
export const DROIDS = {
  ouvrier: { name: 'Ouvrier', color: [0.95, 0.70, 0.15], css: '#f2b326', work: 'machine', desc: 'Fait tourner une machine à la place d’un humain.' },
  logistique: { name: 'Agent logistique', color: [0.25, 0.60, 1.0], css: '#3f99ff', kit: 'k_scanner', lvl: 1, work: 'hq', desc: 'Apporte les matières premières aux machines et range la production à l’entrepôt.' },
  maintenance: { name: 'Agent de maintenance', color: [0.30, 0.85, 0.45], css: '#4cd975', kit: 'k_outils', lvl: 1, work: 'hq', desc: 'Répare tout seul les pannes légères.' },
  recherche: { name: 'Agent de recherche', color: [0.13, 0.76, 0.70], css: '#22c3b4', kit: 'k_detect', lvl: 2, work: 'hq', desc: 'Fouille le terrain vague et ramène à l’entrepôt la matière qui manque.' },
  ingenieur: { name: 'Ingénieur', color: [0.70, 0.40, 1.0], css: '#b366ff', kit: 'k_tablette', lvl: 2, work: 'hq', desc: 'Livre les matériaux et monte les nouvelles machines tout seul.' },
  chefmaint: { name: 'Chef de la maintenance', color: [0.12, 0.56, 0.31], css: '#1f8f4e', kit: 'k_valise', lvl: 4, work: 'hq', desc: 'Répare les pannes lourdes (et légères) tout seul.' },
  expert: { name: 'Agent logistique expert', color: [0.17, 0.31, 0.84], css: '#2b4fd6', kit: 'k_terminal', lvl: 5, work: 'hq', desc: 'Distribue les pièces fabriquées à la machine qui en aura besoin le plus tôt.' },
  qualite: { name: 'Agent qualité', color: [0.95, 0.95, 0.95], css: '#f2f2f2', kit: 'k_lecteur', lvl: 6, work: 'machine', only: 'qualite', desc: 'Fait tourner le poste qualité et divise les rebuts par deux.' },
  production: { name: 'Agent de production', color: [1.0, 0.48, 0.10], css: '#ff7a1a', kit: 'k_bras', lvl: 7, work: 'machine', desc: 'Fait tourner deux machines à la fois.' },
  process: { name: 'Ingénieur process', color: [0.36, 0.29, 0.85], css: '#5b4bd8', kit: 'k_flux', lvl: 7, work: 'hq', desc: 'Optimise les flux : +15 % de cadence sur toute l’usine.' },
  achat: { name: 'Agent d’achat packaging', color: [1.0, 0.44, 0.69], css: '#ff6fb1', kit: 'k_achat', lvl: 8, work: 'hq', desc: 'Commande les cartons : contre 1 plastique, il en livre 3 à l’emballeuse.' },
  adjoint: { name: 'Adjoint de production', color: [0.78, 0.81, 0.84], css: '#c7ced6', kit: 'k_planning', lvl: 9, work: 'hq', desc: 'Place tout seul les ouvriers libres sur les machines sans opérateur.' },
  chef: { name: 'Chef de production', color: [0.95, 0.76, 0.31], css: '#f2c14e', kit: 'k_pilotage', lvl: 9, work: 'hq', desc: 'Pilote l’usine : +25 % de cadence et lance les droïdes à livrer quand des commandes attendent.' },
};
export const SPEC_ORDER = ['logistique', 'maintenance', 'recherche', 'ingenieur', 'chefmaint', 'expert', 'qualite', 'production', 'process', 'achat', 'adjoint', 'chef'];

// Tenues achetées avec les crédits
export const OUTFITS = {
  casquette: { name: 'Casquette', price: 15 },
  casque: { name: 'Casque de chantier', price: 20 },
  tablier: { name: 'Tablier de cuir', price: 25 },
  gilet: { name: 'Gilet haute visibilité', price: 30 },
  noeud: { name: 'Nœud papillon', price: 40 },
  chrome: { name: 'Peinture chromée', price: 60 },
  or: { name: 'Peinture dorée', price: 100 },
};
export const CREDITS = { goal: 10, level: 30 };

// Créatures du terrain vague (inventées) : capturées à deux, elles boostent une machine pour toujours.
export const ANIMALS = {
  rouillard: { name: 'Rouillard', desc: 'Boule de plaques rouillées sur six pattes fines, un grand œil ambré.', speed: 1.3, flee: 4.9 },
  vitrelle: { name: 'Vitrelle', desc: 'Corps de verre sur trois échasses, côtes de cuivre et cœur lumineux.', speed: 1.1, flee: 5.1 },
  pistoche: { name: 'Pistoche', desc: 'Long et bas, pattes à pistons, ailerons de tôle et queue en câble.', speed: 1.5, flee: 4.8 },
};
export const ANIMAL_COUNT = 6;

export const LEVELS = [
  { name: 'À mains nues', goals: [
    { id: 'forge', text: 'Construire la forge' },
    { id: 'circuits', text: 'Construire l’atelier de circuits' },
    { id: 'core', text: 'Ramener à deux le cœur d’assembleur (épaves, au nord-est)' },
    { id: 'assembleur', text: 'Construire l’assembleur de droïdes' },
    { id: 'droid1', text: 'Produire le premier droïde' },
  ] },
  { name: 'Premiers employés', goals: [
    { id: 'assign2', text: 'Affecter 2 droïdes ouvriers à des machines' },
    { id: 'atelier', text: 'Construire l’atelier de spécialisation' },
    { id: 'maintenance', text: 'Former un agent de maintenance (boîte à outils : forge)' },
    { id: 'logistique', text: 'Former un agent logistique (scanner : atelier de circuits)' },
    { id: 'animal', text: 'Capturer une créature à deux et l’installer sur une machine' },
  ] },
  { name: 'Les éclaireurs', goals: [
    { id: 'recherche', text: 'Former un agent de recherche (détecteur)' },
    { id: 'trefileuse', text: 'Construire la tréfileuse' },
    { id: 'fil4', text: 'Produire 4 fils de cuivre' },
    { id: 'ingenieur', text: 'Former un ingénieur (tablette de plans)' },
  ] },
  { name: 'Le courant', goals: [
    { id: 'generateur', text: 'Construire le générateur avant la fin de la batterie' },
    { id: 'fuel', text: 'Alimenter le générateur en charbon ou en bois' },
    { id: 'heavy', text: 'Réparer une panne lourde (à deux)' },
    { id: 'droids6', text: 'Avoir 6 droïdes dans l’usine' },
  ] },
  { name: 'Métallurgie', goals: [
    { id: 'fonderie', text: 'Construire la fonderie' },
    { id: 'laminoir', text: 'Construire le laminoir' },
    { id: 'tole4', text: 'Produire 4 tôles' },
    { id: 'chefmaint', text: 'Former un chef de la maintenance (valise d’expert)' },
  ] },
  { name: 'Deux lignes', goals: [
    { id: 'forge2', text: 'Construire une deuxième forge' },
    { id: 'circuits2', text: 'Construire un deuxième atelier de circuits' },
    { id: 'expert', text: 'Former un agent logistique expert' },
    { id: 'made10', text: 'Produire 10 droïdes au total' },
  ] },
  { name: 'Qualité', goals: [
    { id: 'qualite', text: 'Construire le poste de contrôle qualité' },
    { id: 'ctrl6', text: 'Contrôler 6 pièces' },
    { id: 'recycleur', text: 'Construire le recycleur' },
    { id: 'recyc2', text: 'Recycler 2 rebuts' },
    { id: 'qualiteD', text: 'Former un agent qualité' },
  ] },
  { name: 'Électronique', goals: [
    { id: 'four', text: 'Construire le four à verre' },
    { id: 'silicium2', text: 'Produire 2 plaques de silicium' },
    { id: 'circuitA1', text: 'Produire un circuit avancé' },
    { id: 'production', text: 'Former un agent de production' },
    { id: 'process', text: 'Former un ingénieur process' },
  ] },
  { name: 'Expédition', goals: [
    { id: 'emballeuse', text: 'Construire l’emballeuse' },
    { id: 'quai', text: 'Construire le quai d’expédition' },
    { id: 'achat', text: 'Former un agent d’achat packaging' },
    { id: 'orders3', text: 'Livrer 3 commandes' },
  ] },
  { name: 'La grande usine', goals: [
    { id: 'adjoint', text: 'Former un adjoint de production' },
    { id: 'chef', text: 'Former un chef de production' },
    { id: 'droids15', text: 'Avoir 15 droïdes dans l’usine' },
    { id: 'orders8', text: 'Livrer 8 commandes au total' },
  ] },
];

export const other = (id) => (id === 'A' ? 'B' : 'A');
