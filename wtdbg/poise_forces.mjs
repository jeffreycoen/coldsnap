import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechPoise } from "../src/engine/mech.js";
const f = makeField(64, 1.7, 5); f.h.fill(0);
const w = makeWorld({ field: f, seed: 5 });
const mech = buildMech(w, { x: 0, z: -20 });
for (let i = 0; i < 700; i++) { w.events.length = 0; stepWorld(w); }
mechPoise(w, mech, "L");
const st = mech.state, R = mech.legs.R;
for (let i = 0; i < 800; i++) {
  w.events.length = 0; stepWorld(w);
  const po = st.poise;
  if (po && i % 12 === 0) {
    // realized CoP on the stance (R) foot from live contacts
    let pn = 0, cx = 0;
    for (const c of w.contacts) {
      const bb = c.a === R.foot || c.b === R.foot ? c : null;
      if (bb && c.pn > 0) { pn += c.pn; cx += c.p.x * c.pn; }
    }
    const cop = pn > 1e-6 ? cx / pn : NaN;
    const ar = R.ankleRoll;
    console.log((i / 120).toFixed(2), po.phase,
      "hullx", mech.hull.pos.x.toFixed(3), "hvx", mech.hull.v.x.toFixed(3),
      "copX", isNaN(cop) ? "-" : cop.toFixed(3), "ftRx", R.foot.pos.x.toFixed(3),
      "arAng", ar.angle.toFixed(3), "arTgt", ar.target.toFixed(3),
      "arFF", (ar.tauFF / 1000).toFixed(1) + "k",
      "hipRoll", R.hipRoll.angle.toFixed(3), "/", R.hipRoll.target.toFixed(3),
      "ld", (R.load / 1000).toFixed(0) + "k",
      "ldL", (mech.legs.L.load / 1000).toFixed(0) + "k",
      "hvz", mech.hull.v.z.toFixed(2), "hullz", mech.hull.pos.z.toFixed(2), "ftRz", R.foot.pos.z.toFixed(2), "apFF", (R.anklePitch.tauFF / 1000).toFixed(0) + "k", "apA", R.anklePitch.angle.toFixed(2), "apT", R.anklePitch.target.toFixed(2), "passDx", ((mech._dbgPassDx || 0) * 50 * 120).toFixed(3) + "mm/s*", "passFx", ((mech._dbgPassFx || 0) * 50 * 120).toFixed(3));
  }
  if (st.mode === "FALLEN" || (!po && i > 300)) { console.log("end", (i / 120).toFixed(2)); break; }
}
