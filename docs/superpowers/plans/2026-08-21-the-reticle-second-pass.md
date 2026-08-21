# THE RETICLE, SECOND PASS — task plan (proposed mark mk2.00)

**Goal.** Three playtest findings against mk1.99: the ring's band thickened and its red brightened, the wall projection fixed at its root (the destination cell was never tested), and the build menu closed by possession and held shut through it.

**Suggested model:** Sonnet 5 — every code block is complete; the work is mechanical placement and gate runs.

**Symmetry:** all three items live in the player's interface; no enemy counterpart exists. No ruling needed.

**Design choices (owner checks live, no authority source exists):** band inner radius 0.70 (30% of radius, was 18%) and color 0xff4a3c (was 0xff6b5e). The live look on phone and desktop is the acceptance; the pins ratify whatever literal ships after his check.

## Required reading (verified against the live tree)

- `src/depot/sight.js:187-216` — clampToImpact as shipped (the defect lives here)
- `src/render/renderer.js:1320-1340` — retRing and setReticle as shipped
- `src/depot/DepotGame.jsx:4061-4067` — closeBuild
- `src/depot/DepotGame.jsx:4503-4507` — the squad TAKE CONTROL slot
- `src/depot/DepotGame.jsx:4594-4603` — the tower TAKE CONTROL slot
- `src/depot/DepotGame.jsx:4626` — the vehicle TAKE CONTROL slot
- `src/depot/DepotGame.jsx:4648-4662` — the BUILD toggle
- `scripts/tests/04-vision-command-possession.mjs:1546-1551, 2010-2100` — the T5(a) pin and the mk1.99 RETICLE block the new block follows

## Trap notes

- `renderer.js:742` holds a DIFFERENT mesh also named `reticle` (another mode's marker) and `:764` a third ring in the same red — touch neither. Only `retRing` inside `setReticle` (line 1327) changes.
- The mk1.99(h) pin regexes the `setReticle(on, x, z, y, r, hit) {` block for the absence of `opacity` — the literal edits keep that block's shape; do not reformat it.
- The three TAKE CONTROL `act` handlers and the BUILD toggle live inside the React component where `closeBuild` is defined (line 4061) — same scope, no import needed.
- The existing mk1.99 clampToImpact tests (a/b/c) must pass UNCHANGED — the fix adds a destination-cell test; the between-cells march is untouched.
- Line numbers are anchors from the current tree; match by quoted code if drifted, stop if the quoted code cannot be found.

## The sweep license

One re-teach — the color literal moves, so the T5(a) pin re-teaches. Reported old → new in the landing report. Any other failing test stops the task.

| Test | Old | New |
|---|---|---|
| `scripts/tests/04-vision-command-possession.mjs:1549-1550` | `ok("POSSESSION T5(a) source pin (re-taught mk1.99): the renderer owns a setReticle overlay drawn in the established red, solid", /setReticle\(on, x, z, y, r, hit\)/.test(rendSrc) && /0xff6b5e/.test(String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) \|\| "")));` | `ok("POSSESSION T5(a) source pin (re-taught mk2.00): the renderer owns a setReticle overlay drawn in the brightened red, solid", /setReticle\(on, x, z, y, r, hit\)/.test(rendSrc) && /0xff4a3c/.test(String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) \|\| "")));` |

## Steps

### Step 1 — baseline, then the failing tests

Run `node scripts/gate.mjs depot-test` on the clean tree and record its PASS count (expected 1720) — step 5's arithmetic baseline.

Append one block to `scripts/tests/04-vision-command-possession.mjs`, after the `// ==== end THE RETICLE (mk1.99) ====` marker at the end of the file. No new imports are needed — `clampToImpact` and `fs` are already imported.

```js
// ==== THE RETICLE, SECOND PASS (mk2.00) =====================================
// Playtest findings against mk1.99: the destination cell takes the hit (the
// steer parks the reticle ON a wall's own cell — the one cell mk1.99 never
// tested, so the ring fell flat at the wall's foot), the ring's band and red
// re-tuned, and possession closes the build tree and holds it shut. Pure
// helper on hand-built maps; JSX/renderer wiring pinned by source regex.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) the reticle steered ONTO a 3m wall's own cell hits the face: the
  // offset clamps half a cell short, wall true, impact at man height.
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3; // a wall at u≈11
    const r = clampToImpact(SG, 0.5, { x: 0, z: 0 }, { dx: 11, dz: 0 }, idUV);
    ok("RETICLE mk2.00(a): a reticle parked on the wall's own cell clamps to the face",
      r.wall === true && r.dx > 0 && r.dx < 11, JSON.stringify(r));
    ok("RETICLE mk2.00(a): the face impact sits at man height on the wall",
      r.y > 0 && r.y < 3, r.y);
  }
  // (b) one cell out: a wall in the immediately adjacent cell (the old n<2
  // early-out's blind spot) still clamps.
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3;
    const r = clampToImpact(SG, 0.5, { x: 9, z: 0 }, { dx: 2, dz: 0 }, idUV);
    ok("RETICLE mk2.00(b): a wall one cell from the shooter still takes the hit",
      r.wall === true && r.dx > 0 && r.dx < 2, JSON.stringify(r));
  }
  // (c) source pin: the ring's re-tuned band and red.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit\) \{[\s\S]*?\n    \},/) || "");
    ok("RETICLE mk2.00(c) source pin: the ring's band is 30% of radius in the brightened red",
      /RingGeometry\(0\.7, 1\.0, 44\)/.test(block) && /0xff4a3c/.test(block), block.length);
  }
  // (d) source pins: every TAKE CONTROL closes the build tree with the take.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("RETICLE mk2.00(d) source pin: the squad's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControl\(\); \}/.test(gameSrc));
    ok("RETICLE mk2.00(d) source pin: the tower's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControlTower\(tr\.id\); \},/.test(gameSrc));
    ok("RETICLE mk2.00(d) source pin: the vehicle's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControlVehicle\(\); \} \},/.test(gameSrc));
    // (e) source pin: the BUILD toggle refuses to open over a live possession.
    ok("RETICLE mk2.00(e) source pin: the BUILD toggle refuses while possessed",
      /if \(buildOpen\) \{ closeBuild\(\); return; \}[\s\S]{0,240}if \(S && S\.possess\) return;/.test(gameSrc));
  }
}
// ==== end THE RETICLE, SECOND PASS (mk2.00) =================================
```

Apply the sweep-license re-teach from the table above in the same edit.

Run `node scripts/gate.mjs depot-test`. Expected: FAIL — mk2.00(a) and (b) fail against the shipped clampToImpact, (c)-(e) fail against the unedited sources.

### Step 2 — the destination cell (sight.js)

In `src/depot/sight.js`, two edits to `clampToImpact` (line 193).

The early-out `if (n < 2) return { dx: off.dx, dz: off.dz, y: 0, wall: false };` becomes:

```js
  if (n < 1) return { dx: off.dx, dz: off.dz, y: 0, wall: false };
```

The function's final line `return { dx: off.dx, dz: off.dz, y: 0, wall: false };` (after the march loop) becomes:

```js
  // mk2.00: the destination cell itself. The steer parks the reticle ON a
  // wall's own cell (the ground behind it is dark), and mk1.99's march —
  // canSee's convention — never tested that cell, so the ring fell flat at
  // the wall's foot. A solid standing taller than man height in the
  // reticle's own cell takes the hit on its near face, half a cell short.
  if (SG.occ[ti] > ty) {
    const tc = Math.max(0, (n - 0.5) / n);
    return { dx: off.dx * tc, dz: off.dz * tc, y: ty, wall: true };
  }
  return { dx: off.dx, dz: off.dz, y: 0, wall: false };
```

The function's head comment gains one line at its end: `// mk2.00: the destination cell is tested too — see below.`

### Step 3 — the ring's band and red (renderer.js)

In `src/render/renderer.js:1327`, the retRing construction line, two literals change — `RingGeometry(0.82, 1.0, 44)` → `RingGeometry(0.7, 1.0, 44)` and `color: 0xff6b5e` → `color: 0xff4a3c`. The full line after the edit:

```js
        retRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 44), new THREE.MeshBasicMaterial({ color: 0xff4a3c, depthWrite: false, side: THREE.DoubleSide }));
```

Nothing else in the block moves. The block comment (`renderer.js:1321-1324`) gains one line at its end: `// mk2.00 (owner): band 30% of radius, red brightened.`

### Step 4 — possession closes the build menu (DepotGame.jsx)

Four edits, in file order. All four sit inside the component that defines `closeBuild` (line 4061).

Line 4506, the squad slot, becomes (act gains the leading `closeBuild();`):

```js
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, act: () => { closeBuild(); const S = stateRef.current; if (S) S.takeControl(); } },
```

Line 4601, the tower slot's act, becomes:

```js
            act: () => { closeBuild(); const S = stateRef.current; if (S) S.takeControlTower(tr.id); },
```

Line 4626, the vehicle slot, becomes:

```js
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, act: () => { closeBuild(); const S = stateRef.current; if (S) S.takeControlVehicle(); } },
```

The BUILD toggle's onClick (lines 4652-4654): between `const S = stateRef.current;` and `const b = S && S.mode ? branchOf(S.mode) : null;` insert:

```js
              // mk2.00 (owner): the build tree never opens over a live
              // possession — the bar hides while possessed, but the state
              // underneath must refuse too.
              if (S && S.possess) return;
```

One comment line joins the squad slot's existing comment (lines 4503-4505), at its end: `// mk2.00 (owner): the build tree closes with the take — all three TAKE CONTROLs.`

The same behavior on phone and desktop for free: one bar, one toggle, one closeBuild serve both layouts.

### Step 5 — gates

Run, in order: `node scripts/gate.mjs depot-test`, `node scripts/gate.mjs golden`, `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke`. All green. The smoke gate needs the preview server: `npm run build && (npx vite preview --port 4173 &)`, kill it after. Arithmetic acceptance: the new block adds exactly 8 `ok(` calls (a=2, b=1, c=1, d=3, e=1); the re-teach replaces one check one-for-one. depot-test's final PASS count must equal step 1's baseline plus 8 (expected 1728). The agent reports both counts; a different delta stops the task.

### Step 6 — deploy

`src/version.js` → `export const MK = "mk2.00";` (comment untouched). Build AFTER the bump: `npm run build`. Commit everything as `the reticle second pass, mk2.00`, push. The owner's live check on phone and desktop is the acceptance: the thicker, brighter ring; the ring standing on wall faces it is steered onto; TAKE CONTROL closing the build tree; the tree refusing to open while possessed.

## Report requirements

- Fixture seeds: none drawn by the new checks (hand-built maps and source pins — pure arithmetic); existing seeds untouched.
- The re-teach old → new (the one in the sweep table).
- Both depot-test PASS counts with the delta (must be +8).
- Every deviation its own labeled bullet.
