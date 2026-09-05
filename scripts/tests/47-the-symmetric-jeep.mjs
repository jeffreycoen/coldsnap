import { ok } from "./harness.mjs";
import { makeWorld } from "../../src/engine/core.js";
import { makeMap, TOWN, makeGrid } from "../../src/depot/mapgen.js";
import { parkArmor } from "../../src/depot/muster.js";
import { JEEP } from "../../src/depot/specs.js";

// ==== mk3.03: the symmetric jeep ============================================
// SYMMETRY IS LAW — the enemy's jeep parks through the same door with the
// same fit. Seed rolled each run.
{
  console.log("\n[mk3.03: the symmetric jeep]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);

  // (a) parkArmor fields a REAL jeep for team 2 — spec, springs, fit and all
  {
    const map = makeMap(SEED);
    const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flat, seed: SEED });
    const grid = makeGrid(flat);
    const depotE = TOWN.find((t) => t.depot && t.team === 2);
    let seq = 0;
    parkArmor(w, grid, flat, depotE, 2, "jeep", () => ++seq, map);
    const v = w.bodies.find((b) => b.kind === "vehicle" && b.vtype === "jeep" && b.team === 2);
    ok("(a) the enemy's jeep parks through the one door", !!v, v ? "parked" : "no jeep");
    ok("(a) it wears the jeep's own spec, not the Bison's", !!v && v.hx === JEEP.hx && v.maxHp === JEEP.hp && v.bounty === JEEP.bounty, v ? `${v.hx}/${v.maxHp}/${v.bounty}` : "-");
    ok("(a) it rides the springs with the full fit", !!v && !!v.susp && v.fords === true && v.eyeR === JEEP.eye && v.gear === "2h" && v.drv === "jeep" && v.apcSeq === 1, v ? `${!!v.susp}/${v.fords}/${v.eyeR}/${v.gear}/${v.drv}/${v.apcSeq}` : "-");
  }
}
