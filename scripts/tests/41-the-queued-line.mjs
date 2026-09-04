import { ok } from "./harness.mjs";
import { makeWorld, stepWorld } from "../../src/engine/core.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import fs from "node:fs";

// ==== mk2.94: the queued line ===============================================
// A line entry never pops in the squad module — the squad digs in on arrival
// and the entry waits for the game layer's hook. Seed rolled each run. The
// hook itself is interface-side; the pins carry it.
{
  console.log("\n[mk2.94: the queued line]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special (owner, 2026-09-04)
  console.log("  fixture seed base", SEED);
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the seam leaves a line entry alone: arrive, dig in, entry kept
  {
    const w = makeWorld({ field: flatF, seed: SEED + 0 }); w.depotCombat = true;
    const sq = makeSquad(1, "engineers", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "line", line: "bags", ax: 2, az: 0, bx: 8, bz: 0 }];
    for (let i = 0; i < 9600 && sq.order !== "defend"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(a) the squad digs in at the line's doorstep", sq.order === "defend" && Math.hypot(sq.anchor.x, sq.anchor.z) < 3, `${sq.order} at ${sq.anchor.x.toFixed(1)},${sq.anchor.z.toFixed(1)}`);
    ok("(a) the line entry waits for the game layer", sq._queue && sq._queue.length === 1 && sq._queue[0].kind === "line", sq._queue ? `${sq._queue.length} left` : "gone");
  }

  // (b) pins: the game-layer hook, its wiring, and the interface
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(b) pins: the hook prices the line and waits", /input\.stepChainBuild = \(sq\) => \{/.test(dg) && /if \(run\.resources < price\) return; \/\/ stand and wait/.test(dg));
  ok("(b) pins: the hook starts the line it shifts", /sq\._queue\.shift\(\); if \(!sq\._queue\.length\) sq\._queue = null;\n\s*startBuildLine\(grid, sq, q\.line, a, b, toast\);/.test(dg));
  ok("(b) pins: the accept appends under the light", /push\(\{ kind: "line", line: lp\.kind, ax: lp\.a\.x, az: lp\.a\.z, bx: lp\.b\.x, bz: lp\.b\.z \}\);/.test(dg));
  ok("(b) pins: the plain line wipes the chain", /startBuildLine\(grid, sq, lp\.kind, lp\.a, lp\.b, toast\); sq\._queue = null;/.test(dg));
  ok("(b) pins: the flags mark the line's start", /line: q\.kind === "line" \? 1 : 0/.test(dg) && /f\.line \? "▤"/.test(dg));
  const ss = fs.readFileSync("src/depot/sim.js", "utf8");
  ok("(b) pins: the sim calls the hook at tick cadence", /if \(!sq\._build && input\.stepChainBuild\) input\.stepChainBuild\(sq\);/.test(ss));
  const sqs = fs.readFileSync("src/depot/squads.js", "utf8");
  ok("(b) pins: the seam refuses line entries", /squad\._queue\.length && squad\._queue\[0\]\.kind !== "line"\) \{/.test(sqs));
}
