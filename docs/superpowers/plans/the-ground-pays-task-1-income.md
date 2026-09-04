# TASK 1 — THE GROUND PAYS (mk2.49)

Owner's rulings, 2026-08-25: income is the clock, scaled by held ground. 1 scrap/second for the starting area; continuously more for more ground, fractions included; never under 1/second. One pay law, one per-second schedule, both sides — the enemy's 90-per-bell stipend dies. Building pay (4 per standing held building per bell) stays on top, unchanged.

**Suggested model: Sonnet** — every edit is specified verbatim here.

## Facts this plan is built on (verified at plan time)

- The player's income is one line in the frame loop: `S.resources += 1 * sdt;` (`DepotGame.jsx:3811`), inside the `if (S.started && !S.gameOver && !S.victory)` block.
- The enemy's stipend is one line at the bell: `if (reg) reg.scrap += STIPEND;` (`state.js:1805`), `STIPEND = 90` (`economy.js:31`).
- The territory field steps at 4Hz (`terrAcc`/`TERR_STEP`, `DepotGame.jsx:3814-3819`); several derived reads already hang off `if (terrGuard > 0)` right after it.
- `bell.js:86-89` already counts held cells (`T.v[i] > 0.15` / `< -0.15`) for the commander's read — the count loop this task reuses.
- The territory cell is 2m (`territory.js:4`, `cs = 2`), so one cell is 4 m². `EMIT.depot.r` is 36 (`territory.js:18`). One full depot disc is `round(π·36²/4)` = **1018 cells** — the shared divisor, both sides, derived, never saved.
- The depot's disc clips the rim at its corner seat, so a fresh boot holds *under* one full disc — the floor makes opening income exactly 1/second, identical to today. The smoke test's early-war scrap arithmetic is therefore untouched.
- `economy.js` already imports from `territory.js` (`holderAt`).
- `scripts/tests/06-troops-physics.mjs:296` pins the literal source line `export const STIPEND = 90;` — the constant statement **stays**; only its comment and its one live consumer change.
- Saves carry `S.resources` and `S.reg` as plain numbers; the rates are derived each territory tick and are never serialized. No save key changes; old saves ride as they are.

## Behavior re-teaches (each one listed; any OTHER failure stops the task)

Five spots in `scripts/tests/01-engine-era.mjs` pin the bell-paid stipend; this task moves the law, so the plan carries their exact edits (Step 1). Fixture loops that add `STIPEND` per bell as headless income shorthand (`01:722-723`, `01:1672`, `01:1694`, `02-front-f1`'s bell drives) are untouched — at the floor, 1/second × 90s IS 90/bell, so their arithmetic stays honest. `11-hiring-hall.mjs`'s inequalities hold with or without the bell credit; not edited.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/economy.js` (all).
3. `src/depot/state.js` lines 1-40 and 1766-1930 (`fireBell`).
4. `src/depot/DepotGame.jsx` lines 1480-1500 (the `S` literal's market fields) and 3779-3860 (the income line and the territory accumulator).
5. `src/depot/territory.js` (all).
6. `scripts/tests/01-engine-era.mjs` lines 40-90, 640-660, 733-800.
7. `scripts/depot-test.mjs` (all — 30 lines).

## Steps

### Step 1 — failing asserts first

**(a) New era file `scripts/tests/26-the-ground-pays.mjs`:**

```js
// COLDSNAP suite era 26 — THE GROUND PAYS (mk2.49-). Income is the clock,
// scaled by held ground — one law, one per-second schedule, both sides;
// the bell stipend is dead. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { INCOME_CELLS, groundRate, STIPEND } from "../../src/depot/economy.js";
import { EMIT } from "../../src/depot/territory.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("G1: INCOME_CELLS is one depot disc of ground (pi r^2 over the 4 m^2 cell)",
  INCOME_CELLS === Math.round(Math.PI * EMIT.depot.r * EMIT.depot.r / 4) && INCOME_CELLS === 1018, INCOME_CELLS);
ok("G1: the floor — holding nothing still pays 1/second", groundRate(0) === 1);
ok("G1: the starting ground pays exactly the old clock", groundRate(INCOME_CELLS) === 1);
ok("G1: below the start the floor holds", groundRate(Math.floor(INCOME_CELLS / 2)) === 1);
ok("G1: held ground scales continuously, fractions included",
  groundRate(2 * INCOME_CELLS) === 2 &&
  Math.abs(groundRate(Math.round(1.5 * INCOME_CELLS)) - 1.5) < 0.01);
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("G2: the player's income line reads the ground rate", /S\.resources \+= S\._groundRate1 \* sdt/.test(dg));
  ok("G2: the regiment accrues on the same clock, the same gate", /S\.reg\.scrap \+= S\._groundRate2 \* sdt/.test(dg));
  ok("G2: the rates ride the territory tick", /S\._groundRate1 = groundRate\(pc\)/.test(dg) && /S\._groundRate2 = groundRate\(ec\)/.test(dg));
  ok("G2: the bell stipend is dead", !/reg\.scrap \+= STIPEND/.test(src("src/depot/state.js")));
  ok("G2: STIPEND stands only as the fixtures' shorthand", STIPEND === 90);
}
```

**(b) `scripts/depot-test.mjs`:** before the `finish();` line, after the era-25 import, add:

```js
await import("./tests/26-the-ground-pays.mjs");
```

**(c) `scripts/tests/01-engine-era.mjs` — the five stipend edits, exact:**

At lines 61-62, replace both lines with:

```js
  ok("the bell pays the regiment nothing; income is the clock both sides (mk2.49)",
    I.reg.scrap <= regBefore, `${I.reg.scrap}`);
```

At line 650, replace the whole `ok(...)` line with:

```js
    ok("bookValue: STIPEND retired from the bell — kept as the fixtures' floor-income shorthand (mk2.49)", STIPEND === 90);
```

At lines 750-751, replace the two comment lines (`// The prediction has to be taken off the SAME books...` / `// — i.e. after the stipend the bell pays...`) with:

```js
  // The prediction is taken off the SAME books the bell hands planWave —
  // the raw regiment (mk2.49: the bell pays no stipend; income is the
  // frame clock, both sides).
```

At line 757, delete the line `regP.scrap += STIPEND;`.

At lines 776-777, replace the `expected` calculation with:

```js
  const expected = scrapBefore + 100 * RESULTS.structureDmg
    + 1 * RESULTS.buildingKill + 2 * RESULTS.leak;
```

At lines 782-790, replace the whole `// STIPEND paid at the bell...` block (comment and braces included) with:

```js
// The bell pays NO stipend (mk2.49) — income is the per-second clock, both
// sides, in the frame loop; the bell's only regiment credit is payResults.
{
  const S = makeRunState();
  S.started = true;
  S.reg = { heads: 0, tanks: 0, heads0: 300, tanks0: 8, scrap: 60 };
  const before = S.reg.scrap;
  fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(10), t: BELL_PERIOD_S });
  ok("the bell pays no stipend into reg.scrap (mk2.49)", S.reg.scrap === before, `${S.reg.scrap} vs ${before}`);
}
```

Run `node scripts/gate.mjs depot-test` — the new era's G2 source pins FAIL (the code is unwritten) and the three edited fireBell asserts FAIL (the stipend still pays). Record the PASS count.

### Step 2 — `src/depot/economy.js`: the rate law

Replace the `STIPEND` line and its comment (line 31) with:

```js
export const STIPEND = 90; // mk2.49 (owner): RETIRED FROM THE BELL — income is the per-second clock, both sides, ground-scaled (groundRate below). The constant stands as the fixtures' floor-income shorthand (1/second x the 90-second bell) and for the one source pin that guards it.
```

Directly below it, add:

```js
// THE GROUND PAYS (mk2.49, owner): income is the clock, scaled by held
// ground — one law, one schedule, both sides. INCOME_CELLS is the ground
// worth 1 scrap/second: one full depot-emitter disc of territory cells
// (radius EMIT.depot.r, cell area 4 m^2) — a shared number derived from
// the same table both depots emit with, so neither side's divisor can
// drift. groundRate never falls under 1 (owner: the floor) and scales
// continuously above it, fractions included.
export const INCOME_CELLS = Math.round(Math.PI * EMIT.depot.r * EMIT.depot.r / 4);
export function groundRate(heldCells) {
  return Math.max(1, heldCells / INCOME_CELLS);
}
```

Change the import at line 3 to:

```js
import { holderAt, EMIT } from "./territory.js";
```

### Step 3 — `src/depot/state.js`: the stipend dies at the bell

Delete line 1805 (`if (reg) reg.scrap += STIPEND;`) and replace the step-3 comment above it (lines 1802-1804) with:

```js
  // 3. the income — the per-second clock, ground-scaled, both sides, in the
  // frame loop (mk2.49). The bell pays neither side; its only regiment
  // credit is payResults in step 1 and the town pay the caller applies.
```

Remove `STIPEND` from the import at line 8:

```js
import { payResults, combatIneffective, bookValue, KILL_CUT } from "./economy.js";
```

### Step 4 — `src/depot/DepotGame.jsx`: the rates, computed and spent

**(a)** Add `groundRate` to the economy import (line 33):

```js
import { makeRegiment, payTown, groundRate } from "./economy.js";
```

**(b)** In the `S` literal, directly after the line `_market: null, _marketAcc: 0, _buyAt: -9,` (line 1486), add:

```js
        // mk2.49: THE GROUND PAYS — income rates per second, ground-scaled
        // (groundRate over the territory field's held-cell counts). Derived
        // on the territory tick, never saved; 1 (the floor) until the first
        // tick, which is also every fresh boot's true opening rate.
        _groundRate1: 1, _groundRate2: 1,
```

**(c)** Directly after the sight recompute line `if (terrGuard > 0) stepSight(world, T.sight, invW, fwdU);` (line 3824), add:

```js
          // mk2.49: THE GROUND PAYS — held-cell counts on the territory
          // clock (bell.js's commander-read loop, verbatim), cached as
          // per-second rates for the income lines below. One law, both signs.
          if (terrGuard > 0) {
            let pc = 0, ec = 0;
            for (let i = 0; i < T.v.length; i++) { if (T.v[i] > 0.15) pc++; else if (T.v[i] < -0.15) ec++; }
            S._groundRate1 = groundRate(pc);
            S._groundRate2 = groundRate(ec);
          }
```

**(d)** Replace the income line (3811, `S.resources += 1 * sdt; // mk1.13 ...`) with:

```js
            S.resources += S._groundRate1 * sdt; // mk2.49 (owner): income is the clock, scaled by held ground — floor 1/second
            if (S.reg) S.reg.scrap += S._groundRate2 * sdt; // one law, one schedule, both sides — the bell stipend is dead
```

Both lines sit inside the existing `if (S.started && !S.gameOver && !S.victory)` block — the enemy's accrual starts and stops exactly when the player's does.

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green; the ledger: 3 asserts re-taught (bell-pays-nothing, results-without-stipend, no-stipend block), 1 label re-taught (STIPEND shorthand), 1 fixture line deleted (the prediction's stipend), 10 new era-26 checks. State the PASS arithmetic against Step 1's count.
- `node scripts/gate.mjs depot-lint` — green (no rng anywhere in this task).
- `node scripts/gate.mjs smoke` — green (the opening rate is the floor, exactly today's 1/second; no UI moved).

### Step 6 — the deploy

Bump `src/version.js` to `mk2.49`. Build AFTER the bump; commit ("the ground pays — income scales with held land, one clock both sides, mk2.49"); push. The owner's live check — the scrap count climbing faster as his ground grows, phone and desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the re-teach ledger old→new, gates and verdicts, commit hash, the shipped mark, seeds (none used by the new era; smoke's pinned 11). Every nonconformity its own labeled bullet.
