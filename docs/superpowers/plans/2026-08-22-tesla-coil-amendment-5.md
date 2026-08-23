# The Tesla Coil — Amendment 5 (the missing arcs array)

## The defect, proven by the counters

Driven through the real input path headless (tap the tower, tap TAKE CONTROL, hold the desktop trigger), the mk2.19 counters read: `pk: "tower"` (possessed), `fired: 0` (trigger refused), and **`arcs: -1` — the run state has no arcs array**.

Root: the game does not build its run state through state.js's `makeRunState` (which Task 1 gave `arcs: []`) — DepotGame builds its own literal at `src/depot/DepotGame.jsx:1287` (`const S = { score: ..., ws: makeDepotAssaultState(), ... }`), and that literal never got the field. Only the RESUME path sets `S.arcs` (the restore line). Consequences, all observed: a resumed run chains and scorches (the owner's first test); every fresh run has `S.arcs` undefined, so the possessed trigger refuses silently (`if (!arcs) return false`) and the auto trigger's `spec.tesla && arcs` guard falls through to `towerShot` — the coil fires plain projectiles. Plan-writer's miss in Task 1: the plan anchored the field in the wrong constructor.

## Step 1 — the field

`src/depot/DepotGame.jsx:1290` — the line `ws: makeDepotAssaultState(), spawnRR: 0,` becomes:

```js
        ws: makeDepotAssaultState(), spawnRR: 0,
        arcs: [], // mk2.20: live tesla chains — THE game state's row (state.js makeRunState serves fixtures only; Amendment 5)
```

## Step 2 — the pin

Append to `scripts/tests/22-the-tesla-coil.mjs`:

```js
{ // Amendment 5: the LIVE state literal carries the arcs array — the game
  // does not boot through makeRunState, so the field is pinned at the source.
  const dg = (await import("node:fs")).readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("a5: the game state carries arcs", /ws: makeDepotAssaultState\(\), spawnRR: 0,\s*\n\s*arcs: \[\]/.test(dg));
}
```

## Gates and the landing

`node scripts/gate.mjs depot-test` (seed 13), `golden`, `depot-lint`, `smoke`. All green → bump `src/version.js` to `mk2.20` → build → commit "the tesla coil — the missing arcs array, mk2.20" → push. Acceptance: the owner possesses the coil and presses FIRE — bolt and damage on a fresh run. Sound becomes mk2.21; the switch and words mk2.22.
