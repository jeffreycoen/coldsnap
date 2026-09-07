# The Trimmed Range — a two-task run

Opened 2026-09-06, following The Shell Carved (closed at 0.3.18). Two
tasks; this file is both the index and, given the size, the first
task's plan. The thrust sweep has its own file.

| Task | Mark | What lands | Status |
|---|---|---|---|
| T1 | 0.4.0 | The campaign and the contract sandbox retired from the shipped game; the mech test range KEPT (the mech workbench stays); bundle drop measured at 122,874 bytes raw JS (1,473,454 → 1,350,580) | LANDED 77c5aab (dist total 1,351,133 bytes / 1.29 MB, gzip wire 419,743 bytes / ~410 KB, floppy margin 123,427 bytes; smoke 30 − 7 = 23, 0 FAIL) |
| T2 | — (nothing ships) | The thrust sweep: falls-per-steps curve across thruster power, measured headless in a worktree | OPEN |
| T3 | 0.4.1 | The mech readout: a drawn silhouette with one dot per joint, colored green through red by servo effort, refreshed every frame; tapping it (or B) opens the full numeric table; stop impacts flash their joint and hold the number until looked at | LANDED ea3268d (smoke 23 PASS, 0 FAIL) |
| T4 | 0.4.2 | Every nozzle gains its own aim inside a modest cone about its mount, sweeping slowly; force follows where the bell points now; the hinge solver gains the shear tap; the readout gains the shear column, the nozzle aim column, and the head weld | LANDED 0d2632c (12-the-mech.mjs 25 PASS, 0 FAIL; smoke 23 PASS, 0 FAIL) |
| T5 | — (nothing ships) | The swivel experiment: the swiveling machine measured against the fixed-cant control, same tunings, on the shipped harness | LANDED 234ad7b (swivel arm falls 11/12, fixed-cant arm falls 12/12) |
| T6 | 0.4.3 | The leap, first increment: a pressure store, two-step aiming with a reachable ring and landing mark, and the crouch/drive/fly/brake leap mode landing through the deep-plant bookkeeping — stand-only, bench-only | LANDED d57d5ea (12-the-mech.mjs 25 PASS, 0 FAIL; smoke 23 PASS, 0 FAIL). Amendment 1 (0.4.4), the landing fixed — righted flight replaces bare damping, the rise burn closes the loop on the live arc, the brake arrives gentler and catches only upright, land bent, reach halved to 28m: LANDED 65be925 (12-the-mech.mjs 25 PASS, 0 FAIL; smoke 23 PASS, 0 FAIL) |
| T7 | 0.4.5 | The leap, whole: the pressure gauge becomes a real gas store in joules, the launch a piston paying force through a distance, the landing a vectored cushion and skid paying real work, righting a differential nozzle burn with the gyro as backup; tanks drawn on the torso back, a charge wisp, the vent plumes and snow, the hiss and the report | LANDED 3994faa (12-the-mech.mjs 25 PASS, 0 FAIL; smoke 23 PASS, 0 FAIL) |
| T8 | 0.4.6 | The gas tanks become real bodies welded to the torso; the piston, cushion, and skid launch/landing loads route through the hull body instead of body-wide; the bench gains the war's free camera on touch (two-finger twist and pinch) and desktop keys 1/3; the stick's screen-relative mapping follows the camera's live frame | LANDED 941dcbd (12-the-mech.mjs 25 PASS, 0 FAIL; smoke 23 PASS, 0 FAIL) |

Standing rule for every measurement harness from here on: results stream
as they land — one line per completed run appended to
`.superpowers/experiments.log` (the gates.log pattern: timestamp,
harness name, cell, seed, the run's numbers), so progress is readable
mid-flight by tailing the file. A harness that reports only at the end
does not conform.

---

# T1: the campaign and the sandbox retire (0.4.0)

The clearance campaign and the contract sandbox leave the shipped game.
The mech test range, the tower defense, and the frozen driving demo
stay, with everything they import. Removal is by deleting the retired
files and their menu wiring; the bundler does the rest.

**Suggested model: Sonnet 5.**

## Required reading

1. This plan, whole; `/home/batman/coldsnap/CLAUDE.md`, whole.
2. `src/ui/App.jsx`, `src/ui/DemosScreen.jsx`, whole.
3. `scripts/smoke.mjs`, whole.
4. `README.md`, whole.
5. `docs/superpowers/the-bundle-measured.md` — the follow-up section
   (the measured per-file table and entanglement verdicts this plan is
   built on).

## What is deleted (the measured cut, entanglements already settled)

`src/game/CampaignRunner.jsx`, `src/game/campaign.js`,
`src/game/ContractSandbox.jsx`, `src/game/contracts.js`,
`src/game/closeout.js`, `src/game/altcheck.js`,
`src/game/runner/AarPanel.jsx`, `src/game/runner/actions.js`,
`src/ui/CampaignScreen.jsx`.

**KEPT, verified shared:** `scenario.js`, `runner/trials.js`,
`predicate.js` (the mech range's), `runner/Typed.jsx` (the war's
Dispatch uses it), `ColdsnapTD.jsx`, `MechRange.jsx`, both renderers,
the frozen demo. If deleting the nine leaves any kept file importing a
deleted one, the task stops — that contradicts the measured
entanglement table and is a finding.

## The wiring

- `src/ui/App.jsx`: the campaign and sandbox imports, their screen
  branches, and their state (progress/record reads) removed.
- `src/ui/DemosScreen.jsx`: the two menu cards removed; the remaining
  cards stand unchanged.
- Dead `data-camp`/`data-menu="campaign"`/`data-menu="contracts"`
  attributes go with their elements. Stored save keys
  (`coldsnap-camp-*`, `coldsnap-cs-trial`) are NOT migrated or cleared
  — old browser storage is left as it lies (the saves law).

## The smoke re-teach (test edits, exact)

`scripts/smoke.mjs`: the `contracts` section and the `campaign` section
are removed whole, and both names leave `ALL_SECTIONS`. Nothing else in
the file changes. The new pass count is measured and becomes the
standing smoke number (expected 30 minus those sections' checks; the
arithmetic — old count, removed-check count, new count — is stated in
the report).

## CI and gates

`deploy.yml` is untouched: every CI gate tests kept code (`scenario`,
`predicate` serve the mech range; `depot-test`, `golden`, `combat`,
`accuracy`, `depot-lint` are unrelated). Verified at plan-writing.

## README re-measures

- "five tech demos" (line 5) and "five playable tech demos" (line 45):
  the count becomes three (driving, tower defense, mech range), the
  sentences reworded minimally.
- The size line re-measured from this task's build: dist total, gzip
  wire figure, floppy margin (expected ≈ 1.29 MB / margin ≈ 117 KB —
  the shipped numbers are whatever this build measures).
- Nothing else in the README changes.

## Steps

1. Preconditions:
   ```bash
   git log --oneline -1 | grep -c 4ea995f     # 1
   ls src/game/CampaignRunner.jsx src/game/ContractSandbox.jsx | wc -l  # 2
   ```
2. The deletions and the wiring, per the lists above.
3. `grep -rn 'CampaignRunner\|ContractSandbox\|CampaignScreen\|campaign.js\|contracts.js\|closeout.js\|altcheck.js\|AarPanel\|runner/actions' src scripts` —
   zero hits outside gates.log/docs, or the task stops.
4. The smoke re-teach; the README edits with numbers measured AFTER
   step 5's build.
5. `src/version.js` → `"0.4.0"` (the new phase's tenth; the form holds).
   `npm run build`. Measure the bundle for step 4's numbers.
6. Gates, wrapper, foreground, once each, bounded log polling, solo:
   `depot-test` (1,615 / 0), `golden` (7), `scenario` (16 / 0),
   `predicate` (3 / 0), then preview + `smoke` (the measured new count,
   0 FAIL). Any red stops with output.
7. Commit: `the range trimmed — the campaign and the sandbox retire, the mech bench stays, 0.4.0`.
   Standing trailers. Push. This document's T1 row → LANDED with
   commit, the measured bundle numbers, and the new smoke count.

## Acceptance (arithmetic)

- The five gates green; smoke 0 FAIL with the stated arithmetic.
- The step-3 grep clean.
- dist total measured and README carrying exactly it; the deleted nine
  absent from the tree; the kept list untouched
  (`git diff --stat src/game/MechRange.jsx src/game/scenario.js src/game/runner/trials.js src/game/predicate.js src/game/runner/Typed.jsx src/game/ColdsnapTD.jsx src/demo src/render` — empty).

## Report

One line of outcome; the bundle old→new; the smoke arithmetic; the
step-3 grep result; each gate's count and runtime; every deviation
labeled; the commit hash pushed.
