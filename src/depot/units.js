// COLDSNAP DEPOT — the roster returns. Unit behavior drivers ported from
// src/game/ColdsnapTD.jsx (READ-ONLY reference: rifle-halt fire :678-721,
// grenadier lob :723-754, sapper satchel :661-676, breaker ram :964-972,
// tank :597-615 + spec :836). Kept out of DepotGame.jsx (already ~1300
// lines) so the game loop just calls stepUnits + spawnUnit.
//
// Every aimed shot here goes through state.js's shooterFire — the same
// accuracy core towers use (scatterSigma/applyScatter, src/depot/accuracy.js)
// — at tower-equal acc/windF/windComp (Jeff's decision). Every random draw
// is world.rng() (mulberry32, seeded); an unseeded Math dot random() call is
// forbidden in src/depot (scripts/depot-lint.mjs).
import { addBody, applyDamage, explode } from "../engine/core.js";
import { shooterFire, fieldReaches, effRange, hostileStructure, standingStructure } from "./state.js";
import { arcClears } from "./accuracy.js";
// exposureAt + the pair's shared survey/direction solvers (6.5 Task 6: ONE
// behavior module, both signs). squads.js now imports accuracy/state for the
// stand-point scorer — the same documented-safe deferred cycle accuracy.js
// and state.js already share (no top-level cross calls).
import { exposureAt, surveyHighGround, bestStandPoint } from "./squads.js";
import { ENEMY_SPECS, ENEMY_FIRE, TANK, INFANTRY_ARMS, SATCHEL, SAPPER_PLANT_PAD } from "./specs.js";

// ---------------------------------------------------------------- spawning
export function spawnUnit(world, sp, tag) {
  if (tag === "tank") return spawnTank(world, sp);
  const spec = ENEMY_SPECS[tag] || ENEMY_SPECS[""];
  const x = sp.x + (world.rng() - 0.5) * 2.6, z = sp.z + (world.rng() - 0.5) * 2.6;
  const u = addBody(world, {
    kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
    x, z, y: world.field.heightAt(x, z) + spec.hy + 0.02, hp: spec.hp, friction: 0.38,
  });
  u.tag = tag || ""; u.bounty = spec.bounty;
  if (spec.dress) u.dress = spec.dress;
  // SMEARS ON (C0 T4, mk0.33): every enemy infantryman — conscript, runner,
  // breaker, grenadier, sapper, marksman — leaves a permanent red mark where
  // he dies. Set on the unit path only; spawnTank returns above, so armour
  // never smears (these are infantry marks). Render-only: the renderer's kill
  // handler reads it off the corpse, no sim path branches on it.
  u.smearStyle = "human";
  u.brave = true;
  if (tag === "gren") u.utype = "gren";
  u.wph = world.rng() * 6.28;
  // The pair (6.5 Task 6): a marksman buy fields TWO men. The spotter spawns
  // DRAW-FREE (fixed offset, derived walk phase) so fielding the pair adds
  // ZERO rng draws — a pairless run's stream is untouched, and the pairless-
  // identity contract holds trivially. Kill payout splits the 45 buy price:
  // 30 for the sniper, 15 for the spotter (sums to the price — symmetric
  // with the player's own 45-scrap pair).
  if (tag === "sniper") {
    u.role = "sniper"; u.bounty = 30;
    const s = addBody(world, {
      kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
      x: x + 1.1, z: z + 0.7, y: world.field.heightAt(x + 1.1, z + 0.7) + spec.hy + 0.02, hp: spec.hp, friction: 0.38,
    });
    s.tag = "sniper"; s.role = "spotter"; s.bounty = 15;
    if (spec.dress) s.dress = spec.dress;
    s.smearStyle = "human";                 // the spotter falls like any man
    s.brave = true;
    s.wph = u.wph + 1.7;                    // derived, not drawn
    s.pairId = u.id; u.pairId = s.id;
  }
  return u;
}

function spawnTank(world, sp) {
  const x = sp.x + (world.rng() - 0.5) * 2.4, z = sp.z + (world.rng() - 0.5) * 2.4;
  const t = addBody(world, {
    kind: "vehicle", team: 2, mass: TANK.mass, hx: TANK.hx, hy: TANK.hy, hz: TANK.hz,
    x, y: world.field.heightAt(x, z) + TANK.hy + 0.1, z, hp: TANK.hp, friction: 0.85,
  });
  t.armor = 140;
  t.tag = "tank";
  t.squad = "waveArmor"; // engine's stepDrive/aiDrive picks this up generically
  t.driverSpec = { throttleHabit: 0.8 };
  t.bounty = TANK.bounty;
  t.gunT = 2 + world.rng() * 2;
  return t;
}

// Player kill-bounty payment: any dead team-2 combatant with a bounty pays
// out once. Team 2 fields two kinds of dead bodies — conscript-class
// infantry (b.kind === "unit", spawnUnit above) and wave armor
// (b.kind === "vehicle", spawnTank above) — both carry a real b.bounty
// (ENEMY_SPECS[tag].bounty / TANK.bounty). Pushes a "tdkill" event per body,
// exactly once (b._paid guards re-payment on subsequent frames before the
// corpse is swept). Called from DepotGame.jsx's stepDepot.
export function payBounties(world) {
  for (const b of world.bodies) {
    if ((b.kind === "unit" || b.kind === "vehicle") && b.team === 2 && !b.alive && !b._paid && b.bounty) {
      b._paid = true;
      world.events.push({ type: "tdkill", bounty: b.bounty });
    }
  }
}

// ------------------------------------------------------------------ march
// fwdDir is DepotGame.jsx's orientation-aware flow-field-to-world direction
// helper (rotates by the map's ORIENT, one of DEPOT's 4 assault
// orientations) — passed in rather than reimplemented here so units.js
// can't drift from the module-local ORIENT state it depends on.
function faceTravel(u, dt) {
  const sp = Math.hypot(u.v.x, u.v.z);
  u.wph = (u.wph || 0) + sp * dt * 3.6;
  if (sp > 0.5) {
    const desired = Math.atan2(u.v.x, u.v.z);
    let err = desired - Math.atan2(u.R[6], u.R[8]);
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    u.w.y += err * 6 * dt;
    u.w.y *= 1 - Math.min(1, 4 * dt);
  }
}

// ------------------------------------------------------------ tank driver
// Wave armor: an engine vehicle on the engine's own tread physics
// (stepDrive/aiDrive, called generically from stepWorld). We only need to
// keep t.goal pointed down the flow field and pull the trigger on its gun.
function stepTank(world, grid, t, dt, fwdDir, T, toUV = (x, z) => ({ u: x, v: z })) {
  const cell = grid && grid.cellAt(t.pos.x, t.pos.z);
  if (cell && cell.dist < 1e8 && (cell.dx || cell.dz)) {
    const fd = fwdDir(cell.dx, cell.dz);
    t.goal = { x: t.pos.x + fd.x * 9, z: t.pos.z + fd.z * 9 };
    t.lostT = 0;
  } else {
    // off-grid write-off: same 12s window infantry uses (above). Without
    // this a tank that wanders off the flow field (grid gap, pushed off
    // the map by a collision, etc.) keeps driving forever — no leak radius
    // ever catches it, and it never dies. Mirrors the infantry lostT path.
    t.lostT = (t.lostT || 0) + dt;
    if (t.lostT > 12) applyDamage(world, t, 1e9, { attacker: "world" });
  }
  t.gunT = (t.gunT || 0) - dt;
  if (t.gunT > 0) return;
  const fspec = ENEMY_FIRE.tank;
  const muzzle = { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z };
  const eR = effRange(world, muzzle, fspec);
  let tgt = null, td = eR * eR;
  for (const s of world.bodies) {
    // FRONT F1 (4c): the shared hostile-structure set — behavior identical
    // to the old inline tower|wall filter except depot masonry joins it.
    if (!hostileStructure(s, 2)) continue;
    // NOTE: deliberately NO fieldReaches gate here (unlike stepRifleman/
    // stepGrenadier below, and unlike a tank's own unit-vs-unit case). A
    // tower's own emission (EMIT.tower, territory.js) keeps the ground right
    // around itself pinned "held" for team 1 for as long as it's alive — so
    // team 2's flipped read is permanently "unheld" at the tower's own
    // position, and the gate silently vetoes every acquisition attempt no
    // matter how close or how long a tank sits in range (found via
    // scripts/depot-test.mjs's tank-vs-tower fixture: field stayed "unheld"
    // for 60s of simulated siege with the tank parked on top of the tower).
    // TD's reference tank driver (ColdsnapTD.jsx :597-615) never had a
    // territory gate on structure fire at all — direct-fire counter-battery
    // range + line-of-sight (arcClears, right below) is the correct gate.
    const dx = s.pos.x - t.pos.x, dz = s.pos.z - t.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < td && arcClears(world, muzzle, s.pos, fspec, t.id)) { td = d2; tgt = s; }
  }
  if (!tgt) { t.gunT = 0.5; return; }
  t.gunT = fspec.cd + world.rng() * (fspec.cdVar || 0);
  // owner: t.id — without it the shell has no muzzle-clearing immunity
  // (core.js's owner-immunity gate, ~:698) against the tank's OWN hull.
  // The muzzle sits at t.pos.x/z (only offset in y), squarely inside the
  // tank's own 2.4m-deep hz box, and hitStruct:true is required below to
  // let the round hit the tower target at all — so without an owner id the
  // round detonates on its own hull on the very first tick, every time,
  // and never reaches the target. Found by scripts/depot-test.mjs's
  // tank-vs-tower fixture: a "boom" event landed ~2m from the muzzle,
  // still inside the tank's own footprint, tower hp never moved.
  shooterFire(world, t, muzzle, tgt, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });
}

// ---------------------------------------------------- anti-personnel pass
// A player soldier inside `urgency` of effective range is a more urgent
// target than any wall — IF our field reaches him (the unit-vs-unit law:
// fog gates men, never masonry). fieldReaches is read with the ATTACKER's
// sign (team 2); arcClears threads the shooter's own id (self-hit law).
function nearestPlayerUnit(world, u, muzzle, fspec, R2, urgency, T, toUV) {
  let best = null, bd = R2 * urgency * urgency; // (urgency*R)^2
  for (const s of world.bodies) {
    if (s.kind !== "unit" || !s.alive || s.team !== 1) continue;
    const c = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, c.u, c.v, 2)) continue; // attacker-sign fog gate
    const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd && arcClears(world, muzzle, s.pos, fspec, u.id)) { bd = d2; best = s; }
  }
  return best;
}

// Sticky-target revalidation for a UNIT target: alive, still team 1, still
// in range, still fog-reachable (units revalidate WITH the field gate every
// tick — structures deliberately without, see the notes below), LOS clear.
function unitTargetValid(world, u, muzzle, tgt, fspec, R2, T, toUV) {
  if (!tgt || !tgt.alive || tgt.kind !== "unit" || tgt.team !== 1) return false;
  const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
  if (dx * dx + dz * dz > R2) return false;
  const c = toUV(tgt.pos.x, tgt.pos.z);
  if (!fieldReaches(T, c.u, c.v, 2)) return false;
  return arcClears(world, muzzle, tgt.pos, fspec, u.id);
}

// The one new tunable Task 4 introduces: a player soldier inside 60% of
// effective range outranks any structure target (pinned on both sides of
// the boundary by depot-test.mjs's "4A priority" asserts).
const URGENCY = 0.6;

// ------------------------------------------------------- cover halt (4B)
// When engaging and TAKING FIRE, evaluate 5 candidate stand points: the
// current spot + 4 lateral offsets (±1.5m, ±3m perpendicular to the threat
// bearing); take the lowest exposureAt (threat bearing = toward tgt).
// Re-evaluated ONLY when u.lastHit changes identity (core.js's applyDamage
// stamps a fresh info object per hit), at most once per 2s (u._coverT).
// Deterministic, zero rng. u._standPt stays null when the current spot is
// already the best available — being shot at is not, by itself, a reason
// to leave good ground.
const COVER_OFFSETS = [1.5, -1.5, 3, -3];
function coverHaltUpdate(world, u, tgt) {
  if (!u.lastHit || u.lastHit === u._coverHit) return;
  if (world.t - (u._coverT != null ? u._coverT : -1e9) < 2) return;
  u._coverHit = u.lastHit;
  u._coverT = world.t;
  const bearing = Math.atan2(tgt.pos.x - u.pos.x, tgt.pos.z - u.pos.z);
  const px = Math.cos(bearing), pz = -Math.sin(bearing); // perpendicular to threat
  let best = null, bestExp = exposureAt(world, u.pos.x, u.pos.z, bearing);
  for (const off of COVER_OFFSETS) {
    const cx = u.pos.x + px * off, cz = u.pos.z + pz * off;
    const e = exposureAt(world, cx, cz, bearing);
    if (e < bestExp - 1e-9) { bestExp = e; best = { x: cx, z: cz }; }
  }
  u._standPt = best;
}

// Steer toward the chosen stand point — the same "close slowly while
// firing" velocity nudge shape, aimed at the stand point instead of the
// flow cell. Returns true when it drove the man this tick.
function seekStandPoint(world, u, sp, dt) {
  if (!u._standPt) return false;
  const dx = u._standPt.x - u.pos.x, dz = u._standPt.z - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.25) {
    // a halted body may have gone to SLEEP (engine skips integration and
    // re-zeros v below its wake threshold — a gentle accel from rest never
    // escapes it). Wake with a full-speed kick, then steer normally.
    if (u.sleeping) { u.sleeping = false; u.v.x = (dx / d) * sp; u.v.z = (dz / d) * sp; }
    u.v.x += ((dx / d) * sp - u.v.x) * Math.min(1, 4 * dt);
    u.v.z += ((dz / d) * sp - u.v.z) * Math.min(1, 4 * dt);
  } else {
    u.v.x *= 1 - Math.min(1, 6 * dt);
    u.v.z *= 1 - Math.min(1, 6 * dt);
  }
  faceTravel(u, dt);
  return true;
}

// ----------------------------------------------------- their sniper (4C)
// Fire spec = INFANTRY_ARMS.sniper verbatim — one table, both sides (spec
// pin asserted). blastR/kv merged in exactly like state.js's squadFire
// does (the INTERFACE GAP note there: INFANTRY_ARMS carries no blastR/kv
// and core.js's explode() NaNs without them); cd aliases fireRate so the
// rifleman fire path's cooldown code reads one field.
export const SNIPER_FIRE = { ...INFANTRY_ARMS.sniper, blastR: 0.3, kv: 0.5, cd: INFANTRY_ARMS.sniper.fireRate };

// VANTAGE (small documented heuristic): a marching sniper stops for good
// where (a) exposure toward the advance bearing < 0.35 — he is IN cover
// against what he is walking toward — and (b) his ground is no lower than
// the mean of 6 forward height samples on a ±45° arc at 8m (not shooting
// out of a hollow). Checked every tick while marching (cheap: one body
// scan); once true, u.hold latches permanently and he skips the march.
const VANTAGE_EXPOSURE = 0.35, VANTAGE_R = 8, VANTAGE_N = 6;
function atVantage(world, u, bearing) {
  if (exposureAt(world, u.pos.x, u.pos.z, bearing) >= VANTAGE_EXPOSURE) return false;
  let sum = 0;
  for (let k = 0; k < VANTAGE_N; k++) {
    const az = bearing + (k / (VANTAGE_N - 1) - 0.5) * (Math.PI / 2);
    sum += world.field.heightAt(u.pos.x + Math.sin(az) * VANTAGE_R, u.pos.z + Math.cos(az) * VANTAGE_R);
  }
  return world.field.heightAt(u.pos.x, u.pos.z) >= sum / VANTAGE_N;
}

// -------------------------------------------------------------- riflemen
// Everything but the grenadier and the sapper still carries a rifle and
// halts to work on a wall or emplacement rather than walk past it.
function stepRifleman(world, u, spec, cell, dt, fwdDir, T, toUV = (x, z) => ({ u: x, v: z })) {
  const sniper = u.tag === "sniper";
  const fspec = sniper ? SNIPER_FIRE : ENEMY_FIRE.rifle;
  u.fireCd = (u.fireCd || 0) - dt;
  u.scanCd = (u.scanCd || 0) - dt;
  const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
  // per-rescan (unlike towers' static positions, an infantryman's own effR
  // moves with it) — recomputed every scan tick below and reused for the
  // sticky-target validity check in between scans (u._effR).
  let R2 = (u._effR != null ? u._effR : fspec.range) ** 2;
  let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
  if (tgt && tgt.kind === "unit") {
    // sticky UNIT target: revalidate WITH the fog gate each tick (unit-vs-
    // unit law) — structures below stay field-free, as today.
    if (!unitTargetValid(world, u, muzzle, tgt, fspec, R2, T, toUV)) tgt = null;
  } else if (tgt) {
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
    // NOTE: deliberately NO fieldReaches gate on structure fire here (see
    // stepTank's comment above, and the identical fix there) — a wall or
    // tower's own territory emission keeps the ground around itself pinned
    // "held" for team 1 for as long as it's alive, so team 2's flipped read
    // never leaves "unheld" no matter how close or how long the rifleman
    // sits in range. Direct-fire range + arcClears LOS is the correct gate
    // for structure fire, not ground control. Unit-vs-unit targeting is
    // unaffected and correctly keeps its own field gate (see below).
    if (!hostileStructure(tgt, 2) || dx * dx + dz * dz > R2 || !arcClears(world, muzzle, tgt.pos, fspec, u.id)) tgt = null;
  }
  if (!tgt && u.scanCd <= 0) {
    // seq, not id: b.id is a module-global counter (differs across worlds
    // in one process), b.seq is world-local — the scan-phase stagger must
    // key off seq or a same-seed twin run desyncs its rescan ticks (found
    // by Task 4A's twin-determinism assert once units began re-scanning
    // mid-fight for unit targets).
    u.scanCd = 0.13 + (u.seq % 8) * 0.012;
    u._effR = effRange(world, muzzle, fspec);
    R2 = u._effR * u._effR;
    let td = R2;
    for (const s of world.bodies) {
      // FRONT F1 (4c): shared hostile-structure set — identical to the old
      // inline tower|wall filter except depot masonry joins it.
      if (!hostileStructure(s, 2)) continue;
      const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < td && arcClears(world, muzzle, s.pos, fspec, u.id)) { td = d2; tgt = s; }
    }
    // anti-personnel: a member inside the urgency radius outranks any wall.
    // The sniper has NO urgency radius — full effRange, prefer units always.
    const man = nearestPlayerUnit(world, u, muzzle, fspec, R2, sniper ? 1 : URGENCY, T, toUV);
    if (man) tgt = man;
  }
  u.tgtId = tgt ? tgt.id : null;
  if (tgt) {
    if (u.fireCd <= 0) {
      u.fireCd = (sniper ? fspec.cd : u.tag === "heavy" ? 1.1 : 1.5) + world.rng() * 0.5;
      u.flashT = world.t;
      // unit target: NO hitOnly — the round hits whatever it physically
      // hits (law of the world). Structure target: hitOnly kept. Both carry
      // owner: u.id (self-hit law — uniform muzzle-clearing immunity).
      shooterFire(world, u, muzzle, tgt, fspec, tgt.kind === "unit"
        ? { attacker: "enemy", owner: u.id }
        : { attacker: "enemy", hitStruct: true, hitOnly: "structure", owner: u.id });
    }
    // a held sniper works his vantage: no closing, no cover hop — he is
    // already on chosen ground (movement handled below, target or not)
    if (!u.hold)
    // close slowly while firing rather than standing still — unless taking
    // fire drove him to a cover stand point (4B), which takes priority.
    if (cell && cell.dist < 1e8) {
      const sp = spec.speed * 0.35 * u.frostMul;
      coverHaltUpdate(world, u, tgt);
      if (seekStandPoint(world, u, sp, dt)) return true;
      const fd = fwdDir(cell.dx, cell.dz);
      u.v.x += (fd.x * sp - u.v.x) * Math.min(1, 4 * dt);
      u.v.z += (fd.z * sp - u.v.z) * Math.min(1, 4 * dt);
      faceTravel(u, dt);
      return true; // handled march this tick — skip the default fallback
    }
  }
  if (u.hold) { // vantage hold (4C): permanently claims the march tick
    // The pair (6.5 Task 6): a directed sniper walks the few meters to his
    // spotter-chosen stand point (u._standPt, set once at the latch), then
    // settles — seekStandPoint drives, damps on arrival. Undirected holds
    // (no spotter) keep the old damp-in-place exactly.
    if (u._standPt) {
      u.settled = Math.hypot(u._standPt.x - u.pos.x, u._standPt.z - u.pos.z) <= 0.3;
      seekStandPoint(world, u, spec.speed * 0.35 * u.frostMul, dt);
      return true;
    }
    u.settled = true;
    u.v.x *= 1 - Math.min(1, 6 * dt);
    u.v.z *= 1 - Math.min(1, 6 * dt);
    return true;
  }
  return false; // no target, or target found but no valid cell: default march
}

// -------------------------------------------------------------- grenadier
// Halts at range and lobs shells over your wall at whatever structure is
// nearest. High-arc fire (opts.high) — same treatment as the mortar tower.
function stepGrenadier(world, u, cell, dt, fwdDir, T, toUV = (x, z) => ({ u: x, v: z })) {
  const fspec = ENEMY_FIRE.lob;
  u.grenCd = (u.grenCd || 0) - dt;
  u.scanCd = (u.scanCd || 0) - dt;
  const muzzle = { x: u.pos.x, y: u.pos.y + 1.0, z: u.pos.z };
  let R2 = (u._effR != null ? u._effR : fspec.range) ** 2;
  let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
  if (tgt && tgt.kind === "unit") {
    // sticky UNIT target: fog-gated revalidation every tick (same law as
    // stepRifleman above).
    if (!unitTargetValid(world, u, muzzle, tgt, fspec, R2, T, toUV)) tgt = null;
  } else if (tgt) {
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
    // NOTE: deliberately NO fieldReaches gate on structure fire here — same
    // rationale as stepTank/stepRifleman above: a wall or tower's own
    // territory emission keeps the ground around itself pinned "held" for
    // team 1 for as long as it's alive, so team 2's flipped read never
    // leaves "unheld". Direct-fire range + arcClears LOS is the correct
    // gate; unit-vs-unit targeting keeps its own field gate elsewhere.
    if (!hostileStructure(tgt, 2) || dx * dx + dz * dz > R2 || !arcClears(world, muzzle, tgt.pos, fspec, u.id)) tgt = null;
  }
  if (!tgt && u.scanCd <= 0) {
    // seq, not id: b.id is a module-global counter (differs across worlds
    // in one process), b.seq is world-local — the scan-phase stagger must
    // key off seq or a same-seed twin run desyncs its rescan ticks (found
    // by Task 4A's twin-determinism assert once units began re-scanning
    // mid-fight for unit targets).
    u.scanCd = 0.13 + (u.seq % 8) * 0.012;
    u._effR = effRange(world, muzzle, fspec);
    R2 = u._effR * u._effR;
    let td = R2;
    for (const b of world.bodies) {
      // FRONT F1 (4c): shared hostile-structure set (depot masonry joins).
      if (!hostileStructure(b, 2)) continue;
      const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < td && arcClears(world, muzzle, b.pos, fspec, u.id)) { td = d2; tgt = b; }
    }
    // anti-personnel: same 60% urgency radius as the riflemen, fog-gated
    const man = nearestPlayerUnit(world, u, muzzle, fspec, R2, URGENCY, T, toUV);
    if (man) tgt = man;
  }
  u.tgtId = tgt ? tgt.id : null;
  if (tgt && u.grenCd <= 0) {
    u.grenCd = 3.0 + world.rng() * 0.6;
    u.flashT = world.t;
    // owner: u.id — without it the lofted shell has no muzzle-clearing
    // immunity against the grenadier's own body (core.js's owner-immunity
    // gate, ~:698) and detonates at the launch point on the very first
    // tick, same failure mode as stepTank's shell needed owner: t.id for.
    // Only surfaced once the fieldReaches gate above stopped permanently
    // vetoing grenadier-vs-wall acquisition (scripts/depot-test.mjs's
    // rifleman/grenadier-vs-wall fixtures).
    // Unit shots keep hitStruct and carry NO hitOnly — blast is blast.
    shooterFire(world, u, muzzle, tgt, fspec, { high: true, attacker: "enemy", hitStruct: true, owner: u.id });
  }
  if (tgt && cell && cell.dist < 1e8) {
    const sp = 1.3 * u.frostMul;
    coverHaltUpdate(world, u, tgt); // 4B: same cover halt as the riflemen
    if (seekStandPoint(world, u, sp, dt)) return true;
    const fd = fwdDir(cell.dx, cell.dz);
    u.v.x += (fd.x * sp - u.v.x) * Math.min(1, 3 * dt);
    u.v.z += (fd.z * sp - u.v.z) * Math.min(1, 3 * dt);
    faceTravel(u, dt);
    return true;
  }
  return false; // no target, or target found but no valid cell: default march
}

// ---------------------------------------------------------------- sapper
// Carries one satchel charge: sprints the road, and the first wall or
// emplacement within arm's reach gets it — 1.5s fuse, a blast that
// breaches masonry outright. The sapper rarely survives his work.
function stepSapper(world, u, dt) {
  if (u._fuse != null) {
    u._fuse -= dt;
    u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
    if (u._fuse <= 0) {
      // SIEGE FIX (mk0.21): the enemy demolition SHOWS the same way the
      // player's does — a cosmetic marker beside core's boom (core frozen).
      world.events.push({ type: "demo", x: u.pos.x, y: u.pos.y, z: u.pos.z, r: SATCHEL.r });
      explode(world, u.pos.x, u.pos.y, u.pos.z, { ...SATCHEL, attacker: "enemy" });
      applyDamage(world, u, 1e9, { attacker: "enemy" });
    }
    return true;
  }
  for (const t2 of world.bodies) {
    // FRONT F1 (4c): the sapper's wall-seek gains depot chunks via the
    // shared hostile-structure set.
    if (!hostileStructure(t2, 2)) continue;
    // SIEGE FIX (mk0.21): STANDING masonry only, and CONTACT range — the
    // identical filter and the identical shared pad the player's sappers use
    // (squads.js stepSapperCharges). Symmetry is the law.
    if (!standingStructure(t2)) continue;
    const dx2 = t2.pos.x - u.pos.x, dz2 = t2.pos.z - u.pos.z;
    const reach2 = t2.hx + SAPPER_PLANT_PAD;
    if (dx2 * dx2 + dz2 * dz2 < reach2 * reach2) { u._fuse = 1.5; u.flashT = world.t; return true; }
  }
  return false; // otherwise runs with the flow like everyone else
}

// ------------------------------------------------------------------- step
// March + combat driver, called before the engine step (same ordering TD
// uses: game-layer drivers, then stepWorld). grid supplies the flow field;
// upright/contacts/sleep/damage all belong to the engine.
export function stepUnits(world, grid, fwdDir, T, toUV = (x, z) => ({ u: x, v: z })) {
  const dt = world.dt;
  // wave armor (tanks): engine-driven vehicles, gun on a timer
  for (const t of world.bodies) {
    if (t.kind !== "vehicle" || t.team !== 2 || !t.alive || !t.squad) continue;
    stepTank(world, grid, t, dt, fwdDir, T, toUV);
  }
  for (const u of world.bodies) {
    if (u.kind !== "unit" || !u.alive || u.team !== 2) continue;
    u.frostMul = u.frostMul == null ? 1 : u.frostMul; // frost towers arrive later; default no-slow
    const supported = u.grounded || Math.abs(u.v.y) < 0.6;
    if (supported && u.R[4] > -0.5) {
      if (u.R[4] < 0.995) {
        const yaw2 = Math.atan2(u.R[6], u.R[8]) * 0.5;
        const ty = Math.sin(yaw2), tw = Math.cos(yaw2);
        const a = Math.min(1, 14 * dt);
        const sgn = u.q.y * ty + u.q.w * tw < 0 ? -1 : 1;
        u.q.x += (0 - u.q.x) * a; u.q.y += (ty * sgn - u.q.y) * a;
        u.q.z += (0 - u.q.z) * a; u.q.w += (tw * sgn - u.q.w) * a;
        const L2 = Math.hypot(u.q.x, u.q.y, u.q.z, u.q.w) || 1;
        u.q.x /= L2; u.q.y /= L2; u.q.z /= L2; u.q.w /= L2;
      }
      u.w.x *= 1 - Math.min(1, 6 * dt); u.w.z *= 1 - Math.min(1, 6 * dt);
    }
    if (!grid || !supported || u.R[4] < 0.7) continue;
    const spec = ENEMY_SPECS[u.tag] || ENEMY_SPECS[""];
    const cell = grid.cellAt(u.pos.x, u.pos.z);

    // The pair, enemy sign (6.5 Task 6): the spotter carries binoculars, not
    // a rifle — he NEVER fires (no stepRifleman for him) and never draws rng.
    // He shadows his sniper on the march; once the sniper latches a hold he
    // takes the surveyed high ground (set at latch time, below) and settles.
    // His sniper dead -> he converts to a lone rifleman: tag swap to "" (the
    // conscript rifle, ENEMY_FIRE.rifle), role cleared, hp KEPT — same man,
    // different tool. Bounty stays his own 15.
    if (u.role === "spotter") {
      const sn2 = u.pairId != null ? world.byId.get(u.pairId) : null;
      if (!sn2 || !sn2.alive) {
        u.role = undefined; u.tag = ""; u.pairId = null;
        u._standPt = null; u.hold = false; u.settled = false;
        continue; // next tick he marches and fights as an ordinary rifleman
      }
      const spd = spec.speed * u.frostMul;
      u._standPt = u._spotPt || { x: sn2.pos.x + 1.1, z: sn2.pos.z + 0.7 };
      u.settled = !!u._spotPt && Math.hypot(u._standPt.x - u.pos.x, u._standPt.z - u.pos.z) < 0.35;
      seekStandPoint(world, u, spd, dt);
      continue;
    }
    if (u.tag === "sapper" && stepSapper(world, u, dt)) continue;
    // sniper vantage check (4C): while marching, latch u.hold at the first
    // spot that reads as VANTAGE toward the advance bearing. The pair (6.5
    // Task 6): at the latch, a live spotter surveys the high ground around
    // the hold point and directs the sniper to his best firing spot — the
    // SAME solvers the player's pair uses (one behavior module, both signs).
    // Placement-time only (the latch happens once); draw-free.
    if (u.tag === "sniper" && !u.hold && cell && cell.dist < 1e8 && (cell.dx || cell.dz)) {
      const fd = fwdDir(cell.dx, cell.dz);
      if (atVantage(world, u, Math.atan2(fd.x, fd.z))) {
        u.hold = true;
        const sp2 = u.pairId != null ? world.byId.get(u.pairId) : null;
        if (sp2 && sp2.alive && sp2.role === "spotter") {
          const bearing = Math.atan2(fd.x, fd.z);
          const spot = surveyHighGround(world, u.pos.x, u.pos.z, bearing, (sp2.hx || 0.3) + 0.35);
          if (spot) sp2._spotPt = { x: spot.x, z: spot.z };
          const stand = bestStandPoint(world, u.pos.x, u.pos.z, bearing, u);
          if (stand) u._standPt = { x: stand.x, z: stand.z };
        }
      }
    }
    if (u.tag !== "gren" && u.tag !== "sapper" && stepRifleman(world, u, spec, cell, dt, fwdDir, T, toUV)) continue;
    if (u.tag === "gren" && stepGrenadier(world, u, cell, dt, fwdDir, T, toUV)) continue;

    // lost / default march (also the fallback path when a rifleman/
    // grenadier has no target in range this tick)
    if (!cell || cell.dist >= 1e8) {
      let ex = -u.pos.x, ez = -u.pos.z;
      const g = grid.worldToGrid(u.pos.x, u.pos.z);
      if (g) {
        let bd = 1e9;
        for (let dz2 = -1; dz2 <= 1; dz2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
          if (!dx2 && !dz2) continue;
          const nx2 = g.gx + dx2, nz2 = g.gz + dz2;
          if (!grid.inBounds(nx2, nz2)) continue;
          const nc = grid.cells[grid.idx(nx2, nz2)];
          if (nc.blocked || nc.dist >= 1e8) continue;
          if (nc.dist < bd) { bd = nc.dist; const wp = grid.gridToWorld(nx2, nz2); ex = wp.x - u.pos.x; ez = wp.z - u.pos.z; }
        }
      }
      const bl = Math.hypot(ex, ez) || 1;
      u.v.x += ((ex / bl) * 2.6 - u.v.x) * Math.min(1, 6 * dt);
      u.v.z += ((ez / bl) * 2.6 - u.v.z) * Math.min(1, 6 * dt);
      faceTravel(u, dt);
      u.lostT = (u.lostT || 0) + dt;
      if (u.lostT > 12) applyDamage(world, u, 1e9, { attacker: "world" });
      continue;
    }
    u.lostT = 0;
    const onIce = cell.ice;
    const speed = spec.speed * (onIce ? 1.3 : 1) * (u.frostMul || 1);
    const gain = Math.min(1, spec.gain * (onIce ? 0.4 : 1) * dt);
    const fd = fwdDir(cell.dx, cell.dz);
    u.v.x += (fd.x * speed - u.v.x) * gain;
    u.v.z += (fd.z * speed - u.v.z) * gain;
    faceTravel(u, dt);
  }
}

// -------------------------------------------------------- breaker ramming
// TD applies this against wave-armor contacts after the engine step; DEPOT
// mirrors it identically (heavy tag = breaker). Called from DepotGame.jsx's
// stepDepot, once per tick, after stepWorld's contact list is fresh.
export function stepBreakerRam(world) {
  for (const c of world.contacts) {
    if (c.pn <= 0 || !c.b) continue;
    const a = c.a, b = c.b;
    const unit = a.tag === "heavy" ? a : b.tag === "heavy" ? b : null;
    const str = unit === a ? b : a;
    if (unit && unit.alive && (str.kind === "wall" || str.kind === "tower") && str.alive) {
      // P1.5 T2: a player wall is three stacked courses and a breaker is tall
      // enough to be in contact with two of them at once — every contact
      // POINT deals ram damage, so charging the same wall would deal roughly
      // double what it dealt as one body. He works the BASE: only course 0
      // takes the ram, and when the base goes the courses above fall on him.
      if (str.kind === "wall" && str.course > 0) continue;
      const sp = Math.hypot(unit.v.x, unit.v.z);
      if (sp > 0.8) { applyDamage(world, str, sp * world.dt * 16, { attacker: "enemy" }); str.hitT = world.t; }
    }
  }
}

// FRONT F1: checkLeaks is GONE. An enemy that reaches the depot stays and
// fights — his structure fire (the shared hostile-structure set above)
// chews the building, and the breach census is the cost. Wave timeout
// (executeWithdrawal) and the off-grid write-off remain the only removals.
