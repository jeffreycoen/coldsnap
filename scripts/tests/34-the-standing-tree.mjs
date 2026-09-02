import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";

// ==== mk2.87: the standing tree =============================================
// A walking man does not fell a tree. Under depot combat a unit↔tree contact
// is one-sided — the tree ignores contact-wake from units and takes no
// impulse from them; the man is pushed off the trunk at full strength. A
// vehicle still rams a tree over. Seed 5.
{
  console.log("\n[mk2.87: the standing tree]");
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const plantTree = (world) => {
    const t = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: 1.62, z: 0, hp: 70, friction: 0.5 });
    t.sleeping = true;
    return t;
  };
  const plantMan = (world) =>
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -0.9, y: 1.0, z: 0, hp: 58 });

  // (a) a rifleman drives into the trunk for ten seconds — the sleeping tree
  // neither wakes nor moves, and the man is held off it
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const man = plantMan(world);
    for (let i = 0; i < 600; i++) { man.v.x = 1.6; stepWorld(world); }
    ok("(a) the shoved tree stays asleep", tree.sleeping === true);
    ok("(a) the trunk has not moved", Math.hypot(tree.pos.x, tree.pos.z) < 0.01, `moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(3)}m`);
    ok("(a) the trunk stands upright", tree.R[4] > 0.999, `upY ${tree.R[4].toFixed(4)}`);
    ok("(a) the man is held off the trunk", man.pos.x < -0.5, `x ${man.pos.x.toFixed(2)}`);
  }

  // (b) an AWAKE tree (woken by the war around it) still refuses the shove
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const man = plantMan(world);
    for (let i = 0; i < 600; i++) { tree.sleeping = false; tree.sleepT = 0; man.v.x = 1.6; stepWorld(world); }
    ok("(b) the awake trunk has not moved", Math.hypot(tree.pos.x, tree.pos.z) < 0.02, `moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(3)}m`);
    ok("(b) the awake trunk stands upright", tree.R[4] > 0.999, `upY ${tree.R[4].toFixed(4)}`);
  }

  // (c) control — a tank still fells the tree
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const tank = addBody(world, { kind: "vehicle", team: 1, mass: 3400, hx: 1.5, hy: 0.8, hz: 2.4, x: -6, y: 0.8, z: 0, hp: 260 });
    for (let i = 0; i < 240; i++) { tank.v.x = 6; stepWorld(world); }
    ok("(c) a tank still knocks the tree over", tree.R[4] < 0.9 || Math.hypot(tree.pos.x, tree.pos.z) > 0.5, `upY ${tree.R[4].toFixed(3)}, moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(2)}m`);
  }
}
