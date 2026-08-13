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
- THE RED CARRIED RETICLE (owner, 2026-08-13, after playing mk0.93): the reticle draws as a RED circle (its own renderer ring, not the build ghost's square). The reticle is CARRIED: released, it keeps its distance and direction from the unit — walking moves it with the unit; the right stick steers the offset. Sight-circle and seen-ground bounds unchanged; ground going dark under it still drops it home to the unit.
- REVERSAL (owner, 2026-08-13, same playtest): the bell no longer releases possession — "a bell save mid-possession releases to command view" (mk0.90, line above) is struck. The bell rings, the save is written (still never recording a possession), and the player keeps driving.

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
- CURRENT (2026-08-13): prod mk0.99. Shipped this arc: mk0.95 wind toggle; mk0.96 wind finish + FIRE pressed-state; mk0.97 the sharpened hand (possessed spread ×0.25, snap-lead, cover as bonus both sides, firing line, hold-the-shot); mk0.98 stone stands (infantry can't wake welded masonry, stick stops at buildings, bar hides while possessed); mk0.99 killing rifles (rifle 15 / MG 8 both sides, hit flinch+flash). Phase closes on the owner's playtest. Next phase: The Front.
- Owner rulings still open: tower friendly-fire safety off while possessed (ratify by play); possessed squad pace (~2.1 m/s sustained, rear man on the 6m band) — accept or possessed members outpace the anchor.
- PLAYTEST VERDICT (owner, 2026-08-12): Polish I, Vision, and the halt-and-fight fix (mk0.74) all passed — "seems okay." Both phases CLOSED. Next phase: Command (radial orders).
- Mid-march stall: squads freeze short of their destination near masonry before any contact (pre-existing pathing, cohesion/detour family) — surfaced again in the mk0.74 staging runs; unranked by the owner.
- Rifle lethality at halt range: halted squads engage at maximum reach where scatter eats shots (zero kills in a 16s staged exchange); feel call, unranked.
- Renderer stale comment (renderer.js:955-957 says targeting reads territory — false since mk0.72); fix rides the next task that may touch that file.
- Cohesion-deadlock autopsy fix fork (time-cap shipped C0; the smoke-bot modes B fixes were judged moot under load-only testing).
- Economy probe script calls the gate ungated (flagged mk0.72, out of scope).
