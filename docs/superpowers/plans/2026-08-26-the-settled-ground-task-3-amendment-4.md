# The Settled Valley — Amendment 4: the mound blocks, men go around

*Written by Claude Fable 5, 2026-08-26, on the owner's ruling: "if it's too dense to go through they can go around." Dispatched on the owner's order in the same message. Verified in scratch before dispatch: 16 random maps, connectivity 16/16, five mound crossings via the real router, zero failures.*

## The ruling recorded

A rubble mound is too dense to walk through — so it blocks its cells like a rock, and the router honestly walks men around it. This is the one named exception to ruling 2's open-cells law, taken knowingly. Shells, stumps, and chimneys stay open ground.

## The three fixes

**1. `src/depot/DepotGame.jsx`** — the footprint claim (Task 3's Step 6b region):

old:
```js
    if (!t.dead) for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); } // T2: a born ruin blocks no cell
```
new:
```js
    if (!t.dead || t.form === "mound") for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); } // T2: a born ruin blocks no cell — EXCEPT the mound (owner, 2026-08-26): too dense to walk, the router goes around
```

The restore path needs no edit: a mound rides the save `ruined: true`, and its cells re-claim on boot from the regrown TOWN through this same line's rule at restore's own claim site — the restore claim reads `if (!ruined)`, so it gains the same exception:

old (restore, `:1161` region):
```js
          if (!ruined) for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); }
```
new:
```js
          if (!ruined || t.form === "mound") for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); } // the mound's exception (owner, 2026-08-26)
```

**2. `src/depot/mapgen.js`** — makeMap's stamp loop:

old:
```js
      if (t.dead) continue; // T2: a born ruin blocks no cell — connectivity judges the true ground
```
new:
```js
      if (t.dead && t.form !== "mound") continue; // T2: a born ruin blocks no cell — except the mound (owner): the router goes around
```

**3. `scripts/tests/33-the-settled-ground.mjs`** — the crossing check becomes THE WAY AROUND: the real game loop (routing every tick, then the legs), asserting arrival past the mound. The slice list gains `sliceFn("stepSquadRouting")` and the assembly gains the injected `planRoute` (era 06's idiom: import `planRoute` from `../../src/depot/route.js`, add `"planRoute"` to the `new Function` parameter list and pass it). The sweep's "no born ruin blocks a cell" law excludes mounds (`if (t.form !== "mound")` guards the cell loop) and gains its mirror: every mound's cells ARE blocked. The crossing block:

```js
// ==== the way around: a squad ordered past a mound arrives ==================
// The mound blocks its cells (owner, 2026-08-26: too dense to walk, men go
// around); the real router carries the squad past it. Routing every tick,
// then the legs — the live game's own loop.
{
  ok("around: the random sweep turned up a mound", !!sweepMound);
  if (sweepMound) {
    const { Mi, m } = sweepMound;
    const flatW = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const world = makeWorld({ field: flatW, seed: 9 });
    world._tdStruct = true; world.depotCombat = true;
    world.inRim = () => true; world.pondAt = () => false; world.streamAt = () => false;
    const g = Mi.makeGrid(null);
    Mi.buildTown(world, g, flatW);
    const sq = makeSquad(1, "rifles", 1, m.x - 8, m.z);
    spawnSquadMembers(world, sq);
    const DEST = { x: m.x + 8, z: m.z };
    sq.order = "move"; sq.dest = { ...DEST };
    for (let i = 0; i < 60 * 120; i++) { Mi.stepSquadRouting(g, sq, world); stepSquad(world, sq, 1 / 120); stepWorld(world); }
    let worst = 0, alive = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (u && u.alive) { alive++; worst = Math.max(worst, Math.hypot(u.pos.x - DEST.x, u.pos.z - DEST.z)); }
    }
    ok("around: all four men arrive past the mound, within 3.5m in 60s", alive === 4 && worst < 3.5, `alive ${alive}, worst ${worst.toFixed(2)}m`);
  }
}
```

(The `sweepMound` capture changes to carry `Mi` only — the mound entry is re-found from `Mi.state()`; or keep the `{ Mi, m }` shape as today. The sweep's own `mkMap` return line gains `stepSquadRouting` and the state stays as is.)

## The license

These three fixes, the crossing block's re-teach, the sweep law's mound exclusion with its blocked-cells mirror, and (extended at dispatch, owner's order) the file's own stamp-line source pin re-taught to the mound exception — it reds purely as fix 2's mechanical mirror. The mirror check is a new check: suite 2,090 → 2,091. Any further red stops the task.

## Resume

Step 8: depot-test twice, depot-lint, smoke; Step 9's deploy, this amendment staged with the rest.
