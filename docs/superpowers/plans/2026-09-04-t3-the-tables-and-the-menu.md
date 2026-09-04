# The Shell Carved — Task 3: the tables and the menu walk out (0.3.12)

The top-of-file pieces leave `src/depot/DepotGame.jsx` for four new files
beside `Dispatch.jsx`: the styles object, the wedge-disc menu component,
the draft screen component, and the build/rack/lattice tables. Behavior is
byte-identical. This task also removes the four dead imports T2 left
behind (flagged at that landing, carried here on the owner's acceptance).

**Suggested model: Sonnet 5** — a verbatim move; every seam is written
here.

## Required reading (verified against the tree at commit 53d826c)

1. This plan, whole.
2. `/home/batman/coldsnap/CLAUDE.md`, whole — it binds every step.
3. `src/depot/DepotGame.jsx` lines 1–300 (the moving region, whole) and
   the import block (lines 9–45).
4. `src/depot/Crate.jsx`, whole (50 lines) — `CrateChip`/`StockTag`, which
   `DraftScreen` imports.
5. The pin sites in step 5: `scripts/tests/23-the-sandbox.mjs` lines
   10–45, `scripts/tests/24-the-quartermaster.mjs` lines 11–85.

## The design, fixed

Four new files, each holding its block verbatim with an `export` added
and nothing else changed:

- `src/depot/styles.js` — the `P` styles object (lines 60–81), exported
  as `export const P`. `detectTouch` (57–59) STAYS in the component (one
  caller, three lines).
- `src/depot/RadialMenu.jsx` — lines 83–142 (the COMMAND 1b comment and
  the `RadialMenu` function), `export default function RadialMenu`.
  Imports: `React` only.
- `src/depot/DraftScreen.jsx` — lines 210–253 (the P7.2 T8 comment and
  the `DraftScreen` function), `export default function DraftScreen`.
  Imports: `React, { useState }`; `P` from `./styles.js`;
  `CrateChip, { StockTag }` from `./Crate.jsx`; `PALETTE_BY_KEY` from
  `./palette.js`.
- `src/depot/palette.js` — lines 144–208 and 255–292: `PALETTE`,
  `PALETTE_BY_KEY`, `PALETTE_LABEL`, `FOE_RACK`, `FOE_RACK_BY_KEY`,
  `TREE_BRANCHES`, `branchOf`, `QM_LINES`, `LATTICE`, comments included,
  every `const`/function gaining `export`. Imports:
  `TOWER_SPECS, TOWER_ORDER, BISON, APC, JEEP, MECH` from `./specs.js`;
  `SQUAD_SPECS` from `./squads.js`.

The component imports every moved name back:

```js
import { P } from "./styles.js";
import RadialMenu from "./RadialMenu.jsx";
import DraftScreen from "./DraftScreen.jsx";
import { PALETTE, PALETTE_BY_KEY, PALETTE_LABEL, FOE_RACK, FOE_RACK_BY_KEY, TREE_BRANCHES, branchOf, QM_LINES, LATTICE } from "./palette.js";
```

Dead imports removed from the component's import block, each verified by
grep at execution before removal (all four verified dead at the T2
landing): `fireProjectile`, `applyDamage` (from `../engine/core.js` —
the line keeps its other names), `spawnEnemy` (the `./sim.js` line keeps
its other names), `ASSAULT_TIMEOUT` (the `./state.js` line keeps its
other names). After the PALETTE move, `TOWER_ORDER` is expected dead in
the component too — verified by grep at execution; removed only if the
grep shows zero component uses, otherwise kept and reported.

## Substitution table (the only tokens allowed to differ from the moved text)

| moved text | becomes | where |
|---|---|---|
| `const P = {` | `export const P = {` | styles.js |
| `function RadialMenu(` | `export default function RadialMenu(` | RadialMenu.jsx |
| `function DraftScreen(` | `export default function DraftScreen(` | DraftScreen.jsx |
| `const PALETTE = [` (and each moved `const`/`function` in palette.js) | `export const …` | palette.js |
| leading indentation | unchanged (all moved blocks already sit at file scope) | all |

An unlisted difference stops the task.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                                   # 53d826c
grep -c '^const P = {' src/depot/DepotGame.jsx         # 1
grep -c '^const PALETTE = \[' src/depot/DepotGame.jsx  # 1
grep -c '^function RadialMenu' src/depot/DepotGame.jsx # 1
grep -c '^function DraftScreen' src/depot/DepotGame.jsx # 1
grep -c '^const LATTICE = {' src/depot/DepotGame.jsx   # 1
ls src/depot/styles.js src/depot/palette.js src/depot/RadialMenu.jsx src/depot/DraftScreen.jsx 2>&1 | grep -c 'No such file'  # 4
```

### Step 2 — the four files

Create the four files as fixed above, each block moved verbatim under
the substitution table, comments riding with their blocks.

### Step 3 — the component

1. Delete the moved blocks (60–81, 83–142, 144–208, 210–253, 255–292 —
   current-tree anchors; the agent re-verifies each block's boundary by
   its first and last line text before cutting, not by number alone).
2. Add the four import lines fixed above.
3. Remove the four dead imports; run the `TOWER_ORDER` grep and act per
   the design note.

### Step 4 — nothing else moves

`detectTouch`, `QM_KEY`, `CARDS_KEY`, and everything from line 294 on
stay byte-identical. `git diff` on the component shows only: the import
block, and the deleted region between the `CARDS_KEY` declaration and
the `resume` comment block (line 294's comment stands directly after the
imports' replacement region).

### Step 5 — the sliced-suite re-points, exact

Both files read DepotGame.jsx as `src(...)`; each named check re-points
to the new file by adding a read beside the old one. Every executed
re-point is reported old-source → new-source.

1. `scripts/tests/23-the-sandbox.mjs` line 29 (`FOE_RACK` exists), line
   30 (`TREE_BRANCHES…foes` — the component keeps no `branch === "foes"`
   literal, so the OR's first arm must hold), line 32 (every infantry
   tag racked): all three re-point `dg2` → a new `palette.js` read.
   Line 24 (`run.manifest.unlocked = PALETTE.map…`) STAYS on `dg` — that
   line remains in the component.
2. `scripts/tests/24-the-quartermaster.mjs` line 61 (`const LATTICE = {`
   and the rung rows): re-point `dg6` → a `palette.js` read, re-teaching
   the pinned text `const LATTICE = {` → `export const LATTICE = {`
   (old→new reported). Line 80 (the draft deals as paper): re-point
   `dg8` → a `DraftScreen.jsx` read. Lines 34–35 (`cs-deal` present,
   never pinned to its final frame) and 53 (`--restT`) STAY on the
   component reads — the manifest-card and lattice JSX keep those
   strings; a failure there is a finding, not a fix.

Any failing pin NOT on this list stops the task — reported, not fixed.

### Step 6 — version, build, gates

1. `src/version.js`: MK → `"0.3.12"`. `npm run build` after.
2. `git status` — expected: `src/depot/DepotGame.jsx`, the four new
   files, `src/version.js`, the two test files, the phase document (at
   landing), `.superpowers/gates.log`, `dist/`. Anything else stops.
3. Through the gate wrapper, foreground, once each, in order:
   `depot-test` (2,207 / 0), `golden` (7 PASS), then `npm run preview`
   (background) and `smoke` (30 / 0 — the draft screen and build bar
   mount through the moved files). A failed gate stops the task with
   its output; nothing is run twice.

### Step 7 — commit and push

Subject: `the tables and the menu walk out — styles, wedge disc, draft screen, and the build tables to their own files, 0.3.12`.
Standing trailers. Push; the owner's live check is the acceptance.

## Acceptance (arithmetic)

- depot-test 2,207 / 0; golden 7 PASS; smoke 30 / 0.
- `grep -c 'const PALETTE = \[' src/depot/DepotGame.jsx` = 0;
  `grep -c 'export const PALETTE = \[' src/depot/palette.js` = 1.
- `grep -c 'function RadialMenu' src/depot/DepotGame.jsx` = 0;
  `grep -c 'function DraftScreen' src/depot/DepotGame.jsx` = 0.
- `git diff --stat src/engine src/graphics src/depot/save.js src/depot/state.js src/depot/hooks.js` — empty.
- DepotGame.jsx line count recorded old → new (expected ≈ 4,062 → ≈ 3,835).

## Report

One line of outcome, then: read-confirmation; each gate's count and
runtime with the suite's printed seeds; every step-5 re-point old-source
→ new-source and the one pin-text re-teach old→new; the dead-import
removals with their grep results (the four carried from T2, and the
`TOWER_ORDER` verdict); the line counts old→new; every deviation of any
size as its own labeled bullet; the commit hash pushed.
