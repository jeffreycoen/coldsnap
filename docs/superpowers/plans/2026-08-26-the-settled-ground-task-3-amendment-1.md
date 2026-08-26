# The Settled Valley — Amendment 1: the other slicers learn stoneCount

*Written by Claude Fable 5, 2026-08-26. The Task 3 agent stopped correctly at Step 8: `genMap` now calls `stoneCount`, and the plan taught that to the slicers in test files 33 and 05's twin battle — but missed that six other slice assemblies across four older test files also rebuild `genMap` from source and now crash without it. The plan defect is mine. Steps 1–7 stand landed in the working tree; no commit was made.*

## The fix

One insertion per slice assembly — `sliceFnX("stoneCount"), ` added directly before the `genMap` slice. Each block's header slice already carries `TOWN_STONE_CAP` (the cap sits above `genMap` since Step 5a, inside every header's `const GRID_CS` → `function genMap` window). Ten lines, four files:

1. `scripts/tests/02-front-f1.mjs:45` — `sliceFn("stoneCount"), ` before `sliceFn("genMap")`.
2. `scripts/tests/05-the-front.mjs:54` — `sliceFn2("stoneCount"), ` before `sliceFn2("genMap")`.
3. `scripts/tests/05-the-front.mjs:124` and `:195` — `sliceFn3("stoneCount"), ` before each `sliceFn3("genMap")`.
4. `scripts/tests/05-the-front.mjs:279` — `sliceFn4("stoneCount"), ` before `sliceFn4("genMap")`.
5. `scripts/tests/06-troops-physics.mjs:45` — `sliceFnP("stoneCount"), ` before `sliceFnP("genMap")`.
6. `scripts/tests/07-armor-demolition.mjs:214`, `:542`, `:715` — `sliceFn4("stoneCount"), `, `sliceFn5("stoneCount"), `, `sliceFn6("stoneCount"), ` before their `genMap` slices.
7. `scripts/tests/08-debug-pass.mjs:233` — `sliceFn15("stoneCount"), ` before `sliceFn15("genMap")`.

`09-reorg.mjs` holds no `genMap` slice (source-pin checks only) — untouched.

## The license

These ten lines are scaffolding repairs, not behavior re-teaches: each block's own checks stay word-for-word identical. The Task 3 plan's licensed re-teaches (file 33 whole, the T6 block) stand unchanged. Any check inside the four files that then reads RED is NOT covered — it stops the task as before.

## Resume

The agent resumes at Step 8 exactly as the plan states: depot-test twice, depot-lint, smoke, then Step 9's deploy. Expected suite count stays 2,090. The four amended files join the commit's staged set.
