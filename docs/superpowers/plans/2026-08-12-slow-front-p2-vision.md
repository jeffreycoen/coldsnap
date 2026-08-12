# SLOW FRONT — Phase 2: Vision (mk0.70)

*2026-08-12. One plan, one audience. Every design decision in here was ratified by the owner today; nothing is open. Four tasks, sequential, sole agent each: mk0.70, mk0.71, mk0.72, mk0.73. All numbers marked provisional are tuned by the owner's playtests.*

*AMENDED after Task 1 landed: its cost probe measured the plan's original see/not-see test at 2,284ms per recompute against a 4ms budget — the test asked every body in the world at every step of every sight line. Task 1b (mk0.71) replaces the ray's inner loop with two flat per-cell maps swept once per recompute; the gate swap and the look shift to mk0.72/mk0.73.*

## What this phase does

Today you can shoot anything standing on ground your side controls. After this phase, **you can only shoot what your side can actually see** — and so can the enemy. Every living unit, every tower, and each depot has eyes. Sight is blocked by terrain and by solid things (rocks, walls, towers, trees, rubble); a raised eye — a tower, a man on a hill — sees over lower obstructions. Snipers and spotters see farthest. Where your side has no sight, enemies are simply not drawn, and the on-screen fog now shows what you *see* rather than what you *hold*. The colored ground wash is unchanged — it still shows who holds the ground, which still governs where you may build.

**Decisions of record (owner, 2026-08-12):** sight gates every shot, structures included · eyes = every friendly unit + tower + the depot · **walls and sandbags are never eyes — they block sight, they don't grant it** · per-type sight distances, snipers/spotters farthest · unseen enemies vanish, no half-visible middle state · ground-ownership wash and build rights stay territory-based · sight blocked by buildings and terrain, elevation sees over.

**Laws that bind every task:** no randomness anywhere in sight (it is pure geometry — the seeded-dice stream must not move by even one draw) · engine files untouched (`core.js`, demo, renderer contract unchanged) · test only what changed, run only the gates listed · one agent at a time · report every deviation as its own bullet.

---

## Task 1 — The eye itself (mk0.70): `src/depot/sight.js`, inert

A new module that can answer "can this eye see that spot?" and keep a map of everything each side sees. Nothing imports it yet — the game plays exactly as before. This task is pure machinery plus its tests, so the risky geometry is proven before anything is wired to it.

**Step 1.1 — failing tests first.** Add a `==== VISION T1: sight` block to `scripts/depot-test.mjs` asserting, against hand-built fixture worlds: (a) an eye sees a clear spot in range and not one beyond range; (b) a ridge between eye and spot blocks it; (c) a wall (three stacked courses, `spawnWallCourses`) blocks a ground-level eye but NOT an eye raised 3m; (d) a spot on a hill is visible from below when nothing intervenes; (e) the team sight map marks an enemy-held corner dark for team 1 and lit for team 2 when only team-2 eyes stand there; (f) two identical worlds produce byte-identical sight maps (determinism); (g) building the map draws zero values from the world's dice (`world.rng` call-count wrap); (h) walls and sandbags are NOT eyes (owner's rule, 2026-08-12): a world holding only a wall line and a sandbag ring produces an all-dark sight map for both sides — they block sight, they never grant it. Run: they must fail (module absent), then pass after 1.2–1.4.

**Step 1.2 — the module.** Create `src/depot/sight.js`:

```js
// COLDSNAP DEPOT — sight.js: who sees what. Pure geometry, zero rng draws.
// A side's sight is the union of what its eyes see. An eye is a raised point
// on a living body; a spot is seen if a straight line from the eye to the
// spot (at man height) clears the terrain and every solid thing in between.
// Elevation is the whole trick: a higher eye's line passes over low cover.
import { solidBlocksPoint } from "./accuracy.js";

// How far each kind of eye sees (meters). Wider than any gun it guides —
// a gun must never out-range its own eyes. // all provisional (F5)
export const SIGHT = {
  unit: 24,        // any infantryman, either side
  sniper: 40,      // a marksman's scope (u.tag or u.role "sniper")
  spotter: 46,     // the binoculars — the pair's whole point (u.role)
  vehicle: 36,     // tank commander, above ENEMY_FIRE.tank.range 34
  tower: 32,       // tall — covers every tower gun's range
  flag: 36,        // the depot garrison, watching from the yard
};
// The eye sits above the body: a man's eyes, a tower's top, the banner.
export function eyeOf(b) {
  if (b.kind === "tower") return { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z, r: SIGHT.tower };
  if (b.kind === "flag")  return { x: b.pos.x, y: b.pos.y + 4.0, z: b.pos.z, r: SIGHT.flag };
  if (b.kind === "vehicle") return { x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z, r: SIGHT.vehicle };
  const r = b.role === "spotter" ? SIGHT.spotter
          : (b.role === "sniper" || b.tag === "sniper") ? SIGHT.sniper : SIGHT.unit;
  return { x: b.pos.x, y: b.pos.y + 0.5, z: b.pos.z, r };
}
// TARGET_H: a spot is "seen" at man height, not at the dirt — the same 1.2m
// convention the reach preview uses (accuracy.js TARGET_H).
export const SIGHT_TARGET_H = 1.2;
const STEP = 0.9; // sample spacing along the line — losGraze's own stride

// canSee: march the straight eye→spot line; terrain above the line blocks,
// a solid box on the line blocks (the eye's own body excluded via selfId).
export function canSee(world, eye, tx, tz, selfId) {
  const dx = tx - eye.x, dz = tz - eye.z;
  const d = Math.hypot(dx, dz);
  if (d > eye.r) return false;
  if (d < STEP) return true;                       // point-blank: no tested span
  const ty = world.field.heightAt(tx, tz) + SIGHT_TARGET_H;
  for (let s = STEP; s < d - STEP; s += STEP) {
    const t = s / d;
    const x = eye.x + dx * t, z = eye.z + dz * t, y = eye.y + (ty - eye.y) * t;
    if (world.field.heightAt(x, z) > y) return false;       // the ground rises into the line
    if (solidBlocksPoint(world, x, y, z, selfId)) return false; // something solid stands in it
  }
  return true;
}
```

**Step 1.3 — the sight map.** Append to `sight.js`. The map shares the territory grid's own frame (2m cells, canonical coordinates) and is stored ON the territory object as `T.sight`, so every function already handed `T` gets sight for free — zero re-plumbing. One eye per occupied cell per team (the tallest), so a hundred conscripts cost what a handful of cells cost:

```js
// makeSight(T): two byte maps over the territory grid — seen1[i]=1 where
// team 1 sees cell i, seen2 likewise. Derived state: never saved, rebuilt
// on resume by the first recompute.
export function makeSight(T) {
  return { nx: T.nx, nz: T.nz, cs: T.cs, halfU: T.halfU, halfV: T.halfV,
           seen1: new Uint8Array(T.nx * T.nz), seen2: new Uint8Array(T.nx * T.nz) };
}
export function seenAt(SG, x, z, team) {
  const ix = Math.floor((x + SG.halfU) / SG.cs), iz = Math.floor((z + SG.halfV) / SG.cs);
  if (ix < 0 || ix >= SG.nx || iz < 0 || iz >= SG.nz) return false;
  return (team === 2 ? SG.seen2 : SG.seen1)[iz * SG.nx + ix] === 1;
}
// stepSight(world, SG, toUV, toWorld): full recompute. Deterministic —
// bodies iterate in world order; no dice. toUV/toWorld are DEPOT's own
// world↔canonical transforms (invW/fwdU), passed in like everywhere else.
export function stepSight(world, SG, toUV, toWorld) {
  SG.seen1.fill(0); SG.seen2.fill(0);
  // one eye per occupied cell per team — the tallest wins the cell
  const eyes1 = new Map(), eyes2 = new Map();
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const isEye = b.kind === "unit" || b.kind === "vehicle" || b.kind === "tower" || b.kind === "flag";
    if (!isEye || (b.team !== 1 && b.team !== 2)) continue;
    const e = eyeOf(b); e.selfId = b.id;
    const c = toUV(e.x, e.z);
    const key = Math.floor((c.u + SG.halfU) / SG.cs) + (Math.floor((c.v + SG.halfV) / SG.cs) * SG.nx);
    const m = b.team === 2 ? eyes2 : eyes1;
    const prev = m.get(key);
    if (!prev || e.y > prev.y) m.set(key, e);
  }
  const sweep = (eyes, seen) => {
    for (const e of eyes.values()) {
      const cellR = Math.ceil(e.r / SG.cs);
      const c = toUV(e.x, e.z);
      const cx = Math.floor((c.u + SG.halfU) / SG.cs), cz = Math.floor((c.v + SG.halfV) / SG.cs);
      for (let iz = Math.max(0, cz - cellR); iz <= Math.min(SG.nz - 1, cz + cellR); iz++) {
        for (let ix = Math.max(0, cx - cellR); ix <= Math.min(SG.nx - 1, cx + cellR); ix++) {
          const i = iz * SG.nx + ix;
          if (seen[i]) continue;                       // another eye already lit it
          const u = -SG.halfU + (ix + 0.5) * SG.cs, v = -SG.halfV + (iz + 0.5) * SG.cs;
          const w = toWorld(u, v);
          if (canSee(world, e, w.x, w.z, e.selfId)) seen[i] = 1;
        }
      }
    }
  };
  sweep(eyes1, SG.seen1);
  sweep(eyes2, SG.seen2);
}
```

**Step 1.4 — cost probe, not a guess.** The Pi is physics-bound (the C0 baseline), so the recompute's real cost gets measured before Task 2 wires it live. Add a scratch script `.superpowers/sight-cost.mjs` (uncommitted) that builds the real map with a mid-fight body count (~120 troops staged via the existing debug hooks pattern), runs `stepSight` 100 times, and reports milliseconds per recompute. **Report the number.** The budget: at 4 recomputes a second, one recompute must stay under ~4ms. If it misses, the fallback dial is written in Task 2 (recompute rate 4Hz → 2Hz — one constant), not a redesign.

**Gates (run ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (new block passes, nothing else re-pinned — the module is inert) · build after bumping `src/version.js` to mk0.70 · `SMOKE_ONLY=depot` smoke (must be untouched-green; no game path changed). Commit "(mk0.70)", push, CI green.

---

## Task 1b — The fast eye (mk0.71): cell maps instead of body walks

Same answers, a thousandth of the work. Once per recompute, sweep the world ONCE into two flat maps over the sight grid — the ground's height at each cell, and the top of the tallest solid standing in each cell. A sight line then marches cell by cell reading two numbers per step, touching no body at all. Blocking becomes map-resolution (a solid blocks its whole 2m cell) — coarser than the exact box test, deterministic, and stated here as the accepted trade.

**Step 1b.1 — re-pin the T1 tests honestly.** The 22 `VISION T1` asserts keep their meanings (a-h all still hold at cell resolution) but their fixture geometry must place blockers and eyes in distinct cells; re-pin coordinates where the old sub-cell placements straddle boundaries. Report every re-pin old→new. Add: (i) a recompute at the probe's 120-troop body count measures under 4ms headless on the Pi (a real timing assert with a generous 3× ceiling, so CI catches a future regression of this exact kind).

**Step 1b.2 — the maps.** In `src/depot/sight.js`, extend `makeSight` and add the sweep:

```js
// two flat maps, swept fresh each recompute:
//   gnd[i]  — the ground's height at cell i's center
//   occ[i]  — the top of the tallest solid standing in cell i (-Infinity when empty)
// A sight line reads these instead of asking bodies. gnd is filled once
// (terrain only re-carves on craters; per-recompute fill is still cheap and
// always true), occ every recompute (walls fall, rubble moves).
export function makeSight(T) {
  return { nx: T.nx, nz: T.nz, cs: T.cs, halfU: T.halfU, halfV: T.halfV,
           seen1: new Uint8Array(T.nx * T.nz), seen2: new Uint8Array(T.nx * T.nz),
           gnd: new Float32Array(T.nx * T.nz), occ: new Float32Array(T.nx * T.nz) };
}
const SOLID = new Set(["rock", "wall", "tower", "tree", "chunk"]); // accuracy.js's own set
export function fillMaps(world, SG, toUV, toWorld) {
  for (let iz = 0; iz < SG.nz; iz++) for (let ix = 0; ix < SG.nx; ix++) {
    const w = toWorld(-SG.halfU + (ix + 0.5) * SG.cs, -SG.halfV + (iz + 0.5) * SG.cs);
    SG.gnd[iz * SG.nx + ix] = world.field.heightAt(w.x, w.z);
  }
  SG.occ.fill(-Infinity);
  for (const b of world.bodies) {
    if (!b.alive || !SOLID.has(b.kind)) continue;
    if (b.invM > 0 && b.kind !== "chunk" && b.kind !== "tree") continue; // solidBlocksPoint's own mobility rule
    const c = toUV(b.pos.x, b.pos.z);
    const rr = Math.max(b.hx, b.hz);                    // conservative footprint under rotation
    const top = b.pos.y + b.hy;
    const ix0 = Math.max(0, Math.floor((c.u - rr + SG.halfU) / SG.cs));
    const ix1 = Math.min(SG.nx - 1, Math.floor((c.u + rr + SG.halfU) / SG.cs));
    const iz0 = Math.max(0, Math.floor((c.v - rr + SG.halfV) / SG.cs));
    const iz1 = Math.min(SG.nz - 1, Math.floor((c.v + rr + SG.halfV) / SG.cs));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * SG.nx + ix;
      if (top > SG.occ[i]) SG.occ[i] = top;
    }
  }
}
```

**Step 1b.3 — the march reads maps.** Replace `canSee`'s inner loop and `stepSight`'s sweep: the line from eye to cell center is walked at cell pitch in CANONICAL space, comparing the line's height against `max(gnd[i] , occ[i])` at each intermediate cell. The eye's own cell and the target's own cell are never tested (an eye is not blocked by the wall it stands on; a target is seen at its own cell, not through it). `stepSight` calls `fillMaps` once, then sweeps eyes exactly as before with the map-marching `canSee`. The exact-box `canSee` signature survives (tests and Task 2's callers see no API change); `solidBlocksPoint` import goes away.

```js
export function canSee(SG, eye, eu, ev, tu, tv) {
  // eye: {y, r, iu, iv} with grid indices precomputed by the sweep; (tu,tv)
  // the target cell's indices. Marches the index-space line, longest axis
  // stepped 1 cell at a time (the same integer walk the engineer line uses).
  const du = tu - eye.iu, dv = tv - eye.iv;
  const n = Math.max(Math.abs(du), Math.abs(dv));
  if (n * SG.cs > eye.r + SG.cs) return false;
  const ty = SG.gnd[tv * SG.nx + tu] + SIGHT_TARGET_H;
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const iu = Math.round(eye.iu + du * t), iv = Math.round(eye.iv + dv * t);
    const i = iv * SG.nx + iu;
    const y = eye.y + (ty - eye.y) * t;
    if (SG.gnd[i] > y || SG.occ[i] > y) return false;
  }
  return true;
}
```

(The agent reconciles the exact signature/precompute against the T1 code as landed — the plan's shape is binding, variable spelling is not. Range check stays true to `eye.r` in meters; the `n * SG.cs` pre-cut above is the coarse reject, the true meter distance check from T1 remains.)

**Step 1b.4 — re-measure.** The same probe, same 120-troop census: report ms per recompute. Budget 4ms. If it still misses, STOP and report — no further design on the fly.

**Gates (ONLY these):** parse · lint:depot · test:depot (re-pins listed) · build after bump to mk0.71 · SMOKE_ONLY=depot smoke. Module stays inert. Commit "(mk0.71)", push, CI green.

---

## Task 2 — One law: you shoot what you see (mk0.72)

The shared gate that every shot already passes through switches from ground-control to sight, and the special cases die. This is the behavior task; the look is Task 3.

**Step 2.1 — failing tests first.** In `scripts/depot-test.mjs`, before touching code: (a) fixture — a tower with a live enemy in range but behind a ridge with no friendly eye beyond it must NOT acquire; walk a friendly unit over the ridge crest → next scan acquires; (b) an enemy rifleman must not fire on a player wall his side cannot see, and must fire once an enemy body crests the hill; (c) the contested-boundary fixtures at `depot-test.mjs:1012-1016` and the territory-anchor note at `:1160-1168` are RE-PINNED to sight behavior (the one-cell-grace bridge is gone — men at contact see each other by geometry, which is the same playable result); (d) the resume round-trip still boots and the first tick rebuilds sight (save file carries nothing new). Expect (a)/(b) to fail until 2.3-2.5 land. Every re-pin reported old→new.

**Step 2.2 — the map lives and ticks.** `src/depot/DepotGame.jsx` — at the territory build site (`makeTerritory` result `T`, near line 887): `T.sight = makeSight(T)`. In the territory accumulator block (`TERR_STEP = 0.25`, line ~891), the same cadence drives sight:

```js
terrAcc += world.dt;
if (terrAcc >= TERR_STEP) {
  terrAcc -= TERR_STEP;
  stepTerritory(T, buildEmitters(), TERR_STEP);
  stepSight(world, T.sight, invW, fwdU);   // sight recomputes on the territory clock
}
```

(Adapt to the accumulator's real local names — read the block; the addition is the one `stepSight` call. If Task 1's measured cost demands it, add `const SIGHT_EVERY = 2` and skip alternate ticks — the dial, pre-authorized, default 1.)

**Step 2.3 — the gate swap.** `src/depot/state.js:29-32` — `fieldReaches` becomes a sight read. The two escape hatches keep every bare test fixture working exactly as documented today (no territory → ungated; territory without a sight map → ungated):

```js
// Targeting gate, symmetric, VISION era: a shooter of `team` may only
// acquire a target its own side SEES. Ground control no longer gates any
// shot — sight does. (x, z) is canonical, converted by callers via invW,
// exactly as before. No T, or a T with no sight map wired -> ungated,
// the same fixture contract fieldReaches has always had.
export function fieldReaches(T, x, z, team) {
  if (!T || !T.sight) return true;
  return seenAt(T.sight, x, z, team);
}
```

Import `seenAt` from `./sight.js`; delete the `fogStateForContested` import (`state.js:11`).

**Step 2.4 — the bridge dies.** `src/depot/territory.js:88-106` — delete `fogStateForContested` whole (its own deletion marker has named this phase since mk0.26). `fogStateFor`/`valueAt`/`holderAt`/`canBuild` stay untouched — ownership still paints the ground and gates building.

**Step 2.5 — structures join the law.** The "structure fire is never gated" carve-outs exist because a wall's own territory emission made it forever untargetable under the old gate — a pathology sight does not have (a visible wall is visible). Add the same one-line sight check the unit paths already get via `fieldReaches`:

- `src/depot/units.js` stepTank structure scan (~:153, inside the loop, after the `hostileStructure` filter): `const c = toUV(s.pos.x, s.pos.z); if (!fieldReaches(T, c.u, c.v, 2)) continue;` — and delete the long no-gate NOTE comment above it (:140-152), replacing it with two lines: sight gates structures now; the old emission pathology died with the ground gate.
- Same addition + comment replacement in stepRifleman's sticky structure check (~:307) and scan (~:322), and stepGrenadier's (~:399, ~:413).
- `src/depot/state.js` squadFire's structure fallback scan (~:542-548): same check with `squad.team`.
- Sappers plant at CONTACT range (arm's length against the stone) — the planter is himself an eye standing on the spot, so the plant stays ungated, stated here as the rule rather than left as an accident.

**Step 2.6 — the tower's sticky-target line.** `src/depot/DepotGame.jsx:389-398` already routes through `fieldReaches` — no code change, but re-read both call sites after 2.3 and confirm the comment at :383-388 still tells the truth; amend its wording (territory → sight) so the file does not lie.

**Gates (ONLY these):** parse · lint:depot · test:depot (2.1's asserts now green; full re-pin list in report) · build after bump to mk0.72 · SMOKE_ONLY=depot smoke · resume round-trip staged check (save at a bell, reload, confirm sight rebuilds and no error). Commit "(mk0.72)", push, CI green.

---

## Task 3 — The look follows the eyes (mk0.73)

Enemies your side cannot see are not drawn, and the screen's fog becomes a picture of sight. One file's sampler changes; the renderer itself is untouched.

**Step 3.1 — the sampler swap.** `src/depot/DepotGame.jsx:1028-1037` — the renderer's `territory.sample` (world-space, drives per-frame enemy visibility and the terrain fog cast) switches to the sight map; `sampleUV` (grid-line ownership tint) and `sampleVal` (ownership wash) stay on the territory field, per the decision that the ownership wash survives:

```js
territory: {
  T,
  toWorld: fwdU,
  // VISION: what the screen hides now follows what your side SEES.
  // Binary — a spot is seen or it is not; the old "seam" middle state
  // never fires, so the renderer's silhouette branch simply goes quiet.
  sample: (x, z) => { const c = invW(x, z); return seenAt(T.sight, c.u, c.v, 1) ? "held" : "unheld"; },
  sampleUV: (u, v) => fogStateFor(T, u, v, 1),   // grid tint: ownership, unchanged
  sampleVal: (x, z) => { const c = invW(x, z); return valueAt(T, c.u, c.v); }, // wash: ownership, unchanged
},
```

The renderer already does the rest with no edits: `renderer.js:1491-1492` skips unseen enemy units, `:1331-1332` hides unseen vehicles, and the fog terrain cast (`:529`) darkens ground you cannot see. The silhouette branch becomes unreachable — leave it; deleting renderer code is not this phase's business.

**Step 3.2 — smoke re-pin.** The fog assert in `scripts/smoke.mjs` reads `__DEPOTFOGDBG__` (total vs visible enemy bodies). Re-pin its expectation to sight behavior on the staged scenario (report old→new). No new smoke sections.

**Step 3.3 — the owner checks live.** No screenshots. Deploy and say what to look at: enemies popping out of dead ground as your men crest a hill; a tower's far field lit by its own height; the dark third of the map where you have no eyes; the ownership wash unchanged beneath all of it; and the FOG menu toggle still flips visuals only.

**Step 3.4 — Pi cost verification.** With sight live, one `?perf=1` probe run at a staged 120-troop fight (the C0 method): report sim ms with sight against the C0/T4-era baseline. Over budget → flip the pre-authorized dial (`SIGHT_EVERY 2`) and report both numbers.

**Gates (ONLY these):** parse · lint:depot · test:depot · build after bump to mk0.73 · SMOKE_ONLY=depot smoke (re-pinned fog assert green). Commit "(mk0.73)", push, CI green.

---

## Sequencing and close

T1 → T1b → T2 → T3, sole agent each, CI-green between, every dispatch carrying this plan as its brief plus read-confirmation on: this plan; `sight.js` (T2/T3); `territory.js`; `accuracy.js:27-52` (`solidBlocksPoint`) and `:194-223` (`reachPolygon` — its fog-boundary line at `:217` rides `fieldReaches` and needs no edit, verify only); `units.js` (all four shooter sites); `state.js:29-55` + squadFire; `DepotGame.jsx` territory/renderer-interface/stepTowers regions; `save.js` laws header; `scripts/depot-test.mjs` — grep `fieldReaches|fogStateForContested|reachPolygon` (37 hits at writing) before editing.

Phase closes on the owner's playtest: sight replacing territory in the fight's feel — snipers as eyes, dark flanks as real danger, towers watching far ground — with the ownership wash and build rules unmoved.

**Known consequences, stated:** mortars and rockets can no longer bombard structures nobody sees (that is the point); a wiped flank goes fully dark including its terrain cast; sight ranges are all provisional and the table (`SIGHT`, sight.js) is the one dial; the spotter is now the best pair of eyes on the field, which quietly buffs the sniper pair both sides carry.
