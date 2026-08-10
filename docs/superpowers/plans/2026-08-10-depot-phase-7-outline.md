# DEPOT Phase 7 OUTLINE — The Bison (for Jeff's review; no code until approved)

> This is an OUTLINE + option sets, not an implementation plan. Every fork below carries 2-3 options; Jeff picks or counter-proposes. After picks, this becomes the code-level plan (subagent-driven-development, per-task commits, scoped gates).

## ⚠ NUMBERING FLAG — read first

The roadmap (`2026-08-09-depot-roadmap.md`) says the NEXT unbuilt phase is **Phase 6: Doctrine drafts** (12-lever mirrored table + shared pool + THE FRAME, `test:doctrine`). **Phase 7 is the Bison.** Jeff said "phase 7" — this outline is drafted for the BISON on that basis, but the roadmap order is 6-then-7. Note: the doctrine ultimate THE FRAME (mech banking) assumes the draft system exists; the bison does NOT depend on doctrine — building 7 before 6 is coherent, just out of roadmap order.

**FORK 0 — sequencing (pick one):**
- **(a)** Bison now (this outline), doctrine drafts become Phase 8's opener or slot after. Roadmap table gets re-lettered.
- **(b)** Jeff meant doctrine drafts — discard this outline's body; a Phase 6 outline gets written instead.
- **(c)** Bison now, but the debt ledger (below) clears first as a "Phase 6.5" interlude.

## Debt ledger — pending items that precede or ride along

| Item | Where | Belongs |
|---|---|---|
| Task 7 rebalance closer (median low-20s; early waveBudget ramp lever; rules e/f) | phase-5 plan, unshipped | **Should precede**: bison pricing is meaningless against an unbalanced economy |
| Save/resume plan | `2026-08-10-depot-save-resume.md`, AWAITING VERDICT | Independent lane; if approved, the bison's delta (hull hp/pos, exclusivity state) must join the snapshot — cheaper to know before building |
| Attrition-win economic-paralysis trigger | proposed, awaiting Jeff | Small; could ride in this phase's closer or the rebalance |
| Infantry ballistics look/sound (smaller tracer, lighter crack — spec flag) | unblocked | Ride-along task, any phase |
| Minor: tank-only survivor stalls instantly; DEFEND re-anchors to centroid | noted, unreviewed | Fold fixes into the closer or explicitly park |

**FORK D — debt handling:** (a) rebalance-first, rest rides along in Phase 7 · (b) everything-first interlude, clean Phase 7 · (c) bison-first, debts after (not recommended: pricing blind).

## Phase goal

The all-in war machine: a prohibitively expensive single purchase; buying it means you DRIVE it — drive-or-build exclusivity, camera handoff, real hull physics, weapons through the shared accuracy model, and a wreck that matters. Single-player only when driven (live input breaks boundary-only multiplayer sync — locked engine truth). Roadmap gate: **smoke drive section**.

## Standing laws that constrain this phase

- Frozen modes + core.js guarded-hook discipline (bison machinery ALREADY lives in core: `world.bisonId`, `stepDrive` core.js:921-929, `driveHull`, `bisonFire` :2307, `bisonMg` :2329 — reuse, don't fork).
- No `Math.random()` in src/depot (text-grep lint). Driving input is player-continuous — it does NOT touch rng, but it DOES make the run non-replayable from decision packets alone (multiplayer/save note, not a blocker).
- Targeting laws: STRUCTURE fire never gates on territory; UNIT-vs-unit fire always fog-gates. Self-hit law: every fire call threads `owner`; every arcClears threads selfId (the bison firing over its own hull is the classic self-hit candidate).
- Flagged-DPS parity for any dirDmg path gaining a target class.
- Scaffold-filter family risk: a team-1 PLAYER VEHICLE is a NEW body class — every `kind === "vehicle"` consumer (tower scan, bounty, leak, off-grid write-off, wave-timeout withdrawal sweep, fog render, territory emitters, corpse cleanup) gets the sweep assert, same as Phase 5 Task 3.
- Stall = the only save/sync point; twin determinism gate; golden + TD gates stay green; scoped verification, SMOKE_ONLY=depot, foreground CI polls.
- Settled by Jeff (2026-08-09, td-vision): all-in purchase, not doctrine-gated; arrives mid-run via saving; same price both sides; drive-OR-build, never both; no AI bison; wreck = massive salvage prize.

## Task skeleton (atomic; anchors; each task = failing asserts → implement → scoped gates → commit → push)

### Task 1 — spec + purchase
`src/depot/specs.js`: `BISON` entry (mass 3800, hx 2.2/hy 0.95/hz 3.3 from core.js:2055 — but finite hp + armor, NOT the sandbox's 1e9). Build bar gains BISON at the all-in price; purchase gated on scrap only (no doctrine). `state.js` owns `S.bison = {id, state}`.

**FORK 1 — price point:** (a) ~10 waves of median income (arrives ~wave 15-20 if saved for hard) · (b) ~6 waves (mid-run per vision, arrives ~wave 10-12) · (c) price = tuning; ship at (b), Task-final probe moves it. All: intel notices the underbuilt garrison while saving ("Expenditure below establishment...").

**FORK 2 — hull durability:** (a) armor 200 + hp pool ≈ 3 tanks (shrugs small arms, dies to massed shells) · (b) armor 140 (tank-equal) + big hp (numbers superiority kills it) · (c) armored but with a weak rear arc via glancing obliquity (pure geometry, most diegetic).

### Task 2 — spawn + drive
`DepotGame.jsx`: purchase spawns the hull at the depot pad; player input → `world.control.{throttle,steer,brake}` (core's `stepDrive` already routes bisonId — zero core changes). Touch stick + keys, matching sandbox drive feel. Territory: hull joins the green emitter list (EMIT entry ≈ structure-grade). Fog: hull projects vision like a squad.

**FORK 3 — mount/dismount:** (a) permanent — bought means driven every wave until it dies (purest all-in) · (b) mount/dismount at stalls only (stall = the decision point; multiplayer-clean) · (c) dismount anywhere, hull parks and goes dormant (guards nothing, tempting bait).

### Task 3 — drive-or-build exclusivity + camera
While mounted: build bar locked, squad orders locked, strikes locked (driving IS the wave action — Jeff's law). Stall behavior per FORK 3. Camera handoff on mount; return on dismount/death.

**FORK 4 — camera:** (a) low chase cam behind the hull (sandbox feel, biggest handoff) · (b) tactical camera follows the hull, zoom clamped tighter (RA look preserved, cheapest — renderer already texel-snaps a moving focus) · (c) (b) now, (a) as a feel toggle later.

### Task 4 — weapons through the shared model
Main gun + coax MG on driver taps: reuse `bisonFire`/`bisonMg` shot shapes but route through `shooterFire` + `applyScatter` (2-draw contract; windF/windComp like any shooter; owner threaded — self-hit asserts vs own hull). Player-aimed = scatter applies to the aim point, no aimbot.

**FORK 5 — fire control:** (a) tap-to-lay main gun with real reload (5-8s), MG hosed on hold (pure manual) · (b) MG auto-engages nearest fog-legal unit while driving; main gun manual (drive-focused) · (c) both manual, but a stationary hull tightens scatter (physics reward for firing halted).

### Task 5 — the enemy's answer + intel
No AI bison (locked). The attacker answers with doctrine: `ai.js` counter-weights shift to AT assets (tanks/grenadiers) when `snap.bison` is live; `intel.js` — but ALSO the mirror question:

**FORK 6 — symmetric availability:** (a) attacker CANNOT buy one until Phase 8 attack mode (player-driven only, both directions — nothing to build now) · (b) attacker banks toward one and, if bought, it arrives as a scripted breakthrough vehicle driven by `aiDrive` (violates "no AI bison" — listed for completeness, lean NO) · (c) (a) + intel foreshadowing lines that THEIR ledger shows heavy-vehicle appropriations (fiction now, Phase 8 truth).

New intel family (digit-free): purchase warning to the ATTACKER side is moot until Phase 8; player-facing lines cover their AT re-weighting ("Anti-armor stores moving forward by night.").

### Task 6 — death, wreck, salvage
Hull death: existing kill machinery (glancing/armor; crush law core.js:1628 already attributes the bison). Wreck stays as a physical carcass (cover! — it's a big chunk-adjacent body).

**FORK 7 — the salvage prize** (Stage B salvage system doesn't exist yet): (a) enemy recovers a flat huge bounty on the kill (uncapped-results-consistent, cheap now) · (b) wreck becomes a scrap-pile OBJECT enemies must reach and tick down (first real salvage mechanic, foreshadows Stage B) · (c) (a) now with the wreck-object deferred to the salvage phase, noted in vision.

### Task 7 — closer
Sweep asserts (scaffold-filter family for the player vehicle); twin determinism of a no-drive run (mounted runs are excluded from twin fixtures — documented); wave-timeout interaction (a live bison must not block withdrawal accounting); economy probe with bison-buy strategy (trap-vs-dominant check per vision); full scoped verify + smoke DRIVE section (mount → drive a lap → fire both weapons → dismount/stall) + phone screenshots; batch push, foreground CI poll, prod smoke.

## Open questions for Jeff (beyond the forks)
1. Wind on the main gun: full windF like mortars (high-arc shells eat wind) — assumed yes, confirm.
2. Does the mounted player still ACKNOWLEDGE dispatches at stalls (assumed yes — stall flow unchanged)?
3. Save/resume (if approved): is a mid-run mounted state save-legal, or does save force dismount-at-stall (FORK 3b makes this free)?
