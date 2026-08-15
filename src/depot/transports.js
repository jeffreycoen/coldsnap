// COLDSNAP DEPOT — transports.js: THE HOLD (P7 T4, mk1.33). Boarding,
// riding, unloading, and the sealed-both-ways law: riders have no eyes and
// no rifles (every consumer skips b.riding), cannot be hurt (they ride
// pinned at y = -60, under every blast, past every round), and DIE WITH the
// vehicle. Squad->APC binding is by apcSeq — a small integer stamped at
// spawn — never a body id (ids do not survive a save). Pure functions,
// zero rng; DepotGame wires them.
import { applyDamage } from "../engine/core.js";
import { clearSlot } from "./squads.js";
import { APC } from "./specs.js";

const RIDE_Y = -60;
const BOARD_R = 2.5;        // m from the rally point — the formation has closed up // provisional (F5)
const HATCH_R = 14;         // m — the ramp drops when the boarders close to this // provisional (F5)
// STANDOFF (found running the boarding fixture, not guessed): clearSlot's
// SOLID_KINDS (squads.js) doesn't vet moving vehicle bodies — a march goal
// set to the hull's own center drives a formation straight INTO its box, and
// core.js's own CRUSH rule (:1734, "other.pos.y > victim.pos.y" with a real
// contact impulse) reads the resulting collision as a tank squashing its own
// boarding squad. The rally point sits outside the hull's footprint radius
// (hypot(v.hx, v.hz)) by this much — enough to clear the formation ring too
// (rifles/mg squads ring at 1.5m, squads.js slotFor) — so no member's slot
// can ever land inside the hull. // provisional (F5)
const STANDOFF = 2.2;

export function apcBySeq(world, seq) {
  for (const b of world.bodies) if (b.kind === "vehicle" && b.vtype === "apc" && b.apcSeq === seq && b.alive) return b;
  return null;
}
export function apcSeated(world, squads, seq) {
  let n = 0;
  for (const sq of squads) if (sq.ridingIn === seq)
    for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) n++; }
  return n;
}
export function stepTransports(world, squads) {
  for (const b of world.bodies) if (b.vtype === "apc") b._hatch = (world.t - (b._unloadT || -9) < 1.5) ? 1 : 0;
  for (const sq of squads) {
    if (sq.ridingIn != null) {
      const v = apcBySeq(world, sq.ridingIn);
      if (!v) {
        // the hull is gone: the hold goes with it — sealed both ways.
        for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          if (u && u.alive) { u.pinned = false; u.riding = false; applyDamage(world, u, 1e6, { cause: "CRUSH", attacker: "world" }); }
        }
        sq.ridingIn = null;
        continue;
      }
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (u && u.alive) { u.riding = true; u.pinned = true; u.pos.x = v.pos.x; u.pos.y = RIDE_Y; u.pos.z = v.pos.z; }
      }
      continue;
    }
    if (sq._boarding != null) {
      const v = apcBySeq(world, sq._boarding);
      if (!v) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; }
      // the rally point — outside the hull, on the squad's own approach
      // bearing (see STANDOFF above); the door still tracks the hull as it
      // parks or drives, since this is recomputed every tick.
      const adx = sq.anchor.x - v.pos.x, adz = sq.anchor.z - v.pos.z;
      const ad = Math.hypot(adx, adz) || 1;
      const rallyR = Math.hypot(v.hx, v.hz) + STANDOFF;
      const rally = { x: v.pos.x + (adx / ad) * rallyR, z: v.pos.z + (adz / ad) * rallyR };
      sq.order = "move"; sq.dest = { x: rally.x, z: rally.z };
      let live = 0, near = 0, nearest = 1e9;
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (!u || !u.alive) continue;
        live++;
        const d = Math.hypot(u.pos.x - rally.x, u.pos.z - rally.z);
        if (d < nearest) nearest = d;
        if (d < BOARD_R) near++;
      }
      if (nearest < HATCH_R) v._hatch = 1;
      const free = APC.seats - apcSeated(world, squads, v.apcSeq);
      if (live === 0 || live > free) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; }
      if (near === live) {
        sq.ridingIn = v.apcSeq; sq._boarding = null;
        sq.order = "ride"; sq.dest = null; sq._legTarget = null; sq._route = null; sq._routeDest = null; sq._build = null; sq._pauseT = 0;
        for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          // sealed into the hold on the SAME tick boarding completes — not
          // the next one (the already-riding branch above only runs once
          // sq.ridingIn is already set, one tick late for this cohort).
          if (u && u.alive) { u.riding = true; u.pinned = true; u.settled = false; u.goal = null; u.v.x = 0; u.v.y = 0; u.v.z = 0; u.pos.x = v.pos.x; u.pos.y = RIDE_Y; u.pos.z = v.pos.z; }
        }
      }
    }
  }
}
export function unloadApc(world, squads, v) {
  if (!v || v.vtype !== "apc") return;
  for (const sq of squads) {
    if (sq.ridingIn !== v.apcSeq) continue;
    sq.ridingIn = null;
    sq.order = "defend"; sq.dest = null; sq._legTarget = null;
    sq.anchor = { x: v.pos.x, z: v.pos.z };
    sq._surveyPending = true; sq._threatSig = undefined;
    let i = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (!u || !u.alive) continue;
      const a = (i++ / APC.seats) * Math.PI * 2;
      const p = clearSlot(world, v.pos.x + Math.sin(a) * 3.4, v.pos.z + Math.cos(a) * 3.4, (u.hx || 0.28) + 0.35);
      u.riding = false; u.pinned = false; u.sleeping = false;
      u.pos.x = p.x; u.pos.z = p.z; u.pos.y = world.field.heightAt(p.x, p.z) + 0.74;
      u.v.x = 0; u.v.y = 0; u.v.z = 0;
    }
  }
  v._unloadT = world.t;
}
