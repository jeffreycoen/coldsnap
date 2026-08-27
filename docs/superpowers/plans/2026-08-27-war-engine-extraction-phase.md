# War Engine Extraction — Phase Document

Opened 2026-08-27. The consulted plan is `2026-08-27-war-engine-extraction.md`
in this directory — the owner's document with the three rulings of 2026-08-27
applied. This file holds the task index, the status, and the baselines. Task
plans are written one at a time, served alone for review, and dispatched only
on approval.

## Standing constraints

- Keystone hash and depot-test pass count unchanged at every commit.
- `core.js`, `renderer.js`, and the save format untouched (step 6 re-exports; step 9 edits `renderer.js` under golden + smoke).
- Verbatim moves in the house form: inventory, substitution table, arithmetic acceptance.
- Gates run through `node scripts/gate.mjs <name>`. Every task runs depot-test and golden; smoke joins where the component changed (tasks 1, 3, 4, 5, 9).
- Implementation agents are Sonnet 5 unless the owner rules otherwise at task approval.
- One agent in the tree at a time; stop after every landing; deploy on green.

## Task index

| Task | Mark | Step | What lands | Gates | Status |
|---|---|---|---|---|---|
| T0 | mk2.69 | 0 | `src/depot/api.js` — typedefs (incl. `TickInput`), roster contract, map adapter, throwing surface, CLI | depot-test, golden | LANDED — commit 05e4568, gates 2,091/0 + golden 7/7, build green |
| T1 | mk2.70 | 1 | `depot/sim.js` — the twelve top-level sim functions + `STONE`/`STONE_PITCH`; `src/ui/startview.js` repointed; api.js entry guard made bundler-safe; 16 test files re-taught | depot-test, golden, smoke, depot-lint | LANDED — commit 063a8b0, gates 2,091/0 + 7/7 + 30/0, build green; DepotGame readFileSync count 87→78 |
| T2a | mk2.71 | 2 | `makeMap` returns `GameMap`; `assertMap` into mapgen; api.js part 3 deleted; the two mapFromGlobals call sites migrated; shim intact (6 export lets) | depot-test, golden, smoke, depot-lint | LANDED — commit e2abb96, gates 2,091/0 + 7/7 + 30/0. Open sweep item for T2b: sim.js line-5 header comment still names mapFromGlobals (stale prose, no call site) |
| T2b | mk2.72 | 2 | every consumer takes `map` as a parameter — state/muster/bell/buildlines/sim/DepotGame/startview migrated; 14 signatures changed; ~45 test re-teaches across 11 files | depot-test, golden, smoke, depot-lint | LANDED — commit 6e9f316, final gates 2,091/0 + 7/7 + 30/0. Surviving mapgen imports under src are builders only (checkConnectivity, layDressing, makeMap/buildDepotTerrain/makeGrid/planTrees/computeFlowField) |
| T3 | mk2.73 | 3 | `S` split run / view / input; `serializeRun` filled; byte-equal saves | depot-test, golden, smoke | DISPATCHED 2026-08-27 — plan `2026-08-27-wee-t3-state-split.md`, agent running |
| T4 | mk2.74 | 4 | `depot/boot.js`; `bootWar` filled; resume-hash proof | depot-test, golden, smoke | pending — plan unwritten |
| T5 | mk2.75 | 5 | `tickWar(war, sdt, input)`; `TickFlags` finalized from dispatch derivation; `node src/depot/api.js gate` exits 0 | depot-test, golden, smoke | pending — plan unwritten |
| T6 | mk2.76 | 6 | `engine/index.js` + `depot/legacy.js`; name-count acceptance; damage-law ruling taken here | depot-test, golden | pending — plan unwritten; carries an owner ruling |
| T7 | mk2.77 | 7 | `SPECS_CONTRACT` narrowed to read keys; `bootWar` calls `assertSpecs` | depot-test, golden | pending — plan unwritten |
| T8 | mk2.78 | 8 | `ColdsnapTD` diff report; byte-identical copies deleted; diverged copies to the owner; reading gate exercised | depot-test, golden | pending — plan unwritten; carries owner rulings |
| T9 | mk2.79 | 9 | renderer `kind → builder` registry; `vtype ===` count 0 | depot-test, golden, smoke | pending — plan unwritten |
| T10 | mk2.80 | 2 close | `export let` shim deleted; gate: `grep -c 'export let' src/depot/mapgen.js` = 0 | depot-test, golden | pending — plan unwritten |
| T11 | mk2.81 | — | phase closeout: README claims and screenshots re-checked against the shipped game | — | pending |

`placeStructure`/`removeStructure` join api.js part 4 when T5 lands, inside T5's task plan.

## Baselines (measured 2026-08-27, tree at mk2.68, commit 7f9b287)

| Measure | Command | Value |
|---|---|---|
| depot-test | `node scripts/gate.mjs depot-test` | 2,091 PASS / 0 FAIL (391.9s) |
| Test files slicing DepotGame.jsx | `grep -c 'readFileSync(.*DepotGame' scripts/tests/*.mjs` | 87 hits across 19 files (largest: 04-vision 21, 11-hiring-hall 11, 09-reorg 7) |
| `S.` fields save.js touches | doc's grep over save.js | 32 |
| `S.` fields across src/depot | doc's grep over src/depot | 211 |
| mapgen.js consumers | `grep -rl 'mapgen.js' src scripts` | 20 files |
| `world.<field> =` assignments (depot) | doc's grep | 14 distinct |
| JSDoc blocks in src | `grep -rc '/\*\*' src` | 1 file; 3 `@param/@typedef/@returns` lines |
| Barrel files | `find src -name index.js` | 0 |
| Era tags in src | doc's grep | 810 |
| `vtype ===` in renderer.js | `grep -c` | 2 |
| Grid-mark writers (src/depot) | doc's grep | blocked 19, bTeam 12, wallId 9, building 3, bag 2 |
| TOWER_SPECS keys | node one-liner | mg gun mortar rocket tesla |
| core.js line-form exports | doc's grep | 37 (plus the grouped `export { heading, applyDamage }` and `__mech__`) |

Keystone hashes per fixture seed are recorded by each task plan at its own
dispatch (the suite's keystone asserts ride inside the 2,091). The T5 landing
records `worldHash` and `runHash` from `node src/depot/api.js gate` as the
standing keystone for T6–T10.

## Status

Phase open. T0–T2b landed and pushed (see the index). T3 dispatched
2026-08-27, agent in the tree. 2026-08-27, owner's order applied by the
orchestrator: the mound-routing check and its setup check deleted from
file 33 (ruling recorded in the consulted plan) — the suite's pass count
is 2,089 from mk2.73 on; the depot-test baseline row above reads 2,091
as measured at mk2.68.
