# SLOW FRONT — Phase 1.5: Polish I

*2026-08-12 — third phase under Vision II, executing Playtest I's directives (all Jeff-ratified). Phase mark **mk0.50**; four tasks, +0.01 each, dispatched sequentially (sole agent in the tree). The bullet outline of this phase was reviewed by Jeff before writing.*

---

# PART ONE — What this phase does (plain language)

Everything you asked for after playing mk0.43, in four deploys.

**Task 1 — The tuning batch (mk0.50).** The bell rings every **90 seconds**. Squads hold a **tighter formation** (about 1.5m instead of 2.4). Units and towers cost **about half again more** — an interim raise until the mercenary market does this properly. One honesty note: this raises *your* prices while the enemy's internal buying prices stay put — a knowing, temporary break in strict cost symmetry that the market will repair; if the enemy suddenly feels rich, this is why. The intel card **stops popping up** (the report still exists behind the bell chip). The **first manifest explains itself** — one line about picking reinforcements, first truck only. Squads **can no longer be ordered off the map** — destination taps clamp to the playable field. And the task verifies on an emulated phone whether the 30fps toggle is perceptibly doing anything, with a keep-or-remove recommendation.

**Task 2 — The masonry look (mk0.51).** Walls become a visible **stack of three welded cubes** — real courses that break one at a time, and when a lower course is shot out, the ones above come down for real. Sandbags become a **single cube**. Both show their **weld seams** so construction reads at a glance. Body-count implications are checked against the perf baseline before it ships.

**Task 3 — The weapon voices (mk0.56).** *(mark shifted: Task 2's look iterations consumed mk0.52-0.55)* The bell becomes a single deep **BONGGG**. The sniper rifle a dry **crack** whose echo grows with the distance the shot traveled. The MG a proper **ratatata**. Rifles sit pitched above the sniper. Under the hood, every shot now carries which weapon fired it — today they all sound alike because the sounds literally can't tell them apart.

**Task 4 — The engineers arrive (mk0.60).** *(Redesigned 2026-08-12 after discussion with Jeff; supersedes the walk-and-drop version. Depot evening/placement work is HELD for The Front phase — none of it ships here.)* Every match now starts with **rifles and an engineer team**, and a few sandbags already seeded around the depot. Engineers take a **two-point BUILD order**: tap where the line starts, tap where it ends, and the squad walks to the start and lays **end-to-end along the line** to the end, then digs in there. The whole line takes ONE rotation — the closest logical rotation to the line's overall direction — so straight north-south or east-west lines lay perfectly end-to-end, and most lines are expected to be drawn that way. An off-axis line keeps that single rotation the whole way (the engine's boxes can't sit at an angle — real rotation waits for a phase that needs it broadly), so its pieces form short parallel offset runs where the path sidesteps. Engineers lay **bags or walls**: field bags cost 3 (menu 5), field walls cost 5 (menu 8) but the squad pauses at each wall — a wall line under fire is a commitment. Scrap runs dry: they stop laying and keep walking. Repair and bridges stay in their full phase later.

**What you do:** approve; then playtest the batch — the 90-second rhythm, formation feel, prices, the wall/sandbag look, all four sounds, and an engineer line built under fire. Every number is a one-line change for your verdicts.

**Order:** 1 → 2 → 3 → 4, sequential, each CI-green before the next.

---

# PART TWO — Task briefs (for agents)

*Dispatch: Opus 5, sequential, sole agent. Read-confirmations open every report. Verification law: load checks + kept gates only (esbuild parse, build, lint:depot, test:depot with honest re-pins, SMOKE_ONLY=depot). Every task bumps `src/version.js` +0.01. Seeded-rng law and draw-count stability apply everywhere; `src/depot/squads.js`'s module-purity and one-draw-per-leg contracts are load-bearing.*

## Task 1 — Tuning batch (mk0.50)

1. `BELL_PERIOD_S` 120 → 90 (`src/depot/state.js`; comment stays provisional-F5).
2. Formation: `slotFor`'s ring radius 2.4 → 1.5 (`src/depot/squads.js:353-358`) — a pure constant; touch nothing else in the file.
3. Costs +~50%, integers, all marked provisional (interim until the mercenary market): `SQUAD_SPECS` (`squads.js:17-31`) sniper 45→68, rifles 20→30, mg 25→38, sappers 25→38, mortars 30→45; `TOWER_SPECS` (`specs.js`) mg 15→23, gun 25→38, mortar 35→53, rocket 50→75, frost 20→30; `WALL_COST` 5→8 (`state.js`); `SANDBAG_COST` 3→5 (`state.js`). Do NOT touch enemy bounties/budgets — the asymmetry is knowing and interim (documented in Part One); note it in a comment beside the raised costs.
4. Intel card: stop auto-raising at the bell (the `fireBell`/card wiring from P1 T2); keep composing every bell and keep the bell-chip re-read path. The manifest card still auto-raises.
5. First-manifest teaching line: bell 1's manifest card carries one extra line ("Pick one reinforcement — the convoy returns each bell."); bells ≥2 don't. Deterministic (bell index), no storage.
6. Off-map clamp: ATTACK/MOVE destination taps clamp into the playable rim before becoming `squad.dest` — clamp in canonical (u,v) space against the rim half-extents (the same extents `world.inRim` uses), then transform back. Find where the ground tap becomes a dest (`DepotGame.jsx` order-flow region) and clamp there — one site, not scattered.
7. 30fps device check (verification work, no product change): headless run with touch emulation + `?perf=1`, count `R.render` executions over a fixed frame window with fps30 on vs off (the probe's ring buffer or a render counter — read the probe first). Report: does the gate halve draws on the touch path; a perceptibility judgment; keep-or-remove recommendation for Jeff. Do not remove anything this task.

**Reading list:** this plan both parts; `src/depot/state.js` (constants + fireBell card wiring); `src/depot/squads.js:1-60` (module laws) + `:353-358`; `src/depot/specs.js`; `src/depot/DepotGame.jsx` order-flow region (dest taps) + the manifest/intel card code from P1 T2 (git show f5c8cd6) + the perf probe (git show 0de7976); `scripts/depot-test.mjs` — grep for pins on ANY of the changed constants (costs, period, radius) and re-pin honestly, old→new in the report.

**Traps:** `validatePlacement`/afford asserts may pin old costs; the P1 T2 manifest asserts may pin card behavior at the bell (intel card no longer raising must not break the "cards don't gate the muster" assert — read it). The formation constant also shapes defend micro-slots — visual check via one staged screenshot (internal sanity).

## Task 2 — Masonry look (mk0.51)

**Walls** (read the actual `buildAt` wall path in `DepotGame.jsx` + how kind-"wall" bodies are built/rendered before designing — the brief below is intent, the code is truth):
- A built wall becomes THREE stacked bodies (courses) of kind "wall", each ~1/3 the current height, welded vertically (weld breakF tuned so shells can shear a course — start from `MASON.breakF` and reason, don't guess wildly; document the chosen value).
- Each course carries its own hp (split the current wall hp across courses; a course dies independently).
- **Support rule:** when a course dies, any course above it with no living course below converts to a dynamic mass-100 chunk (wakes, falls, becomes rubble) — walls collapse honestly. Implement as a small game-layer pass (the depot layer owns it; core untouched).
- Renderer: courses render through the existing wall instancing; the **seams come free from the outline post-pass** once the courses are separate boxes with a slight inset (scale each course ~0.96 so the outline reads between them). The snow cap rides the top living course.
- Targeting/filters: verify every `kind === "wall"` consumer (hostileStructure, breaker ram, enemy structure fire, placement occupancy, sell/refund if any) treats three courses sanely — the grid cell owns all three; selling/refunding removes all; enemy fire naturally hits the course its arc hits.
**Sandbags:** single cube look — adjust `spawnSandbag` dims to read as one bag-cube (keep the orient/auto-continue machinery); same inset/outline seam treatment.
**Budget:** walls go 1 body → 3 sleeping bodies. Report the count delta for a typical fortified run against CHUNK/body budgets and the C0 baseline's sim numbers; if a heavy build order pushes past ~1.5k extra bodies, say so loudly.

**Reading list:** this plan; `DepotGame.jsx` buildAt/sell/occupancy region; `src/depot/state.js` WALL_COST/validatePlacement + hostileStructure; `src/depot/units.js` stepBreakerRam + structure-fire target filters; `src/render/renderer.js` wall/wallCap instancing (`:1057-1059`, `:1332-1342`) and the outline pass (context); `src/depot/save.js` (course bodies + welds must round-trip — welds of statics serialize like any weld; verify); `scripts/depot-test.mjjs` — wall pins (hp, single-body assumptions) re-pinned honestly.

**Traps:** static-static welds are solver-inert (fine — they're the census/seam semantics, not physics springs); the support rule is the real collapse mechanism. Save round-trip: build a wall, save, resume, verify three courses + welds + a half-dead wall restores (staging, not a test). The boot smoke must stay green.

## Task 3 — Weapon voices (mk0.56)

1. **Weapon identity plumbing:** every fire spec gains a `weapon` tag ("rifle" | "mg" | "sniper" | "mortar" | "rocket" | "shell" | "tank" …) — `INFANTRY_ARMS`, `TOWER_SPECS`, `ENEMY_FIRE`, `SNIPER_FIRE`. `shooterFire` passes it into the projectile spec; the muzzle event carries it. The muzzle event is pushed by core's `fireProjectile` — an **additive guarded divergence**: the event gains `weapon: spec.weapon` (undefined for demo specs — byte-identical events there; events are unhashed; golden must stay green and you run it).
2. **Voices** (`src/platform/audio.js`, the module's idiom — humanize, attack ramps, voice cap):
   - Bell rework: ONE deep strike — fundamental down (~94Hz hum region), single hit, longer darker tail; drop the second strike. "BONGGG."
   - `sniper`: a dry crack (highpass snap + short body), with echo taps whose gain/wet scale UP with `dist(x,z)` — near shots are bare cracks, far shots ring off the map (the `echoes()` machinery + `att()` distance model are the tools; invert the usual attenuation for the echo component and cap it).
   - `mg`: burst voice — the coalescing already merges a 6-round burst into one event stream; give it a rapid multi-tap "ratatata" (repeated short noise hits at the burst cadence), not a single fat shot.
   - `rifle`: the existing infantry shot voice pitched noticeably ABOVE the sniper's crack; keep it light.
   - Dispatch on `e.weapon` first, fall back to `e.kind` (demo/campaign keep exactly their current sounds — no weapon tag, no change).
3. No new depot-side draws; audio's internal `Math.random` humanize is its own law.

**Reading list:** this plan; `src/platform/audio.js` whole (vocabulary + MUZZLE + coalescing + echoes/att); `src/engine/core.js:416-425` (fireProjectile's muzzle event — the divergence site; read the surrounding divergence-comment idiom and match it); `src/depot/state.js` shooterFire; `src/depot/specs.js` + `src/depot/units.js` SNIPER_FIRE; `scripts/golden.mjs` (you run it and it must pass).

**Traps:** the muzzle-coalescing groups by `e.kind` today (`audio.js:248-277`, key built at `:256`) — it must group by weapon now or a sniper crack merges into rifle chatter; keep group keys count-stable. Nobody will have heard these — flag that Jeff's ear is the acceptance, same as P1 T4.

## Task 4 — Engineers, two-point build (mk0.60)

*(Redesign of record, 2026-08-12: two-point lines, bags AND walls, end-to-end auto-rotation, dig-in at end, discounted field walls. Depot symmetrization/placement REMOVED — all depot geometry work is held for The Front phase, Jeff's call.)*

1. `SQUAD_SPECS.engineers` (`squads.js`): n 2, cost ~30 (provisional), label "ENGINEER TEAM". They never fire (`squadFire` skips like sappers — tools, not shooters).
2. **Starting kit:** P1 T2's START set gains `sq_engineers`; the spawn/menu UI shows it from bell 0.
3. **Two-point BUILD order** — game-layer machinery (economy stays OUT of squads.js per its module law):
   - Engineer squads get BUILD BAGS and BUILD WALLS chips beside DEFEND/ATTACK/MOVE (engineer squads only; other squads must not see them). Arming one starts a TWO-tap flow: first ground tap = line start, second = line end (both rim-clamped via Task 1's clamp). Ride the existing tap-arming idiom (PENDING_ARM_S); a re-tap of the chip before the second point cancels cleanly.
   - Under order "build": squads.js only knows "build" moves like "move" (quiet legs, threat read forced false — reuse the mk0.28 move semantics in `stepSquad`, don't fork them). The squad travels to the START point, then advances along the start→end line; on arrival at the END it flips to defend as MOVE does — dig in behind the fresh line (Jeff-ratified).
   - **Line rasterization is the game layer's** (in `stepDepot`): walk the start→end segment through grid cells. Each cell along the run gets its piece placed when the squad's anchor has advanced past it. **Orientation: ONE rotation for the ENTIRE line** — the closest logical rotation to the overall start→end direction (dominant axis), computed once at order time and passed to every spawn call; per-step direction is NOT consulted and `sandbagOrientAt`/`wallOrientAt` auto-continue must NOT override it (Jeff's correction of record, 2026-08-12 — the earlier per-step "staircase" text was a transcription error). Off-axis lines form parallel offset runs at the sidesteps — accepted. END-TO-END is the goal on axis-aligned lines: consecutive bags in a straight run must touch, per the bag's long axis vs the grid pitch — read the actual cell size and bag dims and reconcile; report the geometry you land on.
   - **Costs:** field bags `SANDBAG_FIELD_COST = 3` (menu 5); field walls `WALL_FIELD_COST = 5` (menu 8, discount ratified by Jeff). Walls get a lay pause (~1.5s per wall, provisional constant) — the squad halts at each wall course-spawn; bags go down at walking pace. Placement uses the real spawners (`spawnSandbag` / `spawnWallCourses`) and the real occupancy checks (`validatePlacement`-family — a cell already occupied is SKIPPED, not double-filled). Scrap dry: stop placing, keep walking, still dig in at the end.
   - No rng anywhere in this machinery; distance-accumulator on the anchor, deterministic.
4. **Seeded depot sandbags:** at map build, ~4-6 bags ringed around the player depot at seeded positions using the MAP-SEED rng stream (`genMap`'s `r()` pattern — NOT `world.rng`; keep world-stream draw counts untouched), vetted by `clearSlot`-style clearance against the depot footprint and roads.
5. Save: verify the "build" order + engineer squads + a half-laid line round-trip through save/resume (the serializer is generic over squads — verify, don't assume; the line/accumulator state must serialize or reset harmlessly — pick reset-on-resume and document).
6. **Roadmap update at completion:** `src/ui/Roadmap.jsx`'s phase array (shipped mk0.59) — update the Polish I entry's description to reflect engineers shipped ("Playtest fixes: tuning, wall masonry, weapon voices, soundboard, engineers. Awaiting the phase playtest."); status stays IN PROGRESS (the phase closes on Jeff's playtest, not on this task).

**Reading list:** this plan; `src/depot/squads.js` whole (module laws, stepSquad's move/attack machine, SQUAD_SPECS); `src/depot/state.js` (spawnSquadMembers, spawnSandbag, sandbagOrientAt, spawnWallCourses, wallOrientAt, SANDBAG_COST, WALL_COST, validatePlacement); `src/depot/orient.js` (clampToRimFor); `src/depot/DepotGame.jsx` — squad chips/order flow, stepDepot, buildAt/placeSandbagAt (grid pitch + occupancy truth), genMap/buildDepotTerrain (seeding site), P1 T2's menu filtering; `src/depot/save.js` (squad serialization); `src/ui/Roadmap.jsx` (the phase array, item 6); `scripts/depot-test.mjs` — squad-roster and menu pins re-pinned honestly.

**Traps:** squads.js draw-count law — "build" must ride the existing unthreatened-move path (which already draws once per leg unconditionally); adding zero draws means the leg draw still happens — that's FINE (it's the existing contract), just don't add more. The chip row is per-squad-type — non-engineer squads must not see the BUILD chips. The two-tap flow must not fight canvasTapConsumesPending/the pending-arm machinery — read it before wiring. Walls are 3 static courses per cell (mk0.55 masonry) — a "wall" placement = one spawnWallCourses call, one cost, one pause. Boot smoke green; one staged screenshot of an off-axis laid line (internal sanity — uniform rotation with offset runs must read as a line, not scatter).

## Sequencing & close

1 → 2 → 3 → 4, sole agent each, CI-green + prod-verified between. Phase closes on Jeff's playtest: rhythm at 90s, formations, prices, the wall/sandbag look and collapse, all four voices, an engineer line built under fire, plus the 30fps keep-or-remove verdict from Task 1's evidence.
