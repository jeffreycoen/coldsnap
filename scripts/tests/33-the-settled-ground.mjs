// COLDSNAP suite era 33 — THE SETTLED GROUND Task 1 (mk2.61): the stone
// count. mapgen plans in the currency the builder pays: stoneCount(t) is
// the count of what buildTown lays for a town entry, by the builder's own
// lay rules, and TOWN_STONE_CAP 3000 is the planner's ceiling (owner,
// 2026-08-26; the pool rises to 4000 beside it). Fixture seeds: 1-200 for
// the equality sweep, 1-500 for the cap. No seed is special: the cap is
// asserted over the whole sweep, the worst value reported, never pinned.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeWorld, addBody, addWeld, mulberry32, stepWorld } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { stoneCount, TOWN_STONE_CAP } from "../../src/depot/mapgen.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { payTown } from "../../src/depot/economy.js";

// The era-05 extraction machinery, a fresh copy scoped here: buildTown lives
// in DepotGame.jsx (a React module no test imports whole), so the suite
// slices it from source and runs it against the sliced mapgen frame.
const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
const mgSrc = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
const sliceFn = (name) => {
  let start = src.indexOf(`\nfunction ${name}(`), rest;
  if (start >= 0) { rest = src.slice(start + 1); }
  else {
    start = mgSrc.indexOf(`\nexport function ${name}(`);
    if (start < 0) throw new Error("era 33 extract: missing function " + name);
    rest = mgSrc.slice(start + 1).replace(/^export /, "");
  }
  const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
  return rest.slice(0, m < 0 ? rest.length : m + 9);
};
const header = mgSrc.slice(mgSrc.indexOf("const GRID_CS"), mgSrc.indexOf("function genMap")).replace(/^export /gm, "");
const mapSrc = [
  header,
  sliceFn("genMap"), sliceFn("makeMap"), sliceFn("streamAt"), sliceFn("pondAt"), sliceFn("rockAt"),
  sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("townFootprint"), sliceFn("buildTown"),
  `return { makeMap, makeGrid, buildTown, state: () => ({ TOWN, MAP_SEED }) };`,
].join("\n");
const mkMap = () => new Function(
  "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc,
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
const flatF = { heightAt: () => 0 };

// ==== T1a: the twelve template costs ========================================
// The whole-template stone costs, hand-derived from the lay rules and pinned
// as the phase's measured table. door 0 (both door ends count identically);
// the hangar drives through and slabs (door -1).
{
  console.log("\n[settled t1: the stone count]");
  const TPLS = [
    ["croft", { nx: 4, nz: 3, ny: 3, door: 0 }, 36],
    ["watch", { nx: 2, nz: 2, ny: 8, door: 0 }, 33],
    ["yard", { nx: 6, nz: 5, ny: 2, door: 0, roof: false }, 32],
    ["shed", { nx: 4, nz: 4, ny: 3, door: 0 }, 46],
    ["granary", { nx: 3, nz: 3, ny: 7, door: 0 }, 59],
    ["house 5x4", { nx: 5, nz: 4, ny: 4, door: 0 }, 70],
    ["long", { nx: 8, nz: 4, ny: 3, door: 0, cols: true }, 92],
    ["house 6x5", { nx: 6, nz: 5, ny: 4, door: 0, cols: true }, 104],
    ["hangar", { nx: 9, nz: 10, ny: 5, door: -1, slab: true, drive: true }, 115],
    ["chapel", { nx: 5, nz: 6, ny: 5, door: 0, cols: true }, 124],
    ["warehouse", { nx: 8, nz: 6, ny: 4, door: 0, cols: true }, 146],
    ["keep", { nx: 7, nz: 6, ny: 5, door: 0, cols: true }, 156],
  ];
  for (const [name, t, want] of TPLS) {
    const got = stoneCount(t);
    ok(`T1a: ${name} costs ${want} stones`, got === want, String(got));
  }
}

// ==== T1b: the plan equals the lay, every building, 200 seeds ===============
// stoneCount against the sliced buildTown's own n0, every non-depot entry.
// The depots are the precast branch and are deliberately outside stoneCount.
{
  let buildings = 0, mismatches = 0, firstMiss = null;
  for (let s = 1; s <= 200; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const st = Mi.state();
    const world = makeWorld({ field: flatF, seed: 7 });
    world._tdStruct = true;
    const g = Mi.makeGrid(null);
    const out = Mi.buildTown(world, g, flatF);
    for (let i = 0; i < st.TOWN.length; i++) {
      const t = st.TOWN[i];
      if (t.depot) continue;
      buildings++;
      const plan = stoneCount(t);
      if (plan !== out[i].n0) {
        mismatches++;
        if (!firstMiss) firstMiss = `${t.id} seed ${s}: plan ${plan}, laid ${out[i].n0}`;
      }
    }
  }
  ok("T1b: the plan equals the lay on every building over 200 seeds",
    mismatches === 0, firstMiss || `${buildings} buildings`);
  ok("T1b: 3,586 buildings measured over seeds 1-200", buildings === 3586, String(buildings));
}

// ==== T1c: no seed plans past the cap, 500 seeds ============================
// No seed is special: the law is the cap, asserted over the whole sweep; the
// worst value is REPORTED in the detail, never pinned to a named seed.
{
  let worst = 0, over = 0;
  for (let s = 1; s <= 500; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const st = Mi.state();
    let n = 0;
    for (const t of st.TOWN) if (!t.depot) n += stoneCount(t);
    if (n > worst) worst = n;
    if (n > TOWN_STONE_CAP) over++;
  }
  ok("T1c: no seed plans past TOWN_STONE_CAP over 500 seeds", over === 0, `worst ${worst}`);
}

// ==== T1d: the constants ====================================================
{
  const rsrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("T1d: the pool rises to 4000 (owner, 2026-08-26)", /const CHUNK_CAP = 4000;/.test(rsrc));
  ok("T1d: TOWN_STONE_CAP is 3000", TOWN_STONE_CAP === 3000);
}

// ==== T2: BORN RUINS (mk2.62) ===============================================
// A dead entry lays as one of four ruin forms; it is ruined from its first
// frame — no flag, no pay, open cells. No draw moves: the form derives from
// the already-drawn decay value. Fixture seeds 1-200; the crossing's map is
// DISCOVERED by the sweep (first map holding a mound), never named.

// T2a: the four forms' arithmetic on one exemplar entry.
{
  console.log("\n[settled t2: born ruins]");
  const EX = [["shell", 26], ["stump", 14], ["mound", 10], ["chimney", 5]];
  for (const [form, want] of EX) {
    const got = stoneCount({ nx: 4, nz: 4, ny: 3, door: 0, dead: true, form });
    ok(`T2a: the ${form} costs ${want} stones on the 4x4x3 exemplar`, got === want, String(got));
  }
}

// T2b/T2c: the sweep — every form appears, every born ruin is ruined with
// open cells, and the T1b equality pin above already holds over dead entries.
{
  let dead = 0, badRow = 0, badCell = 0;
  const seen = new Set();
  for (let s = 1; s <= 200; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const st = Mi.state();
    const world = makeWorld({ field: flatF, seed: 7 });
    world._tdStruct = true;
    const g = Mi.makeGrid(null);
    const out = Mi.buildTown(world, g, flatF);
    for (let i = 0; i < st.TOWN.length; i++) {
      const t = st.TOWN[i];
      if (!t.dead) continue;
      dead++;
      seen.add(t.form);
      if (out[i].ruined !== true) badRow++;
      for (const ci of out[i].cells) if (g.cells[ci].blocked) badCell++;
    }
  }
  ok("T2b: 607 born ruins over seeds 1-200, all four forms drawn", dead === 607 && seen.size === 4, `${dead} dead, forms ${[...seen].sort().join(",")}`);
  ok("T2c: every born ruin is ruined from its first frame", badRow === 0, String(badRow));
  ok("T2c: no born ruin blocks a cell", badCell === 0, String(badCell));
}

// T2d: a born ruin pays neither side, even on held ground.
{
  const T = { cs: 2, nx: 4, nz: 4, halfU: 4, halfV: 4, v: new Float32Array(16).fill(1) };
  const pay = payTown([{ x: 0, z: 0, ruined: true }], T);
  ok("T2d: a born ruin pays nothing", pay.player === 0 && pay.regiment === 0, `p${pay.player} r${pay.regiment}`);
}

// T2e: THE CROSSING — a rifle squad marches straight through a rubble mound
// and arrives whole. The mound's map is the first the sweep finds holding
// one; the seed is discovered each run, never pinned.
{
  const flatW = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  let found = null;
  for (let s = 1; s <= 200 && !found; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const m = Mi.state().TOWN.find((t) => t.dead && t.form === "mound");
    if (m) found = { Mi, m };
  }
  ok("T2e: a mound exists to cross", !!found);
  if (found) {
    const { Mi, m } = found;
    const world = makeWorld({ field: flatW, seed: 9 });
    world._tdStruct = true; world.depotCombat = true;
    world.inRim = () => true; world.pondAt = () => false; world.streamAt = () => false;
    Mi.buildTown(world, Mi.makeGrid(null), flatW);
    const sq = makeSquad(1, "rifles", 1, m.x - 8, m.z);
    spawnSquadMembers(world, sq);
    const DEST = { x: m.x + 8, z: m.z };
    sq.order = "move"; sq.dest = { ...DEST };
    for (let i = 0; i < 60 * 120; i++) { stepSquad(world, sq, 1 / 120); stepWorld(world); }
    let worst = 0, alive = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (u && u.alive) { alive++; worst = Math.max(worst, Math.hypot(u.pos.x - DEST.x, u.pos.z - DEST.z)); }
    }
    ok("T2e: all four men cross the mound alive and arrive within 3.5m in 60s", alive === 4 && worst < 3.5, `alive ${alive}, worst ${worst.toFixed(2)}m`);
  }
}

// T2f: source pins — the generation seams.
{
  const mg = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  ok("T2f: the old ruins are born shells", /"oldruin" \+ placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "shell"/.test(mg));
  ok("T2f: makeMap's stamp loop skips the dead", /if \(t\.dead\) continue; \/\/ T2: a born ruin blocks no cell/.test(mg));
  ok("T2f: the bench form derives from the drawn decay value, no new draw", /decay < 0\.195 \? "shell" : decay < 0\.27 \? "stump" : decay < 0\.345 \? "mound" : "chimney"/.test(mg));
}
