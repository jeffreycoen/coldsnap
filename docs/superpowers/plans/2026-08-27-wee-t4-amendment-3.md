# Task 4 combined — Amendment 3: the import lists re-derived mechanically; three lines dispositioned

The third stop: the plan's boot.js import list was written from memory
and missed two names the moved code reads. This amendment replaces that
list with one derived by machine — every name the moved text actually
uses in code (comment mentions stripped), checked against the component's
own import lines — and dispositions the three accumulator lines the agent
flagged. The plan and amendments 1 and 2 stand except as written here.

## 1. boot.js import block — replaced whole

Derived by scanning the Move A text (the plan's ranges minus its
exclusions), comments stripped, against DepotGame.jsx's import table.
Two names join the plan's list: `TOWER_SPECS` (the emitter row, line 637)
and `EMIT` (every emitter row, lines 637–654). Nothing else changes.

```js
import { makeField, makeWorld, addBody, mulberry32 } from "../engine/core.js";
import { buildMech } from "../engine/mech.js";
import { MECH, TOWER_SPECS } from "./specs.js";
import { makeMap, buildDepotTerrain, makeGrid, planTrees, computeFlowField } from "./mapgen.js";
import { buildTown, townFootprint, makeDepotAssaultState } from "./sim.js";
import { censusDepotChunks, makeManifestState, makeFoeState, BELL_PERIOD_S } from "./state.js";
import { restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
import { makeTerritory, EMIT } from "./territory.js";
import { makeSight } from "./sight.js";
import { makeRegiment } from "./economy.js";
import { musterFreshStart } from "./muster.js";
```

One clarification the scan settled: line 637's `b.effRange` is a body
property, not the `effRange` function — state.js's `effRange` is NOT
imported by boot.js.

## 2. tick.js import list — confirmed, one subtraction noted

The same mechanical scan over the Move B ranges confirms amendment 2's
list with one note: `PENDING_ARM_S` appears in the moved-range text only
on line 3193's wall-clock arming write, which STAYS in the component per
the plan — so it does not join tick.js's imports. Amendment 2's list
stands exactly as written.

## 3. The three flagged lines (DepotGame.jsx 613–615)

- `let terrAcc = 0;` — DELETED, not moved: `war.clock.terrAcc` starts at
  0 in the war literal (plan step 2), which IS this initialization.
- `let zoneAcc = 0.25;` — STAYS in the component (its only readers are
  the stayed zone-refresh lines 3454–3455).
- `const TERR_STEP = 0.25;` — MOVES to tick.js as a module constant (its
  only code readers are the moved territory and fog lines).

## 4. The draft in the tree

The stopped agent left `src/depot/boot.js` as an untracked draft. The
next agent DELETES it first (`rm src/depot/boot.js`) and writes its own
from the plan — a half-executed draft is not a starting point; the plan
is.

## What does not change

Everything else: both moves, both prior amendments, the gates, the
acceptance arithmetic, the mark, the commit subject, the test list.
