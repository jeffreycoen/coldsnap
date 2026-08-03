// S2: adaptation A1 — period0 re-certified (anchor follows the new period)
import { walkEns, smoothQ, idx } from "./qlib.mjs";
for (const f of [0.8, 0.65, 0.5]) {
  const s = smoothQ({ tSS: f, period0: 1 }, 0.42);
  const e = walkEns({ tSS: f, period0: 1 });
  console.log("tSS@" + f + " +period0: idx", idx(s), "v", s.fell ? "-" : s.vMean.toFixed(2),
    "| ens", e.clean + "/" + e.n, JSON.stringify(e.rows.filter((r) => r.fell).map((r) => r.fell.phase + "@" + r.fell.t)));
}
