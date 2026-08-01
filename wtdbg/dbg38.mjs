import { makeWorld, makeField, stepWorld, addBody } from "../src/engine/core.js";
import { buildMech, mechCommand, mechPunt } from "../src/engine/mech.js";
const CASES = [
  { tx: 0, tz: -17.4, walk: false }, { tx: 0.6, tz: -17.4, walk: false },
  { tx: 0, tz: -13, walk: true }, { tx: 30, tz: 0, walk: false },
];
const runCase = (c, tune) => {
  const f = makeField(64, 1.7, 5); f.h.fill(0);
  const w = makeWorld({ field: f, seed: 5 });
  const mech = buildMech(w, { x: 0, z: -20 });
  Object.assign(mech.tune, tune);
  const s1 = addBody(w, { kind: "vehicle", team: 2, group: "tgt", mass: 950, hx: 1.25, hy: 0.7, hz: 1.85, x: c.tx, y: 1.7, z: c.tz, hp: 55, friction: 0.7 });
  for (let i = 0; i < 700; i++) { w.events.length = 0; stepWorld(w); }
  if (c.walk) mechCommand(mech, { travel: 0.3 });
  let punted = false, maxV = 0;
  for (let i = 0; i < 2400; i++) {
    w.events.length = 0;
    if (!punted && (!c.walk || mech.hull.pos.z > c.tz - 3.6)) { mechPunt(w, mech); punted = true; if (c.walk) mechCommand(mech, { travel: 0 }); }
    stepWorld(w);
    maxV = Math.max(maxV, Math.hypot(s1.v.x, s1.v.z));
    if (mech.state.mode === "FALLEN") return { ok: false, v: maxV };
  }
  return { ok: true, v: maxV };
};
const grid = [];
for (const kickLean of [0.3, 0.5]) for (const kickReach of [1.2, 1.5]) grid.push({ kickLean, kickDur: 1.15, kickReach, kickH: 0.9 });
for (const g of grid) {
  const rs = CASES.map((c) => runCase(c, g));
  const ok = rs.filter(r => r.ok).length;
  console.log(JSON.stringify(g), "clean", ok + "/4", "v", rs.map(r => (r.ok ? "" : "F") + r.v.toFixed(1)).join(","));
}
