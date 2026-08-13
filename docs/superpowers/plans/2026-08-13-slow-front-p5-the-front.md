# THE FRONT — phase plan (P5)

*2026-08-13. Governs the mk1.0x series. THIS PHASE IS MAP WORK ONLY (owner's ruling, second sitting): a **120×120 square map**, wilder procedural generation (roads optional, drawn per seed), a **stream with a bridge** (light version — obstacle water, no drowning), depot geometry work (evened depots, randomized-but-spaced), proving-grounds building forms, copses and forests.*

*Everything troop-shaped moves to the NEXT phase, TROOPS & PHYSICS (P6): the unit-model question (most troops as singles, the sniper pair kept), the selection UI, combat re-tuning, the typed body-list perf work, AND the bell-repriced simple AMM (its design is ratified — repriced each bell off live standing stock, units and masonry, enemy pays the same table — it just does not land in the map phase). The body-list implementation ran to green gates and was REVERTED at the owner's word (tail metric unmeasurable on the probe); its full spec and findings are archived at the bottom of this document for resurrection.*

*Marks: Task 1 = mk1.00, then +0.01 per task. Every deploy bumps `src/version.js` and builds AFTER the bump. Task 1's commit carries the roadmap flip (Possession → DONE, The Front → IN PROGRESS).*

---

## The task list

**Task 1 — The square frame** — POPULATED BELOW (mk1.00).

**Task 2 — The wilder map** *(skeleton)*
- Rewrite generation for the square: random road count, freer band/bench layout, more variance per seed.
- Depot geometry lands here: evened depots, randomized-but-spaced placement.
- Acceptance predicate grows with the randomness (connectivity both ways, depot spacing, retry loop).

**Task 3 — The stream and the bridge** *(skeleton)*
- Carved channel, unwalkable water cells, drawn water. No drowning — obstacle only.
- One bridge: walkable deck cells over the channel.
- Connectivity counts the bridge; flow field re-reads if it drops.

**Task 4 — Buildings of the proving grounds** *(skeleton)*
- Per-template shape hooks in the town builder (beyond the uniform lattice).
- Port the proven forms: slab-roof hangar, warehouse columns, drive-through, freestanding field walls.
- Chunk budget measured under worst-case collapse on the Pi.

**Task 5 — Copses and forests** *(skeleton)*
- Copse/forest placement in generation.
- Raise the tree pools; burn behavior already carries.

**Task 6 — The measurement close** *(skeleton)*
- Full-density Pi baseline on the new map: frame split, collapse worst case, sight recompute.
- Re-pin perf numbers; owner playtest closes the phase.

---

# TASK 1 — The square frame (mk1.00)

**What it does.** The playable field becomes a 120×120 square. The rim half-extents become the ONE source every consumer reads — the two stray 29/57 literals (terrain falloff, territory construction) die. The ground-texture grid, which has been painted at the frozen demo's 188.7m scale since the depot was born, becomes field-derived under the depot's rim option, so grid lines finally sit at the true 0.83m masonry pitch and line up with world positions. Map generation is stretched — same structure, wider ranges — so the square fills; the real generation rewrite is Task 2. Camera pan extents go square. The commit carries the roadmap flip.

**Feel changes that ship for the owner's eyes (no screenshot loops):** the field is a square twice the old ground; the three bands and village benches run much wider; the depot ground-grid is finer than before and true to the masonry pitch; benches feel sparser (building count per bench deliberately unchanged until Task 4).

**Suggested model:** Sonnet — fully specced edits, no design freedom.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/DepotGame.jsx` — 30–52 (frame constants), 53–190 (genMap/makeMap), 192–274 (buildDepotTerrain), 1014–1030 (territory construction), 1078–1099 (trees), 1180 (EXT), 1156–1179 (renderer opts).
- `src/render/renderer.js` — 26–35 (makeSplat head + grid constants), 352–357 (splat call site), 174–210 (retintTerritory), 963–968 (updateTerritory).
- `src/depot/territory.js`, `src/depot/sight.js`, `src/depot/orient.js` — whole (verify parameterization only; no edits).
- `src/depot/save.js` — 262–271 (mark refusal; no edits).
- `scripts/depot-test.mjs` — 1–70 (harness), 3020–3028 (the mk0.50/6 rim source-pin), 2407–2535 (the F1 extraction machinery the new block copies), 5340–5351 (tail).
- `src/ui/Roadmap.jsx` 14–28, `src/version.js`.

**Trap notes:**
- `makeField(121, 2.0)` spans 240m and covers the 120 square at every rotation (corner radius ≈ 84.9 < 120) — the field does NOT change. Do not touch it.
- The renderer's splat-span change is DEPOT-GATED (derives from the field only when `opts.rim` is supplied). Tower defense, campaign, and sandbox pass no rim and must render byte-identically — keep the 188.7 fallback literal.
- `save.js` needs no migration: the mark bump to mk1.00 refuses and burns every old save by itself.
- Old-map comments naming 29×57 (DepotGame.jsx lines 41–44 and 1015–1016; renderer.js 1159–1160) get their numbers corrected in place — comments must not lie.
- genMap's rng is its own map-seed stream, not `world.rng` — the wider loops change its draw counts freely; the draw-count law does not bind map generation.
- Expected test re-pin: exactly ONE — the mk0.50/6 rim source-pin (29/57 → 60/60). Any other old assert moving is a defect to report, not re-pin. The F1 20-seed placement/connectivity sweep runs the LIVE genMap and must pass on the square as-is; a sweep failure is a STOP-and-report.
- `VISION T1(i)`'s sight-budget fixture is self-contained at the old extents — leave it untouched; the new-size budget is Task 6's measurement.

## Steps, in execution order

**Step 1 — failing asserts first.** Two test edits, then `npm run test:depot` must show exactly these reds: the re-pinned mk0.50/6 line, and the new FRONT-T1 block.

(1a) Re-pin the rim source-pin (scripts/depot-test.mjs, line 3027 — report old→new in the task report):
```js
    ok("mk0.50/6: the rim half-extents exist once (inRim and the clamp share them)",
      /const RIM_HALF_U = 60, RIM_HALF_V = 60;/.test(src) && !/halfU: 29, halfV: 57/.test(src));
```

(1b) Insert before the final failure summary (`if (fails.length) {`, line 5347):
```js
// ==== FRONT T1: the square frame ============================================
// mk1.00 (The Front, Task 1). The field is a 120x120 SQUARE: rim 60/60 as the
// one source, stray falloff/territory literals dead, the splat grid pitch
// field-derived under the depot's rim option, generation stretched to fill.
{
  console.log("\n[front t1: the square frame]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("FRONT T1: the rim is 60x60 (the square)", /const RIM_HALF_U = 60, RIM_HALF_V = 60;/.test(src));
  ok("FRONT T1: the flow grid is 59x59 (rim minus the 1m inset, as before)",
    /const GRID_CS = 2\.0, GRID_W = 59, GRID_H = 59;/.test(src));
  ok("FRONT T1: the terrain falloff reads the rim constants, not literals",
    /Math\.abs\(cuv\.u\) - RIM_HALF_U, Math\.abs\(cuv\.v\) - RIM_HALF_V/.test(src));
  ok("FRONT T1: territory is built from the rim constants",
    /makeTerritory\(RIM_HALF_U, RIM_HALF_V\)/.test(src));
  ok("FRONT T1: camera pan extents are square", /const EXT = \{ x: 65, z: 65 \};/.test(src));
  const rsrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  ok("FRONT T1: the splat grid span derives from the field under the rim option (188.7 fallback kept)",
    /opts\.rim \? Wd : null/.test(rsrc) && /span \|\| 188\.7/.test(rsrc));

  // functional: the LIVE genMap fills the square. Same extraction machinery
  // as the FRONT F1 block above (sliceFn over the real source), fresh copy
  // here because that block's helpers are scoped to it.
  const sliceFn2 = (name) => {
    const start = src.indexOf(`\nfunction ${name}(`);
    if (start < 0) throw new Error("T1 extract: missing function " + name);
    const rest = src.slice(start + 1);
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerT1 = src.slice(src.indexOf("const GRID_CS"), src.indexOf("function genMap"));
  const mapSrcT1 = [
    headerT1,
    sliceFn2("genMap"), sliceFn2("makeMap"), sliceFn2("pondAt"), sliceFn2("rockAt"),
    sliceFn2("makeGrid"), sliceFn2("checkConnectivity"), sliceFn2("townFootprint"), sliceFn2("buildTown"),
    `return { makeMap, makeGrid, checkConnectivity, invW,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, ROCKS, TOWN, MAP_SEED }) };`,
  ].join("\n");
  const mkMapT1 = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrcT1,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  let wide = 0, connected = 0, spawnSpread = 0;
  for (let s = 1; s <= 10; s++) {
    const Mi = mkMapT1();
    Mi.makeMap(s * 977);
    const st = Mi.state();
    // width proof: something generated lives beyond the OLD field's |u| 29
    const uOf = (p) => Math.abs(invWFor(st.ORIENT, p.x, p.z).u);
    if (st.ROCKS.some((k) => uOf(k) > 30) || st.TOWN.some((t) => uOf(t) > 30)) wide++;
    // the three spawns spread wider than the old +-21 band
    const us = st.SPAWN_POINTS.map((sp) => invWFor(st.ORIENT, sp.x, sp.z).u);
    if (Math.max(...us) - Math.min(...us) > 60) spawnSpread++;
    // both depots reachable on the accepted map (makeMap's own gate re-run)
    const g = Mi.makeGrid(null);
    for (const t of st.TOWN) {
      const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
      for (let gz = 0; gz < g.h; gz++) for (let gx = 0; gx < g.w; gx++) {
        const wp = g.gridToWorld(gx, gz);
        if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
          if (Math.hypot(wp.x - st.OBJ_POS.x, wp.z - st.OBJ_POS.z) < 5) continue;
          g.cells[g.idx(gx, gz)].blocked = true;
        }
      }
    }
    const og = g.worldToGrid(st.OBJ_POS.x, st.OBJ_POS.z);
    const dw = fwdUFor(st.ORIENT, 0, -51);
    const dg = g.worldToGrid(dw.x, dw.z);
    if (Mi.checkConnectivity(g, st.SPAWN_POINTS, og.gx, og.gz) &&
        Mi.checkConnectivity(g, st.SPAWN_POINTS, dg.gx, dg.gz)) connected++;
  }
  ok("FRONT T1: the square fills — generated features beyond the old rim on every seed", wide === 10, `${wide}/10`);
  ok("FRONT T1: the spawn line spreads across the square (span > 60m)", spawnSpread === 10, `${spawnSpread}/10`);
  ok("FRONT T1: spawns reach the objective AND the enemy depot's door on every seed", connected === 10, `${connected}/10`);
}
// ==== end FRONT T1 ===========================================================
```

**Step 2 — the frame constants.** `src/depot/DepotGame.jsx` lines 30–45. The grid keeps its 1m inset inside the rim (59 cells × 2m = 118, rim 120), exactly today's convention:
```js
// ============================================================== the map
// THE FRONT (mk1.00): a 120x120 SQUARE — one canonical frame, four rotations.
const GRID_CS = 2.0, GRID_W = 59, GRID_H = 59;
```
and
```js
// THE PLAYABLE RIM, once. buildDepotTerrain's falloff box is 60x60 in
// canonical (u, v) — beyond it there is no ground to stand on, only the
// painted horizon. world.inRim, the renderer's rim descriptor and the order
// clamp below all read THESE two numbers so they cannot drift apart.
const RIM_HALF_U = 60, RIM_HALF_V = 60;
```

**Step 3 — kill the stray literals.** Two sites:

(3a) `buildDepotTerrain`, line 205:
```js
    const over = Math.max(0, Math.abs(cuv.u) - RIM_HALF_U, Math.abs(cuv.v) - RIM_HALF_V);
```

(3b) Territory construction, line 1017 (and correct the comment above it to say the extents are the rim constants):
```js
      const T = makeTerritory(RIM_HALF_U, RIM_HALF_V);
```

**Step 4 — stretch generation to fill the square.** `genMap` (DepotGame.jsx 53–158), each literal exactly as follows; everything not named stays byte-identical (bands' v-positions keep — the field's LENGTH barely moved, 114 → 120; the WIDTH is what doubled):
- Passes (line 56): `const passes = bands.map((z) => [{ x: -46 + r() * 28, z }, { x: 10 + r() * 36, z }]);`
- Rock rows (line 60): `for (let x = -55; x <= 55; x += 5.5 + r() * 3) {`
- Spawns (line 67): `const spawns = [-42 + r() * 8, -4 + r() * 8, 34 + r() * 8].map((x) => ({ x, z: GRID_OZ + 2 }));`
- Ponds (line 87): `const x = -50 + r() * 100, z = -12 + r() * 48, rad = 5.5 + r() * 2.5;`
- Bench buildings (line 130): `const x = -52 + r() * 104;`
- Old ruins (line 144): `const x = -50 + r() * 100, z = -46 + r() * 20;`
- Treeline (line 1084): `for (let tu = -56; tu <= 56; tu += 3.2) {`
- Tree clumps (line 1091): `const w = fwdU(-50 + r() * 100, -46 + r() * 24);`

Deliberately unchanged, stated: depot entries (0, 52)/(0, −46), objective (0, 49), bands, per-bench building count (benches read sparser until Task 4), pond count, seeded depot bags. Tree total stays under the 144-instance pool (~35 treeline + ≤28 clump candidates before rejections).

**Step 5 — square camera extents.** Line 1180 — the square makes the orientation branch meaningless (rim 60 + the same 5m margin today's 57+5/29+5 used):
```js
      const EXT = { x: 65, z: 65 }; // square rim 60 + 5m margin; same at every rotation
```

**Step 6 — the ground-texture grid becomes field-true (DEPOT-gated).** `src/render/renderer.js`:

(6a) `makeSplat` takes the span (line 26), deriving its grid mapping from it, demo-literal fallback for every rim-less caller:
```js
function makeSplat(town, span) {
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 1024; // DIVERGENCE from the demo (512): block-scale grid needs the resolution
  const cx = cv.getContext("2d");
  // grid geometry constants. THE FRONT (mk1.00): derived from the caller's
  // field span when supplied (DEPOT passes its real 240m field, so the block
  // grid finally sits at the true 0.83m pitch and lines align with world
  // positions); the 188.7 literal is the frozen demo's field and stays the
  // fallback so TD/campaign/sandbox render byte-identically.
  const SPAN = span || 188.7;
  const W2Ug = 1024 / SPAN, U0g = SPAN / 2, BLK = 0.83;
```
and the paintBase grid loop bound (line 53) follows the span:
```js
      for (let k = Math.ceil(-U0g / BLK); k * BLK <= U0g; k++) {
```

(6b) The call site (line 356) passes the span only when a rim exists:
```js
  const splat = makeSplat(opts.town !== false, opts.rim ? Wd : null); // default keeps the demo/sandbox ground art
```

`retintTerritory` and every scorch/smear consumer read the same closure constants and follow automatically.

**Step 7 — comments stop lying.** Correct the stale 29×57 numbers in the three comment sites: DepotGame.jsx 41–44 (rim comment now says 60×60 — covered by Step 2's block), DepotGame.jsx 1015–1016 (`halfU 60 / halfV 60`), renderer.js 1159–1160 (rim comment names 60×60). Wording otherwise untouched.

**Step 8 — green, flip, bump.** `npm run lint:depot` · `npm run test:depot` — everything green including FRONT T1; the ONLY re-pin is mk0.50/6 (report old→new). Then:

`src/ui/Roadmap.jsx` lines 20–21 (the fold-in flip):
```js
  { name: "Possession", status: "DONE", desc: "Take direct control of any squad or tower and drive it yourself." },
  { name: "The Front", status: "IN PROGRESS", desc: "A square map twice the ground, wilder every seed, and a stream to cross." },
```

`src/version.js` line 6:
```js
export const MK = "mk1.00";
```

**Step 9 — build and smoke.** `npm run build` (AFTER the bump) · `SMOKE_ONLY=depot npm run smoke`. A smoke failure on the pinned seed is a STOP-and-report (the square moves the camera's opening ground — the smoke's own buildable-cell polling should absorb it, but that is verified, not assumed).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; the one named re-pin) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `DepotGame.jsx`, `renderer.js`, `depot-test.mjs`, `Roadmap.jsx`, `version.js`. Commit `"the square frame: 120x120, one rim, a true-pitch grid (mk1.00)"`, push, CI green, STOP. The owner checks the deployed site live: the square field, the wider spawn line, the finer ground grid, sparser benches (accepted until Task 4).

---

## DEFERRED TO THE NEXT PHASE — TROOPS & PHYSICS, P6 (owner, 2026-08-13)

- **Unit model:** most troops as single units (`SQUAD_SPECS` n:1 data experiment first — one-man squads are already supported machinery), sniper/spotter pair kept at 2. Combat re-tuning follows, `provisional (F5)` convention.
- **Selection UI:** select-all-of-type through the pie (phone-first), drag-box on desktop later; group orders with destination spreading.
- **The bell market (simple AMM):** design ratified — reprice at each bell off live standing stock, units and masonry both, enemy pays the same table, no rng; bell-cadence pricing supersedes real-time per-purchase movement (decision-record amendment rides its task when it lands).
- **Body lists (typed pools):** spec below, implemented once to green gates, reverted at mk0.99. Findings: mean sim cost −15–17% at 60fps (reproducible); p95/worst not measurable on `diag-perf.mjs` under load (run-to-run spread wider than the effect — worst 452/494/559 across three runs). A future attempt needs a quieter measurement protocol first.

---

# ARCHIVED SPEC — Body lists (implemented and reverted 2026-08-13; resurrect at TROOPS & PHYSICS, P6)

**What it does.** Today every hot combat and movement scan walks the whole `world.bodies` array — the arc tracer walks it once per flight sample, the slot vetter several times per man per tick. This task filters the body array ONCE per sim tick into seven typed pools, and points every hot scan at its pool. Behavior is identical by construction: pools narrow the candidate set by properties that never change while a body lives (kind, team, town tag, mass class); every scan keeps its full original predicate; pools preserve `world.bodies` order, so every scan visits candidates in the order it always did. Zero rng. Engine untouched.

**The one stated behavior delta.** A body ADDED mid-tick (a sandbag laid by the build line, rubble dropped by the support rule) joins the pools on the NEXT tick — one sim tick (8ms) late as an obstacle or target. Deterministic, identical on every run, twin-safe. Accepted here; the report restates it.

**Suggested model:** Sonnet — fully specced mechanical edits, no design freedom.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/accuracy.js` — whole file (the hottest consumers: `solidBlocksPoint`, `losGraze`, `bracedAt`).
- `src/depot/squads.js` — header laws (1–66), `exposureAt`/`slotBlocked`/`clearSlot` (77–188), `squadThreatened` (414–435), `stepSapperCharges` (454–497).
- `src/depot/state.js` — `fieldReaches` note (13–32), `hostileStructure`/`squadFire` (489–599), `snapTargetNear`/`mateBlocks` (600–641), `friendlyBlocksPoint`/`friendlyFouls` (817–867).
- `src/depot/units.js` — whole file (every enemy scan).
- `src/depot/DepotGame.jsx` — imports (1–28), `stepTowers` (364–430), `stepDepot` (600–725), the frame loop's sim bracket (2876–2913).
- `scripts/depot-test.mjs` — harness (1–70), tail (5340–5351).
- `scripts/depot-lint.mjs` (the seeded-rng law), `scripts/diag-perf.mjs` (run-only, read before running).
- `src/ui/Roadmap.jsx` 14–28, `src/version.js`.

**Trap notes:**
- Pools NARROW, they never decide. Every consumer keeps its full predicate line (alive, team, kind, range, sight, arc). A body that dies mid-tick sits stale in a pool and is skipped by the consumer's own `alive` check — exactly as the full scan skipped it.
- Every consumer needs the fallback `world._L ? pool : world.bodies` — dozens of headless fixtures build worlds that never run `stepDepot`, and they must keep full-scan behavior byte-identical.
- Iteration order is the determinism contract: `rebuildBodyLists` is ONE forward pass over `world.bodies`, never sorted, never bucketed by id.
- OUT OF SCOPE (cold paths, do not convert): `payBounties`, `buildEmitters`, `fillMaps` (sight), `stepWallSupport`, `wallOrientAt`/`sandbagOrientAt`, HUD/census/debug-harness scans, `explode`'s occluder scan (engine — frozen law).
- No rng anywhere in the new module; `npm run lint:depot` gates it.
- `kind` mutates once in the engine (vehicle → wreck at death) — harmless: the body is also `alive === false`, and every pool consumer checks alive/kind anyway.

## Steps, in execution order

**Step 0 — the before-measurement.** On the Pi, capture the baseline: run the game with `?perf=1&seed=4242`, let a heavy mid-game state develop (or drive it with the existing staging hooks), and read `scripts/diag-perf.mjs` (read the script first; run it as-is). Record median and p95 `sim` ms. This number is the task's before; nothing lands without its after.

**Step 1 — failing asserts first.** In `scripts/depot-test.mjs`, insert the block below immediately BEFORE the final failure summary (`if (fails.length) {`, line 5347). Run `npm run test:depot` and confirm the new block FAILS (module missing) while every old assert stays green.

```js
// ==== THE FRONT T1: body lists ==============================================
// mk1.00 (Phase 5 Task 1). One pass per sim tick filters world.bodies into
// typed pools (src/depot/lists.js); every hot scan iterates its pool with its
// full original predicate kept, falling back to world.bodies when no lists
// are installed. The keystone is (c): a twin firefight with and without the
// lists installed lands on the identical worldHash and draw count.
{
  console.log("\n[the front t1: body lists]");
  let listsMod = null;
  try { listsMod = await import("../src/depot/lists.js"); } catch (e) {}
  ok("T1: src/depot/lists.js exists and exports makeBodyLists/rebuildBodyLists",
    !!listsMod && typeof listsMod.makeBodyLists === "function" && typeof listsMod.rebuildBodyLists === "function");
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });

  // one of everything the pool predicates distinguish
  const buildZoo = () => {
    const world = makeWorld({ field: flatF, seed: 3 });
    spawnWallCourses(world, 0, 0, 0);                       // player wall, 3 static courses
    spawnSandbag(world, 4, 0);                              // team-1 static chunk (sandbag)
    const tw = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 8, y: 1, z: 0, hp: 80 });
    tw.towerType = "gun";
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 2, hy: 2, hz: 2, x: -8, y: 1.6, z: 0, hp: 400 });
    addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: -4, y: 1.62, z: 4, hp: 70 });
    const cd = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 0.4, z: 10, hp: 40 }); cd.town = "depot";
    const c2 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 0.4, z: -10, hp: 40 }); c2.town = "depot2";
    addBody(world, { kind: "chunk", team: 1, mass: 100, hx: 0.3, hy: 0.3, hz: 0.3, x: 6, y: 0.3, z: 6, hp: 40 }); // dynamic rubble
    const sq = makeSquad(1, "rifles", 1, -2, -2);
    spawnSquadMembers(world, sq);
    spawnUnit(world, { x: 2, z: 14 }, "");                  // enemy conscript
    spawnUnit(world, { x: -2, z: 16 }, "tank");             // enemy vehicle
    const dead = spawnUnit(world, { x: 9, z: 9 }, ""); dead.alive = false;
    return { world, sq };
  };

  // (a) pool identity: each pool equals its reference filter, in world order.
  if (listsMod) {
    const { world } = buildZoo();
    const L = listsMod.makeBodyLists();
    listsMod.rebuildBodyLists(world, L);
    const SOLID = new Set(["rock", "wall", "tower", "tree", "chunk"]);
    const ref = {
      solids: world.bodies.filter((b) => b.alive && SOLID.has(b.kind) && !(b.invM > 0 && b.kind !== "chunk" && b.kind !== "tree")),
      statics: world.bodies.filter((b) => b.alive && SOLID.has(b.kind) && b.invM === 0),
      friends: world.bodies.filter((b) => b.alive && (b.kind === "unit" || b.kind === "vehicle") && b.team === 1),
      foes: world.bodies.filter((b) => b.alive && (b.kind === "unit" || b.kind === "vehicle") && b.team === 2),
      structsFor1: world.bodies.filter((b) => b.alive && (((b.kind === "wall" || b.kind === "tower") && b.team === 2) || (b.kind === "chunk" && b.town === "depot2"))),
      structsFor2: world.bodies.filter((b) => b.alive && (((b.kind === "wall" || b.kind === "tower") && b.team === 1) || (b.kind === "chunk" && b.town === "depot"))),
      friendly: world.bodies.filter((b) => b.alive && (((b.kind === "wall" || b.kind === "tower") && b.team === 1) || (b.kind === "chunk" && b.team === 0 && b.town !== "depot2"))),
    };
    for (const k of Object.keys(ref)) {
      ok(`T1(a): pool ${k} matches its reference filter, in world order`,
        L[k].length === ref[k].length && L[k].every((b, i) => b === ref[k][i]),
        `${k}: ${L[k].length} vs ${ref[k].length}`);
    }
    ok("T1(a): rebuild installs world._L", world._L === L);
    ok("T1(a): a second rebuild reuses the same arrays (no per-tick allocation)",
      (() => { const s = L.solids; listsMod.rebuildBodyLists(world, L); return L.solids === s; })());
  }

  // (b) mid-tick death honesty: a foe killed AFTER the rebuild is never
  // acquired off the stale pool — the consumer's own alive check skips him.
  if (listsMod) {
    const world = makeWorld({ field: flatF, seed: 7 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const foe = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 58 });
    listsMod.rebuildBodyLists(world, listsMod.makeBodyLists());
    foe.alive = false;                                      // dies mid-tick, list is stale
    squadFire(world, sq, 1 / 60);
    ok("T1(b): a foe killed after the rebuild draws no fire off the stale pool",
      world.projectiles.length === 0, `projectiles=${world.projectiles.length}`);
  }

  // (c) THE KEYSTONE: twin firefight, with and without the lists installed —
  // identical worldHash, identical rng draw count, after 8 sim-seconds of
  // squads, enemy shooters and a live tower-style scan all running together.
  if (listsMod) {
    const run = (withLists) => {
      const { world, sq } = buildZoo();
      world.dt = 1 / 60;
      const T = makeTerritory(29, 57);
      T.sight = makeSight(T);
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      const L = listsMod.makeBodyLists();
      for (let i = 0; i < 480; i++) {
        if (withLists) listsMod.rebuildBodyLists(world, L);
        if (i % 15 === 0) stepSight(world, T.sight, idUV, idW);
        stepUnits(world, straightGrid(0, 1), identFwdDir, T, idUV);
        stepSquad(world, sq, world.dt);
        squadFire(world, sq, world.dt, T, idUV);
        stepWorld(world);
      }
      return `${worldHash(world)}|${draws}`;
    };
    ok("T1(c) KEYSTONE: lists installed vs absent — identical worldHash and draw count",
      run(true) === run(false), `${run(true)} vs ${run(false)}`);
  }
}
// ==== end THE FRONT T1 =======================================================
```

**Step 2 — the module.** Create `src/depot/lists.js` with exactly this content.

```js
// COLDSNAP DEPOT — lists.js: typed body sub-lists for the hot scans.
// ONE pass per sim tick (stepDepot's first line) filters world.bodies into
// per-predicate pools; every hot scan iterates its pool instead of the whole
// body array. THE CONTRACT: a pool narrows the CANDIDATE set by properties
// fixed for a body's lifetime (kind, team, town tag, mass class) — every
// consumer KEEPS its full original predicate (alive, range, sight, arc), so
// a body that dies mid-tick is skipped exactly as the full scan skipped it.
// Pool order is world.bodies order (one forward pass, never sorted), so
// every scan visits candidates in the order it always did — identical picks,
// identical ties. A body ADDED mid-tick (a laid sandbag, a dropped course's
// rubble) joins the pools on the next tick — an accepted one-tick (8ms)
// delta, stated in the phase plan. No rng. Fixtures that never build lists
// fall back to world.bodies at every consumer (world._L absent).
const SOLID_KINDS = new Set(["rock", "wall", "tower", "tree", "chunk"]);

export function makeBodyLists() {
  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [] };
}

// structsFor1/structsFor2: hostileStructure(b, team)'s candidate sets — what
// team 1 / team 2 shooters may treat as enemy STRUCTURE targets (state.js).
// friendly: friendlyBlocksPoint's careful-fire set (state.js) — the residual
// invM check stays in the consumer.
export function rebuildBodyLists(world, L) {
  L.solids.length = 0; L.statics.length = 0;
  L.friends.length = 0; L.foes.length = 0;
  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0;
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const k = b.kind;
    if (k === "unit" || k === "vehicle") {
      if (b.team === 1) L.friends.push(b);
      else if (b.team === 2) L.foes.push(b);
      continue;
    }
    if (!SOLID_KINDS.has(k)) continue;
    // solidBlocksPoint/bracedAt's kind-not-mobility rule (accuracy.js)
    if (!(b.invM > 0 && k !== "chunk" && k !== "tree")) L.solids.push(b);
    // exposureAt/slotBlocked/losGraze's strictly-static rule (squads.js)
    if (b.invM === 0) L.statics.push(b);
    if (k === "wall" || k === "tower") {
      if (b.team === 2) L.structsFor1.push(b);                       // F3-ready
      else if (b.team === 1) { L.structsFor2.push(b); L.friendly.push(b); }
    } else if (k === "chunk") {
      if (b.town === "depot2") L.structsFor1.push(b);
      else if (b.town === "depot") L.structsFor2.push(b);
      if (b.team === 0 && b.town !== "depot2") L.friendly.push(b);
    }
  }
  world._L = L;
}
```

**Step 3 — rebuild once per sim tick.** `src/depot/DepotGame.jsx`. Add to the state.js import cluster's neighborhood (after line 27's save.js import):

```js
import { makeBodyLists, rebuildBodyLists } from "./lists.js";
```

And make the rebuild the FIRST line of `stepDepot` (line 600, before `stepEnemies(world, grid, T);`):

```js
function stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, S) {
  // THE FRONT T1 (mk1.00): the tick's body pools — built once, read by every
  // hot scan below (and by the possessed-fire calls later this same tick).
  rebuildBodyLists(world, world._L || makeBodyLists());
  stepEnemies(world, grid, T);
```

**Step 4 — accuracy.js, three consumers.** Each edit changes ONLY the iteration source; the predicate lines stay verbatim.

`solidBlocksPoint` (line 44):
```js
export function solidBlocksPoint(world, x, y, z, selfId) {
  const pool = world._L ? world._L.solids : world.bodies;   // T1: typed pool, full-scan fallback
  for (const b of pool) {
```

`losGraze` (line 153, the body loop at 159):
```js
  const pool = world._L ? world._L.statics : world.bodies;  // T1
  for (const b of pool) {
```

`bracedAt` (line 179):
```js
export function bracedAt(world, x, z) {
  const pool = world._L ? world._L.solids : world.bodies;   // T1
  for (const b of pool) {
```

**Step 5 — squads.js, four consumers.**

`exposureAt` (line 102, loop at 104):
```js
  const pool = world._L ? world._L.statics : world.bodies;  // T1
  for (const b of pool) {
```

`slotBlocked` (line 168):
```js
function slotBlocked(world, x, z, clear) {
  const pool = world._L ? world._L.statics : world.bodies;  // T1
  for (const b of pool) {
```

`squadThreatened` (line 422, the body loop at 429):
```js
  const pool = world._L ? world._L.foes : world.bodies;     // T1
  for (const b of pool) {
```

`stepSapperCharges` (line 464, the target loop at 484):
```js
    const pool = world._L ? world._L.structsFor1 : world.bodies; // T1
    for (const t2 of pool) {
```

**Step 6 — state.js, four consumers.**

`squadFire`'s two scans (lines 538 and 559) — the pools pick by the squad's own sign, so the function stays two-sided:
```js
    const scanUnits = () => {
      const pool = world._L ? (enemyTeam === 2 ? world._L.foes : world._L.friends) : world.bodies; // T1
      let best = null, bd = eR * eR;
      for (const e of pool) {
```
```js
    const scanStructs = () => {
      const pool = world._L ? (squad.team === 1 ? world._L.structsFor1 : world._L.structsFor2) : world.bodies; // T1
      let best = null, bs = eR * eR;
      for (const s of pool) {
```

`snapTargetNear` (line 609):
```js
export function snapTargetNear(world, aim, T, toUV, r = POSSESS_SNAP_R) {
  const pool = world._L ? world._L.foes : world.bodies;     // T1
  let best = null, bd = r * r;
  for (const b of pool) {
```

`friendlyBlocksPoint` (line 837) — the pool pre-applies the friendly-kind filter; the selfId, invM and per-axis checks stay verbatim:
```js
function friendlyBlocksPoint(world, x, y, z, selfId) {
  const pool = world._L ? world._L.friendly : world.bodies; // T1
  for (const b of pool) {
```

**Step 7 — units.js, five consumers.**

`stepTank`'s structure scan (line 137) — the tank is team 2; its targets are the player's structures:
```js
  const pool = world._L ? world._L.structsFor2 : world.bodies; // T1
  for (const s of pool) {
```

`nearestPlayerUnit` (line 169, loop at 171):
```js
  const pool = world._L ? world._L.friends : world.bodies;  // T1
  let best = null, bd = R2 * urgency * urgency;
  for (const s of pool) {
```

`stepRifleman`'s structure scan (line 310):
```js
    const pool = world._L ? world._L.structsFor2 : world.bodies; // T1
    for (const s of pool) {
```

`stepGrenadier`'s structure scan (line 404):
```js
    const pool = world._L ? world._L.structsFor2 : world.bodies; // T1
    for (const b of pool) {
```

`stepSapper`'s target loop (line 461):
```js
  const pool = world._L ? world._L.structsFor2 : world.bodies; // T1
  for (const t2 of pool) {
```

**Step 8 — DepotGame.jsx, two consumers.**

`stepTowers`' acquisition scan (line 407):
```js
      const pool = world._L ? world._L.foes : world.bodies; // T1
      let bd = eR * eR;
      for (const e of pool) {
```

`engageCheck`'s scan (line 629):
```js
      const pool = world._L ? world._L.foes : world.bodies; // T1
      for (const e of pool) {
```

**Step 9 — green, then the flip and the bump.** Run `npm run test:depot` — the T1 block goes green, nothing else moves (any old assert that moves is a defect, not a re-pin candidate: this task claims behavior identity). Then:

`src/ui/Roadmap.jsx` lines 20–21 — the phase flip (fold-in convention) and The Front's card copy updated to the ratified scope:
```js
  { name: "Possession", status: "DONE", desc: "Take direct control of any squad or tower and drive it yourself." },
  { name: "The Front", status: "IN PROGRESS", desc: "A square map twice the ground, wilder every seed, and a stream to cross." },
```

`src/version.js` line 6:
```js
export const MK = "mk1.00";
```

**Step 10 — the after-measurement and close.** Rebuild (`npm run build`, AFTER the bump), rerun Step 0's exact scenario on the Pi, and report before/after median and p95 `sim` ms side by side. A regression (after ≥ before) is a STOP-and-report, not a ship.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (T1 block failing-first, then green; zero re-pins expected — any re-pin is reported as a defect) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke · Pi perf before/after per Steps 0/10. Allowed files: `lists.js` (new), `accuracy.js`, `squads.js`, `state.js`, `units.js`, `DepotGame.jsx`, `depot-test.mjs`, `Roadmap.jsx`, `version.js`. Commit `"body lists: the hot scans stop walking the world (mk1.00)"`, push, CI green, STOP for the owner's word.

## AMENDMENT 1 (owner's ruling, 2026-08-13) — rebuild once per frame

*Steps 0–9 landed green, but the Step 10 capture showed the tail regressing: mean sim cost fell 15–17%, p95 rose ~2.5%, worst rose ~9–10%, reproduced twice. Cause: the rebuild ran at the top of `stepDepot`, i.e. once per sub-step — a catch-up frame running six sub-steps paid six rebuilds in exactly the frames that were already worst. The owner ruled: move the rebuild to once per frame. Staleness widens from one tick to one frame's sub-steps; still deterministic; the keystone test drives its own loop and is unaffected.*

**Step A1 — take the rebuild out of stepDepot.** `src/depot/DepotGame.jsx` — delete the two rebuild lines added by Step 3 (the comment and the `rebuildBodyLists(...)` call at the top of `stepDepot`), restoring `stepEnemies(world, grid, T);` as the first line. The import from Step 3 stays.

**Step A2 — rebuild once per frame, inside the sim stopwatch.** `src/depot/DepotGame.jsx`, in the frame loop, between the sim-bracket stopwatch open and the catch-up loop (live anchor: `const pSim0 = perf ? performance.now() : 0;` followed by `let guard = 0;`):

```js
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          // THE FRONT T1 AMENDMENT 1 (owner, 2026-08-13): the pool rebuild
          // runs ONCE PER FRAME, not once per sub-step — a catch-up frame
          // running six sub-steps paid six rebuilds in exactly the frames
          // that were already worst (measured: worst +9% at per-sub-step).
          // Staleness widens from one tick to one frame; still deterministic.
          if (S.acc >= STEP) rebuildBodyLists(world, world._L || makeBodyLists());
          let guard = 0;
          while (S.acc >= STEP && guard++ < 6) {
```

The `S.acc >= STEP` guard keeps the rebuild off paused/idle frames, matching the old behavior (the rebuild only ever ran when a sim step ran).

**Step A3 — the module comment tells the truth.** `src/depot/lists.js`, header comment: change "ONE pass per sim tick (stepDepot's first line)" to "ONE pass per frame (DepotGame's frame loop, before the sim catch-up loop)".

**Step A4 — gates and the measurement.** `npm run lint:depot` · `npm run test:depot` (zero re-pins — the T1 block is unaffected by construction) · `npm run build` (mark stays mk1.00, already bumped in-tree) · `SMOKE_ONLY=depot` smoke · rerun the Step 0 heavy capture, two repeats. SHIP RULE: commit only if worst and p95 are at or below the mk0.99 baseline (`perf-before.json`) AND the mean improvement holds. Otherwise stop and report — no third strategy without the owner.
