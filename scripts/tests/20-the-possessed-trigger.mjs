// COLDSNAP suite era 20 — THE POSSESSED TRIGGER (mk2.11, re-taught mk2.12).
// The atomic crew fires under the owner's hand like every unit: the round at
// the reticle, the crew alive at the trigger, the 30-second reload shared
// with the ATTACK path. Fixture seed: 11. No seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, possessedVolley } from "../../src/depot/state.js";

{
  const world = makeWorld({ field: makeField(41, 2.0, 11), seed: 11 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  const before = world.projectiles.length;
  const fired = possessedVolley(world, sq, { x: 0, z: 15 }, null);
  ok("trigger: the possessed crew fires the round", fired === 1 && world.projectiles.length === before + 1);
  ok("trigger: the reload clock is the ATTACK path's own", sq._davyReadyAt > world.t + 25);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("trigger: the crew lives at the trigger", crew.every((u) => u && u.alive));
  ok("trigger: no second round during the reload", possessedVolley(world, sq, { x: 0, z: 15 }, null) === 0);
  world.t = sq._davyReadyAt + 0.01;
  ok("trigger: the reloaded crew fires again", possessedVolley(world, sq, { x: 0, z: 15 }, null) === 1);
}
