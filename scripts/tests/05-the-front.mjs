import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid } from "./shared.mjs";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { makeWorld, makeField, addBody, addWeld, fireProjectile, stepWorld, worldHash, mulberry32 } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { makeSquad, stepSquad, slotBlockedPublic } from "../../src/depot/squads.js";
import { makeTerritory } from "../../src/depot/territory.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import fs from "node:fs";

// ==== FRONT T1: the square frame ============================================
// mk1.00 (The Front, Task 1). The field is a 120x120 SQUARE: rim 60/60 as the
// one source, stray falloff/territory literals dead, the splat grid pitch
// field-derived under the depot's rim option, generation stretched to fill.
{
  console.log("\n[front t1: the square frame]");
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: RIM_HALF_U/GRID_CS/the falloff line moved to mapgen.js.
  const mgSrcT1pin = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  ok("FRONT T1: the rim is 90x90 (the square)", /const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(mgSrcT1pin));
  ok("FRONT T1 (re-pinned mk1.02, Amendment 3): the flow grid is 90x90 — the grid covers the full rim",
    /const GRID_CS = 2\.0, GRID_W = 90, GRID_H = 90;/.test(mgSrcT1pin));
  ok("FRONT T1: the terrain falloff reads the rim constants, not literals",
    /Math\.abs\(cuv\.u\) - RIM_HALF_U, Math\.abs\(cuv\.v\) - RIM_HALF_V/.test(mgSrcT1pin));
  ok("FRONT T1: territory is built from the rim constants",
    /makeTerritory\(RIM_HALF_U, RIM_HALF_V\)/.test(src));
  ok("FRONT T1: camera pan extents are square", /const EXT = \{ x: 95, z: 95 \};/.test(src));
  const rsrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("FRONT T1: the splat grid span derives from the field under the rim option (188.7 fallback kept)",
    /opts\.rim \? Wd : null/.test(rsrc) && /span \|\| 188\.7/.test(rsrc));

  // functional: the LIVE genMap fills the square. Same extraction machinery
  // as the FRONT F1 block above (sliceFn over the real source), fresh copy
  // here because that block's helpers are scoped to it.
  // P7 T18: sliceFn2 checks DepotGame.jsx first (unmoved names), then
  // mapgen.js (moved names, stripping the "export " prefix).
  const mgSrcT1 = mgSrcT1pin;
  const sliceFn2 = (name) => {
    let start = src.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = src.slice(start + 1); }
    else {
      start = mgSrcT1.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("T1 extract: missing function " + name);
      rest = mgSrcT1.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerT1 = mgSrcT1.slice(mgSrcT1.indexOf("const GRID_CS"), mgSrcT1.indexOf("function genMap")).replace(/^export /gm, "");
  const mapSrcT1 = [
    headerT1,
    sliceFn2("genMap"), sliceFn2("makeMap"), sliceFn2("streamAt"), sliceFn2("pondAt"), sliceFn2("rockAt"),
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
    if (Math.max(...us) - Math.min(...us) > 34) spawnSpread++;
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
    const d2t = st.TOWN.find((t) => t.id === "depot2");
    const c2t = invWFor(st.ORIENT, d2t.x, d2t.z);
    const dw = fwdUFor(st.ORIENT, c2t.u, c2t.v - 5);
    const dg = g.worldToGrid(dw.x, dw.z);
    if (Mi.checkConnectivity(g, st.SPAWN_POINTS, og.gx, og.gz) &&
        Mi.checkConnectivity(g, st.SPAWN_POINTS, dg.gx, dg.gz)) connected++;
  }
  ok("FRONT T1: the square fills — generated features beyond the old rim on every seed", wide === 10, `${wide}/10`);
  ok("FRONT T1 (re-pinned mk1.01): the spawn line spreads across the square (span > 34m at the 2-spawn minimum)", spawnSpread === 10, `${spawnSpread}/10`);
  ok("FRONT T1: spawns reach the objective AND the enemy depot's door on every seed", connected === 10, `${connected}/10`);
}
// ==== end FRONT T1 ===========================================================

// ==== FRONT T2: the wilder map ===============================================
// mk1.01 (The Front, Task 2). Map generation stops being three fixed bands,
// two owed roads, and two depots nailed to the center line — every seed now
// draws band/pass/spawn/road counts and both depot positions, evened at a
// mirrored depth. Same extraction machinery as FRONT T1's block, a fresh copy
// scoped here, with ROADS/BANDS/PONDS joining the returned state.
{
  console.log("\n[front t2: the wilder map]");
  const srcT2 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: sliceFn3 checks DepotGame.jsx first, then mapgen.js for moved names.
  const mgSrcT2 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  const sliceFn3 = (name) => {
    let start = srcT2.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = srcT2.slice(start + 1); }
    else {
      start = mgSrcT2.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("T2 extract: missing function " + name);
      rest = mgSrcT2.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerT2 = mgSrcT2.slice(mgSrcT2.indexOf("const GRID_CS"), mgSrcT2.indexOf("function genMap")).replace(/^export /gm, "");
  const mapSrcT2 = [
    headerT2,
    sliceFn3("genMap"), sliceFn3("makeMap"), sliceFn3("streamAt"), sliceFn3("pondAt"), sliceFn3("rockAt"),
    sliceFn3("makeGrid"), sliceFn3("checkConnectivity"), sliceFn3("townFootprint"), sliceFn3("buildTown"),
    `return { makeMap, makeGrid, checkConnectivity, invW,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, ROCKS, PONDS, TOWN, ROADS, BANDS, MAP_SEED }) };`,
  ].join("\n");
  const mkMapT2 = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrcT2,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

  const roadCounts = new Set(), bandCounts = new Set(), spawnCounts = new Set();
  let evened = 0, spaced = 0, clear = 0; const u1s = [];
  for (let s = 1; s <= 40; s++) {
    const Mi = mkMapT2(); Mi.makeMap(s * 613);
    const st = Mi.state();
    roadCounts.add(st.ROADS.length); bandCounts.add(st.BANDS.length); spawnCounts.add(st.SPAWN_POINTS.length);
    const d1 = st.TOWN.find((t) => t.id === "depot"), d2 = st.TOWN.find((t) => t.id === "depot2");
    const c1 = invWFor(st.ORIENT, d1.x, d1.z), c2 = invWFor(st.ORIENT, d2.x, d2.z);
    if (Math.abs(c1.v + c2.v) < 0.01 && c1.v >= 66 && c1.v <= 78.01) evened++;
    if (Math.hypot(d1.x - d2.x, d1.z - d2.z) >= 70) spaced++;
    u1s.push(c1.u);
    const depotClear = (d) =>
      !st.PONDS.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + Math.hypot(12, 9) * MASON.pitch / 2) && // re-pinned mk1.32 (P7 T3): depot grown 9x7 -> 12x9
      !st.ROCKS.some((k) => Math.hypot(d.x - k.x, d.z - k.z) < 12);
    if (depotClear(d1) && depotClear(d2)) clear++;
  }
  ok("T2: road count varies — at least 3 distinct values in 0-3 across 40 seeds", roadCounts.size >= 3, [...roadCounts].join(","));
  ok("T2: band count varies within 2-4", bandCounts.size >= 2 && Math.min(...bandCounts) >= 2 && Math.max(...bandCounts) <= 4, [...bandCounts].join(","));
  ok("T2: spawn count varies within 2-4", spawnCounts.size >= 2 && Math.min(...spawnCounts) >= 2 && Math.max(...spawnCounts) <= 4, [...spawnCounts].join(","));
  ok("T2 (re-pinned mk1.45, P7 T15): every seed's depots are EVENED (mirrored depth, 66-78m)", evened === 40, `${evened}/40`);
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
}
// ==== end FRONT T2 ===========================================================

// ==== FRONT T3: the water, switched off =====================================
// mk1.02 (The Front, Task 3) drew one stream per map; mk1.94 (owner) switches
// it off — the water made too many impassable places. The generator draws no
// stream on any seed and the grid carries no water cell. The water machinery
// (grid blocking, slot refusals, order toasts, ribbons) stays, dormant and
// pinned below, for the day it returns.
{
  console.log("\n[front t3: the stream and the causeway]");
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // extraction: the T1/T2 pattern, plus streamAt and the STREAM module state.
  // P7 T18: sliceFn3 checks DepotGame.jsx first, then mapgen.js for moved names.
  const mgSrcT3 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  let M3ok = true, mkMapT3 = null;
  try {
    const sliceFn3 = (name) => {
      let start = src.indexOf(`\nfunction ${name}(`), rest;
      if (start >= 0) { rest = src.slice(start + 1); }
      else {
        start = mgSrcT3.indexOf(`\nexport function ${name}(`);
        if (start < 0) throw new Error("T3 extract: missing function " + name);
        rest = mgSrcT3.slice(start + 1).replace(/^export /, "");
      }
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const header3 = mgSrcT3.slice(mgSrcT3.indexOf("const GRID_CS"), mgSrcT3.indexOf("function genMap")).replace(/^export /gm, "");
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
    // (a) STREAM OFF (mk1.94, owner): no seed draws a stream; no grid cell
    // carries water. Same 20 seeds the old stream sweep rode.
    let drawn = 0, waterCells = 0;
    for (let s = 1; s <= 20; s++) {
      const Mi = mkMapT3(); Mi.makeMap(s * 331);
      const st = Mi.state();
      if (st.STREAM) drawn++;
      const g = Mi.makeGrid(null);
      for (const c of g.cells) if (c.water) waterCells++;
    }
    ok("T3(a): the stream is off — no seed draws one", drawn === 0, `${drawn}/20 drawn`);
    ok("T3(a): no grid cell carries water on any seed", waterCells === 0, `${waterCells} water cells`);
    ok("T3(a): the off-switch exists and is off", /export const STREAM_ON = false;/.test(mgSrcT3));
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
  const rsrc3 = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("T3(g): setDressing builds water ribbons when streams are supplied",
    /spec\.streams \|\| \[\]/.test(rsrc3));
  const sqsrc3 = fs.readFileSync(new URL("../../src/depot/squads.js", import.meta.url), "utf8");
  ok("T3(g): slotBlocked's water line exists in squads.js",
    /world\.streamAt && world\.streamAt\(x, z\)/.test(sqsrc3));
}
// ==== end FRONT T3 ===========================================================

// ==== FRONT T4: buildings of the proving grounds =============================
// mk1.03 (The Front, Task 4). The town builder learns the proven forms:
// slab-roof drive-through hangars, columned warehouses, columns in the wide
// templates, freestanding field walls that block the grid. The chunk pool
// rises to 3000; the boot stone count is measured right here.
{
  console.log("\n[front t4: buildings of the proving grounds]");
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: sliceFn4 checks DepotGame.jsx first, then mapgen.js for moved names.
  const mgSrcT4 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  const sliceFn4 = (name) => {
    let start = src.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = src.slice(start + 1); }
    else {
      start = mgSrcT4.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("T4 extract: missing function " + name);
      rest = mgSrcT4.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const header4 = mgSrcT4.slice(mgSrcT4.indexOf("const GRID_CS"), mgSrcT4.indexOf("function genMap")).replace(/^export /gm, "");
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
    (mgSrcT4.match(/cols: true/g) || []).length === 5);
  ok("T4(g): the drive doors bind to the long axis by live dimensions",
    /const driveZ = t\.drive && t\.nz >= t\.nx;/.test(src));
  ok("T4(g): the town debug hook exists", /__DEPOTTOWN__/.test(src));
  const rsrc4 = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("T4(g): the chunk pool is raised to 4000 (re-taught mk2.61, owner 2026-08-26)", /const CHUNK_CAP = 4000;/.test(rsrc4));
}
// ==== end FRONT T4 ===========================================================

// ==== FRONT T5: copses, forests, and the high ground ========================
// mk1.04 (The Front, Task 5). Every seed draws 1-3 hills (always at least
// one), each carrying a copse; plus 2-5 copses and 0-2 forests anywhere.
// All planting lives in planTrees (pure, map-seed stream) so this block
// plans the exact trees the game plants. Tree pool 144 -> 360.
{
  console.log("\n[front t5: copses, forests, and the high ground]");
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: sliceFn5 checks DepotGame.jsx first, then mapgen.js for moved names.
  const mgSrcT5 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  let M5ok = true, mkMapT5 = null;
  try {
    const sliceFn5 = (name) => {
      let start = src.indexOf(`\nfunction ${name}(`), rest;
      if (start >= 0) { rest = src.slice(start + 1); }
      else {
        start = mgSrcT5.indexOf(`\nexport function ${name}(`);
        if (start < 0) throw new Error("T5 extract: missing function " + name);
        rest = mgSrcT5.slice(start + 1).replace(/^export /, "");
      }
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const header5 = mgSrcT5.slice(mgSrcT5.indexOf("const GRID_CS"), mgSrcT5.indexOf("function genMap")).replace(/^export /gm, "");
    if (!/let HILLS = \[\];/.test(header5)) throw new Error("T5: HILLS state not in header");
    const mapSrc5 = [
      header5,
      sliceFn5("genMap"), sliceFn5("makeMap"), sliceFn5("streamAt"), sliceFn5("planTrees"),
      sliceFn5("pondAt"), sliceFn5("rockAt"),
      sliceFn5("makeGrid"), sliceFn5("checkConnectivity"), sliceFn5("townFootprint"), sliceFn5("buildTown"),
      sliceFn5("buildDepotTerrain"),
      `return { makeMap, makeGrid, buildDepotTerrain, planTrees, streamAt, pondAt, rockAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, ROADS, PONDS, ROCKS, SPAWN_POINTS, STREAM, HILLS, MAP_SEED }) };`,
    ].join("\n");
    mkMapT5 = () => new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc5,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  } catch (e) { M5ok = false; }
  ok("T5: the map module extracts with HILLS state and planTrees", M5ok);

  if (M5ok) {
    // (a) the sweep: hills and trees inside their ruled bounds on every seed
    let hillLo = 99, hillHi = 0, hillShape = 0, nHillsTotal = 0;
    let treeLo = 9999, treeHi = 0, treeFoul = 0, woodedHills = 0, worstTreeSeed = 0;
    for (let s = 1; s <= 40; s++) {
      const Mi = mkMapT5(); Mi.makeMap(s * 907);
      const st = Mi.state();
      hillLo = Math.min(hillLo, st.HILLS.length); hillHi = Math.max(hillHi, st.HILLS.length);
      nHillsTotal += st.HILLS.length;
      for (const hb of st.HILLS) {
        if (hb.h >= 3 && hb.h <= 5.01 && hb.r >= 10 && hb.r <= 15.01) hillShape++;
      }
      const plan = Mi.planTrees();
      if (plan.length > treeHi) { treeHi = plan.length; worstTreeSeed = s * 907; }
      treeLo = Math.min(treeLo, plan.length);
      for (const p of plan) {
        const c = Mi.invW(p.x, p.z);
        const onBuilding = st.TOWN.some((t) =>
          Math.abs(p.x - t.x) < (t.nx * MASON.pitch) / 2 + 1.4 &&
          Math.abs(p.z - t.z) < (t.nz * MASON.pitch) / 2 + 1.4);
        if (Mi.rockAt(p.x, p.z) || Mi.pondAt(p.x, p.z) || Mi.streamAt(p.x, p.z) ||
            onBuilding || Math.abs(c.u) > 88.01 || Math.abs(c.v) > 88.01) treeFoul++;
      }
      for (const hb of st.HILLS) {
        const hw = Mi.fwdU(hb.u, hb.v);
        const near = plan.filter((p) => Math.hypot(p.x - hw.x, p.z - hw.z) < hb.r * 1.6).length;
        if (near >= 3) woodedHills++;
      }
    }
    ok("T5(a): every seed draws 1-3 hills, never zero", hillLo >= 1 && hillHi <= 3, `${hillLo}-${hillHi}`);
    ok("T5(a): every hill is demo-sized (h 3-5, r 10-15)", hillShape === nHillsTotal, `${hillShape}/${nHillsTotal}`);
    // (the hill-off-the-stream clearance retired with the stream, mk1.94)
    ok("T5(a): tree counts stay inside the budget (25-340 per seed)", treeLo >= 25 && treeHi <= 340, `${treeLo}-${treeHi} (worst seed ${worstTreeSeed})`);
    ok("T5(a): no planned tree stands in rock, water, a building, or off the rim", treeFoul === 0, `${treeFoul} fouls`);
    ok("T5(a): every hill is wooded (3+ trees on its flanks)", woodedHills === nHillsTotal, `${woodedHills}/${nHillsTotal}`);

    // (b) the terrain rises: a hill's summit stands proud of its surroundings
    {
      const Mi = mkMapT5(); Mi.makeMap(907);
      const st = Mi.state();
      const field = makeField(121, 2.0, st.MAP_SEED);
      Mi.buildDepotTerrain(field, st.MAP_SEED);
      const hb = st.HILLS[0];
      const hw = Mi.fwdU(hb.u, hb.v);
      const peak = field.heightAt(hw.x, hw.z);
      let ringMin = 1e9;
      for (let a = 0; a < 8; a++) {
        const rw = Mi.fwdU(hb.u + Math.cos(a * 0.785) * hb.r * 2.5, hb.v + Math.sin(a * 0.785) * hb.r * 2.5);
        const cu = Mi.invW(rw.x, rw.z);
        if (Math.abs(cu.u) > 58 || Math.abs(cu.v) > 58) continue; // ring points past the rim tell nothing
        ringMin = Math.min(ringMin, field.heightAt(rw.x, rw.z));
      }
      ok("T5(b): the hill stands proud of the ground around it (1.8m+)", peak - ringMin > 1.8, (peak - ringMin).toFixed(2));
    }

    // (c) determinism: same seed, identical hills and identical tree plan
    {
      const A = mkMapT5(); A.makeMap(7717);
      const B = mkMapT5(); B.makeMap(7717);
      ok("T5(c): twin determinism — identical HILLS and tree plan",
        JSON.stringify(A.state().HILLS) === JSON.stringify(B.state().HILLS) &&
        JSON.stringify(A.planTrees()) === JSON.stringify(B.planTrees()));
    }
  }

  // (d) source pins: the hooks exist where claimed
  ok("T5(d): buildDepotTerrain lifts the drawn hills", /hb\.h \* Math\.exp\(-dh\)/.test(mgSrcT5));
  ok("T5(d): the boot plants the plan and nothing else", /for \(const p of planTrees\(\)\) treeAt\(p\.x, p\.z\);/.test(src));
  const rsrc5 = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("T5(d): the tree pool is one constant at 360", /const TREE_CAP = 360;/.test(rsrc5));
  ok("T5(d): no bare 144 survives in the renderer (all six sites read TREE_CAP)", !/144/.test(rsrc5));
}
// ==== end FRONT T5 ===========================================================

// ==== FRONT T6: the keystone and the quiet books =============================
// mk1.05 (The Front, Task 6). The broadphase learns two tiers (sleeping and
// zero-mass bodies file once and stay filed); the physics must not move by
// one bit. This block pins a heavy real-map battle's exact world hash and
// draw count BEFORE the engine change — the change must reproduce both.
{
  console.log("\n[front t6: the keystone and the quiet books]");
  // re-pinned mk1.32 (P7 T3): genMap draws one more rng value up front now
  // (cornerSide) — every downstream draw (bands/rocks/spawns/roads/ponds/
  // hills/town) shifts for a fixed seed, so the keystone's whole map (and
  // thus the keystone battle it fights) is a different map. Recaptured off
  // this block's own printed console log.
  // re-pinned mk1.34 (P7 T5): both depots rebuild as column-and-panel
  // precast — a different body count/order in the same world.bodies array
  // this keystone hashes over, even though the fixture's own battle (a
  // non-depot building) never touches depot masonry. Recaptured off this
  // block's own printed console log.
  // re-pinned mk1.45 (P7 T15, Amendment 1): the square grew 120->180 —
  // the keystone's reshaped map sorts a DIFFERENT biggest non-depot building
  // (warehouse0 6x8, not hangar0 9x10), so the battle's own draw count
  // legitimately moves too (hash AND draws re-pin together, the T3/T5
  // precedent). Recaptured off this block's own printed console log.
  // re-pinned mk1.72 (P7.1 T8, owner-ratified): THE SEED PURGE — the old
  // special-cased seed leaves the suite; the keystone's anchor moves to
  // 1000, an ordinary seed with no special standing. Hash and draws
  // re-measured off this block's own printed console log.
  const T6_HASH = 879989108;   // was 2573479645 (re-captured mk2.51: THE URGENCY LAW — conscripts now engage the marching squad at full range, the stream moves)
  const T6_DRAWS = 572;  // was 470 (re-captured mk2.51: THE URGENCY LAW moves the stream)
  const src6 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: sliceFn6 checks DepotGame.jsx first, then mapgen.js for moved names.
  const mgSrc6 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  const sliceFn6 = (name) => {
    let start = src6.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = src6.slice(start + 1); }
    else {
      start = mgSrc6.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("T6 extract: missing function " + name);
      rest = mgSrc6.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const header6 = mgSrc6.slice(mgSrc6.indexOf("const GRID_CS"), mgSrc6.indexOf("function genMap")).replace(/^export /gm, "");
  const mapSrc6 = [
    header6,
    sliceFn6("genMap"), sliceFn6("makeMap"), sliceFn6("streamAt"), sliceFn6("planTrees"),
    sliceFn6("pondAt"), sliceFn6("rockAt"),
    sliceFn6("makeGrid"), sliceFn6("checkConnectivity"), sliceFn6("townFootprint"), sliceFn6("buildTown"),
    sliceFn6("buildDepotTerrain"),
    `return { makeMap, makeGrid, buildTown, buildDepotTerrain, invW, fwdU,
      state: () => ({ ORIENT, TOWN, MAP_SEED }) };`,
  ].join("\n");
  const M6 = new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc6,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

  M6.makeMap(1000);
  const st6 = M6.state();
  const field6 = makeField(181, 2.0, st6.MAP_SEED);
  M6.buildDepotTerrain(field6, st6.MAP_SEED);
  const world = makeWorld({ field: field6, seed: 1000 });
  world._tdStruct = true; world.depotCombat = true;
  M6.buildTown(world, M6.makeGrid(null), field6);
  let draws = 0; const raw6 = world.rng;
  world.rng = () => { draws++; return raw6(); };
  // the battle: a squad marching through town, eight conscripts on a straight
  // flow, six shells into the biggest building — collapse, contacts, corpses.
  const big6 = st6.TOWN.filter((t) => !t.depot).sort((a, b) => b.nx * b.nz - a.nx * a.nz)[0];
  const sq6 = makeSquad(1, "rifles", 1, big6.x - 20, big6.z);
  spawnSquadMembers(world, sq6);
  sq6.order = "move"; sq6.dest = { x: big6.x + 20, z: big6.z };
  for (let i = 0; i < 8; i++) spawnUnit(world, { x: big6.x - 24 + i * 2, z: big6.z - 18 }, "");
  for (let s = 0; s < 6; s++) {
    const from = { x: big6.x - 12, y: field6.heightAt(big6.x, big6.z) + 6, z: big6.z + (s - 2.5) * 1.2 };
    fireProjectile(world, from, { x: 0.86, y: -0.5, z: 0 }, 60,
      { kind: "shell", r: 3.2, kv: 12, dmg: 55, crater: 0.6, hitStruct: true, attacker: "player" });
  }
  for (let i = 0; i < 1200; i++) {
    stepSquad(world, sq6, 1 / 120);
    stepUnits(world, straightGrid(0, 1), identFwdDir, null, (x, z) => ({ u: x, v: z }));
    stepWorld(world);
  }
  const h6 = worldHash(world);
  console.log(`[t6 keystone] hash=${h6} draws=${draws}`);
  ok("T6: the keystone battle broke real welds (the fixture fights)", world.welds.filter((w) => w.broken).length > 20, `${world.welds.filter((w) => w.broken).length} broken`);
  ok("T6 KEYSTONE: world hash identical before and after the quiet books", h6 === T6_HASH, `${h6} vs pinned ${T6_HASH}`);
  ok("T6 KEYSTONE: draw count identical before and after", draws === T6_DRAWS, `${draws} vs pinned ${T6_DRAWS}`);
  // source pins: the two-tier books exist where claimed
  const csrc6 = fs.readFileSync(new URL("../../src/engine/core.js", import.meta.url), "utf8");
  ok("T6: the persistent tier exists in the engine", /the sleeping stone is already on the books/.test(csrc6));
  ok("T6: the unfile helper exists beside wake", /function unfileBody\(world, b\)/.test(csrc6));
}
// ==== end FRONT T6 ===========================================================

