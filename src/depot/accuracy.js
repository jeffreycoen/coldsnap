// Conditional accuracy — the one scatter model every DEPOT shooter uses
// (towers now; riflemen/grenadiers in Phase 3/5; the bison in Phase 7).
// Pure: no state, rng only inside applyScatter (exactly two draws).
const REF_RANGE = 16;          // acc is calibrated at this ground distance
const RANGE_K = 0.045;         // +4.5% sigma per meter beyond REF_RANGE
const ELEV_K = 0.06;           // per meter of height advantage (signed)
const ELEV_MIN = 0.55, ELEV_MAX = 1.8;   // clamp of the elevation multiplier
const GRAZE_K = 1.6;           // full graze multiplies sigma by 1+GRAZE_K
const GRAZE_MARGIN = 1.25;     // lane half-width (m) that counts as grazing
const GRAZE_STEP = 0.9;        // ray sample spacing (m)

export function losGraze(world, muzzle, aim) {
  // Worst (closest) pass-by of the muzzle->aim segment against static solids.
  // Cheap: point samples vs expanded AABBs of rocks/walls/towers/trees/chunks.
  const dx = aim.x - muzzle.x, dy = aim.y - muzzle.y, dz = aim.z - muzzle.z;
  const len = Math.hypot(dx, dy, dz); if (len < 2) return 0;
  let worst = 0;
  for (const b of world.bodies) {
    if (!b.alive || b.invM > 0) continue;                    // static solids only
    if (b.kind !== "rock" && b.kind !== "wall" && b.kind !== "tower" && b.kind !== "tree" && b.kind !== "chunk") continue;
    // coarse reject: box vs segment AABB
    const r = Math.max(b.hx, b.hz) + GRAZE_MARGIN;
    for (let s = GRAZE_STEP; s < len - GRAZE_STEP; s += GRAZE_STEP) {
      const t = s / len, px = muzzle.x + dx * t, py = muzzle.y + dy * t, pz = muzzle.z + dz * t;
      const cx = Math.abs(px - b.pos.x) - b.hx, cy = Math.abs(py - b.pos.y) - b.hy, cz = Math.abs(pz - b.pos.z) - b.hz;
      const gap = Math.max(cx, cy, cz);                      // >0: outside by gap
      if (gap < 0) continue;                                 // inside = a real obstruction; the round eats it physically
      if (gap < GRAZE_MARGIN) worst = Math.max(worst, 1 - gap / GRAZE_MARGIN);
    }
  }
  return worst;
}

export function scatterSigma(world, muzzle, aim, spec) {
  const ground = Math.hypot(aim.x - muzzle.x, aim.z - muzzle.z);
  const range = 1 + RANGE_K * Math.max(0, ground - REF_RANGE);
  // shooter above target => aim.y - muzzle.y < 0 => tighter; firing uphill => wider
  const elev = Math.min(ELEV_MAX, Math.max(ELEV_MIN, 1 + ELEV_K * (aim.y - muzzle.y)));
  const graze = 1 + GRAZE_K * losGraze(world, muzzle, aim);
  return spec.acc * range * elev * graze;
}

export function applyScatter(world, dir, sigma) {
  // rotate dir by a random small angle around a random axis in its normal plane.
  // ALWAYS two draws (contract: stable draw count regardless of sigma).
  const a = world.rng() * Math.PI * 2;
  const m = Math.sqrt(-2 * Math.log(Math.max(1e-12, 1 - world.rng() * 0.9999))) * sigma * 0.6;
  if (m === 0) return { ...dir };
  // orthonormal basis around dir
  const up = Math.abs(dir.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = dir.z * up.y - dir.y * up.z, uy = dir.x * up.z - dir.z * up.x, uz = dir.y * up.x - dir.x * up.y;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = dir.y * uz - dir.z * uy, vy = dir.z * ux - dir.x * uz, vz = dir.x * uy - dir.y * ux;
  const ox = Math.cos(a) * m, oy = Math.sin(a) * m;
  const nx = dir.x + ux * ox + vx * oy, ny = dir.y + uy * ox + vy * oy, nz = dir.z + uz * ox + vz * oy;
  const nl = Math.hypot(nx, ny, nz);
  return { x: nx / nl, y: ny / nl, z: nz / nl };
}
