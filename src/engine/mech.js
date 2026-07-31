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
  const tSS = 1.30 * AG / omega; // ensemble-swept: 1.66 was 0/8 over 40s, 1.30 is 8/8 (1.15: 6/8, 1.45: 5/8) — the long SS gave xi too much divergence time per step
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
    kCop: 0.40, // reference value — 0.9 exceeds the heel-lift line and rolls the foot onto its toe
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
  // proportions per the reference rig (MK1.44 Light Frame): LEGGY — long
  // chunky legs under a low flat slab body. Visual bulk in the legs, MASS
  // in the pelvis (spec §0 + §5b: their pelvis outweighs their torso 2.4:1)
  L1: 1.90, L2: 1.70, ankleH: 0.42, hipX: 0.85, hipY: -0.72,
  hull: { hx: 1.15, hy: 0.62, hz: 0.95, m: 9500 },
  hipBlock: { h: 0.20, m: 280 },
  thigh: { hx: 0.42, hy: 0.95, hz: 0.50, m: 1000 },
  shin: { hx: 0.34, hy: 0.85, hz: 0.40, m: 700 },
  ankleBlock: { h: 0.17, m: 180 },
  foot: { hx: 0.60, hy: 0.20, hz: 0.78, m: 500, fwdOff: 0.14 },
  // torque ceilings: every leg joint holds the whole machine on one leg —
  // tauMax >= M*g*lever (spec §4). kp is tuned to a separate bandwidth ref.
  // knee/hipPitch sized past the naive single-support lever: the walk crouch
  // lever grows with knee bend and the measured demand pegged a 0.9 budget
  // reference servo regime (mech_model rig/mech.js + assemble.js): tauMax
  // as fractions of W*L (either leg holds the machine, doubled), kp sized
  // so the SINGLE-leg torque saturates at kpDeg of error — gravity-stiff.
  // (Rejected here twice before — both tests ran on the sign-flipped ground.)
  wlFrac: { hipRoll: 0.567, hipPitch: 0.567, knee: 0.769 },
  kpDeg: { hipRoll: 6, hipPitch: 8, knee: 12, anklePitch: 6, ankleRoll: 6 },
  limits: { hipRoll: [-0.55, 0.55], hipPitch: [-1.25, 0.95], knee: [-0.02, 2.4], anklePitch: [-1.45, 1.45], ankleRoll: [-0.9, 0.9] },
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
    const gHipR = mkGain([hipB, thigh, shin, ankB, foot], hipPt, AXZ, 0);
    const gHipP = mkGain([thigh, shin, ankB, foot], hipPt, AXX, 0);
    const gKnee = mkGain([shin, ankB, foot], kneePt, AXX, 0);
    const gAnkP = mkGain([ankB, foot], anklePt, AXX, 0);
    const gAnkR = mkGain([foot], anklePt, AXZ, 0);
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
    const torsoY = hullY + (R.hull.hy + 0.58) * s;
    // the WIDE FLAT slab of the reference silhouette
    const torso = B({ kind: "mechlink", group: "mech", mass: 3100 * s3b, hx: 2.05 * s, hy: 0.58 * s, hz: 1.15 * s, x, y: torsoY, z, friction: 0.6, restitution: 0 });
    const om0b = Math.sqrt(world.gravity / ((hullY - groundY) * 0.85));
    const AXY = v3(0, 1, 0), REFZ = v3(0, 0, 1);
    const Iw = chainInertia([torso], v3(x, hullY + R.hull.hy * s, z), AXY) + 2 * 340 * s3b * (2.25 * s) * (2.25 * s);
    const gW = { kp: Iw * (R.BW * om0b) * (R.BW * om0b), kd: 2 * R.zeta * Math.sqrt(Iw * (R.BW * om0b) * (R.BW * om0b) * Iw), kv: 0, tauMax: 0, Ichain: Iw };
    const waist = addHinge(mech, hull, torso, v3(x, hullY + R.hull.hy * s, z), AXY, REFZ, gW, -0.87, 0.87, "waist");
    mech.waist = waist;
    const shoulderY = torsoY + 0.30 * s;
    const arms = {};
    for (const sd of ["L", "R"]) {
      const sxA = sd === "L" ? 1 : -1;
      const ax0 = x + sxA * 2.25 * s;
      const arm = B({ kind: "mechlink", group: "mech", mass: 340 * s3b, hx: 0.17 * s, hy: 0.80 * s, hz: 0.22 * s, x: ax0, y: shoulderY - 0.80 * s, z, friction: 0.6, restitution: 0 });
      const Ia = chainInertia([arm], v3(ax0, shoulderY, z), v3(1, 0, 0));
      const dt0 = tuneDamper(340 * s3b / (mech.links.reduce((a, b) => a + b.mass, 0)), om0b, Ia, 340 * s3b, 0.62 * s, world.gravity, true);
      const gA = { kp: dt0.kp, kd: dt0.kd, kv: 0, tauMax: 3000 * s3b * s, Ichain: Ia };
      arms[sd] = addHinge(mech, torso, arm, v3(ax0, shoulderY, z), v3(1, 0, 0), v3(0, 1, 0), gA, -1.3, 1.3, sd + "armSwing");
    }
    mech.arms = arms;
    const head = B({ kind: "mechlink", group: "mech", mass: 200 * s3b, hx: 0.62 * s, hy: 0.30 * s, hz: 0.48 * s, x, y: torsoY + (0.58 + 0.30) * s, z, friction: 0.6, restitution: 0 });
    // §5e forgiveness: ordinary driving and falls must never tear — the
    // head popped on every faceplant at 8e4. Ordnance-scale damage (M4)
    // gets its own budget.
    mech.headWeld = addWeld(world, torso, head, 6.0e5);
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
    const short = j.name.slice(1);
    if (j.name.includes("anklePitch")) j.tauMax = 1.40 * M * world.gravity * copX0;
    else if (j.name.includes("ankleRoll")) j.tauMax = 1.45 * M * world.gravity * copZ0;
    else j.tauMax = M * world.gravity * L * R.wlFrac[short];
    // reference gain law (mech_model assemble.js): kp = kpTau/(kpDeg rad),
    // kpTau = the undoubled single-leg torque; kd = kp*gamma*h, gamma 6,
    // our h = 1/120, capped at the explicit-damper bound
    const kpTau = 0.5 * j.tauMax;
    j.kp = kpTau / (R.kpDeg[short] * Math.PI / 180);
    j.kd = Math.min(j.kp * 6 / 120, 0.9 * j.Ichain * 120);
    j.kv = 0.02 * j.kd;
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
    const dtn = tuneDamper(mA / (M - mA), mech.k.omega, j.Ichain, mA, 0.80 * s, world.gravity, true);
    j.kp = dtn.kp; j.kd = dtn.kd;
  }
  // rig override history: 0.045L was set when knee ceilings were low; the
  // ceilings went up (levers 1.35+) and the SHALLOW crouch turned out worse
  // — no bend reserve means no torque lever for the force feedforward and
  // no swing clearance once the hull runs a little low (measured: dragging
  // swings recording garbage prints). 0.075L keeps both.
  // 0.05L uniform (stand = walk height, no transition): the full 0.085L
  // crouch shifts the CoM toe-ward and saturates the ankle position servos
  // at stand (0.3 rad sag, measured) on THIS rig's geometry
  mech.k.pelvisDrop = 0.05 * L;
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
  st.mode = "STAND"; st.t = 0; st.swing = null; st.ramp = 1; st.phases = null; st.pi = 0; st.pt = 0; st.comRef = null;
  st.comOff = null; st.hRec = 0; st.crouchCur = null;
  st.heading = yaw; st.headingT = yaw;
  st.cmd = { f: 0, l: 0 }; st.cmdT = { f: 0, l: 0 };
  st.pelvis = { x, z };
  st.prints = {
    L: { x: mech.legs.L.foot.pos.x, z: mech.legs.L.foot.pos.z },
    R: { x: mech.legs.R.foot.pos.x, z: mech.legs.R.foot.pos.z },
  };
  st.hold = {}; st.holdCop = {}; st.stopping = false; st.stopPlan = null;
  st.settleT = 0; st.settledT = 0; st.spawnDone = false;
  if (mech.headWeld && mech.headWeld.broken) { mech.headWeld.broken = false; world._weldPairsDirty = true; }
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
function setLegTargets(mech, side, pelvis, hipYw, heading, footTgt, tiltComp) {
  const leg = mech.legs[side];
  legIK(mech, leg.sx, pelvis, hipYw, heading, footTgt, _ikOut);
  if (tiltComp) {
    // SWING only: the IK frame is attitude-blind (stance leans ARE the
    // force, reference design) but a rolled hull displaces the airborne
    // foot ~hipHeight*sin(roll) — compensate the hip targets by measured
    // tilt so the foot lands where the plan pointed (chain sums keep the
    // sole flat). 5 deg of transfer lean was placing the foot 0.35m inboard.
    const hull = mech.hull;
    const attP = Math.atan2(-hull.R[7], Math.hypot(hull.R[6], hull.R[8]));
    const attR = Math.asin(clamp(hull.R[1], -1, 1));
    _ikOut.hipPitch -= clamp(attP, -0.3, 0.3);
    _ikOut.hipRoll -= clamp(attR, -0.3, 0.3);
  }
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
  // launchRate (reference chassis.js): half slew for the first 2 steps
  const trRate = k.travelRate * ((st.sinceRest || 0) < 2 && st.mode === "WALK" ? 0.5 : 1);
  st.cmd.f += clamp(st.cmdT.f - st.cmd.f, -trRate * dt, trRate * dt);
  st.cmd.l += clamp(st.cmdT.l - st.cmd.l, -trRate * dt, trRate * dt);
  // heading advances CONTINUOUSLY only at STAND; during WALK it steps
  // DISCRETELY at touchdowns (see the latch) — slewing the commanded frame
  // under planted stance feet wound the leg chains mid-cycle and every
  // sustained turn broke at ~80 deg of accumulated arc.
  if (st.mode !== "WALK") st.heading += clamp(wrapPi(st.headingT - st.heading), -k.turnRate * dt, k.turnRate * dt);
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
    const dbYw = mech.state.mode === "WALK" ? 0.015 : 0.06; // swing-leg reaction pumps yaw at step frequency inside a wide deadband (measured +-0.03 -> +-0.3 by step 10)
    const dbY = (e) => Math.abs(e) < dbYw ? 0 : e - Math.sign(e) * dbYw;
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
    // IDEAL cmg — no store limit (reference cmg.js: the momentum-budget
    // version was their reverted experiment; ours drained hMax in ~0.5s of
    // pitch fighting and the machine collapsed at step 2-3 every run).
    // cmgH stays as telemetry of what an actual store would hold.
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
  // crouch is RATE-LIMITED (reference chassis.walkHeight, 1.5*drop/s): a
  // step input through gravity-stiff servos free-falls the machine 0.2s
  // and the landing slam seeds the lateral rock (measured at WALK entry)
  // stand AT walk height (reference: the warmup crouch IS the walk crouch —
  // "no transition to get wrong"; crouching during the first DS ended with
  // an upward jerk right at the transfer)
  const dropTgt = k.pelvisDrop;
  if (st.crouchCur == null) st.crouchCur = 0;
  st.crouchCur += clamp(dropTgt - st.crouchCur, -1.5 * k.pelvisDrop * dt, 1.5 * k.pelvisDrop * dt);
  const walkH = groundRef + g.standHip - st.crouchCur;
  // touchdown height recovery: SS sinks the hull ~0.25m of servo deflection
  // (sized for full weight on one leg). If the height ref stays at walkH
  // through the load split, that deflection recoils as a catapult — measured
  // 570k landing spike then BOTH feet airborne, hy +0.4 hop. hRec drops the
  // ref to the measured hip at touchdown and re-extends at 0.5 m/s.
  if (st.hRec == null) st.hRec = 0;
  st.hRec = Math.max(0, st.hRec - 0.5 * dt);
  // skyhook on the vertical mode: hull mass on gravity-stiff leg springs is
  // underdamped — measured stance load ringing 0 -> 476k -> 0 through SS
  // (trampoline, ballistic windows, xi runaway). Shift the height ref
  // against hull vertical velocity: falling -> deeper deflection -> harder
  // catch; rising -> softer push.
  // asymmetric: strong on the falling half-cycle, weak on the rising half —
  // symmetric damping shortened the legs mid-rise and threw the feet off
  // the ground (0/0 load windows at late SS)
  const vDamp = clamp(-hull.v.y * (hull.v.y < 0 ? 0.3 : 0.08), -0.12, 0.3);
  const hipYRef = walkH + (1 - crouch) * (0.995 - 0.93) * g.L - st.hRec + vDamp;
  // gait-frame axes for catch decisions
  const axes = { fwd: { x: sn, z: cs }, left: { x: cs, z: -sn } };
  // pelvis->CoM offset (heading frame, low-passed): the plan is a COM/xi
  // plan but IK places the PELVIS. This rig's torso slab/head/arms put the
  // true CoM ~0.4-0.5m ahead of the hip line at crouch, so pelvis=comRef
  // marched the real CoM that far ahead of every reference — xi started
  // outside ankle authority before the first lift-off. (The reference rig
  // is pelvis-heavy, com~pelvis, so it never needed the distinction.)
  if (!st.comOff) st.comOff = { f: 0, l: 0, iF: 0, iL: 0 };
  {
    const df = (_com.x - hull.pos.x) * axes.fwd.x + (_com.z - hull.pos.z) * axes.fwd.z;
    const dl = (_com.x - hull.pos.x) * axes.left.x + (_com.z - hull.pos.z) * axes.left.z;
    const a = Math.min(1, dt / 0.8);
    st.comOff.f += (df - st.comOff.f) * a;
    st.comOff.l += (dl - st.comOff.l) * a;
    // realized-error integrator on top: ankle sag + ground compliance lean
    // hull AND com forward together, invisible to the geometric term. On XI
    // (not com — the velocity lead damps the loop; integrating com error at
    // 0.8/s hunted the stand over and toppled it at ~6s), and SLOW.
    // integrate at STAND only — during WALK xi oscillates around comRef by
    // design and any nonzero mean winds the trim (measured: hull walked
    // ~1m behind its own prints by step 4)
    if (st.mode !== "WALK") {
      const ef = (xi.x - feetMid.x) * axes.fwd.x + (xi.z - feetMid.z) * axes.fwd.z;
      const el = (xi.x - feetMid.x) * axes.left.x + (xi.z - feetMid.z) * axes.left.z;
      st.comOff.iF = clamp(st.comOff.iF + ef * 0.3 * dt, -0.5, 0.5);
      st.comOff.iL = clamp(st.comOff.iL + el * 0.15 * dt, -0.3, 0.3);
    }
  }
  const comOffW = {
    x: (st.comOff.f + st.comOff.iF) * axes.fwd.x + (st.comOff.l + st.comOff.iL) * axes.left.x,
    z: (st.comOff.f + st.comOff.iF) * axes.fwd.z + (st.comOff.l + st.comOff.iL) * axes.left.z,
  };
  const totalW = mech.mass * world.gravity;
  // hull attitude (frame-independent: local-axis world-y components).
  // + pitch = nose down, + roll = left side up.
  mech._attP = clamp(Math.atan2(-hull.R[7], Math.hypot(hull.R[6], hull.R[8])), -0.5, 0.5);
  mech._attR = clamp(Math.asin(clamp(hull.R[1], -1, 1)), -0.5, 0.5);
  // ---- reference architecture (mech_model gait.js/dcm.js): ONE continuous
  // plan clock spans DS and SS. Phases carry a ZMP trajectory (DS: linear
  // shift onto the new stance; SS: hold) and backward-recursed xi boundary
  // values. ALL transitions are clock events — lift-off is a non-event;
  // latching/replanning happens ONLY at touchdown, from measured feet.
  const planPhases = (fromStand, xi0) => {
    const stanceSide = st.lastSwing;              // the foot that stays planted first
    const tDSr = k.tDS * st.ramp, tSSr = k.tSS * st.ramp;
    const strideF = st.stopping ? 0 : clamp(st.cmd.f * k.stepPeriod, -k.strideCap, k.strideCap);
    const strideL = st.stopping ? 0 : clamp(st.cmd.l * k.stepPeriod, -k.strideCap, k.strideCap);
    const prints = [{ x: st.prints[stanceSide].x, z: st.prints[stanceSide].z, side: stanceSide }];
    let side = stanceSide;
    for (let i = 1; i <= 4; i++) {
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
    // phase list: [DS to prints0][SS on prints0][DS to prints1][SS on prints1]...
    const startZmp = { x: feetMid.x, z: feetMid.z };
    const phases = [];
    for (let i = 0; i < 4; i++) {
      const p0 = prints[i];
      const zPrev = i === 0 ? startZmp : { x: prints[i - 1].x, z: prints[i - 1].z };
      // 1.2x (reference uses 1.6): the divergence amplifies e^(w*T) over the
      // leading DS and our realized-CoP lag needs less runway
      const dDS = i === 0 && fromStand ? 1.2 * tDSr : tDSr;
      phases.push({ kind: "DS", stance: p0.side, dur: dDS, zA: zPrev, zB: { x: p0.x, z: p0.z }, land: null });
      phases.push({ kind: "SS", stance: p0.side, dur: tSSr, zA: { x: p0.x, z: p0.z }, zB: { x: p0.x, z: p0.z }, land: { x: prints[i + 1].x, z: prints[i + 1].z } });
    }
    // backward xi recursion (linear-ZMP closed form):
    // xi(t) = p(t) + m/w + (xi0 - p0 - m/w) e^{wt};  xiStart from xiEnd
    let xiEnd = { x: prints[4].x, z: prints[4].z };
    for (let i = phases.length - 1; i >= 0; i--) {
      const ph = phases[i];
      const mX = (ph.zB.x - ph.zA.x) / ph.dur, mZ = (ph.zB.z - ph.zA.z) / ph.dur;
      const E = Math.exp(-om * ph.dur);
      ph.xiEnd = xiEnd;
      ph.xiStart = {
        x: ph.zA.x + mX / om + (xiEnd.x - ph.zB.x - mX / om) * E,
        z: ph.zA.z + mZ / om + (xiEnd.z - ph.zB.z - mZ / om) * E,
      };
      xiEnd = ph.xiStart;
    }
    // the plan starts from REALITY (reference rebuilds from measured COM):
    // solve the first DS's zmp A so the MEASURED xi lands on the recursion's
    // SS-start point, then clamp A into the realizable support span
    if (xi0 && phases.length > 1) {
      const ph0 = phases[0], tgt = phases[1].xiStart;
      const E0 = Math.exp(om * ph0.dur);
      const u = (1 - E0) / (om * ph0.dur);
      const solve = (B, x0, xT) => (B * u + x0 * E0 - xT + B) / (u + E0);
      const fL = mech.legs.L.foot.pos, fR = mech.legs.R.foot.pos;
      ph0.zA = {
        x: clamp(solve(ph0.zB.x, xi0.x, tgt.x), Math.min(fL.x, fR.x) - 0.3, Math.max(fL.x, fR.x) + 0.3),
        z: clamp(solve(ph0.zB.z, xi0.z, tgt.z), Math.min(fL.z, fR.z) - 0.3, Math.max(fL.z, fR.z) + 0.3),
      };
      ph0.xiStart = { x: xi0.x, z: xi0.z };
    }
    return phases;
  };
  const phaseRefs = (ph, tIn) => {
    const mX = (ph.zB.x - ph.zA.x) / ph.dur, mZ = (ph.zB.z - ph.zA.z) / ph.dur;
    const u = clamp(tIn / ph.dur, 0, 1);
    const zmp = { x: ph.zA.x + (ph.zB.x - ph.zA.x) * u, z: ph.zA.z + (ph.zB.z - ph.zA.z) * u };
    const E = Math.exp(om * tIn);
    const xiR = {
      x: zmp.x + mX / om + (ph.xiStart.x - ph.zA.x - mX / om) * E,
      z: zmp.z + mZ / om + (ph.xiStart.z - ph.zA.z - mZ / om) * E,
    };
    return { zmp, xiR };
  };
  if (st.mode === "STAND") {
    const eF = (xi.x - feetMid.x) * axes.fwd.x + (xi.z - feetMid.z) * axes.fwd.z;
    const eL = (xi.x - feetMid.x) * axes.left.x + (xi.z - feetMid.z) * axes.left.z;
    let catchSide = null;
    if (Math.abs(eF) > k.copLimitX || Math.abs(eL) > k.copLimitZ + k.halfStance)
      catchSide = eL > 0 ? "L" : "R";
    // launch gate: walk entry is chaotically sensitive to the residual
    // spawn/crouch sway phase (measured: 7 ticks of settle difference
    // flipped a 46s march into a 6s fall). Hold the launch until xi sits
    // near the support centre, up to 1.6s — gait initiation picks its
    // moment; a catch overrides immediately.
    const quiet = Math.hypot(xi.x - feetMid.x, xi.z - feetMid.z) < 0.14 &&
      Math.hypot(_comV.x, _comV.z) < 0.22; // xi can sit centred while com and velocity cancel — that launch still corrupts
    if (cmdTMag > 0.03 && !quiet) st.launchWait = (st.launchWait || 0) + dt;
    else if (cmdTMag <= 0.03) st.launchWait = 0;
    const launchOk = quiet || (st.launchWait || 0) > 1.6;
    if (st.spawnDone && ((catchSide && st.settleT > 1.6) || (cmdTMag > 0.03 && launchOk))) {
      st.launchWait = 0;
      st.mode = "WALK"; st.ramp = 1.35; st.stopping = false;
      if (catchSide) { st.lastSwing = catchSide === "L" ? "R" : "L"; mech.telem.catches++; }
      st.phases = planPhases(true, xi);
      st.pi = 0; st.pt = 0; st.hold = {}; st.holdCop = {};
      st.comRef = { x: _com.x, z: _com.z };
      st.sinceRest = 0;
      st.centre = { x: feetMid.x, z: feetMid.z };
      st.swing = null;
    }
  }
  let zmpRef = { x: feetMid.x, z: feetMid.z };
  let xiRef = { x: feetMid.x, z: feetMid.z };
  if (st.mode === "WALK") {
    // (tried pausing this clock during flight windows — normal brief load
    // dips trip it constantly and the timing jitter wrecks the lateral
    // rhythm. The clock stays steady.)
    st.pt += dt;
    let ph = st.phases[st.pi];
    // clock-driven transitions; each crossing fires its event exactly once
    while (st.pt >= ph.dur) {
      st.pt -= ph.dur;
      if (ph.kind === "DS") {
        // lift-off: a NON-event — record the swing start, no resets
        st.swing = ph.stance === "L" ? "R" : "L";
        const sw = mech.legs[st.swing];
        st.from = { x: sw.foot.pos.x, z: sw.foot.pos.z };
        st.nom = st.phases[st.pi + 1] ? st.phases[st.pi + 1].land : st.from;
        st.hold = {};
        st.lastSwingY = null;
        st.pi++;
        ph = st.phases[st.pi];
      } else {
        // TOUCHDOWN: the only latch point. Plant from measured, pinned 22%
        // toward the plan; replan from reality; ramp decays.
        const sw = mech.legs[st.swing || (ph.stance === "L" ? "R" : "L")];
        const plan = ph.land || { x: sw.foot.pos.x, z: sw.foot.pos.z };
        const landSide = st.swing || (ph.stance === "L" ? "R" : "L");
        st.prints[landSide] = {
          x: sw.foot.pos.x * 0.78 + plan.x * 0.22,
          z: sw.foot.pos.z * 0.78 + plan.z * 0.22,
        };
        st.lastSwing = landSide;
        st.swing = null;
        st.holdCop = {};
        st.ramp = 1 + (st.ramp - 1) * 0.6;
        st.hRec = clamp(hipYRef - (hull.pos.y + g.hipY), 0, 0.5);
        // discrete turn step: one cycle's worth of heading, applied with
        // both feet fresh on the ground (max yaw authority), frame frozen
        // for the coming cycle
        st.heading += clamp(wrapPi(st.headingT - st.heading), -k.turnRate * k.stepPeriod, k.turnRate * k.stepPeriod);
        // path centre advances by half the commanded stride — commanded
        // laterally, so capture can't walk the centreline sideways
        if (st.centre) {
          const sF = clamp(st.cmd.f * k.stepPeriod, -k.strideCap, k.strideCap) / 2;
          st.centre.x += sF * axes.fwd.x; st.centre.z += sF * axes.fwd.z;
        }
        mech.telem.steps++;
        if (cmdTMag < 0.02 && cmdMag < 0.06) st.stopping = true;
        // forward axis only: at touchdown the lateral sway velocity is at
        // its PEAK (com crossing onto the new stance) — a total-speed test
        // could never fire and the machine marched in place forever. The
        // stand absorbs moderate residual sway.
        const vSF = Math.abs(_comV.x * axes.fwd.x + _comV.z * axes.fwd.z);
        const vSL = Math.abs(_comV.x * axes.left.x + _comV.z * axes.left.z);
        if (st.stopping && vSF < 0.22 && vSL < 0.6) {
          st.mode = "STAND"; st.stopping = false; st.postStop = 4;
          break;
        }
        st.sinceRest = (st.sinceRest || 0) + 1;
        st.phases = planPhases(false, xi);
        st.pi = 0;
        // tracker stays CONTINUOUS across rebuilds (reference COMTracker) —
        // resetting it to measured CoM imports the physical divergence into
        // the kinematic reference and the stiff legs lunge (measured 1.2m
        // pelvis jump -> airborne)
        ph = st.phases[0];
      }
    }
    if (st.mode === "WALK") {
      const refs = phaseRefs(ph, st.pt);
      zmpRef = refs.zmp; xiRef = refs.xiR;
      st._dbgXiRefX = xiRef.x;
      // WALK catch: a bounce event can throw xi laterally clear of the
      // plan mid-phase. Riding the dead plan to its touchdown lets the
      // error compound (measured: one 0/0 flight window, then x ran
      // -0.9 -> -4.0 over three steps). Replan NOW from reality, planted
      // foot = the loaded one; cooldown one step period.
      st._emerCd = Math.max(0, (st._emerCd || 0) - dt);
      const exL = (xi.x - xiRef.x) * axes.left.x + (xi.z - xiRef.z) * axes.left.z;
      // turns rotate the gait out from under the world-anchored plan — that
      // divergence is real but touchdown-fixable; catching on it caused a
      // catch STORM (replan at every cooldown expiry, each aborting the
      // swing before its landing — the machine pirouetted 1.5s on one leg).
      // Wider threshold while turning; cooldown covers a FULL replanned
      // cycle incl. its touchdown.
      const turning = Math.abs(wrapPi(st.headingT - st.heading)) > 0.05;
      if (Math.abs(exL) > (turning ? 1.0 : 0.6) && st._emerCd === 0) {
        st.lastSwing = legL.load >= legR.load ? "L" : "R";
        st.swing = null; st.hold = {}; st.holdCop = {};
        st.phases = planPhases(false, xi);
        st.pi = 0; st.pt = 0;
        st._emerCd = 1.7 * k.stepPeriod;
        mech.telem.catches++;
        ph = st.phases[0];
        const r2 = phaseRefs(ph, 0);
        zmpRef = r2.zmp; xiRef = r2.xiR;
      }
      // COM tracker: integrate the stable LIPM ODE toward xi — the pelvis
      // reference is dynamically consistent, not a slewed chase
      if (!st.comRef) st.comRef = { x: feetMid.x, z: feetMid.z };
      // chase-speed cap: when the zA solve clamps, xiRef (seeded from
      // measured xi) diverges with reality and the tracker would drag the
      // pelvis into the lunge at 2.5 m/s. The excess belongs to the SWING
      // (capture), not the pelvis.
      const vCap = (0.45 + Math.abs(st.cmd.f) + Math.abs(st.cmd.l)) * dt;
      st.comRef.x += clamp(om * (xiRef.x - st.comRef.x) * dt, -vCap, vCap);
      st.comRef.z += clamp(om * (xiRef.z - st.comRef.z) * dt, -vCap, vCap);
      st.pelvis.x = st.comRef.x - comOffW.x;
      st.pelvis.z = st.comRef.z - comOffW.z;
    }
  } else {
    // STAND: pelvis eases to where the CoM lands on the feet midpoint,
    // leaning against lateral com velocity — the two-legged lateral rock
    // is otherwise nearly undamped (measured 0.35 m/s sway persisting 4s+
    // after a stop; it also poisons walk launches)
    // ONLY in the few seconds after a walk->stand stop: as a general stand
    // behavior this lean toppled walk launches and spawn settles.
    st.postStop = Math.max(0, (st.postStop || 0) - dt);
    const vLat = _comV.x * axes.left.x + _comV.z * axes.left.z;
    const skL = st.postStop > 0 ? clamp(-vLat * 0.3, -0.2, 0.2) : 0;
    st.pelvis.x += clamp(feetMid.x - comOffW.x + skL * axes.left.x - st.pelvis.x, -1.2 * dt, 1.2 * dt);
    st.pelvis.z += clamp(feetMid.z - comOffW.z + skL * axes.left.z - st.pelvis.z, -1.2 * dt, 1.2 * dt);
    st.comRef = null;
  }
  const xiErr = { x: xi.x - xiRef.x, z: xi.z - xiRef.z };
  const stanceRef = zmpRef;
  // ---- swing trajectory (clock-phased)
  if (st.mode === "WALK" && st.swing && st.phases[st.pi] && st.phases[st.pi].kind === "SS") {
    const ph2 = st.phases[st.pi];
    const s2 = clamp(st.pt / ph2.dur, 0, 1);
    // lateral capture damped to 0.65: full-gain lateral catches overshoot
    // outboard and the touchdown latch bakes the overshoot into the next
    // stance (period-2 sway growth).
    const xef = xiErr.x * axes.fwd.x + xiErr.z * axes.fwd.z;
    const xel = (xiErr.x * axes.left.x + xiErr.z * axes.left.z) * 0.65;
    const xiErrD = { x: xef * axes.fwd.x + xel * axes.left.x, z: xef * axes.fwd.z + xel * axes.left.z };
    const t2 = swingTargetXZ(s2, st.from, st.nom, xiErrD, st.hold, k);
    // Raibert speed brake: each touchdown replan seeds xiRef from measured
    // xi, so xiErr resets to ~0 and accumulated over-speed is invisible to
    // capture — the march ratcheted 0.22 -> 0.7 m/s until a step missed.
    // Velocity excess over the COMMAND survives every replan.
    // FORWARD axis only — lateral com velocity is the gait's own sway, and
    // braking it wrecked the rhythm and yaw (drift -5 rad).
    {
      const vf = clamp(
        ((_comV.x - cmdW.x) * axes.fwd.x + (_comV.z - cmdW.z) * axes.fwd.z) / om * 1.3,
        -0.7 * k.strideCap, 0.7 * k.strideCap);
      t2.x += vf * axes.fwd.x * smoothstep(s2); t2.z += vf * axes.fwd.z * smoothstep(s2);
    }
    const stanceP = st.prints[ph2.stance];
    let dx = t2.x - stanceP.x, dz = t2.z - stanceP.z;
    const lat = dx * axes.left.x + dz * axes.left.z;
    const fwd = dx * axes.fwd.x + dz * axes.fwd.z;
    const sideSign = st.swing === "L" ? 1 : -1;
    const latC = sideSign * clamp(sideSign * lat, k.minFootSep, k.splayMax * 2 * k.halfStance);
    dx = fwd * axes.fwd.x + latC * axes.left.x;
    dz = fwd * axes.fwd.z + latC * axes.left.z;
    // centrePull 0.18 (reference gait.js): nudge the landing toward the
    // commanded path centre + nominal stance offset — capture feedback
    // narrowing the base was walking the prints inboard
    if (st.centre) {
      // forward component slaves to the feet: the centre is LATERAL path
      // discipline only. Advancing it by the commanded stride let the
      // machine outrun it (walks 2-3x command) — after ~12 steps the 3m
      // lag made centrePull drag every landing backward against the speed
      // brake until a step failed. That was the fixed 13-step horizon.
      const cF = (feetMid.x - st.centre.x) * axes.fwd.x + (feetMid.z - st.centre.z) * axes.fwd.z;
      st.centre.x += cF * axes.fwd.x; st.centre.z += cF * axes.fwd.z;
      // lateral: ONLY while actively turning, ease toward the feet so the
      // centreline follows the curve — a straight stale centreline fights
      // every landing through a sustained turn (arc broke at ~80 deg). On
      // straights the strict centreline stays (easing there cost 5s of
      // survival — it erodes the lateral discipline it exists for).
      if (Math.abs(wrapPi(st.headingT - st.heading)) > 0.05) {
        const cL = (feetMid.x - st.centre.x) * axes.left.x + (feetMid.z - st.centre.z) * axes.left.z;
        const cEase = cL * Math.min(1, dt / 1.5);
        st.centre.x += cEase * axes.left.x; st.centre.z += cEase * axes.left.z;
      }
      const anchorX = st.centre.x + sideSign * k.halfStance * axes.left.x;
      const anchorZ = st.centre.z + sideSign * k.halfStance * axes.left.z;
      dx += 0.18 * (anchorX - (stanceP.x + dx));
      dz += 0.18 * (anchorZ - (stanceP.z + dz));
    }
    let ty = groundRef + swingLift(s2, k.stepHeight);
    // descent limit: slam guard near the ground only. A flat 0.35 m/s cap
    // couldn't get the foot down from apex inside the SS window — "touchdown"
    // latched with the foot 0.4m up and the DS ran on one real leg.
    const dLim = ty < groundRef + 0.25 * k.stepHeight ? 0.6 : 2.5;
    if (st.lastSwingY != null && ty < st.lastSwingY) ty = Math.max(ty, st.lastSwingY - dLim * dt);
    st.lastSwingY = ty;
    st.swingTgt = { x: stanceP.x + dx, y: ty, z: stanceP.z + dz };
  }
  // ---- leg targets
  // SS knee dip: the compass vault rides the pelvis up over the stiff
  // stance leg mid-SS and drops it ~0.1m onto every landing — the impact
  // spikes (339k..630k measured) bounced the machine ballistic and the
  // lateral rhythm corrupted within ~3 steps. Flexing through mid-stance
  // absorbs the ripple at the source.
  let hipYEff = hipYRef;
  if (st.mode === "WALK" && st.phases && st.phases[st.pi] && st.phases[st.pi].kind === "SS") {
    const phN = st.phases[st.pi];
    // monotonic: land BENT. The sin() version re-extended exactly at
    // touchdown and fed the impact it was meant to absorb. hRec's rate
    // limit re-extends through the following DS.
    hipYEff = hipYRef; // dip experiment: 0.12 sin and monotonic both LOST distance (11 vs 13 steps) — the vault is not the binding constraint
  }
  const pelvisRef = { x: st.pelvis.x, z: st.pelvis.z };
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    const inSSnow = st.mode === "WALK" && st.swing != null;
    if (inSSnow && st.swing === side && st.swingTgt) {
      // swing IK works from the ACTUAL hip height: when the hull sinks in a
      // lunge, ref-height IK over-extends the leg (clamped at 0.995) and the
      // "lifted" foot planes along the ground
      const hipActual = hull.pos.y + g.hipY;
      // swing IK from the MEASURED hull position (x/z too, not just yaw):
      // the hull leans ~0.3m toward the stance side, and reference-pelvis
      // IK puts the real hip that far inboard of where it thinks — the
      // "droop" no gain or gravity comp could fix
      setLegTargets(mech, side, { x: hull.pos.x, z: hull.pos.z }, Math.min(hipYEff, hipActual + 0.05), yawMeas, st.swingTgt, true);
    } else {
      const p = st.prints[side];
      // DS weight transfer is LEG-LENGTH asymmetry: extend the push-off leg
      // (press down), shorten the other. Ankle-roll edge-pressing alone is
      // self-defeating — pressing a foot's outboard edge rolls the machine
      // OFF that foot, its load dies, and the net CoP lands on the wrong
      // side (measured: xi driven backward through every DS).
      // no leg-length press: the plan's DS ZMP ramp through the ankle CoP is
      // the whole weight-shift mechanism (reference)
      setLegTargets(mech, side, pelvisRef, hipYEff, st.heading, { x: p.x, y: groundRef, z: p.z });
    }
  }
  // waist ring (spec §5c): servo to aim - bodyYaw, slew-limited; aim
  // defaults to the commanded heading until the turret exists (M4)
  if (mech.waist) {
    // no aim input -> torso FOLLOWS the frame (target ~0). Defaulting to
    // st.heading led measured yaw by the whole turn lag (~1 rad) and
    // cranked the 3100kg torso to its stop mid-march — falls at ~7s of
    // sustained turn.
    const aimYaw = mech.aimYaw != null ? mech.aimYaw : yawMeas;
    const wTgt = clamp(wrapPi(aimYaw - yawMeas), mech.waist.lo, mech.waist.hi);
    mech.waist.target += clamp(wTgt - mech.waist.target, -1.74 * dt, 1.74 * dt);
    mech.arms.L.target = 0; mech.arms.R.target = 0;
  }
  // reference: no target-rate feedforward, no attitude trim in the legs —
  // stiff kp tracks, kd damps absolute wRel, IK is attitude-blind in the
  // commanded frame ("leg deflection IS the force")
  for (const j of mech.joints) j.tRate = 0;
  // ---- ankle CoP trim, the ONLY torque feedforward (reference balance.js):
  // tauFF = -/+ kCop * Fff * err, Fff = min(measured force, 1.5W), roll only
  // in single support (rolling a shared foot sheds contact area). Position
  // servos alone hold the machine — "leg deflection IS the force."
  const copCmd = copCommand({ x: stanceRef.x, z: stanceRef.z }, xiErr, st.holdCop, k);
  const Fcap = 1.5 * totalW;
  for (const side of ["L", "R"]) {
    const leg = mech.legs[side];
    const isSwing = st.mode === "WALK" && st.swing === side;
    for (const j of [leg.hipRoll, leg.hipPitch, leg.knee, leg.anklePitch, leg.ankleRoll]) { j.tauFF = 0; j.kpMul = 1; j.kdMul = 1; }
    if (isSwing || leg.load < 0.02 * totalW) continue;
    const inSS = st.mode === "WALK" && st.swing != null;
    const midX = inSS ? leg.foot.pos.x : (legL.foot.pos.x + legR.foot.pos.x) / 2;
    const midZ = inSS ? leg.foot.pos.z : (legL.foot.pos.z + legR.foot.pos.z) / 2;
    let eFwd = (copCmd.x - midX) * axes.fwd.x + (copCmd.z - midZ) * axes.fwd.z;
    let eLeft = (copCmd.x - midX) * axes.left.x + (copCmd.z - midZ) * axes.left.z;
    eFwd = clamp(eFwd, -k.copLimitX, k.copLimitX);
    eLeft = clamp(eLeft, -k.copLimitZ, k.copLimitZ);
    // (full box both axes — reference; earlier half-caps were mitigations
    // for the dead architecture)
    const Fff = Math.min(leg.load, Fcap);
    leg.anklePitch.tauFF = clamp(k.kCop * Fff * eFwd, -0.9 * leg.anklePitch.tauMax, 0.9 * leg.anklePitch.tauMax);
    // roll trim: full gain in SS; HALF gain in DS — the reference gates it
    // off to protect contact area, but with no lateral actuator at all the
    // physical CoP can't follow the DS ZMP ramp and xi overshoots the
    // stance foot (measured: tracked to -0.68 then blew past to -1.4)
    const rollGain = inSS ? 1 : st.mode === "WALK" ? 0.5 : 0; // STAND stays reference-pure (quiet)
    leg.ankleRoll.tauFF = clamp(-k.kCop * rollGain * Fff * eLeft, -0.9 * leg.ankleRoll.tauMax, 0.9 * leg.ankleRoll.tauMax);
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
