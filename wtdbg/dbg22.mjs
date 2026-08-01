import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const out = [];
for (let v = 0; v < 8; v++) {
  const field = makeField(64, 1.7, 5); field.h.fill(0);
  const w = makeWorld({ field, seed: 5 });
  const mech = buildMech(w, { x: (v % 3 - 1) * 0.15, z: -20 });
  const settle = 700 + v * 17;
  for (let i = 0; i < settle; i++) { w.events.length = 0; stepWorld(w); }
  mechCommand(mech, { travel: 0.18 + 0.025 * v });
  let t = 0;
  for (let i = 0; i < 4800; i++) {
    w.events.length = 0; stepWorld(w); t = i / 120;
    if (mech.state.mode === "FALLEN") break;
  }
  const fell = mech.state.mode === "FALLEN";
  out.push({ v, travel: (0.18 + 0.025 * v).toFixed(2), fell, t: t.toFixed(1), steps: mech.telem.steps, dist: (mech.hull.pos.z + 20).toFixed(1), x: mech.hull.pos.x.toFixed(1) });
  console.log(`v${v} travel ${out[v].travel} ${fell ? "FELL@" + out[v].t : "SURVIVED " + out[v].t} steps ${out[v].steps} dist ${out[v].dist} xdrift ${out[v].x}`);
}
const st = out.map(o => o.steps).sort((a, b) => a - b);
const dd = out.map(o => +o.dist).sort((a, b) => a - b);
console.log("median steps", st[4], "median dist", dd[4], "survived", out.filter(o => !o.fell).length + "/8");
