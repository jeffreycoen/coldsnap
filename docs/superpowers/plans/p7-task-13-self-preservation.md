# P7 Task 13 — self-preservation (mk1.43)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. Executes the owner's rulings of 08-17/08-18: the movement grid learns steepness (hull no-go), squad routes avoid deadly drops (the ledge brake stays as last resort), hulls keep clearance from masonry and stop cutting corners, ordered driving goes around friendly and neutral masonry but follows a path through ENEMY masonry verbatim, a genuinely stuck hull backs out and replans, and the map's rim joins the slot law. All game-layer: core.js is READ ONLY — the back-out and the corner crawl ride the existing depotDrive "manual" channel (the possession precedent), so golden does not run.*

**AMENDMENT 1 (owner, 2026-08-18, pre-approval): THE GREEN THREADS** — every friendly unit or hull with an active ordered path (move, attack-march, build, patrol, escort) draws its computed route as a green ground-hugging dashed line, all the time, refreshed at the derived-overlay cadence. Ships in this task (owner's packaging ruling) as Step 7; the source-shape asserts ride Step 1's (j) block. Same renderer path on phone and desktop. The look is accepted by the owner's eyes live.

**Suggested model: Sonnet** — fully specced, mechanical execution; every step carries its literal code.

**Scope:** `src/depot/route.js`, `src/depot/drivers.js`, `src/depot/squads.js`, `src/depot/save.js`, `src/depot/DepotGame.jsx`, `src/render/renderer.js`, `scripts/depot-test.mjs`, `src/version.js`. Nothing else.

**Execution of the 08-18 ramming ruling, stated plainly:** routing always prefers around. Only when the route clamps short AND the straight stretch from the clamp to the ordered point is closed by NOTHING but enemy masonry does the hull keep its destination and drive the last stretch straight through — the ram is the order. Friendly or neutral masonry, rock, water, or steep ground in that stretch clamps honestly, as today.

**Scoped limits (stated, not hidden):** terrain masks are stamped once at map build — craters do not restamp them (crater depth ~0.5m sits under both thresholds). Squad cover-hop legs between waypoints are not drop-vetted — the routes avoid the cliffs and the engine's ledge brake stays the last resort for a man shoved mid-leg.

## Required reading, in order (verify anchors before code)

1. `src/depot/route.js` whole (49 lines) — replaced wholesale by Step 2.
2. `src/depot/drivers.js` 63–146 (armorGoal, replaced wholesale by Step 4) and 229–244 (stepDrivers signature).
3. `src/depot/DepotGame.jsx` 439–463 (makeGrid), 49–50 (grid constants: cs 2.0, 60×60), 553–586 (recomputeFlow cost line), 587–609 (checkConnectivity — DO NOT TOUCH), and the eight cell-stamp sites: 884, 906, 1480, 1495–1502, 2043–2046, 2593–2600, 2761–2783, 2807. Also 28 (the planRoute import line region).
4. `src/depot/squads.js` 180–203 (slotBlocked/clearSlot — Step 5's one line) .
5. `src/depot/save.js` 54–60 (BODY_HANDLED).
6. `src/engine/core.js` 916–956 — READ ONLY: driveHull's reverse throttle (target = throttle × 4.5 when negative) and aiDrive's goal-seek; nothing here changes.
7. `scripts/depot-test.mjs` — the T12 block end (insertion point), the P7 T1 fixture (~6408–6468) for the identity fwdDir it passes to stepDrivers, and the source-shape assert idiom at T9(d11).

## Trap notes

- **core.js is untouched.** The back-out and corner crawl write `v.depotDrive = "manual"` + `v.ctl` — the exact channel possession uses. Golden does not run; if you find yourself editing core.js, STOP.
- **Reverse stays under the crush thresholds.** Back-out throttle is −0.4 (reverse target 1.8 m/s; the vehicle crush rule needs speed > 2.0). Do not raise it.
- **`tight()` (hull clearance) tests masonry and rock ONLY** — never water, ice, or steep. Inflating water would close the 6m causeway to hulls.
- **checkConnectivity and the flow field stay on the same blocked-graph.** The flow change is a COST factor on drop cells, never a block — connectivity math is untouched.
- **Foot routing now avoids drop cells by default.** The P6 T1 route fixtures run flat synthetic grids (no drop flags) and must pass unmoved. Expected re-pins: ZERO; any that move are re-pinned honestly and reported old → new, each its own labeled bullet.
- **Escort now routes** (the owner's ruling names it), and the ARRIVE branch must not flip an escorting hull to defend — the replacement armorGoal in Step 4 carries that guard; do not reintroduce the flip.
- **Fixture grids must provide `cellAt`** (the ram sampler and crawl use it) — the mkGrid helper in Step 1 does.
- **The safety brake still outranks everything** — the progress watch never accrues while the brake holds (the early return sits above it), so a hull politely waiting on men is not "stuck". That patience problem is Task 14's, not this task's.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/depot-test.mjs`, insert after the `// ==== end P7 T12 ====` line:

```js
// ==== P7 T13: SELF-PRESERVATION ==============================================
// The owner's rulings (08-17/08-18): the grid learns steepness and drops, the
// hull learns clearance, corners, backing out, and the difference between
// masonry it must respect and masonry it was ordered through; the rim joins
// the slot law. All game-layer; core.js untouched.
{
  const flatF13 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // identity-mapped mini grid (no rotation), cs 2 — the real grid's interface.
  const mkGrid = (n) => {
    const cells = new Array(n * n);
    for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false };
    const G = { cells, w: n, h: n, cs: 2,
      idx: (gx, gz) => gz * n + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < n && gz >= 0 && gz < n,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (n >> 1), gz: Math.floor(z / 2) + (n >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (n >> 1)) * 2 + 1, z: (gz - (n >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    return G;
  };
  const armorAt = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.tracks = "free";
    return v;
  };
  // (a) the terrain masks, pure over a synthetic field
  {
    const G = mkGrid(20);
    stampTerrainMasks(G, { heightAt: (x, z) => (x > 6 ? (x - 6) * 1.2 : 0) });
    ok("T13(a): a 50-degree ramp flags steep", G.cellAt(11, 1).steep === true);
    ok("T13(a2): the flat stays clear", G.cellAt(-8, 1).steep === false && G.cellAt(-8, 1).drop === false);
    const G2 = mkGrid(20);
    stampTerrainMasks(G2, { heightAt: (x) => (x < 0 ? 2 : 0) });
    ok("T13(a3): the cliff's high lip flags drop", G2.cellAt(-1, 1).drop === true);
    ok("T13(a4): the low ground doesn't", G2.cellAt(5, 1).drop === false);
  }
  // (b) hull routing shuns steep; feet don't care about grade
  {
    const G3 = mkGrid(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) G3.cells[G3.idx(10, gz)].steep = true;
    const rH = planRoute(G3, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T13(b): the hull route threads the one gentle gap in a steep wall", !!rH && rH.reached === true &&
      rH.pts.every((p) => { const c = G3.cellAt(p.x, p.z); return !c || !c.steep; }));
    const rF = planRoute(G3, -9, 1, 9, 1);
    ok("T13(b2): feet don't care about grade", !!rF && rF.reached === true);
  }
  // (c) foot routing walks the safe shoulder past a cliff line
  {
    const G4 = mkGrid(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 4) G4.cells[G4.idx(10, gz)].drop = true;
    const rF2 = planRoute(G4, -9, 1, 9, 1);
    ok("T13(c): a squad route walks the one safe shoulder past a cliff line", !!rF2 && rF2.reached === true &&
      rF2.pts.every((p) => { const c = G4.cellAt(p.x, p.z); return !c || !c.drop; }));
  }
  // (d) hull clearance: a one-cell doorway is no lane for a 4.4m box
  {
    const G5 = mkGrid(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) { const c = G5.cells[G5.idx(10, gz)]; c.blocked = true; c.building = 9; c.bTeam = 0; }
    const rH2 = planRoute(G5, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T13(d): a one-cell doorway is no lane for a hull", !rH2 || !rH2.reached);
    const rF3 = planRoute(G5, -9, 1, 9, 1);
    ok("T13(d2): men walk through it", !!rF3 && rF3.reached === true);
  }
  // (e) the ramming ruling, both halves — reuse the T1 fixture's identity fwdDir
  {
    const wldE = makeWorld({ field: flatF13, seed: 7 });
    const G6 = mkGrid(20);
    for (let gz = 0; gz < 20; gz++) { const c = G6.cells[G6.idx(10, gz)]; c.blocked = true; c.building = 77; c.bTeam = 2; }
    const vE = armorAt(wldE, -9, 1);
    vE.order = "move"; vE.dest = { x: 9, z: 1 };
    stepDrivers(wldE, G6, identFwdDir, null);
    ok("T13(e): an order through ENEMY masonry keeps its destination — the ram is the order",
      Math.hypot(vE.dest.x - 9, vE.dest.z - 1) < 0.6, `${vE.dest.x},${vE.dest.z}`);
    const wldF = makeWorld({ field: flatF13, seed: 7 });
    const G7 = mkGrid(20);
    for (let gz = 0; gz < 20; gz++) { const c = G7.cells[G7.idx(10, gz)]; c.blocked = true; c.building = 77; c.bTeam = 1; }
    const vF = armorAt(wldF, -9, 1);
    vF.order = "move"; vF.dest = { x: 9, z: 1 };
    stepDrivers(wldF, G7, identFwdDir, null);
    ok("T13(e2): FRIENDLY masonry clamps the order short — never rammed",
      Math.hypot(vF.dest.x - 9, vF.dest.z - 1) > 0.6, `${vF.dest.x},${vF.dest.z}`);
  }
  // (f) the progress watch: a hull that travels nothing backs out, marks the
  // lane, and after three strikes clamps the leg where it stands
  {
    const wldS = makeWorld({ field: flatF13, seed: 8 });
    const G8 = mkGrid(20);
    const vS = armorAt(wldS, -9, 1);
    vS.order = "move"; vS.dest = { x: 9, z: 1 };
    let sawBack = false;
    for (let i = 0; i < 16 * 120; i++) { wldS.t += wldS.dt; stepDrivers(wldS, G8, identFwdDir, null); if ((vS._backT || 0) > 0) sawBack = true; }
    ok("T13(f): a hull that travels nothing backs out", sawBack === true);
    ok("T13(f2): the failed lane is marked", !!vS._avoid && vS._avoid.length >= 1);
    ok("T13(f3): three strikes clamp the leg honestly — the hull stands down", vS.order === "defend");
  }
  // (g) the rim joins the slot law
  {
    const wldR = makeWorld({ field: flatF13, seed: 9 });
    wldR.inRim = (x, z) => Math.abs(x) <= 10 && Math.abs(z) <= 10;
    ok("T13(g): off the map is never a slot", slotBlockedPublic(wldR, 14, 0, 0.63) === true);
    const pR = clearSlot(wldR, 11, 0, 0.63);
    ok("T13(g2): clearSlot walks back inside the rim", wldR.inRim(pR.x, pR.z) === true, `${pR.x},${pR.z}`);
  }
  // (h) the corner is taken at a crawl (manual channel, throttle 0.35)
  {
    const wldC = makeWorld({ field: flatF13, seed: 10 });
    const G9 = mkGrid(20);
    const vC = armorAt(wldC, -5, 1);
    vC.order = "move"; vC.dest = { x: -1, z: 9 };
    vC._route = [{ x: -1, z: 1 }, { x: -1, z: 9 }];
    vC._routeDest = { x: -1, z: 9 };
    stepDrivers(wldC, G9, identFwdDir, null);
    ok("T13(h): the corner is taken at a crawl", vC.depotDrive === "manual" && !!vC.ctl && Math.abs(vC.ctl.throttle - 0.35) < 1e-9);
  }
  // (i) source shape: the game wires the masks, the flow shuns the lip, the
  // stamps carry their team
  {
    ok("T13(i): makeGrid stamps the terrain masks", /stampTerrainMasks\(G, field\)/.test(dgSrc));
    ok("T13(i2): the enemy flow pays 3x to march a cliff lip", /cells\[ni\]\.drop \? 3 : 1/.test(dgSrc));
    ok("T13(i3): every structure stamp carries its team", (dgSrc.match(/\.bTeam = /g) || []).length >= 8);
  }
  // (j) Amendment 1 — the green threads (source shape; the look is the
  // owner's live acceptance, smoke's zero-page-errors gate covers the boot)
  {
    ok("T13(j): the renderer carries the order-path overlay", /setOrderPaths\(paths\)/.test(rSrc) && /0x4aff8c/.test(rSrc));
    ok("T13(j2): the game feeds it at the derived-overlay cadence", /setOrderPaths\(/.test(dgSrc));
  }
}
// ==== end P7 T13 =============================================================
```

`dgSrc` and `rSrc` are this block's own reads of DepotGame.jsx and renderer.js source — read them at the block top with the suite's established source-read idiom (the mk1.37 hotfix block's audio.js grep is the precedent). Add `stampTerrainMasks` to the route.js import line and confirm `identFwdDir` (the T1 fixture's identity forward-direction helper) is in scope; if the T1 fixture declares it locally, lift the same two-line helper into this block under a local name. Run the suite — T13 (a)–(j2) must FAIL (or throw on the missing export). Report the failing output.

**Step 2 — route.js learns terrain, clearance, and modes.** Replace the whole file with:

```js
// src/depot/route.js — planRoute, moved verbatim out of DepotGame.jsx (P7
// T2): the motor pool routes hulls on the same movement grid squads march,
// and drivers.js must not import a React component module. P6 T1's design
// note rides with it: breadth-first from the start cell, 8-way with the
// flow field's corner rule, honest clamp to the closest reachable cell,
// thinned to turning points. Deterministic, zero rng.
//
// P7 T13: the planner knows WHO is walking. Foot (the default) refuses
// drop cells — the cliff lips a man dies walking off. Hull refuses steep
// cells, any cell pressed against masonry or rock (the clearance ring a
// 4.4m box needs), and any cell on the caller's avoid list. Enemy masonry
// stays blocked here for BOTH modes — the ram-through ruling is armorGoal's
// business (drivers.js), not the planner's.

// P7 T13: the terrain masks — pure, exported, stamped once per grid build
// (and by the test suite over synthetic grids). steep = ground a hull must
// not climb; drop = a face a man must not walk off.
export const CLIMB_MAX_GRAD = 0.45;                 // rise over run, ~24 degrees // provisional (F5)
export const DROP_STEP_M = 1.2, DROP_MAX_M = 1.0;   // one stride out, down a body-height // provisional (F5)
export function stampTerrainMasks(grid, field) {
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
    const c = grid.cells[grid.idx(gx, gz)];
    const wp = grid.gridToWorld(gx, gz);
    const h0 = field.heightAt(wp.x, wp.z);
    let steep = false, drop = false;
    for (const d of D8) {
      const L = Math.hypot(d[0], d[1]);
      if (grid.inBounds(gx + d[0], gz + d[1])) {
        const np = grid.gridToWorld(gx + d[0], gz + d[1]);
        if (Math.abs(field.heightAt(np.x, np.z) - h0) / (grid.cs * L) > CLIMB_MAX_GRAD) steep = true;
      }
      const sx = wp.x + (d[0] / L) * DROP_STEP_M, sz = wp.z + (d[1] / L) * DROP_STEP_M;
      if (h0 - field.heightAt(sx, sz) > DROP_MAX_M) drop = true;
    }
    c.steep = steep; c.drop = drop;
  }
}

export function planRoute(grid, ax, az, dx, dz, opts = null) {
  const s = grid.worldToGrid(ax, az);
  if (!grid.inBounds(s.gx, s.gz)) return null;
  const t = { gx: Math.max(0, Math.min(grid.w - 1, grid.worldToGrid(dx, dz).gx)),
              gz: Math.max(0, Math.min(grid.h - 1, grid.worldToGrid(dx, dz).gz)) };
  const { cells } = grid;
  const hull = !!(opts && opts.hull);
  const avoid = (opts && opts.avoid) || null;
  // hull clearance: a cell pressed against masonry or rock is no lane for a
  // wide box. Masonry and rock ONLY — inflating water would close the
  // causeway; steep cells are already their own refusal.
  const tight = (ci) => {
    const gx = ci % grid.w, gz = (ci / grid.w) | 0;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oz) continue;
      if (!grid.inBounds(gx + ox, gz + oz)) continue;
      const n = cells[grid.idx(gx + ox, gz + oz)];
      if (n.building != null || n.wallId != null || n.terrain) return true;
    }
    return false;
  };
  const shut = (ci) => {
    const c = cells[ci];
    if (avoid && avoid.has(ci)) return true;
    if (hull) return c.blocked || c.steep || tight(ci);
    return c.blocked || c.drop;
  };
  const prev = new Int32Array(grid.w * grid.h).fill(-2);
  const si = grid.idx(s.gx, s.gz);
  prev[si] = -1;
  const q = [si];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0, best = si, bestD = Infinity;
  while (head < q.length) {
    const ci = q[head++];
    const cgx = ci % grid.w, cgz = (ci / grid.w) | 0;
    const dd = Math.hypot(cgx - t.gx, cgz - t.gz);
    if (dd < bestD) { bestD = dd; best = ci; if (dd === 0) break; }
    for (const d of dirs) {
      const nx = cgx + d[0], nz = cgz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (prev[ni] !== -2 || shut(ni)) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (shut(grid.idx(cgx + d[0], cgz)) || shut(grid.idx(cgx, cgz + d[1]))) continue;
      }
      prev[ni] = ci;
      q.push(ni);
    }
  }
  if (best === si) return null; // nowhere to go (or already there)
  const cellsPath = [];
  for (let ci = best; ci !== -1; ci = prev[ci]) cellsPath.push(ci);
  cellsPath.reverse();
  const pts = [];
  for (let i = 1; i < cellsPath.length; i++) {
    const p0 = cellsPath[i - 1], p1 = cellsPath[i], p2 = cellsPath[i + 1];
    const turn = p2 == null ||
      (p1 % grid.w) - (p0 % grid.w) !== (p2 % grid.w) - (p1 % grid.w) ||
      ((p1 / grid.w) | 0) - ((p0 / grid.w) | 0) !== ((p2 / grid.w) | 0) - ((p1 / grid.w) | 0);
    if (turn) pts.push(grid.gridToWorld(p1 % grid.w, (p1 / grid.w) | 0));
  }
  return { pts, reached: bestD === 0 };
}
```

**Step 3 — the grid carries the masks and the team stamps.** In `src/depot/DepotGame.jsx`:

3a. The route.js import (line ~28) gains the mask stamper: `import { planRoute, stampTerrainMasks } from "./route.js";`

3b. `makeGrid` (line 442): the cell literal gains three fields — `{ blocked: false, terrain: false, ice: false, dx: 0, dz: 0, dist: 1e9, wallId: null, building: null, bTeam: 0, steep: false, drop: false }` — and the terrain loop (455–461) is followed, before `return G;`, by:

```js
  // P7 T13: the terrain masks — steep ground a hull must not climb, cliff
  // lips a man must not walk off. Stamped once; craters do not restamp
  // (their ~0.5m sits under both thresholds). AMENDMENT 2: makeMap's
  // generation-time grid (makeGrid(null), ~line 309) carries no terrain
  // field and needs no masks — it only tests footprints; the guard keeps
  // its cells' steep/drop at their false defaults.
  if (field) stampTerrainMasks(G, field);
```

*(Amendment 2, 2026-08-18: the guard above — the plan's reading list missed makeGrid's second caller, `makeMap`'s field-less generation grid at ~line 309; the unconditional stamp crashed boot. The T13(i) source-shape assert changes to match: `/if \(field\) stampTerrainMasks\(G, field\)/`.)*

3c. `recomputeFlow` (line 569): the cost line becomes — the enemy marchers shun the lips without ever disconnecting the graph:

```js
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1) * (cells[ni].drop ? 3 : 1);
```

3d. Every structure stamp carries its team; every clear resets it. Eight sites, each a one-line touch:

- 884 (boot buildTown): `for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); }`
- 906 (building collapse unblock): `for (const ci of b.cells) { const c = grid.cells[ci]; c.blocked = false; c.building = null; c.bTeam = 0; }`
- 1480 (resume buildTown): same stamp as 884, same line shape.
- 1502 (resume wall): `c.blocked = true; c.wallId = b.id; c.bTeam = b.team || 1;`
- 2046 (placement path wall): after `cell.wallId = b.id;` add `cell.bTeam = b.team || 1;`
- 2599 (engineer-laid wall): after `cell.wallId = b.id;` add `cell.bTeam = 1;`
- 2783 (wall sell/clear): `cell.wallId = null; cell.blocked = false; cell.bTeam = 0;`
- 2807 (wall-death sweep): `for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; c.bTeam = 0; }`

**Step 4 — the hull learns to route as a hull, back out, crawl the corners, and honor the ramming ruling.** In `src/depot/drivers.js`, replace `armorGoal` (lines 91–146) whole with:

```js
function armorGoal(world, grid, v, dt, fwdDir, opts) {
  if (v.tracks !== "free" && armorSafetyBlocked(world, v)) {
    v.depotDrive = "manual";
    v.ctl = { throttle: 0, steer: 0, brake: true };   // the tracks bite — the strong stop
    return;
  }
  v.depotDrive = "auto";
  // P7 T13: THE BACK-OUT — a hull that measured itself not-moving reverses
  // gently (under the crush speed), then replans; the failed lane is already
  // on its avoid list. Rides the manual channel — core.js untouched.
  if ((v._backT || 0) > 0) {
    v._backT -= dt;
    v.depotDrive = "manual";
    v.ctl = { throttle: -0.4, steer: 0, brake: false };   // provisional (F5)
    if (v._backT <= 0) { v._route = null; v._routeDest = null; v._pp = null; v._ppT = 0; }
    return;
  }
  const order = v.order || "defend";
  if (order === "defend") { v.goal = null; return; }
  if (order === "escort") {
    const sq = opts && opts.squads ? opts.squads.find((q) => q.id === v.escortId) : null;
    if (!sq) { v.order = "defend"; v.goal = null; return; }
    const dx = sq.anchor.x - v.pos.x, dz = sq.anchor.z - v.pos.z, d = Math.hypot(dx, dz) || 1;
    if (d <= ARMOR_ESCORT_BACK + 2.2) { v.dest = null; v._route = null; v._routeDest = null; v.goal = null; return; }
    // P7 T13: the escort leg ROUTES now (ordered driving goes around
    // masonry) — the trail point is a moving dest on the same machinery.
    v.dest = { x: sq.anchor.x - (dx / d) * ARMOR_ESCORT_BACK, z: sq.anchor.z - (dz / d) * ARMOR_ESCORT_BACK };
  }
  if (!v.dest) { v.order = "defend"; v.goal = null; return; }
  // MOVE/PATROL/ESCORT: route legs — stepSquadRouting's shape, on the body.
  const destChanged = !v._routeDest || Math.hypot(v._routeDest.x - v.dest.x, v._routeDest.z - v.dest.z) > 0.5;
  const wp0 = v._route && v._route.length ? v._route[0] : v.dest;
  const dWp = Math.hypot(wp0.x - v.pos.x, wp0.z - v.pos.z);
  let stale = false;
  if (!destChanged) {
    if (v._routeD == null || dWp < v._routeD - 0.5) { v._routeD = dWp; v._routeT = 0; }
    else v._routeT = (v._routeT || 0) + dt;
    stale = v._routeT >= 3;
  }
  if (destChanged || stale || !v._route) {
    v._routeD = null; v._routeT = 0;
    // P7 T13: hulls route as HULLS — steep ground and pressed-to-masonry
    // lanes are no lanes, and lately-failed cells are shunned while marked.
    if (v._avoid) v._avoid = v._avoid.filter((a) => a.until > world.t);
    const r = planRoute(grid, v.pos.x, v.pos.z, v.dest.x, v.dest.z,
      { hull: true, team: v.team, avoid: v._avoid && v._avoid.length ? new Set(v._avoid.map((a) => a.ci)) : null });
    if (r && !r.reached && r.pts.length) {
      const end = r.pts[r.pts.length - 1];
      // owner's ruling (2026-08-18): friendly and neutral masonry always
      // detours; a path only ENEMY masonry closes is followed verbatim —
      // the route runs to the wall and the hull drives the last stretch
      // straight, ramming through. Anything else clamps honestly.
      const foe = v.team === 1 ? 2 : 1;
      const rdx = v.dest.x - end.x, rdz = v.dest.z - end.z, rd = Math.hypot(rdx, rdz);
      let ram = rd > 0.5 && rd < 40;   // a bounded last stretch // provisional (F5)
      for (let s = 1; ram && s < rd; s++) {
        const cell = grid.cellAt(end.x + (rdx / rd) * s, end.z + (rdz / rd) * s);
        if (!cell) { ram = false; break; }
        const struct = cell.building != null || cell.wallId != null;
        if (cell.steep || cell.terrain || cell.water || (struct && cell.bTeam !== foe) || (cell.blocked && !struct)) ram = false;
      }
      if (!ram) {
        if (v.order === "patrol") {   // the honest clamp fixes the loop's endpoint too
          if (v._patA && Math.hypot(v.dest.x - v._patA.x, v.dest.z - v._patA.z) < 0.5) v._patA = { x: end.x, z: end.z };
          else if (v._patB && Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5) v._patB = { x: end.x, z: end.z };
        }
        v.dest = { x: end.x, z: end.z };
      }
    }
    v._route = r && r.pts.length ? r.pts : null;
    v._routeDest = { x: v.dest.x, z: v.dest.z };
  }
  while (v._route && v._route.length && Math.hypot(v._route[0].x - v.pos.x, v._route[0].z - v.pos.z) < ARMOR_WP_R) v._route.shift();
  const wp = v._route && v._route.length ? v._route[0] : v.dest;
  if (Math.hypot(v.dest.x - v.pos.x, v.dest.z - v.pos.z) <= ARMOR_ARRIVE) {
    if (v.order === "patrol" && v._patA && v._patB) {
      const goingToB = Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5;
      v.dest = goingToB ? { x: v._patA.x, z: v._patA.z } : { x: v._patB.x, z: v._patB.z };
      v._route = null; v._routeDest = null; v._stuckN = 0;
    } else if (v.order === "escort") { v.goal = null; return; }
    else { v.order = "defend"; v.dest = null; v.goal = null; return; }
  }
  v.goal = { x: wp.x, z: wp.z };
  // P7 T13: SLOW THROUGH THE TURN — full speed on the straights, a crawl at
  // the corner, so the hull's turning arc stays inside the route's clearance
  // corridor instead of sweeping through whatever stands past it.
  const wp1 = v._route && v._route.length > 1 ? v._route[1] : null;
  const wpd = Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z);
  if (wp1 && wpd < 5) {                              // provisional (F5)
    const a1 = Math.atan2(wp.x - v.pos.x, wp.z - v.pos.z);
    const a2 = Math.atan2(wp1.x - wp.x, wp1.z - wp.z);
    let bend = a2 - a1;
    while (bend > Math.PI) bend -= 2 * Math.PI;
    while (bend < -Math.PI) bend += 2 * Math.PI;
    if (Math.abs(bend) > 0.5) {                      // provisional (F5)
      let err = a1 - Math.atan2(v.R[6], v.R[8]);
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      v.depotDrive = "manual";
      v.ctl = { throttle: 0.35, steer: Math.max(-1, Math.min(1, err * 1.8)), brake: false };   // provisional (F5)
    }
  }
  // P7 T13: THE PROGRESS WATCH — waypoint distance can lie (a tipped hull
  // near a waypoint it cannot reach); travelled ground cannot. Under 0.4m in
  // 4s with a live goal = stuck: mark the lane, back out, replan. Three
  // strikes on one leg clamp the leg where the hull stands — honest.
  if (!v._pp || Math.hypot(v.pos.x - v._pp.x, v.pos.z - v._pp.z) > 0.4) { v._pp = { x: v.pos.x, z: v.pos.z }; v._ppT = 0; }
  else v._ppT = (v._ppT || 0) + dt;
  if (v._ppT >= 4) {                                 // provisional (F5)
    const g = grid.worldToGrid(v.goal.x, v.goal.z);
    if (grid.inBounds(g.gx, g.gz)) {
      v._avoid = (v._avoid || []).filter((a) => a.until > world.t);
      v._avoid.push({ ci: grid.idx(g.gx, g.gz), until: world.t + 25 });   // provisional (F5)
    }
    v._stuckN = (v._stuckN || 0) + 1;
    v._backT = 1.2; v._ppT = 0;                      // provisional (F5)
    if (v._stuckN >= 3) { v._stuckN = 0; v.dest = { x: v.pos.x, z: v.pos.z }; v._route = null; v._routeDest = null; }
  }
}
```

**Step 5 — the rim joins the slot law.** In `src/depot/squads.js`, `slotBlocked` (line 181) gains its first line, above the water test:

```js
  if (world.inRim && !world.inRim(x, z)) return true; // P7 T13: off the map is never a slot (bare fixtures carry no inRim and skip)
```

**Step 6 — the tactic scratch never rides a save.** In `src/depot/save.js`, `BODY_HANDLED` (line 54) gains five entries alongside the T12/T5 precedents: `"_pp", "_ppT", "_backT", "_avoid", "_stuckN"` — transient driving state; a resumed hull re-measures fresh.

**Step 7 (Amendment 1) — the green threads.** Two touches, one renderer method and one collector.

7a. In `src/render/renderer.js`: beside `lineGroup`'s declaration add `let pathGroup = null;`, and insert after `setLinePreview`'s closing `},` (line ~1449), inside the same overlay object:

```js
    // P7 T13 (owner): THE GREEN THREADS — the computed route of every
    // friendly ordered unit, sampled to the ground so the line lies on the
    // terrain. Rebuilt at the caller's cadence (4Hz), never per frame.
    setOrderPaths(paths) {
      if (pathGroup) {
        scene.remove(pathGroup);
        pathGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        pathGroup = null;
      }
      if (!paths || !paths.length) return;
      pathGroup = new THREE.Group();
      for (const p of paths) {
        const v = [];
        for (let i = 0; i + 1 < p.pts.length; i++) {
          const a = p.pts[i], b = p.pts[i + 1];
          const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2));
          for (let k = 0; k <= n; k++) {
            const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
            v.push(new THREE.Vector3(x, F.heightAt(x, z) + 0.22, z));
          }
        }
        if (v.length < 2) continue;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v),
          new THREE.LineDashedMaterial({ color: 0x4aff8c, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.55, depthWrite: false }));
        line.computeLineDistances();
        pathGroup.add(line);
      }
      pathGroup.traverse((o) => o.layers && o.layers.set(1));
      scene.add(pathGroup);
    },
```

7b. In `src/depot/DepotGame.jsx`, inside the same 4Hz derived-overlay branch that calls `stepMines` (≈line 3913), immediately after that call:

```js
        // P7 T13 (owner): THE GREEN THREADS — every friendly ordered path,
        // green on the ground, refreshed with the other derived overlays.
        {
          const paths = [];
          for (const sq of S.squads) {
            if (!sq.dest || sq.ridingIn != null) continue;
            if (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol") continue;
            paths.push({ pts: [{ x: sq.anchor.x, z: sq.anchor.z }, ...(sq._route || []), { x: sq.dest.x, z: sq.dest.z }] });
          }
          for (const b of world.bodies) {
            if (b.kind !== "vehicle" || !b.alive || b.team !== 1 || !b.dest) continue;
            if (b.order !== "move" && b.order !== "patrol" && b.order !== "escort") continue;
            paths.push({ pts: [{ x: b.pos.x, z: b.pos.z }, ...(b._route || []), { x: b.dest.x, z: b.dest.z }] });
          }
          R.overlay.setOrderPaths(paths);
        }
```

Enemy paths never draw (team-1 filter — their routes are theirs to hide). Riding squads skip. The look — color, dash, weight — is the owner's live acceptance; dials provisional (F5).

**Step 8 — gates.** Run exactly: `node scripts/depot-test.mjs` (all green, T13 block included), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Golden does NOT run — core.js untouched. Expected re-pins: zero; any that move are re-pinned honestly and reported old → new, each its own labeled bullet.

**Step 9 — the landing.** Bump `src/version.js` to `mk1.43`. Build AFTER the bump. Commit, message: `self-preservation: the hull learns the ground, the map learns its edge (mk1.43)`. Push. Report with the read-confirmation opening, gate results, and the deviation list.
