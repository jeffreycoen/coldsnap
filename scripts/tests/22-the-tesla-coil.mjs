// COLDSNAP suite era 22 — THE TESLA COIL (mk2.15). The frost tower is a
// lightning weapon now: one strike on an acquired enemy, then the chain
// walks 0.15s a hop to the nearest body not yet hit, 4m reach, 8 hits, one
// hit per body, 35 damage stepping down 5 to a floor of 10, blind to team
// and sight past the first strike. Zero rng draws. Fixture seed: 13. No
// seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld, addBody } from "../../src/engine/core.js";
import { TOWER_SPECS } from "../../src/depot/specs.js";
import { TESLA, teslaStrike, stepTesla, teslaWouldCatchFriend } from "../../src/depot/state.js";
import { PONDS } from "../../src/depot/mapgen.js";

const spec = TOWER_SPECS.tesla;
ok("tesla: the spec is a weapon now", spec.fireRate === 5 && spec.dmg === 35 && spec.range === 16 && spec.cost === 55 && !!spec.tesla);
ok("tesla: the slow is gone", spec.slow === undefined);
ok("tesla: the frost key is gone", TOWER_SPECS.frost === undefined);

function rig() {
  const field = makeField(41, 2.0, 13);
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true;
  const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: field.heightAt(0, 0) + spec.hy, z: 0, hp: spec.hp });
  tower.towerType = "tesla";
  const man = (x, z, team) => {
    const u = addBody(world, { kind: "unit", team, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x, y: field.heightAt(x, z) + 1.0, z, hp: 100 });
    u.smearStyle = "human";
    return u;
  };
  return { world, tower, man };
}
// walk the world clock without the integrator: stepTesla reads world.t only
const walk = (world, arcs, s) => { for (let i = 0; i < Math.round(s / 0.05); i++) { world.t += 0.05; stepTesla(world, arcs); } };

{ // the ladder, the stagger, the one-hit rule
  const { world, tower, man } = rig();
  const a = man(6, 0, 2), b = man(8, 0, 2), c = man(10, 0, 2);
  const arcs = [];
  teslaStrike(world, arcs, tower, a);
  stepTesla(world, arcs);
  ok("tesla: the strike lands 35 at once", a.hp === 65);
  ok("tesla: the hop waits its turn", b.hp === 100);
  walk(world, arcs, TESLA.hopS + 0.001);
  ok("tesla: hop one lands 30", b.hp === 70);
  walk(world, arcs, TESLA.hopS);
  ok("tesla: hop two lands 25", c.hp === 75);
  walk(world, arcs, 1.0);
  ok("tesla: nobody is hit twice", a.hp === 65 && b.hp === 70 && c.hp === 75);
  ok("tesla: the spent chain is swept", arcs.length === 0);
}
{ // the reach limit and the floor
  const { world, tower, man } = rig();
  const a = man(6, 0, 2); man(11.5, 0, 2); // 5.5m past the victim: out of hop reach
  const far = world.bodies[world.bodies.length - 1];
  const arcs = [];
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 2.0);
  ok("tesla: 4m is the hop's whole reach", far.hp === 100);
  const ladder = [35, 30, 25, 20, 15, 10, 10, 10];
  ok("tesla: the ladder floors at 10", ladder[7] === TESLA.dmgFloor);
}
{ // eight hits, indiscriminate spread, chain touches a structure
  const { world, tower, man } = rig();
  const first = man(6, 0, 2);
  for (let i = 1; i < 9; i++) man(6 + i * 1.5, 0, i % 2 ? 1 : 2); // friend and foe alternating
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 1.0, hz: 2, x: 7.5, y: 1, z: 1.5, hp: 70 });
  const arcs = [];
  teslaStrike(world, arcs, tower, first);
  walk(world, arcs, 2.5);
  const hit = world.bodies.filter((u) => (u.kind === "unit" && u.hp < 100) || (u.kind === "wall" && u.hp < 70)).length;
  ok("tesla: exactly eight bodies burn", hit === TESLA.maxHits);
  const friendHit = world.bodies.some((u) => u.kind === "unit" && u.team === 1 && u.hp < 100);
  ok("tesla: the spread is blind to team", friendHit);
  ok("tesla: a wall can carry the chain", wall.hp < 70 || hit === TESLA.maxHits);
}
{ // the pond conducts
  PONDS.length = 0;
  PONDS.push({ x: 30, z: 0, r: 6, level: 0 });
  const { world, tower, man } = rig();
  const a = man(6, 0, 2);
  const onPondNear = man(9, 0, 2);   // in hop reach AND on nothing
  const onPondA = man(28, 0, 2);     // on the pond, far beyond any hop
  const onPondB = man(32, 0, 2);     // on the pond too
  const arcs = [];
  // seed the chain next to the pond: second man stands on it
  onPondNear.pos.x = 27; onPondNear.pos.z = 3;
  a.pos.x = 24; a.pos.z = 3;
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 2.5);
  ok("tesla: the pond electrifies whole", onPondA.hp < 100 && onPondB.hp < 100);
  PONDS.length = 0;
}
{ // the kill names its cause; zero draws
  const { world, tower, man } = rig();
  const a = man(6, 0, 2); a.hp = 20;
  const arcs = [];
  const draws0 = (() => { let n = 0; const r = world.rng; world.rng = () => { n++; return r(); }; return { get: () => n, restore: () => (world.rng = r) }; })();
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 1.0);
  draws0.restore();
  ok("tesla: the chain draws nothing from the stream", draws0.get() === 0);
  const kill = world.events.find((e) => e.type === "kill" && e.id === a.id);
  ok("tesla: the kill is signed ZAP", kill && kill.cause === "ZAP");
  ok("tesla: every hit pushed a zap event", world.events.some((e) => e.type === "zap"));
}
{ // the hold: a friendly in the would-be chain holds the trigger
  const { world, tower, man } = rig();
  const foe = man(6, 0, 2); man(8, 0, 1);
  ok("tesla: the hold sees the friend in the spread", teslaWouldCatchFriend(world, tower, foe) === true);
  const { world: w2, tower: t2, man: m2 } = rig();
  const foe2 = m2(6, 0, 2); m2(14, 0, 1);
  ok("tesla: a friend clear of the spread holds nothing", teslaWouldCatchFriend(w2, t2, foe2) === false);
}
