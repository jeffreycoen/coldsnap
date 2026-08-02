// Instrumented single turn run: fLag, waist target, wind-gate duty.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const field = makeField(64, 1.7, 5); field.h.fill(0);
const world = makeWorld({ field, seed: 5 });
const mech = buildMech(world, { x: 0, z: 0 });
if (process.env.WCAP) mech.tune.windCap = Number(process.env.WCAP);
if (process.env.WAIST) mech.tune.waistTurn = Number(process.env.WAIST);
for (let i = 0; i < Math.round(2 / world.dt); i++) { world.events.length = 0; stepWorld(world); }
for (let i = 0; i < Math.round(8 / world.dt); i++) { mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
let yawT = yaw(mech), prev = yaw(mech), tot = 0;
const st = mech.state;
for (let i = 0; i < Math.round(25 / world.dt); i++) {
  yawT -= 0.82 * world.dt;
  const yn = yaw(mech);
  yawT = yn + Math.max(-0.5, Math.min(0.5, wrap(yawT - yn)));
  mechCommand(mech, { travel: 0.42, lateral: 0, heading: yawT });
  world.events.length = 0; stepWorld(world);
  tot += wrap(yaw(mech) - prev); prev = yaw(mech);
  if (i % 90 === 0) {
    const W = mech.mass * 9.81;
    let fLag = 0;
    for (const sd of ["L", "R"]) {
      const lg = mech.legs[sd];
      if (lg.load > 0.15 * W) fLag = Math.max(fLag, Math.abs(wrap(st.heading - Math.atan2(lg.foot.R[6], lg.foot.R[8]))));
    }
    console.log((i / 120).toFixed(1), st.mode, "tot", (tot * 180 / Math.PI).toFixed(0), "pend", wrap(st.headingT - st.heading).toFixed(2), "fLag", fLag.toFixed(2), "waistTgt", mech.waist.target.toFixed(2), "waistAng", mech.waist.angle.toFixed(2), "R4", mech.hull.R[4].toFixed(3));
  }
  if (st.mode === "FALLEN") { console.log("FELL at", (i / 120).toFixed(1)); break; }
}
