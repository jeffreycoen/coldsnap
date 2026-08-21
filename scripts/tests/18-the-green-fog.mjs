// COLDSNAP suite era 18 — THE GREEN FOG (mk2.09). The atomic blast's poison
// ground: radius 6, 4 a second, both sides, 25 seconds, restart never stack.
// Fixture seed: 5. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField, makeWorld, addBody, explode } from "../../src/engine/core.js";
import { addFogPatch, stepFog, FOG_S } from "../../src/depot/fog.js";
import { DAVY_FIRE } from "../../src/depot/specs.js";

{
  const world = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  world.depotCombat = true;
  const fog = [];
  addFogPatch(fog, 0, 0, world.t);
  ok("fog: a patch stands 25 seconds", fog.length === 1 && Math.abs(fog[0].until - FOG_S) < 1e-9);
  const mine = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 2, y: 1.1, z: 0, hp: 58 });
  const theirs = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -2, y: 1.1, z: 0, hp: 58 });
  const outside = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 20, y: 1.1, z: 0, hp: 58 });
  stepFog(world, fog, 0.25);
  ok("fog: poisons our man", Math.abs(mine.hp - 57) < 1e-6);
  ok("fog: poisons its man the same", Math.abs(theirs.hp - 57) < 1e-6);
  ok("fog: spares the man outside", outside.hp === 58);
  addFogPatch(fog, 1, 0, world.t);
  ok("fog: a fresh blast on old ground restarts, never stacks", fog.length === 1);
  world.t = FOG_S + 1;
  stepFog(world, fog, 0.25);
  ok("fog: the patch expires", fog.length === 0);
}
{
  // the boom names its gun — the guarded divergence the game layer hooks
  const world = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  explode(world, 0, 1, 0, { ...DAVY_FIRE, r: 2, attacker: "player" });
  const boom = world.events.find((e) => e.type === "boom");
  ok("fog: the davy boom carries its weapon tag", !!boom && boom.weapon === "davy");
  const plain = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  explode(plain, 0, 1, 0, { r: 2, dmg: 5, kv: 1, kind: "shell" });
  const b2 = plain.events.find((e) => e.type === "boom");
  ok("fog: an untagged boom keeps the old shape", !!b2 && !("weapon" in b2));
  // the wiring pins: the boom hook, the territory-clock tick, the save row
  const dg = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("fog: the game layer hooks the davy boom", dg.includes("addFogPatch(S.fog, e.x, e.z"));
  ok("fog: the patches tick on the territory clock", dg.includes("stepFog(world, S.fog"));
  const sv = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
  ok("fog: the patches ride the save", sv.includes("fog: (S.fog || [])"));
}
