// Ring-buffer the last 3s of a sustained-turn death; dump on fall.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, capturePoint } from "../src/engine/mech.js";
const yaw = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const field = makeField(64, 1.7, 5); field.h.fill(0);
const world = makeWorld({ field, seed: 5 });
const mech = buildMech(world, { x: 0, z: 0 });
mech.thrustersOn = true; mech.thrustAssist = true;
for (let i = 0; i < Math.round(2.4 / world.dt); i++) { world.events.length = 0; stepWorld(world); } // off 0.4
let yawT = yaw(mech);
const st = mech.state;
const ring = [];
let lastCatches = 0, lastSteps = 0;
for (let i = 0; i < Math.round(45 / world.dt); i++) {
  mechCommand(mech, { travel: 0.9, lateral: 0, heading: 0 }); // assisted cruise, no turn
  world.events.length = 0; stepWorld(world);
  const t = i * world.dt;
  if (i % 6 === 0) {
    // xi error in the HEADING frame
    let m2 = 0, cx = 0, cy = 0, cz = 0, vx = 0, vz = 0;
    for (const b of mech.links) { m2 += b.mass; cx += b.mass * b.pos.x; cy += b.mass * b.pos.y; cz += b.mass * b.pos.z; vx += b.mass * b.v.x; vz += b.mass * b.v.z; }
    cx /= m2; cy /= m2; cz /= m2; vx /= m2; vz /= m2;
    const om = Math.sqrt(9.81 / Math.max(0.5, cy));
    const xix = cx + vx / om, xiz = cz + vz / om;
    const fmx = (st.prints.L.x + st.prints.R.x) / 2, fmz = (st.prints.L.z + st.prints.R.z) / 2;
    const h = st.heading, fw = { x: Math.sin(h), z: Math.cos(h) }, lf = { x: Math.cos(h), z: -Math.sin(h) };
    const eF = (xix - fmx) * fw.x + (xiz - fmz) * fw.z;
    const eL = (xix - fmx) * lf.x + (xiz - fmz) * lf.z;
    const ph = st.phases && st.phases[st.pi];
    const ev = [];
    if (mech.telem.catches !== lastCatches) { ev.push("CATCH"); lastCatches = mech.telem.catches; }
    if (mech.telem.steps !== lastSteps) { ev.push("step"); lastSteps = mech.telem.steps; }
    ring.push([t.toFixed(2), st.mode, "af:" + String(st.aboutFace || "-"), ph ? ph.kind + "/" + ph.stance : "-", "eF " + eF.toFixed(2), "eL " + eL.toFixed(2), "R4 " + mech.hull.R[4].toFixed(3), "rec " + (st.recoverT || 0).toFixed(1), "burn " + Math.max(...mech.thrusters.map(x => x.cur)).toFixed(1), ev.join("+")].join(" "));
    if (ring.length > 60) ring.shift();
  }
  if (st.mode === "FALLEN") { console.log("FELL at", t.toFixed(1) + "s; last 3s:"); for (const r of ring) console.log(r); break; }
}
