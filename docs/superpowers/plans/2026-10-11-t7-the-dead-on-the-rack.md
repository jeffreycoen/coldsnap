# T7 — The dead on the rack (0.6.7)

One line. The sandbox's enemy rack draws its tags from a rung list by key; T6 put THE DEAD on the rack's roster but not on that list, so the tag never appears. A fourth rung, THE DEAD, holds the one key. The test learns to read the rungs. Nothing else changes; the war's headless keystone is unchanged.

Checked on a fresh copy at plan-writing time: every anchor hit exactly once, every changed file parses, `depot-lint` PASS, `depot-test` 1708 PASS / 0 FAIL, the keystone unchanged, smoke 27/27.

Suggested model: Sonnet 5.5 — two substitutions at grepped anchors; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `src/depot/palette.js` lines 78–105
4. `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs` lines 1–40

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 5 confirms it again unchanged. Any other number stops the task.

No re-teach is licensed. Any failing test other than the new assert before Step 2 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the failing assert

In `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs`, replace `import { FOE_RACK_BY_KEY } from "../../src/depot/palette.js";` with `import { FOE_RACK_BY_KEY, LATTICE } from "../../src/depot/palette.js";`.

In the same file, replace

```js
  ok("(c) the enemy rack carries THE DEAD", FOE_RACK_BY_KEY.foe_dead && FOE_RACK_BY_KEY.foe_dead.dead === true && FOE_RACK_BY_KEY.foe_dead.label === "THE DEAD");
```

with

```js
  ok("(c) the enemy rack carries THE DEAD", FOE_RACK_BY_KEY.foe_dead && FOE_RACK_BY_KEY.foe_dead.dead === true && FOE_RACK_BY_KEY.foe_dead.label === "THE DEAD");
  ok("(c) the rack's rungs show the tag", LATTICE.foes.some((r) => r.keys.includes("foe_dead"))); // 0.6.7: the rungs are what the screen draws
```

Run `node scripts/gate.mjs depot-test`. Exactly one assert fails: `(c) the rack's rungs show the tag`. Record the result.

### Step 2 — the rung

In `src/depot/palette.js`, replace

```js
    { name: "TOWERS", keys: ["foe_t_mg", "foe_t_gun", "foe_t_mortar", "foe_t_rocket", "foe_t_tesla"] },
  ],
};
```

with

```js
    { name: "TOWERS", keys: ["foe_t_mg", "foe_t_gun", "foe_t_mortar", "foe_t_rocket", "foe_t_tesla"] },
    { name: "THE DEAD", keys: ["foe_dead"] }, // 0.6.7: the third side's one tag
  ],
};
```

### Step 3 — the mark

In `src/version.js`, replace `export const MK = "0.6.6";` with `export const MK = "0.6.7";`.

### Step 4 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; 1707 + 1 = 1708 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 5 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 6 — the landing

Commit exactly these files in one commit: `src/depot/palette.js`, `src/version.js`, `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs`, and this plan file. Subject: `the dead on the rack, 0.6.7`. Push to `main`.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T6 row add the row `| T7 | 0.6.7 | The dead on the rack: the sandbox's THE DEAD tag appears on its own rung | LANDED — mark 0.6.7, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1708, smoke 27/27 |`. Commit that file alone with the subject `t7 lands in the phase document — 0.6.7, the dead on the rack, 27/27`. Push.

### Step 7 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 5, and Step 7 print the identical keystone line.
- `depot-test` 1708 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The live site, phone and desktop: in the sandbox, BUILD → THE ENEMY shows a THE DEAD rung with one tag; tap it, tap the ground, one of the dead stands there. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the depot-test totals; the era's fixture seed; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
