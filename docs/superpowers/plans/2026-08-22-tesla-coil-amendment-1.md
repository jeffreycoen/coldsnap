# The Tesla Coil — Amendment 1 (Task 1, Step 1)

One defect in the plan's own test text, found by the Task 1 agent and verified: era 22's "eight hits" block counts burned bodies with `u.hp < (u.kind === "wall" ? 70 : 100)` over ALL of `world.bodies` — which counts the tower itself (built at hp 85, never struck, 85 < 100). The count reads 9 when the chain correctly lands 8, so the assert can never pass. The chain mechanics themselves behave as specified.

The fix counts only the kinds the fixture populates, each against its own starting health.

In `scripts/tests/22-the-tesla-coil.mjs`, in the block commented `// eight hits, indiscriminate spread, chain touches a structure`, replace:

```js
  const hit = world.bodies.filter((u) => u.hp < (u.kind === "wall" ? 70 : 100)).length;
```

with:

```js
  const hit = world.bodies.filter((u) => (u.kind === "unit" && u.hp < 100) || (u.kind === "wall" && u.hp < 70)).length;
```

The two asserts that follow (`exactly eight bodies burn`, `a wall can carry the chain`) stay byte-identical — the second passes through its `hit === TESLA.maxHits` arm whether or not this fixture's geometry routes the chain through the wall.

Nothing else in the plan changes. The agent's flagged deviation on `scripts/tests/03-bell-polish.mjs` (the tower-price pin's frost clause removed rather than re-pinned at the new 55 — a real value change, outside the re-teach license) is RATIFIED by this amendment: the price is already pinned by era 22's own spec assert (`spec.cost === 55`), so the old clause is not re-created.

After applying: resume Task 1 at Step 8 (the four gates, bump to mk2.15, build, commit, push).
