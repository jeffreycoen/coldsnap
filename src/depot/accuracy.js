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
import { INFANTRY_ARMS } from "./specs.js";
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
// selfId (mirrors state.js's friendlyFouls Task 6 fix): without excluding
// the shooter's own body, the arc sampler's early points (s=0.9m from the
// muzzle) routinely land inside the shooter's own hx/hy/hz box — and a
// DEPRESSED (downslope) arc stays low and close to the muzzle for LONGER
// before climbing clear, so it self-blocks far more often than a level or
// uphill shot. That's why downslope aiming looked broken: arcClears was
// reporting "blocked" against the tower's own footprint, not any real
// terrain or obstruction. Pass the shooter's id to skip its own body while
// still catching every OTHER solid (rocks, other towers, walls, trees).
// Filter by KIND, not mobility (6.5 Task 1): a stone is an obstacle whether
// or not physics lets it move — sleeping masonry is the whole town, and
// town/depot chunks (mass 100/88/320) and trees (mass 260) are dynamic, so
// the old `invM > 0` skip made the chunk/tree SOLID_KINDS entries dead code.
// Units/vehicles stay excluded (dynamic AND not in SOLID_KINDS). Loose
// battlefield debris (shattered chunks) now also blocks aiming — correct
// physics (rubble is cover), and exposureAt already treated it as cover.
export function solidBlocksPoint(world, x, y, z, selfId) {
  for (const b of world.bodies) {
    if (!b.alive || (selfId != null && b.id === selfId)) continue;
    if (!SOLID_KINDS.has(b.kind)) continue;
    if (b.invM > 0 && b.kind !== "chunk" && b.kind !== "tree") continue; // dynamic non-masonry never blocks
    if (Math.abs(x - b.pos.x) <= b.hx && Math.abs(y - b.pos.y) <= b.hy && Math.abs(z - b.pos.z) <= b.hz) return true;
  }
  return false;
}

// Does the round's actual flight path clear the terrain? Samples the
// ballistic arc from muzzle to target (aimSolve pitch, projSpeed), comparing
// arc height vs ground+clearance at each step. Solids still use
// solidBlocksPoint at the ARC height (not the straight line).
//
// ARC_EPS derivation (replaces the old fixed +0.35m pad, which vetoed 94% of
// downslope shots that physically clear — diag-downslope*.mjs, 2026-08-10):
// arcClears is a PREDICTOR of the engine's projectile integrator, so it now
// samples exactly where the engine samples — at t = k*world.dt along the
// flight — using the integrator's own semi-implicit Euler height,
//   y(t) = y0 + vy0*t - (g/2)*t*(t+dt)
// (one dt lower than the analytic parabola: v is decremented before the
// position add). The engine grounds a round only when a step ENDPOINT dips
// to/below heightAt (core.js's terrain-hit check; the bisection afterwards
// only refines the impact point) — terrain between endpoints is physically
// invisible to the round, so cadence-matched sampling has ZERO sampling
// error and the old pad's insurance term (0.9m step x tan(0.52) slope cap
// / 2 ~ 0.26m of unseen inter-sample rise) vanishes with it. What remains
// is float slack between this closed form and the engine's accumulated
// sums: ~1e-6 over any in-range flight, rounded up generously.
// ARC_DT is the engine step (world.dt's fixed value, asserted at makeWorld).
// Wind (world.wind, flagged modes) is deliberately unmodeled here, exactly
// as it was under the pad: scatter + windComp own that error budget.
// Keystone proof: depot-test.mjs "SIGHTLINES keystone" fires real
// projectiles across the whole crest matrix and requires this predictor to
// match observed impacts in both directions, 325/325.
const ARC_EPS = 1e-4, ARC_DT = 1 / 120;
// Target body height above its ground (muzzle convention: 1.24m AGL —
// reachPolygon's TARGET_H plus the same head allowance squadFire's own
// muzzle formula uses). The final approach may descend below terrain+eps
// INTO this band while still above the raw ground: that is a round arriving
// on the target's body, not one eating the crest — the old pad faked this
// "target volume" by excluding the last 0.9m; now it is explicit.
const TARGET_BODY_H = 1.24;
// occlusion class per spec: "arc"    -> terrain checked along the true arc
//                                        (gun, mg, rifle, tank)
//                           "lofted" -> terrain ignored entirely (mortar,
//                                        rocket, gren lob); solids near the
//                                        MUZZLE (first 15% of flight) still
//                                        block lofted fire (you cannot mortar
//                                        out from under your own wall's
//                                        overhang)
// marchArc: the ONE flight march (6.5 Task 2). Walks the round's actual
// flight path — lofted specs walk only the steep climb-out cone (first 15%
// of flight, contract unchanged), "arc" specs walk engine-cadence samples
// (t = k*ARC_DT, the integrator's own Euler height; see the ARC_EPS
// derivation above) — calling hit(x, y, z) at every sample. First true
// aborts the march. Returns:
//   true  -> hit fired somewhere along the flight
//   false -> the whole tested span is hit-free (includes d < 2: point-blank
//            has no tested span)
//   null  -> no ballistic solution exists (aimSolve failed; there IS no
//            flight to march — callers decide what that means)
// arcClears passes terrain+solidBlocksPoint as hit; friendlyFouls
// (state.js) passes friendlyBlocksPoint. One flight model, two questions.
export function marchArc(world, muzzle, target, spec, hit) {
  if (spec.occl === "lofted") {
    const d = Math.hypot(target.x - muzzle.x, target.z - muzzle.z);
    for (let s = 0.9; s < d * 0.15; s += 0.9) {
      const t = s / d, x = muzzle.x + (target.x - muzzle.x) * t, z = muzzle.z + (target.z - muzzle.z) * t;
      if (hit(x, muzzle.y + s * 1.2, z)) return true;  // steep climb-out cone
    }
    return false;
  }
  const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
  const d = Math.hypot(dx, dz); if (d < 2) return false;
  const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
  if (pitch == null) return null;
  const vh = spec.projSpeed * Math.cos(pitch), vy0 = spec.projSpeed * Math.sin(pitch);
  for (let k = 1; ; k++) {
    const t = k * ARC_DT, s = vh * t;                  // engine-cadence sample (see ARC_EPS derivation)
    if (s >= d - 0.9) break;                           // last ~0.9m: the target point itself, assumed reachable
    const y = muzzle.y + vy0 * t - 4.9 * t * (t + ARC_DT); // integrator's own Euler height
    const x = muzzle.x + (dx / d) * s, z = muzzle.z + (dz / d) * s;
    if (hit(x, y, z)) return true;
  }
  return false;
}

export function arcClears(world, muzzle, target, spec, selfId) {
  const tgh = world.field.heightAt(target.x, target.z);
  const blocked = marchArc(world, muzzle, target, spec, (x, y, z) => {
    if (spec.occl !== "lofted") {                      // lofted flight ignores terrain entirely
      const h = world.field.heightAt(x, z);
      if (h + ARC_EPS > y &&                           // terrain pierces the arc…
          !(y > h && y <= tgh + TARGET_BODY_H))        // …unless it's the final descent onto the target's body
        return true;
    }
    return solidBlocksPoint(world, x, y, z, selfId);   // solid at arc height
  });
  return blocked === null ? false : !blocked;          // no solution -> not clear
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
export function reachPolygon(world, T, muzzle, spec, team, toUV = (x, z) => ({ u: x, v: z }), selfId) {
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
      if (!arcClears(world, muzzle, { x: qx, y: qy, z: qz }, spec, selfId)) break;
      if (T) { const c = toUV(px, pz); if (!fieldReaches(T, c.u, c.v, team)) break; } // fog boundary
      last = d;
    }
    pts.push({ x: muzzle.x + dx * last, z: muzzle.z + dz * last });
  }
  return pts;
}

// Selected-squad reach fan: the same polygon squadFire actually shoots by —
// muzzle at a live member's HEAD (pos.y + 0.5, squadFire's own formula), not
// the anchor's ground height (the old flat spec.range ring under-read every
// elevated sniper and ignored terrain entirely). First live member stands in
// for the squad (sniper squads are n=1; for others the members hold within a
// couple meters of each other). Null when nothing is alive.
export function squadReach(world, squad, T = null, toUV = (x, z) => ({ u: x, v: z })) {
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (!u || !u.alive) continue;
    const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
    return reachPolygon(world, T, muzzle, INFANTRY_ARMS[squad.type], squad.team, toUV, u.id);
  }
  return null;
}

// Inspected-tower reach fan (Task 2b): the same fan the placement preview
// draws, from the STANDING tower's real muzzle (pos.y + hy + 0.45 —
// towerShot's own formula, state.js:156). Static body => computed ONCE per
// selection: `cache` is a plain object owned by the caller, keyed on
// tower.id — repeated per-frame calls return the cached polygon; selecting a
// different tower recomputes. selfId threads the tower's own id so its own
// box never clips its own fan (the friendlyFouls fix's shape). Fog-independent
// (T null: what the gun COULD reach — the established preview rule; live fire
// stays fog-gated in stepTowers). `compute` is injectable for the test's
// call-count guard only.
export function towerReachCached(cache, world, tower, spec, toUV = (x, z) => ({ u: x, v: z }), compute = reachPolygon) {
  if (cache.id !== tower.id || !cache.pts) {
    const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
    cache.id = tower.id;
    cache.cx = tower.pos.x; cache.cz = tower.pos.z;
    cache.pts = compute(world, null, muzzle, spec, tower.team || 1, toUV, tower.id);
  }
  return cache.pts;
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
