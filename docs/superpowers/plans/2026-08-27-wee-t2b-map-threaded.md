# War Engine Extraction — Task 2b: the map threaded through every consumer (mk2.72)

The wide, mechanical edit. Every src module that reads mapgen.js's live
state takes `map` (api.js's GameMap) as a parameter instead; the export-let
shim stays whole (its delete is T10, and the test suites keep reading it
until then). Seven modules migrate, ordered bottom-up, with the depot-test
pass count checked at three checkpoints.

The consumers, from `grep -rln 'from "./mapgen.js"' src` at plan time:
state.js, muster.js, bell.js, buildlines.js, sim.js (comment only —
signatures done at T1), DepotGame.jsx, startview.js. Builder imports
(makeMap, genMap, buildDepotTerrain, makeGrid, planTrees, computeFlowField,
layDressing, checkConnectivity, stoneCount as a direct import) are NOT
state and stay imported; only live-state reads migrate.

Consulted plan: `2026-08-27-war-engine-extraction.md`, step 2 (the 2b
half). Phase document: `2026-08-27-war-engine-extraction-phase.md`.

**Suggested model: Sonnet 5** — wide but rule-driven; every signature is in
the table, every token rewrite in the table, and the gates catch what a
sweep misses (smoke boots the real component).

## Required reading (verified at commit 868d36d)

1. This task plan, whole.
2. `2026-08-27-war-engine-extraction.md` — step 2 and the API section's
   GameMap typedef.
3. Each migrating module, whole: `src/depot/state.js` (the tesla block,
   lines ~940–1060, is the only mapgen consumer in it), `src/depot/muster.js`,
   `src/depot/bell.js`, `src/depot/buildlines.js`, `src/ui/startview.js`.
4. `src/depot/DepotGame.jsx`, whole — every mapgen-name read migrates.
5. `src/depot/sim.js` lines 1–10 (the stale comment) and the stepDepot
   body's stepTesla/teslaWouldCatchFriend call sites.
6. The eight test files with calls to changing signatures (38 sites at plan
   time): 03, 04, 07, 09, 10, 11, 12, 22 — find each with
   `grep -n 'stepTesla(\|teslaWouldCatchFriend(\|possessedTowerFire(\|linePieces(\|layPieceAt(\|stepBuildLine(\|parkArmor(\|parkTower(\|parkMech(\|seedBags(\|musterFreshStart(\|mirrorFieldKey(\|ringBell(' scripts/tests/*.mjs`.

## The two tables

### Signature table — every changed export, trailing `map` always last

| Module | Old | New |
|---|---|---|
| state.js | `stepTesla(world, arcs)` | `stepTesla(world, arcs, map)` |
| state.js | `teslaWouldCatchFriend(world, tower, target)` | `(world, tower, target, map)` |
| state.js | `possessedTowerFire(world, tower, aim, T, toUV, arcs)` | `(..., arcs, map)` |
| state.js (internal) | `onWater(x, z)`, `teslaNext(world, from, hit, waters)` | each `+ map` |
| buildlines.js | `linePieces(grid, field, T, kind, a, b)` | `(..., b, map)` |
| buildlines.js | `layPieceAt(world, grid, field, T, S, job, row, ctx)` | `(..., ctx, map)` |
| buildlines.js | `stepBuildLine(world, grid, field, T, S, sq, ctx, toast)` | `(..., toast, map)` |
| muster.js | `parkArmor(world, grid, field, depotT, team, kind, nextSeq)` | `(..., nextSeq, map)` |
| muster.js | `parkTower(world, grid, field, depotT, team, towerType)` | `(..., towerType, map)` |
| muster.js | `parkMech(world, grid, field, depotT, team)` | `(..., team, map)` |
| muster.js | `seedBags(world, grid, depotT, streamKey, stampBag)` | `(..., stampBag, map)` |
| muster.js | `musterFreshStart(world, S, depotP, grid, field, nextApcSeq)` | `(..., nextApcSeq, map)` |
| muster.js | `mirrorFieldKey(world, S, depotE, grid, field, key, nextApcSeq)` | `(..., nextApcSeq, map)` |
| bell.js | `ringBell(world, grid, field, T, S, ctx)` | `(..., ctx, map)` |

`startBuildLine` reads no mapgen state — its signature does not change.

### Token table — inside migrated bodies, these rewrites and no others

`invW(` → `map.invW(` ; `fwdU(` → `map.fwdU(` ; `fwdDir` → `map.fwdDir` ;
`clampToRim(` → `map.clampToRim(` ; `pondAt(` → `map.pondAt(` ;
`streamAt(` → `map.streamAt(` ; `rockAt(` → `map.rockAt(` ;
`TOWN` → `map.TOWN` ; `OBJ_POS` → `map.OBJ_POS` ;
`MAP_SEED` → `map.MAP_SEED` ; `ORIENT` → `map.ORIENT` ;
`SPAWN_POINTS` → `map.SPAWN_POINTS` ; `PONDS` → `map.PONDS` ;
`ROCKS` → `map.ROCKS` ; `ROADS` → `map.ROADS` ; `PASSES` → `map.PASSES` ;
`STREAM` → `map.STREAM` ; `GRID_W` → `map.GRID_W` ; `GRID_H` → `map.GRID_H` ;
`GRID_CS` → `map.GRID_CS` ; `RIM_HALF_U` → `map.RIM_HALF_U` ;
`RIM_HALF_V` → `map.RIM_HALF_V`.

Internal calls thread `map` down (a migrated function calling another
migrated function passes its own `map`). After each module's edit, its
mapgen import shrinks to builders only (or disappears); the mechanical
count-1 grep rule from T1 governs, removals reported.

## Steps

### Step 1 — preconditions

```bash
grep -c 'from "./mapgen.js"' src/depot/state.js src/depot/muster.js src/depot/bell.js src/depot/buildlines.js   # 1 each
grep -c 'mapFromGlobals' src/depot/sim.js        # 1 (the stale comment)
grep -c 'export let' src/depot/mapgen.js         # 6 — untouched by this task
node scripts/gate.mjs depot-test                 # green at entry: 2,091 / 0
```

(The entry gate run doubles as checkpoint zero; skip it only if
.superpowers/gates.log's last depot-test line is today's landed 2,091/0.)

### Step 2 — state.js (the tesla water block), then CHECKPOINT 1

Apply the signature and token tables to `onWater`, `teslaNext`,
`stepTesla`, `teslaWouldCatchFriend`, `possessedTowerFire`. Drop the
`import { pondAt, streamAt } from "./mapgen.js";` line. Thread the callers:

- `src/depot/sim.js`: `stepTesla(world, S.arcs)` → `stepTesla(world, S.arcs, map)`;
  in stepTowers, `teslaWouldCatchFriend(world, b, best)` → `(world, b, best, map)`.
- `src/depot/DepotGame.jsx` frame loop: `possessedTowerFire(world, ptw, S.reticle, T, invW, S.arcs)` → `(world, ptw, S.reticle, T, map.invW, S.arcs, map)`.

Re-teach file 22's six call sites (Rule T below). Then
`node scripts/gate.mjs depot-test` — 2,091 / 0 or stop.

### Step 3 — buildlines.js, muster.js, bell.js, then CHECKPOINT 2

Apply the tables to each. Caller threading:

- buildlines callers: DepotGame's `refreshLinePreview` (`linePieces(grid, field, T, lp.kind, lp.a, lp.b, map)`), the `S.stepBuildLine` closure and `S.stepFoeBuildLine` closure (`stepBuildLine(..., toast, map)` / `(..., () => {}, map)`); bell.js's `startBuildLine` call is unchanged (no signature change) but bell's own body migrates under the token table.
- muster callers: DepotGame's `musterFreshStart(world, S, depotP, grid, field, nextApcSeq)` → `+ map`; bell.js's `mirrorFieldKey`, `parkArmor`, `parkMech` calls → `+ map` (bell has `map` as its own new parameter).
- bell caller: DepotGame's `ringBellOut(world, grid, field, T, S, bellCtx)` → `+ map`.
- Inside muster.js, `parkArmor`/`parkTower`/`parkMech` calls from
  `musterFreshStart`/`mirrorFieldKey` thread the passed `map`.

Re-teach the muster/bell/buildline test call sites (files 03, 04, 07, 09,
10, 11, 12 — Rule T). Then `node scripts/gate.mjs depot-test` — 2,091 / 0
or stop.

### Step 4 — DepotGame.jsx, startview.js, sim.js comment, then CHECKPOINT 3

- DepotGame.jsx: every read of a mapgen live-state name inside the mount
  effect and frame loop becomes `map.<name>` per the token table (`map` is
  already in scope from `const map = makeMap(seed)`). This includes the
  renderer wiring (`rim: { ..., toCanonical: map.invW, toWorld: map.fwdU }`,
  the three territory sample closures, `stepSight(world, T.sight, map.invW, map.fwdU)`),
  the world hooks (`world.pondAt`, `world.inRim`, `world.streamAt` bodies),
  the debug harness (`__DEPOTTOWN__`, `__DEPOTSETT__`, `__DEPOTFOGAT__`,
  `__DEPOTHOLD__`, ...), and every remaining literal. The mapgen import
  shrinks to builders: expected
  `import { genMap, makeMap, buildDepotTerrain, makeGrid, planTrees, computeFlowField } from "./mapgen.js";`
  minus any the count-1 prune drops (genMap is suspected dead — report).
- startview.js: same treatment; expected import
  `import { makeMap, buildDepotTerrain, makeGrid, planTrees } from "../depot/mapgen.js";`
  and every state read via the `map` it already holds. `MAP_SEED` at the
  return becomes `map.MAP_SEED`.
- sim.js line 5: the stale phrase `built by the caller with mapFromGlobals() after`
  becomes `handed back by makeMap(seed);` — comment only.
- Sweep guard, both files: 
  `grep -nE '(^|[^.a-zA-Z_])(TOWN|OBJ_POS|MAP_SEED|SPAWN_POINTS|PONDS|ROCKS|ROADS|PASSES|STREAM|ORIENT|GRID_W|GRID_H|GRID_CS|RIM_HALF_U|RIM_HALF_V|invW|fwdU|fwdDir|clampToRim|streamAt|pondAt|rockAt)\b' src/depot/DepotGame.jsx src/ui/startview.js`
  — every remaining match must be a comment or a `map`-building/importing
  line; anything else is a missed rewrite. Then
  `node scripts/gate.mjs depot-test` — 2,091 / 0 or stop.

### Rule T — test re-teaches (the sweep license)

Every test call to a changed signature gains the trailing `map`:

- Where the test already runs `makeMap(seed)` (files 09, 11, and others),
  capture the return — `const map = makeMap(seed);` — and pass it.
- Where the test builds no map, pass an object literal carrying exactly the
  keys the callee reads (from the token table's per-module usage): for the
  tesla calls in file 22, `{ pondAt, streamAt }` with both imported from
  mapgen.js (the shim is alive until T10, so those are the live functions);
  for muster calls without a real map, `{ TOWN, ROADS, MAP_SEED, OBJ_POS, GRID_W, GRID_H }`
  imported likewise.
- Source pins on the changed signatures re-teach to the new text (e.g. any
  pin on `possessedTowerFire(world, tower, aim, T, toUV, arcs)`).
- Every re-teach reported old→new. 38 call sites across 8 files at plan
  time; a different count at dispatch is a finding, not an error.

### Step 5 — asserts, version, gates, landing

```bash
node --check src/depot/state.js src/depot/muster.js src/depot/bell.js src/depot/buildlines.js src/depot/sim.js && echo SYNTAX-OK
grep -rc 'from "./mapgen.js"' src/depot/state.js | grep ':0' && echo STATE-CLEAN
grep -c 'export let' src/depot/mapgen.js          # still 6
node src/depot/api.js gate; echo "exit=$?"        # still 1, naming step 4
```

1. `git status` — expected exactly: the five migrated src files plus
   DepotGame.jsx and startview.js, `src/version.js`, and the re-taught test
   files. Anything else stops.
2. MK to `"mk2.72"`; `npm run build` after the bump.
3. Final gates in the foreground: depot-lint, depot-test (2,091 / 0),
   golden (ALL PASS), smoke (30 / 0, `vite preview` pattern as before).
4. Green → commit → push. Subject:
   `the map threaded — every consumer takes the valley as an argument, mk2.72`

## Acceptance (arithmetic)

- depot-test 2,091 / 0 at every checkpoint and at the end; golden 7/7;
  smoke 30/0; depot-lint PASS; build green.
- No src module outside mapgen.js imports mapgen live-state names — every
  remaining mapgen import under src/ names builders only (list them in the
  report).
- `export let` count in mapgen.js: 6, untouched.
- `node src/depot/api.js gate` still exits 1 naming step 4.

## Report

One line of outcome, then: read-confirmation; the three checkpoint gate
results and the final four, with runtimes and the suite's own seeds named;
the surviving mapgen import line of every consumer; every re-teach old→new
(grouped by file); the count-1 import removals; nonconformities/deviations/
skips each labeled; the commit hash pushed.
