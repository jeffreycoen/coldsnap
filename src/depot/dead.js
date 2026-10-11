// COLDSNAP DEPOT — dead.js: THE DEAD (0.6.1), the third side. Bodies of
// kind "unit" on DEAD_TEAM with tag DEAD.tag. They hunt any living man
// within DEAD.sense meters, bite once a second at arm's reach, and fire
// nothing. A bite wounds and stamps the sickness (sickAt, the sim clock);
// DEAD.turnS later the body turns; a body bitten to death turns at once.
// No rng anywhere in this module: scans are nearest-first in world order,
// cadences are seq-staggered, the outbreak ring is fixed geometry through
// clearSlot. Zero draws, so the war's stream is untouched.
import { addBody, applyDamage } from "../engine/core.js";
import { DEAD, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";

export function spawnDead(world, x, z) {
  const p = clearSlot(world, x, z, DEAD.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: DEAD_TEAM, tag: DEAD.tag, mass: DEAD.mass, hx: DEAD.hx, hy: DEAD.hy, hz: DEAD.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + DEAD.hy + 0.02, hp: DEAD.hp, friction: 0.38 });
  u.maxHp = DEAD.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.wph = (u.seq * 1.7) % 6.28; // derived, not drawn
  return u;
}

// outbreakCenter: the town nearest the valley's middle — the town cluster
// first, a hamlet when the map drew no town, the nearest standing building
// last. Cluster rows are world coordinates (mapgen transforms them).
export function outbreakCenter(map) {
  const pick = (rows) => { let best = null, bd = Infinity; for (const r of rows) { const d = Math.hypot(r.x, r.z); if (d < bd) { bd = d; best = r; } } return best; };
  const town = pick(map.CLUSTERS.filter((c) => c.kind === "town"));
  if (town) return { x: town.x, z: town.z };
  const ham = pick(map.CLUSTERS.filter((c) => c.kind === "hamlet"));
  if (ham) return { x: ham.x, z: ham.z };
  const t = pick(map.TOWN.filter((b) => !b.depot && !b.marker && !b.dead));
  return t ? { x: t.x, z: t.z } : { x: 0, z: 0 };
}

// THE OUTBREAK: six at the middle town, a ring of seven meters, each
// pushed to clear ground by clearSlot.
export const OUTBREAK_N = 6, OUTBREAK_R = 7;
export function spawnOutbreak(world, map) {
  const c = outbreakCenter(map);
  const out = [];
  for (let i = 0; i < OUTBREAK_N; i++) {
    const a = (i / OUTBREAK_N) * Math.PI * 2;
    out.push(spawnDead(world, c.x + Math.sin(a) * OUTBREAK_R, c.z + Math.cos(a) * OUTBREAK_R));
  }
  return out;
}

// THE TURN: the same body, the third side. The gun goes (no utype, no
// role, no tag of an arm), the roster forgets him on its next prune
// (pruneSquads reads team), his pair is unpaired, and he stands with the
// dead's points.
export function turnDead(world, b) {
  if (b.pairId != null) { const p = world.byId.get(b.pairId); if (p) p.pairId = null; b.pairId = null; }
  b.team = DEAD_TEAM; b.tag = DEAD.tag;
  b.utype = undefined; b.role = undefined; b.squadId = undefined; b.dress = undefined;
  b.hold = false; b.garrison = false; b.settled = false; b.kneel = false; b._tending = false;
  b._fuse = null; b._standPt = null; b._slotGoal = null; b.goal = null; b.tgtId = null; b.targetId = null;
  b.bounty = 0; b.brave = true; b.sickAt = null; b._biteCd = 0;
  b.hp = DEAD.hp; b.maxHp = DEAD.hp; b.sleeping = false;
}

// THE BITE: 15 points and the stamp. A man with 15 or fewer left is bitten
// to death and turns at once — no kill event, no corpse, no stain.
export function biteBody(world, u, v) {
  if (!v.alive) return;
  if (v.hp <= DEAD.bite) { turnDead(world, v); return; }
  applyDamage(world, v, DEAD.bite, { cause: "BITE", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
  if (v.sickAt == null) v.sickAt = world.t;
}

// prey: a living man of any other side, not sealed in a hold.
const prey = (b) => b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && !b.riding && !b.pinned;

// stepDead: once per sim tick, every one of the dead. A held target is kept
// to 1.25x the sense; a fresh scan runs on a seq-staggered cadence. At arm's
// reach (both half-widths plus the pad) the body stops and bites on its
// cooldown; otherwise it seeks the target through squads.js's steer-around
// at DEAD.speed. Nothing in reach: it damps to a stand.
export function stepDead(world, dt) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
    u.scanCd = (u.scanCd || 0) - dt;
    let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
    if (tgt) { const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z; if (!prey(tgt) || dx * dx + dz * dz > keep2) tgt = null; }
    if (!tgt && u.scanCd <= 0) {
      u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let bd = R2;
      for (const b of world.bodies) {
        if (!prey(b)) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tgt = b; }
      }
    }
    u.tgtId = tgt ? tgt.id : null;
    if (!tgt) { u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt); continue; }
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z, d = Math.hypot(dx, dz);
    const reach = u.hx + tgt.hx + DEAD.reachPad;
    if (d <= reach) {
      u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
      if (u._biteCd <= 0) { u._biteCd = DEAD.biteCd; biteBody(world, u, tgt); }
      continue;
    }
    u.goal = { x: tgt.pos.x, z: tgt.pos.z };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}

// stepSick: every stamped living man whose ten seconds are up turns.
export function stepSick(world) {
  for (const b of world.bodies) {
    if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) continue;
    if (world.t - b.sickAt >= DEAD.turnS) turnDead(world, b);
  }
}
