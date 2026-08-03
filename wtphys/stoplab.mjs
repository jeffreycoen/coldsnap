// stop-quality lab: replicate the gate's stop assert conditions.
import { stepWorld } from "../src/engine/core.js";
import { mk } from "./lib.mjs";
import { mechCommand } from "../src/engine/mech.js";
const spec = JSON.parse(process.argv[2] || "{}");
const { world, mech } = mk(spec);
const run = (s) => { for (let i = 0; i < Math.round(s / world.dt); i++) { world.events.length = 0; stepWorld(world); } };
run(2);
for (let i = 0; i < Math.round(14 / world.dt); i++) { mechCommand(mech, { travel: 0.5, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
let tStand = -1;
for (let i = 0; i < Math.round(12 / world.dt); i++) {
  mechCommand(mech, { travel: 0, lateral: 0, heading: 0 });
  world.events.length = 0; stepWorld(world);
  if (tStand < 0 && mech.state.mode === "STAND") tStand = i * world.dt;
}
const v = Math.hypot(mech.hull.v.x, mech.hull.v.z);
console.log(JSON.stringify(spec), "STAND@" + (tStand < 0 ? "never" : tStand.toFixed(1)), "vResid", v.toFixed(3), mech.state.mode);
