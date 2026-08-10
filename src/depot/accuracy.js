// Conditional accuracy — the one scatter model every DEPOT shooter uses
// (towers now; riflemen/grenadiers in Phase 3/5; the bison in Phase 7).
// Pure: no state, rng only inside applyScatter (exactly two draws).
//
// reachPolygon (bottom of file) imports effRange/fieldReaches from state.js,
// which itself imports scatterSigma/applyScatter from here — a circular
// import, but a safe one: neither side calls the other's export at its own
// module top level, only from inside function bodies invoked well after both
// modules have finished evaluating. Kept in one place (state.js, per Task 3's
// brief) rather than duplicated.
import { effRange, fieldReaches } from "./state.js";
import { aimSolve } from "../engine/core.js";
const REF_RANGE = 16;          // acc is calibrated at this ground distance
const RANGE_K = 0.045;         // +4.5% sigma per meter beyond REF_RANGE
const ELEV_K = 0.06;           // per meter of height advantage (signed)
const ELEV_MIN = 0.72, ELEV_MAX = 1.8;   // clamp of the elevation multiplier
const GRAZE_K = 1.6;           // full graze multiplies sigma by 1+GRAZE_K
const GRAZE_MARGIN = 1.25;     // lane half-width (m) that counts as grazing
const GRAZE_STEP = 0.9;        // ray sample spacing (m)

// Same static-solid kind filter losGraze uses (rock/wall/tower/tree/chunk —
// "building chunk" in Task 3's brief is the shatterStructure/town debris
// kind, "chunk"). A plain point-in-AABB test — reachPolygon below marches a
// point outward and asks "am I inside something solid yet", which is a
// cheaper question than losGraze's segment-grazing one.
const SOLID_KINDS = new Set(["rock", "wall", "tower", "tree", "chunk"]);
export function solidBlocksPoint(world, x, y, z) {
  for (const b of world.bodies) {
    if (!b.alive || b.invM > 0) continue;
    if (!SOLID_KINDS.has(b.kind)) continue;
    if (Math.abs(x - b.pos.x) <= b.hx && Math.abs(y - b.pos.y) <= b.hy && Math.abs(z - b.pos.z) <= b.hz) return true;
  }
  return false;
}

// Does the round's actual flight path clear the terrain? Samples the
// ballistic arc from muzzle to target (aimSolve pitch, projSpeed), comparing
// arc height vs ground+clearance at each step. Solids still use
// solidBlocksPoint at the ARC height (not the straight line).
// occlusion class per spec: "arc"    -> terrain checked along the true arc
//                                        (gun, mg, rifle, tank)
//                           "lofted" -> terrain ignored entirely (mortar,
//                                        rocket, gren lob); solids near the
//                                        MUZZLE (first 15% of flight) still
//                                        block lofted fire (you cannot mortar
//                                        out from under your own wall's
//                                        overhang)
export function arcClears(world, muzzle, target, spec) {
  if (spec.occl === "lofted") {
    const d = Math.hypot(target.x - muzzle.x, target.z - muzzle.z);
    for (let s = 0.9; s < d * 0.15; s += 0.9) {
      const t = s / d, x = muzzle.x + (target.x - muzzle.x) * t, z = muzzle.z + (target.z - muzzle.z) * t;
      if (solidBlocksPoint(world, x, muzzle.y + s * 1.2, z)) return false; // steep climb-out cone
    }
    return true;
  }
  const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
  const d = Math.hypot(dx, dz); if (d < 2) return true;
  const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
  if (pitch == null) return false;
  const vh = spec.projSpeed * Math.cos(pitch), vy0 = spec.projSpeed * Math.sin(pitch);
  for (let s = 0.9; s < d - 0.9; s += 0.9) {
    const t = s / vh;                                  // time at horizontal distance s
    const y = muzzle.y + vy0 * t - 4.9 * t * t;        // arc height
    const x = muzzle.x + (dx / d) * s, z = muzzle.z + (dz / d) * s;
    if (world.field.heightAt(x, z) + 0.35 > y) return false;   // terrain pierces the arc
    if (solidBlocksPoint(world, x, y, z)) return false;         // solid at arc height
  }
  return true;
}

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

// ---------------------------------------------------------------- preview
// Placement-preview reach polygon (Task 3): 64 azimuth rays marched outward
// from `muzzle` (a firing point, {x,y,z} — same convention as effRange) to
// spec's elevation-scaled effRange, each ray stopping at the first of:
//   - terrain obstruction: the ground (+TARGET_H, an assumed 1.2m target
//     height) rises above the straight sightline from the muzzle to the
//     ray's own full-range endpoint (also assumed to sit at ground+TARGET_H
//     there) — a simple single-segment sightline, re-derived per ray, not a
//     multi-bounce visibility solve.
//   - a static solid (solidBlocksPoint, same kind filter as losGraze)
//   - the fog/targeting boundary (fieldReaches false for `team` at that
//     point) — only checked when a territory T is supplied; toUV converts
//     the marched WORLD (x, z) point to territory's CANONICAL (u, v), same
//     as every other T caller in this codebase (state.js's own doc comment).
// Recomputed on selection only (DepotGame.jsx), not per frame.
const REACH_N = 64, REACH_STEP = 0.9, TARGET_H = 1.2;
export function reachPolygon(world, T, muzzle, spec, team, toUV = (x, z) => ({ u: x, v: z })) {
  const effR = effRange(world, muzzle, spec);
  const pts = [];
  for (let i = 0; i < REACH_N; i++) {
    const az = (i / REACH_N) * Math.PI * 2;
    const dx = Math.cos(az), dz = Math.sin(az);
    let last = 0;
    for (let d = REACH_STEP; d <= effR; d += REACH_STEP) {
      const px = muzzle.x + dx * d, pz = muzzle.z + dz * d;
      // arcClears's own s-loop deliberately excludes the last ~0.9m before
      // its target (the target point itself isn't terrain-tested — it's
      // assumed reachable). Querying it with a target exactly AT d would
      // therefore let a solid/terrain feature sitting right at d slip
      // through untested. Query one step further out so d itself falls
      // inside arcClears's tested span, but only ever commit `last` to d.
      const qd = d + REACH_STEP, qx = muzzle.x + dx * qd, qz = muzzle.z + dz * qd;
      const qy = world.field.heightAt(qx, qz) + TARGET_H;
      // arcClears tests the round's true flight path — solids at arc height
      // for "arc" specs, muzzle climb-out only for "lofted" (see doc comment
      // on arcClears in this file). Do not ALSO straight-line test solids
      // here for "arc" specs — arcClears already covers them along the arc,
      // and double-testing would reject reachable ground the round clears.
      if (!arcClears(world, muzzle, { x: qx, y: qy, z: qz }, spec)) break;
      if (T) { const c = toUV(px, pz); if (!fieldReaches(T, c.u, c.v, team)) break; } // fog boundary
      last = d;
    }
    pts.push({ x: muzzle.x + dx * last, z: muzzle.z + dz * last });
  }
  return pts;
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
