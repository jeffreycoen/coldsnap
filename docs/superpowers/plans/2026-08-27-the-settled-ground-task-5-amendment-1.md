# The Crowded Valley — Amendment 1: the yard stands clear, and the six pins learn the new numbers

*Written by Claude Fable 5, 2026-08-27, after a full ordered read of every touched file. Verified in scratch: 80 parked hulls across 20 random maps, zero null first routes; planned mass average 5,079 (the doubling holds); trees 299–461. Task 5's Steps 1–5 stand in the working tree, uncommitted.*

## Fix 1 — the yard stands clear (`src/depot/mapgen.js`)

The crowded fill could box a depot's parked armor shut. No placed building may crowd either depot's ground. In `vetAt`, old→new:

old:
```js
  const vetAt = (x, z, nx, nz, offRoad) => {
    const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
    if (x < -78 || x > 78 || z < -69 || z > 69) return false;
```
new:
```js
  const vetAt = (x, z, nx, nz, offRoad) => {
    const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
    if (x < -78 || x > 78 || z < -69 || z > 69) return false;
    // mk2.65: THE YARD STANDS CLEAR — no placed building crowds either
    // depot's ground; the bag ring and the armor parking ring stay open.
    if (Math.hypot(x - depotU1, z - depotDepth) < rad + 32 || Math.hypot(x - depotU2, z + depotDepth) < rad + 32) return false;
```

Both depots equally — symmetry holds.

## Fix 2 — the six pins, re-taught to the crowded valley's numbers

Each old→new, labels naming mk2.65:

1. `scripts/tests/33-the-settled-ground.mjs:182`: `ok("pins: the pool is 4000", /const CHUNK_CAP = 4000;/.test(rsrc));` → `ok("pins: the pool is 7000 (re-taught mk2.65)", /const CHUNK_CAP = 7000;/.test(rsrc));`
2. `scripts/tests/33-the-settled-ground.mjs:183`: `ok("pins: TOWN_STONE_CAP is 3000", TOWN_STONE_CAP === 3000);` → `ok("pins: TOWN_STONE_CAP is 6000 (re-taught mk2.65)", TOWN_STONE_CAP === 6000);`
3. `scripts/tests/05-the-front.mjs:396`: `ok("T4(g): the chunk pool is raised to 4000 (re-taught mk2.61, owner 2026-08-26)", /const CHUNK_CAP = 4000;/.test(rsrc4));` → `ok("T4(g): the chunk pool is raised to 7000 (re-taught mk2.65, the crowded valley)", /const CHUNK_CAP = 7000;/.test(rsrc4));`
4. `scripts/tests/05-the-front.mjs:473`: `ok("T5(a): tree counts stay inside the budget (25-340 per seed)", treeLo >= 25 && treeHi <= 340, ...)` → `ok("T5(a): tree counts stay inside the budget (25-700 per seed — re-taught mk2.65, four times the wood)", treeLo >= 25 && treeHi <= 700, ...)` (detail argument unchanged).
5. `scripts/tests/05-the-front.mjs:510`: `ok("T5(d): the tree pool is one constant at 360", /const TREE_CAP = 360;/.test(rsrc5));` → `ok("T5(d): the tree pool is one constant at 800 (re-taught mk2.65)", /const TREE_CAP = 800;/.test(rsrc5));`
6. `scripts/tests/08-debug-pass.mjs:299-300`: `ok("T15(b3): planted tree count stays under the 360 tree pool on every seed", treeHi15 < 360, ...)` → `ok("T15(b3): planted tree count stays under the 800 tree pool on every seed (re-taught mk2.65)", treeHi15 < 700, ...)` (detail argument unchanged).

## The license

These seven changes and nothing else. The T24 yard test (`09-reorg.mjs`) is NOT touched — Fix 1 makes it pass on its own ground. Any other red stops the task.

## Resume

Task 5 Step 6 onward: depot-test twice (both green, suite 2,091), depot-lint, `npm run build`, smoke, then commit and push per the Task 5 plan, this amendment staged with it.
