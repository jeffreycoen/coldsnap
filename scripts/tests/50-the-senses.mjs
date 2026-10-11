import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, stepDead, gatherSounds } from "../../src/depot/dead.js";

// ==== 0.6.3: the senses =====================================================
// Seed rolled each run.
{
  console.log("\n[0.6.3: the senses]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) gathering: this tick's shots carry 40, bursts and collapses 80, nothing else is a sound
  {
    const w = makeWorld({ field: flat, seed: SEED });
    w.events.push({ type: "muzzle", x: 1, y: 1, z: 2 }, { type: "boom", x: 3, y: 1, z: 4 }, { type: "collapse", x: 5, y: 2, z: 6 }, { type: "kill", x: 7, z: 8 }, { type: "zap", x: 9, z: 10 });
    const s = gatherSounds(w);
    ok("(a) three sounds from five events, with their reach", s.length === 3 && s[0].x === 1 && s[0].r === DEAD.soundGun && s[1].x === 3 && s[1].r === DEAD.soundBlast && s[2].x === 5 && s[2].r === DEAD.soundBlast, JSON.stringify(s));
  }

  // (b) hearing: a shot 30 m off draws one of the dead; a shot 60 m off does not; a burst 60 m off does
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 60, z: 0, r: DEAD.soundGun }] });
    ok("(b) a shot 60 m off is not heard", !d._soundGoal && Math.hypot(d.v.x, d.v.z) < 1e-6);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 30, z: 0, r: DEAD.soundGun }] });
    ok("(b) a shot 30 m off sets the destination and starts the walk", !!d._soundGoal && d._soundGoal.x === 30 && d.v.x > 0, d._soundGoal ? `${d._soundGoal.x}/${d.v.x.toFixed(1)}` : "-");
    const d2 = spawnDead(w, 0, 100);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 60, z: 100, r: DEAD.soundBlast }] });
    ok("(b) a burst 60 m off is heard", !!d2._soundGoal && d2._soundGoal.x === 60);
  }

  // (c) arrival: the destination is reached and dropped; the dead stand
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 12, z: 0, r: DEAD.soundGun }] };
    stepDead(w, 1 / 120, run); run._sounds = [];
    let arrivedAt = null;
    for (let i = 0; i < 600 && arrivedAt == null; i++) { stepDead(w, 1 / 120, run); integrate(w, d, 1 / 120); w.t += 1 / 120; if (!d._soundGoal) arrivedAt = w.t; }
    ok("(c) 12 meters are walked inside three seconds and the destination is dropped", arrivedAt != null && arrivedAt < 3 && Math.abs(d.pos.x - 12) < 2.5, arrivedAt == null ? "never" : `${arrivedAt.toFixed(2)}s at x ${d.pos.x.toFixed(1)}`);
  }

  // (d) prey outranks sound
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 10, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: -30, z: 0, r: DEAD.soundGun }] });
    ok("(d) a man at 10 m is hunted and the sound is dropped", d.tgtId === m.id && !d._soundGoal && d.v.x > 0, `${d.tgtId}/${!!d._soundGoal}`);
  }

  // (e) clawing: pressed against a wall course with somewhere to go, two points a second; idle, nothing
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const wall = addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 1.2, y: 0.3, z: 0, hp: 70 }); wall.maxHp = 70;
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 10, z: 0, r: DEAD.soundGun }] };
    for (let i = 0; i < 120; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
    ok("(e) one second against the wall takes two points", Math.abs((70 - wall.hp) - 2) < 0.1, (70 - wall.hp).toFixed(2));
    const w2 = makeWorld({ field: flat, seed: SEED }); w2.depotCombat = true;
    const d2 = spawnDead(w2, 0, 0);
    const wall2 = addBody(w2, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 1.2, y: 0.3, z: 0, hp: 70 }); wall2.maxHp = 70;
    for (let i = 0; i < 120; i++) { stepDead(w2, 1 / 120, { squads: [], foeSquads: [], _sounds: [] }); w2.t += 1 / 120; }
    ok("(e) idle against the wall, nothing", wall2.hp === 70 && !d2._soundGoal, `${wall2.hp}`);
  }

  // (f) every clawable kind, and armor does not blunt it
  {
    const kinds = [
      ["a sandbag", (w) => { const b = addBody(w, { kind: "chunk", team: 1, mass: 0, hx: 0.9, hy: 0.45, hz: 0.35, x: 1.2, y: 0.45, z: 0, hp: 60 }); b.sandbag = true; b.maxHp = 60; return b; }],
      ["a tower", (w) => { const b = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 1.1, y: 1.0, z: 0, hp: 80 }); b.towerType = "mg"; b.maxHp = 80; return b; }],
      ["an armored hull", (w) => { const b = addBody(w, { kind: "vehicle", team: 2, mass: 3800, hx: 2.2, hy: 0.95, hz: 3.3, x: 2.5, y: 1.0, z: 0, hp: 420 }); b.armor = 160; b.vtype = "bison"; b.maxHp = 420; return b; }],
    ];
    for (const [name, mk] of kinds) {
      const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
      const d = spawnDead(w, 0, 0); const b = mk(w); const hp0 = b.hp;
      const run = { squads: [], foeSquads: [], _sounds: [{ x: 20, z: 0, r: DEAD.soundGun }] };
      for (let i = 0; i < 120; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
      ok(`(f) ${name} loses two points a second to the claw`, Math.abs((hp0 - b.hp) - 2) < 0.1, (hp0 - b.hp).toFixed(2));
    }
  }

  // (g) a body out of reach is not clawed
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const wall = addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 0, y: 0.3, z: 3, hp: 70 }); wall.maxHp = 70;
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 20, z: 0, r: DEAD.soundGun }] };
    for (let i = 0; i < 60; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
    ok("(g) a wall three meters to the side is untouched", wall.hp === 70, `${wall.hp}`);
  }
}
