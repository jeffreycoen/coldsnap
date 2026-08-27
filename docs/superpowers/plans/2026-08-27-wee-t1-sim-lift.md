# War Engine Extraction — Task 1: the sim lifted into depot/sim.js (mk2.70)

A verbatim move. Twelve top-level functions and two constants leave
`DepotGame.jsx` for a new `src/depot/sim.js`; the functions that read mapgen
globals gain a trailing `map` parameter of api.js's GameMap shape; the
component and `src/ui/startview.js` import from sim.js; the test suites that
slice or pin the moved text are re-taught to read it at its new home. One
amendment rides in front: api.js's command-line entry guard is rewritten
bundler-safe (a build finding, verified at plan time — the old guard's
top-level `await import("node:url")` fails the vite browser build the moment
startview.js imports api.js, which this task makes it do).

Consulted plan: `2026-08-27-war-engine-extraction.md`, step 1. Phase
document: `2026-08-27-war-engine-extraction-phase.md`.

**Suggested model: Sonnet 5** — a large but fully specified move; every
allowed difference is in the substitution table, and the re-teaches follow
three mechanical rules.

## Required reading (verified against the tree at commit c93ae36)

Read each in full before any edit; open your report by confirming each:

1. This task plan, whole.
2. `2026-08-27-war-engine-extraction.md` — step 1 and the Readability rules.
3. `src/depot/DepotGame.jsx`, whole. The moved region is contiguous:
   from the comment line `// P6 T1: route bookkeeping, one squad, once per sim tick` (above `function stepSquadRouting`) through the end of `function stepDepot` (its last line is the comment `// FRONT F1: no leak check — an enemy at the depot stays and chews masonry.` followed by the closing `}`). Nothing that stays behind sits inside that region.
4. `src/depot/api.js` — part 3 (map adapter) and part 5 (the entry guard).
5. `src/ui/startview.js`, whole (72 lines).
6. In `scripts/tests/`: the harness/pin blocks that reference a moved name —
   files 01, 02, 03, 04, 05, 06, 07, 08, 10, 12, 22, 23, 25, 33. Find each
   block by grepping the file for the moved names; read the enclosing block.

## Inventory — what moves, in source order

From `DepotGame.jsx` (all top-level, no JSX, no React), moved with their
attached comment blocks, verbatim:

| # | Item | Current anchor |
|---|---|---|
| 1 | `stepSquadRouting(grid, sq, world)` | `\nfunction stepSquadRouting(` |
| 2 | `stepTowers(...)` (already exported) + its `// ==== towers` banner | `export function stepTowers(` |
| 3 | `townFootprint(grid, t)` + the `// ==== town` banner | `\nfunction townFootprint(` |
| 4 | `buildTown(world, grid, field)` and the separate `export { buildTown };` line | `\nfunction buildTown(` |
| 5 | `stepTown(world, grid, town, onRuin)` | `\nfunction stepTown(` |
| 6 | `STONE`, `STONE_PITCH`, `shatterStructure(world, b, opts)` + the `// ==== masonry` banner | `const STONE = 0.30;` |
| 7 | `stepEnemies(world, grid, T, S)` + its march comment | `\nfunction stepEnemies(` |
| 8 | `makeDepotAssaultState()`, `clockStr(s)`, `spawnEnemy(world, sp, tag)` + the `// ==== assaults` banner | `\nfunction makeDepotAssaultState(` |
| 9 | `uprightMember(u, dt)`, `stepDepot(...)` + the `// ==== step` banner | `\nfunction uprightMember(` |

Stays in DepotGame.jsx: `QM_KEY`, `CARDS_KEY`, `detectTouch`, `P`,
`RadialMenu`, `PALETTE`/`FOE_RACK`/`TREE_BRANCHES`/`LATTICE` and everything
below, the default export whole.

## Substitution table — every token allowed to differ

An unlisted difference stops the task.

1. **Export form.** Every moved function and both constants become `export`
   in sim.js (`export function`, `export const`). The separate
   `export { buildTown };` line (and its pinned-slicers comment) is deleted —
   `export function buildTown` replaces it.
2. **Signatures gain a trailing `map`** — these five only:
   - `stepTowers(world, T, discipline, possessedId, arcs, holdArea, map)`
   - `townFootprint(grid, t, map)`
   - `buildTown(world, grid, field, map)`
   - `stepEnemies(world, grid, T, S, map)`
   - `stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, S, map)`
   The other seven signatures do not change.
3. **Inside moved bodies, these token rewrites and no others:**
   - `invW(` → `map.invW(`
   - `clampToRim(` → `map.clampToRim(`
   - `fwdDir` → `map.fwdDir` (its two uses are arguments: `stepDrivers(world, grid, map.fwdDir, T, map.invW, {...})` and `stepUnits(world, grid, map.fwdDir, T, map.invW)`)
   - `TOWN` → `map.TOWN` (buildTown's `for (const t of TOWN)`)
   - `OBJ_POS` → `map.OBJ_POS` (townFootprint)
   - `MAP_SEED` → `map.MAP_SEED` (stepDepot's `windAt(MAP_SEED, world.t)`)
   - `GRID_H` → `map.GRID_H`, `GRID_W` → `map.GRID_W` (townFootprint)
   - internal calls thread `map`: inside buildTown, `townFootprint(grid, t)` → `townFootprint(grid, t, map)`; inside stepDepot, `stepEnemies(world, grid, T, S)` → `stepEnemies(world, grid, T, S, map)` and `stepTowers(world, T, discipline, ..., S.arcs, S.holdArea)` → same with `, map` appended.
4. **Imports:** the moved code's free names resolve through sim.js's own
   header (step 2 below) instead of DepotGame's import lists.

Moved code keeps its names and its comments, era tags included — the
no-era-tags rule binds new text only.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
test ! -f src/depot/sim.js && echo CLEAR                                    # CLEAR
grep -c 'function stepSquadRouting(grid, sq, world)' src/depot/DepotGame.jsx # 1
grep -c 'export { buildTown };' src/depot/DepotGame.jsx                      # 1
cat scripts/tests/*.mjs | grep -c 'readFileSync(.*DepotGame'                 # 87
grep -c 'await import("node:url")' src/depot/api.js                          # 1
grep -c 'from "../depot/DepotGame.jsx"' src/ui/startview.js                  # 1
```

### Step 2 — amend api.js's entry guard (the build finding)

Replace this exact block at the bottom of `src/depot/api.js`:

```js
// main() runs only when this file is the entry point. The node:url import
// stays dynamic and inside the guard so a browser bundle never touches it.
if (typeof process !== "undefined" && process.versions && process.versions.node && process.argv[1]) {
  const { pathToFileURL } = await import("node:url");
  if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
}
```

with:

```js
// main() runs only when this file is the entry point. No top-level await and
// no node: import up here — a browser bundle must transpile this file clean
// (the sim-lift build finding); the node:fs import stays dynamic inside main().
function runningAsEntry() {
  if (typeof process === "undefined" || !process.versions || !process.versions.node || !process.argv[1]) return false;
  const here = decodeURIComponent(import.meta.url.replace(/^file:\/\//, ""));
  const arg = process.argv[1];
  const argAbs = arg.startsWith("/") ? arg : process.cwd() + "/" + arg;
  return here === argAbs;
}
if (runningAsEntry()) main();
```

Verified at plan time: `node src/depot/api.js gate` still exits 1 naming
step 4 (relative and absolute invocation both), `manifest` still works, and
a vite browser build that imports api.js goes green.

### Step 3 — create src/depot/sim.js

The header below verbatim, then the nine inventory items in order, moved
under the substitution table:

```js
// COLDSNAP DEPOT — sim.js: the war's top-level sim functions, moved VERBATIM
// out of DepotGame.jsx (the war-engine-extraction plan's step 1 — the
// mapgen.js / muster.js precedent). The one licensed signature change:
// functions that read mapgen globals take a `map` parameter of api.js's
// GameMap shape, built by the caller with mapFromGlobals() after
// makeMap(seed); the plan's step 2 replaces the source of `map`, never
// these signatures. Moved code keeps its names and comments; only the
// task's substitution table's tokens differ.
import { addBody, addWeld, stepWorld, explode } from "../engine/core.js";
import { TOWER_SPECS, MASON, INFANTRY_ARMS } from "./specs.js";
import {
  makeAssaultState, towerShot, fieldReaches, friendlyFouls, teslaStrike,
  teslaWouldCatchFriend, stepGrenades, stepTesla, stepDavyShot, squadFire,
  pruneSquads, stepWallSupport, forgetWelds,
} from "./state.js";
import { arcClears } from "./accuracy.js";
import { drivePossessedSquad, stepSquad, stepMedicTendSquad, stepMechanicTendSquad } from "./squads.js";
import { stepUnits, spawnUnit } from "./units.js";
import { stepDrivers } from "./drivers.js";
import { stepTransports, unloadEnemyRiders } from "./transports.js";
import { planRoute } from "./route.js";
import { windAt } from "./wind.js";
import { layDressing } from "./mapgen.js";
```

If a moved body references a free name this header lacks, that is a finding:
add the import, report it. If a header name goes unreferenced after the
move, remove it and report that too.

### Step 4 — edit DepotGame.jsx

1. Delete the moved region (reading item 3's anchors — one contiguous
   block, from the `// P6 T1: route bookkeeping` comment through stepDepot's
   closing `}`).
2. Add to the import block:
   ```js
   import { stepDepot, buildTown, townFootprint, makeDepotAssaultState, clockStr, spawnEnemy } from "./sim.js";
   import { mapFromGlobals } from "./api.js";
   ```
3. In the boot, directly after the line `makeMap(seed);`, insert:
   ```js
   const map = mapFromGlobals();
   ```
4. Call sites gain `map`:
   - fresh boot: `town = buildTown(world, grid, field);` → `town = buildTown(world, grid, field, map);`
   - resume branch, both `townFootprint(grid, t)` calls → `townFootprint(grid, t, map)`
   - sim loop: `stepDepot(world, grid, onStructureLost, town, onRuin, T, S.discipline, S);` → append `, map`.
5. Unused-import prune, mechanical: for every name in DepotGame.jsx's
   import statements, if `grep -c '\bNAME\b' src/depot/DepotGame.jsx` is 1
   (the import line alone), remove it from its import list. Expect roughly a
   dozen removals (stepWorld, explode, stepUnits, stepDrivers, squadFire,
   pruneSquads, and kin); report the exact list. Names still used elsewhere
   in the component (addBody, TOWER_SPECS, INFANTRY_ARMS, forgetWelds,
   windAt, unloadApc, TOWN, invW, ...) stay.

### Step 5 — point startview.js at sim.js

In `src/ui/startview.js`:

```js
import { buildTown } from "../depot/sim.js";
import { mapFromGlobals } from "../depot/api.js";
```

replaces the DepotGame import, and the call becomes
`buildTown(world, grid, field, mapFromGlobals());`.

### Step 6 — re-teach the suites (the sweep license)

The license covers exactly this: tests that slice or pin literal text this
task moves. Three rules; every re-teach reported old→new.

**Rule A — retarget reads.** Any `readFileSync(... DepotGame.jsx ...)`
whose downstream slice or regex references a moved name now reads
`../../src/depot/sim.js`. Reads serving text that STAYS in the component
(buildSnapshot, the S-object literal, possession closures, frame-loop text)
keep their target. A read serving both splits into two reads. Slicers that
match `` `\nfunction ${name}(` `` must also try
`` `\nexport function ${name}(` `` and strip the `export ` prefix — the
mapgen-fallback pattern files 06 and 33 already use.

**Rule B — slicer glue for the new signatures.** Executing harnesses (files
02, 05, 06, 07, 08, 33) call sliced `buildTown`/`townFootprint`. Inside each
harness's return-template string, build a map from the locals the sliced
mapgen header already provides and export wrappers so every existing call
site stays untouched:

```js
const __map = { TOWN, OBJ_POS, MAP_SEED, GRID_W, GRID_H, GRID_CS, GRID_OX, GRID_OZ, invW, fwdU, fwdDir, clampToRim };
```

and in the returned object: `buildTown: (w, g, f) => buildTown(w, g, f, __map)`
(likewise `townFootprint` where exported). If a harness's header lacks one
of those locals, include only what the sliced bodies actually read (TOWN,
OBJ_POS, MAP_SEED, GRID_W, GRID_H cover buildTown + townFootprint;
`stepSquadRouting` takes no map and needs no wrapper).

**Rule C — pins whose asserted text moves under the licensed
substitutions.** Known instances (find any others by Rule A's sweep):

- `scripts/tests/04-...mjs` ~line 1097: the stepDepot signature regex gains
  `, map` — `function stepDepot\(world, grid, onStructureLost, town, onRuin, T, discipline, S, map\) \{` — and its read retargets to sim.js.
- `scripts/tests/06-...mjs` (P6T1(f)): `/stepSquadRouting\(grid, sq, world\);/`
  — the call text is unchanged; the read retargets to sim.js.
- `scripts/tests/25-the-teaching-cards.mjs` ~line 100 (the buildTown pin):
  old — `/\nexport \{ buildTown \};/` and `/\nfunction buildTown\(world, grid, field\) \{/` over DepotGame source; new — one pin over sim.js source:
  `/\nexport function buildTown\(world, grid, field, map\) \{/`.
- `scripts/tests/22-the-tesla-coil.mjs` ~line 146 pins the S-object literal
  (`ws: makeDepotAssaultState(), ...`) — that text STAYS in DepotGame; the
  read does NOT retarget.
- File 23 references stepDepot/stepEnemies/stepTowers/uprightMember with no
  DepotGame readFileSync of its own — locate its source reads and apply
  Rule A.

Asserted content stays identical everywhere except where the substitution
table itself moved the text; those pins move WITH it and are reported.

### Step 7 — asserts

```bash
node --check src/depot/sim.js && echo SYNTAX-OK
node src/depot/api.js gate; echo "exit=$?"        # still exits 1 naming step 4
cat scripts/tests/*.mjs | grep -c 'readFileSync(.*DepotGame'   # must FALL below 87; record it
grep -c 'readFileSync(.*sim.js' scripts/tests/*.mjs | grep -v ':0'  # record the new reads
```

### Step 8 — tree state, version, gates, landing

1. `git status` — expected exactly: `src/depot/sim.js` (new); modified
   `src/depot/DepotGame.jsx`, `src/depot/api.js`, `src/ui/startview.js`,
   `src/version.js`, and the re-taught test files. Anything else is a stop.
2. Bump MK to `"mk2.70"`. Build AFTER the bump (`npm run build`) — the
   build is itself an acceptance here (startview now imports api.js).
3. Gates, in order, through the wrapper: `node scripts/gate.mjs depot-lint`
   (sim.js is src/depot — the no-Math.random law now covers it),
   `node scripts/gate.mjs depot-test` (2,091 PASS / 0 FAIL — the moved
   count after re-teaches must land exactly here; any other number is a
   stop), `node scripts/gate.mjs golden` (ALL PASS),
   `node scripts/gate.mjs smoke` (30 PASS / 0 FAIL — the browser boots the
   component with the new imports).
4. Gates green → commit → push. Commit subject:
   `the sim lifted — twelve functions leave the component, mk2.70`

## Acceptance (arithmetic)

- depot-test: 2,091 PASS / 0 FAIL. golden: 7/7. smoke: 30/0. depot-lint: PASS.
- `npm run build` green.
- The DepotGame readFileSync count falls from 87; the new count recorded.
- `grep -c 'function stepDepot' src/depot/DepotGame.jsx` = 0;
  `grep -c 'export function stepDepot' src/depot/sim.js` = 1.
- keystone: rides inside the 2,091 (the suite's pinned-seed hashes).

## Report

One line of outcome, then: read-confirmation; gate counts and runtimes with
the suite's own fixture seeds named; the new readFileSync counts
(DepotGame and sim.js); every re-teach old→new, each its own bullet; the
unused-import removals from DepotGame; every finding against the sim.js
header import list; nonconformities/deviations/skips each labeled, never
filtered; the commit hash pushed.
