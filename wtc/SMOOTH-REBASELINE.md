# Smoothness re-baseline under the fixed CMG (closing loop, item 3)

0.42 cruise, 16s steady window, heading-aware axes, thrusters+assist on (game config).

| heading | ayRms | latRms | r4Rip(e-3) | vfRip | v    |
|---------|-------|--------|------------|-------|------|
| 0.00    | 2.78  | 0.45   | 2.6        | 0.17  | 0.44 |
| 1.57    | 2.77  | 0.45   | 2.6        | 0.17  | 0.44 |
| 2.36    | 2.74  | 0.46   | 2.6        | 0.17  | 0.46 |
| 3.14    | 2.78  | 0.45   | 2.6        | 0.17  | 0.44 |

Spread: 1.00-1.02x on every component.

Verdict: the CMG frame fix made smoothness ISOTROPIC — the C5 composite
(-17% vs pre-campaign) now holds at every heading, where off-axis was
previously unmeasured and (per the fall data) certainly worse. No new
cheap wins are visible in the composite: the remaining roughness is the
heading-independent vaulting energy cycle, so the road to Jeff's -50%
bar remains the dynamic-gait campaign (P's conclusion stands).
