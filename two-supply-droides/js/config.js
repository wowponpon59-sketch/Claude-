// Two Supply — Droïdes (prototype 0.2)
// Repère : x vers l'est, z vers le sud, y vers le haut. Unité : mètre.

export const VERSION = '0.2';

export const WORLD = { half: 40 };
export const SLAB = { x0: -15, x1: 15, z0: -11, z1: 11 };

export const PLAYER_R = 0.4;
export const SPEED = 4.6;
export const CARRY_SPEED = 2.6;
export const REACH = 1.1;      // joueur → bord d'un objet
export const POST_R = 1.1;     // joueur → poste à deux
export const SAC_MAX = 10;

export const PLAYER_COLORS = {
  A: { rgb: [0.20, 0.50, 0.95], css: '#3a86f0', name: 'bleu' },
  B: { rgb: [0.97, 0.50, 0.16], css: '#f7822a', name: 'orange' },
};

export const ITEMS = {
  fer: { name: 'Fer', de: 'du fer', css: '#8d5a3c' },
  verre: { name: 'Verre', de: 'du verre', css: '#7fd3d6' },
  argile: { name: 'Argile', de: "de l'argile", css: '#b4643c' },
  calcaire: { name: 'Calcaire', de: 'du calcaire', css: '#ddd6c6' },
  eau: { name: 'Eau', de: "de l'eau", css: '#3b8fd6' },
  carcasse: { name: 'Carcasse', de: 'une carcasse métallique', css: '#9aa3ad' },
  circuit: { name: 'Circuit', de: 'un circuit de commande', css: '#3fae6a' },
};
export const RAW = ['fer', 'verre', 'argile', 'calcaire', 'eau'];
export const ITEM_ORDER = ['fer', 'verre', 'argile', 'calcaire', 'eau', 'carcasse', 'circuit'];

// Débris à fouiller
export const NODE_TYPES = {
  epave: { name: 'Épave rouillée', item: 'fer', qty: 6, r: 1.6 },
  ferraille: { name: 'Tas de ferraille', item: 'fer', qty: 4, r: 1.1 },
  vitres: { name: 'Vitres brisées', item: 'verre', qty: 4, r: 1.2 },
  argile: { name: 'Butte d’argile', item: 'argile', qty: 6, r: 1.3 },
  calcaire: { name: 'Blocs de calcaire', item: 'calcaire', qty: 5, r: 1.2 },
  citerne: { name: 'Citerne percée', item: 'eau', qty: 8, r: 1.1 },
};

export const T = {
  dig: 0.7,          // secondes par unité fouillée
  respawn: 70,       // un débris vidé se reforme
  repair: 3,
  assemble: 10,      // coups de visseuse pour monter une machine (voir SCREWS)
  spec: 6,
  pannes: [110, 190],
  animalBoost: 0.25,
  animalMax: 2,
  bumpBack: 90,
};
export const SCREWS = 10; // tours de vis pour monter une machine

// Machines : recette, coût de construction, taille
export const MACHINES = {
  forge: {
    name: 'Forge', w: 3.2, d: 2.4,
    recipe: { in: { fer: 2, eau: 1 }, out: 'carcasse', time: 8 },
    cost: { argile: 6, calcaire: 3, eau: 2, fer: 3 },
    desc: '2 fer + 1 eau → 1 carcasse métallique',
  },
  circuits: {
    name: 'Atelier de circuits', w: 3.2, d: 2.4,
    recipe: { in: { verre: 1, calcaire: 1 }, out: 'circuit', time: 8 },
    cost: { argile: 4, calcaire: 2, verre: 4, fer: 2 },
    desc: '1 verre + 1 calcaire (silicium) → 1 circuit de commande',
  },
  assembleur: {
    name: 'Assembleur de droïdes', w: 3.6, d: 2.8, core: true,
    recipe: { in: { carcasse: 1, circuit: 1 }, out: 'droide', time: 10 },
    cost: { fer: 4, verre: 2 },
    desc: '1 carcasse + 1 circuit → 1 droïde standard',
  },
  atelier: {
    name: 'Atelier de spécialisation', w: 3.4, d: 2.6,
    cost: { fer: 6, verre: 3, circuit: 2, carcasse: 2 },
    desc: 'Transforme un droïde standard en employé spécialisé',
  },
};

export const PLOTS = [
  { id: 'forge', type: 'forge', x: -8, z: -5, level: 1 },
  { id: 'circuits', type: 'circuits', x: 0, z: -7, level: 1 },
  { id: 'assembleur', type: 'assembleur', x: 8, z: -5, level: 1 },
  { id: 'atelier', type: 'atelier', x: -8, z: 5.5, level: 2 },
  { id: 'forge2', type: 'forge', x: -12, z: 0, level: 3 },
  { id: 'circuits2', type: 'circuits', x: 12, z: 0.5, level: 3 },
];

export const ENTREPOT = { x: 6, z: 6, w: 4.2, d: 1.8 };
export const START = { A: { x: -1, z: 2 }, B: { x: 1, z: 2.6 } };
export const CORE = { x: 29, z: -23, w: 1.8, d: 1.3, handle: 1.45 };

// Droïdes : de l'ouvrier au chef de production
export const DROIDS = {
  ouvrier: { name: 'Ouvrier', color: [0.95, 0.70, 0.15], css: '#f2b326', desc: 'Fait tourner une machine à la place d’un humain.' },
  logistique: {
    name: 'Agent logistique', color: [0.25, 0.60, 1.0], css: '#3f99ff', kit: 'Scanner de stock',
    cost: { circuit: 1, verre: 2 },
    desc: 'Approvisionne les machines depuis l’entrepôt et range la production.',
  },
  maintenance: {
    name: 'Agent de maintenance', color: [0.30, 0.85, 0.45], css: '#4cd975', kit: 'Boîte à outils',
    cost: { fer: 2, calcaire: 1 },
    desc: 'Repère et répare les pannes tout seul.',
  },
  ingenieur: {
    name: 'Ingénieur', color: [0.70, 0.40, 1.0], css: '#b366ff', kit: 'Tablette de plans',
    cost: { circuit: 2, verre: 1 },
    desc: 'Livre les matériaux et monte les nouvelles machines tout seul.',
  },
};
export const SPEC_ORDER = ['logistique', 'maintenance', 'ingenieur'];

// Organigramme complet (les postes « prévus » arrivent dans les versions suivantes)
export const ORG = [
  { id: 'ouvrier', name: 'Ouvrier', kit: 'Droïde standard', status: 'dispo' },
  { id: 'logistique', name: 'Agent logistique', kit: 'Scanner de stock : 1 circuit + 2 verre', status: 'dispo' },
  { id: 'maintenance', name: 'Agent de maintenance', kit: 'Boîte à outils : 2 fer + 1 calcaire', status: 'dispo' },
  { id: 'ingenieur', name: 'Ingénieur', kit: 'Tablette de plans : 2 circuits + 1 verre', status: 'dispo' },
  { id: 'production', name: 'Agent de production', kit: 'Bras multi-outils', status: 'prevu', desc: 'Fait tourner deux machines voisines.' },
  { id: 'achat', name: 'Agent d’achat packaging', kit: 'Terminal d’achat', status: 'prevu', desc: 'Commande cartons et emballages pour livrer les clients.' },
  { id: 'process', name: 'Ingénieur process', kit: 'Analyseur de flux', status: 'prevu', desc: 'Optimise la cadence de toute une ligne.' },
  { id: 'adjoint', name: 'Adjoint de production', kit: 'Planning de production', status: 'prevu', desc: 'Répartit les droïdes selon les besoins.' },
  { id: 'chef', name: 'Chef de production', kit: 'Poste de pilotage', status: 'prevu', desc: 'Dirige toute l’usine : objectifs, priorités, équipes.' },
];

// Créatures du terrain vague (inventées) : capturées à deux, elles boostent une machine pour toujours.
export const ANIMALS = {
  rouillard: { name: 'Rouillard', desc: 'Boule de plaques rouillées sur six pattes fines, un grand œil ambré.', speed: 1.3, flee: 4.9 },
  vitrelle: { name: 'Vitrelle', desc: 'Corps de verre sur trois échasses, côtes de cuivre et cœur lumineux.', speed: 1.1, flee: 5.1 },
  pistoche: { name: 'Pistoche', desc: 'Long et bas, pattes à pistons, ailerons de tôle et queue en câble.', speed: 1.5, flee: 4.8 },
};
export const ANIMAL_COUNT = 6;

export const LEVELS = [
  {
    name: 'À mains nues',
    goals: [
      { id: 'forge', text: 'Construire la forge' },
      { id: 'circuits', text: 'Construire l’atelier de circuits' },
      { id: 'core', text: 'Ramener à deux le cœur d’assembleur (épaves, à l’est)' },
      { id: 'assembleur', text: 'Construire l’assembleur de droïdes' },
      { id: 'droid1', text: 'Produire le premier droïde' },
    ],
  },
  {
    name: 'Premiers employés',
    goals: [
      { id: 'assign2', text: 'Affecter 2 droïdes ouvriers à des machines' },
      { id: 'animal', text: 'Capturer une créature à deux et l’installer sur une machine' },
      { id: 'atelier', text: 'Construire l’atelier de spécialisation' },
      { id: 'logistique', text: 'Former un agent logistique' },
      { id: 'maintenance', text: 'Former un agent de maintenance' },
    ],
  },
  {
    name: 'L’usine grandit',
    goals: [
      { id: 'ingenieur', text: 'Former un ingénieur' },
      { id: 'forge2', text: 'Construire une deuxième forge' },
      { id: 'circuits2', text: 'Construire un deuxième atelier de circuits' },
      { id: 'droids8', text: 'Avoir 8 droïdes dans l’usine' },
    ],
  },
];

export const other = (id) => (id === 'A' ? 'B' : 'A');
