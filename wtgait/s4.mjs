// S4: tDS share at tSS@0.8 — speed equilibrium + ensemble
import { walkEns, smoothQ, idx } from "./qlib.mjs";
for (const dsF of [1.0, 0.9, 0.8, 0.7]) {
  const spec = { tSS: 0.8, tDS: dsF, period0: 1 };
  const s = smoothQ(spec, 0.42);
  const e = walkEns(spec);
  console.log("tSS@0.8 tDS@" + dsF + ": idx", idx(s), "v", s.fell ? "-" : s.vMean.toFixed(2),
    "ay", s.fell ? "-" : s.ayRms.toFixed(2), "| ens", e.clean + "/" + e.n,
    JSON.stringify(e.rows.filter((r) => r.fell).map((r) => r.fell.phase + "@" + r.fell.t)));
}
