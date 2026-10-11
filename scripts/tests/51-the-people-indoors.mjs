import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, MAN, MASON } from "../../src/depot/specs.js";
import { spawnDead, stepDead } from "../../src/depot/dead.js";
import { spawnPerson, stepPeople, peopleOf } from "../../src/depot/people.js";
import { bootWar } from "../../src/depot/boot.js";

// ==== 0.6.4: the slower dead and the people indoors ========================
// Seed rolled each run.
{
  console.log("\n[0.6.4: the slower dead and the people indoors]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) the numbers
  ok("(a) the dead walk at 4.8 meters a second and the turn is thirty seconds", DEAD.speed === 4.8 && DEAD.turnS === 30, `${DEAD.speed}/${DEAD.turnS}`);

  // (b) the home: a person spawned with a door has an inside spot and an outside spot
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 0, 0, 2.3, 0);
    ok("(b) she stands at the inside spot and knows the outside one", p.pIn && p.pOut && Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z) < 0.01 && p.pOut.x === 2.3, JSON.stringify([p.pIn, p.pOut]));
    const q = spawnPerson(w, 10, 0);
    ok("(b) with no door given the two spots are one", q.pIn && q.pOut && q.pIn.x === q.pOut.x && q.pIn.z === q.pOut.z);
  }

  // (c) the boot: the people stand inside their buildings
  {
    const ob = bootWar({ seed: SEED, outbreak: true });
    const ppl = peopleOf(ob.world);
    const forms = ob.map.TOWN.filter((t) => !t.depot && !t.marker && !t.dead && !t.id.startsWith("fwall"));
    const inside = (b) => forms.some((t) => Math.abs(b.pIn.x - t.x) <= (t.nx * MASON.pitch) / 2 && Math.abs(b.pIn.z - t.z) <= (t.nz * MASON.pitch) / 2);
    const nIn = ppl.filter(inside).length;
    ok("(c) at least nineteen in twenty inside spots lie within a building's footprint", ppl.length > 0 && nIn >= Math.ceil(ppl.length * 0.95), `${nIn}/${ppl.length}`);
    const outside = (b) => !forms.some((t) => Math.abs(b.pOut.x - t.x) < (t.nx * MASON.pitch) / 2 - 0.2 && Math.abs(b.pOut.z - t.z) < (t.nz * MASON.pitch) / 2 - 0.2);
    ok("(c) every outside spot lies outside every footprint", ppl.every(outside), `${ppl.filter((b) => !outside(b)).length} inside`);
  }

  // (d) spooked indoors: out by the door first, then away; home again by the door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 100;
    const p = spawnPerson(w, 0, 0, 2.3, 0); const d = spawnDead(w, 0, 12);
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) the first leg is the door", !!p._fleeing && p.goal && Math.abs(p.goal.x - 2.3) < 0.01 && Math.abs(p.goal.z) < 0.01, p.goal ? `${p.goal.x}/${p.goal.z}` : "-");
    for (let i = 0; i < 240; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(d) two seconds on she is out and running away from the dead", p.pos.x > 1.5 && p.pos.z < -3, `${p.pos.x.toFixed(1)}/${p.pos.z.toFixed(1)}`);
    d.alive = false;
    for (let i = 0; i < 120 * 40; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(d) forty quiet seconds on she is home, inside", Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z) < 1.0, Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z).toFixed(2));
  }

  // (e) the dead reach an indoor person by the door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 0, 0, 2.3, 0); const d = spawnDead(w, 10, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [] });
    ok("(e) from outside, the goal is her door", d.tgtId === p.id && d.goal && Math.abs(d.goal.x - 2.3) < 0.01, d.goal ? `${d.goal.x}` : "-");
    d.pos.x = 2.3; d.pos.z = 0;
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [] });
    ok("(e) at the door, the goal is her", d.goal && Math.abs(d.goal.x - p.pos.x) < 0.01 && Math.abs(d.goal.z - p.pos.z) < 0.01, d.goal ? `${d.goal.x}` : "-");
  }

  // (f) the slower hunt still closes: 12 meters and a bite inside four seconds
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const m = addBody(w, { kind: "unit", team: 1, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x: 12, z: 0, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); m.maxHp = MAN.rifle.hp;
    let bitAt = null;
    for (let i = 0; i < 480 && bitAt == null; i++) { stepDead(w, 1 / 120); w.t += 1 / 120; integrate(w, d, 1 / 120); if (m.hp < MAN.rifle.hp) bitAt = w.t; }
    ok("(f) at 4.8 the dead still close 12 meters and bite inside four seconds", bitAt != null && bitAt < 4 && bitAt > 2, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s");
  }
}
