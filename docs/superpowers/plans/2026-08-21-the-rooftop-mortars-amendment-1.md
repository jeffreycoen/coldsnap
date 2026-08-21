# THE ROOFTOP MORTARS — Amendment 1 (the missed pin)

Step 3 changes the enemy grenadier's throw to fire at `aimT`; the mk2.03(g) source pin quotes the old line verbatim. The plan never licensed it. One re-teach:

| Test | Old | New |
|---|---|---|
| `scripts/tests/04-vision-command-possession.mjs:2389` | `/throwGrenade\(world, u, muzzle, tgt\)/` | `/throwGrenade\(world, u, muzzle, aimT\)/` — label gains `(re-taught mk2.06)` |

Nothing else changes. The task resumes at step 5's gates and deploy. Acceptance: baseline + 4 = 1771 PASS.
