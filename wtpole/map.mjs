// Step-map identification: perturb a steady walk, diff against the
// deterministic unperturbed twin, fit x_{k+1} = J x_k, report eigenvalues.
// Usage: node wtpole/map.mjs <periodScale> <deltaSet: small|large> [gainJSON]
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";

const P = Number(process.argv[2] || 1);
const SET = process.argv[3] || "small"; // small|large
const PHASE = process.argv[4] || "td"; // td|ss
const GARG = 5;
const GAINS = process.argv[GARG] ? JSON.parse(process.argv[GARG]) : {};

const mkRig = () => {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const world = makeWorld({ field, seed: 5 });
  const mech = buildMech(world, { x: 0, z: 0, yaw: Math.PI });
  const k = mech.k;
  k.tSS *= P; k.tDS *= P; k.stepPeriod = k.tSS + k.tDS;
  k._period0 = k.stepPeriod; // A1: anchors re-certified at the live period (gait campaign)
  for (const [n, v] of Object.entries(GAINS)) k[n] = v; // absolute values
  return { world, mech, k };
};
const comOf = (mech) => {
  let m = 0, x = 0, y = 0, z = 0, vx = 0, vz = 0;
  for (const b of mech.links) { m += b.mass; x += b.mass * b.pos.x; y += b.mass * b.pos.y; z += b.mass * b.pos.z; vx += b.mass * b.v.x; vz += b.mass * b.v.z; }
  return { x: x / m, y: y / m, z: z / m, vx: vx / m, vz: vz / m };
};
// forward = -z at yaw pi. State sampled at each touchdown (telem.steps change).
const sample = (mech) => {
  const c = comOf(mech);
  const om = Math.sqrt(9.81 / Math.max(0.5, c.y));
  const xiF = -(c.z + c.vz / om);
  const cF = -((mech.state.prints.L.z + mech.state.prints.R.z) / 2);
  return { v: -c.vz, q: xiF - cF };
};
// One run: returns per-step samples. perturb: {atStep, dv, phase:"td"|"ss"}
const runOne = (perturb) => {
  const { world, mech, k } = mkRig();
  const dt = world.dt;
  for (let i = 0; i < Math.round(2 / dt); i++) { world.events.length = 0; stepWorld(world); }
  mechCommand(mech, { travel: 0.42, lateral: 0, heading: Math.PI });
  const rows = [];
  let last = mech.telem.steps, armed = perturb ? false : null, fireAt = -1;
  const horizon = Math.round(19 / dt);
  for (let i = 0; i < horizon; i++) {
    world.events.length = 0; stepWorld(world);
    if (mech.state.mode === "FALLEN") { rows.push("FELL"); break; }
    if (mech.telem.steps !== last) {
      last = mech.telem.steps;
      rows.push(sample(mech));
      if (perturb && last === perturb.atStep) {
        if (perturb.phase === "td") { for (const b of mech.links) b.v.z += -perturb.dv; }
        else fireAt = i + Math.round(0.5 * k.tSS / dt);
      }
    }
    if (fireAt === i && perturb) { for (const b of mech.links) b.v.z += -perturb.dv; fireAt = -1; }
  }
  return rows;
};
const K0S = (process.env.K0S || "8,9").split(",").map(Number);
const NREC = Number(process.env.NREC || 6);
const K0 = K0S[0];
const twin = runOne(null);
const twinLen = twin.includes("FELL") ? twin.indexOf("FELL") : twin.length;
if (twinLen < K0 + 3) {
  console.log(JSON.stringify({ P, SET, error: "twin unusable", len: twinLen, fell: twin.includes("FELL") }));
  process.exit(0);
}
const mags = SET === "small" ? [0.05, -0.05, 0.08] : [0.25, -0.25, 0.35];
const phases = [PHASE];
const pairsX = [], pairsY = [], pairsPar = [], runsMeta = [];
for (const phase of phases) for (const k0 of K0S) for (const dv of mags) {
  const r = runOne({ atStep: k0, dv, phase });
  const rLen = r.includes("FELL") ? r.indexOf("FELL") : r.length;
  const ok = Math.min(rLen, twinLen) >= k0 + 2;
  runsMeta.push({ dv, phase, k0, ok, len: rLen, fell: r.includes("FELL") });
  if (!ok) continue;
  const seq = [];
  for (let k2 = k0; k2 < k0 + NREC && k2 < Math.min(rLen, twinLen); k2++)
    seq.push({ k: k2, e: r[k2].v - twin[k2].v, q: r[k2].q - twin[k2].q });
  for (let j = 0; j + 1 < seq.length; j++) { pairsX.push(seq[j]); pairsY.push(seq[j + 1]); pairsPar.push(seq[j].k % 2); }
}
const fit = (idx) => {
  let sxx = 0, sxq = 0, sqq = 0, yex = 0, yeq = 0, yqx = 0, yqq = 0;
  for (const i of idx) {
    const x = pairsX[i], y = pairsY[i];
    sxx += x.e * x.e; sxq += x.e * x.q; sqq += x.q * x.q;
    yex += y.e * x.e; yeq += y.e * x.q; yqx += y.q * x.e; yqq += y.q * x.q;
  }
  const det = sxx * sqq - sxq * sxq;
  if (det === 0) return null;
  const J = {
    a: (yex * sqq - yeq * sxq) / det, b: (yeq * sxx - yex * sxq) / det,
    c: (yqx * sqq - yqq * sxq) / det, d: (yqq * sxx - yqx * sxq) / det,
  };
  let se = 0, sq = 0, ve = 0, vq = 0, me = 0, mq = 0;
  for (const i of idx) { me += pairsY[i].e; mq += pairsY[i].q; }
  me /= idx.length; mq /= idx.length;
  for (const i of idx) {
    const x = pairsX[i], y = pairsY[i];
    se += (y.e - (J.a * x.e + J.b * x.q)) ** 2; ve += (y.e - me) ** 2;
    sq += (y.q - (J.c * x.e + J.d * x.q)) ** 2; vq += (y.q - mq) ** 2;
  }
  return { J, r2e: ve > 0 ? 1 - se / ve : null, r2q: vq > 0 ? 1 - sq / vq : null, n: idx.length };
};
const mul = (A, B) => ({ a: A.a * B.a + A.b * B.c, b: A.a * B.b + A.b * B.d, c: A.c * B.a + A.d * B.c, d: A.c * B.b + A.d * B.d });
const eigOf = (M) => {
  const tr = M.a + M.d, dt2 = M.a * M.d - M.b * M.c, disc = tr * tr / 4 - dt2;
  return disc >= 0
    ? [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)].map((x) => ({ re: +x.toFixed(4), im: 0, mag: +Math.abs(x).toFixed(4) }))
    : [{ re: +(tr / 2).toFixed(4), im: +Math.sqrt(-disc).toFixed(4), mag: +Math.sqrt(dt2).toFixed(4) }];
};
const all = pairsX.map((_, i) => i);
const ev = all.filter((i) => pairsPar[i] === 0), od = all.filter((i) => pairsPar[i] === 1);
const fAll = fit(all), fEv = fit(ev), fOd = fit(od);
const out = { P, SET, PHASE, gains: GAINS, pairs: pairsX.length, runs: runsMeta.filter((r) => !r.ok), fAll, fEv, fOd };
if (fAll) out.eigAll = eigOf(fAll.J);
if (fEv && fOd) out.eigStride = eigOf(mul(fOd.J, fEv.J));
console.log(JSON.stringify(out));
