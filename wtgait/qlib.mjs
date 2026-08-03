// Dynamic-gait campaign: quick-step harness.
// Ensemble runner over offsets x headings with fall-site classification,
// plus smoothness composite vs the pre-campaign baseline record.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
import { readFileSync } from "fs";

export const BASE = JSON.parse(readFileSync(new URL("../wtphys/baseline.jsonl", import.meta.url), "utf8").split("\n")[0]);
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// spec: { tSS, tDS, period0, adapt: {...flags}, thr }
export function mkQ(spec = {}, yaw = 0, settle = 2) {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0, yaw });
  if (spec.tSS) { mech.k.tSS *= spec.tSS; }
  if (spec.tDS) { mech.k.tDS *= spec.tDS; }
  mech.k.stepPeriod = mech.k.tSS + mech.k.tDS;
  if (spec.period0) mech.k._period0 = mech.k.stepPeriod; // re-certify anchor at the new period
  if (spec.adapt) mech.tAdapt = spec.adapt;
  if (spec.thr) { mech.thrustersOn = true; mech.thrustAssist = true; }
  const run = (s) => { const n = Math.round(s / world.dt); for (let i = 0; i < n; i++) { world.events.length = 0; stepWorld(world); } };
  run(settle);
  return { world, mech, run };
}

// walk ensemble: offsets x headings, tv for `secs`, then stop; classify falls
export function walkEns(spec, { tv = 0.42, secs = 26, offs = [0, 0.7, 1.4], yaws = [0, 2.36] } = {}) {
  const rows = [];
  for (const yaw of yaws) for (const off of offs) {
    const { world, mech } = mkQ(spec, yaw, 2 + off);
    let fell = null, phase = "launch";
    const fw = { x: Math.sin(yaw), z: Math.cos(yaw) };
    for (let i = 0; i < Math.round((secs + 12) / world.dt); i++) {
      const t = i * world.dt;
      mechCommand(mech, { travel: t > secs ? 0 : tv, lateral: 0, heading: yaw });
      world.events.length = 0; stepWorld(world);
      if (t > 4 && phase === "launch") phase = "cruise";
      if (t > secs) phase = "stop";
      if (mech.state.mode === "FALLEN") { fell = { t: +t.toFixed(1), phase }; break; }
    }
    const d = mech.hull.pos.x * fw.x + mech.hull.pos.z * fw.z;
    rows.push({ yaw, off, fell, dist: +d.toFixed(1), end: mech.state.mode });
  }
  const clean = rows.filter((r) => !r.fell && r.end === "STAND").length;
  return { clean, n: rows.length, rows };
}

// smoothness at tv, single heading (yaw), components vs BASE record
export function smoothQ(spec, tv = 0.42, yaw = 0) {
  const { world, mech } = mkQ({ ...spec, thr: spec.thr || tv > 0.5 }, yaw, 2);
  let vy0 = 0, ay = [], vlat = [], r4d = [], vf = [], fell = false;
  const fw = { x: Math.sin(yaw), z: Math.cos(yaw) }, lf = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  for (let i = 0; i < Math.round(30 / world.dt); i++) {
    mechCommand(mech, { travel: tv > 0.5 ? 0.9 : tv, lateral: 0, heading: yaw });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
    const t = i * world.dt;
    if (t >= 12 && t <= 28) {
      ay.push((mech.hull.v.y - vy0) / world.dt);
      vlat.push(Math.abs(mech.hull.v.x * lf.x + mech.hull.v.z * lf.z));
      r4d.push(1 - mech.hull.R[4]);
      vf.push(mech.hull.v.x * fw.x + mech.hull.v.z * fw.z);
    }
    vy0 = mech.hull.v.y;
  }
  if (fell || ay.length < 100) return { fell: true };
  const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
  const mVf = mean(vf);
  return {
    fell: false, ayRms: rms(ay), ayP99: srt[Math.floor(srt.length * 0.99)],
    latRms: rms(vlat), r4Rip: mean(r4d),
    vfRip: Math.sqrt(mean(vf.map((v) => (v - mVf) ** 2))) / Math.max(0.05, mVf), vMean: mVf,
  };
}
export function idx(s, b = BASE.s42) {
  if (s.fell) return 9.99;
  const r = [s.ayRms / b.ayRms, s.ayP99 / b.ayP99, s.latRms / b.latRms, s.r4Rip / b.r4Rip, s.vfRip / b.vfRip];
  return +Math.exp(r.reduce((a, x) => a + Math.log(Math.max(1e-3, x)), 0) / r.length).toFixed(3);
}
