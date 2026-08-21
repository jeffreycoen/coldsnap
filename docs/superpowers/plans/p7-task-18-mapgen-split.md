# P7 Task 18 — the map moves out (mk1.48)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. First of the five reorganization tasks (owner's ruling): the map frame — constants, orientation state, generator, terrain builder, tree plan, grid builder, flow field, connectivity — moves VERBATIM from DepotGame.jsx into a new `src/depot/mapgen.js`. Zero behavior change is the whole contract: the T6 keystone's hash AND draw count must come out UNTOUCHED (3465970090 / 695) — they are the proof the move was byte-faithful. The route.js precedent (P7 T2, "moved verbatim out of DepotGame.jsx") is the pattern. No design freedom anywhere in this task.*

**Suggested model: Sonnet** — a mechanical move with an explicit inventory.

**Scope:** new `src/depot/mapgen.js`; `src/depot/DepotGame.jsx`; `scripts/depot-test.mjs` (source-read retargets only); `src/version.js`. Nothing else.

## The moving inventory (DepotGame.jsx lines 43–622, verbatim)

- The map-frame constants and state (43–70): `GRID_CS/GRID_W/GRID_H/GRID_OX/GRID_OZ`, `ORIENT`, the `fwdU`/`fwdDir`/`invW` wrappers, `RIM_HALF_U/RIM_HALF_V`, `clampToRim`, `OBJ_POS`, and the map-data lets (`SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, PASSES, BANDS, MAP_SEED, SPAWN_U, STREAM, HILLS`).
- `genMap` (72–299), `makeMap` (300–331), `buildDepotTerrain` (333–435), `pondAt`/`rockAt` (436–437), `makeGrid` (440–~472), `streamAt` (474–~490), `planTrees` (492–~555), `computeFlowField` (556–593), `checkConnectivity` (594–~622).

**What stays in DepotGame.jsx:** `stepSquadRouting` (624+) and everything after it — `buildTown`, `treeAt`, the mount, the loop, the interface. The mount-scope `recomputeFlow` wrapper (2047) stays and now calls the imported `computeFlowField`.

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx` 1–70 (the import block and the moving header) and 43–622 whole (the inventory above — confirm the boundaries: 622 ends `checkConnectivity`, 624 opens `stepSquadRouting`).
2. `src/depot/route.js` 1–10 (the verbatim-move precedent's header comment — mapgen.js opens with the same style).
3. `scripts/depot-test.mjs` — every site that READS DepotGame.jsx source (87 mentions; many share a read). You will classify each in Step 4.

## Trap notes

- **Verbatim means verbatim.** Comments, blank lines, provisional tags — everything inside the moved regions is byte-identical in its new home. The only new text is mapgen.js's header comment and its import/export lines.
- **Live bindings carry the state.** The map lets (`ORIENT`, `TOWN`, `STREAM`, …) become `export let`; ES module imports are live, so DepotGame reads reassignments made by `makeMap` exactly as before. Nothing outside the moved region REASSIGNS any of them (mutating a TOWN entry's fields is fine and unaffected) — verify with a grep before deleting, STOP if you find an external reassignment.
- **No cycle:** mapgen.js imports from orient.js, core.js (`mulberry32`), specs.js (`MASON`), and route.js (`stampTerrainMasks`) — never from DepotGame.jsx or state.js.
- **The keystone is the gate.** Hash 3465970090, draws 695, both UNCHANGED. If either moves, the move was not faithful — STOP and find the difference; never re-pin in this task.
- **Suite edits are retargets, not re-pins.** A source-read or regex that pointed at moved code now points at mapgen.js; the asserted content does not change. Each retarget is listed in the report. Zero true re-pins expected.

## Steps

**Step 1 — the failing asserts land first.** After the T17 block:

```js
// ==== P7 T18: THE MAP MOVES OUT ==============================================
// Reorganization 1 of 5 (owner): the map frame lives in mapgen.js, verbatim.
// Zero behavior change — the keystone above is the proof.
{
  ok("T18(a): mapgen.js exists and owns the generator",
    /export function genMap\(seed\)/.test(mgSrc18) && /export function makeMap\(seed\)/.test(mgSrc18) &&
    /export function buildDepotTerrain\(/.test(mgSrc18) && /export function makeGrid\(field\)/.test(mgSrc18) &&
    /export function planTrees\(\)/.test(mgSrc18) && /export function computeFlowField\(/.test(mgSrc18));
  ok("T18(a2): the frame state moved with it",
    /export let ORIENT = 0;/.test(mgSrc18) && /export const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(mgSrc18) &&
    /export let STREAM = null;/.test(mgSrc18));
  ok("T18(b): DepotGame no longer defines what it now imports",
    !/function genMap\(/.test(dgSrc18) && !/function makeGrid\(/.test(dgSrc18) &&
    !/function computeFlowField\(/.test(dgSrc18) && /from "\.\/mapgen\.js"/.test(dgSrc18));
}
// ==== end P7 T18 =============================================================
```

`mgSrc18`/`dgSrc18` via the suite's source-read idiom (mapgen.js read may not exist yet — read with a try/fallback to empty string so the assert FAILS rather than throws, or place the read inside the block; match the suite's established pattern). Run — T18 fails. Report the failing output.

**Step 2 — mapgen.js is born.** Create `src/depot/mapgen.js`:

```js
// COLDSNAP DEPOT — mapgen.js: the map frame, moved VERBATIM out of
// DepotGame.jsx (P7 T18, the route.js precedent). One canonical square,
// four rotations; the generator, the terrain, the trees, the grid, the
// flow, the connectivity — and the frame's own state (ORIENT, the drawn
// map data), exported as live bindings so makeMap's writes reach every
// reader exactly as they did in the component. Zero behavior change; the
// T6 keystone (hash AND draws) pins the proof.
import { fwdUFor, fwdDirFor, invWFor, clampToRimFor } from "./orient.js";
import { mulberry32 } from "../engine/core.js";
import { MASON } from "./specs.js";
import { stampTerrainMasks } from "./route.js";
```

…followed by lines 43–622 of DepotGame.jsx, verbatim, with these mechanical adjustments ONLY: every moved `const`/`let`/`function` at module level gains `export`; nothing else changes. (`pondAt`, `rockAt`, `streamAt`, `fwdDir`, `clampToRim`, `GRID_OX/OZ` — export them all; DepotGame consumes most and the suite will import the rest at mk1.52.)

**Step 3 — DepotGame imports its map.** Delete lines 43–622 from `src/depot/DepotGame.jsx` and add to the import block:

```js
import { GRID_CS, GRID_W, GRID_H, GRID_OX, GRID_OZ, RIM_HALF_U, RIM_HALF_V, ORIENT, fwdU, fwdDir, invW, clampToRim, OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, PASSES, BANDS, MAP_SEED, SPAWN_U, STREAM, HILLS, genMap, makeMap, buildDepotTerrain, pondAt, rockAt, makeGrid, streamAt, planTrees, computeFlowField, checkConnectivity } from "./mapgen.js";
```

Then build once (a quick `npm run build` is allowed here as the reference-closure check): every unresolved name is a consumer the import list missed — add it, never re-declare it locally. Verify with grep that no moved name is still declared in DepotGame.jsx.

**Step 4 — the suite follows the code.** Grep `scripts/depot-test.mjs` for every DepotGame.jsx source-read and every regex/slice over moved code. Known movers (verify, don't trust this list blind): the F1 T1 makeGrid/makeMap slice harness; the T15 block's mkMap15/census slices and the T15(a–a4) regexes; the T3 harness's map slices; T13(i)/(i2) (stampTerrainMasks call, flow drop-cost). Each retargets its source read to `src/depot/mapgen.js` — the asserted CONTENT is untouched. Pins over code that stayed (bTeam stamps, stampBag, setMode, pickManifest, the lay loop, stepSquadRouting's slice seam) keep reading DepotGame.jsx. List every retarget in the report.

**Step 5 — gates.** `node scripts/depot-test.mjs` (all green — T18 included, and the T6 keystone at hash 3465970090 / draws 695 UNCHANGED), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.48`. Build AFTER the bump. Commit: `the map moves out: mapgen.js, verbatim (mk1.48)`. Push. Report: read-confirmation opening, gate results with the keystone values stated, the full retarget list, every deviation labeled.

---

## Amendment 1 (2026-08-18, after the agent's honest stop — owner-reviewed before resume)

The plan's boundary was wrong by six lines — the plan-writer's error, found by the agent: `checkConnectivity` closes at line **616**, and lines 618–623 are `stepSquadRouting`'s own doc comment, which belongs with its function and STAYS in DepotGame.jsx. **The moved region is lines 43–616** (the blank 617 and the comment 618–623 stay behind, whole). Every other anchor in the inventory was verified exact. Nothing else changes.
