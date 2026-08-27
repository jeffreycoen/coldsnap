# The Settled Ground — Task 6: The Carpenter (mk2.66)

*Written by Claude Fable 5, 2026-08-27, against mk2.65 (commit 7518440), on the owner's rulings: the full plate work, both tints, beams in every building, four sails on the mill, and NO ROOF that is a layer of cubes. Every code block ran green in scratch — the equality sweep holds over every beam and plate on 30 random maps (average planned mass 4,805 of the 6,000 cap, worst boot 5,567 of the 7,000 pool, 30/30 connected). Suggested model: Sonnet — fully specified.*

## What this task does

The buildings stop looking alike, and they gain real carpentry. THE BEAM joins the vocabulary — one long narrow box, shrunk or grown — and one shared walker, `layDressing`, holds every beam, plate, and trim body a form wears. `buildTown` lays what the walker says; `stoneCount` counts the same walker; drift is impossible by construction.

Per building: pitched slate roofs on stepped stone gables, each carried on a RIDGE BEAM (shoot the spine and the roof slumps); a lintel beam and a timber door ajar at every doorway; the row houses' stepped roofline with a beam per segment; THE MILL'S FOUR SAILS — a hub stone and four arm beams each carrying its sail plate, each arm shearing alone, the hub dropping the whole cross; the smithy's framed awning (posts, eave beam, plate); the inn's bracket beam and hung sign; the well's posts, windlass crossbar, and little roof; the bell tower's pyramid cap with a yoke beam and a hung bell (shoot the yoke, the bell drops); the warehouse's plank roof on two joist beams — its stone lid is gone; the watch tower open under its cap — lid gone; the keep crenellated, open ring, no lid; the hangar's header beams and door leaves, one ajar; gate leaves on the gateposts; and inside every shell ruin, the fallen roof plate with its fallen ridge beam in the rubble. NO STONE LIDS remain anywhere.

Two tints land in the renderer: slate for roofs, dark timber for beams, doors, sails, signs, and gates. Every dressed body is a real welded chunk: it falls, slides, and breaks when the walls do.

## Required reading

Report opens confirming each: this plan whole; `src/depot/mapgen.js` (stoneCount and the form book); `src/depot/DepotGame.jsx:200-400` (buildTown); `src/render/renderer.js:920-940` and `:2195-2212`; `scripts/tests/33-the-settled-ground.mjs` whole; the thirteen slicer sites in Step 6; `src/version.js`.

## Licensed re-teaches

1. **The template pins** (`33-the-settled-ground.mjs`, TPLS): all 28 values re-taught to the dressed costs — Step 7 is the complete replacement, computed by the new counter itself.
2. Nothing else. The boot bounds hold (measured worst 5,567 under 6,200/6,500). T24, the era-05 sweeps, and the twin battle pass untouched. Any other red stops the task.

## Steps

### Step 1 — the mark

`src/version.js:6`: `mk2.65` → `mk2.66`.

### Step 2 — mapgen: the form book and the roof rules

**2a.** The keep gains its flag, old→new:
```js
    keep: { t: "keep", nx: 7, nz: 6, ny: 5, cols: true },
```
```js
    keep: { t: "keep", nx: 7, nz: 6, ny: 5, cols: true, cren: true },  // mk2.66: crenellated top, no roof course
```

**2b.** In `stoneCount`'s live loop, the roof line grows the two rules, old→new:
```js
    if (iy === t.ny && (t.roof === false || t.slab)) continue;
```
```js
    const pitchedForm = /^(croft|shed|house|long|granary|mill|smithy|inn|spring|row|chapel|warehouse|watch)/.test(t.id || "");
    if (iy === t.ny && (t.roof === false || t.slab || pitchedForm)) continue; // mk2.66: NO STONE LIDS (owner) — plates on structure, never a layer of cubes
    if (t.cren && iy === t.ny && (!perim || (ix + iz) % 2)) continue; // mk2.66: the keep's crenellations
```

**2c.** `stoneCount`'s tail counts the walker — after the `if (t.slab) n++;` line insert:
```js
  layDressing(t, () => n++); // mk2.66: every beam and plate counts — one walker, no drift
```
and inside the dead branch, directly before the shell's `return n;`:
```js
    layDressing(t, () => n++); // mk2.66: the shell's fallen roof and beam count
```

### Step 3 — mapgen: the walker, appended whole at the end of the file

```js
// THE CARPENTER (mk2.66, owner): every beam, plate, and trim body a form
// wears, as ONE walker shared by buildTown (which lays real bodies) and
// stoneCount (which counts them) — plan and lay cannot drift by construction.
// THE BEAM is the working member: a long narrow box, shrunk or grown — ridge
// beams, lintels, sail arms, joists, posts, the windlass, the bell's yoke.
// NO STONE LIDS (owner): no roof is a layer of cubes; every roof is plates
// on structure. All dials provisional (F5).
export function formOf(t) { return (t.id || "").replace(/[0-9]+$/, ""); }
export function layDressing(t, put) {
  const f = formOf(t);
  const p = MASON.pitch, hcs = MASON.hcs;
  const L = Math.max(t.nx, t.nz), W = Math.min(t.nx, t.nz);
  const ridgeX = t.nx >= t.nz;
  const topY = t.ny * p;
  const beam = (dx, dy, dz, hx, hy, hz, axis, angle, mass) =>
    put({ dx, dy, dz, hx, hy, hz, axis, angle, tint: "timber", mass: mass || 140 });
  // the doorway: a lintel beam over the opening, and a timber door ajar.
  const doorway = () => {
    if (t.door == null || t.door < 0) return;
    const dxs = (t.door - (t.nx - 1) / 2) * p;
    const zc = (1.5 - (t.nz - 1) / 2) * p;
    beam(dxs, p * 3.05, zc, 0.09, 0.09, p * 1.35, null, 0, 90);          // the lintel
    put({ dx: dxs, dy: p * 0.9, dz: zc, hx: 0.08, hy: p * 0.95, hz: p * 0.8,
      axis: "y", angle: 0.5, tint: "timber", mass: 90 });                 // the door, ajar
  };
  // the pitched roof: stepped stone gables, a RIDGE BEAM, two tilted plates
  // welded along it. The beam is the spine — shoot it out and the roof slumps.
  const pitched = (steep) => {
    const H = Math.max(1, Math.floor(W / 2));
    const ridgeH = H * p * (steep ? 1.25 : 0.85);
    const ang = Math.atan2(ridgeH, (W * p) / 2);
    for (let end = 0; end < 2; end++) {
      const e = end === 0 ? -(L - 1) / 2 : (L - 1) / 2;
      for (let st = 1; st <= H; st++) for (let j = st; j <= W - 1 - st; j++) {
        const w0 = (j - (W - 1) / 2) * p;
        put({ dx: ridgeX ? e * p : w0, dy: topY + (st - 1) * p, dz: ridgeX ? w0 : e * p,
          hx: hcs, hy: hcs, hz: hcs, stone: true });
      }
    }
    const rl = (L * p) / 2 + 0.3;
    beam(0, topY - hcs + ridgeH + 0.02, 0, ridgeX ? rl : 0.09, 0.09, ridgeX ? 0.09 : rl, null, 0, 160);
    const slope = Math.hypot((W * p) / 2, ridgeH) / 2 + 0.25;
    for (const sgn of [-1, 1]) {
      const off = sgn * (W * p) / 4;
      put({ dx: ridgeX ? 0 : off, dy: topY - hcs + ridgeH / 2 + 0.10, dz: ridgeX ? off : 0,
        hx: ridgeX ? (L * p) / 2 + 0.2 : slope, hy: 0.06, hz: ridgeX ? slope : (L * p) / 2 + 0.2,
        axis: ridgeX ? "x" : "z", angle: sgn * ang * (ridgeX ? -1 : 1), tint: "roof", mass: 320 });
    }
    return ridgeH;
  };
  if (t.depot) return;
  if (t.dead) {
    if (t.form === "shell") {   // the fallen roof, and its fallen ridge beam
      put({ dx: 0, dy: 1.05, dz: 0, hx: (Math.max(2, L - 2) * p) / 2, hy: 0.06, hz: (Math.max(1.5, W - 2) * p) / 2,
        axis: ridgeX ? "x" : "z", angle: 0.45, tint: "roof", mass: 320 });
      beam(ridgeX ? 0 : 0.6, 0.55, ridgeX ? 0.6 : 0, ridgeX ? (L * p) / 3 : 0.08, 0.08, ridgeX ? 0.08 : (L * p) / 3, ridgeX ? "z" : "x", 0.25, 120);
    }
    return;
  }
  if (f === "croft" || f === "shed" || f === "granary" || f === "spring") { pitched(false); doorway(); return; }
  if (f === "house" || f === "long") { pitched(false); doorway(); return; }
  if (f === "chapel") { pitched(true); doorway(); return; }
  if (f === "keep") { doorway(); return; }   // crenellations lay in the lattice; open ring, no lid
  if (f === "smithy") {                       // the framed awning: posts, eave beam, plate
    pitched(false); doorway();
    const aw = (L * p) / 2 - 0.2, az = -((W * p) / 2 + 0.75);
    beam(-aw + 0.2, p * 1.15, az, 0.08, p * 1.15, 0.08, null, 0, 70);
    beam(aw - 0.2, p * 1.15, az, 0.08, p * 1.15, 0.08, null, 0, 70);
    beam(0, p * 2.3, az, aw, 0.07, 0.07, null, 0, 90);
    put({ dx: 0, dy: p * 2.45, dz: az + 0.35, hx: aw, hy: 0.05, hz: 0.95, axis: "x", angle: 0.3, tint: "roof", mass: 140 });
    return;
  }
  if (f === "inn") {                          // the bracket beam and the hung sign
    pitched(false); doorway();
    beam((t.nx * p) / 2 + 0.45, p * 2.6, 0, 0.45, 0.07, 0.07, null, 0, 60);
    put({ dx: (t.nx * p) / 2 + 0.75, dy: p * 2.1, dz: 0, hx: 0.30, hy: 0.24, hz: 0.05, tint: "timber", mass: 40 });
    return;
  }
  if (f === "row") {                          // the stepped roofline, a ridge beam per segment
    const segs = [[0, 2], [3, 5], [6, t.nx - 1]];
    const H = Math.max(1, Math.floor(t.nz / 2));
    for (let si = 0; si < segs.length; si++) {
      const [a, b] = segs[si];
      const segL = (b - a + 1) * p, cx = ((a + b) / 2 - (t.nx - 1) / 2) * p;
      const ridgeH = H * p * 0.85 + (si % 2 ? 0.3 : 0);
      const ang = Math.atan2(ridgeH, (t.nz * p) / 2);
      const slope = Math.hypot((t.nz * p) / 2, ridgeH) / 2 + 0.2;
      beam(cx, topY - hcs + ridgeH + 0.02, 0, segL / 2 + 0.1, 0.08, 0.08, null, 0, 140);
      for (const sgn of [-1, 1]) {
        put({ dx: cx, dy: topY - hcs + ridgeH / 2 + 0.10, dz: sgn * (t.nz * p) / 4,
          hx: segL / 2 + 0.1, hy: 0.06, hz: slope, axis: "x", angle: -sgn * ang, tint: "roof", mass: 300 });
      }
    }
    doorway();
    return;
  }
  if (f === "mill") {                         // THE FOUR SAILS: hub stone, four arm beams, four sail plates
    const rh = pitched(false); doorway();
    const face = ridgeX ? 1 : 0;              // the sails hang on a short-axis face
    const fy = topY + rh - 0.1, armL = 2.1;
    const fx = face ? 0 : (t.nx * p) / 2 + 0.16, fz = face ? (t.nz * p) / 2 + 0.16 : 0;
    put({ dx: fx, dy: fy, dz: fz, hx: 0.22, hy: 0.22, hz: 0.22, tint: "timber", mass: 120 }); // the hub
    for (const a of [0.785, 2.356, 3.927, 5.498]) {
      const ux = face ? Math.sin(a) : 0, uy = Math.cos(a), uz = face ? 0 : Math.sin(a);
      beam(fx + ux * (armL / 2 + 0.25), fy + uy * (armL / 2 + 0.25), fz + uz * (armL / 2 + 0.25),
        0.06, armL / 2, 0.06, face ? "z" : "x", face ? -a : a, 70);
      put({ dx: fx + ux * (armL * 0.72 + 0.25), dy: fy + uy * (armL * 0.72 + 0.25), dz: fz + uz * (armL * 0.72 + 0.25),
        hx: face ? 0.30 : 0.045, hy: armL * 0.30, hz: face ? 0.045 : 0.30,
        axis: face ? "z" : "x", angle: face ? -a : a, tint: "timber", mass: 50 });
    }
    return;
  }
  if (f === "belltower" || f === "watch") {   // the pyramid cap; the tower's own bell on its yoke
    const half = (t.nx * p) / 2;
    for (const [ax, sgn] of [["x", 1], ["x", -1], ["z", 1], ["z", -1]]) {
      put({ dx: ax === "z" ? sgn * half * 0.5 : 0, dy: topY + 0.35, dz: ax === "x" ? sgn * half * 0.5 : 0,
        hx: ax === "x" ? half : half * 0.55, hy: 0.05, hz: ax === "z" ? half : half * 0.55,
        axis: ax, angle: -sgn * 0.7, tint: "roof", mass: 120 });
    }
    if (f === "belltower") {
      beam(0, topY - p * 0.6, 0, half - 0.05, 0.07, 0.07, null, 0, 60);   // the yoke
      put({ dx: 0, dy: topY - p * 1.15, dz: 0, hx: 0.16, hy: 0.20, hz: 0.16, tint: "timber", mass: 80 }); // the bell
    }
    return;
  }
  if (f === "well") {                         // posts, the windlass crossbar, the little roof
    beam(-(t.nx * p) / 2 + 0.1, p * 1.6, 0, 0.07, p * 1.6, 0.07, null, 0, 60);
    beam((t.nx * p) / 2 - 0.1, p * 1.6, 0, 0.07, p * 1.6, 0.07, null, 0, 60);
    beam(0, p * 2.5, 0, (t.nx * p) / 2 - 0.05, 0.06, 0.06, null, 0, 50); // the windlass
    for (const sgn of [-1, 1]) {
      put({ dx: 0, dy: p * 3.1, dz: sgn * (t.nz * p) / 4, hx: (t.nx * p) / 2 + 0.25, hy: 0.05, hz: 0.65,
        axis: "x", angle: -sgn * 0.6, tint: "roof", mass: 90 });
    }
    return;
  }
  if (f === "warehouse") {                    // plank roof on joists — the lid is gone
    const jl = ridgeX ? (W * p) / 2 + 0.2 : (L * p) / 2 + 0.2;
    for (const e of [-1, 1]) {
      const off = e * (L * p) / 4;
      beam(ridgeX ? off : 0, topY - hcs + 0.08, ridgeX ? 0 : off, ridgeX ? 0.09 : jl, 0.09, ridgeX ? jl : 0.09, null, 0, 180);
    }
    for (const k of [-1, 0, 1]) {
      const off = k * (L * p) / 3.2;
      put({ dx: ridgeX ? off : 0, dy: topY - hcs + 0.26, dz: ridgeX ? 0 : off,
        hx: ridgeX ? (L * p) / 6.2 : jl, hy: 0.05, hz: ridgeX ? jl : (L * p) / 6.2,
        axis: ridgeX ? "x" : "z", angle: 0.06, tint: "roof", mass: 260 });
    }
    return;
  }
  if (f === "hangar") {                       // header beams over the drive openings, doors below
    const driveZ = t.drive && t.nz >= t.nx;
    const span = (driveZ ? t.nx : t.nz) * p;
    for (const end of [-1, 1]) {
      const e = end * ((driveZ ? t.nz : t.nx) - 1) / 2 * p;
      beam(driveZ ? 0 : e, (t.ny - 1) * p + 0.15, driveZ ? e : 0, driveZ ? span / 2 - 0.2 : 0.1, 0.09, driveZ ? 0.1 : span / 2 - 0.2, null, 0, 220);
      for (const half of [-1, 1]) {
        put({ dx: driveZ ? half * span / 4 : e, dy: (t.ny - 1) * p / 2 + 0.2, dz: driveZ ? e : half * span / 4,
          hx: driveZ ? span / 4 - 0.1 : 0.08, hy: (t.ny - 1) * p / 2, hz: driveZ ? 0.08 : span / 4 - 0.1,
          axis: "y", angle: half === end ? 0.7 : 0, tint: "timber", mass: 400 });
      }
    }
    return;
  }
  if (f === "gatepost") {                     // each post hangs its gate leaf
    put({ dx: 0.55, dy: p * 1.4, dz: 0, hx: 0.5, hy: p * 1.3, hz: 0.05, axis: "y", angle: 0.5, tint: "timber", mass: 120 });
    return;
  }
}
```

### Step 4 — buildTown lays it (`src/depot/DepotGame.jsx`)

**4a.** The live lay's roof line, old→new (eight-space indent):
```js
        if (iy === t.ny && (t.roof === false || t.slab)) continue; // T4: a slab replaces the granular roof below
```
```js
        const pitchedForm = /^(croft|shed|house|long|granary|mill|smithy|inn|spring|row|chapel|warehouse|watch)/.test(t.id || "");
        if (iy === t.ny && (t.roof === false || t.slab || pitchedForm)) continue; // T4/mk2.66: NO STONE LIDS (owner) — a slab or plates on structure, never a layer of cubes
        if (t.cren && iy === t.ny && (!perim || (ix + iz) % 2)) continue; // mk2.66: the keep's crenellations
```

**4b.** `layDressing` joins the mapgen import line (`, layDressing` before the closing brace).

**4c.** Directly after `buildTown`'s opening two lines, insert the carpenter:

```js
  // THE CARPENTER (mk2.66): lay every dressing body layDressing walks —
  // plates and trim, tilted by axis+angle, tinted, welded to the nearest
  // lattice stones so they fall when the walls do.
  const qOf = (axis, angle) => {
    if (!axis || !angle) return undefined;
    const h = angle / 2, sh = Math.sin(h);
    return { x: axis === "x" ? sh : 0, y: axis === "y" ? sh : 0, z: axis === "z" ? sh : 0, w: Math.cos(h) };
  };
  const layDress = (t, grid3, base) => {
    let di = 0;
    layDressing(t, (o) => {
      const c = addBody(world, { kind: "chunk", team: 0, mass: o.mass || MASON.mass,
        hx: o.hx, hy: o.hy, hz: o.hz,
        x: t.x + o.dx, y: base + o.dy, z: t.z + o.dz,
        friction: 0.65, restitution: 0.02, q: qOf(o.axis, o.angle) });
      c.sleeping = true; c.town = t.id; c.gpos = [-3, 100 + di++, 0]; // 100+: never mistaken for a course-0 stone by the suite
      if (o.tint) c.tint = o.tint;
      // welded to the three nearest lattice stones in reach — it falls with the walls
      const near = [];
      for (const s of grid3) {
        if (s.gpos[0] === -3) continue;
        const dd = Math.hypot(s.pos.x - c.pos.x, s.pos.y - c.pos.y, s.pos.z - c.pos.z);
        if (dd < 2.2) near.push([dd, s]);
      }
      near.sort((a, b2) => a[0] - b2[0]);
      for (let i = 0; i < Math.min(3, near.length); i++) addWeld(world, c, near[i][1], MASON.breakF);
      grid3.push(c);
    });
  };
```

**4d.** One line directly above `const cells = townFootprint(grid, t);`:
```js
    if (!t.depot) layDress(t, grid3, field.heightAt(t.x, t.z) + hcs + 0.02); // mk2.66: the carpenter dresses every standing and shell form
```

### Step 5 — the renderer tints (`src/render/renderer.js`)

**5a.** After the `const chunkMesh = pool(...)` line and its `receiveShadow` line:
```js
  // mk2.66 (owner): THE TWO TINTS — slate roofs, dark timber. Per-instance
  // color on the one chunk pool; wall stones stay the material's own gray.
  const CHUNK_WALL_C = new THREE.Color(0xffffff), CHUNK_ROOF_C = new THREE.Color(0x5a626e), CHUNK_TIMBER_C = new THREE.Color(0x33291f);
```

**5b.** In the chunk draw loop, after `writeInst(chunkMesh, ki, ...)` and before `ki++;`:
```js
      chunkMesh.setColorAt(ki, b.tint === "roof" ? CHUNK_ROOF_C : b.tint === "timber" ? CHUNK_TIMBER_C : CHUNK_WALL_C);
```

**5c.** The flush line gains ` if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;` at its end.

### Step 6 — the thirteen slicers learn the walker

Every slice list containing a `stoneCount` slice gains `sliceFnX("formOf"), sliceFnX("layDressing"), ` DIRECTLY BEFORE its `sliceFnX("stoneCount")`, matching each site's slicer name:

1. `scripts/tests/33-the-settled-ground.mjs:35` (`sliceFn`)
2. `scripts/tests/05-the-front.mjs:54` (`sliceFn2`), `:124` and `:195` (`sliceFn3`), `:279` (`sliceFn4`), `:427-428` (`sliceFn5`), `:538` (`sliceFn6`)
3. `scripts/tests/02-front-f1.mjs:45` (`sliceFn`)
4. `scripts/tests/06-troops-physics.mjs:45` (`sliceFnP`)
5. `scripts/tests/07-armor-demolition.mjs:214` (`sliceFn4`), `:542` (`sliceFn5`), `:715` (`sliceFn6`)
6. `scripts/tests/08-debug-pass.mjs:233` (`sliceFn15`)

Line numbers may drift; anchor on the slice-list lines.

### Step 7 — the template pins re-taught (file 33)

Replace the whole `TPLS` array with (dressed costs from the new counter; entries carry ids because the walker reads the form from the id):

```js
  const TPLS = [
    ["croft", {"id":"croft0","nx":4,"nz":3,"ny":3,"door":0}, 31],
    ["watch", {"id":"watch0","nx":2,"nz":2,"ny":8,"door":0}, 33],
    ["yard", {"id":"yard0","nx":6,"nz":5,"ny":2,"door":0,"roof":false}, 32],
    ["shed", {"id":"shed0","nx":4,"nz":4,"ny":3,"door":0}, 39],
    ["granary", {"id":"granary0","nx":3,"nz":3,"ny":7,"door":0}, 57],
    ["house 5x4", {"id":"house0","nx":5,"nz":4,"ny":4,"door":0}, 59],
    ["long", {"id":"long0","nx":8,"nz":4,"ny":3,"door":0,"cols":true}, 69],
    ["house 6x5", {"id":"house1","nx":6,"nz":5,"ny":4,"door":0,"cols":true}, 87],
    ["hangar", {"id":"hangar0","nx":9,"nz":10,"ny":5,"door":-1,"slab":true,"drive":true}, 121],
    ["chapel", {"id":"chapel0","nx":5,"nz":6,"ny":5,"door":0,"cols":true}, 107],
    ["warehouse", {"id":"warehouse0","nx":8,"nz":6,"ny":4,"door":0,"cols":true}, 103],
    ["keep", {"id":"keep0","nx":7,"nz":6,"ny":5,"door":0,"cols":true,"cren":true}, 127],
    ["shell 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"shell"}, 28],
    ["stump 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"stump"}, 14],
    ["mound 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"mound"}, 10],
    ["chimney 4x4x3", {"id":"croft9","nx":4,"nz":4,"ny":3,"door":0,"dead":true,"form":"chimney"}, 5],
    ["row houses", {"id":"row0","nx":9,"nz":4,"ny":3,"door":0,"parts":[3,6]}, 83],
    ["inn", {"id":"inn0","nx":6,"nz":5,"ny":4,"door":0,"cols":true}, 89],
    ["inn yard", {"id":"innyard0","nx":6,"nz":5,"ny":2,"door":-1,"roof":false}, 36],
    ["smithy", {"id":"smithy0","nx":4,"nz":3,"ny":3,"door":0}, 35],
    ["smithy chimney", {"id":"chimneyc0","nx":1,"nz":1,"ny":5,"door":-1,"roof":false}, 5],
    ["well", {"id":"well0","nx":2,"nz":2,"ny":1,"door":-1,"roof":false}, 9],
    ["mill", {"id":"mill0","nx":3,"nz":3,"ny":6,"door":0}, 58],
    ["bell tower", {"id":"belltower0","nx":2,"nz":2,"ny":8,"door":-1,"roof":false}, 38],
    ["graveyard", {"id":"graveyard0","nx":6,"nz":5,"ny":2,"door":-1,"roof":false,"stones":true}, 40],
    ["wayside cross", {"id":"cross0","nx":1,"nz":1,"ny":2,"door":-1,"roof":false}, 2],
    ["gatepost", {"id":"gatepost0","nx":1,"nz":1,"ny":3,"door":-1,"roof":false}, 4],
    ["springhouse", {"id":"spring0","nx":2,"nz":2,"ny":2,"door":0}, 11],
  ];
```

### Step 8 — gates

`node scripts/gate.mjs depot-test` TWICE (both green, suite 2,091), `node scripts/gate.mjs depot-lint`, then `npm run build`, THEN `node scripts/gate.mjs smoke` (instant-crash retry rule stands). Run straight through — no parking between steps. Quote both runs' [settled sweep] seed lines.

### Step 9 — the deploy

Commit and push. Subject: `the carpenter — beams, roofs, sails, and the two tints, mk2.66`. Stage the four code files, the six amended test files, and this plan document.

## The owner's live check

Boot valleys: pitched slate roofs on ridge beams, the chapel's steepest; row houses stepping their roofline; the mill turning four sails on its hub; lintels and doors ajar; the smithy's framed awning; the inn's hung sign; wells with windlass and roof; the belfry's bell on its yoke; the warehouse's plank roof on joists; the keep and watch tower open-topped; gates on the gateposts; fallen roofs and beams inside the shells; slate and timber against the stone gray. Phone and desktop. Every angle, size, and tint is a dial for your eye.
