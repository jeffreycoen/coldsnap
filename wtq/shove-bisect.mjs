// Q item 3: bisect the shove envelope regression (56k saved at rocket-era, 48k now).
import { execSync } from "child_process";
const W = "/home/batman/coldsnap/.claude/worktrees/agent-af89fd14ae00c809e";
const core = await import(W + "/src/engine/core.js");
const shas = ["6930a95", "1906d59", "44aeb3a", "548f535", "c14e51e", "a2b310d"];
for (const sha of shas) {
  execSync(`git -C ${W} show ${sha}:src/engine/mech.js > ${W}/src/engine/mech-bisect-tmp.mjs`);
  const m = await import(W + "/src/engine/mech-bisect-tmp.mjs?v=" + sha);
  const row = [];
  for (const imp of [44000, 48000, 52000, 56000]) {
    const field = core.makeField(64, 1.7, 5); field.h.fill(0);
    const world = core.makeWorld({ field, seed: 5 });
    const mech = m.buildMech(world, { x: 0, z: 0 });
    mech.thrustersOn = true;
    for (let i = 0; i < 600; i++) { world.events.length = 0; core.stepWorld(world); }
    mech.hull.v.x += imp / mech.hull.mass;
    let fell = false;
    for (let i = 0; i < 1440; i++) { world.events.length = 0; core.stepWorld(world); if (mech.state.mode === "FALLEN") { fell = true; break; } }
    row.push((imp / 1000) + "k:" + (fell ? "FELL" : "ok"));
  }
  console.log(sha, row.join(" "));
}
execSync(`rm ${W}/src/engine/mech-bisect-tmp.mjs`);
