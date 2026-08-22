// COLDSNAP suite era 19 — THE ATOMIC LOOK AND THE DRESS (mk2.12). Mechanics
// and wiring pins only — the look itself belongs to the owner's eyes, live.
// No fixture world; troopKit is pure. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
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
{
  const r = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("look: the smoke pool rises for the cloud", r.includes("SMOKE_CAP = 384"));
  ok("look: the flash uniform exists", r.includes("uFlash"));
  ok("look: the boom branch knows the davy", r.includes('e.weapon === "davy"'));
  ok("look: the davy palette joins the man loop", r.includes("DAVY_LIVE"));
  const p = fs.readFileSync(new URL("../../src/render/portrait.js", import.meta.url), "utf8");
  ok("look: the portrait wears the orange too", p.includes("DAVY_HEX"));
}
