// diag-squadlag.mjs — THROWAWAY diagnostic (do not commit, not in package.json).
// Reproduces the "green square outruns the troops" symptom headlessly:
// squad anchor is a virtual point marching dest-ward; members seek formation
// slots via local steering. Measures centroid lag, wedging, arrival deltas.
import { makeWorld, addBody, stepWorld } from "../src/engine/core.js";
import { makeSquad, stepSquad, THREAT_RADIUS } from "../src/depot/squads.js";
import { spawnSquadMembers } from "../src/depot/state.js";

const DT = 1 / 120;

function makeFixture(name, { rocks = false, threat = false }) {
  const world = makeWorld({ seed: 1 });
  const squad = makeSquad(1, "rifles", 1, 0, 0);
  spawnSquadMembers(world, squad);
  squad.order = "attack";
  squad.dest = { x: 0, z: 35 };
  squad._legTarget = null; squad._pauseT = 0;
  if (rocks) {
    // masonry cluster straddling the direct route at z=17
    for (const [x, z] of [[-2.5, 17], [-0.9, 17], [0.9, 17], [2.5, 17], [-1.7, 18.4], [1.7, 18.4]]) {
      addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.9, hy: 0.8, hz: 0.9,
        x, y: world.field.heightAt(x, z) + 0.8, z, hp: 1e9 });
    }
  }
  if (threat) {
    // live enemy inside THREAT_RADIUS of the route, passive (no combat stepped)
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
      x: 15, y: world.field.heightAt(15, 20) + 0.74, z: 20, hp: 58 });
  }
  return { name, world, squad };
}

function uprightMember(u, dt) { // copy of DepotGame.jsx:521 (keeps men on their feet)
  const supported = u.grounded || Math.abs(u.v.y) < 0.6;
  if (!supported || u.R[4] <= -0.5) return;
  if (u.R[4] < 0.995) {
    const yaw2 = Math.atan2(u.R[6], u.R[8]) * 0.5;
    const ty = Math.sin(yaw2), tw = Math.cos(yaw2);
    const a = Math.min(1, 14 * dt);
    const sgn = u.q.y * ty + u.q.w * tw < 0 ? -1 : 1;
    u.q.x += (0 - u.q.x) * a; u.q.y += (ty * sgn - u.q.y) * a;
    u.q.z += (0 - u.q.z) * a; u.q.w += (tw * sgn - u.q.w) * a;
    const L2 = Math.hypot(u.q.x, u.q.y, u.q.z, u.q.w) || 1;
    u.q.x /= L2; u.q.y /= L2; u.q.z /= L2; u.q.w /= L2;
  }
}

function run(fix, maxT = 120) {
  const { world, squad } = fix;
  const stats = { lagSum: 0, lagMax: 0, n: 0, anchorArriveT: null, centroidArriveT: null,
    lastManArriveT: null, defendFlipT: null, wedges: [], samples: [] };
  const wedgeTrack = new Map(); // id -> {since}
  const members = () => squad.memberIds.map((id) => world.byId.get(id)).filter((u) => u && u.alive);
  const steps = Math.round(maxT / DT);
  for (let i = 0; i < steps; i++) {
    const preOrder = squad.order;
    stepSquad(world, squad, DT);
    for (const u of members()) uprightMember(u, DT);
    stepWorld(world);
    const ms = members();
    if (!ms.length) { stats.allDead = true; break; }
    let cx = 0, cz = 0;
    for (const u of ms) { cx += u.pos.x; cz += u.pos.z; }
    cx /= ms.length; cz /= ms.length;
    const dest = squad.dest || { x: 0, z: 35 };
    const anchorD = Math.hypot(dest.x - squad.anchor.x, dest.z - squad.anchor.z);
    let lagMax = 0;
    for (const u of ms) {
      const d = Math.hypot(u.pos.x - squad.anchor.x, u.pos.z - squad.anchor.z);
      if (d > lagMax) lagMax = d;
      // wedge: near-zero speed while goal >0.25m away
      const gd = u.goal ? Math.hypot(u.goal.x - u.pos.x, u.goal.z - u.pos.z) : 0;
      const sp = Math.hypot(u.v.x, u.v.z);
      if (gd > 0.25 && sp < 0.05) {
        if (!wedgeTrack.has(u.id)) wedgeTrack.set(u.id, world.t);
      } else if (wedgeTrack.has(u.id)) {
        const dur = world.t - wedgeTrack.get(u.id);
        if (dur > 1.0) stats.wedges.push({ id: u.id, t0: +wedgeTrack.get(u.id).toFixed(1), dur: +dur.toFixed(1), at: [+u.pos.x.toFixed(1), +u.pos.z.toFixed(1)] });
        wedgeTrack.delete(u.id);
      }
    }
    const centroidLag = Math.hypot(cx - squad.anchor.x, cz - squad.anchor.z);
    stats.lagSum += centroidLag; stats.n++;
    if (centroidLag > stats.lagMax) stats.lagMax = centroidLag;
    if (preOrder === "attack" && squad.order === "defend" && stats.defendFlipT == null) stats.defendFlipT = world.t;
    if (stats.anchorArriveT == null && anchorD <= 1.0) stats.anchorArriveT = world.t;
    if (stats.centroidArriveT == null && Math.hypot(dest.x - cx, dest.z - cz) <= 3.0) stats.centroidArriveT = world.t;
    const worst = Math.max(...ms.map((u) => Math.hypot(dest.x - u.pos.x, dest.z - u.pos.z)));
    if (stats.lastManArriveT == null && worst <= 4.0) stats.lastManArriveT = world.t;
    if (i % 240 === 0 || (stats.anchorArriveT != null && stats.lastManArriveT == null && i % 60 === 0 && stats.samples.length < 200)) {
      stats.samples.push({ t: +world.t.toFixed(1), anchor: [+squad.anchor.x.toFixed(1), +squad.anchor.z.toFixed(1)],
        centroid: [+cx.toFixed(1), +cz.toFixed(1)], lag: +centroidLag.toFixed(2), maxMemberDist: +lagMax.toFixed(2),
        order: squad.order, pauseT: +(squad._pauseT || 0).toFixed(2),
        leg: squad._legTarget ? [+squad._legTarget.x.toFixed(1), +squad._legTarget.z.toFixed(1)] : null });
    }
    if (stats.lastManArriveT != null && world.t > stats.lastManArriveT + 2) break;
  }
  // flush still-open wedges
  for (const [id, t0] of wedgeTrack) {
    const dur = world.t - t0;
    if (dur > 1.0) { const u = world.byId.get(id); stats.wedges.push({ id, t0: +t0.toFixed(1), dur: +dur.toFixed(1), at: u ? [+u.pos.x.toFixed(1), +u.pos.z.toFixed(1)] : null, unresolved: true }); }
  }
  // end-state dump + displacement-based stuck check (fan oscillation keeps
  // |v| > 0.05 while position barely moves, so the velocity wedge test misses it)
  stats.final = members().map((u) => ({ id: u.id, pos: [+u.pos.x.toFixed(2), +u.pos.z.toFixed(2)],
    goal: u.goal ? [+u.goal.x.toFixed(2), +u.goal.z.toFixed(2)] : null,
    goalDist: u.goal ? +Math.hypot(u.goal.x - u.pos.x, u.goal.z - u.pos.z).toFixed(2) : 0,
    speed: +Math.hypot(u.v.x, u.v.z).toFixed(2), sleeping: !!u.sleeping, alive: u.alive, hp: u.hp }));
  return stats;
}

const fixtures = [
  makeFixture("A open+unthreatened", {}),
  makeFixture("B rocks+unthreatened", { rocks: true }),
  makeFixture("C open+threatened", { threat: true }),
  makeFixture("D rocks+threatened", { rocks: true, threat: true }),
];

for (const fix of fixtures) {
  const s = run(fix);
  console.log(`\n=== ${fix.name} ===`);
  console.log(`centroid lag mean=${(s.lagSum / s.n).toFixed(2)}m max=${s.lagMax.toFixed(2)}m`);
  console.log(`anchor arrive t=${s.anchorArriveT?.toFixed(1) ?? "never"}  defend flip t=${s.defendFlipT?.toFixed(1) ?? "never"}  centroid<=3m t=${s.centroidArriveT?.toFixed(1) ?? "never"}  last man<=4m t=${s.lastManArriveT?.toFixed(1) ?? "never"}`);
  if (s.anchorArriveT != null && s.lastManArriveT != null)
    console.log(`last man trails anchor by ${(s.lastManArriveT - s.anchorArriveT).toFixed(1)}s`);
  console.log(`wedges (>1s stalled): ${s.wedges.length ? JSON.stringify(s.wedges) : "none"}`);
  console.log("final members: " + JSON.stringify(s.final));
  for (const row of s.samples.slice(0, 20)) console.log("  " + JSON.stringify(row));
}
