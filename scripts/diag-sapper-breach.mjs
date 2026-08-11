// DIAG (throwaway): why 20 sapper teams "half destroy" the enemy depot but
// victory never fires. Modes:
//   node scripts/diag-sapper-breach.mjs quiet   — 20 teams, no enemies, instrumented
//   node scripts/diag-sapper-breach.mjs live    — 20 teams with enemy waves running
//   node scripts/diag-sapper-breach.mjs origcadence — reproduce measure-satchel cadence
import { makeWorld, addBody, addWeld, stepWorld, mulberry32 } from "../src/engine/core.js";
import { censusDepotChunks, depotStandingFraction, spawnSquadMembers, squadFire, DEPOT_BREACH_FRAC, DEPOT_STANDING_TOL } from "../src/depot/state.js";
import { makeSquad, stepSquad } from "../src/depot/squads.js";
import { MASON, SATCHEL } from "../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../src/depot/orient.js";
import { stepUnits, spawnUnit } from "../src/depot/units.js";
import fs from "node:fs";

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
    sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("computeFlowField"), sliceFn("buildTown"),
    `return { makeMap, makeGrid, buildTown, computeFlowField,
       state: () => ({ ORIENT, TOWN, SPAWN_POINTS, OBJ_POS }),
       fwdDir: (du, dv) => fwdDirFor(ORIENT, du, dv), invW: (x, z) => invWFor(ORIENT, x, z),
       worldToGrid: null };`].join("\n"),
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

const mode = process.argv[2] || "quiet";
const N_TEAMS = Number(process.argv[3] || 20);

function displacement(b, c) { return Math.hypot(b.pos.x - c.home.x, b.pos.y - c.home.y, b.pos.z - c.home.z); }

function histo(world, census) {
  let dead = 0, disp12 = 0, disp03 = 0, intact = 0;
  for (const c of census) {
    const b = world.byId.get(c.id);
    if (!b || b.alive === false) { dead++; continue; }
    const d = displacement(b, c);
    if (d > DEPOT_STANDING_TOL) disp12++;
    else if (d > 0.3) disp03++;
    else intact++;
  }
  return { dead, disp12, disp03, intact, n: census.length };
}

function run() {
  M.makeMap(5);
  const st = M.state();
  const dep2 = st.TOWN.find((t) => t.id === "depot2");
  const world = makeWorld({ field: flat, seed: 5 });
  world.depotCombat = true;
  const grid = M.makeGrid(null);
  M.buildTown(world, grid, { heightAt: () => 0 });
  const census = censusDepotChunks(world.bodies, "depot2");
  const objG = grid.worldToGrid(st.OBJ_POS.x, st.OBJ_POS.z);
  M.computeFlowField(grid, objG.gx, objG.gz);

  const live = mode === "live" || mode === "mass";
  const orig = mode === "origcadence";
  if (mode === "mass") return runMass(world, grid, st, dep2, census);
  let spawnRR = 0, nextWaveT = 0;
  const stats = { planted: 0, plantedOnStanding: 0, plantedOnRubble: 0, diedCarrying: 0, detonated: 0 };
  const plantPts = [];
  let frac = 1, breachedAt = null;
  for (let team = 1; team <= N_TEAMS; team++) {
    const off = 8 + (dep2.nz * MASON.pitch) / 2;
    const sq = makeSquad(1000 + team, "sappers", 1, dep2.x, dep2.z + Math.sign(dep2.z || 1) * off);
    spawnSquadMembers(world, sq);
    sq.order = "attack"; sq.dest = { x: dep2.x, z: dep2.z };
    const seen = new Map(sq.memberIds.map((id) => [id, { planted: false }]));
    const dt = orig ? 1 / 30 : 1 / 60;
    const phys = orig ? 20 : 2;
    const capS = live ? 60 : 30;
    for (let i = 0; i < capS / dt; i++) {
      if (live && world.t >= nextWaveT) {
        nextWaveT = world.t + 30;
        const liveEnemies = world.bodies.filter((b) => b.alive && b.team === 2 && (b.kind === "unit" || b.kind === "vehicle")).length;
        for (let k = 0; k < 10 && liveEnemies + k < 30; k++) spawnUnit(world, st.SPAWN_POINTS[spawnRR++ % st.SPAWN_POINTS.length], "");
      }
      stepSquad(world, sq, dt); squadFire(world, sq, dt);
      // detect plant transitions before physics
      for (const [id, rec] of seen) {
        const u = world.byId.get(id);
        if (!u) continue;
        if (!rec.planted && u._fuse != null) {
          rec.planted = true; stats.planted++;
          // what triggered the plant: any chunk within reach — standing?
          let onStanding = false, nearest = 1e9;
          for (const b of world.bodies) {
            if (b.kind !== "chunk" || b.town !== "depot2" || !b.alive) continue;
            const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z;
            if (dx * dx + dz * dz < (b.hx + 1.3) ** 2) {
              const c = census.find((c) => c.id === b.id);
              const d = c ? displacement(b, c) : 1e9;
              nearest = Math.min(nearest, d);
              if (d <= DEPOT_STANDING_TOL) onStanding = true;
            }
          }
          if (onStanding) stats.plantedOnStanding++; else stats.plantedOnRubble++;
          plantPts.push({ x: u.pos.x, z: u.pos.z, onStanding, team });
        }
        if (rec.planted && u._fuse != null && u._fuse <= dt) stats.detonated++; // will blow this tick-ish
      }
      for (let s = 0; s < phys; s++) stepWorld(world);
      if (!sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) break;
    }
    // members dead without planting = charge lost
    for (const [id, rec] of seen) if (!rec.planted) stats.diedCarrying++;
    // let rubble settle a touch between teams (game: continuous)
    for (let s = 0; s < 120; s++) stepWorld(world);
    frac = depotStandingFraction(census, world.byId);
    const h = histo(world, census);
    console.log(`team ${String(team).padStart(2)}: frac=${frac.toFixed(3)} dead=${h.dead} disp>1.2=${h.disp12} disp0.3-1.2=${h.disp03} intact=${h.intact}` +
      (live ? ` liveEnemies=${world.bodies.filter((b) => b.alive && b.team === 2 && b.kind === "unit").length}` : ""));
    if (breachedAt == null && frac < DEPOT_BREACH_FRAC) { breachedAt = team; }
  }
  const h = histo(world, census);
  const visualGone = (h.dead + h.disp12 + h.disp03) / h.n;
  const censusGone = (h.dead + h.disp12) / h.n;
  console.log(`\nMODE=${mode} teams=${N_TEAMS} final frac=${frac.toFixed(3)} breachedAt=${breachedAt ?? "NEVER"} (threshold ${DEPOT_BREACH_FRAC})`);
  console.log(`stones=${h.n} dead=${h.dead} disp>1.2=${h.disp12} disp0.3-1.2=${h.disp03} intact=${h.intact}`);
  console.log(`visual-destroyed frac (dead+disp>0.3)=${visualGone.toFixed(3)}  census-destroyed=${censusGone.toFixed(3)}  gap=${(visualGone - censusGone).toFixed(3)}`);
  console.log(`charges: planted=${stats.planted} onStanding=${stats.plantedOnStanding} onRubble=${stats.plantedOnRubble} lostCarrying=${stats.diedCarrying} (of ${N_TEAMS * 2})`);
  // plant clustering: spread of plant points
  if (plantPts.length) {
    const mx = plantPts.reduce((s, p) => s + p.x, 0) / plantPts.length;
    const mz = plantPts.reduce((s, p) => s + p.z, 0) / plantPts.length;
    const spread = Math.sqrt(plantPts.reduce((s, p) => s + (p.x - mx) ** 2 + (p.z - mz) ** 2, 0) / plantPts.length);
    console.log(`plant points: n=${plantPts.length} centroid=(${mx.toFixed(1)},${mz.toFixed(1)}) rms spread=${spread.toFixed(2)}m depot2 at (${dep2.x.toFixed(1)},${dep2.z.toFixed(1)})`);
  }
}
// MASS mode: all N teams dispatched at once from the PLAYER side of the map
// (long march past the spawn line), live enemy waves, game cadence. Closest
// to what the director actually did.
function runMass(world, grid, st, dep2, census) {
  const dep1 = st.TOWN.find((t) => t.id === "depot");
  let spawnRR = 0, nextWaveT = 0;
  const squads = [];
  for (let team = 1; team <= N_TEAMS; team++) {
    // stagger start points in a line on the player side, ~12m from own depot
    const sx = dep1.x + ((team % 5) - 2) * 3.5;
    const sz = dep1.z - Math.sign(dep1.z || 1) * (12 + Math.floor(team / 5) * 3);
    const sq = makeSquad(1000 + team, "sappers", 1, sx, sz);
    spawnSquadMembers(world, sq);
    sq.order = "attack"; sq.dest = { x: dep2.x, z: dep2.z };
    squads.push(sq);
  }
  const allIds = squads.flatMap((s) => s.memberIds);
  const seen = new Map(allIds.map((id) => [id, { planted: false, dead: false }]));
  const dt = 1 / 60;
  let frac = 1, breachedAt = null, planted = 0, onStanding = 0, killedByEnemy = 0, killedOther = 0;
  const T_CAP = 300; // 5 min of world time
  for (let i = 0; i < T_CAP / dt; i++) {
    if (world.t >= nextWaveT) {
      nextWaveT = world.t + 30;
      const liveE = world.bodies.filter((b) => b.alive && b.team === 2 && b.kind === "unit").length;
      for (let k = 0; k < 10 && liveE + k < 30; k++) spawnUnit(world, st.SPAWN_POINTS[spawnRR++ % st.SPAWN_POINTS.length], "");
    }
    for (const sq of squads) { stepSquad(world, sq, dt); }
    for (const [id, rec] of seen) {
      const u = world.byId.get(id);
      if (!u) continue;
      if (!rec.planted && u._fuse != null) {
        rec.planted = true; planted++;
        for (const b of world.bodies) {
          if (b.kind !== "chunk" || b.town !== "depot2" || !b.alive) continue;
          const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z;
          if (dx * dx + dz * dz < (b.hx + 1.3) ** 2) {
            const c = census.find((c) => c.id === b.id);
            if (c && displacement(b, c) <= DEPOT_STANDING_TOL) { onStanding++; break; }
          }
        }
      }
      if (!rec.dead && u.alive === false) {
        rec.dead = true;
        if (!rec.planted) {
          const byEnemy = u.lastHit && u.lastHit.attacker === "enemy";
          if (byEnemy) killedByEnemy++; else killedOther++;
        }
      }
    }
    stepWorld(world); stepWorld(world);
    if (i % (10 / dt) === 0 || i === Math.floor(T_CAP / dt) - 1) {
      frac = depotStandingFraction(census, world.byId);
      const aliveS = allIds.filter((id) => { const u = world.byId.get(id); return u && u.alive; }).length;
      const h = histo(world, census);
      console.log(`t=${world.t.toFixed(0)}s frac=${frac.toFixed(3)} sappersAlive=${aliveS}/${allIds.length} planted=${planted} disp>1.2=${h.disp12} disp0.3-1.2=${h.disp03}`);
      if (breachedAt == null && frac < DEPOT_BREACH_FRAC) breachedAt = world.t;
      if (aliveS === 0 && planted === 0) break;
      if (aliveS === 0 && world.t > 60) break;
    }
  }
  frac = depotStandingFraction(census, world.byId);
  const h = histo(world, census);
  const visualGone = (h.dead + h.disp12 + h.disp03) / h.n;
  console.log(`\nMODE=mass teams=${N_TEAMS} final frac=${frac.toFixed(3)} breached=${frac < DEPOT_BREACH_FRAC} at t=${breachedAt ?? "NEVER"}`);
  console.log(`charges planted=${planted}/${N_TEAMS * 2} onStanding=${onStanding} lost: enemyFire=${killedByEnemy} otherCause(satchel fratricide etc)=${killedOther}`);
  console.log(`visual-destroyed=${visualGone.toFixed(3)} census-destroyed=${((h.dead + h.disp12) / h.n).toFixed(3)}`);
}
run();
