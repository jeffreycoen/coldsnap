import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";

// ==== mk2.93: the escort link ===============================================
// ESCORT closes a hull's chain: the arrival pop hands the hull its squad and
// the escort machinery takes over. The fixture is the order chain's own.
// Seeds rolled each run.
{
  console.log("\n[mk2.93: the escort link]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special
  console.log("  fixture seed base", SEED);
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const N = 44;
  const mkGrid = () => {
    const cells = Array.from({ length: N * N }, () => ({ blocked: false, terrain: false, ice: false, water: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null }));
    const G = { cells, w: N, h: N, cs: 2,
      idx: (gx, gz) => gz * N + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < N && gz >= 0 && gz < N,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (N >> 1), gz: Math.floor(z / 2) + (N >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (N >> 1)) * 2 + 1, z: (gz - (N >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    return G;
  };
  const mkHull = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    v.homeX = x; v.homeZ = z;
    return v;
  };
  const toUV = (x, z) => ({ u: x, v: z });

  // (a) move A, queued escort — the hull arrives and falls in behind its squad
  {
    const w = makeWorld({ field: flatF, seed: SEED + 0 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    const esq = { id: 7, anchor: { x: 30, z: 0 } };
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "escort", escortId: 7 }];
    for (let i = 0; i < 10800 && v.order !== "escort"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null, toUV, { squads: [esq] }); stepWorld(w); }
    ok("(a) the arrival pops the queued escort", v.order === "escort" && v.escortId === 7, `${v.order} / ${v.escortId}`);
    ok("(a) the chain is consumed", !v._queue || v._queue.length === 0);
  }

  // (b) a dead escort target: the pop lands, the escort machinery finds no
  // squad, and the hull digs in — no new code, the existing branch's own end
  {
    const w = makeWorld({ field: flatF, seed: SEED + 1 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "escort", escortId: 99 }];
    for (let i = 0; i < 10800 && !(v.order === "defend" && (!v._queue || !v._queue.length)); i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null, toUV, { squads: [] }); stepWorld(w); }
    ok("(b) a dead target ends the chain in defend", v.order === "defend" && (!v._queue || v._queue.length === 0), v.order);
  }

  // (c) pins: the mech shares the pop; the tap appends terminally; the flags skip it
  const dsrc = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(c) pins: the mech pops escort too", /q\.kind === "escort"\) \{ b\.order = "escort"; b\.escortId = q\.escortId;/.test(dsrc));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(c) pins: the escort tap appends and puts the light out", /push\(\{ kind: "escort", escortId: sq\.id \}\);/.test(dg));
  ok("(c) pins: the flags skip the escort leg", /if \(q\.kind === "escort"\) return null;/.test(dg));
}
