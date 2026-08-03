// Q: when did yaw-pi walking break?
import { execSync } from "child_process";
const W = "/home/batman/coldsnap/.claude/worktrees/agent-af89fd14ae00c809e";
const core = await import(W + "/src/engine/core.js");
const shas = ["ee2e57c", "0932a36", "6930a95", "1906d59", "548f535", "c14e51e", "a2b310d"];
for (const sha of shas) {
  execSync(`git -C ${W} show ${sha}:src/engine/mech.js > ${W}/src/engine/mech-yb-tmp.mjs`);
  const m = await import(W + "/src/engine/mech-yb-tmp.mjs?v=" + sha);
  const field = core.makeField(64, 1.7, 5); field.h.fill(0);
  const world = core.makeWorld({ field, seed: 5 });
  const mech = m.buildMech(world, { x: 0, z: 0, yaw: Math.PI });
  if (mech.thrustersOn !== undefined) { mech.thrustersOn = true; mech.thrustAssist = true; }
  for (let i = 0; i < 300; i++) { world.events.length = 0; core.stepWorld(world); }
  let fell = -1;
  for (let i = 0; i < Math.round(25 / world.dt); i++) {
    m.mechCommand(mech, { travel: 0.42, lateral: 0, heading: Math.PI });
    world.events.length = 0; core.stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = i * world.dt; break; }
  }
  console.log(sha, fell < 0 ? "ok 25s" : "FELL at " + fell.toFixed(1) + "s");
}
execSync(`rm ${W}/src/engine/mech-yb-tmp.mjs`);
