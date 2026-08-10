// scripts/accuracy-probe.mjs — TUNING REPORT, not a gate. Fires each firing
// tower type (mg/gun/mortar/rocket — frost has no projectile) through the
// real towerShot() fire path at a matrix of range x shooter-elevation x wind,
// against a conscript-sized static target box, 200 seeded shots per cell.
//
// HIT DEFINITION: for every shot we track the projectile's closest approach
// distance to the target's center over its full flight (sampled every
// physics substep via the real fireProjectile/stepWorld path — real gravity,
// real wind drag, real lead-solve + conditional scatter from towerShot). A
// shot counts as a HIT if closest-approach < 0.9m (a body-width near-direct
// hit) OR closest-approach < LETHAL_FRAC * spec.blastR — the target sits
// inside the round's LETHAL portion of the blast at its nearest pass.
// spec.blastR is the full falloff radius (damage tapers to ~0 at the edge
// per explode()'s `f = 1 - dist/reach`), so we treat the inner 45% of it as
// reliably lethal rather than the whole falloff cone — an approximation of
// "the blast would have killed it", not a full occlusion/damage simulation.
//
// wind is a CONSTANT vector, crosswise to the firing lane (target due north
// of the tower along +z; wind blows along +x), set directly on world.wind —
// windAt() (the seeded time-varying field) is not used here, so every cell
// isolates one clean wind magnitude.
import { makeWorld, fireProjectile, stepWorld, mulberry32 } from "../src/engine/core.js";
import { towerShot } from "../src/depot/state.js";
import { TOWER_SPECS, ENEMY_SPECS } from "../src/depot/specs.js";

void fireProjectile; void mulberry32; // (imported for clarity of the fire path; used indirectly via towerShot/makeWorld)

const RANGES = [10, 16, 22, 28];
const ELEVS = [-4, 0, 4];
const WINDS = [0, 3, 5.5];
const SHOTS = 200;
const DIRECT_M = 0.9;
const LETHAL_FRAC = 0.45;

const conscript = ENEMY_SPECS[""];
const TYPES = ["mg", "gun", "mortar", "rocket"];

function seedFor(ti, ri, ei, wi, shot) {
  return 1 + ti * 1000003 + ri * 10007 + ei * 1013 + wi * 101 + shot;
}

function fireOne(spec, type, range, elev, windMag, shot) {
  const seed = seedFor(TYPES.indexOf(type), RANGES.indexOf(range), ELEVS.indexOf(elev), WINDS.indexOf(windMag), shot);
  const world = makeWorld({ seed });
  // shooter elevation: ground ramps linearly from `elev` under the tower
  // (z=0) down to flat 0 under and beyond the target (z=range) — a smooth
  // slope, not a cliff, so a negative elevation (tower below the target)
  // doesn't create a stray ground plane the low flat-fire rounds clip
  // through mid-flight before ever reaching the target.
  world.field = {
    heightAt: (x, z) => (z <= 0 ? elev : z >= range ? 0 : elev * (1 - z / range)),
    carve: () => {},
  };
  world.depotCombat = true;
  world.wind = windMag > 0 ? { x: windMag, z: 0, mag: windMag } : null;
  const tower = { pos: { x: 0, y: elev, z: 0 }, hy: spec.hy, towerType: type };
  const target = { pos: { x: 0, y: conscript.hy, z: range }, v: { x: 0, y: 0, z: 0 }, hy: conscript.hy };
  towerShot(world, tower, target, spec);
  let minDist = Infinity, steps = 0;
  while (world.projectiles.length && steps < 900) {
    stepWorld(world);
    steps++;
    for (const p of world.projectiles) {
      const d = Math.hypot(p.pos.x - target.pos.x, p.pos.y - target.pos.y, p.pos.z - target.pos.z);
      if (d < minDist) minDist = d;
    }
  }
  return minDist < DIRECT_M || minDist < spec.blastR * LETHAL_FRAC;
}

console.log("=== DEPOT accuracy probe (tuning report, not a gate) ===");
console.log(`HIT = closest-approach < ${DIRECT_M}m OR closest-approach < ${LETHAL_FRAC}*spec.blastR, sampled over the real towerShot -> fireProjectile/stepWorld flight (real gravity/wind/lead-solve/scatter).`);
console.log(`${SHOTS} seeded shots/cell. wind is a constant crosswind vector set on world.wind (windAt() not used).\n`);

const degenerate = [];
for (const type of TYPES) {
  const spec = TOWER_SPECS[type];
  console.log(`-- ${type.toUpperCase()} (range spec ${spec.range}m, acc ${spec.acc}, windF ${spec.windF}, windComp ${spec.windComp}) --`);
  const header = "range\\wind".padEnd(11) + WINDS.map((w) => `w=${w}`.padStart(9)).join("");
  for (const elev of ELEVS) {
    console.log(`  elevation ${elev >= 0 ? "+" : ""}${elev}m`);
    console.log("  " + header);
    for (const range of RANGES) {
      const cells = [];
      for (const wind of WINDS) {
        let hits = 0;
        for (let s = 0; s < SHOTS; s++) if (fireOne(spec, type, range, elev, wind, s)) hits++;
        const pct = (100 * hits) / SHOTS;
        cells.push(pct);
        const beyondRange = range > spec.range;
        if ((pct === 0 || pct === 100) && !(type === "mg" && beyondRange)) {
          degenerate.push({ type, range, elev, wind, pct });
        }
      }
      console.log("  " + `${range}m`.padEnd(9) + cells.map((p) => `${p.toFixed(0)}%`.padStart(9)).join(""));
    }
  }
  console.log("");
}

if (degenerate.length) {
  console.log(`SANITY: ${degenerate.length} degenerate cell(s) (0%% or 100%%, excluding mg beyond its effective range):`);
  for (const d of degenerate) console.log(`  ${d.type} range=${d.range} elev=${d.elev} wind=${d.wind} -> ${d.pct.toFixed(0)}%`);
} else {
  console.log("SANITY: no degenerate cells outside mg-beyond-range. OK.");
}
