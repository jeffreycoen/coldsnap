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
  if (v.hp <= DEAD.bite) {
    if (v.riding && v.rideApc == null && u.rideApc != null) v.rideApc = u.rideApc; // 0.6.2: bitten to death in a hold — he keeps the seat
    turnDead(world, v);
    return;
  }
  applyDamage(world, v, DEAD.bite, { cause: "BITE", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
  if (v.sickAt == null) v.sickAt = world.t;
}

// prey: a living man of any other side, not sealed in a hold.
const prey = (b) => b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && !b.riding && !b.pinned;

// 0.6.3: THE SOUNDS — this tick's shots, bursts, and collapses as points
// with a reach. stepDepot gathers them at the end of its tick into
// run._sounds; the dead read them on the next. Never saved (a one-tick
// echo); zero draws.
export function gatherSounds(world) {
  const out = [];
  for (const e of world.events) {
    if (e.type === "muzzle") out.push({ x: e.x, z: e.z, r: DEAD.soundGun });
    else if (e.type === "boom" || e.type === "collapse") out.push({ x: e.x, z: e.z, r: DEAD.soundBlast });
  }
  return out;
}

// clawable: what the dead wear down when it stands in their way — wall
// courses, sandbags, towers, hulls, the mech's hull.
const clawable = (b) => b.alive && (b.kind === "wall" || b.kind === "tower" || b.kind === "vehicle" || b.kind === "mech" || (b.kind === "chunk" && b.sandbag));

// pressedAgainst: the body's box, grown by the dead's own half-width and
// the pad, holds the dead's feet.
function pressedAgainst(u, b) {
  return Math.abs(u.pos.x - b.pos.x) <= b.hx + u.hx + DEAD.clawPad && Math.abs(u.pos.z - b.pos.z) <= b.hz + u.hx + DEAD.clawPad;
}

// THE CLAW: with somewhere to go, every tick pressed against a clawable
// body takes DEAD.claw points a second off it. Cause BLAST so the hull's
// armor law does not blunt it (two points a second, armor or not);
// attacker "dead" pays and scores nobody. The pressed body is re-found on
// a quarter-second cadence and re-checked every tick.
function stepClaw(world, u, dt) {
  u._clawCd = (u._clawCd || 0) - dt;
  let b = u._clawId ? world.byId.get(u._clawId) : null;
  if (b && (!clawable(b) || !pressedAgainst(u, b))) b = null;
  if (!b && u._clawCd <= 0) {
    u._clawCd = 0.25;
    // 0.6.5: the short lists — courses, bags, and towers sit in statics, the
    // hulls in vehicles; the first hit of each, the earlier-born wins, so the
    // pick is the whole walk's pick. No lists: the whole walk.
    if (world._L) {
      let s = null, h = null;
      for (const c of world._L.statics) { if (clawable(c) && pressedAgainst(u, c)) { s = c; break; } }
      for (const c of world._L.vehicles) { if (clawable(c) && pressedAgainst(u, c)) { h = c; break; } }
      b = s && h ? (s.seq < h.seq ? s : h) : (s || h);
    } else for (const c of world.bodies) { if (clawable(c) && pressedAgainst(u, c)) { b = c; break; } }
  }
  u._clawId = b ? b.id : null;
  if (b) applyDamage(world, b, DEAD.claw * dt, { cause: "BLAST", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
}

// stepDead: once per sim tick, every one of the dead. A held target is kept
// to 1.25x the sense; a fresh scan runs on a seq-staggered cadence. At arm's
// reach (both half-widths plus the pad) the body stops and bites on its
// cooldown; otherwise it seeks the target through squads.js's steer-around
// at DEAD.speed. Nothing in reach: it damps to a stand.
export function stepDead(world, dt, run = null) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  const sounds = run && run._sounds ? run._sounds : null;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
    // 0.6.2: THE HOLD — one of the dead sealed in a hull bites every rider
    // with it on the bite cadence: the ferry's loose riders by their seat,
    // a squad's riders by its roster. It never walks; the hull drives on.
    if (u.rideApc != null) {
      if (u._biteCd > 0) continue;
      u._biteCd = DEAD.biteCd;
      for (const b of (world._L ? world._L.units : world.bodies)) if (b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && b.riding && b.rideApc === u.rideApc) biteBody(world, u, b); // 0.6.5: the short list
      if (run) for (const sq of [...(run.squads || []), ...(run.foeSquads || [])]) {
        if (sq.ridingIn !== u.rideApc) continue;
        for (const id of sq.memberIds) { const b = world.byId.get(id); if (b && b.alive && b.team !== DEAD_TEAM && b.riding) biteBody(world, u, b); }
      }
      continue;
    }
    u.scanCd = (u.scanCd || 0) - dt;
    let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
    if (tgt) { const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z; if (!prey(tgt) || dx * dx + dz * dz > keep2) tgt = null; }
    if (!tgt && u.scanCd <= 0) {
      u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let bd = R2;
      for (const b of (world._L ? world._L.units : world.bodies)) { // 0.6.5: the short list, world order, the same predicate
        if (!prey(b)) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tgt = b; }
      }
    }
    u.tgtId = tgt ? tgt.id : null;
    // 0.6.3: THE SOUNDS — with nothing living in reach, the nearest sound of
    // the last tick inside its own reach becomes the destination; a nearer
    // one later replaces it; arrival drops it. Prey always outranks it.
    if (tgt) u._soundGoal = null;
    else if (sounds && sounds.length) {
      let best = null, bd = Infinity;
      for (const s of sounds) {
        const dx = s.x - u.pos.x, dz = s.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 <= s.r * s.r && d2 < bd) { bd = d2; best = s; }
      }
      if (best && (!u._soundGoal || bd < (u._soundGoal.x - u.pos.x) ** 2 + (u._soundGoal.z - u.pos.z) ** 2)) u._soundGoal = { x: best.x, z: best.z };
    }
    if (!tgt && u._soundGoal && Math.hypot(u._soundGoal.x - u.pos.x, u._soundGoal.z - u.pos.z) <= DEAD.arriveM) u._soundGoal = null;
    if (!tgt && !u._soundGoal) { u._clawId = null; u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt); continue; }
    // somewhere to go: the claw works on whatever the body is pressed against
    stepClaw(world, u, dt);
    if (!tgt) {
      u.goal = { x: u._soundGoal.x, z: u._soundGoal.z };
      seekGoal(world, u, dt, DEAD.speed);
      faceTravel(u, dt);
      continue;
    }
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z, d = Math.hypot(dx, dz);
    const reach = u.hx + tgt.hx + DEAD.reachPad;
    if (d <= reach) {
      u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
      if (u._biteCd <= 0) { u._biteCd = DEAD.biteCd; biteBody(world, u, tgt); }
      continue;
    }
    // 0.6.4: a person indoors is reached by the door — her outside spot
    // first, while the dead is itself outside and not yet there; then in.
    let gx = tgt.pos.x, gz = tgt.pos.z;
    if (tgt.pIn && tgt.pOut) {
      const doorLen = Math.hypot(tgt.pOut.x - tgt.pIn.x, tgt.pOut.z - tgt.pIn.z) + 0.3;
      const herIn = Math.hypot(tgt.pIn.x - tgt.pos.x, tgt.pIn.z - tgt.pos.z) < doorLen;
      const meOut = Math.hypot(tgt.pIn.x - u.pos.x, tgt.pIn.z - u.pos.z) >= doorLen;
      const atDoor = Math.hypot(tgt.pOut.x - u.pos.x, tgt.pOut.z - u.pos.z) <= 1.2;
      if (herIn && meOut && !atDoor) { gx = tgt.pOut.x; gz = tgt.pOut.z; }
    }
    u.goal = { x: gx, z: gz };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}

// stepSick: every stamped living man whose ten seconds are up turns.
export function stepSick(world, run = null) {
  for (const b of world.bodies) {
    if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) continue;
    if (world.t - b.sickAt < DEAD.turnS) continue;
    // 0.6.2: a rider turns INSIDE the hold — his squad's seat number becomes
    // his own (the ferry's rideApc), so the hold keeps him and the unload
    // puts him out. The loose-rider loop in transports.js pins him there.
    if (b.riding && b.rideApc == null && run) {
      for (const sq of [...(run.squads || []), ...(run.foeSquads || [])]) if (sq.ridingIn != null && sq.memberIds.includes(b.id)) { b.rideApc = sq.ridingIn; break; }
    }
    turnDead(world, b);
  }
}
