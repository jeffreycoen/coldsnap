// COLDSNAP suite era 21 — THE BROKEN RIDGE (mk2.14). The atomic blast breaks
// the rocks near it (the game layer's breach spawns the tumbling chunks);
// farther rocks survive and re-seat onto the carved ground instead of
// floating. Fixture seed: 13. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField, makeWorld, addBody, explode } from "../../src/engine/core.js";
import { DAVY_FIRE } from "../../src/depot/specs.js";

{
  const field = makeField(41, 2.0, 13);
  field.carveFloor = -12;
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true; world._tdStruct = true;
  const near = addBody(world, { kind: "rock", team: 0, mass: 0, hx: 2, hy: 2.5, hz: 2, x: 3, y: field.heightAt(3, 0) - 0.6, z: 0, hp: 90 + 3.4 * 20 });
  near.seatY = near.pos.y - field.heightAt(3, 0);
  const far = addBody(world, { kind: "rock", team: 0, mass: 0, hx: 2, hy: 2.5, hz: 2, x: 20, y: field.heightAt(20, 0) - 0.6, z: 0, hp: 90 + 3.4 * 20 });
  far.seatY = far.pos.y - field.heightAt(20, 0);
  const h0 = field.heightAt(0, 0);
  explode(world, 0, h0 + 0.5, 0, { ...DAVY_FIRE, r: DAVY_FIRE.blastR, attacker: "player" });
  ok("ridge: the ground carved", field.heightAt(0, 0) < h0);
  ok("ridge: the near rock breaks", !near.alive);
  ok("ridge: the far rock survives on falloff", far.alive);
  ok("ridge: the far rock re-seats onto the carved ground", Math.abs(far.pos.y - (field.heightAt(20, 0) + far.seatY)) < 1e-6);
}
{
  const g = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const bootSrcR = fs.readFileSync(new URL("../../src/depot/boot.js", import.meta.url), "utf8");
  const tickSrcR = fs.readFileSync(new URL("../../src/depot/tick.js", import.meta.url), "utf8");
  ok("ridge: rock health is the soft table", bootSrcR.includes("hp: 90 + k.r * 20"));
  ok("ridge: rocks carry their seat depth", bootSrcR.includes("b.seatY = b.pos.y - field.heightAt(k.x, k.z)"));
  ok("ridge: a davy burst re-lays the rock dressing", tickSrcR.includes('e.weapon === "davy"') && g.includes("setDressing({ rocks: rocksLive"));
}
