# The Swiveling Thrusters — design document

2026-09-06. Design settled in discussion; no plan, no experiment, no
code. This document is the record.

## What the machine gets

Every one of the six thruster nozzles gains its own independent aim.
Today each nozzle is bolted at a fixed angle (canted 45° down-and-
outward) and varies only its strength; direction comes from mixing
nozzles, and every shove wastes part of its force on the fixed cant.
With swivel, a nozzle points where the force is needed and delivers it
whole — more correction from less burn.

## The settled shape

- **All six nozzles gimbal independently.** No slab tilt, no
  privileged pair.
- **Cone: modest, about ±20°** around each nozzle's current mount
  angle. A trim range — better efficiency, the same machine character.
  The rockets do not become a second locomotion system.
- **Slew: slow.** The bells sweep visibly, taking real fractions of a
  second to traverse the cone. The controller must anticipate; aiming
  is planning, not reflex. This keeps the deliberate walking-tank feel.
- **Auto-aim only.** The stabilizer and the walk assist aim the
  nozzles; the pilot sees the effect and never steers it. Piloted
  thrust-vectoring — the jet stick becoming a vector stick — is a real
  candidate but a NEW PLAYER VERB, deferred to its own decision.

## The mechanism, sketched

Each nozzle carries an aim state beside its burn state: a target
direction (clamped to the cone) and a current direction that chases it
at the slew rate, the same shape as the burn's spool. Force applies
along the CURRENT direction — a nozzle mid-sweep pushes where it
points now, not where it is told to point. The controller's demand
step gains an aiming term: instead of projecting the needed force onto
fixed nozzle directions, it asks each nozzle for the in-cone direction
nearest the need, then throttles as today.

## Laws that bind the work when it happens

- Symmetry: the enemy's mech gets identical hardware.
- The certified thruster-free gait is untouched; thrusters stay
  opt-in.
- The look ships visible — the drawn bells swivel — on phone and
  desktop, and the owner's live check rules it.
- The eventual experiment runs on the saved harness with rolled,
  reported seeds, streaming per-run lines to the experiments log.
  It measures falls, walking speed, and delivered burn against the
  fixed-cant machine at the same tunings.

## The aiming rule and the measurements

- The speed assist aims too: every consumer of thrust asks each nozzle
  for the nearest in-cone direction. No fixed nozzle roles survive.
- The pilot's jet stick keeps its meaning — a push direction — and the
  bells turn to serve it. The pilot still never steers a bell.
- Swivel ships on stock tunings; the experiment's numbers rule any
  retune, each retune its own follow-on task.
- The experiment measures, per run: delivered burn (force along the
  demand), wasted burn, total burn, time in the stabilizer's trouble
  state, and every joint's forces — servo torque, stop impacts, and the
  shear carried by the joint's locks — with peaks recorded per joint.
  The shear needs a small tap in the hinge solver; it rides the task
  plan.

## Open, deliberately

- Piloted vectoring (the new verb) — its own decision later.
- Whether swivel changes the lift law's answer on flight — not
  promised; the lift budget is a separate law and stands until ruled
  otherwise.
- Exact cone and slew numbers — the settled words are "modest" and
  "slow"; the numbers come from the experiment, marked as design
  choices until measured.

## Measurement (T5)

The swiveling machine (arm A, the shipped nozzle mixing) measured
against a fixed-cant control (arm F, `mech._fixedCant`), same tunings,
on the T4 harness's fixed walk program. Twelve rolled seeds each, up
to 120 simulated seconds per run.

Swivel arm A seeds: 965036, 331844, 250767, 147182, 676229, 79060,
840104, 582904, 792200, 935753, 235151, 643892.

Fixed-cant arm F seeds: 880762, 479369, 783404, 668557, 608134, 28460,
316974, 952626, 296553, 419649, 75700, 771916.

| metric (mean of 12 runs) | swivel (A) | fixed-cant (F) |
|---|---|---|
| falls | 11/12 | 12/12 |
| steps (sum) | 698 | 556 |
| mean speed | 0.304 m/s | 0.339 m/s |
| delivered burn | 98,100 | 28,318 |
| wasted burn | 10,211 | 6,099 |
| total burn | 108,311 | 34,417 |
| time in trouble | 3.77 s | 1.85 s |

Worst per-joint peaks across the 12 runs:

| | swivel (A) | fixed-cant (F) |
|---|---|---|
| servo torque | Lknee, 522,530 | Rknee, 690,633 |
| stop impact | RarmSwing, 260,500 | RarmSwing, 268,711 |
| shear | LankleRoll, 737,545 | RankleRoll, 1,017,863 |

Determinism check: arm A seed 965036 and arm F seed 880762 each ran
twice; both pairs printed identical results.

Both arms fell on nearly every run of this walk program at these
tunings — this program and thrust budget push the mech past its
margin regardless of nozzle arm; the fall counts are not a swivel
verdict on their own. The swivel arm delivered far more burn (98,100
vs 28,318) at only modestly higher waste (10,211 vs 6,099), and
carried lower peak shear on its worst joint (737,545 vs 1,017,863).
The fixed-cant arm covered less total ground and spent less time in
the stabilizer's trouble state.

The cone and slew numbers are not settled by this measurement — this
run held the shipped stock tunings and did not sweep cone or slew.
Cone (~±20°) and slew (slow) stay marked as design choices.
