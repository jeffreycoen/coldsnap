# ONE TARGET LAW AMENDMENT 1 — the ROOFTOP source pin (mk2.52)

The stop: `scripts/tests/04-vision-command-possession.mjs:2465-2466` pins the literal old text of the grenadier's aim-top line — `const aimT = tgt.kind !== "unit" ? aimTop(world, tgt) : tgt;` — which the plan's Step 2(g) rewrites. Literal text the task itself moves; the asserted behavior (lofted structure shots aim at the roof) is unchanged — soft targets are aimed direct, structures still ride aimTop. The plan-writer's sweep missed this pin; its sibling (the state.js squadFire pin at :2463-2464) is untouched and stands.

## The one edit

`scripts/tests/04-vision-command-possession.mjs` lines 2465-2466 — replace the whole `ok(...)` statement with:

```js
    ok("ROOFTOP mk2.06(l) source pin: the enemy mortar team's structure shot rides aimTop (re-taught mk2.52: soft targets aimed direct)",
      /const aimT = !soft\(tgt\) \? aimTop\(world, tgt\) : tgt;/.test(unitsSrc));
```

## Then

Resume the plan at Step 4 exactly as written, gates strictly one at a time: `depot-test` green (the ledger gains this re-teach, old→new reported; the 07 T1 pin and T6 keystone must still stand — either moving is a STOP), `depot-lint`, `smoke`, then Step 5's deploy (bump mk2.52, build after the bump, commit, push).
