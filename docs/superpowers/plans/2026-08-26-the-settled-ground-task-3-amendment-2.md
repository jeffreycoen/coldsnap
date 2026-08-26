# The Settled Valley — Amendment 2: the last slicer, and the cols pin re-taught

*Written by Claude Fable 5, 2026-08-26. The resume agent stopped correctly on two reds outside Amendment 1's license. A full survey of the suite (every `genMap` slice site, every source-count over mapgen) confirms these two are the last — nothing else reads mapgen's source this way.*

## The two fixes

**1. The eleventh slicer.** `scripts/tests/05-the-front.mjs:427` — the T5 block's assembly. Insert `sliceFn5("stoneCount"), ` on its own line directly before the line `sliceFn5("genMap"), sliceFn5("makeMap"), ...`, matching the T6 block's shape. Scaffolding only; Amendment 1's missed instance (its grep matched `sliceFn2|3|4`, and T5's `sliceFn5` slipped it — mine, not the agent's).

**2. The cols pin, re-taught 5 → 6.** `scripts/tests/05-the-front.mjs:390-391`. The inn (form book, Task 3 Step 3) legitimately carries `cols: true`, the sixth site. Asserted content otherwise identical:

old:
```js
  ok("T4(g): the wide templates and the warehouse carry the cols flag (5 sites)",
    (mgSrcT4.match(/cols: true/g) || []).length === 5);
```
new:
```js
  ok("T4(g): the wide templates, the warehouse, and the inn carry the cols flag (6 sites — re-taught mk2.63, the inn joins)",
    (mgSrcT4.match(/cols: true/g) || []).length === 6);
```

## The license

These two lines and nothing else. Every other check in every file must pass unchanged; any further red stops the task.

## Resume

Step 8 as the main plan states: depot-test twice, depot-lint, smoke; then Step 9's deploy with this amendment joining the staged plan documents. Expected suite count stays 2,090.
