# THE EARNED MUSTER — the enemy spends what the ground pays it (mk2.53)

Owner's rulings, 2026-08-25: the enemy's muster budget follows what it actually earned since the last bell — ground income, building pay, kill pay, assault results — replacing the flat-stipend-era fixed curve (`bellBudget`, ai.js:20-23). The bank-and-surge doctrine stays; its thresholds ride the new baseline. Consequence, measured at plan time and ruled knowingly: under the old tiny curve the bank/surge thresholds (1.8×/2.2× of ~20) sat so low that almost every solvent bell ERUPTED and dumped the till; under earned income (~90+ a bell, more with ground held) the steady band widens — the enemy spends its earnings each bell instead of cycling dump-and-bank, pressure becomes continuous, and a land-rich enemy fields visibly more than a land-poor one. The player lives on the same income law, so the fight stays fair.

**The mechanism in one sentence:** every credit to the regiment's till also accrues to `reg.earned`; `planWave` reads `reg.earned` as its baseline when the field exists and falls back to the old `bellBudget` curve when it does not; `fireBell` zeroes the accumulator after the muster spends it.

**Compatibility by construction:** `makeRegiment` does NOT initialize `earned` — only the live game layer's credit sites create it. Every existing test fixture hands `planWave`/`fireBell` a regiment without the field, takes the fallback, and stays byte-stable: **zero expected re-teaches.** Old saves carry no `earned`; their first resumed bell uses the fallback, then the accumulator exists — no migration, keys only added (the save's generic `{ ...S.reg }` sweep carries it both ways).

**Suggested model: Sonnet** — every edit is specified verbatim here.

## Facts this plan is built on (verified at plan time)

- The regiment's four credit sites: the per-second ground accrual (`DepotGame.jsx`, the mk2.49 income line `if (S.reg) S.reg.scrap += S._groundRate2 * sdt;`), town pay (`bell.js:34`, `if (S.reg) S.reg.scrap += paid.regiment;`), kill pay (`state.js` scoreKill, `else if (S.reg) S.reg.scrap += pay;`), and assault results (`economy.js` payResults, `reg.scrap += ev.structureDmg * ...`).
- `planWave` (ai.js:184-265) sets `const baseline = bellBudget(bell);` at :196; the bank threshold (1.8×), surge (2.2×), screen and spend arithmetic all key off `baseline` — they follow the new baseline with no edit.
- `fireBell` (state.js) runs the muster at `const plan = planWave(reg, snap || {}, S.bell, rng, tier.tags, priceOf);` — the reset lands directly after it.
- The 4-draw contract (planWave) is untouched — the baseline is arithmetic, never a draw.
- No test pins `bellBudget`'s use as the baseline or the `earned` field (grepped: no `bellBudget` asserts; all planWave/fireBell fixtures use raw regiments without `earned`).
- The enemy's hand purchases (fireBell's walk) spend from the till before the muster but never touch `earned` — the budget follows income, not the balance.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/ai.js` lines 1-30 and 184-265.
3. `src/depot/economy.js` (all).
4. `src/depot/state.js` lines 1687-1714 (scoreKill) and 1766-1930 (fireBell).
5. `src/depot/bell.js` lines 26-50.
6. `src/depot/DepotGame.jsx` — the mk2.49 income lines (search `_groundRate2`).
7. `scripts/depot-test.mjs` (all).

## Steps

### Step 1 — failing asserts first: new era file `scripts/tests/28-the-earned-muster.mjs`

```js
// COLDSNAP suite era 28 — THE EARNED MUSTER (mk2.53). The enemy budgets
// what it actually earned since the last bell; fixtures without the
// accumulator take the old curve, byte-stable. No seed is special.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { mulberry32 } from "../../src/engine/core.js";
import { planWave, bellBudget } from "../../src/depot/ai.js";
import { makeRunState, fireBell, BELL_PERIOD_S } from "../../src/depot/state.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

// E1 — the earned baseline governs the steady band: a mid-till regiment
// (150 scrap) under the OLD bell-1 curve (baseline ~20) sits far past the
// 2.2x surge line and DUMPS the till (~125 spent, measured pre-fix); with
// earned 90 the bank threshold is 162 > 150, so it spends its earnings
// (~77-90) and holds the rest — steady pressure, not dump-and-bank.
{
  const mk = (earned) => {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 150 };
    if (earned != null) reg.earned = earned;
    planWave(reg, {}, 1, mulberry32(281));
    return 150 - reg.scrap; // scrap actually spent
  };
  const spentOld = mk(null), spentEarned = mk(90);
  ok("E1: the earned baseline steadies the muster (seed 281) — spends the earnings, not the till",
    spentEarned < spentOld && spentEarned <= 90.001 && spentEarned >= 70, `${spentEarned} vs ${spentOld}`);
}

// E2 — the fallback is exact: earned === bellBudget(bell) buys the identical
// plan a fieldless regiment buys.
{
  const run = (withField) => {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
    if (withField) reg.earned = bellBudget(7);
    const p = planWave(reg, {}, 7, mulberry32(282));
    return JSON.stringify([p, reg.scrap, reg.heads, reg.tanks]);
  };
  ok("E2: the fallback equals the curve to the byte (seed 282)", run(false) === run(true));
}

// E3 — the bell spends the accumulator and zeroes it.
{
  const S = makeRunState();
  S.started = true;
  S.reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400, earned: 250 };
  fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(283), t: BELL_PERIOD_S });
  ok("E3: the muster zeroes the earned accumulator (seed 283)", S.reg.earned === 0, S.reg.earned);
}

// E4 — the credit sites accrue, source-pinned (the four tills that feed it).
{
  const dg = src("src/depot/DepotGame.jsx"), bl = src("src/depot/bell.js"), st = src("src/depot/state.js"), ec = src("src/depot/economy.js");
  ok("E4: ground income accrues to earned", /S\.reg\.earned = \(S\.reg\.earned \|\| 0\) \+ S\._groundRate2 \* sdt;/.test(dg));
  ok("E4: town pay accrues to earned", /S\.reg\.earned = \(S\.reg\.earned \|\| 0\) \+ paid\.regiment;/.test(bl));
  ok("E4: kill pay accrues to earned", /S\.reg\.earned = \(S\.reg\.earned \|\| 0\) \+ pay;/.test(st));
  ok("E4: assault results accrue to earned", /reg\.earned = \(reg\.earned \|\| 0\) \+ won;/.test(ec));
  ok("E4: the baseline reads the earned till", /const baseline = reg\.earned != null \? reg\.earned : bellBudget\(bell\);/.test(src("src/depot/ai.js")));
}
```

Register it in `scripts/depot-test.mjs` after the era-27 import, before `finish();`:

```js
await import("./tests/28-the-earned-muster.mjs");
```

Run `node scripts/gate.mjs depot-test` — E1, E3, and all five E4 pins FAIL (E2 passes trivially pre-fix since both runs take the fallback). Record the PASS count.

### Step 2 — `src/depot/ai.js`: the baseline reads the earnings

Replace the line `const baseline = bellBudget(bell);` (ai.js:196) with:

```js
  // mk2.53 (owner): THE EARNED MUSTER — the budget is what the ground paid
  // since the last bell (reg.earned, accrued at every credit site, zeroed by
  // fireBell after the spend). A regiment with no accumulator — every test
  // fixture, an old save's first resumed bell — takes the old curve exactly.
  const baseline = reg.earned != null ? reg.earned : bellBudget(bell);
```

Also update `bellBudget`'s own comment (ai.js:20-22): append one sentence to the existing comment block:

```js
// mk2.53: superseded as the LIVE baseline by reg.earned (THE EARNED MUSTER);
// stands as the fixture fallback and the pre-income-era reference curve.
```

### Step 3 — the four credit sites accrue

**(a)** `src/depot/economy.js`, `payResults` (lines 45-50) — replace the function body with:

```js
export function payResults(reg, ev) {
  // ev: {structureDmg, buildingKills, leaks} — tower and wall kills pay
  // through the kill law now (state.js scoreKill), never twice.
  const won = ev.structureDmg * RESULTS.structureDmg
    + ev.buildingKills * RESULTS.buildingKill + (ev.leaks || 0) * RESULTS.leak;
  reg.scrap += won;
  reg.earned = (reg.earned || 0) + won; // mk2.53: the earned muster's till
}
```

**(b)** `src/depot/bell.js` line 34 — replace `if (S.reg) S.reg.scrap += paid.regiment;` with:

```js
  if (S.reg) { S.reg.scrap += paid.regiment; S.reg.earned = (S.reg.earned || 0) + paid.regiment; } // mk2.53: town pay is earnings
```

**(c)** `src/depot/state.js`, scoreKill — replace `else if (S.reg) S.reg.scrap += pay;` (line ~1711) with:

```js
  else if (S.reg) { S.reg.scrap += pay; S.reg.earned = (S.reg.earned || 0) + pay; } // mk2.53: kill pay is earnings
```

**(d)** `src/depot/DepotGame.jsx` — replace the mk2.49 enemy income line (`if (S.reg) S.reg.scrap += S._groundRate2 * sdt; // one law, one schedule...`) with:

```js
            if (S.reg) { S.reg.scrap += S._groundRate2 * sdt; S.reg.earned = (S.reg.earned || 0) + S._groundRate2 * sdt; } // one law, one schedule, both sides — and the earned till the muster budgets from (mk2.53)
```

### Step 4 — `src/depot/state.js`: fireBell zeroes the till after the spend

Directly after the line `S.pendingPlan = plan;` (inside the `if (reg && rng)` muster block), add:

```js
    if (reg.earned != null) reg.earned = 0; // mk2.53: the muster spent the earnings; the next bell's budget accrues fresh
```

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green, strictly one gate at a time; ledger: 8 new era-28 checks, **zero re-teaches expected** (every existing fixture takes the fallback). Any existing check failing is UNLISTED — STOP.
- `node scripts/gate.mjs depot-lint` — green (no rng anywhere in this task).
- `node scripts/gate.mjs smoke` — green; any smoke failure is unlisted — STOP.

### Step 6 — the deploy

Bump `src/version.js` to `mk2.53`. Build AFTER the bump; commit ("the earned muster — the enemy spends what the ground pays it, mk2.53"); push. The owner's live check — a land-rich enemy fielding visibly heavier bells, a land-poor one thinning — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the ledger, gates and verdicts, commit hash, shipped mark, seeds (era-28 fixtures 281/282/283; smoke's 11). Every nonconformity its own labeled bullet.

## Out of scope, held

- The armor-vs-armor live-mount anomaly (open diagnosis).
- Commander ground-hunger (doctrine biased by income shortfall) — a later design if the owner wants it.
