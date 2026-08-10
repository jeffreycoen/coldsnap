# DEPOT Phase 2 Implementation Plan — Conditional Accuracy + Wind

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diegetic, symmetric fire accuracy — a condition-driven scatter cone (range, elevation, LOS graze) replacing perfect aim, plus a seeded wind field that deflects projectiles and is readable from flags and tree sway. No visible percentages anywhere.

**Architecture:** One pure module, `src/depot/accuracy.js`, computes scatter from conditions; towers consume it now, future shooters (Phase 3/5 riflemen/grenadiers, Phase 7 bison) consume the same function — that is the symmetry guarantee. Wind lives as a guarded core hook (`world.depotCombat` + `world.wind`) in projectile integration; the wind *value* is computed in depot code (sum-of-sines from seed — zero rng draws, deterministic at any t). Renderer reads `world.wind` for flags/sway.

**Tech Stack:** existing only. Scoped verification per Jeff's rule: run only the gates named per task locally (+`golden` whenever core.js is touched); full suite is CI's job. Smoke locally via `SMOKE_ONLY=depot`.

## Global Constraints

- `src/game/ColdsnapTD.jsx`, demo, sandbox, campaign untouched. Core/renderer changes guarded so all existing gates stay green.
- No `Math.random()` in `src/depot/` (`npm run lint:depot`). No new `world.rng()` draws in core.js. Wind must draw NO rng anywhere (pure function of t + seed) — multiplayer twin-sims depend on it.
- No hit percentages or wind numbers in any UI. The player reads flags and fall of shot.
- Anchors: DepotGame.jsx tower-fire block ≈ lines 330-370 (scan/lead/volley-spread/fireProjectile); core.js `aimSolve` :105, `stepProjectiles` ≈ :644, wind hook goes in its integration step. Verify anchors by reading before editing.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: accuracy.js — the scatter model (pure, headless-tested)

**Files:**
- Create: `src/depot/accuracy.js`
- Create: `scripts/accuracy-test.mjs`
- Modify: `package.json` (`"test:accuracy": "node scripts/accuracy-test.mjs"`)

**Interfaces:**
- Produces (exact signatures, later tasks + phases depend on them):
  - `scatterSigma(world, muzzle, aim, spec)` → σ in radians. `muzzle`/`aim` are `{x,y,z}`; `spec` needs `{projSpeed, acc}` where `acc` is the shooter's base sigma at reference range.
  - `applyScatter(world, dir, sigma)` → new normalized dir; exactly TWO `world.rng()` draws (angle, magnitude) — draw count is a stability contract for determinism tests.
  - `losGraze(world, muzzle, aim)` → 0..1 graze factor (0 = clean lane).

- [ ] **Step 1: Write failing test** (`scripts/accuracy-test.mjs`, node, no browser):

```js
import { scatterSigma, applyScatter, losGraze } from "../src/depot/accuracy.js";
import { mulberry32 } from "../src/engine/core.js";
let n = 0, ok = 0; const T = (name, c) => { n++; if (c) ok++; else console.error("FAIL", name); };
const w = (bodies = []) => ({ rng: mulberry32(7), bodies, field: { heightAt: () => 0 } });
const spec = { projSpeed: 62, acc: 0.010 };
const M = (y) => ({ x: 0, y, z: 0 }), A = (d, y = 0) => ({ x: 0, y, z: d });
// range widens
T("range", scatterSigma(w(), M(1.5), A(30), spec) > scatterSigma(w(), M(1.5), A(12), spec));
// height advantage tightens, disadvantage widens (same ground distance)
T("high ground", scatterSigma(w(), M(6), A(20, 0), spec) < scatterSigma(w(), M(1.5), A(20, 0), spec));
T("uphill", scatterSigma(w(), M(1.5), A(20, 5), spec) > scatterSigma(w(), M(1.5), A(20, 0), spec));
// graze: a static box near the lane widens; far from lane doesn't
const box = (x, z) => ({ alive: true, kind: "rock", pos: { x, y: 1, z }, hx: 1, hy: 1, hz: 1, invM: 0 });
T("graze widens", scatterSigma(w([box(0.9, 10)]), M(1.5), A(20), spec) > scatterSigma(w(), M(1.5), A(20), spec));
T("clear lane", Math.abs(scatterSigma(w([box(8, 10)]), M(1.5), A(20), spec) - scatterSigma(w(), M(1.5), A(20), spec)) < 1e-9);
T("graze range", losGraze(w([box(0.9, 10)]), M(1.5), A(20)) > 0 && losGraze(w([box(8, 10)]), M(1.5), A(20)) === 0);
// applyScatter: deterministic (same rng state => same dir), unit length, exactly 2 draws
{ const a = { rng: mulberry32(3) }, b = { rng: mulberry32(3) };
  const d1 = applyScatter(a, { x: 0, y: 0, z: 1 }, 0.02), d2 = applyScatter(b, { x: 0, y: 0, z: 1 }, 0.02);
  T("det", d1.x === d2.x && d1.y === d2.y && d1.z === d2.z);
  T("unit", Math.abs(Math.hypot(d1.x, d1.y, d1.z) - 1) < 1e-6);
  T("draws", (a.rng(), b.rng(), a.rng() === b.rng())); }
// sigma 0 => unchanged dir, zero draws? NO — draw-count stability: still 2 draws
{ const a = { rng: mulberry32(9) }; const d = applyScatter(a, { x: 0, y: 0, z: 1 }, 0);
  T("zero sigma", d.z > 0.9999); }
console.log(ok + "/" + n); if (ok !== n) process.exit(1);
```

- [ ] **Step 2: Run to verify fail** — `node scripts/accuracy-test.mjs` → module not found.

- [ ] **Step 3: Implement** `src/depot/accuracy.js`:

```js
// Conditional accuracy — the one scatter model every DEPOT shooter uses
// (towers now; riflemen/grenadiers in Phase 3/5; the bison in Phase 7).
// Pure: no state, rng only inside applyScatter (exactly two draws).
const REF_RANGE = 16;          // acc is calibrated at this ground distance
const RANGE_K = 0.045;         // +4.5% sigma per meter beyond REF_RANGE
const ELEV_K = 0.06;           // per meter of height advantage (signed)
const ELEV_MIN = 0.55, ELEV_MAX = 1.8;   // clamp of the elevation multiplier
const GRAZE_K = 1.6;           // full graze multiplies sigma by 1+GRAZE_K
const GRAZE_MARGIN = 1.25;     // lane half-width (m) that counts as grazing
const GRAZE_STEP = 0.9;        // ray sample spacing (m)

export function losGraze(world, muzzle, aim) {
  // Worst (closest) pass-by of the muzzle->aim segment against static solids.
  // Cheap: point samples vs expanded AABBs of rocks/walls/towers/trees/chunks.
  const dx = aim.x - muzzle.x, dy = aim.y - muzzle.y, dz = aim.z - muzzle.z;
  const len = Math.hypot(dx, dy, dz); if (len < 2) return 0;
  let worst = 0;
  for (const b of world.bodies) {
    if (!b.alive || b.invM > 0) continue;                    // static solids only
    if (b.kind !== "rock" && b.kind !== "wall" && b.kind !== "tower" && b.kind !== "tree" && b.kind !== "chunk") continue;
    // coarse reject: box vs segment AABB
    const r = Math.max(b.hx, b.hz) + GRAZE_MARGIN;
    for (let s = GRAZE_STEP; s < len - GRAZE_STEP; s += GRAZE_STEP) {
      const t = s / len, px = muzzle.x + dx * t, py = muzzle.y + dy * t, pz = muzzle.z + dz * t;
      const cx = Math.abs(px - b.pos.x) - b.hx, cy = Math.abs(py - b.pos.y) - b.hy, cz = Math.abs(pz - b.pos.z) - b.hz;
      const gap = Math.max(cx, cy, cz);                      // >0: outside by gap
      if (gap < 0) continue;                                 // inside = a real obstruction; the round eats it physically
      if (gap < GRAZE_MARGIN) worst = Math.max(worst, 1 - gap / GRAZE_MARGIN);
    }
  }
  return worst;
}

export function scatterSigma(world, muzzle, aim, spec) {
  const ground = Math.hypot(aim.x - muzzle.x, aim.z - muzzle.z);
  const range = 1 + RANGE_K * Math.max(0, ground - REF_RANGE);
  // shooter above target => aim.y - muzzle.y < 0 => tighter; firing uphill => wider
  const elev = Math.min(ELEV_MAX, Math.max(ELEV_MIN, 1 + ELEV_K * (aim.y - muzzle.y)));
  const graze = 1 + GRAZE_K * losGraze(world, muzzle, aim);
  return spec.acc * range * elev * graze;
}

export function applyScatter(world, dir, sigma) {
  // rotate dir by a random small angle around a random axis in its normal plane.
  // ALWAYS two draws (contract: stable draw count regardless of sigma).
  const a = world.rng() * Math.PI * 2;
  const m = Math.sqrt(-2 * Math.log(Math.max(1e-12, 1 - world.rng() * 0.9999))) * sigma * 0.6;
  if (m === 0) return { ...dir };
  // orthonormal basis around dir
  const up = Math.abs(dir.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = dir.z * up.y - dir.y * up.z, uy = dir.x * up.z - dir.z * up.x, uz = dir.y * up.x - dir.x * up.y;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = dir.y * uz - dir.z * uy, vy = dir.z * ux - dir.x * uz, vz = dir.x * uy - dir.y * ux;
  const ox = Math.cos(a) * m, oy = Math.sin(a) * m;
  const nx = dir.x + ux * ox + vx * oy, ny = dir.y + uy * ox + vy * oy, nz = dir.z + uz * ox + vz * oy;
  const nl = Math.hypot(nx, ny, nz);
  return { x: nx / nl, y: ny / nl, z: nz / nl };
}
```

- [ ] **Step 4: Verify pass** — `node scripts/accuracy-test.mjs` → all counts pass. Also `npm run lint:depot`.
- [ ] **Step 5: Commit** — "DEPOT accuracy model: range/elevation/graze scatter (pure module + gate)".

### Task 2: towers fire through the model

**Files:**
- Modify: `src/depot/DepotGame.jsx` (fire block ≈ :330-370), `src/depot/specs.js`
- Modify: `scripts/depot-test.mjs` (extend)

**Interfaces:**
- Consumes: `scatterSigma`/`applyScatter` from Task 1.
- Produces: every tower spec in specs.js gains `acc` (base sigma, radians): mg 0.028, gun 0.012, mortar 0.020, rocket 0.026 (frost has no fire). The old flat volley `(rng-0.5)*3` XZ offset is REMOVED (rocket volley spread now comes from per-shot scatter).

- [ ] **Step 1: Failing asserts in depot-test.mjs**: seeded world, one gun tower on flat ground vs a static dummy at range 18 — fire 40 shots via the exposed fire path (extract the per-shot aim computation from the tower loop into an exported `towerShot(world, tower, target, spec)` in DepotGame.jsx or state.js if needed for headless reach — extraction in scope); assert (a) impact spread stddev > 0 (not laser), (b) same seed twice → identical impact list (determinism), (c) tower raised +4m → mean radial miss distance strictly smaller than at 0m (the diegetic promise, measured).
- [ ] **Step 2: verify fail** → **Step 3: Implement**: compute `sigma = scatterSigma(world, muzzle, {x:ax2,y:ay2,z:az2}, spec)` once per trigger pull; per shot `dir = applyScatter(world, rawDir, sigma)`; delete the ox/oz block.
- [ ] **Step 4: Verify** — `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run test:td` (td: neighbor-mode canary; core untouched this task, golden not needed).
- [ ] **Step 5: Commit** — "DEPOT towers: perfect aim replaced by conditional scatter".

### Task 3: wind — field, core deflection hook, tower compensation error

**Files:**
- Create: `src/depot/wind.js`
- Modify: `src/engine/core.js` (projectile integration inside `stepProjectiles` — the gravity line), `src/depot/DepotGame.jsx` (set `world.wind` each tick; tower aim compensation), `src/depot/specs.js` (per-kind `windF`), `scripts/combat-test.mjs` (extend), `scripts/accuracy-test.mjs` (extend)

**Interfaces:**
- Produces: `windAt(seed, t)` → `{x, z, mag}` — pure sum-of-sines, NO rng:

```js
// src/depot/wind.js — deterministic wind field. Pure function of (seed, t):
// multiplayer twin-sims and resumed runs must agree at any t without replay.
export function windAt(seed, t) {
  const p1 = (seed % 977) * 0.013, p2 = (seed % 761) * 0.017, p3 = (seed % 541) * 0.029;
  const dir = p1 * 6.283 + Math.sin(t * 0.011 + p2) * 1.1 + Math.sin(t * 0.0037 + p3) * 1.9; // slow heading drift
  const mag = 2.2 + 2.0 * Math.sin(t * 0.019 + p3) + 1.4 * Math.sin(t * 0.0071 + p1);        // 0..~5.6 m/s envelope
  const m = Math.max(0, mag);
  return { x: Math.cos(dir) * m, z: Math.sin(dir) * m, mag: m };
}
```

- Core hook (guarded, in the projectile integration where gravity applies — read the exact line first):
```js
// DIVERGENCE (guarded): DEPOT wind — lateral drag toward the wind vector,
// scaled per projectile kind (spec.windF, 0 when absent). High arcs eat the
// most wind purely because they fly longer; windF separates mg (nearly
// immune) from mortar/rocket (kited). No rng; world.wind is set by the mode.
if (world.depotCombat && world.wind && p.spec.windF) {
  p.v.x += (world.wind.x - p.v.x * 0.02) * p.spec.windF * dt;
  p.v.z += (world.wind.z - p.v.z * 0.02) * p.spec.windF * dt;
}
```
- specs.js `windF`: mg 0.06, gun shell 0.45, mortar 1.1, rocket 1.3. Enemy grenades later reuse mortar's.
- DepotGame tick: `world.wind = windAt(S.seed, world.t)` every frame (before stepWorld).
- Tower compensation: towers aim with PARTIAL wind hold-off — `windComp` per spec (gun 0.7, mortar 0.5, rocket 0.5, mg 0): offset the aim point by `-wind * windF * tof * windComp` (tof from the existing lead loop). Imperfect by design; doctrine (RANGEFINDERS) raises it in Phase 6.

- [ ] **Step 1: Failing tests**: combat-test — flat-fire shell with `windF` under strong constant `world.wind` lands strictly leeward vs zero-wind twin (same seed); unflagged world identical trajectories with/without world.wind (guard proof); windAt determinism (two calls same args identical, no world needed). accuracy-test — windAt envelope bounds (0 ≤ mag ≤ 6 over t 0..600 sampled per second).
- [ ] **Step 2: verify fail** → **Step 3: Implement** (core hook + wind.js + tick wiring + compensation) → **Step 4: Verify** — `npm run test:combat && npm run test:accuracy && npm run test:depot && npm run golden && npm run test:righting && npm run lint:depot` (core touched → golden+righting mandatory).
- [ ] **Step 5: Commit** — "Wind: seeded field, guarded projectile deflection, partial tower hold-off".

### Task 4: reading the wind — flags + tree sway (renderer)

**Files:**
- Modify: `src/render/renderer.js` (flag + sway, keyed on `world.wind` presence), `src/depot/DepotGame.jsx` (flag placement data)
- Modify: `scripts/td-render-test.mjs` ONLY IF its assertions break (it must keep passing untouched-mode renders).

**Interfaces:**
- Produces: renderer draws a flag (pole + cloth quad/tri strip, survey-stake pennant machinery is the pattern — bright gold 0xffc95c family already proven visible) at each body carrying `b.flagPole = true`; cloth angle = atan2(wind.z, wind.x), ripple amplitude and stiffness scale with `wind.mag` (flutter off `world.t`, no rng). DEPOT sets `flagPole` on the depot + every tower at spawn. Tree sway: existing tree render gains a lean/oscillation scaled by `wind.mag` for worlds where `world.wind` exists — zero change when absent (all other modes).
- [ ] **Step 1:** Read the survey-stake pennant code in renderer.js; implement flags + sway behind `world.wind` presence checks.
- [ ] **Step 2: Verify** — `npm run test:td-render && npm run test:depot`; build; `SMOKE_ONLY=depot node scripts/smoke.mjs` locally; puppeteer screenshots: calm vs strong-wind moments (use a seed/t with known windAt values via the debug harness) — flags visibly angled+rippling, trees leaning; save to the phase workspace.
- [ ] **Step 3: Commit** — "Flags and tree sway: the wind is readable, never printed".

### Task 5: DEPOT tree hp retune (parked Phase-1 item — burning must be visible)

**Files:**
- Modify: `src/depot/DepotGame.jsx` (tree creation: hp 25 → 70), `scripts/depot-test.mjs`
- [ ] **Step 1:** Failing assert: direct gun-shell hit (55 point-blank + glancing ≈ ≤55+dmg) on a 70hp DEPOT tree leaves it ALIVE and BURNING (b.burning set, alive true), dead within ~20s of ignition via the 2hp/s burn (plus any residual). MG still fells in ~18 hits (4/hit).
- [ ] **Step 2: verify fail** → **Step 3:** retune hp (and ONLY hp — burn rate stays 2/s) → **Step 4:** `npm run test:depot && npm run test:combat`; browser screenshot of a burning-alive tree (now reachable) → **Step 5: Commit** — "DEPOT trees: hp 70 — shells ignite, fires burn visibly before the fall".

### Task 6: accuracy probe + CI + prod

**Files:**
- Create: `scripts/accuracy-probe.mjs` (NOT a gate — a tuning report: hit% tables for each tower type at range {10,16,22,28} × elevation {-4,0,+4} × wind {0, 3, 5.5} vs a conscript-sized target, 200 seeded shots per cell, prints a matrix; used to eyeball Phase 2 numbers and re-tune constants)
- Modify: `.github/workflows/deploy.yml` (add `test:accuracy` after `test:depot`)
- [ ] **Step 1:** Build the probe; run it; paste the matrix into the report; SANITY: no cell at 0% or 100% except mg beyond its range; if a cell is degenerate, adjust the Task 1 constants (RANGE_K/ELEV_K/GRAZE_K) or spec `acc`/`windF` values, re-run gates, and record the final numbers in the report AND update the plan constants inline.
- [ ] **Step 2:** Wire CI; commit; push; `gh run watch` to success; `SMOKE_URL=https://jeffreycoen.github.io/coldsnap/ SMOKE_ONLY=depot node scripts/smoke.mjs` ALL PASS.
- [ ] **Step 3: Commit/report** — "Accuracy probe + CI: test:accuracy gated, tuned matrix recorded".

---

## Self-review notes

- Symmetry delivered as shared-module architecture (towers now; Phase 3/5 shooters and Phase 7 bison consume the same functions — stated in accuracy.js header).
- Wind is rng-free end-to-end; scatter uses exactly two draws per shot — both are multiplayer-facing determinism contracts, both asserted.
- Diegetic constraint held: no numbers in UI anywhere in this plan; the probe is a dev script.
- Parked Phase-1 item (burning visibility) resolved in Task 5.
- Constants are proposals; Task 6's probe is the tuning loop that finalizes them — expected drift is numbers, not structure.
