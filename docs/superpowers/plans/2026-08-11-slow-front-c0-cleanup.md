# SLOW FRONT — Phase C0: Cleanup

*2026-08-11 — first phase under Vision II (`2026-08-11-winter-front-vision-2-slow-front.md`). Phase mark **mk0.30**; each task bumps +0.01. Every decision herein was ratified by Jeff on 2026-08-11; the one mid-phase decision point (the test manifest) is explicitly his gate.*

---

# PART ONE — What this phase does (plain language)

This phase cleans the ground and hands you a pace preview. Nothing new gets designed here — it executes decisions you already made.

**Task 1 — The test census (mk0.30).** An agent reads every test script we have (12,340 lines of them) and writes a one-page table: what each test checks, how long it takes, and a keep-or-delete recommendation under your rules — tests only prove things *load*; scripted play-throughs go. **You review this table before anything is deleted.** I'll send it to you rendered, like this plan.

**Task 2 — The purge (mk0.31).** Whatever the reviewed table says, happens: deleted tests removed from the suite and from the deploy pipeline, and a simple load-check put in place for every game surface (each mode starts, shows its version, no errors). CI gets minutes faster and stops crying wolf.

**Task 3 — Squads stop freezing (mk0.32).** The bug where one man wedged in rubble halts his whole squad forever: fixed the way you chose — the squad waits a few seconds, then moves on without him. He rejoins if he gets free.

**Task 4 — The pace preview (mk0.33).** The changes you can feel, all in one deploy: mortars and rockets fire **half as often** on both sides; every fallen soldier leaves a **permanent red smear** in the snow (the enemy marksmen included, now dressed as ordinary men, not silver androids).

**Task 5 — 30 frames per second on phones (mk0.34).** Phones and tablets draw at 30fps by default — the physics is untouched, only the drawing rate changes — with a menu switch to go back to 60. Desktop stays at 60.

**Task 6 — The stopwatch (mk0.35).** A measurement run on the Pi: where each frame's time actually goes (physics vs. drawing), at 60 and at 30, quiet and mid-battle. No opinions — numbers. These numbers are what the map-widening phase will be planned against.

**What you do:** review the test table after Task 1; then, when the phase deploys, playtest and confirm — the slower artillery feel, the smears, the marksman look, the 30fps feel, and that squads no longer freeze mid-advance. Your earlier outstanding confirmations (sappers, sandbags, troop identity, the new MOVE/ATTACK orders) can ride the same session.

**Order:** Task 1 → your review → Task 2 → Tasks 3, 4, 5 (parallel) → Task 6 → your playtest.

---

# PART TWO — Task briefs (for agents)

*Dispatch: Opus 5 (`model: "opus"`), one agent per task. Every agent's report must open by confirming each file on its reading list was read. Verification per the standing law: relevant kept gates + load checks only — no scripted-gameplay verification anywhere in this phase. Every task bumps `src/version.js` (+0.01) in its commit.*

## Task 1 — Test manifest (mk0.30, no game code)

**Deliverable:** `docs/superpowers/test-manifest.md` — one table row per script (and per independently-runnable section of `smoke.mjs`/`depot-test.mjs`): file/section · what it asserts · approx lines · approx runtime · where it runs (CI / local / orphan) · verdict recommendation (KEEP / TRIM / PRUNE) · one-line rationale.

**Verdict law to apply (Jeff's rules, verbatim intent):**
- Automated tests assert that things **load** (mount, version visible, no console errors) — scripted play-throughs/bot-completions are PRUNE by default.
- KEEP: `golden.mjs` (frozen-demo byte law), `depot-lint.mjs` (seeded-rng law), and cheap headless *invariant* gates where they pin engine/data contracts rather than play (recommend per-gate, Jeff decides).
- Campaign/sandbox/mech suites: this era doesn't touch those modes — flag which tests exist only to re-verify untouched surfaces.
- The flaky `rotated-advance` and `fire-discipline-reload` smoke sections: PRUNE (autopsy closed 2026-08-11; root causes documented in project memory — the gameplay bug they exposed is fixed separately in Task 3).

**Reading list:** `package.json` (scripts), `.github/workflows/deploy.yml`, directory listing of `scripts/`, the header comment + assert inventory of every `scripts/*.mjs` (skim bodies, read headers fully), `scripts/_diag-rotflake.mjs` (untracked — list it as orphan). Do not read `src/` beyond what a header forces.

**Trap notes:** runtimes may be documented in headers or memory (browser suite ~5-8 min total on the Pi) — estimate, don't run the full suite to time it. This task deletes nothing.

**Gate after this task:** the manifest goes to Jeff rendered; Task 2 blocks on his returned verdicts.

## Task 2 — Execute the purge (mk0.31)

**Scope:** apply Jeff's verdicts exactly. Delete PRUNE files/sections; trim TRIM ones; update `package.json` scripts and `deploy.yml` so CI runs precisely the kept set; ensure a **boot-load smoke** exists covering every surface (start screen, demo, contract sandbox, campaign, WINTER FRONT, mech range: page mounts, mode enters, version string present, zero console errors — nothing more). Delete `scripts/_diag-rotflake.mjs` (autopsy closed).

**Reading list:** the approved `test-manifest.md`, `package.json`, `deploy.yml`, `scripts/smoke.mjs` (structure: section selection via `SMOKE_ONLY`), each file being deleted (confirm no kept script imports from it).

**Trap notes:** `smoke.mjs` sections share helpers (e.g. `seedMission`) — pruning sections must not orphan helpers kept sections use. CI must still gate deploy on the kept set passing. **Verification:** run the new boot-load smoke + `golden` + `depot-lint` locally; green = done.

## Task 3 — Cohesion time-cap (mk0.32)

**Change (Jeff-ratified design):** in `src/depot/squads.js`, the attack/move leg machine — when `trail > COHESION_M` holds the anchor (`squads.js:529-537`), accumulate a per-leg hold timer (`squad._cohesionHoldT += dt`); once it exceeds **`COHESION_CAP_S = 4`** (exported constant, comment: covers a legitimate 6m catch-up at MOVE_SPEED 3.2 twice over), the anchor advances regardless for the remainder of that leg. Reset the timer at every leg boundary (`_legTarget` assignment). Stuck members keep seeking their slots and rejoin naturally.

**Hard contracts:** zero new rng draws; the one-draw-per-leg dwell contract (`squads.js:511-520`) untouched; draw-count identical for capped vs. uncapped runs of equal legs.

**Reading list:** `src/depot/squads.js` (whole file, 594 lines), the flake-autopsy summary in project memory (Mode A: detour-fan oscillation in concave pockets; `slotBlocked` ignores `invM>0` rubble — do **not** fix that here, it's out of scope), `src/depot/state.js:274-340` (squadFire's stationary gate — confirm the cap doesn't change firing eligibility semantics).

**Verification:** boot-load smoke + `depot-lint`. No new test (load-only law); the fix's field proof is Jeff's playtest.

## Task 4 — Pace & identity bundle (mk0.33)

Four changes, one deploy:

1. **Artillery cadence halved** in `src/depot/specs.js`: `TOWER_SPECS.mortar.fireRate 2.3 → 4.6`; `TOWER_SPECS.rocket.fireRate 4.4 → 8.8`; `INFANTRY_ARMS.mortars.fireRate 3.0 → 6.0`; `ENEMY_FIRE.lob.cd 3.0 → 6.0` (symmetry law — Jeff-ratified). Update adjacent comments. If any *kept* gate pins these numbers or DPS baselines (check the post-purge `depot-test.mjs`), re-measure and re-pin honestly — never tune the spec to the assert.
2. **Smears on**: set `u.smearStyle = "human"` at every infantry spawn — `spawnSquadMembers` (`src/depot/state.js:349-372`, all types) and `spawnUnit` (`src/depot/units.js:23-55`, all tags including the marksman **and** his spotter). Vehicles/tanks: no smear (renderer smears are infantry marks).
3. **Marksman re-dress**: delete `dress: "android"` from `ENEMY_SPECS.sniper` (`src/depot/specs.js:35`) — the spotter copies dress from the same spec (`units.js:49`), so one deletion covers the pair; troopkit then palettes them slate-by-team automatically. Grep post-purge tests for pins on marksman dress.
4. **Permanent smears**: in `src/render/renderer.js` `makeSplat`, keep a ledger of smear draws (`{u, v, style, wx, wz}` pushed in `smear()`); extract the paint body into an internal `paintSmear()` used by both `smear()` and a replay loop at the end of `fade()`, so the DEPOT decal-fade re-blend (`fade()`, armed via `opts.fadeDecals`) never greys them. The replay must not re-increment the `smears` counter. Ledger unbounded (permanent means permanent); repaint cost is per-fade-tick (every 4s), not per frame.

**Reading list:** `src/depot/specs.js` (whole, 142 lines), `src/depot/state.js:340-412`, `src/depot/units.js:22-86`, `src/render/renderer.js:26-206` (makeSplat) + `:940-971` (consume kill branch) + `:322-332` (fade arming), `src/render/troopkit.js:120-149` (dress → palette path), post-purge `scripts/depot-test.mjs` (pin check).

**Trap notes:** `smear()` is deterministic from `(wx, wz)` — the replay must reuse stored values, not re-derive. The jsdom e2e canvas stub is fillRect-only — `paintSmear` already complies; keep it so. `makeSplat` is shared by every mode: the ledger is inert where `fade()` is never armed (TD/campaign/demo unchanged); renderer output is unhashed, golden unaffected. **Verification:** boot-load smoke + `depot-lint` + any kept depot gates touching specs.

## Task 5 — 30fps touch default (mk0.34)

**Change:** in `src/depot/DepotGame.jsx`'s rAF loop — every rAF still samples input and steps the sim accumulator (dt/stepping semantics untouched, `dt = 1/120`); when `fps30` is on, `R.render(...)` and label-layer updates run on alternate frames only. Default: on when `detectTouch()` (import from `../ui/theme.js`), off on desktop. A menu entry ("FPS 30/60") toggles it; persist under a depot storage key (`window.storage`, follow the existing settings-restore pattern — change-gated save, restore before first toggle render, defaults never clobber a save).

**Reading list:** `src/depot/DepotGame.jsx` loop + menu regions (agent locates via the `☰`/menu construction and the rAF `loop()`), `src/game/ContractSandbox.jsx:493-560` (the accumulator-loop precedent), `src/platform/autosave.js` (persistence pattern), `src/ui/theme.js:39-44` (detectTouch).

**Trap notes:** HUD state already updates on its own 0.2s cadence — don't double-throttle it. The step cap (touch 5) is per-rAF and unaffected by render skipping. Never skip `R.consume(evs)` — event-driven audio/particles must not drop events on skipped frames (consume every frame, render alternate). **Verification:** boot-load smoke; both toggle states reach a running game.

## Task 6 — Pi perf baseline (mk0.35)

**Deliverable:** a numbers report (served to Jeff + recorded in the plan directory as `2026-08-11-c0-perf-baseline.md`): sim-step vs render-pass vs other, per frame, on the Pi — measured in real Chromium (not swiftshader-headless), at 60 and 30fps, in (a) early-game quiet and (b) a heavy mid-fight (staged via existing debug/console APIs — this is a measurement run, not a test; it lives outside CI). Include chunk counts, body counts, and worst-case frame spike during a building collapse.

**Instrumentation:** a minimal, permanent, flag-gated probe — `?perf=1` query param makes the DEPOT loop record `performance.now()` brackets around `stepWorld` and `R.render` into a `window.__DEPOTPERF__` ring buffer. No overhead when the flag is absent. The measurement script (`scripts/diag-perf.mjs`, marked diag — excluded from CI by name convention established in the manifest) drives the browser and dumps the buffer.

**Reading list:** `src/depot/DepotGame.jsx` (loop), `src/render/renderer.js:1251-1885` (render passes — know what's being timed), the test-manifest doc (diag naming convention), one prior probe script for the puppeteer-on-Pi pattern (agent picks from the kept set).

**Trap notes:** swiftshader numbers are fiction for GPU cost — headful Chromium on the Pi or nothing; if headful is unavailable in the session, report that plainly rather than substituting swiftshader. Sim time is wall-clock honest either way.

## Sequencing & dispatch

Task 1 → **Jeff gate (manifest review)** → Task 2 → Tasks 3/4/5 in parallel (disjoint files except `version.js` — serialize the bump commits) → Task 6 → deploy-verified → **Jeff playtest** (artillery pace, smears, marksman dress, 30fps feel, no squad freeze + the outstanding sapper/sandbag/troop-identity/MOVE-order confirmations). Phase closes on his confirmations, logged in project memory.
