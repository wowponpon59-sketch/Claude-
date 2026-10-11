// Déplacements et collisions, partagés par l'hôte et l'invité.
import { WORLD, POS, PLAYER_R } from './config.js';

const STATIC = [
  POS.ble, POS.puits, POS.sel, POS.moulin, POS.petrin,
  ...POS.tables, POS.poubelle, POS.comptoir, ...POS.walls,
];

export function obstacles(S) {
  const list = STATIC.slice();
  if (!S) return list;
  if (S.phase === 'crate') list.push({ x: S.crate.x, z: S.crate.z, w: POS.crate.w, d: POS.crate.d, crate: true });
  else list.push(POS.four);
  return list;
}

export function boxDist(p, b) {
  const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0);
  const dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
  return Math.hypot(dx, dz);
}

function clampWorld(x, z, r) {
  return [
    Math.min(WORLD.maxX - r, Math.max(WORLD.minX + r, x)),
    Math.min(WORLD.maxZ - r, Math.max(WORLD.minZ + r, z)),
  ];
}

// Déplace un cercle (joueur) et le repousse hors des boîtes.
export function moveCircle(x, z, dx, dz, obs, r = PLAYER_R) {
  let [nx, nz] = clampWorld(x + dx, z + dz, r);
  for (let iter = 0; iter < 3; iter++) {
    for (const b of obs) {
      const hx = b.w / 2, hz = b.d / 2;
      const cx = Math.min(b.x + hx, Math.max(b.x - hx, nx));
      const cz = Math.min(b.z + hz, Math.max(b.z - hz, nz));
      let ox = nx - cx, oz = nz - cz;
      const d = Math.hypot(ox, oz);
      if (d >= r) continue;
      if (d > 1e-6) {
        nx = cx + (ox / d) * r;
        nz = cz + (oz / d) * r;
      } else {
        // Centre à l'intérieur de la boîte : sortie par le côté le plus proche.
        const px = hx - Math.abs(nx - b.x), pz = hz - Math.abs(nz - b.z);
        if (px < pz) nx = b.x + Math.sign(nx - b.x || 1) * (hx + r);
        else nz = b.z + Math.sign(nz - b.z || 1) * (hz + r);
      }
    }
    [nx, nz] = clampWorld(nx, nz, r);
  }
  return [nx, nz];
}

function overlaps(x, z, w, d, b) {
  return Math.abs(x - b.x) < (w + b.w) / 2 && Math.abs(z - b.z) < (d + b.d) / 2;
}

// Déplace une boîte (la caisse portée à deux), axe par axe.
export function moveBox(x, z, dx, dz, w, d, obs) {
  const inside = (nx, nz) =>
    nx - w / 2 >= WORLD.minX && nx + w / 2 <= WORLD.maxX &&
    nz - d / 2 >= WORLD.minZ && nz + d / 2 <= WORLD.maxZ &&
    !obs.some((b) => overlaps(nx, nz, w, d, b));
  let nx = x, nz = z;
  if (inside(nx + dx, nz)) nx += dx;
  if (inside(nx, nz + dz)) nz += dz;
  return [nx, nz];
}
