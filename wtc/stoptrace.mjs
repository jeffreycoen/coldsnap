// C: trace the 2.36/off0 stuck stop
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
const h = 2.36;
const field = core.makeField(64, 1.7, 5); field.h.fill(0);
const world = core.makeWorld({ field, seed: 5 });
const mech = m.buildMech(world, { x: 0, z: 0, yaw: h });
mech.thrustersOn = true; mech.thrustAssist = true;
for (let i = 0; i < Math.round(2.5 / world.dt); i++) { world.events.length = 0; core.stepWorld(world); }
for (let i = 0; i < Math.round(44 / world.dt); i++) {
  const t = i * world.dt;
  m.mechCommand(mech, { travel: t > 28 ? 0 : 0.42, lateral: 0, heading: h });
  world.events.length = 0; core.stepWorld(world);
  const st = mech.state;
  if (t > 27.5 && i % 60 === 0) {
    const v = Math.hypot(mech.hull.v.x, mech.hull.v.z);
    console.log(t.toFixed(1), st.mode, "v", v.toFixed(2), "stopping", !!st.stopping, "rec", (st.recoverT || 0).toFixed(1), "arrest", (st._arrestT || 0).toFixed(1), "R4", mech.hull.R[4].toFixed(3), "cad", (st.cadence || 1).toFixed(2));
  }
  if (st.mode === "FALLEN") { console.log("FELL", t.toFixed(1)); break; }
}
