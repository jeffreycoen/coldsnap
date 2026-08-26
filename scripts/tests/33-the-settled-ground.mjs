// COLDSNAP suite era 33 — THE SETTLED GROUND Task 1 (mk2.61): the stone
// count. mapgen plans in the currency the builder pays: stoneCount(t) is
// the count of what buildTown lays for a town entry, by the builder's own
// lay rules, and TOWN_STONE_CAP 3000 is the planner's ceiling (owner,
// 2026-08-26; the pool rises to 4000 beside it). Fixture seeds: 1-200 for
// the equality sweep, 1-500 for the cap. No seed is special: the cap is
// asserted over the whole sweep, the worst value reported, never pinned.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeWorld, addBody, addWeld, mulberry32 } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { stoneCount, TOWN_STONE_CAP } from "../../src/depot/mapgen.js";

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
