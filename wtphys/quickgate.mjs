// Mini-gate: the three C4-failing sections — sortie s2, about-face from march, heavy-blast mortality.
import { makeWorld, makeField, stepWorld, explode } from "../src/engine/core.js";
import { buildMech, mechCommand, mechAboutFace } from "../src/engine/mech.js";
import { mk, run, wrap } from "./lib.mjs";

const spec = JSON.parse(process.argv[2] || "{}");
const yawOf = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);

// sortie s2 (the failing index): from mech-test SORTIES[2]
{
  const sc = [[0, .2, .2, 0], [6, .2, -.2, 0], [12, .3, 0, .7], [15, -.15, 0, 0], [20, .3, 0, 0], [28, 0, 0, 0]];
  const { world, mech } = mk(spec);
  run(world, 2.68);
  let heading = 0, ki = 0, fellAt = 0;
  for (let i = 0; i < 4560; i++) {
    const t = i / 120;
    if (ki + 1 < sc.length && t >= sc[ki + 1][0]) ki++;
    heading += sc[ki][3] / 120;
    const yn = yawOf(mech);
    heading = yn + Math.max(-0.5, Math.min(0.5, wrap(heading - yn)));
    mechCommand(mech, { travel: sc[ki][1], lateral: sc[ki][2], heading });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fellAt = t; break; }
  }
  console.log("s2:", fellAt ? "FELL@" + fellAt.toFixed(1) : "ok");
}
// about-face from march
{
  const { world, mech } = mk(spec);
  run(world, 2);
  for (let i = 0; i < Math.round(6 / world.dt); i++) { mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
  const y0 = yawOf(mech);
  mechAboutFace(world, mech);
  let done = -1, fell = false;
  for (let i = 0; i < Math.round(50 / world.dt); i++) {
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
    if (done < 0 && !mech.state.aboutFace && mech.state.mode === "STAND" && Math.abs(wrap(yawOf(mech) - y0 - Math.PI)) < 0.2) { done = i * world.dt; break; }
  }
  console.log("aface-march:", fell ? "FELL" : done > 0 ? done.toFixed(1) + "s" : "incomplete");
}
// heavy blast mortality (same call as the gate)
{
  const { world, mech } = mk(spec);
  run(world, 4);
  explode(world, 0.6, 1.2, 0.3, { r: 5.0, kv: 220, dmg: 42, crater: 0.7, attacker: "test" });
  run(world, 4);
  console.log("blast:", mech.state.mode === "FALLEN" ? "goes down (ok)" : "SURVIVES up=" + mech.hull.R[4].toFixed(2));
}
