# COLDSNAP FRONT — Vision & Roadmap (Jeff's picks: all option A; for his review)

## The game in one paragraph
Two depots face each other across a frozen valley. Both sides muster forces on a shared clock, hold ground, build on what they hold, and push a front line made of real physics — masonry that collapses, ice that breaks, rounds that fly true arcs. The war ends one way: a depot falls. Yours or theirs.

## Jeff's five picks (2026-08-11, all option A)
1. **Muster cycles** — both sides buy and field on a shared clock; between musters play is continuous (fight, order, build live). The cycle boundary anchors saves, intel, town income, and the future multiplayer gate.
2. **Destroy to win** — the enemy depot is a physical masonry lattice like yours; breach it below the standing threshold and it falls. Same rule both directions. Pure physics.
3. **The enemy builds** — the buy brain grows build decisions: towers and walls on ground it holds, placed by the same rules the player obeys (held ground, real costs, real build rights).
4. **Both hats always** — the player builds on any ground they hold and commands squads anywhere, all the time. The front is wherever you push it.
5. **Depot falls = game over** — the single victory condition, both directions. Clean and brutal.

## What pick 5 retires (consequence, stated plainly)
The economic endings — attrition, starvation, the ledger verdict — stop ENDING the game. The machinery stays (the economy still starves a broke side into fielding nothing, which is how economic pressure now expresses itself: a starved enemy can't defend its depot), but the war no longer ends at a bookkeeping line. The books become the means; the depot is the end.

## Pillars (unchanged laws)
- Everything is physics: sightlines, cover, collapse, craters — the simulation is the truth and the fiction.
- Symmetry: one table, one behavior, both signs. Anything one side gets, the other gets.
- Determinism: seeded randomness with exact draw contracts; same seed, same war (multiplayer's foundation).
- Diegetics: no percentages, no bars floating over the world; you read flags, fall of shot, glints, and rubble.
- Plans reviewed by Jeff before code; per-task reports in plain language; Jeff playtests every phase.

## Roadmap

| Phase | Name | Ships | Gate |
|---|---|---|---|
| F1 | The second depot | Enemy depot built as real masonry at their end (replaces the spawn-edge anchors); symmetric breach loss both directions; camera/map accommodates two bases; victory = depot falls (pick 5 lands here) | headless breach-both-ways checks; Jeff playtest |
| F2 | The heartbeat | Waves and the between-wave card replaced by muster cycles: shared clock, both sides buy at the bell, continuous play between; intel/town income/saves move to the cycle boundary; dispatch card becomes a cycle report | cycle-clock determinism twins; save-at-cycle round-trip; Jeff playtest |
| F3 | The enemy builds | Buy brain gains build decisions: towers/walls on red-held ground, real costs, same placement rules as the player; pre-set opening fortification as its first "build" | builder-brain headless runs (it must fortify, expand, and rebuild); Jeff playtest |
| F4 | The front | Fronts in practice: squads as the mid-map instrument, cover/sightline play, the pair's role, counter-attacks on their depot; polish on ordering (multi-squad selection if it hurts without) | Jeff playtest is the gate — this phase is feel |
| F5 | Balance, re-founded | The measurement + tuning pass rebuilt against the two-depot game (today's baseline run stays useful as the before picture); prices, muster budgets, cycle length, depot toughness | new sanity rules for the new shape; Jeff verdict |
| F6+ | The war machines | Bison (its outline's forks survive intact — the breakthrough weapon this game was missing a front for); rockets retuned as true indirect fire over the front; save/resume finalized on cycle boundaries; multiplayer on the cycle gate | per existing outlines |

## Debts carried in
- **Rockets:** held; F6 is their natural home (indirect fire finally has a front to fire over).
- **Balance measurement running now:** lands as F5's before-picture; no tuning until F5.
- **Save/resume plan:** survives nearly intact — cycle boundaries replace wave stalls as the save point (F2 confirms).
- **Doctrine drafts (old phase 6):** parked, not dead — doctrine picks at muster bells fit F2's clock naturally if wanted later.
- **Stale docs cleanup:** fold into F1's opening commit.

## Risks, named
- **F2 is the deep cut** — the phase machine (build/wave/stall) is load-bearing in code and in the save/multiplayer design. It gets its own careful plan; everything else is additive by comparison.
- **F3's builder brain is the largest new AI** — pick 3a accepted; F3's plan should ship it in stages (fortify first, expand second, rebuild third), each Jeff-tested.
- **Pacing unknown:** muster cycle length and depot toughness decide whether games are 10 minutes or 60. F5 owns it; F1/F2 ship with honest first guesses, labeled provisional.
