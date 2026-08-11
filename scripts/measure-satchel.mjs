// FRONT F1 Task 4.5 — satchel charge sweep (measurement harness, headless).
// Jeff's decision 2026-08-11: the charge gets BIGGER, tuned by measurement,
// until sapper teams genuinely breach a depot from the REAL plant distance
// (hx + 1.3). This harness sweeps {r, kv} vs the REAL depot2 lattice
// (buildTown, weld breakF = MASON.breakF * 1.5 = 120,000) and reports
// teams-to-breach (2 charges per team, planted where a real sapper stops).
//   node scripts/measure-satchel.mjs [r,kv,cap ...]
//
// MEASURED CURVE (2026-08-11, this harness, real depot2, 233 stones,
// breach = standing fraction < 0.58):
//   r 3.4 kv  9  -> no breach in 30 teams (frac 0.970)  [the old charge]
//   r 3.4 kv 60  -> no breach in 30 teams (frac 0.876)
//   r 4.2 kv 60  -> no breach in 30 teams (frac 0.798)
//   r 4.6 kv 30  -> no breach in 20 teams (frac 0.807)
//   r 5.0 kv 24  -> no breach in 20 teams (frac 0.738)
//   r 5.0 kv 27  -> 17 teams
//   r 5.0 kv 30  ->  8 teams
//   r 5.0 kv 36  -> 10 teams   (rubble-geometry noise)
//   r 5.0 kv 45  ->  1 team
//   r 6.0 kv 45  ->  1 team (frac 0.030)
//   r 8.0 kv 90  ->  1 team (frac 0.000 — the whole depot)
// THROUGH-PLAY CURVE (real squads walking in — the number that matters;
// walked-in teams waste charges on rubble already scattered into the
// approach, so play needs a bigger charge than the idealized geometry):
//   r 5.0 kv 30  -> 56 teams
//   r 5.0 kv 38  -> 18 teams
//   r 5.0 kv 42  -> 17 teams
//   r 5.0 kv 45  ->  9 teams   <- THE KNEE (chosen; provisional F5)
//   r 5.0 kv 60  -> 10 teams   (rubble-waste plateau)
// The cliff is welded-shell physics: below it the shock never unzips the
// perimeter and the roof stands forever; above it collapse cascades.
//
// SIEGE FIX (mk0.21) — Jeff doubled the charge to {r:5, kv:90, dmg:300} and
// the sappers now spurn rubble and plant at contact range. Re-measured with
// this harness (--sides) and scripts/diag-sapper-breach.mjs:
//   SIDES, old {r:3.4,kv:9,dmg:150} -> shipped {r:5,kv:90,dmg:300}
//     WALL  (hp 100): 1m 113.6->246.9 | 2m 79.5->197.2 | 3m 44.8->146.7
//                     4m 10.1-> 96.0  | 5m  0.0-> 45.3 | 6m  0.0->  0.0
//     TOWER (hp 130): 1m 118.0->251.8 | 2m 88.1->206.7 | 3m 57.7->160.8
//                     4m 27.2->114.9  | 5m  0.0-> 68.8 | 6m  0.0-> 22.7
//     UNIT  (hp 58) : lethal radius 2.5m -> 4.6m; shove at 0.5m 7.5 -> 79.3 m/s
//     SPLASH        : friend at 3m and 4m now DIES too (was: lives) — the
//                     fratricide channel widened; fixing it was deliberately
//                     out of scope for mk0.21.
//   TEAMS-TO-BREACH (real depot2, 233 stones, threshold 0.58)
//     sequential walk-in teams: 11 -> 3   (diag "quiet" mode)
//     20 teams massed at once : never breached (plateau 0.751) -> BREACHED at
//                               t=60s, final fraction 0.056, on 3 charges.
import { makeWorld, addBody, addWeld, explode, stepWorld, mulberry32 } from "../src/engine/core.js";
import { censusDepotChunks, depotStandingFraction, spawnSquadMembers, DEPOT_BREACH_FRAC, DEPOT_STANDING_TOL } from "../src/depot/state.js";
import { squadFire } from "../src/depot/state.js";
import { makeSquad, stepSquad } from "../src/depot/squads.js";
import { MASON, SATCHEL } from "../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../src/depot/orient.js";
import fs from "node:fs";

// -- extract the real map/town builders from DepotGame.jsx (same trick as
//    depot-test.mjs F1/4.5i — JSX, not importable).
const depotSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
const sliceFn = (name) => {
  const start = depotSrc.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error("extract: missing function " + name);
  const rest = depotSrc.slice(start + 1);
  const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
  return rest.slice(0, m < 0 ? rest.length : m + 9);
};
const header = depotSrc.slice(depotSrc.indexOf("const GRID_CS"), depotSrc.indexOf("function genMap"));
const M = new Function(
  "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld",
  [header, sliceFn("genMap"), sliceFn("makeMap"), sliceFn("pondAt"), sliceFn("rockAt"),
    sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("buildTown"),
    `return { makeMap, makeGrid, buildTown, state: () => ({ ORIENT, TOWN }) };`].join("\n"),
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

// One team = 2 charges, each planted at the sapper's REAL stopping distance:
// (nearest standing chunk hx) + 1.3, measured horizontally from that chunk,
// on the approach side; the two men stand ~1.1 m apart; blast at chest
// height (y = 0.74, the squad unit's center). Between teams the rubble
// settles 4 s, exactly like the walk-in cadence of the through-play test.
function teamsToBreach(spec, cap = 30) {
  M.makeMap(5);
  const dep2 = M.state().TOWN.find((t) => t.id === "depot2");
  const world = makeWorld({ field: flat, seed: 5 });
  world.depotCombat = true;
  M.buildTown(world, M.makeGrid(null), { heightAt: () => 0 });
  const census = censusDepotChunks(world.bodies, "depot2");
  const approach = { x: dep2.x, z: dep2.z + Math.sign(dep2.z || 1) * 8 }; // open ground side
  let teams = 0, frac = 1;
  while (frac >= DEPOT_BREACH_FRAC && teams < cap) {
    teams++;
    // the men walk to the nearest standing stone and stop at hx + 1.3
    let best = null, bd = Infinity;
    for (const b of world.bodies) {
      if (b.kind !== "chunk" || b.town !== "depot2" || !b.alive) continue;
      const c = census.find((c) => c.id === b.id);
      if (!c || Math.hypot(b.pos.x - c.home.x, b.pos.y - c.home.y, b.pos.z - c.home.z) > DEPOT_STANDING_TOL) continue;
      const d = Math.hypot(b.pos.x - approach.x, b.pos.z - approach.z);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) break;
    const dx = approach.x - best.pos.x, dz = approach.z - best.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    const px = best.pos.x + (dx / dl) * (best.hx + 1.3), pz = best.pos.z + (dz / dl) * (best.hx + 1.3);
    const lx = -dz / dl, lz = dx / dl; // lateral: the two men side by side
    explode(world, px + lx * 0.55, 0.74, pz + lz * 0.55, { ...spec, dmg: 150, crater: 0.6, hitStruct: true, attacker: "player" });
    explode(world, px - lx * 0.55, 0.74, pz - lz * 0.55, { ...spec, dmg: 150, crater: 0.6, hitStruct: true, attacker: "player" });
    for (let s = 0; s < 2.5 * 120; s++) stepWorld(world);
    frac = depotStandingFraction(census, world.byId);
    if (trace) console.log(`  team ${teams}: frac=${frac.toFixed(3)}`);
  }
  return { teams, frac, breached: frac < DEPOT_BREACH_FRAC, stones: census.length };
}

// THROUGH-PLAY mode (THROUGHPLAY=1): the same measurement with REAL sapper
// squads walking in under ATTACK orders — the number that matters, because
// walked-in teams waste charges on rubble already scattered into the
// approach (sappers plant at any hostile chunk in arm's reach, standing or
// not; the enemy sapper shares this blindness — symmetry). SATCHEL's fields
// are overwritten in place so squads.js detonates the candidate charge.
function teamsToBreachPlay(spec, cap = 30) {
  SATCHEL.r = spec.r; SATCHEL.kv = spec.kv;
  M.makeMap(5);
  const dep2 = M.state().TOWN.find((t) => t.id === "depot2");
  const world = makeWorld({ field: flat, seed: 5 });
  world.depotCombat = true;
  M.buildTown(world, M.makeGrid(null), { heightAt: () => 0 });
  const census = censusDepotChunks(world.bodies, "depot2");
  let teams = 0, frac = 1;
  while (frac >= DEPOT_BREACH_FRAC && teams < cap) {
    teams++;
    const off = 8 + (dep2.nz * MASON.pitch) / 2;
    const sq = makeSquad(1000 + teams, "sappers", 1, dep2.x, dep2.z + Math.sign(dep2.z || 1) * off);
    spawnSquadMembers(world, sq);
    sq.order = "attack"; sq.dest = { x: dep2.x, z: dep2.z };
    const dt = 1 / 30;
    for (let i = 0; i < 30 / dt; i++) {
      stepSquad(world, sq, dt); squadFire(world, sq, dt);
      for (let s = 0; s < 20; s++) stepWorld(world);
      if (!sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) break;
    }
    frac = depotStandingFraction(census, world.byId);
    if (trace) console.log(`  team ${teams}: frac=${frac.toFixed(3)}`);
  }
  return { teams, frac, breached: frac < DEPOT_BREACH_FRAC, stones: census.length };
}

// --sides: the four side-measurements the Task 4.5 amendment required.
// Old {r:3.4, kv:9} vs shipped SATCHEL {r:5, kv:45}, chest-height charge:
//  1. WALL (hp 100, kind "wall"):  hp damage at d = 1..6m  → kill range + damage reach
//  2. TOWER (hp 130, kind "tower"): hp damage at d = 1..6m
//  3. UNIT (hp 58, kind "unit"):   lethal radius (binary-search d where hp<=0) + shove |v| at d=0.5
//  4. OWN-TEAM SPLASH: planter + a friendly member at d = 1..4m → who dies
// Each cell: fresh world, one explode() with the spec under test, read hp/v after one step.
// Print old → new per cell. These are the recorded numbers from the mk0.14 report —
// the harness makes them reproducible instead of historical.
function sidesRun() {
  // SIEGE FIX (mk0.21): the old column is the ORIGINAL charge (r 3.4, kv 9,
  // dmg 150); the new column is whatever SATCHEL currently is, damage
  // included — the doubling moved dmg too, so this can no longer hard-code it.
  const OLD = { r: 3.4, kv: 9, dmg: 150 };
  const NEW = { r: SATCHEL.r, kv: SATCHEL.kv, dmg: SATCHEL.dmg };
  const full = (s) => ({ dmg: 150, ...s, crater: 0.6, hitStruct: true, attacker: "player" });
  const oneShot = (spec, mk) => {           // mk(world) -> body; blast at (0, 1.2, d) is set by mk
    const world = makeWorld({ field: flat, seed: 11 });
    world.depotCombat = true;
    const b = mk(world);
    return { world, b };
  };
  const structDmg = (spec, kind, hp, hy, d) => {
    const { world, b } = oneShot(spec, (w) =>
      addBody(w, { kind, team: 1, mass: 0, hx: 0.9, hy, hz: 0.9, x: 0, y: hy, z: 0, hp }));
    explode(world, 0, 1.2, d, full(spec));
    stepWorld(world);
    return hp - b.hp;
  };
  const unitProbe = (spec, d) => {
    const { world, b } = oneShot(spec, (w) =>
      addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 }));
    explode(world, 0, 1.2, d, full(spec));
    stepWorld(world);
    return { hp: b.hp, v: Math.hypot(b.v.x, b.v.y, b.v.z) };
  };
  const lethalRadius = (spec) => {          // largest d (0.01m grid) where the unit still dies
    let lo = 0, hi = 12;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (unitProbe(spec, mid).hp <= 0) lo = mid; else hi = mid;
    }
    return lo;
  };
  const splash = (spec, d) => {             // planter at the charge, friend at d
    const world = makeWorld({ field: flat, seed: 11 });
    world.depotCombat = true;
    const planter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const friend = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: d, hp: 58 });
    explode(world, 0, 1.2, 0, full(spec));
    stepWorld(world);
    return { planter: planter.hp <= 0, friend: friend.hp <= 0 };
  };
  const fmt = (n) => (Math.round(n * 10) / 10).toString();
  console.log(`SATCHEL SIDE-MEASUREMENTS — old {r:${OLD.r}, kv:${OLD.kv}, dmg:${OLD.dmg}} → shipped {r:${NEW.r}, kv:${NEW.kv}, dmg:${NEW.dmg}} (chest-height charge, one step)`);
  for (const [label, kind, hp, hy] of [["WALL  (hp 100)", "wall", 100, 0.9], ["TOWER (hp 130)", "tower", 130, 1.5]]) {
    const cells = [];
    for (let d = 1; d <= 6; d++) cells.push(`d=${d}m ${fmt(structDmg(OLD, kind, hp, hy, d))} → ${fmt(structDmg(NEW, kind, hp, hy, d))}`);
    console.log(`  ${label}: ${cells.join(" | ")}`);
  }
  console.log(`  UNIT  (hp 58) : lethal radius ${fmt(lethalRadius(OLD))}m → ${fmt(lethalRadius(NEW))}m; shove |v| at d=0.5: ${fmt(unitProbe(OLD, 0.5).v)} → ${fmt(unitProbe(NEW, 0.5).v)} m/s`);
  const who = (s) => (s.planter ? "planter DIES" : "planter lives") + ", " + (s.friend ? "friend DIES" : "friend lives");
  for (let d = 1; d <= 4; d++) console.log(`  SPLASH d=${d}m: old [${who(splash(OLD, d))}] → new [${who(splash(NEW, d))}]`);
}
if (process.argv.includes("--sides")) { sidesRun(); process.exit(0); }

const argSpecs = process.argv.slice(2).map((s) => { const [r, kv, cap] = s.split(",").map(Number); return { r, kv, cap }; });
const specs = argSpecs.length ? argSpecs
  : [3.4, 5, 6.5, 8].flatMap((r) => [24, 48, 90].map((kv) => ({ r, kv })));
const trace = process.env.TRACE === "1";
console.log("r      kv    teams  frac    breached  (real depot2 lattice, plant at hx+1.3, 2 charges/team)");
for (const spec of specs) {
  const o = (process.env.THROUGHPLAY === "1" ? teamsToBreachPlay : teamsToBreach)({ r: spec.r, kv: spec.kv }, spec.cap || 16);
  console.log(`${spec.r.toFixed(1).padEnd(6)} ${String(spec.kv).padEnd(5)} ${String(o.teams).padEnd(6)} ${o.frac.toFixed(3)}   ${o.breached}  stones=${o.stones}`);
}
