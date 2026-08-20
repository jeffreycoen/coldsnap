# WINTER FRONT — Phase 7.2: The Hiring Hall

*The skeleton. Scope and design rulings are written into the task entries below and each task's own plan file. Nine tasks plus one hotfix, marks mk1.80–mk1.90 (mk1.83 = the wall-clock arming amendment; mk1.86 = the hire-affordability hotfix), easier selection first (owner's ordering); the calm window inserted third off the mk1.81 live check (owner); the reaction inserted fifth off the mk1.84 live check (owner, 2026-08-20). Each task's full plan is its own file, written one at a time on the owner's word and served alone for review. Resource harvesting is NOT here — it is Phase 7.3. ARMS follows 7.3.*

## Status

| # | Task | Mark | Plan file | State |
|---|------|------|-----------|-------|
| 1 | Easier selection | mk1.80 | `p7-2-task-1-selection.md` | SHIPPED (e8d9c60) |
| 2 | The hand | mk1.81 | `p7-2-task-2-the-hand.md` | SHIPPED (e965d1e; A1/A2) |
| 3 | The calm window | mk1.82 | `p7-2-task-3-calm-window.md` | SHIPPED (9e01adc; A1, A2 mk1.83 fbdc72f) |
| 4 | His hand | mk1.84 | `p7-2-task-4-his-hand.md` | SHIPPED (ef3811b) |
| 5 | The reaction | mk1.85 | `p7-2-task-5-reaction.md` | SHIPPED (341d09b; A1) |
| — | Hotfix: the hire answers its price | mk1.86 | `p7-2-hotfix-mk186-hire-affordability.md` | SHIPPED (9d0faec) |
| 6 | The medic | mk1.87 | `p7-2-task-6-medic.md` | SHIPPED (92ad73b; A1) |
| 7 | The mechanic | mk1.88 | `p7-2-task-7-mechanic.md` | SHIPPED (733db8c; A1) |
| 8 | The opening draft | mk1.89 | `p7-2-task-8-opening-draft.md` | SHIPPED (ee95bee; A1, A2 mk1.90, A3 mk1.91 8b90fa2) |
| — | The mech | — | — | LEFT THE QUEUE (owner, 2026-08-20: the old mech design is struck; the redesigned mech starts clean under the twelve rulings written below — unpackaged, no task number or mark until he rules) |
| — | The volunteer | — | — | HELD (owner, 2026-08-20: "hold off for now" — returns on his word, takes the next open mark) |

Every deploy bumps `src/version.js` first, builds after. One agent in the tree at a time; stop after every task.

## The tasks

**Task 1 — Easier selection (mk1.80).** Bigger tap targets; SELECT ALL OF TYPE with multi-squad orders riding it; tap-cycling through overlapping units. Drag-box is cut. Phone and desktop both, by law. Suggested model: Sonnet (input/interface, no sim change).

**Task 2 — The hand (mk1.81).** The bell's manifest pick becomes the convoy's five cards: three plans and two hires, every card its own seeded draw off the full type list — no tier gate, heroes included from bell 1; price and the market wall do the refusing. A plan costs half the type's live market price and unlocks the build bar (each build then pays full). A hire fields at once, placed by the player's own ground tap. Buy as many of the hand as the scrap holds — the convoy's window is exempt from the one-buy-per-second law. Unpicked cards re-pool. The info card stays the door to every purchase. The field manual's deal card re-teaches and the manual revision bumps; the stale "Eight linked cards" header comment dies here. The mech joins the pool in Task 8, not before. Suggested model: Sonnet (interface + draw-contract arithmetic, fully specced; bell draw counts pinned old→new).

**Task 3 — The calm window (mk1.82).** The owner's three convoy rulings off the mk1.81 live check: the WHOLE WAR PAUSES while the hand's window is up (clock, prices, combat — LATER or buying out resumes; the nothing-waits law knowingly reversed for this one window); the BAR STARTS EMPTY (the free rifles and engineer plans die — every build option is bought off the hand; the dealt four still open the war; the plans pool grows to fifteen); the dealt hand's start placements and the hire's placement gain the ✓/✗ CONFIRM GHOST — a re-tap moves it, ✓ fields it, ✗ cancels (a cancelled hire returns to the hand). Phone and desktop both. The enemy-side mirror of the bare-bar economy is intent for his hand and Enemy Front (owner: symmetrical eventually). Suggested model: Sonnet (interface + the pause gate, fully specced).

**Task 4 — His hand (mk1.84).** The full mirror: the enemy draws his own five each bell, count-stable, same table and same three-plus-two split, pays half for plans and full for hires off his own books; his hires field seeded at his depot. The interim asymmetry closes here — flagged, knowing. With the player's bar bare, his free START unlocks mirror the same law (symmetry, owner's 2026-08-20 word) — the plan names the delta. Suggested model: Sonnet (brain-side buying over Task 2's machinery, no interface).

**Task 5 — The reaction (mk1.85).** The enemy answers being attacked (owner's mk1.84 live-check finding: attacked from beyond its weapon reach, it takes no action — structural, the reactive layer was never built). Fire stays sight-gated; the reaction is movement, never blind fire. Shape, escalation, and the symmetry delta are ruled in the design-questions pass before the plan. Suggested model: Sonnet (unit-behavior work on existing machinery once specced).

**Task 6 — The medic (mk1.87).** A new squad type, both sides: he walks to the nearest wounded man and kneels to treat — the theater over the aura. Tier-1 row, ~55 scrap; rate and radius plan-set, provisional. Medic dress; the owner's eye accepts the look. Joins the hand's pool with his info card and live portrait. Suggested model: Sonnet (new squad behavior on existing squad machinery, specced loop).

**Task 7 — The mechanic (mk1.88).** A new squad type, both sides: he repairs machines AND masonry — hulls, towers, walls, sandbags. Repair is slow, pauses under fire, and pays scrap per point off the market books, so dear-to-replace keeps its teeth. Tier-3 row, ~55 scrap; cadence and cost plan-set, provisional. Joins the pool with card and portrait. Suggested model: Sonnet (same shape as Task 6, plus the repair-payment path).

**The volunteer — HELD (owner, 2026-08-20; returns on his word, next open mark).** Roughly one bell in five (~20%, one count-stable seeded draw), a free unit simply joins: the player places his by ground tap; the enemy's mirror fields seeded. Rides the hand's card and placement machinery. Held out of the queue (owner, 2026-08-20). Suggested model: Sonnet (small, bounded, one draw added to the bell contract).

**Task 8 — The opening draft (mk1.89).** Seven cards dealt at the war's start, units AND plans, EACH SIDE PICKS FIVE, all five free; starting scrap 250. Seven distinct types, kind derived from the draw's own fraction; heroes included at plain odds; the enemy picks commander-colored (cautious towers and plans, bold units, stubborn defensive — deterministic, zero draws). New pre-start pick screen, phone and desktop. Supersedes the assigned dealt four. Suggested model: Sonnet (draw contract + interface, fully specced).

**The mech — starts clean (owner, 2026-08-20).** The paragraph that stood here described the old design and is struck with it. THE TWELVE STANDING RULINGS, the mech's design truth until its own plan carries them: (1) BOTH SIDES NOW — the enemy fields and drives it in the same work, its driver built from the tower-defense boss precedent through the motor pool. (2) HERO CARD AT PLAIN ODDS — it arrives through the opening draft and the convoy hand like the Bison and the APC, one table both sides. (3) KNOCKDOWN — helpless a few seconds, then stands where it fell; damage taken while down is real; the fall itself never wounds it. (4) BOXES FIRST — the plain steel look ships; the art is its own later work. (5) BIG AND PHYSICAL — it interacts with objects and units through real contacts like everything else. (6) ONE ADDED WEAPON: THE HEAVY SALVO — a heavier missile mode on a long cooldown; no machine gun, no frost bolt, no stomp. (7) THE FEET OBEY THE TRACKS LAW — enemy men die underfoot, own men are braked for, careful/free vocabulary, both sides. (8) SIZE STAYS — ~7 m and ~19 t, exactly as the walk was certified. (9) PRICE ~400 SCRAP — the hero market family with the wall on top; a drafted mech is a lucky war, accepted knowingly. (10) ROCKETS ON — stabilization rockets and speed assist ship enabled (~0.7 m/s cruise). (11) FULL CITIZEN UNPOSSESSED — radial orders (defend, move, patrol, escort) through its own driver row; possession optional. (12) THE PROBE IS THE FIRST GATE — the physics budget governs: the Pi measurement, worst case two mechs fighting amid the full standing field, runs before any fielding code. Packaging, task count, and marks are the owner's ruling when he calls for the plan.

## Standing constraints

- All dials provisional (F5).
- The draw-count law binds Tasks 2, 4, and 5: the bell's draw contract changes are draw-then-clamp, counts pinned old→new in each plan.
- Engine (`core.js`) and renderer changes are guarded additive divergences, golden green. Task 8 fields the mech through existing engine interfaces; any engine touch is a guarded divergence.
- Test only what changed; the sweep license covers moved or re-signed literal text; every re-pin reported old→new. Every report names its fixture seeds.
- Interface tasks (1, 2, 3, 5, and the placement taps) ship phone AND desktop, every time.
- The owner's live check is the acceptance for every look: the selection feel, the hand's cards, the volunteer's arrival, the medic's kneel and dress, the repair theater, the mech on the field.

## Deferred out of this phase

- Resource harvesting — Phase 7.3 (rocks, trees, scrap salvage; the trees question still open).
- The engineer/sapper split, rocket troopers, frost freeze-shot, tower plans — ARMS.
- The enemy's mech — Heroes.
- The hip-yaw gait merge — its own decision behind the owner's mech-range playtest.
- Standing oddments unchanged: the setTargetAtTime audio gap (6 sites), the siege caveat, the sapper/grenadier hold gap.
