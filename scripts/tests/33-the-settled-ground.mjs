// COLDSNAP suite file 33 — THE SETTLED GROUND. Re-taught mk2.63 (the settled
// valley): the sweep draws its maps AT RANDOM every run — no specific seeds,
// no exact totals — and asserts laws that hold on any
// map. Drawn seeds are logged so a red is traceable. Template pins are pure
// arithmetic, no map involved. World-rng constants seed physics fixtures
// only, never a map.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeWorld, addBody, addWeld, mulberry32 } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { stoneCount, TOWN_STONE_CAP } from "../../src/depot/mapgen.js";
import { payTown } from "../../src/depot/economy.js";
import { planRoute } from "../../src/depot/route.js";

const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
const mgSrc = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
// stepSquadRouting/townFootprint/buildTown moved to sim.js (war-engine-
// extraction task 1) — sliceFn's third fallback.
const simSrc = fs.readFileSync(new URL("../../src/depot/sim.js", import.meta.url), "utf8");
const sliceFn = (name) => {
  let start = src.indexOf(`\nfunction ${name}(`), rest;
  if (start >= 0) { rest = src.slice(start + 1); }
  else {
    start = mgSrc.indexOf(`\nexport function ${name}(`);
    if (start >= 0) { rest = mgSrc.slice(start + 1).replace(/^export /, ""); }
    else {
      start = simSrc.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("file 33 extract: missing function " + name);
      rest = simSrc.slice(start + 1).replace(/^export /, "");
    }
  }
  const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
  return rest.slice(0, m < 0 ? rest.length : m + 9);
};
const header = mgSrc.slice(mgSrc.indexOf("const GRID_CS"), mgSrc.indexOf("const TOWN_STONE_CAP")).replace(/^export /gm, "");
const mapSrc = [
  header,
  "const TOWN_STONE_CAP = " + TOWN_STONE_CAP + ";",
  sliceFn("formOf"), sliceFn("layDressing"), sliceFn("stoneCount"),
  sliceFn("genMap"), "const liveGameMap = () => null; // task-2a harness stub: sliced makeMap's return, unused here", sliceFn("makeMap"), sliceFn("streamAt"), sliceFn("pondAt"), sliceFn("rockAt"),
  sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("stepSquadRouting"), sliceFn("townFootprint"), sliceFn("buildTown"),
  `  return { makeMap, makeGrid, buildTown: (w, g, f) => buildTown(w, g, f, { TOWN, OBJ_POS, MAP_SEED, GRID_W, GRID_H }), checkConnectivity, stepSquadRouting, state: () => ({ TOWN, MAP_SEED, OBJ_POS, SPAWN_POINTS, CLUSTERS }) };`,
].join("\n");
const mkMap = () => new Function(
  "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", "planRoute", mapSrc,
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld, planRoute);
const flatF = { heightAt: () => 0 };

// ==== the template pins: pure arithmetic, no map =============================
{
  console.log("\n[settled: the template pins]");
  const TPLS = [
    ["croft", {"id":"croft0","nx":4,"nz":3,"ny":3,"door":0}, 31],
    ["watch", {"id":"watch0","nx":2,"nz":2,"ny":8,"door":0}, 33],
    ["yard", {"id":"yard0","nx":6,"nz":5,"ny":2,"door":0,"roof":false}, 32],
    ["shed", {"id":"shed0","nx":4,"nz":4,"ny":3,"door":0}, 39],
    ["granary", {"id":"granary0","nx":3,"nz":3,"ny":7,"door":0}, 57],
    ["house 5x4", {"id":"house0","nx":5,"nz":4,"ny":4,"door":0}, 59],
    ["long", {"id":"long0","nx":8,"nz":4,"ny":3,"door":0,"cols":true}, 69],
    ["house 6x5", {"id":"house1","nx":6,"nz":5,"ny":4,"door":0,"cols":true}, 87],
    ["hangar", {"id":"hangar0","nx":9,"nz":10,"ny":5,"door":-1,"slab":true,"drive":true}, 121],
    ["chapel", {"id":"chapel0","nx":5,"nz":6,"ny":5,"door":0,"cols":true}, 107],
    ["warehouse", {"id":"warehouse0","nx":8,"nz":6,"ny":4,"door":0,"cols":true}, 103],
    ["keep", {"id":"keep0","nx":7,"nz":6,"ny":5,"door":0,"cols":true,"cren":true}, 127],
    ["shell 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"shell"}, 28],
    ["stump 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"stump"}, 14],
    ["mound 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"mound"}, 10],
    ["chimney 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"chimney"}, 5],
    ["row houses", {"id":"row0","nx":9,"nz":4,"ny":3,"door":0,"parts":[3,6]}, 83],
    ["inn", {"id":"inn0","nx":6,"nz":5,"ny":4,"door":0,"cols":true}, 89],
    ["inn yard", {"id":"innyard0","nx":6,"nz":5,"ny":2,"door":-1,"roof":false}, 36],
    ["smithy", {"id":"smithy0","nx":4,"nz":3,"ny":3,"door":0}, 35],
    ["smithy chimney", {"id":"chimneyc0","nx":1,"nz":1,"ny":5,"door":-1,"roof":false}, 5],
    ["well", {"id":"well0","nx":2,"nz":2,"ny":1,"door":-1,"roof":false}, 9],
    ["mill", {"id":"mill0","nx":3,"nz":3,"ny":6,"door":0}, 58],
    ["bell tower", {"id":"belltower0","nx":2,"nz":2,"ny":8,"door":-1,"roof":false}, 38],
    ["graveyard", {"id":"graveyard0","nx":6,"nz":5,"ny":2,"door":-1,"roof":false,"stones":true}, 40],
    ["wayside cross", {"id":"cross0","nx":1,"nz":1,"ny":2,"door":-1,"roof":false}, 2],
    ["gatepost", {"id":"gatepost0","nx":1,"nz":1,"ny":3,"door":-1,"roof":false}, 4],
    ["springhouse", {"id":"spring0","nx":2,"nz":2,"ny":2,"door":0}, 11],
  ];
  for (const [name, t, want] of TPLS) {
    const got = stoneCount(t);
    ok(`templates: ${name} costs ${want} stones`, got === want, String(got));
  }
}

// ==== THE RANDOM SWEEP: laws on ground nobody chose ==========================
{
  console.log("\n[settled: the random sweep]");
  const seeds = Array.from({ length: 40 }, () => 1 + Math.floor(Math.random() * 1000000));
  console.log("[settled sweep] seeds: " + seeds.join(","));
  let mism = 0, firstMiss = null, badRow = 0, badCell = 0, over = 0, worstPlan = 0;
  let townless = 0, hamletless = 0, badMarker = 0, conn = 0, moundOpen = 0;
  const forms = new Set();
  for (const s of seeds) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const st = Mi.state();
    const world = makeWorld({ field: flatF, seed: 7 });
    world._tdStruct = true;
    const g = Mi.makeGrid(null);
    const out = Mi.buildTown(world, g, flatF);
    let planned = 0;
    for (let i = 0; i < st.TOWN.length; i++) {
      const t = st.TOWN[i];
      if (t.depot) continue;
      const plan = stoneCount(t);
      planned += plan;
      if (plan !== out[i].n0) { mism++; if (!firstMiss) firstMiss = `${t.id} seed ${s}: plan ${plan}, laid ${out[i].n0}`; }
      if (t.dead) {
        forms.add(t.form);
        if (out[i].ruined !== true) badRow++;
        if (t.form !== "mound") { for (const ci of out[i].cells) if (g.cells[ci].blocked) badCell++; }
        else { for (const ci of out[i].cells) if (!g.cells[ci].blocked) moundOpen++; }
      }
      if (t.marker && out[i].marker !== true) badMarker++;
    }
    if (planned > TOWN_STONE_CAP) over++;
    if (planned > worstPlan) worstPlan = planned;
    if (!st.CLUSTERS.some((c) => c.kind === "town")) townless++;
    if (!st.CLUSTERS.some((c) => c.kind === "hamlet")) hamletless++;
    const og = g.worldToGrid(st.OBJ_POS.x, st.OBJ_POS.z);
    if (Mi.checkConnectivity(g, st.SPAWN_POINTS, og.gx, og.gz)) conn++;
  }
  ok("sweep law: the plan equals the lay on every building", mism === 0, firstMiss || "0 mismatches");
  ok("sweep law: every born ruin is ruined from its first frame", badRow === 0, String(badRow));
  ok("sweep law: no born ruin blocks a cell", badCell === 0, String(badCell));
  ok("sweep law: every mound blocks its ground", moundOpen === 0, String(moundOpen));
  ok("sweep law: all four ruin forms occur on random ground", forms.size === 4, [...forms].sort().join(","));
  ok("sweep law: no map plans past TOWN_STONE_CAP", over === 0, `worst ${worstPlan}`);
  ok("sweep law: every map seats a town", townless === 0, String(townless));
  ok("sweep law: every map raises hamlets", hamletless === 0, String(hamletless));
  ok("sweep law: every marker entry carries its marker", badMarker === 0, String(badMarker));
  ok("sweep law: spawns reach the objective on every map", conn === 40, `${conn}/40`);
}

// ==== pay laws: born ruins and markers pay nobody ============================
{
  const T = { cs: 2, nx: 4, nz: 4, halfU: 4, halfV: 4, v: new Float32Array(16).fill(1) };
  const pay = payTown([{ x: 0, z: 0, ruined: true }, { x: 0, z: 0, marker: true }], T);
  ok("pay law: born ruins and markers pay nothing", pay.player === 0 && pay.regiment === 0, `p${pay.player} r${pay.regiment}`);
  const pay2 = payTown([{ x: 0, z: 0 }], T);
  ok("pay law: a standing building still pays its holder", pay2.player > 0, String(pay2.player));
}

// ==== source pins: the seams and the constants ===============================
{
  ok("pins: TOWN_STONE_CAP is 6000 (re-taught mk2.65)", TOWN_STONE_CAP === 6000);
}
