import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid } from "./shared.mjs";
import { squadFire, spawnSquadMembers, spawnSandbag, spawnWallCourses } from "../../src/depot/state.js";
import { makeWorld, addBody, addWeld, stepWorld, worldHash, mulberry32 } from "../../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, TANK, MASON } from "../../src/depot/specs.js";
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { planRoute } from "../../src/depot/route.js";
import { SQUAD_SPECS, makeSquad, stepSquad } from "../../src/depot/squads.js";
import { STIPEND } from "../../src/depot/economy.js";
import { planWave } from "../../src/depot/ai.js";
import { makeTerritory } from "../../src/depot/territory.js";
import { makeSight, stepSight } from "../../src/depot/sight.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import { computePrices, marketCounts } from "../../src/depot/market.js";
import fs from "node:fs";

// ==== P6 T1: the path that walks around =====================================
// mk1.10 (Troops & Physics, Task 1). Squad marches follow a computed route
// on the movement grid: around masonry. The leg
// machine consumes waypoints; routes are drawn/redrawn by the game layer.
// Zero new rng; the one-draw-per-leg contract is untouched.
{
  console.log("\n[p6 t1: the path that walks around]");
  // stepSquadRouting/townFootprint/buildTown moved to sim.js (war-engine-
  // extraction task 1) — sliceFnP's first check reads their new home; the
  // (f) source pin below reads the same text.
  const src = fs.readFileSync(new URL("../../src/depot/sim.js", import.meta.url), "utf8");
  // P7 T18: sliceFnP checks sim.js first (stepSquadRouting/townFootprint/
  // buildTown live there now), then mapgen.js for moved names.
  const mgSrcP = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  let M1ok = true, mk1 = null;
  try {
    const sliceFnP = (name) => {
      let start = src.indexOf(`\nfunction ${name}(`), rest;
      if (start >= 0) { rest = src.slice(start + 1); }
      else {
        start = src.indexOf(`\nexport function ${name}(`);
        if (start >= 0) { rest = src.slice(start + 1).replace(/^export /, ""); }
        else {
          start = mgSrcP.indexOf(`\nexport function ${name}(`);
          if (start < 0) throw new Error("P6T1 extract: missing function " + name);
          rest = mgSrcP.slice(start + 1).replace(/^export /, "");
        }
      }
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const headerP = mgSrcP.slice(mgSrcP.indexOf("const GRID_CS"), mgSrcP.indexOf("function genMap")).replace(/^export /gm, "");
    const mapSrcP = [
      headerP,
      sliceFnP("formOf"), sliceFnP("layDressing"), sliceFnP("stoneCount"), sliceFnP("genMap"), "const liveGameMap = () => null; // task-2a harness stub: sliced makeMap's return, unused here", sliceFnP("makeMap"), sliceFnP("streamAt"), sliceFnP("planTrees"),
      sliceFnP("pondAt"), sliceFnP("rockAt"),
      sliceFnP("makeGrid"), sliceFnP("checkConnectivity"), sliceFnP("stepSquadRouting"),
      sliceFnP("townFootprint"), sliceFnP("buildTown"),
      `      return { makeMap, makeGrid, buildTown: (w, g, f) => buildTown(w, g, f, { TOWN, OBJ_POS, MAP_SEED, GRID_W, GRID_H }), planRoute, stepSquadRouting, streamAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, STREAM, MAP_SEED }) };`,
    ].join("\n");
    // P7 T2 (mk1.31): planRoute moved out of DepotGame.jsx into route.js —
    // no longer sliceable source text here, so the REAL imported function is
    // injected as a parameter instead; sliced stepSquadRouting's own
    // internal call to planRoute(...) closes over this same binding.
    mk1 = () => new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", "planRoute", mapSrcP,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld, planRoute);
  } catch (e) { M1ok = false; }
  ok("P6T1: the map module extracts with planRoute and stepSquadRouting", M1ok);

  if (M1ok) {
    // (a) RETIRED (mk1.94, owner): the stream is switched off — there is no
    // causeway to cross. (b) below still proves routing around masonry.

    // (b) around, not through: a route past the biggest building never enters
    // a blocked cell, and ends within a cell of its destination.
    // re-pinned mk1.72 (P7.1 T8): THE SEED PURGE — the old special-cased
    // seed leaves the suite; seed 1001 (first candidate) holds both (b)
    // and (c) unchanged.
    {
      const Mi = mk1(); Mi.makeMap(1001);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 }); // claims footprints
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const route = Mi.planRoute(g, big.x - 14, big.z, big.x + 14, big.z);
      ok("P6T1(b): a route exists past the biggest building", !!route && route.pts.length >= 2, route && `${route.pts.length} pts`);
      if (route) {
        const foul = route.pts.filter((p) => { const c = g.cellAt(p.x, p.z); return c && c.blocked; }).length;
        ok("P6T1(b): no route point stands on a blocked cell", foul === 0, `${foul} fouls`);
        const end = route.pts[route.pts.length - 1];
        ok("P6T1(b): the route ends beside the asked ground", Math.hypot(end.x - (big.x + 14), end.z - big.z) < 2.9, Math.hypot(end.x - (big.x + 14), end.z - big.z).toFixed(2));
      }
    }

    // (c) the honest clamp: a destination ON the building routes to the
    // nearest reachable ground beside it, and stepSquadRouting rewrites
    // sq.dest to that point.
    {
      const Mi = mk1(); Mi.makeMap(1001);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 });
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const sq = { order: "move", dest: { x: big.x, z: big.z }, anchor: { x: big.x - 14, z: big.z }, _route: null };
      Mi.stepSquadRouting(g, sq);
      ok("P6T1(c): an unreachable destination is clamped to reachable ground",
        !!sq._route && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) > 1.5 && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) < 12,
        `moved ${Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z).toFixed(2)}m`);
      const endC = sq._route && g.cellAt(sq.dest.x, sq.dest.z);
      ok("P6T1(c): the clamped ground is not blocked", !!endC && !endC.blocked);
    }

    // (d) determinism twin: identical routes from identical seeds.
    {
      const A = mk1(); A.makeMap(7717); const gA = A.makeGrid(null);
      const B = mk1(); B.makeMap(7717); const gB = B.makeGrid(null);
      const wa = A.fwdU(-30, -30), wd = A.fwdU(30, 30);
      ok("P6T1(d): twin determinism — identical routes",
        JSON.stringify(A.planRoute(gA, wa.x, wa.z, wd.x, wd.z)) === JSON.stringify(B.planRoute(gB, wa.x, wa.z, wd.x, wd.z)));
    }
  }

  // (e) the leg machine walks a route: stubbed water band with a gap at
  // x=20; a squad with a route through the gap crosses and digs in; the
  // T3(f) routeless squad still holds at the bank (that block re-proves it).
  {
    const flatFP = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatFP, seed: 5 });
    world.streamAt = (x, z) => z > 10 && z < 14 && !(x > 18 && x < 22);
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    sq._route = [{ x: 20, z: 6 }, { x: 20, z: 18 }, { x: 0, z: 30 }];
    for (let i = 0; i < 4800; i++) { stepSquad(world, sq, 1 / 60); stepWorld(world); }
    ok("P6T1(e): the routed squad crosses at the gap and digs in", sq.order === "defend" && Math.hypot(sq.anchor.x - 0, sq.anchor.z - 30) < 1.5, `${sq.order} at (${sq.anchor.x.toFixed(1)}, ${sq.anchor.z.toFixed(1)})`);
    ok("P6T1(e): the route is consumed", !sq._route || sq._route.length === 0, sq._route && `${sq._route.length} left`);
  }

  // (f) source pins
  const sqsrcP = fs.readFileSync(new URL("../../src/depot/squads.js", import.meta.url), "utf8");
  ok("P6T1(f): the leg machine pops waypoints", /squad\._route\.shift\(\);/.test(sqsrcP));
  ok("P6T1(f): legs aim at the waypoint, arrival still reads the true dest", /const wp = squad\._route && squad\._route\.length \? squad\._route\[0\] : squad\.dest;/.test(sqsrcP));
  ok("P6T1(f): stepDepot routes every ordered squad", /stepSquadRouting\(grid, sq, world\);/.test(src));
}
// ==== end P6 T1 ==============================================================

// ==== P6 T2: stone doesn't murder pedestrians ===============================
// mk1.11 (Troops & Physics, Task 2). A sleeping stone is not a weapon: under
// depot combat the ejection out of a standing wall (or settled rubble) can
// no longer slam a living man dead, and a sleeping stone never counts as
// burying him. Falling stone kills exactly as before — (b) proves it.
{
  console.log("\n[p6 t2: stone doesn't murder pedestrians]");
  const flatT2 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // one welded, sleeping three-course stack — a standing wall face
  const buildStack = (world, x, z) => {
    const lo = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 0.42, z, friction: 0.65, restitution: 0.02 });
    const mid = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 1.25, z, friction: 0.65, restitution: 0.02 });
    const hi = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 2.08, z, friction: 0.65, restitution: 0.02 });
    addWeld(world, lo, mid, 8.0e4); addWeld(world, mid, hi, 8.0e4);
    lo.sleeping = true; mid.sleeping = true; hi.sleeping = true;
    return { lo, mid, hi };
  };

  // (a) THE WALL KILL DIES: a man pressed into a sleeping wall by his own
  // side's shoving (deterministic pushes, the cohesion squeeze in miniature)
  // is ejected but NOT killed. RED before the fix — he dies today.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    buildStack(world, 0, 5);
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; } // the squeeze, re-applied
      stepWorld(world);
    }
    ok("T2(a): the man pressed into a sleeping wall SURVIVES", man.alive === true, `alive=${man.alive} hp=${man.alive ? man.hp.toFixed(0) : "dead"}`);
  }

  // (a2) settled loose rubble is exempt the same way (same three stones,
  // no welds, still asleep — a settled pile a man is pressed against)
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const r1 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 0.42, z: 5, friction: 0.65, restitution: 0.02 });
    const r2 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 1.25, z: 5, friction: 0.65, restitution: 0.02 });
    const r3 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 2.08, z: 5, friction: 0.65, restitution: 0.02 });
    r1.sleeping = true; r2.sleeping = true; r3.sleeping = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; }
      stepWorld(world);
    }
    ok("T2(a2): sleeping loose rubble never killed him and still doesn't (wake exemption needs a live weld)", man.alive === true, `alive=${man.alive}`);
  }

  // (b) FALLING STONE STILL KILLS (green before AND after — the guard's
  // honesty check): a freed chunk dropped on a man's head stays lethal.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 5, hp: 58, friction: 0.55 });
    const rock = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 7, z: 5, friction: 0.65, restitution: 0.02 });
    rock.fallingSince = world.t; // severed mid-collapse, exactly as weldBreakPass stamps it
    for (let i = 0; i < 600 && man.alive; i++) stepWorld(world);
    ok("T2(b): falling stone still kills (green first, green after)", man.alive === false, `alive=${man.alive}`);
  }

  // (d) source pin: the guard exists, gated, in the classifier
  const csrcT2 = fs.readFileSync(new URL("../../src/engine/core.js", import.meta.url), "utf8");
  ok("T2(d): the sleeping-stone guard exists in classifyImpacts",
    /SLEEPING STONE IS\s*\n?\s*\/\/ NOT A WEAPON|SLEEPING STONE IS NOT A WEAPON/.test(csrcT2) && /inertStone/.test(csrcT2));
}
// ==== end P6 T2 ==============================================================

// ==== P6 T3: only engineers build ===========================================
// mk1.12 (Troops & Physics, Task 3). Walls and sandbags leave the bar and
// the starting kit — engineer lines are the only door to masonry. Towers
// keep direct placement; the seeded depot bags stay; the harness's buildAt
// door stays for staging.
{
  console.log("\n[p6 t3: only engineers build]");
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const muSrcT3 = fs.readFileSync(new URL("../../src/depot/muster.js", import.meta.url), "utf8");
  const blSrcT3 = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8");
  ok("T3: the bar has no wall slot", !/key: "wall", label: "WALL"/.test(src));
  ok("T3: the bar has no sandbag slot", !/key: "sandbag", label: "SANDBAG"/.test(src));
  ok("T3: no build mode is selected by default", /mode: null, sellMode: false/.test(src));
  ok("T3: the ground tap guards the tower path on a live mode", /if \(S\.mode && TOWER_SPECS\[S\.mode\]\)/.test(src));
  ok("T3: the engineer line machinery is untouched (both spawners live) (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js) (re-taught P7.1 T7)",
    /spawnWallCourses\(world, row\.x/.test(blSrcT3) && /spawnSandbag\(world, row\.x, row\.z, orient, team\)/.test(blSrcT3));
  ok("T3: the seeded depot bags are untouched (retargeted mk1.49, P7 T19: seedBags moved to muster.js)",
    /spawnSandbag\(world, bx, bz,/.test(muSrcT3));
  ok("T3: the harness door stays (buildAt via __DEPOTBUILD__)", /__DEPOTBUILD__ = \(gx, gz, mode\) => buildAt\(gx, gz, mode \|\| "wall"\)/.test(src));
  ok("T3: the start screen stopped promising the trowel", !/Wall their road/.test(src));
}
// ==== end P6 T3 ==============================================================

// ==== P6 T4: the living market ==============================================
// mk1.13 (Troops & Physics, Task 4). Per-family prices off live standing
// stock, both armies counted together; repriced every second; one buy per
// second per side; income flat 1 scrap/second both sides. Zero rng.
{
  console.log("\n[p6 t4: the living market]");
  let mkt = null;
  try { mkt = await import("../../src/depot/market.js"); } catch (e) {}
  ok("T4: src/depot/market.js exists with the three exports",
    !!mkt && typeof mkt.marketCounts === "function" && typeof mkt.computePrices === "function" && mkt.MARKET_KG === 88);

  if (mkt) {
    // (a) the curve: base at zero, double at K, capped at 4x, integer prices
    const P0 = mkt.computePrices({});
    ok("T4(a): an empty field pays base prices", P0.player.sq_rifles === SQUAD_SPECS.rifles.cost && P0.player.gun === TOWER_SPECS.gun.cost,
      `rifles ${P0.player.sq_rifles}, gun ${P0.player.gun}`);
    const Pk = mkt.computePrices({ rifles: 16 });
    ok("T4(a): K of a family doubles its price", Pk.player.sq_rifles === SQUAD_SPECS.rifles.cost * 2, `${Pk.player.sq_rifles}`);
    const Pcap = mkt.computePrices({ rifles: 999 });
    ok("T4(a): a type bought out tops at its own pole — 32x for rifles", Pcap.player.sq_rifles === SQUAD_SPECS.rifles.cost * 32, `${Pcap.player.sq_rifles}`);

    // (b) shared stock: enemy conscripts and player riflemen are ONE family
    {
      const flatM = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
      const world = makeWorld({ field: flatM, seed: 3 });
      for (let i = 0; i < 6; i++) spawnUnit(world, { x: i * 2, z: 0 }, "");     // 6 conscripts
      const sq = makeSquad(1, "rifles", 1, 20, 20);
      spawnSquadMembers(world, sq);                                             // 4 riflemen
      const counts = mkt.marketCounts(world, [sq]);
      ok("T4(b): the rifles family counts both armies' men", counts.rifles === 10, `${counts.rifles}`);
      const Pm = mkt.computePrices(counts);
      ok("T4(b): both sides pay the same multiplied table",
        Pm.player.sq_rifles === Math.max(1, Math.round(SQUAD_SPECS.rifles.cost * (32 / (32 - 10)) * (88 / (88 - 10)))) &&
        Pm.foe[""] === Math.max(1, Math.round(ENEMY_SPECS[""].bounty * (32 / (32 - 10)) * (88 / (88 - 10)))),
        `player ${Pm.player.sq_rifles}, foe ${Pm.foe[""]}`);
    }

    // (c) determinism: same counts, same prices, twice
    ok("T4(c): twin determinism", JSON.stringify(mkt.computePrices({ rifles: 7, guntower: 2 })) === JSON.stringify(mkt.computePrices({ rifles: 7, guntower: 2 })));

    // (d) planWave pays market prices — and its 4-draw contract holds
    {
      const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
      const reg2 = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
      let draws = 0;
      const rngW = () => { draws++; return mulberry32(77)(); };
      const rngA = mulberry32(77), rngB = mulberry32(77);
      const flat = planWave(reg, {}, 6, rngA);
      const priceOf = (t) => Math.round((t === "tank" ? TANK.bounty : ENEMY_SPECS[t].bounty) * 2);
      const priced = planWave(reg2, {}, 6, rngB, null, priceOf);
      const nOf = (r) => r.buys.reduce((s, b) => s + b.n, 0);
      ok("T4(d): doubled prices field a smaller assault on the same budget", nOf(priced) < nOf(flat), `${nOf(priced)} vs ${nOf(flat)}`);
      planWave({ heads: 9, tanks: 0, heads0: 9, tanks0: 0, scrap: 9 }, {}, 1, rngW, null, priceOf);
      ok("T4(d): the 4-draw contract holds under market prices", draws === 4, `${draws}`);
    }
  }

  // (e) income + limit + wiring: source pins
  const srcT4 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const stT4 = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
  ok("T4(e): the player's income is the clock — ground-scaled, floor 1/second (re-taught mk2.49)", /S\.resources \+= S\._groundRate1 \* sdt;/.test(srcT4) && !/S\.resources \+= 1 \* sdt;/.test(srcT4));
  ok("T4(e): the bell pays no lump", !/S\.resources \+= BELL_SCRAP;/.test(stT4));
  ok("T4(e): one purchase per second, toasted", /THE MARKET PACES YOU/.test(srcT4) && /S\._buyAt = world\.t;/.test(srcT4));
  ok("T4(e): purchases charge the live price", /const priceNow = /.test(srcT4));
  ok("T4(e): the enemy stipend is the same clock", /export const STIPEND = 90;/.test(fs.readFileSync(new URL("../../src/depot/economy.js", import.meta.url), "utf8")));
}
// ==== end P6 T4 ==============================================================

// ==== P6 T7: the front door =================================================
// mk1.14 (Troops & Physics, Task 7). The site opens on WINTER FRONT — one
// identity, one action, three laws — and the demos live behind one link.
{
  console.log("\n[p6 t7: the front door]");
  const ss = fs.readFileSync(new URL("../../src/ui/StartScreen.jsx", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../../src/ui/App.jsx", import.meta.url), "utf8");
  ok("T7: the range subtitle is dead", !/WINTER RANGE COMMAND/.test(ss));
  ok("T7 (re-taught mk2.43): the laws left the door for the teaching cards", !/muster bell rings/.test(ss) && !/real masonry/.test(ss) && !/The save burns/.test(ss));
  ok("T7: the demos left the door", !/PROVING GROUNDS/.test(ss) && !/MECH TEST RANGE/.test(ss) && !/HOLD THE DEPOT/.test(ss));
  ok("T7: one quiet link leads to the range", /data-menu="demos"/.test(ss));
  ok("T7: the demos page routes from the app shell", /DemosScreen/.test(app) && /data-menu="demos"/.test(ss));
  const dg = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T7: the southern treeline is gone", !/southern treeline/.test(dg));
  let dm = "";
  try { dm = fs.readFileSync(new URL("../../src/ui/DemosScreen.jsx", import.meta.url), "utf8"); } catch (e) {}
  ok("T7: the five cards and controls live on the range page",
    /HOLD THE DEPOT/.test(dm) && /CLEARANCE CAMPAIGN/.test(dm) && /CONTRACT SANDBOX/.test(dm) && /PROVING GROUNDS/.test(dm) && /MECH TEST RANGE/.test(dm) && /CONTROLS/.test(dm));
}
// ==== end P6 T7 ==============================================================

// ==== P6 T10: body lists =====================================================
// mk1.19 (Troops & Physics, Task 10). Third landing. One pass per frame
// filters world.bodies into typed pools (src/depot/lists.js); every hot scan
// iterates its pool with its full original predicate kept, falling back to
// world.bodies when no lists are installed. The keystone is (c): a twin
// firefight with and without the lists installed lands on the identical
// worldHash and draw count.
{
  console.log("\n[p6 t10: body lists]");
  let listsMod = null;
  try { listsMod = await import("../../src/depot/lists.js"); } catch (e) {}
  ok("T10: src/depot/lists.js exists and exports makeBodyLists/rebuildBodyLists",
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
      ok(`T10(a): pool ${k} matches its reference filter, in world order`,
        L[k].length === ref[k].length && L[k].every((b, i) => b === ref[k][i]),
        `${k}: ${L[k].length} vs ${ref[k].length}`);
    }
    ok("T10(a): rebuild installs world._L", world._L === L);
    ok("T10(a): a second rebuild reuses the same arrays (no per-tick allocation)",
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
    ok("T10(b): a foe killed after the rebuild draws no fire off the stale pool",
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
    ok("T10(c) KEYSTONE: lists installed vs absent — identical worldHash and draw count",
      run(true) === run(false), `${run(true)} vs ${run(false)}`);
  }
}
// ==== end P6 T10 ==============================================================

// ==== P6 T11: the two-pressure wall =========================================
// mk1.20. Every price carries the type's own count (strong) plus the whole
// field's living men against the engine ceiling (mild) — the owner's ruling:
// "all prices increase with each buy but the prices for the unit purchased
// go up more substantially." Soft wall, no sell-outs, the 4x cap stands.
{
  console.log("\n[p6 t11: the two-pressure wall]");
  let mkt = null;
  try { mkt = await import("../../src/depot/market.js"); } catch (e) {}
  ok("T11: the two poles exported — field 88, clamp 50", !!mkt && mkt.MARKET_KG === 88 && mkt.WALL_CLAMP === 50);
  if (mkt) {
    const base = SQUAD_SPECS.rifles.cost;
    const Pg = mkt.computePrices({ _men: 44 });
    ok("T11(a): a half-full field doubles every price", Pg.player.sq_rifles === base * 2 && Pg.player.gun === TOWER_SPECS.gun.cost * 2,
      `rifles ${Pg.player.sq_rifles}, gun ${Pg.player.gun}`);
    const Pk = mkt.computePrices({ rifles: 16 });
    ok("T11(b): the type wall still doubles at K", Pk.player.sq_rifles === base * 2, `${Pk.player.sq_rifles}`);
    const Pboth = mkt.computePrices({ rifles: 16, _men: 44 });
    ok("T11(b2): the two walls multiply — the bought type rises more", Pboth.player.sq_rifles === base * 4, `${Pboth.player.sq_rifles}`);
    const Ptype = mkt.computePrices({ rifles: 28 });
    ok("T11(c): a spammed type is ridiculous on its own line — 8x at 28 rifles",
      Ptype.player.sq_rifles === base * 8, `${Ptype.player.sq_rifles}`);
    const Pwall = mkt.computePrices({ _men: 80 });
    ok("T11(c2): the measured ceiling is ridiculous — 11x at 80 men",
      Pwall.player.sq_rifles === Math.max(1, Math.round(base * (88 / 8))), `${Pwall.player.sq_rifles}`);
    const Pcap = mkt.computePrices({ rifles: 999, _men: 999 });
    ok("T11(c3): both walls topped — the rifle pole (32x) times the field clamp (50x)", Pcap.player.sq_rifles === base * 32 * 50, `${Pcap.player.sq_rifles}`);
    {
      const flatM = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
      const world = makeWorld({ field: flatM, seed: 3 });
      for (let i = 0; i < 6; i++) spawnUnit(world, { x: i * 2, z: 0 }, "");
      const sq = makeSquad(1, "rifles", 1, 20, 20);
      spawnSquadMembers(world, sq);
      const counts = mkt.marketCounts(world, [sq]);
      ok("T11(d): _men counts every living man, both armies", counts._men === 10, `${counts._men}`);
    }
  }
}
// ==== end P6 T11 =============================================================

