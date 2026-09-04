import { ok } from "./harness.mjs";
import { apcBySeq } from "../../src/depot/transports.js";
import { JEEP } from "../../src/depot/specs.js";
import fs from "node:fs";

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

  // (c) pins: the axle roll, the hatch, the one-gun possession
  const rr = fs.readFileSync("src/graphics/renderer.js", "utf8");
  ok("(c) pins: the wheels roll about their own axle", /wh\.rotateY\(spd \* 0\.04\);/.test(rr) && !/wh\.rotation\.y \+= spd/.test(rr));
  const tr = fs.readFileSync("src/depot/transports.js", "utf8");
  ok("(c) pins: the hatch knows the jeep", /if \(b\.vtype === "apc" \|\| b\.vtype === "jeep"\) b\._hatch/.test(tr));
  const tk = fs.readFileSync("src/depot/tick.js", "utf8");
  ok("(c) pins: the possessed jeep fires its coax, not the shell", /\(pv\.vtype === "apc" \|\| pv\.vtype === "jeep"\) possessedArmorMg/.test(tk));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(c) pins: one gun, FIRE alone — no MG button on the jeep", /hud\.possessed\.vtype !== "apc" && hud\.possessed\.vtype !== "jeep" && \(/.test(dg));
}
