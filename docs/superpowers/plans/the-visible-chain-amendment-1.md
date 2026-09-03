# The Visible Chain — Amendment 1: one loose pin

Step 1's third pin, `/▶/`, matches the pre-existing pause/play button (DepotGame.jsx lines 3700 and 3732), so it passed before the fix and the required all-four-fail pattern could not occur. The pin is tightened to the panel's own line, which nothing else in the file carries. The plan-writer's check verified pins against the edited source but not against the unedited one; both directions are checked from here on.

In `scripts/tests/39-the-visible-chain.mjs`, replace exactly:

```js
  ok("pins: the panel leads with the active order", /▶/.test(dg));
```

with:

```js
  ok("pins: the panel leads with the active order", /▶ \{hud\.chainList\.active\}/.test(dg));
```

## Dispatch state

Step 1's files are on the tree. On dispatch the agent applies the re-teach above, re-runs `node scripts/gate.mjs depot-test` blocking, and confirms the corrected pattern: exactly the four new pins FAIL, every pre-existing test PASSES. Then Steps 2–6 exactly as the plan writes them. Nothing else changes.
