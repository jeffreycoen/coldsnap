# P7 Task 22 — the suite splits (mk1.52)

*2026-08-18. Reorganization 5 of 5: `scripts/depot-test.mjs` (~8,600 lines) splits into per-era files under `scripts/tests/`, imported in order by a thin runner that KEEPS THE NAME — the gate command `node scripts/depot-test.mjs` does not change, so CI and every standing gate list stand. The cut rule is mechanical: CONTIGUOUS segments in original file order, boundaries at the era banners, block bodies verbatim. The proof is arithmetic: the pass count before equals the pass count after, exactly, plus the keystone unchanged. Zero test content changes of any kind.*

**Suggested model: Sonnet** — a mechanical file split with a manifest step.

**Scope:** `scripts/depot-test.mjs` (becomes the runner), new `scripts/tests/*.mjs`, `src/version.js`. NOTHING under `src/` is touched — if a step wants a src edit, STOP.

## The cut rule (binds everything)

1. **Contiguous, in order.** The file is divided into consecutive segments; no test moves relative to another. Execution order after the split = ES import order in the runner = today's top-to-bottom order.
2. **Block bodies verbatim.** Inside every `{ ... }` test block, not a byte changes.
3. **Module-scope bindings follow usage.** The `ok()` harness, its counters, and the final summary/exit go to `scripts/tests/harness.mjs`. Any other top-level binding (helpers like the identity forward-direction, shared fixture makers, pin constants) used by MORE THAN ONE segment moves to `scripts/tests/shared.mjs` with an export; used by exactly one segment, it moves into that segment's file. Bodies verbatim; only `export`/`import` lines are new.
4. **Licensed path fixes:** source reads are `new URL("../src/...", import.meta.url)`-relative; files moving into `scripts/tests/` re-point one level (`../../src/...`, `../../docs/...`). Each fixed path is listed in the report. This is the ONLY licensed text change inside moved code.

## The era files (labels for the contiguous segments — the agent's manifest fixes the exact line boundaries)

| File | Contents (by banner) |
|---|---|
| `tests/harness.mjs` | ok(), counters, the summary + exit semantics, source-read helper if one is shared |
| `tests/shared.mjs` | multi-segment top-level bindings (per rule 3) |
| `tests/01-engine-era.mjs` | everything before the first FRONT/F1 banner (rotation-invariance, engine and troopkit pins, early-era fixtures) |
| `tests/02-front-f1.mjs` | the F1/F1.5 blocks |
| `tests/03-bell-polish.mjs` | the P1/P1.5 era (mk0.4x–0.6x banners) |
| `tests/04-vision-command-possession.mjs` | P2/P3/P4 banners (sightlines, COMMAND, POSSESSION) |
| `tests/05-the-front.mjs` | FRONT T1–T6 |
| `tests/06-troops-physics.mjs` | P6 T1–T12 |
| `tests/07-armor-demolition.mjs` | P7 T1–T11 + the mk1.37 hotfix block |
| `tests/08-debug-pass.mjs` | P7 T12–T17 |
| `tests/09-reorg.mjs` | P7 T18–T21 (+ this task's T22 block) |

If a banner's era straddles a boundary awkwardly, the CONTIGUITY rule wins — adjust the file boundary, never the order, and name the adjustment.

## Required reading, in order

1. `scripts/depot-test.mjs` — the import block, the ok()/summary harness (top and bottom of the file), then a banner-level scan of the whole file to build the manifest (Step 2). This is the one task where reading every line is not required — blocks move whole and unread; the MANIFEST (banners, ranges, module-scope bindings and their users) is what must be exact.
2. `package.json` — confirm what the test script invokes (the runner keeps that exact entry point).
3. `scripts/smoke.mjs` and `scripts/depot-lint.mjs` — confirm neither reads depot-test.mjs (they must be untouched by the split).

## Trap notes

- **The baseline is captured FIRST.** Step 1 runs the suite and records the exact pass count and the keystone line before anything moves. The after-run must match the pass count TO THE DIGIT and the keystone byte-for-byte. Any difference = STOP.
- **ES import order is execution order** — the runner lists the era files in the manifest's order; harness first, shared second.
- **The summary and exit semantics move, not change** — whatever the harness prints and whatever exit code it sets on failure today, the runner's final behavior is identical (CI reads it).
- **Cross-file leakage is the known risk:** a block reading a binding that stayed in another file surfaces as a ReferenceError on the first run — resolve it by rule 3 (promote to shared.mjs), never by editing the block. Each promotion is listed.
- **No sweep license needed** — no `src/` text moves, so no pins retarget. If a pin fails anyway, that is a real signal: STOP.

## Steps

**Step 1 — the baseline.** Run `node scripts/depot-test.mjs`; record the exact pass/fail counts and the keystone hash/draws line. These are the acceptance numbers. Then land the T22 assert at the end of the CURRENT file (it will ride into `09-reorg.mjs` with its era):

```js
// ==== P7 T22: THE SUITE SPLITS ===============================================
// Reorganization 5 of 5 (owner): per-era files behind a runner that keeps
// the gate command. The proof is the baseline: same pass count, same
// keystone, zero content changes.
{
  ok("T22(a): the runner is thin and keeps the name", true); // re-pointed at runner shape in Step 4
}
// ==== end P7 T22 =============================================================
```

(The placeholder assert becomes real in Step 4 — see there; landing it now keeps the count arithmetic simple: baseline + 1 expected after.)

**Step 2 — the manifest.** Scan the file's top-level structure: every era banner with its line range; every module-scope binding with the list of segments that reference it. Write the manifest to `.superpowers/t22-manifest.md` (working notes, untracked) and include its summary in the report. No cuts yet.

**Step 3 — the split.** Create `scripts/tests/` per the era table and the manifest: harness.mjs (ok/counters/summary/exit), shared.mjs (multi-user bindings), the nine era files (contiguous verbatim segments + their single-user bindings + imports from harness/shared). Apply the licensed path fixes (rule 4), each recorded.

**Step 4 — the runner.** `scripts/depot-test.mjs` becomes:

```js
// COLDSNAP — depot-test: the gate keeps its name (P7 T22). The suite lives
// in scripts/tests/, one file per era, imported IN ORDER — import order is
// execution order and matches the old file top to bottom. harness.mjs owns
// ok(), the counters, and the exit; nothing here runs a test.
import "./tests/harness.mjs";
import "./tests/shared.mjs";
import "./tests/01-engine-era.mjs";
import "./tests/02-front-f1.mjs";
import "./tests/03-bell-polish.mjs";
import "./tests/04-vision-command-possession.mjs";
import "./tests/05-the-front.mjs";
import "./tests/06-troops-physics.mjs";
import "./tests/07-armor-demolition.mjs";
import "./tests/08-debug-pass.mjs";
import "./tests/09-reorg.mjs";
import { finish } from "./tests/harness.mjs";
finish();
```

(adjusted to the harness's real summary/exit shape — if today's summary runs at module bottom rather than via a callable, `finish` is that code moved behind an export; verbatim semantics.) The T22 placeholder in `09-reorg.mjs` becomes real:

```js
  ok("T22(a): the runner is thin and keeps the name",
    /import "\.\/tests\/01-engine-era\.mjs";/.test(rnSrc22) && !/PIN_HASH/.test(rnSrc22));
```

with `rnSrc22` reading `scripts/depot-test.mjs` — the runner contains imports and the finish call, no test content.

**Step 5 — gates.** `node scripts/depot-test.mjs` — pass count = baseline + 1 (the T22 assert), fail count = baseline's, keystone byte-identical, all stated. `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.52`. Build AFTER the bump. Commit: `the suite splits: nine eras behind one gate (mk1.52)`. Push. Report: read-confirmation opening (manifest summary included), the baseline vs after numbers, every promotion to shared.mjs, every path fix, every deviation labeled.
