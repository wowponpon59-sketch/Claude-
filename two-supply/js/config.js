// Two Supply — prototype 0.1
// Configuration du monde : positions, durées, recettes.
// Repère : x vers la droite, z vers le bas de l'écran, y vers le haut. Unité : mètre.

export const VERSION = '0.1';

export const WORLD = { minX: -12, maxX: 12, minZ: -8, maxZ: 8 };

export const PLAYER_R = 0.35;
export const SPEED = 4.2;
export const CARRY_SPEED = 2.3;
export const REACH = 0.75;   // distance max joueur → bord d'un objet
export const POST_R = 0.9;   // distance max joueur → poste (poignée, levier)

export const PLAYER_COLORS = {
  A: { rgb: [0.22, 0.52, 0.95], css: '#3a86f0', name: 'bleu' },
  B: { rgb: [0.97, 0.51, 0.17], css: '#f7822a', name: 'orange' },
};

export const ROLES = {
  inge: {
    name: 'Ingénieur',
    short: 'Ingé',
    pitch: 'Construit, visse et répare deux fois plus vite. Voit les plans de montage.',
  },
  chef: {
    name: 'Chef de production',
    short: 'Chef',
    pitch: 'Pétrit deux fois plus vite. Seul à connaître les recettes.',
  },
};

export const ITEMS = {
  ble: { name: 'blé', de: 'le blé' },
  eau: { name: 'eau', de: "l'eau" },
  sel: { name: 'sel', de: 'le sel' },
  farine: { name: 'farine', de: 'la farine' },
  pate: { name: 'pâte', de: 'la pâte' },
  pain: { name: 'pain', de: 'le pain' },
};

// Boîtes : centre (x, z), largeur w (axe x), profondeur d (axe z).
export const POS = {
  ble: { x: -9.5, z: -4.5, w: 1.6, d: 1.2 },
  puits: { x: -9.5, z: 1.5, w: 1.5, d: 1.5 },
  sel: { x: -9.5, z: 5.5, w: 1.6, d: 1.2 },
  moulin: { x: -4, z: -5.8, w: 1.8, d: 1.6 },
  petrin: { x: 0, z: -5.8, w: 1.8, d: 1.4 },
  tables: [
    { x: -5.0, z: 1.0, w: 1.2, d: 0.8 },
    { x: -1.5, z: 2.0, w: 1.2, d: 0.8 },
    { x: 2.2, z: 4.8, w: 1.2, d: 0.8 },
  ],
  poubelle: { x: -3.2, z: 6.6, w: 0.9, d: 0.9 },
  comptoir: { x: 10.6, z: -5.0, w: 1.4, d: 2.2 },
  four: { x: 5, z: -1.6, w: 2.4, d: 1.6 },
  postL: { x: 3.25, z: -1.6 },
  postR: { x: 6.75, z: -1.6 },
  front: { x: 5, z: -0.3 },
  crate0: { x: 9.4, z: 4.6 },
  crate: { w: 1.6, d: 1.2 },
  handle: 1.25,
  walls: [
    { x: -6.6, z: -5.5, w: 0.3, d: 5 },
    { x: -6.6, z: 5.5, w: 0.3, d: 5 },
  ],
  startA: { x: -3, z: 2.6 },
  startB: { x: -0.6, z: 3.6 },
};

export const T = {
  harvest: { ble: 0.8, eau: 0.6, sel: 0.6 },
  moulin: 3.0,
  bake: 4.0,
  leverWindow: 1.0,
  knead: { chef: 4, inge: 8 },
  screw: { inge: 6, chef: 12 },
  unjam: { inge: 1.2, chef: 3.5 },
  jamEvery: 3,
  orderLife: 120,
  orderEvery: 35,
  maxOrders: 3,
  goal: 5,
  placeDist: 0.9,
};

export const other = (id) => (id === 'A' ? 'B' : 'A');
