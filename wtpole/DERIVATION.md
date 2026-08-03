# The step-to-step map: derivation (pole-placement campaign)

Base: 97d1d3a. Forward axis, support frame, yaw = π (game spawn).

## Constants (printed by map.mjs at run)

ω = √(g/comH); τ_D = k.tDS, τ_S = k.tSS, T = τ_D + τ_S (certified).
Gains: raibert b = 1.3, kCapture = 1.0, capDeadband = 0.15·strideCap ≈ 0.124 m,
kDCM = 2.0, vChase = 0.45 m/s, latchMix = 0.78, seedSpan = 0.30 m,
capCommit = 0.5, bCap = 0.7 (commanded) / 1.0 (uncommanded).

## State at touchdown k

- e_k = v_k − v*   (CoM forward speed error)
- q_k = (ξ_k − c_k) − q*   (capture offset from support center, steady part removed)

## Structure (why this map is piecewise, and what each path does)

**(P1) Seed absorption is nominally DEADBEAT on q.** At every touchdown
replan, planPhases solves the first DS's zA so the *measured* ξ lands on the
recursion's SS-entry point (the solve in planPhases, clamped to
feet ± seedSpan). While unclamped, a q perturbation does not propagate as q:
it is absorbed into a zA displacement — the CoP does the work — and its
residue re-enters through the *pelvis chase over the bent plan* as a speed
effect. Small-signal q-dynamics are therefore dominated by the D≈small,
C-coupling-into-e regime.

**(P2) The capture correction has a dead zone.** Swing placement adds
kCap·ξerr only beyond capDeadband ≈ 0.124 m. Inside it, u = 0: the
small-signal map has NO capture gain. Outside, full gain arrives smoothstepped
and committed at s = capCommit.

**(P3) The chase is rate-limited.** comRef follows xiRef at ≤ vChase + |cmd|
m/s. Large |e| saturates the chase: the reference lags reality and the
brake's placement (∝ e/ω, cap bCap·strideCap) becomes the only e-authority.

**(P4) The absorption clamps.** |zA| beyond feet ± seedSpan saturates (P1);
beyond it, q propagates with the RAW divergence e^{ωτ_S} across the SS.

## The linear map per regime

x = [e; q],  x_{k+1} = J_r x_k, with r ∈ {inner, outer}:

- **J_inner** (|q| < deadband, unclamped seed): capture inactive, absorption
  deadbeat. Expect |D| ≪ 1, A set by chase+brake, B and C cross-terms
  through the bent-plan pelvis path.
- **J_outer** (deadband and/or seedSpan active): capture gain enters B/D,
  absorption partial → D picks up e^{ωτ_S}·(1−σ) with σ the absorbed
  fraction; brake still in A.

**Hypothesis H1 (the wall):** at short T the *outer* map limit-cycles because
per-step correction quanta (deadband, seedSpan, stride/brake caps — all
FIXED lengths) stay constant while per-step natural motion shrinks ∝ T: the
same whack against a smaller drift = overcorrection → alternating-sign
eigenvalue < −1. This is exactly why "gain-per-second" scaling failed
(the gait campaign's negative): it scaled gains and left every BREAKPOINT
fixed. **The schedule must scale the nonlinear breakpoints with T, not only
the gains.**

**Hypothesis H2:** J_inner stays stable at short T (divergence per step
*shrinks*), so a correctly-scaled outer region hands perturbations to a
healthy inner region.

## Method

1. Identify J_inner and J_outer empirically at certified T: perturbation
   families (velocity boosts at touchdown / mid-SS, both signs, two
   magnitudes), difference against the unperturbed twin, stack step pairs,
   least-squares J, **validate prediction on held-out runs** (R² per
   component; the map earns trust only by predicting).
2. Eigen-ladder across T ∈ {1.0, 0.9, 0.8, 0.7, 0.65} with baseline gains →
   the wall as eigenvalue trajectories.
3. Test H1 directly: at T = 0.8/0.65 re-measure with breakpoints scaled ∝ T
   (capDeadband, seedSpan, per-step caps) — gains fixed. Then gains-only
   (the refuted axis, as control). Then joint placement: solve
   {b, kCap, deadband, seedSpan, vChase, latchMix} so both eigenvalues of
   BOTH regime maps match the certified-T values.
4. Certify at the best contained period; measure the smoothness composite.

Numbers follow in RESULTS sections as stages complete.

---

# RESULTS

## Stage 1 — identification (the map earned trust where it matters)

| Config | regime | R2(e) | R2(q) | per-step eig | stride eig |
|---|---|---|---|---|---|
| P=1.0 baseline | small | 0.44-0.85 | negative (q DEADBEAT — P1 confirmed: absorption noise, unfittable) | 0.74, -0.26 | 0.51, 0.07 |
| P=1.0 baseline | large | 0.59-0.63 | negative (absorption unclamped even here) | 0.44, -0.29 | 0.27, ~0 |
| P=0.8 baseline | large | **0.92** | **0.95** | **1.71** (unstable) | **3.21** |

At 0.8 the q-channel comes ALIVE (absorption saturates, P4 confirmed) and
the e-row shows sign-flip overcorrection (a = -2.6, H1's signature). The
best-fitting map of the campaign is the unstable one — the instability IS
the signal.

## Stage 2 — pole placement at P=0.8 (cells, all map-measured)

| Cell | per-step radius |
|---|---|
| baseline | 1.71 |
| breakpoints ∝T (deadband/seedSpan/strideCap) | 1.68 — REFUTED as dominant axis |
| gains ∝T (raibert 1.04, kCap 0.8) | 1.12 |
| gains ∝1/T | 1.33 |
| gains ∝T + kDCM 1.2 | **0.75 / stride 0.31 — PLACED** (certified-grade) |
| gains ∝T + kDCM 3.0 | 1.63 (confirms direction) |
| gains ∝T + vChase 0.65 | 1.34 (not the lever) |

kDCM was the q-amplifier: the CoP/DCM push per step overshoots at short
period (d-entry 4.4 → the map's largest term, BEYOND raw pendulum
divergence — active positive feedback, now explained and tamed).

## Stage 3 — the entry problem (ensembles override the map's island)

| Path to the placed cruise | result |
|---|---|
| native 0.8 launch, placed gains | 0/3 — LAUNCH is its own period-locked regime (dies before cruise) |
| native 0.8 launch, base gains (control) | 0/3 h0, 2/3 h2.36 (reproduces gait campaign's landscape) |
| phase-scheduled gains (launch base -> cruise placed), snap period | 1/6 — the period SNAP is a frequency jump the sway oscillator cannot make |
| + ramped period (5%/cycle), snapped gains | 0/6 — intermediate periods with 0.8-placed gains are mismatched |
| + LOCKSTEP gain scheduling (gains follow live period) | 1/6 |
| + established-walk gate (sinceRest>=6, walkEstT>4) | 1/6 |
| smoothness on the "surviving" contracted run | ayRms 6.55 vs 3.05 base (2.1x ROUGHER), vMean -0.11 (thrash: catch resets yo-yo the ramp) |

## The wall, proven at the level the directive demanded

The placed cruise at 0.8T is a REAL stable island (map-verified, R2 0.92+)
— and it is UNREACHABLE: (a) the launch sequence is period-locked machinery
outside the cruise map's domain; (b) the transition is a time-varying
resonance crossing (limit-cycle transfer), not a fixed map — no ramp
rate/gate/schedule shape tried survives it, and partial transitions thrash
(catch resets re-arm the ramp). A transition controller would need a
Floquet/LTV derivation of the RAMP dynamics — beyond gain scheduling.
(c) Even quasi-entered, the short period measured ROUGHER (2.1x), consistent
with the gait campaign's limp finding: SS-shortening does not remove the
vault's energy, it re-times it.

## Structural statement (what the math demands instead)

Period manipulation of this compass gait cannot reach the -50% smoothness
bar. The roughness is the vaulting energy cycle of stiff-leg walking; the
architecture's floor is near the shipped -17/18%. Roads that change the
STRUCTURE, not the gains: (1) a Groucho/knee-flexion gait (flatten the CoM
path at the source — a new gait derivation, different leg-stiffness regime);
(2) SLIP-model running with flight phases; (3) renderer/camera-side
perceptual smoothing (already partially shipped). The scheduling
infrastructure (cruiseGains/cruisePeriod, identity-safe) and the placed
gain set {raibert 1.04, kCapture 0.8, kDCM 1.2}@0.8T ship inert for any
future entry-problem campaign.
