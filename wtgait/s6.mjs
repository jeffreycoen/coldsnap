// S6: SHORT PERIOD x HIGH COMMAND — the certified-stride quick-step region.
// Static tSS scaling + period0 + swing boost; governor cap lifted (hook);
// thrusters off (pure gait first).
import { mkQ, idx } from "./qlib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import { stepWorld } from "../src/engine/core.js";

const trial = (tssF, cmd, yaw = 0, settle = 2, secs = 26) => {
  const { world, mech } = mkQ({ tSS: tssF, period0: 1 }, yaw, settle);
  mech._govCap = 0.9;
  let vy0 = 0, ay = [], vlat = [], r4d = [], vf = [], fell = null, phase = "launch";
  const fw = { x: Math.sin(yaw), z: Math.cos(yaw) }, lf = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  for (let i = 0; i < Math.round((secs + 12) / world.dt); i++) {
    const t = i * world.dt;
    mechCommand(mech, { travel: t > secs ? 0 : cmd, lateral: 0, heading: yaw });
    world.events.length = 0; stepWorld(world);
    if (t > 5 && phase === "launch") phase = "cruise";
    if (t > secs) phase = "stop";
    if (mech.state.mode === "FALLEN") { fell = phase + "@" + t.toFixed(1); break; }
    if (t >= 12 && t <= 24) {
      ay.push((mech.hull.v.y - vy0) / world.dt);
      vlat.push(Math.abs(mech.hull.v.x * lf.x + mech.hull.v.z * lf.z));
      r4d.push(1 - mech.hull.R[4]);
      vf.push(mech.hull.v.x * fw.x + mech.hull.v.z * fw.z);
    }
    vy0 = mech.hull.v.y;
  }
  const end = mech.state.mode;
  if (fell || ay.length < 100) return { fell: fell || "short-window", end };
  const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
  const mVf = mean(vf);
  return { fell: null, end, ayRms: rms(ay), ayP99: srt[Math.floor(srt.length * 0.99)], latRms: rms(vlat), r4Rip: mean(r4d), vfRip: Math.sqrt(mean(vf.map((v) => (v - mVf) ** 2))) / Math.max(0.05, mVf), vMean: mVf };
};

for (const tssF of [0.65, 0.5]) for (const cmd of [0.6, 0.7, 0.8]) {
  const s = trial(tssF, cmd);
  console.log("tSS@" + tssF + " cmd" + cmd + ":",
    s.fell ? "FELL " + s.fell : "idx " + idx(s) + " v " + s.vMean.toFixed(2) + " ay " + s.ayRms.toFixed(2) + " end " + s.end);
}
