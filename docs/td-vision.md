# COLDSNAP DEPOT: Vision Outline

Working brainstorm, 2026-08-09. Direction only — nothing here is committed until it ships behind gates.

## The module (decided 2026-08-09)
**COLDSNAP DEPOT is a new module** — HOLD THE DEPOT (ColdsnapTD.jsx) stays intact as the pure TD and its gates keep passing untouched; the symmetric game is built next door. Same pattern as demo → sandbox → campaign.
- Shared substrate: core.js + renderer.js, map generator, audio, common unit/tower spec data. Core changes only as guarded hooks (TD-hook discipline).
- Structured as a directory from birth: `src/depot/` with `economy.js`, `territory.js`, `accuracy.js`, `ai/attacker.js`, `ai/builder.js`, `units/` — apply the module-split lesson early, not at 2800 lines.
- DEPOT inherits none of TD's balance tuning debts; conditional accuracy and the economy land fresh here, TD untouched.
- Trees/fire/MG-shredding is substrate-level — both modes get it.
- Start screen gains COLDSNAP DEPOT as a new option.

## Pillars

1. **The world has laws.** Combat stays physical: real ballistics, real occlusion, real collapse. No visible hit percentages — probability is *emergent and diegetic* (high ground and clear lanes demonstrably shoot better).
2. **Symmetry.** Rules apply to both sides: accuracy conditions, economy, tech, eventually role. The attacker is a player-shaped opponent, not a script.
3. **Every field order is new ground.** Procedural maps stay canonical; systems must be probe-able and seed-deterministic.

## 1. Combat model (first build target)

### Conditional accuracy — symmetric, diegetic
- Replace "perfect aimSolve + fixed tremor" with a **condition-driven scatter cone** per shot, both sides:
  - widens with range
  - narrows with height advantage, widens firing uphill
  - widens when the LOS ray grazes cover (partial cover); grazed rounds may physically eat the obstacle (already true)
- No UI percentages. Player learns terrain value by watching fire land.
- Existing machinery: aimSolve, per-shot spread, terrain collision. This is tuning + a modifier function, not new physics.
- Balance risk: current wave tuning assumes attacker shots mostly land — full re-tune via td-balance-probe.

### Damage-on-impact probability
- Today: every hit subtracts flat HP. Options to explore (undecided):
  - **Glancing geometry**: impact angle/velocity scales damage (physical, diegetic)
  - **Armor thresholds**: hits below a penetration floor do reduced/no damage (tanks, mech, bison)
  - **Damage variance**: seeded roll around a mean (cheapest, least diegetic)
- Lean: glancing geometry + armor thresholds for armored kinds; no dice.

### Environment
- **Trees**: catch fire when struck by incendiary-capable rounds (blasts already burn them); MG fire steadily shreds them to nothing (progressive destruction, no fire required).
- Cover is consumable everywhere: boulders, walls, trees, buildings all degrade — cover economy is real.
- **Wind (decided 2026-08-09)**: a seeded world wind vector drifting smoothly in strength/direction over a round; lateral acceleration on projectiles (guarded core hook, DEPOT-only). High arcs eat the most wind (mortars/rockets/grenades), flat fire barely notices. Symmetric — attacker aim suffers the same drift. **Visible diegetically**: flags on towers/depot angle and ripple with the true vector; tree sway amplitude scales with strength. No wind numbers in the UI — read the flags.

## 2. Economy — staged symmetry

### Stage A: Economic mirror (start here)
- Attacker gets a scrap economy: per-round stipend + payment for results (structure damage, buildings destroyed, leaks).
- Attacker **buys waves** from a priced roster (bounties ≈ prices already); mech is saved-for, not scripted.
- Attacker doctrine: readable counter-composition rules against the player's build (mortar farm → runners; walled pass → sappers/breakers).
- Wave rhythm stays round-based: purchases commit at wave start; build phase preserved.

### Stage B: Blended symmetry (explore after A)
- **Territorial**: income from ground held. Village pays whoever controls it; the front line is the economy.
- **Salvage**: wrecks, felled towers, dead units become physical scrap piles either side can recover — resources are objects on the field.
- **Attrition**: some pools finite (regiment size, masonry stock) so grinding matters.
- Blend, not pick-one: territorial + salvage compose naturally (front lines matter, battles leave usable ruins); attrition seasons long runs.

### Territory control
- Player holds a zone (shaded **green**), enemy holds theirs (shaded **red**); contested ground between.
- **Mechanism (proposed): influence field.** Every living unit and standing structure projects control in a radius (structures > units; depot most). Control soaks into the ground and decays slowly — ground stays yours a while after the shooting moves on. The front is the contour where the fields balance. Implementation: coarse grid (~2m cells) under the hood, updated a few times/sec.
- **Green gates build rights** — build only in your own color. Losing ground compounds; the depot's large radius is the anti-death-spiral floor (a last stand is always buildable).
- Income follows the field: village buildings pay whoever's color they stand in.
- Doctrine note: current map law (south third no-man's-land, first ridge = town line) becomes the *starting* front, not a constant.

## 3. Units beyond towers

### Defending infantry — snipers and troops
- Deployable infantry for defense (later: assault). Snipers = long range, low cadence, accuracy strongly elevation/LOS-driven — the showcase unit for the conditional-accuracy model.
- Infantry uses **cover**; when cover is destroyed they're exposed and die by existing mechanisms (blast, collapse, crush — machinery already in core).
- Same units usable by both sides (symmetry).

### The bison — all roles worth exploring (order TBD)
- **Economics (direction, 2026-08-09): prohibitively expensive all-in purchase, not a doctrine gate.** Buying it means forgoing other defenses/attackers — a different game for that run. Arrives mid-run (saving takes waves; intel lines can notice the underbuilt garrison). Its wreck is a massive salvage prize — losing it feeds the enemy. Same price both sides. Trap-vs-dominant balance is a probe-harness question.
- **DECIDED (2026-08-09): the bison is player-driven when active — you drive OR build, never both.** Driving is your action for the wave; no AI bison. (Multiplayer note: live driving needs the lockstep caveat — boundary-sync v1 may restrict it.)
- Escort/objective scenario remains a later option.

## 4. Tech — both kinds

### Doctrine pool (draft v1, 2026-08-09)
Flat pool + a rare **ultimate** tier (round 9+ slot, once per run). 1-of-3 per draft; cadence rounds 1/2/3 then every 3rd.

Balance scheme: every common pick ≈ one tower's value (~25 scrap) per 3 rounds in its niche; two effect sizes only — **+20% specialist** (narrow) or **+10% generalist** (broad); every defender pick has an attacker mirror on the same lever so the draft can't structurally favor a side. Numbers below are ratios-as-proposal; absolute values are probe tuning.

| Lever | Defender pick | Attacker pick | Effect (both sides) |
|---|---|---|---|
| Fortification | ENTRENCH | SIEGE TRAIN | walls −20% cost, +20% hp / mortar+tank −20% cost |
| Precision | MARKSMAN PROGRAM | GRENADIER CORPS | sniper/gren: +20% accuracy (tighter scatter), +2 range |
| Cadence | DEEP MAGAZINES | MASS LEVY | towers +10% fire rate / conscripts −20% cost, wave cap +10% |
| Armor | REVETMENTS | HARDENED PLATE | own structures/units: glancing threshold +20% |
| Wind & lead | RANGEFINDERS | SMOKE DISCIPLINE | own fire: −20% wind/lead error / enemy fire at moving own units: +20% scatter |
| Off-map | STRIKE PRIORITY | CREEPING BARRAGE | strike −20% cost, −20% cooldown / unlocks attacker strike (then same discounts) |
| Economy: ground | CIVIL DEFENSE | FORAGE PARTIES | own-color territory income +20% |
| Economy: wrecks | SALVAGE CORPS | COMBAT ENGINEERS | salvage yield +20%, recovery radius +20% |
| Economy: kills | KILLING GROUND | FIELD PROMOTION | bounties +20% / survivors of a wave gain +10% accuracy (stacking, cap 3) |
| Repair | MASON'S LEVY | PIONEER ROADS | walls self-repair 1 hp/s / grade rough ground along a chosen path (mech routes, faster vehicles) |
| Specialist | FROST DOCTRINE | INFILTRATION | frost field +20% radius/slow / sappers −20% cost, +20% speed |
| Crisis | FINAL PROTECTIVE FIRE | FORLORN HOPE | depot threatened: all towers +20% cadence / regiment below 25%: all units +20% speed+accuracy |

**Shared pool (either side may draw):** WIND DISCIPLINE (−10% wind error — stacks with the specialist) · SALVAGE RIGHTS (win contested piles) · QUARTERMASTER (stipend +10%) · FLEXIBLE COMMAND (one reroll per draft, permanent)

**Ultimates (rare, round 9+ slot, once per run):** THE FRAME — unlocks banking for the mech (both sides). Mech stays AI-driven, road-bound by engine truth (walker needs graded roads; value varies by seed — treated as flavor, dispatch attaches a "route survey"; PIONEER ROADS mitigates). Defender mech paces roads inside green.
- **Doctrine picks**: a few one-way choices per run (roguelike-flavored); cheap to build, multiplies procedural replay value.
- **Banked research**: scrap → tech as an alternative spending sink within a run (tower accuracy, wall cost, strike cooldown…).
- Symmetric: the attacker banks into its own tree (armored conscripts, faster sappers, mech discount).
- Persistent meta-tech: deliberately **avoided** for now — grinds against "every field order is new ground."

## 5. Endgame: the RTS bridge
Gap between this TD and an RTS, as separable steps:
1. an opponent that **spends** (Stage A)
2. an opponent that **holds ground** (Stage B territory)
3. the player **fielding mobile units** (infantry, bison)
4. information as a resource (fog/scouting) — unexplored, later
5. **multiplayer — THE VISION (2026-08-09): two players entering the website and sharing the battlefield**, one defending, one attacking.
   - Architecture falls out of choices already made: seed-deterministic engine + round-committed decisions = twin simulations exchanging only **decision packets at wave boundaries** (shared map seed, then purchases/placements/orders per round). No state sync, no authoritative server.
   - Hard requirement from day one: **DEPOT combat uses seeded rng only** — no unseeded Math.random() anywhere in sim-affecting code (the TD's aim/cooldown jitter would desync twins).
   - Continuous input (live bison driving, mid-wave strikes) breaks boundary-only sync — multiplayer v1 is orders-at-boundaries; hero-driving stays single-player until input-streamed lockstep is proven.
   - Needs a small signaling service for WebRTC pairing (Pages is static) — the project's first server, tiny.
   - Build late, design for it now: seeded rng + decisions-as-data cost almost nothing today.
- **Side selection at start (decided 2026-08-09): the player chooses to defend the depot or attack it.**
  - Attack mode = the attacker economy played by hand: stipend + results income, buy from the roster, commit at wave start, direct the assault. Designing Stage A symmetric means attack mode is mostly UI on top of the same rules.
  - New cost is the **defender AI** (places towers/walls/infantry against procedural terrain) — harder brain than the wave-shopper. Sequence: attacker AI first (player defends), builder AI second (unlocks player attack).
  - Bison-as-hero slots naturally on the attack side — the campaign's narrative mirror made playable.
  - Win conditions invert cleanly: depot falls vs regiment breaks (attrition pool = attack mode's loss condition).
- Each step ships as a playable release; HOLD THE DEPOT never breaks along the way.

## Settled decisions
- Conditional accuracy: symmetric, diegetic, no visible percentages.
- Economy: start with the economic mirror; explore the territorial/salvage/attrition blend next.
- Tech: doctrine picks + banked research; no persistent meta-tech.
- Publishing: MIT licensed (done), Jeff's name stays on it, itch.io target after a stranger playtest + front-door cleanup.

## Answered 2026-08-09
- **Attacker economy visibility**: diegetic intel lines — and invest in them properly (bureau-voice quality writing, not throwaway strings).
- **Damage model**: BOTH glancing geometry and armor thresholds. No dice.
- **What moves the front**: unit presence.
- **Infantry command**: placed like towers, with orders — DEFEND (they hold position) or ATTACK (they advance).
- **Run structure**: not endless — total victory or 50 waves.
- **Doctrine**: roguelike draft (offered picks, not a fixed tree).
- **Intel delivery**: between-wave dispatch card — teletyped bureau voice, ACKNOWLEDGE to dismiss, last dispatch re-readable from the bar. Reuses campaign brief machinery. CONFIRMED.
- **Wave rhythm**: hard stall points between waves — nothing advances until ACKNOWLEDGE. Doubles as the multiplayer sync point.
- **Draft cadence**: a pick at each of rounds 1, 2, 3, then every 3rd round after.
- **Victory**: destroy the enemy regiment or depot; otherwise greater economic power at turn 50 wins.
- **Scope: no v1 cut — the entire plan gets built.** Sequencing is build order, not scope.

## Open questions
- Territory influence-field proposal above: confirm (incl. green-gates-build-rights).
- Doctrine pool v1 above: confirm/adjust picks; numbers are tuning.
- Intel-line design = mapping table from real AI state → bureau prose (bought armor → "Rail offload observed…"; banking → "Expenditure below establishment. Purpose unassessed."; doctrine picked → prisoner-interview lines). Decisions inside: truth granularity (counts vs strength-words), one-wave delay or live, whether intel can miss. A writing deliverable.
- Wind tuning: strength envelope, drift rate, attacker AI compensation error. CONFIRMED as tuning work.
- Multiplayer signaling: **free-tier worker. DECIDED.**
