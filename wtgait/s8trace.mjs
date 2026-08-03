// S8: full telemetry on the tSS@0.65 death — what structurally fails?
import { mkQ } from "./qlib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import { stepWorld } from "../src/engine/core.js";
const { world, mech } = mkQ({ tSS: 0.65, period0: 1 }, 0, 2);
const st = mech.state;
let lastSteps = 0;
const W = mech.mass * 9.81;
for (let i = 0; i < Math.round(12 / world.dt); i++) {
  const t = i * world.dt;
  mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 });
  world.events.length = 0; stepWorld(world);
  if (mech.telem.steps !== lastSteps) {
    lastSteps = mech.telem.steps;
    const sd = st.lastSwing, pr = st.prints[sd];
    const ph = st.phases && st.phases[st.pi];
    // com + xi
    let m = 0, cx = 0, cz = 0, vx = 0, vz = 0, cy = 0;
    for (const b of mech.links) { m += b.mass; cx += b.mass * b.pos.x; cy += b.mass * b.pos.y; cz += b.mass * b.pos.z; vx += b.mass * b.v.x; vz += b.mass * b.v.z; }
    cx /= m; cy /= m; cz /= m; vx /= m; vz /= m;
    const om = Math.sqrt(9.81 / Math.max(0.5, cy));
    const xiz = cz + vz / om;
    const fmz = (st.prints.L.z + st.prints.R.z) / 2;
    console.log("step", String(lastSteps).padStart(2), sd, "t", t.toFixed(1),
      "vz", vz.toFixed(2), "xiF", (xiz - fmz).toFixed(2),
      "loadL", (mech.legs.L.load / W).toFixed(2), "loadR", (mech.legs.R.load / W).toFixed(2),
      "R4", mech.hull.R[4].toFixed(3), "hy", mech.hull.pos.y.toFixed(2),
      "cad", (st.cadence || 1).toFixed(2));
  }
  if (st.mode === "FALLEN") { console.log("FELL", t.toFixed(1)); break; }
}
