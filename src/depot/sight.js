// COLDSNAP DEPOT — sight.js: who sees what. Pure geometry, zero rng draws.
// A side's sight is the union of what its eyes see. An eye is a raised point
// on a living body; a spot is seen if a straight line from the eye to the
// spot (at man height) clears the terrain and every solid thing in between.
// Elevation is the whole trick: a higher eye's line passes over low cover.
import { solidBlocksPoint } from "./accuracy.js";

// How far each kind of eye sees (meters). Wider than any gun it guides —
// a gun must never out-range its own eyes. // all provisional (F5)
export const SIGHT = {
  unit: 24,        // any infantryman, either side
  sniper: 40,      // a marksman's scope (u.tag or u.role "sniper")
  spotter: 46,     // the binoculars — the pair's whole point (u.role)
  vehicle: 36,     // tank commander, above ENEMY_FIRE.tank.range 34
  tower: 32,       // tall — covers every tower gun's range
  flag: 36,        // the depot garrison, watching from the yard
};
// The eye sits above the body: a man's eyes, a tower's top, the banner.
export function eyeOf(b) {
  if (b.kind === "tower") return { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z, r: SIGHT.tower };
  if (b.kind === "flag")  return { x: b.pos.x, y: b.pos.y + 4.0, z: b.pos.z, r: SIGHT.flag };
  if (b.kind === "vehicle") return { x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z, r: SIGHT.vehicle };
  const r = b.role === "spotter" ? SIGHT.spotter
          : (b.role === "sniper" || b.tag === "sniper") ? SIGHT.sniper : SIGHT.unit;
  return { x: b.pos.x, y: b.pos.y + 0.5, z: b.pos.z, r };
}
// TARGET_H: a spot is "seen" at man height, not at the dirt — the same 1.2m
// convention the reach preview uses (accuracy.js TARGET_H).
export const SIGHT_TARGET_H = 1.2;
const STEP = 0.9; // sample spacing along the line — losGraze's own stride

// canSee: march the straight eye→spot line; terrain above the line blocks,
// a solid box on the line blocks (the eye's own body excluded via selfId).
export function canSee(world, eye, tx, tz, selfId) {
  const dx = tx - eye.x, dz = tz - eye.z;
  const d = Math.hypot(dx, dz);
  if (d > eye.r) return false;
  if (d < STEP) return true;                       // point-blank: no tested span
  const ty = world.field.heightAt(tx, tz) + SIGHT_TARGET_H;
  for (let s = STEP; s < d - STEP; s += STEP) {
    const t = s / d;
    const x = eye.x + dx * t, z = eye.z + dz * t, y = eye.y + (ty - eye.y) * t;
    if (world.field.heightAt(x, z) > y) return false;       // the ground rises into the line
    if (solidBlocksPoint(world, x, y, z, selfId)) return false; // something solid stands in it
  }
  return true;
}

// makeSight(T): two byte maps over the territory grid — seen1[i]=1 where
// team 1 sees cell i, seen2 likewise. Derived state: never saved, rebuilt
// on resume by the first recompute.
export function makeSight(T) {
  return { nx: T.nx, nz: T.nz, cs: T.cs, halfU: T.halfU, halfV: T.halfV,
           seen1: new Uint8Array(T.nx * T.nz), seen2: new Uint8Array(T.nx * T.nz) };
}
export function seenAt(SG, x, z, team) {
  const ix = Math.floor((x + SG.halfU) / SG.cs), iz = Math.floor((z + SG.halfV) / SG.cs);
  if (ix < 0 || ix >= SG.nx || iz < 0 || iz >= SG.nz) return false;
  return (team === 2 ? SG.seen2 : SG.seen1)[iz * SG.nx + ix] === 1;
}
// stepSight(world, SG, toUV, toWorld): full recompute. Deterministic —
// bodies iterate in world order; no dice. toUV/toWorld are DEPOT's own
// world↔canonical transforms (invW/fwdU), passed in like everywhere else.
export function stepSight(world, SG, toUV, toWorld) {
  SG.seen1.fill(0); SG.seen2.fill(0);
  // one eye per occupied cell per team — the tallest wins the cell
  const eyes1 = new Map(), eyes2 = new Map();
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const isEye = b.kind === "unit" || b.kind === "vehicle" || b.kind === "tower" || b.kind === "flag";
    if (!isEye || (b.team !== 1 && b.team !== 2)) continue;
    const e = eyeOf(b); e.selfId = b.id;
    const c = toUV(e.x, e.z);
    const key = Math.floor((c.u + SG.halfU) / SG.cs) + (Math.floor((c.v + SG.halfV) / SG.cs) * SG.nx);
    const m = b.team === 2 ? eyes2 : eyes1;
    const prev = m.get(key);
    if (!prev || e.y > prev.y) m.set(key, e);
  }
  const sweep = (eyes, seen) => {
    for (const e of eyes.values()) {
      const cellR = Math.ceil(e.r / SG.cs);
      const c = toUV(e.x, e.z);
      const cx = Math.floor((c.u + SG.halfU) / SG.cs), cz = Math.floor((c.v + SG.halfV) / SG.cs);
      for (let iz = Math.max(0, cz - cellR); iz <= Math.min(SG.nz - 1, cz + cellR); iz++) {
        for (let ix = Math.max(0, cx - cellR); ix <= Math.min(SG.nx - 1, cx + cellR); ix++) {
          const i = iz * SG.nx + ix;
          if (seen[i]) continue;                       // another eye already lit it
          const u = -SG.halfU + (ix + 0.5) * SG.cs, v = -SG.halfV + (iz + 0.5) * SG.cs;
          const w = toWorld(u, v);
          if (canSee(world, e, w.x, w.z, e.selfId)) seen[i] = 1;
        }
      }
    }
  };
  sweep(eyes1, SG.seen1);
  sweep(eyes2, SG.seen2);
}
