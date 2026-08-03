// C: assisted overdrive 6-offset ensemble (raw 0.9, stop at 42s, 60s cap)
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
let clean = 0; const det = [];
for (const off of [0, 0.4, 0.8, 1.2, 1.6, 2.0]) {
  const field = core.makeField(64, 1.7, 5); field.h.fill(0);
  const world = core.makeWorld({ field, seed: 5 });
  const mech = m.buildMech(world, { x: 0, z: 0 });
  mech.thrustersOn = true; mech.thrustAssist = true;
  for (let i = 0; i < Math.round((2 + off) / world.dt); i++) { world.events.length = 0; core.stepWorld(world); }
  let fell = -1, z30 = 0, z40 = 0;
  for (let i = 0; i < Math.round(60 / world.dt); i++) {
    const t = i * world.dt;
    m.mechCommand(mech, { travel: t > 42 ? 0 : 0.9, lateral: 0, heading: 0 });
    world.events.length = 0; core.stepWorld(world);
    if (t >= 30 && z30 === 0) z30 = mech.hull.pos.z;
    if (t >= 40 && z40 === 0) z40 = mech.hull.pos.z;
    if (mech.state.mode === "FALLEN") { fell = t; break; }
  }
  if (fell < 0 && mech.state.mode === "STAND") clean++;
  else det.push("off" + off + "@" + (fell < 0 ? mech.state.mode : fell.toFixed(0)));
  if (off === 0) det.push("cruise " + ((z40 - z30) / 10).toFixed(2));
}
console.log("ASSIST:", clean + "/6", det.join(" "));
