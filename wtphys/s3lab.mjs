// s3 mini-repro: SORTIES[3] (S-curve at 0.35, stop at 30) vs a factor spec.
import { stepWorld } from "../src/engine/core.js";
import { mk, run, wrap } from "./lib.mjs";
import { mechCommand } from "../src/engine/mech.js";
const spec = JSON.parse(process.argv[2] || "{}");
const sc = [[0, .35, 0, 0], [10, .35, 0, -.7], [14, .35, 0, .7], [18, .35, 0, 0], [30, 0, 0, 0]];
const yawOf = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const { world, mech } = mk(spec, { z: -20 });
run(world, 2.77); // gate's settle for sortie index 3 (2.5 + 3*0.09)
let heading = 0, ki = 0, fellAt = 0;
for (let i = 0; i < 4560; i++) {
  const t = i / 120;
  if (ki + 1 < sc.length && t >= sc[ki + 1][0]) ki++;
  heading += sc[ki][3] / 120;
  const yn = mech.state.heading; // game-identical command-frame anchor
  heading = yn + Math.max(-0.5, Math.min(0.5, wrap(heading - yn)));
  mechCommand(mech, { travel: sc[ki][1], lateral: sc[ki][2], heading });
  world.events.length = 0; stepWorld(world);
  if (mech.state.mode === "FALLEN") { fellAt = t; break; }
}
console.log(JSON.stringify(spec), fellAt ? "FELL@" + fellAt.toFixed(1) : "ok (" + mech.state.mode + ")");
