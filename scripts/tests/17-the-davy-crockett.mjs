// COLDSNAP suite era 17 — THE DAVY CROCKETT (mk2.08). Two men, one atomic
// round: the blast hurts both sides, the crew dies at the trigger, the
// crater reaches the deep floor, the kill law pays nobody for the crew.
// Fixture seeds: 7 (the firing world), 9 (the blast world). No seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld, addBody, stepWorld, explode } from "../../src/engine/core.js";
import { DAVY_FIRE, ENEMY_SPECS } from "../../src/depot/specs.js";
import { SQUAD_SPECS, makeSquad, squadSpeed } from "../../src/depot/squads.js";
import { spawnSquadMembers, stepDavyShot, scoreKill, makeRunState } from "../../src/depot/state.js";

{
  // one table, both sides — the spec rows agree
  ok("davy: squad row exists at 450, two men", SQUAD_SPECS.davy && SQUAD_SPECS.davy.n === 2 && SQUAD_SPECS.davy.cost === 450);
  ok("davy: the slowest crew on the map", squadSpeed("davy") === 2.0);
  ok("davy: enemy row mirrors price and speed", ENEMY_SPECS.davy.bounty === 450 && ENEMY_SPECS.davy.speed === 2.0);
  ok("davy: the fire table", DAVY_FIRE.dmg === 200 && DAVY_FIRE.blastR === 25 && DAVY_FIRE.crater === 10 && DAVY_FIRE.range === 20);
}
{
  // the blast hurts both sides; the crater reaches the deep floor (seed 9)
  const field = makeField(41, 2.0, 9);
  field.carveFloor = -12;
  const world = makeWorld({ field, seed: 9 });
  world.depotCombat = true; world._tdStruct = true;
  const mine = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 10, y: 1.1, z: 0, hp: 58 });
  const theirs = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -10, y: 1.1, z: 0, hp: 58 });
  explode(world, 0, 0.5, 0, { ...DAVY_FIRE, r: DAVY_FIRE.blastR, attacker: "player" });
  ok("davy: the blast hurts the enemy", theirs.hp < 58);
  ok("davy: the blast hurts our own the same", mine.hp < 58);
  ok("davy: the crater floor is deep", field.heightAt(0, 0) < -6);
}
{
  // the crew fires once under attack and dies at the trigger (seed 7)
  const field = makeField(41, 2.0, 7);
  const world = makeWorld({ field, seed: 7 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  sq.order = "attack"; sq.dest = { x: 0, z: 18 };
  const tgt = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.1, z: 15, hp: 58 });
  void tgt;
  const before = world.projectiles.length;
  for (let i = 0; i < 300 && !sq._davyFired; i++) stepDavyShot(world, sq, 1 / 120, null);
  ok("davy: one round leaves the tube", sq._davyFired === true && world.projectiles.length === before + 1);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("davy: the crew dies with the shot", crew.every((u) => u && !u.alive));
  // the crew's death pays and scores nobody (friendly fire under the kill law)
  const S = makeRunState();
  const paid = scoreKill(S, { type: "kill", attacker: "player", team: 1, kind: "unit", utype: "davy" }, null);
  ok("davy: the crew's death pays nobody", paid === null && S.score.p.kills === 0);
}
