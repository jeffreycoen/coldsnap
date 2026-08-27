# War Engine Extraction — Task 3: the S split — run, view, input (mk2.73)

The component's one state bag `S` splits into three: `run` (the sim's
state — everything save.js touches, plus the unsaved sim-side fields the
tick reads and writes), `view` (presentation — nothing the sim reads),
`input` (the per-tick commands — api.js's TickInput). `serializeRun` in
api.js gets its body. `save.js is not touched at all` — its diff must be
empty; it drew the line and this task only sorts fields to either side
of it.

Two typedef amendments ride in this task, both findings from writing it:
- **War gains `census` and `census2`** — serializeFront needs both and they
  are save-critical boot products; a War that cannot serialize itself was
  an incomplete typedef. Recorded old→new in the phase document at landing.
- **TickInput's `reticleLockId` stays in the typedef but is view at the
  split** — the sim never reads it (the sticky lock is frame-loop
  steering); it remains an optional field a component may carry.

Consulted plan: `2026-08-27-war-engine-extraction.md`, step 3 and the
2026-08-27 rulings. Phase document holds the bellAt/bellT note this task
now executes: both live in `run` as boot-derived, unsaved clock fields.

**Suggested model: Sonnet 5** — several hundred mechanical rewrites under
one assignment table, one signature change, one filled surface function.

## Required reading (verified at commit c6abf99)

1. This task plan, whole — the assignment table IS the task.
2. `2026-08-27-war-engine-extraction.md` — step 3, the API section.
3. `src/depot/save.js`, whole — the line-drawer; it must emerge untouched.
4. `src/depot/DepotGame.jsx`, whole.
5. `src/depot/sim.js` — the stepDepot body.
6. `src/depot/api.js` — parts 1 and 4.
7. `src/depot/state.js` — fireBell only (the one body edit there).
8. `src/depot/bell.js`, `src/depot/buildlines.js`, `src/depot/muster.js` —
   their S-parameter reads (all run-class; verified in the table below).
9. Test blocks pinning stepDepot/stepTowers body text or fireBell's convoy
   line — find with `grep -n 'S\.possess\|S\.devDummies\|S\.squads\|stepDepot(' scripts/tests/*.mjs`.

## THE ASSIGNMENT TABLE

Derived at plan time (160 distinct `S.` fields across DepotGame.jsx,
sim.js, bell.js, state.js, buildlines.js; re-derive at dispatch with
`grep -rohE '(^|[^A-Za-z0-9_])S\.[a-zA-Z_][a-zA-Z0-9_]*' <those five files> | sed 's/.*S\.//' | sort -u`
— a moved count is a finding). Every occurrence of `S.<name>` rewrites to
its bag. An unassigned name found at dispatch stops the task.

**run** (the 32 save-touched fields, plus unsaved sim-side state):
`arcs bell bellAt bellT breach _buyAt cmdr depotCensusAcc depotStanding
draft endedAt enemyBreach enemyStanding focus foe foeSquads fog gameOver
_groundRate1 _groundRate2 holdArea _hot intelArmedAt intelPlan intelUp
lastDispatch ledgerLoss manifest _market _marketAcc mines _minePrices mode
nextSquadId pendingPlan reg _reportedBreak _reportedSpent resources
sandbagOrient _saveBurned score spawnRR squads started starvedStreak
victory ws zoom`
(`focus`, `zoom`, `mode` are saved fields — run by the line, even though
the component also steers them; `draft` is the boot-drawn opening hand —
war state, dies at confirm; `_market`/`_minePrices`/`_groundRate*`/`_hot`/
`_buyAt`/`_marketAcc` are unsaved derived caches the sim's pricing and
pacing read — run, the bellAt precedent.)

**input** (api.js TickInput):
`possess possessInput reticle fireHeld mgHeld mechWant devDummies windOn
discipline releasePossession stepBuildLine stepFoeBuildLine`

**view** (everything else — presentation, selection, camera, teaching,
debug counters, and every UI method hung on S):
`acc acceptLine ackIntel armHire audio buildPt0 cancelHire clearPending
closeInfo confirmDraft confirmInfo confirmPending devSpawn dismissManifest
_draftDone _draftOpen flagScreen fogOn fps fpsAcc fpsN healthOn hirePlace
hover hudT infoArmedAt infoArmedWall infoDoor infoKey inspectId
inspectReach joy joyR _keepPie keys linePending lineScreen mechAimHeld
mechAimOff mechAimRange mechHardT mechKeyTurnPrev mechKeyTurnT _mechRngGrab
mechWant→INPUT(listed above) mechYawT openInfo openManifest orderMode
orderSquad orderVehicle paused pending pendingScreen pickManifest pieOpen
_placeQueue _placeTotal pointer pv rejectLine reticleLockId reticleOff
rotate _rotHeld selArmedAt selectAllType sellById sellMode selReach
selSquadId selSquadIds selVehId setFog setHealth setTowerDiscipline
setWind speed squadScreen takeControl takeControlTower takeControlVehicle
teachBack teachFire _teachIdx teachNext teachPie _teachQ _teachSeen
teachSkip teachWalk _teslaFired _teslaZaps toasts toggleStructFirst
toggleTracks towerScreen unloadVehicle vehOrderMode vehScreen`
(The stray `mechWant→INPUT` marker above is deliberate: mechWant appears in
both sweeps' greps; it is INPUT. Everything else on this list is view.)

## Steps

### Step 1 — preconditions

```bash
git diff --stat src/depot/save.js | wc -l                     # 0 — and it stays 0
grep -rohE '(^|[^A-Za-z0-9_])S\.[a-zA-Z_][a-zA-Z0-9_]*' src/depot/DepotGame.jsx src/depot/sim.js src/depot/bell.js src/depot/state.js src/depot/buildlines.js | sed 's/.*S\.//' | sort -u | wc -l   # 160
grep -ohE 'S\.[a-zA-Z_]+' src/depot/save.js | sort -u | wc -l  # 32
node src/depot/api.js gate; echo $?                            # message naming step 4, then 1
```

### Step 2 — api.js: serializeRun filled, War typedef amended

Add `import { serializeFront } from "./save.js";` beside the worldHash
import. Replace the throwing `serializeRun` with:

```js
/**
 * Serialize the war's run state — the same context the component's save
 * built, byte-equal to save.js's serializeFront by construction (this is
 * a pure argument mapping; serializeFront is untouched).
 * THE ONE DRAW: exactly one world.rng draw per call, unconditional — the
 * save law (save.js law 2). The caller saves the returned string or
 * discards it; the draw happened either way.
 * @param {War} war @param {Object} [opts] {smears} — the renderer's smear
 * ledger (R._splat.log); a headless caller has none and passes nothing.
 * @returns {string}
 */
export function serializeRun(war, opts = {}) {
  const rngSeed = Math.floor(war.world.rng() * 4294967296);
  return serializeFront({
    S: war.run, world: war.world, T: war.T, town: war.town,
    census: war.census, census2: war.census2,
    rocks: war.map.ROCKS, smears: opts.smears || [],
    mapSeed: war.map.MAP_SEED, rngSeed,
  });
}
```

In the War typedef, after `@property {Array} town ...` add:

```
 * @property {Array} census        the player depot's stone census (censusDepotChunks)
 * @property {Array} census2       the enemy depot's census
```

In the TickInput typedef, annotate `reticleLockId`'s line with
`— view-side at the T3 split; the sim never reads it`.

### Step 3 — state.js: fireBell's one input read

fireBell reads `S.possess` on one line (the mk2.02 convoy-waits rule).
The run bag carries no possession, so the fact arrives as an option:

- old: `M.cardUp = M.hand.length > 0 && !S.possess; // mk2.02: THE CONVOY WAITS (owner) — no deal opens over a live possession; release opens it`
- new: `M.cardUp = M.hand.length > 0 && !opts.possessed; // mk2.02: THE CONVOY WAITS (owner) — no deal opens over a live possession; release opens it (the fact rides opts since the T3 split)`

and fireBell's opts destructure gains `possessed = false`. No other
state.js line changes — every other S-taking function there
(stepBell, checkLoss, checkDepotBreach/checkEnemyBreach, stepDepotCensus,
stampEnd, endCardReady, scoreKill, nextSpawnTag, withdrawDue,
executeWithdrawal, makeRunState) reads run-class fields only (verified at
plan time) and will simply receive the `run` bag through its existing
parameter.

### Step 4 — sim.js: stepDepot takes run and input; the view touch moves out

1. Signature: `stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, S, map)`
   → `stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, run, input, map)`.
2. Body rewrites per the table: `S.devDummies`→`input.devDummies`,
   `S.possess`→`input.possess`, `S.possessInput`→`input.possessInput`,
   `S.reticle`→`input.reticle`, `S.releasePossession`→`input.releasePossession`,
   `S.stepBuildLine`→`input.stepBuildLine`, `S.stepFoeBuildLine`→`input.stepFoeBuildLine`,
   `S.windOn`→`input.windOn`, `S.squads`→`run.squads`, `S.foeSquads`→`run.foeSquads`,
   `S.arcs`→`run.arcs`, `S.holdArea`→`run.holdArea`.
3. THE MOVED BLOCK — the selection pruning is view work inside the sim and
   leaves stepDepot entirely (delete there, reinsert in DepotGame per step
   5.6; per-frame instead of per-tick is a presentation-only cadence
   change, stated here as the licensed deviation):
   ```js
   if (S.selSquadIds) { S.selSquadIds = S.selSquadIds.filter((id) => S.squads.some((q) => q.id === id)); if (S.selSquadIds.length < 2) S.selSquadIds = null; }
   if (S.selSquadId != null && !S.squads.some((q) => q.id === S.selSquadId)) {
     const nextId = S.selSquadIds ? S.selSquadIds.find((id) => id !== S.selSquadId) : null; // the group promotes its next squad
     if (nextId != null) S.selSquadId = nextId;
     else { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.selSquadIds = null; }
   }
   ```
4. After the sweep: `grep -c '\bS\.' src/depot/sim.js` must be 0.

### Step 5 — DepotGame.jsx: the three bags

1. The boot's `const S = { ... }` literal splits into three literals —
   `const run = { ... }`, `const view = { ... }`, `const input = { ... }` —
   every property landing per the table, values and comments carried
   verbatim. The methods hung on S (`S.orderSquad = ...` etc.) become
   `view.<name> = ...` (they are closures over all three bags).
2. `stateRef.current = S` becomes `stateRef.current = { run, view, input }`;
   every `stateRef.current` consumer (the JSX handlers, setMode/closeBuild/
   startGame/toggles below the effect) rewrites `S.<name>` →
   `<bag>.<name>` per the table, reading the composite
   (`const C = stateRef.current; C.view.x / C.run.x / C.input.x` — local
   naming free, table binding not).
3. After the censuses exist in the boot, assemble the war:
   ```js
   // the War (api.js typedef) — T4's bootWar will return this same shape
   const war = { map, field, grid, world, T, town, census: depotCensus, census2: depotCensus2, run };
   ```
   (In the resume branch `town`/censuses bind after restore — place the
   assembly after both branches converge, where `stateRef.current` is set
   today.)
4. `saveFront` drops its own rng draw and serializeFront call; its body
   becomes `const json = serializeRun(war, { smears: R._splat ? R._splat.log : [] });`
   inside the same try/catch, saveStat, cue, and fire-and-forget write.
   Import `serializeRun` from `"./api.js"`.
5. The bell context gains the possession fact:
   `const bellCtx = { cue, toast, townUV, buildSnapshot, nextApcSeq, saveFront: () => saveFront(), possessed: () => !!input.possess };`
   and bell.js threads it (step 6).
6. The moved selection block from step 4.3 reinserts in the frame loop
   directly AFTER the sim catch-up `while` loop (before drainEvents),
   rewritten per the table (`view.selSquadIds`, `run.squads`, ...).
7. Every remaining `S.` in the file sweeps to its bag. Guards:
   `grep -cE '\bS\.' src/depot/DepotGame.jsx` = 0;
   `grep -c 'const S = ' src/depot/DepotGame.jsx` = 0. The spread-syntax
   lesson from T2b: also check `grep -c '\.\.\.S\b' src/depot/DepotGame.jsx` = 0.
8. Call sites thread the bags: `stepDepot(world, grid, onStructureLost, town, onRuin, T, input.discipline, run, input, map)`;
   `ringBellOut(world, grid, field, T, run, bellCtx, map)`;
   `stepBuildLine(world, grid, field, T, run, sq, layCtx, toast, map)` in
   both build-line closures (the foe façade `SE` object keeps its S-shape —
   it mimics run fields and passes as the run argument);
   `musterFreshStart(world, run, depotP, grid, field, nextApcSeq, map)`;
   `fireBell`-adjacent reads in the frame loop (`stepBell(run, world.t)`,
   `checkLoss(run)`, `stampEnd(run, world.t)`, `endCardReady(run, world.t)`,
   `stepDepotCensus(run, sdt, ...)`, `scoreKill(run, e, ...)`,
   `withdrawDue(run, world.t)`, `executeWithdrawal(run, world)`,
   `nextSpawnTag(run)`) — all mechanical under the table.

### Step 6 — bell.js: pass the possession fact through

ringBell's parameter `S` receives the run bag (rename the parameter to
`run` for honesty — its body's `S.` reads all resolve to run fields per
the table; rename is the licensed token change). Its fireBell call gains
`possessed: !!(ctx.possessed && ctx.possessed())` in the opts object.
buildlines.js and muster.js need NO body edits — their S parameters
receive run and every read is run-class (verified; if the agent finds a
non-run read there, that is a stop, not a workaround).

### Step 7 — re-teach the suites (the sweep license)

Rule: any test pin quoting sim.js/state.js/DepotGame.jsx text this task's
table rewrote re-teaches to the new text, old→new reported. Known at plan
time (the sweep finds the rest through gate failures):

- 04's stepDepot signature regex gains the `run, input` form (third
  re-teach of that pin this phase).
- 04's possession-guard pins quote `S.possess`/`S.releasePossession` —
  now `input.possess`/`input.releasePossession`.
- 23's fight-switch pins quote `S.devDummies` → `input.devDummies`.
- Any fireBell fixture that asserts the convoy-waits behavior drives it
  via `opts.possessed` now (the fixture's own S.possess field is inert).
- Fixtures calling `fireBell`/`stepBell`/`checkLoss`/etc. with S-shaped
  objects need NO change — the functions' parameters are unchanged; the
  objects they pass simply ARE run-shaped.

### Step 8 — asserts, byte-equality proof

```bash
git diff --stat src/depot/save.js | wc -l     # 0 — save.js untouched
node --check src/depot/sim.js src/depot/api.js src/depot/state.js src/depot/bell.js && echo SYNTAX-OK
node src/depot/api.js gate; echo $?            # STILL exits 1 — bootWar/tickWar remain throws
```

Byte-equality, headless scratch (never committed): build a minimal
war-shaped fixture (a run bag with the 32 fields in serializeFront's
shapes, a tiny world `{ t, rng: mulberry32(7), field: { h: new Float32Array(4), n: 2 }, bodies: [], welds: [], mechs: [] }`,
a T `{ nx: 1, nz: 1, v: new Float32Array(1) }`, empty town/censuses, a map
`{ ROCKS: [], MAP_SEED: 11 }`). Serialize it twice: once through
`serializeRun(war)`, once through direct
`serializeFront({ S: war.run, ..., rngSeed: <a twin mulberry32(7) drawn once> })`.
The two strings must be byte-identical. Then the CHECKPOINT:
`node scripts/gate.mjs depot-test` — 2,091 / 0 or stop — after steps 2–4
and their re-teaches, and again after step 5–6.

### Step 9 — tree, version, gates, landing

1. `git status` — expected exactly: api.js, state.js, sim.js,
   DepotGame.jsx, bell.js, version.js, and re-taught test files. save.js
   ABSENT from the diff. Anything else stops.
2. MK to `"mk2.73"`; `npm run build` after.
3. Final gates in the foreground: depot-lint, depot-test (2,091/0), golden
   (7/7), smoke (30/0 — smoke is the real proof here: it boots, plays, and
   SAVES through the new serializeRun path).
4. Green → commit → push. Subject:
   `the state split — run, view, and input part ways, mk2.73`

## Acceptance (arithmetic)

- depot-test 2,091/0 at both checkpoints and the end; golden 7/7; smoke
  30/0; depot-lint PASS; build green.
- `git diff` on save.js: empty.
- `grep -cE '\bS\.'` on sim.js and DepotGame.jsx: 0 each.
- The byte-equality scratch: identical strings.
- `node src/depot/api.js gate`: still exits 1 naming step 4.

## Report

One line of outcome, then: read-confirmation; both checkpoints and the
final four gates with runtimes and the suite's seeds named; the dispatch
field-count vs 160 and any table assignment findings (each old→new);
every re-teach old→new; the byte-equality result; nonconformities/
deviations/skips each labeled (the selection-block cadence change must
appear, it is licensed but named); the commit hash pushed.
