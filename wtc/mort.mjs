// C: bare-machine shove mortality ladder
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
for (const imp of [128000, 160000, 200000, 256000, 320000]) {
  const field = core.makeField(64, 1.7, 5); field.h.fill(0);
  const world = core.makeWorld({ field, seed: 5 });
  const mech = m.buildMech(world, { x: 0, z: 0 });
  for (let i = 0; i < 600; i++) { world.events.length = 0; core.stepWorld(world); }
  mech.hull.v.x += imp / mech.hull.mass;
  let fell = false;
  for (let i = 0; i < Math.round(14 / world.dt); i++) { world.events.length = 0; core.stepWorld(world); if (mech.state.mode === "FALLEN") { fell = true; break; } }
  console.log(imp / 1000 + "k:", fell ? "FELL" : "survived");
}
