# THE LASER FOOTPRINT AND THE TRUE MUZZLE — Amendment 1 (the tank keystone re-pin)

The wave tank now fires from the barrel tip instead of the hull-center phantom — the ruled change. Its rounds fly a genuinely different path, so the pinned world hash in the tank fixture moved. The draw count (12) and the firing assert both still pass; only the hash literal re-pins.

## The one change

`scripts/tests/07-armor-demolition.mjs:41` area — the pinned literal:

- `PIN_HASH` `781775633` → `782830233`, with the comment `// re-pinned mk2.05 (named): the wave tank fires from the barrel TIP now — the rounds' new flight moves the world`.

Nothing else changes. The task resumes at step 6's gates and the deploy, exactly as the plan wrote them. Acceptance: 1767 PASS.
