// COLDSNAP suite file 33 — THE SETTLED GROUND. Re-taught mk2.63 (the settled
// valley): the sweep draws its maps AT RANDOM every run — no specific seeds,
// no exact totals (owner, 2026-08-26) — and asserts laws that hold on any
// map. Drawn seeds are logged so a red is traceable. Template pins are pure
// arithmetic, no map involved. World-rng constants seed physics fixtures
// only, never a map.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeWorld, addBody, addWeld, stepWorld, mulberry32 } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { stoneCount, TOWN_STONE_CAP } from "../../src/depot/mapgen.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { payTown } from "../../src/depot/economy.js";
import { planRoute } from "../../src/depot/route.js";

const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
const mgSrc = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
const sliceFn = (name) => {
  let start = src.indexOf(`\nfunction ${name}(`), rest;
  if (start >= 0) { rest = src.slice(start + 1); }
  else {
    start = mgSrc.indexOf(`\nexport function ${name}(`);
    if (start < 0) throw new Error("file 33 extract: missing function " + name);
    rest = mgSrc.slice(start + 1).replace(/^export /, "");
  }
  const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
  return rest.slice(0, m < 0 ? rest.length : m + 9);
};
const header = mgSrc.slice(mgSrc.indexOf("const GRID_CS"), mgSrc.indexOf("const TOWN_STONE_CAP")).replace(/^export /gm, "");
const mapSrc = [
  header,
  "const TOWN_STONE_CAP = " + TOWN_STONE_CAP + ";",
  sliceFn("stoneCount"),
  sliceFn("genMap"), sliceFn("makeMap"), sliceFn("streamAt"), sliceFn("pondAt"), sliceFn("rockAt"),
  sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("stepSquadRouting"), sliceFn("townFootprint"), sliceFn("buildTown"),
  `return { makeMap, makeGrid, buildTown, checkConnectivity, stepSquadRouting, state: () => ({ TOWN, MAP_SEED, OBJ_POS, SPAWN_POINTS, CLUSTERS }) };`,
].join("\n");
const mkMap = () => new Function(
  "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", "planRoute", mapSrc,
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld, planRoute);
const flatF = { heightAt: () => 0 };

// ==== the template pins: pure arithmetic, no map =============================
{
  console.log("\n[settled: the template pins]");
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
    ["shell 4x4x3", { nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "shell" }, 26],
    ["stump 4x4x3", { nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "stump" }, 14],
    ["mound 4x4x3", { nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "mound" }, 10],
    ["chimney 4x4x3", { nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "chimney" }, 5],
    ["row houses", { nx: 9, nz: 4, ny: 3, door: 0, parts: [3, 6] }, 108],
    ["inn", { nx: 6, nz: 5, ny: 4, door: 0, cols: true }, 104],
    ["inn yard", { nx: 6, nz: 5, ny: 2, door: -1, roof: false }, 36],
    ["smithy", { nx: 4, nz: 3, ny: 3, door: 0 }, 36],
    ["smithy chimney", { nx: 1, nz: 1, ny: 5, door: -1, roof: false }, 5],
    ["well", { nx: 2, nz: 2, ny: 1, door: -1, roof: false }, 4],
    ["mill", { nx: 3, nz: 3, ny: 6, door: 0 }, 51],
    ["bell tower", { nx: 2, nz: 2, ny: 8, door: -1, roof: false }, 32],
    ["graveyard", { nx: 6, nz: 5, ny: 2, door: -1, roof: false, stones: true }, 40],
    ["wayside cross", { nx: 1, nz: 1, ny: 2, door: -1, roof: false }, 2],
    ["gatepost", { nx: 1, nz: 1, ny: 3, door: -1, roof: false }, 3],
    ["springhouse", { nx: 2, nz: 2, ny: 2, door: 0 }, 9],
  ];
  for (const [name, t, want] of TPLS) {
    const got = stoneCount(t);
    ok(`templates: ${name} costs ${want} stones`, got === want, String(got));
  }
}

// ==== THE RANDOM SWEEP: laws on ground nobody chose ==========================
let sweepMound = null;
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
        if (t.form === "mound" && !sweepMound) sweepMound = { Mi, m: t };
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

// ==== the way around: a squad ordered past a mound arrives ==================
// The mound blocks its cells (owner, 2026-08-26: too dense to walk, men go
// around); the real router carries the squad past it. Routing every tick,
// then the legs — the live game's own loop.
{
  ok("around: the random sweep turned up a mound", !!sweepMound);
  if (sweepMound) {
    const { Mi, m } = sweepMound;
    const flatW = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const world = makeWorld({ field: flatW, seed: 9 });
    world._tdStruct = true; world.depotCombat = true;
    world.inRim = () => true; world.pondAt = () => false; world.streamAt = () => false;
    const g = Mi.makeGrid(null);
    Mi.buildTown(world, g, flatW);
    const sq = makeSquad(1, "rifles", 1, m.x - 8, m.z);
    spawnSquadMembers(world, sq);
    const DEST = { x: m.x + 8, z: m.z };
    sq.order = "move"; sq.dest = { ...DEST };
    for (let i = 0; i < 60 * 120; i++) { Mi.stepSquadRouting(g, sq, world); stepSquad(world, sq, 1 / 120); stepWorld(world); }
    let worst = 0, alive = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (u && u.alive) { alive++; worst = Math.max(worst, Math.hypot(u.pos.x - DEST.x, u.pos.z - DEST.z)); }
    }
    ok("around: all four men arrive past the mound, within 3.5m in 60s", alive === 4 && worst < 3.5, `alive ${alive}, worst ${worst.toFixed(2)}m`);
  }
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
  const rsrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("pins: makeMap's stamp loop skips the dead, bar the mound (owner, 2026-08-26)", /if \(t\.dead && t\.form !== "mound"\) continue;/.test(mgSrc));
  ok("pins: the flag rows skip markers", /m\.depot \|\| m\.fwall \|\| m\.marker \|\| b\.ruined/.test(src));
  ok("pins: the pool is 4000", /const CHUNK_CAP = 4000;/.test(rsrc));
  ok("pins: TOWN_STONE_CAP is 3000", TOWN_STONE_CAP === 3000);
}
