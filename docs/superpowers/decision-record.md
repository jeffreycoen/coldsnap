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

## Orders and command (Command phase, ahead)

- Radial order menu on placement and on tap replaces the chip row; defend-here is the intrinsic default.
- Order vocabulary discussed: patrol, take cover, hold fire/ambush, attack structures, fall back, escort, suppress/barrage, directed demolition. Tower doctrine: priority/focus/hold/careful/sector/barrage.
- Engineers' BUILD is two-point: tap start, tap end, lay end-to-end, dig in at the end. One rotation per line — the closest logical rotation to the line's overall direction, no per-step staircase. Field bags 3, field walls 5 with a lay pause.

## Possession (its own phase, after Command)

- Any friendly unit, squad, or tower is takeover-able — TAKE CONTROL on every radial. Twin-stick; squads driven as one (stick = formation anchor, fire = volley at aim); towers = manual fire control with doctrine buttons. The front fights on under standing orders; a bell save mid-possession releases to command view. Enemy needs no mirror.

## The Front (map phase, ahead)

- Map widens to ~80m (length stays); third road, flanks, village per bench, proving-grounds building forms.
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
- Owner playtests owed: Polish I batch AND Vision phase (one session can cover both).
- Halt-and-fight fix task: ruled, not yet planned/dispatched.
- Renderer stale comment (renderer.js:955-957 says targeting reads territory — false since mk0.72); fix rides the next task that may touch that file.
- Cohesion-deadlock autopsy fix fork (time-cap shipped C0; the smoke-bot modes B fixes were judged moot under load-only testing).
- Economy probe script calls the gate ungated (flagged mk0.72, out of scope).
