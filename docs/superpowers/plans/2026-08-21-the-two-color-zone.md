# THE TWO-COLOR ZONE — task plan (proposed mark mk1.97)

*Written 2026-08-21 on the owner's word. One small task. Suggested model: Sonnet — two specced edits, no design.*

## The ruling (owner, 2026-08-21)

While a placement is armed, the zone paints the whole field's verdict: **legal ground the buildable green, illegal ground red, opacity 0.5 for both** (was: legal-only green fill at 0.1). Illegal includes everything the armed unit's mask refuses — unheld, steep for its kind, roomed out, and claimed cells alike; the red simply covers whatever is not green. Colors from the house palette — legal in the buildable green `0x4aff8c` (the hover ghost's own OK color, one green for "you may build here" everywhere), red `0xff5544` (the refusal red); the owner's eye rules both at the live check, and re-dialing is a sight adjustment, not a new task.

## Required reading (agent; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md`; `src/render/renderer.js` `setZone` (:1422-1450 — the comment block at :1422 through the method's closing `},`; the signature sits at :1427); `src/depot/DepotGame.jsx` `refreshZone`'s closing `R.overlay.setZone(...)` call (:2745); `scripts/tests/14-the-placement-law.mjs` K16 (the signature pin this task must keep).

## Trap notes

- **Era 14's K16 pins the literal signature `setZone(on, grid, mask, heightAt, color)`** — the signature stays; `color` becomes the legal-side color (callers pass the buildable green). K17 and the pendingPad are untouched.
- **The mesh now covers every cell** (~32,400 vertices — under the 65,536 index line) at the same 4Hz rebuild; the geometry swaps to vertex colors, so the material's own color dies and `vertexColors: true` carries both sides.
- No suite assert reads the zone's opacity or colors; the expected counts do not move.

## Step 1 — the renderer (renderer.js, `setZone` whole becomes)

```js
    // mk1.95: THE PLACEMENT ZONE — the ground a confirm placement may take,
    // shown while one is armed. mk1.97 (owner): the whole field's verdict,
    // two colors — legal in the passed color (the buildable green), everything
    // else in the refusal red, 0.5 both. Merged vertex-colored quads over
    // the game layer's passed grid mask; rebuilt only at its ~4Hz zone tick.
    // The grid's cells are 2m and ORIENT is quarter-turns, so flat
    // axis-aligned quads at cell-center height are exact.
    setZone(on, grid, mask, heightAt, color) {
      if (!zoneMesh) {
        zoneMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
        zoneMesh.layers.set(1); scene.add(zoneMesh);
      }
      zoneMesh.visible = !!on;
      if (!on) return;
      const legal = new THREE.Color(color || 0x4aff8c), illegal = new THREE.Color(0xff5544);
      const pos = [], col = [], idx = [];
      const h = grid.cs * 0.5;
      for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
        const okC = mask[gz * grid.w + gx] ? legal : illegal;
        const wp = grid.gridToWorld(gx, gz);
        const y = heightAt(wp.x, wp.z) + 0.14;
        const b = pos.length / 3;
        pos.push(wp.x - h, y, wp.z - h, wp.x + h, y, wp.z - h, wp.x + h, y, wp.z + h, wp.x - h, y, wp.z + h);
        for (let k = 0; k < 4; k++) col.push(okC.r, okC.g, okC.b);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      zoneMesh.geometry.dispose();
      zoneMesh.geometry = new THREE.BufferGeometry();
      zoneMesh.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      zoneMesh.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
      zoneMesh.geometry.setIndex(idx);
    },
```

## Step 2 — the caller (DepotGame.jsx, `refreshZone`'s last line)

Old: `R.overlay.setZone(true, grid, placeZoneMask(grid, heldAt, vetAt, room), (x, z) => field.heightAt(x, z), dealPhase ? 0x4aff8c : 0x7dffa8);`

New: `R.overlay.setZone(true, grid, placeZoneMask(grid, heldAt, vetAt, room), (x, z) => field.heightAt(x, z), 0x4aff8c);` — the one buildable green for every door.

## Step 3 — the gates (run ONLY these)

- `node scripts/depot-test.mjs` — exactly **1707 PASS, 0 FAIL** (nothing pinned moves; K16's signature survives verbatim).
- `node scripts/golden.mjs` — 7/7 (renderer is frozen-law; the change stays inside the depot-only overlay).
- The standing smoke run — build, preview, `smoke.mjs`, kill the preview. (The RETURN TO BASE step flaked once on the mk1.96 landing — if it fails once, re-run before judging; twice is a stop.)

## Step 4 — the landing

`src/version.js` → `mk1.97`; build AFTER the bump; commit (`the two-color zone, mk1.97`); push. Report: gate numbers, no fixture seeds drawn (no test changes), deviations as labeled bullets.

**The owner's live check** (phone AND desktop): arm anything — the field reads the buildable green where that unit may stand, red where it may not, at half strength; colors and weight are his to re-dial on sight.
