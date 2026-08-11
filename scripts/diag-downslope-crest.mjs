import { makeWorld, addBody, aimSolve } from "../src/engine/core.js";
import { INFANTRY_ARMS } from "../src/depot/specs.js";
import { arcClears } from "../src/depot/accuracy.js";
import { squadFire } from "../src/depot/state.js";
import { makeSquad } from "../src/depot/squads.js";
import { solidBlocksPoint } from "../src/depot/accuracy.js";

function arcTrace(world, muzzle, target, spec, selfId) {
  const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
  const d = Math.hypot(dx, dz); if (d < 2) return { ok: true };
  const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
  if (pitch == null) return { ok: false, why: "aimSolve" };
  const vh = spec.projSpeed * Math.cos(pitch), vy0 = spec.projSpeed * Math.sin(pitch);
  for (let s = 0.9; s < d - 0.9; s += 0.9) {
    const t = s / vh, y = muzzle.y + vy0 * t - 4.9 * t * t;
    const x = muzzle.x + (dx/d)*s, z = muzzle.z + (dz/d)*s;
    const g = world.field.heightAt(x, z);
    if (g + 0.35 > y) return { ok: false, why: "terrain", s, y: +y.toFixed(3), g: +g.toFixed(3), gap: +(y-g).toFixed(3) };
    if (solidBlocksPoint(world, x, y, z, selfId)) return { ok: false, why: "solid", s };
  }
  return { ok: true };
}
// rounded (cosine) crest: h=H for x<=0, cosine falloff over rampLen
function setCrest(world, H, rampLen) {
  const f = world.field;
  for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
    const x = i * f.cs - f.half;
    let h = x <= 0 ? H : x >= rampLen ? 0 : H * 0.5 * (1 + Math.cos(Math.PI * x / rampLen));
    f.h[f.idx(i, j)] = h;
  }
}
const sniper = INFANTRY_ARMS.sniper;
console.log("== rounded crest, sniper muzzle=pos.y+0.5 (1.24m AGL): veto matrix ==");
console.log("rows: setback of shooter behind crest start; cols: H/ramp; cell: vetoed targets / total (targets every 1m on downslope+beyond)");
for (const setback of [0, 1, 2, 3, 4]) {
  let row = `setback ${setback}m: `;
  for (const [H, ramp] of [[3,6],[4,8],[6,8],[6,12],[8,10]]) {
    const world = makeWorld({ seed: 1 });
    setCrest(world, H, ramp);
    const sx = -setback;
    const sh = addBody(world, { kind:"unit", team:1, mass:80, hx:.28, hy:.72, hz:.28, x:sx, y:world.field.heightAt(sx,0)+0.74, z:0, hp:58 });
    const muzzle = { x: sx, y: sh.pos.y + 0.5, z: 0 };
    let veto = 0, n = 0, first = null;
    for (let tx = 2; tx <= 26; tx++) {
      const tr = arcTrace(world, muzzle, { x: tx, y: world.field.heightAt(tx,0)+0.74, z: 0 }, sniper, sh.id);
      n++; if (!tr.ok) { veto++; if (!first) first = { tx, ...tr }; }
    }
    row += ` H${H}/r${ramp}:${veto}/${n}`;
    if (first && setback >= 2 && H === 6 && ramp === 8) console.log("  sample veto:", JSON.stringify(first));
  }
  console.log(row);
}
console.log("\n== same, tower muzzle +2.5 above pos ==");
for (const setback of [2, 3, 4]) {
  let row = `setback ${setback}m: `;
  for (const [H, ramp] of [[3,6],[4,8],[6,8],[6,12],[8,10]]) {
    const world = makeWorld({ seed: 1 });
    setCrest(world, H, ramp);
    const sx = -setback;
    const sh = addBody(world, { kind:"unit", team:1, mass:80, hx:.28, hy:.72, hz:.28, x:sx, y:world.field.heightAt(sx,0)+0.74, z:0, hp:58 });
    const muzzle = { x: sx, y: sh.pos.y + 2.5, z: 0 };
    let veto = 0, n = 0;
    for (let tx = 2; tx <= 26; tx++) {
      const tr = arcTrace(world, muzzle, { x: tx, y: world.field.heightAt(tx,0)+0.74, z: 0 }, sniper, sh.id);
      n++; if (!tr.ok) veto++;
    }
    row += ` H${H}/r${ramp}:${veto}/${n}`;
  }
  console.log(row);
}
console.log("\n== gap distribution: how close were vetoed arcs to clearing? (setback 2, H6 r8) ==");
{
  const world = makeWorld({ seed: 1 });
  setCrest(world, 6, 8);
  const sh = addBody(world, { kind:"unit", team:1, mass:80, hx:.28, hy:.72, hz:.28, x:-2, y:world.field.heightAt(-2,0)+0.74, z:0, hp:58 });
  const muzzle = { x: -2, y: sh.pos.y + 0.5, z: 0 };
  for (let tx = 4; tx <= 22; tx += 3) {
    const tr = arcTrace(world, muzzle, { x: tx, y: world.field.heightAt(tx,0)+0.74, z: 0 }, sniper, sh.id);
    console.log(`tx=${tx}:`, JSON.stringify(tr));
  }
}
console.log("\n== end-to-end squadFire: sniper squad at setback 2 on H6 r8 crest, conscript at tx=14 ==");
{
  const world = makeWorld({ seed: 1 });
  setCrest(world, 6, 8);
  const sh = addBody(world, { kind:"unit", team:1, mass:80, hx:.28, hy:.72, hz:.28, x:-2, y:world.field.heightAt(-2,0)+0.74, z:0, hp:58 });
  sh.utype = "sniper";
  const tgt = addBody(world, { kind:"unit", team:2, mass:80, hx:.28, hy:.72, hz:.28, x:14, y:world.field.heightAt(14,0)+0.74, z:0, hp:58 });
  const squad = makeSquad(1, "sniper", 1, -2, 0);
  squad.memberIds.push(sh.id); squad.order = "defend";
  const nb = world.projectiles.length;
  squadFire(world, squad, 0.5, null);
  console.log(`projectiles after squadFire: ${world.projectiles.length - nb} (fireCd=${sh.fireCd})`);
}

console.log("\n== of all vetoes across the matrix: gap sign (gap>0 = arc physically clears, pad-only veto) ==");
{
  let padOnly = 0, truePierce = 0, gaps = [];
  for (const setback of [0,1,2,3,4]) for (const [H, ramp] of [[3,6],[4,8],[6,8],[6,12],[8,10]]) {
    const world = makeWorld({ seed: 1 });
    setCrest(world, H, ramp);
    const sx = -setback;
    const sh = addBody(world, { kind:"unit", team:1, mass:80, hx:.28, hy:.72, hz:.28, x:sx, y:world.field.heightAt(sx,0)+0.74, z:0, hp:58 });
    const muzzle = { x: sx, y: sh.pos.y + 0.5, z: 0 };
    for (let tx = 2; tx <= 26; tx++) {
      const tr = arcTrace(world, muzzle, { x: tx, y: world.field.heightAt(tx,0)+0.74, z: 0 }, sniper, sh.id);
      if (!tr.ok && tr.why === "terrain") { gaps.push(tr.gap); tr.gap > 0 ? padOnly++ : truePierce++; }
    }
  }
  gaps.sort((a,b)=>a-b);
  console.log(`vetoes: ${padOnly + truePierce}; pad-only (arc above ground): ${padOnly}; true pierce (arc below ground): ${truePierce}`);
  console.log(`gap quantiles: min=${gaps[0]} med=${gaps[gaps.length>>1]} max=${gaps[gaps.length-1]}`);
}
