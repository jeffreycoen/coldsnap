import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import fs from "node:fs";

// ==== mk2.97: the suspension ================================================
// Four spring-and-damper wheels under a flagged body: it settles at spring
// height and sleeps, leans on a slope, pitches on a step, takes per-body
// drive numbers, and a graded climb can beat an under-geared engine.
// All numbers were measured on the reference implementation. Seeds rolled
// each run.
{
  console.log("\n[mk2.97: the suspension]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };
  const mkJ = (w, x, z, y) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, x, y, z, hp: 90, friction: 0.8 });
    v.susp = { kx: 0.6, kz: 0.9, rest: 0.55, travel: 0.4, rate: 66000, damp: 6000 };
    return v;
  };

  // (a) dropped, it settles level at spring height and falls asleep
  {
    const w = makeWorld({ field: flat, seed: SEED + 0 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(a) the hull settles level at spring height", v.pos.y > 0.96 && v.pos.y < 1.06 && v.R[4] > 0.999, `y ${v.pos.y.toFixed(3)} upY ${v.R[4].toFixed(4)}`);
    ok("(a) the parked hull sleeps", v.sleeping === true);
  }

  // (b) a slope leans it on its springs — held high, not resting on the box
  {
    const slope = { heightAt: (x) => x * 0.2, dirty: false, carve: () => {}, normalAt: (x, z, o) => { const l = Math.hypot(0.2, 1); o.x = -0.2 / l; o.y = 1 / l; o.z = 0; } };
    const w = makeWorld({ field: slope, seed: SEED + 1 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(b) the slope leans the hull on its springs", v.R[4] > 0.96 && v.R[4] < 0.99 && v.pos.y > 0.9 && Math.abs(v.pos.x) < 0.2 && v.sleeping === true, `upY ${v.R[4].toFixed(4)} y ${v.pos.y.toFixed(2)} x ${v.pos.x.toFixed(2)}`);
  }

  // (c) a step under the front axle pitches it — again held high
  {
    const stepF = { heightAt: (x, z) => z > 0 ? 0.15 : 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };
    const w = makeWorld({ field: stepF, seed: SEED + 2 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(c) the step pitches the hull, one axle high", v.R[4] > 0.99 && v.R[4] < 0.999 && v.pos.y > 0.9, `upY ${v.R[4].toFixed(4)} y ${v.pos.y.toFixed(2)}`);
  }

  // (d) per-body drive numbers: spdF 14 runs where the default holds 9.5
  {
    const speeds = [];
    for (const spd of [14, null]) {
      const w = makeWorld({ field: flat, seed: SEED + 3 }); w.depotCombat = true;
      const v = mkJ(w, -30, 0, 1.4);
      if (spd) v.spdF = spd;
      v.depotDrive = "manual"; v.ctl = { throttle: 1, steer: 0, brake: false };
      for (let i = 0; i < 600; i++) stepWorld(w);
      speeds.push(Math.hypot(v.v.x, v.v.z));
    }
    ok("(d) spdF 14 runs past the tread constant", speeds[0] > 12, speeds[0].toFixed(2));
    ok("(d) an unmarked body keeps the old 9.5", speeds[1] < 9.7, speeds[1].toFixed(2));
  }

  // (e) the grade beats the under-geared engine: 26.6 degrees, accCap 3.5
  // stalls and slides back; accCap 7 climbs it
  {
    const prog = [];
    for (const cap of [3.5, 7]) {
      const slope = { heightAt: (x, z) => z * 0.5, dirty: false, carve: () => {}, normalAt: (x, z, o) => { const l = Math.hypot(0.5, 1); o.x = 0; o.y = 1 / l; o.z = -0.5 / l; } };
      const w = makeWorld({ field: slope, seed: SEED + 4 }); w.depotCombat = true;
      const v = mkJ(w, 0, -10, slope.heightAt(0, -10) + 1.4);
      v.accCap = cap; v.spdF = 14;
      v.depotDrive = "manual"; v.ctl = { throttle: 1, steer: 0, brake: false };
      for (let i = 0; i < 1440; i++) stepWorld(w);
      prog.push(v.pos.z + 10);
    }
    ok("(e) 2H's gearing stalls on the grade and slides back", prog[0] < 0, prog[0].toFixed(1));
    ok("(e) 4L's gearing climbs the same grade", prog[1] > 40, prog[1].toFixed(1));
  }

  // (f) pins: the pass, its call, the grade line, the grounded commit
  const cs = fs.readFileSync("src/engine/core.js", "utf8");
  ok("(f) pins: the suspension pass exists", /function stepSuspension\(world\) \{/.test(cs) && /b\._suspGround = touching;/.test(cs));
  ok("(f) pins: the world steps it after the drive", /stepDrive\(world\);\n\s*stepSuspension\(world\);/.test(cs));
  ok("(f) pins: the grade steals after the cap", /if \(b\.susp && traction > 0\) acc -= world\.gravity \* fwd\.y;/.test(cs));
  ok("(f) pins: wheels ground the hull", /b\.groundedNow \|\| b\.bodyGroundedNow \|\| b\._suspGround/.test(cs));
}
