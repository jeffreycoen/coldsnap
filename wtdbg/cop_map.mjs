// Micro-experiment: FF torque -> realized CoP mapping on the R ankle roll.
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildMech } from "../src/engine/mech.js";
for (const test of [0, 15000, -15000]) {
  const f = makeField(64, 1.7, 5); f.h.fill(0);
  const w = makeWorld({ field: f, seed: 5 });
  const mech = buildMech(w, { x: 0, z: -20 });
  const R = mech.legs.R;
  mech._testFF = test; // consumed below via monkey patch? no — inject directly each tick after controller
  for (let i = 0; i < 700; i++) { w.events.length = 0; stepWorld(w); }
  // steady state with injected FF: override tauFF post-controller via a wrapper on stepWorld ticks
  let cop = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    w.events.length = 0;
    // pre-step: the controller sets tauFF inside stepWorld's mechStep hook...
    // easiest reliable injection: bias the ankle roll TARGET instead? No — we
    // need torque->CoP. Patch: run stepWorld, THEN add impulse-equivalent next
    // tick by setting tauFF AFTER controller would overwrite... Actually the
    // controller runs inside stepWorld; overwrite before solve is not
    // reachable from here. Use mech.tune-free approach: temporarily raise
    // kCop and set a fake copCmd? Simplest true injection: monkey-patch the
    // joint object with a getter that adds the bias when the solver reads it.
    if (i === 0 && test !== 0) {
      let base = R.ankleRoll.tauFF;
      Object.defineProperty(R.ankleRoll, "tauFF", {
        get() { return (this._ff || 0) + test; },
        set(v) { this._ff = v; },
        configurable: true,
      });
      R.ankleRoll.tauFF = base;
    }
    stepWorld(w);
    if (i > 300) {
      let pn = 0, cx = 0;
      for (const c of w.contacts) {
        if ((c.a === R.foot || c.b === R.foot) && c.pn > 0) { pn += c.pn; cx += c.p.x * c.pn; }
      }
      if (pn > 1e-6) { cop += cx / pn; n++; }
    }
  }
  console.log("testFF", (test / 1000).toFixed(0) + "k", "-> mean CoP x on R foot:", (cop / Math.max(1, n)).toFixed(3), "(ankle at", mech.legs.R.foot.pos.x.toFixed(3) + ", +x = inboard)");
}
