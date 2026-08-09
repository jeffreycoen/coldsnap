// Hip-yaw re-tune sweep: walk-speed ensemble across settle offsets.
// Usage: node scripts/yaw-sweep.mjs 'raibert=1.3,1.45,1.6,1.75' ['kCapture=...']
// Each cell: N offset runs of travel 0.5 for 40s -> mean dist, falls, minUp.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand, mechFallen, mechUp } from "../src/engine/mech.js";

const flatWorld = (seed = 5) => {
  const field = makeField(64, 1.7, seed);
  field.h.fill(0);
  return makeWorld({ field, seed });
};
const run = (w, secs) => { const n = Math.round(secs / w.dt); for (let i = 0; i < n; i++) { w.events.length = 0; stepWorld(w); } };

const axes = process.argv.slice(2).map((a) => {
  const [name, vals] = a.split("=");
  return { name, vals: vals.split(",").map(Number) };
});
if (!axes.length) axes.push({ name: "raibert", vals: [1.3] });

const OFFS = 6;
function cellRun(params) {
  let falls = 0, sumD = 0, minUp = 1;
  for (let o = 0; o < OFFS; o++) {
    const w = flatWorld();
    const mech = buildMech(w, { x: 0, z: -20 });
    for (const [k2, v] of Object.entries(params)) {
      if (k2 === "tSS") { mech.k.tSS = v; mech.k.stepPeriod = mech.k.tSS + mech.k.tDS; }
      else if (k2 in mech.k) mech.k[k2] = v;
      else if (k2 in mech.tune) mech.tune[k2] = v;
      else if (k2 === "solveIT") mech.solveIT = v;
      else throw new Error("unknown knob " + k2);
    }
    run(w, 2.5 + o * 0.09);
    mechCommand(mech, { travel: 0.5 });
    const z0 = mech.hull.pos.z;
    for (let s = 0; s < 40; s++) { run(w, 1); const u = mechUp(mech); if (u < minUp) minUp = u; if (mechFallen(mech)) break; }
    if (mechFallen(mech)) falls++;
    else sumD += mech.hull.pos.z - z0;
  }
  const okRuns = OFFS - falls;
  return { falls, meanD: okRuns ? sumD / okRuns : 0, minUp };
}

// full grid over the given axes
const grid = axes.reduce((acc, ax) => acc.flatMap((p) => ax.vals.map((v) => ({ ...p, [ax.name]: v }))), [{}]);
for (const p of grid) {
  const t0 = Date.now();
  const r = cellRun(p);
  console.log(Object.entries(p).map(([k2, v]) => `${k2}=${v}`).join(" "),
    `| falls ${r.falls}/${OFFS} meanD ${r.meanD.toFixed(1)}m (${(r.meanD / 40).toFixed(3)} m/s) minUp ${r.minUp.toFixed(2)} [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
}
