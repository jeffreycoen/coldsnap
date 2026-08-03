# Closing-loop feel playthrough (item 4) — verdicts

Phone landscape 844x390 (swiftshader) + desktop 960x600, fresh build on :4179.

| Beat | Verdict |
|------|---------|
| Spawn/approach (10s hold) | ok — WALK, 6 steps, garrison unaware, no pageerrors |
| Missiles (MSL, 40m) | ok — salvo fires, garrison ALERTED, button shows cooldown countdown (screenshot p1-msl.png) |
| Cannon (hold FIRE) | ok — kills 1, shots 2 |
| PUNT | ok — status shows PUNT tag, executes, returns STAND |
| ONE LEG | ok — label flips to LOWER while held/lowering, resets when down (part-2 "stick" was a slow swiftshader lower, verified patient-window) |
| 180 | ok — engages (af="turn"), completes in ~20s sim, monotonic err 2.69 -> 0.14 (part-2 "2s done" was a probe regex artifact: no tag shows during the brake moment) |
| JETS burst | ok — touch grab feeds jetCmd, burns fire; probe pushed mech-backward (screen-up = its rear at spawn) where puffs-only is design; heat correctly nets ~0 below hard burns |
| GYRO OFF + 30k shove | ok — STAND R4 0.999 |
| Reissue | ok — respawn at z 41 |
| Desktop keys G/H/J/C | all EFFECT |
| Pageerrors across all runs | none |

Screenshots: p1-spawn/approach/msl/cannon, p2-oneleg/after180, p5-jets.
No new jank found requiring code changes; the state surfacing (cooldown,
maneuver tags, LOWER flip, toggle colors) reads correctly in play.
