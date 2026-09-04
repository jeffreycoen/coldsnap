import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";

// ==== mk2.88: the armor attack order ========================================
// ATTACK for hulls: drive the road, halt to fight any live foe the guns can
// reach, roll on when the ground is quiet, defend on arrival. The fixture is
// the hunt test's own (11-hiring-hall (f)). Seeds rolled each run.
{
  console.log("\n[mk2.88: the armor attack order]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special (owner, 2026-09-04)
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
  const mkHull = (w, drv, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = drv === "apc" ? "apc" : "bison"; v.drv = drv; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    v.homeX = x; v.homeZ = z;
    return v;
  };
  const mkFoe = (w, x, z, hp) => { const u = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x, y: 0.74, z, hp }); u.pinned = true; return u; }; // pinned: the target stands whatever the dice, so the halt geometry is seed-free

  // (a) a live foe in the gun's reach halts the attacking hull where it stands
  {
    const w = makeWorld({ field: flatF, seed: SEED + 0 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    mkFoe(w, 0, 0, 50000);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 1200; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(a) the attacking hull halts to fight", Math.hypot(v.pos.x + 20, v.pos.z) < 5, `${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
    ok("(a) the order holds through the fight", v.order === "attack", v.order);
    ok("(a) the gun scan stamped the foe clock", (v._foeT || 0) > 3, `_foeT ${(v._foeT || 0).toFixed(1)}`);
  }

  // (b) a quiet road: ATTACK drives through and digs in, exactly MOVE's end
  {
    const w = makeWorld({ field: flatF, seed: SEED + 1 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 3600 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(b) a quiet attack arrives and defends", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (c) the foe falls, the ground goes quiet, the hull rolls on
  {
    const w = makeWorld({ field: flatF, seed: SEED + 2 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    mkFoe(w, 0, 4, 40);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 3600 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(c) the foe falls and the hull rolls on to the destination", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (d) the transport halts too — its coax is a gun; it stops short of the
  // foe (mg reach 18) and stands fighting, never arriving
  {
    const w = makeWorld({ field: flatF, seed: SEED + 3 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "apc", -20, 0);
    mkFoe(w, 0, 0, 50000);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 1200; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(d) the transport stands fighting short of the foe", v.pos.x < -10 && v.order === "attack", `${v.pos.x.toFixed(1)}, ${v.order}`);
  }

  // (e) pins: the mech's own halt and stamp (its fixture is heavy; the
  // walker shares ATTACK's exact clock and hold by these lines)
  const dsrc = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(e) pins: the mech honors the halt", /order === "attack" && world\.t - \(b\._foeT \|\| 0\) < ATTACK_HOLD_S/.test(dsrc));
  ok("(e) pins: the mech gun stamps the clock", /if \(tgt\) b\._foeT = world\.t;/.test(dsrc));

  // (f) pins: the pie wedge and the ground tap
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(f) pins: the vehicle pie carries ATTACK", /key: "attack", icon: "✕", label: "ATTACK"/.test(dg));
  ok("(f) pins: the attack tap sets the order", /v\.order = om; v\.dest = \{ x: d\.x, z: d\.z \}; v\._route = null; v\._routeDest = null; v\._queue = null;/.test(dg));
}
