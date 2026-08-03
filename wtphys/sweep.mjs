// Screening sweeper: node wtphys/sweep.mjs <factorsJson> <outFile>
// factorsJson: [["name", level], ...] cells; each cell runs smooth(0.42)+smooth(0.9-assist)+battery.
import { smooth, battery } from "./lib.mjs";
import fs from "fs";

const cells = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = process.argv[3];
for (const [name, level] of cells) {
  const spec = name === "base" ? {} : { [name]: level };
  const t0 = Date.now();
  let rec;
  try {
    const s42 = smooth(spec, 0.42);
    const s90 = smooth(spec, 0.9);
    const bat = battery(spec);
    rec = { name, level, s42, s90, bat, wall: (Date.now() - t0) / 1000 };
  } catch (e) {
    rec = { name, level, err: String(e).slice(0, 120) };
  }
  fs.appendFileSync(out, JSON.stringify(rec) + "\n");
  console.log(name, level, rec.err || (rec.s42.fell ? "s42 FELL" : "ok"), rec.wall ? rec.wall.toFixed(0) + "s" : "");
}
