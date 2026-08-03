// S3: trace one failing tSS@0.8 run — plan-vs-print shortfall per touchdown
import { mkQ } from "./qlib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import { stepWorld } from "../src/engine/core.js";
const { world, mech } = mkQ({ tSS: 0.8, period0: 1 }, 0, 2);
const st = mech.state;
let lastSteps = 0, lastPlan = null;
for (let i = 0; i < Math.round(20 / world.dt); i++) {
  const t = i * world.dt;
  mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 });
  world.events.length = 0; stepWorld(world);
  const ph = st.phases && st.phases[st.pi];
  if (ph && ph.land) lastPlan = { x: ph.land.x, z: ph.land.z };
  if (mech.telem.steps !== lastSteps) {
    lastSteps = mech.telem.steps;
    const sd = st.lastSwing;
    const pr = st.prints[sd];
    const short = lastPlan ? (lastPlan.z - pr.z).toFixed(2) : "-";
    console.log("step", String(lastSteps).padStart(2), sd, "t", t.toFixed(1),
      "short", short, "R4", mech.hull.R[4].toFixed(3),
      "v", Math.hypot(mech.hull.v.x, mech.hull.v.z).toFixed(2),
      "hy", mech.hull.pos.y.toFixed(2), "rec", (st.recoverT || 0).toFixed(1));
  }
  if (st.mode === "FALLEN") { console.log("FELL at", t.toFixed(1)); break; }
}
