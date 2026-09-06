// T4 two-thrust-modes harness — the harness of record for this run
// (docs/superpowers/plans/2026-09-06-t4-the-two-thrust-modes.md). A
// measuring tool, never run in CI.
//
// Seeds are ROLLED fresh at startup from Math.random() (lawful here — this
// is a measuring script, not game logic; src/depot is where Math.random
// stays forbidden) and printed first thing. No seed is ever written into
// this file. A determinism rerun instead passes ONE drawn seed back
// explicitly with --seed <n>.
//
// It runs the mech through the fixed walk program (unchanged from T3) on
// real relief (makeField + buildDepotTerrain), at four thrust arms:
//   A — stock (no engine edit needed to run this arm against a stock
//       checkout; the B/C flags below are no-ops unless the engine under
//       test carries the T4 worktree edits).
//   B — the walk assist (mech._armB): a feed-forward burn share entering
//       through the same governor-commanded-speed slot the stock speed
//       assist uses, opened under plain commanded walk intent instead of
//       only overdrive, tilted along the commanded heading (rear/side
//       nozzles). Share: mech._armBShare (frozen by `calibrate`).
//   C — the one-metric guard (mech._armC): the five-case trouble thicket
//       replaced by one danger test — capture-point escape beyond the
//       reachable step (leg-geometry derived) plus the uprightness floor.
//   D — both. Precedence (guard zeroes the assist share the tick it
//       fires) falls out of the engine's own if/else-if chain: the guard
//       arms st._thrA, and the assist branch is a mutually exclusive
//       else-if of that same chain — no separate code needed.
//
// Usage:
//   node scripts/mech-experiment.mjs sweep <A|B|C|D> <thrustMult> <budgetMult> [n]
//   node scripts/mech-experiment.mjs determinism <A|B|C|D> <thrustMult> <budgetMult> --seed <n>
//   node scripts/mech-experiment.mjs calibrate <shareVals> <thrustMult> <budgetMult> --seed <n>
//     e.g. calibrate 0.25,0.35,0.5,0.65,0.8 1 1 --seed 12345  -- coarse grid for arm B's share

import { appendFileSync } from "node:fs";
import { makeWorld, makeField, stepWorld } from "../src/engine/core.js";
import { buildDepotTerrain } from "../src/depot/mapgen.js";
import { buildMech, mechCommand, mechFallen, mechUp } from "../src/engine/mech.js";

// streaming: one line per completed run, appended as it lands (the
// gates.log pattern) — timestamp, harness name, cell, seed, the run's
// numbers. Every sweep/calibrate/determinism run streams here.
const EXPERIMENTS_LOG = new URL("../.superpowers/experiments.log", import.meta.url);
function logRun(cellLabel, r) {
  const line = `${new Date().toISOString()} mech-experiment ${cellLabel} seed=${r.seed} fell=${r.fell} steps=${r.steps} catches=${r.catches} dist=${r.dist.toFixed(3)} meanSpeed=${r.meanSpeed.toFixed(4)} minUp=${r.minUp.toFixed(3)} peakF=${r.peakF.toFixed(0)} meanF=${r.meanF.toFixed(1)} delivered=${(r.delivered || 0).toFixed(0)} wasted=${(r.wasted || 0).toFixed(0)} totalBurn=${(r.totalBurn || 0).toFixed(0)} troubleT=${(r.troubleT || 0).toFixed(2)}\n`;
  appendFileSync(EXPERIMENTS_LOG, line);
  for (const j of r.joints || []) {
    appendFileSync(EXPERIMENTS_LOG, `${new Date().toISOString()} mech-experiment ${cellLabel} seed=${r.seed} joint=${j.name} tqPk=${j.tqPk.toFixed(0)} stop=${j.stop.toFixed(0)} shearPk=${j.shearPk.toFixed(0)}\n`);
  }
}

// ---- the walk program, as data (unchanged from T3's harness of record) ----
export function walkProgram() {
  let heading = 0;
  const prog = [];
  prog.push([20, { travel: 0.5 }]);                          // straight march
  heading += Math.PI / 2;  prog.push([15, { travel: 0.55, heading }]); // +90 turn
  prog.push([15, { travel: 0.6 }]);                          // straight march
  heading -= Math.PI / 3;  prog.push([15, { travel: 0.5, heading }]);  // -60 turn
  prog.push([15, { travel: 0.4, lateral: 0.3 }]);            // lateral-mixed leg
  heading += Math.PI / 4;  prog.push([15, { travel: 0.55, heading }]); // +45 turn
  prog.push([10, { travel: -0.3 }]);                         // slow reverse-lean leg
  heading -= Math.PI / 2;  prog.push([15, { travel: 0.5, heading }]);  // -90 turn
  return prog;
}

const DT = 1 / 120;
const TOTAL_S = 120;
const N_SEEDS = 12;

// ---- the seed law: drawn fresh here, never written into the script ----
function rollSeeds(n) {
  const seeds = [];
  for (let i = 0; i < n; i++) seeds.push(Math.floor(Math.random() * 1_000_000));
  return seeds;
}

function parseSeedFlag(rest) {
  const i = rest.indexOf("--seed");
  return i >= 0 ? Number(rest[i + 1]) : null;
}

function buildWorld(seed) {
  const field = makeField(181, 2.0, seed);
  buildDepotTerrain(field, seed);
  return makeWorld({ field, seed });
}

function buildMechForRun(seed, { thrustMult, budgetMult, arm, armBShare }) {
  const world = buildWorld(seed);
  const mech = buildMech(world, { x: 0, z: -30 });
  mech.thrustersOn = true;
  mech.thrustAssist = true;
  mech.thrustMax = mech.thrustMax * thrustMult;
  if (budgetMult !== 1) mech._budgetMult = budgetMult;
  if (arm === "B" || arm === "D") {
    mech._armB = true;
    mech._armBShare = armBShare != null ? armBShare : 0.5; // frozen — see calibrate, stated in the report
  }
  if (arm === "C" || arm === "D") mech._armC = true;
  if (arm === "F") mech._fixedCant = true; // the fixed-cant control machine
  return { world, mech };
}

function runOne(seed, opts) {
  const { world, mech } = buildMechForRun(seed, opts);
  const prog = walkProgram();
  let peakF = 0, sumF = 0, nF = 0, minUp = 1, t = 0, fellAt = null;
  let delivered = 0, totalB = 0, troubleT = 0;
  const jointPk = {};
  for (const j of mech.joints) jointPk[j.name] = { tq: 0 };
  const x0 = mech.hull.pos.x, z0 = mech.hull.pos.z;
  outer:
  for (const [dur, cmd] of prog) {
    let segT = 0;
    while (segT < dur) {
      mechCommand(mech, cmd);
      world.events.length = 0;
      stepWorld(world);
      t += DT; segT += DT;
      for (const th of mech.thrusters) {
        const f = th.cur * mech.thrustMax;
        if (f > peakF) peakF = f;
        sumF += f; nF++;
      }
      if (mech._thrF) {
        totalB += Math.hypot(mech._thrF.x, mech._thrF.z) * DT;
        const dm = mech._thrDemand;
        if (dm) delivered += Math.max(0, mech._thrF.x * dm.x + mech._thrF.z * dm.z) * DT;
      }
      if (mech.state._thrA) troubleT += DT;
      for (const j of mech.joints) {
        const tq = Math.abs(j._mAcc || 0) / DT;
        if (tq > jointPk[j.name].tq) jointPk[j.name].tq = tq;
      }
      const u = mechUp(mech);
      if (u < minUp) minUp = u;
      if (mechFallen(mech)) { fellAt = t; break outer; }
      if (t >= TOTAL_S) break outer;
    }
    if (t >= TOTAL_S) break;
  }
  const dist = Math.hypot(mech.hull.pos.x - x0, mech.hull.pos.z - z0);
  // every leg of the walk program commands nonzero travel throughout, so
  // the elapsed sim time IS the commanded-walk time for this program
  const meanSpeed = t > 0 ? dist / t : 0;
  const joints = mech.joints.map((j) => ({
    name: j.name, tqPk: jointPk[j.name].tq, stop: j.stopImp, shearPk: j.shearPk || 0,
  }));
  return {
    seed, fell: fellAt != null, steps: mech.telem.steps, catches: mech.telem.catches,
    dist, meanSpeed, minUp, peakF, meanF: nF ? sumF / nF : 0,
    delivered, wasted: totalB - delivered, totalBurn: totalB, troubleT, joints,
  };
}

function cell(arm, thrustMult, budgetMult, seeds, extra = {}) {
  const cellLabel = `arm=${arm} thrust=${thrustMult} budget=${budgetMult}`;
  const rows = seeds.map((s) => {
    const r = runOne(s, { thrustMult, budgetMult, arm, ...extra });
    logRun(cellLabel, r);
    return r;
  });
  const falls = rows.filter((r) => r.fell).length;
  const steps = rows.reduce((a, r) => a + r.steps, 0);
  const catches = rows.reduce((a, r) => a + r.catches, 0);
  const meanDist = rows.reduce((a, r) => a + r.dist, 0) / rows.length;
  const meanSpeed = rows.reduce((a, r) => a + r.meanSpeed, 0) / rows.length;
  const peakF = Math.max(...rows.map((r) => r.peakF));
  const meanF = rows.reduce((a, r) => a + r.meanF, 0) / rows.length;
  const fallsPer100 = steps ? (falls / steps) * 100 : 0;
  return { arm, thrustMult, budgetMult, falls, n: seeds.length, steps, catches, meanDist, meanSpeed, peakF, meanF, fallsPer100, rows };
}

function printCell(c) {
  console.log(`ARM=${c.arm} thrustMult=${c.thrustMult} budgetMult=${c.budgetMult} falls=${c.falls}/${c.n} falls/100steps=${c.fallsPer100.toFixed(2)} steps=${c.steps} catches=${c.catches} meanDist=${c.meanDist.toFixed(2)}m meanSpeed=${c.meanSpeed.toFixed(3)}m/s peakF=${c.peakF.toFixed(0)}N meanF=${c.meanF.toFixed(1)}N`);
  for (const r of c.rows) console.log(`  seed=${r.seed} fell=${r.fell} steps=${r.steps} catches=${r.catches} dist=${r.dist.toFixed(2)} meanSpeed=${r.meanSpeed.toFixed(3)} minUp=${r.minUp.toFixed(3)} peakF=${r.peakF.toFixed(0)} meanF=${r.meanF.toFixed(1)}`);
}

const [, , cmd, ...rest] = process.argv;

if (cmd === "sweep") {
  const [arm, thrustMult, budgetMult, nArg] = rest;
  const n = nArg ? Number(nArg) : N_SEEDS;
  const seeds = rollSeeds(n);
  console.log(`rolled seeds: ${seeds.join(",")}`);
  printCell(cell(arm, Number(thrustMult), Number(budgetMult), seeds));
} else if (cmd === "determinism") {
  const [arm, thrustMult, budgetMult] = rest;
  const seed = parseSeedFlag(rest);
  if (seed == null) { console.error("determinism requires --seed <n> (pass back a rolled seed)"); process.exit(1); }
  const opts = { thrustMult: Number(thrustMult), budgetMult: Number(budgetMult), arm };
  const a = runOne(seed, opts);
  logRun(`determinism arm=${arm} thrust=${thrustMult} budget=${budgetMult} run=A`, a);
  const b = runOne(seed, opts);
  logRun(`determinism arm=${arm} thrust=${thrustMult} budget=${budgetMult} run=B`, b);
  console.log("run A:", JSON.stringify(a));
  console.log("run B:", JSON.stringify(b));
  console.log("identical:", JSON.stringify(a) === JSON.stringify(b));
} else if (cmd === "calibrate") {
  const [shareVals, thrustMult, budgetMult] = rest;
  const seed = parseSeedFlag(rest);
  if (seed == null) {
    // the calibration seed is ROLLED here (once), printed, then passed
    // explicitly on the command line for the frozen record in the report
    const rolled = rollSeeds(1)[0];
    console.log(`no --seed given: rolled calibration seed ${rolled} (pass it back explicitly to reproduce)`);
    var useSeed = rolled;
  } else {
    var useSeed = seed;
  }
  const shares = shareVals.split(",").map(Number);
  for (const share of shares) {
    const r = runOne(useSeed, { thrustMult: Number(thrustMult), budgetMult: Number(budgetMult), arm: "B", armBShare: share });
    logRun(`calibrate armBShare=${share} thrust=${thrustMult} budget=${budgetMult}`, r);
    console.log(`share=${share} seed=${useSeed} fell=${r.fell} steps=${r.steps} catches=${r.catches} dist=${r.dist.toFixed(2)} meanSpeed=${r.meanSpeed.toFixed(3)} minUp=${r.minUp.toFixed(3)}`);
  }
} else {
  console.error("usage: sweep|determinism|calibrate ...");
  process.exit(1);
}
