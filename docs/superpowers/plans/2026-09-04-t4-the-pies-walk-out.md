# The Shell Carved — Task 4: the pies walk out (0.3.13)

The four pie builders — the squad, tower, vehicle, and group wedge-disc
blocks in the component's JSX — move to a new `src/depot/pies.jsx` as four
components. Behavior is byte-identical: same wedges, same actions, same
arming, phone and desktop. Under the recorded ruling, the 33 source-text
checks broken by the move are DELETED, each listed below; no new pin is
written.

**Suggested model: Sonnet 5** — a verbatim move with a fixed prop seam and
an enumerated deletion list.

## Required reading (verified against the tree at commit b35e30a)

1. This plan, whole.
2. `/home/batman/coldsnap/CLAUDE.md`, whole.
3. `src/depot/DepotGame.jsx` lines 3460–3690 (the four blocks and their
   surroundings) and lines 2900–3010 (`closeBuild`, `teachPress`).
4. `src/depot/RadialMenu.jsx`, whole.
5. Each test file in the deletion table, at the block containing its
   named checks.

## The design, fixed

New file `src/depot/pies.jsx`:

```js
// COLDSNAP DEPOT — pies.jsx: the four wedge discs. Each takes its hud
// slice and the component's live handles; the bodies are the component's
// own, moved whole. press is the long-press card opener (teachPress);
// closeBuild folds the build tree on a TAKE CONTROL.
import React from "react";
import RadialMenu from "./RadialMenu.jsx";
```

then four exports, each the corresponding JSX block's inner body moved
verbatim under the substitution table:

- `export function SquadPie({ sq, stateRef, press, closeBuild, isTouch })`
  — the `{hud.squadSel && (() => { … })()}` body (first line
  `const sq = hud.squadSel;` DROPPED — `sq` arrives as the prop; the rest
  from `const slots = [` through the closing ternary, verbatim).
- `export function TowerPie({ tr, stateRef, press, closeBuild, isTouch })`
  — the `{hud.towerRadial && (() => { … })()}` body, its
  `const tr = hud.towerRadial;` line dropped likewise.
- `export function VehiclePie({ vr, stateRef, press, closeBuild, isTouch })`
  — the `{hud.vehRadial && (() => { … })()}` body, `const vr = …` dropped.
- `export function GroupPie({ gr, stateRef, press, isTouch })` — the
  `{hud.groupRadial && (() => { … })()}` body, `const gr = …` dropped
  (its slots never call `closeBuild`).

In the component, each block is replaced by one line:

```jsx
{hud.squadSel && <SquadPie sq={hud.squadSel} stateRef={stateRef} press={teachPress} closeBuild={closeBuild} isTouch={isTouch} />}
{hud.towerRadial && <TowerPie tr={hud.towerRadial} stateRef={stateRef} press={teachPress} closeBuild={closeBuild} isTouch={isTouch} />}
{hud.vehRadial && <VehiclePie vr={hud.vehRadial} stateRef={stateRef} press={teachPress} closeBuild={closeBuild} isTouch={isTouch} />}
{hud.groupRadial && <GroupPie gr={hud.groupRadial} stateRef={stateRef} press={teachPress} isTouch={isTouch} />}
```

with `import { SquadPie, TowerPie, VehiclePie, GroupPie } from "./pies.jsx";`
added to the import block. Block boundaries are verified by first and
last line text before cutting, never by number alone. `RadialMenu`
becomes unused in the component after the move — its import line is
removed, verified by grep.

## Substitution table (the only tokens allowed to differ from the moved text)

| moved text | becomes | where |
|---|---|---|
| `const sq = hud.squadSel;` (and the tr/vr/gr twins) | dropped — the name arrives as a prop | pies.jsx |
| `teachPress` | `press` | pies.jsx (the `press={teachPress}` RadialMenu props) |
| `return sq.showPie` (each block's tail) | unchanged — it is the component function's return now | pies.jsx |
| leading indentation | the new function depth | pies.jsx |

`stateRef`, `closeBuild`, and `isTouch` keep their names (props named to
match). An unlisted difference stops the task.

## The 33 deletions (the recorded ruling: movers delete the source-text
checks their moves break; each is one `ok(...)` or `pin(...)` statement,
matched by its quoted name, removed whole)

| file | checks |
|---|---|
| `scripts/tests/03-bell-polish.mjs` | "mk0.60/6: the build chips are engineer-only, at the order site and in the radial" |
| `scripts/tests/04-vision-command-possession.mjs` | the three "RETICLE mk2.00(d) source pin: the squad's / the tower's / the vehicle's TAKE CONTROL closes the build tree" |
| `scripts/tests/09-reorg.mjs` | "T10(f5): the sapper pie gains MINES and WIRES wedges"; "T10(f6): the wedges are gated to sappers, mirroring the engineer gate" |
| `scripts/tests/10-command-refit.mjs` | the audit(j) wiring block's 21 `pin(...)` calls — DEFEND/MOVE/ATTACK/PATROL/STRUCTURES/BAGS/WALLS/MINES/WIRES/squad TAKE CONTROL (squad pie), CAREFUL-FREE/tower TAKE CONTROL/SELL (tower pie), veh DEFEND/MOVE/PATROL/ESCORT/LOAD/UNLOAD/TRACKS/veh TAKE CONTROL (vehicle pie). "handlers live" and the `pin` helper STAY. |
| `scripts/tests/11-hiring-hall.mjs` | "T1(d): the pie carries SELECT ALL wired to its handler" |
| `scripts/tests/25-the-teaching-cards.mjs` | "T6: the wedges carry their cards" |
| `scripts/tests/35-the-armor-attack.mjs` | "(f) pins: the vehicle pie carries ATTACK" — "(f) pins: the attack tap sets the order" STAYS (consumeVehOrderTap, unmoved) |
| `scripts/tests/36-the-screen-select.mjs` | "pins: the reticle is three wedges" |
| `scripts/tests/38-the-chain-builder.mjs` | "pins: the QUEUE wedge stands on both pies"; "pins: the CLEAR wedge stands on both pies" |
| `scripts/tests/39-the-visible-chain.mjs` | "pins: both pies hold their disc while QUEUE is lit" |

A deletion that orphans a variable used by no surviving check removes
the declaration too, reported. Any OTHER failing check of any kind stops
the task — reported, not fixed.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                                     # b35e30a
grep -c 'hud.squadSel && (() => {' src/depot/DepotGame.jsx   # 1
grep -c 'hud.towerRadial && (() => {' src/depot/DepotGame.jsx # 1
grep -c 'hud.vehRadial && (() => {' src/depot/DepotGame.jsx  # 1
grep -c 'hud.groupRadial && (() => {' src/depot/DepotGame.jsx # 1
ls src/depot/pies.jsx 2>&1 | grep -c 'No such file'          # 1
```

### Step 2 — pies.jsx and the component seam, as fixed above.

### Step 3 — the 33 deletions, per the table.

### Step 4 — version, build, gates

1. `src/version.js`: MK → `"0.3.13"`. `npm run build` after.
2. `git status` — expected: `src/depot/DepotGame.jsx`, new
   `src/depot/pies.jsx`, `src/version.js`, the ten test files, the phase
   document (at landing), `.superpowers/gates.log`, `dist/`. Anything
   else stops.
3. Through the gate wrapper, foreground, once each, in order:
   `depot-test` (**2,165 / 0** — 2,198 minus the 33), `golden` (7 PASS),
   then `npm run preview` (background) and `smoke` (30 / 0 — the pies
   mount and the possession flow runs through them). A failed gate stops
   the task with its output; nothing is run twice.

### Step 5 — commit and push

Subject: `the pies walk out — four wedge discs to pies.jsx, thirty-three retired pins with them, 0.3.13`.
Standing trailers. Push; the owner's live check is the acceptance. The
phase document's T4 row lands LANDED with commit and counts; the
depot-test baseline row moves to 2,165.

## Acceptance (arithmetic)

- depot-test 2,165 / 0; golden 7 PASS; smoke 30 / 0.
- `grep -c 'RadialMenu' src/depot/DepotGame.jsx` = 0;
  `grep -c 'export function .*Pie' src/depot/pies.jsx` = 4.
- `git diff --stat src/engine src/graphics src/depot/save.js src/depot/state.js src/depot/hooks.js src/depot/palette.js` — empty.
- DepotGame.jsx line count recorded old → new (expected ≈ 3,832 → ≈ 3,620).

## Report

One line of outcome, then: read-confirmation; each gate's count and
runtime with the suite's printed seeds; the 33 deletions each named
old→gone with any orphaned-variable removals; the line counts old→new;
every deviation of any size as its own labeled bullet; the commit hash
pushed.
