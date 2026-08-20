# WINTER FRONT — Phase 7.2: The Hiring Hall

*The skeleton. Scope and all design rulings: `docs/superpowers/decision-record.md`, the 2026-08-19 first-pass and second-pass entries plus the 2026-08-20 convoy rulings. Nine tasks, marks mk1.80–mk1.89 (mk1.83 = the wall-clock arming amendment), easier selection first (owner's ordering); the calm window inserted third off the mk1.81 live check (owner); the reaction inserted fifth off the mk1.84 live check (owner, 2026-08-20). Each task's full plan is its own file, written one at a time on the owner's word and served alone for review. Resource harvesting is NOT here — it is Phase 7.3. ARMS follows 7.3.*

## Status

| # | Task | Mark | Plan file | State |
|---|------|------|-----------|-------|
| 1 | Easier selection | mk1.80 | `p7-2-task-1-selection.md` | SHIPPED (e8d9c60) |
| 2 | The hand | mk1.81 | `p7-2-task-2-the-hand.md` | SHIPPED (e965d1e; A1/A2) |
| 3 | The calm window | mk1.82 | `p7-2-task-3-calm-window.md` | SHIPPED (9e01adc; A1, A2 mk1.83 fbdc72f) |
| 4 | His hand | mk1.84 | `p7-2-task-4-his-hand.md` | SHIPPED (ef3811b) |
| 5 | The reaction | mk1.85 | `p7-2-task-5-reaction.md` | SHIPPED (341d09b; A1) |
| 6 | The volunteer | mk1.86 | `p7-2-task-6-volunteer.md` | pending |
| 7 | The medic | mk1.87 | `p7-2-task-7-medic.md` | pending |
| 8 | The mechanic | mk1.88 | `p7-2-task-8-mechanic.md` | pending |
| 9 | The mech | mk1.89 | `p7-2-task-9-mech.md` | pending |

Every deploy bumps `src/version.js` first, builds after. One agent in the tree at a time; stop after every task.

## The tasks

**Task 1 — Easier selection (mk1.80).** Bigger tap targets; SELECT ALL OF TYPE with multi-squad orders riding it; tap-cycling through overlapping units. Drag-box is cut. Phone and desktop both, by law. Suggested model: Sonnet (input/interface, no sim change).

**Task 2 — The hand (mk1.81).** The bell's manifest pick becomes the convoy's five cards: three plans and two hires, every card its own seeded draw off the full type list — no tier gate, heroes included from bell 1; price and the market wall do the refusing. A plan costs half the type's live market price and unlocks the build bar (each build then pays full). A hire fields at once, placed by the player's own ground tap. Buy as many of the hand as the scrap holds — the convoy's window is exempt from the one-buy-per-second law. Unpicked cards re-pool. The info card stays the door to every purchase. The field manual's deal card re-teaches and the manual revision bumps; the stale "Eight linked cards" header comment dies here. The mech joins the pool in Task 8, not before. Suggested model: Sonnet (interface + draw-contract arithmetic, fully specced; bell draw counts pinned old→new).

**Task 3 — The calm window (mk1.82).** The owner's three convoy rulings off the mk1.81 live check: the WHOLE WAR PAUSES while the hand's window is up (clock, prices, combat — LATER or buying out resumes; the nothing-waits law knowingly reversed for this one window); the BAR STARTS EMPTY (the free rifles and engineer plans die — every build option is bought off the hand; the dealt four still open the war; the plans pool grows to fifteen); the dealt hand's start placements and the hire's placement gain the ✓/✗ CONFIRM GHOST — a re-tap moves it, ✓ fields it, ✗ cancels (a cancelled hire returns to the hand). Phone and desktop both. The enemy-side mirror of the bare-bar economy is intent for his hand and Enemy Front (owner: symmetrical eventually). Suggested model: Sonnet (interface + the pause gate, fully specced).

**Task 4 — His hand (mk1.84).** The full mirror: the enemy draws his own five each bell, count-stable, same table and same three-plus-two split, pays half for plans and full for hires off his own books; his hires field seeded at his depot. The interim asymmetry closes here — flagged, knowing. With the player's bar bare, his free START unlocks mirror the same law (symmetry, owner's 2026-08-20 word) — the plan names the delta. Suggested model: Sonnet (brain-side buying over Task 2's machinery, no interface).

**Task 5 — The reaction (mk1.85).** The enemy answers being attacked (owner's mk1.84 live-check finding: attacked from beyond its weapon reach, it takes no action — structural, the reactive layer was never built). Fire stays sight-gated; the reaction is movement, never blind fire. Shape, escalation, and the symmetry delta are ruled in the design-questions pass before the plan. Suggested model: Sonnet (unit-behavior work on existing machinery once specced).

**Task 6 — The volunteer (mk1.86).** Roughly one bell in five (~20%, one count-stable seeded draw), a free unit simply joins: the player places his by ground tap; the enemy's mirror fields seeded. Rides the hand's card and placement machinery. Suggested model: Sonnet (small, bounded, one draw added to the bell contract).

**Task 7 — The medic (mk1.87).** A new squad type, both sides: he walks to the nearest wounded man and kneels to treat — the theater over the aura. Tier-1 row, ~55 scrap; rate and radius plan-set, provisional. Medic dress; the owner's eye accepts the look. Joins the hand's pool with his info card and live portrait. Suggested model: Sonnet (new squad behavior on existing squad machinery, specced loop).

**Task 8 — The mechanic (mk1.88).** A new squad type, both sides: he repairs machines AND masonry — hulls, towers, walls, sandbags. Repair is slow, pauses under fire, and pays scrap per point off the market books, so dear-to-replace keeps its teeth. Tier-3 row, ~55 scrap; cadence and cost plan-set, provisional. Joins the pool with card and portrait. Suggested model: Sonnet (same shape as Task 6, plus the repair-payment path).

**Task 9 — The mech (mk1.89).** The engine's walker joins the war on main's gait. THE PROBE IS THE FIRST GATE, inside the task: the mech walking amid the full standing field, measured on the Pi with the ramp protocol against the 11.0 ms line, two repeats — it fields only if it passes. Then: a motor-pool row over the mech's command interface, twin-stick possession, and its hire card at ~400 scrap joins the pool, any bell. The hip-yaw branch merge stays its own later decision; the enemy's mech stays the Heroes crown — a knowing asymmetry, on the record. Suggested model: Sonnet (probe protocol + motor-pool integration, fully specced; the probe's numbers land in the report before any fielding code runs).

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
