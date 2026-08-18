// COLDSNAP DEPOT — drivers.js: THE MOTOR POOL (P7 T1, mk1.30). The one
// driver layer for every vehicle in the war. A driver is a GOAL policy
// (where the hull wants to be — written to b.goal; the engine's aiDrive
// steers and driveHull drives) and a GUNS policy (what its weapon does
// about what it sees). The engine keeps all tread physics; this module only
// sets goals and pulls triggers. A body names its driver with b.drv (a
// plain string — rides the save's generic scalar sweep); bodies without one
// are not the pool's business. Every draw is world.rng(); iteration is
// world.bodies order — deterministic. Future vehicles (the depot Bison,
// the APC, heroes) add a DRIVERS row, never a second loop.
import { applyDamage } from "../engine/core.js";
import { shooterFire, fieldReaches, effRange, hostileStructure, snapTargetNear, POSSESS_ACC } from "./state.js";
import { arcClears } from "./accuracy.js";
import { ENEMY_FIRE, BISON_FIRE } from "./specs.js";
import { planRoute } from "./route.js";

// ---- the wave tank — re-seated from units.js stepTank (mk1.30), verbatim.
function tankGoal(world, grid, t, dt, fwdDir) {
  const cell = grid && grid.cellAt(t.pos.x, t.pos.z);
  if (cell && cell.dist < 1e8 && (cell.dx || cell.dz)) {
    const fd = fwdDir(cell.dx, cell.dz);
    t.goal = { x: t.pos.x + fd.x * 9, z: t.pos.z + fd.z * 9 };
    t.lostT = 0;
  } else {
    // off-grid write-off: same 12s window infantry uses. Without this a
    // tank that wanders off the flow field keeps driving forever — no leak
    // radius ever catches it, and it never dies. Mirrors the infantry lostT.
    t.lostT = (t.lostT || 0) + dt;
    if (t.lostT > 12) applyDamage(world, t, 1e9, { attacker: "world" });
  }
}
function tankGuns(world, t, dt, T, toUV) {
  t.gunT = (t.gunT || 0) - dt;
  if (t.gunT > 0) return;
  const fspec = ENEMY_FIRE.tank;
  const muzzle = { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z };
  const eR = effRange(world, muzzle, fspec);
  let tgt = null, td = eR * eR;
  const pool = world._L ? world._L.structsFor2 : world.bodies; // T10
  for (const s of pool) {
    // FRONT F1 (4c): the shared hostile-structure set — towers, walls,
    // depot masonry. VISION (mk0.72): structures obey the one law too —
    // you shoot what your side sees.
    if (!hostileStructure(s, 2)) continue;
    const c = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, c.u, c.v, 2)) continue;
    const dx = s.pos.x - t.pos.x, dz = s.pos.z - t.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < td && arcClears(world, muzzle, s.pos, fspec, t.id)) { td = d2; tgt = s; }
  }
  if (!tgt) { t.gunT = 0.5; return; }
  t.gunT = fspec.cd + world.rng() * (fspec.cdVar || 0);
  // owner: t.id — the muzzle sits inside the tank's own hitbox and
  // hitStruct is required to hit the target at all; without owner immunity
  // the round detonates on its own hull on the first tick, every time
  // (found by the tank-vs-tower fixture; full note in the mk1.21 units.js).
  shooterFire(world, t, muzzle, tgt, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });
}

export const DRIVERS = {
  waveArmor: { goal: tankGoal, guns: tankGuns },
};

// ---- the depot's own armor (P7 T2, mk1.31): the full-citizen driver.
// Orders live ON the body (order/dest/_patA/_patB/escortId/tracks — plain
// scalars and flat objects, they ride the save's generic sweep): DEFEND
// holds, MOVE and PATROL run planRoute legs on the movement grid with the
// squads' own stall watch, ESCORT trails a squad at a respectful offset.
// THE OVERRUN SAFETY (owner): under tracks "careful" (the default) the hull
// brakes rather than roll over its OWN side's men — it flips depotDrive to
// "manual" with the brake on while blocked, back to "auto" when the lane
// clears (Task 1's own mechanism, no engine edit). "free" takes the safety
// off; enemy infantry are crushable either way — that is the weapon.
// Team-agnostic throughout: the enemy's Bison rides this exact policy when
// Task 5 seats its commander.
const ARMOR_WP_R = 2.5, ARMOR_ARRIVE = 3.0, ARMOR_ESCORT_BACK = 4;   // provisional (F5)
const SAFETY_AHEAD = 4, SAFETY_SPEED_K = 0.5, SAFETY_HALF_W = 2.8;   // provisional (F5)
function armorSafetyBlocked(world, v) {
  const fx = v.R[6], fz = v.R[8];
  const fl = Math.hypot(fx, fz) || 1;
  const reach = v.hz + SAFETY_AHEAD + Math.hypot(v.v.x, v.v.z) * SAFETY_SPEED_K;
  const pool = world._L ? (v.team === 1 ? world._L.friends : world._L.foes) : world.bodies;
  for (const u of pool) {
    if (u.kind !== "unit" || !u.alive || u.team !== v.team) continue;
    const dx = u.pos.x - v.pos.x, dz = u.pos.z - v.pos.z;
    const ahead = (dx * fx + dz * fz) / fl;
    if (ahead < 0 || ahead > reach) continue;
    if (Math.abs((dx * fz - dz * fx) / fl) < SAFETY_HALF_W) return true;
  }
  return false;
}
function armorGoal(world, grid, v, dt, fwdDir, opts) {
  if (v.tracks !== "free" && armorSafetyBlocked(world, v)) {
    v.depotDrive = "manual";
    v.ctl = { throttle: 0, steer: 0, brake: true };   // the tracks bite — the strong stop
    return;
  }
  v.depotDrive = "auto";
  // P7 T13: THE BACK-OUT — a hull that measured itself not-moving reverses
  // gently (under the crush speed), then replans; the failed lane is already
  // on its avoid list. Rides the manual channel — core.js untouched.
  if ((v._backT || 0) > 0) {
    v._backT -= dt;
    v.depotDrive = "manual";
    v.ctl = { throttle: -0.4, steer: 0, brake: false };   // provisional (F5)
    if (v._backT <= 0) { v._route = null; v._routeDest = null; v._pp = null; v._ppT = 0; }
    return;
  }
  const order = v.order || "defend";
  if (order === "defend") { v.goal = null; return; }
  if (order === "escort") {
    const sq = opts && opts.squads ? opts.squads.find((q) => q.id === v.escortId) : null;
    if (!sq) { v.order = "defend"; v.goal = null; return; }
    const dx = sq.anchor.x - v.pos.x, dz = sq.anchor.z - v.pos.z, d = Math.hypot(dx, dz) || 1;
    if (d <= ARMOR_ESCORT_BACK + 2.2) { v.dest = null; v._route = null; v._routeDest = null; v.goal = null; return; }
    // P7 T13: the escort leg ROUTES now (ordered driving goes around
    // masonry) — the trail point is a moving dest on the same machinery.
    v.dest = { x: sq.anchor.x - (dx / d) * ARMOR_ESCORT_BACK, z: sq.anchor.z - (dz / d) * ARMOR_ESCORT_BACK };
  }
  if (!v.dest) { v.order = "defend"; v.goal = null; return; }
  // MOVE/PATROL/ESCORT: route legs — stepSquadRouting's shape, on the body.
  const destChanged = !v._routeDest || Math.hypot(v._routeDest.x - v.dest.x, v._routeDest.z - v.dest.z) > 0.5;
  const wp0 = v._route && v._route.length ? v._route[0] : v.dest;
  const dWp = Math.hypot(wp0.x - v.pos.x, wp0.z - v.pos.z);
  let stale = false;
  if (!destChanged) {
    if (v._routeD == null || dWp < v._routeD - 0.5) { v._routeD = dWp; v._routeT = 0; }
    else v._routeT = (v._routeT || 0) + dt;
    stale = v._routeT >= 3;
  }
  if (destChanged || stale || !v._route) {
    v._routeD = null; v._routeT = 0;
    // P7 T13: hulls route as HULLS — steep ground and pressed-to-masonry
    // lanes are no lanes, and lately-failed cells are shunned while marked.
    if (v._avoid) v._avoid = v._avoid.filter((a) => a.until > world.t);
    const r = planRoute(grid, v.pos.x, v.pos.z, v.dest.x, v.dest.z,
      { hull: true, team: v.team, avoid: v._avoid && v._avoid.length ? new Set(v._avoid.map((a) => a.ci)) : null });
    if (r && !r.reached && r.pts.length) {
      const end = r.pts[r.pts.length - 1];
      // owner's ruling (2026-08-18): friendly and neutral masonry always
      // detours; a path only ENEMY masonry closes is followed verbatim —
      // the route runs to the wall and the hull drives the last stretch
      // straight, ramming through. Anything else clamps honestly.
      const foe = v.team === 1 ? 2 : 1;
      const rdx = v.dest.x - end.x, rdz = v.dest.z - end.z, rd = Math.hypot(rdx, rdz);
      let ram = rd > 0.5 && rd < 40;   // a bounded last stretch // provisional (F5)
      for (let s = 1; ram && s < rd; s++) {
        const cell = grid.cellAt(end.x + (rdx / rd) * s, end.z + (rdz / rd) * s);
        if (!cell) { ram = false; break; }
        const struct = cell.building != null || cell.wallId != null;
        if (cell.steep || cell.terrain || cell.water || (struct && cell.bTeam !== foe) || (cell.blocked && !struct)) ram = false;
      }
      if (!ram) {
        if (v.order === "patrol") {   // the honest clamp fixes the loop's endpoint too
          if (v._patA && Math.hypot(v.dest.x - v._patA.x, v.dest.z - v._patA.z) < 0.5) v._patA = { x: end.x, z: end.z };
          else if (v._patB && Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5) v._patB = { x: end.x, z: end.z };
        }
        v.dest = { x: end.x, z: end.z };
      }
    }
    v._route = r && r.pts.length ? r.pts : null;
    v._routeDest = { x: v.dest.x, z: v.dest.z };
  }
  while (v._route && v._route.length && Math.hypot(v._route[0].x - v.pos.x, v._route[0].z - v.pos.z) < ARMOR_WP_R) v._route.shift();
  const wp = v._route && v._route.length ? v._route[0] : v.dest;
  if (Math.hypot(v.dest.x - v.pos.x, v.dest.z - v.pos.z) <= ARMOR_ARRIVE) {
    if (v.order === "patrol" && v._patA && v._patB) {
      const goingToB = Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5;
      v.dest = goingToB ? { x: v._patA.x, z: v._patA.z } : { x: v._patB.x, z: v._patB.z };
      v._route = null; v._routeDest = null; v._stuckN = 0;
    } else if (v.order === "escort") { v.goal = null; return; }
    else { v.order = "defend"; v.dest = null; v.goal = null; return; }
  }
  v.goal = { x: wp.x, z: wp.z };
  // P7 T13: SLOW THROUGH THE TURN — full speed on the straights, a crawl at
  // the corner, so the hull's turning arc stays inside the route's clearance
  // corridor instead of sweeping through whatever stands past it.
  const wp1 = v._route && v._route.length > 1 ? v._route[1] : null;
  const wpd = Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z);
  if (wp1 && wpd < 5) {                              // provisional (F5)
    const a1 = Math.atan2(wp.x - v.pos.x, wp.z - v.pos.z);
    const a2 = Math.atan2(wp1.x - wp.x, wp1.z - wp.z);
    let bend = a2 - a1;
    while (bend > Math.PI) bend -= 2 * Math.PI;
    while (bend < -Math.PI) bend += 2 * Math.PI;
    if (Math.abs(bend) > 0.5) {                      // provisional (F5)
      let err = a1 - Math.atan2(v.R[6], v.R[8]);
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      v.depotDrive = "manual";
      v.ctl = { throttle: 0.35, steer: Math.max(-1, Math.min(1, err * 1.8)), brake: false };   // provisional (F5)
    }
  }
  // P7 T13: THE PROGRESS WATCH — waypoint distance can lie (a tipped hull
  // near a waypoint it cannot reach); travelled ground cannot. Under 0.4m in
  // 4s with a live goal = stuck: mark the lane, back out, replan. Three
  // strikes on one leg clamp the leg where the hull stands — honest.
  if (!v._pp || Math.hypot(v.pos.x - v._pp.x, v.pos.z - v._pp.z) > 0.4) { v._pp = { x: v.pos.x, z: v.pos.z }; v._ppT = 0; }
  else v._ppT = (v._ppT || 0) + dt;
  if (v._ppT >= 4) {                                 // provisional (F5)
    const g = grid.worldToGrid(v.goal.x, v.goal.z);
    if (grid.inBounds(g.gx, g.gz)) {
      v._avoid = (v._avoid || []).filter((a) => a.until > world.t);
      v._avoid.push({ ci: grid.idx(g.gx, g.gz), until: world.t + 25 });   // provisional (F5)
    }
    v._stuckN = (v._stuckN || 0) + 1;
    v._backT = 1.2; v._ppT = 0;                      // provisional (F5)
    if (v._stuckN >= 3) { v._stuckN = 0; v.dest = { x: v.pos.x, z: v.pos.z }; v._route = null; v._routeDest = null; }
  }
}
// ---- the two scans, lifted to module level (P7 T4): armorGuns' own nested
// closures, bodies unchanged, parameters explicit — so the APC's coax-only
// guns policy can share them without a second copy. Behavior identical for
// the Bison (same gates, same order — the T2 fixtures prove it stays green).
function armorScanFoes(world, v, muzzle, spec, unitsOnly, T, toUV) {
  const enemyTeam = v.team === 1 ? 2 : 1;
  const eR = effRange(world, muzzle, spec);
  const pool = world._L ? (enemyTeam === 2 ? world._L.foes : world._L.friends) : world.bodies;
  let best = null, bd = eR * eR;
  for (const e of pool) {
    if ((e.kind !== "unit" && (unitsOnly || e.kind !== "vehicle")) || !e.alive || e.team !== enemyTeam) continue;
    const dx = e.pos.x - v.pos.x, dz = e.pos.z - v.pos.z, d2 = dx * dx + dz * dz;
    if (d2 >= bd) continue;
    const c = toUV(e.pos.x, e.pos.z);
    if (!fieldReaches(T, c.u, c.v, v.team)) continue;
    if (!arcClears(world, muzzle, e.pos, spec, v.id)) continue;
    bd = d2; best = e;
  }
  return best;
}
function armorScanStructs(world, v, muzzle, spec, T, toUV) {
  const eR = effRange(world, muzzle, spec);
  const pool = world._L ? (v.team === 1 ? world._L.structsFor1 : world._L.structsFor2) : world.bodies;
  let best = null, bs = eR * eR;
  for (const s of pool) {
    if (!hostileStructure(s, v.team)) continue;
    const cs = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, cs.u, cs.v, v.team)) continue;
    const dx = s.pos.x - v.pos.x, dz = s.pos.z - v.pos.z, d2 = dx * dx + dz * dz;
    if (d2 >= bs) continue;
    if (!arcClears(world, muzzle, s.pos, spec, v.id)) continue;
    bs = d2; best = s;
  }
  return best;
}
function armorGuns(world, v, dt, T, toUV) {
  const attacker = v.team === 1 ? "player" : "enemy";
  v.gunT = (v.gunT || 0) - dt; v.mgT = (v.mgT || 0) - dt;
  const muzzle = { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z };
  if (v.gunT <= 0) {
    const gun = BISON_FIRE.gun;
    let tgt = armorScanFoes(world, v, muzzle, gun, false, T, toUV), struct = false;
    if (!tgt) { tgt = armorScanStructs(world, v, muzzle, gun, T, toUV); struct = !!tgt; }
    if (tgt) {
      v.gunT = gun.cd;
      v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
      shooterFire(world, v, muzzle, tgt, gun, struct
        ? { attacker, hitStruct: true, hitOnly: "structure", owner: v.id }
        : { attacker, hitStruct: true, owner: v.id });
    } else v.gunT = 0.5;
  }
  if (v.mgT <= 0) {
    const mg = BISON_FIRE.mg;
    const tgt = armorScanFoes(world, v, muzzle, mg, true, T, toUV);   // the coax shoots men, not dirt
    if (tgt) {
      v.mgT = mg.cd;
      v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
      shooterFire(world, v, muzzle, tgt, { ...mg, volley: mg.burst }, { attacker, owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
    } else v.mgT = 0.4;
  }
}
DRIVERS.armor = { goal: armorGoal, guns: armorGuns };

// ---- the APC (P7 T4): same legs, one gun. The goal policy IS armorGoal —
// orders, routes, escort, the overrun safety, all shared. The guns policy
// is the coax alone: a transport defends itself, it does not duel.
function apcGuns(world, v, dt, T, toUV) {
  const attacker = v.team === 1 ? "player" : "enemy";
  v.mgT = (v.mgT || 0) - dt;
  if (v.mgT > 0) return;
  const mg = BISON_FIRE.mg;
  const muzzle = { x: v.pos.x, y: v.pos.y + 1.3, z: v.pos.z };
  const tgt = armorScanFoes(world, v, muzzle, mg, true, T, toUV);
  if (tgt) {
    v.mgT = mg.cd;
    v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
    shooterFire(world, v, muzzle, tgt, { ...mg, volley: mg.burst }, { attacker, owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
  } else v.mgT = 0.4;
}
DRIVERS.apc = { goal: armorGoal, guns: apcGuns };
// (stepDrivers' possessed skip already decays mgT — no change.)

// stepDrivers: once per sim tick, BEFORE stepUnits — tanks drew from
// world.rng before infantry at mk1.21 and the draw-order contract holds.
// opts.possessedId (P7 T2): a possessed hull skips its driver entirely
// (goal untouched, guns untouched) but its cooldowns still decay — the
// stepTowers precedent. opts.squads: escort's own live squad lookup.
export function stepDrivers(world, grid, fwdDir, T, toUV = (x, z) => ({ u: x, v: z }), opts = {}) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "vehicle" || !b.alive) continue;
    const d = DRIVERS[b.drv];
    if (!d) continue;
    if (opts.possessedId === b.id) { b.gunT = (b.gunT || 0) - dt; b.mgT = (b.mgT || 0) - dt; continue; }
    d.goal(world, grid, b, dt, fwdDir, opts);
    d.guns(world, b, dt, T, toUV);
  }
}

// POSSESSION (P7 T2): the owner's two triggers. Same laws as every
// possessed shot — sight-gated at the aim, POSSESS_ACC sharpening, snap to
// a live seen enemy, real cooldowns shared with the auto guns.
export function possessedArmorFire(world, v, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const gun = BISON_FIRE.gun;
  v.gunT = v.gunT || 0;
  if (v.gunT > 0) return false;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, v.team)) return false;
  const live = snapTargetNear(world, aim, T, toUV);
  const tgt = live || { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  v.gunT = gun.cd;
  v._aimYaw = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
  shooterFire(world, v, { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z }, tgt, { ...gun, acc: gun.acc * POSSESS_ACC }, { attacker: "player", hitStruct: true, owner: v.id });
  return true;
}
export function possessedArmorMg(world, v, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const mg = BISON_FIRE.mg;
  v.mgT = v.mgT || 0;
  if (v.mgT > 0) return false;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, v.team)) return false;
  const live = snapTargetNear(world, aim, T, toUV);
  const tgt = live || { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  v.mgT = mg.cd;
  v._aimYaw = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
  shooterFire(world, v, { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z }, tgt, { ...mg, acc: mg.acc * POSSESS_ACC, volley: mg.burst }, { attacker: "player", owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
  return true;
}
