# P7.1 Task 1 — Camera rotation (mk1.60)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

One task: the camera rotates continuously — a two-finger twist on touch, held Q/E on desktop. The view stays at any angle it is left at. A quick Q/E tap keeps today's 90° snap; the ⟳ button stays. Render and input only; the sim never reads the camera.

**Rulings executed here** (decision record, 2026-08-19): free angle holds, no settle-back; tap snaps, hold swings; ⟳ stays.

**Suggested model:** Sonnet — bounded render/input change, fully specced below.

## Required reading, in order

1. `src/render/renderer.js:322-350` — the camera rig: `yawA`/`yawTgt`, `applyYaw()`, `rotateStep()`.
2. `src/render/renderer.js:2150-2180` — the render loop's yaw tween and the mid-turn texel-snap suspension.
3. `src/render/renderer.js:2214` — the renderer's return object (where `rotateBy` joins the exports).
4. `src/depot/DepotGame.jsx:2078-2170` — the pointer handlers (pinch), the key handlers `kd`/`ku`.
5. `src/depot/DepotGame.jsx:2696-2713` — the frame loop's key-driven pan block (where held rotation joins).
6. `src/depot/DepotGame.jsx:1949`, `:3550-3551`, `:3863` — `S.rotate`, the ⟳ button, the interaction help line.
7. `src/game/ColdsnapTD.jsx:1308` — the OTHER game's identical `kd` line. Read to know it exists; NEVER touch it.
8. `scripts/tests/01-engine-era.mjs:472-525` — the rotation-invariance pins this task must not trip.

## Trap notes

- `rotateStep` must stay defined EXACTLY ONCE in renderer.js — a suite pin counts `function rotateStep` occurrences. The new function is `rotateBy`, never a second `rotateStep`.
- `state.js` and `core.js` must gain no reference to yaw or rotation — two suite pins grep for it. All work lives in renderer.js and DepotGame.jsx.
- ColdsnapTD.jsx carries a byte-identical `kd` line. The edit is in DepotGame.jsx ONLY; tower defense keeps its step rotation.
- The tween does the smoothing: `rotateBy` only moves `yawTgt`, and the existing chase (`dt*6`) plus its texel-snap suspension handle the rest. Do not touch `applyYaw` or the tween.
- The twist's SIGN cannot be derived on paper (screen y runs down; the ortho basis flips it). Ship `rotateBy(da)`; if the owner's live check reads inverted, the sanctioned fix is the one-character flip to `-da` — a stated tolerance, not an open question.
- No rng anywhere in this task; `depot-lint` stays clean by construction.

## Steps

**Step 1 — renderer.js: the continuous entry point.** Directly under `rotateStep` (line 349), add:

```js
  // P7.1 T1: continuous rotation — small increments stream in from a held
  // key or a two-finger twist. Only yawTgt moves: the existing tween chases
  // it, so smoothing and the mid-turn texel-snap suspension come for free.
  function rotateBy(d) { yawTgt += d; }
```

**Step 2 — renderer.js: export it.** In the return object (line 2214), after `rotateStep,` add `rotateBy,`.

**Step 3 — DepotGame.jsx: the hold constants and state.** Beside the `kd` handler's declarations (near line 2154), add:

```js
      // P7.1 T1: tap = the 90° snap, hold = continuous. The frame loop
      // accumulates hold time and rotates past the window; keyup reads the
      // accumulated time to decide tap-vs-hold.
      const ROT_HOLD_S = 0.22, ROT_SPEED = 1.6; // provisional (F5)
```

and to the `S` state literal (near `keys: {}`), add `_rotHeld: { q: 0, e: 0 },`.

**Step 4 — DepotGame.jsx: the key handlers.** In `kd` (line 2155), DELETE the two rotate clauses (`if (e.key === "q" || e.key === "Q") R.rotateStep(-1); if (e.key === "e" || e.key === "E") R.rotateStep(1);`). Replace `ku` (line 2156) with:

```js
      const ku = (e) => {
        const k = e.key.toLowerCase();
        if (k === "q" || k === "e") {
          if ((S._rotHeld[k] || 0) <= ROT_HOLD_S) R.rotateStep(k === "q" ? -1 : 1);
          S._rotHeld[k] = 0;
        }
        onKey(e, false);
      };
```

**Step 5 — DepotGame.jsx: the held rotation.** In the frame loop, directly above the `if (!S.possess)` pan block (line 2705), add:

```js
          // P7.1 T1: held rotation keys — past the tap window the key swings
          // the view continuously; a release inside it snaps 90° (see ku).
          if (S.keys.q) { S._rotHeld.q += dt; if (S._rotHeld.q > ROT_HOLD_S) R.rotateBy(-ROT_SPEED * dt); }
          if (S.keys.e) { S._rotHeld.e += dt; if (S._rotHeld.e > ROT_HOLD_S) R.rotateBy(ROT_SPEED * dt); }
```

(Deliberately outside the `!S.possess` gate — rotation works while possessed, exactly as the old keydown snap did.)

**Step 6 — DepotGame.jsx: the two-finger twist.** Change the pinch state line (2079) to:

```js
      let pinchD0 = 0, pinchZ0 = 1, pinchA = 0, dragTotal = 0, downPt = null;
```

In `onPointerDown`'s two-pointer branch (lines 2109-2114), after `pinchZ0 = S.zoom;` add:

```js
          pinchA = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x); // P7.1 T1: the twist's running angle
```

In `onPointerMove`'s two-pointer branch (lines 2134-2139), after `R.setZoom(S.zoom);` add:

```js
          // P7.1 T1: TWO-FINGER ROTATION — the twist between the touches
          // steers the yaw. Incremental with wrap, so fingers crossing the
          // ±π seam never jump the view.
          const a = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x);
          let da = a - pinchA;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          pinchA = a;
          R.rotateBy(da);
```

**Step 7 — DepotGame.jsx: the words.** Line 3863: touch text gains `twist to rotate` after `pinch to zoom`; desktop text's `Q/E rotates` becomes `Q/E rotates (tap snaps, hold swings)`. The ⟳ button and its title are untouched.

**Step 8 — version.** `src/version.js`: `mk1.55` → `mk1.60`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — full suite green, zero re-pins expected (the rotation-invariance pins hold by construction).
2. `node scripts/golden.mjs` — green (renderer change is additive; the frozen demo path never calls `rotateBy`).
3. `node scripts/smoke.mjs` — boot green, zero page errors.
4. `node scripts/depot-lint.mjs` — clean (no rng added).

Then: bump → build → commit → push. The owner's live check — two-finger twist on the phone, tap-vs-hold Q/E on desktop, the twist's direction — is the acceptance.

## Report requirements

Open with the read-confirmation of the eight reading items. Every deviation, re-pin, and the twist-sign outcome (as shipped or flipped) is its own labeled bullet.
