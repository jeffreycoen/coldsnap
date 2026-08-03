// C: heading ladder ENSEMBLE — 8 headings x 3 settle offsets, march 28s + stop, must end STAND
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
const HS = [0, 0.79, 1.57, 2.36, Math.PI, -2.36, -1.57, -0.79];
const OFFS = [0, 0.6, 1.2];
let clean = 0, total = 0;
for (const h of HS) {
  let row = "";
  for (const off of OFFS) {
    total++;
    const field = core.makeField(64, 1.7, 5); field.h.fill(0);
    const world = core.makeWorld({ field, seed: 5 });
    const mech = m.buildMech(world, { x: 0, z: 0, yaw: h });
    mech.thrustersOn = true; mech.thrustAssist = true;
    for (let i = 0; i < Math.round((2.5 + off) / world.dt); i++) { world.events.length = 0; core.stepWorld(world); }
    let fell = -1;
    const x0 = mech.hull.pos.x, z0 = mech.hull.pos.z;
    for (let i = 0; i < Math.round(38 / world.dt); i++) {
      const t = i * world.dt;
      m.mechCommand(mech, { travel: t > 28 ? 0 : 0.42, lateral: 0, heading: h });
      world.events.length = 0; core.stepWorld(world);
      if (mech.state.mode === "FALLEN") { fell = i * world.dt; break; }
    }
    const dist = Math.hypot(mech.hull.pos.x - x0, mech.hull.pos.z - z0);
    const ok = fell < 0 && dist > 6 && mech.state.mode === "STAND";
    if (ok) clean++;
    row += ok ? " ok" : (fell < 0 ? " " + mech.state.mode.slice(0, 4) : " F" + fell.toFixed(0));
  }
  console.log(h.toFixed(2).padStart(5), row);
}
console.log("ENSEMBLE:", clean + "/" + total);
