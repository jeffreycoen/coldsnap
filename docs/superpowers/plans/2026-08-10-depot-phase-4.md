# DEPOT Phase 4 Implementation Plan — Territory + Fog of War

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ground takes sides. An influence field over the playable area drives: green/red grid-line tinting, build rights (green only), holder-paid town buildings, and three-state fog (held = full detail, seam = silhouettes, unheld = activity invisible) with a hard targeting boundary. Fog on by default with a feel toggle (visuals only — the targeting rule is not toggleable).

**Architecture:** One pure module, `src/depot/territory.js`, owns the field: a coarse cell grid (2m) accumulating influence from bodies each tick with slow decay (τ ≈ 75s), plus two permanent anchors (depot green, attacker spawn edge red). Everything else *reads* it: renderer tints grid lines and applies the fog treatment from a small texture the mode updates; tower/enemy target acquisition consults it (symmetric: each side acquires only into ground its own field reaches); build placement and town payouts consult it. The field is deterministic (positions in, no rng) — multiplayer-safe by construction.

## Global Constraints

- Frozen modes + core.js untouched (any core need = STOP, plan defect). Renderer changes flag-gated: no option passed → byte-identical (test:td-render green).
- No `Math.random()` in src/depot; territory.js draws NO rng at all.
- Jeff's locked decisions govern: slow decay (~60-90s revert), permanent red spawn anchor, hard fog targeting boundary (both sides), grid-line tinting look (terrain palette untouched), town buildings pay holder per wave, fog ON default + visual-only toggle.
- No numbers/percentages in UI. Fog hides ACTIVITY only — terrain, wind flags, and your own assets always render.
- Rotation invariance: tint/fog render + all new asserts exercised rotated at least once in smoke.
- Scoped verification per project rule; `SMOKE_ONLY=depot`; dispatch prompts mandate FOREGROUND CI polls (never background monitors).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: territory.js — the field (pure, gated)

**Files:** Create `src/depot/territory.js`; extend `scripts/depot-test.mjs`.

**Interfaces (exact — later tasks + Phase 5 consume):**

```js
// src/depot/territory.js — who holds the ground. Deterministic, rng-free.
// Cells: 2m over the playable extent (reuse the rim halfU/halfV extents).
export function makeTerritory(halfU, halfV) {
  const cs = 2, nx = Math.ceil((halfU * 2) / cs), nz = Math.ceil((halfV * 2) / cs);
  return { cs, nx, nz, halfU, halfV, v: new Float32Array(nx * nz) }; // v: -1 (red) .. +1 (green)
}
export const DECAY_TAU = 75;        // s — slow revert (Jeff)
export const EMIT = {               // influence/s at the emitter cell, falling linearly to 0 at r
  depot: { w: 2.4, r: 18 }, tower: { w: 1.2, r: 9 }, wall: { w: 0.5, r: 4 },
  unit: { w: 0.6, r: 5 }, vehicle: { w: 0.9, r: 7 },
  anchor: { w: 2.4, r: 14 },        // attacker spawn edge, permanent red
};
export function stepTerritory(T, emitters, dt) { /* decay toward 0 by dt/τ, then add each
  emitter's signed contribution (team 1 → +, team 2 → −), clamp [-1,1].
  emitters: [{x, z, w, r, sign}] — the mode builds this list from live bodies + anchors. */ }
export function holderAt(T, x, z) { /* v > +0.15 → 1 (green), v < -0.15 → 2 (red), else 0 */ }
export function fogStateAt(T, x, z) { /* for the PLAYER: v > +0.15 "held", |v| <= 0.15 "seam", else "unheld" */ }
```

- [ ] **Step 1: failing asserts** — decay halves in ~52s (τ·ln2) with no emitters; a tower emitter greens its cell within seconds; opposing emitters at range produce a seam (|v|≤0.15 band between them); anchor stays red after 300s of no enemy presence; determinism (two identical runs, identical Float32Array); holderAt/fogStateAt thresholds.
- [ ] **Step 2:** verify fail → **Step 3:** implement (cell loop bounded by each emitter's radius — NOT full-grid per emitter) → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT territory: the ground takes sides — influence field, anchors, slow memory".

### Task 2: wiring — build rights, town pay, targeting boundary

**Files:** Modify `src/depot/DepotGame.jsx` (field tick ~4Hz from live bodies + anchors; build placement check; town payout at stall), `src/depot/state.js` (targeting gate in the acquisition scans — read where towers scan (≈DepotGame :330) and where enemy units acquire structures (units.js); gate BOTH), `src/depot/units.js`; extend depot-test.

**Rules:** build allowed only where `holderAt` = 1 (toast "GROUND NOT HELD" on refusal — bureau-terse, no digits); town building pays its holder at stall (green → player scrap, red → regiment scrap, seam → nobody; reuse the building list from buildTown); targeting: a tower may acquire a target only if the PLAYER field reaches it (fogStateAt ≠ "unheld" at target); an attacker shooter may acquire only where THEIR field reaches (mirrored check, sign-flipped). Already-engaged sticky targets that walk into fog are dropped on the next rescan.
- [ ] **Step 1: failing asserts** — build refusal on red/seam ground, allowed on green; a scripted town building flips holder and the stall payout follows; a target beyond the field is not acquired, same target with a friendly unit near it (field extended) is; symmetric check for an attacker rifleman vs a tower in player-held fog; consequence: massacre-at-the-wall still pays results (Phase 3 economics unaffected).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot && npm run build` → **Step 5:** Commit "DEPOT: build rights, holder-paid town, and guns that cannot see past the line".

### Task 3: placement preview + confirm (Jeff, 2026-08-10)

**Files:** Modify `src/depot/DepotGame.jsx` (placement flow), `src/depot/state.js` or `accuracy.js` (shared reach sampler), `src/render/renderer.js` (overlay polygon — reuse the overlay API), `src/depot/specs.js` (acquisition-range elevation rule); extend depot-test + smoke.

**Behavior:**
- NEW SIM RULE (symmetric, both sides): acquisition range scales with muzzle height above mean surrounding ground: `range * min(1.2, 1 + 0.02 * elev)` — high ground sees farther. Applies to towers AND enemy shooters; probe re-check in Task 5 covers it.
- Selecting a build cell shows a ghost tower + **effective-reach polygon**: ~64 azimuth rays from muzzle height, each stopping at the first LOS obstruction (terrain/static solids — reuse/extract the graze sampler) or the elevation-scaled range. Red, translucent fill, hard edge. After Task 2 lands, rays also clip at the fog targeting boundary. Recomputed on selection move only (not per frame).
- Purchase requires confirm: ✓/✗ pair floating by the cell (screen-space — rotation-proof), armed after 350ms (trailing-tap lesson); ✓ deducts scrap + places, ✗ or tap-elsewhere cancels; no scrap moves before ✓. WALLS EXEMPT: instant placement as today (5-scrap spam; ring meaningless). Frost tower shows its slow-field radius as the ring instead (blue-white, honest about what it does).
- [ ] **Step 1: failing asserts** — elevation rule pins (range at +6m = 1.12×, cap at 1.2×); reach sampler stops at a wall fixture and at spec.range on open flat; confirm flow headless (select → pending, no scrap spent → confirm → placed+deducted; cancel → nothing).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: confirm-flow tap sequence replaces the old direct-tap build; rotated variant); screenshots: ring on flat vs on a rise (visibly bigger), ring bitten by a boulder, confirm pair visible — save to workspace → **Step 5:** Commit "DEPOT placement: the red reach polygon and the ✓ that spends the scrap".

### Task 4: the look — grid tinting + three-state fog (renderer)

**Files:** Modify `src/render/renderer.js` (new DEPOT-only option, e.g. `opts.territory` carrying a sampler; grid-line tint + fog treatment), `src/depot/DepotGame.jsx` (pass sampler + per-frame fog visibility for enemy bodies); extend smoke.

**The look (decided):** grid LINES take faction tint (green/red, neutral grey in seam/no-man's) — terrain colors untouched. Mechanism choice is the implementer's (repaint the splat-canvas grid lines region-batched on territory change, OR a low-res modulation texture applied only to the grid-line pass) — document the choice and its Pi cost in the report. Fog: unheld ground gets the colder/desaturated/coarser-dither treatment; enemy units/vehicles in unheld cells are NOT rendered for the player; in seam cells render as grey silhouettes (flat dark dress palette, no team colors, no kind detail beyond hull shape); player assets, terrain, wind flags, trees render everywhere. Toggle: menu entry "FOG" on/off — flips VISUALS only (hiding/silhouettes/desaturation), never the targeting gate; default ON.
- [ ] **Step 1:** implement; **Step 2:** verify `npm run test:td-render && node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs`; screenshots: held/seam/unheld tri-state in one frame, enemy silhouettes at the seam, same rotated one Q/E step, toggle-off comparison — save to workspace; **Step 3:** Commit "DEPOT fog: three states of knowing, grid lines that take sides".

#### Task 5 results (2026-08-10)

Probe wired to real territory.js field: build placement now gated by `canBuild`
(unheld plan spots retried on later wave-starts as the field accumulates),
tower/enemy targeting gated by `fieldReaches`, tower range uses cached
`effRange` (elevation rule). Town pay approximated by a single depot-only
`payTown` entry each stall (probe has no other town buildings modeled — a
known simplification, see task-5-report.md).

Initial run (EMIT unchanged) FAILED the sanity gate: `wall.r=4` left ~6-7m
gaps between the wall-line chokepoint and the tower row behind it (median/
strong plan spots), which under build-rights could never be built at all —
median collapsed to max wave 6 (all losses), strong never broke attrition.

**Tuning applied:** `EMIT.wall.r` 4 → 9 (matches `tower.r`) in
`src/depot/territory.js` — closes the reach gap so a wall-then-tower line is
actually buildable end-to-end. No other EMIT/pay-rate values touched.

Also updated the probe's own sanity-rule (a) computation: a `WIN (ledger)`
verdict (attacker's book value collapses, forcing an early ledger win) now
counts as a "defense breaks the offensive" success alongside attrition WINs,
per this task's brief.

**Final probe matrix (20 seeds, strong auto-throttled to 10 past 2min/cell):**

| tier | avg wave | WIN rate | notes |
|---|---|---|---|
| none | 1.1 | 0/20 | all overrun by wave 1-2 |
| median | 35.5 | 14/20 | mixed LOSS(overrun)/WIN(ledger), max wave 50 |
| strong | 10.4 | 17/20 | WIN(ledger)+STALEMATE dominate; 0 literal attrition WINs but 17/20 (85%) ledger-break |

Sanity gate: (a) 85% PASS (≥30%), (b) max wave 2 PASS (≤8), (c) max wave 50 /
LOSS+WIN mix PASS (≥25, ≥2 verdicts).

### Task 5: probe re-check + smoke + prod

**Files:** Extend `scripts/economy-probe.mjs` (the targeting boundary changes combat reach — re-run the 3-tier matrix (now incl. the elevation-range rule); sanity rules from Phase 3 must still hold; if median collapses (fog starves tower dps), tune EMIT weights/radii — field reach is the balance lever, not the accuracy model), extend smoke depot section (fog assert: a spawned far enemy absent from render while unheld, appears on approach; rotated build-refusal toast check).
- [ ] **Step 1:** probe → tune → record finals in report + this plan; **Step 2:** full scoped verify + 3 consecutive local smoke passes; **Step 3:** commit ("DEPOT balance under fog: probe re-run, field weights tuned"), push, FOREGROUND CI poll to success, prod `SMOKE_ONLY=depot` ALL PASS; **Step 4:** report incl. screenshots for Jeff's phone-check list (rim, tint, fog states, toggle).

---

## Self-review notes
- Every Phase 4 locked decision maps to a task: decay/anchor (1), build rights + town pay + hard boundary both sides (2), grid-tint look + 3-state fog + toggle-visuals-only (3), feel/balance loop (4).
- Field is rng-free and position-deterministic — multiplayer contract holds; targeting gate reads the same field on both twins.
- Fog toggle deliberately does NOT alter the sim (targeting) — stated twice because it's the likeliest implementer mistake.
- Open risk, accepted: seam silhouettes may leak unit-type info via hull size; acceptable v1, revisit with playtest.
