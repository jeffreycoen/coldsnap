# War Engine Extraction — Task 2a: makeMap returns the GameMap (mk2.71)

`makeMap(seed)` builds and RETURNS the GameMap object while still assigning
every `export let` (the shim stays whole through this phase; its delete is
T10). `assertMap` and `GAME_MAP_KEYS` move into mapgen.js; api.js's part 3
(the map adapter) is deleted; the two `mapFromGlobals` call sites T1 created
switch to `const map = makeMap(seed)`. No other consumer changes — T2b owns
the wide migration.

One correction to the phase split's wording, found writing this plan: "no
consumer changes" cannot hold literally, because deleting `mapFromGlobals`
orphans its two callers. The change is exactly two call sites, both listed
below; nothing else moves.

A side effect worth naming: after this task neither DepotGame.jsx nor
startview.js imports api.js at all — the browser bundle's api.js
entanglement retreats until step 3.

Consulted plan: `2026-08-27-war-engine-extraction.md`, step 2 (the 2a half,
per the 2026-08-27 ruling). Phase document:
`2026-08-27-war-engine-extraction-phase.md`.

**Suggested model: Sonnet 5** — small verbatim additions, two-line call-site
edits, and one mechanical re-teach across six harness files.

## Required reading (verified against the tree at commit 2cdb1ea)

1. This task plan, whole.
2. `2026-08-27-war-engine-extraction.md` — step 2.
3. `src/depot/mapgen.js` lines 1–60 (the export-let block) and the whole
   `makeMap` body (`export function makeMap(seed)`).
4. `src/depot/api.js` — part 1's GameMap typedef and all of part 3.
5. `src/depot/DepotGame.jsx` lines 405–440 (the boot's map lines) and line
   45 (the api.js import).
6. `src/ui/startview.js`, whole.
7. The thirteen harness templates that slice `makeMap`:
   02-front-f1 (1), 05-the-front (6), 06-troops-physics (1),
   07-armor-demolition (3), 08-debug-pass (1), 33-the-settled-ground (1) —
   find each with `grep -n 'sliceFn[0-9A-Za-z]*("makeMap")' scripts/tests/*.mjs`.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
grep -c 'export function makeMap(seed)' src/depot/mapgen.js          # 1
grep -c mapFromGlobals src/depot/api.js                              # 2
grep -c mapFromGlobals src/depot/DepotGame.jsx                       # 2
grep -c mapFromGlobals src/ui/startview.js                           # 2
grep -c 'liveGameMap' src/depot/mapgen.js                            # 0
grep -c 'sliceFn[0-9A-Za-z]*("makeMap")' scripts/tests/*.mjs | grep -v ':0' | awk -F: '{s+=$2} END {print s}'   # 13
```

### Step 2 — mapgen.js gains the map object

Directly AFTER `makeMap`'s closing `}` (before `export function
buildDepotTerrain`), insert this block verbatim. `GAME_MAP_KEYS` and
`assertMap` are api.js part 3's own bodies, moved; `liveGameMap` is new text
and deliberately NOT exported and NOT in the file's header region (the test
harnesses slice that region wholesale — see step 5).

```js
// The GameMap (api.js part 1's typedef): the map frame as ONE object.
// makeMap returns it; the export-let shim above stays assigned in parallel
// for this phase (the extraction plan's step 2b migrates consumers; its
// closing task deletes the shim). assertMap and GAME_MAP_KEYS moved here
// verbatim from api.js part 3, which this change deletes.
export const GAME_MAP_KEYS = [
  "GRID_CS", "GRID_W", "GRID_H", "GRID_OX", "GRID_OZ", "ORIENT",
  "RIM_HALF_U", "RIM_HALF_V", "OBJ_POS", "SPAWN_POINTS", "PONDS", "ROCKS",
  "TOWN", "ROADS", "PASSES", "BANDS", "MAP_SEED", "SPAWN_U", "STREAM",
  "HILLS", "CLUSTERS",
  "fwdU", "invW", "fwdDir", "clampToRim", "pondAt", "rockAt", "streamAt", "stoneCount",
];

export function assertMap(map) {
  const missing = GAME_MAP_KEYS.filter((key) => !(key in map));
  if (missing.length) throw new Error("assertMap: missing " + missing.join(", "));
  if (!map.TOWN || map.TOWN.length === 0) throw new Error("assertMap: TOWN is empty — makeMap(seed) has not run");
  return map;
}

// liveGameMap: the module's current drawn state as a GameMap. Internal —
// makeMap's return is the door. The functions are the module's own (they
// read the live lets), so a map built here stays live with the shim; step
// 2b's consumers call them as map.<name> with identical behavior.
function liveGameMap() {
  return assertMap({
    GRID_CS, GRID_W, GRID_H, GRID_OX, GRID_OZ, ORIENT, RIM_HALF_U, RIM_HALF_V,
    OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, PASSES, BANDS, MAP_SEED,
    SPAWN_U, STREAM, HILLS, CLUSTERS,
    fwdU, invW, fwdDir, clampToRim, pondAt, rockAt, streamAt, stoneCount,
  });
}
```

Then makeMap's two exits return it — exactly two edits inside the body:

- the success line
  `checkConnectivity(g, SPAWN_POINTS, dg.gx, dg.gz)) return;`
  becomes
  `checkConnectivity(g, SPAWN_POINTS, dg.gx, dg.gz)) return liveGameMap();`
- after the loop's closing brace (the comment `// ten broken rolls in a row
  would be a generator bug — the last one stands` is in ColdsnapTD's copy,
  not here; this makeMap simply falls out of the loop), add before the
  function's closing `}`:
  `return liveGameMap(); // the deepest retry stands — return what was installed`

### Step 3 — api.js loses part 3

1. Delete part 3 whole: the `// ===== part 3: map adapter` banner comment,
   `GAME_MAP_KEYS`, `assertMap`, and `mapFromGlobals`.
2. Delete the now-orphaned mapgen import block at the top of api.js (the
   entire `import { GRID_CS, ... } from "./mapgen.js";` statement — nothing
   else in api.js reads those names). The `worldHash` import stays.
3. In part 1's GameMap typedef comment, replace the parenthetical
   `(step 2's makeMap return; until then mapFromGlobals() builds it from
   mapgen.js's live exports)` with `(makeMap's return — mapgen.js builds and
   asserts it)`.

### Step 4 — the two call sites

DepotGame.jsx:
- line 45: delete `import { mapFromGlobals } from "./api.js";`
- boot lines 431–432:
  ```js
  makeMap(seed);
  const map = mapFromGlobals();
  ```
  become
  ```js
  const map = makeMap(seed);
  ```

startview.js:
- line 12: delete `import { mapFromGlobals } from "../depot/api.js";`
- line 15: `makeMap(seed);` becomes `const map = makeMap(seed);`
- line 22: `buildTown(world, grid, field, mapFromGlobals());` becomes
  `buildTown(world, grid, field, map);`

### Step 5 — re-teach the harnesses (the sweep license)

The sliced `makeMap` now ends in `return liveGameMap();`, and `liveGameMap`
is not in the harnesses' sliced text (deliberately — slicing it would drag
`pondAt`/`stoneCount` dependencies into harnesses that don't carry them).
Every harness calls `makeMap` for its side effects and ignores the return
(verified at plan time across all thirteen call patterns), so the glue is a
null stub.

Rule: in each of the thirteen template arrays that contain a
`sliceFn*("makeMap")` element (files 02, 05 ×6, 06, 07 ×3, 08, 33), insert
immediately before that element a literal string element:

```js
"const liveGameMap = () => null; // task-2a harness stub: sliced makeMap's return, unused here",
```

No other harness change. Pins verified untouched at plan time: 09-reorg's
`/export function makeMap\(seed\)/` (signature unchanged) and 33's
mound-stamp pin (`if (t.dead && t.form !== "mound") continue;` — body text
unchanged). Any OTHER pin that fails on makeMap's two changed lines is a
finding: re-teach it to the new text and report old→new.

### Step 6 — asserts

```bash
node --check src/depot/mapgen.js && node --check src/depot/api.js && echo SYNTAX-OK
node src/depot/api.js gate; echo "exit=$?"     # still exits 1 naming step 4
grep -rc mapFromGlobals src/ | awk -F: '{s+=$2} END {print s}'   # 0
```

Scratch script (repo root, /tmp, never committed):

```js
import { makeMap, assertMap, TOWN, MAP_SEED } from "./src/depot/mapgen.js";
const map = makeMap(11);
assertMap(map);
if (map.MAP_SEED !== MAP_SEED || map.TOWN !== TOWN) throw new Error("returned map is not the live state");
if (map.TOWN.length === 0) throw new Error("empty TOWN");
if (typeof map.invW !== "function" || typeof map.stoneCount !== "function") throw new Error("map functions missing");
console.log("T2a functional asserts: PASS —", map.TOWN.length, "town rows, seed", map.MAP_SEED);
```

### Step 7 — tree state, version, gates, landing

1. `git status` — expected exactly: modified `src/depot/mapgen.js`,
   `src/depot/api.js`, `src/depot/DepotGame.jsx`, `src/ui/startview.js`,
   `src/version.js`, and the six re-taught test files. Anything else stops.
2. Bump MK to `"mk2.71"`; `npm run build` after the bump.
3. Gates in the foreground through the wrapper, in order: depot-lint,
   depot-test (2,091 / 0 — anything else stops), golden (ALL PASS), smoke
   (30 / 0 — start `vite preview` first if the gate needs the server, stop
   it after; the T1 landing's pattern).
4. Green → commit → push. Subject:
   `the map returned — makeMap hands back the valley it drew, mk2.71`

## Acceptance (arithmetic)

- depot-test 2,091 / 0; golden 7/7; smoke 30/0; depot-lint PASS; build green.
- `mapFromGlobals` occurs nowhere under src/ (count 0).
- `node src/depot/api.js gate` still exits 1 naming step 4.
- `grep -c 'export let' src/depot/mapgen.js` unchanged from before the task
  (the shim is untouched; record the number).

## Report

One line of outcome, then: read-confirmation; gate counts and runtimes with
the suite's own seeds named; the export-let count; every re-teach old→new
(the thirteen stub insertions may be reported as one bullet naming all
thirteen sites); any pin findings beyond the two verified; nonconformities/
deviations/skips each labeled; the commit hash pushed.
