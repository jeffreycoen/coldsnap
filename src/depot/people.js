// COLDSNAP DEPOT — people.js: THE PEOPLE (0.6.2). Team 0 unit bodies
// tagged PERSON.tag, two at the door of every standing form with a door,
// three at a hangar or warehouse. They stand at their door; any of the dead
// within PERSON.fear meters, or a shot fired within PERSON.gunFear meters
// this tick, sends them running away from it at a man's pace through
// squads.js's steer-around; PERSON.homeS quiet seconds later they walk
// home. They fire nothing, see nothing, hold nothing. No rng anywhere:
// door spots are fixed geometry through clearSlot, scans are seq-staggered.
import { addBody } from "../engine/core.js";
import { MASON, PERSON, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";

export function peopleOf(world) {
  const out = [];
  for (const b of world.bodies) if (b.kind === "unit" && b.tag === PERSON.tag && b.alive) out.push(b);
  return out;
}

export function spawnPerson(world, x, z) {
  const p = clearSlot(world, x, z, PERSON.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: 0, tag: PERSON.tag, mass: PERSON.mass, hx: PERSON.hx, hy: PERSON.hy, hz: PERSON.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + PERSON.hy + 0.02, hp: PERSON.hp, friction: 0.5 });
  u.maxHp = PERSON.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.pdoor = { x: p.x, z: p.z }; // where she stands, and walks back to
  u.fleeT = -1000;              // the last fright, on the sim clock
  u.wph = (u.seq * 1.7) % 6.28;
  u.sleeping = true;
  return u;
}

// The door spot: just outside the doorway. buildTown carves the door in
// the column ix = t.door (0 or nx - 1) at rows iz 1..2, so the opening is
// on an x face and the outside is one step past that face. The hangar has
// no door but a drive-through on its long axis; its people stand at one
// end of it.
function doorSpot(t) {
  const p = MASON.pitch;
  if (/^hangar/.test(t.id)) {
    const driveZ = t.nz >= t.nx;
    return driveZ ? { x: t.x, z: t.z + ((t.nz - 1) / 2) * p + 1.3, along: "x" } : { x: t.x + ((t.nx - 1) / 2) * p + 1.3, z: t.z, along: "z" };
  }
  const side = t.door === 0 ? -1 : 1;
  return { x: t.x + side * (((t.nx - 1) / 2) * p + 1.3), z: t.z + (1.5 - (t.nz - 1) / 2) * p, along: "z" };
}

export function spawnPeople(world, map) {
  const out = [];
  for (const t of map.TOWN) {
    if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
    const hangar = /^hangar/.test(t.id);
    if (!hangar && (t.door == null || t.door < 0)) continue;
    const n = hangar || /^warehouse/.test(t.id) ? 3 : 2;
    const d = doorSpot(t);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.9;
      out.push(spawnPerson(world, d.along === "x" ? d.x + off : d.x, d.along === "z" ? d.z + off : d.z));
    }
  }
  return out;
}

// stepPeople: once per sim tick, after the guns have fired (this tick's
// muzzle events are on world.events). A fright sets the goal one fleeStep
// away from the threat and stamps fleeT; the run continues until a scan
// finds nothing; homeS quiet seconds later she walks back to her door.
export function stepPeople(world, map, dt) {
  let shots = null;
  for (const e of world.events) if (e.type === "muzzle") (shots || (shots = [])).push(e);
  const F2 = PERSON.fear * PERSON.fear, G2 = PERSON.gunFear * PERSON.gunFear;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.tag !== PERSON.tag || !u.alive || u.riding) continue;
    u.scanCd = (u.scanCd || 0) - dt;
    if (u.scanCd <= 0 || shots) {
      if (u.scanCd <= 0) u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let tx = null, tz = null, bd = F2;
      for (const b of world.bodies) {
        if (b.kind !== "unit" || b.team !== DEAD_TEAM || !b.alive || b.riding) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tx = b.pos.x; tz = b.pos.z; }
      }
      if (tx == null && shots) {
        let gd = G2;
        for (const e of shots) { const dx = e.x - u.pos.x, dz = e.z - u.pos.z, d2 = dx * dx + dz * dz; if (d2 < gd) { gd = d2; tx = e.x; tz = e.z; } }
      }
      if (tx != null) {
        u.fleeT = world.t;
        const dx = u.pos.x - tx, dz = u.pos.z - tz, d = Math.hypot(dx, dz) || 1;
        const g = map.clampToRim(u.pos.x + (dx / d) * PERSON.fleeStep, u.pos.z + (dz / d) * PERSON.fleeStep);
        u.goal = { x: g.x, z: g.z }; u._fleeing = true;
      } else if (u._fleeing && u.scanCd > 0.19) { u._fleeing = false; u.goal = null; }
    }
    if (u._fleeing && u.goal) { seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt); continue; }
    if (u.pdoor && world.t - (u.fleeT != null ? u.fleeT : -1e9) >= PERSON.homeS && Math.hypot(u.pdoor.x - u.pos.x, u.pdoor.z - u.pos.z) > 0.6) {
      u.goal = { x: u.pdoor.x, z: u.pdoor.z };
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
  }
}
