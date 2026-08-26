// COLDSNAP suite era 31 — THE LIT ROOF (mk2.57). An occupied cell is seen
// at its SURFACE (owner, 2026-08-26): the eye tests to the roof the reticle
// would rest on, not to the ground walled off underneath it — so a roof the
// owner is looking at is lawful ground for the reticle, the surface law,
// and every gun. Honest line of sight is kept: ground hidden behind a
// building stays dark, and a wide roof lights only as far as a low eye can
// see over its near rim. No seed is special; fixture seeds named below.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { makeSight, stepSight, seenAt, steerReticle, surfaceAt } from "../../src/depot/sight.js";
import { possessedArmorFire } from "../../src/depot/drivers.js";
import { tightSolve } from "../../src/depot/accuracy.js";
import { BISON, BISON_FIRE } from "../../src/depot/specs.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
const idUV = (x, z) => ({ u: x, v: z });
const idW = (u, v) => ({ x: u, z: v });
const mkSG = () => makeSight({ nx: 64, nz: 64, cs: 2, halfU: 64, halfV: 64 });
const mkBison = (w, team, x, z) => {
  const v = addBody(w, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp });
  v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend";
  return v;
};

// R1 — the law: a Bison facing a 7 m building sees the near roof cells at
// their surface; the ground hidden behind the building stays dark.
{
  const w = makeWorld({ field: flatF, seed: 311 });
  mkBison(w, 1, 0, 0);
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 3.5, hz: 3, x: 12, y: 3.5, z: 0, hp: 999 });
  const SG = mkSG();
  stepSight(w, SG, idUV, idW);
  ok("R1: the near roof cells are LIT (seed 311)", seenAt(SG, 9, 0, 1) && seenAt(SG, 11, 0, 1));
  ok("R1: the surface there is the roof, 7 m, solid", surfaceAt(SG, 11, 0, idUV).y === 7 && surfaceAt(SG, 11, 0, idUV).solid === true);
  ok("R1: ground hidden behind the building stays dark", !seenAt(SG, 17, 0, 1) && !seenAt(SG, 19, 0, 1) && !seenAt(SG, 21, 0, 1));
  ok("R1: a low eye cannot see over a wide roof's far rim — honest sight kept", !seenAt(SG, 15, 0, 1));
}

// R2 — the reticle climbs: steered from the Bison toward the building, it
// no longer stops at the wall's base — it rides up onto the lit roof and
// rests at the surface the guns will aim at.
{
  const w = makeWorld({ field: flatF, seed: 312 });
  mkBison(w, 1, 0, 0);
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 3.5, hz: 3, x: 12, y: 3.5, z: 0, hp: 999 });
  const SG = mkSG();
  stepSight(w, SG, idUV, idW);
  let off = { dx: 0, dz: 0 };
  for (let i = 0; i < 400; i++) off = steerReticle(SG, 1, { x: 0, z: 0 }, 26, off, 1, 0, 1 / 60, idUV);
  ok("R2: the reticle steers past the wall's base onto the roof (seed 312)", off.dx > 9, off.dx.toFixed(1));
  ok("R2: it rests on the roof surface", surfaceAt(SG, off.dx, 0, idUV).y === 7);
}

// R3 — the shot follows: with the roof lit, the possessed Bison FIRES at
// the roof point through the real sight gate, and the solver lands a lawful
// arc on the roof plane.
{
  const w = makeWorld({ field: flatF, seed: 313 }); w.depotCombat = true;
  const v = mkBison(w, 1, 0, 0);
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 3.5, hz: 3, x: 12, y: 3.5, z: 0, hp: 999 });
  const SG = mkSG();
  stepSight(w, SG, idUV, idW);
  const T = { sight: SG };
  const aim = { x: 10, y: 7, z: 0 };
  const sol = tightSolve(w, { x: 0, y: 2.97, z: 0 }, aim, BISON_FIRE.gun, v.id);
  ok("R3: a lawful arc lands on the roof plane (seed 313)", sol && sol.v < BISON_FIRE.gun.projSpeed, JSON.stringify(sol));
  w.events.length = 0;
  const fired = possessedArmorFire(w, v, aim, T, idUV);
  ok("R3: the possessed shot passes the sight gate and fires", fired === true && w.events.some((e) => e.type === "muzzle" && e.kind === "shell"));
}

// R4 — SYMMETRY: the enemy's eye lights the same roof for its own side.
{
  const w = makeWorld({ field: flatF, seed: 314 });
  mkBison(w, 2, 24, 0);
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 3.5, hz: 3, x: 12, y: 3.5, z: 0, hp: 999 });
  const SG = mkSG();
  stepSight(w, SG, idUV, idW);
  ok("R4: the enemy sees its near rim of the same roof (seed 314)", seenAt(SG, 15, 0, 2) && !seenAt(SG, 9, 0, 2));
}

// R5 — source pin: canSee tests the occupied cell's surface, not the ground
// under it.
ok("R5: canSee reads the surface — occ over gnd — at the target cell",
  /const ty = \(SG\.occ\[ti\] > SG\.gnd\[ti\] \? SG\.occ\[ti\] : SG\.gnd\[ti\]\) \+ SIGHT_TARGET_H;/.test(src("src/depot/sight.js")));
