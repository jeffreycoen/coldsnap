// Ensemble verdict for a (period, gains) cell: 3 offsets x 1 heading half.
// Usage: node wtpole/walk6.mjs <P> <half 0|1> [gainsJSON]
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const P = Number(process.argv[2] || 1);
const HALF = Number(process.argv[3] || 0);
const GAINS = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const heading = HALF === 0 ? 0 : 2.36;
const out = [];
for (const off of [0, 0.6, 1.2]) {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0, yaw: heading });
  const k = mech.k;
  k.tSS *= P; k.tDS *= P; k.stepPeriod = k.tSS + k.tDS;
  k._period0 = k.stepPeriod;
  for (const [n, v] of Object.entries(GAINS)) {
    if (n === "cruiseGains") k.cruiseGains = v;
    else if (n === "cruisePeriodScale") { k.cruisePeriod = { tSS: k.tSS * v, tDS: k.tDS * v }; k._period0 = (k.tSS + k.tDS) * v; }
    else k[n] = v;
  }
  const dt = world.dt;
  for (let i = 0; i < Math.round((2 + off) / dt); i++) { world.events.length = 0; stepWorld(world); }
  let fell = false, dist0 = mech.hull.pos.z;
  for (let i = 0; i < Math.round(40 / dt); i++) {
    const t = i * dt;
    mechCommand(mech, { travel: t > 32 ? 0 : 0.42, lateral: 0, heading });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
  }
  const d = Math.hypot(mech.hull.pos.x - 0, mech.hull.pos.z - dist0);
  out.push({ off, heading, fell, end: mech.state.mode, dist: +d.toFixed(1) });
}
console.log(JSON.stringify({ P, HALF, GAINS, out, clean: out.filter((r) => !r.fell && r.end === "STAND").length }));
