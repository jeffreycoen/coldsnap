// Physics factorial campaign: shared harness (patchers + metric batteries).
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechAboutFace, mechPivot, RIG } from "../src/engine/mech.js";

const RIG0 = JSON.parse(JSON.stringify(RIG));
export const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const yawOf = (m) => Math.atan2(m.hull.R[6], m.hull.R[8]);

// ---- factor application -----------------------------------------------------
// spec: { name: factorValue } — each name maps to a patcher.
// RIG-group patchers mutate RIG BEFORE build (restored after); post-group
// patchers mutate the built mech.
const RIG_PATCH = {
  kpDegKnee: (f) => { RIG.kpDeg.knee = RIG0.kpDeg.knee * f; },
  kpDegHipP: (f) => { RIG.kpDeg.hipPitch = RIG0.kpDeg.hipPitch * f; },
  kpDegHipR: (f) => { RIG.kpDeg.hipRoll = RIG0.kpDeg.hipRoll * f; },
  kpDegAnk: (f) => { RIG.kpDeg.anklePitch = RIG0.kpDeg.anklePitch * f; RIG.kpDeg.ankleRoll = RIG0.kpDeg.ankleRoll * f; },
  BW: (f) => { RIG.BW = RIG0.BW * f; },
  zeta: (f) => { RIG.zeta = RIG0.zeta * f; },
  wlFrac: (f) => { for (const k of Object.keys(RIG.wlFrac)) RIG.wlFrac[k] = RIG0.wlFrac[k] * f; },
  ballast: (f) => { // f>1: shift mass hull->torso; f<1: torso->hull (total const)
    const d = (f - 1) * 1800;
    RIG.hull.m = RIG0.hull.m - d;
  },
  footLen: (f) => { RIG.foot.hz = RIG0.foot.hz * f; },
  footWid: (f) => { RIG.foot.hx = RIG0.foot.hx * f; },
};
const POST_PATCH = {
  tSS: (m, f) => { m.k.tSS *= f; m.k.stepPeriod = m.k.tSS + m.k.tDS; },
  tDS: (m, f) => { m.k.tDS *= f; m.k.stepPeriod = m.k.tSS + m.k.tDS; },
  strideCap: (m, f) => { m.k.strideCap *= f; },
  stepHeight: (m, f) => { m.k.stepHeight *= f; },
  copLim: (m, f) => { m.k.copLimitX *= f; m.k.copLimitZ *= f; },
  kCop: (m, f) => { m.k.kCop *= f; },
  kCapture: (m, f) => { m.k.kCapture *= f; },
  travelRate: (m, f) => { m.k.travelRate *= f; },
  turnRate: (m, f) => { m.k.turnRate *= f; },
  fzKp: (m, f) => { m.tune.fzKp *= f; },
  fzKd: (m, f) => { m.tune.fzKd *= f; },
  katt: (m, f) => { m.tune.katt *= f; },
  cmgKp: (m, f) => { m.tune.cmgKp *= f; },
  cmgKd: (m, f) => { m.tune.cmgKd *= f; },
  cmgSlew: (m, f) => { m.tune.cmgSlew *= f; },
  cmgCap: (m, f) => { m.tune.cmgCap = 0.13 * f; },
  turnDS: (m, f) => { m.tune.turnDS *= f; },
  afRate: (m, f) => { m.tune.afRate *= f; },
  thrustMax: (m, f) => { m.thrustMax *= f; },
  raibert: (m, f) => { m._raibert = 1.3 * f; },
  wantVCap: (m, f) => { m._wantVCap = 0.68 * f; },
  cadSlope: (m, f) => { m._cadSlope = 0.55 * f; },
  solveIT: (m, f) => { m.solveIT = Math.round(12 * f); },
  cfmF: (m, f) => { m.cfmF = 0.2 * f; },
  hRecRate: (m, f) => { m.hRecRate = 0.5 * f; },
  weldK: (m, f) => { for (const j of m.joints) j.weldK = f; },
  stopAlpha: (m, f) => { for (const j of m.joints) j.stopAlpha = 1e-7 * f; },
  servoKp: (m, f) => { for (const j of m.joints) { if (j.name === "waist" || j.name.includes("armSwing")) continue; j.kp *= f; j.kd = Math.min(j.kp * 6 / 120, 0.9 * j.Ichain * 120); j.kv = 0.02 * j.kd; } },
  tauMax: (m, f) => { for (const j of m.joints) { if (j.name === "waist" || j.name.includes("armSwing")) continue; j.tauMax *= f; } },
  friction: (m, f) => { for (const s of ["L", "R"]) m.legs[s].foot.friction = Math.min(0.99, 0.95 * f); },
  magicAnchor: (m, f) => { m.magicAnchor = f; },
  magicRide: (m, f) => { m.magicRide = f; },
  magicYaw: (m, f) => { m.magicYaw = f; },
  magicTd: (m, f) => { m.magicTd = f; },
  magicRail: (m, f) => { m.magicRail = f; },
  magicSway: (m, f) => { m.magicSway = f; },
};
export function mk(spec = {}, opts = {}) {
  for (const [k, f] of Object.entries(spec)) if (RIG_PATCH[k]) RIG_PATCH[k](f);
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: opts.z || 0 });
  Object.assign(RIG, JSON.parse(JSON.stringify(RIG0)));
  RIG.kpDeg = JSON.parse(JSON.stringify(RIG0.kpDeg));
  RIG.wlFrac = JSON.parse(JSON.stringify(RIG0.wlFrac));
  RIG.foot = JSON.parse(JSON.stringify(RIG0.foot));
  RIG.hull = JSON.parse(JSON.stringify(RIG0.hull));
  for (const [k, f] of Object.entries(spec)) if (POST_PATCH[k]) POST_PATCH[k](mech, f);
  if (opts.thr) { mech.thrustersOn = true; mech.thrustAssist = true; }
  return { world, mech };
}
export const run = (w, s) => { const n = Math.round(s / w.dt); for (let i = 0; i < n; i++) { w.events.length = 0; stepWorld(w); } };

// ---- smoothness composite ---------------------------------------------------
// steady cruise window; returns raw components (lower = smoother).
export function smooth(spec, tv) {
  const { world, mech } = mk(spec, { thr: tv > 0.5 });
  run(world, 2);
  let vy0 = 0, ay = [], vlat = [], r4d = [], vf = [], fell = false;
  let aPrev = 0;
  for (let i = 0; i < Math.round(30 / world.dt); i++) {
    mechCommand(mech, { travel: tv > 0.5 ? 0.9 : tv, lateral: 0, heading: 0 });
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
    const t = i * world.dt;
    if (t >= 12 && t <= 28) {
      const a = (mech.hull.v.y - vy0) / world.dt;
      ay.push(a);
      vlat.push(Math.abs(mech.hull.v.x));
      r4d.push(1 - mech.hull.R[4]);
      vf.push(mech.hull.v.z);
      aPrev = a;
    }
    vy0 = mech.hull.v.y;
  }
  if (fell || ay.length < 100) return { fell: true };
  const rms = (arr) => Math.sqrt(arr.reduce((s, x) => s + x * x, 0) / arr.length);
  const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const srt = [...ay].map(Math.abs).sort((a, b) => a - b);
  const p99 = srt[Math.floor(srt.length * 0.99)];
  const mVf = mean(vf);
  return {
    fell: false,
    ayRms: rms(ay),                    // vertical accel RMS
    ayP99: p99,                        // slam spikes
    latRms: rms(vlat),                 // lateral sway
    r4Rip: mean(r4d),                  // attitude wobble depth
    vfRip: Math.sqrt(mean(vf.map(v => (v - mVf) ** 2))) / Math.max(0.05, mVf), // speed ripple
    vMean: mVf,
  };
}
// composite ratio vs a baseline record (geometric mean of 5 ratios)
export function smoothIndex(s, b) {
  if (s.fell) return 9.99;
  const r = [s.ayRms / b.ayRms, s.ayP99 / b.ayP99, s.latRms / b.latRms, s.r4Rip / b.r4Rip, s.vfRip / b.vfRip];
  return Math.exp(r.reduce((a, x) => a + Math.log(Math.max(1e-3, x)), 0) / r.length);
}

// ---- capability battery -----------------------------------------------------
export function battery(spec) {
  const out = {};
  { // walk 10m at 0.5 + stop
    const { world, mech } = mk(spec);
    run(world, 2);
    let t10 = -1, fell = false;
    for (let i = 0; i < Math.round(30 / world.dt); i++) {
      mechCommand(mech, { travel: 0.5, lateral: 0, heading: 0 });
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      if (t10 < 0 && mech.hull.pos.z > 10) { t10 = i * world.dt; break; }
    }
    let tStop = -1;
    if (!fell && t10 > 0) {
      for (let i = 0; i < Math.round(10 / world.dt); i++) {
        mechCommand(mech, { travel: 0, lateral: 0, heading: 0 });
        world.events.length = 0; stepWorld(world);
        if (mech.state.mode === "FALLEN") { fell = true; break; }
        if (mech.state.mode === "STAND") { tStop = i * world.dt; break; }
      }
    }
    out.walk10 = fell ? -1 : t10; out.stop = fell ? -1 : tStop;
  }
  { // parked->pivot 90 deg (game-identical: feed + mechPivot when walking)
    const { world, mech } = mk(spec);
    run(world, 2);
    let yawT = yawOf(mech), tot = 0, prev = yawOf(mech), t90 = -1, fell = false;
    for (let i = 0; i < Math.round(25 / world.dt); i++) {
      yawT -= 0.82 * world.dt;
      const yn = mech.state.heading;
      yawT = yn + Math.max(-0.5, Math.min(0.5, wrap(yawT - yn)));
      mechCommand(mech, { travel: 0, lateral: 0, heading: yawT });
      if (mech.state.mode === "WALK" && !mech.state.aboutFace) mechPivot(world, mech);
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      tot += wrap(yawOf(mech) - prev); prev = yawOf(mech);
      if (t90 < 0 && Math.abs(tot) > Math.PI / 2) { t90 = i * world.dt; break; }
    }
    out.turn90 = fell ? -1 : t90;
  }
  { // about-face
    const { world, mech } = mk(spec);
    run(world, 2);
    const y0 = yawOf(mech);
    mechAboutFace(world, mech);
    let done = -1, fell = false;
    for (let i = 0; i < Math.round(45 / world.dt); i++) {
      world.events.length = 0; stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = true; break; }
      if (done < 0 && !mech.state.aboutFace && mech.state.mode === "STAND" && Math.abs(wrap(yawOf(mech) - y0 - Math.PI)) < 0.15) { done = i * world.dt; break; }
    }
    out.aface = fell ? -1 : done;
  }
  { // assisted cruise, offsets 0 + 1.2
    let clean = 0, cr = 0;
    for (const off of [0, 1.2]) {
      const { world, mech } = mk(spec, { thr: true });
      run(world, 2 + off);
      let fell = false, z25 = 0, z35 = 0;
      for (let i = 0; i < Math.round(45 / world.dt); i++) {
        const t = i * world.dt;
        mechCommand(mech, { travel: t > 38 ? 0 : 0.9, lateral: 0, heading: 0 });
        world.events.length = 0; stepWorld(world);
        if (t >= 25 && z25 === 0) z25 = mech.hull.pos.z;
        if (t >= 35 && z35 === 0) z35 = mech.hull.pos.z;
        if (mech.state.mode === "FALLEN") { fell = true; break; }
      }
      if (!fell) { clean++; if (off === 0) cr = (z35 - z25) / 10; }
    }
    out.cruiseN = clean; out.cruiseV = cr;
  }
  { // shove ladder 48k, 56k
    let env = 0;
    for (const imp of [48000, 56000]) {
      const { world, mech } = mk(spec, { thr: true });
      run(world, 5);
      mech.hull.v.x += imp / mech.hull.mass;
      let fell = false;
      for (let i = 0; i < Math.round(12 / world.dt); i++) { world.events.length = 0; stepWorld(world); if (mech.state.mode === "FALLEN") { fell = true; break; } }
      if (!fell) env = imp;
    }
    out.shove = env;
  }
  return out;
}
