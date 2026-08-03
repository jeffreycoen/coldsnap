// Candidate evaluator: s3 (gate draw + settle margin), assist 3-off, smoothness, shove.
import { stepWorld } from "../src/engine/core.js";
import { mk, run, wrap, smooth, smoothIndex } from "./lib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import fs from "fs";
const spec = JSON.parse(process.argv[2] || "{}");
const base = JSON.parse(fs.readFileSync("wtphys/baseline.jsonl", "utf8").trim());
const sc3 = [[0, .35, 0, 0], [10, .35, 0, -.7], [14, .35, 0, .7], [18, .35, 0, 0], [30, 0, 0, 0]];
const s3run = (settle) => {
  const { world, mech } = mk(spec, { z: -20 });
  run(world, settle);
  let heading = 0, ki = 0;
  for (let i = 0; i < 4560; i++) {
    const t = i / 120;
    if (ki + 1 < sc3.length && t >= sc3[ki + 1][0]) ki++;
    heading += sc3[ki][3] / 120;
    const yn = mech.state.heading;
    heading = yn + Math.max(-0.5, Math.min(0.5, wrap(heading - yn)));
    mechCommand(mech, { travel: sc3[ki][1], lateral: sc3[ki][2], heading });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") return "F@" + t.toFixed(0);
  }
  return "ok";
};
const s3res = [2.77, 2.5, 3.0, 3.3].map(s3run);
// assist 3-off
let aClean = 0;
for (const off of [0, 0.8, 1.2]) {
  const { world, mech } = mk(spec, { thr: true });
  run(world, 2 + off);
  let fell = false;
  for (let i = 0; i < Math.round(60 / world.dt); i++) {
    const t = i * world.dt;
    mechCommand(mech, { travel: t > 42 ? 0 : 0.9, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
  }
  if (!fell && mech.state.mode === "STAND") aClean++;
}
// smoothness + shove
const s42 = smooth(spec, 0.42);
let shove = 0;
for (const imp of [48000, 56000]) {
  const { world, mech } = mk(spec, { thr: true });
  run(world, 5);
  mech.hull.v.x += imp / mech.hull.mass;
  let fell = false;
  for (let i = 0; i < Math.round(12 / world.dt); i++) { world.events.length = 0; stepWorld(world); if (mech.state.mode === "FALLEN") { fell = true; break; } }
  if (!fell) shove = imp;
}
console.log(JSON.stringify(spec), "| s3", s3res.join(","), "| assist", aClean + "/3", "| i42", s42.fell ? "FELL" : smoothIndex(s42, base.s42).toFixed(2), "| shove", shove / 1000 + "k");
