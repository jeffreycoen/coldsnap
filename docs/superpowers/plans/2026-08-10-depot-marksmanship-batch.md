# DEPOT Marksmanship Batch — Two Diagnosed Fixes + The Sniper/Spotter Pair (for Jeff's review; no code until approved)

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time (Tasks 1-2 unblock Task 3 — do not reorder). Commit per task, PUSH per task (Jeff live-tests). Iteration budget: 3 implement-verify cycles per task, then BLOCKED with findings. No screenshot/verify loops beyond the named gates — Jeff is the playtester.

**Goal:** Fix the two playtest-diagnosed defects (sleeping marchers, downslope veto) at their root, then ship the spotter: every sniper fields as a two-man pair, symmetric both sides — the spotter takes the best ground within 5m and directs the sniper to the best firing spot within the same radius; losses degrade the pair honestly.

## Diagnosis provenance (both on disk, not committed, not gated)
- `scripts/diag-squadlag.mjs` — sleep bug: seekGoal never wakes a sleeping body (core.js:1827 sleeps at |v|²<0.06 for 0.55s; threatened attack pauses 1.5-3s guarantee it). 0/4 members arrive on threatened fixtures; wedged members sleep forever. Ring renders the ghost anchor (DepotGame.jsx:1517/1520).
- `scripts/diag-downslope.mjs`, `diag-downslope-crest.mjs` — downslope veto: accuracy.js:76's fixed +0.35m terrain pad kills 94% of vetoed shots (249/266) that physically clear the crest (median real clearance 0.217m). Infantry muzzles (1.24m AGL) are the victims; towers (2.95m+) mostly escape. Sole failing gate — aimSolve/effRange/fieldReaches/selfId all verified clean.

## Global Constraints
- Frozen modes untouched. core.js: NO changes planned (wake is done from depot code via the public sleeping flag, same as units.js's seekStandPoint precedent). If a core need emerges, STOP — plan defect.
- No `Math.random()` in src/depot (text-grep lint — never write the string, comments included). Rng-draw contracts preserved exactly: one draw per attack leg (squads.js), two per shot (applyScatter), four per planWave. Every new decision path below is draw-free (positional/height solves, no rng).
- The laws: STRUCTURE fire never territory-gates; UNIT-vs-unit always fog-gates; every fire call threads `owner`, every arcClears threads `selfId`; flagged-DPS parity ±10% on any path whose damage behavior changes.
- Symmetry is law: everything Task 3 gives the player's sniper pair, the enemy marksman pair gets identically — one table, one behavior module, both signs.
- Scoped verification (named gates per task; `SMOKE_ONLY=depot`); FOREGROUND CI polls; per-task completion report to Jeff.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: marchers that stay awake — wake-on-seek + rubber-band + honest ring

**Files:** `src/depot/squads.js` (seekGoal, stepSquad), `src/depot/DepotGame.jsx` (ring anchor), `scripts/depot-test.mjs`.

- **1a (root cause):** `seekGoal` wakes the body when it has a live goal beyond arrive-tolerance: `if (u.sleeping && d > 0.15) { u.sleeping = false; }` before the steer (the seekStandPoint wake-kick precedent, units.js:212 — same cure, same shape; full-speed kick optional, test decides whether the gentle-accel-from-rest escape matters here too). The d<0.15 idle branch stays non-waking — settled defenders keep sleeping (idle-world determinism property preserved).
- **1b (cohesion):** anchor advance gates on the squad body: in the attack moving-leg branch, before advancing the anchor, compute max live-member distance to anchor; if > `COHESION_M = 6`, hold the anchor this tick (leg target unchanged, no new draws — the leg-arrival draw still fires exactly once per leg, only later in wall-clock). Deadlock-free because 1a guarantees members keep marching.
- **1c (honest ring):** selection ring + squad chip anchor at the live-member centroid, not `squad.anchor` (DepotGame.jsx:1517/1520 and the squadScreen projection). Render-only.
- [ ] **Failing asserts first** (fixtures from diag-squadlag, promoted into depot-test): threatened open-ground attack → all members arrive within 8s of the anchor (today: never); rock-cluster route → 4/4 arrive (today: 2/4); centroid-anchor lag bounded < COHESION_M + slack through the whole march; leg draw-count unchanged vs a pinned twin (rng stream identity through a threatened attack); defenders still sleep when settled; twin determinism.
- [ ] fail → implement → `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` → Commit "DEPOT squads: nobody sleeps on the march — wake-on-seek, rubber-band anchor, honest ring" → PUSH + report to Jeff (he playtests the feel; no screenshot loop).

### Task 2: physics-true sightlines — the pad becomes an epsilon

**Files:** `src/depot/accuracy.js` (arcClears), `scripts/depot-test.mjs`, spec baselines re-measured (`src/depot/specs.js` only if parity demands a dirDmg rescale — record either way).

**Decided direction (Jeff, 2026-08-10 discussion):** arcClears is a *predictor* of what the fired round will do; the engine's flight sim is ground truth. The fixed 0.35m corridor lies (94% of its downslope vetoes clear in reality). Replace it:
- Terrain test: arc y vs raw `heightAt + EPS` where `EPS ≈ 0.1` (sampling insurance only: 0.9m step × max terrain slope — derive the exact value from the field's slope clamp, document the derivation in-module).
- Target end: the arc must reach the target's body — evaluate the final approach against the target's standing height (+1.24 head, the reachPolygon TARGET_H convention) instead of relying on the corridor to fake target volume.
- Grazing lanes stay *punished, not forbidden*: losGraze → scatterSigma already widens sigma near solids; rounds that clip the lip crater it (diegetic erosion under sustained fire — physics does the storytelling).
- **Keystone assert (the anti-lie gate):** on the diag-downslope crest fixtures, fire real projectiles through the engine and require arcClears' verdict to MATCH observed impacts (predictor agrees with simulator, both directions: clears-and-lands-downrange vs blocked-and-eats-the-crest). This pins the fix to physics, not to a new constant.
- [ ] **Failing asserts first:** sniper on every diag crest fixture acquires + lands rounds downslope (today: 0 projectiles); true crest pierces still veto (the 17 real blocks stay blocked); tower behavior unchanged on its existing fixtures; reachPolygon downslope fans widen accordingly (sniper selected-reach shows it — Jeff eyeballs); flagged-DPS parity: rifles/mg/sniper vs the pinned soft fixtures within ±10% of pre-change (level-ground lanes barely move — measure, record, rescale only if breached); twin determinism.
- [ ] fail → implement → `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` → Commit "DEPOT sightlines: the predictor stops lying — pad to epsilon, arcs pinned to physics" → PUSH + report.

### Task 2b: universal selection LOS — every selected shooter shows its true fan

**Files:** `src/depot/DepotGame.jsx` (selection paths: inspected towers ~:1497, selected squads ~:1503-1521), `scripts/depot-test.mjs` (light — fan-source asserts), smoke (one state-hook assert).

**Jeff, 2026-08-10:** selecting ANY soldier or tower highlights its current line of sight. The sniper's selReach path is the template — generalize it: inspected tower → reachPolygon from its real muzzle (pos.y + hy + 0.45, its cached effRange spec), computed ONCE at select (static body); selected rifles/mg squad → the same fan from the first live member's muzzle at the sniper's 1Hz refresh (replaces their flat range ring); frost tower keeps its honest aura ring (it is not a gun). Fans are fog-independent (what the shooter COULD reach — the established preview rule; live fire stays fog-gated). Render-only; sequenced AFTER Task 2 so the fan shows honest arcs, never the pad bug.
- [ ] Asserts: selected tower's fan derives from its muzzle/effRange (compare a flat-ground tower's fan max radius ≈ effRange); squad fan present for all three types; no per-frame recompute for towers (call-count guard); render-only (twin determinism with selections interleaved).
- [ ] fail → implement → `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` → Commit "DEPOT: select anything that shoots, see what it sees" → PUSH + report.

### Task 3: the pair — sniper + spotter, symmetric

> **SUPERSEDED (2026-08-11):** implemented as `2026-08-10-depot-phase-6-5-sightlines-and-pair.md` Task 6, which carries this spec verbatim plus the finalized survey solver. This entry is kept for provenance only.

**Files:** `src/depot/squads.js` (spotter behavior + conversion), `src/depot/specs.js` (SQUAD_SPECS.sniper n:2, price; ENEMY side mirrors), `src/depot/units.js` (enemy marksman pair), `src/depot/state.js` (squadFire: spotter never fires), `src/depot/ai.js` (buy covers two heads), `src/depot/intel.js` (line audit only — marksman family already exists), `src/depot/DepotGame.jsx` (placement/selection), `scripts/depot-test.mjs`, smoke.

**The mechanic (Jeff, locked 2026-08-10):**
- Sniper squads field as **two men: sniper + spotter**. Symmetric — the enemy marksman arrives as the same pair.
- **On placement and on DEFEND re-anchor (never mid-fight, never per frame):** the spotter solves the local height maxima within `SPOT_R = 5`m of the anchor. Solver (Jeff-reviewed 2026-08-10): the field is bilinear over 2m control points, so the true maximum lies at a control point or the disc rim — evaluate heightAt at every control point inside the disc (~20) plus 16 fixed rim azimuths; REJECT candidates that fail clearSlot (inside solids), sit on pond ice, or fall outside the playable rim; RANK by height, with cover breaking near-ties (among candidates within 0.3m of the top height, prefer lowest exposureAt toward the threat bearing — Jeff's pick); remaining ties → nearest anchor, then fixed scan order. Fully deterministic, zero rng. Craters may later destroy his hill — he does NOT re-survey on terrain change, only on placement/re-anchor (no battlefield pacing). He marches there via seekGoal (Task 1's wake makes this safe).
- **Spotter directs the sniper:** sniper moves to the best *firing* spot within the same 5m — candidates scored by his actual arc (sampled reach toward the threat bearing via arcClears from each candidate's muzzle — Task 2's honest predictor is the scoring function; cheap: ~8-12 candidates × a handful of test rays, computed on placement/re-anchor only, never per frame).
- **Vision stays physical:** the spotter's elevated eyes feed ACQUISITION only (his muzzle point may serve as the sniper's fieldReaches/spotting origin — fog knowledge extends); the ROUND always flies from the sniper's own muzzle and must clear his own arc. No solution transfer, no teleporting ballistics.
- **Degradation:** spotter dies → direction stops; sniper keeps his current ground, own eyes only (no special case — the assist simply never re-runs). Sniper dies → spotter converts to a lone rifleman: utype/spec swap to `rifles` (INFANTRY_ARMS.rifles, fires from then on), squad relabels, existing one-man-squad machinery carries it. He KEEPS his current hp (same man, different tool — no heal, no reset).
- **The look (Jeff, 2026-08-10 — all three, final geometry pending a renderer read of how soldiers/rifles are drawn):** (1) spotter silhouette carries NO rifle, binoculars-up pose while holding; (2) periodic lens glint from a holding spotter — BOTH SIDES (it is also how the player spots the enemy's pair; intel's "scope flash" fiction already exists); (3) settled low pose for a sniper on his directed ground. In the fog's seam/silhouette zone both men render as generic man-shapes — fog costs you exactly this identification, by design. Renderer changes DEPOT-gated; if the unit-drawing path can't carry a prop/pose cheaply, STOP and surface options rather than improvising.
- **Fire discipline:** the spotter carries binoculars, not a rifle — he NEVER fires until converted. squadFire skips him by role flag; draw counts unchanged (a non-firing man draws nothing).
- **Price (Jeff, 2026-08-10, provisional — all prices are balance-pass tunables, not locked): 45 scrap** (two heads: 30 sniper + half a rifles squad for the spotter). Enemy marksman bounty mirrors (30 → 45); ai.js sniperWanted affordability check updates to match.
- [ ] **Failing asserts first:** pair spawns 2 (both sides); spotter occupies the local maxima within 5m (fixture with a known knoll — assert his ground height ≥ every sampled alternative); sniper's chosen stand point's scored reach ≥ the anchor default's (the direction is an improvement, measured by the honest predictor); spotter never fires (0 projectiles from his id across a firefight); spotter-loss → no further repositioning, sniper unaffected otherwise; sniper-loss → spotter respec'd to rifles and fires; enemy pair behaves identically (sign-flipped fixture); price/afford paths both sides; rng stream identity vs pre-Task-3 on a no-sniper run (nothing new draws); twin determinism with pairs in play.
- [ ] fail → implement → `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: place a pair, spotter climbs, sniper resettles — state-hook asserts, one screenshot for Jeff's phone, no loops) → Commit "DEPOT: the pair — a scope is only as good as the eyes beside it" → PUSH + report.

---

## Self-review notes
- Order is load-bearing: Task 1's wake makes Task 3's micro-repositioning survivable; Task 2's honest arcClears IS Task 3's LOS scoring function. Do not reorder.
- Task 2 is the one behavior-baseline risk (grazing lanes loosen slightly everywhere) — the parity re-measure is mandatory, the keystone predictor-vs-simulator assert is what makes the new epsilon a derived number instead of a new magic constant.
- Task 3 adds zero rng draws and zero core changes; all new solves are positional and placement-time-only (never per frame).
- Settled (Jeff, 2026-08-10): the spotter is the repositioning DIRECTOR only — no vision/acquisition-origin transfer in v1. The sniper acquires with his own eyes from the ground the spotter directed him to.
