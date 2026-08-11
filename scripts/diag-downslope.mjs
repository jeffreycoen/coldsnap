// Throwaway diagnosis: infantry can't fire downslope. Not wired into package.json.
import { makeWorld, addBody, aimSolve } from "../src/engine/core.js";
import { INFANTRY_ARMS } from "../src/depot/specs.js";
import { arcClears, solidBlocksPoint } from "../src/depot/accuracy.js";
import { effRange } from "../src/depot/state.js";

// instrumented copy of arcClears (arc branch)
function arcTrace(world, muzzle, target, spec, selfId) {
  const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
  const d = Math.hypot(dx, dz); if (d < 2) return { ok: true };
  const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
  if (pitch == null) return { ok: false, why: "aimSolve null" };
  const vh = spec.projSpeed * Math.cos(pitch), vy0 = spec.projSpeed * Math.sin(pitch);
  for (let s = 0.9; s < d - 0.9; s += 0.9) {
    const t = s / vh;
    const y = muzzle.y + vy0 * t - 4.9 * t * t;
    const x = muzzle.x + (dx / d) * s, z = muzzle.z + (dz / d) * s;
    const g = world.field.heightAt(x, z);
    if (g + 0.35 > y) return { ok: false, why: "terrain", s, y, g, need: g + 0.35, pitch };
    if (solidBlocksPoint(world, x, y, z, selfId)) return { ok: false, why: "solid", s, y, pitch };
  }
  return { ok: true, pitch };
}

// plateau at height H for x < edgeX, ramp down to 0 over rampLen meters
function setSlope(world, H, edgeX, rampLen) {
  const f = world.field;
  for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
    const x = i * f.cs - f.half;
    let h;
    if (x <= edgeX) h = H;
    else if (x >= edgeX + rampLen) h = 0;
    else h = H * (1 - (x - edgeX) / rampLen);
    f.h[f.idx(i, j)] = h;
  }
}

function scenario({ H, rampLen, dist, muzzleH, spec, label }) {
  const world = makeWorld({ seed: 1 });
  setSlope(world, H, 0, rampLen);
  // shooter on crest lip (x=0), target downslope at x=dist
  const sx = 0, tx = dist;
  const sy = world.field.heightAt(sx, 0);
  const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
    x: sx, y: sy + 0.74, z: 0, hp: 58, friction: 0.5 });
  const tg = world.field.heightAt(tx, 0);
  const target = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
    x: tx, y: tg + 0.74, z: 0, hp: 58, friction: 0.5 });
  const muzzle = { x: sx, y: shooter.pos.y + (muzzleH ?? 0.5), z: 0 };
  const eR = effRange(world, muzzle, spec);
  const d2 = (tx - sx) ** 2;
  const tr = arcTrace(world, muzzle, target.pos, spec, shooter.id);
  const same = arcClears(world, muzzle, target.pos, spec, shooter.id);
  console.log(`${label}  H=${H} ramp=${rampLen} dist=${dist} muzzle.y=${muzzle.y.toFixed(2)} tgt.y=${target.pos.y.toFixed(2)}`
    + ` effR=${eR.toFixed(2)} inRange=${d2 < eR * eR}`
    + ` arcClears=${same} trace=${JSON.stringify(tr, (k, v) => typeof v === "number" ? +v.toFixed(3) : v)}`);
  return { ok: same, tr };
}

const sniper = INFANTRY_ARMS.sniper, rifles = INFANTRY_ARMS.rifles, mg = INFANTRY_ARMS.mg;

console.log("== prime case: sniper on crest, target downslope ==");
for (const H of [2, 4, 6, 8]) for (const ramp of [4, 8, 16]) {
  scenario({ H, rampLen: ramp, dist: Math.min(24, ramp + 8), muzzleH: 0.5, spec: sniper, label: `sniper` });
}
console.log("\n== same spots, tower-height muzzle (+2.5) ==");
for (const H of [4, 6, 8]) for (const ramp of [4, 8, 16]) {
  scenario({ H, rampLen: ramp, dist: Math.min(24, ramp + 8), muzzleH: 2.5, spec: sniper, label: `tower ` });
}
console.log("\n== rifles / mg specs, H=4 ramp=8 dist=12 ==");
scenario({ H: 4, rampLen: 8, dist: 12, muzzleH: 0.5, spec: rifles, label: "rifles" });
scenario({ H: 4, rampLen: 8, dist: 12, muzzleH: 0.5, spec: mg, label: "mg    " });

console.log("\n== veto rate vs slope angle (sniper, dist=ramp+6, target at ramp base+) ==");
for (const H of [1, 2, 3, 4, 5, 6, 8, 10]) {
  let veto = 0, n = 0, whys = {};
  for (let ramp = 3; ramp <= 20; ramp++) {
    for (const dist of [ramp + 2, ramp + 6, ramp + 12]) {
      if (dist > 28) continue;
      const world = makeWorld({ seed: 1 });
      setSlope(world, H, 0, ramp);
      const sy = world.field.heightAt(0, 0);
      const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: .28, hy: .72, hz: .28, x: 0, y: sy + 0.74, z: 0, hp: 58 });
      const tgy = world.field.heightAt(dist, 0);
      const muzzle = { x: 0, y: sh.pos.y + 0.5, z: 0 };
      const tr = arcTrace(world, muzzle, { x: dist, y: tgy + 0.74, z: 0 }, sniper, sh.id);
      n++;
      if (!tr.ok) { veto++; whys[tr.why] = (whys[tr.why] || 0) + 1; }
    }
  }
  console.log(`H=${H}m: veto ${veto}/${n} (${(100 * veto / n).toFixed(0)}%) ${JSON.stringify(whys)}`);
}

console.log("\n== level-ground control (H=0) ==");
scenario({ H: 0, rampLen: 8, dist: 16, muzzleH: 0.5, spec: sniper, label: "flat  " });

console.log("\n== shooter set back from lip (crest behind the lip test): shooter at x=-3, H=4 ramp=8 ==");
{
  const world = makeWorld({ seed: 1 });
  setSlope(world, 4, 0, 8);
  const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: .28, hy: .72, hz: .28, x: -3, y: world.field.heightAt(-3, 0) + 0.74, z: 0, hp: 58 });
  const muzzle = { x: -3, y: sh.pos.y + 0.5, z: 0 };
  for (const tx of [8, 10, 12, 15]) {
    const tr = arcTrace(world, muzzle, { x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0 }, sniper, sh.id);
    console.log(`tgt x=${tx}: ${JSON.stringify(tr, (k, v) => typeof v === "number" ? +v.toFixed(3) : v)}`);
  }
}
