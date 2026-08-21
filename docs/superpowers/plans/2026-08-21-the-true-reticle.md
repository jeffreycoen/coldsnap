# THE TRUE RETICLE — task plan (proposed mark mk2.01)

**Goal.** The ring becomes the landing bound: center at the predicted impact, radius at the hard edge of the scatter draw, integrated with the engine's own flight arithmetic. The surface law replaces the steering clamp (rooftops targetable, nothing blocks the steer). Blazing crimson with the fog opt-out, and the large crosshair.

**Suggested model:** Sonnet 5 — every code block below is complete; the work is mechanical placement and gate runs.

**Symmetry:** the possession interface is player-only by nature; no counterpart exists. No ruling needed.

**Rulings recorded (owner, 2026-08-21):** the ring bounds LANDING points only — blast reaches beyond it. The reticle's movement is limited by nothing but sight; what cannot be hit shows itself by where the ring parks. Auto-firing mortars choosing rooftops stays in the later ballistics pass.

**Design choices (owner checks live):** crimson 0xf0143c; crosshair bars 0.12 wide, 0.85 long, riding at 1.35 ring radii; 16 bound rays. His eye rules the shipped values.

**Why the bound is a true bound:** `applyScatter`'s deflection magnitude is `sqrt(-2·ln(max(1e-12, 1 - rng·0.9999)))·sigma·0.6` — at rng→1 that is `sqrt(-2·ln(1e-4))·0.6·sigma ≈ 2.5751·sigma`, a hard cap. Rays deflected by exactly that cap, integrated with the same gravity, wind-drag, and step the engine runs, land at the ring's edge; every real draw is inside it. Solids are map-resolution (the sight grid's `occ`), the accepted trade everywhere else in sight.

## Required reading (verified against the live tree)

- `src/depot/accuracy.js:1-20, 191-198, 286-302` — the module head, scatterSigma, applyScatter (the formula the cap and `deflect` mirror)
- `src/engine/core.js:105-111, 706-725` — aimSolve; the projectile step's gravity and wind-drag lines the predictor mirrors
- `src/depot/state.js:367-444` — shooterFire (the aim math predictRing mirrors)
- `src/depot/state.js:706-750` — possessedVolley/possessedTowerFire (the tgt lines that gain aim.y)
- `src/depot/drivers.js:526-560` — possessedArmorFire/possessedArmorMg (same tgt lines)
- `src/depot/sight.js:187-224` — clampToImpact (deleted) and its neighborhood
- `src/depot/DepotGame.jsx:21, 26, 33` — the three import lines
- `src/depot/DepotGame.jsx:1343, 1752, 1873, 1888, 1919` — the reticleHit state and hygiene lines
- `src/depot/DepotGame.jsx:3390-3420` — the frame loop's reticle block
- `src/depot/DepotGame.jsx:3668-3692` — the ring block and setReticle call
- `src/render/renderer.js:1318-1345` — retRing and setReticle
- `scripts/tests/04-vision-command-possession.mjs:5, 10, 1546-1551, 2009-2153` — the imports, the T5(a) pin, the mk1.99 and mk2.00 blocks this task rewrites

## Trap notes

- The T4(g) pins match the steer, reclamp, and derive lines byte-for-byte — the frame-loop replacement below keeps all three verbatim.
- The mk1.99(g) scatterSigma pin matches `const sig9 = scatterSigma(world, muzzle9, aim9, { ...spec9, acc: spec9.acc * POSSESS_ACC });` byte-for-byte — the ring block keeps that exact line.
- The mk2.00(c) pin regexes the whole `setReticle(on, x, z, y, r, hit) {` … `\n    },` block — the rewrite keeps that signature and closing shape.
- `renderer.js:742` and `:764` hold other meshes in the old red — touch neither.
- `STEP = 1/120` (`DepotGame.jsx:3173`) is the sim step; the predictor's default dt matches it.
- Line numbers are anchors; match by quoted code if drifted, stop if the quoted code cannot be found.

## The sweep license

Licensed REMOVALS (their subject, `clampToImpact`, is deleted by this task) and re-teaches, every one reported in the landing report. Any other failing test stops the task.

Removals (8 checks):
- mk1.99(a) 1 check, mk1.99(b) 2 checks, mk1.99(c) 1 check — the clampToImpact behavior tests (`:2020-2048`), removed with their `bareSG` helper.
- mk1.99(g)'s clampToImpact source pin (`:2083-2084`), 1 check — the pinned line is deleted.
- mk2.00(a) 2 checks, mk2.00(b) 1 check — the destination-cell tests (`:2110-2131`), removed with that block's `idUV`/`bareSG` helpers.

Re-teaches (2 checks, in place):

| Test | Old | New |
|---|---|---|
| `:1549-1550` T5(a) | `...established red, solid", /setReticle\(on, x, z, y, r, hit\)/.test(rendSrc) && /0xff4a3c/...` | `...crimson, solid (re-taught mk2.01)", /setReticle\(on, x, z, y, r, hit\)/.test(rendSrc) && /0xf0143c/...` (only the label suffix and the color literal change) |
| `:2134-2137` mk2.00(c) | `.../RingGeometry\(0\.7, 1\.0, 44\)/.test(block) && /0xff4a3c/.test(block)` | label gains `(re-taught mk2.01)`; `/0xff4a3c/` → `/0xf0143c/`; the RingGeometry regex stays |

## Steps

### Step 1 — baseline, then the failing tests

Run `node scripts/gate.mjs depot-test` on the clean tree; record the PASS count (expected 1728).

Test-file surgery on `scripts/tests/04-vision-command-possession.mjs`:
- Line 5 (the accuracy import) gains `applyScatter, SCATTER_CAP, deflect, flightImpact, predictRing` after `bracedAt`.
- Line 10 (the sight import): `clampToImpact` → `surfaceAt`.
- In the mk1.99 block: delete the `bareSG` const (`:2013-2016`) and the three sub-blocks (a), (b), (c) (`:2018-2048`, from `// (a) a clean line:` through the (c) block's closing brace). In the (g) sub-block delete the two lines of the clampToImpact pin (`:2083-2084`). The block's head comment and everything else stays.
- In the mk2.00 block: delete the `idUV` and `bareSG` consts and the (a) and (b) sub-blocks (from `const idUV` after the block's opening brace through the (b) sub-block's closing brace, `:2107-2131`). The (c), (d), (e) pins stay.
- Apply the two re-teaches from the sweep table.
- Append the new block after `// ==== end THE RETICLE, SECOND PASS (mk2.00)`:

```js
// ==== THE TRUE RETICLE (mk2.01) =============================================
// The ring is the landing bound: nominal trajectory integrated with the
// engine's own arithmetic, radius at applyScatter's hard cap. The surface
// law aims the guns at whatever the reticle rests on (rooftops included);
// nothing blocks the steer. Pure helpers on hand-built maps; wiring pinned
// by source regex, the file's own convention.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });
  const wallSG = () => { const SG = bareSG(); for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3; return SG; }; // a 3m wall at u≈11

  // (a) the cap is the formula's own tail: sqrt(-2 ln 1e-4) x 0.6.
  ok("TRUE RETICLE mk2.01(a): SCATTER_CAP pins the draw's hard edge (~2.5751)",
    Math.abs(SCATTER_CAP - Math.sqrt(-2 * Math.log(1e-4)) * 0.6) < 1e-9, SCATTER_CAP);

  // (b) no real draw exceeds it: 500 draws at sigma 0.1, every deflection
  // angle at or under atan(cap x 0.1).
  {
    const world = makeWorld({ field: flatField, seed: 71 });
    const dir = { x: 0, y: 0, z: 1 };
    let worst = 0;
    for (let i = 0; i < 500; i++) {
      const d2 = applyScatter(world, dir, 0.1);
      worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, d2.z))));
    }
    ok("TRUE RETICLE mk2.01(b): 500 applyScatter draws all sit inside the cap angle",
      worst <= Math.atan(SCATTER_CAP * 0.1) + 1e-9, worst);
  }
  // (c) still air, flat gun: the round flies level, drops under 9.8, and
  // lands on the dirt where the fall time says — not at the aim's chest line.
  {
    const hit = flightImpact(bareSG(), { x: -30, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(c): a level 100 m/s round from 1.5m lands ~55m out on the ground",
      hit.wall === false && Math.abs(hit.y) < 1e-6 && hit.x > 20 && hit.x < 32, JSON.stringify(hit));
  }
  // (d) a flat shot into a 3m wall terminates on its near face.
  {
    const hit = flightImpact(wallSG(), { x: 0, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(d): a flat round into the wall stops on the face",
      hit.wall === true && hit.x >= 10 && hit.x <= 12.5 && hit.y > 0 && hit.y < 3, JSON.stringify(hit));
  }
  // (e) the same wall, a lofted round: the arc clears it and lands behind.
  {
    const hit = flightImpact(wallSG(), { x: -30, y: 0.5, z: 0 }, { x: Math.cos(75 * Math.PI / 180), y: Math.sin(75 * Math.PI / 180), z: 0 }, 33, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(e): a 75-degree mortar round clears the 3m wall and lands behind it",
      hit.wall === false && hit.x > 12.5, JSON.stringify(hit));
  }
  // (f) surfaceAt: dirt reads ground; a solid's cell reads its top.
  {
    const SG = wallSG();
    const s0 = surfaceAt(SG, 0, 0, idUV), s1 = surfaceAt(SG, 11, 0, idUV);
    ok("TRUE RETICLE mk2.01(f): open dirt reads ground height, not solid", s0.y === 0 && s0.solid === false, JSON.stringify(s0));
    ok("TRUE RETICLE mk2.01(f): the wall's cell reads its top — the rooftop", s1.y === 3 && s1.solid === true, JSON.stringify(s1));
  }
  // (g) THE LAW: 100 real scatter draws through the real flight, mortar in
  // a crosswind — every landing inside the ring the predictor promised.
  {
    const world = makeWorld({ field: flatField, seed: 72 });
    const SG = bareSG();
    const spec = { projSpeed: 33, occl: "lofted", windF: 0.04, windComp: 0.6 };
    const wind = { x: 2.5, z: 0, mag: 2.5 };
    const muzzle = { x: -20, y: 0.5, z: 0 }, aim = { x: 6, y: 0.9, z: 0 };
    const pr = predictRing(SG, muzzle, aim, spec, 0.02, wind, idUV);
    let worst = 0;
    for (let i = 0; i < 100; i++) {
      const dir = applyScatter(world, pr.rawDir, 0.02);
      const hit = flightImpact(SG, muzzle, dir, spec.projSpeed, spec, wind, idUV);
      worst = Math.max(worst, Math.hypot(hit.x - pr.center.x, hit.z - pr.center.z));
    }
    ok("TRUE RETICLE mk2.01(g): 100 drawn mortar rounds in a crosswind all land inside the predicted ring",
      worst <= pr.r + 0.25, `worst=${worst.toFixed(3)} r=${pr.r.toFixed(3)}`);
  }
  // (h) the rooftop: a mortar aimed at the wall's TOP lands ON the top —
  // flat ring on the roof, not a face hit.
  {
    const SG = wallSG();
    const spec = { projSpeed: 33, occl: "lofted", windF: 0 };
    const pr = predictRing(SG, { x: -20, y: 0.5, z: 0 }, { x: 11, y: 3.9, z: 0 }, spec, 0.005, null, idUV);
    ok("TRUE RETICLE mk2.01(h): a mortar aimed at the rooftop lands on the roof, flat",
      pr.center.wall === false && Math.abs(pr.center.y - 3) < 0.01 && pr.center.x >= 10 && pr.center.x <= 12.5,
      JSON.stringify(pr.center));
  }
  // (i) source pins: the surface law aims the guns, the fire paths honor
  // aim.y, the ring is the predictor's, the crosshair rides the ring.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("TRUE RETICLE mk2.01(i) source pin: the frame loop reads the surface under the reticle",
      /S\.reticle\.y = surfaceAt\(T\.sight, S\.reticle\.x, S\.reticle\.z, invW\)\.y;/.test(gameSrc));
    ok("TRUE RETICLE mk2.01(i) source pin: all four possessed fire paths aim at the surface (aim.y)",
      (stateSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
      (driversSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2);
    ok("TRUE RETICLE mk2.01(i) source pin: the ring is the predictor's landing bound",
      /const pr9 = predictRing\(T\.sight, muzzle9, aim9, spec9, sig9, world\.wind, invW\);/.test(gameSrc));
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) || "");
    ok("TRUE RETICLE mk2.01(i) source pin: the crosshair bars ride the ring, fog opted out",
      /PlaneGeometry\(0\.12, 0\.85\)/.test(block) && /fog: false/.test(block), block.length);
  }
}
// ==== end THE TRUE RETICLE (mk2.01) =========================================
```

Run `node scripts/gate.mjs depot-test`. Expected: FAIL — the new exports do not exist yet.

### Step 2 — the predictor (accuracy.js)

In `src/depot/accuracy.js`, after `applyScatter`'s closing brace (after line 302), add:

```js
// mk2.01: THE TRUE RETICLE — the landing predictor. The nominal trajectory
// is integrated with the engine's own arithmetic (gravity 9.8, core.js's
// wind-drag line at :720-721, the 1/120 sim step), and the ring's radius
// rides applyScatter's hard cap: its deflection magnitude can never exceed
// SCATTER_CAP x sigma (the 1e-4 tail of the draw), so cap rays integrated
// to the ground bound every possible impact. Landing points only — blast
// reaches beyond the ring (owner, 2026-08-21). Solids are map-resolution
// (the sight grid's occ), the accepted trade everywhere in sight. Pure,
// zero rng draws.
export const SCATTER_CAP = Math.sqrt(-2 * Math.log(1e-4)) * 0.6;
// The first 2.5m of flight ignores solids — losGraze's own muzzle-cover
// exemption, so a braced shooter's sandbag never eats the prediction.
const PREDICT_SKIP_M = 2.5;
export function flightImpact(SG, muzzle, dir, speed, spec, wind, toUV, dt = 1 / 120) {
  const p = { x: muzzle.x, y: muzzle.y, z: muzzle.z };
  const v = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
  for (let k = 0; k < 1800; k++) {
    v.y -= 9.8 * dt;
    if (wind && spec.windF) {
      v.x += (wind.x - v.x * 0.02) * spec.windF * dt;
      v.z += (wind.z - v.z * 0.02) * spec.windF * dt;
    }
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    const c = toUV(p.x, p.z);
    const ix = Math.floor((c.u + SG.halfU) / SG.cs), iz = Math.floor((c.v + SG.halfV) / SG.cs);
    if (ix < 0 || ix >= SG.nx || iz < 0 || iz >= SG.nz) return { x: p.x, y: p.y, z: p.z, wall: false };
    const i = iz * SG.nx + ix;
    if (SG.occ[i] > SG.gnd[i] && p.y <= SG.occ[i] &&
        Math.hypot(p.x - muzzle.x, p.z - muzzle.z) > PREDICT_SKIP_M) {
      // under the top by more than one step's fall: the near face; else the
      // roof — a descending round parks flat ON the solid's top.
      const face = p.y < SG.occ[i] - 0.4;
      return { x: p.x, y: face ? Math.max(p.y, SG.gnd[i] + 0.2) : SG.occ[i], z: p.z, wall: face };
    }
    if (p.y <= SG.gnd[i]) return { x: p.x, y: SG.gnd[i], z: p.z, wall: false };
  }
  return { x: p.x, y: p.y, z: p.z, wall: false };
}
// deflect: applyScatter's own tangent-plane rotation with a CHOSEN azimuth
// and magnitude instead of drawn ones — the cone's edge, ray by ray.
export function deflect(dir, a, m) {
  const up = Math.abs(dir.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = dir.z * up.y - dir.y * up.z, uy = dir.x * up.z - dir.z * up.x, uz = dir.y * up.x - dir.x * up.y;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = dir.y * uz - dir.z * uy, vy = dir.z * ux - dir.x * uz, vz = dir.x * uy - dir.y * ux;
  const ox = Math.cos(a) * m, oy = Math.sin(a) * m;
  const nx = dir.x + ux * ox + vx * oy, ny = dir.y + uy * ox + vy * oy, nz = dir.z + uz * ox + vz * oy;
  const nl = Math.hypot(nx, ny, nz);
  return { x: nx / nl, y: ny / nl, z: nz / nl };
}
// predictRing: shooterFire's own pre-shot math (target at rest — the
// possessed ground aim never moves), then the nominal impact and 16 cap
// rays. center is the ring's center (wall true = a vertical face took it);
// r bounds every possible landing; rawDir feeds the renderer's face yaw.
export function predictRing(SG, muzzle, aim, spec, sigma, wind, toUV) {
  const high = spec.occl === "lofted";
  let ax = aim.x, az = aim.z;
  for (let li = 0; li < 2; li++) {
    const ld = Math.max(2, Math.hypot(ax - muzzle.x, az - muzzle.z));
    const lp = aimSolve(spec.projSpeed, ld, aim.y - muzzle.y, 9.8, high);
    if (lp == null) break;
    const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
    ax = aim.x; az = aim.z;
    if (wind && spec.windF && spec.windComp) {
      ax -= wind.x * spec.windF * tof * spec.windComp;
      az -= wind.z * spec.windF * tof * spec.windComp;
    }
  }
  const dx = ax - muzzle.x, dz = az - muzzle.z, dy = aim.y - muzzle.y;
  const d = Math.max(2, Math.hypot(dx, dz));
  let pitch = aimSolve(spec.projSpeed, d, dy, 9.8, high);
  if (pitch == null) pitch = high ? 1.1 : 0.45;
  const rawDir = { x: (dx / d) * Math.cos(pitch), y: Math.sin(pitch), z: (dz / d) * Math.cos(pitch) };
  const center = flightImpact(SG, muzzle, rawDir, spec.projSpeed, spec, wind, toUV);
  const cap = SCATTER_CAP * sigma;
  let r = 0.4;
  for (let s = 0; s < 16; s++) {
    const hit = flightImpact(SG, muzzle, deflect(rawDir, (s / 16) * Math.PI * 2, cap), spec.projSpeed, spec, wind, toUV);
    r = Math.max(r, Math.hypot(hit.x - center.x, hit.z - center.z));
  }
  return { center, r, rawDir };
}
```

### Step 3 — the surface (sight.js)

In `src/depot/sight.js`: DELETE `clampToImpact` whole (the mk1.99 comment block and function, lines 187-224). In its place, add:

```js
// mk2.01: THE SURFACE LAW. What the reticle rests on is what the guns aim
// at: a solid's top when it sits on one (rooftops, wall tops), the ground
// otherwise. Nothing clamps the steer any more — the landing predictor
// (accuracy.js) shows where the shot truly ends. Pure, zero draws.
export function surfaceAt(SG, x, z, toUV) {
  const c = toUV(x, z);
  const ix = Math.floor((c.u + SG.halfU) / SG.cs), iz = Math.floor((c.v + SG.halfV) / SG.cs);
  if (ix < 0 || ix >= SG.nx || iz < 0 || iz >= SG.nz) return { y: 0, solid: false };
  const i = iz * SG.nx + ix;
  return SG.occ[i] > SG.gnd[i] ? { y: SG.occ[i], solid: true } : { y: SG.gnd[i], solid: false };
}
```

### Step 4 — the fire paths honor the surface (state.js, drivers.js)

Four identical edits. In `src/depot/state.js:714` (possessedVolley) and `:746` (possessedTowerFire), and in `src/depot/drivers.js:533` (possessedArmorFire) and `:556` (possessedArmorMg), the line

```js
  const tgt = live || { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
```

becomes (one line, all four sites):

```js
  const tgt = live || { pos: { x: aim.x, y: (aim.y != null ? aim.y : world.field.heightAt(aim.x, aim.z)) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 }; // mk2.01: aim.y is the surface under the reticle — rooftops are targets
```

### Step 5 — the game layer (DepotGame.jsx)

Five edits, in file order.

Imports. Line 26 gains `predictRing` (after `towerReachCached`). Line 33: `clampToImpact` → `surfaceAt`.

State block, line 1343: drop `reticleHit: null,` — the line becomes:

```js
        reticle: null, reticleOff: null, reticleLockId: null, joyR: null, fireHeld: false,
```

Hygiene lines 1752, 1873, 1888, 1919: `S.reticleLockId = null; S.reticleHit = null;` becomes, at all four sites:

```js
        S.reticleLockId = null;
```

The frame loop: replace lines 3395-3411 (from the reclamp line through the sticky-snap `if (lk9)` line — the impact block dies) with:

```js
              S.reticleOff = reclampReticle(T.sight, 1, rc, rR, S.reticleOff, invW);
              S.reticle = { x: rc.x + S.reticleOff.dx, z: rc.z + S.reticleOff.dz };
              // mk2.01: THE SURFACE LAW — nothing blocks the steer; the
              // ground the reticle rests on aims the guns: a solid's top
              // when it sits on one (rooftops, wall tops), the dirt
              // otherwise. Where the shot truly ends is the predictor's
              // ring, never a steering clamp.
              S.reticle.y = surfaceAt(T.sight, S.reticle.x, S.reticle.z, invW).y;
              // mk1.99: THE STICKY SNAP — the RAW offset steers; the lock
              // only bends the derived aim onto the man, so pulling the raw
              // point past the radius is the deliberate escape.
              const lk9 = stickyLock(world, S.reticleLockId, S.reticle, T, invW);
              S.reticleLockId = lk9 ? lk9.id : null;
              if (lk9) S.reticle = { x: lk9.pos.x, z: lk9.pos.z };
```

The ring block: replace lines 3668-3693 (the T5 comment through the full three-line `R.overlay.setReticle(...)` call) with:

```js
          // POSSESSION T5 (mk0.94): the reticle draws through its own red
          // ring, and the build hover never paints while possessed. mk2.01:
          // THE TRUE RETICLE — the ring is the LANDING BOUND: center at the
          // predicted impact (predictRing — the engine's own flight
          // arithmetic), radius at applyScatter's hard cap. No shot can
          // land outside it. For a squad the bound is drawn from the
          // farthest living shooter — every member's cone lands inside.
          let rr9 = 1.2, hit9 = null, ctr9 = null;
          if (S.possess && S.reticle) {
            const P9 = S.possess;
            let spec9 = null, pb0 = null;
            if (P9.kind === "squad") {
              const sq9 = S.squads.find((q) => q.id === P9.id); spec9 = sq9 ? INFANTRY_ARMS[sq9.type] : null;
              if (sq9) for (const id of sq9.memberIds) {
                const u = world.byId.get(id);
                if (u && u.alive && u.role !== "spotter" && (!pb0 || Math.hypot(u.pos.x - S.reticle.x, u.pos.z - S.reticle.z) > Math.hypot(pb0.pos.x - S.reticle.x, pb0.pos.z - S.reticle.z))) pb0 = u;
              }
            }
            else { pb0 = world.byId.get(P9.id); if (pb0) spec9 = P9.kind === "tower" ? TOWER_SPECS[pb0.towerType] : P9.kind === "vehicle" ? BISON_FIRE.gun : null; }
            const rc9 = possessCenter();
            if (spec9 && spec9.acc != null && rc9) {
              const muzzle9 = pb0 ? { x: pb0.pos.x, y: pb0.pos.y + (P9.kind === "tower" ? pb0.hy + 0.45 : P9.kind === "vehicle" ? 1.4 : 0.5), z: pb0.pos.z }
                                  : { x: rc9.x, y: field.heightAt(rc9.x, rc9.z) + 0.5, z: rc9.z };
              const aim9 = { x: S.reticle.x, y: (S.reticle.y != null ? S.reticle.y : field.heightAt(S.reticle.x, S.reticle.z)) + 0.9, z: S.reticle.z };
              const sig9 = scatterSigma(world, muzzle9, aim9, { ...spec9, acc: spec9.acc * POSSESS_ACC });
              const pr9 = predictRing(T.sight, muzzle9, aim9, spec9, sig9, world.wind, invW);
              ctr9 = pr9.center;
              rr9 = Math.max(0.4, pr9.r);
              hit9 = pr9.center.wall ? { y: pr9.center.y, yaw: Math.atan2(pr9.rawDir.x, pr9.rawDir.z) } : null;
            }
          }
          R.overlay.setReticle(!!(S.possess && S.reticle),
            ctr9 ? ctr9.x : (S.reticle ? S.reticle.x : 0), ctr9 ? ctr9.z : (S.reticle ? S.reticle.z : 0),
            ctr9 ? ctr9.y : (S.reticle ? field.heightAt(S.reticle.x, S.reticle.z) : 0), rr9, hit9);
```

### Step 6 — crimson, crosshair, fog opt-out (renderer.js)

Replace the whole `setReticle` method (`renderer.js:1325-1340`) with (the `retRing` variable now holds a group):

```js
    setReticle(on, x, z, y, r, hit) {
      if (!retRing) {
        // mk2.01: BLAZING CRIMSON — fog: false (the scene fog was washing
        // the red toward the sky color at distance); one shared material.
        const rmat = new THREE.MeshBasicMaterial({ color: 0xf0143c, depthWrite: false, side: THREE.DoubleSide, fog: false });
        retRing = new THREE.Group();
        retRing.add(new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 44), rmat));
        // mk2.01: THE LARGE CROSSHAIR — four bars riding the ring, spanning
        // past its edge, scaling and tilting with it.
        for (let ci = 0; ci < 4; ci++) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.85), rmat);
          const ca = (ci * Math.PI) / 2;
          bar.position.set(Math.sin(ca) * 1.35, Math.cos(ca) * 1.35, 0);
          bar.rotation.z = -ca;
          retRing.add(bar);
        }
        retRing.rotation.x = -Math.PI / 2;
        for (const ch of retRing.children) ch.layers.set(1);
        scene.add(retRing);
      }
      retRing.visible = !!on;
      if (on) {
        const rr = Math.max(0.4, r || 1.2);
        retRing.scale.set(rr, rr, 1);
        // a wall hit stands the crosshair upright on the face, square to
        // the fire line; ground and rooftops keep it flat at the landing.
        if (hit) { retRing.position.set(x, hit.y, z); retRing.rotation.set(0, hit.yaw, 0); }
        else { retRing.position.set(x, y + 0.1, z); retRing.rotation.set(-Math.PI / 2, 0, 0); }
      }
    },
```

The comment above the retRing declaration (`renderer.js:1318`) becomes: `let retRing = null; // POSSESSION T5 (mk0.94) / mk2.01: the possessed crosshair group — ring + bars, crimson, fog-proof`

### Step 7 — gates

`node scripts/gate.mjs depot-test`, `golden`, `depot-lint`, `smoke`, in that order, all green. Smoke needs the preview server on :4173 (`npm run build`, `npx vite preview --port 4173 &`), killed after. Arithmetic acceptance: 13 new checks, 8 removed, 2 re-taught in place — final depot-test PASS count must equal step 1's baseline − 8 + 13 (expected 1733). A different number stops the task.

### Step 8 — deploy

`src/version.js` → `export const MK = "mk2.01";` (comment untouched). Build AFTER the bump. Commit everything as `the true reticle, mk2.01`, push. The owner's live check on phone and desktop is the acceptance: the crimson crosshair; mortar rounds inside the ring in wind; the machine gun's ring sitting on the ground the rounds actually strike; the ring standing on wall faces, lying flat on rooftops, and a mortar killing what stands on one.

## Report requirements

- Fixture seeds named: 71, 72 (new draws); all others untouched.
- Every removal and re-teach listed old → new, per the sweep table.
- Both depot-test PASS counts with the arithmetic (baseline − 8 + 13).
- Every deviation its own labeled bullet.
