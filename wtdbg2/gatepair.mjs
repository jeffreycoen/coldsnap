// The two flipped asserts, swept over afRate: s4 sortie + about-face from march.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechAboutFace } from "../src/engine/mech.js";
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const S4 = [[0, .1, 0, 0], [4, .3, 0, 0], [8, .1, 0, .7], [12, .3, 0, 0], [16, 0, .22, -.7], [20, .3, 0, 0], [28, 0, 0, 0]];
for (const rate of [0.2, 0.25, 0.3]) {
  // s4
  let s4res;
  {
    const field = makeField(64, 1.7, 5); field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: -20 });
    mech.tune.afRate = rate;
    for (let i = 0; i < Math.round(2.86 / world.dt); i++) { world.events.length = 0; stepWorld(world); }
    let heading = 0, ki = 0, fellAt = 0;
    for (let i = 0; i < 4560; i++) {
      const t = i / 120;
      if (ki + 1 < S4.length && t >= S4[ki + 1][0]) ki++;
      heading += S4[ki][3] / 120;
      const yn = yaw(mech);
      let lead = wrap(heading - yn);
      heading = yn + Math.max(-0.5, Math.min(0.5, lead));
      mechCommand(mech, { travel: S4[ki][1], lateral: S4[ki][2], heading: mech.state.aboutFace && !mech.state.afLive ? null : heading });
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fellAt = t; break; }
    }
    s4res = fellAt ? "FELL@" + fellAt.toFixed(1) : "clean";
  }
  // about-face from march (gate-identical)
  let afres;
  {
    const field = makeField(64, 1.7, 5); field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: 0 });
    mech.tune.afRate = rate;
    for (let i = 0; i < Math.round(2 / world.dt); i++) { world.events.length = 0; stepWorld(world); }
    mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 });
    for (let i = 0; i < Math.round(6 / world.dt); i++) { world.events.length = 0; stepWorld(world); }
    const y0 = yaw(mech);
    mechAboutFace(world, mech);
    let done = -1, fell = false;
    for (let i = 0; i < Math.round(55 / world.dt); i++) {
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      if (done < 0 && !mech.state.aboutFace && mech.state.mode === "STAND" && Math.abs(wrap(yaw(mech) - y0 - Math.PI)) < 0.2) { done = i * world.dt; break; }
    }
    afres = fell ? "FELL" : done > 0 ? done.toFixed(1) + "s" : "incomplete";
  }
  console.log("afRate", rate, "| s4:", s4res, "| af-march:", afres);
}
