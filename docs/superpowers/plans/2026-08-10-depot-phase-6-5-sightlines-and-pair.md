# DEPOT Phase 6.5 — Sightline Conformity + The Sniper/Spotter Pair (for Jeff's approval; no code until approved)

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time. Failing asserts first, always. Commit + PUSH per task (Jeff live-tests), FOREGROUND CI polls. Iteration budget 3 cycles/task then BLOCKED. Reports to Jeff: plain language, no jargon, every nonconformity its own labeled bullet.

**Goal:** Close all five nonconformities from the 2026-08-10 line-of-sight audit, then ship the sniper/spotter pair (spec finalized in `2026-08-10-depot-marksmanship-batch.md` Task 3 — carried here unchanged, superseding that entry).

**Audit provenance:** every shooter both teams already runs the exact arc tracer with self-exclusion at acquisition; fired rounds always collide with terrain. The five defects are in the safety check, an obstacle filter, one weapon classification, and one collision convention.

## Global Constraints
- Frozen modes untouched. core.js: Task 4 touches NOTHING in core — the hitStruct change is spec/call-site data only. If a core need emerges, STOP.
- No `Math.random()` string in src/depot. Rng contracts exact: 1 draw/attack leg, 2/shot, 4/planWave; every new decision path below is draw-free.
- Laws: structure fire never fog-gates; unit fire always fog-gates; every fire call threads `owner`, every arcClears threads `selfId`; flagged-DPS parity ±10% wherever damage behavior changes (measure before, record, rescale in specs.js's documented style).
- Symmetry is law. Prices provisional (balance pass owns them).
- Scoped gates per task: `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (+`npm run test:td-render` when renderer touched).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: obstacle filter — masonry and trees become real to aiming and discipline

**Defects closed:** "safety check never protects the depot" + "aiming ignores buildings and trees" (audit #2, #3).

**Files:** `src/depot/accuracy.js` (solidBlocksPoint), `src/depot/state.js` (friendlyBlocksPoint), `scripts/depot-test.mjs`.

**Root cause:** both point-tests skip every body with `invM > 0` (dynamic). Town/depot chunks (mass 100/88/320) and trees (mass 260) are dynamic, so the `chunk`/`tree` entries in SOLID_KINDS are dead code — only static sandbags ever match.

```js
// accuracy.js — solidBlocksPoint: filter by KIND, not mobility. A stone is an
// obstacle whether or not physics lets it move; sleeping masonry is the whole
// town. Units/vehicles stay excluded (dynamic AND not in SOLID_KINDS).
export function solidBlocksPoint(world, x, y, z, selfId) {
  for (const b of world.bodies) {
    if (!b.alive || (selfId != null && b.id === selfId)) continue;
    if (!SOLID_KINDS.has(b.kind)) continue;
    if (b.invM > 0 && b.kind !== "chunk" && b.kind !== "tree") continue; // dynamic non-masonry never blocks
    if (Math.abs(x - b.pos.x) <= b.hx && Math.abs(y - b.pos.y) <= b.hy && Math.abs(z - b.pos.z) <= b.hz) return true;
  }
  return false;
}
```

```js
// state.js — friendlyBlocksPoint: same fix. The team-0-chunk clause finally
// fires: CAREFUL now actually holds the shot your depot would have caught.
    if (!b.alive || (selfId != null && b.id === selfId)) continue;
    const friendly = ((b.kind === "wall" || b.kind === "tower") && b.team === 1) ||
                      (b.kind === "chunk" && b.team === 0);
    if (!friendly) continue;
    if (b.invM > 0 && b.kind !== "chunk") continue;
```

- Debris caveat: loose battlefield chunks (shattered structures, rock debris) now also block aiming — correct physics (rubble is cover), and exposureAt already treated them as cover, so the systems agree now.
- Perf note: no new loops — same scans, weaker filter. If depot-test's firefight fixtures slow measurably, bound chunk tests to sleeping chunks only (awake debris is in flight — transient) and document.
- [ ] **Failing asserts:** tower behind a town house does NOT acquire a target masked by it (today it does); CAREFUL tower whose arc crosses depot masonry HOLDS (today fires — the audit's headline case; assert depot chunk hp unchanged over N seconds); FREE still fires; tree masks acquisition; sandbag behavior unchanged; twin determinism.
- [ ] fail → implement → gates → Commit "DEPOT sightlines: stone and timber are real — masonry and trees block aim and discipline" → PUSH + report.

### Task 2: the safety check runs the exact tracer

**Defect closed:** "safety check uses old math" (audit #1).

**Files:** `src/depot/accuracy.js` (extract the marcher), `src/depot/state.js` (friendlyFouls delegates), `scripts/depot-test.mjs`.

```js
// accuracy.js — marchArc(world, muzzle, target, spec, hit): the ONE flight
// march. Cadence-matched samples (t = k*ARC_DT, integrator-exact height —
// Task 2's tracer, extracted). Calls hit(x, y, z) per sample; first true
// aborts. arcClears passes solidBlocksPoint+terrain; friendlyFouls passes
// friendlyBlocksPoint. Lofted specs keep the climb-out-cone contract.
export function marchArc(world, muzzle, target, spec, hit) { /* extracted loop */ }
```

- friendlyFouls (state.js) drops its private 0.9m-step parabola and calls `marchArc` with the friendly-blocker predicate (selfId threaded). FRIENDLY_MARGIN 0.4 unchanged.
- arcClears itself becomes a `marchArc` caller — one flight model, two questions (blocked? / fouls a friendly?). Byte-identical verdicts asserted against pre-refactor arcClears on the existing crest fixtures.
- [ ] **Failing asserts:** arcClears verdicts identical pre/post refactor across the crest matrix (refactor-safety pin); friendlyFouls verdict matches a real fired round's impact on a friendly-wall fixture both directions (the keystone pattern, now for discipline); margins case from audit (analytic-vs-integrator divergence) resolves to the integrator's answer.
- [ ] fail → implement → gates → Commit "DEPOT discipline: one flight model — the safety check stops guessing" → PUSH + report.

### Task 3: the rocket tower earns its classification

**Defect closed:** "rocket tower misclassified" (audit #4).

**Files:** `src/depot/state.js` (towerShot), `scripts/depot-test.mjs`, parity check.

**STATUS: ON HOLD (Jeff, 2026-08-11).** Implementation blocked: the rocket's aim wobble (acc 0.340, tuned for flat fire) lands lobbed salvos 30-80m off target — flagged DPS 2.4592 flat → 0.0000 lobbed. Wobble sweep on the pinned fixture: 0.100→0.53, 0.030→1.02, 0.020→3.12 (+27% vs flat baseline). Fix requires an accuracy retune (~0.025-0.030 band), which is a balance decision. Jeff chose HOLD — skip this task, continue 4-6, revisit later. Original decision below stands when resumed.

**Decision (Jeff, 2026-08-10: make it lob):** rockets fire the HIGH arc — `towerShot` sets `high` for mortar AND rocket. The spec already says lofted (salvo weapon, blast radius 3.4, crater); making the rounds actually lob matches the classification, lets it genuinely fire over hills, and its acquisition contract becomes true. Alternative (rejected unless Jeff prefers): reclassify `occl:"arc"` — keeps flat fire but a salvo weapon that can't shoot over anything loses its role vs the gun tower.

```js
// state.js towerShot:
  const high = tower.towerType === "mortar" || tower.towerType === "rocket";
```

- Flight time rises (projSpeed 30 lobbed) — lead solve already iterates; wind exposure grows (windF 1.3 — intended, rockets are kited by design).
- [ ] **Failing asserts:** rocket tower behind a crest lands salvo rounds on a masked target (today: hillside); rocket vs near flat target still lands (high-arc close solve exists — else aimSolve fallback pitch 1.1 covers); flagged-DPS parity vs the pinned soft fixture ±10% (lob changes impact geometry — measure, rescale dmg/blastR NEVER, dirDmg only if breached and documented); twin determinism.
- [ ] fail → implement → gates → Commit "DEPOT rockets: they lob now, as advertised" → PUSH + report.

### Task 4: no round passes through a structure

**Defect closed:** "scattered rounds pass through rocks/walls" + grenadier/rifleman inconsistency (audit #5 + cosmetic).

**Files:** `src/depot/state.js` (shooterFire), `src/depot/units.js` (call-site audit), `scripts/depot-test.mjs`. **core.js untouched** — hitStruct is an existing per-round spec flag.

- Every round fired through `shooterFire` carries `hitStruct: true` unless the caller already sets `hitOnly` (structure-only shots keep their exact behavior). Unit-target shots may now physically eat a wall/rock/tower edge en route — the blast lands where the round stops. This kills the last impossible-hit path and makes rifleman/grenadier collision identical.
- Ricochet/decal/event side effects: rounds now sometimes strike structures that used to be ghosted through — struct-hit events fire; assert no bounty/results misbooking (structureDmg attribution: a PLAYER round eating the player's own wall must not pay the attacker — verify the attacker check in drainEvents covers attacker "player" correctly).
- [ ] **Failing asserts:** a round fired at a unit with a wall edge clipping the flight path stops at the wall (fixture with deliberate scatter seed); no attacker pay for player self-hits; sniper/rifle/mg/tank DPS parity on OPEN-ground fixtures unchanged ±10% (open ground has no structures — expect identical to 4 decimals); grenadier==rifleman collision settings; twin determinism.
- [ ] fail → implement → gates → Commit "DEPOT: every round respects every wall — the last pass-through dies" → PUSH + report.

### Task 5: preview self-exclusion uniformity

**Defect closed:** cosmetic squadReach gap.

**Files:** `src/depot/accuracy.js` (squadReach threads the member's id), `scripts/depot-test.mjs` (one-line pin).
- [ ] Assert squadReach output unchanged today (proof it was harmless) + selfId now threaded (grep pin). Fold into Task 4's commit if trivially small.

### Task 6: the pair — sniper + spotter

**Spec:** verbatim from `2026-08-10-depot-marksmanship-batch.md` Task 3 (solver: control-points+rim, clear/ice/rim vets, height rank, cover breaks near-ties ≤0.3m, ties→nearest→scan order; placement/re-anchor only; look: rifle-less binocular silhouette + both-sides lens glint + settled sniper pose, generic in fog silhouettes; degradation: spotter death stops direction, sniper death converts spotter to rifleman KEEPING current hp; spotter never fires; price 45 provisional both sides; director only — no vision transfer). That plan entry is superseded by this task; the sniper's stand-point scorer uses Task 2's `marchArc`-backed reach sampling.

**Sequenced LAST deliberately:** the pair's LOS scoring must run on conformant sightlines (Tasks 1-2) or the spotter directs the sniper using physics that then changes under him.

**Files:** `src/depot/squads.js` (spotter role, solver, conversion), `src/depot/specs.js` (SQUAD_SPECS.sniper n:2 cost:45; ENEMY_SPECS.sniper bounty 45, pair spawn), `src/depot/units.js` (enemy pair mirror), `src/depot/state.js` (squadFire role skip), `src/depot/ai.js` (affordability), `src/render/renderer.js` (DEPOT-gated: binocular pose variant, glint sprite, settled pose — read the unit-drawing path first; if a prop/pose can't ride cheaply, STOP and surface options), `scripts/depot-test.mjs`, smoke.

```js
// squads.js — the survey (deterministic, draw-free, placement/re-anchor only)
export const SPOT_R = 5, SPOT_TIE_M = 0.3;
export function surveyHighGround(world, cx, cz, threatBearing, clear) {
  const F = world.field, cands = [];
  const i0 = Math.floor((cx - SPOT_R + F.half) / F.cs), i1 = Math.ceil((cx + SPOT_R + F.half) / F.cs);
  const j0 = Math.floor((cz - SPOT_R + F.half) / F.cs), j1 = Math.ceil((cz + SPOT_R + F.half) / F.cs);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {   // control points in the disc
    const x = i * F.cs - F.half, z = j * F.cs - F.half;
    if (Math.hypot(x - cx, z - cz) > SPOT_R) continue;
    cands.push({ x, z });
  }
  for (let k = 0; k < 16; k++) {                                    // rim
    const a = (k / 16) * Math.PI * 2;
    cands.push({ x: cx + Math.sin(a) * SPOT_R, z: cz + Math.cos(a) * SPOT_R });
  }
  let best = null;
  for (const c of cands) {
    if (slotBlockedPublic(world, c.x, c.z, clear)) continue;        // solids (expose slotBlocked)
    if (world.pondAt && world.pondAt(c.x, c.z)) continue;           // ice — thread the mode's pond test
    const h = F.heightAt(c.x, c.z);
    const e = exposureAt(world, c.x, c.z, threatBearing);
    const d = Math.hypot(c.x - cx, c.z - cz);
    if (!best) { best = { x: c.x, z: c.z, h, e, d }; continue; }
    const dh = h - best.h;
    if (dh > SPOT_TIE_M) best = { x: c.x, z: c.z, h, e, d };
    else if (dh > -SPOT_TIE_M) {                                    // near-tie band: cover, then distance
      if (e < best.e - 1e-9 || (Math.abs(e - best.e) <= 1e-9 && d < best.d - 1e-9)) best = { x: c.x, z: c.z, h, e, d };
    }
  }
  return best;                                                       // null only if everything blocked
}
```

```js
// squads.js — sniper stand-point score (spotter alive only): candidates =
// anchor + 8 ring points at 2.5m + the 4 best-height survey leftovers; score =
// count of clear test rays (marchArc-backed arcClears from candidate muzzle
// toward 12 fixed azimuths biased to threatBearing, at effRange samples).
// Highest count wins; ties → nearest anchor. Placement/re-anchor only.
```

- Roles: members tagged `u.role = "sniper" | "spotter"` at spawn; squadFire skips `role === "spotter"`; conversion swaps role+utype to rifles (hp untouched); pruneSquads/selection unchanged (ordinary members).
- Enemy mirror: ENEMY spawn path fields the pair; the marksman's existing vantage march is replaced by: spotter surveys around the hold point, directs identically (shared functions — one behavior module, both signs).
- Renderer (DEPOT-gated): `u.role` drives pose/prop; glint = a small timed sprite at a holding spotter (world.t-driven, no rng); fog seam silhouettes unchanged (role invisible).
- [ ] **Failing asserts:** pair spawns 2 both sides at 45; spotter lands on the true max (knoll fixture: his height ≥ every candidate); cover tiebreak (twin-knoll fixture: equal heights, he takes the covered one); ice/blocked rejection; sniper's directed spot scores ≥ anchor score; spotter fires 0 rounds ever; spotter-death → no re-direction, sniper holds; sniper-death → spotter respec'd rifles, fires, hp carried; enemy pair identical (sign-flipped); affordability paths; rng stream identity on a pairless run; twin determinism with pairs; renderer flag-off byte-identical (td-render).
- [ ] fail → implement → gates (+test:td-render) → Commit "DEPOT: the pair — a scope is only as good as the eyes beside it" → PUSH + report (one phone screenshot: pair on a knoll, glint visible).

---

## Self-review notes
- Order is load-bearing: 1→2 (filter before the shared marcher inherits it), 2→3 (rockets' new lob verdicts come from the one flight model), 1-2→6 (the pair scores on conformant physics). 4 is independent but sequenced before 6 so parity settles once.
- Task 3 carries the one design decision (lob vs reclassify) — recommended lob, Jeff confirms at approval.
- Task 4 is the one balance-touching change (cover gets physically real against small arms) — parity asserts bound it; anything breaching ±10% stops for a rescale decision, not a silent tune.
- The marksmanship-batch plan's Task 3 is superseded by Task 6 here; noted in both docs at implementation time.
