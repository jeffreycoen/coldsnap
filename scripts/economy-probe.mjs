// scripts/economy-probe.mjs — Phase 3 Task 7 balance probe.
// Full-fidelity headless combat: real world stepping (units.js + DepotGame's
// stepTowers logic, mirrored here), real tower/wall bodies, real regiment
// economy (ai.js planWave + economy.js payResults/bookValue). No DOM/three.js.
//
// Runs 50-wave sims x N seeds x 3 canned defenses (none/median/strong),
// reports waves survived, regiment remaining, both ledgers, verdict.
//
//   node scripts/economy-probe.mjs
import {
  makeWorld, addBody, stepWorld, mulberry32,
} from "../src/engine/core.js";
import { TOWER_SPECS, WAVES } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, stepBreakerRam } from "../src/depot/units.js";
import { towerShot } from "../src/depot/state.js";
import {
  makeRunState, startWave, tryStall, advance, checkLoss, checkWin, nextSpawnTag, PHASE,
} from "../src/depot/state.js";
import { makeRegiment } from "../src/depot/economy.js";

const WALL_COST = 5;
const OBJ = { x: 0, z: 0 };
const SPAWN = { x: 0, z: 45 };
const identFwdDir = (dx, dz) => ({ x: dx, z: dz });
const straightGrid = { cellAt: () => ({ dist: 1, dx: 0, dz: -1, ice: false }) };

// ---------------------------------------------------------------- defenses
// Static candidate positions, cheapest-first build order. "median"/"strong"
// pull a prefix of this list, refreshed each build phase (anything missing —
// destroyed or not yet affordable — gets rebuilt/bought as scrap allows).
// A wall chokepoint line sits in the marching corridor; towers stand behind it.
function wallLine(z, xs) { return xs.map((x) => ({ type: "wall", x, z })); }
function towerSpot(type, x, z) { return { type, x, z }; }

const MEDIAN_PLAN = [
  ...wallLine(14, [-3.6, -1.8, 0, 1.8, 3.6]),
  towerSpot("mg", -6, 20), towerSpot("mg", 6, 20),
  towerSpot("gun", -3, 23), towerSpot("gun", 3, 23),
  towerSpot("frost", 0, 17),
  towerSpot("mortar", 0, 27),
];

const STRONG_PLAN = [
  ...wallLine(14, [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4]),
  ...wallLine(11, [-3.6, -1.8, 0, 1.8, 3.6]),
  towerSpot("mg", -8, 20), towerSpot("mg", 8, 20), towerSpot("mg", -6, 18), towerSpot("mg", 6, 18),
  towerSpot("gun", -4, 23), towerSpot("gun", 4, 23), towerSpot("gun", 0, 25),
  towerSpot("frost", -6, 16), towerSpot("frost", 6, 16),
  towerSpot("mortar", -3, 29), towerSpot("mortar", 3, 29), towerSpot("mortar", 0, 31),
];
// Overflow slots: once the fixed plan is fully built, "strong" keeps
// reinvesting every wave's scrap (uncapped tower pay, Jeff's decision) into
// extra mg towers along an expanding flank line — the arms-race variant.
function overflowSpot(i) {
  const row = Math.floor(i / 6), slot = i % 6;
  const x = (slot - 2.5) * 2.6;
  return towerSpot("mg", x, 33 + row * 3);
}

function buildAt(world, occupied, spot, snapCounts) {
  const spec = spot.type === "wall" ? null : TOWER_SPECS[spot.type];
  const cost = spec ? spec.cost : WALL_COST;
  const y = 0; // flat probe field height baseline (world.field.heightAt below)
  const h = world.field.heightAt(spot.x, spot.z);
  let b;
  if (spec) {
    b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: spot.x, y: h + spec.hy, z: spot.z, hp: spec.hp });
    b.towerType = spot.type;
  } else {
    b = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: spot.x, y: h + 0.9, z: spot.z, hp: 70 });
  }
  b.maxHp = b.hp;
  return { body: b, cost };
}

// Runs the build script for this wave-start: rebuild/buy anything from the
// plan (in order) not currently standing, spending resources as affordable.
// For "strong", once the fixed plan is exhausted, keeps buying overflow mg
// slots with whatever scrap remains (uncapped arms race).
function refreshDefense(world, S, occupied, plan, overflow) {
  for (let i = 0; i < plan.length; i++) {
    const key = i;
    const alive = occupied.get(key) && world.byId.has(occupied.get(key));
    if (alive) continue;
    const spot = plan[i];
    const cost = spot.type === "wall" ? WALL_COST : TOWER_SPECS[spot.type].cost;
    if (S.resources < cost) continue;
    const { body } = buildAt(world, occupied, spot);
    occupied.set(key, body.id);
    S.resources -= cost;
  }
  if (overflow) {
    let oi = occupied.get("overflowN") || 0;
    let guard = 0;
    while (S.resources >= TOWER_SPECS.mg.cost && guard++ < 200) {
      const spot = overflowSpot(oi);
      const { body } = buildAt(world, occupied, spot);
      occupied.set("ov" + oi, body.id);
      S.resources -= TOWER_SPECS.mg.cost;
      oi++;
    }
    occupied.set("overflowN", oi);
  }
}

function buildSnapshot(world) {
  let mortars = 0, mgs = 0, guns = 0, rockets = 0, frosts = 0, walls = 0;
  for (const b of world.bodies) {
    if (b.kind === "wall") { walls++; continue; }
    if (b.kind !== "tower") continue;
    if (b.towerType === "mortar") mortars++;
    else if (b.towerType === "mg") mgs++;
    else if (b.towerType === "gun") guns++;
    else if (b.towerType === "rocket") rockets++;
    else if (b.towerType === "frost") frosts++;
  }
  return { mortars, mgs, guns, rockets, frosts, walls };
}

// player-side book value using each tower's REAL spec cost (Task 7 fix —
// buildSnapshot previously lumped rocket towers into "guns" and would have
// valued them at gun cost; here we tally exact types directly, no lumping).
function playerBookValueReal(world, resources) {
  let assets = 0;
  for (const b of world.bodies) {
    if (b.kind === "wall") { assets += WALL_COST; continue; }
    if (b.kind !== "tower") continue;
    const spec = TOWER_SPECS[b.towerType];
    if (spec) assets += spec.cost;
  }
  return resources + assets;
}
function attackerBookValueReal(reg) {
  const ENEMY_BOUNTY0 = 4, TANK_BOUNTY = 25; // ENEMY_SPECS[""].bounty, TANK.bounty
  return reg.scrap + reg.heads * ENEMY_BOUNTY0 + reg.tanks * TANK_BOUNTY;
}

function stepTowersLocal(world) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
    const spec = TOWER_SPECS[b.towerType] || TOWER_SPECS.gun;
    if (spec.fireRate <= 0) continue;
    b.fireCd = (b.fireCd || 0) - dt;
    let best = b.targetId ? world.byId.get(b.targetId) : null;
    if (best && (!best.alive || best.team !== 2 || best.kind !== "unit")) best = null;
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z;
      if (dx * dx + dz * dz > spec.range * spec.range) best = null;
    }
    b.scanCd = (b.scanCd || 0) - dt;
    if (!best && b.scanCd <= 0) {
      b.scanCd = 0.11 + (b.id % 8) * 0.011;
      let bd = spec.range * spec.range;
      for (const e of world.bodies) {
        if (e.kind !== "unit" || !e.alive || e.team !== 2) continue;
        const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = e; }
      }
    }
    b.targetId = best ? best.id : null;
    if (!best || b.fireCd > 0) continue;
    b.fireCd = spec.fireRate;
    towerShot(world, b, best, spec);
  }
}

function stepOnce(world, S, ws, structHp) {
  stepUnits(world, straightGrid, identFwdDir);
  stepTowersLocal(world);
  stepWorld(world);
  stepBreakerRam(world);

  for (const b of world.bodies) {
    if (b.kind !== "wall" && b.kind !== "tower") continue;
    const prev = structHp.get(b.id);
    if (prev != null && b.hp < prev && b.lastHit && b.lastHit.attacker === "enemy") {
      ws.results.structureDmg += prev - b.hp;
    }
    structHp.set(b.id, b.hp);
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind === "wall" || b.kind === "tower") && !b.alive) {
      structHp.delete(b.id);
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5) {
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind !== "unit" || !b.alive || b.team !== 2) continue;
    const dx = b.pos.x - OBJ.x, dz = b.pos.z - OBJ.z;
    if (dx * dx + dz * dz < 9) {
      world.events.push({ type: "leak", dmg: 1 });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  // PROBE-ONLY WORKAROUND (not a game fix — see task-7 report "concerns"):
  // a surviving tank (kind "vehicle") has no leak/despawn path in the
  // shipped game (DepotGame.jsx's leak-check only covers kind==="unit"),
  // so a tank that outlives the defense marches off-map forever and a wave
  // never clears. Treat a tank well past the objective as escaped so the
  // probe can finish; flagged for Jeff, not silently patched into ship code.
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind !== "vehicle" || !b.alive || b.team !== 2) continue;
    if (b.pos.z - OBJ.z < -8) {
      world.events.push({ type: "leak", dmg: 1 });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  for (const b of world.bodies) {
    if (b.kind === "unit" && b.team === 2 && !b.alive && !b._paid && b.bounty) {
      b._paid = true;
      world.events.push({ type: "tdkill", bounty: b.bounty });
    }
  }
  for (const e of world.events) {
    if (e.type === "tdkill") { S.resources += e.bounty; S.kills++; }
    else if (e.type === "leak") { S.lives--; ws.results.leaks++; }
    else if (e.type === "kill" && e.attacker === "enemy") {
      if (e.kind === "tower") ws.results.towerKills++;
      else if (e.kind === "wall") ws.results.wallKills++;
    }
  }
  world.events.length = 0;
  checkLoss(S);
}

function liveEnemyCount(world) {
  let n = 0;
  for (const b of world.bodies) if (b.alive && ((b.kind === "unit" && b.team === 2) || (b.kind === "vehicle" && b.team === 2))) n++;
  return n;
}

// One full 50-wave run. defense: "none" | "median" | "strong".
function runSim(seed, defense, maxSteps = 26000) {
  const world = makeWorld({ seed: seed * 1000 + 7 });
  world.depotCombat = true;
  world.dt = 1 / 30; // dt batching — coarser than the game's 1/120, plenty stable for economy probing

  const rng = mulberry32(seed);
  const S = makeRunState({ waves: WAVES, startResources: 120, startLives: 20 });
  S.started = true;
  S.reg = makeRegiment(rng);
  const occupied = new Map();
  const plan = defense === "strong" ? STRONG_PLAN : defense === "median" ? MEDIAN_PLAN : [];

  let stalemate = false;
  let forcedClears = 0;
  let wavesCleared = 0;

  while (!S.gameOver && !S.victory) {
    if (defense !== "none") refreshDefense(world, S, occupied, plan, defense === "strong");

    const snap = buildSnapshot(world);
    startWave(S, WAVES, { reg: S.reg, snap, rng });
    const ws = S.ws;
    let steps = 0, spawnTimer = 0;
    while (!S.gameOver) {
      if (ws.spawnQueue > 0) {
        spawnTimer -= world.dt;
        if (spawnTimer <= 0) {
          spawnTimer = ws.spawnDelay;
          const tag = nextSpawnTag(S);
          spawnUnit(world, SPAWN, tag);
          ws.spawnQueue--;
        }
      }
      const structHp = stepOnce._structHp || (stepOnce._structHp = new Map());
      stepOnce(world, S, ws, structHp);
      steps++;
      if (ws.spawnQueue <= 0 && liveEnemyCount(world) === 0) break;
      if (steps > maxSteps) {
        // Forced clear: a handful of survivors (usually a tank stuck against
        // a wall it can't break, or a unit wedged in geometry) that would
        // otherwise stall the probe forever. Wiped with no bounty/results —
        // conservative for the attacker's economy, not a defense credit.
        for (const b of world.bodies) {
          if (b.alive && ((b.kind === "unit" && b.team === 2) || (b.kind === "vehicle" && b.team === 2))) {
            b.alive = false; b._paid = true;
          }
        }
        forcedClears++;
        break;
      }
    }
    if (S.gameOver) break;
    stepOnce._structHp = new Map(); // fresh attribution map per wave
    tryStall(S, WAVES, 0, null);
    if (forcedClears > 6) { stalemate = true; break; } // truly wedged run — bail out
    wavesCleared = ws.waveIdx + 1;
    if (S.victory) break; // attrition win flips at tryStall
    const advanced = advance(S, WAVES, buildSnapshot(world));
    if (!advanced) break;
    if (S.phase === PHASE.BUILD && S.ws.waveIdx >= WAVES.length) break;
  }

  const finalSnap = buildSnapshot(world);
  const playerBV = playerBookValueReal(world, S.resources);
  const attackerBV = attackerBookValueReal(S.reg);
  let verdict;
  if (S.attrition) verdict = "WIN (attrition)";
  else if (S.victory) verdict = "WIN (ledger)";
  else if (S.ledgerLoss) verdict = "LOSS (ledger)";
  else if (stalemate) verdict = "STALEMATE";
  else verdict = "LOSS (overrun)";

  return {
    seed, defense, wavesCleared, verdict,
    lives: S.lives, resources: Math.round(S.resources),
    regHeads: S.reg.heads, regTanks: S.reg.tanks, regScrap: Math.round(S.reg.scrap),
    playerBV: Math.round(playerBV), attackerBV: Math.round(attackerBV),
    finalSnap, stalemate,
  };
}

// ------------------------------------------------------------------- main
const args = process.argv.slice(2);
const seedsArg = args.find((a) => a.startsWith("--seeds="));
const cellsArg = args.find((a) => a.startsWith("--cells="));
let SEEDS = seedsArg ? parseInt(seedsArg.split("=")[1], 10) : 20;
const CELLS = cellsArg ? cellsArg.split("=")[1].split(",") : ["none", "median", "strong"];

const allResults = {};
for (const defense of CELLS) {
  const t0 = Date.now();
  const rows = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    rows.push(runSim(seed, defense));
  }
  const elapsed = (Date.now() - t0) / 1000;
  allResults[defense] = { rows, elapsed };
  console.log(`\n=== defense: ${defense} (${SEEDS} seeds, ${elapsed.toFixed(1)}s) ===`);
  for (const r of rows) {
    console.log(`seed ${String(r.seed).padStart(2)}: wave ${String(r.wavesCleared).padStart(2)}/50  ${r.verdict.padEnd(16)} lives=${r.lives}  reg(heads=${r.regHeads} tanks=${r.regTanks} scrap=${r.regScrap})  playerBV=${r.playerBV} attackerBV=${r.attackerBV}`);
  }
  const avgWave = rows.reduce((s, r) => s + r.wavesCleared, 0) / rows.length;
  const wins = rows.filter((r) => r.verdict.startsWith("WIN")).length;
  const attritionWins = rows.filter((r) => r.verdict === "WIN (attrition)").length;
  console.log(`  avg wave cleared: ${avgWave.toFixed(1)}  WIN rate: ${wins}/${rows.length}  attrition WINs: ${attritionWins}/${rows.length}`);
  if (elapsed > 120 && SEEDS > 10) {
    console.log(`  (cell exceeded ~2min at ${SEEDS} seeds — reducing subsequent cells to 10 seeds)`);
    SEEDS = 10;
  }
}

// ------------------------------------------------------------- sanity gate
console.log("\n=== SANITY RULES ===");
const none = allResults.none.rows;
const median = allResults.median.rows;
const strong = allResults.strong.rows;

const strongBreaks = strong.filter((r) => r.verdict === "WIN (attrition)").length / strong.length;
const noneMaxWave = Math.max(...none.map((r) => r.wavesCleared));
const medianMaxWave = Math.max(...median.map((r) => r.wavesCleared));
const medianVerdicts = new Set(median.map((r) => (r.verdict.startsWith("WIN") ? "WIN" : "LOSS")));

console.log(`(a) strong defense breaks the regiment (attrition WIN) in >=30% of seeds: ${(strongBreaks * 100).toFixed(0)}% — ${strongBreaks >= 0.3 ? "PASS" : "FAIL"}`);
console.log(`(b) no-defense never survives past wave ~8: max wave ${noneMaxWave} — ${noneMaxWave <= 8 ? "PASS" : "FAIL"}`);
console.log(`(c) median defense reaches wave 25+ with mixed verdicts: max wave ${medianMaxWave}, verdicts seen ${[...medianVerdicts].join("/")} — ${medianMaxWave >= 25 && medianVerdicts.size >= 2 ? "PASS" : "FAIL"}`);
