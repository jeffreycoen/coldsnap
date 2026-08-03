// Launch responsiveness: entry factor sweep (env LF) with stability checks.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
let tHalfSum = 0, n = 0, falls = 0;
for (const off of [0, 0.5, 1.0, 1.5]) {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0 });
  mech.thrustersOn = true; mech.thrustAssist = true;
  if (process.env.LF) mech._launchF = Number(process.env.LF);
  for (let i = 0; i < Math.round((5 + off) / world.dt); i++) { world.events.length = 0; stepWorld(world); }
  const z0 = mech.hull.pos.z;
  let tHalf = -1;
  for (let i = 0; i < Math.round(20 / world.dt); i++) {
    mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    if (tHalf < 0 && mech.hull.pos.z - z0 > 0.5) tHalf = i * world.dt;
    if (mech.state.mode === "FALLEN") { falls++; break; }
  }
  if (tHalf > 0) { tHalfSum += tHalf; n++; }
}
console.log((process.env.LABEL || "cfg") + ": 0.5m avg", n ? (tHalfSum / n).toFixed(2) + "s" : "-", "falls", falls + "/4");
