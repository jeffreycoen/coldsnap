# DEPOT Two Depots — Capture the Flag Direction (OUTLINE for Jeff; options, not a plan; no code)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

**The idea (Jeff, 2026-08-11):** add a second depot for the enemy and move gameplay from tower-defense waves toward a capture-the-flag, real-time-strategy feel.

**Why the codebase is ready for this:** the ground-holding field is already symmetric (either side can hold any cell); the enemy already has a real economy, finite manpower, and a buy brain; player infantry already takes attack orders; build rights already follow held ground; the depot-as-physical-building loss (masonry standing fraction) already exists and mirrors for free. The old roadmap's separate "attack mode" phase collapses into this: one symmetric game.

---

## FORK 1 — the heartbeat (biggest decision)
The between-wave break currently anchors: saves, intel delivery, town income, the future multiplayer sync gate. Options:
- **(a) Muster cycles (recommended):** both sides buy and field forces on a shared clock (say every 45-90 seconds); between musters, play is continuous — fighting, ordering, building all live. Feels like a front line that surges in pulses; keeps every break-anchored system (saves, intel, income, multiplayer) on the cycle boundary.
- **(b) Fully continuous:** reinforcements trickle per-second both sides. Purest strategy-game feel; saves/intel/income/multiplayer all need new homes — each one a design decision.
- **(c) Keep waves, add the second depot only:** you can now counter-attack between defends; smallest step, tests the appetite before committing.

## FORK 2 — how the enemy depot falls
- **(a) Destroy:** breach it physically, same standing-fraction rule as yours. Pure physics, symmetric, nearly free to build. Ends in rubble.
- **(b) Occupy:** hold the ground around it (the field already measures holding) for N seconds with the garrison dead or driven off. More chess-like; the building survives to be garrisoned.
- **(c) Take the flag literally:** a physical flag object your soldier must reach and carry home — true capture the flag; most new machinery (carrying, dropping, retaking), most game.

## FORK 3 — the enemy becomes a builder
Today the enemy only buys troops. A symmetric game wants it building towers/walls on its held ground.
- **(a) Full mirror:** the buy brain gains build decisions (tower/wall placement on red ground) — the real thing; largest AI work.
- **(b) Pre-built enemy base:** its depot starts fortified (scripted towers/walls per difficulty); it spends on troops only. Cheap, credible early version.
- **(c) (b) now, (a) as its own later phase.**

## FORK 4 — what the player's hands do
- **(a) Both hats always:** build on your ground, order squads anywhere, all the time. Full strategy game.
- **(b) Build at home, command forward:** building stays anchored near your depot's zone; the front is fought with troops. Preserves the defense identity; the middle of the map is infantry country.

## FORK 5 — victory & the books
- **(a) Depot falls = game over** (either direction). Clean, brutal.
- **(b) Depot falls OR economy breaks:** existing attrition/starvation/ledger wins stay live alongside capture. Richer, already built.

## Debts this direction touches
- **Balance pass:** measurement running now; tuning HELD until this direction settles (Jeff, 2026-08-11) — the wave-based health rules would be tuned into obsolescence otherwise.
- **Rockets:** still held; a front-line game makes the lob question more interesting (indirect fire over a front), same wobble retune needed.
- **Save/resume plan:** written against wave-stall save points; FORK 1's answer decides its fate (muster cycles keep it nearly as-is; continuous play reopens it).
- **The Bison:** slots naturally into this game as the breakthrough weapon; its outline's forks survive intact.
- **Multiplayer:** muster cycles (FORK 1a) keep the decision-packet model alive; fully continuous (1b) reopens it fundamentally.

## Suggested path (not binding)
FORK 1a + 2a + 3b + 4b + 5b: muster cycles, destroyable enemy depot, pre-fortified enemy base, build-at-home/fight-forward, all victory tracks live. Ships a playable two-depot game with the least new machinery, every step reversible, and the full mirror (enemy builder, occupation rules, literal flags) available as later phases if it plays well.
