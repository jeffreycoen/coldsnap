// S7: short period x high command, governor bypassed (st.govF injected),
// certified-style launch: 0.42 for 6s, then step to target.
import { mkQ, idx } from "./qlib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import { stepWorld } from "../src/engine/core.js";

const trial = (tssF, cmd, yaw = 0, settle = 2, secs = 30) => {
  const { world, mech } = mkQ({ tSS: tssF, period0: 1 }, yaw, settle);
  let vy0 = 0, ay = [], vlat = [], r4d = [], vf = [], fell = null, phase = "launch";
  const fw = { x: Math.sin(yaw), z: Math.cos(yaw) }, lf = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  for (let i = 0; i < Math.round((secs + 12) / world.dt); i++) {
    const t = i * world.dt;
    const tv = t > secs ? 0 : t < 6 ? 0.42 : cmd;
    mechCommand(mech, { travel: tv, lateral: 0, heading: yaw });
    mech.state.govF = tv > 0.5 ? 5 : mech.state.govF; // bypass: deliver the command raw
    world.events.length = 0; stepWorld(world);
    if (t > 6 && phase === "launch") phase = "cruise";
    if (t > secs) phase = "stop";
    if (mech.state.mode === "FALLEN") { fell = phase + "@" + t.toFixed(1); break; }
    if (t >= 14 && t <= 28) {
      ay.push((mech.hull.v.y - vy0) / world.dt);
      vlat.push(Math.abs(mech.hull.v.x * lf.x + mech.hull.v.z * lf.z));
      r4d.push(1 - mech.hull.R[4]);
      vf.push(mech.hull.v.x * fw.x + mech.hull.v.z * fw.z);
    }
    vy0 = mech.hull.v.y;
  }
  const end = mech.state.mode;
  if (fell || ay.length < 100) return { fell: fell || "short", end };
  const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
  const mVf = mean(vf);
  return { fell: null, end, ayRms: rms(ay), ayP99: srt[Math.floor(srt.length * 0.99)], latRms: rms(vlat), r4Rip: mean(r4d), vfRip: Math.sqrt(mean(vf.map((v) => (v - mVf) ** 2))) / Math.max(0.05, mVf), vMean: mVf };
};

for (const tssF of [1.0, 0.65, 0.5]) for (const cmd of [0.6, 0.75]) {
  const s = trial(tssF, cmd);
  console.log("tSS@" + tssF + " cmd" + cmd + ":",
    s.fell ? "FELL " + s.fell : "idx " + idx(s) + " v " + s.vMean.toFixed(2) + " ay " + s.ayRms.toFixed(2) + " lat " + s.latRms.toFixed(2) + " end " + s.end);
}
