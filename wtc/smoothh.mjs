// C: heading-aware smoothness composite at 0.42 cruise, 4 headings
const W = "/home/batman/coldsnap/.claude/worktrees/agent-a1424cc8f0b996a51";
const core = await import(W + "/src/engine/core.js");
const m = await import(W + "/src/engine/mech.js");
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const rows = [];
for (const h of [0, 1.57, 2.36, Math.PI]) {
  const field = core.makeField(64, 1.7, 5); field.h.fill(0);
  const world = core.makeWorld({ field, seed: 5 });
  const mech = m.buildMech(world, { x: 0, z: 0, yaw: h });
  mech.thrustersOn = true; mech.thrustAssist = true;
  for (let i = 0; i < 240; i++) { world.events.length = 0; core.stepWorld(world); }
  const fw = { x: Math.sin(h), z: Math.cos(h) }, lf = { x: Math.cos(h), z: -Math.sin(h) };
  let vy0 = 0; const ay = [], vlat = [], r4d = [], vf = [];
  let fell = false;
  for (let i = 0; i < Math.round(30 / world.dt); i++) {
    m.mechCommand(mech, { travel: 0.42, lateral: 0, heading: h });
    world.events.length = 0; core.stepWorld(world);
    if (mech.state.mode === "FALLEN") { fell = true; break; }
    const t = i * world.dt;
    if (t >= 12 && t <= 28) {
      ay.push((mech.hull.v.y - vy0) / world.dt);
      vlat.push(Math.abs(mech.hull.v.x * lf.x + mech.hull.v.z * lf.z));
      r4d.push(1 - mech.hull.R[4]);
      vf.push(mech.hull.v.x * fw.x + mech.hull.v.z * fw.z);
    }
    vy0 = mech.hull.v.y;
  }
  if (fell) { console.log(h.toFixed(2), "FELL"); continue; }
  const mVf = mean(vf);
  const row = { h: h.toFixed(2), ayRms: +rms(ay).toFixed(2), latRms: +rms(vlat).toFixed(2), r4Rip: +(mean(r4d) * 1000).toFixed(1), vfRip: +(Math.sqrt(mean(vf.map(v => (v - mVf) ** 2))) / mVf).toFixed(2), v: +mVf.toFixed(2) };
  rows.push(row);
  console.log(JSON.stringify(row));
}
// uniformity: worst/best ratio per component
if (rows.length > 1) {
  for (const k of ["ayRms", "latRms", "r4Rip", "vfRip"]) {
    const vs = rows.map((r) => r[k]);
    console.log(k, "spread", (Math.max(...vs) / Math.max(1e-6, Math.min(...vs))).toFixed(2) + "x");
  }
}
