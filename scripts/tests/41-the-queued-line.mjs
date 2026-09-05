import { ok } from "./harness.mjs";
import { makeWorld, stepWorld } from "../../src/engine/core.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";

// ==== mk2.94: the queued line ===============================================
// A line entry never pops in the squad module — the squad digs in on arrival
// and the entry waits for the game layer's hook. Seed rolled each run. The
// hook itself is interface-side; the pins carry it.
{
  console.log("\n[mk2.94: the queued line]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special
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
}
