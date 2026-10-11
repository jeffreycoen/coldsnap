// COLDSNAP DEPOT — people.js: THE PEOPLE (0.6.2; 0.6.4 indoors). Team 0
// unit bodies tagged PERSON.tag, two in every standing form with a door,
// three in a hangar or warehouse. They live INSIDE, just inside the door
// (pIn), and know the spot just outside it (pOut). Spooked — any of the
// dead within PERSON.fear meters, or a shot fired within PERSON.gunFear
// meters this tick — a person leaves by the door and runs away from the
// threat at a man's pace through squads.js's steer-around; PERSON.homeS
// quiet seconds later she walks back to the door and in. They fire
// nothing, see nothing, hold nothing. No rng anywhere: the spots are fixed
// geometry vetted by clearSlot, scans are seq-staggered.
import { addBody } from "../engine/core.js";
import { MASON, PERSON, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal, slotBlockedPublic } from "./squads.js";
import { faceTravel } from "./units.js";

export function peopleOf(world) {
  const out = [];
  for (const b of world.bodies) if (b.kind === "unit" && b.tag === PERSON.tag && b.alive) out.push(b);
  return out;
}

// spawnPerson(world, xIn, zIn, xOut, zOut): the body stands at the inside
// spot (vetted by clearSlot); the outside spot defaults to the inside one
// (a bare fixture with no door).
export function spawnPerson(world, xIn, zIn, xOut, zOut) {
  const p = clearSlot(world, xIn, zIn, PERSON.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: 0, tag: PERSON.tag, mass: PERSON.mass, hx: PERSON.hx, hy: PERSON.hy, hz: PERSON.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + PERSON.hy + 0.02, hp: PERSON.hp, friction: 0.5 });
  u.maxHp = PERSON.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.pIn = { x: p.x, z: p.z };                                            // home: just inside the door
  u.pOut = xOut != null ? { x: xOut, z: zOut } : { x: p.x, z: p.z };    // the step outside it
  u.fleeT = -1000;                                                       // the last fright, on the sim clock
  u.wph = (u.seq * 1.7) % 6.28;
  u.sleeping = true;
  return u;
}

// The door: buildTown carves it in the column ix = t.door (0 or nx - 1) at
// rows iz 1..2, so the opening is on an x face. Outside is 1.3 m past the
// wall plane; inside is 1.1 m within it (the first clear spot, else 2.0 m).
// The hangar has no door but a drive-through on its long axis; its people
// live just inside one end of it.
const IN_1 = 1.1, IN_2 = 2.0, OUT = 1.3;
function doorSpots(world, t) {
  const p = MASON.pitch;
  let wall, axis, side, cross;
  if (/^hangar/.test(t.id)) {
    const driveZ = t.nz >= t.nx;
    axis = driveZ ? "z" : "x"; side = 1;
    wall = axis === "z" ? t.z + ((t.nz - 1) / 2) * p : t.x + ((t.nx - 1) / 2) * p;
    cross = axis === "z" ? t.x : t.z;
  } else {
    axis = "x"; side = t.door === 0 ? -1 : 1;
    wall = t.x + side * ((t.nx - 1) / 2) * p;
    cross = t.z + (1.5 - (t.nz - 1) / 2) * p;
  }
  const at = (along) => (axis === "x" ? { x: along, z: cross } : { x: cross, z: along });
  const out = at(wall + side * OUT);
  let inn = at(wall - side * IN_1);
  if (slotBlockedPublic(world, inn.x, inn.z, PERSON.hx + 0.35)) inn = at(wall - side * IN_2);
  return { inn, out, axis };
}

export function spawnPeople(world, map) {
  const out = [];
  for (const t of map.TOWN) {
    if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
    const hangar = /^hangar/.test(t.id);
    if (!hangar && (t.door == null || t.door < 0)) continue;
    const n = hangar || /^warehouse/.test(t.id) ? 3 : 2;
    const d = doorSpots(world, t);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.6;
      // the spread runs across the door's axis — along the wall, inside
      const ix = d.axis === "x" ? d.inn.x : d.inn.x + off, iz = d.axis === "x" ? d.inn.z + off : d.inn.z;
      out.push(spawnPerson(world, ix, iz, d.out.x, d.out.z));
    }
  }
  return out;
}

// indoorsOf: is she in the house? Nearer her inside spot than the door is
// long, and not standing on the outside spot.
const doorLen = (u) => Math.hypot(u.pOut.x - u.pIn.x, u.pOut.z - u.pIn.z) + 0.3;
export function indoorsOf(u) {
  if (!u.pIn || !u.pOut) return false;
  const inD = Math.hypot(u.pIn.x - u.pos.x, u.pIn.z - u.pos.z), outD = Math.hypot(u.pOut.x - u.pos.x, u.pOut.z - u.pos.z);
  return inD < doorLen(u) && inD < outD; // nearer the inside spot than the outside one — one step past the door is out
}

// stepPeople: once per sim tick, after the guns have fired (this tick's
// muzzle events are on world.events). A fright stamps fleeT and sets the
// flight goal one fleeStep away from the threat; indoors, the first leg is
// the door. The run continues until a scan finds nothing; homeS quiet
// seconds later she walks to the door and in.
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
        u._fleeGoal = { x: g.x, z: g.z }; u._fleeing = true;
      } else if (u._fleeing && u.scanCd > 0.19) { u._fleeing = false; u._fleeGoal = null; u.goal = null; }
    }
    if (u._fleeing && u._fleeGoal) {
      // 0.6.4: out by the door first, then away
      u.goal = indoorsOf(u) ? { x: u.pOut.x, z: u.pOut.z } : { x: u._fleeGoal.x, z: u._fleeGoal.z };
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    if (u.pIn && world.t - (u.fleeT != null ? u.fleeT : -1e9) >= PERSON.homeS && Math.hypot(u.pIn.x - u.pos.x, u.pIn.z - u.pos.z) > 0.6) {
      // 0.6.4: home is by the door, then in
      const inD = Math.hypot(u.pIn.x - u.pos.x, u.pIn.z - u.pos.z);
      u.goal = inD > doorLen(u) ? { x: u.pOut.x, z: u.pOut.z } : { x: u.pIn.x, z: u.pIn.z }; // beyond the door's length, the door; inside it, in
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
  }
}
