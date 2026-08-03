# Physics factorial campaign — results (Advisor P)

Baseline (pre-campaign, commit a2b310d): see baseline.jsonl.
Screening: 83 one-factor cells (screenA/screenB.jsonl), compact battery each
(smoothness@0.42 + @0.9-assisted, walk10, stop, pivot-90, about-face,
cruise 2-off, shove 48/56k). NOTE: screening ran the PRE-magic engine
(node imports resolve at process start — a process-law addition).

## One-factor screening: signal cells
| Cell | Verdict |
|---|---|
| tSS@0.5 (short swing, full DS) | JACKPOT-class: i42 0.83 AND walk speed +55% (0.62 m/s at cmd 0.42) — but breaks turn/about-face machinery timing; interacts badly with the sole anchor. The mapped next leg. |
| kpDegKnee@1.25 (softer knee) | Clean: i42 0.92, i90 0.87, cruise 2/2, shove 56k |
| weldK@1.5 | i42 0.93, shove 56k — baked |
| BW@1.5, zeta@1.25 | shove 56k, cruise 2/2 — baked |
| cfmF@1.25 (stiffer ground) | Screened well (cruise 2/2, shove 56k) but ablation shows it BREAKS sortie s2 + march-180 — REJECTED |
| cmgKp@1.25 | turn 15.8→13.0s but breaks about-face + sortie — REJECTED from bake; turn speed is coupled to attitude authority (interaction row for the next leg) |
| tauMax@0.5 | smoother but falls — floor confirmed |
| magic rail (height pin) | NEGATIVE: kills forward progress (0.49→0.04 m/s); the vertical wave is gait-functional vaulting |
| magic sway shaper | lat 0.44→0.25 but reroutes energy into attitude wobble — shelved |
| fzKp/fzKd/katt | measure DEAD post-build (identical trajectories) — consumed elsewhere or at build |
| tSS×tDS both scaled | falls outright — only SS shortening works |

## Shipped bake (C5, all-hard-pass)
RIG.BW 3.5→5.25, zeta 1.1→1.375, weldK 1.5 (lock bias authority ×1.5),
magic ride damper 8 (WALK-scoped — always-on measured FALLEN stops),
sole anchor (idle-skate killer; releases when blast-scale slip demanded).
Mortality recalibrated kv 220→550 (stack rides the old charge at up 0.98;
weld ablation decisive that no single component is the armor).

## Before → after (certified battery)
| Metric | Before | After |
|---|---|---|
| Smoothness composite @0.42 | 1.00 | 0.83 (ayRms 3.11→2.78, lat 0.51→0.45) |
| Smoothness @0.9 assisted | 1.00 | 1.00 |
| Walk speed @cmd 0.42 | 0.40 m/s | 0.44 m/s |
| Stop residual | 0.19 m/s draws | 0.04 m/s clean |
| Shove envelope | 48 kN·s | 56 kN·s |
| Pivot 90° | 15.8 s | 15.0 s |
| About-face | 27.4 s | 27.8 s |
| Assisted cruise | 0.66 m/s, 4/6-class | 0.66 m/s, gate-majority green |
| Heavy-blast mortality | kv 220 | kv 550 (tougher machine, invariant kept) |

## The wall at this license + mapped next leg
- The −50% smoothness mandate is NOT met (−17%). The remaining roughness is
  the gait's own vaulting energy cycle: pinning it kills locomotion (rail),
  damping it reroutes it (sway/ride trades). The road to −50% is the
  QUICK-STEP gait (tSS 0.5-0.65): measured smoother AND much faster, needs
  (a) machinery time-constants scaled by stepPeriod (launch gates, recoverT
  floors, pivot LPFs — first attempts here re-rolled certified trajectories
  and were reverted; must be done one-constant-at-a-time with ensembles),
  (b) anchor × quick-step interaction resolved (idle-only scope broke
  launches on one draw — needs its own ensemble),
  (c) turn/about-face re-certified at the new cadence.
- Turn speed: cmgKp buys 2.8s but costs about-face/sortie — the interaction
  grid (cmgKp × afRate × turnDS) is unrun.
- kpDegKnee@1.25 composes with everything measured and is likely safe to add
  next round (left out to keep the bake minimal-risk under one gate cycle).


## Loop 2 (quick-step + interaction grids) — verdicts
- QUICK-STEP REFUTED at ensemble standards: the tSS@0.5 screening jackpot
  was a single-draw artifact. 4-offset ensembles: 1/4 at every C5 ablation
  including full pre-C5 reversal. Raw cadence scaling cannot ship; the real
  quick-step needs swing-servo retune + capture-window scaling (the full
  dynamic-gait campaign, next license tier).
- kpDegKnee@1.25 under C5: REGRESSES walk smoothness (0.83→0.93 — overlaps
  the ride damper's job), gains assisted-speed smoothness (1.00→0.83),
  slows stops 2.3→5.2s. Not a default; candidate for a speed-mode tune.
- cfmF ladder 1.05–1.15: alive (2.5 probe flips outcomes) but no measured
  benefit below the 1.25 breaking point. Stays 0.2.
- afRate/cmgKp grids: afRate 1.1 gives turn 13.7s and about-face 24-26s
  BUT 6/8 with a genuine fall vs current 7/8 zero-fall. Never-fall mandate
  outranks turn speed: current values are the local robustness optimum.
- Net: the C5 bake is the certified local optimum of this factorial space
  at this license. Smoothness stands at -17% vs the -50% mandate; the
  remaining distance is the dynamic-gait campaign, not parameter search.
