# DEPOT Phase 5 Implementation Plan — Infantry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commandable infantry squads on both sides: sniper (1), rifle squad (4), MG team (2) — placed like towers, ordered per-squad (DEFEND / ATTACK-to-point), advancing cover-to-cover, using real geometry as cover, persisting across waves without healing. Enemy mirror: cover-seeking behavior + a sniper in their buy list. Plus the deferred buildable-edge line fix (screen-constant stroke).

**Architecture:** One new module `src/depot/squads.js` owns squad state, orders, movement, and exposure/cover scoring; combat goes through the existing `shooterFire` + accuracy model (this phase adds specs, not fire machinery). Squads are territory emitters like any unit (ATTACK pushes the field and the fog with it — already true via the Phase 4 emitter list once squads exist as unit bodies). Sandbags reuse the wall build path with a low-profile spec. Enemy mirror extends units.js behaviors + ai.js roster + intel.js lines.

## Global Constraints

- Frozen modes + core.js untouched (STOP on any core need). No `Math.random()` in src/depot. Renderer additions DEPOT-gated (`test:td-render` green).
- All new combat through `shooterFire`/accuracy.js — no bespoke fire paths. All squad randomness via `world.rng` with documented draw counts (multiplayer contract).
- Orders are player input, allowed mid-wave (like building) — but squad decision LOGIC must be deterministic from state+field (AI-side mirror runs headless).
- Persistence: squads and their casualties survive stalls; save/restock rules — squads are NOT respawned by any restock machinery.
- Jeff's locked decisions (vision "Phase 5 decisions") govern. Scoped verification; SMOKE_ONLY=depot; FOREGROUND CI polls in every dispatch (never background waits).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: squads.js — state, orders, exposure (pure core, gated)

**Files:** Create `src/depot/squads.js`; extend `scripts/depot-test.mjs`.

**Interfaces (exact — later tasks consume):**

```js
// src/depot/squads.js — squad brains. Pure functions over world + squad state.
export const SQUAD_SPECS = {           // costs are scrap; members spawn as unit bodies (team param)
  sniper: { n: 1, cost: 30, label: "SNIPER" },
  rifles: { n: 4, cost: 20, label: "RIFLE SQUAD" },
  mg:     { n: 2, cost: 25, label: "MG TEAM" },
};
export function makeSquad(id, type, team, x, z) {
  return { id, type, team, order: "defend", dest: null, memberIds: [], anchor: { x, z } };
}
// exposure: 0 (fully covered) .. 1 (open ground). Samples nearby static solids
// (rock/wall/tower/chunk/tree, incl. sandbags) within 2.2m in the threat
// direction; a solid between the man and the threat bearing reduces exposure.
export function exposureAt(world, x, z, threatBearing) { /* implement: 8-dir solid scan,
  cover counts when within ±60° of threatBearing at distance ≤2.2m; returns 1 - bestCoverWeight */ }
// coverHop: next advance waypoint toward dest — the lowest-exposure cell within
// hop radius (6m) that strictly reduces distance-to-dest; falls back to direct
// step when nothing qualifies. Deterministic, no rng.
export function coverHop(world, from, dest, threatBearing) { /* grid-sample 12 candidates */ }
// stepSquad(world, squad, dt): order machine.
//   defend: members hold formation around anchor, each man micro-seeks the
//           lowest-exposure spot within 3m of his slot (recompute on threat change, not per frame).
//   attack: squad advances dest-ward via coverHop legs; pauses 1.5-3s at each
//           cover leg (rng ONCE per leg — document); on arrival order becomes "defend" with anchor=dest.
export function stepSquad(world, squad, dt) { /* drives member unit bodies via their existing
  locomotion (units walk to point targets — reuse the march/goto machinery from units.js) */ }
```

- [ ] **Step 1: failing asserts** — exposureAt: man behind a wall vs threat bearing ≈0.1-0.3, open field = 1, wall BEHIND him (away from threat) = 1; coverHop picks a boulder-adjacent cell over open ground when both advance; stepSquad defend keeps members within 3m of anchor over 30 simulated seconds; attack reaches a 30m dest in legs (arrival < 60s), order flips to defend at dest; determinism twin-run (identical member positions).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT squads: orders, exposure, and the cover-to-cover hop".

### Task 2: infantry combat specs — both sides

**Files:** Modify `src/depot/specs.js`, `src/depot/units.js` (member fire behavior), extend depot-test.

- Specs (all through shooterFire + accuracy; symmetric values both teams):
  - `sniperRifle`: projSpeed 120 (flat), kind "mg" single shot, dmg 60 (one-shots all infantry hp ≤58... verify conscript 58 — set 65 to be sure), cadence 4.5s, acc 0.006 (tightest in game), occl "arc", windF 0.10, windComp 0.8, range 30 (> gun tower 19; elevation rule can push ~36). Armor chip: vs `b.armor` bodies the armor threshold naturally reduces it to scratch damage — verify, don't special-case.
  - `rifleFire`: existing rifleman spec values (reuse), range 15.
  - `mgTeam`: mg kind, cadence burst pattern (reuse tower mg cadence 0.17 in 6-round bursts, 2.2s between bursts), range 17, acc 0.070.
- Members fire while their squad holds/pauses (not mid-hop); target selection = nearest enemy in own-field reach (existing acquisition gates incl. arcClears/fog apply — squads see with the field like everything else).
- [ ] **Step 1: failing asserts** — sniper one-shots a conscript at 26m from +4 elevation (seeded, majority of 10 trials given scatter); sniper vs tank ≈ chip (hp loss < 8/shot); MG burst pattern draws documented rng counts; spec pins.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot` → **Step 5:** Commit "DEPOT infantry arms: the scoped rifle, the burst gun, the line".

### Task 3: placement, orders UI, sandbags, persistence

**Files:** Modify `src/depot/DepotGame.jsx` (build bar entries SNIPER/RIFLES/MG/SANDBAG; squad placement = tower flow incl. reach-polygon preview for sniper (his range fan) + confirm ✓/✗; tap-squad selection; order chips DEFEND/ATTACK; attack destination tap), `src/depot/specs.js` (sandbag), `src/depot/state.js` (squad persistence across waves — squads live outside wave spawn/cleanup), extend depot-test + smoke.

- Sandbag: build-bar item, cost 3, places a low soft wall (hx 0.9, hy 0.45, hp 60, kind "wall", no weld lattice — single body), counts as cover (exposureAt sees it) and as a wall for territory EMIT (0.5/r4) but NOT for the town/building census.
- Selection: tap a squad member/marker → squad selected (ring under members), chips appear: DEFEND | ATTACK; ATTACK → next ground tap = dest (marker flag until arrival). Tap elsewhere deselects. 350ms arming per modal lesson. Rotation-proof.
- Persistence: squads + members survive stall/advance; dead members stay dead (squad fights understrength); an annihilated squad's entry is gone (no refund). Buying a new squad = new purchase.
- [ ] **Step 1: failing asserts** — placement deducts cost + green-only + confirm flow; sandbag cover measurable via exposureAt; squad survives a wave boundary with a casualty retained (2/4 rifles persist); order round-trip headless (select→attack→dest→arrival→defend).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: place rifles, order ATTACK to a point, squad moves; sandbag place; rotated variant); screenshots: squad selected w/ chips, sniper reach fan, sandbag line, mid-advance — task3-*.png to workspace → **Step 5:** Commit "DEPOT infantry: placed, ordered, dug in, and kept".

### Task 4: the enemy mirror

**Files:** Modify `src/depot/units.js` (enemy cover behavior: riflemen/grenadiers use exposureAt to pick halt points; advancing enemies path via coverHop when under fire — bounded scope: keep the flow-field as the strategic direction, coverHop only perturbs the local step), `src/depot/ai.js` (sniper in the buy list: price 30, counter-weight vs player infantry presence — buildSnapshot gains a `squads` count), `src/depot/intel.js` (marksman line family: "Marksman activity reported forward of the line." + 2 variants, wired to sniper purchases), extend depot-test.

- [ ] **Step 1: failing asserts** — an enemy rifleman under fire relocates to a lower-exposure halt point (exposure drops); AI buys snipers when snap.squads ≥ 2 (share above baseline); intel emits a marksman line (no-gap fixture) with no digits; enemy sniper fires through shooterFire with the same spec (twin determinism).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT mirror: they take cover too, and one of them has a scope".

### Task 5: edge-line fix (deferred from 4.1)

**Files:** Modify `src/render/renderer.js`.
- The buildable-edge contour renders as a screen-constant thin stroke (~1.5px at devicePixelRatio 1) instead of a ground-space cell-wide band: draw it in the overlay pass (screen space, from the same threshold contour data) OR scale the ground-space line width inversely with zoom — implementer's call, document; must stay crisp at all zooms and rotations.
- [ ] **Step 1:** implement → **Step 2:** `npm run test:td-render && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs`; screenshots at 3 zoom levels + rotated → **Step 3:** Commit "DEPOT: the buildable edge is a line, not a band".

### Task 6: probe + prod closer

**Files:** `scripts/economy-probe.mjs` (STRONG_PLAN/MEDIAN_PLAN may now include squads — add a squads-using tier variant OR extend median with a sniper+rifles purchase; enemy sniper joins their sim), plan doc numbers.
- [ ] **Step 1:** re-run matrix; all four sanity rules hold (incl. 0 spurious breach); tune squad costs/spec numbers if a tier degenerates (never the CAREFUL default, never Phase 3 economy rates first).
- [ ] **Step 2:** full scoped verify + 3 consecutive smokes → **Step 3:** commit ("DEPOT Phase 5 closes: infantry in the line, probe green"), PUSH, foreground CI poll, prod SMOKE_ONLY=depot ALL PASS → **Step 4:** report + phone-check screenshots (squad orders in action, sniper overwatch, sandbag line under fire, enemy using cover, thin edge line).

---

## Self-review notes
- Every Phase 5 decision maps: roster+per-squad+attack-to-point (1,3), cover incl. sandbags (1,3), persistence-no-heal (3), sniper ceiling (2), full mirror (4), edge line (5).
- Squad movement deliberately reuses unit locomotion + grid — no new pathfinding tech; coverHop is a local heuristic, not A*.
- Sniper range 30 intentionally exceeds gun towers (Jeff's "anti-personnel king"); fog/field reach still gates acquisition — a sniper needs the field pushed forward to use his reach, which is the intended loop with ATTACK orders.
- Deferred cosmetics NOT in this phase: confirm-pair collision, rigid tree sway, breach-card debug hook, seam silhouette hull-size leak.
