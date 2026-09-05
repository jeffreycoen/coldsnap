# The Shell Carved — Phase Document

Opened 2026-09-04. The goal: `src/depot/DepotGame.jsx` (4,383 lines) gives up
everything that is not the screen shell, and a standing rule keeps it from
growing back. This file holds the skeleton, the status, and the index. Each
task's full plan is its own file, written one at a time, served alone for
review, dispatched only on approval.

## The versioning change

The deployment mark gains a leading zero. This phase is 0.3.1x: its first
task deploys as 0.3.10 and each task steps +0.01. `src/version.js` carries
the new form from the first task on. Saves are unaffected beyond what every
deploy already does: a save from a different mark is refused and burned
(`save.js parseFront`), so no save migration exists to break. The mark is
asserted by the smoke gate and shown on the start screen, the phone start
screen, and the war's corner readout — the rename is proven by smoke, not by
eye alone.

## The standing rules (land in task 1)

Added to CLAUDE.md under Frozen laws:

> New interface panels, screens, and self-contained blocks get their own file
> under `src/depot/`; `DepotGame.jsx` takes only the hookup lines that
> connect them.

> Game code reaches the engine, renderer, audio, and storage through
> `src/depot/api.js` — never directly. The screen's own modules sit behind
> the component and are not part of that surface.

## Measured baselines (2026-09-04, tree at mk3.05, commit 8c5f4dd)

| Measure | Value |
|---|---|
| DepotGame.jsx lines | 4,383 |
| Comment-only lines in it | 975 (plus ~80 trailing) |
| Test files reading DepotGame.jsx by file slice | 27 files, ~85 slice sites (heaviest: 04-vision 16, 11-hiring-hall 11, 09-reorg 7) |
| depot-test | 2,136 PASS / 0 FAIL (re-measured at the T1 landing; 2,207 → 2,198 at the T3 landing, amendment 1 — nine source-text pins retired; 2,198 → 2,163 at the T4 landing, amendment 1 — thirty-five source-text pins retired; 2,163 → 2,136 at the T5 landing, amendments 1 and 2 — twenty-seven source-text pins retired) |
| golden | 7 PASS |
| smoke | 30 PASS |

## Standing constraints

- Every task is a verbatim move in the house form: inventory, substitution
  table, arithmetic acceptance (suite pass count; keystone hashes where the
  sim is near the cut). The mk2.74 plan
  (`2026-08-27-wee-t4-engine-leaves-the-screen.md`) is the model.
- The sliced suite is the main hazard: every task plan carries its exact
  per-file re-point list for the pins its move breaks, and any failing pin
  not on the list stops the task.
- Plan-writing for a move may apply it in a throwaway git worktree and run
  depot-test there once; the run's failure list becomes the plan's
  deletion table. The working tree is never touched; the worktree is
  discarded after harvest.
- `core.js`, `graphics/renderer.js`, `save.js`, and the frozen demo are
  untouched all phase. No save-borne key or field shape moves or renames.
- Gates per task: depot-test and golden always; smoke on every task (the
  component changes in all of them). Runs go through
  `node scripts/gate.mjs <name>`.
- Implementation agents are Sonnet 5 unless ruled otherwise at task approval.
- One agent in the tree at a time; stop after every landing; deploy on green.
- Interface behavior is unchanged all phase, phone and desktop both; the
  live site check after each deploy is the acceptance for look and feel.
- Source-text pins — suite checks that grep a source file's text rather than
  run its behavior — are retired. No new one is ever written; movers delete
  the ones their moves break; the full sweep is T8.

## Task index

| Task | Mark | What lands | Status |
|---|---|---|---|
| T1 | 0.3.10 | The mark's new form in `src/version.js`; the growth rule and the door rule into CLAUDE.md; smoke green on the renamed mark | LANDED, commit 1c4b943, depot-test 2,207 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T2 | 0.3.11 | The debug harness out: every `window.__DEPOT*__` hook and the unmount cleanup list move to a new `src/depot/hooks.js`, installed with one call over a context bag | LANDED, commit aac65c3, depot-test 2,207 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T3 | 0.3.12 | The top-of-file pieces out: `RadialMenu`, `DraftScreen`, the styles object, and the palette/rack/lattice tables to their own files beside `Dispatch.jsx` | LANDED, commit 3eac7d1, depot-test 2,198 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T4 | 0.3.13 | The three pie builders (squad, vehicle, tower) and the group pie as components in their own file — pure presentation, every action a prop, the `InfoCard.jsx` discipline | LANDED, commit e3554e6, depot-test 2,163 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T5 | 0.3.14 | The placement and build layer out: buildAt, canBuildAt, the pending flow, the hire/deal/hero placers, sellAt, and the sandbox rack placer, to a builder module over `{ war, view, input, R, toast, … }` — the `tick.js` idiom | LANDED, commit 93f9ad1, depot-test 2,136 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T8 | 0.3.15 | The pin purge, pulled ahead: every remaining source-text pin swept from the suite; behavior checks stay. Ahead of the last two moves so they break nothing | LANDED, commit 18be931, 521 checks deleted, depot-test 1,615 PASS / 0 FAIL, golden 7 PASS / 0 FAIL, smoke 30 PASS / 0 FAIL |
| T6 | 0.3.16 | The selection and order layer out: the tap cycle, the order taps, the line flow, possession take/release, and the chain controls, same builder idiom | OPEN |
| T7 | 0.3.17 | The comment trim, mechanical: every task/phase/mark stamp prefix deleted; comment blocks carrying no constraint deleted; every deletion reported | OPEN |
| Closeout | 0.3.18 | README claims and screenshots re-checked against the shipped game; one short README paragraph naming `src/depot/api.js` as the one import surface, with the headless line `node src/depot/api.js gate`; the phase's line count recorded | OPEN |

## Expected landing

DepotGame.jsx keeps: the component's React state and effects, the frame
loop, the interface refresh block, the pointer/key layer, and the JSX with
its panels imported. Expected size on the order of 2,000–2,500 lines after
T6, lower again after T7. The exact floor is what the task plans find; no
task chases lines past its inventory.

## Status

Phase open. No task plan written. Task plans are written one at a time on
approval of this document.
