# SLOW FRONT — Phase 1: The Bell

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-12 — second phase under Vision II. Phase mark **mk0.40** (new tenth); four tasks, +0.01 each, dispatched sequentially (one agent at a time — the shared-working-tree lesson from C0). All structure herein was ratified 2026-08-11; the tier table and every number marked provisional are content within that structure — approving this plan ratifies them as the starting values, and the balance pass (F5) owns their tuning.*

---

# PART ONE — What this phase does (plain language)

This phase replaces the wave counter with the game's new heartbeat.

**Task 1 — The clock (mk0.40).** The old rhythm — build phase, wave, build phase, wave — goes away. In its place: a shared clock. Every ~2 minutes the **muster bell** rings; between bells, play never pauses — you build, order squads, skirmish with stragglers. When the bell rings, the enemy's assault marches, sized and composed by what *their* bells have brought them. The top bar shows the time to the next bell instead of a wave number. Losing still means one thing only: your depot falls. Victory still means theirs does.

**Task 2 — The manifest (mk0.41).** The bell moment plays out in order: the **intel report**, then the cycle's **income**, then the **manifest** — a convoy card offering two or three new items; you pick one, and it joins your build menu for the rest of the match. You start every match with walls, sandbags, and a rifle squad only. The enemy climbs the same ladder on the same bells, picking from their own mirrored tiers — so the war escalates in step, but not identically.

The ladder (starting values — the balance pass will tune the order and pacing):

- **You start with:** wall · sandbag · rifle squad
- **Tier 1 (early bells):** MG tower · MG team · frost tower
- **Tier 2 (middle bells):** gun tower · sniper pair · mortar team
- **Tier 3 (later bells):** mortar tower · rocket tower · sapper team
- *(Engineers and heroes join the ladder in their own later phases.)*

What the convoy offers is drawn from your current tier plus anything you passed over earlier — an unpicked item isn't lost, it just waits for another truck. The enemy's mirror: their runners and breakers are tier 1, grenadiers and sappers tier 2, marksmen and tanks tier 3; before a tier opens, their assaults simply can't contain those troops.

**Task 3 — Leaving and returning (mk0.42).** The game auto-saves at every bell. The start screen gains **RESUME FRONT** — put the phone down mid-match, come back tomorrow, carry on from the last bell: same ground, same craters, same smears, same men, same scrap, same unlocks. Two hard rules you set: when your depot falls, the save burns — no rewinding a lost war; and starting a fresh front while a save exists asks you to confirm before it overwrites. One honest limitation, stated plainly: resuming restores the *state* of the war exactly, but future chance (scatter, enemy picks) rolls fresh dice from the resume — it is a return, not a replay.

**Task 4 — The sound of it (mk0.43).** The bell tolls. The convoy arrival has its arrival sound. Quiet interface ticks for the manifest pick and the save. Small, but this is the heartbeat becoming audible.

**What you do:** approve this plan; then playtest when it deploys — the feel of the 2-minute rhythm, the manifest moment, and a leave-and-resume round trip on your phone. The bell length and tier pacing are yours to adjust from play; they're one-line changes by design.

**Order:** Task 1 → 2 → 3 → 4, one agent at a time, each CI-green before the next starts.

---

# PART TWO — Task briefs (for agents)

*Dispatch: Opus 5, sequential, sole agent in the tree. Read-confirmations open every report. Verification law: load checks + kept gates only (`lint:depot`, `test:depot`, `golden`, boot smoke) — no scripted-gameplay tests. Every task bumps `src/version.js` +0.01. The seeded-rng law (`depot-lint`) and draw-count stability discipline apply to every change.*

## Task 1 — The clock (mk0.40)

**Replace** the build/wave phase machine with the bell cycle.

- New constants in `src/depot/state.js`: `BELL_PERIOD_S = 120` (provisional-F5), `TIER_BELLS = [1, 3, 5]` (bell index at which tiers 1/2/3 open, provisional-F5 — see Task 2's tier tables; keep the constants in state.js so both tasks share one source).
- Run state: replace `PHASE.BUILD/WAVE/STALL` consumers with `{ bell: 0, bellT: BELL_PERIOD_S }` counting down on sim time (`world.t`-derived, never wall clock). At zero: fire the bell event (Task 2 hooks the intel/income/manifest sequence here; this task just spawns the assault and resets the timer), increment `bell`.
- Assault at the bell: size/composition from `planWave` (`src/depot/ai.js`) capped by the enemy tier state (this task introduces the tier-state object with everything unlocked-from-start EXCEPT tags gated by `TIER_BELLS` — conscripts always available; `fast`/`heavy` tier 1; `gren`/`sapper` tier 2; `sniper`/`tank` tier 3). The `WAVES` table (`src/depot/specs.js:71`) is deleted; `planWave` becomes the only composer (read `ai.js` fully first — it already plans; what changes is its budget/roster inputs now derive from bell index + tier caps, not a wave row).
- Between bells play continues exactly as now (build, orders, combat with survivors). The wave-timeout withdrawal machinery (`executeWithdrawal`) is KEPT — a spent assault still withdraws; the bell just brings the next one on schedule rather than on clearance.
- HUD: the wave counter becomes the bell countdown (`BELL 4 · 1:37`); keep the element's data hook stable for the boot smoke (mark assert unchanged).
- Game-over/victory conditions untouched (depot breach census both signs).

**Reading list:** the plan (this file, both parts); `src/depot/DepotGame.jsx` — the loop, the phase/wave state wiring, HUD top bar, `stepDepot`'s wave/withdrawal calls; `src/depot/state.js` (PHASE machine + exports); `src/depot/ai.js` (whole file, 218 lines); `src/depot/specs.js` (WAVES + ENEMY_SPECS); `src/depot/economy.js` (whole, 61 lines — income timing today); `scripts/depot-test.mjs` — grep for PHASE/WAVES/planWave consumers among the kept 480 asserts; re-pin honestly anything that pinned the wave machine (report every re-pin old→new; if a pinned behavior is genuinely *gone* rather than changed, delete the assert and say so).

**Traps:** rng — assault composition draws must be seeded and count-stable per bell; `depot-lint` gates you. Do not let the bell fire from wall clock or React state (the loop's ref-state law — read the file header). The boot smoke's depot section must still mount/exit clean — run it.

## Task 2 — The manifest (mk0.41)

**The bell moment, in order, and the unlock ladder both sides.**

- Player tier tables in `src/depot/specs.js` (exported, provisional-F5): START = wall/sandbag/rifles; T1 = mg tower, mg team, frost; T2 = gun tower, sniper pair, mortar team; T3 = mortar tower, rocket tower, sapper team. Enemy mirror table = the tag gates Task 1 placed (document the two tables side by side in one comment block — symmetry is the law and the file should show it).
- Manifest state: unlocked set (starts = START), offer pool = current-tier items + earlier-tier unpicked. At each bell ≥ 1: draw 2-3 offers from the pool (seeded — `world.rng`, fixed draw count per bell regardless of pool size: draw indices then clamp, so the stream stays count-stable), present the manifest card; player picks ONE → joins unlocked; unpicked return to the pool.
- Bell sequence wiring (the Task 1 hook): intel report card (reuse `composeIntel` — read `src/depot/intel.js` whole; it becomes bell-anchored), then income (move the stipend grant here from wherever `economy.js`/the loop grants it today — one income event per bell, amount provisional-F5), then the manifest card, then the assault spawns. The cards queue; the assault does NOT wait on the player acknowledging cards (the war is not polite) — cards are dismissible while fighting.
- Manifest card UI: the brief-card idiom — scrim-free floating card (must not block combat input), ACKNOWLEDGE-armed per the trailing-tap law (`PENDING_ARM_S`), offer buttons armed the same way; dismissing without picking leaves the choice available via a top-bar chip until the next bell (then the offer re-pools — a skipped bell is a skipped pick, player's loss, no banking).
- Build menu (`DepotGame.jsx` mode buttons / tower picker) filters to the unlocked set; squad placement list likewise. Locked items simply don't render (no teasing greyed buttons — the manifest is the reveal).
- Enemy picks: at each bell the enemy "picks" too — seeded draw from their mirrored pool → their unlocked set feeds Task 1's tier caps. One draw per bell, count-stable.

**Reading list:** the plan; Task 1's landed diff (`git show` the mk0.40 commit); `src/depot/DepotGame.jsx` — build-menu construction, toast/card UI patterns, the pending-placement arm machinery; `src/depot/state.js` (PENDING_ARM_S family, validatePlacement); `src/depot/intel.js` (whole); `src/depot/economy.js` (whole); `src/depot/specs.js`; `src/depot/squads.js:17-31` (SQUAD_SPECS keys); `scripts/depot-test.mjs` kept asserts touching economy/intel timing.

**Traps:** every draw seeded + count-stable (enemy pick and player offers both); the manifest card must not eat combat taps (arm discipline + no full scrim); locked-item filtering must not break the boot smoke's depot mount (smoke only asserts mount/mark/exit — verify). HUD0/state shape changes ripple to the React mirror — follow the existing hud-tick pattern.

## Task 3 — Leaving and returning (mk0.42)

**Bell auto-save, RESUME FRONT, loss-final.**

- Serializer (new `src/depot/save.js`): at each bell (immediately BEFORE the assault spawns — the save is the state you'd want back), capture: bell/tier/unlock state, resources, heightfield (`field.h` as a plain array — ~14.6k floats, well inside the ~5MB storage budget), all live bodies with the fields the depot layer depends on (kind, team, tag/utype/role/dress/smearStyle, pos/q/v/w, hp/maxHp, town/gpos/sandbag/flagPole, tower fields, squadId), welds as index-pairs + breakF + broken, squads roster (orders, anchors, dests, memberIds remapped), territory field, splat smear ledger (`R._splat` — the T4 mk0.33 `smearLog`; scorch/tread staining is NOT saved — acceptable visual loss, stated in Part One), depot census standing state, and a **fresh derived rng seed** (draw once from `world.rng` at save time — mulberry32's internal state is closure-hidden by design; reseeding on resume keeps every post-resume run internally deterministic; a resumed run intentionally diverges from the unsaved continuation — ratified, stated in Part One). One save slot, key `coldsnap-front-save`, via `window.storage`, JSON; write is async and must not hitch the frame (serialize into a string on the bell tick, `storage.set` fire-and-forget).
- Resume: `RESUME FRONT` on the start screen (`src/ui/StartScreen.jsx`) and the module entry — shown only when a save exists (async probe, the campaign's pattern). Restore path in DepotGame: rebuild field → world → bodies → welds → squads → territory → splat replay → tier/economy state → reseed rng → resume the countdown mid-bell-period at full period (resume restarts the current cycle's clock — simpler and kinder than restoring a half-elapsed timer; document it).
- Loss-final: depot falls → delete the save before the end card shows. Victory → same. Starting NEW FRONT with a save present → two-tap confirm (the campaign's "THE RECORD BURNS" arm/disarm pattern, 5s self-disarm).
- The save version-stamps itself (`mk`); a save from a different mark refuses to load (toast: "the front has moved on") and is deleted — no migration machinery this era.

**Reading list:** the plan; Tasks 1-2 landed diffs; `src/depot/DepotGame.jsx` — world construction (`makeField`/`buildDepotTerrain`/`buildTown`/grid/territory init) end to end, the map-module state (`genMap`/`makeMap` globals — the save must store `MAP_SEED` and rebuild the map deterministically from it rather than serializing rocks/roads/town layouts); `src/depot/territory.js` (whole, 120 lines); `src/render/renderer.js` makeSplat (smearLog shape, `setWorld`/`clear` semantics); `src/game/campaign.js` reset/burn pattern + `src/ui/CampaignScreen.jsx` the arm/disarm button; `src/ui/StartScreen.jsx` (whole); `src/platform/storage.js`.

**Traps:** `MAP_SEED` + `makeMap` rebuild MUST run before body restore (bodies sit on the rebuilt terrain; craters then re-apply from the saved heightfield — restore field.h AFTER buildDepotTerrain, then `field.dirty = true`). Weld references are by body identity — serialize as indices into the serialized body array. `addBody` reassigns ids: remap `squadId`/`memberIds`/`pairId`/`tgtId` (or null tgtIds — they revalidate). Sleeping states: restore `sleeping` or the whole town wakes on frame 1 (frame-budget cliff — the C0 baseline says exactly how bad). Do not serialize functions or the rng closure. Boot smoke: start screen section must still pass with the new button absent (no save in the smoke profile).

## Task 4 — The sound of it (mk0.43)

- `src/platform/audio.js` gains three cues, event-driven per the module's law (consume events, never mode checks): `bell` (a real toll — two inharmonic strikes + long dark tail, the module's modal-voice idiom), `manifest` (truck-arrival rumble + tailgate knock), and a soft UI tick for pick/save. DepotGame pushes `{type:"bell"}`, `{type:"manifest"}` events at the bell sequence (events are unhashed — safe).
- Bell countdown's last 5 seconds: a quiet pre-toll tick per second (audio only — no new visuals this task).

**Reading list:** the plan; `src/platform/audio.js` (whole — match the vocabulary section's style); the Task 1/2 bell-sequence code (`git show` both commits); `src/game/ContractSandbox.jsx` audio-consume precedent if useful.

**Traps:** voice cap + humanize discipline (the module's anti-drum-machine rules); no `Math.random` outside the audio module's own vary() (audio is exempt from depot-lint — it lives in platform/ — but keep draws out of `src/depot`).

## Sequencing & close

T1 → T2 → T3 → T4, sequential, each CI-green and prod-verified before the next dispatch. Phase closes on Jeff's playtest: the 2-minute rhythm, the manifest moment, a leave-and-resume round trip on the phone, and a loss burning its save. `BELL_PERIOD_S`, `TIER_BELLS`, tier contents, and income are one-line tunables for his adjustments; all marked provisional-F5.
