// COLDSNAP suite era 29 — THE LOBBED SHELL (mk2.55). The Bison's gun rises
// to 85° at a fitted speed and lands its shell where the reticle stands —
// straight when a straight shot clears, lobbed when it cannot, both sides.
// The field gun keeps the 35° law, and the wave tank's scan keeps the flat
// law. The wind stays on the shell (owner,
// 2026-08-25): the ring shows where a lob lands. No seed is special;
// fixture seeds are named below.
import { ok } from "./harness.mjs";
import { makeWorld, stepWorld, addBody, mulberry32 } from "../../src/engine/core.js";
import { spawnUnit, stepUnits } from "../../src/depot/units.js";
import { stepDrivers, possessedArmorFire, barrelTip } from "../../src/depot/drivers.js";
import { shooterFire } from "../../src/depot/state.js";
import { elevSolve, elevCapOf, ELEV_CAP, shotClears, arcClears, lanePool, arcAtPitchClears, predictRing, speedForPitch } from "../../src/depot/accuracy.js";
import { BISON, BISON_FIRE, TOWER_SPECS, ENEMY_FIRE, BARRELS } from "../../src/depot/specs.js";
import { identFwdDir, straightGrid } from "./shared.mjs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
const DEG = Math.PI / 180;
const SIN35 = Math.sin(35 * DEG);
const M = { x: 0, y: 2.97, z: 0 };                       // a Bison's tube height over flat ground
const idUV = (x, z) => ({ u: x, v: z });
// the 4 m building: a 6 m deep block, mass 0 (masonry stands), 20 m out
const block = (w, x = 20) => addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 2, hz: 3, x, y: 2, z: 0, hp: 999 });
const mkGrid = () => {
  const W = 40, H = 40, CS = 2, OX = -40, OZ = -40;
  const cells = Array.from({ length: W * H }, () => ({ blocked: false, ice: false, water: false, wallId: null, dist: 1, dx: 0, dz: 1 }));
  return { cells, w: W, h: H, cs: CS, ox: OX, oz: OZ,
    idx: (gx, gz) => gz * W + gx,
    inBounds: (gx, gz) => gx >= 0 && gx < W && gz >= 0 && gz < H,
    worldToGrid: (x, z) => ({ gx: Math.floor((x - OX) / CS), gz: Math.floor((z - OZ) / CS) }),
    gridToWorld: (gx, gz) => ({ x: OX + (gx + 0.5) * CS, z: OZ + (gz + 0.5) * CS }),
    cellAt(x, z) { const g = this.worldToGrid(x, z); return this.inBounds(g.gx, g.gz) ? cells[this.idx(g.gx, g.gz)] : null; } };
};
const mkBison = (w, team, x, z) => {
  const v = addBody(w, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
  v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.tracks = "careful"; v.order = "defend";
  return v;
};
const muzzles = (w) => w.events.filter((ev) => ev.type === "muzzle" && ev.kind === "shell");

// L1 — the dial: the Bison's gun alone carries the 85° cap; every other auto
// gun and the wave tank keep ELEV_CAP.
ok("L1: BISON_FIRE.gun.elevCap is 85 and elevCapOf reads it in radians",
  BISON_FIRE.gun.elevCap === 85 && Math.abs(elevCapOf(BISON_FIRE.gun) - 85 * DEG) < 1e-12);
ok("L1: the field gun and the wave tank carry no cap of their own — ELEV_CAP (35°) stands for them",
  TOWER_SPECS.gun.elevCap === undefined && ENEMY_FIRE.tank.elevCap === undefined &&
  elevCapOf(TOWER_SPECS.gun) === ELEV_CAP && Math.abs(ELEV_CAP - 35 * DEG) < 1e-12);

// L2 — the lob: ground 3 m behind a 4 m building, and a 7 m roof, both held
// under the 35° law, both fire now — the barrel above 35°, the speed under
// full. The field gun on the same ground still holds (its cap did not move).
{
  const w = makeWorld({ field: flatF, seed: 281 });
  block(w);
  const behind = elevSolve(w, M, { x: 26, y: 0, z: 0 }, BISON_FIRE.gun, 0);
  ok("L2: ground 3 m behind a 4 m building — the Bison lobs (pitch > 35°, speed under 85)",
    behind && behind.pitch > 35 * DEG && behind.pitch <= 85 * DEG + 1e-9 && behind.v < 85, JSON.stringify(behind));
  const fieldGun = elevSolve(w, M, { x: 26, y: 0, z: 0 }, TOWER_SPECS.gun, 0);
  ok("L2: the field gun on the same ground holds — the 35° law is untouched for it", fieldGun === null, JSON.stringify(fieldGun));
  const w2 = makeWorld({ field: flatF, seed: 282 });
  addBody(w2, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 3.5, hz: 3, x: 12, y: 3.5, z: 0, hp: 999 });
  const roof = elevSolve(w2, M, { x: 12, y: 7, z: 0 }, BISON_FIRE.gun, 0);
  ok("L2: a 7 m roof 12 m out — the Bison lobs onto it", roof && roof.pitch > 35 * DEG && roof.v < 85, JSON.stringify(roof));
}

// L3 — straight stays straight, and the flattest lawful arc still wins:
// clear ground fires the low root at full speed; a 2 m wall 4 m short of the
// target raises the barrel to the same ~22° it did under the 35° law.
{
  const w = makeWorld({ field: flatF, seed: 283 });
  const clear = elevSolve(w, M, { x: 20, y: 0, z: 0 }, BISON_FIRE.gun, 0);
  ok("L3: clear ground — the low root at full speed", clear && clear.v === 85 && clear.pitch < 0.1, JSON.stringify(clear));
  addBody(w, { kind: "wall", team: 0, mass: 0, hx: 0.9, hy: 1.0, hz: 0.2, x: 16, y: 1.0, z: 0, hp: 200 });
  const low = elevSolve(w, M, { x: 20, y: 0, z: 0 }, BISON_FIRE.gun, 0);
  ok("L3: a 2 m wall 4 m short — the flattest lawful arc, under 35°, exactly as before",
    low && low.pitch > 15 * DEG && low.pitch < 35 * DEG && low.v < 85, JSON.stringify(low));
}

// L4 — past 85° the gun still holds: the mk2.03(b) wall (18 m tall, 2 m
// before the target) under the Bison's own cap.
{
  const w = makeWorld({ field: flatF, seed: 284 });
  addBody(w, { kind: "wall", team: 0, mass: 0, hx: 0.9, hy: 9, hz: 0.2, x: 18, y: 9, z: 0, hp: 999 });
  ok("L4: an arc even 85° cannot clear returns null — the gun holds", elevSolve(w, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, BISON_FIRE.gun, 0) === null);
}

// L5 — shooterFire fires the lob: one shell, its muzzle direction above 35°,
// its speed the fitted one, exactly two rng draws (applyScatter's contract),
// and the fired pitch on the shooter for the barrel mesh.
{
  const w = makeWorld({ field: flatF, seed: 285 });
  block(w);
  const shooter = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
  let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
  w.events.length = 0;
  shooterFire(w, shooter, M, { pos: { x: 26, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
  const mz = muzzles(w);
  const p = w.projectiles[w.projectiles.length - 1];
  const speed = p ? Math.hypot(p.v.x, p.v.y, p.v.z) : 0;
  ok("L5: one shell leaves, lobbed (muzzle dy > sin 35°)", mz.length === 1 && mz[0].dy > SIN35, JSON.stringify(mz[0]));
  ok("L5: the shell flies at the fitted speed, under 85 m/s", speed > 5 && speed < 84, speed.toFixed(2));
  ok("L5, re-taught mk2.56: the lob draws exactly three times — applyScatter's two and the charge draw", draws === 3, draws);
  ok("L5: the fired pitch rides the shooter, above 35°", shooter._aimPitch > SIN35, shooter._aimPitch);
}

// L6 — the tip follows the pitch: a possessed Bison's lob leaves a muzzle
// higher than the flat tube's end (the mk2.05 true-muzzle law, kept).
{
  const w = makeWorld({ field: flatF, seed: 286 }); w.depotCombat = true;
  const v = mkBison(w, 1, 0, 0);
  block(w);
  const aim = { x: 26, y: 0, z: 0 };
  const flat = barrelTip(v, aim, BISON_FIRE.gun, BARRELS.bison);
  w.events.length = 0;
  const fired = possessedArmorFire(w, v, aim, null, idUV);
  const mz = muzzles(w);
  ok("L6: the possessed lob fires", fired && mz.length === 1, JSON.stringify(mz));
  ok("L6: the shell leaves a tip raised with the barrel — over 1 m above the flat tube's end",
    mz.length === 1 && mz[0].y > flat.y + 1.0 && mz[0].x < flat.x, `muzzle y ${mz[0] && mz[0].y.toFixed(2)} vs flat ${flat.y.toFixed(2)}`);
}

// L7 — SYMMETRY: both sides' auto-driven Bisons seek a man behind the
// building and fire at him with a raised barrel — a man the flat gate
// refused; the wave tank, its scan on the flat law,
// keeps quiet at the same man. Two mirrored fixtures, one shape. (The
// raised pitch here is lower than L2's: the tube is lifted 2 m over the
// flat gate's muzzle and 3 m closer, so a flatter arc already clears — the
// flattest lawful arc wins.)
{
  const SIN10 = Math.sin(10 * DEG);
  const trial = (team, seed) => {
    const w = makeWorld({ field: flatF, seed }); w.depotCombat = true;
    const v = mkBison(w, team, 0, 0);
    block(w);
    // the other side's man, on the far side of the block, sealed from any flat shot
    const man = addBody(w, { kind: "unit", team: team === 1 ? 2 : 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 26, y: 0.74, z: 0, hp: 50000 });
    const scanMuzzle = { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z };   // armorScanFoes' own muzzle
    const flatRefused = !arcClears(w, scanMuzzle, man.pos, BISON_FIRE.gun, v.id);
    for (let i = 0; i < 600; i++) { stepDrivers(w, mkGrid(), identFwdDir, null, idUV, {}); stepWorld(w); }
    return { mz: muzzles(w), flatRefused };
  };
  const enemy = trial(2, 287), player = trial(1, 288);
  ok("L7: the enemy's Bison fires at a player man behind the building the flat gate refused, barrel raised (seed 287)",
    enemy.flatRefused && enemy.mz.length > 0 && enemy.mz.every((m) => m.dy > SIN10), JSON.stringify(enemy.mz[0]));
  ok("L7: the player's auto-driven Bison does the same to an enemy man behind the same building (seed 288)",
    player.flatRefused && player.mz.length > 0 && player.mz.every((m) => m.dy > SIN10), JSON.stringify(player.mz[0]));
  const w = makeWorld({ field: flatF, seed: 289 }); w.depotCombat = true;
  spawnUnit(w, { x: 0, z: 0 }, "tank");
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 2, hz: 3, x: 0, y: 2, z: 20, hp: 999 });
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 26, hp: 50000 });
  for (let i = 0; i < 600; i++) { stepDrivers(w, straightGrid(0, 0), identFwdDir, null); stepUnits(w, straightGrid(0, 0), identFwdDir, null); stepWorld(w); }
  ok("L7: the wave tank holds at the same man (seed 289) — its scan keeps the flat law", muzzles(w).length === 0, muzzles(w).length);
}

// L8 — the lane pool: on a seeded field of 200 boxes, every pitch's verdict
// against the lane pool equals the verdict against the whole pool, 240 of 240.
{
  const w = makeWorld({ field: flatF, seed: 290 });
  const r = mulberry32(290);
  for (let i = 0; i < 200; i++) {
    const hx = 0.3 + r() * 2, hy = 0.5 + r() * 3, hz = 0.3 + r() * 2;
    addBody(w, { kind: r() < 0.5 ? "rock" : "chunk", team: 0, mass: 0, hx, hy, hz, x: (r() - 0.5) * 80, y: hy, z: (r() - 0.5) * 80, hp: 999 });
  }
  let same = 0, n = 0, lobs = 0;
  for (let i = 0; i < 60; i++) {
    const m = { x: (r() - 0.5) * 60, y: 1.5 + r() * 2, z: (r() - 0.5) * 60 };
    const t = { x: m.x + (r() - 0.5) * 50, y: 0, z: m.z + (r() - 0.5) * 50 };
    const d = Math.max(2, Math.hypot(t.x - m.x, t.z - m.z));
    const pool = lanePool(w, m, t, null);
    for (const pd of [5, 30, 60, 80]) {
      const v = speedForPitch(d, t.y - m.y, pd * DEG); if (v == null) continue;
      n++;
      const a = arcAtPitchClears(w, m, t, pd * DEG, v, null), b = arcAtPitchClears(w, m, t, pd * DEG, v, null, pool);
      if (a === b) same++; if (!a) lobs++;
    }
  }
  ok(`L8: the lane pool's verdicts match the whole pool's (seed 290) — ${same}/${n}, ${lobs} of them blocked`, n >= 200 && same === n && lobs > 20, `${same}/${n}`);
}

// L9 — the ring shows where the lob lands (owner: the wind stays on the
// shell): on a map with the same 4 m building, the ring's chosen arc is a
// lob, in still air it lands on the aim, in a crosswind it lands downwind.
{
  const N = 64;
  const SG = { nx: N, nz: N, cs: 2, halfU: N, halfV: N, gnd: new Float32Array(N * N), occ: new Float32Array(N * N).fill(-Infinity) };
  const cell = (x, z) => Math.floor((z + N) / 2) * N + Math.floor((x + N) / 2);
  for (let x = 17; x < 23; x += 2) for (let z = -3; z <= 3; z += 2) SG.occ[cell(x, z)] = 4;
  const aim = { x: 26, y: 0, z: 0 };
  const still = predictRing(SG, M, aim, BISON_FIRE.gun, 0.02, null, idUV);
  const windy = predictRing(SG, M, aim, BISON_FIRE.gun, 0.02, { x: 0, z: 2.2, mag: 2.2 }, idUV);
  ok("L9: the ring chooses a lob over the building", still.rawDir.y > SIN35 && windy.rawDir.y > SIN35 && !still.high, `${still.rawDir.y.toFixed(2)} / ${windy.rawDir.y.toFixed(2)}`);
  ok("L9: still air — the ring's center sits on the aim", !still.center.wall && Math.hypot(still.center.x - aim.x, still.center.z - aim.z) < 2.5, JSON.stringify(still.center));
  ok("L9: a 2.2 m/s crosswind — the ring's center drifts downwind, off the aim", !windy.center.wall && windy.center.z > 1.0 && windy.center.z > still.center.z + 1.0, JSON.stringify(windy.center));
}
