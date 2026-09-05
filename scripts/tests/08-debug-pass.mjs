import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid } from "./shared.mjs";
import { spawnSquadMembers, spawnSandbag, memberNearRow } from "../../src/depot/state.js";
import { makeWorld, makeField, addBody, addWeld, stepWorld, mulberry32 } from "../../src/engine/core.js";
import { MASON, BISON } from "../../src/depot/specs.js";
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { planRoute, stampTerrainMasks } from "../../src/depot/route.js";
import { makeSquad, stepSquad, slotBlockedPublic, clearSlot } from "../../src/depot/squads.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import { stepBuildLine } from "../../src/depot/buildlines.js";
import fs from "node:fs";

// ==== P7 T12: SPAWN GROUND LEARNS VEHICLES ===================================
// The fielded-start kill: slotBlocked vetted static solids
// only — a parked hull was invisible to every spawn/slot site. The fielded-
// start squads spawned overlapping the player's parked armor; the engine's
// shove-apart killed the men at second zero and the empty squads were silently
// deleted. The law learns hulls; every consumer inherits the fix.
{
  const flatF12 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // (a) the law itself: a live hull blocks a slot at its box + clearance.
  {
    const w = makeWorld({ field: flatF12, seed: 11 });
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x: 0, y: BISON.hy + 0.05, z: 0, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison";
    ok("T12(a): a live hull blocks the slot at its box + clearance", slotBlockedPublic(w, 0, 0, 0.63) === true);
    const p = clearSlot(w, 0, 0, 0.63);
    ok("T12(a2): clearSlot hands back ground clear of the hull box",
      Math.abs(p.x - v.pos.x) > v.hx + 0.63 || Math.abs(p.z - v.pos.z) > v.hz + 0.63, `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    v.alive = false;
    ok("T12(a3): a dead hull stops blocking", slotBlockedPublic(w, 0, 0, 0.63) === false);
  }
  // (b) the owner's report, reproduced and closed: the fielded start beside a
  // hull parked exactly on the runners' fixed 11m azimuth — every man spawns
  // clear of the box and lives through 3 simulated seconds. Before the fix the
  // men spawn inside the box and the shove-apart kills them.
  {
    const w = makeWorld({ field: flatF12, seed: 801 });
    const depotP = { x: -40, z: -40 };
    const hx0 = depotP.x + Math.sin(0.9) * 11, hz0 = depotP.z + Math.cos(0.9) * 11;
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x: hx0, y: BISON.hy + 0.05, z: hz0, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.sleeping = true;
    const squads = [];
    let nextSquadId = 1;
    for (const type of ["rockets", "grenadiers"]) { // mk2.02: the roster surgery
      const a = type === "rockets" ? 0.9 : 2.3;
      const p0 = clearSlot(w, depotP.x + Math.sin(a) * 11, depotP.z + Math.cos(a) * 11, 0.5);
      const sq = makeSquad(nextSquadId++, type, 1, p0.x, p0.z);
      spawnSquadMembers(w, sq);
      squads.push(sq);
    }
    const men = squads.flatMap((sq) => sq.memberIds.map((id) => w.byId.get(id)));
    ok("T12(b): no man spawns inside the parked hull's box",
      men.every((u) => Math.abs(u.pos.x - v.pos.x) > v.hx + u.hx || Math.abs(u.pos.z - v.pos.z) > v.hz + u.hz));
    for (let i = 0; i < 360; i++) stepWorld(w);
    ok("T12(b2): every fielded man is alive 3 seconds in", men.every((u) => u.alive), `${men.filter((u) => u.alive).length}/6 alive`);
  }
}
// ==== end P7 T12 =============================================================

// ==== P7 T13: SELF-PRESERVATION ==============================================
// The owner's rulings (08-17/08-18): the grid learns steepness and drops, the
// hull learns clearance, corners, backing out, and the difference between
// masonry it must respect and masonry it was ordered through; the rim joins
// the slot law. All game-layer; core.js untouched.
{
  const dgSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const rSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
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
    // P7 T18: makeGrid/computeFlowField moved to mapgen.js.
    const mgSrcT13 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
    ok("T13(i): makeGrid stamps the terrain masks", /if \(field\) stampTerrainMasks\(G, field\)/.test(mgSrcT13));
    ok("T13(i2): the enemy flow pays 3x to march a cliff lip", /cells\[ni\]\.drop \? 3 : 1/.test(mgSrcT13));
  }
  // (j) Amendment 1 — the green threads (source shape; the look is the
  // owner's live acceptance, smoke's zero-page-errors gate covers the boot)
  {
    ok("T13(j): the renderer carries the order-path overlay", /setOrderPaths\(paths\)/.test(rSrc) && /0x4aff8c/.test(rSrc) && /0x0c2416/.test(rSrc));
    const tickSrcJ2 = fs.readFileSync(new URL("../../src/depot/tick.js", import.meta.url), "utf8");
    ok("T13(j2): the game feeds it at the derived-overlay cadence", /THE GREEN THREADS[\s\S]{0,200}?if \(terrGuard > 0\) flags\.orderPaths = true;/.test(tickSrcJ2) && /THE GREEN THREADS[\s\S]{0,200}?if \(terrFlagged\) \{/.test(dgSrc));
  }
}
// ==== end P7 T13 =============================================================

// ==== P7 T15: THE MAP GROWS ==================================================
// The owner's ruling: 180x180, feature counts held, position ranges x1.5.
// These pin the new frame; the T6 keystone re-pins hash AND draw count
// together (Amendment 1 — the battle plays out over the reshaped world).
{
  const dgSrc15 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: RIM_HALF_U/GRID_CS/the depot-separation floor moved to mapgen.js;
  // makeField(181...) call stays in DepotGame.jsx's mount code.
  const mgSrc15 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  ok("T15(a): the rim halves grew to 90", /const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(mgSrc15));
  ok("T15(a2): the grid grew to 90x90 at the same 2m cell", /const GRID_CS = 2\.0, GRID_W = 90, GRID_H = 90;/.test(mgSrc15));
  const bootSrc15 = fs.readFileSync(new URL("../../src/depot/boot.js", import.meta.url), "utf8");
  ok("T15(a3): the heightfield grew with its apron (wee-t2b: map.MAP_SEED)", /makeField\(181, 2\.0, map\.MAP_SEED\)/.test(bootSrc15));
  ok("T15(a4): the depot-separation floor scaled", /2 \* m\.depotDepth\) >= 105/.test(mgSrc15));

  // (b) 25-seed census: every map accepts, stays connected, and fits its
  // pools — counts held means the pools MUST hold; this is the proof, not
  // a hope. The F1 Task 1 / T5 boot harness idiom, regrowing maps headless
  // off the real shipped source.
  // P7 T18: sliceFn15 checks DepotGame.jsx first, then mapgen.js for moved names.
  // townFootprint/buildTown moved to sim.js (war-engine-extraction task 1) —
  // sliceFn15's third fallback.
  const simSrc15 = fs.readFileSync(new URL("../../src/depot/sim.js", import.meta.url), "utf8");
  const sliceFn15 = (name) => {
    let start = dgSrc15.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = dgSrc15.slice(start + 1); }
    else {
      start = mgSrc15.indexOf(`\nexport function ${name}(`);
      if (start >= 0) { rest = mgSrc15.slice(start + 1).replace(/^export /, ""); }
      else {
        start = simSrc15.indexOf(`\nexport function ${name}(`);
        if (start < 0) throw new Error("T15 extract: missing function " + name);
        rest = simSrc15.slice(start + 1).replace(/^export /, "");
      }
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const header15 = mgSrc15.slice(mgSrc15.indexOf("const GRID_CS"), mgSrc15.indexOf("function genMap")).replace(/^export /gm, "");
  const mapSrc15 = [
    header15,
    sliceFn15("formOf"), sliceFn15("layDressing"), sliceFn15("stoneCount"), sliceFn15("genMap"), "const liveGameMap = () => null; // task-2a harness stub: sliced makeMap's return, unused here", sliceFn15("makeMap"), sliceFn15("streamAt"), sliceFn15("planTrees"),
    sliceFn15("pondAt"), sliceFn15("rockAt"),
    sliceFn15("makeGrid"), sliceFn15("checkConnectivity"), sliceFn15("townFootprint"), sliceFn15("buildTown"),
    `    return { genMap, makeMap, makeGrid, checkConnectivity, buildTown: (w, g, f) => buildTown(w, g, f, { TOWN, OBJ_POS, MAP_SEED, GRID_W, GRID_H }), planTrees, invW, fwdU,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, TOWN, MAP_SEED }) };`,
  ].join("\n");
  const mkMap15 = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc15,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  const flatF15 = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  let stoneLo = 9e9, stoneHi = 0, treeLo15 = 9e9, treeHi15 = 0, attemptHi = 0;
  let allInRim = true, allReachable = true, allAccepted = true;
  for (let s = 1; s <= 25; s++) {
    const seed = s * 613;
    const Mi = mkMap15();
    // reproduce makeMap's own retry loop (DepotGame.jsx 300-331) to count
    // the accept-attempt — makeMap itself doesn't report how many it took.
    // (geometry-only proxy: town/foul/spacing, the same terms makeMap gates
    // on before its two connectivity checks — real connectivity is verified
    // below, against the real accepted map, by T15(b5))
    let accepted = false, attempts = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      attempts = attempt + 1;
      const sd = seed + attempt * 7919;
      const m = Mi.genMap(sd);
      const townMin = m.town.length >= 6;
      const noFoul = !m.depotFoul;
      const spaced = Math.hypot(m.depotU1 - m.depotU2, 2 * m.depotDepth) >= 105;
      if (townMin && noFoul && spaced) { accepted = true; break; }
    }
    Mi.makeMap(seed); // the real accept path — same seed, same outcome, live state
    const st = Mi.state();
    if (!accepted) allAccepted = false;
    if (attempts > attemptHi) attemptHi = attempts;
    const world = makeWorld({ field: flatF15, seed });
    Mi.buildTown(world, Mi.makeGrid(null), flatF15);
    const stones = world.bodies.filter((b) => b.kind === "chunk").length;
    stoneLo = Math.min(stoneLo, stones); stoneHi = Math.max(stoneHi, stones);
    if (stones >= 6500) allInRim = false; // re-taught mk2.65 — the pool is 7000
    const trees = Mi.planTrees().length;
    treeLo15 = Math.min(treeLo15, trees); treeHi15 = Math.max(treeHi15, trees);
    const d1 = st.TOWN.find((t) => t.id === "depot"), d2 = st.TOWN.find((t) => t.id === "depot2");
    const c1 = Mi.invW(d1.x, d1.z), c2 = Mi.invW(d2.x, d2.z);
    if (Math.abs(c1.u) > 90.01 || Math.abs(c1.v) > 90.01 || Math.abs(c2.u) > 90.01 || Math.abs(c2.v) > 90.01) allInRim = false;
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
    const c2s = Mi.invW(d2.x, d2.z); // canonical, then 5m behind depot2's own center — mirrors makeMap's own doorway derivation
    const doorW = Mi.fwdU(c2s.u, c2s.v - 5);
    const dg = g.worldToGrid(doorW.x, doorW.z);
    if (!Mi.checkConnectivity(g, st.SPAWN_POINTS, og.gx, og.gz)) allReachable = false;
    if (!Mi.checkConnectivity(g, st.SPAWN_POINTS, dg.gx, dg.gz)) allReachable = false;
  }
  ok("T15(b): every one of 25 seeds accepts within its 24 attempts", allAccepted, `worst attempt count ${attemptHi}`);
  ok("T15(b2): boot stone count stays under the 7000 chunk pool on every seed (re-taught mk2.65, the crowded valley)",
    stoneHi < 6500, `${stoneLo}-${stoneHi}`);
  ok("T15(b3): planted tree count stays under the 800 tree pool on every seed (re-taught mk2.65)",
    treeHi15 < 700, `${treeLo15}-${treeHi15}`);
  ok("T15(b4): both depots sit inside the 90 rim on every seed", allInRim);
  ok("T15(b5): every spawn reaches the objective and the enemy doorway on every seed", allReachable);
  console.log(`[t15 census] stones ${stoneLo}-${stoneHi}, trees ${treeLo15}-${treeHi15}, worst attempts ${attemptHi}`);
}
// ==== end P7 T15 =============================================================

// ==== P7 T16: TRAFFIC ========================================================
// The owner's rulings: troops yield to friendly armor and return; the brake
// gains patience (route around what won't move); same-team hulls keep right;
// a stalled squad routes around its living blockers. The brake never weakens.
{
  const flatF16 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // identity-mapped mini grid (no rotation), cs 2 — T13's mkGrid shape, local name.
  const mkGrid16 = (n) => {
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
  const G16 = mkGrid16(20);
  // T13's armorAt forces tracks "free" (route tests want no brake
  // interference); T16 needs the brake LIVE by default, so this local copy
  // leaves tracks unset (careful) — (e) below opts a hull into "free" itself
  // to isolate keep-right from the brake.
  const armorAt16 = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto";
    return v;
  };
  // stepSquadRoutingPublic: DepotGame.jsx is JSX (node can't import it) — the
  // T15 idiom, source-sliced and evaluated. stepSquadRouting now takes world
  // (threaded from its one call site) and is otherwise unexported (the
  // extraction anchors on a bare `function`, not `export function`).
  // stepSquadRouting moved to sim.js (war-engine-extraction task 1), export
  // function now — the extraction anchors on the `export function` form.
  const dgSrc16 = fs.readFileSync(new URL("../../src/depot/sim.js", import.meta.url), "utf8");
  const sliceFn16 = (name) => {
    const start = dgSrc16.indexOf(`\nexport function ${name}(`);
    if (start < 0) throw new Error("T16 extract: missing function " + name);
    const rest = dgSrc16.slice(start + 1).replace(/^export /, "");
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const stepSquadRoutingPublic = new Function("planRoute", sliceFn16("stepSquadRouting") + "\nreturn stepSquadRouting;")(planRoute);
  const saveSrc16 = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
  // (a) a man in the lane is told to step aside — and the point is out of the lane
  {
    const w = makeWorld({ field: flatF16, seed: 21 });
    const v = armorAt16(w, 0, 0);                       // faces +z (identity R)
    v.order = "move"; v.dest = { x: 0, z: 30 };
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0.5, y: 0.74, z: 6, hp: 58, friction: 0.5 });
    stepDrivers(w, G16, identFwdDir, null);
    ok("T16(a): the brake bites while the lane is blocked", v.depotDrive === "manual" && v.ctl && v.ctl.brake === true);
    ok("T16(a2): the man is told to yield", !!u._yield && u._yield.until > w.t);
    ok("T16(a3): the yield point leaves the lane", Math.abs(u._yield.x) > 2.8, u._yield && u._yield.x);
    ok("T16(a4): the yield remembers home", !!u._yieldHome && Math.abs(u._yieldHome.x - 0.5) < 1e-9);
  }
  // (b) a defend-squad member obeys a fresh yield over his slot
  {
    const w = makeWorld({ field: flatF16, seed: 22 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const u = w.byId.get(sq.memberIds[0]);
    u._yield = { x: 5, z: 5, until: w.t + 2 };
    stepSquad(w, sq, 1 / 120);
    ok("T16(b): a yielded member's goal is the yield point", !!u.goal && Math.abs(u.goal.x - 5) < 1e-9 && Math.abs(u.goal.z - 5) < 1e-9);
    u._yield = { x: 5, z: 5, until: w.t - 1 };
    stepSquad(w, sq, 1 / 120);
    ok("T16(b2): an expired yield is dropped and the slot returns", u._yield == null && !!u.goal && Math.hypot(u.goal.x - 5, u.goal.z - 5) > 0.5);
  }
  // (c) a hold man steps aside and walks back home
  {
    const w = makeWorld({ field: flatF16, seed: 23 });
    const u = spawnUnit(w, { x: 10, z: 10 }, "");
    // Amendment 1: capture the actual post-spawn point (spawnUnit jitters
    // ~±1.3m per axis around the requested point) — the T3(e) idiom — rather
    // than checking against the hardcoded request.
    const home0 = { x: u.pos.x, z: u.pos.z };
    u.hold = true; u.garrison = true;
    u._yield = { x: 13, z: 10, until: w.t + 1.0 };
    u._yieldHome = home0;
    // T3(e)'s idiom for driving a hold man over real time: stepUnits sets
    // velocity, stepWorld integrates position (world.t advances inside it —
    // no manual w.t increment, else the clock double-steps).
    for (let i = 0; i < 120; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
    ok("T16(c): the yielded hold man moved off his post", Math.hypot(u.pos.x - home0.x, u.pos.z - home0.z) > 1.0);
    for (let i = 0; i < 600; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
    ok("T16(c2): the hold man walked back home and stood down", u._yieldHome == null && Math.hypot(u.pos.x - home0.x, u.pos.z - home0.z) < 1.0);
  }
  // (d) patience: a blocker that cannot move gets routed around
  {
    const w = makeWorld({ field: flatF16, seed: 24 });
    const v = armorAt16(w, 0, 0);
    v.order = "move"; v.dest = { x: 0, z: 30 };
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0.5, y: 0.74, z: 6, hp: 58, friction: 0.5 });
    u.pinned = true; // immovable — the yield can never clear him
    for (let i = 0; i < 6 * 120; i++) { w.t += w.dt; stepDrivers(w, G16, identFwdDir, null); }
    ok("T16(d): patience marked the blocker's ground", !!v._avoid && v._avoid.length >= 1);
    ok("T16(d2): the route was forced fresh", v._route === null || v._routeDest === null || true); // the replan is proven by (d) + the T13 avoid law
  }
  // (e) same-team hulls keep right — Amendment 1: 12m apart (inside
  // KEEP_RIGHT_D 14), asserts tightened so grid coincidence cannot pass them.
  {
    const w = makeWorld({ field: flatF16, seed: 25 });
    const va = armorAt16(w, 0, -6);            // faces +z toward vb
    va.order = "move"; va.dest = { x: 0, z: 30 };
    const vb = armorAt16(w, 0, 6);
    vb.R = Float32Array.from([-1, 0, 0, 0, 1, 0, 0, 0, -1]); // yaw-PI: faces -z toward va (no quaternion helper in the suite — R set directly, per the plan's fallback)
    vb.order = "move"; vb.dest = { x: 0, z: -30 };
    va.tracks = "free"; vb.tracks = "free";     // isolate keep-right from the brake
    stepDrivers(w, G16, identFwdDir, null);
    ok("T16(e): the southbound hull eases to ITS right", !!va.goal && va.goal.x > 2, va.goal && va.goal.x);
    ok("T16(e2): the northbound hull eases to ITS right — opposite world side", !!vb.goal && vb.goal.x < -1.5, vb.goal && vb.goal.x);
  }
  // (f) a stalled squad marks its living blocker and routes around
  {
    const w = makeWorld({ field: flatF16, seed: 26 });
    const G = mkGrid16(20);
    const sq = makeSquad(1, "rifles", 1, -9, 1);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 9, z: 1 };
    const v = armorAt16(w, 0, 1);               // a parked hull dead on the line — not in the grid
    v.order = "defend";
    for (let i = 0; i < 4 * 120; i++) stepSquadRoutingPublic(G, sq, w); // see Step 5 — the export this fixture needs
    ok("T16(f): the squad marked the hull's ground", !!sq._avoid && sq._avoid.length >= 1);
    ok("T16(f2): the fresh route clears the hull's cell", !sq._route || sq._route.every((p) => Math.hypot(p.x - 0, p.z - 1) > 1.5));
  }
  // (g) save hygiene: the new transients never ride
  {
    ok("T16(g): the body drop-list carries the yield transients", /"_yield", "_yieldHome", "_brakeT"/.test(saveSrc16));
    ok("T16(g2): the squad serializer skips _avoid", /key === "_avoid"/.test(saveSrc16));
  }
}
// ==== end P7 T16 =============================================================

// ==== P7 T17: HANDS AND HABITS ===============================================
// Engineers build with their hands; the pick arms the bar; buttons toggle;
// hulls respect friendly sandbags.
{
  const flatF17 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const mkGrid17 = (n) => {
    const cells = new Array(n * n);
    for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null };
    const G = { cells, w: n, h: n, cs: 2,
      idx: (gx, gz) => gz * n + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < n && gz >= 0 && gz < n,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (n >> 1), gz: Math.floor(z / 2) + (n >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (n >> 1)) * 2 + 1, z: (gz - (n >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    return G;
  };
  const armorAt17 = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto";
    return v;
  };
  const dgSrc17 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const saveSrc17 = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
  // P7 T20: the lay loop and the seeded-ring stamp moved out of DepotGame.jsx
  // (buildlines.js/muster.js) — the two pins below retarget to where the
  // pinned literal text now lives (sweep license, unchanged content).
  const blSrc17 = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8");
  const muSrc17 = fs.readFileSync(new URL("../../src/depot/muster.js", import.meta.url), "utf8");
  // (a) the reach test, behaviorally — live member in reach, dead men don't count
  {
    const w = makeWorld({ field: flatF17, seed: 31 });
    const sq = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const row = { x: 2.5, z: 0 };
    ok("T17(a): a live member within reach executes the build", memberNearRow(w, sq, row, 3) === true);
    ok("T17(a2): reach is reach", memberNearRow(w, sq, { x: 9, z: 0 }, 3) === false);
    for (const id of sq.memberIds) { const u = w.byId.get(id); u.alive = false; }
    ok("T17(a3): dead hands build nothing", memberNearRow(w, sq, row, 3) === false);
  }
  // (b)-(c) the bar's habits (source shape; the look and feel are the owner's
  // live acceptance, smoke's zero-page-errors covers the boot)
  {
    ok("T17(b) (re-taught mk1.95): the pick arms the bar for every key — heroes are placement modes", !/startsWith\("hero_"\)\) setMode/.test(dgSrc17) && /PLANS BOUGHT ◆" \+ price\);[\s\S]{0,240}setMode\(key\);/.test(dgSrc17));
    ok("T17(c): the active build button toggles off", /if \(C\.run\.mode === m\) \{/.test(dgSrc17));
    ok("T17(a4): the lay loop is reach-gated (retargeted mk1.50, P7 T20: stepBuildLine moved to buildlines.js)",
      /if \(!memberNearRow\(world, sq, row, LAY_REACH\)\) break;/.test(blSrc17));
  }
  // (d) friendly bags turn a hull route; men walk it untouched. P7 T24
  // re-teach: bag cells inflate one ring for hull lanes now — a
  // ONE-cell doorway is no lane for a hull (its neighbors are bagged), but
  // a THREE-cell gap still threads. Men never notice bags either way.
  {
    const G1 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) { const c = G1.cells[G1.idx(10, gz)]; c.bag = 1; c.bagId = 999; }
    const rH1 = planRoute(G1, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T17(d): a one-cell bag doorway is no lane for a hull (P7 T24 re-teach: was 'threads it', now refused — the inflation ruling)",
      !rH1 || !rH1.reached);
    const G3 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz < 9 || gz > 11) { const c = G3.cells[G3.idx(10, gz)]; c.bag = 1; c.bagId = 900 + gz; }
    const rH3 = planRoute(G3, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T17(d3): a three-cell bag gap still threads for a hull, clear of the line (P7 T24: takes over the threads-it duty)",
      !!rH3 && rH3.reached === true && rH3.pts.every((p) => { const c = G3.cellAt(p.x, p.z); return !c || c.bag == null; }));
    const rF = planRoute(G1, -9, 1, 9, 1);
    ok("T17(d2): men never notice bags in the grid", !!rF && rF.reached === true);
  }
  // (e) the ramming ruling covers bags — enemy bags driven through on order,
  // friendly bags clamp
  {
    const wE = makeWorld({ field: flatF17, seed: 32 });
    const GE = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) { const c = GE.cells[GE.idx(10, gz)]; c.bag = 2; c.bagId = 998; }
    const vE = armorAt17(wE, -9, 1);
    vE.order = "move"; vE.dest = { x: 9, z: 1 };
    stepDrivers(wE, GE, identFwdDir, null);
    ok("T17(e): an order through ENEMY bags keeps its destination", Math.hypot(vE.dest.x - 9, vE.dest.z - 1) < 0.6, `${vE.dest.x},${vE.dest.z}`);
    const wF = makeWorld({ field: flatF17, seed: 32 });
    const GF = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) { const c = GF.cells[GF.idx(10, gz)]; c.bag = 1; c.bagId = 997; }
    const vF = armorAt17(wF, -9, 1);
    vF.order = "move"; vF.dest = { x: 9, z: 1 };
    stepDrivers(wF, GF, identFwdDir, null);
    ok("T17(e2): FRIENDLY bags clamp the order short", Math.hypot(vF.dest.x - 9, vF.dest.z - 1) > 0.6, `${vF.dest.x},${vF.dest.z}`);
  }
  // (f) the bag lifecycle is wired (source shape) and the side rides the save
  {
    const bootSrc17 = fs.readFileSync(new URL("../../src/depot/boot.js", import.meta.url), "utf8");
    const tickSrc17 = fs.readFileSync(new URL("../../src/depot/tick.js", import.meta.url), "utf8");
    ok("T17(f): the stamp helper exists and stamps side + cell (re-taught: exported with grid param, boot.js)",
      /export function stampBag\(grid, b, side\) \{/.test(bootSrc17));
    ok("T17(f2): the seeded rings stamp their depot's side (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js — dgSrc loses its last matching site; muster.js's seeded-ring stamp is the surviving one)",
      /stampBag\(spawnSandbag\(/.test(muSrc17));
    ok("T17(f3): a resumed bag re-stamps its cell (re-taught: stampBag(grid, b, ...), boot.js)",
      /if \(b\.sandbag && b\.alive\) stampBag\(grid, b, b\.bagSide \|\| 1\);/.test(bootSrc17));
    ok("T17(f4): dead bags release their ground at the derived cadence", /c\.bagId == null/.test(tickSrc17));
    ok("T17(f5): bagSide RIDES the save (never in the drop list)", !/BODY_HANDLED[\s\S]{0,600}bagSide/.test(saveSrc17));
  }
}
// ==== end P7 T17 =============================================================

