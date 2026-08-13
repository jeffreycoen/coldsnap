# THE FRONT — phase plan (P5)

*2026-08-13. Governs the mk1.0x series. THIS PHASE IS MAP WORK ONLY (owner's ruling, second sitting): a **120×120 square map**, wilder procedural generation (roads optional, drawn per seed), a **stream with a bridge** (light version — obstacle water, no drowning), depot geometry work (evened depots, randomized-but-spaced), proving-grounds building forms, copses and forests.*

*Everything troop-shaped moves to the NEXT phase, TROOPS & PHYSICS (P6): the unit-model question (most troops as singles, the sniper pair kept), the selection UI, combat re-tuning, the typed body-list perf work, AND the bell-repriced simple AMM (its design is ratified — repriced each bell off live standing stock, units and masonry, enemy pays the same table — it just does not land in the map phase). The body-list implementation ran to green gates and was REVERTED at the owner's word (tail metric unmeasurable on the probe); its full spec and findings are archived at the bottom of this document for resurrection.*

*Marks: Task 1 = mk1.00, then +0.01 per task. Every deploy bumps `src/version.js` and builds AFTER the bump. Task 1's commit carries the roadmap flip (Possession → DONE, The Front → IN PROGRESS).*

---

## The task list

**Task 1 — The square frame** — POPULATED BELOW (mk1.00).

**Task 2 — The wilder map** — POPULATED BELOW (mk1.01).

**Task 3 — The stream and the bridge** — POPULATED BELOW (mk1.02).

**Task 4 — Buildings of the proving grounds** — POPULATED BELOW (mk1.03).

**Task 5 — Copses and forests** *(skeleton)*
- Copse/forest placement in generation.
- Raise the tree pools; burn behavior already carries.

**Task 6 — The measurement close** *(skeleton)*
- Full-density Pi baseline on the new map: frame split, collapse worst case, sight recompute.
- Re-pin perf numbers; owner playtest closes the phase.

---

# TASK 4 — Buildings of the proving grounds (mk1.03)

**What it does.** The town builder stops knowing one shape. It learns the proving grounds' proven forms: the drive-through hangar whose roof is ONE rigid 800-kilogram slab welded to the top two wall courses (shear the ring and the whole roof pancakes at once), the warehouse whose granular roof stands on two interior columns (shoot the columns and it comes down honestly), and freestanding field walls — masonry screens infantry fight from. Wide existing buildings get the same interior columns. Field walls block the movement grid: the assault paths around them, and they are real cover and real chokepoints. The chunk pool rises 2000 → 3000 to hold the denser town; the boot stone count is measured in the suite and the collapse cost is measured on the Pi.

**Rulings folded in (owner, 2026-08-13):** field walls BLOCK the grid; walls lie AXIS-ALIGNED; big forms draw **2–4 per map**; wide existing templates (6+ stones) are RETROFITTED with columns; the stone cap is RAISED (2000 → 3000, the Pi measurement is the judge). The depot lattice itself is deliberately NOT columned — the fortress fight is tuned as it stands. The roofless yard is not columned — no roof to hold.

**Feel changes that ship for the owner's eyes:** hangars you can walk or drive through, with roofs that pancake in one piece when the walls go; warehouses and wide houses that collapse when their columns are shot out; field walls scattered across the front as cover; assaults bending around them.

**Suggested model:** Sonnet — all code specified below.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/DepotGame.jsx` — 30–56 (map state), 58–218 (genMap; the TPL list at 153–159, benches 176–199, ruins 200–208 — edits land here), 219–250 (makeMap, read-only), 525–619 (townFootprint/buildTown/stepTown — the heart of the task), 1038–1110 (boot: buildTown call + censuses, read-only), 2477–2500 (debug hooks; the new hook lands beside `__DEPOTFLAGS__` at ~2488), 3295 (hook cleanup list).
- `src/engine/core.js` — 2172–2320 (the pattern source: cover walls, hangar + slab, warehouse columns, houses). FROZEN — read-only.
- `src/render/renderer.js` — 745–760 (CHUNK_CAP), 1675–1690 (the chunk draw loop, read-only).
- `src/depot/state.js` — 875–935 (census machinery, read-only — bench buildings are never censused).
- `src/depot/save.js` — 50–130 (verify only: bodies serialize per-body `hx/hy/hz`, so the slab rides a save like any chunk; no edits).
- `scripts/depot-test.mjs` — 1–70 (harness), 2407–2437 (the extraction pattern), 5490–5608 (the T3 block + tail; T4 lands before the tail).
- `src/version.js`.

**Trap notes:**
- genMap runs on its OWN map-seed stream — draw counts there change freely; `depot-lint` still forbids `Math.random`.
- Big forms are placed BEFORE the bench buildings (landmarks first, benches fill around them), and the `bid` id counter hoists above both loops. Nothing pins building ids.
- ACCEPTED SEEDS SHIFT: more blocked ground means makeMap's retry may accept a later attempt on some seeds. Every existing sweep asserts properties, not layouts — **EXPECTED RE-PINS: none.** Any old assert moving is a defect: STOP and report.
- The slab joins the building's stone list AFTER the weld map is built — its sentinel grid position `[-1, t.ny, -1]` must never enter the neighbor lookups. It DOES join `stones`/`n0`, so a pancaked roof counts toward the building's ruin — intended.
- The drive doors bind to the LONG axis by comparing the entry's live dimensions — never store an axis on the template; both the genMap swap and the ORIENT rotation swap `nx/nz` under it.
- Column positions are DERIVED from the post-swap dimensions at build time (the warehouse thirds rule) — never stored coordinates, same reason.
- `door: -1` is the no-door convention (matches no column); the ORIENT swap's `Math.min(t.door, t.nx - 1)` keeps −1 at −1. A field wall is one stone thick, so the standard door carve can never fire on it anyway.
- makeMap falls through with its LAST attempt if all 24 retries foul — pre-existing behavior; the new blockers raise the odds slightly. Not this task's to fix. If any sweep shows a disconnected accepted map, STOP and report.
- If the T4(a) stone-budget assert reads over 2900, STOP and report — the cap decision goes back to the owner.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the FRONT-T4 block before the tail summary (`if (fails.length) {`). `npm run test:depot` shows the block red — the T4(a) counts read zero and the T4(g) source pins are absent; blocks (b)–(e) skip themselves while no form exists. Record the exact reds.

```js
// ==== FRONT T4: buildings of the proving grounds =============================
// mk1.03 (The Front, Task 4). The town builder learns the proven forms:
// slab-roof drive-through hangars, columned warehouses, columns in the wide
// templates, freestanding field walls that block the grid. The chunk pool
// rises to 3000; the boot stone count is measured right here.
{
  console.log("\n[front t4: buildings of the proving grounds]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const sliceFn4 = (name) => {
    const start = src.indexOf(`\nfunction ${name}(`);
    if (start < 0) throw new Error("T4 extract: missing function " + name);
    const rest = src.slice(start + 1);
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const header4 = src.slice(src.indexOf("const GRID_CS"), src.indexOf("function genMap"));
  const mapSrc4 = [
    header4,
    sliceFn4("genMap"), sliceFn4("makeMap"), sliceFn4("streamAt"), sliceFn4("pondAt"), sliceFn4("rockAt"),
    sliceFn4("makeGrid"), sliceFn4("checkConnectivity"), sliceFn4("townFootprint"), sliceFn4("buildTown"),
    `return { makeMap, makeGrid, buildTown, invW, state: () => ({ ORIENT, TOWN, MAP_SEED }) };`,
  ].join("\n");
  const mkMapT4 = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc4,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  const flatF4 = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the sweep: 2-4 big forms and 2-5 field walls on every seed; both big
  // kinds appear across the sweep; the worst boot stone count stays under
  // the raised pool with rubble headroom.
  let bigLo = 99, bigHi = 0, wallLo = 99, wallHi = 0, sawHangar = 0, sawWarehouse = 0;
  let worstStones = 0, worstSeed = 0, hangarSeed = 0, warehouseSeed = 0, wallSeed = 0;
  for (let s = 1; s <= 40; s++) {
    const Mi = mkMapT4(); Mi.makeMap(s * 769);
    const st = Mi.state();
    const bigs = st.TOWN.filter((t) => /^(hangar|warehouse)/.test(t.id));
    const walls = st.TOWN.filter((t) => /^fwall/.test(t.id));
    bigLo = Math.min(bigLo, bigs.length); bigHi = Math.max(bigHi, bigs.length);
    wallLo = Math.min(wallLo, walls.length); wallHi = Math.max(wallHi, walls.length);
    if (bigs.some((t) => t.slab)) { sawHangar++; if (!hangarSeed) hangarSeed = s * 769; }
    if (bigs.some((t) => t.cols && !t.slab)) { sawWarehouse++; if (!warehouseSeed) warehouseSeed = s * 769; }
    if (walls.length && !wallSeed) wallSeed = s * 769;
    const world = makeWorld({ field: flatF4, seed: 5 });
    Mi.buildTown(world, Mi.makeGrid(null), flatF4);
    const stones = world.bodies.filter((b) => b.kind === "chunk").length;
    if (stones > worstStones) { worstStones = stones; worstSeed = s * 769; }
  }
  ok("T4(a): every seed draws 2-4 big forms", bigLo >= 2 && bigHi <= 4, `${bigLo}-${bigHi}`);
  ok("T4(a): every seed draws 2-5 field walls", wallLo >= 2 && wallHi <= 5, `${wallLo}-${wallHi}`);
  ok("T4(a): both big kinds appear across the sweep", sawHangar >= 5 && sawWarehouse >= 5, `hangar ${sawHangar}/40, warehouse ${sawWarehouse}/40`);
  ok("T4(a): worst boot stone count stays under the 3000 pool with rubble headroom", worstStones <= 2900, `${worstStones} stones (seed ${worstSeed})`);

  // (b) the hangar: one 800kg slab welded to the top two courses, no
  // granular roof, drive doors open at ground level through both end walls.
  if (hangarSeed) {
    const Mi = mkMapT4(); Mi.makeMap(hangarSeed);
    const hg = Mi.state().TOWN.find((t) => t.slab);
    const world = makeWorld({ field: flatF4, seed: 5 });
    Mi.buildTown(world, Mi.makeGrid(null), flatF4);
    const mine = world.bodies.filter((b) => b.kind === "chunk" && b.town === hg.id);
    const slabs = mine.filter((b) => b.mass === 800);
    ok("T4(b): the hangar carries exactly one rigid slab", slabs.length === 1, `${slabs.length}`);
    const slab = slabs[0];
    const welds = world.welds.filter((w) => !w.broken && (w.a === slab || w.b === slab)).length;
    ok("T4(b): the slab hangs on the top two courses (10+ welds)", welds >= 10, `${welds}`);
    ok("T4(b): no granular roof course on a slab building", mine.every((b) => b === slab || b.gpos[1] < hg.ny));
    const driveZ = hg.nz >= hg.nx;
    const doorway = mine.filter((b) => b.gpos[1] === 0 && (driveZ
      ? (b.gpos[2] === 0 || b.gpos[2] === hg.nz - 1) && b.gpos[0] >= 1 && b.gpos[0] <= hg.nx - 2
      : (b.gpos[0] === 0 || b.gpos[0] === hg.nx - 1) && b.gpos[2] >= 1 && b.gpos[2] <= hg.nz - 2));
    ok("T4(b): the drive doors are open at ground level on both ends", doorway.length === 0, `${doorway.length} stones in the doorway`);
  }

  // (c) the warehouse: two interior columns, full height, distinct sites.
  if (warehouseSeed) {
    const Mi = mkMapT4(); Mi.makeMap(warehouseSeed);
    const wh = Mi.state().TOWN.find((t) => t.cols && !t.slab && /^warehouse/.test(t.id));
    const world = makeWorld({ field: flatF4, seed: 5 });
    Mi.buildTown(world, Mi.makeGrid(null), flatF4);
    const mine = world.bodies.filter((b) => b.kind === "chunk" && b.town === wh.id);
    const interior = mine.filter((b) => b.gpos[1] < wh.ny &&
      b.gpos[0] > 0 && b.gpos[0] < wh.nx - 1 && b.gpos[2] > 0 && b.gpos[2] < wh.nz - 1);
    ok("T4(c): the warehouse stands two interior columns, full height", interior.length === 2 * wh.ny, `${interior.length} vs ${2 * wh.ny}`);
    const sites = new Set(interior.map((b) => b.gpos[0] + "," + b.gpos[2]));
    ok("T4(c): the columns stand at two distinct sites", sites.size === 2, [...sites].join(" | "));
  }

  // (d) a field wall: L x H stones, one thick, no roof, and it CLAIMS its
  // ground — the blocked cell carries the wall's building id.
  if (wallSeed) {
    const Mi = mkMapT4(); Mi.makeMap(wallSeed);
    const fw = Mi.state().TOWN.find((t) => /^fwall/.test(t.id));
    const world = makeWorld({ field: flatF4, seed: 5 });
    const g = Mi.makeGrid(null);
    Mi.buildTown(world, g, flatF4);
    const mine = world.bodies.filter((b) => b.kind === "chunk" && b.town === fw.id);
    const L = Math.max(fw.nx, fw.nz);
    ok("T4(d): a field wall is L x H stones, one thick, no roof", mine.length === L * fw.ny, `${mine.length} vs ${L * fw.ny}`);
    const gc = g.worldToGrid(fw.x, fw.z);
    const cell = g.inBounds(gc.gx, gc.gz) ? g.cells[g.idx(gc.gx, gc.gz)] : null;
    ok("T4(d): the wall claims its ground (blocked cell, building id)", !!cell && cell.blocked === true && cell.building === fw.id, cell && String(cell.building));
  }

  // (e) the slab STANDS: wake the whole hangar and run five sim seconds —
  // the welded plate must not sag or shear on a quiet field.
  if (hangarSeed) {
    const Mi = mkMapT4(); Mi.makeMap(hangarSeed);
    const hg = Mi.state().TOWN.find((t) => t.slab);
    const world = makeWorld({ field: flatF4, seed: 5 });
    Mi.buildTown(world, Mi.makeGrid(null), flatF4);
    const mine = world.bodies.filter((b) => b.kind === "chunk" && b.town === hg.id);
    const slab = mine.find((b) => b.mass === 800);
    const homes = mine.map((b) => ({ b, x: b.pos.x, y: b.pos.y, z: b.pos.z }));
    const y0 = slab.pos.y;
    for (const b of mine) b.sleeping = false;
    for (let i = 0; i < 600; i++) stepWorld(world);
    ok("T4(e): the woken slab holds its height over 5 sim seconds", Math.abs(slab.pos.y - y0) < 0.25, (slab.pos.y - y0).toFixed(3));
    const moved = homes.filter((h) => Math.hypot(h.b.pos.x - h.x, h.b.pos.y - h.y, h.b.pos.z - h.z) > 0.3).length;
    ok("T4(e): the woken hangar keeps its stones (under 5% drift)", moved <= mine.length * 0.05, `${moved}/${mine.length}`);
  }

  // (f) determinism: same seed, identical town
  {
    const A = mkMapT4(); A.makeMap(7717);
    const B = mkMapT4(); B.makeMap(7717);
    ok("T4(f): twin determinism — identical TOWN", JSON.stringify(A.state().TOWN) === JSON.stringify(B.state().TOWN));
  }

  // (g) source pins: the hooks and the raised cap exist where claimed
  ok("T4(g): the wide templates and the warehouse carry the cols flag (5 sites)",
    (src.match(/cols: true/g) || []).length === 5);
  ok("T4(g): the drive doors bind to the long axis by live dimensions",
    /const driveZ = t\.drive && t\.nz >= t\.nx;/.test(src));
  ok("T4(g): the town debug hook exists", /__DEPOTTOWN__/.test(src));
  const rsrc4 = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  ok("T4(g): the chunk pool is raised to 3000", /const CHUNK_CAP = 3000;/.test(rsrc4));
}
// ==== end FRONT T4 ===========================================================
```

**Step 2 — the wide templates gain columns.** `src/depot/DepotGame.jsx`, the TPL list (line 153). Four entries gain `cols: true` — every roofed template 6+ stones on a side; the 5×4 house, croft, watch, granary, shed, and the roofless yard stay bare:
```js
  const TPL = [
    { t: "croft", nx: 4, nz: 3, ny: 3 }, { t: "house", nx: 6, nz: 5, ny: 4, cols: true },
    { t: "house", nx: 5, nz: 4, ny: 4 }, { t: "long", nx: 8, nz: 4, ny: 3, cols: true },
    { t: "watch", nx: 2, nz: 2, ny: 8 }, { t: "granary", nx: 3, nz: 3, ny: 7 },
    { t: "yard", nx: 6, nz: 5, ny: 2, roof: false }, { t: "shed", nx: 4, nz: 4, ny: 3 },
    { t: "chapel", nx: 5, nz: 6, ny: 5, cols: true }, { t: "keep", nx: 7, nz: 6, ny: 5, cols: true },
  ];
```

**Step 3 — genMap draws the big forms and the field walls.** Three edits, all inside genMap:

(3a) The big forms go down FIRST, before the benches — insert between the `depotFoul` line (175) and the benches array (177), and this block owns `let bid = 0;` now (delete the old `let bid = 0;` at line 180):
```js
  // T4: THE BIG FORMS (owner's ruling: 2-4 per map) — the proving grounds'
  // slab-roof drive-through hangar and columned warehouse, placed before the
  // benches so the landmarks go down first and the benches fill around them.
  // The shape flags (slab/drive/cols) are read by buildTown.
  const BIG = [
    { t: "hangar", nx: 9, nz: 10, ny: 5, slab: true, drive: true },
    { t: "warehouse", nx: 8, nz: 6, ny: 4, cols: true },
  ];
  let bid = 0;
  const nBig = 2 + Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 120 && placed < nBig; k++) {
    const tpl = BIG[Math.floor(r() * BIG.length)];
    const swap = r() < 0.5;
    const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
    const x = -48 + r() * 96;
    const z = -44 + r() * 84;
    const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
    if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 4)) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
    if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
    if (roadDist(x, z) < rad + 3) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) continue;
    if (Math.abs(z - streamV) < rad + 9) continue;
    town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny,
      door: tpl.drive ? -1 : (r() < 0.5 ? 0 : nx - 1),
      slab: tpl.slab, drive: tpl.drive, cols: tpl.cols });
    placed++;
  }
```

(3b) The bench loop's push (line 196) carries the template's flag through:
```js
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, ruin: decay || undefined, cols: tpl.cols });
```

(3c) The field walls go down after the old ruins (insert after line 208, before the `T` transform):
```js
  // T4: FIELD WALLS (owner's rulings: they block the grid; axis-aligned) —
  // freestanding masonry screens, 3-8 stones long, 2-4 courses, one stone
  // thick. Town entries like any building: footprint claim, ruin bookkeeping.
  const nWalls = 2 + Math.floor(r() * 4);
  for (let k = 0, placed = 0; k < 90 && placed < nWalls; k++) {
    const L = 3 + Math.floor(r() * 6), H = 2 + Math.floor(r() * 3);
    const swap = r() < 0.5;
    const nx = swap ? 1 : L, nz = swap ? L : 1;
    const x = -50 + r() * 100;
    const z = -44 + r() * 84;
    const rad = L * MASON.pitch / 2 + 1;
    if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 8)) continue;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 3)) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 2)) continue;
    if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
    if (roadDist(x, z) < rad + 2.5) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2)) continue;
    if (Math.abs(z - streamV) < rad + 9) continue;
    town.push({ id: "fwall" + placed, x, z, nx, nz, ny: H, door: -1, roof: false });
    placed++;
  }
```

**Step 4 — buildTown learns the shapes.** `src/depot/DepotGame.jsx`, the lattice loop (lines 544–556). The loop head gains the derived column test, and the skip chain gains three lines (slab roof, drive doors) — everything else in the loop stays byte-identical:
```js
  for (const t of TOWN) {
    const grid3 = [], base = field.heightAt(t.x, t.z) + hcs + 0.02;
    // T4: interior columns — derived from the LIVE (rotation-swapped) dims,
    // the proving grounds' warehouse rule: a third in from each end, mirrored.
    // Derived, never stored: both swaps rotate the building under the rule.
    const colAt = t.cols
      ? (() => {
          const c1x = Math.floor(t.nx / 3), c1z = Math.floor(t.nz / 3);
          const c2x = t.nx - 1 - c1x, c2z = t.nz - 1 - c1z;
          return (ix, iz) => (ix === c1x && iz === c1z) || (ix === c2x && iz === c2z);
        })()
      : () => false;
    // T4: drive doors run down the LONG axis — derived from live dims too.
    const driveZ = t.drive && t.nz >= t.nx;
    for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
      const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
      const corner = (ix <= 1 || ix >= t.nx - 2) && (iz <= 1 || iz >= t.nz - 2);
      if (iy < t.ny && !perim && !colAt(ix, iz)) continue;
      if (iy === t.ny && (t.roof === false || t.slab)) continue; // T4: a slab replaces the granular roof below
      if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
      // T4: drive-through — doors carved through BOTH end walls of the long
      // axis, full width bar the corners, every course but the top lintel.
      if (t.drive && iy < t.ny - 1 && (driveZ
        ? (iz === 0 || iz === t.nz - 1) && ix >= 1 && ix <= t.nx - 2
        : (ix === 0 || ix === t.nx - 1) && iz >= 1 && iz <= t.nz - 2)) continue;
      if (t.depot && iy === t.ny && perim && !corner && (ix + iz) % 2) continue;
      if (t.ruin && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < t.ruin && iy > 0) continue;
```
Then THE SLAB — inserted after the weld loop (after line 591's closing brace) and before the footprint claim (line 592), so its sentinel grid position never enters the neighbor map:
```js
    // T4: THE SLAB — one rigid 800kg roof plate, sized inside the wall ring
    // with the standard ~2cm joint, welded to the top two courses (the
    // proving grounds' proven form: 1-hop convergence, pancakes whole when
    // the ring shears). It joins stones/n0 so a fallen roof counts as ruin.
    if (t.slab) {
      const shx = ((t.nx - 1) / 2) * pitch - hcs - 0.02;
      const shz = ((t.nz - 1) / 2) * pitch - hcs - 0.02;
      const slab = addBody(world, {
        kind: "chunk", team: 0, mass: 800, hx: shx, hy: 0.2, hz: shz,
        x: t.x, y: base + (t.ny - 1) * pitch + 0.2, z: t.z,
        friction: 0.65, restitution: 0.02,
      });
      slab.sleeping = true; slab.town = t.id; slab.gpos = [-1, t.ny, -1];
      for (const c of grid3) if (c.gpos[1] >= t.ny - 2) addWeld(world, slab, c, townBreakF);
      grid3.push(slab);
    }
```

**Step 5 — the town debug hook.** Beside `__DEPOTFLAGS__` (line ~2488) — the Pi capture aims by it:
```js
      window.__DEPOTTOWN__ = () => TOWN.map((t) => ({ id: t.id, x: +t.x.toFixed(2), z: +t.z.toFixed(2), nx: t.nx, nz: t.nz, ny: t.ny, slab: !!t.slab, cols: !!t.cols }));
```
And `"__DEPOTTOWN__"` joins the cleanup delete list (line 3295).

**Step 6 — the chunk pool rises.** `src/render/renderer.js` line 749–755 — the cap becomes 3000 and the comment tells the new truth (keep the mk-history sentences, append):
```js
  // T4 (mk1.03, owner's ruling): 2000 -> 3000. The proving-grounds forms
  // (2-4 big buildings, columns in the wide templates, field walls) push a
  // dense seed's boot stones past the old pool. The Pi collapse capture is
  // the judge of the raised cap; the stones counter stays the alarm.
  const CHUNK_CAP = 3000;
```
The pool allocation, draw loop, and HUD counter all read this one constant — nothing else changes.

**Step 7 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (zero re-pins) · `src/version.js` → `"mk1.03"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke`.

**Step 8 — the Pi collapse capture.** Write `.superpowers/diag-t4-collapse.mjs` (untracked scratch, the body-lists capture's pattern): serve the built bundle (`npm run preview`), drive headful Chromium at `?seed=<S>&perf=1` where S is a T4(a) sweep seed carrying a hangar (report which). `__DEPOTSTART__()`, 10 seconds idle, snapshot `__DEPOTPERF__` (baseline). Find the hangar via `__DEPOTTOWN__()`, fire 40 `__DEPOTSHELL__` rounds walked along its two long walls over ~6 seconds, run 12 more seconds, snapshot again. Report baseline vs collapse-window mean, median, and worst `sim` ms, plus the stones counter at peak. **STOP-and-report before commit if the collapse-window median sim exceeds 16ms** — the cap ruling goes back to the owner with the numbers.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; zero re-pins) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke · the Step 8 Pi capture (numbers in the report). Allowed files: `src/depot/DepotGame.jsx`, `src/render/renderer.js`, `scripts/depot-test.mjs`, `src/version.js` (plus the untracked `.superpowers/diag-t4-collapse.mjs`). Commit `"buildings of the proving grounds: slabs, columns, field walls (mk1.03)"`, push, CI green, STOP. The owner checks the deployed site across seeds: hangars with open drive-throughs, a shelled hangar's roof pancaking in one piece, a warehouse dropping when its columns go, field walls as cover with the assault bending around them.

---

# TASK 3 — The stream and the bridge (mk1.02)

**What it does.** Every map gets ONE stream: a meandering channel crossing the full width in a drawn gap between the rock bands, carved into the terrain with a flat water surface, and ONE crossing. Water is an OBSTACLE, not a killer — no drowning this phase. Both sides obey it the same way: the enemy's flow field routes around water cells automatically; player squads refuse water ground through the same slot-vetting family that already refuses masonry, and a squad ordered into a leg that fords holds at the bank. Building on water is refused. The assault funnels at the crossing — the chokepoint is the point.

**Two scope decisions, stated for the owner's review:**
- **The crossing is a CAUSEWAY (built-up earth), not a suspended deck.** A hovering deck needs new render geometry and deck bodies; the earthen crossing is honest to the terrain system and ships now. Engineer-built and sapper-blown bridges are the Water phase's, per the vision — so the skeleton line "flow field re-reads if it drops" is RULED OUT here: this crossing is permanent terrain.
- **An order whose destination lies ACROSS the water is refused only when the tap lands ON water** ("OPEN WATER — find the crossing"). A destination on far land is accepted; the squad advances to the bank and HOLDS there (the anchor never fords). Crossing is played as two orders through the causeway. Squad path-routing around water is TROOPS & PHYSICS (P6) work; the bank-hold is the honest interim, and it goes on the polish ledger.

**Feel changes that ship for the owner's eyes:** one stream per seed, full-width, meandering, with visible water; a single earthen crossing; assaults funneling over it; squads that stand at the bank instead of wading.

**Suggested model:** Sonnet — all code specified below.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/DepotGame.jsx` — 30–52 (module state; `let STREAM` lands by line 51), 53–190 (genMap/makeMap), 192–274 (buildDepotTerrain), 299–320 (makeGrid), 935–950 (world threading — pondAt/inRim), 1078–1153 (trees/bags, read-only), 1190–1215 (setDressing call), 1900–1935 (consumeOrderTap; the clamp site at 1921), 2325–2335 (breachRock's setDressing).
- `src/depot/squads.js` — 156–190 (slotBlocked/clearSlot), 560–620 (the leg advance; anchor write at 613–616).
- `src/render/renderer.js` — 1131–1162 (setDressing).
- `src/depot/units.js` — 479–560 (read-only: the march is grid-driven; water cells route automatically).
- `scripts/depot-test.mjs` — 1–70, the FRONT T1/T2 extraction blocks, tail.
- `src/version.js`.

**Trap notes:**
- Water is NOT a body. Enemy movement obeys it through the grid; player squads only through the two squads.js edits below; the POSSESSED squad already obeys it for free (the mk0.98 anchor clamp rejects `cell.blocked`, and water cells are blocked) — verify, do not edit.
- All stream math is CANONICAL (u, v), transformed exactly like every other drawn feature; `streamAt` takes WORLD coords and converts via `invW`.
- The stream lives on the map-seed stream — draw counts there are free. The one squads.js edit near the leg machine adds ZERO rng draws (the bank-hold suppresses the anchor write only; the one-draw-per-leg contract is untouched because a held leg never reaches its arrival draw).
- Ponds and their ice are UNTOUCHED — the stream is its own system (water level 0.78, bed 0.2, both absolute; base terrain minimum ≈0.9 keeps the plane inside the banks).
- Renderer change is DEPOT-gated by data: `setDressing` only builds ribbons when `spec.streams` is supplied; TD/campaign/sandbox pass none and render byte-identically.
- The save regrows the stream from the seed (pure genMap); the carve rides the heightfield exactly like craters. No save edits; the mark bump burns old saves.
- `streamV` is capped to ±22 so the channel (≤ meander 3 + width 4 + bank 3) can never touch a depot pad (edge ≥ 31.3) — safety by construction.
- The F1/T1/T2 extraction sweeps re-run the LIVE makeMap and their own grid copies now include stream blocking; their connectivity asserts must keep passing (makeMap's retry guarantees accepted maps connect). A sweep failure is a STOP-and-report.
- Placement wording: water cells get their own refusal ("NO GROUND — open water") at the three placement gates; the generic OCCUPIED path must not be the answer a river gives.
- EXPECTED RE-PINS: none. Any old assert moving is a defect — STOP and report.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the FRONT-T3 block before the tail summary; `npm run test:depot` shows the block red (streamAt missing from the extraction, source pins absent), everything else green. Record the exact reds.

```js
// ==== FRONT T3: the stream and the causeway =================================
// mk1.02 (The Front, Task 3). One stream per map: full-width, carved, water
// at 0.78 over a 0.2 bed, ONE causeway crossing at bridgeU. Water blocks the
// grid (both sides' movement) and the squads' slot family; orders tapped on
// water are refused; nothing drowns.
{
  console.log("\n[front t3: the stream and the causeway]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // extraction: the T1/T2 pattern, plus streamAt and the STREAM module state.
  let M3ok = true, mkMapT3 = null;
  try {
    const sliceFn3 = (name) => {
      const start = src.indexOf(`\nfunction ${name}(`);
      if (start < 0) throw new Error("T3 extract: missing function " + name);
      const rest = src.slice(start + 1);
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const header3 = src.slice(src.indexOf("const GRID_CS"), src.indexOf("function genMap"));
    if (!/let STREAM = null;/.test(header3)) throw new Error("T3: STREAM state not in header");
    const mapSrc3 = [
      header3,
      sliceFn3("genMap"), sliceFn3("makeMap"), sliceFn3("streamAt"), sliceFn3("pondAt"), sliceFn3("rockAt"),
      sliceFn3("makeGrid"), sliceFn3("checkConnectivity"), sliceFn3("townFootprint"), sliceFn3("buildTown"),
      sliceFn3("buildDepotTerrain"),
      `return { makeMap, makeGrid, checkConnectivity, buildDepotTerrain, streamAt, invW,
        state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, ROCKS, PONDS, TOWN, ROADS, BANDS, STREAM, MAP_SEED }) };`,
    ].join("\n");
    mkMapT3 = () => new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc3,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  } catch (e) { M3ok = false; }
  ok("T3: the map module extracts with streamAt and STREAM state", M3ok);

  if (M3ok) {
    // (a) every seed carries a full-width stream inside the safe band
    let has = 0, safe = 0, blockedMid = 0, openCauseway = 0;
    for (let s = 1; s <= 20; s++) {
      const Mi = mkMapT3(); Mi.makeMap(s * 331);
      const st = Mi.state();
      if (!st.STREAM) continue;
      has++;
      if (Math.abs(st.STREAM.v) <= 22.01 && st.STREAM.pts[0].u === -60 && st.STREAM.pts[st.STREAM.pts.length - 1].u === 60) safe++;
      // (b) the grid: mid-channel cells block; the causeway stays open
      const g = Mi.makeGrid(null);
      // a centerline point at least 12m from the causeway
      const P = st.STREAM.pts.find((q) => Math.abs(q.u - st.STREAM.bridgeU) > 12);
      if (P) {
        const wMid = fwdUFor(st.ORIENT, P.u, P.v);
        const gm = g.worldToGrid(wMid.x, wMid.z);
        if (g.inBounds(gm.gx, gm.gz) && g.cells[g.idx(gm.gx, gm.gz)].blocked) blockedMid++;
      } else blockedMid++; // no point that far out is a geometry fluke, not a fail
      const wCw = fwdUFor(st.ORIENT, st.STREAM.bridgeU, st.STREAM.v);
      const gc = g.worldToGrid(wCw.x, wCw.z);
      if (g.inBounds(gc.gx, gc.gz) && !g.cells[g.idx(gc.gx, gc.gz)].blocked) openCauseway++;
    }
    ok("T3(a): every seed carries a stream", has === 20, `${has}/20`);
    ok("T3(a): the stream spans the full width inside |v| <= 22", safe === 20, `${safe}/20`);
    ok("T3(b): mid-channel grid cells are blocked", blockedMid === 20, `${blockedMid}/20`);
    ok("T3(b): the causeway cell stays open", openCauseway === 20, `${openCauseway}/20`);

    // (c) the carve: bed below the waterline mid-channel, causeway above it
    {
      const Mi = mkMapT3(); Mi.makeMap(4242);
      const st = Mi.state();
      const field = makeField(121, 2.0, st.MAP_SEED);
      Mi.buildDepotTerrain(field, st.MAP_SEED);
      const P = st.STREAM.pts.find((q) => Math.abs(q.u - st.STREAM.bridgeU) > 12) || st.STREAM.pts[0];
      const wMid = fwdUFor(st.ORIENT, P.u, P.v);
      const wCw = fwdUFor(st.ORIENT, st.STREAM.bridgeU, st.STREAM.v);
      ok("T3(c): mid-channel bed sits below the 0.78 waterline", field.heightAt(wMid.x, wMid.z) < 0.75, field.heightAt(wMid.x, wMid.z).toFixed(2));
      ok("T3(c): the causeway crown sits above the waterline", field.heightAt(wCw.x, wCw.z) > 0.85, field.heightAt(wCw.x, wCw.z).toFixed(2));
    }

    // (d) determinism: same seed, identical stream
    {
      const A = mkMapT3(); A.makeMap(7717);
      const B = mkMapT3(); B.makeMap(7717);
      ok("T3(d): twin determinism — identical STREAM", JSON.stringify(A.state().STREAM) === JSON.stringify(B.state().STREAM));
    }
  }

  // (e) squads refuse water ground: the slot family reads world.streamAt
  {
    const flatF3 = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatF3, seed: 5 });
    world.streamAt = (x, z) => z > 10 && z < 14;
    ok("T3(e): slotBlocked refuses a water point", slotBlockedPublic(world, 0, 12, 0.6) === true);
    ok("T3(e): dry ground is still a slot", slotBlockedPublic(world, 0, 5, 0.6) === false);
    // (f) the anchor never fords: a MOVE across the stubbed water holds at the bank
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    for (let i = 0; i < 2400; i++) { stepSquad(world, sq, 1 / 60); stepWorld(world); }
    ok("T3(f): the anchor holds at the bank (never enters the water band)", sq.anchor.z < 10.5, sq.anchor.z.toFixed(2));
    ok("T3(f): the order survives the hold (still travelling, not silently completed)", sq.order === "move", sq.order);
  }

  // (g) source pins: the game layer's water rules exist where claimed
  ok("T3(g): a ground order tapped on water is refused with the open-water toast",
    /if \(streamAt\(d\.x, d\.z\)\) \{ toast\("OPEN WATER — find the crossing"\); return true; \}/.test(src));
  ok("T3(g): buildAt refuses open water in its own words",
    /NO GROUND — open water/.test(src));
  ok("T3(g): the world threads streamAt beside pondAt/inRim",
    /world\.streamAt = \(x, z\) => streamAt\(x, z\);/.test(src));
  const rsrc3 = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  ok("T3(g): setDressing builds water ribbons when streams are supplied",
    /spec\.streams \|\| \[\]/.test(rsrc3));
  const sqsrc3 = fs.readFileSync(new URL("../src/depot/squads.js", import.meta.url), "utf8");
  ok("T3(g): slotBlocked's water line exists in squads.js",
    /world\.streamAt && world\.streamAt\(x, z\)/.test(sqsrc3));
}
// ==== end FRONT T3 ===========================================================
```

**Step 2 — genMap draws the stream.** `src/depot/DepotGame.jsx`. First, module state beside the other map globals (line 51's list):
```js
let STREAM = null; // T3: { pts:[{u,v}...], w, v, bridgeU } — canonical, regrown from seed
```
Then inside genMap, AFTER the spawns block and BEFORE the roads block, insert:
```js
  // THE STREAM (T3, mk1.02): one per map — full width, meandering, in a
  // drawn gap clear of the bands, capped |v|<=22 so it can never touch a
  // depot pad. ONE causeway crossing at bridgeU. Canonical space throughout.
  let streamV = (bands[0] + bands[1]) / 2;   // fallback: between the first two bands
  for (let i = 0; i < 20; i++) {
    const v = -22 + r() * 44;
    if (bands.every((b) => Math.abs(v - b) >= 8)) { streamV = v; break; }
  }
  const streamW = 2.2 + r() * 1.8;           // half-width: a 4.4-8m channel // provisional (F5)
  const bridgeU = (r() - 0.5) * 90;
  const streamPts = [];
  for (let u = -60; u <= 60; u += 10) streamPts.push({ u, v: streamV + (r() - 0.5) * 6 });
  const stream = { pts: streamPts, w: streamW, v: streamV, bridgeU };
```
The roads loop gains the causeway waypoint (roads cross water nowhere else) — replace the loop body:
```js
  for (let ri = 0; ri < nRoads; ri++) {
    const pts = [[spawns[ri % spawns.length].x, GRID_OZ + 2]];
    let bridged = false;
    for (const band of passes) {
      const g = band[Math.floor(r() * band.length)];
      if (!bridged && g.z > streamV) { pts.push([bridgeU, streamV]); bridged = true; }
      pts.push([g.x, g.z]);
    }
    if (!bridged) pts.push([bridgeU, streamV]);
    pts.push([objU, objV]);
    roads.push(pts);
  }
```
Clearances — one added line in each of four existing reject chains (coarse v-band tests; the meander is ±3 and the channel ≤4, so 9–10m covers it):
- rocks (in the band loop): `if (Math.abs(z - streamV) < 9) continue;`
- ponds: `if (Math.abs(z - streamV) < rad + 10) continue;`
- bench buildings: `if (Math.abs(z - streamV) < rad + 9) continue;`
- old ruins: `if (Math.abs(z - streamV) < 9) continue;`
The return gains `stream` (the pts stay CANONICAL — deliberately NOT run through T(); every consumer converts via invW like territory does).

**Step 3 — the module knows the stream.** After makeGrid (near line 320), add the distance test:
```js
// T3: is this WORLD point open water? Canonical distance to the stream
// centerline, minus the causeway exemption. The one water test everything
// reads — grid blocking, squad slots, order taps, placement.
function streamAt(x, z) {
  if (!STREAM) return false;
  const c = invW(x, z);
  if (Math.abs(c.u - STREAM.bridgeU) < 3) return false; // the causeway
  const P = STREAM.pts;
  let best = 1e9;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const du = b.u - a.u, dv = b.v - a.v;
    const t = Math.max(0, Math.min(1, ((c.u - a.u) * du + (c.v - a.v) * dv) / (du * du + dv * dv)));
    best = Math.min(best, Math.hypot(c.u - (a.u + du * t), c.v - (a.v + dv * t)));
  }
  return best < STREAM.w;
}
```
makeMap assigns it with the other globals, BEFORE `makeGrid(null)` runs: add `STREAM = m.stream;` to the assignment block. makeGrid's cell classification gains the water branch (line 318):
```js
    if (rockAt(wp.x, wp.z)) { c.blocked = true; c.terrain = true; }
    else if (streamAt(wp.x, wp.z)) { c.blocked = true; c.water = true; }
    else if (pondAt(wp.x, wp.z)) c.ice = true;
```

**Step 4 — the terrain carves.** In buildDepotTerrain, between the slope-relax passes and the road-flatten block (so banks stay banks and the causeway ramps smooth):
```js
  // T3: THE STREAM. Carved after the relax (banks stay banks), before the
  // roads (the causeway ramp smooths). Bed at 0.2, water at 0.78 — absolute
  // levels; base terrain never dips below ~0.9, so the plane stays banked.
  if (STREAM) {
    const P = STREAM.pts, W = STREAM.w;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const c = invW(x, z);
      let dS = 1e9;
      for (let k2 = 0; k2 + 1 < P.length; k2++) {
        const a = P[k2], b = P[k2 + 1];
        const du = b.u - a.u, dv = b.v - a.v;
        const t = Math.max(0, Math.min(1, ((c.u - a.u) * du + (c.v - a.v) * dv) / (du * du + dv * dv)));
        dS = Math.min(dS, Math.hypot(c.u - (a.u + du * t), c.v - (a.v + dv * t)));
      }
      if (dS >= W + 3) continue;
      const k = j * n + i;
      const target = dS < W ? 0.2 : 0.2 + ((dS - W) / 3) * (h[k] - 0.2);
      // the causeway: untouched within 3m of the crossing, full carve by 6m
      const cw = Math.min(1, Math.max(0, (Math.abs(c.u - STREAM.bridgeU) - 3) / 3));
      const carved = h[k] * (1 - cw) + Math.min(h[k], target) * cw;
      if (carved < h[k]) h[k] = carved;
    }
  }
```

**Step 5 — squads refuse the water.** `src/depot/squads.js`, two edits:

(5a) `slotBlocked` (line 168) gains a first line — this one line covers clearSlot, every goal vetting, and seekGoal's look-ahead fan, because they all funnel through it:
```js
function slotBlocked(world, x, z, clear) {
  if (world.streamAt && world.streamAt(x, z)) return true; // T3: open water is never a slot
  for (const b of pool) {
```
(the loop line stays exactly as it is today — the T1 pool machinery was reverted; the loop reads `world.bodies`).

(5b) The leg machine's anchor write (line 613–616) — the anchor never fords; a leg into water holds at the bank (no new draws: a held leg never reaches its arrival draw):
```js
        if (trail <= COHESION_M || squad._cohesionHoldT > COHESION_CAP_S) {
          const step = Math.min(ld, MOVE_SPEED * dt);
          const nx2 = cx + (lx / ld) * step, nz2 = cz + (lz / ld) * step;
          // T3: the anchor never fords — a leg into open water holds at the bank.
          if (!(world.streamAt && world.streamAt(nx2, nz2))) squad.anchor = { x: nx2, z: nz2 };
        }
```

**Step 6 — the game layer's water rules.** `src/depot/DepotGame.jsx`:

(6a) Thread the test beside pondAt/inRim (after line 942):
```js
      world.streamAt = (x, z) => streamAt(x, z);
```
(6b) Order taps on water are refused — immediately after `const d = clampToRim(p.x, p.z);` in consumeOrderTap (line 1921):
```js
        // T3: open water takes no orders — the river is ground for nobody.
        if (streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
```
(6c) Placement speaks the truth — three guards, each a first-line check of the target cell: in `buildAt` and in `canPlaceInfantryAt` (and `canBuildAt`) before their existing checks:
```js
        if (cell.water) { toast("NO GROUND — open water"); return; }             // buildAt
        if (cell.water) return { ok: false, msg: "NO GROUND — open water" };     // canBuildAt / canPlaceInfantryAt
```
(6d) The water ribbons — computed once at boot beside the dressing call (line ~1207), and passed at BOTH setDressing sites (boot and breachRock):
```js
      // T3: the stream's visible water — the canonical centerline sampled at
      // 2m, split at the causeway, widened, world-transformed, at 0.78.
      const streamRibs = [];
      if (STREAM) {
        let run = [];
        const flush = () => { if (run.length >= 2) streamRibs.push({ pts: run, w: STREAM.w + 1 }); run = []; };
        for (let u = -60; u <= 60; u += 2) {
          if (Math.abs(u - STREAM.bridgeU) < 3) { flush(); continue; }
          const i2 = Math.max(0, Math.min(STREAM.pts.length - 2, Math.floor((u + 60) / 10)));
          const a = STREAM.pts[i2], b = STREAM.pts[i2 + 1];
          const t = Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u || 1)));
          const w = fwdU(u, a.v + (b.v - a.v) * t);
          run.push({ x: w.x, y: 0.78, z: w.z });
        }
        flush();
      }
      R.setDressing({ rocks: rocksLive, ponds: PONDS, streams: streamRibs });
```
(breachRock's call at line 2331 becomes `R.setDressing({ rocks: rocksLive, ponds: PONDS, streams: streamRibs });` — hoist `streamRibs` so both sites see it).

**Step 7 — the renderer draws the water.** `src/render/renderer.js`, inside `setDressing` (line 1136), after the ponds loop:
```js
    // T3 (DEPOT-gated by data): stream water — a flat ribbon strip per run,
    // built from the centerline points, at the level the game supplies.
    for (const s of spec.streams || []) {
      const n2 = s.pts.length;
      if (n2 < 2) continue;
      const pos = new Float32Array(n2 * 2 * 3);
      for (let i = 0; i < n2; i++) {
        const p = s.pts[i];
        const q0 = s.pts[Math.max(0, i - 1)], q1 = s.pts[Math.min(n2 - 1, i + 1)];
        let dx = q1.x - q0.x, dz = q1.z - q0.z;
        const L = Math.hypot(dx, dz) || 1;
        const px = (-dz / L) * s.w, pz = (dx / L) * s.w;
        pos.set([p.x + px, p.y, p.z + pz, p.x - px, p.y, p.z - pz], i * 6);
      }
      const idx = [];
      for (let i = 0; i + 1 < n2; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2b4a5c, transparent: true, opacity: 0.82, depthWrite: false }));
      m.layers.set(1);
      dressG.add(m);
    }
```

**Step 8 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (zero re-pins) · `src/version.js` → `"mk1.02"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke` (preview server as before; a smoke failure is a STOP-and-report).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; zero re-pins) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/DepotGame.jsx`, `src/depot/squads.js`, `src/render/renderer.js`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the stream: one river, one crossing, nobody fords (mk1.02)"`, push, CI green, STOP. The owner checks the deployed site across seeds: the stream's meander and water, the single causeway, assaults funneling over it, a squad refusing to ford, "OPEN WATER" on a water tap.

## AMENDMENT 3 (owner's ruling, 2026-08-13) — the grid grows to the full rim

*Found in execution: T3(b)'s mid-channel probe deterministically samples the stream's u = −60 rim endpoint, and the flow grid covered rim-minus-1m (59×59, the inherited inset convention) — the probed cell was off-grid on every seed. The owner rejected a test-side fix and ruled: WIDEN THE GRID TO THE FULL RIM. The 1m inset dies; the flow/build grid covers every meter of playable ground; the stream's full-rim extent stands; the T3 probes work unchanged.*

**Step A3-1.** `src/depot/DepotGame.jsx` line 32: `const GRID_CS = 2.0, GRID_W = 60, GRID_H = 60;` (cell centers at ±59, cell edges exactly on the ±60 rim). Correct the Task 1-era comment beside it — the inset convention is gone.

**Step A3-2.** One re-pin in FRONT T1 (report old→new): the grid-size source-pin `GRID_W = 59, GRID_H = 59` (with its "rim minus the 1m inset" wording) becomes `GRID_W = 60, GRID_H = 60` ("the grid covers the full rim, Amendment 3").

**Step A3-3.** Everything else follows automatically (`GRID_OX/OZ` derive; territory/sight/rim clamp were never inset-coupled) — verify by running the full suite; any OTHER moved assert is a STOP-and-report.

**Polish ledger (this task's deferrals):** squad path-routing AROUND water to a far-side destination (today: bank-hold, crossing is two orders) — TROOPS & PHYSICS (P6); a timber-deck bridge look — Water phase.

---

# TASK 2 — The wilder map (mk1.01)

**What it does.** Map generation stops being three fixed bands, two owed roads, and two depots nailed to the center line. Every seed now draws: how many rock bands (2–4) and where; how many passes cut each band (1–3); how many spawns feed the enemy edge (2–4); how many roads exist at all (0–3 — roads are terrain and looks, the march runs the flow field). THE DEPOTS WANDER AND ARE EVENED: both are placed per seed at a mirrored depth from the map center (40–50m, so each sits the identical distance from its own rim — the known depot asymmetry closes by construction) with independent side-to-side positions, never the same way twice. Their v-separation is ≥80m by construction, so spacing needs no luck. The objective, roads, terrain mound, seeded cover, territory flags, connectivity checks, and the save all follow the drawn positions. The acceptance predicate grows with the randomness; the retry loop widens.

**Feel changes that ship for the owner's eyes:** no two seeds share a skeleton anymore — band count, pass count, road count (including roadless fronts), spawn count, and both depot positions all vary; the two depots always sit equally deep in their own ground.

**Suggested model:** Sonnet — the generation code is specified verbatim below; the agent executes.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/DepotGame.jsx` — 30–52 (frame constants), 53–190 (genMap/makeMap — the whole region this task replaces), 192–274 (buildDepotTerrain), 430–515 (townFootprint/buildTown, read-only), 1078–1153 (trees + seeded bags), 1236–1246 (camera focus reads TOWN, read-only).
- `src/depot/save.js` — 9–36 (the three laws; the map regrows from seed — no edits).
- `src/depot/units.js` — 479–560 (flow-field march; read-only, confirms no depot-position dependency).
- `scripts/depot-test.mjs` — 2407–2535 (FRONT F1 block — two re-pins land here), 5340–5480 (FRONT T1 block + tail; the new T2 block lands before the summary).
- `src/version.js`.

**Trap notes:**
- genMap runs on its OWN seeded stream — draw counts there may change freely; the draw-count law binds only `world.rng`. `depot-lint` still forbids `Math.random`.
- The march needs no edits: enemies follow the flow field to `OBJ_POS`; tanks/riflemen/grenadiers target by the shared hostile-structure set. Confirm by reading, change nothing in `units.js`.
- The save regrows the map from `MAP_SEED` — the new generation is deterministic per seed, so resume needs no edits. The mark bump (mk1.01) burns old saves by itself.
- The seeded depot sandbags, camera opening focus, territory flag emitters, and audio reflectors all read `TOWN` — they follow the wandering depots automatically. Verify, do not edit.
- `SPAWN_U` is stored but has no live consumer (the old anchor emitters died in F1) — keep the field, spend no effort on it.
- EXPECTED RE-PINS, exactly three (report each old→new): (1) the F1 depot2-at-(0,−46) assert becomes the evened-depth pin; (2) the two hardcoded door points `fwdUFor(..., 0, -51)` (test lines 2519 and 5411) become derived from the returned depot2 position; (3) FRONT T1's spawn-spread pin (`span > 60`) becomes `span > 34` — a legal 2-spawn seed spans as little as 35m (centers ±22.5m, jitter ±5). Any OTHER old assert moving is a defect: STOP and report.
- The F1 sweep's clearance asserts must keep passing on the wilder geometry — a sweep failure is a STOP-and-report, not a re-pin.
- Smoke runs on a pinned seed and polls its ground through the live hooks (`__DEPOTFINDBUILDABLE__`, `__DEPOTSCREENAT__`) — it should absorb the moved depot. A smoke failure is a STOP-and-report.
- `benches` can degenerate when the last band sits close to the depot ground — the existing `Math.max(2, ...)` in the bench draw already guards it; keep it.

## Steps, in execution order

**Step 1 — failing asserts first.** Three test edits, then `npm run test:depot`: the two re-pins and most of the new T2 block go red (current generation is fixed-shape); the spacing and connectivity sub-asserts may already pass — record exactly which.

(1a) Re-pin F1/1a (line 2445) — the fixed position becomes the evening law. Insert a `depot1` lookup beside the existing `depot2` one and replace the assert:
```js
  const depot1 = st.TOWN.find((t) => t.id === "depot");
  {
    const c1 = depot1 ? invWFor(st.ORIENT, depot1.x, depot1.z) : { u: 9e9, v: 9e9 };
    const c2 = depot2 ? invWFor(st.ORIENT, depot2.x, depot2.z) : { u: 9e9, v: 9e9 };
    ok("F1/1a (re-pinned mk1.01): the depots are EVENED — mirrored depth, 40-50m from center",
      Math.abs(c1.v + c2.v) < 0.01 && c1.v >= 40 && c1.v <= 50.01, `v1=${c1.v} v2=${c2.v}`);
```
(the 9×7×6 template pin below it stays byte-identical).

(1b) Re-pin the two hardcoded door points. Line 2519:
```js
      const c2s = invWFor(sti.ORIENT, d2.x, d2.z);
      const doorW = fwdUFor(sti.ORIENT, c2s.u, c2s.v - 5); // 5m behind depot2's own center — derived, not owed
```
Line 5411 (FRONT T1 block), same shape:
```js
    const d2t = st.TOWN.find((t) => t.id === "depot2");
    const c2t = invWFor(st.ORIENT, d2t.x, d2t.z);
    const dw = fwdUFor(st.ORIENT, c2t.u, c2t.v - 5);
```

(1b-2) Re-pin FRONT T1's spawn-spread assert (the wilder map legally draws 2 spawns; minimum legal span is 35m):
```js
    ok("FRONT T1 (re-pinned mk1.01): the spawn line spreads across the square (span > 34m at the 2-spawn minimum)", spawnSpread === 10, `${spawnSpread}/10`);
```
with the collector line above it re-pinned to `if (Math.max(...us) - Math.min(...us) > 34) spawnSpread++;`

(1c) Insert the FRONT-T2 block before the final failure summary (after the FRONT T1 block). It copies the T1 extraction pattern (own scoped `sliceFn`/extractor, returning `{ ORIENT, OBJ_POS, SPAWN_POINTS, ROCKS, PONDS, TOWN, ROADS, BANDS, MAP_SEED }` — note ROADS/BANDS/PONDS join the returned state) and asserts, over 40 seeds (`s * 613`):
```js
  const roadCounts = new Set(), bandCounts = new Set(), spawnCounts = new Set();
  let evened = 0, spaced = 0, clear = 0; const u1s = [];
  for (let s = 1; s <= 40; s++) {
    const Mi = mkMapT2(); Mi.makeMap(s * 613);
    const st = Mi.state();
    roadCounts.add(st.ROADS.length); bandCounts.add(st.BANDS.length); spawnCounts.add(st.SPAWN_POINTS.length);
    const d1 = st.TOWN.find((t) => t.id === "depot"), d2 = st.TOWN.find((t) => t.id === "depot2");
    const c1 = invWFor(st.ORIENT, d1.x, d1.z), c2 = invWFor(st.ORIENT, d2.x, d2.z);
    if (Math.abs(c1.v + c2.v) < 0.01 && c1.v >= 40 && c1.v <= 50.01) evened++;
    if (Math.hypot(d1.x - d2.x, d1.z - d2.z) >= 70) spaced++;
    u1s.push(c1.u);
    const depotClear = (d) =>
      !st.PONDS.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + Math.hypot(9, 7) * MASON.pitch / 2) &&
      !st.ROCKS.some((k) => Math.hypot(d.x - k.x, d.z - k.z) < 12);
    if (depotClear(d1) && depotClear(d2)) clear++;
  }
  ok("T2: road count varies — at least 3 distinct values in 0-3 across 40 seeds", roadCounts.size >= 3, [...roadCounts].join(","));
  ok("T2: band count varies within 2-4", bandCounts.size >= 2 && Math.min(...bandCounts) >= 2 && Math.max(...bandCounts) <= 4, [...bandCounts].join(","));
  ok("T2: spawn count varies within 2-4", spawnCounts.size >= 2 && Math.min(...spawnCounts) >= 2 && Math.max(...spawnCounts) <= 4, [...spawnCounts].join(","));
  ok("T2: every seed's depots are EVENED (mirrored depth, 40-50m)", evened === 40, `${evened}/40`);
  ok("T2: every seed's depots sit >= 70m apart", spaced === 40, `${spaced}/40`);
  ok("T2: the player depot wanders side to side (u spread > 30m over 40 seeds)", Math.max(...u1s) - Math.min(...u1s) > 30, (Math.max(...u1s) - Math.min(...u1s)).toFixed(1));
  ok("T2: both depots clear of ponds and rocks on every seed", clear === 40, `${clear}/40`);
  // determinism: the wilder map is still a pure function of its seed
  {
    const A = mkMapT2(); A.makeMap(7717);
    const B = mkMapT2(); B.makeMap(7717);
    ok("T2: twin determinism — same seed, identical town/roads/bands",
      JSON.stringify([A.state().TOWN, A.state().ROADS, A.state().BANDS]) === JSON.stringify([B.state().TOWN, B.state().ROADS, B.state().BANDS]));
  }
```
(Connectivity both ways stays covered by the F1 sweep and the FRONT T1 sweep, which run the live generation — no duplicate here.)

**Step 2 — genMap, replaced whole.** `src/depot/DepotGame.jsx` — replace the entire `genMap` function (lines 53–158) with the following. Everything not commented as new keeps today's logic verbatim; the sections are reordered only where the depots must be drawn first.
```js
function genMap(seed) {
  const r = mulberry32(seed);
  // THE DEPOTS FIRST (T2, mk1.01): both drawn per seed at MIRRORED DEPTH —
  // the same distance from their own rim by construction, which closes the
  // old placement asymmetry (record: player 8m from rim, enemy 14). Their
  // side-to-side positions are independent, so no two wars share a front.
  // v-separation is >= 80m by construction; spacing needs no retry luck.
  const depotDepth = 40 + r() * 10;      // provisional (F5)
  const depotU1 = (r() - 0.5) * 70;      // the player's depot, canonical u
  const depotU2 = (r() - 0.5) * 70;      // the enemy's
  const objU = depotU1, objV = depotDepth - 3; // the objective sits 3m field-side of the player depot
  // THE BANDS (T2): 2-4 rock bands, evenly seeded across the middle ground,
  // each jittered — the fixed three-band skeleton is gone.
  const nBands = 2 + Math.floor(r() * 3);
  const bands = [];
  for (let i = 0; i < nBands; i++) bands.push(-28 + (i + 0.5) * (58 / nBands) + (r() - 0.5) * 10);
  // THE PASSES (T2): 1-3 gaps per band, drawn anywhere across the width.
  const passes = bands.map((z) => {
    const n = 1 + Math.floor(r() * 3);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: -50 + r() * 100, z });
    return out;
  });
  const rocks = [];
  for (let bi = 0; bi < bands.length; bi++) {
    const density = 0.35 + r() * 0.65;
    for (let x = -55; x <= 55; x += 5.5 + r() * 3) {
      if (r() > density) continue;
      const z = bands[bi] + (r() - 0.5) * 2.5;
      if (passes[bi].some((g) => Math.abs(x - g.x) < 6.5)) continue;
      // T2: a wandering depot can meet a band — rocks keep 12m off both
      if (Math.hypot(x - depotU1, z - depotDepth) < 12 || Math.hypot(x - depotU2, z + depotDepth) < 12) continue;
      rocks.push({ x, z, r: 3.4 + r() * 1.2, h: 3.0 + r() * 0.9 });
    }
  }
  // THE SPAWNS (T2): 2-4, spread across the enemy edge with jitter.
  const nSpawn = 2 + Math.floor(r() * 3);
  const spawns = [];
  for (let i = 0; i < nSpawn; i++) spawns.push({ x: -45 + (i + 0.5) * (90 / nSpawn) + (r() - 0.5) * 10, z: GRID_OZ + 2 });
  // THE ROADS (T2): 0-3 — a front owes nobody a road. Each drawn road runs
  // spawn -> one pass per band -> the objective. Roads are terrain and looks;
  // the march runs the flow field either way.
  const nRoads = Math.floor(r() * 4);
  const roads = [];
  for (let ri = 0; ri < nRoads; ri++) {
    const pts = [[spawns[ri % spawns.length].x, GRID_OZ + 2]];
    for (const band of passes) { const g = band[Math.floor(r() * band.length)]; pts.push([g.x, g.z]); }
    pts.push([objU, objV]);
    roads.push(pts);
  }
  const roadDist = (x, z) => {
    let best = 1e9;
    for (const route of roads) for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b2 = route[i + 1];
      const dx = b2[0] - a[0], dz = b2[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return best;
  };
  const ponds = [];
  const nP = 1 + Math.floor(r() * 4);
  for (let i = 0; i < 30 && ponds.length < nP; i++) {
    const x = -50 + r() * 100, z = -12 + r() * 48, rad = 5.5 + r() * 2.5;
    if (passes.flat().some((g) => Math.abs(x - g.x) < 9 && Math.abs(z - g.z) < 14)) continue;
    if (roadDist(x, z) < rad + 6) continue;
    // T2: clear of BOTH depots (the old check knew one fixed objective)
    if (Math.hypot(x - depotU1, z - depotDepth) < 16 || Math.hypot(x - depotU2, z + depotDepth) < 16) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 6)) continue;
    ponds.push({ x, z, r: rad, level: 0 });
  }
  const TPL = [
    { t: "croft", nx: 4, nz: 3, ny: 3 }, { t: "house", nx: 6, nz: 5, ny: 4 },
    { t: "house", nx: 5, nz: 4, ny: 4 }, { t: "long", nx: 8, nz: 4, ny: 3 },
    { t: "watch", nx: 2, nz: 2, ny: 8 }, { t: "granary", nx: 3, nz: 3, ny: 7 },
    { t: "yard", nx: 6, nz: 5, ny: 2, roof: false }, { t: "shed", nx: 4, nz: 4, ny: 3 },
    { t: "chapel", nx: 5, nz: 6, ny: 5 }, { t: "keep", nx: 7, nz: 6, ny: 5 },
  ];
  // T2: both depots at their DRAWN positions — same lattice, same template.
  const town = [
    { id: "depot", x: depotU1, z: depotDepth, nx: 9, nz: 7, ny: 6, door: 4, depot: true },
    { id: "depot2", x: depotU2, z: -depotDepth, nx: 9, nz: 7, ny: 6, door: 4, depot: true, team: 2 },
  ];
  // T2: BOTH depots run the foul check the enemy's alone used to run —
  // except the ROAD clause, which checks depot2 only (AMENDMENT 2): every
  // drawn road terminates AT the player depot by design (its own supply
  // road), so road proximity is a foul for the enemy's ground alone.
  const dHalfDiag = Math.hypot(9, 7) * MASON.pitch / 2;
  const dFoul = (d, roadChecked) =>
    (roadChecked && roadDist(d.x, d.z) <= dHalfDiag + 2) ||
    spawns.some((sp) => Math.hypot(d.x - sp.x, d.z - sp.z) < dHalfDiag + 2) ||
    ponds.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + dHalfDiag) ||
    rocks.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + dHalfDiag);
  const depotFoul = dFoul(town[0], false) || dFoul(town[1], true);
  // T2: benches between consecutive bands, plus the last band to depot ground.
  const benches = [];
  for (let i = 0; i + 1 < bands.length; i++) benches.push([bands[i] + 8, bands[i + 1] - 7]);
  benches.push([bands[bands.length - 1] + 8, depotDepth - 8]);
  let bid = 0;
  for (let bi = 0; bi < benches.length; bi++) {
    const want = 2 + Math.floor(r() * 4);
    for (let k = 0, placed = 0; k < 90 && placed < want; k++) {
      const tpl = TPL[Math.floor(r() * TPL.length)];
      const swap = r() < 0.5;
      const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
      const x = -52 + r() * 104;
      const z = benches[bi][0] + r() * Math.max(2, benches[bi][1] - benches[bi][0]);
      const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
      if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
      if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
      if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
      if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) continue;
      const decay = r() < 0.2 ? 0.12 + r() * 0.3 : 0;
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, ruin: decay || undefined });
      placed++;
    }
  }
  const nRuin = Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 14 && placed < nRuin; k++) {
    const x = -50 + r() * 100, z = -depotDepth + r() * 20;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < 10)) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < 10)) continue;
    town.push({ id: "oldruin" + placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, ruin: 0.5 });
    placed++;
  }
  const T = (o) => { const w = fwdU(o.x, o.z); o.x = w.x; o.z = w.z; return o; };
  for (const k of rocks) T(k);
  for (const q of ponds) T(q);
  for (const t of town) { T(t); if (ORIENT % 2) { const nx0 = t.nx; t.nx = t.nz; t.nz = nx0; t.door = Math.min(t.door, t.nx - 1); } }
  const spawnU = spawns.map((sp) => sp.x);
  for (const sp of spawns) T(sp);
  for (const band of passes) for (const g of band) T(g);
  for (const route of roads) for (const pt of route) { const w = fwdU(pt[0], pt[1]); pt[0] = w.x; pt[1] = w.z; }
  return { seed, bands, passes, rocks, ponds, spawns, spawnU, town, roads, depotFoul, objU, objV, depotU1, depotU2, depotDepth };
}
```

**Step 3 — makeMap follows the drawn depot.** Replace `makeMap` (now directly after genMap) with:
```js
function makeMap(seed) {
  for (let attempt = 0; attempt < 24; attempt++) {   // T2: wilder maps foul more — a deeper retry pocket
    const sd = seed + attempt * 7919;
    ORIENT = sd % 4;
    const m = genMap(sd);
    OBJ_POS = fwdU(m.objU, m.objV);                  // T2: the objective follows the DRAWN depot, set after genMap
    MAP_SEED = sd; BANDS = m.bands; PASSES = m.passes; ROCKS = m.rocks;
    PONDS = m.ponds; SPAWN_POINTS = m.spawns; TOWN = m.town; ROADS = m.roads;
    SPAWN_U = m.spawnU;
    const g = makeGrid(null);
    for (const t of TOWN) {
      const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
      for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
        const wp = g.gridToWorld(gx, gz);
        if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
          if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
          g.cells[g.idx(gx, gz)].blocked = true;
        }
      }
    }
    const og = g.worldToGrid(OBJ_POS.x, OBJ_POS.z);
    // T2: the enemy doorway derives from the DRAWN depot2 — 5m behind its center.
    const d2door = fwdU(m.depotU2, -m.depotDepth - 5);
    const dg = g.worldToGrid(d2door.x, d2door.z);
    // T2: the grown predicate — town minimum, no depot foul, explicit spacing
    // (guaranteed by construction, asserted anyway), both connectivities.
    if (TOWN.length >= 6 && !m.depotFoul &&
        Math.hypot(m.depotU1 - m.depotU2, 2 * m.depotDepth) >= 70 &&
        checkConnectivity(g, SPAWN_POINTS, og.gx, og.gz) &&
        checkConnectivity(g, SPAWN_POINTS, dg.gx, dg.gz)) return;
  }
}
```
Also delete the now-dead pre-genMap `OBJ_POS = fwdU(0, 49);` line (it moved after genMap) and correct the F1-era comments above `town` in genMap's old body (they described canonical (0, −46) — gone with the replacement).

**Step 4 — the terrain follows.** `buildDepotTerrain`:

(4a) The band lift generalizes to any band count (line 204):
```js
    let y = 2.0
      + Math.sin(x * 0.075 + 1.3) * 0.42
      + Math.cos(z * 0.061 - 0.6) * 0.38
      + Math.sin((x + z) * 0.032) * 0.30
      + (r() - 0.5) * 0.06;
    for (let bi = 0; bi < BANDS.length; bi++) y += stepUp(BANDS[bi] - 1, 10, 1.8 + 0.2 * (bi % 3));
```
(`stepUp` reads `cuv.v` via the closure exactly as before; only the fixed three-term sum dies.)

(4b) Both depots get the same raised pad — the town flatten loop (lines 221–230) gains a depot lift, and the OBJ-specific mound block (lines 231–239, `if (d < 9)`) is DELETED:
```js
  for (const t of TOWN) {
    const rad = Math.hypot(t.nx, t.nz) * MASON.pitch / 2 + (t.depot ? 4.0 : 2.0);
    const ph = h[Math.round((t.z + half) / cs) * n + Math.round((t.x + half) / cs)] + (t.depot ? 0.5 : 0);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d >= rad) continue;
      h[j * n + i] += (ph - h[j * n + i]) * Math.min(1, (rad - d) / 1.8);
    }
  }
```
The old mound's fixed height (the sum of all three band lifts + 0.5) assumed the player depot stood beyond every band; a wandering depot takes local ground + 0.5 instead — evened, both sides.

**Step 5 — trees respect the wandering depots.** In the mount effect: the treeline loop (line 1084) and the clump inner loop (line 1093-ish) each gain one rejection beside their existing ones:
```js
          if (TOWN.some((t) => t.depot && Math.hypot(w.x - t.x, w.z - t.z) < 10)) continue;
```
(clump version tests `jx, jz` instead of `w.x, w.z`).

**Step 6 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (the two named re-pins, nothing else moved) · `src/version.js` → `"mk1.01"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke` (start the preview server as Task 1's run did).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; two named re-pins reported old→new) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the wilder map: depots wander evened, roads drawn not owed (mk1.01)"`, push, CI green, STOP. The owner checks the deployed site live across several `?seed=` values: varying band/road/spawn counts, roadless seeds, the depots off the center line and equally deep on both sides.

## AMENDMENT 2 (2026-08-13) — a depot's own road is not a foul

*Found in execution: Step 2's foul check ran the ROAD clause on both depots while every drawn road terminates 3m from the player depot's center — inside its own ~6.7m foul radius. Every seed with a road was therefore rejected, and all accepted maps came out roadless (the T2 road-variance assert caught it: `roadCounts = {0}` across 40 seeds). The fix follows the fiction: a supply road is supposed to reach the player's depot. The road-proximity clause now checks the ENEMY depot only; spawns, ponds, and rocks still check both. The Step 2 genMap block above is corrected in place (`dFoul(d, roadChecked)`); no other step changes.*

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
