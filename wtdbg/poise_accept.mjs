// Acceptance: raise >=0.7m, hold 20s R4>=0.95, lower, quiet stand; both sides; 3 cycles; shove test.
import { makeWorld, makeField, stepWorld, explode } from "../src/engine/core.js";
import { buildMech, mechPoise } from "../src/engine/mech.js";
const mk = () => {
  const f = makeField(64, 1.7, 5); f.h.fill(0);
  const w = makeWorld({ field: f, seed: 5 });
  const mech = buildMech(w, { x: 0, z: -20 });
  for (let i = 0; i < 700; i++) { w.events.length = 0; stepWorld(w); }
  return { w, mech };
};
const step = (w, n, mech) => {
  for (let i = 0; i < n; i++) {
    w.events.length = 0; stepWorld(w);
    if (mech.state.mode === "FALLEN") return false;
  }
  return true;
};
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS" : "FAIL") + " — " + name, detail); ok ? pass++ : fail++; };

for (const side of ["L", "R"]) {
  const { w, mech } = mk();
  const leg = mech.legs[side];
  let allOk = true, det = "";
  for (let cyc = 0; cyc < 3 && allOk; cyc++) {
    mechPoise(w, mech, side);
    let held = 0, minR4 = 1, maxFt = 0, t = 0;
    for (let i = 0; i < 120 * 40; i++) {
      w.events.length = 0; stepWorld(w); t = i / 120;
      const po = mech.state.poise;
      if (mech.state.mode === "FALLEN") { allOk = false; det = `cyc${cyc} FELL t=${t.toFixed(1)} during ${po ? po.phase : "?"}`; break; }
      if (po && po.phase === "hold") {
        held += 1 / 120;
        minR4 = Math.min(minR4, mech.hull.R[4]);
        maxFt = Math.max(maxFt, leg.foot.pos.y - 1.0);
        if (held >= 20) break;
      }
      if (!po && i > 120 * 12) { allOk = false; det = `cyc${cyc} poise self-ended t=${t.toFixed(1)} held=${held.toFixed(1)}`; break; }
    }
    if (!allOk) break;
    if (held < 20 || minR4 < 0.95 || maxFt < 0.7) { allOk = false; det = `cyc${cyc} held=${held.toFixed(1)} minR4=${minR4.toFixed(3)} maxFt=${maxFt.toFixed(2)}`; break; }
    mechPoise(w, mech, side);
    let down = false;
    for (let i = 0; i < 120 * 10; i++) {
      w.events.length = 0; stepWorld(w);
      if (mech.state.mode === "FALLEN") { allOk = false; det = `cyc${cyc} FELL during lower`; break; }
      if (!mech.state.poise) { down = true; break; }
    }
    if (!allOk) break;
    if (!down) { allOk = false; det = `cyc${cyc} never lowered`; break; }
    if (!step(w, 360, mech)) { allOk = false; det = `cyc${cyc} fell after lower`; break; }
    if (mech.hull.R[4] < 0.97) { allOk = false; det = `cyc${cyc} not upright after lower R4=${mech.hull.R[4].toFixed(3)}`; break; }
  }
  check(`side ${side}: 3 cycles raise>=0.7 hold20s R4>=0.95 lower`, allOk, det);
}

{
  const { w, mech } = mk();
  mechPoise(w, mech, "L");
  let inHold = false;
  for (let i = 0; i < 120 * 15; i++) {
    w.events.length = 0; stepWorld(w);
    const po = mech.state.poise;
    if (po && po.phase === "hold" && po.tgt && po.tgt.y >= 1.7) { inHold = true; break; }
    if (mech.state.mode === "FALLEN") break;
  }
  if (!inHold) check("shove: reached hold", false);
  else {
    explode(w, 6, 1.2, -20, { r: 3.0, kv: 8, dmg: 0, crater: 0, attacker: "test" });
    let fell = false;
    for (let i = 0; i < 120 * 8; i++) { w.events.length = 0; stepWorld(w); if (mech.state.mode === "FALLEN") { fell = true; break; } }
    check("shove kv8 at 6m during hold: no faceplant (foot-down ok)", !fell, "up=" + mech.hull.R[4].toFixed(2));
  }
}
console.log(fail === 0 ? "POISE ACCEPT: ALL PASS" : `POISE ACCEPT: ${fail} FAIL`);
