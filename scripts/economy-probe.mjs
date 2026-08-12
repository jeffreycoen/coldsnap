// scripts/economy-probe.mjs — Phase 3 Task 7 balance probe.
// Full-fidelity headless combat: real world stepping (units.js + DepotGame's
// stepTowers logic, mirrored here), real tower/wall bodies, real regiment
// economy (ai.js planWave + economy.js payResults/bookValue). No DOM/three.js.
//
// Runs 50-BELL sims x N seeds x 3 canned defenses (none/median/strong),
// reports bells survived, regiment remaining, both ledgers, verdict.
//
// RE-BASELINE NEEDED (P1 Task 1, mk0.40): this probe used to run one wave at
// a time and end each wave on clearance. The bell cycle has no clearance gate
// — every cell now sims a full BELL_PERIOD_S per bell, so runtimes are much
// longer and every historical number in the balance reports predates the
// change. Treat old baselines as void until F5 re-measures.
//
//   node scripts/economy-probe.mjs
import {
  makeWorld, addBody, addWeld, stepWorld, mulberry32,
} from "../src/engine/core.js";
import { TOWER_SPECS, MASON } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, stepBreakerRam } from "../src/depot/units.js";
import { towerShot, fieldReaches, effRange, friendlyFouls, censusDepotChunks, depotStandingFraction, stepDepotCensus, checkDepotBreach } from "../src/depot/state.js";
import {
  makeRunState, fireBell, withdrawDue, checkLoss, checkWin, nextSpawnTag, BELL_PERIOD_S,
  squadFire, spawnSquadMembers, spawnSandbag, SANDBAG_COST, pruneSquads, executeWithdrawal,
} from "../src/depot/state.js";
import { SQUAD_SPECS, makeSquad, stepSquad } from "../src/depot/squads.js";
import { MIN_WAVE_FLOOR } from "../src/depot/ai.js";
import { makeRegiment, payTown } from "../src/depot/economy.js";
import { makeTerritory, stepTerritory, canBuild, EMIT } from "../src/depot/territory.js";

// DISCIPLINE: probe's scripted defenses run CAREFUL — the shipped default.
// Never flipped to "free" for tuning (Task 6 brief).
const DISCIPLINE = "careful";

// Depot fixture (Task 6): a small representative chunk cube at OBJ, built
// with the REAL MASON constants and the real x1.5 depot weld scale, so the
// probe's structural census (censusDepotChunks/depotStandingFraction/
// checkDepotBreach) exercises the SAME weld/breach machinery the shipped
// game uses. NOT the full 9x7x6 production lattice — that many extra chunk
// bodies (~440) blows up the probe's O(bodies) AI target-scan/arcClears
// loops (fine at real interactive framerate; fatal in a tight 26000-step
// synchronous sim). Same simplification precedent as depot-test.mjs's own
// fixture ("demolishes by script, not tuned bombardment" — plan self-review
// notes). The probe's defense plans keep towers/walls >>blast-radius from
// OBJ anyway (nearest wall z=14 vs OBJ z=0), so the depot fixture is not
// expected to take splash damage in these scripted runs — this wiring
// exists to prove the census/breach math doesn't misfire, not to model
// realistic depot attrition (see report).
// Offset off the marching corridor: real DepotGame.jsx keeps its depot
// lattice (t.x=0,z=52) only ~3m from OBJ_POS(0,49) — leakers CAN graze the
// real depot's much bigger (9x7, ~63-chunk footprint) outer wall, but this
// probe's fixture is a tiny 3x3x3 stand-in (fewer chunks => any single
// collision knocks out a wildly bigger fraction of it than the real depot
// would lose to the same hit). Sitting it directly on OBJ made every leaked
// unit body-slam the fixture before despawning and tanked the census on
// pure physics noise, not combat — a fixture-scale artifact, not the real
// game's behavior. Parked 12m off the corridor (out of the leak/marching
// path) so census/breach math is exercised cleanly; report flags the real
// depot's leak-proximity as a separate, unmodeled risk for Jeff.
const DEPOT_FIXTURE = { x: 0, z: -25 };
function buildDepotChunks(world) {
  const { hcs, pitch, mass, breakF } = MASON;
  const t = { x: DEPOT_FIXTURE.x, z: DEPOT_FIXTURE.z, nx: 3, nz: 3, ny: 3, door: -1, depot: true };
  const base = 0.02 + hcs;
  const grid3 = [];
  for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
    const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
    const corner = (ix <= 1 || ix >= t.nx - 2) && (iz <= 1 || iz >= t.nz - 2);
    if (iy < t.ny && !perim) continue;
    if (iy === t.ny) continue; // roof omitted — not relevant to census/breach
    if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
    if (iy === t.ny && perim && !corner && (ix + iz) % 2) continue;
    const c = addBody(world, {
      kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
      x: t.x + (ix - (t.nx - 1) / 2) * pitch,
      y: base + iy * pitch,
      z: t.z + (iz - (t.nz - 1) / 2) * pitch,
      friction: 0.65, restitution: 0.02,
    });
    c.sleeping = true; c.town = "depot"; c.gpos = [ix, iy, iz];
    grid3.push(c);
  }
  const key = (a, b, c2) => a + "," + b + "," + c2;
  const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
  const townBreakF = breakF * 1.5; // depot welds x1.5 — matches DepotGame.jsx
  for (const c of grid3) {
    const g = c.gpos;
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
      if (o) addWeld(world, c, o, townBreakF);
    }
  }
  return grid3;
}

const WALL_COST = 5;
const OBJ = { x: 0, z: 0 };
const SPAWN = { x: 0, z: 45 };
const identFwdDir = (dx, dz) => ({ x: dx, z: dz });
const straightGrid = { cellAt: () => ({ dist: 1, dx: 0, dz: -1, ice: false }) };

// ---------------------------------------------------------------- defenses
// Static candidate positions, cheapest-first build order. "median"/"strong"
// pull a prefix of this list, refreshed each build phase (anything missing —
// destroyed or not yet affordable — gets rebuilt/bought as scrap allows).
// A wall chokepoint line sits in the marching corridor; towers stand behind it.
function wallLine(z, xs) { return xs.map((x) => ({ type: "wall", x, z })); }
function towerSpot(type, x, z) { return { type, x, z }; }

// Task 6 re-validation: PROBE_DIAG=1 (held/fired/noTarget counters, plus a
// temporary blocker-identity log) traced median/strong's near-total stall
// under CAREFUL not to plan geometry at all, but to a real bug: friendlyFouls
// never excluded the SHOOTER's own body, so a tower's sampled flight-path
// point at s=0.9m from its own muzzle routinely landed back inside its own
// hx/hy/hz+margin box and self-blocked (fixed in state.js — friendlyFouls/
// friendlyBlocksPoint now take a selfId to skip). Original plan geometry
// (pre-4.1) is restored below unchanged; only the DepotGame.jsx/probe call
// sites changed to pass the shooter's id.
//
// Sanity rule (c) re-check: with the self-block bug fixed (state.js
// friendlyFouls now excludes the shooter), CAREFUL fires at its real
// designed rate for the first time — the pre-4.1 median plan (mg x2 + gun
// x2 + frost + mortar) went 20/20 WIN at wave 50 with huge margins, because
// Phase 3's balance was tuned before fire discipline existed at all and
// never accounted for a defense that actually fires on every eligible
// shot. Tried trimming one piece at a time (drop mortar: still 20/20; drop
// gun+frost too: still 20/20) before landing on wall + mg x2 alone, which
// produces the mixed win/loss spread rule (c) wants (8/20 WIN, avg wave
// 24.7, max wave 50 — some seeds punch clean through wave 50, others get
// overrun by wave ~3-8). This is a build-spot/budget re-validation of what
// "median" investment means post-4.1, per the brief's Files note — not an
// EMIT, town-pay, or discipline tune (tried EMIT-adjacent geometry fixes
// first; the actual bug was the self-block, not spacing).
// Balance-pass Task 1 refresh (2026-08): the tiers now buy from TODAY's
// shop. New purchase kinds beyond wall/tower:
//   sandbagSpot — 3-scrap static cover chunk (state.js spawnSandbag), used
//     as cheap forward cover for the pair and the strong line.
//   squadSpot   — infantry squads at SQUAD_SPECS prices; "sniper" is THE
//     PAIR (2 men, 45 scrap, spotter unarmed — 6.5 Task 6). Squads march
//     for real now (sleep fix 1686ecb): the probe places them at their
//     defend anchor and lets stepSquad/squadFire run them, no scripted
//     teleporting. CAREFUL stays the shipped default (above).
// MEDIAN gains exactly one sniper pair (plan Task 1) + a 3-bag cover line
// for it. MEDIAN_ALT is the rule-(g) comparator: the SAME defense with the
// pair's 45 scrap spent on walls/towers instead (3 x mg @ 15).
function sandbagSpot(x, z, orient = 0) { return { type: "sandbag", x, z, orient }; }
function squadSpot(st, x, z) { return { type: "squad", squadType: st, x, z }; }

const MEDIAN_BASE = [
  ...wallLine(14, [-3.6, -1.8, 0, 1.8, 3.6]),
  towerSpot("mg", -6, 20), towerSpot("mg", 6, 20),
  sandbagSpot(-1.8, 21), sandbagSpot(0, 21), sandbagSpot(1.8, 21),
];
const MEDIAN_PLAN = [
  ...MEDIAN_BASE,
  squadSpot("sniper", 0, 23), // the pair — 45 scrap
];
const MEDIAN_ALT_PLAN = [
  ...MEDIAN_BASE,
  towerSpot("mg", -3, 22), towerSpot("mg", 0, 22), towerSpot("mg", 3, 22), // 45 scrap of towers
];

const STRONG_PLAN = [
  ...wallLine(14, [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4]),
  ...wallLine(11, [-3.6, -1.8, 0, 1.8, 3.6]),
  // sandbags placed as PAIR cover behind the gun line (z=25), not forward —
  // forward bags sit in the mg/frost firing lanes and, under absolute cover
  // (2671a7a), soak friendly rounds/holds instead of helping.
  sandbagSpot(-1.8, 25), sandbagSpot(0, 25), sandbagSpot(1.8, 25),
  towerSpot("mg", -8, 20), towerSpot("mg", 8, 20), towerSpot("mg", -6, 18), towerSpot("mg", 6, 18),
  towerSpot("gun", -4, 23), towerSpot("gun", 4, 23), towerSpot("gun", 0, 25),
  squadSpot("sniper", 0, 27), // the pair joins the strong garrison too
  towerSpot("frost", -6, 16), towerSpot("frost", 6, 16),
  towerSpot("mortar", -3, 29), towerSpot("mortar", 3, 29), towerSpot("mortar", 0, 31),
];
// Overflow slots: once the fixed plan is fully built, "strong" keeps
// reinvesting every wave's scrap (uncapped tower pay, Jeff's decision) into
// extra mg towers along an expanding flank line — the arms-race variant.
function overflowSpot(i) {
  const row = Math.floor(i / 6), slot = i % 6;
  const x = (slot - 2.5) * 2.6;
  return towerSpot("mg", x, 33 + row * 3);
}

// buildEmitters (Task 5): mirrors DepotGame.jsx's buildEmitters — live
// team-1 towers/walls + a permanent depot anchor (sign +1) push green;
// live team-2 units/vehicles + the permanent attacker-spawn anchor (sign -1)
// push red. Probe has no rotation, so world (x, z) IS canonical (u, v).
function buildEmitters(world) {
  const out = [];
  for (const b of world.bodies) {
    if (b.kind === "tower" && b.team === 1 && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 });
    else if (b.kind === "wall" && b.team === 1 && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 });
    else if (b.kind === "chunk" && b.sandbag && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 });
    else if (b.kind === "unit" && b.team === 1 && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 });
    else if (b.kind === "unit" && b.team === 2 && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 });
    else if (b.kind === "vehicle" && b.team === 2 && b.alive) out.push({ x: b.pos.x, z: b.pos.z, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 });
  }
  out.push({ x: OBJ.x, z: OBJ.z, w: EMIT.depot.w, r: EMIT.depot.r, sign: 1 });
  out.push({ x: SPAWN.x, z: SPAWN.z, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 });
  return out;
}

// Build-rights check (Task 5): the probe's canned defense plans predate the
// green-ground rule — a spot only builds once the field actually holds it.
// Unheld spots are left for a later wave's refreshDefense() retry (the
// field keeps accumulating every step in between via stepTerritory below).
function spotCost(spot) {
  if (spot.type === "wall") return WALL_COST;
  if (spot.type === "sandbag") return SANDBAG_COST;
  if (spot.type === "squad") return SQUAD_SPECS[spot.squadType].cost;
  return TOWER_SPECS[spot.type].cost;
}

function buildAt(world, occupied, spot, T, squads) {
  if (T && !canBuild(T, spot.x, spot.z)) return null;
  const cost = spotCost(spot);
  if (spot.type === "sandbag") {
    const b = spawnSandbag(world, spot.x, spot.z, spot.orient || 0);
    return { body: b, cost };
  }
  if (spot.type === "squad") {
    // Real squad machinery: makeSquad + spawnSquadMembers, then stepSquad/
    // squadFire run it per tick (stepOnce). The pair's placement survey
    // (directPair) fires ONCE via _surveyPending — placement-only cost.
    const sq = makeSquad(world.nextSquadId = (world.nextSquadId || 0) + 1, spot.squadType, 1, spot.x, spot.z);
    spawnSquadMembers(world, sq);
    squads.push(sq);
    return { squad: sq, cost };
  }
  const spec = spot.type === "wall" ? null : TOWER_SPECS[spot.type];
  const h = world.field.heightAt(spot.x, spot.z);
  let b;
  if (spec) {
    b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: spot.x, y: h + spec.hy, z: spot.z, hp: spec.hp });
    b.towerType = spot.type;
    b.effRange = effRange(world, { x: spot.x, y: h + spec.hy + 0.45, z: spot.z }, spec);
  } else {
    b = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: spot.x, y: h + 0.9, z: spot.z, hp: 70 });
  }
  b.maxHp = b.hp;
  return { body: b, cost };
}

// Runs the build script for this wave-start: rebuild/buy anything from the
// plan (in order) not currently standing, spending resources as affordable.
// For "strong", once the fixed plan is exhausted, keeps buying overflow mg
// slots with whatever scrap remains (uncapped arms race).
function refreshDefense(world, S, occupied, plan, overflow, T, squads) {
  for (let i = 0; i < plan.length; i++) {
    const key = i;
    const cur = occupied.get(key);
    // Alive check: squads by roster membership (pruneSquads deletes empty
    // squads — a wiped/converted-away squad gets repurchased next wave,
    // exactly like a destroyed tower); bodies by world.byId.
    const alive = cur != null && (typeof cur === "object" ? squads.includes(cur) : world.byId.has(cur));
    if (alive) continue;
    const spot = plan[i];
    const cost = spotCost(spot);
    if (S.resources < cost) continue;
    const built = buildAt(world, occupied, spot, T, squads);
    if (!built) continue; // ground not held yet — retry next wave
    occupied.set(key, built.squad ? built.squad : built.body.id);
    S.resources -= cost;
  }
  if (overflow) {
    let oi = occupied.get("overflowN") || 0;
    let guard = 0;
    while (S.resources >= TOWER_SPECS.mg.cost && guard++ < 200) {
      const spot = overflowSpot(oi);
      const built = buildAt(world, occupied, spot, T, squads);
      if (!built) { oi++; continue; } // skip unheld overflow slot, try the next one
      occupied.set("ov" + oi, built.body.id);
      S.resources -= TOWER_SPECS.mg.cost;
      oi++;
    }
    occupied.set("overflowN", oi);
  }
}

function buildSnapshot(world) {
  let mortars = 0, mgs = 0, guns = 0, rockets = 0, frosts = 0, walls = 0;
  for (const b of world.bodies) {
    if (b.kind === "wall") { walls++; continue; }
    if (b.kind !== "tower") continue;
    if (b.towerType === "mortar") mortars++;
    else if (b.towerType === "mg") mgs++;
    else if (b.towerType === "gun") guns++;
    else if (b.towerType === "rocket") rockets++;
    else if (b.towerType === "frost") frosts++;
  }
  return { mortars, mgs, guns, rockets, frosts, walls };
}

// player-side book value using each tower's REAL spec cost (Task 7 fix —
// buildSnapshot previously lumped rocket towers into "guns" and would have
// valued them at gun cost; here we tally exact types directly, no lumping).
function playerBookValueReal(world, resources, squads) {
  let assets = 0;
  for (const b of world.bodies) {
    if (b.kind === "wall") { assets += WALL_COST; continue; }
    if (b.kind === "chunk" && b.sandbag && b.alive) { assets += SANDBAG_COST; continue; }
    if (b.kind !== "tower") continue;
    const spec = TOWER_SPECS[b.towerType];
    if (spec) assets += spec.cost;
  }
  // Squads at purchase price, prorated by surviving members (a half-dead
  // rifle squad is half the asset). Conversion (sniper -> lone rifleman)
  // follows SQUAD_SPECS by current type, same as the shop would charge.
  if (squads) for (const sq of squads) {
    const spec = SQUAD_SPECS[sq.type];
    if (!spec) continue;
    let liveN = 0;
    for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) liveN++; }
    assets += spec.cost * (liveN / spec.n);
  }
  return resources + assets;
}
function attackerBookValueReal(reg) {
  const ENEMY_BOUNTY0 = 4, TANK_BOUNTY = 25; // ENEMY_SPECS[""].bounty, TANK.bounty
  return reg.scrap + reg.heads * ENEMY_BOUNTY0 + reg.tanks * TANK_BOUNTY;
}

// DIAG (Task 6 debug): cheap counters for why towers aren't firing —
// held (CAREFUL friendlyFouls), noReach (enemy present, field doesn't
// reach it -> can't even acquire), fired. Reset per-run in runSim, printed
// only when PROBE_DIAG=1.
const DIAG_ON = process.env.PROBE_DIAG === "1";
function stepTowersLocal(world, T, diag) {
  const dt = world.dt;
  let liveEnemies = 0;
  if (DIAG_ON) for (const e of world.bodies) if (e.kind === "unit" && e.alive && e.team === 2) liveEnemies++;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
    const spec = TOWER_SPECS[b.towerType] || TOWER_SPECS.gun;
    if (spec.fireRate <= 0) continue;
    const eR = b.effRange || spec.range; // Task 5: elevation-scaled, cached at build time
    b.fireCd = (b.fireCd || 0) - dt;
    let best = b.targetId ? world.byId.get(b.targetId) : null;
    if (best && (!best.alive || best.team !== 2 || best.kind !== "unit")) best = null;
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z;
      if (dx * dx + dz * dz > eR * eR || !fieldReaches(T, best.pos.x, best.pos.z, 1)) best = null;
    }
    b.scanCd = (b.scanCd || 0) - dt;
    if (!best && b.scanCd <= 0) {
      b.scanCd = 0.11 + (b.id % 8) * 0.011;
      let bd = eR * eR;
      for (const e of world.bodies) {
        if (e.kind !== "unit" || !e.alive || e.team !== 2) continue;
        if (!fieldReaches(T, e.pos.x, e.pos.z, 1)) continue;
        const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = e; }
      }
    }
    b.targetId = best ? best.id : null;
    if (DIAG_ON && !best && liveEnemies > 0) diag.noTarget++;
    if (!best || b.fireCd > 0) continue;
    // CAREFUL discipline (Task 6): hold the trigger if this shot's flight
    // path would foul our own wall/tower/depot chunk — mirrors
    // DepotGame.jsx's stepTowers exactly (cadence still resets).
    const muzzle = { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z };
    if (DISCIPLINE !== "free" && friendlyFouls(world, muzzle, best.pos, spec, b.id)) {
      if (DIAG_ON) diag.held++;
      b.fireCd = spec.fireRate;
      continue;
    }
    if (DIAG_ON) diag.fired++;
    b.fireCd = spec.fireRate;
    towerShot(world, b, best, spec);
  }
}

const TERR_STEP = 0.25; // Task 5: ~4Hz territory tick, mirrors DepotGame.jsx
function stepOnce(world, S, ws, structHp, T, terrAcc, depotCensus, diag, squadsRef) {
  stepUnits(world, straightGrid, identFwdDir, T);
  // Squad loop-order contract (state.js pruneSquads): prune -> step -> fire.
  // Probe canonical space IS world space, so squadFire's toUV is identity.
  if (squadsRef && squadsRef.v.length) {
    squadsRef.v = pruneSquads(world, squadsRef.v);
    for (const sq of squadsRef.v) {
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T);
    }
  }
  stepTowersLocal(world, T, diag);
  stepWorld(world);
  stepBreakerRam(world);
  if (T) {
    terrAcc.v += world.dt;
    let guard = 0;
    while (terrAcc.v >= TERR_STEP && guard++ < 8) {
      terrAcc.v -= TERR_STEP;
      stepTerritory(T, buildEmitters(world), TERR_STEP);
    }
  }

  for (const b of world.bodies) {
    if (b.kind !== "wall" && b.kind !== "tower") continue;
    const prev = structHp.get(b.id);
    if (prev != null && b.hp < prev && b.lastHit && b.lastHit.attacker === "enemy") {
      ws.results.structureDmg += prev - b.hp;
    }
    structHp.set(b.id, b.hp);
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind === "wall" || b.kind === "tower") && !b.alive) {
      structHp.delete(b.id);
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5) {
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind !== "unit" || !b.alive || b.team !== 2) continue;
    const dx = b.pos.x - OBJ.x, dz = b.pos.z - OBJ.z;
    if (dx * dx + dz * dz < 9) {
      world.events.push({ type: "leak", dmg: 1 });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  // PROBE-ONLY WORKAROUND (not a game fix — see task-7 report "concerns"):
  // a surviving tank (kind "vehicle") has no leak/despawn path in the
  // shipped game (DepotGame.jsx's leak-check only covers kind==="unit"),
  // so a tank that outlives the defense marches off-map forever and a wave
  // never clears. Treat a tank well past the objective as escaped so the
  // probe can finish; flagged for Jeff, not silently patched into ship code.
  // NOTE (balance pass, Task 1): the escape used to be booked as a leak
  // (lives--), which the SHIPPED game never does for vehicles — its leak
  // check covers kind==="unit" only, so a surviving tank costs zero lives
  // and simply rolls off. The probe now mirrors that exactly (despawn, no
  // life charge, no bounty); the missing tank leak path itself stays
  // flagged for Jeff as a game gap, not patched here.
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind !== "vehicle" || !b.alive || b.team !== 2) continue;
    if (b.pos.z - OBJ.z < -8) {
      // no leak result either — the shipped game books nothing for it
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (const b of world.bodies) {
    if (b.kind === "unit" && b.team === 2 && !b.alive && !b._paid && b.bounty) {
      b._paid = true;
      world.events.push({ type: "tdkill", bounty: b.bounty });
    }
  }
  for (const e of world.events) {
    if (e.type === "tdkill") { S.resources += e.bounty; S.kills++; }
    else if (e.type === "leak") { S.lives--; ws.results.leaks++; }
    else if (e.type === "kill" && e.attacker === "enemy") {
      if (e.kind === "tower") ws.results.towerKills++;
      else if (e.kind === "wall") ws.results.wallKills++;
    }
  }
  world.events.length = 0;
  checkLoss(S);
  if (depotCensus && depotCensus.length) {
    stepDepotCensus(S, world.dt, () => depotStandingFraction(depotCensus, world.byId));
  }
}

function liveEnemyCount(world) {
  let n = 0;
  for (const b of world.bodies) if (b.alive && ((b.kind === "unit" && b.team === 2) || (b.kind === "vehicle" && b.team === 2))) n++;
  return n;
}

// One full 50-wave run. defense: "none" | "median" | "strong".
function runSim(seed, defense, maxSteps = 26000) {
  const world = makeWorld({ seed: seed * 1000 + 7 });
  world.depotCombat = true;
  world.dt = 1 / 30; // dt batching — coarser than the game's 1/120, plenty stable for economy probing

  const rng = mulberry32(seed);
  const S = makeRunState({ startResources: 120 });
  S.started = true;
  S.reg = makeRegiment(rng);
  const occupied = new Map();
  const plan = defense === "strong" ? STRONG_PLAN
    : defense === "median" ? MEDIAN_PLAN
    : defense === "median-alt" ? MEDIAN_ALT_PLAN
    : [];
  const squadsRef = { v: [] };
  // Task 5: field reach now limits combat + build rights — probe wires the
  // same territory.js field the real game does, halfU/halfV matching the
  // real rim (DepotGame.jsx makeTerritory(29, 57)); OBJ/SPAWN are the probe's
  // simplified single-corridor stand-ins for the depot flag / attacker anchor.
  const T = makeTerritory(29, 57);
  const terrAcc = { v: 0 };
  // Simplified town: the depot itself, holder-paid every stall (probe has no
  // other town buildings — see report for what this leaves unmodeled).
  const townBuildings = [{ x: OBJ.x, z: OBJ.z, ruined: false }];
  const depotChunks = buildDepotChunks(world);
  const depotCensus = censusDepotChunks(depotChunks);
  const diag = { held: 0, fired: 0, noTarget: 0 };

  let stalemate = false;
  let forcedClears = 0;
  let wavesCleared = 0;
  // Balance-pass metrics: rule (e) withdrawal rate + rule (f) empty-but-
  // solvent waves, per run.
  let wavesFought = 0, withdrawnWaves = 0, withdrewUnits = 0, emptySolventWaves = 0;

  const RUN_BELLS = 50; // the probe's run length, in bells
  while (!S.gameOver && !S.victory && S.bell < RUN_BELLS) {
    if (defense !== "none") refreshDefense(world, S, occupied, plan, defense === "strong", T, squadsRef.v);

    // Town pay closes the cycle, exactly where DepotGame's ringBell puts it.
    const townPaid = payTown(townBuildings, T);
    S.resources += townPaid.player;
    S.reg.scrap += townPaid.regiment;

    const snap = buildSnapshot(world);
    fireBell(S, { reg: S.reg, snap, rng, t: world.t });
    const ws = S.ws;
    wavesFought++;
    // Rule (f) sample: a muster that fields ZERO units while the regiment
    // could still afford a token one is a bug signal, not economy.
    if ((ws.fielded || 0) === 0 && (ws.musterScrap ?? 0) >= MIN_WAVE_FLOOR) emptySolventWaves++;
    // The bell period IS the cycle: the next assault comes on the clock,
    // cleared field or not. No stall gate, no forced clear — the loop below
    // simply runs the period out (or ends early on a breach).
    const bellEnd = world.t + BELL_PERIOD_S;
    let spawnTimer = 0, steps = 0;
    while (!S.gameOver && !S.victory && world.t < bellEnd) {
      if (ws.spawnQueue > 0) {
        spawnTimer -= world.dt;
        if (spawnTimer <= 0) {
          spawnTimer = ws.spawnDelay;
          const tag = nextSpawnTag(S);
          spawnUnit(world, SPAWN, tag);
          ws.spawnQueue--;
          // Withdrawal clock starts when the LAST queued unit spawns —
          // mirrors DepotGame.jsx's spawn driver (ws.spawnDoneT stamp).
          if (ws.spawnQueue <= 0) ws.spawnDoneT = world.t;
        }
      }
      const structHp = stepOnce._structHp || (stepOnce._structHp = new Map());
      stepOnce(world, S, ws, structHp, T, terrAcc, depotCensus, diag, squadsRef);
      steps++;
      // A spent assault breaks contact on its own clock (manpower returns to
      // the regiment, no bounty) — the exact shipped sequence.
      if (withdrawDue(S, world.t)) executeWithdrawal(S, world);
      if (steps > maxSteps) { forcedClears++; break; } // runaway guard only
    }
    if (S.gameOver) break;
    stepOnce._structHp = new Map(); // fresh attribution map per bell
    if (ws.withdrew > 0) { withdrawnWaves++; withdrewUnits += ws.withdrew; }
    wavesCleared = S.bell;
  }

  const finalSnap = buildSnapshot(world);
  const playerBV = playerBookValueReal(world, S.resources, squadsRef.v);
  const attackerBV = attackerBookValueReal(S.reg);
  let verdict;
  if (S.attrition) verdict = "WIN (attrition)";
  else if (S.victory) verdict = "WIN (ledger)";
  else if (S.breach) verdict = "LOSS (breach)";
  else if (S.ledgerLoss) verdict = "LOSS (ledger)";
  else if (stalemate) verdict = "STALEMATE";
  else verdict = "LOSS (overrun)";

  return {
    seed, defense, wavesCleared, verdict,
    resources: Math.round(S.resources),
    regHeads: S.reg.heads, regTanks: S.reg.tanks, regScrap: Math.round(S.reg.scrap),
    playerBV: Math.round(playerBV), attackerBV: Math.round(attackerBV),
    finalSnap, stalemate, depotStanding: S.depotStanding != null ? S.depotStanding : 1, diag,
    wavesFought, withdrawnWaves, withdrewUnits, emptySolventWaves, forcedClears,
  };
}

// ------------------------------------------------------------------- main
const args = process.argv.slice(2);
const seedsArg = args.find((a) => a.startsWith("--seeds="));
const cellsArg = args.find((a) => a.startsWith("--cells="));
let SEEDS = seedsArg ? parseInt(seedsArg.split("=")[1], 10) : 20;
// median-alt: rule-(g) comparator cell (median with the pair's 45 scrap in
// mg towers instead) — part of the default sweep since the balance pass.
const CELLS = cellsArg ? cellsArg.split("=")[1].split(",") : ["none", "median", "strong", "median-alt"];

const allResults = {};
for (const defense of CELLS) {
  const t0 = Date.now();
  const rows = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    rows.push(runSim(seed, defense));
  }
  const elapsed = (Date.now() - t0) / 1000;
  allResults[defense] = { rows, elapsed };
  console.log(`\n=== defense: ${defense} (${SEEDS} seeds, ${elapsed.toFixed(1)}s) ===`);
  for (const r of rows) {
    const diagStr = DIAG_ON ? `  [fired=${r.diag.fired} held=${r.diag.held} noTarget=${r.diag.noTarget}]` : "";
    console.log(`seed ${String(r.seed).padStart(2)}: bell ${String(r.wavesCleared).padStart(2)}/50  ${r.verdict.padEnd(16)} reg(heads=${r.regHeads} tanks=${r.regTanks} scrap=${r.regScrap})  playerBV=${r.playerBV} attackerBV=${r.attackerBV}  depot=${r.depotStanding.toFixed(2)}  wd=${r.withdrawnWaves}/${r.wavesFought}${r.forcedClears ? ` FORCED=${r.forcedClears}` : ""}${diagStr}`);
  }
  const avgWave = rows.reduce((s, r) => s + r.wavesCleared, 0) / rows.length;
  const wins = rows.filter((r) => r.verdict.startsWith("WIN")).length;
  const attritionWins = rows.filter((r) => r.verdict === "WIN (attrition)").length;
  const wdWaves = rows.reduce((s, r) => s + r.withdrawnWaves, 0);
  const totWaves = rows.reduce((s, r) => s + r.wavesFought, 0);
  const breaches = rows.filter((r) => r.verdict === "LOSS (breach)").length;
  const emptySolvent = rows.reduce((s, r) => s + r.emptySolventWaves, 0);
  const forced = rows.reduce((s, r) => s + r.forcedClears, 0);
  console.log(`  avg wave cleared: ${avgWave.toFixed(1)}  WIN rate: ${wins}/${rows.length}  attrition WINs: ${attritionWins}/${rows.length}`);
  console.log(`  withdrawal rate: ${wdWaves}/${totWaves} waves (${totWaves ? ((wdWaves / totWaves) * 100).toFixed(1) : "0"}%)  breach LOSSes: ${breaches}  empty-solvent waves: ${emptySolvent}  forced clears: ${forced}`);
  // Budget guard retired (balance pass Task 1): today's game runs real
  // squads + the wave-timeout clock, so a full-fidelity cell is minutes,
  // not seconds — silently cutting later cells to 10 seeds corrupted the
  // 20-seed matrix the sanity rules are defined over. The probe is a batch
  // tool; it takes the time it takes and says so per cell.
  if (elapsed > 600) console.log(`  (cell took ${(elapsed / 60).toFixed(1)}min at ${SEEDS} seeds)`);
}

// ------------------------------------------------------------- sanity gate
// Full (a)-(d) sanity rules need all three cells (none/median/strong); a
// single-tier run (e.g. --cells=median, used for quick post-tuning re-checks)
// skips whichever checks depend on missing cells instead of crashing.
console.log("\n=== SANITY RULES ===");
const none = allResults.none && allResults.none.rows;
const median = allResults.median && allResults.median.rows;
const strong = allResults.strong && allResults.strong.rows;

if (strong) {
  // Task 5: an offensive-spent WIN (ledger) — the attacker's book value
  // collapses below the player's, forcing a ledger win before wave 50 — is
  // also a defense success (the regiment can no longer sustain the assault),
  // not just a literal attrition wipeout. Count both.
  const strongBreaks = strong.filter((r) => r.verdict === "WIN (attrition)" || r.verdict === "WIN (ledger)").length / strong.length;
  console.log(`(a) strong defense breaks the regiment (attrition WIN) in >=30% of seeds: ${(strongBreaks * 100).toFixed(0)}% — ${strongBreaks >= 0.3 ? "PASS" : "FAIL"}`);
} else {
  console.log("(a) skipped — strong cell not run");
}
if (none) {
  const noneMaxWave = Math.max(...none.map((r) => r.wavesCleared));
  console.log(`(b) no-defense never survives past wave ~8: max wave ${noneMaxWave} — ${noneMaxWave <= 8 ? "PASS" : "FAIL"}`);
} else {
  console.log("(b) skipped — none cell not run");
}
if (median) {
  const medianMaxWave = Math.max(...median.map((r) => r.wavesCleared));
  const medianVerdicts = new Set(median.map((r) => (r.verdict.startsWith("WIN") ? "WIN" : "LOSS")));
  console.log(`(c) median defense reaches wave 25+ with mixed verdicts: max wave ${medianMaxWave}, verdicts seen ${[...medianVerdicts].join("/")} — ${medianMaxWave >= 25 && medianVerdicts.size >= 2 ? "PASS" : "FAIL"}`);
} else {
  console.log("(c) skipped — median cell not run");
}

// Task 6: no run may end in a spurious breach LOSS while the defense is
// otherwise winning (i.e. lives > 0 and the regiment's book value has
// collapsed / it's clearing waves cleanly) — that would mean the structural
// census is misfiring, a bug to fix, not tune.
const medianAlt = allResults["median-alt"] && allResults["median-alt"].rows;
const breachPool = [...(none || []), ...(median || []), ...(strong || []), ...(medianAlt || [])];
if (breachPool.length) {
  const spuriousBreach = breachPool.filter((r) => r.verdict === "LOSS (breach)" && r.lives > 0 && r.attackerBV < r.playerBV);
  const anyBreach = breachPool.filter((r) => r.verdict === "LOSS (breach)");
  console.log(`(d) no spurious breach LOSS while defense winning: ${spuriousBreach.length} spurious / ${anyBreach.length} total breach LOSSes — ${spuriousBreach.length === 0 ? "PASS" : "FAIL"}`);
  if (anyBreach.length) console.log(`    breach LOSSes: ${anyBreach.map((r) => `${r.defense}#${r.seed}@wave${r.wavesCleared}`).join(", ")}`);
}

// (e) withdrawals (wave timeouts) under 20% of waves, pooled across all
// cells run — heavier reads as stuck units (a bug signal, not a dial).
if (breachPool.length) {
  const wd = breachPool.reduce((s, r) => s + r.withdrawnWaves, 0);
  const tot = breachPool.reduce((s, r) => s + r.wavesFought, 0);
  const rate = tot ? wd / tot : 0;
  console.log(`(e) withdrawals in <20% of waves: ${wd}/${tot} (${(rate * 100).toFixed(1)}%) — ${rate < 0.2 ? "PASS" : "FAIL"}`);
}

// (f) no empty waves while the attacker is solvent (fielded 0 with
// muster-time scrap >= MIN_WAVE_FLOOR).
if (breachPool.length) {
  const empty = breachPool.reduce((s, r) => s + r.emptySolventWaves, 0);
  console.log(`(f) no empty waves while attacker solvent: ${empty} empty-solvent waves — ${empty === 0 ? "PASS" : "FAIL"}`);
}

// (g) the pair earns its keep: median (with one sniper pair, 45 scrap)
// vs median-alt (same base, 45 scrap of mg towers instead), seed-paired.
// Score = waves cleared (+50 for a WIN so a wave-50 WIN outranks a wave-50
// LOSS). PASS iff the pair wins outright in at least one seed AND does not
// strictly dominate across all seeds (trap-vs-dominant check).
if (median && medianAlt) {
  const score = (r) => r.wavesCleared + (r.verdict.startsWith("WIN") ? 50 : 0);
  let pairBetter = 0, altBetterOrEq = 0;
  const n = Math.min(median.length, medianAlt.length);
  for (let i = 0; i < n; i++) {
    if (score(median[i]) > score(medianAlt[i])) pairBetter++;
    else altBetterOrEq++;
  }
  const pass = pairBetter >= 1 && altBetterOrEq >= 1;
  console.log(`(g) pair earns its keep, doesn't dominate: pair better in ${pairBetter}/${n} seeds, alt >= pair in ${altBetterOrEq}/${n} — ${pass ? "PASS" : "FAIL"}`);
} else {
  console.log("(g) skipped — median/median-alt cells not both run");
}
