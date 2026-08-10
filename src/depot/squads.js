// COLDSNAP DEPOT — squads.js: squad brains. Pure functions over world +
// squad state. Members are ordinary "unit" bodies (team param) so territory
// emitters/fog/combat see them for free — this module drives their goal
// points; the existing units.js march machinery (cell.dx/dz -> velocity,
// faceTravel) isn't reachable here (it's flow-field driven, private to
// units.js, and geared to team-2 grid marching). Instead each member gets a
// simple seek-to-point driver (steer velocity toward u.goal, same shape as
// units.js's own fallback "lost" march at the bottom of stepUnits) — cheap,
// deterministic, and independent of any flow grid so squads can path off it
// entirely (cover hops, formation slots) rather than only ever following the
// enemy flow field.
//
// No unseeded randomness anywhere in this module. The ONLY rng draw is in
// stepSquad's attack leg-pause dwell time (documented at the call site) —
// exactly one draw per attack leg, per the brief.

export const SQUAD_SPECS = {           // costs are scrap; members spawn as unit bodies (team param)
  sniper: { n: 1, cost: 30, label: "SNIPER" },
  rifles: { n: 4, cost: 20, label: "RIFLE SQUAD" },
  mg:     { n: 2, cost: 25, label: "MG TEAM" },
};

export function makeSquad(id, type, team, x, z) {
  return { id, type, team, order: "defend", dest: null, memberIds: [], anchor: { x, z } };
}

// ------------------------------------------------------------- exposure
// Same static-solid kind filter accuracy.js's SOLID_KINDS uses (rock/wall/
// tower/tree/chunk) — sandbags in this codebase are chunk-kind masonry (no
// separate "sandbag" body kind exists), so they fall out of "chunk" for
// free.
const SOLID_KINDS = new Set(["rock", "wall", "tower", "tree", "chunk"]);
const COVER_RADIUS = 2.2;      // m — solid must be within this of the man to count
const COVER_HALF_ARC = Math.PI / 3; // 60 degrees either side of threatBearing

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// exposure: 0 (fully covered) .. 1 (open ground). Samples nearby static
// solids (rock/wall/tower/chunk/tree, incl. sandbags) within 2.2m in the
// threat direction; a solid between the man and the threat bearing reduces
// exposure. threatBearing is the world-space direction (radians, atan2(dx,
// dz) convention — matches faceTravel/units.js) FROM the man TOWARD the
// threat; cover only counts when it sits between the man and that bearing
// (i.e. the solid's bearing FROM the man is within +-60 degrees of
// threatBearing, so it's actually interposed, not off to the side or behind
// him).
export function exposureAt(world, x, z, threatBearing) {
  let bestCoverWeight = 0;
  for (const b of world.bodies) {
    if (!b.alive || b.invM > 0) continue; // static solids only (invM>0 = dynamic)
    if (!SOLID_KINDS.has(b.kind)) continue;
    const dx = b.pos.x - x, dz = b.pos.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > COVER_RADIUS || dist < 1e-6) continue;
    const bearing = Math.atan2(dx, dz); // solid's bearing FROM the man
    const off = angleDiff(bearing, threatBearing);
    if (off > COVER_HALF_ARC) continue; // not between man and threat
    // closer + more centered on the threat bearing = stronger cover. Being
    // interposed at all does most of the work (arcW); distance inside the
    // 2.2m radius is a mild secondary bonus, not the dominant term — a man
    // tucked right up against a wall and one 1.5m off it should both read
    // as solidly covered, not "half exposed" just for standing a step back.
    const distW = 1 - dist / COVER_RADIUS;
    const arcW = 1 - off / COVER_HALF_ARC;
    const weight = arcW * (0.7 + 0.3 * distW);
    if (weight > bestCoverWeight) bestCoverWeight = weight;
  }
  return 1 - Math.min(1, bestCoverWeight);
}

// -------------------------------------------------------------- coverHop
// Next advance waypoint toward dest — the lowest-exposure cell within hop
// radius (6m) that strictly reduces distance-to-dest. Grid-sample 12
// candidates on a ring at HOP_R, biased toward dest (only candidates within
// +-90 degrees of the dest bearing are considered, since anything wider
// can't reduce distance-to-dest at this radius); falls back to a direct
// step toward dest when nothing qualifies. Deterministic, no rng.
const HOP_R = 6, HOP_CANDIDATES = 12;
export function coverHop(world, from, dest, threatBearing) {
  const ddx = dest.x - from.x, ddz = dest.z - from.z;
  const d0 = Math.hypot(ddx, ddz);
  if (d0 < 1e-6) return { x: from.x, z: from.z };
  const destBearing = Math.atan2(ddx, ddz);
  let best = null, bestExposure = Infinity;
  for (let i = 0; i < HOP_CANDIDATES; i++) {
    const az = (i / HOP_CANDIDATES) * Math.PI * 2;
    const cx = from.x + Math.sin(az) * HOP_R, cz = from.z + Math.cos(az) * HOP_R;
    const dNew = Math.hypot(dest.x - cx, dest.z - cz);
    if (dNew >= d0) continue; // must strictly reduce distance-to-dest
    if (angleDiff(az, destBearing) > Math.PI / 2) continue; // pointing away, skip
    const exp = exposureAt(world, cx, cz, threatBearing);
    if (exp < bestExposure - 1e-9 || (Math.abs(exp - bestExposure) <= 1e-9 && best && dNew < Math.hypot(dest.x - best.x, dest.z - best.z))) {
      bestExposure = exp; best = { x: cx, z: cz };
    }
  }
  if (best) return best;
  // fallback: direct step toward dest, capped at HOP_R
  const step = Math.min(HOP_R, d0);
  return { x: from.x + (ddx / d0) * step, z: from.z + (ddz / d0) * step };
}

// ---------------------------------------------------------------- helpers
const MOVE_SPEED = 3.2; // m/s — infantry march speed toward a goal point
function seekGoal(u, dt) {
  if (!u.goal) return;
  const dx = u.goal.x - u.pos.x, dz = u.goal.z - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.15) { u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt); return; }
  const sp = MOVE_SPEED;
  u.v.x += ((dx / d) * sp - u.v.x) * Math.min(1, 6 * dt);
  u.v.z += ((dz / d) * sp - u.v.z) * Math.min(1, 6 * dt);
}

function slotFor(squad, idx, n) {
  // formation slots around the anchor: a small ring, spread evenly.
  const az = (idx / Math.max(1, n)) * Math.PI * 2;
  const r = n <= 1 ? 0 : 2.4;
  return { x: squad.anchor.x + Math.sin(az) * r, z: squad.anchor.z + Math.cos(az) * r };
}

// Approach bearing used as threatBearing when the squad has no live enemy
// context wired in yet: bearing FROM member TOWARD squad.anchor's forward
// reference (dest if attacking, else world +z as a stable default).
function defaultThreatBearing(world, squad, from) {
  if (squad.dest) return Math.atan2(squad.dest.x - from.x, squad.dest.z - from.z);
  return 0;
}

// stepSquad(world, squad, dt): order machine.
//   defend: members hold formation around anchor, each man micro-seeks the
//           lowest-exposure spot within 3m of his slot (recompute on threat
//           change, not per frame — squad._threatSig tracks the bearing
//           bucket so a per-tick exposure re-scan doesn't churn every man's
//           goal every frame).
//   attack: squad advances dest-ward via coverHop legs; pauses 1.5-3s at
//           each cover leg (rng ONCE per leg draws the dwell time — the
//           brief's one draw per attack leg); on arrival order becomes
//           "defend" with anchor=dest.
const DEFEND_SLOT_R = 3;
const ARRIVE_TOL = 1.0;
export function stepSquad(world, squad, dt) {
  const members = squad.memberIds.map((id) => world.byId.get(id)).filter((u) => u && u.alive);
  if (!members.length) return;

  if (squad.order === "attack" && squad.dest) {
    const cx = squad.anchor.x, cz = squad.anchor.z;
    const dToDest = Math.hypot(squad.dest.x - cx, squad.dest.z - cz);
    if (dToDest <= ARRIVE_TOL) {
      squad.order = "defend";
      squad.anchor = { x: squad.dest.x, z: squad.dest.z };
      squad.dest = null;
      squad._legTarget = null;
      squad._pauseT = 0;
      squad._threatSig = undefined; // force a defend re-scan on arrival
    } else if (squad._pauseT > 0) {
      // dwelling at the current cover leg — no movement, no new rng draw.
      squad._pauseT -= dt;
      if (squad._pauseT <= 0) { squad._pauseT = 0; squad._legTarget = null; } // next tick picks a fresh hop
    } else {
      // moving leg: pick a cover-hop target if we don't have one yet (pure,
      // no rng), then advance the squad anchor toward it.
      if (!squad._legTarget) {
        const bearing = defaultThreatBearing(world, squad, { x: cx, z: cz });
        squad._legTarget = coverHop(world, { x: cx, z: cz }, squad.dest, bearing);
      }
      const lx = squad._legTarget.x - cx, lz = squad._legTarget.z - cz;
      const ld = Math.hypot(lx, lz);
      if (ld < 0.3) {
        // arrived at this leg's cover point: pause 1.5-3s before the next
        // hop. ONE rng draw here — exactly once per attack leg, per the brief.
        squad._pauseT = 1.5 + world.rng() * 1.5;
      } else {
        const step = Math.min(ld, MOVE_SPEED * dt);
        squad.anchor = { x: cx + (lx / ld) * step, z: cz + (lz / ld) * step };
      }
    }

    const n = members.length;
    members.forEach((u, i) => {
      const slot = slotFor(squad, i, n);
      u.goal = { x: slot.x, z: slot.z };
      seekGoal(u, dt);
    });
    return;
  }

  // defend: hold formation around anchor; each member micro-seeks the
  // lowest-exposure spot within DEFEND_SLOT_R of his slot. Recomputed on
  // threat-bearing change (bucketed to 1 of 8 sectors) rather than every
  // frame — matches units.js's own scanCd-style throttling pattern.
  const bearing = defaultThreatBearing(world, squad, squad.anchor);
  const sector = Math.round(bearing / (Math.PI / 4));
  if (squad._threatSig !== sector) {
    squad._threatSig = sector;
    const n = members.length;
    members.forEach((u, i) => {
      const slot = slotFor(squad, i, n);
      let best = slot, bestExp = exposureAt(world, slot.x, slot.z, bearing);
      for (let k = 0; k < 8; k++) {
        const az = (k / 8) * Math.PI * 2;
        const cx = slot.x + Math.sin(az) * DEFEND_SLOT_R, cz = slot.z + Math.cos(az) * DEFEND_SLOT_R;
        const exp = exposureAt(world, cx, cz, bearing);
        if (exp < bestExp - 1e-9) { bestExp = exp; best = { x: cx, z: cz }; }
      }
      u._slotGoal = best;
    });
  }
  members.forEach((u) => {
    u.goal = u._slotGoal || slotFor(squad, squad.memberIds.indexOf(u.id), members.length);
    seekGoal(u, dt);
  });
}
