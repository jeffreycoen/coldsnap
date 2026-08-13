# WINTER FRONT — Decision Record

*The owner's ratified design decisions, migrated from session memory 2026-08-12. This file is the durable record: sessions and agents read it instead of re-asking settled questions. Append new rulings at their section; never silently rewrite one — a reversal gets a dated line of its own. Ship history lives in git; process rules live in CLAUDE.md; this file is design truth.*

## Standing frames

- The war slows diegetically, never by clock: complexity arrives through per-match progression, and ground control matters.
- Symmetry is law: whatever one side can do or suffer, the other can — charges, floods, tiers, markets, heroes.
- Loss is final: the depot falls, the save burns, no rewind. Save/resume is exact-state plus fresh dice (reseed-on-resume, one draw per bell).
- Physics budget governs design: the Pi is sim-bound (C0 baseline); features that add bodies or per-tick scans budget for it explicitly.

## The muster bell

- 90-second cycle (provisional), the war's only clock. Bell order: results pay → intel composes (card no longer auto-raises) → income → manifest offers 2-3, player picks 1 → enemy picks 1 → muster → dispatch.
- Tiers open at bells 1/3/5, mirrored both sides; the bell is a ceiling and a pick is the key; unpicked offers re-pool.
- Starting kit: walls, sandbags, rifles, engineers, plus seeded sandbags around the depot.
- Draw-count law: fixed rng draws per bell (manifest 4, foe 1), draw-then-clamp, exhausted pools still burn draws.

## Vision (Phase 2, shipped mk0.70-0.73)

- Sight gates every shot, structures included. Ground control gates building only.
- Eyes: every friendly unit, vehicle, tower, and the depot flag. Walls and sandbags are never eyes — they block sight, they don't grant it.
- Per-type sight ranges (provisional): unit 24, sniper 40, spotter 46, vehicle 36, tower 32, flag 36. A gun must never out-range its side's eyes.
- Sight is blocked by terrain and solids; elevated eyes see over. Unseen enemies are not drawn — binary, no silhouette band. Terrain fog cast follows sight; ownership wash and grid tint stay territory-based.
- Sight is derived state: never saved, rebuilt on resume, zero rng, cell maps recomputed at the territory tick.
- **Fire rule (owner, 2026-08-12): a squad under ATTACK that sees enemies in range halts and fights, then resumes the advance. MOVE stays quiet.** (Ruled after the mk0.73 diagnosis: attack-order squads never counted as stationary, so they never fired — the fix task implements this.)

## Orders and command (Command phase, next — scope ratified 2026-08-12)

- Radial order menu on placement and on tap replaces the chip row; defend-here is the intrinsic default. Covers SQUADS AND TOWERS this phase — one interaction language.
- Squad radial v1: MOVE, ATTACK, DEFEND carry over; new orders are PATROL (two taps, there and back, forever, fighting per halt-and-fight) and ATTACK STRUCTURES (prefer walls/towers over men). Type-specific orders = existing only (engineers' BUILD BAGS/WALLS migrate into their radial); no new type-specific orders this phase.
- HOLD FIRE is CUT (owner): "they can ambush with line of sight obstructed by walls" — ambush emerges from the sight system, no mechanism.
- Tower radial v1: per-tower CAREFUL/FREE (replaces the global toggle) + SELL (moves off the inspect panel). Focus-fire and the rest of the doctrine vocabulary (priority/hold/sector/barrage) wait.
- TWO-POINT ORDERS CONFIRM BEFORE THEY START (owner, 2026-08-12): patrol and build lines show the proposed path after the second tap — endpoint discs, the line, and per-piece ghost footprints with visible gaps on blocked cells — with armed accept/reject buttons floating at the END point ("up to" cost shown; skips never charge). Tapping an endpoint disc picks it up; the next ground tap re-places it; repeat until accept or reject. Nothing walks until accept; reject clears and deselects.
- Possession phase later adds TAKE CONTROL to every radial — the radial's slot geometry reserves room.
- Vocabulary still on the shelf for later phases: take cover, fall back, escort, suppress/barrage, directed demolition, mortar barrage (noting barrage cuts against the sight law).
- Engineers' BUILD is two-point: tap start, tap end, lay end-to-end, dig in at the end. One rotation per line — the closest logical rotation to the line's overall direction, no per-step staircase. Field bags 3, field walls 5 with a lay pause.
- SHIPPED (overnight run, 2026-08-13): Command phase mk0.80-0.86 — the pie live for squads and towers, proposed-line confirm on every two-point order, patrol and attack-structures in the vocabulary. Phase awaits the owner's playtest.

## Possession (its own phase, after Command)

- TWIN-STICK RETICLE (owner, 2026-08-13, after playing mk0.92): the tap-to-aim is replaced by a RIGHT STICK that STEERS a persistent ground reticle (deflection = velocity, stays put on release); the reticle is BOUNDED to the possessed unit's OWN sight circle (unit's SIGHT radius) intersected with ground currently seen — dark or out-of-view ground is unreachable, not refused. FIRE shoots at the reticle. Left stick unchanged (movement; towers have none). This also answers the queued far-eyes range question: possessed fire reaches only what the possessed unit itself can view. Patrols and proposed lines accepted as shipped ("look good").

- Any friendly unit, squad, or tower is takeover-able — TAKE CONTROL on every radial. Twin-stick; squads driven as one (stick = formation anchor, fire = volley at aim); towers = manual fire control with doctrine buttons. The front fights on under standing orders; a bell save mid-possession releases to command view. Enemy needs no mirror.
- SHIPPED (overnight run, 2026-08-13): Possession phase mk0.90-0.92 — take control on every squad and tower pie, twin-stick squad drive, volley at the aim, manual tower fire. Awaits the owner's playtest and his rulings on the queued questions (possessed squad pace; volleys beyond weapon range under far eyes).
- SHIPPED (2026-08-13): Task 4, mk0.93 — the steered reticle, per the twin-stick reticle ruling above.
- PLAYTEST VERDICT (owner, 2026-08-13): the possession phase plays well through mk0.99 — "this looks to be working... this phase is good." Phase CLOSED. Squad pace, tower safety-off and reticle speed stand as shipped (provisional F5 dials remain provisional).
- THE RED CARRIED RETICLE (owner, 2026-08-13, after playing mk0.93): the reticle draws as a RED circle (its own renderer ring, not the build ghost's square). The reticle is CARRIED: released, it keeps its distance and direction from the unit — walking moves it with the unit; the right stick steers the offset. Sight-circle and seen-ground bounds unchanged; ground going dark under it still drops it home to the unit.
- REVERSAL (owner, 2026-08-13, same playtest): the bell no longer releases possession — "a bell save mid-possession releases to command view" (mk0.90, line above) is struck. The bell rings, the save is written (still never recording a possession), and the player keeps driving.

## The Front (map phase, ahead)

- Map widens to ~80m (length stays); third road, flanks, village per bench, proving-grounds building forms.
- SQUARE 120 (owner, 2026-08-13): the map is a 120×120 SQUARE — supersedes the ~80m widening above. Generation gets more random; road count is drawn per seed, not fixed at three; a stream with a bridge arrives THIS phase as obstacle water (no drowning — the Water phase keeps basins, ice and the rest). Depot geometry work unchanged (evened + randomized-but-spaced).
- MAP ONLY (owner, 2026-08-13): this phase is map work only. Deferred to the next phase, TROOPS & PHYSICS (P6 by plan numbering — the owner's "how troops affect physics"): the unit-model change (most troops as singles, sniper pair kept), the selection UI (select-all-of-type, drag-box), combat re-tuning, the typed body-list perf work, and the bell-repriced simple AMM (design ratified: repriced each bell off live standing stock, units AND masonry, enemy pays the same table, no rng — supersedes the market section's real-time per-purchase pricing when it lands). Body lists were implemented to green gates and REVERTED at mk0.99 (probe's tail metric not repeatable); spec and findings archived in the phase plan.
- The phase plan: `plans/2026-08-13-slow-front-p5-the-front.md` (map tasks 1–6, skeleton pending fill).
- SHIPPED (2026-08-13): Task 1 mk1.00 (the 120×120 square frame, one rim constant, true-pitch ground grid) and Task 2 mk1.01 (wilder generation: bands 2-4, passes 1-3 per band, spawns 2-4, roads 0-3, depots wandering at MIRRORED depth — the placement asymmetry above is CLOSED by construction; a depot's own supply road is not a foul, Amendment 2).
- SHIPPED (2026-08-13): Task 6 mk1.05 — the two-tier collision books (owner's idea): sleeping and zero-mass bodies file once and stay filed; a cell of only sleeping stone does no pair work. Physics byte-identical (keystone hash and draw count pinned before and unmoved after; golden green; zero re-pins). Measured on the Pi, seed 2307: idle sim mean 5.0 → 3.1 ms (−38%), assault-plus-collapse 10.8 → 7.3 ms (−32%), tails improved or flat. These AFTER numbers are THE FRONT's full-density baseline. The weld-scan cousin of this idea stays queued for P6.
- SHIPPED (2026-08-13): Task 5 mk1.04 — hills and woods: 1-3 hills per seed (never zero, demo-sized, overlook allowed), a copse on every hill, 2-5 drawn copses, 0-2 forests of 20-40 trees; all planting in one pure plan function the suite runs; tree pool 144 → 360 behind one constant (six sites — Amendment 1 found the flame bound the plan missed; Amendment 2 reworded a comment that tripped the amendment's own pin). Tree counts measured 47-132 per seed.
- SHIPPED (2026-08-13): Task 4 mk1.03 — the proving grounds' building forms: slab-roof drive-through hangars and columned warehouses (2-4 per map), interior columns in the wide templates, freestanding field walls that block the grid (axis-aligned). Chunk pool 2000 → 3000; worst boot stone count measured 1589; Pi collapse capture median 5.9ms (well under the 16ms stop line).
- SHIPPED (2026-08-13): Task 3 mk1.02 — every map carries ONE stream (full-width meander, carved channel, water at a fixed level, no drowning) with ONE causeway crossing; water blocks movement for both sides symmetrically (grid for the enemy, the slot family and a bank-hold for player squads); orders and building refused on open water. Rulings: the crossing is permanent terrain this phase (built/blown bridges wait for Water); the flow grid covers the FULL rim now (60×60 — Amendment 3, the 1m inset died). Polish ledger: squad path-routing around water (P6); timber-deck look (Water).
- P6 ADDITION (owner, 2026-08-13): sleep-aware physics bookkeeping — sleeping blocks stop being filed into the collision lookup each tick, and the per-tick weld scan skips what sleeps. No behavior change; engine change under the guarded-divergence law. Tried FIRST among the P6 performance work, ahead of the body-lists resurrection. (View-gated physics was considered and rejected: the war moves in the fog — enemy marches, unseen shellfire, mid-fall collapses.)
- ALL depot geometry work lands here: evening the depots AND randomized-but-spaced placement (roads, objective, territory, save all follow). Known asymmetries until then: player depot sits closer to its rim; enemy opening sight 473 cells vs player 257.
- Sim-side performance work (typed body sub-lists, solver load under collapse) must precede or ride this phase — render is not the bottleneck.

## Terrain, water, the dam

- Copses/forests (raise tree pools); real ice ported from the sandbox as a per-pond plate builder; drowning needs a guarded core divergence (water-region list).
- Guaranteed stream every map, seeded creek→roaring river; connected basins with deterministic settle on ground disruption (craters flood, channels drain — no per-cell fluid sim).
- Bridges: engineers build, sappers blow, walkable.
- Some seeds hold a lake behind a dam; dams are masonry, blowable by BOTH sides' sappers; a blown dam = deterministic flood surge along the flow path (impulses + drown clock, washes sandbags/weak structures), then re-terraform: drained lake crossable, downstream becomes water.

## The mercenary market (Balance phase centerpiece)

- One shared market, both armies: per-item reserve pools with a constant-product price curve; buying drains the shared pool — market warfare is legal and symmetric.
- Purchase order is real-time first-come-first-served — no turns, no priority; the enemy brain staggers its buys across the cycle.
- Territory feeds replenishment, not prices: held-ground fraction scales each side's refill, symmetric.
- Reserves are sized to the physics budget — the market is the invisible performance governor. Interim until then: flat +50% player prices (the knowing asymmetry: enemy internal prices unraised).

## Heroes (late phases)

- Late-bell manifest arrivals: tanks, ace snipers, the Bison, the mech as the crown. Directly pilotable (twin-stick), front fights on meanwhile. Full symmetry: enemy late bells field their own, AI-driven; mech-vs-mech endgame is the poster. Mech playable mode rides the mech track (M4).
- **Mech track state (migrated from memory 2026-08-12; verify against branches before acting):** biped walker M1–M4 on main; `hip-yaw` branch re-tuned (lateral-sway pump fixed: tSS ×1.21, kCapture 1.3 baked in buildMech; 0.44 m/s at command 0.5, 0/6 falls, gates green) — branch NOT merged, awaiting the owner's playtest. Servo stiffness/latch/raibert measured flat, don't re-sweep. Gait truths: ensemble-sweep everything, single runs lie; launches vs cruise need separate gain sets. Harnesses: `scripts/yaw-{sweep,diag,trace}.mjs`.

## Sound

- The acoustics reference is `docs/superpowers/2026-08-12-sound-profiles-reference.md`; future sound-domain research (machinery, water, construction) appends there.
- The soundboard (`?sounds=1`, OLD/NEW A/B) is permanent and is the acceptance loop for all sound work. Retune mk0.58 accepted; its skipped items (crack path-gating, directionality, distance rate, aeolian whistle, vegetation, varied hammer) wait on research gaps.

## Deferral queues

**Polish II (post-phase, owner-ratified disposition — deferrals collect here, never folded in opportunistically):**
- Manual wall rotation toggle (like sandbags).
- Full-width top/bottom bar strips swallow ground taps (screen-eighth bands can't issue orders).
- Intel card's future purpose and re-entry.
- Income-vs-price feel at bells 1-3 (a bell buys ~2/3 of pre-raise).
- composeIntel's variable draw count (0-6 — the one non-count-stable rng site; fix = intel restructure).
- Manifest/intel card layout wrinkles at 960px and narrow phones.

**Open/owed:**
- PLAYTEST VERDICT (owner, 2026-08-13): "this phase is good" — THE FRONT is CLOSED at mk1.05 (six tasks, mk1.00–mk1.05).
- REVERSAL (owner, 2026-08-13): the SINGLES UNIT MODEL is SHELVED — "let's keep the squad setup for now." Squads stay the unit model; the n:1 experiment leaves the P6 queue and returns only on the owner's word.
- CURRENT (2026-08-13): prod mk1.05. THE FRONT CLOSED (owner's verdict, above). Next phase: TROOPS & PHYSICS (P6) — design questions before any plan; its Task 1 commit carries the roadmap flip (The Front → DONE, Troops & Physics → IN PROGRESS) per the fold-in convention.
- SHIPPED (2026-08-13): P6 Task 4 mk1.13 — the living market: sixteen type families priced off live standing stock (both armies counted together, one shared table), repriced each second, capped at 4x; one buy per second per side; income flat 1 scrap/second both sides (player bell lump and old trickle dead, enemy stipend now the same 90-per-bell clock); town payout stays; kill bounties stand (owner-reviewed interpretation). Amendment 1: "spent" now also means a regiment out of men — the manpower path joined the spent-offensive detector. Eight re-pins, all named. K dials all provisional (F5), tuned by play.
- SHIPPED (2026-08-13): P6 Task 3 mk1.12 — only engineers build: walls and sandbags left the build bar and the starting kit; masonry comes only off engineer lines; towers keep direct placement; the seeded depot bags stay; no build mode pre-selected at match open. Seven test re-pins, all owner-ruled (Amendment 1); the sandbag-orientation bar toggle's tests pruned with the toggle.
- SHIPPED (2026-08-13): P6 Task 2 mk1.11 — a sleeping stone is not a weapon: standing walls and settled rubble can no longer slam or bury a living man who is merely pressed against them; falling and flying stone kill exactly as before. Guarded to depot combat; golden green; keystone unmoved (hash and draws identical). Diagnosis on the way: the field kill was the BURIAL clock reading a wall's head-height stone as bearing down, not the ejection slam (Amendment 1); the ungated-parity fixture was retired in favor of golden (Amendment 2).
- SHIPPED (2026-08-13): P6 Task 1 mk1.10 — the path that walks around: squad marches follow a computed route on the movement grid (around masonry, through the causeway); one order crosses the stream; unreachable destinations clamp honestly to the nearest reachable ground; a stalled route redraws in three seconds — the mid-march stall closed. Roadmap flipped: The Front DONE, Troops & Physics IN PROGRESS. (Amendment 1: two test-side corrections to the plan's own Step 1 code — the implementation stood as first landed.)
- P6 DESIGN RULINGS (owner, 2026-08-13): MARKET CURVE — prices double at a half-full field (men plus masonry against the physics budget), flat prices on an empty field, capped near 4x when stuffed; both sides pay the same table. WATER ROUTING — one order walks the crossing: squads route themselves through the causeway, the bank-hold dies. ONE PATH SYSTEM — squad legs follow a computed path on the movement grid (around buildings, walls, rocks, through the causeway); the same fix owns the mid-march stall. MASONRY KILL — fixed in the physics rule: standing, sleeping, welded masonry can never slam a living walking man dead; falling stone kills exactly as now (engine change, Task 6 gates, this one named delta). LANDING PAGE — the site opens straight into Winter Front's start screen with one small tech-demos link; ALL site wording is audited against what the game is NOW (stale copy dies). README — showcase first (screenshots, the bold true claims), the technical section below it.
- FROST TOWER (owner, 2026-08-13): found DEAD in Winter Front — the slow-aura loop was never ported from tower defense; the tower did nothing. The owner's ruling: it will SHOOT — frost bolts that FREEZE enemies — "make it beautiful." DEFERRED to the phase AFTER P6, alongside the ROCKET TROOPERS (the vision's rocket teams): one arms phase reworks frost and fields rockets together. Freeze mechanics, cadence, aura, and the frozen/shatter look are designed at that phase's planning (provisional dials); the owner's eyes accept the look live.
- MARKET REVISION (owner, 2026-08-13, supersedes the half-full-field curve above): the bell market prices PER TYPE — each type's price rises with how many of THAT type stand on the field, BOTH armies' stock counted together (one shared market; buying a type out is a legal move). Cheap under-fielded types pull players toward variety. INCOME: a flat 1 scrap per second, both sides, REPLACING the old trickle and the flat bell payout; the ground-holding town payout at each bell stays as the only bonus. Curve anchors per type are provisional dials set at planning. CADENCE (owner, 2026-08-13, later the same day): prices recalculate EVERY SECOND off the live standing counts, not at the bell — the market breathes in real time; deterministic, count-based, no dice. PURCHASE LIMIT (owner, same ruling set): each side may BUY at most once per second — no spam-clicking a cheap price; the enemy brain obeys the identical limit (symmetry).
- ONLY ENGINEERS BUILD (owner, 2026-08-13): walls and sandbags can no longer be placed directly from the build bar — they are laid ONLY by engineer squads walking their two-point lines. Towers keep direct placement. The seeded depot sandbags (map dressing) stay. Joins P6 as its own task.
- P6 SCOPE (owner, 2026-08-13): the bell-market pricing (design ratified above); squad path-routing around water; the mid-march stall fix; THE MASONRY-CONTACT KILL (owner's report: a squad walked into a building and lost a man — standing sleeping masonry must not slam a walking man dead; the known depenetration-ejection hazard, fix designed at planning); the body-lists resurrection (measured with Task 6's mean/median protocol); the weld-scan sleep skip; the LANDING PAGE cleanup (Winter Front alone on the main page, tech demos behind a link); the README rewrite (what this game is technically, with screenshots). The SELECTION UI is DEFERRED to polish (owner's ruling — with squads kept it loses its case).
- Owner rulings still open: tower friendly-fire safety off while possessed (ratify by play); possessed squad pace (~2.1 m/s sustained, rear man on the 6m band) — accept or possessed members outpace the anchor.
- PLAYTEST VERDICT (owner, 2026-08-12): Polish I, Vision, and the halt-and-fight fix (mk0.74) all passed — "seems okay." Both phases CLOSED. Next phase: Command (radial orders).
- Mid-march stall: squads freeze short of their destination near masonry before any contact (pre-existing pathing, cohesion/detour family) — surfaced again in the mk0.74 staging runs; unranked by the owner.
- Rifle lethality at halt range: halted squads engage at maximum reach where scatter eats shots (zero kills in a 16s staged exchange); feel call, unranked.
- Renderer stale comment (renderer.js:955-957 says targeting reads territory — false since mk0.72); fix rides the next task that may touch that file.
- Cohesion-deadlock autopsy fix fork (time-cap shipped C0; the smoke-bot modes B fixes were judged moot under load-only testing).
- Economy probe script calls the gate ungated (flagged mk0.72, out of scope).
