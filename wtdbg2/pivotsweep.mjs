// afRate sweep on the about-face under the advisor stack (rockets armed).
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechAboutFace } from "../src/engine/mech.js";
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
for (const rate of (process.argv[2] ? [Number(process.argv[2])] : [0.2, 0.3, 0.4])) {
  let clean = 0; const times = []; const det = [];
  for (const off of [0, 0.4, 0.8, 1.2, 1.6, 2.0]) {
    const field = makeField(64, 1.7, 5); field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: 0 });
    mech.thrustersOn = true; mech.thrustAssist = true;
    mech.tune.afRate = rate;
    for (let i = 0; i < Math.round((2 + off) / world.dt); i++) { world.events.length = 0; stepWorld(world); }
    const y0 = yaw(mech);
    mechAboutFace(world, mech);
    let done = -1, fell = false;
    for (let i = 0; i < Math.round(50 / world.dt); i++) {
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      if (done < 0 && !mech.state.aboutFace && mech.state.mode === "STAND" && Math.abs(wrap(yaw(mech) - y0 - Math.PI)) < 0.15) { done = i * world.dt; break; }
    }
    if (!fell && done > 0) { clean++; times.push(done); } else det.push("off" + off + (fell ? " FELL" : " inc"));
  }
  const avg = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : "-";
  console.log("afRate", rate, ":", clean + "/6, avg", avg + "s", det.join(" "));
}
