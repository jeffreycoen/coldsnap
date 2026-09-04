# The Jeep — Amendment 1: the pool's sixteen count pins

Adding `hero_jeep` grows the hand pool from nineteen keys to twenty — the feature working as designed — and sixteen pre-existing tests pin the old pool in literals: its count ("nineteen", and "eighteen" where a hand-minus-one is asserted), its draw arithmetic, its uniqueness counts, and the `HERO_MODE` map's exact contents. The plan licensed only the CARDS registry's count and should have swept the pool's own pins; that gap is the plan-writer's, and the sweep now covers every count literal adjacent to any table a plan grows, wherever in the suite it lives.

## The license

The sweep license is granted for EXACTLY the sixteen failures the stopped run named — the tests in the hand, T2, T3, T4, T6, T6v2, T7, T7v2, T19, M22, K7, and lattice groups that failed on the post-fix depot-test run of 2026-09-04 — under one rule:

- A pool-count literal steps up by one (19 → 20; 18 → 19 where the assert counts the hand minus one), and any prose count in the assert's name is re-worded to match ("nineteen" → "twenty", "eighteen" → "nineteen").
- The `HERO_MODE` pin's literal learns its new entry exactly as Step 9d wrote it (`hero_jeep: "jeep"` between the apc and mech entries).
- Asserted content is otherwise IDENTICAL — no gate, no mechanism, no other literal changes. If honoring a failure requires more than the rule above, STOP instead.

Every re-teach is reported old→new, each its own bullet, in the landing report. A seventeenth pre-existing failure — anything beyond the sixteen named — stops the task; the license does not stretch.

## Dispatch state

Steps 1–11 are applied on the tree and correct, including the CARDS re-teach. On dispatch the agent applies the sixteen re-teaches under the rule, then resumes Step 12's gates from the top: depot-test, golden, depot-lint, smoke, all green. Then Step 13 unchanged (bump to mk2.98, build, commit, push — the commit includes this amendment file and every re-taught test file). Nothing else in the plan changes.
