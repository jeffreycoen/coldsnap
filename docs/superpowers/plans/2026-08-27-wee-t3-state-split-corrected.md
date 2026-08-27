# War Engine Extraction — Task 3, corrected plan (mk2.73)

This plan lands the state split: the one big game-state bag broken into
three — `run` (what a save keeps), `view` (what the screen keeps), and
`input` (what the player's hands hold) — and saves routed through the new
`serializeRun` door in `src/depot/api.js`.

The code for this task is already written and sits uncommitted in the
working tree. The first plan for this task let its agent rewrite tests on
its own judgment; that permission was against the rules and does not exist
here. This plan carries no judgment calls at all: the agent checks that
the tree matches this plan's fingerprints, runs the listed checks once
each, and lands. Any check that fails, any file this plan does not name,
any surprise of any size stops the task at once with a report. Nothing is
ever run twice to "see if it clears".

**Suggested model: Sonnet 5** — every step is checking and landing;
nothing is designed, nothing is authored.

The agent that ran the first plan is not used again (owner's order,
2026-08-27).

## Required reading

1. This plan, whole. Nothing else. The changed code is verified by
   fingerprint in step 2, not re-read; the tree is the single copy of it.

## What is in the tree, and where

Twenty-eight changed files, uncommitted, on top of commit c6abf99. Each
group below is verified in step 2 by a fingerprint — a checksum of that
group's exact changed lines, computed at plan-writing time on this tree.

1. **`src/depot/DepotGame.jsx`** — the split itself. The old single bag is
   now three literals built in the boot (search anchor: `THE BOOT ORDER`),
   held as `stateRef.current = { run, view, input }`, with the war object
   assembled beside them. Saving calls `serializeRun`.
2. **`src/depot/api.js`** (the `serializeRun` body at line 311),
   **`src/depot/bell.js`** (its state parameter renamed to `run`; the bell
   passes the possession fact onward), **`src/depot/state.js`** (`fireBell`
   reads the possession fact from its options — its only body change),
   **`src/depot/sim.js`** (`stepDepot` now takes `run`, `input`, and the
   map; the block that prunes dead selections moved out to the screen's
   frame loop — a deliberate, owner-visible change of when it runs, named
   again in the report).
3. **Twenty test files** under `scripts/tests/` (listed in step 1's
   expected tree). Every changed line re-points a test at the new field
   homes — `run.`, `view.`, or `input.` where the old bag's name was —
   with the tested content itself unchanged. One file is different in
   kind: `33-the-settled-ground.mjs` lost its two mound-walking checks on
   the owner's order of 2026-08-27, so the suite's count is now 2,089.
4. **Two plan documents** — the phase document cut back to skeleton,
   status, and index; the mound ruling written into the consulted plan.

Also changed: `.superpowers/gates.log`, the check-runner's own log. It
rides in the commit as always and has no fingerprint.

## Steps

### Step 1 — the tree is exactly what this plan expects, or stop

The list of changed files must match this, exactly — nothing missing,
nothing extra (untracked files are not part of this check):

```bash
git status --short | grep -v '^??'
```

Expected: `.superpowers/gates.log`, the two plan documents
(`2026-08-27-war-engine-extraction-phase.md`,
`2026-08-27-war-engine-extraction.md`), these twenty-one test files —
02-front-f1, 03-bell-polish, 04-vision-command-possession,
06-troops-physics, 07-armor-demolition, 08-debug-pass, 09-reorg,
10-command-refit, 11-hiring-hall, 12-the-mech, 14-the-placement-law,
18-the-green-fog, 23-the-sandbox, 24-the-quartermaster,
25-the-teaching-cards, 26-the-ground-pays, 28-the-earned-muster,
33-the-settled-ground — and these five source files: `src/depot/api.js`,
`src/depot/bell.js`, `src/depot/DepotGame.jsx`, `src/depot/sim.js`,
`src/depot/state.js`. Any other modified file stops the task.

`src/depot/save.js` must show no change at all:

```bash
git diff --stat src/depot/save.js | wc -l    # must print 0
```

### Step 2 — the changed lines are exactly these, or stop

Four fingerprints, computed on this tree at plan-writing. Each command
must print its number exactly; one wrong character in any changed file
changes the number.

```bash
git diff scripts/tests | sha256sum
# 9607574b5ec1241ef3552b270201d20c425b899ec062d07ff55a7b27a4e066c5

git diff src/depot/api.js src/depot/bell.js src/depot/state.js src/depot/sim.js | sha256sum
# feac6c7fe0a98abce61d3a43d8f04aa3c977fd2d7322a321ceb30678aa4a5fca

git diff src/depot/DepotGame.jsx | sha256sum
# cbe9ff51192ac42b93c7b8c3d3fb79552690cf770bbbb271fd2f00becd0aa833

git diff docs/superpowers/plans/2026-08-27-war-engine-extraction-phase.md docs/superpowers/plans/2026-08-27-war-engine-extraction.md | sha256sum
# f8a636e3d261d03ea5a07df3f4703eec92a1c7a503a8907357ce19e217e1b1ef

git diff scripts/smoke.mjs | sha256sum
# 6df5a9245c124bcd746433dc0ec06d1f5e537aaa7e5576d289d1902fa7ad8bd4
```

Amendment, 2026-08-27, on the owner's word: the first agent to run this
plan stopped at the smoke check — 29 of 30, the end-card exit check timed
out. A probe on the owner's order showed the game itself works and the
check's own waits were too tight for full-run load. The owner ordered the
two waits lengthened in `scripts/smoke.mjs` (done: 700ms to 2000ms, 15s to
45s — the fifth fingerprint above). Depot-test (2,089/0), golden (7/0),
the save proof, the version bump to mk2.73, and the build all passed in
that first run and are not run again — the only code changed since is the
smoke script itself, so the finishing agent runs step 6's check 3 (smoke)
only, then step 7. `scripts/smoke.mjs` joins step 1's expected file list
and the commit.

### Step 3 — the surface door still refuses, or stop

The command-line gate must still fail by design (its boot and tick fill in
at tasks 4 and 5):

```bash
node src/depot/api.js gate; echo exit=$?    # must print exit=1
```

### Step 4 — the save door writes the same bytes both ways, or stop

Write this to the scratch directory (never committed) and run it once. It
proves `serializeRun` is a pure re-plumbing of the old save call: the same
bags through both doors, byte for byte. The script passed a syntax check
at plan-writing; it has not been run. FAIL is a finding — report and stop,
never adjust the script.

```js
// Task 3 proof (never committed): serializeRun(war) must equal a direct
// serializeFront call with the same bags and a twin random-number stream.
import { serializeFront } from "/home/batman/coldsnap/src/depot/save.js";
import { serializeRun } from "/home/batman/coldsnap/src/depot/api.js";
import { mulberry32 } from "/home/batman/coldsnap/src/engine/core.js";

const run = {
  resources: 40, spawnRR: 0,
  score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } },
  bell: 1, started: true, mode: "war", sandbagOrient: 0, cmdr: null,
  nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 },
  depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1, starvedStreak: 0,
  _reportedBreak: false, _reportedSpent: false,
  manifest: {}, foe: { unlocked: ["conscripts"] },
  intelUp: false, intelArmedAt: 0, lastDispatch: null,
  pendingPlan: null, intelPlan: null,
  ws: {}, reg: {}, mines: [], fog: [], arcs: [],
  holdArea: { 1: false, 2: false }, squads: [], foeSquads: [],
};
const world = { t: 0, rng: mulberry32(7), field: { h: new Float32Array(4), n: 2 }, bodies: [], welds: [], mechs: [] };
const T = { nx: 1, nz: 1, v: new Float32Array(1) };
const war = { run, world, T, town: [], census: [], census2: [], map: { ROCKS: [], MAP_SEED: 11 } };
const a = serializeRun(war);
const twin = mulberry32(7);
const b = serializeFront({ S: run, world: { ...world, rng: twin }, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 11, rngSeed: Math.floor(twin() * 4294967296) });
if (a !== b) { console.log("BYTE-EQUALITY: FAIL"); process.exit(1); }
console.log("BYTE-EQUALITY: PASS —", a.length, "bytes both ways");
```

### Step 5 — version, then build

In `src/version.js` line 6, `"mk2.72"` becomes `"mk2.73"`. Then
`npm run build`. A build failure stops the task.

### Step 6 — the three checks this change touches, once each

In the foreground, blocking, in order, each exactly once. The number
matches or the task stops with the check's own output. A failed check is
never run again.

1. `node scripts/gate.mjs depot-test` — 2,089 PASS / 0 FAIL, exactly.
   The split touches the game component, the simulation file, the bell,
   and the state file; the suite's files test those directly, so this is
   the changed surface.
2. `node scripts/gate.mjs golden` — 7 PASS / 0 FAIL. The engine-parity
   law: proves the split never reached the frozen physics.
3. `node scripts/gate.mjs smoke` — 30 PASS / 0 FAIL. Boots the built
   game on both the phone and desktop paths and saves through the new
   `serializeRun` door — the one live test of the rewired save. Start
   `vite preview` first if the check needs the server; stop it after.

### Step 7 — commit and push

One commit carrying every file step 1 listed plus `src/version.js` and
the build output. Subject:

```
the state split — run, view, and input part ways, mk2.73
```

With the standing trailers. Push. The push is the deploy; the owner's
live check is the acceptance.

## Acceptance (arithmetic)

- All four fingerprints match before anything runs.
- depot-test 2,089 / 0. golden 7 / 0. smoke 30 / 0. Build green.
- The both-ways save proof: PASS.
- `src/depot/save.js`: zero changed lines at commit time.
- `node src/depot/api.js gate`: exit 1.

## Report

One line of outcome, then short bullets: the read-confirmation; each
check's count and time, with the test suite's own printed seeds named;
the save-proof result; three named bullets — the dead-selection pruning
now runs once per frame instead of once per simulation tick (deliberate,
carried from the approved design), the two deleted mound checks and the
document edits ride in this commit on the owner's order, and the test
edits in this commit were first made by the stopped agent and land here
as fingerprinted plan content; every deviation of any size as its own
labeled bullet; the commit hash pushed.
