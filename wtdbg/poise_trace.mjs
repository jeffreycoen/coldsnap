import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechPoise } from "../src/engine/mech.js";
const f = makeField(64, 1.7, 5); f.h.fill(0);
const w = makeWorld({ field: f, seed: 5 });
const mech = buildMech(w, { x: 0, z: -20 });
for (let i = 0; i < 700; i++) { w.events.length = 0; stepWorld(w); }
mechPoise(w, mech, "L");
const st = mech.state, L = mech.legs.L, R = mech.legs.R;
const com = () => {
  let m = 0, cx = 0, cy = 0, cz = 0, vx = 0, vz = 0;
  for (const b of mech.links) { m += b.mass; cx += b.mass * b.pos.x; cy += b.mass * b.pos.y; cz += b.mass * b.pos.z; vx += b.mass * b.v.x; vz += b.mass * b.v.z; }
  cx /= m; cy /= m; cz /= m; vx /= m; vz /= m;
  const om = Math.sqrt(9.81 / Math.max(0.5, cy - 1.0));
  return { x: cx + vx / om, z: cz + vz / om };
};
for (let i = 0; i < 700; i++) {
  w.events.length = 0; stepWorld(w);
  const po = st.poise;
  if (i % 6 === 0) {
    const sp = st.prints[po && po.raise === "L" ? "R" : "L"];
    const xi = com();
    console.log((i / 120).toFixed(2), po ? po.phase : "-",
      "exiL", (xi.x - sp.x).toFixed(2), "exiF", (xi.z - sp.z).toFixed(2),
      "pel", st.pelvis.x.toFixed(2),
      "ftL", L.foot.pos.x.toFixed(2) + "," + L.foot.pos.y.toFixed(2) + "," + L.foot.pos.z.toFixed(2),
      "ftR", R.foot.pos.x.toFixed(2) + "," + R.foot.pos.y.toFixed(2) + "," + R.foot.pos.z.toFixed(2),
      "spx", (st.prints[po && po.raise === "L" ? "R" : "L"]).x.toFixed(2),
      "fR4", R.foot.R[4].toFixed(2), "hullx", mech.hull.pos.x.toFixed(2),
      "gT", po && po.gTgt ? po.gTgt.x.toFixed(2) + "," + po.gTgt.y.toFixed(2) : "-",
      "R4", mech.hull.R[4].toFixed(3), "hy", mech.hull.pos.y.toFixed(2),
      "lds", (L.load / 1000).toFixed(0) + "/" + (R.load / 1000).toFixed(0),
      "cX", (st.crouchX || 0).toFixed(2));
  }
  if (st.mode === "FALLEN") { console.log("FELL", (i / 120).toFixed(2)); break; }
}
