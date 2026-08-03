// Rank screening cells: composite smoothness index + capability deltas vs baseline.
import fs from "fs";
const base = JSON.parse(fs.readFileSync("wtphys/baseline.jsonl", "utf8").trim());
const idx = (s, b) => {
  if (!s || s.fell) return 9.99;
  const r = [s.ayRms / b.ayRms, s.ayP99 / b.ayP99, s.latRms / b.latRms, s.r4Rip / b.r4Rip, s.vfRip / b.vfRip];
  return Math.exp(r.reduce((a, x) => a + Math.log(Math.max(1e-3, x)), 0) / r.length);
};
const rows = [];
for (const f of ["wtphys/screenA.jsonl", "wtphys/screenB.jsonl"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").trim().split("\n")) {
    const r = JSON.parse(line);
    if (r.err) { rows.push({ n: r.name + "@" + r.level, i42: 9.9, note: "ERR" }); continue; }
    rows.push({
      n: r.name + "@" + r.level,
      i42: idx(r.s42, base.s42),
      i90: idx(r.s90, base.s90),
      v42: r.s42.fell ? 0 : r.s42.vMean,
      turn: r.bat.turn90, af: r.bat.aface, cN: r.bat.cruiseN, cV: r.bat.cruiseV, shove: r.bat.shove / 1000,
      walk10: r.bat.walk10,
    });
  }
}
rows.sort((a, b) => a.i42 - b.i42);
console.log("cell            i42   i90   v42  turn90  aface cN cV    shove walk10");
for (const r of rows) console.log(
  r.n.padEnd(15), (r.i42 ?? 9.9).toFixed(2), (r.i90 ?? 9.9).toFixed(2), (r.v42 ?? 0).toFixed(2),
  String((r.turn ?? -1).toFixed ? r.turn.toFixed(1) : r.turn).padStart(6), String(r.af?.toFixed ? r.af.toFixed(1) : r.af).padStart(6),
  r.cN, (r.cV ?? 0).toFixed(2), String(r.shove ?? 0).padStart(4), r.walk10?.toFixed ? r.walk10.toFixed(1) : r.walk10);
