// C: trace the off0.4 late death (release at 42, dies ~57)
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
const field = core.makeField(64, 1.7, 5); field.h.fill(0);
const world = core.makeWorld({ field, seed: 5 });
const mech = m.buildMech(world, { x: 0, z: 0 });
mech.thrustersOn = true; mech.thrustAssist = true;
for (let i = 0; i < Math.round(2.4 / world.dt); i++) { world.events.length = 0; core.stepWorld(world); }
for (let i = 0; i < Math.round(60 / world.dt); i++) {
  const t = i * world.dt;
  m.mechCommand(mech, { travel: t > 42 ? 0 : 0.9, lateral: 0, heading: 0 });
  world.events.length = 0; core.stepWorld(world);
  const st = mech.state;
  if (t > 42 && i % 48 === 0) {
    const v = Math.hypot(mech.hull.v.x, mech.hull.v.z);
    console.log(t.toFixed(1), st.mode, "v", v.toFixed(2), "stop", !!st.stopping, "rec", (st.recoverT || 0).toFixed(1), "arr", (st._arrestT || 0).toFixed(1), "govD", !!st.govDecel, "R4", mech.hull.R[4].toFixed(3));
  }
  if (st.mode === "FALLEN") { console.log("FELL", t.toFixed(1)); break; }
}
