# Task 4 combined — Amendment 5: the finish (the fixes, the re-points, the landing)

Three things stand between the tree and the mk2.74 landing: one
byte-for-byte violation in boot.js (the tree planting was rewritten, not
moved), the test re-points the plan's step 7 under-listed (now fully
classified by the diagnosis task), and three failures from the stopped
full run that the per-file runs did not reproduce. This amendment fixes
the first, lists every test edit exactly, and lets the one full gate run
settle the third. The plan and amendments 1–4 stand except as written
here.

## Fix 1 — boot.js: the tree planting restored to the moved bytes

boot.js lines 284–289 currently read (a rewrite; the violation):

```js
    for (const p of planTrees()) {
      const ty = field.heightAt(p.x, p.z);
      const u = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: p.x, y: ty + 1.62, z: p.z, hp: 70, friction: 0.5 });
      u.sleeping = true;
    }
```

Replace with the original bytes from commit e8938d8 (DepotGame.jsx
660–665 and 679), the helper placed directly above the `if (!RES)` block
it serves, indentation adjusted to boot.js's two-space module level only:

```js
  const treeAt = (tx, tz) => {
    const ty = field.heightAt(tx, tz);
    const u = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: tx, y: ty + 1.62, z: tz, hp: 70, friction: 0.5 });
    u.sleeping = true;
    return u;
  };
```

and inside the `if (!RES)` block, where the rewritten loop stood:

```js
    for (const p of planTrees()) treeAt(p.x, p.z);
```

The two comment lines above the loop ("T5: the whole tree plan...")
stay exactly where they are.

## Fix 2 — the test edits, every one listed

Two kinds. THE RULE for kind A (re-points): the failing check's source
read re-points to the named file; the pinned pattern text is untouched.
Where the check's block shares its source variable with checks that
PASS, add one new read beside it (`const bootSrc = fs.readFileSync(new
URL("../../src/depot/boot.js", import.meta.url), "utf8");` — or
tick.js — matching the file's existing read idiom) and use it in the
failing check's expression only; a passing check is never edited. Kind B
(re-teaches): the pin's text itself changes, old→new written here.

Kind A — re-points (35 checks; check name → new source file):

- 01-engine-era.mjs:1845 (team-1 units emitter), :1848 (sandbag emitter) → boot.js; :1982 (buildSnapshot wires squads) → tick.js; the third emitter-region failure in that file's sweep block → boot.js.
- 02-front-f1.mjs (F1/1c flag emitter sign) → boot.js.
- 04-vision-command-possession.mjs (sight map made where territory made) → boot.js; :336 (recomputes on territory clock), (volley reads input.reticle), (tower fire reads input.reticle) → tick.js.
- 05-the-front.mjs:27 (territory from rim constants), :265 (world threads streamAt), :545 (plants the plan — passes again after Fix 1 with its read re-pointed) → boot.js.
- 06-troops-physics.mjs:299 (income is the clock) → tick.js.
- 07-armor-demolition.mjs:1148 (mount-scope reseed — re-teach, kind B below).
- 08-debug-pass.mjs:537 (dead bags release) → tick.js; (green-threads cadence block) → tick.js; (heightfield apron) → boot.js; (every stamp carries team: the count-8 check re-teaches, kind B below).
- 09-reorg.mjs:612 region (RES restore source-extract: the slice's start anchor re-points to boot.js; the `stateRef.current` assert keeps reading DepotGame.jsx — split reads per THE RULE).
- 11-hiring-hall.mjs:184 (re-arms instantly), :734 (till at 250), (books-stamp `world._mech` fragment) → boot.js; (ring stamps wall arm — re-teach, kind B below).
- 16-the-deep-floor.mjs:17 (carveFloor) → boot.js.
- 18-the-green-fog.mjs:42 (patches tick) and (hooks davy boom) → tick.js.
- 21-the-broken-ridge.mjs:28 (rock health), :29 (seat depth) → boot.js; (davy re-lays dressing: the AND splits — the `e.weapon === "davy"` fragment reads tick.js, the `setDressing` fragment keeps reading DepotGame.jsx).
- 22-the-tesla-coil.mjs:147 (state carries arcs) → boot.js.
- 23-the-sandbox.mjs:20 (bell never rings) and (never ends on bench) — re-teaches, kind B below.
- 26-the-ground-pays.mjs:21–23 (the three G2 income pins) → tick.js.
- 28-the-earned-muster.mjs:53 (E4 ground income) → tick.js.

Kind B — re-teaches (pinned text changes; old → new, licensed by the
plan and amendments that changed the code):

1. 07-armor-demolition.mjs:1148 — old formula text over `apcSeqN` →
   new: `if (b.kind === "vehicle" && b.vtype === "apc" && b.apcSeq > war.seq.apc) war.seq.apc = b.apcSeq;`, read from boot.js.
2. 08-debug-pass.mjs:533 — old
   `/const stampBag = \(b, side\) => \{/` → new
   `/export function stampBag\(grid, b, side\) \{/`, read from boot.js.
3. 08-debug-pass.mjs:536 — old
   `/if \(b\.sandbag && b\.alive\) stampBag\(b, b\.bagSide \|\| 1\);/` → new
   `/if \(b\.sandbag && b\.alive\) stampBag\(grid, b, b\.bagSide \|\| 1\);/`, read from boot.js.
4. 08-debug-pass.mjs:187–189 (T13(i3), the stamp-count sum) — today it
   sums `.bTeam = ` over DepotGame.jsx + buildlines.js against a
   threshold of 8; the split leaves those two at 6 + 1. The edit extends
   the sum with two new reads (boot.js: 2 hits, tick.js: 1 hit — sum 10,
   measured at plan-writing), threshold unchanged at 8; the comment
   above it gains one line naming this task's split. Counts other than
   6/1/2/1 at execution stop the task.
5. 09-reorg.mjs:177–179 (T21(a2)) — old
   `/const ringBell = \(\) => ringBellOut\(world, grid, field, T, run, bellCtx, map\);/`
   on DepotGame.jsx → new, on tick.js:
   `/if \(!war\.dev && stepBell\(run, world\.t\)\) \{ flags\.bell = true; ringBellOut\(world, grid, field, T, run, bellCtx, map\); \}/`
   (the negative half of the check — no old-style block body — keeps
   reading DepotGame.jsx and now also asserts the wrapper is GONE:
   `!/const ringBell = /.test(dgSrc21)`; the `view.pickManifest` third
   clause is untouched).
6. 11-hiring-hall.mjs (ring stamps wall arm) — the pin re-teaches to the
   landed component line at DepotGame.jsx:2717:
   `/if \(flags\.bell\) \{ view\.teachFire\("bell"\); run\.manifest\.armedAtWall = performance\.now\(\) \/ 1000 \+ PENDING_ARM_S; \}/`
   (verify the exact landed text by read before writing the pattern; a
   mismatch stops).
7. 23-the-sandbox.mjs:20 — old
   `if (!dev && stepBell(run, world.t))` → new
   `if (!war.dev && stepBell(run, world.t))`, read from tick.js; same
   file's census check: old `if (!dev) stepDepotCensus` → new
   `if (!war.dev) stepDepotCensus`, read from tick.js.

Any test failure beyond these thirty-nine named checks is a stop.

## Fix 3 — the three unaccounted failures settle at the gate

After fixes 1 and 2: the full gates, foreground, once each, in order —
`node scripts/gate.mjs depot-test` (2,089 / 0 exactly; the stopped run's
three unreproduced failures either never existed apart from these
thirty-nine or they surface HERE, and any failure stops the task with
its output), `golden` (7 / 0), `smoke` (30 / 0, the preview-server
pattern).

## The landing (the plan's steps 8–9, unchanged)

MK → `"mk2.74"` before `npm run build`; the phase-document index update
(combined 4+5 row, closeout mk2.75, tasks 6–11 off the board); one
commit of everything, subject
`the engine leaves the screen — boot and tick walk out, mk2.74`, the
standing trailers; push.

## Report

One line of outcome, then: each gate's count and runtime with the
suites' printed seeds; the keystone hashes re-printed from one fresh
`node src/depot/api.js gate` run per seed (must equal the recorded
3367709165 / 2717846799 and 2465682022 / 4256581177 — a changed hash
stops the task); every kind-A re-point and kind-B re-teach confirmed
old→new; the tree-planting restoration named; whatever the full run
says about the three unaccounted failures, plainly; every deviation
labeled; the commit hash pushed.
