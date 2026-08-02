// Assisted-cruise lab: env knobs WANTV, SLOPE, ENG, RAIB; 3-off screen or OFFS=6.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const OFFS = process.env.OFFS === "6" ? [0, 0.4, 0.8, 1.2, 1.6, 2.0] : [0, 0.8, 1.6];
let clean = 0, cruise = 0; const det = [];
for (const off of OFFS) {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0 });
  mech.thrustersOn = true; mech.thrustAssist = true;
  if (process.env.WANTV) mech._wantVCap = Number(process.env.WANTV);
  if (process.env.SLOPE) mech._cadSlope = Number(process.env.SLOPE);
  if (process.env.ENG) mech._cadEng = Number(process.env.ENG);
  for (let i = 0; i < Math.round((2 + off) / world.dt); i++) { world.events.length = 0; stepWorld(world); }
  let fell = -1, z30 = 0, z40 = 0;
  for (let i = 0; i < Math.round(60 / world.dt); i++) {
    const t = i * world.dt;
    mechCommand(mech, { travel: t > 42 ? 0 : 0.9, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    if (t >= 30 && z30 === 0) z30 = mech.hull.pos.z;
    if (t >= 40 && z40 === 0) z40 = mech.hull.pos.z;
    if (mech.state.mode === "FALLEN") { fell = t; break; }
  }
  if (fell < 0 && mech.state.mode === "STAND") { clean++; if (off === 0) cruise = (z40 - z30) / 10; }
  else det.push("o" + off + "@" + (fell < 0 ? mech.state.mode : fell.toFixed(0)));
}
console.log((process.env.LABEL || "cfg") + ":", clean + "/" + OFFS.length, "cruise", cruise.toFixed(2), det.join(" "));
