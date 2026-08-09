// What eats the walk speed on the yaw rig? Per-second CoM velocity trace
// plus ablations: yaw joint locked, solver iterations, cadence.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechFallen, mechUp } from "../src/engine/mech.js";

const flatWorld = (seed = 5) => {
  const field = makeField(64, 1.7, seed);
  field.h.fill(0);
  return makeWorld({ field, seed });
};
const run = (w, secs) => { const n = Math.round(secs / w.dt); for (let i = 0; i < n; i++) { w.events.length = 0; stepWorld(w); } };

function trial(label, mod, trace = false) {
  const w = flatWorld();
  const mech = buildMech(w, { x: 0, z: -20 });
  if (mod) mod(mech, w);
  run(w, 2.5);
  mechCommand(mech, { travel: 0.5 });
  const z0 = mech.hull.pos.z;
  const vs = [];
  let lastZ = z0, minUp = 1;
  for (let s = 0; s < 40; s++) {
    run(w, 1);
    vs.push(mech.hull.pos.z - lastZ); lastZ = mech.hull.pos.z;
    const u = mechUp(mech); if (u < minUp) minUp = u;
    if (mechFallen(mech)) break;
  }
  const d = mech.hull.pos.z - z0;
  console.log(`${label}: dist ${d.toFixed(1)}m (${(d / 40).toFixed(3)} m/s) minUp ${minUp.toFixed(2)} steps ${mech.telem.steps} fallen ${mechFallen(mech)}`);
  if (trace) console.log("  v/s:", vs.map((v) => v.toFixed(2)).join(" "));
}

trial("baseline", null, true);
trial("yaw LOCKED (old-rig emulation)", (mech) => {
  for (const sd of ["L", "R"]) { const j = mech.legs[sd].hipYaw; j.lo = -0.001; j.hi = 0.001; }
}, true);
trial("solveIT 12", (mech) => { mech.solveIT = 12; });
trial("solveIT 28", (mech) => { mech.solveIT = 28; });
trial("hipYaw kp x2", (mech) => { for (const sd of ["L", "R"]) { const j = mech.legs[sd].hipYaw; j.kp *= 2; j.kd *= 1.4; } });
trial("hipYaw tauMax x2", (mech) => { for (const sd of ["L", "R"]) { mech.legs[sd].hipYaw.tauMax *= 2; } });

for (const m of [4, 8, 16]) trial(`hipYaw kp x${m}`, (mech) => {
  for (const sd of ["L", "R"]) { const j = mech.legs[sd].hipYaw; j.kp *= m; j.kd = Math.min(2 * Math.sqrt(j.kp * j.Ichain), 0.9 * j.Ichain * 120); j.tauMax *= m; }
}, m === 8);
