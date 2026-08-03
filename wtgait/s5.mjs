// S5: SPEED-LED quick-step via the cadence machinery (engagement lowered)
// cadence follows built speed -> no bootstrap failure; strides+both phases co-scale.
import { walkEns, smoothQ, idx, mkQ } from "./qlib.mjs";
import { mechCommand } from "../src/engine/mech.js";
import { stepWorld } from "../src/engine/core.js";

// patch hooks: mech._cadEng / _cadSlope via a spec extension
function specApply(mech, eng, slope) { mech._cadEng = eng; mech._cadSlope = slope; }

for (const [eng, slope] of [[0.30, 0.8], [0.30, 1.2], [0.30, 1.6], [0.22, 1.2]]) {
  // smoothness with patched cadence
  const smoothP = (tv, yaw = 0) => {
    const { world, mech } = mkQ({}, yaw, 2);
    specApply(mech, eng, slope);
    let vy0 = 0, ay = [], vlat = [], r4d = [], vf = [], fell = false, cadMin = 1;
    const fw = { x: Math.sin(yaw), z: Math.cos(yaw) }, lf = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    for (let i = 0; i < Math.round(30 / world.dt); i++) {
      mechCommand(mech, { travel: tv, lateral: 0, heading: yaw });
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      const t = i * world.dt;
      if (mech.state.cadence < cadMin) cadMin = mech.state.cadence;
      if (t >= 12 && t <= 28) {
        ay.push((mech.hull.v.y - vy0) / world.dt);
        vlat.push(Math.abs(mech.hull.v.x * lf.x + mech.hull.v.z * lf.z));
        r4d.push(1 - mech.hull.R[4]);
        vf.push(mech.hull.v.x * fw.x + mech.hull.v.z * fw.z);
      }
      vy0 = mech.hull.v.y;
    }
    if (fell || ay.length < 100) return { fell: true, cadMin };
    const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
    const mVf = mean(vf);
    return { fell: false, cadMin, ayRms: rms(ay), ayP99: srt[Math.floor(srt.length * 0.99)], latRms: rms(vlat), r4Rip: mean(r4d), vfRip: Math.sqrt(mean(vf.map((v) => (v - mVf) ** 2))) / Math.max(0.05, mVf), vMean: mVf };
  };
  const s = smoothP(0.42);
  // ensemble with patched cadence
  let clean = 0; const falls = [];
  for (const yaw of [0, 2.36]) for (const off of [0, 0.7, 1.4]) {
    const { world, mech } = mkQ({}, yaw, 2 + off);
    specApply(mech, eng, slope);
    let fell = null, phase = "launch";
    for (let i = 0; i < Math.round(38 / world.dt); i++) {
      const t = i * world.dt;
      mechCommand(mech, { travel: t > 26 ? 0 : 0.42, lateral: 0, heading: yaw });
      world.events.length = 0; stepWorld(world);
      if (t > 4 && phase === "launch") phase = "cruise";
      if (t > 26) phase = "stop";
      if (mech.state.mode === "FALLEN") { fell = phase + "@" + t.toFixed(1); break; }
    }
    if (!fell && mech.state.mode === "STAND") clean++; else if (fell) falls.push(fell);
  }
  console.log("eng" + eng + " slope" + slope + ": idx", idx(s), "v", s.fell ? "-" : s.vMean.toFixed(2),
    "cadMin", s.cadMin?.toFixed(2), "| ens", clean + "/6", JSON.stringify(falls));
}
