# The Settled Ground — Task 1: The Stone Count (mk2.61)

**DO NOT USE THIS PLAN AS AN EXAMPLE (owner, 2026-08-26).** It shipped and its task landed, but it names specific seed ranges and pins exact totals — against the random ground rule taken the same day. No future plan copies its shape.

*Written by Claude Fable 5, 2026-08-26, against mk2.60 (commit b12611b). Skeleton: `2026-08-26-the-settled-ground-skeleton-draft.md`, rulings 1 (cap 3,000 / pool 4,000) and the marker rule not touched here. Suggested model: Sonnet — one pure function mirroring an existing loop, fully specified below. Every code block below has had a syntax pass; every anchor greps against the live tree.*

## What this task does

`mapgen.js` gains `stoneCount(t)` — the planned stone count of one town entry, by `buildTown`'s own lay rules — and `TOWN_STONE_CAP` 3000. `renderer.js`'s `CHUNK_CAP` rises 3000 → 4000 (owner, 2026-08-26; one constant, golden green). A new era file pins the plan against the lay on every building over 200 seeds, pins the twelve template costs, and asserts no seed plans past the cap over 500 seeds. Nothing on screen changes: no planned count today reaches the cap, so the raised pool draws exactly what the old one drew.

## Required reading (verified against the tree)

The agent's report opens by confirming each was read.

1. This plan, whole.
2. `src/depot/mapgen.js` — whole file (634 lines). The TPL/BIG tables (`:159-165`, `:190-193`), the town entry shapes, and the insertion point (`:415-417`).
3. `src/depot/DepotGame.jsx:202-397` — `townFootprint`, `buildTown` (the non-depot lay branch `:317-367` is the law `stoneCount` mirrors), `stepTown`.
4. `src/render/renderer.js:920-940` — the `CHUNK_CAP` comment block and constant; `:2193` and `:2203` (the draw loop and stats read the constant, no other change).
5. `scripts/tests/05-the-front.mjs:250-400` — the era-05 boot sweep and the `T4(g)` pool pin this task re-teaches.
6. `scripts/tests/32-the-commanders-eye.mjs` — the era-file idiom (header comment, imports, `ok`).
7. `scripts/tests/harness.mjs`, the tail of `scripts/depot-test.mjs` (the import ladder and `finish()`).
8. `src/version.js`.

## The one re-teach this plan licenses

`scripts/tests/05-the-front.mjs:396` pins the literal `const CHUNK_CAP = 3000;`. This task moves that literal, so the pin re-teaches 3000 → 4000 — asserted content otherwise identical, reported old→new. **No other failure is licensed.** In particular `05-the-front.mjs:311` (worst boot ≤ 2,900) and `08-debug-pass.mjs:297` (boot < 3,000) must pass untouched — no seed's map changes in this task. Any other red stops the task.

## Steps, in execution order

### Step 1 — the mark

`src/version.js:6`: `mk2.60` → `mk2.61`.

### Step 2 — the failing asserts: the new era file

Create `scripts/tests/33-the-settled-ground.mjs` exactly as follows. Register it in `scripts/depot-test.mjs` with `await import("./tests/33-the-settled-ground.mjs");` on a new line after the era-32 import (the line before `finish();`). Run `node scripts/gate.mjs depot-test` and confirm it fails on the missing `stoneCount` import — the failing state is the proof the pins bite.

```js
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
```

Seventeen checks: twelve template pins, two equality-sweep pins, one cap pin, two constant pins. Suite arithmetic: 2,045 → 2,062. The exact final count is the run's to state; a different count is a nonconformity, reported.

### Step 3 — `stoneCount` and the cap in `mapgen.js`

Insert at `src/depot/mapgen.js`, after `rockAt` (`:415`) and before the `// ========== grid + flow` section comment (`:417`):

```js
// THE STONE COUNT (Settled Ground T1, mk2.61): the planned stone cost of one
// town entry, by buildTown's OWN lay rules (DepotGame.jsx, the non-depot
// branch) — perimeter walls, interior columns, the granular roof, the door
// carve, the drive-through carve, the decay hash, the slab. mapgen plans in
// the currency the renderer pays. The two depots are the precast branch and
// are outside this count by design (the suite excludes them too).
// Mirror discipline: any change to buildTown's lay rules changes this
// function in the same task, and era 33's equality sweep is the proof.
export const TOWN_STONE_CAP = 3000; // owner, 2026-08-26 — provisional until the Pi collapse capture // provisional (F5)
export function stoneCount(t) {
  const colAt = t.cols
    ? (() => {
        const c1x = Math.floor(t.nx / 3), c1z = Math.floor(t.nz / 3);
        const c2x = t.nx - 1 - c1x, c2z = t.nz - 1 - c1z;
        return (ix, iz) => (ix === c1x && iz === c1z) || (ix === c2x && iz === c2z);
      })()
    : () => false;
  const driveZ = t.drive && t.nz >= t.nx;
  let n = 0;
  for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
    const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
    if (iy < t.ny && !perim && !colAt(ix, iz)) continue;
    if (iy === t.ny && (t.roof === false || t.slab)) continue;
    if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
    if (t.drive && iy < t.ny - 1 && (driveZ
      ? (iz === 0 || iz === t.nz - 1) && ix >= 1 && ix <= t.nx - 2
      : (ix === 0 || ix === t.nx - 1) && iz >= 1 && iz <= t.nz - 2)) continue;
    if (t.ruin && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < t.ruin && iy > 0) continue;
    n++;
  }
  if (t.slab) n++; // the slab is ONE body, counted like buildTown's grid3 counts it
  return n;
}
```

The loop is `buildTown`'s non-depot branch (`DepotGame.jsx:318-329`) with `addBody` replaced by `n++` and the slab body (`:356-366`) as `+1`. No draw, no state, no import — `depot-lint` has nothing to see.

### Step 4 — the pool

`src/render/renderer.js:934`: `const CHUNK_CAP = 3000;` → `const CHUNK_CAP = 4000;`. Append to the comment block above it (after the `:930-933` paragraph):

```js
  // Settled Ground T1 (mk2.61, owner 2026-08-26): 3000 -> 4000 beside
  // TOWN_STONE_CAP 3000 (mapgen.js) — physics sleeps boot stones, the pool
  // is a draw limit. Provisional until the Pi collapse capture; the stones
  // counter stays the alarm.
```

No other renderer line changes; `:935`, `:936`, `:2193`, `:2203` all read the constant.

### Step 5 — the licensed re-teach

`scripts/tests/05-the-front.mjs:396`:

old: `ok("T4(g): the chunk pool is raised to 3000", /const CHUNK_CAP = 3000;/.test(rsrc4));`
new: `ok("T4(g): the chunk pool is raised to 4000 (re-taught mk2.61, owner 2026-08-26)", /const CHUNK_CAP = 4000;/.test(rsrc4));`

Reported old→new in the landing report. Nothing else in era 05 moves.

### Step 6 — gates

`node scripts/gate.mjs depot-test` and `node scripts/gate.mjs depot-lint`, in that order. Both green, no failure beyond Step 2's deliberate pre-implementation red. The report names the fixture seed ranges (1–200, 1–500) and the final check count.

### Step 7 — the deploy

Build after the bump (Step 1 already landed). Gates green → commit → push. The commit message names the mark: `the stone count — mapgen plans in the currency the renderer pays, mk2.61`. The owner's live check: the game boots unchanged; the stones counter reads n/4000.

## Acceptance arithmetic

- Twelve template costs equal the measured table exactly (croft 36 … keep 156).
- 3,586 buildings over seeds 1–200, zero plan/lay mismatches.
- Zero of 500 seeds past 3,000; the worst planned count reported, not pinned.
- Suite 2,045 → 2,063; every prior check green except the one licensed re-teach.
- Nothing on screen changes.
