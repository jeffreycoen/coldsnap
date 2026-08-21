# THE RETICLE — task plan (proposed mark mk1.99)

**Goal.** Four approved changes to the possessed aim: the ring drawn solid and sized to the live spread, tap to aim, the reticle stopped at the first surface the shot would hit, and a wider, sticky enemy snap.

**Suggested model:** Sonnet 5 — every code block below is complete; the work is mechanical placement and gate runs.

**Symmetry:** the possession interface is player-only by nature; the enemy has no counterpart to mirror. No asymmetry ruling needed.

**Ruling recorded (owner, 2026-08-21):** the mk0.93 "taps do nothing while possessed" ruling is retired; a possessed ground tap jumps the reticle. Fire stays on the trigger.

## Required reading (verified against the live tree)

- `src/depot/sight.js:162-185` — steerReticle/reclampReticle, the rules this task extends
- `src/depot/state.js:639-736` — POSSESS_ACC/POSSESS_SNAP_R/snapTargetNear and the three fire paths
- `src/depot/DepotGame.jsx:1334-1345` — the S state block (reticle fields)
- `src/depot/DepotGame.jsx:1746-1766` — takeControlVehicle (mech branch keeps no reticle)
- `src/depot/DepotGame.jsx:1834-1921` — possessCenter/possessSightR/takeControl/takeControlTower/releasePossession
- `src/depot/DepotGame.jsx:2260-2268` — the tap handler's possession gate
- `src/depot/DepotGame.jsx:3348-3385` — the frame loop's reticle steer
- `src/depot/DepotGame.jsx:3633-3643` — the setReticle call
- `src/render/renderer.js:1318-1331` — retRing and setReticle
- `src/depot/accuracy.js:191-198` — scatterSigma
- `src/depot/specs.js:98-106, 238-270` — BISON_FIRE, INFANTRY_ARMS
- `scripts/tests/04-vision-command-possession.mjs:1-15, 1278-1300, 1417-1560, 1600-1615` — the pins this task re-teaches and the fixture conventions the new tests copy

## Trap notes

- The T4(g) source pins (`04-vision-command-possession.mjs:1531-1535`) match the steer, reclamp, and derive lines byte-for-byte. Step 5 keeps all three lines verbatim; the new code goes between the reclamp line and the derive line, and the derive line's exact text is reused.
- The release-hygiene pin (`:1289`) matches `S.reticle = null; S.reticleOff = null; S.fireHeld = false;` — step 6 appends after `S.mgHeld = false;`, never inside that run.
- `fieldReaches(null, ...)` returns true — the new stickyLock tests pass `T = null` deliberately, same as T7(c).
- `INFANTRY_ARMS[sq.type]` is undefined for unarmed squads; the ring-size code falls back to today's 1.2 radius.
- The mech possession has no reticle (`DepotGame.jsx:1753-1756`); the tap gate keeps returning early for it.

## The sweep license

This task re-signs `setReticle` and re-pins `POSSESS_SNAP_R`. Pre-licensed re-teaches, every one reported old → new in the landing report:

| Test | Old | New |
|---|---|---|
| `scripts/tests/04-vision-command-possession.mjs:1608-1609` | `ok("POSSESSION T7(a): POSSESS_SNAP_R is pinned at 2m", POSSESS_SNAP_R === 2, POSSESS_SNAP_R);` | `ok("POSSESSION T7(a) (re-taught mk1.99): POSSESS_SNAP_R is pinned at 4m — the forgiving snap", POSSESS_SNAP_R === 4, POSSESS_SNAP_R);` |
| `scripts/tests/04-vision-command-possession.mjs:1547-1548` | `ok("POSSESSION T5(a) source pin: the renderer owns a setReticle overlay drawn in the established red", /setReticle\(on, x, z, y\)/.test(rendSrc) && /0xff6b5e/.test(String(rendSrc.match(/setReticle\(on, x, z, y\) \{[\s\S]*?\n    \},/) \|\| "")));` | `ok("POSSESSION T5(a) source pin (re-taught mk1.99): the renderer owns a setReticle overlay drawn in the established red, solid", /setReticle\(on, x, z, y, r, hit\)/.test(rendSrc) && /0xff6b5e/.test(String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) \|\| "")));` |

Any other failing test stops the task.

## Steps

### Step 1 — the failing tests first

Before any edit, run `node scripts/gate.mjs depot-test` on the clean tree and record its PASS count — the baseline for step 6's arithmetic.

Append one block to `scripts/tests/04-vision-command-possession.mjs`, at the end of the file (after the last `// ==== end` marker). First widen the file's own imports: on line 3 add `stickyLock` after `snapTargetNear` in the `state.js` import; on line 10 add `clampToImpact` after `reclampReticle` in the `sight.js` import.

```js
// ==== THE RETICLE (mk1.99) ==================================================
// The owner's aim pass: the ring is the spread drawn solid, a tap jumps the
// reticle, the fire line stops at the first surface it would hit
// (clampToImpact), and the enemy snap is 4m and sticky (stickyLock). Pure
// helpers tested on hand-built maps and stub worlds; JSX/renderer wiring
// pinned by source regex, the file's own convention.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  // A bare 32x32 sight grid, 2m cells, flat ground, nothing standing.
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) a clean line: the offset passes through untouched, no wall.
  {
    const SG = bareSG();
    const r = clampToImpact(SG, 0.5, { x: 0, z: 0 }, { dx: 24, dz: 0 }, idUV);
    ok("RETICLE mk1.99(a): a clear fire line leaves the offset untouched",
      r.dx === 24 && r.dz === 0 && r.wall === false, JSON.stringify(r));
  }
  // (b) a 3m-tall solid column across the line clamps the offset short of it
  // and reports the face (wall true, impact height under the top).
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3; // a wall at u≈11
    const r = clampToImpact(SG, 0.5, { x: 0, z: 0 }, { dx: 24, dz: 0 }, idUV);
    ok("RETICLE mk1.99(b): a solid across the line clamps the offset short of the wall cell",
      r.dx > 0 && r.dx < 11 && r.wall === true, JSON.stringify(r));
    ok("RETICLE mk1.99(b): the impact height sits on the face, under the wall's top",
      r.y > 0 && r.y < 3, r.y);
  }
  // (c) a ridge (raised ground) clamps too, but is not a wall face.
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.gnd[iz * 32 + 21] = 4;
    const r = clampToImpact(SG, 0.5, { x: 0, z: 0 }, { dx: 24, dz: 0 }, idUV);
    ok("RETICLE mk1.99(c): a ridge across the line clamps the offset, wall false",
      r.dx > 0 && r.dx < 11 && r.wall === false, JSON.stringify(r));
  }
  // (d) stickyLock acquires a live enemy within the 4m snap radius.
  {
    const world = makeWorld({ field: flatField, seed: 61 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    const lk = stickyLock(world, null, { x: 3, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(d): stickyLock acquires a live enemy 3m from the aim (4m radius)",
      lk === enemy, lk && lk.id);
  }
  // (e) the hold: a locked man stays locked while the raw aim stays within
  // 4m of him; past 4m the lock breaks and, with no other enemy near, drops.
  {
    const world = makeWorld({ field: flatField, seed: 62 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    const held = stickyLock(world, enemy.id, { x: 3.5, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(e): a held lock survives the raw aim 3.5m off the man",
      held === enemy, held && held.id);
    const dropped = stickyLock(world, enemy.id, { x: 4.5, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(e): the raw aim steered past 4m breaks the lock",
      dropped === null, dropped && dropped.id);
  }
  // (f) a dead man sheds the lock even at zero distance.
  {
    const world = makeWorld({ field: flatField, seed: 63 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    enemy.alive = false;
    const lk = stickyLock(world, enemy.id, { x: 0, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(f): a dead man sheds the lock", lk === null, lk && lk.id);
  }
  // (g) source pins: the tap jumps the reticle; the loop clamps to impact and
  // runs the sticky lock; the ring reads the live scatter.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("RETICLE mk1.99(g) source pin: a possessed ground tap jumps the reticle through the sight-circle clamp and the seen test",
      /if \(seenAt\(T\.sight, cc0\.u, cc0\.v, 1\)\) \{\s*S\.reticleOff = \{ dx: dx0, dz: dz0 \};/.test(gameSrc));
    ok("RETICLE mk1.99(g) source pin: the frame loop clamps the offset through clampToImpact",
      /const imp9 = clampToImpact\(T\.sight, eyeY9, rc, S\.reticleOff, invW\);/.test(gameSrc));
    ok("RETICLE mk1.99(g) source pin: the frame loop derives the aim through stickyLock",
      /const lk9 = stickyLock\(world, S\.reticleLockId, S\.reticle, T, invW\);/.test(gameSrc));
    ok("RETICLE mk1.99(g) source pin: the ring radius reads the live scatterSigma under POSSESS_ACC",
      /scatterSigma\(world, muzzle9, aim9, \{ \.\.\.spec9, acc: spec9\.acc \* POSSESS_ACC \}\)/.test(gameSrc));
  }
  // (h) source pin: the ring's material is solid — no opacity in its block.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) || "");
    ok("RETICLE mk1.99(h) source pin: the ring draws solid — its material carries no opacity",
      block.length > 0 && !/opacity/.test(block) && /depthWrite: false/.test(block), block.length);
  }
}
// ==== end THE RETICLE (mk1.99) ==============================================
```

Apply the two sweep-license re-teaches from the table above in the same edit.

Run `node scripts/gate.mjs depot-test`. Expected: FAIL — `clampToImpact`/`stickyLock` are not exported yet.

### Step 2 — the impact clamp (sight.js)

In `src/depot/sight.js`, after `reclampReticle` (after line 185), add:

```js
// mk1.99: THE IMPACT SURFACE. March the fire line from the shooter's eye
// height toward the steered point over the same gnd/occ maps canSee reads,
// and stop the offset at the first cell the line cannot clear. Returns the
// clamped offset plus the impact — its height and whether a solid face
// (occ) took the hit — or wall:false with the offset untouched when the
// line is clean. Pure, zero draws, map-resolution like all sight.
export function clampToImpact(SG, eyeY, center, off, toUV) {
  const c0 = toUV(center.x, center.z);
  const c1 = toUV(center.x + off.dx, center.z + off.dz);
  const iu0 = Math.floor((c0.u + SG.halfU) / SG.cs), iv0 = Math.floor((c0.v + SG.halfV) / SG.cs);
  const iu1 = Math.floor((c1.u + SG.halfU) / SG.cs), iv1 = Math.floor((c1.v + SG.halfV) / SG.cs);
  const du = iu1 - iu0, dv = iv1 - iv0;
  const n = Math.max(Math.abs(du), Math.abs(dv));
  if (n < 2) return { dx: off.dx, dz: off.dz, y: 0, wall: false };
  const ti = Math.min(SG.nz - 1, Math.max(0, iv1)) * SG.nx + Math.min(SG.nx - 1, Math.max(0, iu1));
  const ty = SG.gnd[ti] + SIGHT_TARGET_H;
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const iu = Math.min(SG.nx - 1, Math.max(0, Math.round(iu0 + du * t)));
    const iv = Math.min(SG.nz - 1, Math.max(0, Math.round(iv0 + dv * t)));
    const i = iv * SG.nx + iu;
    const y = eyeY + (ty - eyeY) * t;
    if (SG.gnd[i] > y || SG.occ[i] > y) {
      const tc = Math.max(0, (k - 0.5) / n);
      return { dx: off.dx * tc, dz: off.dz * tc, y, wall: SG.occ[i] > y };
    }
  }
  return { dx: off.dx, dz: off.dz, y: 0, wall: false };
}
```

### Step 3 — the sticky snap (state.js)

In `src/depot/state.js:646`, re-teach the constant (comment updated with it):

```js
export const POSSESS_SNAP_R = 4;   // m — reticle-to-enemy snap radius (mk1.99: widened 2 -> 4, the forgiving snap) // provisional (F5)
```

After `snapTargetNear`'s closing brace (line 659), add:

```js
// mk1.99: THE STICKY SNAP. A held lock outlives the frame: the man stays
// locked while he lives, stays seen, and the RAW aim stays within the snap
// radius of him — steering the raw point past the radius is the deliberate
// escape. Otherwise the lock drops and the nearest snappable enemy takes it.
export function stickyLock(world, lockId, aim, T, toUV, r = POSSESS_SNAP_R) {
  if (lockId) {
    const b = world.byId.get(lockId);
    if (b && b.alive && (b.kind === "unit" || b.kind === "vehicle" || b.kind === "mech") && b.team === 2) {
      const c = toUV(b.pos.x, b.pos.z);
      if (fieldReaches(T, c.u, c.v, 1) && Math.hypot(b.pos.x - aim.x, b.pos.z - aim.z) < r) return b;
    }
  }
  return snapTargetNear(world, aim, T, toUV, r);
}
```

### Step 4 — the solid, sized, tilting ring (renderer.js)

Replace `src/render/renderer.js:1324-1331` (the whole `setReticle` method) with:

```js
    setReticle(on, x, z, y, r, hit) {
      if (!retRing) {
        retRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 44), new THREE.MeshBasicMaterial({ color: 0xff6b5e, depthWrite: false, side: THREE.DoubleSide }));
        retRing.rotation.x = -Math.PI / 2; retRing.layers.set(1); scene.add(retRing);
      }
      retRing.visible = !!on;
      if (on) {
        const rr = Math.max(0.4, r || 1.2);
        retRing.scale.set(rr, rr, 1);
        // mk1.99: a wall hit stands the ring upright on the face, its plane
        // square to the fire line; clean ground keeps the flat ring.
        if (hit) { retRing.position.set(x, hit.y, z); retRing.rotation.set(0, hit.yaw, 0); }
        else { retRing.position.set(x, y + 0.1, z); retRing.rotation.set(-Math.PI / 2, 0, 0); }
      }
    },
```

The comment above the method (`renderer.js:1321-1323`) gains one line at its end: `// mk1.99: solid, spread-sized, and standing on a wall hit.`

### Step 5 — the game layer (DepotGame.jsx)

Five edits, in file order.

Imports. Line 18 gains `BISON_FIRE` (after `MECH`); line 21 gains `POSSESS_ACC, stickyLock` (after `placeZoneMask`); line 26 gains `scatterSigma` (after `towerReachCached`); line 33 gains `clampToImpact` (after `reclampReticle`).

State block, line 1343: `reticle: null, reticleOff: null, joyR: null, fireHeld: false,` becomes:

```js
        reticle: null, reticleOff: null, reticleLockId: null, reticleHit: null, joyR: null, fireHeld: false,
```

Possession hygiene — the lock and hit die with every take and release. After `S.fireHeld = false; S.mgHeld = false;` in `takeControlVehicle` (line 1751), after `S.fireHeld = false;` in `takeControl` (line 1871) and in `takeControlTower` (line 1885), and after `S.reticle = null; S.reticleOff = null; S.fireHeld = false; S.mgHeld = false;` in `releasePossession` (line 1915), add on its own line:

```js
        S.reticleLockId = null; S.reticleHit = null;
```

The tap. Replace lines 2264-2268 (the four comment lines and `if (S.possess) return;`) with:

```js
        // mk1.99: TAP TO AIM — while possessed, a ground tap JUMPS the
        // reticle: clamped to the sight circle (steerReticle's own
        // arithmetic), refused on dark ground (the reticle stays put), and
        // the loop's sticky snap lands any nearby lock. Fire stays on the
        // trigger. Retires the mk0.93 "taps do nothing" ruling (owner,
        // 2026-08-21). The mech keeps no reticle.
        if (S.possess) {
          if (S.possess.kind === "mech") return;
          const rc0 = possessCenter();
          if (rc0 && S.reticleOff) {
            let dx0 = p.x - rc0.x, dz0 = p.z - rc0.z;
            const rR0 = possessSightR(), d0 = Math.hypot(dx0, dz0);
            if (d0 > rR0 && d0 > 1e-9) { dx0 *= rR0 / d0; dz0 *= rR0 / d0; }
            const cc0 = invW(rc0.x + dx0, rc0.z + dz0);
            if (seenAt(T.sight, cc0.u, cc0.v, 1)) {
              S.reticleOff = { dx: dx0, dz: dz0 };
              S.reticle = { x: rc0.x + dx0, z: rc0.z + dz0 };
            }
          }
          return;
        }
```

The frame loop. Between the reclamp line (3375, kept byte-identical for the T4(g) pin) and the derive line (3376, its exact text reused below), the impact clamp and the lock go in. Lines 3375-3383 become:

```js
              S.reticleOff = reclampReticle(T.sight, 1, rc, rR, S.reticleOff, invW);
              // mk1.99: THE IMPACT SURFACE — the offset stops at the first
              // cell the fire line cannot clear; the hit (height + facing)
              // rides to the ring.
              const pb9 = S.possess.kind === "squad" ? null : world.byId.get(S.possess.id);
              const eyeY9 = pb9 ? (S.possess.kind === "tower" ? pb9.pos.y + pb9.hy + 0.45 : pb9.pos.y + 1.4)
                                : field.heightAt(rc.x, rc.z) + 0.5;
              const imp9 = clampToImpact(T.sight, eyeY9, rc, S.reticleOff, invW);
              S.reticleOff = { dx: imp9.dx, dz: imp9.dz };
              S.reticleHit = imp9.wall ? { y: imp9.y, yaw: Math.atan2(imp9.dx, imp9.dz) } : null;
              S.reticle = { x: rc.x + S.reticleOff.dx, z: rc.z + S.reticleOff.dz };
              // mk1.99: THE STICKY SNAP — the RAW offset steers; the lock
              // only bends the derived aim onto the man, so pulling the raw
              // point past the radius is the deliberate escape.
              const lk9 = stickyLock(world, S.reticleLockId, S.reticle, T, invW);
              S.reticleLockId = lk9 ? lk9.id : null;
              if (lk9) { S.reticle = { x: lk9.pos.x, z: lk9.pos.z }; S.reticleHit = null; }
              // P7 T2: keep the turret honest while possessed — the hull's
              // own aim yaw follows the live reticle every frame, not just
              // on a shot.
              if (S.possess.kind === "vehicle" && S.reticle) {
                const pv2 = world.byId.get(S.possess.id);
                if (pv2) pv2._aimYaw = Math.atan2(S.reticle.x - pv2.pos.x, S.reticle.z - pv2.pos.z);
              }
```

The ring call. Replace lines 3633-3639 (the T5 comment and the three-line `R.overlay.setReticle(...)` call) with:

```js
          // POSSESSION T5 (mk0.94): the reticle draws through its own red
          // ring (the owner's ruling — a red circle, not the build ghost's
          // square), and the build hover never paints while possessed.
          // Squad and tower share the ring. mk1.99: THE RING IS THE SPREAD —
          // radius = distance x live two-sigma cone through the one scatter
          // model every shooter uses (scatterSigma under POSSESS_ACC),
          // floored at 0.4m; drawn solid; standing on a wall hit.
          let rr9 = 1.2, hit9 = null;
          if (S.possess && S.reticle) {
            const P9 = S.possess;
            let spec9 = null, pb0 = null;
            if (P9.kind === "squad") { const sq9 = S.squads.find((q) => q.id === P9.id); spec9 = sq9 ? INFANTRY_ARMS[sq9.type] : null; }
            else { pb0 = world.byId.get(P9.id); if (pb0) spec9 = P9.kind === "tower" ? TOWER_SPECS[pb0.towerType] : P9.kind === "vehicle" ? BISON_FIRE.gun : null; }
            const rc9 = possessCenter();
            if (spec9 && spec9.acc != null && rc9) {
              const muzzle9 = pb0 ? { x: pb0.pos.x, y: pb0.pos.y + (P9.kind === "tower" ? pb0.hy + 0.45 : 1.4), z: pb0.pos.z }
                                  : { x: rc9.x, y: field.heightAt(rc9.x, rc9.z) + 0.5, z: rc9.z };
              const aim9 = { x: S.reticle.x, y: field.heightAt(S.reticle.x, S.reticle.z) + 0.9, z: S.reticle.z };
              const sig9 = scatterSigma(world, muzzle9, aim9, { ...spec9, acc: spec9.acc * POSSESS_ACC });
              rr9 = Math.max(0.4, Math.hypot(aim9.x - muzzle9.x, aim9.z - muzzle9.z) * sig9 * 2);
            }
            hit9 = S.reticleHit || null;
          }
          R.overlay.setReticle(!!(S.possess && S.reticle),
            S.reticle ? S.reticle.x : 0, S.reticle ? S.reticle.z : 0,
            S.reticle ? (hit9 ? hit9.y : field.heightAt(S.reticle.x, S.reticle.z)) : 0, rr9, hit9);
```

### Step 6 — gates

Run, in order: `node scripts/gate.mjs depot-test`, `node scripts/gate.mjs golden`, `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke`. All green. Arithmetic acceptance: the new block adds exactly 13 `ok(` calls (a=1, b=2, c=1, d=1, e=2, f=1, g=4, h=1); the two re-teaches replace existing checks one-for-one. depot-test's final PASS count must equal step 1's clean-tree baseline plus 13. The agent reports both counts; a different delta stops the task.

### Step 7 — deploy

`src/version.js` → `export const MK = "mk1.99";` (comment untouched). Build AFTER the bump: `npm run build`. Commit everything as `the reticle, mk1.99`, push. The owner's live check on phone and desktop is the acceptance: the solid ring breathing with range and weapon (sniper tight, machine gun and mortar wide), the tap jump, the ring standing on walls, the 4m sticky lock.

## Report requirements

- Fixture seeds named: 61, 62, 63 (new), 31/41/51 (existing, untouched); no seed special.
- Every re-teach old → new (the two in the sweep table).
- Both depot-test PASS counts (baseline and final) with the delta.
- Every deviation its own labeled bullet.
