import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";

// ==== mk2.90: the order chain ===============================================
// Queued orders pop at the arrival seam: move/attack chain, patrol is
// terminal, an empty chain digs in as today. The hull fixture is the armor
// attack test's own. Seeds rolled each run.
{
  console.log("\n[mk2.90: the order chain]");
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

  // (a) the hull's chain: move A, then a queued patrol — it ends patrolling
  {
    const w = makeWorld({ field: flatF, seed: SEED + 0 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 10, z: 0 };
    v._queue = [{ kind: "patrol", ax: 10, az: 8, bx: 10, bz: -8 }];
    for (let i = 0; i < 10800 && v.order !== "patrol"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(a) the hull pops the queued patrol on arrival", v.order === "patrol" && v._patA && Math.abs(v._patA.x - 10) < 0.01 && Math.abs(v._patA.z - 8) < 0.01, `${v.order}`);
    ok("(a) the chain is consumed", !v._queue || v._queue.length === 0, v._queue && `${v._queue.length} left`);
  }

  // (b) the hull's chain of moves: A then B, defend at B when the chain runs dry
  {
    const w = makeWorld({ field: flatF, seed: SEED + 1 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "move", x: 20, z: 10 }];
    for (let i = 0; i < 10800 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(b) the dry chain digs in at the LAST link", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z - 10) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (c) the squad's chain of moves: A then B, defend at B
  {
    const w = makeWorld({ field: flatF, seed: SEED + 2 }); w.depotCombat = true;
    const sq = makeSquad(1, "rifles", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "move", x: 12, z: 6 }];
    for (let i = 0; i < 9600 && sq.order !== "defend"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(c) the squad walks the chain and digs in at the last link", sq.order === "defend" && Math.hypot(sq.anchor.x - 12, sq.anchor.z - 6) < 3, `${sq.order} at ${sq.anchor.x.toFixed(1)},${sq.anchor.z.toFixed(1)}`);
    ok("(c) the squad's chain is consumed", !sq._queue || sq._queue.length === 0);
  }

  // (d) the squad's queued patrol is terminal — it patrols, both ends set
  {
    const w = makeWorld({ field: flatF, seed: SEED + 3 }); w.depotCombat = true;
    const sq = makeSquad(2, "rifles", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "patrol", ax: 0, az: 6, bx: 0, bz: -6 }];
    for (let i = 0; i < 9600 && sq.order !== "patrol"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(d) the squad pops the queued patrol", sq.order === "patrol" && sq._patA && Math.abs(sq._patA.z - 6) < 0.01 && sq._patB && Math.abs(sq._patB.z + 6) < 0.01, sq.order);
  }
}
