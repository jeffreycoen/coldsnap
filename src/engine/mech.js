// engine/mech.js — biped walker: hinge joints, the mech island, rig builder,
// and the gait controller. Implements docs/mech-spec.md (MK1.43.0 v4).
// The core stays a contacts+welds engine; everything mech lives here behind
// the world.mechStep hook, and core carries only guarded no-op edits (marked
// DIVERGENCE) so golden parity holds. Determinism: no rng, no Date — all
// controller state derives from world state.
import { addBody, addWeld, __mech__ } from "./core.js";
const { V, v3, qFromAxis, qMul, qNorm, rMulVec, rTMulVec, iMulVec, wake } = __mech__;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smoothstep = (s) => { const t = clamp(s, 0, 1); return t * t * (3 - 2 * t); };
// sin^2: zero slope at BOTH ends — lands at zero commanded vertical speed (spec §3)
export function swingLift(s, h) { const p = Math.sin(Math.PI * s); return p * p * h; }

// ---------------------------------------------------------------- gait math (spec §1, §2)
export function deriveGait(L, comH, halfStance, foot, g = 9.81) {
  const omega = Math.sqrt(g / comH);
  const AG = 0.7;
  const tSS = 1.66 * AG / omega;
  const tDS = 0.92 * AG / omega;
  return {
    omega, tSS, tDS,
    stepPeriod: tSS + tDS,
    strideCap: 0.28 * L,
    stepHeight: 0.08 * L,
    pelvisDrop: 0.085 * L,
    copLimitX: 0.80 * (foot.halfLen - foot.ankleOffX),
    copLimitZ: 0.65 * foot.halfWid,
    copClamp: 0.45 * (L / 2.95),
    halfStance,
    minFootSep: Math.min(2 * foot.halfWid + 0.06 * (L / 2.95), 1.9 * halfStance),
    splayMax: 1.40,
    yawPerStep: 8 * Math.PI / 180,
    turnRate: (8 * Math.PI / 180) / (tSS + tDS),
    travelRate: 0.6 * Math.sqrt(L / 2.95),
    kDCM: 2.0,
    kCapture: 1.0,
    capCommit: 0.5,
    capDeadband: 0.15,
    restExt: 0.93,
    // spec's 0.40 assumes a stiff ankle position servo behind it; with
    // torque-only stance ankles the CoP trim IS the anti-lean authority and
    // 0.40 saturated at 3 degrees of hull lean (measured slow topple)
    kCop: 0.90,
  };
}
export function capturePoint(com, comVel, g) {
  const om = Math.sqrt(g / Math.max(1e-4, com.y));
  return { x: com.x + comVel.x / om, z: com.z + comVel.z / om };
}
function swingTargetXZ(s, from, nom, xiErr, hold, k) {
  if (s < k.capCommit || !hold.cap) {
    let cx = k.kCapture * xiErr.x, cz = k.kCapture * xiErr.z;
    const m = Math.hypot(cx, cz), db = k.capDeadband * k.strideCap;
    const sc = m > 1e-9 ? Math.max(0, m - db) / m : 0;
    cx *= sc; cz *= sc;
    const cm = Math.hypot(cx, cz);
    if (cm > k.strideCap) { cx *= k.strideCap / cm; cz *= k.strideCap / cm; }
    hold.cap = { x: cx, z: cz };
  }
  const tx = nom.x + hold.cap.x, tz = nom.z + hold.cap.z;
  const e = smoothstep(s);
  return { x: from.x + (tx - from.x) * e, z: from.z + (tz - from.z) * e };
}
function copCommand(zmpRef, xiErr, hold, k) {
  if (!hold.cop || Math.hypot(xiErr.x - hold.cop.x, xiErr.z - hold.cop.z) > 0.25 * k.copClamp)
    hold.cop = { x: xiErr.x, z: xiErr.z };
  return {
    x: zmpRef.x + clamp(k.kDCM * hold.cop.x, -k.copClamp, k.copClamp),
    z: zmpRef.z + clamp(k.kDCM * hold.cop.z, -k.copClamp, k.copClamp),
  };
}
function planStop(xi, feetMid, k) {
  let ax = k.kCapture * (xi.x - feetMid.x), az = k.kCapture * (xi.z - feetMid.z);
  const m = Math.hypot(ax, az);
  if (m > k.strideCap) { ax *= k.strideCap / m; az *= k.strideCap / m; }
  return { x: ax, z: az };
}
// ---- the plan (spec §2b): N=4 footprints ahead + the textbook backward DCM
// recursion. xi_start(i) = p(i) + (xi_end(i) - p(i))*e^(-w*T). Replanned at
// every touchdown from the MEASURED landing. This replaced a pile of
// seeded-heuristic references that each fought physics a different way.
function buildStepPlan(st, k, axes, cmdF, cmdL, p0, stanceSide, om) {
  const N = 4;
  const strideF = clamp(cmdF * k.stepPeriod, -k.strideCap, k.strideCap);
  const strideL = clamp(cmdL * k.stepPeriod, -k.strideCap, k.strideCap);
  const prints = [{ x: p0.x, z: p0.z, side: stanceSide }];
  let side = stanceSide;
  for (let i = 1; i <= N; i++) {
    side = side === "L" ? "R" : "L";
    const sgn = side === "L" ? 1 : -1;
    const latOff = strideL + sgn * 2 * k.halfStance;
    const prev = prints[i - 1];
    prints.push({
      x: prev.x + strideF * axes.fwd.x + latOff * axes.left.x,
      z: prev.z + strideF * axes.fwd.z + latOff * axes.left.z,
      side,
    });
  }
  let xiEnd = { x: prints[N].x, z: prints[N].z };
  let xiStart1 = null, xiEnd1 = null;
  for (let i = N; i >= 1; i--) {
    const p = prints[i - 1];
    const T = k.stepPeriod * (i === 1 ? st.ramp : 1);
    const d = Math.exp(-(om || k.omega) * T);
    const xiStart = { x: p.x + (xiEnd.x - p.x) * d, z: p.z + (xiEnd.z - p.z) * d };
    if (i === 1) { xiStart1 = xiStart; xiEnd1 = xiEnd; }
    xiEnd = xiStart;
  }
  return { prints, xiStart: xiStart1, xiEnd: xiEnd1 };
}

// Den Hartog damper tuning for hanging appendages (spec §5, verbatim)
export function tuneDamper(mu, wSway, I_aboutHinge, m, leverToCoM, g, hangs) {
  const wT = wSway / (1 + mu);
  const zeta = Math.sqrt(3 * mu / (8 * Math.pow(1 + mu, 3)));
  const kg = (hangs ? +1 : -1) * m * g * leverToCoM;
  const kp = Math.max(0, wT * wT * I_aboutHinge - kg);
  const wA = Math.sqrt(Math.max(1e-6, (kp + kg) / I_aboutHinge));
  return { kp, kd: 2 * zeta * wA * I_aboutHinge };
}

// ---------------------------------------------------------------- hinge (spec §6)
// Locks: 3 linear (point-to-point at the anchor) + 2 axis-projected angular.
// Free axis: motor with IMPLICIT damping (unconditionally stable at any kd),
// end stops with finite compliance whose impulse feeds a damage budget.
const _h1 = v3(), _h2 = v3(), _h3 = v3(), _h4 = v3(), _h5 = v3(), _h6 = v3();
function addHinge(mech, a, b, anchorW, axisW, refW, motor, lo, hi, name) {
  const j = {
    name, a, b,
    rA: rTMulVec(a.R, V.sub(v3(), anchorW, a.pos), v3()),
    rB: rTMulVec(b.R, V.sub(v3(), anchorW, b.pos), v3()),
    axA: rTMulVec(a.R, V.copy(v3(), axisW), v3()),
    axB: rTMulVec(b.R, V.copy(v3(), axisW), v3()),
    refA: rTMulVec(a.R, V.copy(v3(), refW), v3()),
    refB: rTMulVec(b.R, V.copy(v3(), refW), v3()),
    kp: motor.kp, kd: motor.kd, kv: motor.kv, tauMax: motor.tauMax,
    Ichain: motor.Ichain,
    target: 0, tauFF: 0, angle: 0, wRel: 0,
    lo, hi, stopAlpha: 1e-7, stopImp: 0,
    // per-tick scratch
    _a1: v3(), _p1: v3(), _p2: v3(), _eAng: v3(),
    _rAw: v3(), _rBw: v3(), _C: v3(),
    _wTgt: 0, _Ieff: 1, _mAcc: 0, _mBudget: 0, _sAcc: 0,
  };
  mech.joints.push(j);
  return j;
}
function projK(a, b, n) { // n^T (IinvA + IinvB) n — full projected inverse inertia
  iMulVec(a.invIw, n, _h1);
  iMulVec(b.invIw, n, _h2);
  return V.dot(_h1, n) + V.dot(_h2, n);
}
function angImpulse(a, b, axis, lam) {
  V.scale(_h1, axis, lam);
  iMulVec(a.invIw, _h1, _h2); V.addScaled(a.w, a.w, _h2, -1);
  iMulVec(b.invIw, _h1, _h2); V.addScaled(b.w, b.w, _h2, 1);
}
function prepHinge(j, dt) {
  const a = j.a, b = j.b;
  rMulVec(a.R, j.axA, j._a1);
  const a1 = j._a1;
  // orthonormal complement
  if (Math.abs(a1.x) > 0.6) V.set(j._p1, a1.y, -a1.x, 0); else V.set(j._p1, 0, a1.z, -a1.y);
  V.norm(j._p1, j._p1);
  V.cross(j._p2, a1, j._p1);
  // axis misalignment (drift the angular locks correct): e = a1A x a1B
  rMulVec(b.R, j.axB, _h3);
  V.cross(j._eAng, a1, _h3);
  // hinge angle: refs projected onto the plane ⊥ a1
  rMulVec(a.R, j.refA, _h1);
  rMulVec(b.R, j.refB, _h2);
  V.addScaled(_h1, _h1, a1, -V.dot(a1, _h1));
  V.addScaled(_h2, _h2, a1, -V.dot(a1, _h2));
  V.cross(_h3, _h1, _h2);
  j.angle = Math.atan2(V.dot(_h3, a1), V.dot(_h1, _h2));
  // anchors + linear error
  rMulVec(a.R, j.rA, j._rAw);
  rMulVec(b.R, j.rB, j._rBw);
  V.add(_h1, a.pos, j._rAw);
  V.add(_h2, b.pos, j._rBw);
  V.sub(j._C, _h2, _h1);
  // motor: implicit damper (spec §6) — compute the velocity target once per tick
  V.sub(_h1, b.w, a.w);
  const wRel = V.dot(_h1, a1);
  j.wRel = wRel;
  // effective inertia: the ARTICULATED CHAIN about this joint, not the local
  // two-body pair — a light connector block on a heavy chain makes the local
  // projK read ~2000x light, the locks reclaim the block's half of each motor
  // impulse, and the joint crawls at 2%/step (measured). The build-time chain
  // inertia overestimates in bent poses; the iterate-and-remeasure loop
  // self-corrects that direction.
  const Ieff = j.Ichain;
  const auth = j._auth || 1;
  const kpEff = j.kp * (j.kpMul || 1) * auth;
  const kdEff = j.kd * (j.kdMul || 1) + j.kv * Math.abs(wRel);
  const e = wrapPi(j.target - j.angle);
  // target-rate feedforward: damp (wRel - targetRate), not wRel — a position-
  // only servo lags a moving target by rate*2zeta/bw (~0.3 rad at swing
  // speed: measured toe-drag, the foot never cleared the ground)
  const tr = j.tRate || 0;
  j._wTgt = tr + ((wRel - tr) + (kpEff * e + j.tauFF) * dt / Ieff) / (1 + kdEff * dt / Ieff);
  j._Ieff = Ieff;
  j._mBudget = j.tauMax * dt * auth;
  j._sAcc = 0;
  // motor: SINGLE-SHOT per tick (spec: "compute once per tick ... apply").
  // Per-iteration re-application is wrong in BOTH inertia conventions here:
  // local pair inertia under-injects ~2000x through a light connector (the
  // locks reclaim the block's half each sweep — the joint crawls), and chain
  // inertia re-applied 12x over-injects 12x and detonates. One chain-scale
  // impulse, then the lock iterations distribute it down the articulation.
  j._mAcc = clamp((j._wTgt - wRel) * Ieff, -j._mBudget, j._mBudget);
  angImpulse(a, b, a1, j._mAcc);
}
function iterHinge(j, dt, locksOnly = false) {
  const a = j.a, b = j.b, a1 = j._a1;
  // --- 3 linear locks (weld-style, tight: no slop)
  for (let ai = 0; ai < 3; ai++) {
    const ax = ai === 0 ? _AX : ai === 1 ? _AY : _AZ;
    V.cross(_h1, a.w, j._rAw); V.add(_h1, _h1, a.v);
    V.cross(_h2, b.w, j._rBw); V.add(_h2, _h2, b.v);
    V.sub(_h2, _h2, _h1);
    const vRel = V.dot(_h2, ax);
    let k = a.invM + b.invM;
    V.cross(_h1, j._rAw, ax); iMulVec(a.invIw, _h1, _h2); V.cross(_h1, _h2, j._rAw); k += V.dot(_h1, ax);
    V.cross(_h1, j._rBw, ax); iMulVec(b.invIw, _h1, _h2); V.cross(_h1, _h2, j._rBw); k += V.dot(_h1, ax);
    const cAx = ai === 0 ? j._C.x : ai === 1 ? j._C.y : j._C.z;
    const bias = clamp((0.2 / dt) * cAx, -4, 4);
    const P = -(vRel + bias) / Math.max(1e-9, k);
    V.scale(_h3, ax, P);
    V.addScaled(a.v, a.v, _h3, -a.invM);
    V.cross(_h1, j._rAw, _h3); iMulVec(a.invIw, _h1, _h2); V.addScaled(a.w, a.w, _h2, -1);
    V.addScaled(b.v, b.v, _h3, b.invM);
    V.cross(_h1, j._rBw, _h3); iMulVec(b.invIw, _h1, _h2); V.addScaled(b.w, b.w, _h2, 1);
  }
  // --- 2 angular locks (full projected inverse inertia — spec insists)
  for (let pi = 0; pi < 2; pi++) {
    const n = pi === 0 ? j._p1 : j._p2;
    V.sub(_h1, b.w, a.w);
    const Cdot = V.dot(_h1, n);
    const bias = clamp((0.2 / dt) * V.dot(j._eAng, n), -6, 6);
    const k = projK(a, b, n);
    const lam = -(Cdot + bias) / Math.max(1e-9, k);
    angImpulse(a, b, n, lam);
  }
  if (locksOnly) return;
  // --- end stops: one-sided, finite compliance; impulse tracked for damage
  if (j.hi > j.lo) {
    const over = j.angle - j.hi, under = j.lo - j.angle;
    if (over > 0 || under > 0) {
      V.sub(_h1, b.w, a.w);
      const wCur = V.dot(_h1, a1);
      const k = projK(j.a, j.b, a1) + j.stopAlpha / (dt * dt);
      let dLam;
      if (over > 0) { // push angle down: negative lam only
        dLam = -(wCur + (0.2 / dt) * over) / Math.max(1e-9, k);
        const acc = Math.min(0, j._sAcc + dLam);
        dLam = acc - j._sAcc; j._sAcc = acc;
      } else { // push angle up: positive lam only
        dLam = -(wCur - (0.2 / dt) * under) / Math.max(1e-9, k);
        const acc = Math.max(0, j._sAcc + dLam);
        dLam = acc - j._sAcc; j._sAcc = acc;
      }
      if (dLam !== 0) angImpulse(j.a, j.b, a1, dLam);
      const tq = Math.abs(j._sAcc) / dt;
      if (tq > j.stopImp) j.stopImp = tq; // damage-budget telemetry (spec §6 end stops)
    }
  }
}
const _AX = v3(1, 0, 0), _AY = v3(0, 1, 0), _AZ = v3(0, 0, 1);

// ------------------------------------------------- positional drift correction
// Velocity-level Baumgarte on the angular locks reaches a standoff against the
// motors' implicit damping: the lock's correction rate is exactly what the
// servo damps, and the joint parks at a torque-proportional drift (measured:
// 0.03 rad at the hip = 9cm at the ankle, zero gravity). Split-impulse style
// positional projection kills it — corrections the velocity solver never sees.
function applyRot(b, ex, ey, ez) {
  const ang = Math.hypot(ex, ey, ez);
  if (ang < 1e-12) return;
  const q = qFromAxis(V.set(_h5, ex / ang, ey / ang, ez / ang), ang);
  qNorm(qMul(b.q, q, b.q));
}
function positionalPass(mech, iters = 2) {
  const M = __mech__;
  for (let it = 0; it < iters; it++) {
    for (const j of mech.joints) {
      const a = j.a, b = j.b;
      // angular: align the axes (rotate B by -e·share, A by +e·share)
      rMulVec(a.R, j.axA, _h1);
      rMulVec(b.R, j.axB, _h2);
      V.cross(_h3, _h1, _h2); // e = a1A x a1B
      const eLen2 = V.len2(_h3);
      if (eLen2 > 1e-14) {
        iMulVec(a.invIw, _h3, _h1); const wa = V.dot(_h1, _h3) / eLen2;
        iMulVec(b.invIw, _h3, _h1); const wb = V.dot(_h1, _h3) / eLen2;
        const sum = wa + wb;
        if (sum > 1e-12) {
          applyRot(a, _h3.x * (wa / sum), _h3.y * (wa / sum), _h3.z * (wa / sum));
          applyRot(b, -_h3.x * (wb / sum), -_h3.y * (wb / sum), -_h3.z * (wb / sum));
          M.qToR(a.q, a.R); M.invInertiaWorld(a.R, a.invIb, a.invIw);
          M.qToR(b.q, b.R); M.invInertiaWorld(b.R, b.invIb, b.invIw);
        }
      }
      // linear: close the anchor gap (generalized inverse masses)
      rMulVec(a.R, j.rA, _h1);
      rMulVec(b.R, j.rB, _h2);
      const cx = b.pos.x + _h2.x - a.pos.x - _h1.x;
      const cy = b.pos.y + _h2.y - a.pos.y - _h1.y;
      const cz = b.pos.z + _h2.z - a.pos.z - _h1.z;
      const cLen = Math.hypot(cx, cy, cz);
      if (cLen > 1e-9) {
        V.set(_h3, cx / cLen, cy / cLen, cz / cLen);
        V.cross(_h4, _h1, _h3); iMulVec(a.invIw, _h4, _h5);
        const wa = a.invM + V.dot(_h4, _h5);
        V.cross(_h4, _h2, _h3); iMulVec(b.invIw, _h4, _h5);
        const wb = b.invM + V.dot(_h4, _h5);
        const sum = wa + wb;
        if (sum > 1e-12) {
          const lam = cLen / sum;
          // A moves +d, B moves -d
          V.scale(_h6, _h3, lam);
          V.addScaled(a.pos, a.pos, _h6, a.invM);
          V.cross(_h4, _h1, _h6); iMulVec(a.invIw, _h4, _h5);
          applyRot(a, _h5.x, _h5.y, _h5.z);
          V.addScaled(b.pos, b.pos, _h6, -b.invM);
          V.cross(_h4, _h2, _h6); iMulVec(b.invIw, _h4, _h5);
          applyRot(b, -_h5.x, -_h5.y, -_h5.z);
          M.qToR(a.q, a.R); M.invInertiaWorld(a.R, a.invIb, a.invIw);
          M.qToR(b.q, b.R); M.invInertiaWorld(b.R, b.invIb, b.invIw);
        }
      }
    }
  }
}

// ------------------------------------------------- island contact solve (replica)
// The mech island re-solves its own foot/body contacts INTERLEAVED with the
// hinges at fixed iterations — balance authority is contact-solve quality as
// much as joint stiffness (spec §6). Same math as core's solveContacts.
function relVelC(c) {
  const a = c.a, b = c.b;
  V.cross(_h1, a.w, c.rA); V.add(_h1, _h1, a.v);
  if (!b) return V.scale(_h2, _h1, -1);
  V.cross(_h2, b.w, c.rB); V.add(_h2, _h2, b.v);
  return V.sub(_h2, _h2, _h1);
}
function applyImpulseC(c, J) {
  const a = c.a, b = c.b;
  if (!a.sleeping) {
    V.addScaled(a.v, a.v, J, -a.invM);
    V.cross(_h4, c.rA, J); iMulVec(a.invIw, _h4, _h5); V.addScaled(a.w, a.w, _h5, -1);
  }
  if (b && !b.sleeping) {
    V.addScaled(b.v, b.v, J, b.invM);
    V.cross(_h4, c.rB, J); iMulVec(b.invIw, _h4, _h5); V.addScaled(b.w, b.w, _h5, 1);
  }
}
function solveContactOne(c, dt) {
  if (c.a.sleeping && (!c.b || c.b.sleeping)) return;
  const n = c.n;
  let vRel = relVelC(c);
  const vn = V.dot(vRel, n);
  let dPn;
  if (c.softCfm) {
    // spec §4 ground: compliant, damped, zero restitution — one bodyweight
    // sinks ~1% of leg length and never springs back. Soft constraint:
    // equilibrium depth = c*F. Rigid Baumgarte under gravity-stiff servos
    // was stiff-on-stiff and BOUNCED (813 kN spikes, measured).
    const beta = 0.2;
    // -(vn - bias + cfm*pn): bias pushes OUT of penetration, cfm relaxes the
    // impulse toward depth/c equilibrium. (This shipped sign-flipped first —
    // ground that SUCKS feet in — and poisoned several tuning rounds.)
    dPn = -(vn - (beta / dt) * Math.max(0, c.depth - 0.004) + c.softCfm * c.pn) / (1 / c.invKn + c.softCfm);
  } else {
    dPn = -(vn - c.bias - c.bounce) * c.invKn;
  }
  const pn0 = c.pn;
  c.pn = Math.max(0, c.pn + dPn);
  applyImpulseC(c, V.scale(_h6, n, c.pn - pn0));
  vRel = relVelC(c);
  const maxF = c.mu * c.pn;
  let vt = V.dot(vRel, c.t1);
  const pt0 = c.pt1;
  c.pt1 = clamp(c.pt1 - vt * c.invKt1, -maxF, maxF);
  applyImpulseC(c, V.scale(_h6, c.t1, c.pt1 - pt0));
  vRel = relVelC(c);
  vt = V.dot(vRel, c.t2);
  const pt20 = c.pt2;
  c.pt2 = clamp(c.pt2 - vt * c.invKt2, -maxF, maxF);
  applyImpulseC(c, V.scale(_h6, c.t2, c.pt2 - pt20));
}

// ---------------------------------------------------------------- rig (spec §0, §1)
// Reference rig at s=1: leg L = 2.95 (the spec's reference leg), hull 69% of
// 15.3t. 5 hinges per leg (hipRoll Z, hipPitch X, knee X, anklePitch X,
// ankleRoll Z) — 10 joints, 11 bodies. Yaw has no joint: heading changes go
// through stepped foot placement and stance-foot friction.
export const RIG = {
  // wide stance + wide feet: a 3.5m-CoM biped on a narrow base spent every
  // controller iteration fighting lateral margins it simply didn't have
  L1: 1.55, L2: 1.40, ankleH: 0.36, hipX: 0.80, hipY: -1.15,
  hull: { hx: 1.55, hy: 1.05, hz: 1.35, m: 10500 },
  hipBlock: { h: 0.16, m: 260 },
  thigh: { hx: 0.26, hy: 0.775, hz: 0.28, m: 950 },
  shin: { hx: 0.22, hy: 0.70, hz: 0.24, m: 620 },
  ankleBlock: { h: 0.14, m: 170 },
  foot: { hx: 0.55, hy: 0.17, hz: 0.66, m: 430, fwdOff: 0.12 },
  // torque ceilings: every leg joint holds the whole machine on one leg —
  // tauMax >= M*g*lever (spec §4). kp is tuned to a separate bandwidth ref.
  // knee/hipPitch sized past the naive single-support lever: the walk crouch
  // lever grows with knee bend and the measured demand pegged a 0.9 budget
  // proximal ceilings: single-support vault peaks ~1.5x static on the deep
  // crouch; §5e's forgiveness rule (gameplay = engineering x4) is canon —
  // the knee ceiling-saturated at 1.35 and buckled mid-vault (measured)
  levers: { hipRoll: 1.4, hipPitch: 2.2, knee: 2.2, anklePitch: 0.65, ankleRoll: 0.5 },
  limits: { hipRoll: [-0.55, 0.55], hipPitch: [-1.25, 0.95], knee: [-0.02, 2.25], anklePitch: [-0.95, 0.95], ankleRoll: [-0.65, 0.65] },
  // servo bandwidth (x omega) and damping ratio. BW is sized so kp*e at
  // typical errors (~0.3 rad) commands accelerations INSIDE the physical
  // torque ceiling — BW 9 commanded 4.7x tauMax and the loop bang-banged the
  // ceiling exactly as spec §6 warns. tauMax is a ceiling, not a tuning knob.
  BW: 3.5, zeta: 1.1,
};

// box inertia about its own centroid axes (half extents), world-axis aligned at build
function boxI(m, hx, hy, hz) { return v3((m / 3) * (hy * hy + hz * hz), (m / 3) * (hx * hx + hz * hz), (m / 3) * (hx * hx + hy * hy)); }
// chain inertia about an axis line through `pivot` along `axis` at build pose
function chainInertia(bodies, pivot, axis) {
  let I = 0;
  for (const b of bodies) {
    const Ic = boxI(b.mass, b.hx, b.hy, b.hz);
    I += Ic.x * axis.x * axis.x + Ic.y * axis.y * axis.y + Ic.z * axis.z * axis.z;
    V.sub(_h1, b.pos, pivot);
    V.addScaled(_h1, _h1, axis, -V.dot(_h1, axis));
    I += b.mass * V.len2(_h1);
  }
  return I;
}

let MECH_ID = 1;
export function buildMech(world, opts = {}) {
  const s = opts.s || 1;
  const x = opts.x || 0, z = opts.z || 0, yaw = opts.yaw || 0;
  const R = RIG, s3 = s * s * s;
  const L = (R.L1 + R.L2) * s;
  const groundY = world.field.heightAt(x, z);
  // build pose: legs dead straight, soles exactly on the ground; the controller
  // pulls the 0.93 crouch in the first half second.
  const hipYw = groundY + R.ankleH * s + L;
  const hullY = hipYw - R.hipY * s;
  const mech = {
    id: MECH_ID++, s, joints: [], links: [], legs: {}, _contacts: [],
    telem: { catches: 0, steps: 0, falls: 0 },
  };
  const B = (o) => {
    const b = addBody(world, o);
    b.mechRef = mech;
    mech.links.push(b);
    return b;
  };
  // §5b: the CMG flywheel is REAL mass (~3% of machine), on the mount body
  const hull = B({ kind: "mech", team: 1, group: opts.group || "mech", mass: (R.hull.m + 460) * s3, hx: R.hull.hx * s, hy: R.hull.hy * s, hz: R.hull.hz * s, x, y: hullY, z, hp: opts.hp != null ? opts.hp : 1e9, friction: 0.6, restitution: 0 });
  mech.hull = hull;
  const gains = {};
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? 1 : -1; // +X is LEFT (up x fwd)
    const hx = x + sx * R.hipX * s, hipPt = v3(hx, hipYw, z);
    const kneePt = v3(hx, hipYw - R.L1 * s, z);
    const anklePt = v3(hx, hipYw - L, z);
    const hipB = B({ kind: "mechlink", group: "mech", mass: R.hipBlock.m * s3, hx: R.hipBlock.h * s, hy: R.hipBlock.h * s, hz: R.hipBlock.h * s, x: hx, y: hipYw, z, friction: 0.6, restitution: 0 });
    const thigh = B({ kind: "mechlink", group: "mech", mass: R.thigh.m * s3, hx: R.thigh.hx * s, hy: R.thigh.hy * s, hz: R.thigh.hz * s, x: hx, y: hipYw - R.L1 * s / 2, z, friction: 0.6, restitution: 0 });
    const shin = B({ kind: "mechlink", group: "mech", mass: R.shin.m * s3, hx: R.shin.hx * s, hy: R.shin.hy * s, hz: R.shin.hz * s, x: hx, y: kneePt.y - R.L2 * s / 2, z, friction: 0.6, restitution: 0 });
    const ankB = B({ kind: "mechlink", group: "mech", mass: R.ankleBlock.m * s3, hx: R.ankleBlock.h * s, hy: R.ankleBlock.h * s, hz: R.ankleBlock.h * s, x: hx, y: anklePt.y, z, friction: 0.6, restitution: 0 });
    const foot = B({ kind: "mechfoot", group: "mech", mass: R.foot.m * s3, hx: R.foot.hx * s, hy: R.foot.hy * s, hz: R.foot.hz * s, x: hx, y: anklePt.y - 0.19 * s, z: z + R.foot.fwdOff * s, friction: 0.95, restitution: 0 });
    // servo gains from chain inertia + gait frequency: kp = I*(BW*omega)^2 —
    // derived, so Froude scaling falls out (kp ~ s^4, kd ~ s^4.5) and gamma
    // = kd/(kp*dt) is scale-invariant by construction.
    // soft bandwidth-derived servos + explicit load feedforward. The
    // gravity-stiff alternative (kp = tauMax/sag, no feedforward) was tried
    // and BOUNCES: ~7 MN/m of leg stiffness in series with the ground at
    // 120 Hz is structurally underdamped, 600 kN contact spikes measured.
    const comH0 = hullY - groundY;
    const om0 = Math.sqrt(world.gravity / (comH0 * 0.85));
    const mkGain = (bodies, pivot, axis, lever) => {
      const I = chainInertia(bodies, pivot, axis);
      const kp = I * (R.BW * om0) * (R.BW * om0);
      const kd = 2 * R.zeta * Math.sqrt(kp * I);
      return { kp, kd, kv: 0.02 * kd, tauMax: 0, Ichain: I, lever };
    };
    const AXX = v3(1, 0, 0), AXZ = v3(0, 0, 1);
    const gHipR = mkGain([hipB, thigh, shin, ankB, foot], hipPt, AXZ, R.levers.hipRoll);
    const gHipP = mkGain([thigh, shin, ankB, foot], hipPt, AXX, R.levers.hipPitch);
    const gKnee = mkGain([shin, ankB, foot], kneePt, AXX, R.levers.knee);
    const gAnkP = mkGain([ankB, foot], anklePt, AXX, R.levers.anklePitch);
    const gAnkR = mkGain([foot], anklePt, AXZ, R.levers.ankleRoll);
    gains[side] = { gHipR, gHipP, gKnee, gAnkP, gAnkR };
    const REFY = v3(0, 1, 0);
    const leg = {
      side, sx, hipB, thigh, shin, ankB, foot,
      distal: null, // filled after joints exist
      hipRoll: addHinge(mech, hull, hipB, hipPt, AXZ, REFY, gHipR, R.limits.hipRoll[0], R.limits.hipRoll[1], side + "hipRoll"),
      hipPitch: addHinge(mech, hipB, thigh, hipPt, AXX, REFY, gHipP, R.limits.hipPitch[0], R.limits.hipPitch[1], side + "hipPitch"),
      knee: addHinge(mech, thigh, shin, kneePt, AXX, REFY, gKnee, R.limits.knee[0], R.limits.knee[1], side + "knee"),
      anklePitch: addHinge(mech, shin, ankB, anklePt, AXX, REFY, gAnkP, R.limits.anklePitch[0], R.limits.anklePitch[1], side + "anklePitch"),
      ankleRoll: addHinge(mech, ankB, foot, anklePt, AXZ, REFY, gAnkR, R.limits.ankleRoll[0], R.limits.ankleRoll[1], side + "ankleRoll"),
      load: 0,
    };
    leg.distal = {
      hipRoll: [hipB, thigh, shin, ankB, foot],
      hipPitch: [thigh, shin, ankB, foot],
      knee: [shin, ankB, foot],
      anklePitch: [ankB, foot],
      ankleRoll: [foot],
    };
    mech.legs[side] = leg;
  }
  // ---- upper body (spec §5, §5c): torso on a waist YAW ring, hanging arms
  // as Den Hartog dampers (the free stability), head welded (mounts break
  // under abuse — that's the damage model's flavor, §5e)
  {
    const s3b = s * s * s;
    const torsoY = hullY + (R.hull.hy + 0.85) * s;
    const torso = B({ kind: "mechlink", group: "mech", mass: 2600 * s3b, hx: 1.30 * s, hy: 0.85 * s, hz: 1.00 * s, x, y: torsoY, z, friction: 0.6, restitution: 0 });
    const om0b = Math.sqrt(world.gravity / ((hullY - groundY) * 0.85));
    const AXY = v3(0, 1, 0), REFZ = v3(0, 0, 1);
    const Iw = chainInertia([torso], v3(x, hullY + R.hull.hy * s, z), AXY) + 2 * 340 * s3b * (1.48 * s) * (1.48 * s) + 180 * s3b * (0.0);
    const gW = { kp: Iw * (R.BW * om0b) * (R.BW * om0b), kd: 2 * R.zeta * Math.sqrt(Iw * (R.BW * om0b) * (R.BW * om0b) * Iw), kv: 0, tauMax: 0, Ichain: Iw };
    const waist = addHinge(mech, hull, torso, v3(x, hullY + R.hull.hy * s, z), AXY, REFZ, gW, -0.87, 0.87, "waist");
    mech.waist = waist;
    const shoulderY = torsoY + 0.55 * s;
    const arms = {};
    for (const sd of ["L", "R"]) {
      const sxA = sd === "L" ? 1 : -1;
      const ax0 = x + sxA * 1.48 * s;
      const arm = B({ kind: "mechlink", group: "mech", mass: 340 * s3b, hx: 0.16 * s, hy: 0.62 * s, hz: 0.20 * s, x: ax0, y: shoulderY - 0.62 * s, z, friction: 0.6, restitution: 0 });
      const Ia = chainInertia([arm], v3(ax0, shoulderY, z), v3(1, 0, 0));
      const dt0 = tuneDamper(340 * s3b / (mech.links.reduce((a, b) => a + b.mass, 0)), om0b, Ia, 340 * s3b, 0.62 * s, world.gravity, true);
      const gA = { kp: dt0.kp, kd: dt0.kd, kv: 0, tauMax: 3000 * s3b * s, Ichain: Ia };
      arms[sd] = addHinge(mech, torso, arm, v3(ax0, shoulderY, z), v3(1, 0, 0), v3(0, 1, 0), gA, -1.3, 1.3, sd + "armSwing");
    }
    mech.arms = arms;
    const head = B({ kind: "mechlink", group: "mech", mass: 180 * s3b, hx: 0.30 * s, hy: 0.26 * s, hz: 0.30 * s, x, y: torsoY + (0.85 + 0.26) * s, z, friction: 0.6, restitution: 0 });
    addWeld(world, torso, head, 8.0e4);
    mech.torso = torso; mech.head = head;
    mech.upper = [torso, arms.L.b, arms.R.b, head];
  }
  // torque ceilings from total machine weight
  const M = mech.links.reduce((a, b) => a + b.mass, 0);
  mech.mass = M;
  for (const j of mech.joints) {
    if (j.name === "waist" || j.name.includes("armSwing")) {
      if (j.name === "waist") { j.tauMax = 0.35 * M * world.gravity; j.kv = 0.1 * j.kd; }
      continue;
    }
    // ankle ceilings DERIVE from the CoP box (spec §5e: the balance zone
    // and the ankle ceiling are ONE rule at two sites)
    const copX0 = 0.80 * (R.foot.hz * s - R.foot.fwdOff * s);
    const copZ0 = 0.65 * R.foot.hx * s;
    if (j.name.includes("anklePitch")) j.tauMax = 1.40 * M * world.gravity * copX0;
    else if (j.name.includes("ankleRoll")) j.tauMax = 1.45 * M * world.gravity * copZ0;
    else j.tauMax = M * world.gravity * R.levers[j.name.slice(1)];
  }
  // gait constants from measured geometry
  let cy = 0;
  for (const b of mech.links) cy += b.mass * b.pos.y;
  const comBuild = cy / M - groundY;
  const comH = comBuild - (1 - 0.93) * L * 0.7; // standing crouch pulls the CoM down a touch
  mech.geom = { L, L1: R.L1 * s, L2: R.L2 * s, ankleH: R.ankleH * s, hipX: R.hipX * s, hipY: R.hipY * s, footFwd: R.foot.fwdOff * s, standHip: R.ankleH * s + 0.93 * L, comH };
  mech.k = deriveGait(L, comH, R.hipX * s, { halfLen: R.foot.hz * s, halfWid: R.foot.hx * s, ankleOffX: R.foot.fwdOff * s }, world.gravity);
  mech.groundC = (0.01 * L) / (M * world.gravity); // spec §4, m/N
  // loop gains, sweepable (defaults = shipped tune)
  mech.tune = { fzBase: 0.95, fzKp: 2.0, fzKd: 1.6, fzCap: 1.15, floorG: 0.85, katt: 1.2, cmgKp: 2.2, cmgKd: 0.55, cmgSlew: 1.5 };
  // retune the arm dampers with FINAL mass + true gait omega (build-time
  // first pass used running totals — Den Hartog is sensitive to mu/wSway)
  if (mech.arms) for (const sd of ["L", "R"]) {
    const j = mech.arms[sd];
    const mA = j.b.mass;
    const dtn = tuneDamper(mA / (M - mA), mech.k.omega, j.Ichain, mA, 0.62 * s, world.gravity, true);
    j.kp = dtn.kp; j.kd = dtn.kd;
  }
  // rig override history: 0.045L was set when knee ceilings were low; the
  // ceilings went up (levers 1.35+) and the SHALLOW crouch turned out worse
  // — no bend reserve means no torque lever for the force feedforward and
  // no swing clearance once the hull runs a little low (measured: dragging
  // swings recording garbage prints). 0.075L keeps both.
  mech.k.pelvisDrop = 0.085 * L; // spec value (the low-ceiling era that forced shallower is over)
  // controller state
  mech.state = {
    mode: "STAND", phase: "DS", t: 0, swing: null, lastSwing: "R", ramp: 1,
    cmd: { f: 0, l: 0 }, cmdT: { f: 0, l: 0 }, heading: yaw, headingT: yaw,
    pelvis: { x, z },
    prints: {
      L: { x: x + R.hipX * s, z: z },
      R: { x: x - R.hipX * s, z: z },
    },
    hold: {}, holdCop: {}, stopping: false, stopPlan: null, settled: 0,
  };
  // spawn layout for respawn
  mech._layout = mech.links.map((b) => ({ b, dx: b.pos.x - x, dy: b.pos.y - groundY, dz: b.pos.z - z }));
  // rotate the whole rig to the requested heading (locals stay consistent)
  if (yaw !== 0) placeMech(world, mech, x, z, yaw);
  // registration: hooks are no-ops until the first mech exists
  if (!world.mechs) {
    world.mechs = [];
    world.mechStep = stepMechs;
    world._mechPairs = new Set();
  }
  world.mechs.push(mech);
  // self-collision exclusion: every pair within hull+leg chain (L and R legs
  // still collide with EACH OTHER — minFootSep keeps them apart in health,
  // physicality is welcome in failure)
  {
    const up = [hull, mech.torso, mech.head, mech.arms.L.b, mech.arms.R.b];
    for (let i = 0; i < up.length; i++) for (let k2 = i + 1; k2 < up.length; k2++) {
      const a = up[i], b = up[k2];
      world._mechPairs.add(a.id < b.id ? a.id * 100000 + b.id : b.id * 100000 + a.id);
    }
  }
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    const chain = [hull, leg.hipB, leg.thigh, leg.shin, leg.ankB, leg.foot];
    for (let i = 0; i < chain.length; i++) for (let k2 = i + 1; k2 < chain.length; k2++) {
      const a = chain[i], b = chain[k2];
      world._mechPairs.add(a.id < b.id ? a.id * 100000 + b.id : b.id * 100000 + a.id);
    }
  }
  return mech;
}

export function placeMech(world, mech, x, z, yaw) {
  const q = qFromAxis(v3(0, 1, 0), yaw);
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const gy = world.field.heightAt(x, z);
  for (const { b, dx, dy, dz } of mech._layout) {
    b.pos.x = x + dx * cs + dz * sn;
    b.pos.y = gy + dy;
    b.pos.z = -dx * sn + dz * cs + z;
    b.q = qNorm({ ...q });
    V.set(b.v, 0, 0, 0); V.set(b.w, 0, 0, 0);
    b.sleeping = false; b.sleepT = 0; b.airT = 0;
    const qToR2 = __mech__.qToR; qToR2(b.q, b.R);
    __mech__.invInertiaWorld(b.R, b.invIb, b.invIw);
  }
  const st = mech.state;
  st.mode = "STAND"; st.phase = "DS"; st.t = 0; st.swing = null; st.ramp = 1;
  st.heading = yaw; st.headingT = yaw;
  st.cmd = { f: 0, l: 0 }; st.cmdT = { f: 0, l: 0 };
  st.pelvis = { x, z };
  st.prints = {
    L: { x: mech.legs.L.foot.pos.x, z: mech.legs.L.foot.pos.z },
    R: { x: mech.legs.R.foot.pos.x, z: mech.legs.R.foot.pos.z },
  };
  st.hold = {}; st.holdCop = {}; st.stopping = false; st.stopPlan = null;
  st.settleT = 0; st.settledT = 0; st.spawnDone = false;
  // stale actuator state must not survive a reissue: a held CMG torque or
  // fall-time load filter tips the fresh spawn
  mech.cmgH = { x: 0, y: 0, z: 0 };
  mech._cmgT = { x: 0, y: 0, z: 0 };
  for (const sd of ["L", "R"]) { mech.legs[sd].load = 0; mech.legs[sd].loadLpf = 0; }
  for (const j of mech.joints) { j.target = 0; j.tauFF = 0; j.stopImp = 0; }
}
export function respawnMech(world, mech, x, z, yaw) { placeMech(world, mech, x, z, yaw || 0); }

// ---------------------------------------------------------------- IK (ref-frame)
// pelvis ref pose (x,z, hipY world, heading, level) + foot sole target (world)
// -> the five hinge targets. Convention (verified by the zero-g convergence
// gate): theta_h + = knee forward; hinge targets: hipPitch=-th, knee=+tk,
// anklePitch=th-tk, hipRoll=phi, ankleRoll=-phi.
function legIK(mech, sx, pelvis, hipYw, heading, footTgt, out) {
  const g = mech.geom;
  const cs = Math.cos(heading), sn = Math.sin(heading);
  // ankle point in world
  const ax = footTgt.x, az = footTgt.z, ay = footTgt.y + g.ankleH;
  // hip point in world
  const hxw = pelvis.x + sx * g.hipX * cs, hzw = pelvis.z - sx * g.hipX * sn;
  // v = hip->ankle in pelvis-ref frame (heading yaw only, level)
  const wx = ax - hxw, wy = ay - hipYw, wz = az - hzw;
  const vx = wx * cs - wz * sn;         // ref-local X (left)
  const vy = wy;
  const vz = wx * sn + wz * cs;         // ref-local Z (fwd)
  const phi = Math.atan2(vx, -vy);
  // planar 2-link in the rolled sagittal plane: down component -hypot(vx,vy), fwd vz
  const dY = -Math.hypot(vx, vy), dZ = vz;
  const rr = clamp(Math.hypot(dY, dZ), 0.35 * g.L, 0.995 * g.L);
  const alpha = Math.atan2(dZ, -dY);
  const cg = clamp((g.L1 * g.L1 + g.L2 * g.L2 - rr * rr) / (2 * g.L1 * g.L2), -1, 1);
  const gamma = Math.acos(cg);
  const tk = Math.PI - gamma;
  const delta = Math.asin(clamp(g.L2 * Math.sin(gamma) / rr, -1, 1));
  const th = alpha + delta;
  out.hipRoll = phi;
  out.hipPitch = -th;
  out.knee = tk;
  out.anklePitch = th - tk;
  out.ankleRoll = -phi;
  return out;
}
const _ikOut = {};
function setLegTargets(mech, side, pelvis, hipYw, heading, footTgt) {
  const leg = mech.legs[side];
  legIK(mech, leg.sx, pelvis, hipYw, heading, footTgt, _ikOut);
  leg.hipRoll.target = clamp(_ikOut.hipRoll, leg.hipRoll.lo, leg.hipRoll.hi);
  leg.hipPitch.target = clamp(_ikOut.hipPitch, leg.hipPitch.lo, leg.hipPitch.hi);
  leg.knee.target = clamp(_ikOut.knee, leg.knee.lo, leg.knee.hi);
  leg.anklePitch.target = clamp(_ikOut.anklePitch, leg.anklePitch.lo, leg.anklePitch.hi);
  leg.ankleRoll.target = clamp(_ikOut.ankleRoll, leg.ankleRoll.lo, leg.ankleRoll.hi);
}

// ---------------------------------------------------------------- controller (spec §2, §3)
function mechCom(mech, out, outV) {
  let m = 0, cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
  for (const b of mech.links) {
    m += b.mass;
    cx += b.mass * b.pos.x; cy += b.mass * b.pos.y; cz += b.mass * b.pos.z;
    vx += b.mass * b.v.x; vy += b.mass * b.v.y; vz += b.mass * b.v.z;
  }
  V.set(out, cx / m, cy / m, cz / m);
  V.set(outV, vx / m, vy / m, vz / m);
}
function soleY(leg) { return leg.foot.pos.y - leg.foot.hy; }
function onFallMech(mech) {
  for (const j of mech.joints) {
    j.target = j.angle; j.tauFF = 0;
    // spec §3: kp==0 dampers (arms) get a kd boost when down
    if (j.kp === 0) j.kd = Math.min(j.kd * 8, 0.9 * j.Ichain * 120);
  }
  mech.state.mode = "FALLEN";
  mech.telem.falls++;
}
const _com = v3(), _comV = v3();
function controller(world, mech) {
  const st = mech.state, k = mech.k, g = mech.geom, dt = world.dt;
  // fallen mechs limp; everything else stays awake for the servos
  if (st.mode === "FALLEN") return;
  for (const b of mech.links) { b.sleepT = 0; if (b.sleeping) wake(b); }
  // attitude check: up.y or pelvis crash = fall (spec §3: fall = limp)
  const hull = mech.hull;
  const legL = mech.legs.L, legR = mech.legs.R;
  // ground reference from LOADED soles only — an airborne machine's min-sole
  // "ground" rises with its own feet, the IK chases the phantom floor, and
  // the legs never reach down to the real one (measured post-hop free fall).
  // Terrain-height fallback while airborne.
  let groundRef;
  const ldL0 = legL.load > 0.04 * mech.mass * world.gravity, ldR0 = legR.load > 0.04 * mech.mass * world.gravity;
  if (ldL0 && ldR0) groundRef = Math.min(soleY(legL), soleY(legR));
  else if (ldL0) groundRef = soleY(legL);
  else if (ldR0) groundRef = soleY(legR);
  else groundRef = st._lastGround != null ? st._lastGround : world.field.heightAt(hull.pos.x, hull.pos.z);
  st._lastGround = groundRef;
  const hipYnow = hull.pos.y + g.hipY; // hull local hip offset is -|hipY|... hipY negative of hull? hipY = R.hipY*s is negative
  if (hull.R[4] < 0.6 || (hipYnow - groundRef) < 0.62 * g.standHip) { onFallMech(mech); return; }
  // command slew (spec: every channel slewed)
  st.cmd.f += clamp(st.cmdT.f - st.cmd.f, -k.travelRate * dt, k.travelRate * dt);
  st.cmd.l += clamp(st.cmdT.l - st.cmd.l, -k.travelRate * dt, k.travelRate * dt);
  st.heading += clamp(wrapPi(st.headingT - st.heading), -k.turnRate * dt, k.turnRate * dt);
  const cs = Math.cos(st.heading), sn = Math.sin(st.heading);
  const cmdW = { x: st.cmd.f * sn + st.cmd.l * cs, z: st.cmd.f * cs - st.cmd.l * sn };
  const cmdMag = Math.hypot(st.cmd.f, st.cmd.l), cmdTMag = Math.hypot(st.cmdT.f, st.cmdT.l);
  // capture point + MV plan (pelvis ref advances at the commanded velocity)
  mechCom(mech, _com, _comV);
  const comRel = { x: _com.x, y: Math.max(0.5, _com.y - groundRef), z: _com.z };
  const xi = capturePoint(comRel, _comV, world.gravity);
  // live pendulum frequency — the plan must diverge at the rate the real CoM does
  const om = Math.sqrt(world.gravity / comRel.y);
  const feetMid = { x: (st.prints.L.x + st.prints.R.x) / 2, z: (st.prints.L.z + st.prints.R.z) / 2 };
  st.settleT = (st.settleT || 0) + dt;
  // hull yaw is the one unactuated DOF (no yaw joints by design). Split
  // frames by role: STANCE legs solve IK in the COMMANDED heading — through
  // planted feet the yaw-locked leg chains actively wind the hull back
  // (measured-yaw stance IK was positive feedback: -9 to -50 deg runaway).
  // The SWING leg solves in MEASURED yaw so it lands on its world target
  // regardless of hull spin (commanded-frame swing swept the foot 2.6m).
  const yawMeas = Math.atan2(hull.R[6], hull.R[8]);
  // CMG (spec §5b): the attitude battery, mounted to the hull (heaviest
  // body). PD on tilt+yaw, torque budget 0.13*W*comH, momentum store with
  // ground-bleed desaturation. This REPLACES hip attitude springs — their
  // reaction couples at laterally-offset feet were the yaw pump.
  {
    const W = mech.mass * world.gravity;
    const tauCap = 0.13 * W * mech.geom.comH;
    const hMax = tauCap * 0.5;
    if (mech.cmgH == null) mech.cmgH = { x: 0, y: 0, z: 0 };
    // attitude errors: tilt from R (level target), yaw vs commanded heading
    const exT = -Math.asin(clamp(-hull.R[7], -1, 1));  // pitch err (nose down = +R7 neg)
    const ezT = -Math.asin(clamp(hull.R[1], -1, 1));   // roll err
    const eyT = wrapPi(st.heading - yawMeas);
    // deadband: ordinary gait sway must not drain the store (spec: reference
    // the plan or the gyro brakes every step as if it were a fall)
    // tilt deadband TIGHT (0.02): a tolerated standing lean walks a tall
    // top-heavy rig slowly away; yaw keeps the wide band (heading changes
    // are cheap and gait sway must not drain the store)
    const dbT = (e) => Math.abs(e) < 0.02 ? 0 : e - Math.sign(e) * 0.02;
    const dbY = (e) => Math.abs(e) < 0.06 ? 0 : e - Math.sign(e) * 0.06;
    const kpA = tauCap * mech.tune.cmgKp, kdA = tauCap * mech.tune.cmgKd;
    const txD = clamp(-kpA * dbT(-exT) - kdA * hull.w.x, -tauCap, tauCap);
    const tyD = clamp(kpA * dbY(eyT) - kdA * hull.w.y, -tauCap, tauCap);
    const tzD = clamp(-kpA * dbT(-ezT) - kdA * hull.w.z, -tauCap, tauCap);
    // slew: the CMG is an OUTER loop, slower than the gait (spec §5b)
    if (!mech._cmgT) mech._cmgT = { x: 0, y: 0, z: 0 };
    const slewC = (tauCap / (k.stepPeriod / mech.tune.cmgSlew)) * dt;
    mech._cmgT.x += clamp(txD - mech._cmgT.x, -slewC, slewC);
    mech._cmgT.y += clamp(tyD - mech._cmgT.y, -slewC, slewC);
    mech._cmgT.z += clamp(tzD - mech._cmgT.z, -slewC, slewC);
    let tx = mech._cmgT.x, ty = mech._cmgT.y, tz = mech._cmgT.z;
    // momentum budget: torque only while the store holds; bleed against the
    // ground through the stance (time constant ~7s) while any foot is loaded
    const loaded = legL.load + legR.load > 0.1 * W;
    const hMag = Math.hypot(mech.cmgH.x, mech.cmgH.y, mech.cmgH.z);
    if (hMag >= hMax) { tx *= 0.05; ty *= 0.05; tz *= 0.05; }
    mech.cmgH.x += tx * dt; mech.cmgH.y += ty * dt; mech.cmgH.z += tz * dt;
    if (loaded) { const bl = Math.min(1, dt / 7); mech.cmgH.x -= mech.cmgH.x * bl; mech.cmgH.y -= mech.cmgH.y * bl; mech.cmgH.z -= mech.cmgH.z * bl; }
    const Ih = { x: 1 / Math.max(1e-9, hull.invIw[0]), y: 1 / Math.max(1e-9, hull.invIw[4]), z: 1 / Math.max(1e-9, hull.invIw[8]) };
    hull.w.x += tx * dt / Ih.x;
    hull.w.y += ty * dt / Ih.y;
    hull.w.z += tz * dt / Ih.z;
  }
  // SPAWN SEQUENCE (spec §5f): settle with both feet loaded (~0.4s) -> crouch
  // ramp to walk height (~1.4s) -> only then command authority. Cold-starting
  // servos at full gain on frame 1 jumps the machine.
  if (!st.spawnDone) {
    const settled = legL.load + legR.load > 0.5 * mech.mass * world.gravity;
    st.settledT = (st.settledT || 0) + (settled && st.settleT > 0.4 ? dt : 0);
    if (st.settledT > 1.4) st.spawnDone = true;
  }
  mech.auth = st.spawnDone ? 1 : clamp(0.35 + st.settleT / 0.8, 0.35, 1);
  const crouch = st.spawnDone ? 1 : smoothstep(Math.min(1, (st.settledT || 0) / 1.4));
  const walkH = groundRef + g.standHip - (st.mode === "WALK" ? k.pelvisDrop : 0);
  const hipYRef = walkH + (1 - crouch) * (0.995 - 0.93) * g.L;
  // gait-frame axes for catch decisions
  const axes = { fwd: { x: sn, z: cs }, left: { x: cs, z: -sn } };
  const totalW = mech.mass * world.gravity;
  // hull attitude (frame-independent: local-axis world-y components).
  // + pitch = nose down, + roll = left side up.
  mech._attP = clamp(Math.atan2(-hull.R[7], Math.hypot(hull.R[6], hull.R[8])), -0.5, 0.5);
  mech._attR = clamp(Math.asin(clamp(hull.R[1], -1, 1)), -0.5, 0.5);
  // ---- mode logic (phase clock first, then the support reference)
  for (const j of mech.joints) j._auth = mech.auth != null ? mech.auth : 1;
  if (st.mode === "STAND") {
    const eF = (xi.x - feetMid.x) * axes.fwd.x + (xi.z - feetMid.z) * axes.fwd.z;
    const eL = (xi.x - feetMid.x) * axes.left.x + (xi.z - feetMid.z) * axes.left.z;
    let catchSide = null;
    if (Math.abs(eF) > k.copLimitX || Math.abs(eL) > k.copLimitZ + k.halfStance)
      catchSide = eL > 0 ? "L" : "R";
    if (st.spawnDone && ((catchSide && st.settleT > 1.6) || cmdTMag > 0.03)) {
      st.mode = "WALK"; st.phase = "DS"; st.t = 0; st.ramp = 1.35;
      st.stopping = false; st.stopPlan = null;
      if (catchSide) { st.lastSwing = catchSide === "L" ? "R" : "L"; mech.telem.catches++; }
    }
  }
  if (st.mode === "WALK") {
    // airborne (landing bounce, blast lift): the gait clock STOPS — phases
    // can't do work without ground and marching on just schedules a fall
    const airborne = legL.load + legR.load < 0.05 * totalW;
    st.airT2 = airborne ? (st.airT2 || 0) + dt : 0;
    if (st.airT2 < 0.06) st.t += dt;
    const tDS = k.tDS * st.ramp, tSS = k.tSS * st.ramp;
    if (st.phase === "DS") {
      // stopping latches once the command dies; the plan then targets rest
      if (cmdTMag < 0.02 && cmdMag < 0.06 && !st.stopping) st.stopping = true;
      // replan EVERY DS tick from the measured stance print (spec: replan at
      // every touchdown from the measured landing; per-tick also tracks the
      // slewing command and heading)
      // plan strides from the COMMAND, exactly: with the DCM drive re-solving
      // each tick, an over-speed body meets a CoP planted AHEAD of xi and
      // brakes. (The old sized-to-actual-speed catch-up reinforced runaways.)
      const cmdEffF = st.stopping ? 0 : st.cmd.f;
      const cmdEffL = st.stopping ? 0 : st.cmd.l;
      st.plan = buildStepPlan(st, k, axes, cmdEffF, cmdEffL, st.prints[st.lastSwing], st.lastSwing, om);
      const nextSwing = st.lastSwing === "L" ? "R" : "L";
      const nextStanceP = st.prints[st.lastSwing];
      // WEIGHT SHIFT with the LIPM sign convention the hard way taught: xi
      // DIVERGES from the CoP, so unloading the next swing foot means pushing
      // OFF it. Closed-form constant-CoP drive toward the PLAN's SS-start xi,
      // re-solved each tick from measured xi:
      //   p = (xi_tgt - xi*e^(wT)) / (1 - e^(wT)),  T = remaining DS time.
      const tgtF = st.plan.xiStart.x * axes.fwd.x + st.plan.xiStart.z * axes.fwd.z;
      const tgtL = st.plan.xiStart.x * axes.left.x + st.plan.xiStart.z * axes.left.z;
      const stF = nextStanceP.x * axes.fwd.x + nextStanceP.z * axes.fwd.z;
      const xiFm = xi.x * axes.fwd.x + xi.z * axes.fwd.z;
      const xiLm = xi.x * axes.left.x + xi.z * axes.left.z;
      const T = Math.max(0.06, tDS - st.t);
      const E = Math.exp(om * T);
      let pF = (tgtF - xiFm * E) / (1 - E);
      let pL = (tgtL - xiLm * E) / (1 - E);
      // clamp the drive into the physical support span (+ ankle authority)
      const fL = { f: legL.foot.pos.x * axes.fwd.x + legL.foot.pos.z * axes.fwd.z, l: legL.foot.pos.x * axes.left.x + legL.foot.pos.z * axes.left.z };
      const fR = { f: legR.foot.pos.x * axes.fwd.x + legR.foot.pos.z * axes.fwd.z, l: legR.foot.pos.x * axes.left.x + legR.foot.pos.z * axes.left.z };
      pF = clamp(pF, Math.min(fL.f, fR.f) - 0.6 * k.copLimitX, Math.max(fL.f, fR.f) + 0.6 * k.copLimitX);
      pL = clamp(pL, Math.min(fL.l, fR.l) - 0.6 * k.copLimitZ, Math.max(fL.l, fR.l) + 0.6 * k.copLimitZ);
      st.shift = { x: pF * axes.fwd.x + pL * axes.left.x, z: pF * axes.fwd.z + pL * axes.left.z };
      // lift when xi has ARRIVED near the plan's SS-start point and the foot
      // is unloaded (grace: 1.5 extra tDS, then go anyway)
      const nsw = mech.legs[nextSwing];
      const arrived = Math.abs(xiLm - tgtL) < 0.35 * k.halfStance && Math.abs(xiFm - tgtF) < 0.6 * k.strideCap
        && Math.abs(hull.v.y) < 0.35; // don't lift off mid-bounce — height-recovery momentum becomes a jump
      // emergency: xi beyond the ankle envelope means no CoP can catch it —
      // step NOW (stepping must be available in every state; no cooldown)
      const emergency = Math.abs(xiFm - stF) > 1.2 * k.copLimitX;
      // an emergency step with the lift candidate still fully loaded is a
      // self-inflicted free fall (measured: fired one tick after touchdown,
      // yanked the only loaded foot) — give the transfer a beat first
      const emergencyOK = emergency && st.t >= 0.3 * tDS && nsw.load < 0.5 * totalW;
      if ((st.t >= tDS && ((arrived && nsw.load < 0.5 * totalW * 0.5) || st.t >= tDS + 1.5 * k.tDS)) || emergencyOK) {
        st.swing = nextSwing;
        st.phase = "SS"; st.t = 0; st.hold = {};
        st.lastSwingY = null;
        st.from = { x: nsw.foot.pos.x, z: nsw.foot.pos.z };
        st.ssPlan = st.plan;
        st.nom = { x: st.plan.prints[1].x, z: st.plan.prints[1].z };
      }
    } else if (st.phase === "SS") {
      const s = st.t / tSS;
      const leg = mech.legs[st.swing];
      const loaded = leg.load > 0.22 * totalW;
      // early touchdown needs the foot NEAR THE GROUND — a drag contact at
      // lift height must not count (it declared touchdown barely ahead of
      // lift-off and every step landed short: the compounding the spec warns
      // about)
      const nearGround = (leg.foot.pos.y - leg.foot.hy) < groundRef + 0.08;
      if (s >= 1 || (s > 0.62 && loaded && nearGround)) {
        // touchdown: replan from the MEASURED landing
        st.prints[st.swing] = { x: leg.foot.pos.x, z: leg.foot.pos.z };
        st.lastSwing = st.swing; st.swing = null;
        st.phase = "DS"; st.t = 0;
        st.ramp = 1 + (st.ramp - 1) * 0.6;
        st.holdCop = {};
        st.shift = null;
        mech.telem.steps++;
        if (st.stopping && Math.hypot(_comV.x, _comV.z) < 0.3) {
          st.mode = "STAND"; st.stopping = false;
        }
      }
    }
  }
  // ---- xi reference + error. During SS the lateral reference is the LIPM
  // exponential (xi passes BY the stance foot on its way to the next print,
  // it does not park over it): refL = stance + sign*eps0*e^(wt) — continuous
  // with the DS plan's lift-off target and arriving at the next print at
  // touchdown. xiErr drives the capture step and the SS ankle trim.
  const inSSm = st.mode === "WALK" && st.phase === "SS" && st.swing;
  const stanceRef = inSSm ? st.prints[st.swing === "L" ? "R" : "L"] : feetMid;
  const xiFm2 = xi.x * axes.fwd.x + xi.z * axes.fwd.z;
  const xiLm2 = xi.x * axes.left.x + xi.z * axes.left.z;
  let refF, refL;
  if (inSSm && st.ssPlan) {
    // the plan's DCM trajectory: ref(t) = p0 + (xiStart - p0)*e^(wt)
    const p0 = st.ssPlan.prints[0], xs = st.ssPlan.xiStart;
    const grow = Math.exp(om * st.t);
    const rx = p0.x + (xs.x - p0.x) * grow;
    const rz = p0.z + (xs.z - p0.z) * grow;
    refF = rx * axes.fwd.x + rz * axes.fwd.z;
    refL = rx * axes.left.x + rz * axes.left.z;
  } else {
    refF = (stanceRef.x * axes.fwd.x + stanceRef.z * axes.fwd.z) + st.cmd.f / om;
    refL = (feetMid.x * axes.left.x + feetMid.z * axes.left.z) + st.cmd.l / om;
  }
  const xiF = xiFm2 - refF, xiL = xiLm2 - refL;
  const xiErr = { x: xiF * axes.fwd.x + xiL * axes.left.x, z: xiF * axes.fwd.z + xiL * axes.left.z };
  // pelvis: PLAN-anchored IK center (feet midpoint standing, support-to-next-
  // print midpoint walking). Tracking the CoM here closed a feedback loop —
  // CoM wobble -> ref wobble -> stiff servos amplify (measured 3-5 Hz rock).
  {
    const p1 = st.mode === "WALK" && st.plan ? st.plan.prints[1] : null;
    let tx = st.mode === "WALK" && p1 ? (stanceRef.x + p1.x) / 2 : feetMid.x;
    let tz = st.mode === "WALK" && p1 ? (stanceRef.z + p1.z) / 2 : feetMid.z;
    // lateral pelvis SWAY toward the plan's xi target during DS: without it
    // the force transfer "shifts weight" by rolling the hull 18 deg (which
    // moves the CoM a meter sideways on its own and overshoots everything) —
    // the body must translate over the new support, not tip over it
    if (st.mode === "WALK" && st.phase === "DS" && st.plan) {
      tx = tx * 0.3 + st.plan.xiStart.x * 0.7;
      tz = tz * 0.3 + st.plan.xiStart.z * 0.7;
    }
    st.pelvis.x += clamp(tx - st.pelvis.x, -1.2 * dt, 1.2 * dt);
    st.pelvis.z += clamp(tz - st.pelvis.z, -1.2 * dt, 1.2 * dt);
  }
  // ---- swing trajectory
  if (st.mode === "WALK" && st.phase === "SS" && st.swing) {
    const tSS = k.tSS * st.ramp;
    const s = st.t / tSS;
    // swing target (capture feedback, committed at mid-swing) + clamps
    const t2 = swingTargetXZ(s, st.from, st.nom, xiErr, st.hold, k);
    // clamp against the stance foot: separation in [minFootSep, splayMax*2*halfStance]
    const stanceP = st.prints[st.swing === "L" ? "R" : "L"];
    let dx = t2.x - stanceP.x, dz = t2.z - stanceP.z;
    const lat = dx * axes.left.x + dz * axes.left.z;
    const fwd = dx * axes.fwd.x + dz * axes.fwd.z;
    const sideSign = st.swing === "L" ? 1 : -1;
    const latC = sideSign * clamp(sideSign * lat, k.minFootSep, k.splayMax * 2 * k.halfStance);
    dx = fwd * axes.fwd.x + latC * axes.left.x;
    dz = fwd * axes.fwd.z + latC * axes.left.z;
    // REACH CLAMP: never command a landing at full leg extension — a
    // straight knee has no torque lever, so the landed leg cannot deliver
    // the force feedforward and the machine sinks on it (measured: 1.45W
    // commanded, free-fall anyway). Cap horizontal reach for ext <= 0.95.
    {
      const sx = st.swing === "L" ? 1 : -1;
      const hcs = Math.cos(st.heading), hsn = Math.sin(st.heading);
      const hipGx = st.pelvis.x + sx * g.hipX * hcs;
      const hipGz = st.pelvis.z - sx * g.hipX * hsn;
      const hipH = Math.max(0.5, hipYRef - groundRef - g.ankleH);
      const dMax = Math.sqrt(Math.max(0.04, (0.95 * g.L) * (0.95 * g.L) - hipH * hipH));
      const ddx = stanceP.x + dx - hipGx, ddz = stanceP.z + dz - hipGz;
      const dd = Math.hypot(ddx, ddz);
      if (dd > dMax) { dx -= ddx * (1 - dMax / dd); dz -= ddz * (1 - dMax / dd); }
    }
    // final descent rate-limited: land probing at ~0.35 m/s, not at whatever
    // the sin^2 tail plus a dropping hull adds up to (measured 341 kN slams
    // bounced the machine airborne)
    let ty = groundRef + swingLift(s, k.stepHeight);
    if (st.lastSwingY != null && ty < st.lastSwingY) ty = Math.max(ty, st.lastSwingY - 0.35 * dt);
    st.lastSwingY = ty;
    st.swingTgt = {
      x: stanceP.x + dx,
      y: ty,
      z: stanceP.z + dz,
    };
  }
  // ---- leg targets
  const pelvisRef = { x: st.pelvis.x, z: st.pelvis.z };
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    if (st.mode === "WALK" && st.phase === "SS" && st.swing === side && st.swingTgt) {
      // swing IK works from the ACTUAL hip height: when the hull sinks in a
      // lunge, ref-height IK over-extends the leg (clamped at 0.995) and the
      // "lifted" foot planes along the ground
      const hipActual = hull.pos.y + g.hipY;
      // swing IK from the MEASURED hull position (x/z too, not just yaw):
      // the hull leans ~0.3m toward the stance side, and reference-pelvis
      // IK puts the real hip that far inboard of where it thinks — the
      // "droop" no gain or gravity comp could fix
      setLegTargets(mech, side, { x: hull.pos.x, z: hull.pos.z }, Math.min(hipYRef, hipActual + 0.05), yawMeas, st.swingTgt);
    } else {
      const p = st.prints[side];
      // DS weight transfer is LEG-LENGTH asymmetry: extend the push-off leg
      // (press down), shorten the other. Ankle-roll edge-pressing alone is
      // self-defeating — pressing a foot's outboard edge rolls the machine
      // OFF that foot, its load dies, and the net CoP lands on the wrong
      // side (measured: xi driven backward through every DS).
      let pressY = 0;
      if (st.mode === "WALK" && st.phase === "DS" && st.shift) {
        const sLat = clamp(((st.shift.x - feetMid.x) * axes.left.x + (st.shift.z - feetMid.z) * axes.left.z) / k.halfStance, -1, 1);
        pressY = -0.06 * sLat * leg.sx;
      }
      setLegTargets(mech, side, pelvisRef, hipYRef, st.heading, { x: p.x, y: groundRef + pressY, z: p.z });
    }
  }
  // waist ring (spec §5c): servo to aim - bodyYaw, slew-limited; aim
  // defaults to the commanded heading until the turret exists (M4)
  if (mech.waist) {
    const aimYaw = mech.aimYaw != null ? mech.aimYaw : st.heading;
    const wTgt = clamp(wrapPi(aimYaw - yawMeas), mech.waist.lo, mech.waist.hi);
    mech.waist.target += clamp(wTgt - mech.waist.target, -1.74 * dt, 1.74 * dt);
    mech.arms.L.target = 0; mech.arms.R.target = 0;
  }
  // target rates for the motors' tracking feedforward (clamped: lift-off
  // target discontinuities must not become velocity spikes)
  for (const j of mech.joints) {
    const pt = j._pTgt != null ? j._pTgt : j.target;
    j.tRate = clamp(wrapPi(j.target - pt) / dt, -3, 3);
    j._pTgt = j.target;
  }
  // hull attitude compensation applied AFTER the rate pass (differentiating
  // it once pumped pitch wobble into a standing hop); WALK only — the
  // standing stack balances without it and extra loops fight
  if (st.mode === "WALK") for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    leg.hipPitch.target = clamp(leg.hipPitch.target - (mech._attPf || 0), leg.hipPitch.lo, leg.hipPitch.hi);
    leg.hipRoll.target = clamp(leg.hipRoll.target - (mech._attRf || 0), leg.hipRoll.lo, leg.hipRoll.hi);
  }
  // ---- feedforward stack: damped vertical impedance + CoP placement +
  // hull attitude springs at the stance hips, with soft servos underneath.
  const copCmd = (st.mode === "WALK" && st.phase === "DS" && st.shift)
    ? st.shift
    : copCommand({ x: stanceRef.x, z: stanceRef.z }, xiErr, st.holdCop, k);
  const jointWorld = (j, out) => {
    rMulVec(j.b.R, j.rB, out);
    return V.add(out, j.b.pos, out);
  };
  const heightErr = (hull.pos.y + g.hipY) - hipYRef;
  const T = mech.tune;
  const Fz = clamp(totalW * (T.fzBase - T.fzKp * heightErr - T.fzKd * _comV.y), 0.25 * totalW, T.fzCap * totalW);
  mech._attPf = (mech._attPf || 0) + 0.12 * (mech._attP - (mech._attPf || 0));
  mech._attRf = (mech._attRf || 0) + 0.12 * (mech._attR - (mech._attRf || 0));
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    const isSwing = st.mode === "WALK" && st.phase === "SS" && st.swing === side;
    // gain schedule: unloaded swing leg tracks stiffer, EASING off before
    // touchdown (a hard gain step mid-swing kicked the leg — measured)
    const sNow = st.mode === "WALK" && st.phase === "SS" ? st.t / (k.tSS * st.ramp) : 0;
    const ease = smoothstep((sNow - 0.68) / 0.2);
    // swing tracking at 4x still meandered +-0.35m around the target
    // (execution error, planner verified sane) — 8x, eased before touchdown
    const swingMul = isSwing ? 8 - 6 * ease : 1;
    const swingKd = isSwing ? 2.8 - 1.5 * ease : 1;
    for (const j of [leg.hipRoll, leg.hipPitch, leg.knee, leg.anklePitch, leg.ankleRoll]) { j.kpMul = swingMul; j.kdMul = swingKd; }
    if (isSwing || leg.load < 0.02 * totalW) {
      // swing/unloaded: gravity comp for the leg's OWN hanging weight —
      // without it the 2.4t leg droops 0.4m inboard of its target no matter
      // the tracking gain (measured; the meandering was droop, not noise)
      for (const [j, kind, name] of [[leg.hipPitch, "p", "hipPitch"], [leg.knee, "p", "knee"], [leg.anklePitch, "p", "anklePitch"], [leg.hipRoll, "r", "hipRoll"], [leg.ankleRoll, "r", "ankleRoll"]]) {
        jointWorld(j, _h6);
        let md = 0, cx = 0, cz = 0;
        for (const b of leg.distal[name]) { md += b.mass; cx += b.mass * b.pos.x; cz += b.mass * b.pos.z; }
        cx /= md; cz /= md;
        const Fw = -md * world.gravity;
        const dFwd = (cx - _h6.x) * axes.fwd.x + (cz - _h6.z) * axes.fwd.z;
        const dLeft = (cx - _h6.x) * axes.left.x + (cz - _h6.z) * axes.left.z;
        j.tauFF = clamp(kind === "p" ? Fw * dFwd : -Fw * dLeft, -0.5 * j.tauMax, 0.5 * j.tauMax);
      }
      continue;
    }
    const inSS = st.mode === "WALK" && st.phase === "SS";
    const midX = inSS ? leg.foot.pos.x : (legL.foot.pos.x + legR.foot.pos.x) / 2;
    const midZ = inSS ? leg.foot.pos.z : (legL.foot.pos.z + legR.foot.pos.z) / 2;
    let eFwd = (copCmd.x - midX) * axes.fwd.x + (copCmd.z - midZ) * axes.fwd.z;
    let eLeft = (copCmd.x - midX) * axes.left.x + (copCmd.z - midZ) * axes.left.z;
    // SS forward trim capped at half the box: a saturated toe-brake pitches
    // the machine over its own toe (ankles trim, capture steps catch)
    eFwd = clamp(eFwd, -k.copLimitX, inSS ? 0.5 * k.copLimitX : k.copLimitX);
    eLeft = clamp(eLeft, -k.copLimitZ, k.copLimitZ);
    const copX = leg.foot.pos.x + eFwd * axes.fwd.x + eLeft * axes.left.x;
    const copZ = leg.foot.pos.z + eFwd * axes.fwd.z + eLeft * axes.left.z;
    // RAW instantaneous measured load, ALWAYS — walking is a perturbation
    // of the (proven) standing stack, and the measured load self-adapts
    // through weight transfer. Every walk-only force loop tried here (Fz
    // height force, attitude springs) re-created the limit-cycle fights.
    // measured load for double support (levers ~0, feedback-neutral, proven
    // standing). Single support MUST use the height-referenced Fz instead:
    // F*lever torques press the ground, which raises next tick's measured F
    // — loop gain > 1 through the big SS levers, the machine launches itself
    // (measured: stance load 217k then airborne).
    let F = inSS ? Fz : leg.load;
    // DS weight transfer, exact: the desired CoP fixes the per-foot load
    // fraction, F_L/W = (p - x_R)/(x_L - x_R). Position-level pressing was
    // 3x too weak; a fixed force gain overshot and stumbled the machine
    // sideways. The closed-form p re-solves from measured xi every tick, so
    // this fraction self-regulates.
    if (st.mode === "WALK" && st.phase === "DS" && st.shift) {
      const pLat = st.shift.x * axes.left.x + st.shift.z * axes.left.z;
      const xLl = legL.foot.pos.x * axes.left.x + legL.foot.pos.z * axes.left.z;
      const xRl = legR.foot.pos.x * axes.left.x + legR.foot.pos.z * axes.left.z;
      const fracL = clamp((pLat - xRl) / Math.max(0.2, xLl - xRl), 0, 1);
      // split the HEIGHT-LOOP force by the CoP fraction — but FLOOR at the
      // measured load: the fraction shapes the push-off, it must not order
      // the front foot slack while the vault physically arrives on it
      // (measured: F_front ~0, machine falls THROUGH the fresh leg)
      // floor on the LOW-PASSED load, capped at W: with §5e-strong knees a
      // raw-spike floor is a >unity feedback loop (362k spike -> launch)
      leg.loadLpf = (leg.loadLpf || 0) * 0.9 + leg.load * 0.1;
      F = Math.min(Math.max(Fz * (side === "L" ? fracL : 1 - fracL), T.floorG * leg.loadLpf), totalW);
    }
    // hull attitude spring+damper through the loaded hips during ALL of
    // WALK: single support obviously, but DS too — the leg-length weight
    // shift deliberately un-balances the machine and something must keep
    // the hull level while it happens (measured: 0.25 rad of unrighted roll
    // through one DS). STAND stays clean (proven without it).
    const walkGain = st.mode === "WALK" ? 1 : 0;
    const share = clamp(F / totalW, 0, 1);
    const pitchRate = hull.w.x * axes.left.x + hull.w.z * axes.left.z;
    const rollRate = hull.w.x * axes.fwd.x + hull.w.z * axes.fwd.z;
    const Katt = mech.hull.mass * world.gravity * T.katt;
    // pitch spring at the stance hip stays (its yaw side-effect is small and
    // the CMG's yaw channel absorbs it); ROLL spring stays dead — its couple
    // at the laterally-offset foot was the dominant yaw pump
    const attTauP = Katt * (mech._attPf + 0.3 * pitchRate) * share * walkGain;
    const attTauR = 0;
    for (const [j, kind] of [[leg.hipPitch, "p"], [leg.knee, "p"], [leg.anklePitch, "p"], [leg.hipRoll, "r"], [leg.ankleRoll, "r"]]) {
      jointWorld(j, _h6);
      const dFwd = (copX - _h6.x) * axes.fwd.x + (copZ - _h6.z) * axes.fwd.z;
      const dLeft = (copX - _h6.x) * axes.left.x + (copZ - _h6.z) * axes.left.z;
      let tau = kind === "p" ? F * dFwd : -F * dLeft;
      if (j === leg.hipPitch) tau += attTauP;
      if (j === leg.hipRoll) tau += attTauR;
      j.tauFF = clamp(tau, -0.9 * j.tauMax, 0.9 * j.tauMax);
    }
  }
}

// ---------------------------------------------------------------- island step
export function mechIslandSolve(world, mech) {
  const dt = world.dt;
  // gather this mech's contacts (flagged in prepContacts, excluded from the
  // LOD-tiered global pass)
  const cs = mech._contacts; cs.length = 0;
  const cfm = 0.2 * mech.groundC / (dt * dt);
  for (const c of world.contacts) {
    if (!c.mech) continue;
    if (c.a.mechRef === mech || (c.b && c.b.mechRef === mech)) {
      c.softCfm = (!c.b && c.a.kind === "mechfoot") ? cfm : 0;
      cs.push(c);
    }
  }
  // island: fixed iterations, joints + contacts INTERLEAVED (spec §6)
  for (const j of mech.joints) prepHinge(j, dt);
  const IT = 12;
  for (let it = 0; it < IT; it++) {
    for (const j of mech.joints) iterHinge(j, dt, false);
    for (const c of cs) solveContactOne(c, dt);
  }
  // locks-only close-out: the last motor impulse must not leave the step with
  // unsolved lock velocity, or it integrates into a positional ratchet the
  // drift pass then converts into a standing hinge-angle error (measured)
  for (let it = 0; it < 2; it++) for (const j of mech.joints) iterHinge(j, dt, true);
  // foot loads for the NEXT tick's controller (N)
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    let pn = 0;
    for (const c of cs) if (c.a === leg.foot || c.b === leg.foot) pn += c.pn;
    leg.load = pn / dt;
  }
}
function stepMechs(world) {
  for (const mech of world.mechs) {
    positionalPass(mech);
    controller(world, mech);
    mechIslandSolve(world, mech);
  }
}

// ---------------------------------------------------------------- commands + gate helpers
export function mechCommand(mech, { travel = null, lateral = null, heading = null } = {}) {
  const st = mech.state;
  if (travel != null) st.cmdT.f = travel;
  if (lateral != null) st.cmdT.l = lateral;
  if (heading != null) st.headingT = heading;
}
export function mechUp(mech) { return mech.hull.R[4]; }
export function mechFallen(mech) { return mech.state.mode === "FALLEN"; }
// build-time stability caps (spec §4/§6) — explicit-damper bounds still
// asserted even though the motor is implicit: they keep a future small mech
// failing LOUDLY at build.
export function mechCaps(mech, dt) {
  const out = [];
  for (const j of mech.joints) {
    const I = j.Ichain;
    out.push({
      name: j.name,
      kdCap: j.kd * dt / I,
      kpCap: j.kp * dt * dt / I,
      kvCap: (j.kd + 2 * Math.sqrt(j.tauMax * j.kv)) * dt / I,
      gamma: j.kd / (j.kp * dt),
    });
  }
  return out;
}
export const __mechTest__ = { addHinge, prepHinge, iterHinge, legIK, setLegTargets, chainInertia, controller, stepMechs, positionalPass };
