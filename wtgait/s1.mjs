// S1: baseline reproduction + naive tSS ladder (no adaptations)
import { walkEns, smoothQ, idx } from "./qlib.mjs";
{
  const s = smoothQ({}, 0.42);
  console.log("S1 baseline: idx", idx(s), "v", s.vMean?.toFixed(2), "ay", s.ayRms?.toFixed(2));
  const e = walkEns({});
  console.log("S1 baseline ensemble:", e.clean + "/" + e.n, JSON.stringify(e.rows.filter((r) => r.fell)));
}
for (const f of [0.8, 0.65, 0.5]) {
  const s = smoothQ({ tSS: f }, 0.42);
  const e = walkEns({ tSS: f });
  console.log("tSS@" + f + ": idx", idx(s), "v", s.fell ? "-" : s.vMean.toFixed(2),
    "| ens", e.clean + "/" + e.n, JSON.stringify(e.rows.filter((r) => r.fell).map((r) => r.fell.phase + "@" + r.fell.t)));
}
