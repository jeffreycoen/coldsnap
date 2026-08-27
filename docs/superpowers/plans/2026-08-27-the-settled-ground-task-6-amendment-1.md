# The Carpenter — Amendment 1: nothing leans on the walls

*Written by Claude Fable 5, 2026-08-27. The agent stopped correctly on the two hangar checks. Scratch reproduction found the true cause: it was not the dressing bodies drifting — the header beam, the door leaves, and the house lintels physically overlapped the wall lattice, and a woken building's contacts shoved its own stones (66 of 121 moved on one map). After these four geometry fixes: 2–6 movers against the test's bar of 7 across repeated random maps, the slab stable, the roof-course reader clean, the equality sweep still green (plan equals lay, cap clean, 30/30 connected), and every template cost unchanged (counts did not move — only positions and sizes).*

## The four fixes, old→new

**1. `src/depot/DepotGame.jsx` — the dressing marker goes negative** (the T4(b) fix — a suite filter reads `gpos[1] >= ny` as a roof stone):

old:
```js
      c.sleeping = true; c.town = t.id; c.gpos = [-3, 100 + di++, 0]; // 100+: never mistaken for a course-0 stone by the suite
```
new:
```js
      c.sleeping = true; c.town = t.id; c.gpos = [-3, -1 - di++, 0]; // negative: never read as a course-0 stone NOR a roof-course stone by any suite filter
```

**2. `src/depot/mapgen.js`, in `layDressing` — the lintel sits inside the opening**, clear of the wall course above it:

old:
```js
    beam(dxs, p * 3.05, zc, 0.09, 0.09, p * 1.35, null, 0, 90);          // the lintel
```
new:
```js
    beam(dxs, p * 2.3, zc, 0.09, 0.08, p * 1.35, null, 0, 90);           // the lintel — inside the opening, clear of the course above
```

**3. `src/depot/mapgen.js`, hangar block — the doors span the OPENING, never the wall**:

old:
```js
    const span = (driveZ ? t.nx : t.nz) * p;
```
new:
```js
    const span = ((driveZ ? t.nx : t.nz) - 2) * p; // the OPENING's width — the leaves live between the jambs, never against them
```

**4. `src/depot/mapgen.js`, hangar block — the header drops into the opening and the leaves shrink clear of the lintel course**:

old:
```js
      beam(driveZ ? 0 : e, (t.ny - 1) * p + 0.15, driveZ ? e : 0, driveZ ? span / 2 - 0.2 : 0.1, 0.09, driveZ ? 0.1 : span / 2 - 0.2, null, 0, 220);
      for (const half of [-1, 1]) {
        put({ dx: driveZ ? half * span / 4 : e, dy: (t.ny - 1) * p / 2 + 0.2, dz: driveZ ? e : half * span / 4,
          hx: driveZ ? span / 4 - 0.1 : 0.08, hy: (t.ny - 1) * p / 2, hz: driveZ ? 0.08 : span / 4 - 0.1,
          axis: "y", angle: half === end ? 0.7 : 0, tint: "timber", mass: 400 });
      }
```
new:
```js
      beam(driveZ ? 0 : e, (t.ny - 1) * p - 0.45, driveZ ? e : 0, driveZ ? span / 2 - 0.2 : 0.1, 0.08, driveZ ? 0.1 : span / 2 - 0.2, null, 0, 220);
      for (const half of [-1, 1]) {
        const lh = ((t.ny - 1) * p) / 2 - 0.35;
        put({ dx: driveZ ? half * span / 4 : e, dy: lh + 0.18, dz: driveZ ? e : half * span / 4,
          hx: driveZ ? span / 4 - 0.1 : 0.07, hy: lh, hz: driveZ ? 0.07 : span / 4 - 0.1,
          axis: "y", angle: half === end ? 0.7 : 0, tint: "timber", mass: 400 });
      }
```

## The license

These four fixes and nothing else. No test changes — T4(b) and T4(e) pass on their own ground once nothing leans on the walls. The TPLS table stands as the plan shipped it (every count unchanged). Any further red stops the task.

## Resume

Task 6 Step 8 from the top: depot-test twice, depot-lint, build, smoke, straight through; then Step 9's commit and push with this amendment staged; then Task 7 exactly per the dispatch.
