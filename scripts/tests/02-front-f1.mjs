import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid, starvedReg } from "./shared.mjs";
import { makeRunState, fireBell, BELL_PERIOD_S, checkLoss, makeEndDispatch, pendingArmed, PENDING_EDGE_PAD, pendingButtonsVisible, canvasTapConsumesPending, END_CARD_DELAY_S, stampEnd, endCardReady, checkDepotBreach, checkEnemyBreach, spawnSquadMembers } from "../../src/depot/state.js";
import { troopKit, barrelBasis, RIFLE_PREROT, RIFLE_OFF, RIFLE_LEN } from "../../src/render/troopkit.js";
import { INFANTRY, makeWorld, addBody, addWeld, stepWorld, mulberry32 } from "../../src/engine/core.js";
import { MASON } from "../../src/depot/specs.js";
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { stampTerrainMasks } from "../../src/depot/route.js";
import { makeSquad } from "../../src/depot/squads.js";
import { combatIneffective } from "../../src/depot/economy.js";
import { EMIT } from "../../src/depot/territory.js";
import { fwdUFor, fwdDirFor, invWFor } from "../../src/depot/orient.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import fs from "node:fs";

// ==== FRONT F1 Task 1: their depot stands ====================================
// DepotGame.jsx is JSX (not importable headlessly) — extract the REAL map
// machinery (module header + genMap/makeMap/makeGrid/pondAt/rockAt/
// checkConnectivity/buildTown) from the source text and evaluate it with its
// imported deps injected. This runs the actual shipped code, not a copy.
{
  const depotSrcF1 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T18: the map frame moved to mapgen.js, verbatim, with export keywords
  // added. townFootprint/buildTown stayed in DepotGame.jsx. sliceFn checks
  // DepotGame.jsx first (unmoved names), then mapgen.js (moved names,
  // stripping the "export " prefix so the extracted text is byte-identical
  // to what it was pre-move).
  const mgSrcF1 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  const sliceFn = (name) => {
    let start = depotSrcF1.indexOf(`\nfunction ${name}(`), rest;
    if (start >= 0) { rest = depotSrcF1.slice(start + 1); }
    else {
      start = mgSrcF1.indexOf(`\nexport function ${name}(`);
      if (start < 0) throw new Error("F1 extract: missing function " + name);
      rest = mgSrcF1.slice(start + 1).replace(/^export /, "");
    }
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerStart = mgSrcF1.indexOf("const GRID_CS");
  const headerEnd = mgSrcF1.indexOf("function genMap");
  const header = mgSrcF1.slice(headerStart, headerEnd).replace(/^export /gm, "");
  const mapSrc = [
    header,
    sliceFn("formOf"), sliceFn("layDressing"), sliceFn("stoneCount"), sliceFn("genMap"), sliceFn("makeMap"), sliceFn("streamAt"), sliceFn("pondAt"), sliceFn("rockAt"),
    // townFootprint (P1 T3): buildTown's grid-footprint loop, lifted out so
    // the save's restore path can recompute the same cells without re-laying
    // stone. buildTown calls it, so the extraction must carry it.
    // streamAt (T3, mk1.02): makeGrid's water branch calls it now.
    sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("townFootprint"), sliceFn("buildTown"),
    `return { genMap, makeMap, makeGrid, checkConnectivity, buildTown, invW,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, MAP_SEED }) };`,
  ].join("\n");
  const makeMapModule = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", "stampTerrainMasks", mapSrc,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld, stampTerrainMasks);

  const M = makeMapModule();
  M.makeMap(5);
  const st = M.state();
  const depot2 = st.TOWN.find((t) => t.id === "depot2");
  ok("F1/1a: genMap places depot2 (team 2) in the town list", !!depot2 && depot2.team === 2, JSON.stringify(depot2));
  {
    const depot1 = st.TOWN.find((t) => t.id === "depot");
    const c1 = depot1 ? invWFor(st.ORIENT, depot1.x, depot1.z) : { u: 9e9, v: 9e9 };
    const c2 = depot2 ? invWFor(st.ORIENT, depot2.x, depot2.z) : { u: 9e9, v: 9e9 };
    ok("F1/1a (re-pinned mk1.45, P7 T15): the depots are EVENED — mirrored depth, 66-78m from center",
      Math.abs(c1.v + c2.v) < 0.01 && c1.v >= 66 && c1.v <= 78.01, `v1=${c1.v} v2=${c2.v}`);
    ok("F1/1a (re-pinned mk1.32, P7 T3): depot2 shares the depot lattice template (12x9x7, door 5, depot flag)",
      !!depot2 && depot2.depot === true &&
      Math.max(depot2.nx, depot2.nz) === 12 && Math.min(depot2.nx, depot2.nz) === 9 && depot2.ny === 7,
      depot2 && `${depot2.nx}x${depot2.nz}x${depot2.ny}`);
  }

  // real buildTown on the real map: same stone-count law both depots, two flags
  {
    const world = makeWorld({ field: { heightAt: () => 0 }, seed: 5 });
    const grid = M.makeGrid(null);
    M.buildTown(world, grid, { heightAt: () => 0 });
    const stones1 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot").length;
    const stones2 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot2").length;
    ok("F1/1b: depot2 chunk lattice exists with the same stone count as depot", stones2 > 0 && stones2 === stones1, `depot=${stones1} depot2=${stones2}`);
    const flags = world.bodies.filter((b) => b.kind === "flag");
    ok("F1/1b: exactly two flag bodies, teams 1 and 2",
      flags.length === 2 && flags.map((f) => f.team).sort().join(",") === "1,2",
      `n=${flags.length} teams=${flags.map((f) => f.team)}`);

  }

  // source pins: the emitter rule and the deleted anchor push
  ok("F1/1c: buildEmitters flags emit by team sign", /b\.kind === "flag"[^\n]*sign: b\.team === 2 \? -1 : 1/.test(depotSrcF1));
  ok("F1/1c: the SPAWN_POINTS anchor push is deleted", !/for \(const sp of SPAWN_POINTS\)[^\n]*EMIT\.anchor/.test(depotSrcF1));

  // renderer: cloth tint keys on the flag body's team (DEPOT-gated by the
  // existing world.wind gate — TD/no-option renders never reach this block)
  {
    const rSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("F1/1d: flag cloth tint keys on the flag body's team", /flagClothMesh\.setColorAt\(fi, b\.team === 2 \?/.test(rSrc));
  }

  // connectivity both directions + 20-seed placement sweep: depot2 never
  // fouls roads/spawns/ponds/rocks and every map builds
  {
    const halfDiag = Math.hypot(12, 9) * MASON.pitch / 2; // re-pinned mk1.32 (P7 T3): depot grown 9x7 -> 12x9
    for (let s = 1; s <= 20; s++) {
      const Mi = makeMapModule();
      Mi.makeMap(s * 101);
      const sti = Mi.state();
      const d2 = sti.TOWN.find((t) => t.id === "depot2");
      if (!d2) { ok(`F1/sweep seed ${s * 101}: depot2 present`, false); continue; }
      // clearance in world space against the built map
      const roadDistW = (x, z) => {
        let best = 1e9;
        for (const route of sti.ROADS) for (let i = 0; i < route.length - 1; i++) {
          const a = route[i], b2 = route[i + 1];
          const dx = b2[0] - a[0], dz = b2[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
        }
        return best;
      };
      const rd = roadDistW(d2.x, d2.z);
      const pondFoul = sti.PONDS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const rockFoul = sti.ROCKS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const spawnFoul = sti.SPAWN_POINTS.some((sp) => Math.hypot(d2.x - sp.x, d2.z - sp.z) < halfDiag + 2);
      ok(`F1/sweep seed ${s * 101}: depot2 clear of roads/ponds/rocks/spawns`,
        rd > halfDiag + 2 && !pondFoul && !rockFoul && !spawnFoul,
        `roadDist=${rd.toFixed(2)} pond=${pondFoul} rock=${rockFoul} spawn=${spawnFoul}`);
      // connectivity both directions on the accepted map
      const g = Mi.makeGrid(null);
      for (const t of sti.TOWN) {
        const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
        for (let gz = 0; gz < g.h; gz++) for (let gx = 0; gx < g.w; gx++) {
          const wp = g.gridToWorld(gx, gz);
          if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
            if (Math.hypot(wp.x - sti.OBJ_POS.x, wp.z - sti.OBJ_POS.z) < 5) continue;
            g.cells[g.idx(gx, gz)].blocked = true;
          }
        }
      }
      const og = g.worldToGrid(sti.OBJ_POS.x, sti.OBJ_POS.z);
      const c2s = invWFor(sti.ORIENT, d2.x, d2.z);
      const doorW = fwdUFor(sti.ORIENT, c2s.u, c2s.v - 5); // 5m behind depot2's own center — derived, not owed
      const dg = g.worldToGrid(doorW.x, doorW.z);
      ok(`F1/sweep seed ${s * 101}: spawns reach the objective AND depot2's doorway`,
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, og.gx, og.gz) &&
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, dg.gx, dg.gz));
    }
  }

  // twin determinism: two extractions, same seed -> identical map state
  {
    const A = makeMapModule(); A.makeMap(77);
    const B = makeMapModule(); B.makeMap(77);
    ok("F1: twin determinism — same seed, identical town layout",
      JSON.stringify(A.state().TOWN) === JSON.stringify(B.state().TOWN));
  }
}
// ==== end FRONT F1 Task 1 ====================================================

// ==== FRONT F1 Task 3: the only ending =======================================
// The two breaches are the ONLY run-enders. Leaks/lives retire; the bell
// cycles forever; attrition/spent become one-time dispatch observations.
{

  // (a) leaks retired at the source: units.js exports no checkLeaks, the
  // world removal path is gone, DepotGame neither imports nor calls it, and
  // no leak event branch/lives field survives in HUD or run state.
  {
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const depotSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    ok("F1/3a: units.js no longer defines checkLeaks", !unitsSrc.includes("function checkLeaks"));
    ok("F1/3a: DepotGame neither imports nor calls checkLeaks", !depotSrc.includes("checkLeaks"));
    ok("F1/3a grep pin: no lives field in DepotGame (HUD, hooks, run state)", !/\blives\b/.test(depotSrc.replace(/\/\/[^\n]*/g, "")));
    ok("F1/3a grep pin: no heart chip in DepotGame", !depotSrc.includes("♥"));
    ok("F1/3a grep pin: no FINAL WAVE copy in state.js cards", !stateSrc.includes("FINAL WAVE"));
    ok("F1/3a grep pin: no n-of-50 wave display in DepotGame", !depotSrc.includes("totalWaves"));
    ok("F1/3a: makeRunState carries no lives", !("lives" in makeRunState()));
    const S0 = makeRunState();
    S0.reg = { heads: 0, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 };
    fireBell(S0, { reg: S0.reg, snap: {}, rng: mulberry32(1), t: BELL_PERIOD_S });
    ok("F1/3a: ws.results.leaks still initialized (dead field reads 0)", S0.ws.results.leaks === 0);
  }

  // (a2) an enemy parked at your depot for 30 simulated seconds neither
  // despawns nor costs anything — he stays, fights, and his structure fire
  // chews depot masonry (the shared hostile-structure set makes "depot"
  // chunks targetable by team 2 — the Task 3/4 interlock).
  {
    const { hcs, pitch, mass } = MASON;
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatF, seed: 31 });
    const chunks = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 2; iy++) for (let iz = 0; iz < 1; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - 1) * pitch, y: hcs + 0.02 + iy * pitch, z: 20 + iz * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = "depot"; chunks.push(c);
    }
    const home = chunks.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const u = spawnUnit(world, { x: 0, z: 8 }, "");
    u.pos.x = 0; u.pos.z = 8; // parked well inside rifle range of the lattice
    world.dt = 1 / 60;
    for (let i = 0; i < 30 * 60; i++) {
      stepUnits(world, straightGrid(0, 1), identFwdDir);
      stepWorld(world);
    }
    ok("F1/3a2: parked enemy persists 30s (no despawn, no leak events)",
      world.byId.has(u.id) && u.alive && !world.events.some((e) => e.type === "leak"),
      `alive=${u.alive}`);
    // Masonry falls by DISPLACEMENT, not hit points (core.js: chunks take
    // blast impulse; hp damage covers units/vehicles, and the structure hp
    // loop covers wall/tower/rock). The observable for "his fire chews the
    // building" is physical: he acquires a depot chunk and his rounds shove
    // stones off their homes (weld-free fixture so single stones can move).
    ok("F1/3a2: he acquires depot masonry as a target", u.tgtId != null && chunks.some((c) => c.id === u.tgtId), `tgt=${u.tgtId}`);
    const moved = home.filter((h) => {
      const b = world.byId.get(h.id);
      if (!b) return true;
      return Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05;
    }).length;
    ok("F1/3a2: his structure fire physically works the masonry (stones shoved off home)", moved > 0, `moved=${moved}/${chunks.length}`);
  }

  // (b) the bell cycles forever: 60 bells deep the muster still fields men
  // and nothing has ended the run.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 4000, tanks: 40, heads0: 4000, tanks0: 40, scrap: 200 };
    const rng = mulberry32(303);
    for (let w = 0; w < 60; w++) {
      S.reg.scrap += 60; // a steady income so the deep run keeps mustering
      fireBell(S, { reg: S.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
    }
    ok("F1/3c: bell 60 still musters, run alive",
      S.bell === 60 && S.ws.spawnQueue > 0 && !S.victory && !S.gameOver,
      `bell=${S.bell} queue=${S.ws.spawnQueue}`);
    ok("F1/3c: no FINAL WAVE copy on any bell card", !S.lastDispatch.lines.some((l) => l.includes("FINAL WAVE")));
  }

  // (c) forced combatIneffective sets NO victory; its dispatch line appears
  // exactly once (the bureau reports; the guns finish it).
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective
    const rng = mulberry32(404);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S });
    ok("F1/3b: combat-ineffective regiment sets NO victory", S.victory === false && S.gameOver === false);
    const line1 = S.lastDispatch.lines.find((l) => /combat-ineffective/i.test(l));
    ok("F1/3b: the observation line appears at the bell", !!line1, JSON.stringify(S.lastDispatch.lines));
    ok("F1/3b: observation is digit-free bureau voice", line1 && !/\d/.test(line1), line1);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("F1/3b: the observation appears only once (second bell silent)",
      !S.lastDispatch.lines.some((l) => /combat-ineffective/i.test(l)), JSON.stringify(S.lastDispatch.lines));
  }

  // (c2) three starved musters: NO victory; a one-time spent observation.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = starvedReg();
    const rng = mulberry32(505);
    for (let i = 0; i < 3; i++) { S.reg.scrap = 0; fireBell(S, { reg: S.reg, snap: {}, rng, t: (i + 1) * BELL_PERIOD_S }); }
    ok("F1/3b: three starved musters set NO victory (spent retired as an ending)",
      S.victory === false && S.gameOver === false, `victory=${S.victory} spent=${S.spent}`);
    ok("F1/3b: spent observation line appears once, digit-free (re-pinned mk1.13 — spent by manpower)",
      S.lastDispatch.lines.some((l) => /spent/i.test(l) && !/\d/.test(l)), JSON.stringify(S.lastDispatch.lines));
    S.reg.scrap = 0;
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 4 * BELL_PERIOD_S });
    ok("F1/3b: spent observation not repeated", !S.lastDispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(S.lastDispatch.lines));
  }

  // (d) exhaustive: the only two enders are the two breaches. Force every
  // retired condition — regiment stub, ledger/book-value, attrition, spent —
  // and assert no end; then the two breaches still end it.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 5, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective AND broke
    ok("F1/3b: checkLoss without breach never fires (regiment stub only)", checkLoss(S) === false && !S.gameOver);
    const rng = mulberry32(606);
    for (let i = 0; i < 4; i++) { S.reg.scrap = 0; fireBell(S, { reg: S.reg, snap: {}, rng, t: (i + 1) * BELL_PERIOD_S }); }
    ok("F1/3d: no retired condition ends the run",
      !S.victory && !S.gameOver && !S.breach && !S.enemyBreach, `v=${S.victory} go=${S.gameOver}`);
    checkEnemyBreach(S, 0.1);
    ok("F1/3d: enemy breach still ends it (victory)", S.victory === true && S.enemyBreach === true);
    const S2 = makeRunState();
    checkDepotBreach(S2, 0.1);
    ok("F1/3d: player breach still ends it (loss)", S2.gameOver === true && S2.breach === true);
  }

  // (e) twin determinism: two identical drives through the bell cycle produce
  // identical dispatch/flag traces from the same seeded stream.
  {
    const drive = () => {
      const S = makeRunState();
      S.started = true;
      S.reg = { heads: 400, tanks: 8, heads0: 400, tanks0: 8, scrap: 120 };
      const rng = mulberry32(909);
      const trace = [];
      for (let w = 0; w < 8; w++) {
        fireBell(S, { reg: S.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
        trace.push(JSON.stringify([S.bell, S.ws.spawnQueue, S.lastDispatch.lines, S.victory, S.gameOver]));
      }
      return trace.join("|");
    };
    ok("F1/3e: twin determinism through the bell cycle", drive() === drive());
  }
}
// ==== end FRONT F1 Task 3 ====================================================







// ==== mk0.23 TROOP IDENTITY (render kit) =====================================
// The look is a PURE function of team/utype/tag/role — pin every unit type on
// both sides, and pin that nothing outside DEPOT changes at all.
{
  const mk = (o) => ({ team: 2, alive: true, ...o });
  const nProps = (k) => k.props.filter(Boolean).length;

  // --- non-DEPOT parity: the frozen demo / sandbox / TD / campaign look
  for (const b of [mk({ team: 1, utype: "rifles" }),
                   mk({ utype: "gren" }), mk({ team: 1, utype: "mg", role: "gunner" })]) {
    const k = troopKit(b, false);
    ok(`kit: non-DEPOT ${b.utype || b.tag || "conscript"} is untouched (base palette, no bulk, rifle 1, zero props)`,
      k.pal === (b.utype === "gren" ? "gren" : "con") && k.bw === 1 && k.bh === 1 && k.rifle === 1 && nProps(k) === 0);
  }

  // --- coat = side (DEPOT only)
  ok("kit: player infantry wear the warm rust coat", troopKit(mk({ team: 1, utype: "rifles" }), true).pal === "con");
  ok("kit: enemy infantry wear the cold slate coat", troopKit(mk({ tag: "" }), true).pal === "gren");
  ok("kit: the enemy grenadier is unchanged (already slate)", troopKit(mk({ utype: "gren" }), true).pal === "gren");

  // --- bulk
  {
    const c = troopKit(mk({ tag: "" }), true);
    ok("kit: the conscript keeps his own frame", c.bw === 1 && c.bh === 1);
  }

  // --- weapon slot per role, both sides
  const cases = [
    ["player rifleman", mk({ team: 1, utype: "rifles" }), 1, 0],
    ["enemy conscript", mk({ tag: "" }), 1, 0],
    ["player sniper", mk({ team: 1, utype: "sniper", role: "sniper" }), 1, 2],
    ["enemy marksman", mk({ tag: "sniper", role: "sniper", dress: "android" }), 1, 2],
    ["player sapper", mk({ team: 1, utype: "sappers" }), 0, 1],
    ["enemy sapper", mk({ tag: "sapper" }), 0, 1],
    ["mortar man", mk({ team: 1, utype: "mortars" }), 0, 1],
    ["MG gunner", mk({ team: 1, utype: "mg", role: "gunner" }), 0.8, 3],
    ["MG loader", mk({ team: 1, utype: "mg", role: "loader" }), 0, 0],
  ];
  for (const [name, b, rifle, np] of cases) {
    const k = troopKit(b, true);
    ok(`kit: ${name} carries rifle=${rifle} props=${np}`, k.rifle === rifle && nProps(k) === np, `got rifle=${k.rifle} props=${nProps(k)}`);
  }
  // the spotter is owned by the pair look, not the kit
  for (const b of [mk({ team: 1, utype: "sniper", role: "spotter" }), mk({ tag: "sniper", role: "spotter", dress: "android" })]) {
    const k = troopKit(b, true);
    ok("kit: the spotter is untouched by the kit (the pair look owns him)", k.rifle === 1 && nProps(k) === 0);
  }

  // --- the sniper's scope really is ON the barrel, and the long barrel butts
  // onto the muzzle: both derived from the rifle's baked preRot, not eyeballed
  {
    const { fwd, up } = barrelBasis(RIFLE_PREROT);
    const len = (v) => Math.hypot(v[0], v[1], v[2]);
    ok("kit: barrelBasis is orthonormal", Math.abs(len(fwd) - 1) < 1e-9 && Math.abs(len(up) - 1) < 1e-9 &&
      Math.abs(fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2]) < 1e-9);
    const [scope, longb] = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).props;
    const rel = (p) => [p[0] - RIFLE_OFF[0], p[1] - RIFLE_OFF[1], p[2] - RIFLE_OFF[2]];
    const along = (p) => { const r = rel(p); return r[0] * fwd[0] + r[1] * fwd[1] + r[2] * fwd[2]; };
    const off = (p) => { const r = rel(p); return r[0] * up[0] + r[1] * up[1] + r[2] * up[2]; };
    const side = (p) => { const r = rel(p), a = along(p), o = off(p);
      return Math.hypot(r[0] - a * fwd[0] - o * up[0], r[1] - a * fwd[1] - o * up[1], r[2] - a * fwd[2] - o * up[2]); };
    ok("kit: the scope sits ON the barrel axis (no lateral drift), clear of it by its own radius",
      side(scope.off) < 1e-9 && Math.abs(off(scope.off) - 0.055) < 1e-9 && Math.abs(along(scope.off)) < RIFLE_LEN / 2,
      `side=${side(scope.off)} off=${off(scope.off)} along=${along(scope.off)}`);
    ok("kit: the scope is aimed down the barrel, not tilted by hand", scope.aim === "barrel" && !scope.tilt);
    ok("kit: the long barrel butts onto the muzzle end and extends the reach",
      side(longb.off) < 1e-9 && longb.aim === "barrel" && along(longb.off) < -RIFLE_LEN / 2, `along=${along(longb.off)}`);
    ok("kit: the scoped rifle itself is never sheared (uniform scale only)",
      troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).rifle === 1);
  }

  // --- the MG bipod is TWO legs, splayed, not a flat slab
  {
    const [rec, legL, legR] = troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).props;
    ok("kit: the MG receiver rides the barrel", rec.aim === "barrel");
    ok("kit: the bipod is two separate legs, mirrored about the gun centreline",
      !!legL && !!legR && legL.tilt[0] === 2 && legR.tilt[0] === 2 && legL.tilt[1] === -legR.tilt[1] && legL.tilt[1] !== 0);
    ok("kit: the two legs splay to opposite sides and hang below the muzzle",
      Math.sign(legL.off[0] - legR.off[0]) === -1 && legL.off[1] === legR.off[1] && legL.off[1] < 0.45);
    ok("kit: each leg is a slender upright, not a slab", legL.s[1] > 5 * legL.s[0] && legL.s[0] === legL.s[2]);
    ok("kit: the MG gun is short (uniform scale, no shear)", troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).rifle < 1);
  }

  // --- fog: every prop and weapon goes back to the generic man-shape
  {
    const g = troopKit(mk({ tag: "gren" }), true, true), s = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true, true);
    ok("kit: the fog seam takes every prop and weapon back to the generic man-shape",
      nProps(g) === 0 && nProps(s) === 0 && g.rifle === 1 && s.rifle === 1);
  }

  // --- determinism: same body in, same look out; no hidden state
  {
    const b = mk({ team: 1, utype: "mg", role: "gunner" });
    const a1 = JSON.stringify(troopKit(b, true)), a2 = JSON.stringify(troopKit(b, true));
    ok("kit: troopKit is pure (identical output for identical body)", a1 === a2);
  }

  // --- the part table's spare slots are real and inert
  ok("kit: INFANTRY.con carries three spare prop slots",
    ["prop", "prop2", "prop3"].every((k) => INFANTRY.con.some((p) => p.key === k)));
  ok("kit: the grenadier table gained nothing", !INFANTRY.gren.some((p) => /^prop/.test(p.key)));
  ok("kit: the MG team spawns as gunner + loader", (() => {
    const world = makeWorld(11);
    world.field = { heightAt: () => 0 };
    const sq = makeSquad(9, "mg", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const roles = sq.memberIds.map((id) => world.byId.get(id).role);
    return roles[0] === "gunner" && roles[1] === "loader";
  })());
}
// ==== end mk0.23 TROOP IDENTITY ==============================================



// ==== mk0.27: NO TAP GOES SILENTLY MISSING ===================================
{
  console.log("\n[mk0.27: confirm-tap thefts]");
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  const pending = { gx: 1, gz: 1, mode: "mg", cost: 20, armedAt: 5 };

  // (a) the unarmed ✓ tap: inert, but the pending survives untouched, so the
  // next tap still resolves normally (it is not a swallowed tap).
  ok("mk0.27/a: an unarmed pending is not confirmable", pendingArmed(pending, 4.9) === false);
  ok("mk0.27/a: the pending still resolves on the next canvas tap (buttons on screen)",
    canvasTapConsumesPending(pending, { x: 400, y: 300 }, rect) === true);

  // (b) the pan theft: buttons off the viewport -> a canvas tap is NOT eaten.
  ok("mk0.27/b: buttons panned off the right edge are not visible",
    pendingButtonsVisible({ x: 799, y: 300 }, rect) === false);
  ok("mk0.27/b: buttons panned above the top edge are not visible",
    pendingButtonsVisible({ x: 400, y: 2 }, rect) === false);
  ok("mk0.27/b: an unprojectable anchor (behind the camera) is not visible",
    pendingButtonsVisible(null, rect) === false);
  ok("mk0.27/b: a canvas tap is NOT consumed while the buttons are off-screen",
    canvasTapConsumesPending(pending, { x: 900, y: 300 }, rect) === false);
  ok("mk0.27/b: no pending at all consumes nothing",
    canvasTapConsumesPending(null, { x: 400, y: 300 }, rect) === false);
  ok("mk0.27/b: the edge pad is a real margin", PENDING_EDGE_PAD > 0
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD - 1, y: 300 }, rect) === false
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD, y: 300 }, rect) === true);

  // (c) the wiring: DepotGame uses both, says something on the inert tap, and
  // auto-cancels the pending when its anchor leaves the viewport.
  {
    const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.27/c: the canvas-tap pending-clear goes through canvasTapConsumesPending",
      /canvasTapConsumesPending\(S\.pending, S\.pendingScreen/.test(src));
    ok("mk0.27/c: the unarmed ✓ tap toasts instead of vanishing",
      /if \(!pendingArmed\(p, world\.t\)\) \{[^}]*toast\(/.test(src.replace(/\n/g, " ")));
    ok("mk0.27/c: a pending whose anchor leaves the viewport auto-cancels with a toast",
      /pendingButtonsVisible\(/.test(src) && /PLACEMENT CANCELLED/.test(src));
  }
}
// ==== end mk0.27 =============================================================


// ==== mk0.29: THE ENDING'S DIGNITY + SAFE EXITS ==============================
// Three repairs: the end card's RETURN TO BASE button actually leaves; the
// card waits ~6s after the breach so the collapse can play out; and the
// in-game MENU button arms before it drops you out of a live battle.
{
  console.log("\n[mk0.29: the ending's dignity]");

  // (a) the stamp + the gate.
  ok("mk0.29/a: the end card waits about six seconds", END_CARD_DELAY_S >= 4 && END_CARD_DELAY_S <= 10, `delay=${END_CARD_DELAY_S}`);
  {
    const S = { gameOver: false, victory: false };
    stampEnd(S, 100);
    ok("mk0.29/a: no verdict, no stamp", S.endedAt == null);
    S.gameOver = true;
    stampEnd(S, 100);
    ok("mk0.29/a: the verdict stamps the world clock once", S.endedAt === 100);
    stampEnd(S, 140);
    ok("mk0.29/a: later ticks never re-stamp", S.endedAt === 100);
    ok("mk0.29/a: the card is held back while the collapse plays",
      endCardReady(S, 100) === false && endCardReady(S, 100 + END_CARD_DELAY_S - 0.01) === false);
    ok("mk0.29/a: the card arrives once the delay is served",
      endCardReady(S, 100 + END_CARD_DELAY_S) === true);
    ok("mk0.29/a: no verdict, no card", endCardReady({ endedAt: 5 }, 1e9) === false);
  }

  // (b) both verdicts stamp, from either breach.
  {
    const loss = { gameOver: false, victory: false };
    checkDepotBreach(loss, 0.1); stampEnd(loss, 12.5);
    ok("mk0.29/b: our depot falling stamps the ending", loss.gameOver === true && loss.endedAt === 12.5);
    const win = { gameOver: false, victory: false };
    checkEnemyBreach(win, 0.1); stampEnd(win, 30);
    ok("mk0.29/b: their depot falling stamps it too", win.victory === true && win.endedAt === 30);
    ok("mk0.29/b: neither card shows immediately",
      endCardReady(loss, 12.5) === false && endCardReady(win, 30) === false);
  }

  // (c) the wiring: the world keeps simming through the delay, orders and
  // building lock at the verdict, and the end dispatch is a STABLE object —
  // that last one is the dead-button bug: a fresh dispatch object every HUD
  // tick re-ran Dispatch's arming effect, so RETURN TO BASE never armed.
  {
    const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.29/c: the end dispatch is memoized (the arming effect stops resetting)",
      /useMemo\([^)]*\n?[^;]*makeEndDispatch/.test(src) || /const endDispatch = useMemo/.test(src));
    ok("mk0.29/c: the card mount waits on the delay gate", /hud\.endCard/.test(src));
    ok("mk0.29/c: the sim keeps running until the card is up",
      /const cardUp = /.test(src) && /S\.paused \|\| !S\.started \|\| cardUp/.test(src));
    ok("mk0.29/c: orders lock at the verdict", /orderSquad = \(kind\) => \{[^}]*gameOver/.test(src.replace(/\n/g, " ")));
    ok("mk0.29/c: building locks at the verdict", /setMode = \(m\) => \{[^}]*gameOver/.test(src.replace(/\n/g, " ")));
    ok("mk0.29/c: the MENU button arms before it leaves the field",
      /data-menu-exit/.test(src) && /LEAVE THE FIELD\?/.test(src) && /menuArmed/.test(src));
  }
}
// ==== end mk0.29 =============================================================

