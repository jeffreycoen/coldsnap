// Advisor campaign baseline: every metric the campaign intends to move.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechAboutFace } from "../src/engine/mech.js";
const mk = (thr = false) => {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0 });
  if (thr) { mech.thrustersOn = true; mech.thrustAssist = true; }
  return { world, mech };
};
const run = (w, s) => { for (let i = 0; i < Math.round(s / w.dt); i++) { w.events.length = 0; stepWorld(w); } };
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// 1. walk-start latency (quiet stand -> cmd 0.42): time to WALK, to 0.5m
{
  const { world, mech } = mk();
  run(world, 5);
  const z0 = mech.hull.pos.z;
  let tWalk = -1, tHalf = -1;
  for (let i = 0; i < Math.round(8 / world.dt); i++) {
    mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    const t = i * world.dt;
    if (tWalk < 0 && mech.state.mode === "WALK") tWalk = t;
    if (tHalf < 0 && mech.hull.pos.z - z0 > 0.5) tHalf = t;
  }
  console.log("walk-start: WALK at", tWalk.toFixed(2) + "s, 0.5m at", tHalf.toFixed(2) + "s");
}
// 2. stop latency (0.42 cruise -> cmd 0): time to STAND
{
  const { world, mech } = mk();
  run(world, 2);
  for (let i = 0; i < Math.round(12 / world.dt); i++) { mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
  let tStand = -1;
  for (let i = 0; i < Math.round(10 / world.dt); i++) {
    mechCommand(mech, { travel: 0, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "STAND") { tStand = i * world.dt; break; }
  }
  console.log("stop: STAND at", tStand.toFixed(2) + "s after release");
}
// 3. parked turn: stick-fed 30s total; time to 90 deg
{
  const { world, mech } = mk();
  run(world, 2);
  let yawT = yaw(mech), tot = 0, prev = yaw(mech), t90 = -1;
  for (let i = 0; i < Math.round(30 / world.dt); i++) {
    yawT -= 0.82 * world.dt;
    const yn = mech.state.heading; // game-identical anchor
    yawT = yn + Math.max(-0.5, Math.min(0.5, wrap(yawT - yn)));
    mechCommand(mech, { travel: 0, lateral: 0, heading: yawT });
    world.events.length = 0; stepWorld(world);
    tot += wrap(yaw(mech) - prev); prev = yaw(mech);
    if (t90 < 0 && Math.abs(tot) > Math.PI / 2) t90 = i * world.dt;
  }
  console.log("parked turn: total 30s =", (Math.abs(tot) * 180 / Math.PI).toFixed(0) + " deg, 90deg in", t90 < 0 ? ">30s" : t90.toFixed(1) + "s");
}
// 4. walking 90-deg turn time at 0.42
{
  const { world, mech } = mk();
  run(world, 2);
  for (let i = 0; i < Math.round(8 / world.dt); i++) { mechCommand(mech, { travel: 0.42, lateral: 0, heading: 0 }); world.events.length = 0; stepWorld(world); }
  const y0 = yaw(mech);
  let yawT = yaw(mech), t90 = -1, fell = false;
  for (let i = 0; i < Math.round(40 / world.dt); i++) {
    yawT -= 0.82 * world.dt;
    const yn = mech.state.heading; // game-identical anchor
    yawT = yn + Math.max(-0.5, Math.min(0.5, wrap(yawT - yn)));
    mechCommand(mech, { travel: 0.42, lateral: 0, heading: yawT });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
    if (t90 < 0 && Math.abs(wrap(yaw(mech) - y0)) > Math.PI / 2) { t90 = i * world.dt; break; }
  }
  console.log("walking 90deg turn:", fell ? "FELL" : t90 < 0 ? ">40s" : t90.toFixed(1) + "s");
}
// 5. assisted cruise 6-offset
{
  let clean = 0, cruise = 0;
  for (const off of [0, 0.4, 0.8, 1.2, 1.6, 2.0]) {
    const { world, mech } = mk(true);
    run(world, 2 + off);
    let fell = false, z30 = 0, z40 = 0;
    for (let i = 0; i < Math.round(60 / world.dt); i++) {
      const t = i * world.dt;
      mechCommand(mech, { travel: t > 42 ? 0 : 0.9, lateral: 0, heading: 0 });
      world.events.length = 0; stepWorld(world);
      if (t >= 30 && z30 === 0) z30 = mech.hull.pos.z;
      if (t >= 40 && z40 === 0) z40 = mech.hull.pos.z;
      if (mech.state.mode === "FALLEN") { fell = true; break; }
    }
    if (!fell && mech.state.mode === "STAND") clean++;
    if (off === 0 && !fell) cruise = (z40 - z30) / 10;
  }
  console.log("assisted cruise: " + clean + "/6, " + cruise.toFixed(2) + " m/s");
}
// 6. shove envelope with rockets
{
  const env = [];
  for (const imp of [48000, 56000, 64000, 72000]) {
    const { world, mech } = mk(true);
    run(world, 5);
    mech.hull.v.x += imp / mech.hull.mass;
    let fell = false;
    for (let i = 0; i < Math.round(12 / world.dt); i++) { world.events.length = 0; stepWorld(world); if (mech.state.mode === "FALLEN") { fell = true; break; } }
    env.push(imp / 1000 + "k:" + (fell ? "FELL" : "ok"));
  }
  console.log("shove:", env.join(" "));
}
// 7. about-face from stand: time
{
  const { world, mech } = mk();
  run(world, 2);
  const y0 = yaw(mech);
  mechAboutFace(world, mech);
  let done = -1;
  for (let i = 0; i < Math.round(55 / world.dt); i++) {
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { done = -2; break; }
    if (done < 0 && !mech.state.aboutFace && mech.state.mode === "STAND" && Math.abs(wrap(yaw(mech) - y0 - Math.PI)) < 0.15) { done = i * world.dt; break; }
  }
  console.log("about-face:", done === -2 ? "FELL" : done < 0 ? "incomplete" : done.toFixed(1) + "s");
}
