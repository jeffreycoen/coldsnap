# URGENCY LAW AMENDMENT 1 — the T6 keystone re-pin (mk2.51)

The stop: the T6 keystone (`scripts/tests/05-the-front.mjs:540-541, 599-600`) pins the exact world hash and rng draw count of a fixture battle — eight enemy conscripts against a player squad marching through town. The urgency law changes when those conscripts fire on the men, so the battle honestly diverges: deterministic on the edited tree, 3 of 3 runs, clean baseline with the edits stashed. This keystone was written to prove the mapgen code-move changed nothing; a RULED behavior change moves it, and the pin's own comment carries the precedent (re-captured at mk2.02, the roster surgery, for the same reason).

## The one edit

`scripts/tests/05-the-front.mjs` lines 540-541 — replace both lines with:

```js
  const T6_HASH = 879989108;   // was 2573479645 (re-captured mk2.51: THE URGENCY LAW — conscripts now engage the marching squad at full range, the stream moves)
  const T6_DRAWS = 572;  // was 470 (re-captured mk2.51: THE URGENCY LAW moves the stream)
```

The new numbers are the edited tree's own, printed by the fixture (`[t6 keystone] hash=879989108 draws=572`) and reproduced deterministically.

## Then

Resume the plan at Step 3 exactly as written, gates strictly one at a time: `depot-test` green (the ledger gains this keystone re-pin, old→new reported), `depot-lint`, `smoke`, then Step 4's deploy (bump mk2.51, build after the bump, commit, push).
