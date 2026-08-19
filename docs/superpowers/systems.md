# COLDSNAP — Systems Reference

*Stamped mk1.52, 2026-08-18. One entry per system: what it does, where it lives, what it exports, and the traps an agent editing near it must know. Dispatch reading lists are drawn from this document; anchors are re-verified against live code at every dispatch (the standing law), and the whole document is re-stamped at each phase close. Line anchors below were verified live at the stamp mark.*

*The war's standing laws, for orientation: the demo file is byte-frozen; engine changes are guarded additive divergences with golden green; no unseeded randomness in `src/depot` (depot-lint gates it); draw counts are contracts; every dial marked `// provisional (F5)` is tuned by the owner's play, never treated as final.*

---

## The engine — `src/engine/core.js` (2,480 lines)

Extracted verbatim from the byte-frozen demo (`src/demo/coldsnap-proving-grounds.jsx`); every behavior change is either byte-identical to the demo or a guarded divergence behind a flag no demo/campaign/TD world sets (`world.depotCombat`, `world.mechs`, `b.mechRef`, …). ~20 inline DIVERGENCE comments mark the sanctioned ones. `scripts/golden.mjs` re-extracts the demo's physics at test time and asserts hash parity.

### Dice (mulberry32)
- **What:** the one seeded random source; draw order is part of determinism.
- **Where:** `mulberry32` :13; consumed via `world.rng()` (set in `makeWorld` :395) at `fireVolley` :458, `explode` torque :567, `grenFire` :984, unit gren timing :1057, `bisonMg` :2459.
- **Exports:** `mulberry32`.
- **Traps:** adding, removing, or reordering ONE `world.rng()` call in a shared path changes every downstream draw and fails golden. `src/depot` additionally bans `Math.random` outright.

### World and bodies
- **What:** the world container (bodies, welds, projectiles, contacts, caches) and body construction.
- **Where:** `makeWorld` :389, `makeBody` :160, `addBody` :403, `addWeld` :404, `wakeIsland` :422.
- **Exports:** `makeWorld, makeBody, addBody, addWeld, CAUSE`.
- **Traps:** `b.seq` is a world-local sequence (distinct from module-global id) keeping parity-keyed logic deterministic across rebuilds. Weld mutation outside `addWeld`/`weldBreakPass` must maintain `world.weldsOf` and `_weldPairsDirty` or welded pairs double-solve.

### The heightfield
- **What:** bilinear terrain with crater carve.
- **Where:** `makeField` :114 (`heightAt` :120, `carve` :135); consumed by `terrainContacts` :367.
- **Exports:** `makeField`.
- **Traps:** `carve` sets `F.dirty` for the RENDERER only — physics reads the field live. Height floor −1.5.

### The step
- **What:** the fixed 1/120s tick: drive → units → integrate → contacts → solve → weld break → positions → projectiles → impacts → status → sleep.
- **Where:** `stepWorld` :1965.
- **Exports:** `stepWorld`.
- **Traps:** solver iterations are load-tiered (>900 → 4, >450 → 7, else 12, :1992); the mech island solves separately after (guarded). Sleeping bodies skip the rotation refresh — waking needs `sleeping = false`, not just a velocity.

### The two-tier collision books (mk1.05)
- **What:** broadphase split into a filed-once static tier (sleeping/zero-mass) and a per-step dynamic tier, merged in `seq` order so the contact sequence is byte-identical to the old one-tier grid.
- **Where:** `collectContacts` :1372–1507; `satBoxBox` :205 is the narrowphase.
- **Traps:** golden-guarded structure. `wakeExempt` (:1431, depotCombat only): a sleeping weld-attached chunk ignores contact-wake from sub-200kg movers — infantry cannot knock masonry over.

### Welds
- **What:** rigid constraints with stress accumulation and break thresholds.
- **Where:** `solveWelds` :1615, `weldBreakPass` :1669.
- **Exports:** `addWeld, weldStressDecay`.
- **Traps:** the 6mm position deadband (:1642) stops limit-cycling — removing it breaks sleep convergence. Ice uses its own shock/creep constants (:1231), not `breakF`.

### Shells, blasts, damage
- **What:** ballistic projectiles, the area blast with occlusion, HP/armor resolution.
- **Where:** `fireProjectile` :432, `explode` :489, `stepProjectiles` :684, `applyDamage` :817, `killBody` :838.
- **Exports:** `fireProjectile, fireVolley, explode, applyDamage, CAUSE`.
- **Traps:** blast impulse diverges (guarded) above a 600kg mass knee; below it, byte-identical to the demo. Under depotCombat, sub-armor ballistic hits do 15%; blast bypasses armor.

### Impact classification
- **What:** turns high-impulse contacts into CRUSH/COLLAPSE/IMPACT kills.
- **Where:** `classifyImpacts` :1705.
- **Traps:** thresholds are load-bearing tuning: vehicle crush `pn > 60` from above (:1734); falling-chunk collapse `dv > 2.2` (:1755); bare-terrain fall `dv > 6.5` units / `11` vehicles with `airT > 0.22` (:1749). `inertStone` (:1723, depotCombat) makes a sleeping chunk non-lethal — the mk1.11 law.

### Infantry protections
- **What:** kinematic uprighting and the ledge brake — a walking man plants at a lethal drop.
- **Where:** inside `stepUnits` :999–1230; the brake :1043 (`> 1.15m` drop one stride ahead).
- **Traps:** the brake only covers grounded, upright, un-hit, self-propelled men — blasts still carry a man over an edge, by design.

### Hull drive
- **What:** tank drive (throttle/steer/traction) plus the AI goal-seek; `stepDrive` dispatches control per body.
- **Where:** `driveHull` :916, `aiDrive` :940, `stepDrive` :958.
- **Traps:** traction needs ground contact and hull-up `R[4]` (zero authority tipped past 0.25). The `depotCombat && b.depotDrive` branch (:968) is the mk1.30 guarded divergence: "auto" steers to a game-layer goal, "manual" reads game-layer `b.ctl` — the possession and crawl/back-out channel. Reverse throttle targets ×4.5.

### worldHash and the frozen boundary
- **What:** the parity hash (positions quantized ×512, order-dependent) golden compares.
- **Where:** `worldHash` :2014; the freeze header :1–10; `__mech__` (:2480) is mech.js's only sanctioned back door.
- **Traps:** body-array reordering breaks the hash even with identical physics. `src/engine/mech.js` exists for the mech track and hooks in via `world.mechStep`.

---

## The map frame — `src/depot/mapgen.js` (585 lines)

Born mk1.48, verbatim from DepotGame. Owns the canonical 180×180 square (rotated four ways), its generation, and its grids.

- **What:** generates and HOLDS the map — terrain, town plan, roads, stream, hills, spawns — plus the movement grid, flow field, and connectivity.
- **Where:** `genMap`/`makeMap` :41–300 (draw + retry), `buildDepotTerrain` :302, `makeGrid`/`computeFlowField`/`checkConnectivity` :409–585, `planTrees` :461, `streamAt`/`pondAt`/`rockAt` :405/443.
- **Exports:** the frame constants (`RIM_HALF_U/V` 90, `GRID_*` 90×90 at 2m), the orientation state and transforms (`ORIENT, fwdU, fwdDir, invW, clampToRim`), the live map data (`TOWN, STREAM, ROADS, PASSES, BANDS, HILLS, PONDS, ROCKS, SPAWN_POINTS, SPAWN_U, MAP_SEED, OBJ_POS`), and the functions above.
- **Traps:** the map data are LIVE-BOUND `export let`s — `makeMap`'s writes reach every importer; import the binding, never snapshot. `genMap`'s draw order/count is pinned by the suite. Grid cells carry: `blocked/terrain/water/ice/wallId/building/bTeam/bag/bagId/steep/drop` — the last four are P7 additions (team stamps; hull-only bag claims; terrain masks stamped once at build, craters never restamp). The flow field pays 3× to cross a cliff lip but never disconnects; `checkConnectivity` stays on the plain blocked-graph.

---

## The fresh-war boot — `src/depot/muster.js` (189 lines)

Born mk1.49, verbatim bodies with explicit parameters.

- **What:** parks the starting armor (flatness-vetted, asleep, fail-proof ring), seeds the depot bag rings, and runs the fresh start — home guard, commander draw, fielded squads.
- **Where:** `armorSpread/armorStable/parkArmor` :37–97, `seedBags` :106, `musterFreshStart` :147.
- **Exports:** all five.
- **Traps:** call order at the mount is the contract (bags → armor ×4 → … → musterFreshStart); `musterFreshStart` is fresh-boot only and its draw order is pinned (guard 24 → commander 1 → fielded 18; boot total 45 with makeRegiment's 2 and the save's reseed draw). The APC seat counter stays a mount let — parkArmor receives a `nextSeq` callback.

---

## The two-point build line — `src/depot/buildlines.js` (233 lines)

Born mk1.50, verbatim bodies with explicit parameters.

- **What:** turns two taps into a one-axis-per-step cell run, previews it as ghosts, and lays pieces (walls/bags/mines/wires) as the squad walks.
- **Where:** `lineCells` :48, `pieceHalf` :64, `startBuildLine` :72, `linePieces` :98, `layPieceAt` :123, `stepBuildLine` :185.
- **Exports:** all six.
- **Traps:** zero rng, by contract. `ctx` carries the mount's hands (`stampBag, recomputeFlow, objG, setMines`) — both the layer and the driver need it. The ghost must skip EXACTLY what laying skips or the preview lies. The engineer-reach gate (mk1.47): a row lays only with a live member within `LAY_REACH` 3m; the gate breaks the loop, never holds the anchor. Wall lays claim the cell first and refuse if they'd seal the map (connectivity check), then un-claim.

---

## The bell — `src/depot/bell.js` (164 lines)

Born mk1.51, one verbatim ring.

- **What:** the whole bell moment: town pay → fireBell's sequence → the defensive-opening split → the commander's armor orders → the ferry → the enemy hero buy-back → the enemy mine seeding → cues → the save.
- **Where:** `ringBell(world, grid, field, T, S, ctx)` :24–164, the single export.
- **Traps:** THE DRAW ORDER IS THE RING — fireBell's 4 (planWave), the ferry's unconditional 2, the sapper's unconditional 2, intel's variable draws, byte-fixed. `ctx` = `cue, toast, townUV, buildSnapshot, nextApcSeq, saveFront`. The bell's CARDS (ackIntel/openManifest/dismissManifest/pickManifest) deliberately live in the mount — presentation never rides the ring.

---

## The war's state and ledgers

### The bell clock and the assault machine — `src/depot/state.js` (1,535 lines)
- **What:** `stepBell`/`fireBell` are the shared clock; fireBell's six-step order (results → intel → income → manifest → foe pick → muster) is fixed and is what the player reads.
- **Where:** `stepBell` :1334, `fireBell` :1361, `makeDispatch` :1192, `nextSpawnTag` :1483, `withdrawDue` :1494, `executeWithdrawal` :1508.
- **Traps:** `bellAt` is an absolute sim-clock stamp — never per-frame subtraction.

### The two ladders
- **What:** both sides climb `TIER_BELLS` [1,3,5,10]; offers drawn per bell, one pick is the key, unpicked re-pool.
- **Where:** state.js `TIER_BELLS` :1040, `drawOffers` :1118, `drawFoePick` :1131, `pickManifest` :1140; the ladder data in specs.js `PLAYER_START` :160, `PLAYER_TIERS` :161.
- **Traps:** DRAW LAW — `drawOffers` burns exactly 4, `drawFoePick` exactly 1, exhausted pools still burn.

### Squad wiring
- **What:** members spawn as ordinary team-1 unit bodies on vetted ground; `pruneSquads` runs roster hygiene each tick.
- **Where:** `spawnSquadMembers` :709, `pruneSquads` :810, `memberNearRow` :780 (the engineer-reach test).
- **Traps:** loop order is prune → step → fire. A squad at zero members is silently deleted — by design.

### The one trigger — squadFire/towerShot/shooterFire
- **What:** every aimed shot, both sides, one accuracy/scatter/wind path.
- **Where:** `shooterFire` :351, `towerShot` :412, `squadFire` :500, `possessedVolley` :651, `possessedTowerFire` :687, `friendlyFouls` :884.
- **Traps:** INFANTRY_ARMS rows lack blastR/kv — squadFire's fallbacks (0.3/0.5) prevent damage becoming not-a-number. Dynamic shooters must pass `owner` for self-hit immunity.

### Walls, bags, placement
- **What:** a wall is three welded courses (`stepWallSupport` is the whole collapse rule); `validatePlacement` is the shared four-check gate; sandbags are static chunk-kind cover.
- **Where:** `spawnWallCourses` :226, `stepWallSupport` :305, `validatePlacement` :65, `spawnSandbag` :763, `sandbagOrientAt` :792.
- **Traps:** each course carries the FULL wall hp (deliberate). Field-laid pieces price off `*_FIELD_COST`, separate from menu costs. Every bag body is team-1 by the old spawn shape — bag SIDE rides `b.bagSide`, stamped by the caller; never trust `b.team` on a bag.

### The censuses and the breach law
- **What:** depot masonry is censused at build; `depotStandingFraction` (mass-weighted, upright-slid pieces still stand) against `DEPOT_BREACH_FRAC` 0.40 ends the war.
- **Where:** `censusDepotChunks` :914, `depotStandingFraction` :956, `checkDepotBreach`/`checkEnemyBreach` :979/:993.
- **Traps:** both checks are idempotent; first past the bar wins.

### The books — `economy.js` (61) and `market.js` (102)
- **What:** income is the clock (1 scrap/s both sides); `payTown` pays held ground at the bell; prices = base × per-type wall (doubles at K) × field fullness (pole at 88 men), repriced each second, one shared table both armies.
- **Where:** economy `payTown` :13, `makeRegiment` :24 (exactly 2 draws); market `MARKET_K` :20, `computePrices` :84, `fieldPrices` :100.
- **Traps:** every K is provisional (F5). Enemy buying reads the same table (`priceOf`); with no market cache the fallback path matters — a live `priceOf` returning undefined turns the buy math silently into not-a-number (found mk1.51, fixture-side).

### The dials — `specs.js` (245)
- **What:** every stat table: towers, enemy troops, TANK/BISON/APC, enemy fire, infantry arms, the satchel, MASON, the ladders.
- **Where:** `TOWER_SPECS` :34, `ENEMY_SPECS` :48, `BISON` :84, `APC` :99, `INFANTRY_ARMS` :212, `SATCHEL` :195, `MASON` :172.
- **Traps:** most dials carry `// provisional (F5)` — check before treating any as final.

### The save — `save.js` (366)
- **What:** single-slot bell-boundary save; bodies/welds/squads/censuses/terrain serialize generically; the map regrows from seed; rng reseeds from one draw; loss burns the slot.
- **Where:** `BODY_HANDLED` :54 (the never-carry list), `serializeFront` :170, `restoreBodies` :322, `restoreSquads` :356, `probeFront`/`burnFront` (stale marks burn at the door).
- **Traps:** the never-carry lists are load-bearing: targeting caches, broadphase bookkeeping (`_filed/_cells` — the mk1.34 ghost), driving/traffic transients, the squad `_avoid`/`_legTarget`/`_build`. Body ids never survive — every reference is a saved-array index. `saveFront` (mount) draws exactly one rng value per call, unconditionally.

### The derived fields
- **Territory** (`territory.js` :108): decaying 2m influence grid; ownership and build rights ONLY — targeting stopped reading it at mk0.72. `makeTerritory(halfU, halfV)`, `stepTerritory` at 4Hz.
- **Sight** (`sight.js` :183): derived visibility — never saved, rebuilt on resume, zero rng; cell-resolution blocking; per-type ranges in `SIGHT` :19; the possessed reticle's steer/clamp lives here too.
- **Intel** (`intel.js` :142): digit-free prose off the one-bell-old plan; VARIABLE draws (the one non-count-stable site, on the books since P1) with fixed family order.
- **Accuracy** (`accuracy.js` :301): the shared flight tracer (`marchArc`) feeding occlusion and friendly-foul checks; `applyScatter` is a fixed 2-draw contract; the state.js circular import is safe (function-body calls only).
- **Orient** (`orient.js` :56): pure canonical↔world transforms; always clamp in canonical space then transform back.

---

## The brains

### The buy brain — `ai.js` (327)
- **What:** each bell's enemy purchase (mix, tanks, snipers, bank-or-spend) plus the P7 doctrine helpers.
- **Where:** `planWave` :181, `bellBudget` :20; `cmdrOf` :289 (ONE draw per war, fresh boot only), `cmdrBellOrders` :297, `ferryDecide` :308, `flankDrop` :320, `homeShare`/`pickHomeDetail` :264+.
- **Traps:** `planWave` draws EXACTLY 4 every call, every branch. The doctrine helpers are pure — the caller draws, they decide (draw-then-clamp).

### The soldier — `units.js` (600)
- **What:** per-tick enemy infantry: march, fire with cover-halts, grenadier lob, sapper plant, sniper vantage hold, the yield; plus breaker grind and bounties.
- **Where:** `stepUnits` :451, `stepRifleman` :227, `stepSapper` :415, `spawnUnit` :23 (3 draws/man), `stepBreakerRam` :566.
- **Traps:** scan stagger keys off `b.seq`, never id. The sniper's spotter spawns draw-free. Reached-the-depot enemies stay and fight — only timeout/off-grid writes bodies off.

### The squad — `squads.js` (772)
- **What:** the order machine (defend/attack/move/build/patrol/ride), formation slots, exposure cover, the sniper pair's survey, satchels, possession drive.
- **Where:** `stepSquad` :533, `seekGoal` :352 (detour-commit 0.45s), `clearSlot`/`slotBlocked` :205/:184 (THE SLOT LAW), `exposureAt` :114, `drivePossessedSquad` :745.
- **Traps:** ONE rng draw per leg, unconditional at leg arrival (threatened or not). The slot law vets static solids AND live hulls AND the rim — every goal this module hands out passes it. Cohesion holds are time-capped (4s) so a wedged man can't deadlock a squad.

### The motor pool — `drivers.js` (381)
- **What:** one team-agnostic driver table (`b.drv` → goal policy + guns policy): wave tank, armor, APC; the safety cone, yield, patience, back-out, corner crawl, keep-right; possessed fire.
- **Where:** `stepDrivers` :341, `armorGoal` :97, `armorBlockers` :82, `armorGuns`/`apcGuns` :289/:320, `possessedArmorFire/Mg` :356/:369.
- **Traps:** the brake is never weakened — blockers in the cone always stop the hull that tick; yield asks men to step aside (2.5s), patience (4s) marks the lane and reroutes. The ram-through ruling lives HERE (:170), not in the planner: friendly/neutral masonry always detours; a path only enemy masonry closes is driven through its last bounded stretch. Possessed hulls skip goal+guns but cooldowns decay.

### The planner — `route.js` (103)
- **What:** grid search with an honest clamp and turn-point thinning; foot mode refuses cliff lips, hull mode refuses steep/tight/avoided cells; the terrain-mask stamper.
- **Where:** `planRoute` :40, `stampTerrainMasks` :20.
- **Traps:** enemy masonry is blocked for BOTH modes here — the ram exception is drivers.js's. Zero rng.

### The hold — `transports.js` (138)
- **What:** boarding rallies, the sealed hold (riders pinned at y −60, unhittable, eyeless), unload rings, the enemy ferry mirror.
- **Where:** `stepTransports` :35, `unloadApc` :101, `unloadEnemyRiders` :126, `apcBySeq` :25.
- **Traps:** sealed both ways — the hull's death kills every rider. Binding is by `apcSeq`, never body id. Boarding goals stand off the hull's footprint (STANDOFF 2.2m) — a goal at hull center kills the boarders against their own ride.

### The ground that bites — `mines.js` (60)
- **What:** watched trigger points polled at 4Hz; trip-side protection (never your own comrades' devices) with a both-sides blast; the seeding math, pure.
- **Where:** `stepMines` :10, `mineSeedRoll`/`mineSeedPlace` :50/:53.
- **Traps:** zero rng inside — the bell draws both seeding rolls unconditionally and passes them in.

---

## Presentation and platform

### The renderer — `src/render/renderer.js` (2,200)
- **What:** terrain mesh + splat painting (smears/scorch/territory tint/fog wash), instanced pools for everything drawable, the overlay family, the three-pass dot-matrix look.
- **Where:** `makeSplat` :26, `syncTerrain` :408, `updateFogWash` :526; `pool()` :739 with caps — chunks 3000, walls 2304, trees 360, mines/wires 96 each, infantry 96; overlays :1284–1493 (`setLinePreview` :1420, `setOrderPaths` :1454 — the green threads, dark underlay + bright dash), `setMines` :1257; the post shader :245, `setGfx` :1005.
- **Exports:** `washAlpha, WASH_SEAM, WASH_MAX_A, minesToDraw`.
- **Traps:** pool caps saturate SILENTLY — the HUD stones counter is the only chunk alarm. `instanceColor` must be allocated before first compile. Preview/path overlays dispose-and-rebuild per call — only ever call them at their own cadence (taps / 4Hz). The smear ledger is unbounded by the owner's law.

### The troop looks — `troopkit.js` (149)
- **What:** pure body→look mapping (palette, bulk, rifle, props) for DEPOT; other modes keep the frozen look.
- **Traps:** rifles take uniform scale only (non-uniform shears the baked rotation).

### The sound — `platform/audio.js` (743)
- **What:** procedural WebAudio — one-shots by event, continuous beds, the spatial chain; the soundboard (`?sounds=1`) is the acceptance loop for all sound work.
- **Where:** voice tables `MUZZLE` :266 / `WEAPON` :285, the bell's partials :377, `fin()` :40.
- **Traps:** every raw audio-parameter write goes through `fin()` or a silent NaN kills that node (the mk1.37 law; ~6 `setTargetAtTime` sites remain unwrapped — the open oddment). Voice cap 26; the bell is exempt on its own bus.

### Storage and the mark
- **What:** `platform/storage.js` installs the async KV shim (localStorage-backed on Pages); `version.js` exports `MK`.
- **Traps:** the mark law — +0.01 per task, +0.1 per phase, sequential, bump BEFORE the build; smoke asserts the on-screen mark equals `MK`.

---

## The gates

### The suite — `scripts/depot-test.mjs` + `scripts/tests/` (split at mk1.52)
- **What:** the headless functional suite, nine era files behind a 26-line runner that awaits each in sequence.
- **Where:** runner `scripts/depot-test.mjs`; `tests/harness.mjs` (ok/finish), `tests/shared.mjs` (cross-era fixtures); eras `01-engine-era` … `09-reorg` (the keystone pins live in their eras; T18+ blocks in 09).
- **Gate command:** `node scripts/depot-test.mjs` (also `npm run test:depot`).
- **Traps:** a NEW era file joins as an AWAITED dynamic import — a bare static import reorders execution (proven at mk1.52). The T6 keystone (hash 3465970090 / draws 695 at this stamp) re-pins ONLY when the world legitimately reshapes, hash and draws together (the T3/T5/T15 precedent).

### The lint — `scripts/depot-lint.mjs`
- **What:** forbids `Math.random` under `src/depot`. Command: `npm run lint:depot`.

### The smoke — `scripts/smoke.mjs`
- **What:** the only browser gate — every surface mounts, the mark shows, no console throws; asserts nothing about play. LOCAL ONLY (needs a live preview server); never in CI.

### The golden — `scripts/golden.mjs`
- **What:** the frozen-demo law — slices the byte-frozen demo (lines 1–4 + 7–2098) and asserts core.js parity by hash.
- **Traps:** ANY edit to the demo file silently shifts the slice and corrupts the check. Golden gates ENGINE parity only — it is not the check for game-layer landings and does not run for them.

### CI — `.github/workflows/deploy.yml`
- **What:** on every push to main: golden, depot-lint, test:predicate, test:scenario, test:combat, test:depot, test:accuracy, then build → Pages deploy.
- **Traps:** smoke and every diag/probe script are local-only.
