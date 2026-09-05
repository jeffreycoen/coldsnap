import { ok } from "./harness.mjs";
import { apcBySeq } from "../../src/depot/transports.js";
import { JEEP } from "../../src/depot/specs.js";

// ==== mk2.99: the jeep refit ================================================
// The four playtest defects: rolling wheels, boarding, size, one gun.
// No seeds — a synthetic world and source pins.
{
  console.log("\n[mk2.99: the jeep refit]");

  // (a) the boarding lookup finds a jeep by its seat number
  {
    const jeep = { kind: "vehicle", vtype: "jeep", apcSeq: 7, alive: true };
    const w = { bodies: [{ kind: "vehicle", vtype: "bison", apcSeq: 7, alive: true }, jeep] };
    ok("(a) the boarding lookup finds the jeep", apcBySeq(w, 7) === jeep, apcBySeq(w, 7) ? apcBySeq(w, 7).vtype : "null");
  }

  // (b) the body stands at Willys proportions
  ok("(b) the spec grew to the real footprint", JEEP.hx === 0.85 && JEEP.hz === 1.6 && JEEP.hy === 0.55, `${JEEP.hx}/${JEEP.hy}/${JEEP.hz}`);
}
