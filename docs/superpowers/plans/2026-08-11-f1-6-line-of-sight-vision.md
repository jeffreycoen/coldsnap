# F1.6 — Vision Is Line of Sight (outline-level; full code-bearing plan written for Jeff's review after F1.5 closes; scheduled AFTER F1.5 Tasks 2-3, BEFORE F2)

**Jeff's direction (2026-08-11):** fog and area-of-control are two different things wearing one coat. Vision must come from LINE OF SIGHT — what soldiers and towers physically see from where they stand, traced over real terrain by the same honest physics the guns use. Control (the influence field) keeps ownership: build rights, income, the red/green wash. They overlap most of the time and part exactly where the game gets interesting.

## The design
- **Vision layer (new):** a coarse grid (control-field resolution) marked visible/silhouette/hidden, rebuilt at a slow tick (~1Hz, control-field cadence) from every friendly eye: each living unit and tower contributes its sightline footprint (reachPolygon-style azimuth march from its real eye height, terrain/solid-occluded, honest tracer). Enemy side gets the mirror layer (symmetry — their acquisition stays gated by their own reads; see law note).
- **Fog renderer reads VISION, not control:** hidden ground gets the cold treatment, enemies unrendered; silhouette band at vision edges (to be defined: distance-faded rim vs the current seam semantics). Control wash/grid tint unchanged — you can SEE ground you don't OWN (sniper on a ridge) and OWN ground you can't SEE (valley behind your line stays dark).
- **The spotter earns his eyes:** elevated spotter = genuinely larger vision footprint — the pair's vision-transfer returns as a natural consequence, not a special case.
- **Laws untouched:** fire acquisition already runs honest sightlines per shot (arcClears) and unit-vs-unit fog gating currently reads the CONTROL field — DECISION FOR THE FULL PLAN: does the targeting gate move to the vision layer (see what you shoot) or stay on control (radio-net fiction)? Jeff decides at plan review; lean = targeting follows VISION (one truth).
- **Determinism:** vision layer is a pure function of body positions + terrain — no rng, twin-safe, multiplayer-safe by construction.
- **Cost control:** per-eye footprints cached and recomputed only on meaningful movement (position delta > cell size) or terrain change (crater events); towers static = computed once. Budget measured before shipping.

## Scheduling
- After F1.5 Tasks 2 (rocket retune) and 3 (rocket teams); before F2 (the heartbeat). F1.5's Task 4 closer may merge into this phase's closer if Jeff prefers fewer stops.
- Version: next tenth at phase open per the scheme.

## Full plan checklist (to be expanded code-bearing at writing time)
- Task 1: vision.js — the layer, pure + tested (footprint math, cadence, cache rules, both signs).
- Task 2: renderer swap — fog reads vision; control wash unchanged; toggle audit (FOG button semantics: visuals-only rule carries over).
- Task 3: targeting-gate decision implementation (per Jeff's review pick) + law asserts updated both directions.
- Task 4: spotter elevation payoff + selection UX (what a selected unit SEES vs what it can SHOOT — two fans? Jeff decides look).
- Closer: cost measurement, smoke, playtest framing.
