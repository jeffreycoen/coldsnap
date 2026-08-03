// Smoothness composite at a given (config, heading, offset), window 15-28s.
// Usage: node wtpole/smoothp.mjs <heading> <offset> [gainsJSON]
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const H = Number(process.argv[2] || 0);
const OFF = Number(process.argv[3] || 0);
const GAINS = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const field = makeField(64, 1.7, 5); field.h.fill(0);
const world = makeWorld({ field, seed: 5 });
const mech = buildMech(world, { x: 0, z: 0, yaw: H });
const k = mech.k;
for (const [n, v] of Object.entries(GAINS)) {
  if (n === "cruiseGains") k.cruiseGains = v;
  else if (n === "cruisePeriodScale") { k.cruisePeriod = { tSS: k.tSS * v, tDS: k.tDS * v }; k._period0 = (k.tSS + k.tDS) * v; }
  else k[n] = v;
}
const dt = world.dt;
for (let i = 0; i < Math.round((2 + OFF) / dt); i++) { world.events.length = 0; stepWorld(world); }
let vy0 = 0; const ay = [], vlat = [], r4d = [], vf = [];
let fell = false;
const fwd = { x: Math.sin(H), z: Math.cos(H) }, left = { x: Math.cos(H), z: -Math.sin(H) };
for (let i = 0; i < Math.round(30 / dt); i++) {
  mechCommand(mech, { travel: 0.42, lateral: 0, heading: H });
  world.events.length = 0; stepWorld(world);
  if (mech.state.mode === "FALLEN") { fell = true; break; }
  const t = i * dt;
  if (t >= 15 && t <= 28) {
    ay.push((mech.hull.v.y - vy0) / dt);
    vlat.push(Math.abs(mech.hull.v.x * left.x + mech.hull.v.z * left.z));
    r4d.push(1 - mech.hull.R[4]);
    vf.push(mech.hull.v.x * fwd.x + mech.hull.v.z * fwd.z);
  }
  vy0 = mech.hull.v.y;
}
if (fell || ay.length < 100) { console.log(JSON.stringify({ H, OFF, GAINS, fell: true })); process.exit(0); }
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
const mVf = mean(vf);
console.log(JSON.stringify({ H, OFF, GAINS, fell: false,
  ayRms: +rms(ay).toFixed(3), ayP99: +srt[Math.floor(srt.length * 0.99)].toFixed(3),
  latRms: +rms(vlat).toFixed(3), r4Rip: +mean(r4d).toFixed(5),
  vfRip: +(Math.sqrt(mean(vf.map((v) => (v - mVf) ** 2))) / Math.max(0.05, mVf)).toFixed(3),
  vMean: +mVf.toFixed(3), period: +k.stepPeriod.toFixed(3) }));
