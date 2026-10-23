// Déplacements et collisions (cercles et boîtes), partagés par l'hôte et l'invité.
import { WORLD, PLAYER_R, PLOTS, PART, TRUCK } from './config.js';
import { STATIC_OBS, plotBox } from './world.js';

export function obstacles(S) {
  const list = STATIC_OBS.slice();
  if (!S) return list;
  for (const p of PLOTS) {
    const st = S.plots[p.id];
    if (st && (st.built || st.ready)) list.push(plotBox(p));
  }
  // Pièces lourdes posées dans le terrain vague (celles des chantiers débloqués)
  if (S.parts) for (const p of PLOTS) {
    const c = S.parts[p.id];
    if (c && !c.placed && (p.level || 1) <= S.level + 1 && !(S.plots[p.id] && S.plots[p.id].built)) list.push({ x: c.x, z: c.z, w: PART.w, d: PART.d, core: true });
  }
  // Camion de livraison garé devant les ruines
  if (S.truck) { const along = Math.abs(S.truck.dx) > 0.5; list.push({ x: S.truck.x, z: S.truck.z, w: along ? TRUCK.w : TRUCK.d, d: along ? TRUCK.d : TRUCK.w }); }
  return list;
}

export function boxDist(p, b) {
  if (b.c) return Math.max(0, Math.hypot(p.x - b.x, p.z - b.z) - b.r);
  const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0);
  const dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
  return Math.hypot(dx, dz);
}

function clampWorld(x, z, r) {
  const m = WORLD.half - r - 0.5;
  return [Math.min(m, Math.max(-m, x)), Math.min(m, Math.max(-m, z))];
}

export function moveCircle(x, z, dx, dz, obs, r = PLAYER_R) {
  let [nx, nz] = clampWorld(x + dx, z + dz, r);
  for (let iter = 0; iter < 3; iter++) {
    for (const b of obs) {
      if (b.c) {
        const ox = nx - b.x, oz = nz - b.z, d = Math.hypot(ox, oz), min = b.r + r;
        if (d >= min) continue;
        if (d > 1e-6) { nx = b.x + (ox / d) * min; nz = b.z + (oz / d) * min; }
        else nx = b.x + min;
        continue;
      }
      const hx = b.w / 2, hz = b.d / 2;
      if (Math.abs(nx - b.x) > hx + r || Math.abs(nz - b.z) > hz + r) continue;
      const cx = Math.min(b.x + hx, Math.max(b.x - hx, nx));
      const cz = Math.min(b.z + hz, Math.max(b.z - hz, nz));
      const ox = nx - cx, oz = nz - cz, d = Math.hypot(ox, oz);
      if (d >= r) continue;
      if (d > 1e-6) { nx = cx + (ox / d) * r; nz = cz + (oz / d) * r; }
      else {
        const px = hx - Math.abs(nx - b.x), pz = hz - Math.abs(nz - b.z);
        if (px < pz) nx = b.x + Math.sign(nx - b.x || 1) * (hx + r);
        else nz = b.z + Math.sign(nz - b.z || 1) * (hz + r);
      }
    }
    [nx, nz] = clampWorld(nx, nz, r);
  }
  return [nx, nz];
}

function hitsBox(x, z, w, d, b) {
  if (b.c) {
    const cx = Math.min(x + w / 2, Math.max(x - w / 2, b.x));
    const cz = Math.min(z + d / 2, Math.max(z - d / 2, b.z));
    return Math.hypot(cx - b.x, cz - b.z) < b.r;
  }
  return Math.abs(x - b.x) < (w + b.w) / 2 && Math.abs(z - b.z) < (d + b.d) / 2;
}

// Déplace une boîte (la caisse portée à deux), axe par axe.
export function moveBox(x, z, dx, dz, w, d, obs) {
  const m = WORLD.half - 0.5;
  const ok = (nx, nz) => Math.abs(nx) + w / 2 < m && Math.abs(nz) + d / 2 < m && !obs.some((b) => hitsBox(nx, nz, w, d, b));
  let nx = x, nz = z;
  if (ok(nx + dx, nz)) nx += dx;
  if (ok(nx, nz + dz)) nz += dz;
  return [nx, nz];
}

// Avance vers une cible en contournant (pour droïdes, créatures et bot).
export function steer(ent, tx, tz, speed, dt, obs, r = 0.4) {
  const dx = tx - ent.x, dz = tz - ent.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  const step = Math.min(d, speed * dt);
  let ux = dx / d, uz = dz / d;
  if (ent.detour > 0) {
    ent.detour -= dt;
    const s = ent.side || 1;
    const vx = ux * 0.35 - uz * s, vz = uz * 0.35 + ux * s, l = Math.hypot(vx, vz);
    ux = vx / l; uz = vz / l;
  }
  const [nx, nz] = moveCircle(ent.x, ent.z, ux * step, uz * step, obs, r);
  const moved = Math.hypot(nx - ent.x, nz - ent.z);
  if (moved < step * 0.3 && !(ent.detour > 0)) { ent.detour = 0.7; ent.side = Math.random() < 0.5 ? 1 : -1; }
  ent.x = nx; ent.z = nz;
  if (moved > 1e-4) ent.rot = Math.atan2(ux, uz);
  return d;
}
