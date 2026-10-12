import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, toggleBenchDead } from "../../src/depot/dead.js";
import { sickSeconds } from "../../src/depot/sickclock.js";
import { FOE_RACK_BY_KEY } from "../../src/depot/palette.js";
import { peopleOf } from "../../src/depot/people.js";
import { bootWar } from "../../src/depot/boot.js";

// ==== 0.6.6: the fast dead, the sick clock, and the bench ===================
// Seed rolled each run.
{
  console.log("\n[0.6.6: the fast dead, the sick clock, and the bench]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };

  // (a) the pace
  ok("(a) the dead walk at 6.4 meters a second, twice a man's pace", DEAD.speed === 6.4, String(DEAD.speed));

  // (b) the clock: whole seconds left until the turn, or nothing
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 5;
    const m = man(w, 1, 0, 0), e = man(w, 2, 3, 0), q = man(w, 1, 6, 0), d = spawnDead(w, 9, 0);
    m.sickAt = 5; e.sickAt = 5; q.sickAt = 5; q.alive = false;
    ok("(b) a fresh stamp reads thirty", sickSeconds(w, m) === 30, String(sickSeconds(w, m)));
    w.t = 17.4;
    ok("(b) twelve and a bit seconds on it reads eighteen, both armies alike", sickSeconds(w, m) === 18 && sickSeconds(w, e) === 18, `${sickSeconds(w, m)}/${sickSeconds(w, e)}`);
    m.sickAt = null;
    ok("(b) no stamp, no clock; a dead man, no clock", sickSeconds(w, m) === null && sickSeconds(w, q) === null);
    ok("(b) one of the dead carries no clock", sickSeconds(w, d) === null);
  }

  // (c) the rack
  ok("(c) the enemy rack carries THE DEAD", FOE_RACK_BY_KEY.foe_dead && FOE_RACK_BY_KEY.foe_dead.dead === true && FOE_RACK_BY_KEY.foe_dead.label === "THE DEAD");

  // (d) the bench switch: the first turn-on fields the ring and the people; off halts; on again fields nothing new
  {
    const war = bootWar({ seed: SEED, dev: true });
    const deadOf = () => war.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    ok("(d) the bench opens with no dead, no people, no outbreak", deadOf() === 0 && peopleOf(war.world).length === 0 && !war.run.outbreak);
    const on1 = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) the first turn-on fields six and the people and runs them", on1 === true && war.run.outbreak === true && deadOf() === 6 && peopleOf(war.world).length > 0, `${deadOf()}/${peopleOf(war.world).length}`);
    const off = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) off halts them where they stand", off === false && war.run.outbreak === false && deadOf() === 6);
    const on2 = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) on again fields nothing new", on2 === true && war.run.outbreak === true && deadOf() === 6, String(deadOf()));
    ok("(d) the outbreak is not a key the war's run carries", bootWar({ seed: SEED }).run.outbreak === undefined);
  }
}
