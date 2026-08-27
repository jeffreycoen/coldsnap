# War Engine Extraction — Task 4 combined: the engine leaves the screen (mk2.74)

One task, two moves, one landing. The boot (the block that builds the map,
ground, grid, world, town, censuses, territory, and the run bag) moves out
of the game component into a new file `src/depot/boot.js`, filling
`bootWar`. The per-tick war step (enemies, towers, the bell, spawning,
income, territory, devices, the event drain) moves into a new file
`src/depot/tick.js`, filling `tickWar`. At the landing,
`node src/depot/api.js gate` boots a war from a seed with no browser, runs
it 90 seconds, prints the world checksum, and exits 0 — the phase's goal.
The screen component keeps everything screen-only: renderer, audio,
camera, pointer and key handling, the presentation state, and calls the
two new doors.

This absorbs the phase index's tasks 4 and 5 (owner's order, 2026-08-27).
The phase ends after this task and the closeout; tasks 6 through 11 are
off the board (owner's ruling, 2026-08-27). Marks stay sequential, none
skipped: this task is mk2.74 and the closeout becomes mk2.75 — the phase
index re-numbers to say so at this plan's approval.

There is no permission to edit tests freely. Every test edit is listed in
step 7, exact. Any test failure not predicted there stops the task with a
report. Any surprise of any size stops the task. Nothing is run twice.

**Suggested model: Sonnet 5** — the moves are verbatim under a
substitution table; the design is fixed here, and every seam edit is
written below. It is a LONG task; the alternative is Fable on the owner's
word.

## Required reading (verified against the tree at commit e8938d8)

1. This plan, whole.
2. `src/depot/DepotGame.jsx` — the mount effect whole (lines 404–3783),
   read before any cut.
3. `src/depot/api.js`, whole (441 lines).
4. `src/depot/sim.js` — `stepDepot` (line 529 on) and `stepEnemies`.
5. `src/depot/bell.js`, whole.
6. `src/depot/save.js` — `serializeFront` and the restore exports only.
7. The test files named in step 7, each at the pins listed there.

## The design, fixed

- `bootWar(opts)` lives in `src/depot/boot.js`; `opts` is
  `{ seed, resume = null, dev = false }`. It returns the War object
  (api.js's typedef) — no renderer, no audio, no storage, no window
  reads inside. The component computes the seed (its address-bar and
  menu logic stays where it is) and passes it in.
- `tickWar(war, sdt, input)` lives in `src/depot/tick.js`. One call
  advances the war by one fixed step (the component's accumulator loop
  and the headless gate both call it per step). It returns
  `{ events, flags }`: the frame's drained world events plus the
  TickFlags booleans the screen reads to update drawings.
- `src/depot/api.js` part 4 replaces the two throwing bodies with
  re-exports from the new files. The gate's loop already calls them.
- The War typedef gains one field: `seq` — `{ apc: number }`, the
  armored-carrier seat counter (mount-scope today, line 504). It is
  never saved; save.js is untouched.
- The TickInput typedef gains one field: `feedMech` — a per-tick
  callback `(mech, dt) => void` the component installs to feed the
  possessed walker's controls (its body reads keys and camera, so it
  cannot move); `defaultTickInput()` carries `feedMech: null`.
- The bell rings inside `tickWar`. The side-effect context (line 2210's
  `bellCtx`) becomes `input.bellCtx`; when it is null (headless),
  `tickWar` builds a silent one from the war itself whose `saveFront`
  calls `serializeRun(war)` and discards the string — the one
  draw per bell from the seeded random stream (save.js law) happens identically with no screen.
- Small pure helpers the component and boot both need move to boot.js
  as exports: `stampBag(grid, b, side)` (line 456), `buildEmitters(world, map)`
  (line 627), `treeAt` stays internal. The component re-derives
  `depotP`, `depotE`, `objG`, `townUV`, `townFlagMeta` from the returned
  war (each is a pure read of `war.map`, `war.town`, `war.grid`).
- What does NOT move, named so the cut is exact: the renderer build and
  every `R.*` call; the audio build and every `A.*` call; the address-bar
  seed logic; the storage toggle reads (fog, discipline, wind, health);
  the `view` bag and all its methods; the smear replay (reads
  `R._splat`); `R.setZoom` on resume (component calls it off
  `war.run.zoom` after boot); the whole pointer/key/tap layer; the
  possessed-reticle steering block (lines 3072–3121 — view work); the
  end-card, save-burn side effect (`burnFront` touches storage — the
  component keeps `burnSave`, keyed off `run.gameOver || run.victory`
  exactly as today at line 2982); the interface refresh; every
  `window.__DEPOT*__` hook.

## Inventory — what moves, verbatim

Anchors are against the tree at commit e8938d8.

**Move A — the boot, DepotGame.jsx lines 410–1032 → boot.js.** From the
`THE BOOT ORDER` comment (line 410) through the end of the resume-restore
block (line 1032, the smear-replay line EXCLUDED — it stays). Inside that
range these pieces stay behind in the component, cut around them:
- line 425 (`urlSeed`) and the seed expression at 426–430 (the component
  resolves `seed` and passes it),
- lines 707–730 (`makeRenderer` and its options object),
- lines 731–766 (`EXT`, audio build, reflectors, stream ribs for
  DRAWING — the stream-rib block 739–752 is renderer dressing; boot keeps
  nothing of it; the component rebuilds `streamRibs` from `war.map.STREAM`
  with the identical code),
- lines 753–788 (dressing, roads, objective, banners, fog/discipline/
  wind/health toggle reads — `discipline`/`windOn` land in the component
  and feed `input` exactly as today),
- the `view` bag (858–978) and `input` bag (894–906) — the component's;
  `input` is built in the component and handed to `tickWar`,
- lines 1004 (`R.setZoom`) and 1031 (smear replay).
The rest — map/field/terrain/grid/world, `stampBag`, the resume body/
weld/town/census/rock restore, territory + sight, `townUV`/`townFlagMeta`
construction (boot keeps them internal AND the component re-derives its
own copies; they are pure), tree/rock planting, `musterFreshStart`, the
run bag literal, the resume run-restore block — moves whole. The
sandbox-opening block (lines 982–989) STAYS in the component — it reads
`PALETTE`, a component constant — and runs right after `bootWar` returns
(step 5's code carries it). `rocksLive` becomes `war.rocksLive` (see the typedef note in
step 3).

**Move B — the tick, out of the frame loop → tick.js.** These blocks, in
today's execution order, become the body of `tickWar`:
- `stampEnd(run, world.t)` (line 2979),
- the bell: `stepBell` + the ring (line 3193, stripped of the two view
  calls — `view.teachFire("bell")` and the wall-clock arming stamp stay
  in the component keyed on the returned `flags.bell`),
- spawn timer / withdrawal (3207–3217),
- income (3220–3221),
- the territory/sight accumulator (3223–3243; `terrAcc` becomes
  `war.clock.terrAcc`), device and fog steps and the dead-bag release
  (3251, 3269, 3272–3276) — their renderer twins (`R.setMines`,
  `R.updateTerritory`, `R.setTownFlags`, the order-path overlay
  3277–3292) stay in the component, keyed on `flags.territory`,
- `world.events.length = 0` and the fixed-step body: the mech feed
  (via `input.feedMech`), `stepDepot`, and the four possessed-trigger
  blocks (3316–3367),
- the census and market accumulators (3390–3403),
- the event drain — `drainEvents` (2501–2549) moves whole EXCEPT its two
  renderer calls: `breachRock` (2471–2500) moves minus its `R.setDressing`
  line and its toast (the flags carry `dressing: true`; the component
  re-dresses and toasts), and the davy re-dress check sets
  `flags.dressing` instead of calling the renderer. `view.teachFire`
  at 2537 leaves the drain; the component fires it off the returned
  kill events.

The frame loop keeps: the sdt computation (view state), the camera/pan/
possession-focus blocks, the reticle block, the hover/selection blocks,
the moved-selection pruning (T3), the renderer/audio consume calls (fed
from `tickWar`'s returned events plus the cue queue), all the screen-
anchor projection work, and the interface refresh.

**TickFlags, derived at plan-writing** (the 2026-08-27 ruling): the
returned `flags` are `{ territory, mines, townFlags, orderPaths, dressing,
bell }` — booleans; `territory` true on any 4Hz territory step this call,
`mines`/`townFlags`/`orderPaths` ride it (their data changes only then),
`dressing` true when a rock breached or a davy carve landed, `bell` true
when the bell rang this call. The api.js TickFlags typedef is re-signed to
exactly this list.

## Substitution table (the only tokens allowed to differ from the moved text)

| moved text | becomes | where |
|---|---|---|
| `resumeRef.current` | `opts.resume` | boot.js |
| `dev` (bare reads) | `opts.dev` | boot.js |
| `seed` (the resolved value) | `opts.seed` | boot.js |
| `let apcSeqN = 0; const nextApcSeq = () => ++apcSeqN;` | `war.seq = { apc: 0 };` + `const nextApcSeq = () => ++war.seq.apc;` | boot.js |
| `terrAcc` | `war.clock.terrAcc` | tick.js |
| `R.setDressing(...)` / `R.setMines(...)` / toast lines inside moved code | deleted; the boolean in `flags` replaces each | tick.js |
| `view.teachFire(...)` inside moved code | deleted; fired by the component off returned events/flags | tick.js |
| function-scope names the cut orphans (`ws`, `run`, `world`, ...) | read off `war.` | tick.js |

An unlisted difference stops the task.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                                    # e8938d8
grep -c "THE BOOT ORDER" src/depot/DepotGame.jsx        # 1
grep -c "bootWar: filled by step 4" src/depot/api.js    # 1
grep -c "tickWar: filled by step 5" src/depot/api.js    # 1
ls src/depot/boot.js src/depot/tick.js 2>&1 | grep -c "No such file"   # 2
grep -n 'const bellCtx = { cue, toast, townUV' src/depot/DepotGame.jsx # 1 hit at 2210
grep -c 'const war = { map, field, grid, world, T, town' src/depot/DepotGame.jsx # 1
node src/depot/api.js gate; echo exit=$?                # exit=1
```

### Step 2 — boot.js: the boot moves

Create `src/depot/boot.js` with exactly this import block — an import
beyond this list, or a missing one, is a finding that stops the task,
never a silent addition:

```js
import { makeField, makeWorld, addBody, mulberry32 } from "../engine/core.js";
import { buildMech } from "../engine/mech.js";
import { MECH } from "./specs.js";
import { makeMap, buildDepotTerrain, makeGrid, planTrees, computeFlowField } from "./mapgen.js";
import { buildTown, townFootprint, makeDepotAssaultState } from "./sim.js";
import { censusDepotChunks, makeManifestState, makeFoeState, BELL_PERIOD_S } from "./state.js";
import { restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
import { makeTerritory } from "./territory.js";
import { makeSight } from "./sight.js";
import { makeRegiment } from "./economy.js";
import { musterFreshStart } from "./muster.js";
```

Then, in this order:

1. `export function stampBag(grid, b, side)` — line 456's closure with
   `grid` as a parameter, body verbatim.
2. `export function buildEmitters(world, map)` — line 627's closure with
   its two reads as parameters, body verbatim.
3. `export function bootWar(opts = {})` — the Move A text, verbatim under
   the substitution table, assembling and returning
   `war = { map, field, grid, world, T, town, census, census2, run,
   seq, clock: { terrAcc: 0 }, rocksLive }`.

### Step 3 — api.js: the doors open, the typedefs re-sign

1. `bootWar` throw body → `export { bootWar } from "./boot.js";` (adjust
   to a re-export line at the file top with the other imports; the shape comment
   stays on a plain re-export).
2. `tickWar` throw body → re-export from `./tick.js`.
3. War typedef: add `seq` (never saved), `clock` (never saved),
   `rocksLive` (the live ridge list; regrown on boot, culled on breach).
4. TickInput typedef: add `feedMech` and `bellCtx` (both nullable,
   headless-default null). `defaultTickInput()` gains
   `feedMech: null, bellCtx: null`.
5. TickFlags typedef: re-signed to the six-boolean list above.

### Step 4 — tick.js: the tick moves

Create `src/depot/tick.js` with `export function tickWar(war, sdt, input)`
holding Move B verbatim under the substitution table. The internal
default bell context, built once per war (cached on `war.clock._bellCtx`):

```js
// headless bell context: silent cues, the one save draw per bell intact.
const noop = () => {};
function defaultBellCtx(war, input) {
  const townUV = war.town.map((b) => { const c = war.map.invW(b.x, b.z); return { id: b.id, x: c.u, z: c.v, marker: b.marker, get ruined() { return b.ruined; } }; });
  return {
    cue: noop, toast: noop, townUV,
    buildSnapshot: () => buildSnapshotOf(war),
    nextApcSeq: () => ++war.seq.apc,
    saveFront: () => { serializeRun(war); },
    possessed: () => !!(input.possess),
  };
}
```

`buildSnapshotOf(war)` is line 1049's `buildSnapshot` moved verbatim with
its `world`/`run` reads off `war.` — exported from tick.js; the component
deletes its copy and imports this one (its bellCtx uses it too).

### Step 5 — the component calls the doors

In `DepotGame.jsx`:

1. The Move A range is replaced by:
   ```js
   const war = bootWar({ seed, resume: RES, dev });
   const { map, field, grid, world, T, town, run } = war;
   const depotCensus = war.census, depotCensus2 = war.census2;
   const nextApcSeq = () => ++war.seq.apc;
   if (dev) {
     run.started = true;
     run.manifest.unlocked = PALETTE.map((p) => p.key);
   }
   ```
   followed by the retained screen-side blocks (renderer build, audio,
   dressing/roads/objective/banners off `war.map` and `war.rocksLive`,
   stream ribs, toggles, the `view`/`input` bags, `R.setZoom(run.zoom)`
   and the smear replay under `if (RES)`), then the re-derivations:
   ```js
   const depotP = map.TOWN.find((t) => t.depot && t.team !== 2), depotE = map.TOWN.find((t) => t.depot && t.team === 2);
   const objG = grid.worldToGrid(map.OBJ_POS.x, map.OBJ_POS.z);
   const townUV = town.map((b) => { const c = map.invW(b.x, b.z); return { id: b.id, x: c.u, z: c.v, marker: b.marker, get ruined() { return b.ruined; } }; });
   const townFlagMeta = new Map(map.TOWN.map((t) => [t.id, { ny: t.ny, depot: !!t.depot, fwall: t.id.startsWith("fwall"), marker: !!t.marker }]));
   ```
2. `input` gains `feedMech: (mech, cdt) => feedMechCommands(mech, cdt)`
   and `bellCtx` (the today's line-2210 object, `saveFront`/`possessed`
   unchanged).
3. The frame loop's Move B blocks are replaced by, inside the existing
   fixed-step while loop:
   ```js
   const { events, flags } = tickWar(war, STEP, input);
   frameEvents.push(...events);
   if (flags.bell) { view.teachFire("bell"); run.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
   if (flags.territory) terrFlagged = true;
   if (flags.dressing) dressFlagged = true;
   ```
   with `frameEvents`/`terrFlagged`/`dressFlagged` declared at the top of
   the frame and consumed after the loop: the renderer-twin blocks
   (updateTerritory, setMines, setTownFlags, order paths) run under
   `terrFlagged`; the dressing re-lay and the "THE RIDGE IS BREACHED"
   toast under `dressFlagged`; `R.consume`/`A.consume` read
   `frameEvents` plus the cue queue; the teach fires
   (`kill_price`, `convoy`) key off `frameEvents`/state exactly as the
   drain and loop did.
4. The spawn-cadence caveat, stated: today the whole bell/spawn/income/
   territory group runs once per FRAME on `sdt`; after this task it runs
   once per fixed STEP inside `tickWar`. All of it is accumulator- or
   clock-driven (`sdt` sums identically across sub-steps), so outcomes
   are unchanged; the 2,089 suite and the golden gate arbitrate, and any
   failure there stops the task — it is not repaired in flight.

### Step 6 — the headless proof

```bash
node src/depot/api.js gate; echo exit=$?      # exit=0 — prints seed, steps, worldHash, runHash
node src/depot/api.js gate 7 30; echo exit=$? # exit=0 — a second seed, shorter run
```

Run each twice in a row: the printed hashes must be identical run to run
(the determinism law). The four numbers (two seeds' worldHash/runHash)
are recorded in the landing report as the standing keystone.

### Step 7 — the sliced-suite re-points, exact

The moved text is verbatim, so a pin on it fails only because the file
changed. Every edit is a re-point of which file a harness reads — the
pinned text itself is untouched. The list (file: pins, today's anchors):

- `01-engine-era.mjs` — the emitter pins (`EMIT.unit`/`EMIT.wall` rows)
  and the `censusDepotChunks(` boot read: re-point those reads to
  boot.js. The `towerReachCached` pin stays (view code, unmoved).
- `02-front-f1.mjs` — `cardUp`/`sdt` pins stay (the sdt gate stays in
  the component). No edit expected; listed so a failure here is a
  finding, not a fix.
- `04-vision-command-possession.mjs` — the possessed-trigger pins
  (`possessedVolley(`, `possessedTowerFire(` call lines) re-point to
  tick.js; the reticle pins (steer/reclamp/stickyLock) and the
  `stepSight` frame pin stay if `stepSight` text stays — `stepSight`
  MOVES (territory block), so that one pin re-points to tick.js; the
  `makeSight` boot pin re-points to boot.js; the selection-clear pins
  stay (component).
- `05-the-front.mjs` — `buildDepotTerrain`, `makeTerritory`,
  `world.streamAt`, `planTrees` boot pins re-point to boot.js. The
  `const EXT = { x: 95, z: 95 };` pin STAYS (EXT remains in the
  component).
- `06-troops-physics.mjs`, `07-armor-demolition.mjs`,
  `08-debug-pass.mjs` — their boot-region pins (`stampBag`, the
  resumed-bag stamp, `makeField(181, ...)`, the apcSeq resume guard)
  re-point to boot.js; 08's order-path/`c.bagId` pins split — the
  overlay call stays (component), the bag-release read re-points to
  tick.js.
- `09-reorg.mjs` — `const r = RES.run;`, the apcSeq pair, the input-bag
  pin: resume-restore pins re-point to boot.js; the
  `stateRef.current = { run, view, input };` and `possess: null` pins
  stay (component). The apcSeq pins re-teach to the substitution
  table's new form (`war.seq = { apc: 0 };` / `() => ++war.seq.apc`) —
  the ONE pin-text change in this task, old→new exactly that.
- `11-hiring-hall.mjs` — `world._mech = { take:`, `resources: 250`,
  `armedAtWall = 0` boot pins → boot.js; the `ringBell();` frame pin →
  tick.js re-teach to the flags form (`if (flags.bell)` — old→new
  written at execution against the actual landed line, reported); the
  convoy/sdt pins stay.
- `16-the-deep-floor.mjs` (`carveFloor = -12`),
  `21-the-broken-ridge.mjs` (rock hp/seatY), `22-the-tesla-coil.mjs`
  (the run-bag arcs pin), `23-the-sandbox.mjs` (the dev-opening pin;
  its two tick pins → tick.js), `18-the-green-fog.mjs` (`stepFog` →
  tick.js), `25-the-teaching-cards.mjs` (view pins stay; the
  `teachUp`/sdt pins stay), `26-the-ground-pays.mjs` (income and
  ground-rate pins → tick.js; `R.setTownFlags(rows)` stays),
  `28-the-earned-muster.mjs` (earned-till pin → tick.js),
  `33-the-settled-ground.mjs` (townFootprint import read — no edit;
  sim.js unmoved).
- Harnesses that EXECUTE sliced boot text (03, 05, 07, 11's fixture
  builders): their `readFileSync(...DepotGame...)` sources change to
  boot.js where the sliced region moved; the slice anchors themselves
  are unchanged text.

Any failing pin NOT on this list stops the task — reported, not fixed.
Each executed re-point is reported per file, old source → new source.

### Step 8 — version, build, gates

1. `git status` — expected: `src/depot/DepotGame.jsx`, `src/depot/api.js`,
   new `src/depot/boot.js` and `src/depot/tick.js`, `src/version.js`,
   the step-7 test files, the two phase documents (index row updated at
   landing), `.superpowers/gates.log`. Anything else stops.
2. MK → `"mk2.74"`; `npm run build` after.
3. Foreground, once each, in order: `node scripts/gate.mjs depot-test`
   (2,089 / 0), `golden` (7 / 0), `smoke` (30 / 0). A failed gate stops
   the task with its output; it is never rerun.

### Step 9 — commit and push

Subject: `the engine leaves the screen — boot and tick walk out, mk2.74`.
Standing trailers. Push; the owner's live check is the acceptance.

## Acceptance (arithmetic)

- `node src/depot/api.js gate` exits 0; hashes identical across two runs
  on each of two seeds; the four numbers recorded as the keystone.
- depot-test 2,089 / 0; golden 7 / 0; smoke 30 / 0; build green.
- `git diff --stat src/depot/save.js src/engine/core.js src/render/renderer.js` — empty.
- `grep -c "THE BOOT ORDER" src/depot/boot.js` = 1 and
  `src/depot/DepotGame.jsx` = 0.
- Every moved line byte-identical to its source under the substitution
  table (the verbatim-move law; the suite's pins are the check).

## Report

One line of outcome, then: read-confirmation; the keystone hashes; each
gate's count and runtime with the suite's printed seeds; every step-7
re-point old-source → new-source per file; the two pin-text re-teaches
(09's seat counter, 11's bell flag) old→new; the spawn-cadence note
(step 5.4) restated as a named bullet; every deviation of any size as its
own labeled bullet; the commit hash pushed.
