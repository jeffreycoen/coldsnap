# Dynamic-gait campaign (quick-step): the period-scaling table

Base: d920431 (first fully-clean state). Baseline reproduced exactly:
idx 0.822 @ 0.42 cmd, v 0.44, walk ensemble 6/6. Target: idx <= 0.50 at
v >= 0.44. All cells are 6-run ensembles (3 settle offsets x headings
{0, 2.36}) with stops, falls classified by phase.

## The ladder: constant x scale x verdict

| Config | idx | v | ensemble | verdict |
|---|---|---|---|---|
| baseline (certified period) | 0.822 | 0.44 | 6/6 | reference |
| tSS@0.8 naive | FELL | — | 0/6 cruise@11-15s | swing can't track the clock |
| tSS@0.65 naive | FELL | — | 0/6 cruise@9-12s | same |
| tSS@0.5 naive | 2.29 | −0.03 | 1/6 | marches in place |
| + A1 anchor re-cert (_period0) | — | — | 0.5: 2/6, others 0/6 | necessary, not sufficient — the 0.9 gate silently disables the C5 anchor at ANY shortened period |
| + A2 swing authority ×1/T² (kp+kd+tauMax) | — | — | **0.8: 4/6**, 0.65/0.5 worse | REAL for 0.8 (shortfall 0.72m → tracks); slams the shorter periods |
| A2 collision found | — | — | — | authority ratio and anchor gate MUST NOT share _period0 — re-certifying one zeroed the other; split into _designPeriod (immutable) |
| tDS share {0.9, 0.8, 0.7} at tSS 0.8 | — | — | 3/6 → 2/6 → 0/6 monotone | DS time is load-bearing (weight transfer + CoP ramp run on pendulum time, not our clock) |
| speed-led cadence (eng 0.30/0.22 × slope 0.8–1.6) | FELL | — | 0–4/6, floor-dives to 0.62 then dies | no bootstrap failure, but floor-cadence cruise = the same fatal region |
| short period × high command (0.6–0.8) | — | — | all FELL | governor never delivers (dies at launch band); bypassed: still falls; certified period at raw 0.75 walks fine (v 0.55, idx 0.92) |
| gain-per-second invariance (brake+capture × period ratio) | — | — | 0.8: 4/6 → **0/6** | NEGATIVE both directions — the correction stack is a coupled discrete map, not separable per-loop gains |

## Mechanism traces (the campaign's real product)

1. **tSS@0.8 naive death**: swing target moves at clock rate, servos track at
   certified rate → feet land up to 0.72m short of plan → the speed brake's
   foot placement becomes unenforceable → commanded runaway (v 0.8→2.1) at
   11.9s. Fixed by A2 swing authority (torque ~ 1/T²).
2. **tSS@0.8 with A2**: speed equilibrium collapses to 0.17 m/s — SS-only
   shortening balloons the DS *fraction* (41%→47%) and the vault never
   builds momentum. Not a smoothness win at any stability: it is a limp,
   slower AND rougher (idx 1.94).
3. **tSS@0.65 with A2** (the decisive trace): a 3-step speed↔xi limit cycle —
   vz 0.19→0.62→0.14, xiF +0.52→−0.24 — growing to backward collapse in 7
   steps. The plan recursion, comRef chase, brake, and capture form a
   coupled discrete-time system whose stability region MOVED with the
   period; single-lever changes exit the region along a different axis each
   time (measured: swing authority fixes tracking → oscillation appears;
   gain reduction damps oscillation → tracking authority starves).

## The wall, stated precisely

The quick-step is NOT reachable by scaling any one constant, any pair, or
by speed-led cadence — confirmed here by a mechanism-driven adaptation
ladder, independently of P's parameter refutation. The gait's correction
stack is a coupled step-to-step map tuned (by ensemble evolution over this
project's history) to one period. A genuinely shorter period requires
RE-DERIVING the discrete map: linearize the step-to-step dynamics
(xi, comRef, stride correction) at the target period and place its poles —
a mathematical campaign with the controller's equations, not a sweep.
The pendulum itself is willing (raw cmd 0.75 at certified period walks at
0.55 m/s); it is the CONTROLLER that is period-locked.

## What ships from this campaign (identity-safe scaffolding)

- `j.tauMul` motor-budget channel (identity when unset) — the swing
  authority path for the future re-derivation.
- Swing authority block: kp/kd/tauMax × min(4, 1/T²) for hipPitch/knee/
  anklePitch when the live period is short — inert at certified period,
  load-bearing for any future quick-step.
- `k._designPeriod` (immutable) split from `k._period0` (anchor
  re-certification) — the measured collision is documented in-code.
- `mech._govCap` governor experiment hook (identity default).
- This harness (`wtgait/qlib.mjs`): yaw-capable ensembles with fall-phase
  classification — the campaign tool the re-derivation will need.

Gate state after all reverts: MECH ALL HARD PASS, GOLDEN ALL PASS,
baseline byte-reproduced (idx 0.822, 6/6).
