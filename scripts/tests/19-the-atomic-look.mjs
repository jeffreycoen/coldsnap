// COLDSNAP suite era 19 — THE ATOMIC LOOK AND THE DRESS (mk2.12). Mechanics
// and wiring pins only — the look itself belongs to the owner's eyes, live.
// No fixture world; troopKit is pure. No seed is special.
import { ok } from "./harness.mjs";
import { troopKit, DAVY_HEX } from "../../src/render/troopkit.js";

{
  const kit = troopKit({ team: 1, utype: "davy", alive: true }, true, false);
  ok("dress: the crew wears the orange", kit.pal === "davy");
  ok("dress: no rifle — the tube is the tool", kit.rifle === 0 && !!kit.props[0]);
  const foe = troopKit({ team: 2, tag: "davy", alive: true }, true, false);
  ok("dress: its crew wears the same orange", foe.pal === "davy");
  ok("dress: the palette exists", typeof DAVY_HEX.dom === "number");
  const plain = troopKit({ team: 1, utype: "davy", alive: true }, false, false);
  ok("dress: outside the war the look is untouched", plain.pal === "con" && plain.rifle === 1);
}
