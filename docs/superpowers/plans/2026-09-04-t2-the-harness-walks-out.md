# The Shell Carved — Task 2: the harness walks out (0.3.11)

The debug harness — every `window.__DEPOT*__` hook except the stopwatch —
moves out of `src/depot/DepotGame.jsx` into a new `src/depot/hooks.js`,
installed by one call over a context bag and uninstalled by the function
that call returns. Behavior is byte-identical: the same hooks on `window`,
the same shapes returned, the same cleanup on unmount. The smoke gate and
the sliced suite are the proof.

**Suggested model: Sonnet 5** — a verbatim move under a substitution
table; the design is fixed here.

## Required reading (verified against the tree at commit a2e36df)

1. This plan, whole.
2. `/home/batman/coldsnap/CLAUDE.md`, whole — it binds every step.
3. `src/depot/DepotGame.jsx` lines 1960–1975 (the cue queue and `cueN`),
   1976–2002 (`saveFront`/`saveStat`), 2255–2585 (the hook block, whole),
   2586–2620 (the stopwatch — it STAYS), 3410–3430 (the unmount cleanup).
4. `src/depot/boot.js` lines 1–30 — the extraction idiom this repeats.
5. The four pin sites named in step 5, each read before editing.

## The design, fixed

- New file `src/depot/hooks.js` exporting one function:
  `installDepotHooks(ctx)`. It assigns every moved hook to `window` and
  returns `uninstallDepotHooks`, a function holding today's delete loop
  verbatim. No other exports.
- `ctx` is destructured at the top of the function so every hook body
  stays verbatim:
  `{ world, run, view, input, map, grid, field, T, R, canvas, stateRef,
  RES, buildAt, groundPoint, pickHeightAt, consumeOrderTap, getSaveStat,
  cueN }`.
- `saveStat` is a mutable component local written by `saveFront`; it
  crosses as the getter `getSaveStat` — the ONE body edit, listed in the
  substitution table.
- `cueN` is a mutable object; it crosses by reference (the component's
  `cue()` keeps writing it; `__DEPOTCUES__` keeps reading it). `RES` and
  `stateRef` cross as plain values.
- **What moves:** DepotGame.jsx lines 2260–2582 — the 45 hooks from
  `window.__DEPOT__` through `window.__DEPOTENEMYPOS__`, comments
  included — and the unmount delete loop at line 3423.
- **What stays, named so the cut is exact:** the `cueN` declaration
  (line 1971) and the `cue` function; `saveFront`/`saveStat`
  (1976–1992); the whole `?perf=1` stopwatch including
  `window.__DEPOTPERF__` (2595–2616) — it reads the frame loop's ring
  buffers and never moves; `devSpawnAt` (a placer, not a hook — T5's
  business).
- The delete loop's name list is moved verbatim, not corrected: it names
  34 hooks while 45 exist, and that gap is today's shipped behavior. It
  is reported as an observation, never repaired here.

## hooks.js imports (exactly these; any difference stops the task)

```js
import { fireProjectile, applyDamage } from "../engine/core.js";
import { buildMech } from "../engine/mech.js";
import { MECH } from "./specs.js";
import { windAt } from "./wind.js";
import { spawnEnemy } from "./sim.js";
import { SQUAD_SPECS, makeSquad } from "./squads.js";
import { holderAt, canBuild, fogStateFor } from "./territory.js";
import { endCardReady, pendingArmed, spawnSquadMembers, ASSAULT_TIMEOUT } from "./state.js";
```

## Substitution table (the only tokens allowed to differ from the moved text)

| moved text | becomes | where |
|---|---|---|
| `last: saveStat` | `last: getSaveStat()` | hooks.js, `__DEPOTSAVE__` |
| leading indentation (6 spaces, component depth) | the new function's depth (2 spaces) | hooks.js, every moved line |
| the delete loop's `for (const k of [...]) delete window[k];` | wrapped as the returned `uninstallDepotHooks` function, list verbatim | hooks.js |

An unlisted difference stops the task.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                                      # a2e36df
grep -c 'window\.__DEPOT' src/depot/DepotGame.jsx         # 51
ls src/depot/hooks.js 2>&1 | grep -c 'No such file'       # 1
grep -c 'installDepotHooks' src/depot/DepotGame.jsx       # 0
grep -c 'window.__DEPOTENEMYPOS__' src/depot/DepotGame.jsx # 1
```

### Step 2 — hooks.js: the harness moves

Create `src/depot/hooks.js`: the import block above, then

```js
// COLDSNAP DEPOT — hooks.js: the debug harness. Every window.__DEPOT*__
// hook the tests and staging scripts drive, installed by the component at
// mount over a context bag, removed by the returned uninstall at unmount.
// __DEPOTPERF__ is not here — the stopwatch reads the frame loop's own
// ring buffers and stays in the component.
export function installDepotHooks(ctx) {
  const { world, run, view, input, map, grid, field, T, R, canvas, stateRef,
    RES, buildAt, groundPoint, pickHeightAt, consumeOrderTap, getSaveStat, cueN } = ctx;
```

followed by the moved block (lines 2260–2582) verbatim under the
substitution table, then:

```js
  return function uninstallDepotHooks() {
```

holding line 3423's delete loop verbatim, then the two closing braces.

### Step 3 — the component calls the door

In `DepotGame.jsx`:

1. Add to the import block:
   `import { installDepotHooks } from "./hooks.js";`
2. Replace the moved block (2260–2582) with:
   ```js
   const uninstallHooks = installDepotHooks({ world, run, view, input, map, grid, field, T, R, canvas, stateRef,
     RES, buildAt, groundPoint, pickHeightAt, consumeOrderTap, getSaveStat: () => saveStat, cueN });
   ```
   placed AFTER `consumeOrderTap`, `buildAt`, `groundPoint`, and
   `pickHeightAt` are all defined — the moved block's own position
   already satisfies this; the call sits exactly where the block was.
3. Replace line 3423's delete loop with `uninstallHooks();`.
4. Delete the imports the component no longer uses once the hooks are
   gone, and only those, each verified with a grep before removal.
   Verified at plan-writing against the live tree: `windAt` is
   removable (its only component use is the moved `__DEPOTSETT__`);
   `holderAt` (town flags, line 2954), `fogStateFor` (the renderer's
   territory wiring, line 458), and `endCardReady` (frame loop and
   interface block, 4 uses) all stay. A grep that contradicts this is
   reported, not resolved silently.

### Step 4 — the sliced-suite re-points, exact

Four files pin hook text against DepotGame.jsx source; each re-points to
hooks.js. Every executed re-point is reported old-source → new-source.

1. `scripts/tests/01-engine-era.mjs` line 1867 — the `__DEPOTTHIN__`
   team-2 pin tests `depotSrc3` (read at 1834, also used by the
   corpse-sweep pins that STAY on DepotGame). Add beside the read:
   `const hooksSrc = fs.readFileSync(new URL("../../src/depot/hooks.js", import.meta.url), "utf8");`
   and re-point check (g) alone to `hooksSrc`.
2. `scripts/tests/04-vision-command-possession.mjs` lines 664–674 — the
   `__DEPOTORDER__` body match (regex spans to `__DEPOTFOCUS__` with
   6-space indentation). Read hooks.js beside `dsrc` and re-point the
   `orderBody` match to it, re-teaching the regex's indentation
   `\n      window\.` → `\n  window\.` — old→new reported. The
   acceptLine pins above it stay on `dsrc`.
3. `scripts/tests/04-vision-command-possession.mjs` line 1589 — the
   `world.wind = windAt` count-1 pin on `gameSrc`: after the move the
   component carries 0 and hooks.js carries 1. Re-teach to assert
   exactly that, both counts, both files — old→new reported.
4. `scripts/tests/05-the-front.mjs` line 426 — `__DEPOTTOWN__` exists:
   re-point to a hooks.js read.
5. `scripts/tests/06-troops-physics.mjs` line 234 — the `__DEPOTBUILD__`
   → `buildAt` pin: re-point to a hooks.js read (the pinned text itself
   is unchanged — `buildAt` is a destructured name in hooks.js).

Any failing pin NOT on this list stops the task — reported, not fixed.

### Step 5 — the phase document's stale baseline

In `docs/superpowers/plans/2026-09-04-the-shell-carved-phase.md`, the
baselines row `depot-test | 2,089 PASS / 0 FAIL …` becomes
`2,207 PASS / 0 FAIL (re-measured at the T1 landing)`.

### Step 6 — version, build, gates

1. `src/version.js`: MK → `"0.3.11"`. `npm run build` after.
2. `git status` — expected: `src/depot/DepotGame.jsx`, new
   `src/depot/hooks.js`, `src/version.js`, the four test files, the two
   plan documents (this file's status row lands in the phase index),
   `.superpowers/gates.log`, `dist/`. Anything else stops.
3. Foreground, once each, in order, through the gate wrapper:
   `node scripts/gate.mjs depot-test` (2,207 / 0),
   `node scripts/gate.mjs golden` (7 PASS),
   then `npm run preview` (background) and `node scripts/gate.mjs smoke`
   (30 / 0 — smoke drives `__DEPOT__`, `__DEPOTSTART__`, `__DEPOTEND__`
   through the moved installer). A failed gate stops the task with its
   output; it is never rerun.

### Step 7 — commit and push

Subject: `the harness walks out — every debug hook to hooks.js, installed in one call, 0.3.11`.
Standing trailers. Push; the owner's live check is the acceptance.

## Acceptance (arithmetic)

- depot-test 2,207 / 0; golden 7 PASS; smoke 30 / 0.
- `grep -c 'window\.__DEPOT' src/depot/DepotGame.jsx` = 4 (the `cueN`
  comment at 1971, the `__DEPOT*__` prose comment near the end block,
  and the two stopwatch sites) — the executed value is measured and
  reported; anything above 4 stops.
- `grep -c 'window\.__DEPOT' src/depot/hooks.js` = 47 (45 hooks plus
  the prose mentions riding the moved comments) — measured and reported.
- `git diff --stat src/engine src/graphics src/depot/save.js src/depot/state.js` — empty.
- DepotGame.jsx line count recorded old → new (expected ≈ 4,383 → ≈ 4,060).

## Report

One line of outcome, then: read-confirmation; each gate's count and
runtime with the suite's printed seeds; every step-4 re-point old-source
→ new-source and the two pin-text re-teaches old→new; the delete-list
gap (34 names, 45 hooks) as its own labeled observation bullet; the
import-removal greps' results; the line counts old→new; every deviation
as its own labeled bullet; the commit hash pushed.
