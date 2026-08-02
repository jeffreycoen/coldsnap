// Turn lab: feed-rate ladder for sustained walking turns + parked turns.
// Usage: node wtdbg2/turnlab.mjs [feed] [travel] [trace]
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const feeds = process.argv[2] ? [Number(process.argv[2])] : [0.5, 0.65, 0.82];
const travel = process.argv[3] != null ? Number(process.argv[3]) : 0.42;
const trace = process.argv[4] === "trace";
for (const feed of feeds) {
  let clean = 0; const times = []; const det = [];
  for (const off of [0, 0.7, 1.4]) {
    const field = makeField(64, 1.7, 5); field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: 0 });
    mech.thrustersOn = true; mech.thrustAssist = true; // game config
    if (process.env.WCAP) mech.tune.windCap = Number(process.env.WCAP);
    if (process.env.WAIST) mech.tune.waistTurn = Number(process.env.WAIST);
    if (process.env.TDS) mech.tune.turnDS = Number(process.env.TDS);
    for (let i = 0; i < Math.round((2 + off) / world.dt); i++) { world.events.length = 0; stepWorld(world); }
    if (travel > 0) for (let i = 0; i < Math.round(8 / world.dt); i++) { mechCommand(mech, { travel, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
    const y0 = yaw(mech);
    let yawT = yaw(mech), t90 = -1, t180 = -1, fell = -1, tot = 0, prev = y0;
    for (let i = 0; i < Math.round(45 / world.dt); i++) {
      yawT -= feed * world.dt;
      const yn = yaw(mech);
      yawT = yn + Math.max(-0.5, Math.min(0.5, wrap(yawT - yn)));
      mechCommand(mech, { travel, lateral: 0, heading: mech.state.aboutFace && !mech.state.afLive ? null : yawT }); // live pivots track the stick; only the 180 button freezes
      world.events.length = 0; stepWorld(world);
      tot += wrap(yaw(mech) - prev); prev = yaw(mech);
      const t = i * world.dt;
      if (trace && off === 0 && i % 60 === 0) console.log(t.toFixed(1), mech.state.mode, "af", String(mech.state.aboutFace || "-"), "tot", (tot * 180 / Math.PI).toFixed(0), "hdg", (mech.state.heading * 180 / Math.PI).toFixed(0), "hdgT", (mech.state.headingT * 180 / Math.PI).toFixed(0), "R4", mech.hull.R[4].toFixed(3), "rec", (mech.state.recoverT || 0).toFixed(1));
      if (mech.state.mode === "FALLEN") { fell = t; break; }
      if (t90 < 0 && Math.abs(tot) > Math.PI / 2) t90 = t;
      if (t180 < 0 && Math.abs(tot) > Math.PI) { t180 = t; break; }
    }
    if (fell < 0) { clean++; times.push(t90); } else det.push("off" + off + "@" + fell.toFixed(0));
  }
  const avg90 = times.filter(t => t > 0);
  console.log("feed", feed, "travel", travel, ":", clean + "/3", "t90 avg", avg90.length ? (avg90.reduce((a, b) => a + b, 0) / avg90.length).toFixed(1) + "s" : "-", det.join(" "));
}
