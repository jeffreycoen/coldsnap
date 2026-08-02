// engine/mech.js — biped walker: hinge joints, the mech island, rig builder,
// and the gait controller. Implements docs/mech-spec.md (MK1.43.0 v4).
// The core stays a contacts+welds engine; everything mech lives here behind
// the world.mechStep hook, and core carries only guarded no-op edits (marked
// DIVERGENCE) so golden parity holds. Determinism: no rng, no Date — all
// controller state derives from world state.
import { addBody, addWeld, fireProjectile, __mech__ } from "./core.js";
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
function positionalPass(mech, iters = 2, anchor = null) {
  const M = __mech__;
  for (let it = 0; it < iters; it++) {
    for (const j of mech.joints) {
      const a = j.a, b = j.b;

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
      // (NOTE for the sole-skate item: ~95% of the standing skate is THIS
      // pass positionally dragging the loaded foot — friction never sees
      // position writes. Anchoring loaded feet at stand fixed the skate to
      // 13mm/s but broke the punt suite 4/4 -> 2/4; reverted. A future fix
      // must preserve the pass's role in the pre/post-kick stand.)
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
          // poise-hold anchor: the loaded stance foot takes NO horizontal
          // position writes (they bypass friction — 95% of the sole-skate,
          // advisor-1). Vertical closure stays; the chain absorbs the
          // horizontal over the remaining iterations. Scoped to the hold —
          // the global version broke the punt and the walk.
          if (a === anchor) { a.pos.y += _h6.y * a.invM; }
          else {
            V.addScaled(a.pos, a.pos, _h6, a.invM);
            V.cross(_h4, _h1, _h6); iMulVec(a.invIw, _h4, _h5);
            applyRot(a, _h5.x, _h5.y, _h5.z);
          }
          if (b === anchor) { b.pos.y += -_h6.y * b.invM; }
          else {
            V.addScaled(b.pos, b.pos, _h6, -b.invM);
            V.cross(_h4, _h2, _h6); iMulVec(b.invIw, _h4, _h5);
            applyRot(b, -_h5.x, -_h5.y, -_h5.z);
          }
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
  hull: { hx: 1.15, hy: 0.62, hz: 0.95, m: 10800 }, // BALLAST (Jeff, 2026-07-31): +1300 from the torso slab — the reference rig's stability IS its pelvis-heaviness; a lower CoM shrinks the pelvis->CoM offset and the toppling moment
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
    const torso = B({ kind: "mechlink", group: "mech", mass: 1800 * s3b, hx: 2.05 * s, hy: 0.58 * s, hz: 1.15 * s, x, y: torsoY, z, friction: 0.6, restitution: 0 });
    const om0b = Math.sqrt(world.gravity / ((hullY - groundY) * 0.85));
    const AXY = v3(0, 1, 0), REFZ = v3(0, 0, 1);
    const Iw = chainInertia([torso], v3(x, hullY + R.hull.hy * s, z), AXY) + 2 * 340 * s3b * (2.25 * s) * (2.25 * s);
    const gW = { kp: Iw * (R.BW * om0b) * (R.BW * om0b), kd: 2 * R.zeta * Math.sqrt(Iw * (R.BW * om0b) * (R.BW * om0b) * Iw), kv: 0, tauMax: 0, Ichain: Iw };
    const waist = addHinge(mech, hull, torso, v3(x, hullY + R.hull.hy * s, z), AXY, REFZ, gW, -0.87, 0.87, "waist");
    mech.waist = waist;
    torso.visTag = "torso"; // renderer hook: the shoulder missile pod rides this body
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
    // STABILIZATION ROCKETS (design 2026-08-02): six nozzles on the torso
    // slab, exhaust canted 45 deg down-and-outward — thrust is therefore
    // up-and-inward, applied HIGH (the torso rides ~2m above the CoM), so
    // a burn both rights the lean and pushes the CoM back over support.
    // Forces are REAL (applied to the torso body, carried into the hull
    // through the waist ring) — unlike the ideal CMG there is no free
    // momentum. Unlimited fuel for now (design call).
    // Layout: torso-local [x(left), y(up), z(fwd)]; exhaust unit vectors.
    const R2 = Math.SQRT1_2;
    mech.thrusters = [
      { p: v3(1.5 * s, -0.4 * s, 1.0 * s), e: v3(0, -R2, R2), cur: 0, cmd: 0 },   // front-left  (thrust up+back  = brake / anti-nose-down)
      { p: v3(-1.5 * s, -0.4 * s, 1.0 * s), e: v3(0, -R2, R2), cur: 0, cmd: 0 },  // front-right
      { p: v3(1.5 * s, -0.4 * s, -1.0 * s), e: v3(0, -R2, -R2), cur: 0, cmd: 0 }, // rear-left   (thrust up+fwd   = accelerate)
      { p: v3(-1.5 * s, -0.4 * s, -1.0 * s), e: v3(0, -R2, -R2), cur: 0, cmd: 0 },// rear-right
      { p: v3(2.0 * s, -0.4 * s, 0), e: v3(R2, -R2, 0), cur: 0, cmd: 0 },         // left side   (thrust up+right = anti-left-lean)
      { p: v3(-2.0 * s, -0.4 * s, 0), e: v3(-R2, -R2, 0), cur: 0, cmd: 0 },       // right side
    ];
    mech.thrustMax = 30000 * s * s * s; // N per nozzle; the GRIP BUDGET below is the real limiter
    mech.thrustersOn = false; // opt-in: the certified gait is pinned thruster-free in CI; the game enables
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
  mech.tune = { fzBase: 0.95, fzKp: 2.0, fzKd: 1.6, fzCap: 1.15, floorG: 0.85, katt: 1.2, cmgKp: 2.2, cmgKd: 0.55, cmgSlew: 1.5, yawSS: 1.0, yawSSd: 1.0, turnDS: 0.35, afRate: 0.2, kickLean: 0.5, kickDur: 1.15, kickReach: 1.2, kickH: 0.9 } // punt-suite 4/4 (advisor sweep 2026-08-01); // sortie-swept: full SS yaw spring + heavy SS damping + slow DS turn = 4/6 clean vs 0/6
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
  mech.k.pelvisDrop = 0.05 * L; // (0.07 broke the walk gates — the whole gait is swept at 0.05)
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
  // stumble reflex: while recovering, the stick is IGNORED and the gait
  // stops itself (the stop machinery is proven); commands resume when the
  // frame is back. Compound maneuvers (reversals, turning strafes) kept
  // killing runs precisely because the sortie kept commanding full stride
  // through the stumble.
  st.recoverT = Math.max(0, (st.recoverT || 0) - dt);
  if (st.recoverT > 0) {
    st.cmd.f += clamp(0 - st.cmd.f, -k.travelRate * 2 * dt, k.travelRate * 2 * dt);
    st.cmd.l += clamp(0 - st.cmd.l, -k.travelRate * 2 * dt, k.travelRate * 2 * dt);
  } else {
    // OVERDRIVE governor (2026-08-02, "walking is so freaking slow"): the
    // gait is ensemble-swept to 0.5 and STEP commands beyond it fall (6.3s)
    // — but an ESTABLISHED walk cruises at 0.55 cleanly (6/6 settle
    // offsets) when the extra arrives at 0.03/s. Leaving overdrive holds
    // the certified band until the frame sheds momentum: a direct 0.55->0
    // stop fell 2/6 in the decel. Raw commands <= 0.5 pass untouched.
    let effF = st.cmdT.f;
    st.walkEstT = st.mode === "WALK" ? (st.walkEstT || 0) + dt : 0;
    if (st.cmdT.f > 0.5) {
      st.govDecel = false;
      if (st.govF == null) st.govF = 0.42; // overdrive LAUNCHES at the robust band — 0.5 launches fell 4/6 across settle offsets
      if (st.walkEstT > 8) st.govF = Math.min(0.55, st.govF + 0.03 * dt);
      effF = Math.min(st.cmdT.f, st.govF);
    } else {
      if (st.govF != null && Math.hypot(hull.v.x, hull.v.z) > 0.55) st.govDecel = true; // leaving overdrive hot
      st.govF = null;
      if (st.govDecel) {
        if (Math.hypot(hull.v.x, hull.v.z) > 0.55 && st.cmdT.f < 0.42) effF = 0.42; // brake through the certified band, not past it
        else st.govDecel = false;
      }
    }
    st.cmd.f += clamp(effF - st.cmd.f, -trRate * dt, trRate * dt);
    st.cmd.l += clamp(st.cmdT.l - st.cmd.l, -trRate * dt, trRate * dt);
  }
  // heading rotates continuously at STAND, and during WALK only through DS
  // phases (both feet fresh on the ground). Continuous rotation through SS
  // broke every turn at ~80 deg (winds the loaded stance chain); an 8-deg
  // DISCRETE step at touchdown was worse — a step input into loaded servos
  // that bounced the frame airborne (launch-into-turn fell at 6s). DS-only
  // slew, scaled to keep the same per-cycle turn budget, is both.
  // stumble trigger: healthy walking never drops below R4 ~0.96; under
  // 0.93 the frame is in trouble — shed the commands and recover
  if (st.mode === "WALK" && hull.R[4] < 0.93) st.recoverT = Math.max(st.recoverT, 0.9);
  // (a second, height-based trigger lives after walkH is computed)
  // ABOUT-FACE: a commanded 180 executed as a march-in-place PIVOT (slew
  // during single support at afRate; normal turning keeps the sortie-swept
  // 2.8 deg/cycle DS budget). Travel sheds for the duration; a stumble
  // aborts and clamps the pending turn to a plain trim so recovery isn't
  // fighting a pi error.
  if (st.aboutFace) {
    const afp = Math.abs(wrapPi(st.headingT - st.heading));
    if (afp < 0.12) {
      st.aboutFace = false;
      // in-place march sway rides above the strict stop bound forever
      // (measured: turn done, WALK never exits) — take the stumble-stop's
      // relaxed bounds home to STAND
      if (st.mode === "WALK") st.recoverT = Math.max(st.recoverT, 1.8); // >= one full cycle, or the window expires before a qualifying touchdown
    } else if (st.recoverT > 0 || st.mode === "FALLEN") {
      // abort = kill ALL pending turn and stop. Leaving a residual trim
      // froze a mid-pivot splayed stance and the frame pumped itself to
      // 1.9 m/s riderless and fell (measured, march off 0.2)
      st.aboutFace = false;
      st.headingT = st.heading;
      st.stopping = true;
      st.recoverT = Math.max(st.recoverT, 1.8); // relaxed stop bounds long enough to reach a qualifying touchdown
    } else {
      st.cmdT.f = 0; st.cmdT.l = 0;
      // brake-first (the punt's lesson): pivoting under way-speed momentum
      // fell 2/8 from a march — shed to a walk-in-place crawl, THEN turn.
      // LOW-PASSED speed: the instantaneous hull speed swings 0.3-0.9
      // every sway cycle — a one-shot check flipped to "turn" with the
      // momentum still there, and a sustained-quiet check never passed
      if (st.aboutFace === "brake") {
        const vh = Math.hypot(hull.v.x, hull.v.z);
        st.afV = st.afV == null ? vh : st.afV + (vh - st.afV) * Math.min(1, dt / 0.7);
        if (st.afV < 0.4) { st.aboutFace = "turn"; st.afV = null; }
      }
    }
  }
  {
    const inDS = st.mode === "WALK" && st.phases && st.phases[st.pi] && st.phases[st.pi].kind === "DS";
    const pend = Math.abs(wrapPi(st.headingT - st.heading));
    const standOk = st.mode !== "WALK" && pend <= 0.3; // small trims only — big standing turns must STEP (see the walk-entry trigger)
    const inSS = st.mode === "WALK" && st.phases && st.phases[st.pi] && st.phases[st.pi].kind !== "DS";
    if ((standOk || inDS || (st.aboutFace && inSS)) && !(st.mode === "WALK" && st.recoverT > 0)) {
      let rate = st.mode === "WALK" ? k.turnRate * (k.stepPeriod / Math.max(k.tDS, 0.2)) * mech.tune.turnDS : k.turnRate;
      if (st.aboutFace && st.mode === "WALK") {
        // the pivot rotates during SINGLE support only: one gripping sole
        // resists the twist (the DS grind winds BOTH legs — measured: the
        // wound chain shortened the frame 0.3m, tripped the height
        // stumble, and released 0.6 rad as a whip), and every touchdown
        // lands the swung foot neutral in the new frame, relieving the
        // wind one leg at a time. Lean PAUSES the pivot (graceful, vs the
        // stumble abort at 0.93 which ends it)
        const upr = clamp((hull.R[4] - 0.955) / 0.03, 0, 1);
        rate = inSS && st.aboutFace === "turn" ? mech.tune.afRate * upr : 0;
      }
      st.heading += clamp(wrapPi(st.headingT - st.heading), -rate * dt, rate * dt);
    }
  }
  const cs = Math.cos(st.heading), sn = Math.sin(st.heading);
  const cmdW = { x: st.cmd.f * sn + st.cmd.l * cs, z: st.cmd.f * cs - st.cmd.l * sn };
  const cmdMag = Math.hypot(st.cmd.f, st.cmd.l), cmdTMag = Math.hypot(st.cmdT.f, st.cmdT.l);
  // capture point + MV plan (pelvis ref advances at the commanded velocity)
  mechCom(mech, _com, _comV);
  const comRel = { x: _com.x, y: Math.max(0.5, _com.y - groundRef), z: _com.z };
  const xi = capturePoint(comRel, _comV, world.gravity);
  // EFFECTIVE-GRAVITY compensation (speed assist): sustained horizontal
  // thrust tilts the gravity the LIPM balances against — the equilibrium
  // capture point shifts by a/omega^2, and every consumer downstream
  // (plan, catches, stride placement) must see the SHIFTED point or the
  // whole stack fights the rockets (measured: backward cascades, crawls).
  // Assist-only: stability burns are sub-second transients and the catch
  // machinery should keep seeing the raw dynamics during them.
  // Sign (derived, then measured -sign was 1/6): under sustained forward
  // thrust the equilibrium xi sits a/om^2 BEHIND the CoP — the machine
  // water-skis, leaning BACK against the push. Feeding xi + a/om^2 makes
  // the controller read that leaned-back state as on-reference.
  if (st._thrV != null && mech._thrF) {
    const om2e = world.gravity / Math.max(0.5, comRel.y);
    xi.x += (mech._thrF.x / mech.mass) / om2e;
    xi.z += (mech._thrF.z / mech.mass) / om2e;
  }
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
    // HIP-STRATEGY balance for the static one-leg hold: the CMG torques
    // the hull against com drift (F ~ tau/comH — instant, no contact lag,
    // no CoP box). The ankle alone can't catch the raise transients: its
    // realized CoP lags through the soft contact and saturates at 44k.
    let pbX = 0, pbZ = 0, leanX = 0, leanZ = 0;
    if (st.poise && (st.poise.phase === "hold" || st.poise.phase === "lower")) {
      const spB = st.prints[st.poise.raise === "L" ? "R" : "L"];
      const exB = _com.x - spB.x + _comV.x * 0.4;
      const ezB = _com.z - spB.z + _comV.z * 0.4;
      // instant torque: transient catcher (post-slew)
      pbZ = clamp(exB * 420000, -tauCap, tauCap);
      pbX = clamp(-ezB * 420000, -tauCap, tauCap);
      // lean SETPOINT: sustained authority. Torque alone cancels against
      // the CMG's own leveler; biasing the level target leans the machine
      // and gravity pushes the com — the real hip strategy.
      leanZ = clamp(exB * 0.35, -0.1, 0.1);
      leanX = clamp(-ezB * 0.35, -0.1, 0.1);
    }
    const txD = clamp(-kpA * dbT(-exT - leanX) - kdA * hull.w.x, -tauCap, tauCap);
    // yaw AUTHORITY only in double support (like the heading slew): the
    // yaw spring chasing heading through SS rotates the hull over the one
    // planted foot until it edge-rolls (R4 collapse mid-SS, the sortie
    // killer). In SS keep only the DAMPING term.
    // (zeroing the SS spring outright lost the frame to gait yaw — it does
    // double duty. 0.45 spring + 1.8x damping in SS keeps hold while
    // cutting the active rotation rate over the planted foot.)
    const inSSy = st.mode === "WALK" && st.phases && st.phases[st.pi] && st.phases[st.pi].kind === "SS";
    // extra SS yaw damping ONLY while a turn is active/decaying — running
    // it through straight marches broke the fast band (0.53 fell at 8s)
    const tf = Math.min(1, (st.turnLpf || 0) / 0.1);
    const yawSSe = 1 - (1 - mech.tune.yawSS) * tf, yawSSde = 1 + (mech.tune.yawSSd - 1) * tf;
    const tyD = clamp(kpA * dbY(eyT) * (inSSy ? yawSSe : 1) - kdA * (inSSy ? yawSSde : 1) * hull.w.y, -tauCap, tauCap);
    const tzD = clamp(-kpA * dbT(-ezT - leanZ) - kdA * hull.w.z, -tauCap, tauCap);
    // slew: the CMG is an OUTER loop, slower than the gait (spec §5b)
    if (!mech._cmgT) mech._cmgT = { x: 0, y: 0, z: 0 };
    const slewC = (tauCap / (k.stepPeriod / mech.tune.cmgSlew)) * dt;
    mech._cmgT.x += clamp(txD - mech._cmgT.x, -slewC, slewC);
    mech._cmgT.y += clamp(tyD - mech._cmgT.y, -slewC, slewC);
    mech._cmgT.z += clamp(tzD - mech._cmgT.z, -slewC, slewC);
    let tx = mech._cmgT.x, ty = mech._cmgT.y, tz = mech._cmgT.z;
    // poise balance bypasses the slew: the CMG's outer-loop filter is right
    // for gait attitude but starves the hip-strategy — the ankle loop is
    // lag-limited (soft-contact CoP realization ~0.2s at w=1.6) and the
    // hold NEEDS an instant actuator. pb terms are already tauCap-clamped.
    tx = clamp(tx + pbX, -tauCap, tauCap);
    tz = clamp(tz + pbZ, -tauCap, tauCap);
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
    // GYRO TOGGLE (2026-08-02): off = the ideal CMG applies NOTHING — the
    // rockets (continuous duty below) and ankles are all that hold
    // attitude. State zeroed so re-engage doesn't dump a stale torque.
    if (mech.gyroOn === false) { mech._cmgT.x = 0; mech._cmgT.y = 0; mech._cmgT.z = 0; tx = 0; ty = 0; tz = 0; }
    hull.w.x += tx * dt / Ih.x;
    hull.w.y += ty * dt / Ih.y;
    hull.w.z += tz * dt / Ih.z;
  }
  // THRUSTER AUTO-CONTROL (2026-08-02): error-band ownership — the ankles
  // and step machinery own the small/slow regime exactly as before; the
  // rockets wake on the BIG/FAST errors that today become catches and
  // falls, and on overdrive for speed assist. Hysteresis on the band edge
  // (the poise lesson: two controllers sharing one band fight).
  if (mech.thrusters && mech.thrustersOn && st.mode !== "FALLEN") {
    const W5 = mech.mass * world.gravity;
    mechCom(mech, _com, _comV);
    const om5 = Math.sqrt(world.gravity / Math.max(0.5, _com.y - groundRef));
    const xix = _com.x + _comV.x / om5, xiz = _com.z + _comV.z / om5;
    const fmx = (st.prints.L.x + st.prints.R.x) / 2, fmz = (st.prints.L.z + st.prints.R.z) / 2;
    const ex5 = xix - fmx, ez5 = xiz - fmz;
    const exi = Math.hypot(ex5, ez5);
    const leanR = Math.hypot(hull.w.x, hull.w.z);
    const gyroOff = mech.gyroOn === false;
    // INTENT-SCALED AUTHORITY (Jeff, 2026-08-02): the player's hands say
    // who flies the machine. Sticks RELEASED -> the rockets get wide
    // bands and full budget (catch things the step machinery handles
    // ugly). Locomotion COMMANDED -> the gait owns the body and rockets
    // fire only on genuine last-ditch trouble — every mid-stride burn
    // perturbs the plan (measured: 12% duty halved walk speed).
    const walking = st.mode === "WALK";
    const cmdIntent = Math.abs(st.cmdT.f) + Math.abs(st.cmdT.l);
    const idle5 = cmdIntent < 0.05 && !st.aboutFace && !st.kick;
    const stopping5 = !!st.govDecel; // planned overdrive stop: burns skate the braking soles (2/6, measured)
    const trouble = st.spawnDone && (stopping5
      ? hull.R[4] < 0.945
      : idle5 && !walking
        ? (exi > 0.30 || leanR > 0.55 || hull.R[4] < 0.965) // BISECT: idle wide bands off
        : idle5
          ? (st.recoverT > 0 || hull.R[4] < 0.945) // stick released mid-walk: stopping — normal walk bands
          : walking
            // INTENT SPLIT: at full-stick overdrive the machine is in
            // rocket-mode — recovery burns are load-bearing (removing
            // them measured 0-2/6 on assisted cruise). At sub-overdrive
            // maneuvering speeds the same burns FIGHT the gait's precise
            // work — last-ditch only there.
            ? (st.govF != null
              ? (st.recoverT > 0 || hull.R[4] < 0.945)
              : ((st.recoverT > 0 && hull.R[4] < 0.975) || hull.R[4] < 0.935))
            : (exi > 0.30 || leanR > 0.55 || hull.R[4] < 0.965));
    const calm = walking
      ? (st.recoverT <= 0 && hull.R[4] > 0.975 && exi < 0.45)
      : (exi < 0.18 && leanR < 0.30 && hull.R[4] > 0.985); // BISECT: idle calm band off
    if (trouble) st._thrA = 1;
    else if (calm) st._thrA = 0;
    const torso5 = mech.waist ? mech.waist.b : mech.hull;
    const R5 = torso5.R;
    for (const th of mech.thrusters) th.cmd = 0;
    if (st._thrA) {
      // demand: push the capture point back over the feet + damp CoM speed
      const dx5 = -ex5 * 2.2 - _comV.x * 0.9;
      const dz5 = -ez5 * 2.2 - _comV.z * 0.9;
      for (const th of mech.thrusters) {
        // nozzle thrust direction in world (minus exhaust), horizontal part
        const tx5 = -(R5[0] * th.e.x + R5[3] * th.e.y + R5[6] * th.e.z);
        const tz5 = -(R5[2] * th.e.x + R5[5] * th.e.y + R5[8] * th.e.z);
        th.cmd = clamp(dx5 * tx5 + dz5 * tz5, 0, 1);
      }
    } else if (mech.jetCmd && Math.hypot(mech.jetCmd.x, mech.jetCmd.z) > 0.15) {
      // MANUAL JETS (Jeff, 2026-08-02): the pilot vectors the rockets
      // directly — a held directional burn, world-frame. Stability still
      // preempts on genuine trouble (branch above); everything else is on
      // the pilot. The Raibert brake leans against forward burns mid-walk
      // — manual mode is for standing scoots, slides, and showing off.
      const jm = Math.min(1, Math.hypot(mech.jetCmd.x, mech.jetCmd.z));
      const jx5 = mech.jetCmd.x / Math.max(1e-6, jm), jz5 = mech.jetCmd.z / Math.max(1e-6, jm);
      for (const th of mech.thrusters) {
        const tx5 = -(R5[0] * th.e.x + R5[3] * th.e.y + R5[6] * th.e.z);
        const tz5 = -(R5[2] * th.e.x + R5[5] * th.e.y + R5[8] * th.e.z);
        th.cmd = clamp((jx5 * tx5 + jz5 * tz5) * 1.6 * jm, 0, 0.8);
      }
      st._thrV = null;
    } else if (mech.thrustAssist && ((st.govF != null && st.govF > 0.505) || st.govDecel)) {
      // SPEED ASSIST — the g_eff-compensated overdrive booster: every outer
      // patch surfaced another coupling with the swept balance stack
      // (Raibert fight -> backward cascade at 0.9 m/s; stride geometry
      // outrun at 0.7; overshoot oscillation). The honest integration is
      // thrust-as-effective-gravity INSIDE the capture math (g_eff), a
      // campaign of its own. Best ensemble so far: 4/6 at raw 0.7.
      // (assist waits for the governor's establishment gate — burning
      // into a LAUNCHING gait fell 3/3 at 6-12s, measured)
      // SPEED ASSIST: rear pair pushes toward the commanded speed in
      // overdrive; front pair thrust-brakes the decel. Gentler grip
      // budget — the gait still needs its friction to walk.
      const fwdX = Math.sin(st.heading), fwdZ = Math.cos(st.heading);
      const vF5 = _comV.x * fwdX + _comV.z * fwdZ;
      const wantV = st.govDecel ? 0.42 : Math.min(st.cmdT.f, 0.62); // 0.7 outran the stride geometry — the CoM escapes the support base per step (fell 2/6 at ~25s)
      const dv5 = wantV - vF5;
      // _thrV holds STEADY while assisting — nulling it on transient
      // overshoot re-armed the raw Raibert brake mid-sway and the fight
      // cascaded backward at 0.9 m/s (measured)
      st._thrV = st.govDecel ? null : wantV;
      if (dv5 > 0.05 && !st.govDecel) { mech.thrusters[2].cmd = mech.thrusters[3].cmd = clamp(dv5 * 2.0, 0, 0.66); }
      else if (dv5 < -0.08) { mech.thrusters[0].cmd = mech.thrusters[1].cmd = clamp(-dv5 * 2.0, 0, 0.66); }
    }
    if (st._thrA) st._thrV = null;
    // GRIP BUDGET: vertical thrust unweights the soles, and sole friction
    // is what the whole gait stands on — cap total lift at 0.30 W
    // (stability) / 0.20 W (speed assist)
    let lift = 0;
    for (const th of mech.thrusters) lift += th.cmd * mech.thrustMax * Math.SQRT1_2;
    const jetsLive = mech.jetCmd && Math.hypot(mech.jetCmd.x, mech.jetCmd.z) > 0.15;
    const liftCap = (st._thrA ? 0.30 : jetsLive ? 0.25 : gyroOff ? 0.25 : 0.20) * W5;
    if (lift > liftCap) { const sc5 = liftCap / lift; for (const th of mech.thrusters) th.cmd *= sc5; }
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
  // still-low frame = still recovering: without this the reflex expired on
  // its 0.9s timer while hy sat 0.3+ below ref, commands resumed, and the
  // machine flapped between stumble and resume until it died
  if (st.mode === "WALK" && walkH - hipYnow > 0.3) st.recoverT = Math.max(st.recoverT, 0.4);
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
  const poiseHold = st.poise && (st.poise.phase === "hold" || st.poise.phase === "lower");
  // poise hold: STRONG symmetric vertical damping — the one-leg load
  // oscillation (300k<->30k) gates the ankle's CoP authority and the
  // balance leaks a lurch inboard every light-load trough (bounce
  // ratchet). No swing feet to throw here, so symmetric is safe.
  const vDamp = poiseHold
    ? clamp(-hull.v.y * 0.55, -0.3, 0.3)
    : clamp(-hull.v.y * (hull.v.y < 0 ? 0.3 : 0.08), -0.12, 0.3);
  // poise needs ~0.17 extra crouch: with hips 1.7 apart, the stance leg
  // reaches its foot under the pelvis CENTRE only if the hip drops
  // (3.67m needed at full height vs 3.6 of leg)
  if (st.crouchX == null) st.crouchX = 0;
  // release the poise crouch only at a QUIET stand — ramping height back
  // up mid-catch-walk is the catapult pattern (rising ref under load)
  const cxTgt = st.poise && st.poise.phase !== "recentre" ? 0.18
    : (st.mode === "WALK" || (st.recoverT || 0) > 0) ? st.crouchX : 0;
  st.crouchX += clamp(cxTgt - st.crouchX, -0.35 * dt, 0.35 * dt);
  const hipYRef = walkH + (1 - crouch) * (0.995 - 0.93) * g.L - st.hRec + vDamp - st.crouchX;
  // gait-frame axes for catch decisions
  const axes = { fwd: { x: sn, z: cs }, left: { x: cs, z: -sn } };
  // pelvis->CoM offset (heading frame, low-passed): the plan is a COM/xi
  // plan but IK places the PELVIS. This rig's torso slab/head/arms put the
  // true CoM ~0.4-0.5m ahead of the hip line at crouch, so pelvis=comRef
  // marched the real CoM that far ahead of every reference — xi started
  // outside ankle authority before the first lift-off. (The reference rig
  // is pelvis-heavy, com~pelvis, so it never needed the distinction.)
  if (!st.comOff) st.comOff = { f: 0, l: 0, iF: 0, iL: 0 };
  st.standT = st.mode === "WALK" ? 0 : (st.standT || 0) + dt;
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
      // EPOCH-LIMITED integration (2026-07-31): the trim is load-bearing
      // for walk launches (removing it fails the 20m gate and half the
      // ensemble) — but CONTINUOUS integration closes a slow positive loop
      // with the ankle equilibrium and a bare stand leans itself over at
      // 26-31s at every gain/leak tried. So: integrate only the FIRST 4s
      // of each stand epoch (learn the launch trim), then hold. A frozen
      // constant cannot run away; the residual slow drift is recycled by
      // the stand catches.
      // the classic integrator is BACK: its 26s 'runaway' was integrating
      // the stale-print fiction (feet skate, frame didn't) — with prints
      // tracking the measured feet the loop reference is honest.
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
  // ---- POISE: stand on one leg (design 2026-08-01: "plant the foot,
  // raise the leg — if it falls over it's not right"). The static
  // single-support primitive the punt is built on. Phases: shift (weight
  // onto the stance foot, both planted) -> hold (leg raised, stance ankle
  // CoP + CMG own balance) -> lower (foot down, latch on load).
  if (st.mode === "STAND" && st.poiseReq && st.spawnDone && !st.poise) {
    st.poise = { phase: "crouch", raise: st.poiseReq, t: 0 };
    st.poiseReq = null;
  }
  if (st.poise && st.mode !== "STAND") st.poise = null; // catches/walk own the machine
  if (st.poise) {
    const po = st.poise;
    po.t += dt;
    const stSide = po.raise === "L" ? "R" : "L";
    const sp = st.prints[stSide];
    const rLeg = mech.legs[po.raise];
    const gSign = po.raise === "L" ? 1 : -1;
    const gatherPt = {
      x: sp.x + axes.left.x * gSign * 0.5,
      z: sp.z + axes.left.z * gSign * 0.5,
    };
    if (po.phase === "crouch") {
      // settle INTO the poise crouch before any weight moves — ramping
      // height mid-transfer bounced the machine airborne
      if (st.crouchX > 0.17 && po.t > 1.2) { po.phase = "shift"; po.t = 0; }
    } else if (po.phase === "shift") {
      // Sequence a person uses: shift what the tether allows (the planted
      // trailing leg limits pelvis travel to ~0.46m of its 0.85m journey,
      // so xi CANNOT reach the stance box at full width) -> STEP the feet
      // together -> finish the shift on the narrow stance -> raise. Raising
      // with xi outside the ankle box is textbook LIPM divergence
      // (measured 0.42 -> 0.9 in 0.5s, e^{wt} to the digit).
      // RAISE DIRECTLY from a converged shift — measured: with the 0.18
      // crouch, xi converges onto the stance foot at FULL stance width
      // (exi +-0.05 by 1.7s; the inherited "tether" analysis was wrong at
      // this crouch). The gather step that followed commanded a cross-body
      // point unreachable from the raised leg's own hip (0.87m inboard)
      // and threw the machine over from a converged state.
      const exi3 = Math.hypot(xi.x - sp.x, xi.z - sp.z);
      const vLat2 = Math.hypot(_comV.x, _comV.z);
      po.unl = rLeg.load < 0.27 * totalW && exi3 < 0.3 && vLat2 < 0.15 ? (po.unl || 0) + dt : 0;
      if (po.unl > 0.2) { // the sway's quiet window is ~0.25s — a longer dwell never catches it
        po.phase = "hold";
        // CRANE STANCE: tuck the raised foot toward the support line — held
        // at its own hip line, the 1.5t leg's ~23 kN*m roll moment about
        // the stance foot ate the entire roll authority and the hull
        // yielded leftward at 0.5 m/s against a railed pelvis command.
        // Raised, the leg HAS the lateral reach (2.1m at knee height —
        // the gather only lacked reach at ground height).
        po.tgt = { x: rLeg.foot.pos.x, y: groundRef + 0.85, z: rLeg.foot.pos.z };
        // no tuck: with the roll sign fixed the static moment is inside
        // the ankle budget (23 vs 44 kN*m), and the tuck's own reaction
        // (1.5t at 1.4 m/s) out-ran the CoP chase and threw the hold
      } else if (po.t > 5) po.phase = "recentre";
    } else if (po.phase === "gather") {
      // mini-step: lift, move inboard, place — dragging a grounded foot
      // wrestles its own friction (588k spike, fall)
      const hd = Math.hypot(rLeg.foot.pos.x - gatherPt.x, rLeg.foot.pos.z - gatherPt.z);
      po.gTgt = { x: gatherPt.x, y: hd > 0.2 ? groundRef + 0.18 : groundRef, z: gatherPt.z };
      if (hd < 0.16 && rLeg.foot.pos.y < groundRef + 0.1) { po.phase = "shift2"; po.t2 = 0; }
      if ((po.gt = (po.gt || 0) + dt) > 2.5) po.phase = "recentre";
    } else if (po.phase === "shift2") {
      // narrow stance: the tether is short now — xi can reach the box
      po.t2 = (po.t2 || 0) + dt;
      const exi2 = Math.hypot(xi.x - sp.x, xi.z - sp.z);
      po.unl = rLeg.load < 0.25 * totalW && exi2 < 0.3 ? (po.unl || 0) + dt : 0;
      if (po.unl > 0.2) { // the sway's quiet window is ~0.25s — a longer dwell never catches it
        po.phase = "hold";
        po.tgt = { x: rLeg.foot.pos.x, y: groundRef + 0.85, z: rLeg.foot.pos.z };
      } else if (po.t2 > 4) po.phase = "recentre";
    } else if (po.phase === "hold") {
      // raise eases up to the held height, then the foot TUCKS toward the
      // support line (crane stance) — mass over the foot, no roll moment
      if (po.tgt.y < groundRef + 0.85) po.tgt.y = Math.min(groundRef + 0.85, po.tgt.y + 0.5 * dt);
      if (hull.R[4] < 0.9 || Math.hypot(xi.x - sp.x, xi.z - sp.z) > 1.55 * k.copLimitZ + 0.1) po.phase = "lower"; // abort while ONE capture step can still win: at 0.94 the excursion grows to 1.6 during the lower (e^{wt}) — beyond the 0.9 landing reach
      if (st.poiseDownReq) { po.phase = "lower"; st.poiseDownReq = null; }
      if (po.phase === "lower") {
        // the tucked leg's world position is NOT po.tgt — restart the
        // capture landing from the measured foot
        po.tgt = { x: rLeg.foot.pos.x, y: rLeg.foot.pos.y, z: rLeg.foot.pos.z };
      }
    } else if (po.phase === "lower") {
      if (po.tgt) {
        po.tgt.y = Math.max(groundRef, po.tgt.y - 2.5 * dt);
        // CAPTURE landing, not a blind put-back: the machine is usually
        // escaping when lower fires — land the foot where the falling com
        // needs it (com + velocity lead), clamped to the leg's reach.
        const rHipX = st.pelvis.x + (po.raise === "L" ? 1 : -1) * g.hipX;
        const capX = _com.x + _comV.x * 0.35, capZ = _com.z + _comV.z * 0.35;
        po.tgt.x += clamp(clamp(capX, rHipX - 0.9, rHipX + 0.9) - po.tgt.x, -2.2 * dt, 2.2 * dt);
        po.tgt.z += clamp(capZ - po.tgt.z, -2.2 * dt, 2.2 * dt);
      }
      if (rLeg.load > 0.25 * totalW) { po.phase = "recentre"; po.tgt = null; }
    } else if (po.phase === "recentre") {
      if (!po.rk) { po.rk = 1; st.postStop = 2.5; } // arm the post-stop lateral skyhook — recentre inherits real sway
      const exiR = Math.hypot(xi.x - feetMid.x, xi.z - feetMid.z);
      // a BIG excursion is a stepping problem, not a leaning problem: the
      // gentle stand-ease inherited xi 1.4m out and flailed itself dead in
      // a second (measured). Hand the machine to the proven catch/stumble
      // machinery — clearing poise re-arms the stand-catches next tick,
      // recoverT gives the catch-walk its relaxed stop bounds.
      if (exiR > 0.42) {
        st.poise = null;
        st.recoverT = Math.max(st.recoverT || 0, 0.9);
      } else {
        const quiet2 = Math.hypot(_comV.x, _comV.z) < 0.3;
        if (exiR < 0.25 && rLeg.load > 0.2 * totalW && quiet2) st.poise = null;
        if ((po.rt = (po.rt || 0) + dt) > 6) st.poise = null;
      }
    }
  }
  if (st.mode === "STAND") {
    // prints TRACK the measured feet at stand: the soles skate backward at
    // ~0.05 m/s (solver-level creep, open item) and the stale prints left
    // every stand reference — pelvis target, catch frame, launch centre —
    // anchored to where the feet USED to be, up to 0.8m of fiction. The
    // machine balances against reality, not the latch.
    // ...but never track an AIRBORNE foot (poise raise): its print froze
    // feetMid 0.4m off the stance foot and the CoP trim steered xi off
    // the machine's own support
    if (legL.load > 0.05 * totalW || !st.poise) { st.prints.L.x = legL.foot.pos.x; st.prints.L.z = legL.foot.pos.z; }
    if (legR.load > 0.05 * totalW || !st.poise) { st.prints.R.x = legR.foot.pos.x; st.prints.R.z = legR.foot.pos.z; }
    feetMid.x = (st.prints.L.x + st.prints.R.x) / 2;
    feetMid.z = (st.prints.L.z + st.prints.R.z) / 2;
    const eF = (xi.x - feetMid.x) * axes.fwd.x + (xi.z - feetMid.z) * axes.fwd.z;
    const eL = (xi.x - feetMid.x) * axes.left.x + (xi.z - feetMid.z) * axes.left.z;
    let catchSide = null;

    // second trigger: HULL TILT. The standing trim integrator holds xi
    // centred while the machine itself slowly leans (its runaway mode) —
    // the xi test alone never fires and the shipped build fell SILENTLY at
    // ~26s. The hull can't hide its attitude.
    // SUSTAINED tilt only (0.6s): recoil kicks and mouse-aim torso swings
    // dip R4 for a few ticks and were firing catches constantly in live
    // combat — 'falling over more than ever'. The slow drift-lean HOLDS
    // its tilt; transients don't. (0.982/earlier thresholds were worse —
    // catches need real lean to work against.)
    st.tiltT = hull.R[4] < 0.965 ? (st.tiltT || 0) + dt : 0;
    const tiltCatch = st.tiltT > 0.6 && (st.standT || 0) > 3;
    if (!st.poise && (Math.abs(eF) > k.copLimitX || Math.abs(eL) > k.copLimitZ + k.halfStance || tiltCatch))
      catchSide = eL > 0 ? "L" : "R";
    // launch gate: walk entry is chaotically sensitive to the residual
    // spawn/crouch sway phase (measured: 7 ticks of settle difference
    // flipped a 46s march into a 6s fall). Hold the launch until xi sits
    // near the support centre, up to 1.6s — gait initiation picks its
    // moment; a catch overrides immediately.
    // gait initiation waits for the RIGHT sway moment, not just a quiet
    // one: the first DS transfers weight onto the stance side, so launch
    // when the lateral sway is moving TOWARD it (or still). Launching
    // against the sway was the fast-band killer (0.41-0.53 fell at ~5
    // steps from a corrupted first transfer).
    const stSgn = st.lastSwing === "L" ? 1 : -1;
    const vTow = (_comV.x * axes.left.x + _comV.z * axes.left.z) * stSgn;
    const quiet = Math.hypot(xi.x - feetMid.x, xi.z - feetMid.z) < 0.14 &&
      Math.hypot(_comV.x, _comV.z) < 0.22 && vTow > -0.03; // xi can sit centred while com and velocity cancel — that launch still corrupts
    // a big pending turn is a WALK request: a standing frame cannot rotate
    // far without stepping — grinding the commanded frame against planted
    // feet is the leg-winding failure in its standing form (aim sideways
    // while parked -> pirouette -> fall). Turn by marching in place.
    const wantTurn = Math.abs(wrapPi(st.headingT - st.heading)) > 0.3;
    const wantGo = cmdTMag > 0.03 || wantTurn;
    if (wantGo && !quiet) st.launchWait = (st.launchWait || 0) + dt;
    else if (!wantGo) st.launchWait = 0;
    const launchOk = quiet || (st.launchWait || 0) > 1.6;
    if (st.spawnDone && ((catchSide && st.settleT > 1.6) || (wantGo && launchOk))) {
      st.launchWait = 0;
      st.mode = "WALK"; st.ramp = 1.35; st.stopping = false;
      st.postStop = 0; // the post-stop lateral skyhook TOPPLES launches (own measurement) — a relaunch inside its 4s window was sortie1's death
      // launchRate halves the SLEW for 2 steps, but the command already
      // slewed to full during the stand — step 1 launched at full stride.
      // Enter gently regardless of what the stick did while standing.
      st.cmd.f *= 0.5; st.cmd.l *= 0.5;

      if (catchSide) {
        st.lastSwing = catchSide === "L" ? "R" : "L"; mech.telem.catches++;
        // bleed the wound trim — each catch resets the slow-runaway clock
        st.comOff.iF *= 0.4; st.comOff.iL *= 0.4;
      }
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
  if (st.poise && st.poise.phase !== "recentre") {
    // poise: the balance reference IS the stance foot — feetMid averages
    // in the raised foot and points the ankle CoP off the support
    const spr = st.prints[st.poise.raise === "L" ? "R" : "L"];
    zmpRef = { x: spr.x, z: spr.z };
    xiRef = { x: spr.x, z: spr.z };
  }
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
        st.kick = null; // clock touchdown during a straggling kick: the latch here is equivalent (measured prints); never leave a stale kick
        st.prints[landSide] = {
          x: sw.foot.pos.x * 0.78 + plan.x * 0.22,
          z: sw.foot.pos.z * 0.78 + plan.z * 0.22,
        };
        st.lastSwing = landSide;
        st.swing = null;
        st.holdCop = {};
        st.ramp = 1 + (st.ramp - 1) * 0.6;
        st.hRec = clamp(hipYRef - (hull.pos.y + g.hipY), 0, 0.5);
        // path centre advances by half the commanded stride — commanded
        // laterally, so capture can't walk the centreline sideways
        if (st.centre) {
          const sF = clamp(st.cmd.f * k.stepPeriod, -k.strideCap, k.strideCap) / 2;
          st.centre.x += sF * axes.fwd.x; st.centre.z += sF * axes.fwd.z;
        }
        mech.telem.steps++;
        // a stumble stops properly: the reflex zeroing st.cmd is not enough
        // — stopping never triggered (the PLAYER's stick is still forward)
        // and the machine marched in place degraded (hy 3.8, R4 0.85-0.96
        // hopping) until a pirouette killed it. Stop to STAND, let the
        // launch gate relaunch clean.
        // about-face keeps the in-place march alive until the turn is in
        // (stumbles still stop — the abort above already dropped the flag)
        if ((cmdTMag < 0.02 || st.recoverT > 0) && cmdMag < 0.06 && !st.aboutFace) st.stopping = true;
        // GEAR CHANGE = stop first: commanding travel against the current
        // motion (reverse at speed) asked the gait for a momentum reversal
        // mid-stride and it died fighting it (sortie2, the instant the
        // stick flipped). Stop, stand, relaunch through the launch gate in
        // the new direction.
        const vFsg = _comV.x * axes.fwd.x + _comV.z * axes.fwd.z;
        if (st.cmdT.f * vFsg < -0.045 && Math.abs(vFsg) > 0.25) st.stopping = true;
        // forward axis only: at touchdown the lateral sway velocity is at
        // its PEAK (com crossing onto the new stance) — a total-speed test
        // could never fire and the machine marched in place forever. The
        // stand absorbs moderate residual sway.
        const vSF = Math.abs(_comV.x * axes.fwd.x + _comV.z * axes.fwd.z);
        const vSL = Math.abs(_comV.x * axes.left.x + _comV.z * axes.left.z);
        // stumble-stops accept a rougher entry — STAND has catches, and a
        // degraded hopper never passes the strict quiet test (it died
        // marching in place waiting to qualify)
        const vFm = st.recoverT > 0 ? 0.3 : 0.22, vLm = st.recoverT > 0 ? 0.75 : 0.6;
        if (st.stopping && vSF < vFm && vSL < vLm && hull.R[4] > 0.95) {
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
      // mid-DS stop: a stumbling machine can die inside one cycle — waiting
      // for the NEXT touchdown to check the stop condition was too late
      // (sortie2 went airborne and fell 0.3s before its check). Both feet
      // planted and quiet-enough is a stand, whenever it happens.
      if (st.stopping && st.recoverT > 0 && ph.kind === "DS" && hull.R[4] > 0.95 && legL.load + legR.load > 0.5 * totalW) {
        const vF2 = Math.abs(_comV.x * axes.fwd.x + _comV.z * axes.fwd.z);
        const vL2 = Math.abs(_comV.x * axes.left.x + _comV.z * axes.left.z);
        if (vF2 < 0.3 && vL2 < 0.75) {
          st.mode = "STAND"; st.stopping = false; st.postStop = 4;
        }
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
      // turn state DECAYS (~2s) instead of flipping off: the instant the
      // turn ended, the catch threshold cliffed 1.2 -> 0.6 and a tolerated
      // turn-induced error became an immediate catch cascade — four
      // different sorties all died within 1.3s of their turn segment ending.
      const turnMag = Math.abs(wrapPi(st.headingT - st.heading));
      st.turnLpf = Math.max(turnMag, (st.turnLpf || 0) * (1 - dt / 2));
      const turning = st.turnLpf > 0.05;
      const catchThr = 0.6 + 0.6 * Math.min(1, st.turnLpf / 0.15);
      st._catchSameT = Math.max(0, (st._catchSameT || 0) - dt);
      // never abort a LATE swing: past ~1/3 of SS the landing is imminent
      // and will replan from reality anyway — catching there threw away a
      // nearly-complete step and rode one leg through a fake DS (measured:
      // healthy turn at R4 0.97, catch at pt 0.47, airborne 0.4s later)
      const lateSwing = ph.kind === "SS" && st.pt / ph.dur > 0.35;
      if (Math.abs(exL) > catchThr && st._emerCd === 0 && !lateSwing && !st.kick && !st.puntReq) {
        let planted = legL.load >= legR.load ? "L" : "R";
        // consecutive catches picking the same planted side is the
        // one-legged-pirouette trap: the airborne foot's swing restarts
        // from scratch every catch and NEVER lands (measured: hdg frozen
        // 1.8s, machine spun to the ground on one leg). Flip — the plan's
        // first DS then drives the airborne foot down: a step-down catch.
        if (st._lastCatchSide === planted && st._catchSameT > 0) planted = planted === "L" ? "R" : "L";
        st._lastCatchSide = planted; st._catchSameT = 2.2 * k.stepPeriod;
        st.lastSwing = planted;
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
    // STAND: pelvis eases to where the CoM lands on the feet midpoint
    // plus a FIXED forward bias — the support polygon extends forward of
    // the ankle line (foot fwdOff) and the ballast rig's static
    // equilibrium rests behind it. Any FEEDBACK trim on this axis is a
    // slow-runaway loop (integrator: leaned over at 27-31s at every gain
    // tried; none: backward catch-pacing off the pad). A constant can't
    // run away.
    // leaning against lateral com velocity — the two-legged lateral rock
    // is otherwise nearly undamped (measured 0.35 m/s sway persisting 4s+
    // after a stop; it also poisons walk launches)
    // ONLY in the few seconds after a walk->stand stop: as a general stand
    // behavior this lean toppled walk launches and spawn settles.
    st.postStop = Math.max(0, (st.postStop || 0) - dt);
    const vLat = _comV.x * axes.left.x + _comV.z * axes.left.z;
    const skL = st.postStop > 0 ? clamp(-vLat * 0.3, -0.2, 0.2) : 0;
    let pTgtX = feetMid.x, pTgtZ = feetMid.z;
    if (st.poise && (st.poise.phase === "hold" || st.poise.phase === "lower")) {
      // hold: pelvis FROZEN. The xi-feedback is a second controller in the
      // same loop as the ankle CoP chase — they fought and the com ran.
      // One loop, one actuator: the ankle owns balance.
    } else if (st.poise && st.poise.phase !== "recentre") {
      // FEEDBACK shift: move the pelvis to steer MEASURED xi onto the
      // stance foot. The blind fixed-target ease kept pushing after the
      // weight had arrived and tipped the machine over the outboard edge.
      const spp = st.prints[st.poise.raise === "L" ? "R" : "L"];
      const gx = clamp((spp.x - xi.x) * 0.9, -0.4, 0.4);
      const gz = clamp((spp.z - xi.z) * 0.9, -0.4, 0.4);
      st.pelvis.x += gx * dt; st.pelvis.z += gz * dt;
    } else {
      st.pelvis.x += clamp(pTgtX - comOffW.x + skL * axes.left.x - st.pelvis.x, -1.2 * dt, 1.2 * dt);
      st.pelvis.z += clamp(pTgtZ - comOffW.z + skL * axes.left.z - st.pelvis.z, -1.2 * dt, 1.2 * dt);
    }
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
      const bCap = cmdMag < 0.05 ? 1.0 : 0.7; // uncommanded recovery: full braking — the catch cascade accelerated backward past the 0.7 cap
      // thrust-assisted speed is COMMANDED speed: without this the brake's
      // foot placement fought the rockets and cascaded backward at 0.7 m/s
      // (measured) — the legs stride at their cap, thrust makes the rest
      const cwx = st._thrV != null ? axes.fwd.x * Math.max(Math.hypot(cmdW.x, cmdW.z), st._thrV) : cmdW.x;
      const cwz = st._thrV != null ? axes.fwd.z * Math.max(Math.hypot(cmdW.x, cmdW.z), st._thrV) : cmdW.z;
      const vf = clamp(
        ((_comV.x - cwx) * axes.fwd.x + (_comV.z - cwz) * axes.fwd.z) / om * 1.3,
        -bCap * k.strideCap, bCap * k.strideCap);
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
      if (st.turnLpf > 0.03) {
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
    // EMERGENCY PLANT: if the hull attitude collapses mid-SS (stance foot
    // edge-rolled — R4 0.98 -> 0.83 in 0.2s measured), the swing must slam
    // down NOW: a second support point is the only thing that arrests the
    // pitch, and the leisurely arc never arrives in time.
    const emergPlant = hull.R[4] < 0.94;
    if (emergPlant) ty = groundRef;
    // descent limit: slam guard near the ground only. A flat 0.35 m/s cap
    // couldn't get the foot down from apex inside the SS window — "touchdown"
    // latched with the foot 0.4m up and the DS ran on one real leg.
    const dLim = emergPlant ? 3.5 : ty < groundRef + 0.25 * k.stepHeight ? 0.6 : 2.5;
    if (st.lastSwingY != null && ty < st.lastSwingY) ty = Math.max(ty, st.lastSwingY - dLim * dt);
    st.lastSwingY = ty;
    st.swingTgt = { x: stanceP.x + dx, y: ty, z: stanceP.z + dz };
    // PUNT (design: plant right, kick hard with left): while st.kick runs,
    // the swing target is a strike ramp — fast forward reach rising to hull
    // height. The leg's real mass at strike speed delivers the momentum;
    // contacts do the damage. Recovery = the normal machinery (replan at
    // kick end, stumble reflex on whatever the impact did to us).
    if (st.kick) {
      st.kick.t += dt;
      // TWO-PHASE: strike (0.34s out), then a CONTROLLED return to the home
      // print. Handing the retraction to the normal swing machinery whipped
      // the leg back at 7 m/s, overshot home by 1m, and the touchdown latch
      // recorded the overshoot (crossed stance, stuck march, fall).
      const T_STRIKE = 0.34;
      // geometry from the KICKING FOOT's own start (st.from): anchoring on
      // the stance print sent the foot cross-body under the torso, where it
      // plowed the pad 1.4m short of the target and tripped the machine.
      const strike = {
        x: st.from.x + axes.fwd.x * mech.tune.kickReach - axes.left.x * sideSign * 0.35 * k.halfStance,
        y: groundRef + mech.tune.kickH,
        z: st.from.z + axes.fwd.z * mech.tune.kickReach - axes.left.z * sideSign * 0.35 * k.halfStance,
      };
      let kf;
      if (st.kick.t < T_STRIKE) {
        kf = smoothstep(st.kick.t / T_STRIKE);
        st.swingTgt = {
          x: st.from.x + (strike.x - st.from.x) * kf,
          y: groundRef + 0.25 + (strike.y - groundRef - 0.25) * kf,
          z: st.from.z + (strike.z - st.from.z) * kf,
        };
        // BLOCKED STRIKE: the foot met something solid short of full reach.
        // Momentum is already delivered — but the servo would keep SHOVING
        // against it for the rest of the window and the equal-opposite ran
        // the hull backward at ~3 m/s (the point-blank kill band). Abort
        // straight to PLANT at the contact.
        const sf = mech.legs[st.swing].foot.pos;
        const terr = Math.hypot(st.swingTgt.x - sf.x, st.swingTgt.z - sf.z);
        if (kf > 0.45 && terr > 0.7) st.kick.t = st.kick.dur;
        // (load-based contact-abort was tried and REVERTED: the foot's
        // ground grazes during a normal arc trip it too — every kick came
        // out 25% weaker and the grids got worse, not better)
      } else if (st.kick.t < st.kick.dur) {
        const rf = smoothstep((st.kick.t - T_STRIKE) / (st.kick.dur - T_STRIKE));
        // plant EARLY: the leg can't reverse 5.5 m/s without overshooting
        // (measured 1.4m past home, latched, machine fell off its own
        // print). Ground the foot by mid-return — friction eats the
        // overshoot in the dirt instead of the air.
        st.swingTgt = {
          x: strike.x + (st.from.x - strike.x) * rf,
          y: strike.y + (groundRef + 0.02 - strike.y) * Math.min(1, rf * 2.2),
          z: strike.z + (st.from.z - strike.z) * rf,
        };
        kf = 1 - rf;
        // hand over to PLANT at first ground proximity — the return's tail
        // (still chasing home horizontally while pressing down) bounced the
        // foot off the pad (287k/0/204k load flicker) and rocked the frame
        // over before the plant could engage
        if (rf > 0.4 && mech.legs[st.swing].foot.pos.y < groundRef + 0.22) st.kick.t = st.kick.dur;
      } else {
        // PHASE 3 — PLANT: press the foot down WHERE IT IS and wait for it
        // to genuinely LOAD. The old clock-latch recorded the print at an
        // unloaded hover point (return overshoot leaves the foot ~0.5m off
        // home) and the machine then shifted weight onto fiction — the
        // stale-prints bug in kick form. A real biped plants where the foot
        // came down and corrects with the NEXT step.
        const swf2 = mech.legs[st.swing].foot.pos;
        if (!st.kick.px) { st.kick.px = swf2.x; st.kick.pz = swf2.z; st.kick.pl = 0; }
        st.kick.pl += dt;
        st.swingTgt = { x: st.kick.px, y: groundRef - 0.03, z: st.kick.pz };
        kf = 0;
        st.kick.lt = mech.legs[st.swing].load > 0.18 * totalW ? (st.kick.lt || 0) + dt : 0;
        if (st.kick.lt > 0.1 || st.kick.pl > 0.7) {
          st.prints[st.swing] = { x: swf2.x, z: swf2.z };
          st.lastSwing = st.swing;
          st.kick = null; st.swing = null; st.hold = {}; st.holdCop = {};
          st.stopping = true;
          st.phases = planPhases(false, xi);
          st.pi = 0; st.pt = 0;
          st.recoverT = Math.max(st.recoverT, 1.2);
        }
      }
      // counter-lean: the leg whipping forward carries real momentum — the
      // pelvis shifts back through the strike or the kicker faceplants
      // (measured: R4 0.06 without it); decays with the return. In PLANT,
      // DECAY rather than track kf — kf drops to 0 at handover and the
      // one-tick lean release (0.3m pelvis snap) seeded a backward run.
      if (st.kick && st.kick.px !== undefined) st.kickLean = Math.max(0, st.kickLean - 2.5 * dt);
      else st.kickLean = mech.tune.kickLean * kf;
      if (st.kick) st.lastSwingY = st.swingTgt.y;
    }
  }
  // kick counter-lean applies while kicking and decays through recovery
  if (st.kickLean > 0) {
    st.pelvis.x -= axes.fwd.x * st.kickLean;
    st.pelvis.z -= axes.fwd.z * st.kickLean;
    if (!st.kick) st.kickLean = Math.max(0, st.kickLean - 1.0 * dt);
  }
  // punt request (from mechPunt): force a plan that plants RIGHT and
  // swings LEFT, clock jumped to the last slice of the DS so the kick
  // begins almost immediately
  if (st.puntReq) {
    // the kick launches ONLY from double support — firing mid-swing forced
    // a replan at an arbitrary gait phase and dropped the machine. The
    // request stays pending until the feet allow it (or times out).
    st.puntReq -= dt;
    if (st.puntReq <= 0) st.puntReq = null;
    const inDSNow = st.mode === "WALK" && st.phases && st.phases[st.pi] && st.phases[st.pi].kind === "DS";
    const bothLoaded = legL.load + legR.load > 0.55 * totalW;
    // punt at speed = BRAKE FIRST (gear-change doctrine): firing the kick
    // with 0.4 m/s of march momentum made the recovery a coin toss on the
    // exact trigger phase. The request pends while the stop machinery
    // sheds the speed; the kick fires at the first slow both-loaded DS.
    const puntSpd = Math.hypot(_comV.x, _comV.z);
    if (st.puntReq && st.mode === "WALK" && puntSpd > 0.4) st.stopping = true;
    if (st.puntReq && !st.kick && bothLoaded && puntSpd < 0.45 && (st.mode === "STAND" || inDSNow)) {
      st.puntReq = null;
      if (st.mode === "STAND" && st.spawnDone) {
        st.mode = "WALK"; st.ramp = 1; st.stopping = false;
        st.comRef = { x: _com.x, z: _com.z };
        st.centre = { x: feetMid.x, z: feetMid.z };
        st.sinceRest = 2; st.holdCop = {};
      }
      if (st.mode === "WALK") {
        st.lastSwing = "R";
        st.phases = planPhases(false, xi);
        // NO clock jump: the DS-R IS the wind-up (weight transfers onto the
        // plant foot with consistent plan refs). Jumping the clock desynced
        // xiRef and the WALK catch hijacked the punt mid-kick (stance
        // flipped, wrong foot kicked, machine toppled backward).
        // The kick owns strike AND return (0.85s) — stretch its SS to fit,
        // and freeze capture (the deliberate counter-lean poisons xiErr).
        if (st.phases[1]) st.phases[1].dur = Math.max(st.phases[1].dur, mech.tune.kickDur + 1.0); // strike + return + PLANT all inside one SS
        st.pi = 0; st.pt = 0;
        st.swing = null; st.hold = { cap: { x: 0, z: 0 } };
        st.kick = { t: 0, dur: mech.tune.kickDur }; // dur = strike 0.34 + return
      }
    }
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
    if (st.poise && st.poise.tgt && side === st.poise.raise) {
      if (st.poise.phase === "hold") {
        // JOINT-SPACE tuck for the HELD leg: any world-position IK chases
        // the hull's own sway — the raised 1.5t leg flailed 0.4m at 2Hz
        // and shook xi out of the box (measured). A held leg is a POSE.
        // Slewed entry 0.7 rad/s: a snapped tuck's reaction outruns the
        // ankle (advisor-2, measured).
        const mir = side === "L" ? 1 : -1; // roll mirrors per side
        const tuck = { hipRoll: 0.08 * mir, hipPitch: -0.55, knee: 1.35, anklePitch: -0.8, ankleRoll: 0 };
        for (const jn of ["hipRoll", "hipPitch", "knee", "anklePitch", "ankleRoll"]) {
          const j = leg[jn];
          j.target += clamp(tuck[jn] - j.target, -0.7 * dt, 0.7 * dt);
          j.tRate = 0;
        }
        continue;
      }
      // SAME frame as stance IK: switching to swing-style (measured frame,
      // hull base, tiltComp) at the raise was a step input that yanked the
      // 1.5t leg and kicked the hull +0.5 m/s in 0.1s — the transient that
      // poisoned every hold before any balance controller could act.
      setLegTargets(mech, side, pelvisRef, hipYEff, st.heading, st.poise.tgt);
      continue;
    }
    if (st.poise && side === st.poise.raise && st.poise.phase === "gather" && st.poise.gTgt) {
      const hipA3 = hull.pos.y + g.hipY;
      setLegTargets(mech, side, { x: hull.pos.x, z: hull.pos.z }, Math.min(hipYEff, hipA3 + 0.05), yawMeas, st.poise.gTgt, true);
      continue;
    }
    if (st.poise && side === st.poise.raise && st.poise.phase === "shift2" && st.poise.gTgt) {
      setLegTargets(mech, side, pelvisRef, hipYEff, st.heading, { x: st.poise.gTgt.x, y: groundRef, z: st.poise.gTgt.z });
      continue;
    }
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
    // 1.1 rad/s (was 1.74), and gentler still in single support — swinging
    // the torso hard while on one foot rocked the frame over
    const inSSw = st.mode === "WALK" && st.swing != null;
    // and FROZEN when single support is already strained — the return swing
    // finishing off a stressed stance was the last rear-aim fall
    const wRate = (inSSw ? (hull.R[4] < 0.97 ? 0 : 0.6) : 1.1) * dt;
    mech.waist.target += clamp(wTgt - mech.waist.target, -wRate, wRate);
    mech.arms.L.target = 0; mech.arms.R.target = 0;
  }
  // POISE hold: the stance sole servos FLAT against the MEASURED hip-roll
  // sag. The attitude-blind commanded-frame ankle target (gait doctrine)
  // presses an edge whenever the hip sags — measured 0.084 rad of sole
  // tilt = ~54 kN*m of steady edge-press that shoved the machine off its
  // own support. Static single support needs a flat sole; balance then
  // belongs to the CoP trim alone.
  if (st.poise && (st.poise.phase === "hold" || st.poise.phase === "lower")) {
    const stLeg = mech.legs[st.poise.raise === "L" ? "R" : "L"];
    stLeg.ankleRoll.target = -stLeg.hipRoll.angle;
  }
  // SHOULDER POD TRACKING (2026-08-02): the rack slews INDEPENDENT of the
  // torso — a ~300kg pod on a 19t frame turns for free. It points where
  // the next salvo would actually go (the reticle solve, snapped targets
  // included), and at the live mslTarget for a beat after firing.
  {
    const torso2 = mech.waist ? mech.waist.b : mech.hull;
    const tYaw = Math.atan2(torso2.R[6], torso2.R[8]);
    let want;
    if (mech.mslTarget && world.t - (mech._lastMsl || -99) < 2.5) want = mech.mslTarget;
    else if ((st._podT = ((st._podT || 0) + dt)) > 0.1) { st._podT = 0; st._podAim = mslAimPoint(world, mech); want = st._podAim; }
    else want = st._podAim;
    const wYaw = want ? Math.atan2(want.x - torso2.pos.x, want.z - torso2.pos.z) : tYaw;
    if (mech.mslYaw == null) mech.mslYaw = tYaw;
    mech.mslYaw += clamp(wrapPi(wYaw - mech.mslYaw), -2.8 * dt, 2.8 * dt);
    mech.podLock = !!(want && want.lock);
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
    const inSS = (st.mode === "WALK" && st.swing != null) || (st.poise != null && st.poise.phase !== "recentre");
    const midX = inSS ? leg.foot.pos.x : (legL.foot.pos.x + legR.foot.pos.x) / 2;
    const midZ = inSS ? leg.foot.pos.z : (legL.foot.pos.z + legR.foot.pos.z) / 2;
    let eFwd = (copCmd.x - midX) * axes.fwd.x + (copCmd.z - midZ) * axes.fwd.z;
    let eLeft = (copCmd.x - midX) * axes.left.x + (copCmd.z - midZ) * axes.left.z;
    eFwd = clamp(eFwd, -k.copLimitX, k.copLimitX);
    eLeft = clamp(eLeft, -k.copLimitZ, k.copLimitZ);
    // (full box both axes — reference; earlier half-caps were mitigations
    // for the dead architecture)
    const Fff = Math.min(leg.load, Fcap);
    // (the standing foot-skate was measured IDENTICAL with this trim zeroed
    // — the creep is solver-level, not toe-press; trim stays reference-pure)
    leg.anklePitch.tauFF = clamp(k.kCop * Fff * eFwd, -0.9 * leg.anklePitch.tauMax, 0.9 * leg.anklePitch.tauMax);
    // roll trim: full gain in SS; HALF gain in DS — the reference gates it
    // off to protect contact area, but with no lateral actuator at all the
    // physical CoP can't follow the DS ZMP ramp and xi overshoots the
    // stance foot (measured: tracked to -0.68 then blew past to -1.4)
    const rollGain = inSS ? 1 : st.mode === "WALK" ? 0.5 : 0; // STAND stays reference-pure (quiet)
    leg.ankleRoll.tauFF = clamp(-k.kCop * rollGain * Fff * eLeft, -0.9 * leg.ankleRoll.tauMax, 0.9 * leg.ankleRoll.tauMax);
    // TORQUE-CONTROLLED ankle for the static hold (micro-experiment: +tau
    // moves the realized CoP OUTBOARD, linearly, ~11mm/kN*m): the position
    // servo's sag torque kp*e (38-54k under the one-leg moment) drowns any
    // CoP command. Cancel the measured spring torque in the FF and impose
    // the CoP demand directly; kd remains for stability.
    if (st.poise && (st.poise.phase === "hold" || st.poise.phase === "lower") && !isSwing && leg.load > 0.3 * totalW) {
      const ar = leg.ankleRoll;
      const sag = ar.kp * (ar.target - ar.angle);
      // calm gain + lateral velocity damping: the railed bang-bang command
      // held the balance but its sustained reaction slid the FOOT out from
      // under a balanced machine (tangential-slip weakness). And when the
      // foot IS sliding, back off and let friction re-grip (stick-slip).
      const vLat3 = _comV.x * axes.left.x + _comV.z * axes.left.z;
      // LIVE DCM law, bypassing copCommand's gait latch (it stairsteps
      // behind a slowly drifting xi): place the CoP PAST xi (Kp>1) so the
      // pendulum is pushed back, plus velocity damping and a slow trim tab.
      const spH = st.prints[st.poise.raise === "L" ? "R" : "L"];
      const eLive = ((xi.x - spH.x) * axes.left.x + (xi.z - spH.z) * axes.left.z) * 1.4;
      st.poise.iTab = clamp((st.poise.iTab || 0) + vLat3 * 2.2 * dt, -0.6 * k.copLimitZ, 0.6 * k.copLimitZ);
      const eHold = clamp(eLive + vLat3 * 0.35 + st.poise.iTab, -0.9 * k.copLimitZ, 0.9 * k.copLimitZ);
      const slide = Math.hypot(leg.foot.v.x, leg.foot.v.z) > 0.12 ? 0.3 : 1;
      ar.tauFF = clamp((-sag - 0.3 * Fff * eHold) * slide, -0.9 * ar.tauMax, 0.9 * ar.tauMax);
      // pitch keeps its POSITION spring untouched — its sag structurally
      // carries the forward moment (cancelling it dropped the hold 16s->5s;
      // a velocity trim tab also measured NEGATIVE, 16s->14.8s).
    }
  }
}

// ---------------------------------------------------------------- island step
export function mechIslandSolve(world, mech) {
  const dt = world.dt;
  // gather this mech's contacts (flagged in prepContacts, excluded from the
  // LOD-tiered global pass)
  const cs = mech._contacts; cs.length = 0;
  // during a poise HOLD the stance foot's ground compliance is the CoP
  // realization LAG (~0.2s at omega 1.6) that loses the balance race
  // (advisor-2, measured) — stiffen it 4x for the hold only
  const poiseHold = mech.state.poise && mech.state.poise.phase === "hold";
  const cfm = (poiseHold ? 0.05 : 0.2) * mech.groundC / (dt * dt);
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
  // poise hold: two extra friction passes on the stance contacts — the
  // sustained CoP torque slides the foot through residual tangential slip
  if (poiseHold) {
    for (let it = 0; it < 2; it++) for (const c of cs) solveContactOne(c, dt);
  }
  // contact close-out: the lock sweep above injects impulses into the foot
  // bodies AFTER the last friction solve — that dirty tangential velocity
  // integrated every tick into the sole-skate (feet creeping backward at a
  // constant ~0.05 m/s, both feet lockstep). Re-balance the contacts, then
  // give the locks one final word.
  for (let it = 0; it < 2; it++) for (const c of cs) solveContactOne(c, dt);
  // (STATIC foot clamp during hold: tried, measured WORSE — 17.5s -> 12s.
  // The skating foot was accidentally tracking the residual controller-side
  // xi drift, keeping support under it. The drift root is the same slow
  // equilibrium loop as the standing skate — open engine/controller item.)

  for (const j of mech.joints) iterHinge(j, dt, true);
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
    {
    const po2 = mech.state.poise;
    const anchor2 = po2 && po2.phase === "hold"
      ? mech.legs[po2.raise === "L" ? "R" : "L"].foot : null;
    positionalPass(mech, 2, anchor2);
  }
    controller(world, mech);
    // thrusters: slew to command, apply real force+torque to the torso
    if (mech.thrusters) {
      const torso = mech.waist ? mech.waist.b : mech.hull;
      const dt = world.dt;
      if (!mech._thrF) mech._thrF = { x: 0, z: 0 };
      mech._thrF.x = 0; mech._thrF.z = 0;
      for (const th of mech.thrusters) {
        const tgt = mech.thrustersOn ? clamp(th.cmd, 0, 1) : 0;
        const spool = mech.gyroOn === false ? 0.06 : 0.12; // continuous duty needs the faster bell
        th.cur += clamp(tgt - th.cur, -dt / spool, dt / spool);
        if (th.cur < 0.01) continue;
        const F = th.cur * mech.thrustMax;
        // world-frame mount + exhaust via torso rows-as-basis
        const R = torso.R;
        const px = R[0] * th.p.x + R[3] * th.p.y + R[6] * th.p.z;
        const py = R[1] * th.p.x + R[4] * th.p.y + R[7] * th.p.z;
        const pz = R[2] * th.p.x + R[5] * th.p.y + R[8] * th.p.z;
        const ex = R[0] * th.e.x + R[3] * th.e.y + R[6] * th.e.z;
        const ey = R[1] * th.e.x + R[4] * th.e.y + R[7] * th.e.z;
        const ez = R[2] * th.e.x + R[5] * th.e.y + R[8] * th.e.z;
        // thrust opposes exhaust
        const fx = -ex * F, fy = -ey * F, fz = -ez * F;
        torso.v.x += fx * torso.invM * dt;
        torso.v.y += fy * torso.invM * dt;
        torso.v.z += fz * torso.invM * dt;
        mech._thrF.x += fx; mech._thrF.z += fz;
        // torque r x F about the torso centre
        const tx = py * fz - pz * fy, ty2 = pz * fx - px * fz, tz2 = px * fy - py * fx;
        torso.w.x += (torso.invIw[0] * tx + torso.invIw[1] * ty2 + torso.invIw[2] * tz2) * dt;
        torso.w.y += (torso.invIw[3] * tx + torso.invIw[4] * ty2 + torso.invIw[5] * tz2) * dt;
        torso.w.z += (torso.invIw[6] * tx + torso.invIw[7] * ty2 + torso.invIw[8] * tz2) * dt;
        wake(torso);
      }
    }
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
// autocannon aim solve: torso facing + BALLISTIC pitch for the commanded
// range (mech.aimRange, metres; UI sets it from stick deflection / mouse
// distance). Low-arc solution of the projectile equation with muzzle
// height; shared by mechFire and the range's trajectory preview.
export function mechAimDir(world, mech) {
  const torso = mech.waist ? mech.waist.b : mech.hull;
  const ty = Math.atan2(torso.R[6], torso.R[8]);
  const gY = world.field.heightAt(torso.pos.x, torso.pos.z);
  const h = Math.max(1, torso.pos.y + 0.35 - gY);
  const d = clamp((mech.aimRange || 26) - 2.4, 4, 120); // muzzle sits 2.6m ahead of the torso the range is measured from
  const s2 = 120 * 120, g = world.gravity;
  const disc = s2 * s2 - g * (g * d * d - 2 * h * s2);
  const tanTh = disc > 0 ? (s2 - Math.sqrt(disc)) / (g * d) : 0.0;
  const pitch = Math.atan(tanTh); // negative = down for near targets (h above ground)
  const cp = Math.cos(pitch);
  const dir = v3(Math.sin(ty) * cp, Math.sin(pitch), Math.cos(ty) * cp);
  const muzzle = v3(torso.pos.x + dir.x * 2.6, torso.pos.y + 0.35, torso.pos.z + dir.z * 2.6);
  return { muzzle, dir, torso };
}
// autocannon (M4): torso-ring mounted, fires along the torso's ACTUAL
// facing. Mass semantics per design: the shell carries pmass, so the frame
// eats m*v of recoil through the waist ring — fire braced or stagger.
export function mechFire(world, mech) {
  if (mech.state.mode === "FALLEN") return false;
  if (world.t - (mech._lastFire || -9) < 0.75) return false;
  const { muzzle, dir, torso } = mechAimDir(world, mech);
  const PM = 40, SPD = 120;
  fireProjectile(world, muzzle, dir, SPD, { kind: "shell", pmass: PM, r: 2.4, kv: 16, dmg: 90, crater: 0.45, attacker: "player", ownerMech: mech });
  const J = PM * SPD;
  torso.v.x -= dir.x * J * torso.invM;
  torso.v.y -= dir.y * J * torso.invM;
  torso.v.z -= dir.z * J * torso.invM;
  wake(torso);
  mech._lastFire = world.t;
  mech.telem.shots = (mech.telem.shots || 0) + 1;
  return true;
}
// PUNT: plant the right foot, kick hard with the left (design 2026-07-31).
// Request flag — the controller owns the plan machinery and executes it.
export function mechPunt(world, mech) {
  if (mech.state.mode === "FALLEN" || mech.state.kick) return false;
  if (world.t - (mech._lastPunt || -9) < 2.2) return false;
  mech._lastPunt = world.t;
  mech.state.puntReq = 2.8; // seconds the request stays pending — covers braking from a march plus waiting for double support
  return true;
}
// ABOUT-FACE (design 2026-08-01): commanded 180 — through the RIGHT, per
// drill. Request sets the heading target and stages brake -> turn; the
// controller executes a march-in-place pivot (single-support slew) and
// clears the flag when the turn is in.
export function mechAboutFace(world, mech) {
  const st = mech.state;
  if (st.mode === "FALLEN" || st.kick || st.poise || st.aboutFace) return false;
  if (world.t - (mech._lastAF || -9) < 3) return false;
  mech._lastAF = world.t;
  // -pi + eps keeps wrapPi's shortest-path resolution on the RIGHT side
  st.headingT = wrapPi(st.heading - Math.PI + 0.02);
  st.aboutFace = "brake";
  st.cmdT.f = 0; st.cmdT.l = 0;
  return true;
}
// SHOULDER MISSILES (design 2026-08-01: "missiles from a shoulder
// launcher that can turn and aim independently of the body"; revised
// 2026-08-01: "rockets need to go where reticle is aimed"). The rack is
// ~300kg — slewing it fast is a rounding error against the 19t frame
// (unlike the 1800kg torso), so independent aim costs nothing. The salvo
// flies to the RETICLE point (torso facing at the commanded aimRange);
// if a live hostile sits within 12m of that point the rack snaps to it
// with lead, otherwise the rockets land on the point itself. Ripple-fires
// a lobbed 3-rocket salvo (HIGH ballistic arc — clears buildings) with
// real mass and per-rocket recoil.
// the salvo's target solve, shared with the pod's tracking visual: the
// reticle's ground point (torso ACTUAL facing at the commanded range),
// snapped to a live hostile within 12m of it (with lead)
export function mslAimPoint(world, mech) {
  const torso = mech.waist ? mech.waist.b : mech.hull;
  const ty = Math.atan2(torso.R[6], torso.R[8]);
  const rng = clamp(mech.aimRange || 26, 6, 120);
  const rx = torso.pos.x + Math.sin(ty) * rng, rz = torso.pos.z + Math.cos(ty) * rng;
  let best = null, bestD = 12;
  for (const b of world.bodies) {
    if (!b.alive || b.team !== 2) continue;
    const d = Math.hypot(b.pos.x - rx, b.pos.z - rz);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best
    ? { x: best.pos.x + best.v.x * 1.6, z: best.pos.z + best.v.z * 1.6, lock: true } // lead at ~arc flight time
    : { x: rx, z: rz, lock: false };
}
export function mechMissiles(world, mech) {
  if (mech.state.mode === "FALLEN") return false;
  if (world.t - (mech._lastMsl || -99) < 6) return false;
  const torso = mech.waist ? mech.waist.b : mech.hull;
  const tgt = mslAimPoint(world, mech);
  if (Math.hypot(tgt.x - torso.pos.x, tgt.z - torso.pos.z) < 8) return false; // danger-close
  mech._lastMsl = world.t;
  mech.mslTarget = tgt;
  mech.mslSlew = 0; // launcher bearing animates in the controller-side state (visual later)
  // muzzle = the shoulder POD (right side, matches the rendered rack)
  const Rm = torso.R;
  const m0 = { x: torso.pos.x + Rm[0] * -1.35 + Rm[3] * 1.05, y: torso.pos.y + Rm[1] * -1.35 + Rm[4] * 1.05, z: torso.pos.z + Rm[2] * -1.35 + Rm[5] * 1.05 }; // matches the halved pod
  const dx = mech.mslTarget.x - m0.x, dz = mech.mslTarget.z - m0.z;
  const d = Math.max(6, Math.hypot(dx, dz));
  const h = m0.y - world.field.heightAt(mech.mslTarget.x, mech.mslTarget.z);
  // FIXED 32-degree loft, SPEED solved for the exact hit — a fixed-speed
  // high arc flew ~10s and expired mid-flight (projectile life cap 8s),
  // and took forever to land. s^2 = g d^2 (1+tan^2) / (2 (d tan + h))
  const g = world.gravity, tanTh = 0.62;
  const den = 2 * (d * tanTh + Math.max(0.5, h));
  // floor 10 (not 18): the solve gives ~17 m/s at 30m — an 18 floor made
  // every shot inside ~33m fly LONG, missing the reticle it promised
  const spd = clamp(Math.sqrt(Math.max(100, g * d * d * (1 + tanTh * tanTh) / den)), 10, 90);
  const th = Math.atan(tanTh);
  const cp = Math.cos(th), sp2 = Math.sin(th);
  const ux = dx / d, uz = dz / d;
  for (let i = 0; i < 3; i++) {
    const jx = (i - 1) * 0.012, jz = (i - 1) * -0.009; // slight ripple spread
    const dir = v3(ux * cp + jx, sp2, uz * cp + jz);
    V.norm(dir, dir);
    fireProjectile(world, v3(m0.x + ux * 0.6, m0.y, m0.z + uz * 0.6), dir, spd,
      { kind: "rocket", pmass: 15, r: 3.2, kv: 13, dmg: 62, crater: 0.8, attacker: "player", ownerMech: mech, delay: i * 0.14, vroll: true });
    torso.v.x -= dir.x * (15 * spd) * torso.invM;
    torso.v.z -= dir.z * (15 * spd) * torso.invM;
  }
  wake(torso);
  mech.telem.salvos = (mech.telem.salvos || 0) + 1;
  return true;
}
// POISE: raise one leg and stand on the other; call again to lower.
export function mechPoise(world, mech, side) {
  const st = mech.state;
  if (st.mode === "FALLEN") return false;
  if (st.poise) { st.poiseDownReq = true; return true; }
  st.poiseReq = side === "R" ? "R" : "L";
  return true;
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
