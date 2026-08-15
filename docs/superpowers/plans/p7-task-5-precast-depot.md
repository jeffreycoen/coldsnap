*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton and binding rulings.*

# Task 5 — The precast depot and the honest resume (mk1.34) — FULL PLAN

**What it does, in one line:** kills the resume ghost (the save stops carrying the mk1.05 broadphase bookkeeping that left every resumed sleeping stone untouchable to contact physics) and rebuilds BOTH depots as column-and-panel precast — a quarter the bodies, the measured boom cost at the wall drops 5.3 → 1.6 ms, panels fall as whole slabs, columns drop the roof.

**The evidence behind it (2026-08-15, in the decision record):** ghost repro — fresh boot 17,104 hull-vs-stone contacts, simulated resume ZERO; stutter capture — the blast occlusion scan over ~369 depot stones is the dominant term at 5.1-5.3 ms per boom, the solver-LOD theory dead.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch):**
- This section whole; the decision record's PRECAST DEPOT / RESUMED STONES / PLOW STUTTER entries.
- `.superpowers/diag-depot-ram.mjs` and `.superpowers/diag-resume-ghost.mjs` — the two probes; the slab-depot variant at the ram probe's tail is this task's construction sketch.
- `src/depot/save.js` whole (BODY_HANDLED, writeBody's sweep, readBody's resets, serializeFront/restoreBodies).
- `src/depot/DepotGame.jsx` — buildTown whole (the lattice loop, the depot buttress block, weld map, the slab branch for `t.slab`, townFootprint, the flag), the boot censuses.
- `src/depot/state.js` :880-989 (census/standing/breach — verify the precast pieces flow through untouched).
- `src/engine/core.js` :1362-1500 (collectContacts — the `_filed`/`_cells` lifecycle you are un-ghosting; READ ONLY).
- `scripts/depot-test.mjs` — harness, the existing save round-trip block (grep `serializeFront`), the P7 blocks at the tail, any pin on depot stone counts.
- `src/depot/specs.js` MASON. `src/version.js`.

**Trap notes (binding):**
1. save.js is IN SCOPE this once (the defect lives there): `BODY_HANDLED` gains `"_filed"` and `"_cells"` (the writer drops them), and readBody resets both beside the targeting-cache resets (`b._filed = false; b._cells = null;`). Nothing else in save.js moves.
2. NO core.js edits — the engine's filing lifecycle is correct; the save was lying to it.
3. The precast branch lives inside buildTown, keyed on `t.depot` — the non-depot path is byte-untouched. Everything downstream (townFootprint, censuses, stepTown, breach fractions, sappers' standingStructure, the flag anchor) must flow through UNCHANGED — panels and the slab are ordinary `chunk` bodies with `town` set.
4. The door is the front face's MIDDLE BAY (no panel, full height, ~1.7 m clear between column faces) — men walk in, hulls don't fit. The front face is the one FACING THE FIELD: iz = 0 in lattice space for the player depot and the enemy's alike (the T() rotation carries both; do not special-case teams).
5. Weld law: MASON.breakF everywhere; every panel welded to BOTH its columns at three heights; the slab welded to every column cap AND every panel top; crowns welded down onto the slab. No weld may bridge two panels directly.
6. gpos on precast pieces: columns keep real [ix, iy, iz]; panels/slab use sentinel first components (< 0) — nothing reads gpos on depot pieces after build except saves (generic array — fine), but keep them unique.
7. Body budget sanity: ~each depot lands near 90-110 bodies (columns ~10×7, panels ~9, slab 1, crowns 8). The fixture asserts the range; the report states the exact count and the re-measured boom probe.
8. Renderer untouched — panels and the slab draw through the instanced chunk mesh exactly as the hangar's slab always has.
9. mk1.33 saves are refused by the mark gate — no migration.

## Step 1 — Asserts first (failing)

Append the P7 T5 block before the fails check.

```js
// ==== P7 T5: THE PRECAST DEPOT AND THE HONEST RESUME ========================
{
  // (a) THE GHOST DIES: a full save/restore round trip, then a hull driven
  // at the restored sleeping masonry — contacts must form. Build the save
  // ctx the same minimal way the existing round-trip block does (reuse its
  // helpers/shape — read it first).
  //   world A: 20 welded sleeping chunks (town "depot2") + squads/T/town/census ctx as the existing block builds them
  //   run 60 steps (files the stones into A's books: _filed goes true)
  //   json = serializeFront(...); ok("(a1) the file carries no broadphase bookkeeping", !json.includes("_filed") && !json.includes("_cells"));
  //   world B: parseFront + restoreBodies (+ restoreWelds)
  //   drive a manual-ctl 2600kg hull (the diag's shape) at the restored wall for 1200 steps
  //   count hull-vs-chunk contacts; ok("(a2) resumed stones are solid again", contacts > 0);
  //   ok("(a3) resumed stones still displace", movedStones > 0);
  // (b) THE PRECAST SHAPE (sliced buildTown, the T3 map-assert machinery):
  //   for the pinned seed: both depots' body sets contain
  //     - column stones: kind chunk, unit dims (hx===MASON.hcs), count in [60, 80]
  //     - panels: hy > 2 (full-height slabs), mass 750, count in [7, 10]
  //     - exactly one roof slab: hy === 0.2, hx > 4, mass 900
  //     - crowns: 8
  //   total per depot in [80, 110]  (vs ~300 for the lattice — assert < 150)
  // (c) THE DOOR BAY: no panel occupies the front face's middle bay (a
  //   point probe at the bay center at man height finds no body).
  // (d) THE SIEGE STILL WORKS: displace 65% of one depot's census
  //   (teleport pieces > DEPOT_STANDING_TOL) -> depotStandingFraction < 0.40
  //   -> checkEnemyBreach fires; 30% displaced does not.
  // (e) THE PANEL FALLS WHOLE: shear one panel's welds (set broken), wake
  //   it, run 600 steps -> the panel body lies displaced/toppled (R[4]
  //   moved or pos dropped) while its columns stand.
}
// ==== end P7 T5 ==============================================================
```
(The block is sketched in comments because two of its fixtures must reuse existing harness machinery — the save round-trip helpers and the T3 slicing. Write the real asserts against those shapes; keep every `ok()` line named as above.)

## Step 2 — save.js: the honest resume

- BODY_HANDLED (:54-59) gains two entries with the comment:
```js
  "_filed", "_cells", // mk1.05's broadphase bookkeeping — NEVER saved: a restored
                      // stone marked filed against an empty book is a ghost (P7 T5)
```
- readBody, beside the targeting-cache reset line:
```js
  // The broadphase re-files restored sleepers itself — a carried _filed
  // would tell it not to (the resume ghost, P7 T5).
  b._filed = false; b._cells = null;
```

## Step 3 — buildTown: the precast depot

Inside buildTown's per-town loop, the depot goes down its own construction path (`if (t.depot) { ... continue-into-common-tail ... }`); croft/house/every other template is untouched. The full branch — columns, panels, door bay, slab, crowns, welds:

```js
    // P7 T5 (mk1.34, owner): THE PRECAST DEPOT — column-and-panel, the
    // warehouse lesson at fortress scale. A quarter the lattice's bodies
    // (the measured boom at the wall drops 5.3 -> 1.6 ms); demolition goes
    // structural — shear a panel's welds and it falls as ONE piece, drop
    // columns and the roof pancakes. Same footprint, same censuses, same
    // breach law: every piece is an ordinary chunk with town set.
    if (t.depot) {
      const NY = t.ny;
      const colXs = [0, 4, 7, t.nx - 1];
      const colZs = [0, 4, t.nz - 1];
      const isCol = (ix, iz) =>
        (iz === 0 || iz === t.nz - 1) ? colXs.indexOf(ix) >= 0
        : (ix === 0 || ix === t.nx - 1) ? colZs.indexOf(iz) >= 0 : false;
      const colTops = [];
      for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
        if (!isCol(ix, iz)) continue;
        let below = null;
        for (let iy = 0; iy < NY; iy++) {
          const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
            x: t.x + (ix - (t.nx - 1) / 2) * pitch, y: base + iy * pitch, z: t.z + (iz - (t.nz - 1) / 2) * pitch,
            friction: 0.65, restitution: 0.02 });
          c.sleeping = true; c.town = t.id; c.gpos = [ix, iy, iz];
          grid3.push(c);
          if (below) addWeld(world, below, c, breakF);
          below = c;
          if (iy === NY - 1) colTops.push(c);
        }
      }
      const panelH = (NY * pitch) / 2 - 0.04;
      const panels = [];
      const addPanel = (px, pz, hx2, hz2) => {
        const p = addBody(world, { kind: "chunk", team: 0, mass: 750, hx: hx2, hy: panelH, hz: hz2,
          x: px, y: base + panelH - hcs, z: pz, friction: 0.65, restitution: 0.02 });
        p.sleeping = true; p.town = t.id; p.gpos = [-2, 0, panels.length];
        grid3.push(p); panels.push(p);
        // welded to BOTH its columns at three heights — the shear points
        for (const s of grid3) {
          if (s.gpos[0] < 0 || ![1, 3, NY - 2].includes(s.gpos[1])) continue;
          if (Math.abs(s.pos.x - px) <= hx2 + pitch && Math.abs(s.pos.z - pz) <= hz2 + pitch) addWeld(world, p, s, breakF);
        }
        return p;
      };
      for (const iz of [0, t.nz - 1]) {
        for (let bi = 0; bi + 1 < colXs.length; bi++) {
          if (iz === 0 && bi === 1) continue; // THE DOOR BAY — men walk in, hulls don't fit
          const a = colXs[bi], b2 = colXs[bi + 1];
          addPanel(t.x + ((a + b2) / 2 - (t.nx - 1) / 2) * pitch, t.z + (iz - (t.nz - 1) / 2) * pitch,
            ((b2 - a) * pitch) / 2 - hcs - 0.03, hcs);
        }
      }
      for (const ix of [0, t.nx - 1]) {
        for (let bi = 0; bi + 1 < colZs.length; bi++) {
          const a = colZs[bi], b2 = colZs[bi + 1];
          addPanel(t.x + (ix - (t.nx - 1) / 2) * pitch, t.z + ((a + b2) / 2 - (t.nz - 1) / 2) * pitch,
            hcs, ((b2 - a) * pitch) / 2 - hcs - 0.03);
        }
      }
      // THE ROOF: one rigid slab on the caps and panel tops — the hangar's
      // proven pancake (1-hop convergence, falls whole when the ring shears)
      const slab = addBody(world, { kind: "chunk", team: 0, mass: 900,
        hx: ((t.nx - 1) / 2) * pitch - hcs, hy: 0.2, hz: ((t.nz - 1) / 2) * pitch - hcs,
        x: t.x, y: base + (NY - 0.5) * pitch + 0.2, z: t.z, friction: 0.65, restitution: 0.02 });
      slab.sleeping = true; slab.town = t.id; slab.gpos = [-1, NY, -1];
      grid3.push(slab);
      for (const cTop of colTops) addWeld(world, slab, cTop, breakF);
      for (const p of panels) addWeld(world, slab, p, breakF);
      // the crowns: the four corner silhouettes, on the slab
      for (const [bx, bz] of [[0, 0], [t.nx - 1, 0], [0, t.nz - 1], [t.nx - 1, t.nz - 1]]) {
        let below = slab;
        for (let iy = NY + 1; iy <= NY + 2; iy++) {
          const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
            x: t.x + (bx - (t.nx - 1) / 2) * pitch, y: base + iy * pitch, z: t.z + (bz - (t.nz - 1) / 2) * pitch,
            friction: 0.65, restitution: 0.02 });
          c.sleeping = true; c.town = t.id; c.gpos = [bx, iy, bz];
          grid3.push(c);
          addWeld(world, below, c, breakF);
          below = c;
        }
      }
    } else {
      // ... today's lattice loop, UNTOUCHED, for every non-depot template ...
    }
```
The old depot-only carve rules inside the lattice loop (the depot roof checker, the depot buttress block after it, and the `townBreakF` depot ternary if any trace remains) die with this — the lattice loop simplifies back to the generic template builder. The common tail (footprint cells, the flag anchor, `out.push`) is shared by both branches, unchanged.

## Step 4 — Version, gates, ship

- `src/version.js`: `"mk1.33"` → `"mk1.34"`.
- Gates, ONLY these: `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs`. golden NOT run (core untouched).
- Also run `node .superpowers/diag-depot-ram.mjs` ONCE after landing and report the explode-probe line — the before number is 5.1-5.3 ms; the report states the after.
- Expected re-pins: any depot stone-count or dims-shape pins (T3's own T3(b) counts columns differently now — re-pin honestly); the boot stone count drops sharply (report the new number).
- Commit the task's files only (src/depot/save.js, src/depot/DepotGame.jsx, scripts/depot-test.mjs, src/version.js), push. Message: `the precast depot and the honest resume (mk1.34)` with the standard trailers.
- The owner checks live: resume a bell-saved war and DRIVE INTO masonry — it shoves back (the ghost is dead); the depots read as column-and-panel precast — big flat slabs between stone columns, the flat roof, the crowns; shelling a bay drops the whole panel; contact at the depot no longer stutters the way it did (the measured term fell 3.3×).

**Report format:** read-confirmation first; one line of outcome; the after-boom-probe number and the new boot stone count; every re-pin old→new named; every deviation its own bullet; smoke stated plainly.
