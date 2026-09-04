# EARNED MUSTER AMENDMENT 1 — a zero credit accrues nothing (mk2.53)

The stop: Step 3(a)'s `payResults` accrues unconditionally, so a quiet bell's zeroed results DEFINE `reg.earned = 0` — a defined zero defeats the `!= null` fallback, the baseline collapses to 0, and the muster buys nothing (`T21(b3)` in 09-reorg.mjs, reproducible, tracked to the edit by stash-toggle). The town-pay site carries the same latent trap (`paid.regiment` is 0 with no territory). The rule this amendment writes: the earnings field comes to exist only when scrap actually arrives — zero credits accrue nothing, and the arithmetic is unchanged for every nonzero credit.

## The edits

**(a)** `src/depot/economy.js`, in the amended `payResults` — replace the line

```js
  reg.earned = (reg.earned || 0) + won; // mk2.53: the earned muster's till
```

with:

```js
  if (won > 0) reg.earned = (reg.earned || 0) + won; // mk2.53: the earned muster's till — a zero credit accrues NOTHING (a defined 0 would defeat the fixtures' curve fallback)
```

**(b)** `src/depot/bell.js` — replace the Step 3(b) line with:

```js
  if (S.reg) { S.reg.scrap += paid.regiment; if (paid.regiment > 0) S.reg.earned = (S.reg.earned || 0) + paid.regiment; } // mk2.53: town pay is earnings; a zero pay accrues nothing
```

**(c)** `scripts/tests/28-the-earned-muster.mjs` — the two matching E4 pins re-point to the new text. Replace the payResults pin with:

```js
  ok("E4: assault results accrue to earned (zero credits accrue nothing)", /if \(won > 0\) reg\.earned = \(reg\.earned \|\| 0\) \+ won;/.test(ec));
```

and the town-pay pin with:

```js
  ok("E4: town pay accrues to earned (zero pay accrues nothing)", /if \(paid\.regiment > 0\) S\.reg\.earned = \(S\.reg\.earned \|\| 0\) \+ paid\.regiment;/.test(bl));
```

(The kill-pay and ground-income sites stand as written: a kill's pay is always positive, and the live frame loop owning the ground line IS the live game — the field existing there is correct.)

## Then

Resume the plan at Step 5 exactly as written, gates strictly one at a time: `depot-test` green (T21(b3) recovered, all 8 era-28 checks green, zero re-teaches), `depot-lint`, `smoke`, then Step 6's deploy (bump mk2.53, build after the bump, commit, push).
