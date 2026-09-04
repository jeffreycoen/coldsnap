# TASK 1 AMENDMENT 1 — the missed income pin (mk2.49)

The stop: `scripts/tests/06-troops-physics.mjs:292` pins the OLD player income line by literal source regex — `/S\.resources \+= 1 \* sdt;/` against `DepotGame.jsx`. The plan's Step 4(d) rewrites that line, so the pin fails. The plan-writer's sweep found the era-06 STIPEND pin four lines below it but missed this sibling. The pin guards literal text the task itself moves; asserted behavior (income is the clock, not a bell lump) is unchanged — this is a re-teach, not a behavior change.

## The one edit

`scripts/tests/06-troops-physics.mjs` line 292 — replace the whole `ok(...)` line with:

```js
  ok("T4(e): the player's income is the clock — ground-scaled, floor 1/second (re-taught mk2.49)", /S\.resources \+= S\._groundRate1 \* sdt;/.test(srcT4) && !/S\.resources \+= 1 \* sdt;/.test(srcT4));
```

## Then

Resume the plan at Step 5 exactly as written: `depot-test` green (ledger gains this one re-teach, old→new reported), `depot-lint`, `smoke`, then Step 6's deploy (bump mk2.49, build after the bump, commit, push).
