// stick-abuse ensemble: 6 sorties of compound commands, the stuff players do
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech, mechCommand } from "../src/engine/mech.js";
const SORTIES = [
  // [t, travel, lateral, dh(rad/s)]
  [[0,.3,0,0],[8,.3,0,.7],[11,.3,0,0],[18,0,.22,0],[24,.25,0,-.7],[27,.25,0,0],[34,0,0,0]],          // the known killer
  [[0,.3,0,0],[6,.3,0,-.7],[9,0,0,0],[12,.3,0,.7],[16,.3,0,0],[24,0,0,0]],                            // turn, full stop, turn back
  [[0,.2,.2,0],[6,.2,-.2,0],[12,.3,0,.7],[15,-.15,0,0],[20,.3,0,0],[28,0,0,0]],                       // diagonal weave + reverse gear
  [[0,.35,0,0],[10,.35,0,-.7],[14,.35,0,.7],[18,.35,0,0],[30,0,0,0]],                                 // S-curve at speed
  [[0,.1,0,0],[4,.3,0,0],[8,.1,0,.7],[12,.3,0,0],[16,0,.22,-.7],[20,.3,0,0],[28,0,0,0]],              // speed churn + turning strafe
  [[0,.3,0,.35],[12,.3,0,-.35],[24,.3,0,0],[32,0,0,0]],                                               // long gentle S
];
let pass = 0;
for (let si = 0; si < SORTIES.length; si++) {
  const f = makeField(64, 1.7, 5); f.h.fill(0);
  const w = makeWorld({ field: f, seed: 5 });
  const mech = buildMech(w, { x: 0, z: -20 });
  for (let i = 0; i < 300 + si * 11; i++) { w.events.length = 0; stepWorld(w); }
  const sc = SORTIES[si];
  let heading = 0, k = 0, fellAt = 0;
  for (let i = 0; i < 4560; i++) {
    const t = i / 120;
    if (k + 1 < sc.length && t >= sc[k + 1][0]) k++;
    heading += sc[k][3] / 120;
    { // steering lock, as the game applies it: command leads actual yaw by <= 0.5 rad
      const yawNow = Math.atan2(mech.hull.R[6], mech.hull.R[8]);
      let lead = heading - yawNow;
      while (lead > Math.PI) lead -= 2 * Math.PI;
      while (lead < -Math.PI) lead += 2 * Math.PI;
      heading = yawNow + Math.max(-0.5, Math.min(0.5, lead));
    }
    mechCommand(mech, { travel: sc[k][1], lateral: sc[k][2], heading });
    w.events.length = 0; stepWorld(w);
    if (mech.state.mode === "FALLEN") { fellAt = t; break; }
  }
  const okRun = !fellAt;
  if (okRun) pass++;
  console.log(`sortie${si} ${okRun ? "OK" : "FELL@" + fellAt.toFixed(1)} steps ${mech.telem.steps} pos ${mech.hull.pos.x.toFixed(1)},${(mech.hull.pos.z + 20).toFixed(1)}`);
}
console.log(pass + "/6 sorties clean");
