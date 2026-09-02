# The Standing Tree — Amendment 1: Step 1's required failure pattern

The plan predicted exactly four failing asserts in Step 1. The live run (seed 5, 2026-09-02) showed five, and the plan's own stop rule halted the task. The prediction was wrong; the diagnosis and the fix are unaffected.

## What actually happens before the fix

The man wakes the tree, knocks it flat, and the fallen trunk goes back to sleep before tick 600 — so "(a) the shoved tree stays asleep" reads true for the wrong reason and passes.

## The change

Step 1's required result is replaced with:

> Run `node scripts/gate.mjs depot-test`. Required result: exactly these five asserts FAIL —
> - (a) the trunk has not moved
> - (a) the trunk stands upright
> - (a) the man is held off the trunk
> - (b) the awake trunk has not moved
> - (b) the awake trunk stands upright
>
> "(a) the shoved tree stays asleep" and "(c) a tank still knocks the tree over" PASS. Every pre-existing test PASSES. Any other pattern stops the task.

This pattern is the one already on disk (gates.log, 2026-09-02, 2091 PASS / 5 FAIL, all five failures in the new file). Step 1's files are already in the tree; on dispatch the agent verifies the logged run matches this pattern and proceeds to Step 2. No re-run of Step 1 is required.

Nothing else in the plan changes. Steps 2–5, the gates, and the acceptance arithmetic stand as written. After the fix, all seven new asserts must PASS, including "(a) stays asleep" — which then holds for the right reason: the tree is never woken at all.
