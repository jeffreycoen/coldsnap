// Sortie s0 in isolation with feature toggles (env: WAIST, WCAP, NOPIVOT).
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const SC = [[0, .3, 0, 0], [8, .3, 0, .7], [11, .3, 0, 0], [18, 0, .22, 0], [24, .25, 0, -.7], [27, .25, 0, 0], [34, 0, 0, 0]];
const field = makeField(64, 1.7, 5); field.h.fill(0);
const world = makeWorld({ field, seed: 5 });
const mech = buildMech(world, { x: 0, z: -20 });
if (process.env.WAIST) mech.tune.waistTurn = Number(process.env.WAIST);
if (process.env.WCAP) mech.tune.windCap = Number(process.env.WCAP);
if (process.env.NOPIVOT) mech.state._noPivot = true;
for (let i = 0; i < Math.round(2.5 / world.dt); i++) { world.events.length = 0; stepWorld(world); }
let heading = 0, ki = 0, fellAt = 0;
for (let i = 0; i < 4560; i++) {
  const t = i / 120;
  if (ki + 1 < SC.length && t >= SC[ki + 1][0]) ki++;
  heading += SC[ki][3] / 120;
  const yawNow = mech.state.heading; // game-identical anchor
  let lead = heading - yawNow;
  while (lead > Math.PI) lead -= 2 * Math.PI;
  while (lead < -Math.PI) lead += 2 * Math.PI;
  heading = yawNow + Math.max(-0.5, Math.min(0.5, lead));
  mechCommand(mech, { travel: SC[ki][1], lateral: SC[ki][2], heading: mech.state.aboutFace && !mech.state.afLive ? null : heading });
  world.events.length = 0; stepWorld(world);
  if (mech.state.mode === "FALLEN") { fellAt = t; break; }
}
console.log((process.env.LABEL || "s0") + ":", fellAt ? "FELL at " + fellAt.toFixed(1) : "clean");
