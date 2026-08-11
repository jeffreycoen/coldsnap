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

const argSpecs = process.argv.slice(2).map((s) => { const [r, kv, cap] = s.split(",").map(Number); return { r, kv, cap }; });
const specs = argSpecs.length ? argSpecs
  : [3.4, 5, 6.5, 8].flatMap((r) => [24, 48, 90].map((kv) => ({ r, kv })));
const trace = process.env.TRACE === "1";
console.log("r      kv    teams  frac    breached  (real depot2 lattice, plant at hx+1.3, 2 charges/team)");
for (const spec of specs) {
  const o = (process.env.THROUGHPLAY === "1" ? teamsToBreachPlay : teamsToBreach)({ r: spec.r, kv: spec.kv }, spec.cap || 16);
  console.log(`${spec.r.toFixed(1).padEnd(6)} ${String(spec.kv).padEnd(5)} ${String(o.teams).padEnd(6)} ${o.frac.toFixed(3)}   ${o.breached}  stones=${o.stones}`);
}
