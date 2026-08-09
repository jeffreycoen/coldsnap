// Fine trace of the surge/collapse cycle: per-0.5s controller internals.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechFallen } from "../src/engine/mech.js";

const field = makeField(64, 1.7, 5);
field.h.fill(0);
const w = makeWorld({ field, seed: 5 });
const mech = buildMech(w, { x: 0, z: -20 });
const run = (secs) => { const n = Math.round(secs / w.dt); for (let i = 0; i < n; i++) { w.events.length = 0; stepWorld(w); } };
run(2.5);
mechCommand(mech, { travel: 0.5 });
const st = mech.state;
let lastZ = mech.hull.pos.z, recAcc = 0, lastRec = 0;
console.log("t | v | cmd.f | recT | mode | steps | yawErr | x | swayV");
let steps0 = 0;
for (let i = 0; i < 80; i++) {
  const n = Math.round(0.5 / w.dt);
  let rec = 0;
  for (let j = 0; j < n; j++) {
    w.events.length = 0; stepWorld(w);
    if ((st.recoverT || 0) > lastRec + 1e-6) rec++;
    lastRec = st.recoverT || 0;
  }
  const v = (mech.hull.pos.z - lastZ) / 0.5; lastZ = mech.hull.pos.z;
  const hy = Math.atan2(mech.hull.R[6], mech.hull.R[8]);
  const yerr = ((hy - st.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  console.log(`${(i * 0.5 + 2.5).toFixed(1)} | ${v.toFixed(2)} | ${st.cmd.f.toFixed(2)} | ${(st.recoverT || 0).toFixed(2)}${rec ? "*" : " "} | ${st.mode} | ${mech.telem.steps - steps0} | ${yerr.toFixed(2)} | ${mech.hull.pos.x.toFixed(2)} | ${mech.hull.v.x.toFixed(2)}`);
  steps0 = mech.telem.steps;
  if (mechFallen(mech)) break;
}
