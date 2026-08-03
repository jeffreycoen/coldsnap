# Advisor campaign — after-numbers (branch advisor-control @ 3eba7e7)

Harness notes: the walking/parked turn rows use turnlab.mjs (game-identical:
steering lock + mechPivot trigger). baseline.mjs's turn rows predate the
game-layer pivot trigger and understate the shipped behavior.

| Metric                             | Before (c14e51e)        | After                          |
|------------------------------------|-------------------------|--------------------------------|
| Sustained walking turn, feed 0.82  | 0/3 — 90 deg NEVER      | 3/3 — 90 deg in 14.8s          |
| Sustained walking turn, feed 0.5   | 1/3 — 90 deg in 32.7s   | 3/3 — 90 deg in 14.8s          |
| Browser turn ensemble (max stress) | ~0-2/6 (untested class) | 4/6 true-build                 |
| Assisted cruise (6 offsets)        | 3/6 @ 0.61 m/s          | 4/6 @ 0.66 m/s                 |
| About-face (6-offset avg)          | 27.5s (1 sample)        | 27.4s avg, 6/6                 |
| Walk-start 0.5m                    | 2.34s                   | 2.34s (gait-physics bound)     |
| Stop from cruise                   | 2.27s                   | 2.27s (unchanged)              |
| Shove envelope (rockets)           | 48k ok / 56k FELL       | unchanged (unaddressed)        |
| Desktop click-fire                 | BROKEN (never fired)    | fires on mousedown             |
| Mid-march 180 button               | BROKEN (stuck in brake) | works (mechCommand yields)     |

Residual open items:
- ONE phone fall mode: pivot-from-march under browser frame jitter
  (~1/3 of max-stress sequences); poisons downstream inputs when it hits.
- assisted-cruise o0.4 sprint-cascade (~30s) + one decel-tail (~42s),
  mechanism signatures recorded in-code.
- shove envelope regression to 48k (pre-existing on main; intent-band
  interaction suspected, unswept).
- audit X/T desktop rows are probe-sequencing artifacts (toggles verified
  in isolation and in phone run #1).
