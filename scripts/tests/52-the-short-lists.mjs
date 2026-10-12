import { ok } from "./harness.mjs";
import { makeWorld, addBody, worldHash } from "../../src/engine/core.js";
import { MAN, DEAD_TEAM, PERSON } from "../../src/depot/specs.js";
import { spawnDead, stepDead } from "../../src/depot/dead.js";
import { spawnPerson, stepPeople } from "../../src/depot/people.js";
import { makeBodyLists, rebuildBodyLists } from "../../src/depot/lists.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { defaultTickInput } from "../../src/depot/api.js";

// ==== 0.6.5: the short lists ================================================
// Seed rolled each run.
{
  console.log("\n[0.6.5: the short lists]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const stone = (w, x, z) => addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x, z, y: 0.9, hp: 70 });

  // (a) the list: every living unit, in world order
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    man(w, 1, 0, 0); stone(w, 5, 5); man(w, 2, 3, 0); const d = spawnDead(w, 6, 0); spawnPerson(w, 9, 0); const gone = man(w, 1, 12, 0); gone.alive = false;
    const L = makeBodyLists();
    ok("(a) makeBodyLists carries a units list", Array.isArray(L.units));
    rebuildBodyLists(w, L);
    const ref = w.bodies.filter((b) => b.alive && b.kind === "unit");
    ok("(a) units is every living unit, in world order", L.units.length === ref.length && L.units.every((b, i) => b === ref[i]) && L.units.includes(d), `${L.units.length}/${ref.length}`);
  }

  // (b) the prey pick: the same man, lists or no lists
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    man(w, 1, 8, 0); man(w, 2, -8, 0.5); spawnPerson(w, 0, 8); const d = spawnDead(w, 0, 0);
    rebuildBodyLists(w, makeBodyLists());
    stepDead(w, 1 / 120); const withL = d.tgtId;
    d.tgtId = null; d.scanCd = 0; w._L = null;
    stepDead(w, 1 / 120); const without = d.tgtId;
    ok("(b) the prey pick is the same man with the lists and without", withL != null && withL === without, `${withL}/${without}`);
  }

  // (c) the claw pick: the same stone, lists or no lists
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const s = stone(w, d.pos.x + 0.9 + d.hx + 0.1, d.pos.z);
    const run = { _sounds: [{ x: 30, z: 0, r: 40 }] };
    rebuildBodyLists(w, makeBodyLists());
    stepDead(w, 1 / 120, run); const withL = d._clawId;
    d._clawId = null; d._clawCd = 0; w._L = null;
    stepDead(w, 1 / 120, run); const without = d._clawId;
    ok("(c) the claw pick is the same stone with the lists and without", withL === s.id && without === s.id, `${withL}/${without}/${s.id}`);
  }

  // (d) the remembered shot: heard on her next search, not every tick; forgotten after three tenths
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 10;
    const p = spawnPerson(w, 0, 0);
    stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120;                       // her first search, silence
    w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; w.events.length = 0;  // the shot lands between searches
    ok("(d) a shot between searches is not heard that tick", !p._fleeing);
    for (let i = 0; i < 30; i++) { stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; }
    ok("(d) her next search, inside a quarter second, hears it and she runs away from it", !!p._fleeing && p.goal && p.goal.x < 0, p.goal ? p.goal.x.toFixed(1) : "-");
    for (let i = 0; i < 40; i++) { stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; }
    ok("(d) three tenths on, the shot is forgotten", Array.isArray(w._shots) && w._shots.length === 0, String(w._shots && w._shots.length));
  }

  // (e) the whole outbreak: two seconds with the lists and two without land on one number
  {
    const a = bootWar({ seed: SEED, outbreak: true }), b = bootWar({ seed: SEED, outbreak: true });
    a.run.started = true; b.run.started = true; a.run._hot = true;
    const input = defaultTickInput();
    for (let i = 0; i < 240; i++) { tickWar(a, 1 / 120, input); tickWar(b, 1 / 120, input); }
    ok("(e) the lists change nothing: the outbreak's number is the same with them and without", !!a.world._L && !b.world._L && worldHash(a.world) === worldHash(b.world), `${worldHash(a.world)}/${worldHash(b.world)}`);
  }
}
