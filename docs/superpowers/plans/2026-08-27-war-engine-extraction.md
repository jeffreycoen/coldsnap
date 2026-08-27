# COLDSNAP — War Engine Extraction (Claude Fable 5)

**NOTICE (owner, 2026-08-27): this document is very poor quality. Do not
use it for reference unless the owner explicitly directs it.**

The consulted plan for the extraction phase. The owner's document, checked in on
2026-08-27, with three rulings of that date applied where they land. The phase
document beside this file (2026-08-27-war-engine-extraction-phase.md) holds the
task index, the status, and the recorded baselines.

## Instruction

Make COLDSNAP's war engine reusable so that a new game is a spec and a map.

Constraints: same repo. Keystone hash and depot-test pass count unchanged at every commit. `core.js`, `renderer.js`, and the save format untouched. One surface file, `src/depot/api.js`; a game imports from it and from `engine/index.js` only.

Done when a node script with no browser boots a war, ticks it for 90 seconds, and prints `worldHash`, and `ColdsnapTD` runs on the same code.

The rest of this document is the plan to consult, not the instruction to execute.

**Verdict.** The physics engine is already out. The war engine is not. It lives inside one React effect. The tree is optimized for agent editing under a verification harness. It is not optimized for reading or for use, by a human or by an agent. This plan fixes both: the moves fix use; the declared shapes fix reading.

**How to read this.** Every anchor here is a name, a comment heading, or a grep target. Never a line number. At dispatch, grep each anchor against the live tree. Zero hits or several hits stop the task. Every count is a command. Run it at dispatch and record the number. A number that moved is a finding, not an error. This document is the phase index. Each numbered step under Order is one task file in the house form (inventory, substitution table, arithmetic acceptance); no step is executed from this document alone.

## Done

`src/engine/core.js` is extracted and golden-gated: `scripts/golden.mjs` pins its `worldHash` trajectory. Leave it. It is not physics-only. See step 6.

## Not done

The layer between physics and this specific war. That layer is what would make game #2 fast.

## Blockers, largest first

1. **The frame-loop effect in `DepotGame.jsx`.** Anchor: the `useEffect` inside `DepotGame` that declares `const frame =` and calls `requestAnimationFrame(frame)`. That closure holds the boot order (under the comment `THE BOOT ORDER`), the run state `S`, placement, taps, the bell context, and the frame loop. No test can execute it. The suites mirror it and grep its source text. Count: `grep -c 'readFileSync(.*DepotGame' scripts/tests/*.mjs`. Nothing in that closure is reusable until it is a module.

2. **`mapgen.js` is a process-wide singleton.** Anchor: every `export let` in `mapgen.js`. `makeMap(seed)` assigns them. `fwdU`, `invW`, `fwdDir`, and `clampToRim` close over `ORIENT` at module scope. Consumers: `grep -rl 'mapgen.js' src scripts`. Result: one map per process. A second game, a second valley, or a test with two maps cannot exist.

3. **`S` mixes sim state with view state.** The line already exists. The `S.` fields that `save.js` reads or writes are the sim. Every other `S.` field is view: hover, toasts, zoom, focus, keys, joystick, reach previews. Measure both sets at dispatch: `grep -ohE 'S\.[a-zA-Z_]+' src/depot/save.js | sort -u` against the same command over `src/depot/`. Until they split, the sim cannot run headless and cannot be hashed. (Ruling, 2026-08-27: the split is three-way, not two — see `TickInput` under API part 1. Fields the sim reads every tick but never saves — possession, triggers, toggles, the build-line closures — are INPUT, passed to `tickWar` as an argument, stored in neither `run` nor view.)

## Smaller leaks

- The sim slice of `frame` calls the renderer directly: `R.updateTerritory`, `R.setMines`, `R.setTownFlags`, `R.overlay.setOrderPaths`. Anchor: those call sites inside `frame`. (Ruling, 2026-08-27: this list is a floor, not the inventory — the sim slice also changes rock dressing in `breachRock` and feeds mines from the build-line lay context. Step 5 derives the real list at dispatch.)
- Game code hangs undeclared fields on the engine's world. List at dispatch: `grep -ohE 'world\.[a-zA-Z_]+ = ' src/depot/*.js src/depot/*.jsx | sort -u`. Known members: `world._L`, `world._mech`, `world._grenades`, `world.depotCombat`, `world._devDummies`, `world._holdArea`.
- `core.js` carries game content: `INFANTRY`, `STATIONS`, `buildProvingGrounds`, `bisonFire`, `bisonMg`, `achOnKill`, `recoverBison`, `freezePool`, `thawPool`. It also carries game law inside the tick. `stepWorld` calls `stepUnits`, `stepDrive`, and `stepIceGrind`. `world.depotCombat` gates `explode`, `applyDamage`, `killBody`, `stepProjectiles`, `classifyImpacts`, and `stepStatus`.
- `renderer.js` imports `INFANTRY` from `core.js` and branches on `vtype` (anchor: `vtype ===`), with fixed builders `buildBison`, `buildWaveTank`, `buildApc`, `buildTowerMesh`.
- `startview.js` (src/ui/startview.js) imports `buildTown` from `DepotGame.jsx`. A menu file imports the game component file to get a sim function.
- The import cycle `state.js` → `squads.js` → `accuracy.js` → `state.js`. It does not block this plan. It makes `depot/*.js` an all-or-nothing block.

## Readability

The source records provenance, not contract. Every finding below is a predicate with its measurement. Run each at dispatch and record the number.

- **No declared shapes.** `world`, `body`, `map`, `run`, and `grid` have no written form. The contract lives in `kind` strings, `vtype` strings, and fields hung on `world`. Learning it means reading every consumer. Measure: `grep -rc '/\*\*' src` and `grep -rcE '@param|@typedef|@returns' src`.
- **No table of contents.** No barrel file and no engine API document. An agent's first read is the whole of `core.js`. Measure: `find src -name index.js`.
- **Era tags in comments.** Tags of the form `P<n> T<n>` and `mk<n>.<n>` mark past states. They are a change log inlined into the source. A reader must discount every one to find present behavior. Measure: `grep -rhoE '\b(P[0-9]+ T[0-9]+|mk[0-9]+\.[0-9]+)' src | wc -l`. The rationale prose around them is worth keeping; the tags are not.
- **Short aliases.** `S`, `R`, `T`, `w`, `b`, `u`, `sq`, `SE` carry no meaning outside their enclosing function and cannot serve as grep anchors. Measure: `grep -ohE '\b(S|R|T|w|b|u|sq|SE)\.' src/depot/DepotGame.jsx | sort | uniq -c`. One-letter parameters on exports: `grep -oE '^export function [a-zA-Z_]+\([^)]*\)' src/engine/core.js | grep -cE '\b[a-z]\b'`.
- **File granularity.** The largest files are read whole for any change. Measure: `wc -l src/engine/*.js src/render/*.js src/depot/*.js src/depot/*.jsx | sort -n | tail -6`. Steps 1, 4, and 5 reduce this without design.

Rules for every file this plan creates (`api.js`, `sim.js`, `boot.js`, the tick module, `engine/index.js`, `depot/legacy.js`): full-word names in every new signature; a typedef on every object the file creates or returns; rationale prose allowed, era tags not. Verbatim-moved code keeps its names. Renaming inside a move breaks the move.

## API

One file, `src/depot/api.js`. It is the surface the steps fill in. A game imports from it and from `engine/index.js` only, never from `DepotGame.jsx`. No second surface file. No scripts folder entries; the file is its own command-line entry. Five parts, in this order.

1. **Shapes.** JSDoc `@typedef` blocks, no runtime: `Field`, `Body`, `World`, `GameMap`, `Grid`, `Territory`, `Run`, `War`, `TickFlags`, `TickInput`, `Specs`. Each field list is derived from the tree: the constructor (`makeField`, `makeBody`, `makeWorld`, `makeGrid`, `makeTerritory`) plus every `world.<field> =` and `b.<field> =` assignment in `src/`. Game-assigned fields are marked optional. A game-assigned `world` field that `core.js` reads is marked `READ BY CORE`. `GameMap` keeps the `mapgen.js` export names as keys so the later substitution is a pure prefix (`TOWN` → `map.TOWN`). `Run` is exactly the `S.` fields `save.js` reads or writes. `War` is `{map, field, grid, world, T, town, run}`. `TickFlags` is one boolean per renderer call that lives in the sim slice today: `territory`, `mines`, `townFlags`, `orderPaths`, `dressing` (ruling, 2026-08-27 — the breached-ridge and davy-crater re-dress), with the final list derived at step 5's dispatch. `TickInput` (ruling, 2026-08-27) is the per-tick command object: every field the sim reads each tick that `save.js` never touches — possession state and its stick/reticle/trigger fields, the sandbox toggles, the hold-area switch, the wind toggle, and the build-line drive hooks — derived at task 0 from what `stepDepot` and the trigger blocks in `frame` actually read. `tickWar` takes it as its third argument.

2. **Roster contract.** `SPECS_CONTRACT`, `checkSpecs(specs)`, `assertSpecs(specs)`. One entry per name `specs.js` exports, with its form (table, object, array, number) and the keys required on every row. The starting key lists are the keys present on every row of each table today (the minimum shape). Cross-check the name list against what the game imports from `specs.js`; the two lists must match. `checkSpecs` returns problem strings; `assertSpecs` throws with all of them and returns `specs` when clean. Passes on today's `specs.js`.

3. **Map adapter.** `mapFromGlobals()`, `assertMap(map)`. Builds the `GameMap` object from today's live `mapgen.js` exports: the `export let` names, the grid and rim constants, and the functions that read live map state (`fwdU`, `invW`, `fwdDir`, `clampToRim`, `pondAt`, `rockAt`, `streamAt`, `stoneCount`). Builders stay out. `assertMap` throws listing every missing key. A non-empty `TOWN` is the boot sentinel: before `makeMap(seed)` runs, every live export is empty, `0`, or `null`, and `MAP_SEED` is `0`, so `MAP_SEED` cannot serve. This part is deleted at step 2.

4. **Surface.** `bootWar({seed, resume, dev}) → War`, `tickWar(war, sdt, input) → TickFlags`, `serializeRun(war) → string`. Each has its JSDoc block. Each body is one throw naming the plan step that fills it: 4, 5, 3. The fill rule: when a step lands, replace the throw with an import from the new module and delete the step note.

5. **Command-line entry.** `main()` runs only when the file is the entry point (`import.meta.url` against `process.argv[1]`). `node src/depot/api.js gate [seed=1] [seconds=90]` boots through `bootWar`, ticks, and prints `seed`, `seconds` with the step count, `worldHash`, and `runHash` (a stable-key JSON hash of `war.run`). Until steps 4 and 5 land it prints the step message and exits 1. `node src/depot/api.js manifest [--write out.json] <file...>` prints the names each file imports from `engine/*.js`, `render/renderer.js`, and `depot/api.js`, as sorted JSON; `--write` checks a manifest in. Handles named, aliased, namespace, default, and multi-line imports. Any other argument prints usage and exits 2.

## Structures

What a structure is today, how one is placed, how one dies, and what a new type needs. Every name is a grep anchor.

**Types.**

- Towers. Five keys in `TOWER_SPECS`: `mg` (SPITTER), `gun` (FIELD GUN), `mortar` (MORTAR), `rocket` (SALVO RACK), `tesla` (TESLA COIL). `TOWER_ORDER` fixes the hand order. A tower is one static body: `addBody(world, { kind: "tower", team, mass: 0, hx, hy: spec.hy, hz })` with `b.towerType` set. Player placement adds it in `DepotGame.jsx`; muster adds it with `parkTower(world, grid, field, depotT, team, towerType)` in `muster.js`. It fires in `stepTowers(world, T, discipline, possessedId, arcs, holdArea)` through `towerShot` and `possessedTowerFire` in `state.js`. List the keys at dispatch: `node -e 'const s = await import("./src/depot/specs.js"); console.log(Object.keys(s.TOWER_SPECS).join(" "))'`.
- Stone walls. Courses of `MASON` pieces welded together: `spawnWallCourses(world, x, y, z, orient)` in `state.js`, weld strength `WALL_WELD_BREAK_F = MASON.breakF`. Dials: `WALL_COST`, `WALL_HP`, `WALL_COURSES`, `WALL_HALF`, `WALL_H`, `WALL_COURSE_PITCH`, `WALL_JOINT`, `WALL_THIN`. Orientation from `wallOrientAt`. Support law in `stepWallSupport`; per-course hp in `wallCourseHp`.
- Sandbags. `spawnSandbag`, `SANDBAG_COST`, `SANDBAG_HX`, `sandbagOrientAt` in `state.js`; `seedBags` in `muster.js`. The chosen orientation rides the save as `sandbagOrient`.
- Build lines. Walls and sandbags laid by a squad over time, not dropped: `buildlines.js` (`startBuildLine(grid, sq, kind, a, b, toast, team)`, `linePieces`, `layPieceAt`, `stepBuildLine`, `lineCells`, `pieceHalf`). Field prices `WALL_FIELD_COST`, `SANDBAG_FIELD_COST`; pace `WALL_LAY_PAUSE_S`.
- Mines. `mines.js` (`stepMines(world, mines)`, `minePrices`, `mineSeedRoll`, `mineSeedPlace`). They live in `run.mines`, not as bodies. The renderer learns of them through `R.setMines`.
- Town buildings. Map content, not placeable. `buildTown(world, grid, field)` from the `TOWN` rows; footprint by `townFootprint`; `stepTown(world, grid, town, onRuin)`; destruction by `shatterStructure(world, b, opts)`.

**The grid marks.** A structure exists for routing only through its grid cells: `blocked`, `wallId`, `building`, `bTeam`, `bag`. Count the writers at dispatch: `grep -rhoE '\.(wallId|building|bTeam|bag|blocked) = ' src/depot | sort | uniq -c`. Every change to a mark is followed by `recomputeFlow()`, which is `computeFlowField(grid, objG.gx, objG.gz)`; `onRuin` is the same call. A structure the flow field does not know about does not exist to the enemy.

**Placement today.** One path, inside the frame-loop effect: a hand key (`HAND_KEYS`, `HAND_TAGS`) is pending; `placeZoneMask(grid, heldAt, vetAt, room)` says where and feeds `R.overlay.setZone`; on the tap, `validatePlacement({blocked, ice, held, resources, cost})` says whether; the spend closure pays from `S.reg.scrap`; the creator runs; the grid marks are set; `recomputeFlow()`; the renderer is told. Both teams use the same creators with a `team` argument; that is the symmetry law applied to structures.

**Death.** Towers and bags die by hp through `applyDamage` and `killBody`. Walls die by weld break: a course whose weld exceeds `WALL_WELD_BREAK_F` falls (`fallingSince`), and `stepWallSupport` drops what stood on it. Town buildings die through `shatterStructure`. `hostileStructure(b, team)` and `standingStructure(b)` in `state.js` are the two judgments every other module asks; they sit in the import cycle.

**Persistence.** Structures ride the save as body rows and weld rows through `serializeFront`; mines ride as `run.mines`. The no-migration rule means a new type must fit those rows as they are.

**The API call.** Part 4 of `api.js` gains one function when step 5 lands: `placeStructure(war, key, at, orient, team) → { ok, reason, bodies, flags }`. It wraps the whole path above: zone, validate, pay, create, mark, `recomputeFlow`, and returns `TickFlags` plus a `flow` flag. `removeStructure(war, body)` is its inverse: unmark, kill, `recomputeFlow`. A game never touches the grid marks itself.

**A new structure type needs, in this order.** (1) A spec row, or a new table with an entry in `SPECS_CONTRACT`. (2) A creator that takes `team`, uses `world.rng` and never `Math.random`, and sets its grid marks. (3) A place in `placeStructure` and, if it acts, a step function called from `tickWar`. (4) A renderer builder; `buildTowerMesh` is the model, and step 9's registry is where it goes. (5) A fit inside the existing save rows. (6) Answers from `hostileStructure` and `standingStructure`. (7) If the player places it, a key in `HAND_KEYS` and a tag in `HAND_TAGS`. Acceptance for any new type: keystone hash equal on every fixture seed that does not place it.

## What is reusable

By module, not by size.

Reusable as-is or nearly: the fixed-step tick; the `mapgen.js` recipe, grid, flow field, and connectivity; `territory.js`, `sight.js`, `fog.js`; `squads.js` (cover, cohesion, react); `drivers.js`; `accuracy.js` (range and arc law); `transports.js`; `mines.js`; the wall, sandbag, and placement law in `state.js` (`validatePlacement`, `placeZoneMask`); the bell clock, census pricing, and ground income (`state.js`, `market.js`, `economy.js`, `bell.js`); `save.js`.

COLDSNAP-only: `specs.js` (roster, prices); `cards.js`, `lists.js`, `infocards.js`, the teaching cards; `buildTown`; the palette and foe rack; `Crate.jsx`, `Dispatch.jsx`, `InfoCard.jsx`, `RadialMenu`; the theme.

**The roster contract.** Every reusable module that imports `specs.js` reads a fixed set of names. List it at dispatch: `grep -ohE 'import \{[^}]+\} from "./specs.js"' src/depot/*.js src/depot/*.jsx`. That set, with the shape each consumer reads, is the contract game #2 must satisfy. It is not written down anywhere. The API's part 2 writes it; step 7 narrows it.

## Order

Verbatim moves. Keystone hash before and after each step. House form: inventory, substitution table, arithmetic acceptance. Gates run through `scripts/gate.mjs` as the brief lists.

0. **Land the API file and verify its shapes.** Write `src/depot/api.js` as specified under API. `core.js` is not touched; every typedef lives in `api.js`. Re-derive each field list at dispatch from the constructors plus every `world.<field> =` and `b.<field> =` assignment in `src/`, and diff against the typedefs. A field in the file that the tree lacks, or in the tree that the file lacks, is a finding; fix the file. Run `node src/depot/api.js gate`; it must exit 1 naming step 4. Import `api.js` and run `assertSpecs` on `specs.js`; it must pass. `git status` must show one new file. Acceptance: keystone hash equal (no runtime touched); golden green; the typedefs match the derivation.

1. **Lift the top-level sim functions out of `DepotGame.jsx` into `depot/sim.js`.** Inventory: every top-level function in `DepotGame.jsx` above the default export that contains no JSX and touches no React. Re-derive the list at dispatch. Known members: `stepSquadRouting`, `stepTowers`, `townFootprint`, `buildTown`, `stepTown`, `shatterStructure`, `stepEnemies`, `makeDepotAssaultState`, `clockStr`, `spawnEnemy`, `uprightMember`, `stepDepot`, plus the constants they read (`STONE`, `STONE_PITCH`). `RadialMenu`, `DraftScreen`, and `detectTouch` stay. These functions read mapgen globals (`invW`, `fwdDir`, `TOWN`, `OBJ_POS`, `MAP_SEED`). Give them a `map` parameter now, of the `GameMap` shape in `api.js`, built by the caller with `mapFromGlobals()` after `makeMap(seed)`. Step 2 replaces the source of `map`, not the signature. Point `startview.js` at `sim.js`. The `buildTown` export line is pinned by three test slicers (the comment at its export names them); the task plan carries the re-teach license for exactly that pin. Acceptance: keystone hash equal; every test that greps `DepotGame.jsx` for one of these names now imports it from `sim.js`; the `readFileSync` count falls and the new count is recorded.

2. **De-globalize `mapgen.js`.** (Ruling, 2026-08-27: split in two tasks.) **2a:** `makeMap(seed)` builds and RETURNS the `GameMap` object — the same keys `mapFromGlobals()` builds today, with `fwdU`, `invW`, `fwdDir`, `clampToRim`, `pondAt`, `rockAt`, `streamAt`, `stoneCount` as methods — while still assigning every `export let`. `assertMap` moves into `mapgen.js`; the map adapter part of `api.js` is deleted in the same task. No consumer changes; keystone equal. **2b:** every consumer takes `map` as a parameter, migrated module by module with the pass count checked per module. Widest edit; fully mechanical. The `export let` shim stays through this phase; its delete is this phase's closing task, gate: `grep -c 'export let' src/depot/mapgen.js` returns 0. Acceptance both tasks: keystone hash equal; depot-test pass count equal.

3. **Split `S` into `run`, `view`, and `input`.** `run` = the `Run` typedef: the fields `save.js` touches, plus any field a `restore*` function in `save.js` writes. `input` = the `TickInput` typedef (ruling, 2026-08-27): the per-tick command fields the sim reads but the save never carries. `view` = the rest. `save.js` draws the run line; do not redraw it. The presentation fields riding inside `S.manifest` (`cardUp`, `armedAtWall`) stay inside it — `serializeFront` copies the object whole today and the byte-equality acceptance requires it stays whole. The task plan carries the full three-way field table, every field assigned, written at plan time from the dispatch-time greps. `serializeRun(war)` in `api.js` gets its body here: it calls `serializeFront` with the same context the component builds today. Acceptance: `save.js` reads nothing from `view` or `input`; `serializeRun` output is byte-equal to today's `serializeFront` output on the fixture seeds.

4. **Lift the boot into `depot/boot.js`.** Anchor: the section under `THE BOOT ORDER`, from `makeMap(seed)` to the call to `makeRenderer(`. `bootWar({seed, resume, dev})` returns the `War` typedef: `{map, field, grid, world, T, town, run}`. `api.js` imports it from `boot.js` and drops the throw. Renderer construction stays in the component; so do audio, storage probes, and every wall-clock read — the boot module takes its side effects through a context argument (the `bell.js` ctx precedent) so a headless caller passes no-ops. Acceptance: keystone hash equal; a resumed save boots to the same hash as before (no migration).

5. **Lift the sim slice of `frame` into `tickWar(war, sdt, input)`.** Inventory: bell, spawn, withdraw, territory, fog, mines, `stepDepot`, `drainEvents`, census — DERIVED AT DISPATCH by grepping every `R.` call and every `S.` read inside the sim slice (ruling, 2026-08-27); the list in this sentence is the starting point, not the boundary. Return the `TickFlags` typedef, one flag per renderer call that lives in the sim slice today — `territory`, `mines`, `townFlags`, `orderPaths`, `dressing`, plus whatever the dispatch derivation finds. The component keeps input, camera, and render, builds `TickInput` each frame, and calls `R.*` from the flags. `api.js` drops its throw. Acceptance: none of the renderer calls the derivation lists remain inside the sim slice; keystone hash equal; `node src/depot/api.js gate` exits 0 and its two hashes are recorded as the keystone for every later step.

6. **Then, and only then, `core.js`.** By re-export, not by edit. `engine/index.js` exports the solver names, one export per line, each with a one-line comment stating what it does and what it takes. That file is the engine's table of contents. It becomes the first read for any agent, in place of `core.js`. `depot/legacy.js` re-exports `INFANTRY`, `bisonFire`, and the rest of the game content, in the same form. `core.js` stays byte-identical. Golden holds. Acceptance: every name `core.js` exports appears in exactly one of the two files. List core's names with `grep -oE '^export (function|const|let|class) [A-Za-z0-9_]+' src/engine/core.js`, plus the names inside its grouped `export { ... }` line; count names, not lines. State plainly what this does not do: the tick still runs `stepUnits`, `stepDrive`, `stepIceGrind`, and the `depotCombat` law. Game #2 inherits those under the flag. A game in the same family accepts them. A game that needs a different damage law gets hooks, in the pattern already in the tick (`if (world.mechStep) world.mechStep(world)`) as additive divergence with golden green, or forks. That is an owner ruling at this step, not a default.

7. **Narrow the roster contract.** `SPECS_CONTRACT` in `api.js` checks the minimum row shape. This step narrows each table to the keys its consumers read: for each name, grep the reads (`TOWER_SPECS\[[^]]+\]\.(\w+)` and the local alias each consumer binds) and set the key list to that union. `bootWar` calls `assertSpecs`. Game #2 fails at boot, not mid-war. Acceptance: `assertSpecs` still passes on `specs.js`; every listed key has at least one read site.

8. **First consumer: `ColdsnapTD.jsx`.** It is a live route in `App.jsx`. It imports `core.js` and `renderer.js` and nothing from `depot/`. It defines its own copies of names that also exist in `depot/`. List them at dispatch by comparing top-level function names in both. Diff each copy against `depot/`. Byte-identical: TD imports from `sim.js` and deletes the copy. Different: leave it, record the diff, and the owner rules. (Reading note, 2026-08-27: most copies have diverged — frost tower, `Math.random`, older `buildTown` — so expect the ruling branch, not the delete branch, for nearly all.) Acceptance: the duplicate-name list shrinks and its new length is recorded; the reading gate below is exercised in this task.

9. **Renderer last.** A `kind → mesh builder` registry replaces the `vtype` chains. The fixed-cap instanced pools are the keeper. Acceptance: `grep -c 'vtype ===' src/render/renderer.js` returns 0; golden and smoke green.

## Acceptance gate for the whole job

`node src/depot/api.js gate` boots a war with no React, no DOM, no THREE, runs a scripted war of fixed length on the fixture seeds, and prints `worldHash` plus a hash of `run`. Today it exits 1 naming step 4. When it exits 0, game #2 is a new `specs.js` that passes `assertSpecs`, a new mapgen recipe, and new UI screens on the same sim. Each game checks in the output of `node src/depot/api.js manifest --write` as its manifest; the engine gate reads every manifest.

The reading gate, alongside: an agent with `engine/index.js`, the typedefs in `api.js`, and one game manifest can write game #2's boot without opening `core.js`. Test it by doing exactly that in step 8's task.

## Not this

No abstract Engine class. No plugin system. No second surface file. No separate package until a second game consumes the modules; step 8 is that game. Rename `depot/` last, not first. No stripping of existing comments in `core.js` or `renderer.js`; the text pins may reference them. No renames inside a verbatim move; the new-file rules under Readability apply to new signatures only.

## Rulings

- 2026-08-27 — `TickInput` is a first-class typedef in `api.js` part 1, written at task 0; `tickWar` takes it as its third argument. The `S` split is three-way: run / view / input.
- 2026-08-27 — `TickFlags` gains `dressing`; the step-5 renderer-call inventory and the final flag list are derived at dispatch, not copied from the four-item list.
- 2026-08-27 — Step 2 splits into 2a (GameMap returned, shim intact) and 2b (consumer migration, per-module pass-count checks). The shim delete is this phase's closing task.
- Deferred to step 6, per this document: the damage-law question (hooks vs. inherit under the flag).
- Deferred to step 8, per this document: disposition of each diverged `ColdsnapTD` copy.
- 2026-08-27 — the mound-routing check ("nobody strands at the mound", file 33) is deleted, with its setup check and plumbing: it rolls its own random seeds and failed pushes on its own dice. Ordered removed by the owner in an earlier phase; the order was never written into a plan document and was lost — applied today. The suite's pass count is 2,089 from mk2.73 on.
