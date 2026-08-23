// COLDSNAP suite era 22 — THE TESLA COIL (mk2.15). The frost tower is a
// lightning weapon now: one strike on an acquired enemy, then the chain
// walks 0.15s a hop to the nearest body not yet hit, 8m reach, 8 hits, one
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
  const a = man(6, 0, 2); man(16, 0, 2); // 10m past the victim: out of hop reach
  const far = world.bodies[world.bodies.length - 1];
  const arcs = [];
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 2.0);
  ok("tesla: 8m is the hop's whole reach", far.hp === 100);
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
  const foe2 = m2(6, 0, 2); m2(22, 0, 1);
  ok("tesla: a friend clear of the spread holds nothing", teslaWouldCatchFriend(w2, t2, foe2) === false);
}
{ // Amendment 3: the ground strike — always a bolt, chain from the snow
  const field = makeField(41, 2.0, 13);
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true;
  const near = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 3, y: field.heightAt(3, 0) + 1, z: 0, hp: 100 });
  near.smearStyle = "human";
  const arcs = [{ nextAt: 0, hits: 0, dmg: 35, fx: 0, fy: 3, fz: 0, atk: "player", tid: 0, gx: 1, gy: field.heightAt(1, 0), gz: 0, hitIds: [], waters: [] }];
  world.t = 0.01; stepTesla(world, arcs);
  ok("ground strike: the bolt lands with no victim", world.events.some((e) => e.type === "zap" && e.hop === 0));
  ok("ground strike: the snow takes no damage call", near.hp === 100);
  for (let i = 0; i < 10; i++) { world.t += 0.05; stepTesla(world, arcs); }
  ok("ground strike: the chain walks from the snow at full 35", near.hp === 65);
}
{ // Amendment 4: the possessed snap takes any body — own men included
  const { makeField: mf4, makeWorld: mw4, addBody: ab4 } = await import("../../src/engine/core.js");
  const { possessedTowerFire: ptf4, stepTesla: st4 } = await import("../../src/depot/state.js");
  const { TOWER_SPECS: TS4 } = await import("../../src/depot/specs.js");
  ok("a4: the spec carries acc", TS4.tesla.acc != null);
  const field = mf4(41, 2.0, 13);
  const world = mw4({ field, seed: 13 });
  world.depotCombat = true;
  const tower = ab4(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: TS4.tesla.hy, hz: 0.8, x: 0, y: field.heightAt(0, 0) + TS4.tesla.hy, z: 0, hp: 85 });
  tower.towerType = "tesla";
  const own = ab4(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1, hz: 0.28, x: 8, y: field.heightAt(8, 0) + 1, z: 0, hp: 100 });
  own.smearStyle = "human";
  const arcs = [];
  ok("a4: FIRE on an own man fires", ptf4(world, tower, { x: 8, z: 0 }, null, undefined, arcs) === true);
  for (let i = 0; i < 4; i++) { world.t += 0.05; st4(world, arcs); }
  ok("a4: the own man takes the strike", own.hp === 65);
}
{ // Amendment 5: the LIVE state literal carries the arcs array — the game
  // does not boot through makeRunState, so the field is pinned at the source.
  const dg = (await import("node:fs")).readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("a5: the game state carries arcs", /ws: makeDepotAssaultState\(\), spawnRR: 0,\s*\n\s*arcs: \[\]/.test(dg));
}
{ // Task 4: the switch — davy holds with a friend in the ring, never on its own crew
  const g = (await import("node:fs")).readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
  ok("switch: davy reads the hold", g.includes("holdArea") && g.includes("friendInBlast"));
  const dg = (await import("node:fs")).readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("switch: the button exists", dg.includes("data-holdarea"));
  ok("switch: tesla trigger reads the hold", dg.includes("teslaWouldCatchFriend"));
}
{ // davy behavior: the hold spares the plan when a rifleman stands in the ring
  const { makeField: mf, makeWorld: mw, addBody: ab } = await import("../../src/engine/core.js");
  const { friendInBlast } = await import("../../src/depot/state.js");
  const field = mf(41, 2.0, 13);
  const world = mw({ field, seed: 13 });
  const friend = ab(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1, hz: 0.28, x: 10, y: 1, z: 0, hp: 100 });
  friend.squadId = 7;
  ok("switch: a friend inside 25m holds the davy", friendInBlast(world, 0, 0, 1, null) === true);
  ok("switch: the crew itself never holds its own shot", friendInBlast(world, 0, 0, 1, { id: 7 }) === false);
}
