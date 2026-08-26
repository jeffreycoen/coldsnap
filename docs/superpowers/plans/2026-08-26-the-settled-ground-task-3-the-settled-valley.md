# The Settled Ground — Task 3: The Settled Valley (mk2.63)

*Written by Claude Fable 5, 2026-08-26, against mk2.62 (commit f47b0fc). Skeleton rulings 3, 4, 5 (the markers, the cluster counts, the form roster) and the random ground rule. This replaces the served test-only Task 3 plan by the owner's order: the buildings and the fuller map are the work. Every code block below ran green in a scratch copy — three full random-sweep runs, zero failures, before this plan was served. Suggested model: Sonnet — the code is fully specified.*

## What this task does

The new buildings, and a map that reads as settled ground. The bench scatter and the lone old-ruin loop retire. Every valley now raises: ONE TOWN (four to seven buildings around a chapel — with its bell tower or walled graveyard — or an inn with its yard; row houses, houses, crofts, a smithy with its chimney, a wayside cross; near a road when the map drew one, gateposts flanking it; doors face the center), TWO OR THREE HAMLETS (crofts and sheds around a yard or a well), ONE OR TWO DEAD HAMLETS (born ruins — shells, stumps, mounds, chimneys — pulled toward a hill), ONE TO THREE SINGLES (mill, keep, watch tower, granary, long house), a SPRINGHOUSE beside a pond, and the big forms and field walls exactly as now. Placement plans in stones and stops at the cap.

Measured on random ground: about 29 buildings a map, up from 14 today. All twelve new forms place. Spawn-to-objective connectivity held on every swept map. Worst planned count about 1,750 of the 3,000 cap.

Markers (ruling 3): the wayside cross, the gateposts, the smithy's chimney, and the springhouse (9 stones) fly no flag and pay nothing. The well pays, by your word.

## Required reading

The report opens by confirming each was read: this plan whole; the skeleton (rulings 3-5 and the random ground rule); `src/depot/mapgen.js` whole; `src/depot/DepotGame.jsx:202-400`; `src/depot/economy.js`; `scripts/tests/33-the-settled-ground.mjs`; `scripts/tests/05-the-front.mjs:514-605`; `src/version.js`.

## Licensed re-teaches — the tests this task must move

1. `scripts/tests/33-the-settled-ground.mjs` is REPLACED WHOLE (Step 2). Its fixed seed ranges and exact totals break with the new generation and conflict with the random ground rule; the new file sweeps random maps and asserts laws.
2. `scripts/tests/05-the-front.mjs` FRONT T6 block is REPLACED (Step 7): the pinned map-1000 hash breaks with the new generation, and a pinned map is against the random ground rule. The twin battle replaces it — one random logged seed, the same war fought twice, identical hash and draw count. This ends the re-pin churn for good.
3. Nothing else. The era-05 sweep bounds (big forms 2-4, walls 2-5, worst boot under 2,900) and `08-debug-pass` bounds must pass untouched — the sweeps re-measure live and the new maps stay well inside. Any other red stops the task.

## Steps

### Step 1 — the mark

`src/version.js:6`: `mk2.62` → `mk2.63`.

### Step 2 — the failing asserts: the phase's test file, replaced whole

Replace the entire content of `scripts/tests/33-the-settled-ground.mjs` with the block below. Run `node scripts/gate.mjs depot-test` and confirm the new-form template pins and cluster laws FAIL (the forms don't exist yet). Record the failure lines.

```js
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
  sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("townFootprint"), sliceFn("buildTown"),
  `return { makeMap, makeGrid, buildTown, checkConnectivity, state: () => ({ TOWN, MAP_SEED, OBJ_POS, SPAWN_POINTS, CLUSTERS }) };`,
].join("\n");
const mkMap = () => new Function(
  "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc,
)(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
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
  let townless = 0, hamletless = 0, badMarker = 0, conn = 0;
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
        for (const ci of out[i].cells) if (g.cells[ci].blocked) badCell++;
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
  ok("sweep law: all four ruin forms occur on random ground", forms.size === 4, [...forms].sort().join(","));
  ok("sweep law: no map plans past TOWN_STONE_CAP", over === 0, `worst ${worstPlan}`);
  ok("sweep law: every map seats a town", townless === 0, String(townless));
  ok("sweep law: every map raises hamlets", hamletless === 0, String(hamletless));
  ok("sweep law: every marker entry carries its marker", badMarker === 0, String(badMarker));
  ok("sweep law: spawns reach the objective on every map", conn === 40, `${conn}/40`);
}

// ==== the crossing: a squad walks through a mound the sweep happened on =====
{
  ok("crossing: the random sweep turned up a mound", !!sweepMound);
  if (sweepMound) {
    const { Mi, m } = sweepMound;
    const flatW = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
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
    ok("crossing: all four men cross the mound alive, within 3.5m in 60s", alive === 4 && worst < 3.5, `alive ${alive}, worst ${worst.toFixed(2)}m`);
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
  ok("pins: makeMap's stamp loop skips the dead", /if \(t\.dead\) continue; \/\/ T2: a born ruin blocks no cell/.test(mgSrc));
  ok("pins: the flag rows skip markers", /m\.depot \|\| m\.fwall \|\| m\.marker \|\| b\.ruined/.test(src));
  ok("pins: the pool is 4000", /const CHUNK_CAP = 4000;/.test(rsrc));
  ok("pins: TOWN_STONE_CAP is 3000", TOWN_STONE_CAP === 3000);
}
```

### Step 3 — mapgen: the form book

In `src/depot/mapgen.js`, replace the whole `const TPL = [ ... ];` table (`:159-165`) with:

```js
  // THE FORM BOOK (mk2.63, owner): every shape the valley can lay. The old
  // ten stay; the new forms join — row houses with partition walls, the inn
  // with its yard, the smithy with its chimney, the well, the mill, the bell
  // tower and graveyard as chapel children, the wayside cross, the gateposts,
  // the springhouse. marker: no flag, no pay (the field walls' standing).
  const F = {
    croft: { t: "croft", nx: 4, nz: 3, ny: 3 },
    house6: { t: "house", nx: 6, nz: 5, ny: 4, cols: true },
    house5: { t: "house", nx: 5, nz: 4, ny: 4 },
    long: { t: "long", nx: 8, nz: 4, ny: 3, cols: true },
    watch: { t: "watch", nx: 2, nz: 2, ny: 8 },
    granary: { t: "granary", nx: 3, nz: 3, ny: 7 },
    yard: { t: "yard", nx: 6, nz: 5, ny: 2, roof: false },
    shed: { t: "shed", nx: 4, nz: 4, ny: 3 },
    chapel: { t: "chapel", nx: 5, nz: 6, ny: 5, cols: true },
    keep: { t: "keep", nx: 7, nz: 6, ny: 5, cols: true },
    row: { t: "row", nx: 9, nz: 4, ny: 3, parts: [3, 6], noswap: true },
    inn: { t: "inn", nx: 6, nz: 5, ny: 4, cols: true, child: "innyard" },
    innyard: { t: "innyard", nx: 6, nz: 5, ny: 2, roof: false, door: -1 },
    smithy: { t: "smithy", nx: 4, nz: 3, ny: 3, child: "chimneyc" },
    chimneyc: { t: "chimneyc", nx: 1, nz: 1, ny: 5, roof: false, door: -1, marker: true },
    well: { t: "well", nx: 2, nz: 2, ny: 1, roof: false, door: -1 },
    mill: { t: "mill", nx: 3, nz: 3, ny: 6 },
    belltower: { t: "belltower", nx: 2, nz: 2, ny: 8, roof: false, door: -1 },
    graveyard: { t: "graveyard", nx: 6, nz: 5, ny: 2, roof: false, door: -1, stones: true },
    cross: { t: "cross", nx: 1, nz: 1, ny: 2, roof: false, door: -1, marker: true },
    gatepost: { t: "gatepost", nx: 1, nz: 1, ny: 3, roof: false, door: -1, marker: true },
    spring: { t: "spring", nx: 2, nz: 2, ny: 2, marker: true },  // 9 stones — under the marker line (ruling 3)
  };
```

### Step 4 — mapgen: the settled valley

Replace the region from the line `// T2: benches between consecutive bands, plus the last band to depot ground.` (`:215`) through the end of the old-ruin loop (the line `placed++;` and its closing `}` at `:245-246`) — that is, everything between the big-forms loop and the `// T4: FIELD WALLS` comment — with:

```js
  // THE SETTLED VALLEY (mk2.63, owner): clusters replace the bench scatter —
  // one town, hamlets, dead hamlets, singles. Places, not sprinkles.
  // Placement plans in stones (stoneCount) and stops at TOWN_STONE_CAP.
  const benches = [];
  for (let i = 0; i + 1 < bands.length; i++) benches.push([bands[i] + 8, bands[i + 1] - 7]);
  benches.push([bands[bands.length - 1] + 8, depotDepth - 8]);
  const CL = [];
  let plannedStones = 0;
  // the one vet every placement runs — the standing foul checks, shared.
  const vetAt = (x, z, nx, nz, offRoad) => {
    const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
    if (x < -78 || x > 78 || z < -69 || z > 69) return false;
    if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) return false;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 4)) return false;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) return false;
    if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) return false;
    if (offRoad && roadDist(x, z) < rad + 3) return false;
    if (STREAM_ON && Math.abs(z - streamV) < rad + 9) return false;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) return false;
    return true;
  };
  // put: one entry down if it vets and the stone budget allows. Doors face
  // the cluster's center when one is given; door -1 templates keep no door.
  const put = (fk, x, z, opts) => {
    const tpl = F[fk];
    const swap = tpl.noswap ? false : r() < 0.5;
    const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
    if (!vetAt(x, z, nx, nz, !(opts && opts.onRoad))) return null;
    const e = { id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny,
      door: tpl.door === -1 ? -1 : (opts && opts.face != null ? (x > opts.face.x ? 0 : nx - 1) : (r() < 0.5 ? 0 : nx - 1)),
      roof: tpl.roof, cols: tpl.cols, parts: tpl.parts, stones: tpl.stones, marker: tpl.marker,
      dead: opts && opts.dead ? true : undefined, form: opts && opts.form };
    const cost = stoneCount(e);
    if (plannedStones + cost > TOWN_STONE_CAP) return null;
    plannedStones += cost;
    town.push(e);
    return e;
  };
  // a child stands against its parent — tried on four sides, first that vets.
  const putChild = (fk, p, opts) => {
    const tpl = F[fk];
    // snug against the parent: the shared vet would push a child a building's
    // width away, so a child vets against everything EXCEPT its own parent.
    const gap = ((Math.max(p.nx, p.nz) + Math.max(tpl.nx, tpl.nz)) / 2) * MASON.pitch + 0.9;
    const s0 = Math.floor(r() * 4);
    for (let i = 0; i < 4; i++) {
      const a = ((s0 + i) % 4) * Math.PI / 2;
      const x = p.x + Math.sin(a) * gap, z = p.z + Math.cos(a) * gap;
      const swap = tpl.noswap ? false : r() < 0.5;
      const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
      const pi = town.indexOf(p);
      const others = town.filter((q, qi) => qi !== pi);
      const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
      if (x < -78 || x > 78 || z < -69 || z > 69) continue;
      if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
      if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 4)) continue;
      if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
      if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
      if (roadDist(x, z) < rad + 3) continue;
      if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue;
      if (others.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 1.2)) continue;
      const e = { id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: tpl.door === -1 ? -1 : (r() < 0.5 ? 0 : nx - 1),
        roof: tpl.roof, cols: tpl.cols, parts: tpl.parts, stones: tpl.stones, marker: tpl.marker,
        dead: opts && opts.dead ? true : undefined, form: opts && opts.form };
      const cost = stoneCount(e);
      if (plannedStones + cost > TOWN_STONE_CAP) return null;
      plannedStones += cost;
      town.push(e);
      return e;
    }
    return null;
  };
  // a cluster: a center form, then members rung around it. Returns the row
  // CLUSTERS carries so later work can name the ground.
  const cluster = (kind, centerFk, pool, nMin, nMax, seat, opts) => {
    for (let k = 0; k < 40; k++) {
      const cx = seat.x0 + r() * (seat.x1 - seat.x0), cz = seat.z0 + r() * (seat.z1 - seat.z0);
      if (opts && opts.nearRoad && roads.length && k < 25 && (roadDist(cx, cz) < 5 || roadDist(cx, cz) > 20)) continue;
      if (opts && opts.nearHill && hills.length && k < 25 && !hills.some((h) => Math.hypot(cx - h.u, cz - h.v) < h.r + 28)) continue;
      const cf = F[centerFk];
      if (!vetAt(cx, cz, cf.nx, cf.nz, true)) continue;
      const center = put(centerFk, cx, cz, opts && opts.dead ? { dead: true, form: "shell" } : null);
      if (!center) continue;
      if (cf.child) putChild(cf.child, center);
      const want = nMin + Math.floor(r() * (nMax - nMin + 1));
      let got = 0;
      for (let m = 0; m < want * 6 && got < want; m++) {
        const fk = pool[Math.floor(r() * pool.length)];
        const a = r() * 6.28, d = 9 + r() * 8;
        const dd = opts && opts.dead ? { dead: true, form: ["shell", "stump", "mound", "chimney"][Math.floor(r() * 4)] } : { face: center };
        const e = put(fk, cx + Math.sin(a) * d, cz + Math.cos(a) * d, dd);
        if (e) { got++; if (F[fk].child && !dd.dead) putChild(F[fk].child, e); }
      }
      const row = { kind, x: cx, z: cz, r: 18, n: got + 1 };
      CL.push(row);
      return row;
    }
    return null;
  };
  const midBench = benches[Math.floor(benches.length / 2)];
  // THE TOWN — one, near a road when the map drew one, the chapel (with its
  // tower or its graveyard) or the inn at the center, gateposts on the road.
  const centerPick = r();
  const townCenterFk = centerPick < 0.4 ? "chapel" : centerPick < 0.7 ? "inn" : "chapel";
  const TOWN_POOL = ["row", "house6", "house5", "croft", "long", "shed", "smithy", "cross"];
  let townRow = cluster("town", townCenterFk, TOWN_POOL,
    4, 7, { x0: -60, z0: midBench[0], x1: 60, z1: Math.max(midBench[0] + 4, midBench[1]) },
    roads.length ? { nearRoad: true } : null);
  // a refused middle bench does not leave the valley townless — every bench
  // gets its turn, roads-near first, then anywhere.
  for (let bi = 0; !townRow && bi < benches.length; bi++) {
    townRow = cluster("town", townCenterFk, TOWN_POOL,
      4, 7, { x0: -70, z0: benches[bi][0], x1: 70, z1: Math.max(benches[bi][0] + 4, benches[bi][1]) }, null);
  }
  if (townRow) {
    const ct = town.find((q) => Math.hypot(q.x - townRow.x, q.z - townRow.z) < 4);
    if (ct && ct.id.indexOf("chapel") === 0) putChild(centerPick < 0.4 ? "belltower" : "graveyard", ct);
    if (roads.length) { // the gateposts flank the road at the town's edge
      for (const sgn of [-1, 1]) {
        for (let g = 0; g < 12; g++) {
          const gx = townRow.x + (r() - 0.5) * 30, gz = townRow.z + (r() - 0.5) * 30;
          if (roadDist(gx, gz) > 4.5 || roadDist(gx, gz) < 2.5) continue;
          if (put("gatepost", gx, gz, { onRoad: true })) break;
        }
      }
    }
  }
  // THE HAMLETS — two or three, off the roads, crofts and sheds about a yard
  // or a well.
  const nHam = 2 + Math.floor(r() * 2);
  for (let h = 0; h < nHam; h++) {
    const b0 = Math.floor(r() * benches.length);
    const ctr = r() < 0.5 ? "yard" : "well";
    // a refused bench does not lose the hamlet — every bench gets its turn.
    for (let bi = 0; bi < benches.length; bi++) {
      const b = benches[(b0 + bi) % benches.length];
      if (cluster("hamlet", ctr, ["croft", "shed", "croft", "smithy"],
        2, 4, { x0: -70, z0: b[0], x1: 70, z1: Math.max(b[0] + 4, b[1]) }, null)) break;
    }
  }
  // THE DEAD HAMLETS — one or two, born ruins with a mound and a chimney,
  // against a hill when the map has one.
  const nDead = 1 + Math.floor(r() * 2);
  for (let h = 0; h < nDead; h++) {
    const bi = Math.floor(r() * benches.length);
    cluster("dead", "croft", ["croft", "shed", "house5"],
      2, 3, { x0: -70, z0: benches[bi][0], x1: 70, z1: Math.max(benches[bi][0] + 4, benches[bi][1]) },
      { dead: true, nearHill: hills.length > 0 });
  }
  // THE SINGLES — one to three lone forms on open ground.
  const nSingle = 1 + Math.floor(r() * 3);
  const SINGLES = ["mill", "keep", "watch", "granary", "long"];
  for (let i = 0, got = 0; i < 40 && got < nSingle; i++) {
    const bi = Math.floor(r() * benches.length);
    const x = -70 + r() * 140, z = benches[bi][0] + r() * Math.max(2, benches[bi][1] - benches[bi][0]);
    if (put(SINGLES[Math.floor(r() * SINGLES.length)], x, z, null)) got++;
  }
  // THE SPRINGHOUSE — beside the first pond, its own vet (it belongs at the
  // water the shared vet keeps everything else away from).
  if (ponds.length) {
    for (let g = 0; g < 12; g++) {
      const q = ponds[0], a = r() * 6.28;
      const sx = q.x + Math.sin(a) * (q.r + 2.2), sz = q.z + Math.cos(a) * (q.r + 2.2);
      const rad = F.spring.nx * MASON.pitch / 2 + 1;
      if (spawns.some((sp) => Math.hypot(sx - sp.x, sz - sp.z) < rad + 4)) continue;
      if (rocks.some((k) => Math.hypot(sx - k.x, sz - k.z) < k.r + rad + 1.5)) continue;
      if (roadDist(sx, sz) < rad + 3) continue;
      if (town.some((t2) => Math.hypot(sx - t2.x, sz - t2.z) < rad + Math.max(t2.nx, t2.nz) * MASON.pitch / 2 + 2)) continue;
      const e = { id: "spring" + bid++, x: sx, z: sz, nx: 2, nz: 2, ny: 2, door: 0, marker: true };
      const cost = stoneCount(e);
      if (plannedStones + cost > TOWN_STONE_CAP) break;
      plannedStones += cost; town.push(e);
      break;
    }
  }
```

### Step 5 — mapgen: three small moves

**5a.** Move the `TOWN_STONE_CAP` line from its place above `stoneCount` to directly above `export function genMap(seed) {` (the settled-valley code calls `stoneCount` and reads the cap from inside `genMap`; the constant must sit above it for the suite's source slicer):

```js
export const TOWN_STONE_CAP = 3000; // owner, 2026-08-26 — provisional until the Pi collapse capture // provisional (F5)
```

**5b.** The `CLUSTERS` export. Add above `export let STREAM = null;`:

```js
export let CLUSTERS = []; // mk2.63: [{kind, x, z, r, n}] — the named ground
```

In `makeMap`, extend the state line `SPAWN_U = m.spawnU; STREAM = m.stream; HILLS = m.hills;` with ` CLUSTERS = m.clusters;` and in `genMap`, replace the return line with:

```js
  for (const c of CL) { const w = fwdU(c.x, c.z); c.x = w.x; c.z = w.z; }
  return { seed, bands, passes, rocks, ponds, spawns, spawnU, town, roads, depotFoul, objU, objV, depotU1, depotU2, depotDepth, stream, hills, clusters: CL };
```

**5c.** `stoneCount` learns the two new lay rules. In its live-form loop, replace the line `if (iy < t.ny && !perim && !colAt(ix, iz)) continue;` with:

```js
    const part = t.parts && t.parts.indexOf(ix) >= 0;
    const stone0 = t.stones && iy === 0 && !perim && ((ix * 31 + iz * 7) % 100) / 100 < 0.35;
    if (iy < t.ny && !perim && !colAt(ix, iz) && !part && !stone0) continue;
```

### Step 6 — the builder and the books

**6a.** `src/depot/DepotGame.jsx`, the live lay (`:318-321` region): replace the line `if (iy < t.ny && !perim && !colAt(ix, iz)) continue;` (directly after the `corner` line) with:

```js
        // mk2.63: partition walls (t.parts) stand full height; a graveyard's
        // headstones (t.stones) are single interior stones on the ground.
        const part = t.parts && t.parts.indexOf(ix) >= 0;
        const stone0 = t.stones && iy === 0 && !perim && ((ix * 31 + iz * 7) % 100) / 100 < 0.35;
        if (iy < t.ny && !perim && !colAt(ix, iz) && !part && !stone0) continue;
```

**6b.** Four marker seams, one line each:

- `buildTown`'s out row gains `marker: !!t.marker` (after `ruined: !!t.dead`).
- The restore path's town row (`:1163` region) gains `marker: !!t.marker` the same way.
- `townUV` (`:1224` region) gains `marker: b.marker`.
- `townFlagMeta` (`:1228`) gains `marker: !!t.marker`, and the flag-row skip (`:3860`) becomes `if (!m || m.depot || m.fwall || m.marker || b.ruined) continue;`.

**6c.** `src/depot/economy.js:16`: `if (b.ruined) continue;` becomes:

```js
    if (b.ruined || b.marker) continue; // mk2.63: markers pay nobody (the field walls' standing; the well is a building and pays)
```

### Step 7 — the twin battle

In `scripts/tests/05-the-front.mjs`, replace the whole FRONT T6 block — from `// ==== FRONT T6:` through `// ==== end FRONT T6 ====...` inclusive — with the block below. The file's existing imports already cover every name; note `sliceFn6("stoneCount")` in the slice list — the new generation needs it.

```js
// ==== FRONT T6: the twin battle ==============================================
// mk2.63, THE RANDOM GROUND (owner, 2026-08-26): the pinned map-1000
// keystone retires — a pinned map is a chosen map. One RANDOM seed, logged;
// the same heavy battle fought twice from scratch; identical world hash and
// draw count is the determinism law. The mk1.05 quiet-books source pins stay.
{
  console.log("\n[front t6: the twin battle]");
  const src6 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const mgSrc6 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  const sliceFn6 = (name) => {
    let start = src6.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = src6.slice(start + 1); }
    else {
      start = mgSrc6.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("T6 extract: missing function " + name);
      rest = mgSrc6.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const header6 = mgSrc6.slice(mgSrc6.indexOf("const GRID_CS"), mgSrc6.indexOf("function genMap")).replace(/^export /gm, "");
  const mapSrc6 = [
    header6,
    sliceFn6("stoneCount"),
    sliceFn6("genMap"), sliceFn6("makeMap"), sliceFn6("streamAt"), sliceFn6("planTrees"),
    sliceFn6("pondAt"), sliceFn6("rockAt"),
    sliceFn6("makeGrid"), sliceFn6("checkConnectivity"), sliceFn6("townFootprint"), sliceFn6("buildTown"),
    sliceFn6("buildDepotTerrain"),
    `return { makeMap, makeGrid, buildTown, buildDepotTerrain, invW, fwdU,
      state: () => ({ ORIENT, TOWN, MAP_SEED }) };`,
  ].join("\n");
  const battle6 = (seed) => {
    const M6 = new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc6,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
    M6.makeMap(seed);
    const st6 = M6.state();
    const field6 = makeField(181, 2.0, st6.MAP_SEED);
    M6.buildDepotTerrain(field6, st6.MAP_SEED);
    const world = makeWorld({ field: field6, seed });
    world._tdStruct = true; world.depotCombat = true;
    M6.buildTown(world, M6.makeGrid(null), field6);
    let draws = 0; const raw6 = world.rng;
    world.rng = () => { draws++; return raw6(); };
    const big6 = st6.TOWN.filter((t) => !t.depot && !t.dead).sort((a, b) => b.nx * b.nz - a.nx * a.nz)[0];
    const sq6 = makeSquad(1, "rifles", 1, big6.x - 20, big6.z);
    spawnSquadMembers(world, sq6);
    sq6.order = "move"; sq6.dest = { x: big6.x + 20, z: big6.z };
    for (let i = 0; i < 8; i++) spawnUnit(world, { x: big6.x - 24 + i * 2, z: big6.z - 18 }, "");
    for (let s = 0; s < 6; s++) {
      const from = { x: big6.x - 12, y: field6.heightAt(big6.x, big6.z) + 6, z: big6.z + (s - 2.5) * 1.2 };
      fireProjectile(world, from, { x: 0.86, y: -0.5, z: 0 }, 60,
        { kind: "shell", r: 3.2, kv: 12, dmg: 55, crater: 0.6, hitStruct: true, attacker: "player" });
    }
    for (let i = 0; i < 1200; i++) {
      stepSquad(world, sq6, 1 / 120);
      stepUnits(world, straightGrid(0, 1), identFwdDir, null, (x, z) => ({ u: x, v: z }));
      stepWorld(world);
    }
    return { hash: worldHash(world), draws, broken: world.welds.filter((w) => w.broken).length };
  };
  const seed6 = 1 + Math.floor(Math.random() * 1000000);
  const run1 = battle6(seed6), run2 = battle6(seed6);
  console.log(`[t6 twin] seed ${seed6} hash ${run1.hash}/${run2.hash} draws ${run1.draws}/${run2.draws}`);
  ok("T6: the twin battle broke real welds (the fixture fights)", run1.broken > 20, `${run1.broken} broken`);
  ok("T6 TWIN: the same seed fights the same war — identical world hash", run1.hash === run2.hash, `${run1.hash} vs ${run2.hash}`);
  ok("T6 TWIN: identical draw count", run1.draws === run2.draws, `${run1.draws} vs ${run2.draws}`);
  const csrc6 = fs.readFileSync(new URL("../../src/engine/core.js", import.meta.url), "utf8");
  ok("T6: the persistent tier exists in the engine", /the sleeping stone is already on the books/.test(csrc6));
  ok("T6: the unfile helper exists beside wake", /function unfileBody\(world, b\)/.test(csrc6));
}
// ==== end FRONT T6 ===========================================================
```

### Step 8 — gates

`node scripts/gate.mjs depot-test` TWICE (two different random draws both green is the point), then `node scripts/gate.mjs depot-lint`, then `node scripts/gate.mjs smoke`. Expected suite count 2,090 (2,075 − the old file's 30 + the new file's 45; the T6 block stays at 5). The report quotes both runs' logged seed lines.

### Step 9 — the deploy

Build after the bump. Gates green → commit → push. Commit subject: `the settled valley — towns, hamlets, dead hamlets, and the new forms, mk2.63`.

## The owner's live check

Boot valleys. Each should read as settled ground: a town around its chapel or inn (bell tower or walled graveyard, row houses, a smithy's chimney, gateposts on the road), hamlets around wells and yards, a dead hamlet against a hill, a mill or keep standing alone, a springhouse at a pond. No flag on a cross, a gatepost, a chimney, or a springhouse; a flag on the well. Doors face centers. Phone and desktop. The stones counter stays inside the pool. Look and feel are yours alone — every dial (cluster counts, ring radius, densities) is provisional for your tuning.

## Deferred (polish queue candidates, owner's word)

- The gate arch's lintel (the posts stand; a spanning stone needs a new welded-lintel rule).
- Hamlet and town pads on steep ground read as terraces — tuning if wanted.
- Cluster counts as income dials.
