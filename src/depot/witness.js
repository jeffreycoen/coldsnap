// COLDSNAP DEPOT — witness.js: the davy bench (0.6.8). Four measuring
// helpers the stopwatch, the debug hooks, the test, and the headless bench
// share. None of them draws from the rng; the burst itself runs the real
// path (fireProjectile -> stepProjectiles -> explode) and draws exactly what
// the enemy's own atomic round draws.
import { fireProjectile } from "../engine/core.js";
import { DAVY_FIRE } from "./specs.js";
import { spawnWallCourses } from "./state.js";

// fireDavyDown(world, field, x, z): one atomic round, fired straight down
// from one meter above the highest living body within two meters of the
// point (or above the ground when nothing stands there), with the spec
// shooterFire builds for the enemy's atomic crew. Returns the muzzle height.
export function fireDavyDown(world, field, x, z) {
  let top = field.heightAt(x, z);
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const dx = b.pos.x - x, dz = b.pos.z - z;
    if (dx * dx + dz * dz > 4) continue;
    const t = b.pos.y + b.hy; // the top face of a stone or slab at rest; a wide slab's long side would put the muzzle meters too high
    if (t > top) top = t;
  }
  const y = top + 1;
  fireProjectile(world, { x, y, z }, { x: 0, y: -1, z: 0 }, DAVY_FIRE.projSpeed, {
    kind: DAVY_FIRE.kind, r: DAVY_FIRE.blastR, kv: DAVY_FIRE.kv, dmg: DAVY_FIRE.dmg, crater: DAVY_FIRE.crater,
    weapon: DAVY_FIRE.weapon, noImpact: true, attacker: "enemy", windF: DAVY_FIRE.windF, hitStruct: true,
  });
  return y;
}

// fireDavyUp(world, field, x, z, s): the same round from the same muzzle,
// fired straight up at the speed that brings it back to the muzzle s seconds
// later (v = g s / 2; the engine's own wind drag drifts it a little), so the
// round is aloft long enough for the aloft watch (0.6.11) to do its work
// before the burst. Returns the muzzle height.
export function fireDavyUp(world, field, x, z, s) {
  let top = field.heightAt(x, z);
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const dx = b.pos.x - x, dz = b.pos.z - z;
    if (dx * dx + dz * dz > 4) continue;
    const t = b.pos.y + b.hy;
    if (t > top) top = t;
  }
  const y = top + 1;
  fireProjectile(world, { x, y, z }, { x: 0, y: 1, z: 0 }, world.gravity * s / 2, {
    kind: DAVY_FIRE.kind, r: DAVY_FIRE.blastR, kv: DAVY_FIRE.kv, dmg: DAVY_FIRE.dmg, crater: DAVY_FIRE.crater,
    weapon: DAVY_FIRE.weapon, noImpact: true, attacker: "enemy", windF: DAVY_FIRE.windF, hitStruct: true,
  });
  return y;
}

// countAwake(world): the bodies a step pays for — every body with mass that
// is not asleep — and the chunks among them.
export function countAwake(world) {
  let awake = 0, chunks = 0;
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    awake++;
    if (b.kind === "chunk") chunks++;
  }
  return { awake, chunks };
}

// activeWeldCount(world): the welds the solver sweeps — unbroken, not both
// ends asleep — read after the step.
export function activeWeldCount(world) {
  let n = 0;
  for (const w of world.welds) if (!w.broken && !(w.a.sleeping && w.b.sleeping)) n++;
  return n;
}

// ringOfWalls(world, field, x, z): sixteen player wall stacks (three courses
// each) on a ten-meter ring around the point, orientation alternating — the
// walls the atomic round kills in one tick, so the bench pays the road-map
// recompute the war pays when walls die. Returns the 48 courses.
export function ringOfWalls(world, field, x, z) {
  const out = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const wx = x + Math.cos(a) * 10, wz = z + Math.sin(a) * 10;
    out.push(...spawnWallCourses(world, wx, field.heightAt(wx, wz), wz, k % 2, 1));
  }
  return out;
}
