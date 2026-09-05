# The Shell Carved — Task 6: the order layer walks out (0.3.16)

The selection, order, possession, line, and chain layer leaves
`src/depot/DepotGame.jsx` for a new `src/depot/orders.js` — one builder
over a context bag, the `placement.js` idiom. The moved code wires the
`view` and `input` methods itself; the component destructures the few
names its frame loop and pointer layer still call. The suite is
behavior-only since T8, so no pin table exists; any depot-test failure at
all stops the task.

**Suggested model: Sonnet 5** — a verbatim move with a fixed seam.

## Required reading

1. This plan, whole.
2. `/home/batman/coldsnap/CLAUDE.md`, whole.
3. `src/depot/DepotGame.jsx`, the whole mount effect — every moved
   function and every stay-behind caller (the pointer handlers, the
   frame loop's reticle and selection blocks, the interface refresh
   block, the `installDepotHooks` ctx).
4. `src/depot/placement.js` lines 1–40 — the idiom this repeats.

## The design, fixed

New file `src/depot/orders.js` exporting `makeOrders(ctx)`:

```js
export function makeOrders(ctx) {
  const { world, run, view, input, map, grid, field, T, R, dev,
    toast, canvas, groundPoint, stampBag, objG, recomputeFlow,
    clearPending, canPlaceInfantryAt, startPendingSquad, canBuildAt,
    startPending, sellAt, devSpawnAt, priceNow, SQUAD_MODE, HERO_MODE,
    ghostFp } = ctx;
```

**What moves, verbatim, in today's order** (each cut boundary verified by
first and last line text): `view.toggleGear`; `squadAtPoint`;
`selectedSquad`; `selectedGroup`; `selectedVehicle`; `view.orderVehicle`;
`view.toggleTracks`; `view.unloadVehicle`; `view.takeControlVehicle`;
`view.orderSquad`; `view.toggleStructFirst`; `view.selectAllType`;
`view.selectScreen`; `view.orderGroup`; `view.toggleQueue`;
`view.clearChain`; `view.deleteLeg`; `view.rosterJump`; `possessCenter`;
`possessSightR`; `view.takeControl`; `view.takeControlTower`;
`input.releasePossession`; `LINE_END_R`; `refreshLinePreview`;
`acceptLine`; `rejectLine`; the `view.acceptLine`/`view.rejectLine`
wiring pair; `layCtx` and the three `input.stepBuildLine`/
`input.stepChainBuild`/`input.stepFoeBuildLine` assignments;
`consumeGroupOrderTap`; `consumeOrderTap`; `consumeVehOrderTap`;
`view.setTowerDiscipline`; `tapAt`. The `view.*`/`input.*` assignments
wire themselves inside the builder exactly as they do today.

Return statement:

```js
  return { tapAt, consumeOrderTap, possessCenter, possessSightR, selectedSquad };
}
```

(`tapAt` — the pointer-up handler calls it; `consumeOrderTap` — the
hooks ctx passes it; `possessCenter`/`possessSightR` — the frame loop's
reticle block reads them; `selectedSquad` — verified the frame loop or
interface block reads it directly at execution; if nothing outside the
moved set calls it, it is dropped from the return and reported.)

**What stays, named:** `groundPoint`/`pickHeightAt`/`toNdc` (view-space
picking, the pointer layer's own); every pointer/pinch/key handler;
`sellInspected`; the teaching-card door (`view.teachFire`/`teachPie`/
`teachWalk` and friends); the reticle steering block in the frame loop
(it now calls the returned `possessCenter`/`possessSightR`); `setMode`,
`toggleSell`, `closeBuild`, `startGame` and the other React-level
handlers; the whole interface refresh block and JSX.

**The component seam:** at the site where `view.toggleGear` stood:

```js
const { tapAt, consumeOrderTap, possessCenter, possessSightR, selectedSquad } = makeOrders({
  world, run, view, input, map, grid, field, T, R, dev,
  toast, canvas, groundPoint, stampBag, objG, recomputeFlow,
  clearPending, canPlaceInfantryAt, startPendingSquad, canBuildAt,
  startPending, sellAt, devSpawnAt, priceNow, SQUAD_MODE, HERO_MODE,
  ghostFp,
});
```

placed after `groundPoint` and the placement destructure are both
defined — `groundPoint`'s declaration RELOCATES above this seam if it
sits below today (byte-identical, reported), since `tapAt` and the
consume functions capture it through ctx. The import block gains
`import { makeOrders } from "./orders.js";` and drops imports made dead
by the move, each on a zero-use grep, reported.

## orders.js imports (exactly these; a name the moved bodies do not
reference is removed at execution and reported, never silently added to)

```js
import { PENDING_ARM_S, pendingArmed, canvasTapConsumesPending, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType } from "./state.js";
import { reclampReticle, seenAt } from "./sight.js";
import { JEEP, INFANTRY_ARMS, TOWER_SPECS } from "./specs.js";
import { unloadApc, apcSeated, seatsOf } from "./transports.js";
import { startBuildLine, linePieces, stepBuildLine } from "./buildlines.js";
import { fieldPrices } from "./market.js";
import { MINE_COST, WIRE_COST } from "./mines.js";
```

## Substitution table

| moved text | becomes | where |
|---|---|---|
| leading indentation | the builder's depth | orders.js |

Nothing else differs. An unlisted difference stops the task.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                                     # 959a954
grep -c '"0.3.15"' src/version.js                        # 1
grep -c 'const tapAt = ' src/depot/DepotGame.jsx         # 1
grep -c 'const consumeOrderTap = ' src/depot/DepotGame.jsx # 1
grep -c 'input.releasePossession = ' src/depot/DepotGame.jsx # 1
grep -c 'view.rosterJump = ' src/depot/DepotGame.jsx     # 1
ls src/depot/orders.js 2>&1 | grep -c 'No such file'     # 1
```

### Step 2 — orders.js and the component seam, as fixed above.

### Step 3 — version, build, gates

1. `src/version.js`: MK → `"0.3.16"`. `npm run build` after.
2. `git status` — expected: `src/depot/DepotGame.jsx`, new
   `src/depot/orders.js`, `src/version.js`, the phase document (at
   landing), `.superpowers/gates.log`, `dist/`. Anything else stops.
3. Through the gate wrapper, foreground, once each, in order:
   `depot-test` (**1,615 / 0** — the suite is behavior-only; ANY failure
   stops the task as a real regression, reported with its output),
   `golden` (7 PASS), then `npm run preview` (background) + `smoke`
   (30 / 0 — orders, possession, and the chain all drive the moved
   layer). Backgrounded runs are waited out by polling
   `.superpowers/gates.log` on a bounded loop; no gate runs twice.
4. No helper agents: this task is executed by one agent, alone in the
   tree, start to finish.

### Step 4 — commit and push

Subject: `the order layer walks out — selection, orders, possession, lines, and the chain to orders.js, 0.3.16`.
Standing trailers. Push. Phase document: T6 row LANDED with commit and
counts.

## Acceptance (arithmetic)

- depot-test 1,615 / 0; golden 7 PASS; smoke 30 / 0.
- `grep -c 'const tapAt = ' src/depot/DepotGame.jsx` = 0;
  `grep -c 'const tapAt = ' src/depot/orders.js` = 1;
  `grep -c 'makeOrders' src/depot/DepotGame.jsx` = 1 plus its import.
- `git diff --stat src/engine src/graphics src/depot/save.js src/depot/state.js src/depot/hooks.js src/depot/placement.js src/depot/pies.jsx src/depot/palette.js` — empty.
- DepotGame.jsx line count recorded old → new (expected ≈ 3,219 → ≈ 2,500).

## Report

One line of outcome, then: read-confirmation; each gate's count and
runtime; the `selectedSquad` return verdict; the relocated
`groundPoint` note if executed; the dead-import greps' results; any
import-list correction old→new; the line counts old→new; every
deviation of any size as its own labeled bullet; the commit hash pushed.
