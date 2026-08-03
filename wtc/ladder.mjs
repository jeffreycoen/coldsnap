// C: 8-heading cold-launch march ladder (spawn yaw = heading, 0.42, 28s)
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
const HS = [0, 0.79, 1.57, 2.36, Math.PI, -2.36, -1.57, -0.79];
let clean = 0;
for (const h of HS) {
  const field = core.makeField(64, 1.7, 5); field.h.fill(0);
  const world = core.makeWorld({ field, seed: 5 });
  const mech = m.buildMech(world, { x: 0, z: 0, yaw: h });
  mech.thrustersOn = true; mech.thrustAssist = true;
  for (let i = 0; i < 300; i++) { world.events.length = 0; core.stepWorld(world); }
  let fell = -1, dist = 0;
  const x0 = mech.hull.pos.x, z0 = mech.hull.pos.z;
  for (let i = 0; i < Math.round(28 / world.dt); i++) {
    m.mechCommand(mech, { travel: 0.42, lateral: 0, heading: h });
    world.events.length = 0; core.stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = i * world.dt; break; }
  }
  dist = Math.hypot(mech.hull.pos.x - x0, mech.hull.pos.z - z0);
  const ok = fell < 0 && dist > 6;
  if (ok) clean++;
  console.log(h.toFixed(2).padStart(5), ok ? "ok    " : "FAIL  ", fell < 0 ? "" : "fell@" + fell.toFixed(1), "dist " + dist.toFixed(1));
}
console.log("LADDER:", clean + "/8");
