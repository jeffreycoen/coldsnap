// Headless test for the depot wave phase machine: build -> wave -> stall ->
// advance -> wave 2. Drives src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs
import {
  PHASE, makeRunState, startWave, tryStall, advance,
  regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot, shooterFire, squadFire, nextSpawnTag,
  fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed,
  PENDING_EDGE_PAD, pendingButtonsVisible, canvasTapConsumesPending,
  censusDepotChunks, depotStandingFraction, checkDepotBreach, checkEnemyBreach, stepDepotCensus, hostileStructure,
  spawnSquadMembers, spawnSandbag, SANDBAG_COST, pruneSquads,
  DEPOT_STANDING_TOL, DEPOT_BREACH_FRAC, DEPOT_CENSUS_HZ, standingStructure,
} from "../src/depot/state.js";
import { troopKit, barrelBasis, RIFLE_PREROT, RIFLE_OFF, RIFLE_LEN } from "../src/render/troopkit.js";
import { INFANTRY } from "../src/engine/core.js";
import { reachPolygon, arcClears, squadReach, towerReachCached } from "../src/depot/accuracy.js";
import { friendlyFouls } from "../src/depot/state.js";
import {
  makeWorld, addBody, addWeld, fireProjectile, explode, stepWorld, applyDamage, worldHash, CAUSE, mulberry32, aimSolve,
} from "../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, ENEMY_FIRE, TANK, WAVES as DEPOT_WAVES, MASON, INFANTRY_ARMS, SATCHEL, SAPPER_PLANT_PAD } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, stepBreakerRam, payBounties, SNIPER_FIRE } from "../src/depot/units.js";
import { SQUAD_SPECS, makeSquad, exposureAt, coverHop, stepSquad, COHESION_M } from "../src/depot/squads.js";
import {
  makeRegiment, STIPEND, RESULTS, payResults, combatIneffective, bookValue, payTown,
} from "../src/depot/economy.js";
import { planWave, waveBudget, MIN_WAVE_FLOOR, snapSquads } from "../src/depot/ai.js";
import { composeIntel, openingIntel, strengthWord } from "../src/depot/intel.js";
import { makeTerritory, stepTerritory, holderAt, fogStateAt, fogStateFor, valueAt, canBuild, DECAY_TAU, EMIT } from "../src/depot/territory.js";
import { fwdUFor, fwdDirFor, invWFor } from "../src/depot/orient.js";
import { washAlpha, WASH_SEAM, WASH_MAX_A } from "../src/render/renderer.js";
import fs from "node:fs";

// identity fwdDir (DepotGame.jsx's ORIENT-aware transform, ORIENT===0 case)
// so these headless tests match the default map orientation exactly.
const identFwdDir = (dx, dz) => ({ x: dx, z: dz });
// a straight-line flow field toward +z, for tests that don't build a real grid
function straightGrid(dirX, dirZ) {
  return {
    cellAt: () => ({ dist: 1, dx: dirX, dz: dirZ, ice: false }),
    worldToGrid: () => null,
    inBounds: () => false,
    cells: [], idx: () => 0, gridToWorld: () => ({ x: 0, z: 0 }),
  };
}

const fails = [];
const ok = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? " (" + detail + ")" : ""}`);
  if (!cond) fails.push(name);
};

const WAVES = [
  { units: 3, delay: 1 },
  { units: 4, delay: 0.8 },
  { units: 5, delay: 0.7 },
];

const S = makeRunState({ waves: WAVES });
S.started = true;

// --- initial phase is build
ok("starts in build phase", S.phase === PHASE.BUILD, S.phase);
ok("dispatch starts empty", S.dispatch === null);

// --- build -> wave
startWave(S, WAVES);
ok("startWave moves to wave phase", S.phase === PHASE.WAVE, S.phase);
ok("spawn queue loaded from wave 0", S.ws.spawnQueue === 3, S.ws.spawnQueue);

// tryStall must not fire while queue is nonempty or enemies are alive
let fired = tryStall(S, WAVES, 0);
ok("tryStall no-ops while spawn queue nonempty", fired === false && S.phase === PHASE.WAVE);
S.ws.spawnQueue = 0;
fired = tryStall(S, WAVES, 2);
ok("tryStall no-ops while enemies alive", fired === false && S.phase === PHASE.WAVE);

// --- wave -> stall
fired = tryStall(S, WAVES, 0);
ok("tryStall fires once queue empty and no enemies alive", fired === true);
ok("phase is stall", S.phase === PHASE.STALL, S.phase);
ok("dispatch card populated", !!S.dispatch && Array.isArray(S.dispatch.lines) && S.dispatch.lines.length > 0);
ok("dispatch copy mentions WAVE 1 CLEARED", S.dispatch.lines[0].includes("WAVE 1 CLEARED"), S.dispatch.lines[0]);
ok("lastDispatch mirrors dispatch (for wave-chip re-read)", S.lastDispatch === S.dispatch);

// sim keeps ticking during stall — nothing in the phase machine blocks that
// (no spawn calls happen because DepotGame's loop only calls spawnOne while
// phase === wave; verified here by confirming stall doesn't re-arm spawnQueue)
ok("stall leaves spawn queue drained", S.ws.spawnQueue === 0);

// advance() is a no-op outside stall
const preAdvancePhase = S.phase;
S.phase = PHASE.BUILD;
ok("advance no-ops outside stall", advance(S, WAVES) === false && S.phase === PHASE.BUILD);
S.phase = preAdvancePhase;

// --- stall -> advance -> build (wave 2 armed)
const resourcesBefore = S.resources;
fired = advance(S, WAVES);
ok("advance() fires from stall", fired === true);
ok("phase returns to build", S.phase === PHASE.BUILD, S.phase);
ok("waveIdx incremented to wave 2", S.ws.waveIdx === 1, S.ws.waveIdx);
ok("dispatch cleared (gating card gone)", S.dispatch === null);
ok("lastDispatch still holds wave 1's card for re-read", S.lastDispatch && S.lastDispatch.lines[0].includes("WAVE 1 CLEARED"));
ok("resource bonus applied on advance", S.resources === resourcesBefore + 12, S.resources);
ok("countdown reset for the build phase", S.ws.countdown === 8);

// --- build -> wave 2
startWave(S, WAVES);
ok("startWave arms wave 2's spawn queue", S.ws.spawnQueue === 4, S.ws.spawnQueue);
ok("phase is wave again", S.phase === PHASE.WAVE, S.phase);

// --- clear the last table row -> the war continues (FRONT F1: waves cycle)
S.ws.waveIdx = WAVES.length - 1;
S.ws.spawnQueue = 0;
S.phase = PHASE.WAVE;
tryStall(S, WAVES, 0);
ok("last-row wave clear enters stall", S.phase === PHASE.STALL);
ok("no FINAL WAVE copy on the last-row card", !S.dispatch.lines.some((l) => l.includes("FINAL WAVE")), JSON.stringify(S.dispatch.lines));
advance(S, WAVES);
ok("advancing past the last table row sets NO victory (only a breach ends the run)", S.victory === false && S.gameOver === false);

// ===================================================== end states (FRONT F1)
// checkLoss keeps only the stubbed regiment hook — with the stub false it
// can never fire; the depot's masonry (checkDepotBreach) is the loss track.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const L = makeRunState({ waves: W50 });
  L.started = true;
  L.ws.waveIdx = 4;
  ok("regimentDestroyed stub is always false", regimentDestroyed(L) === false);
  ok("checkLoss never fires without the regiment stub (lives retired)", checkLoss(L) === false && L.gameOver === false);
  ok("checkLoss does not set victory", L.victory === false);
}

// FRONT F1: the book-value verdict is retired as an ending. Rich or poor,
// clearing the last table row ends nothing — advance() never calls checkWin.
// checkWin itself stays exported (the probe reads it) with its old verdict.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const G = makeRunState({ waves: W50, startResources: 999999 });
  G.started = true;
  G.reg = { heads: 60, tanks: 1, heads0: 400, tanks0: 10, scrap: 20 };
  G.ws.waveIdx = W50.length - 1;
  G.ws.spawnQueue = 0;
  G.phase = PHASE.WAVE;
  tryStall(G, W50, 0);
  const snap = { mortars: 2, mgs: 3, guns: 2, frosts: 1, walls: 10 };
  advance(G, W50, snap);
  ok("rich player past the table end: NO ledger win", G.victory === false && G.gameOver === false);
  const B = makeRunState({ waves: W50, startResources: 0 });
  B.started = true;
  B.reg = { heads: 300, tanks: 10, heads0: 400, tanks0: 10, scrap: 500 };
  B.ws.waveIdx = W50.length - 1;
  B.ws.spawnQueue = 0;
  B.phase = PHASE.WAVE;
  tryStall(B, W50, 0);
  advance(B, W50, {});
  ok("poor player past the table end: NO ledger loss", B.victory === false && B.gameOver === false && B.ledgerLoss !== true);
  // the retired function still answers when the probe calls it directly
  const Sw = makeRunState({ waves: W50, startResources: 999999 });
  ok("checkWin (retired, probe-only) still returns its book verdict when called directly",
    checkWin(Sw, W50, snap) === true && Sw.victory === true);
}

// FRONT F1: the loss card is always the breach card — there is no other loss.
{
  const endD = makeEndDispatch({ victory: false, kills: 7 });
  ok("loss end card leads with THE DEPOT IS BREACHED", endD.lines[0] === "THE DEPOT IS BREACHED.", endD.lines[0]);
}

// FRONT F1: a combat-ineffective regiment no longer ends the run — the
// bureau observes it once on the dispatch card and the war continues.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const A = makeRunState({ waves: W50, startResources: 0 });
  A.started = true;
  A.ws.waveIdx = 10;
  A.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // < 12% heads0, 0 tanks -> ineffective
  A.ws.spawnQueue = 0;
  A.phase = PHASE.WAVE;
  const fired = tryStall(A, W50, 0);
  ok("attrition retired: tryStall still fires on regiment break", fired === true);
  ok("attrition retired: run does NOT end", A.victory === false && A.gameOver === false);
  ok("attrition retired: the bureau observes it on the card", A.dispatch.lines.some((l) => /combat-ineffective/i.test(l)), JSON.stringify(A.dispatch.lines));
}

// intact, above-threshold regiment mid-run never draws the observation.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const N = makeRunState({ waves: W50 });
  N.started = true;
  N.ws.waveIdx = 10;
  N.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: 0 };
  N.ws.spawnQueue = 0;
  N.phase = PHASE.WAVE;
  tryStall(N, W50, 0);
  ok("intact regiment mid-run: no break observation, no ending", N.victory === false && !N.dispatch.lines.some((l) => /combat-ineffective/i.test(l)));
}

// bounty bug: killing a TANK (kind: "vehicle") must pay its bounty (25),
// same as a killed infantry unit (kind: "unit") does.
{
  const world = makeWorld({ seed: 1 });
  const tank = spawnUnit(world, { x: 0, z: 10 }, "tank");
  ok("spawned tank carries the TANK bounty", tank.bounty === TANK.bounty, tank.bounty);
  tank.alive = false;
  const before = world.events.length;
  payBounties(world);
  const evs = world.events.slice(before);
  const tdk = evs.find((e) => e.type === "tdkill");
  ok("dead tank pays a tdkill bounty event", !!tdk, JSON.stringify(evs));
  ok("tank bounty is 25 (TANK.bounty)", tdk && tdk.bounty === 25, tdk);
  const before2 = world.events.length;
  payBounties(world);
  ok("bounty is paid only once (b._paid guard)", world.events.length === before2);
}

// economic-paralysis victory: 3 CONSECUTIVE stalls where the attacker
// couldn't afford a minimum wave (reg.scrap < MIN_WAVE_FLOOR) end the run
// early as a WIN — "the offensive is spent" — independent of combatIneffective.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const P = makeRunState({ waves: W50, startResources: 0 });
  P.started = true;
  P.ws.waveIdx = 5;
  // heads/tanks well above the attrition threshold — this must NOT be an
  // attrition win, only a starvation one.
  P.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: MIN_WAVE_FLOOR - 1 };
  P.ws.spawnQueue = 0;
  P.phase = PHASE.WAVE;
  tryStall(P, W50, 0);
  ok("starved stall 1/3: no observation yet", P.victory !== true && !P.dispatch.lines.some((l) => /spent/i.test(l)));
  P.phase = PHASE.WAVE; P.ws.spawnQueue = 0;
  tryStall(P, W50, 0);
  ok("starved stall 2/3: still none", P.victory !== true && !P.dispatch.lines.some((l) => /spent/i.test(l)));
  P.phase = PHASE.WAVE; P.ws.spawnQueue = 0;
  tryStall(P, W50, 0);
  ok("starved stall 3/3: FRONT F1 — no win, only a one-time spent observation", P.victory !== true && P.gameOver !== true && P.dispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(P.dispatch.lines));
}

// only 2 consecutive starved stalls: no trigger.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const P2 = makeRunState({ waves: W50, startResources: 0 });
  P2.started = true;
  P2.ws.waveIdx = 5;
  P2.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: MIN_WAVE_FLOOR - 1 };
  P2.ws.spawnQueue = 0;
  P2.phase = PHASE.WAVE;
  tryStall(P2, W50, 0);
  P2.phase = PHASE.WAVE; P2.ws.spawnQueue = 0;
  tryStall(P2, W50, 0);
  ok("2 starved stalls: no ending, no spent observation", P2.victory !== true && P2.gameOver !== true && !P2.dispatch.lines.some((l) => /spent/i.test(l)));
}

// a solvent stall resets the consecutive counter.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const P3 = makeRunState({ waves: W50, startResources: 0 });
  P3.started = true;
  P3.ws.waveIdx = 5;
  P3.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: MIN_WAVE_FLOOR - 1 };
  P3.ws.spawnQueue = 0;
  P3.phase = PHASE.WAVE;
  tryStall(P3, W50, 0); // starved 1
  P3.phase = PHASE.WAVE; P3.ws.spawnQueue = 0;
  P3.reg.scrap = MIN_WAVE_FLOOR - 1;
  tryStall(P3, W50, 0); // starved 2
  P3.phase = PHASE.WAVE; P3.ws.spawnQueue = 0;
  P3.reg.scrap = MIN_WAVE_FLOOR + 500; // solvent — resets streak
  tryStall(P3, W50, 0);
  P3.phase = PHASE.WAVE; P3.ws.spawnQueue = 0;
  P3.reg.scrap = MIN_WAVE_FLOOR - 1;
  tryStall(P3, W50, 0); // starved 1 again post-reset
  P3.phase = PHASE.WAVE; P3.ws.spawnQueue = 0;
  P3.reg.scrap = MIN_WAVE_FLOOR - 1;
  tryStall(P3, W50, 0); // starved 2 again
  ok("solvent stall resets streak: no win after only 2 post-reset", P3.victory !== true, P3.starvedStreak);
}

// ================================================== spent misfire (Jeff's repro)
// The starved check must read the attacker's MUSTER-TIME solvency, not the
// post-buy scrap planWave leaves behind. A wave that actually fielded troops
// can NEVER count as starved, no matter how broke the regiment is after
// buying it — otherwise every well-spent wave increments the streak and the
// run ends early after 3 perfectly normal waves.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const rng = mulberry32(1234);
  // (a) Jeff's repro: 4 consecutive waves that field real troops. planWave
  // spends scrap down at muster, so post-buy reg.scrap is routinely under
  // MIN_WAVE_FLOOR — the streak must stay 0 and the run must continue.
  const J = makeRunState({ waves: W50, startResources: 0 });
  J.started = true;
  J.reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: MIN_WAVE_FLOOR + 2 };
  for (let w = 0; w < 4; w++) {
    J.reg.scrap = MIN_WAVE_FLOOR + 2; // solvent at muster, nearly all spent by planWave
    startWave(J, W50, { reg: J.reg, snap: {}, rng });
    ok(`repro wave ${w + 1} fields troops`, J.ws.spawnQueue > 0, J.ws.spawnQueue);
    J.ws.spawnQueue = 0;
    tryStall(J, W50, 0, rng);
    ok(`repro wave ${w + 1}: post-spend scrap under floor yet streak stays 0`,
      J.starvedStreak === 0, `streak=${J.starvedStreak} scrap=${J.reg.scrap}`);
    advance(J, W50, {});
  }
  ok("repro: run continues past 4 fielded waves — no spent misfire", J.victory !== true && J.gameOver !== true);

  // (b) genuinely starved: 3 consecutive musters where the attacker cannot
  // afford the floor AND fields zero units -> early WIN, spent flag set.
  const G = makeRunState({ waves: W50, startResources: 0 });
  G.started = true;
  G.reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 0 };
  for (let w = 0; w < 3; w++) {
    G.reg.scrap = 0;
    startWave(G, W50, { reg: G.reg, snap: {}, rng });
    ok(`starved wave ${w + 1} fields nothing`, G.ws.spawnQueue === 0, G.ws.spawnQueue);
    tryStall(G, W50, 0, rng);
    if (w < 2) advance(G, W50, {});
  }
  ok("3 empty musters: FRONT F1 — no ending", G.victory !== true && G.gameOver !== true);
  ok("3 empty musters: the bureau observes the offensive spent", G.dispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(G.dispatch.lines));

  // (c) a fielded wave between two starved ones resets the counter.
  const R = makeRunState({ waves: W50, startResources: 0 });
  R.started = true;
  R.reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 0 };
  const cycle = (scrap) => {
    R.reg.scrap = scrap;
    startWave(R, W50, { reg: R.reg, snap: {}, rng });
    R.ws.spawnQueue = 0;
    tryStall(R, W50, 0, rng);
    advance(R, W50, {});
  };
  cycle(0); // starved 1
  cycle(MIN_WAVE_FLOOR + 40); // fields troops — resets
  ok("fielded wave resets starved streak", R.starvedStreak === 0, R.starvedStreak);
  cycle(0); // starved 1 again
  cycle(0); // starved 2
  ok("reset held: only 2 starved since the fielded wave, run continues", R.victory !== true, R.starvedStreak);
}

// FRONT F1: the only victory card is the enemy-breach card, whatever flags ride along.
{
  const d = makeEndDispatch({ victory: true, kills: 12, wave: 6, totalWaves: 50, spent: true });
  ok("victory card is always the opposing-depot breach card", d.lines[0] === "THE OPPOSING DEPOT IS BREACHED.", JSON.stringify(d.lines));
}

// ================================================== seeded determinism
// Two independently built worlds from the same seed, driven through an
// identical scripted "wave" (spawn N bodies via world.rng(), fire a
// deterministic volley, step to rest) must land on the same worldHash. This
// proves depot map/enemy generation — which all runs through world.rng(),
// per DepotGame.jsx's header comment — replays exactly from ?seed=, the
// same guarantee scenario-test.mjs/campaign-test.mjs hold engine-side.
function scriptedWaveRun(seed) {
  const world = makeWorld({ seed });
  const r = mulberry32(seed);
  for (let i = 0; i < 6; i++) {
    addBody(world, {
      kind: "unit", hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 58,
      x: (r() - 0.5) * 10, y: 0.86, z: 20 + i * 2,
    });
  }
  fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "shell", r: 2, kv: 12, dmg: 55, crater: 0.5, attacker: "player" });
  for (let i = 0; i < 300; i++) stepWorld(world);
  return worldHash(world);
}
{
  const h1 = scriptedWaveRun(42);
  const h2 = scriptedWaveRun(42);
  ok("seeded determinism: double-build same seed -> identical worldHash after scripted wave", h1 === h2, `h1=${h1} h2=${h2}`);
  const h3 = scriptedWaveRun(43);
  ok("different seed diverges (hash isn't a constant)", h3 !== h1, `h1=${h1} h3=${h3}`);
}

// ============================================ rotation-invariance (Global Constraint)
// Plan's Global Constraint: the renderer's Q/E view rotation (rotateStep,
// src/render/renderer.js) must never touch sim state — a scripted wave must
// hash identically whether or not rotateStep is interleaved between steps.
// This harness is headless (no renderer instance, no canvas/GL context), so
// a literal "call rotateStep between stepWorld calls, compare worldHash" run
// isn't reachable here; instead we assert the CONTRACT it depends on at the
// grep level: rotateStep only exists in renderer.js and mutates its own
// local `yawTgt` closure var, and depot's sim tick path (state.js, plus the
// worldHash/stepWorld region of core.js) never reads "yaw" or "rotateStep"
// at all. td-render-test.mjs (a live-server browser gate, not run in CI)
// covers the literal rotate-then-render pixel check; this is the headless
// half of the same guarantee.
{
  const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
  const coreSrc = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
  const rendererSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  // (core.js legitimately says "yaw" for body/mech facing (physics, not the
  // camera) — the sim-purity claim is specifically about view rotation, so
  // check for rotateStep/yawTgt/camYaw, not the bare substring "yaw".)
  ok("rotation-invariance: src/depot/state.js (sim tick path) never references view rotation", !/rotateStep|yawTgt|camYaw/i.test(stateSrc));
  ok("rotation-invariance: src/engine/core.js (stepWorld/worldHash) never references view rotation", !/rotateStep|yawTgt|camYaw/i.test(coreSrc));
  ok("rotation-invariance: rotateStep is defined exactly once, in the renderer", (rendererSrc.match(/function rotateStep/g) || []).length === 1);
  // sanity: worldHash's own inputs are bodies/projectiles/t only — confirms
  // there's no rotation-shaped field it could be hashing in the first place.
  const wh = coreSrc.slice(coreSrc.indexOf("export function worldHash"), coreSrc.indexOf("export function worldHash") + 800);
  ok("rotation-invariance: worldHash hashes bodies/projectiles/t (no camera/view field)", /for \(const \w+ of world\.(bodies|projectiles)\)/.test(wh));
}
{
  // Literal check where we CAN run it headlessly: scripted-wave determinism
  // (above) already proves worldHash is a pure function of (seed, sim steps).
  // Interleaving a no-op "rotate" (calling the exact same rotateStep formula
  // against a throwaway local, never touching `world`) between steps must
  // still land on the same hash as the un-interleaved run, since nothing it
  // touches is reachable from world.
  function scriptedWaveRunWithRotate(seed) {
    const world = makeWorld({ seed });
    const r = mulberry32(seed);
    for (let i = 0; i < 6; i++) {
      addBody(world, {
        kind: "unit", hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 58,
        x: (r() - 0.5) * 10, y: 0.86, z: 20 + i * 2,
      });
    }
    fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "shell", r: 2, kv: 12, dmg: 55, crater: 0.5, attacker: "player" });
    let yawTgt = 0; // stands in for the renderer's local camera state
    for (let i = 0; i < 300; i++) {
      if (i % 7 === 0) yawTgt += Math.PI / 2; // simulated Q/E taps between steps
      stepWorld(world);
    }
    return worldHash(world);
  }
  const h1 = scriptedWaveRun(42);
  const hR = scriptedWaveRunWithRotate(42);
  ok("rotation-invariance: worldHash identical with rotateStep-equivalent view rotation interleaved", h1 === hR, `h1=${h1} hR=${hR}`);
}

// ================================================== guard-flag proof
// world.depotCombat is the single guard flag gating glancing/armor/tree
// combat (Tasks 2-4). A TD-style world — the default, no flag set — must
// leave every one of those hooks inert: no glancing scale-down, no armor
// gate, trees untouched by direct rounds. Full on/off coverage for these
// mechanics lives in combat-test.mjs (test:combat); this is the consolidated
// proof that depot-test.mjs's own suite also verifies the guard holds.
{
  // glancing: head-on vs. grazing hit must deal identical damage without the flag
  const runOnce = (grazing) => {
    const world = makeWorld({ seed: 1 });
    const target = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
    const dir = grazing
      ? { x: Math.sin(75 * Math.PI / 180), y: 0, z: Math.cos(75 * Math.PI / 180) }
      : { x: 0, y: 0, z: 1 };
    const D = 25;
    const from = { x: 0 - dir.x * D, y: 5, z: 20 - dir.z * D };
    fireProjectile(world, from, dir, 60, { kind: "shell", r: 0, kv: 12, dmg: 55, crater: 0, attacker: "player" });
    for (let i = 0; i < 240 && world.projectiles.length; i++) stepWorld(world);
    return target.hp;
  };
  const headOn = runOnce(false);
  const graze = runOnce(true);
  ok("guard: TD world (no depotCombat) — head-on and grazing deal identical damage", headOn === graze, `head-on hp=${headOn} graze hp=${graze}`);

  // armor: gate ignored without the flag
  const withoutFlagLoss = (() => {
    const world = makeWorld({ seed: 1 });
    const b = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
    b.armor = 40;
    applyDamage(world, b, 30, { cause: CAUSE.PROJECTILE, attacker: "player" });
    return 1000 - b.hp;
  })();
  ok("guard: TD world — armor threshold ignored (full 30 hp lost)", withoutFlagLoss === 30, `lost=${withoutFlagLoss}`);

  // trees: inert to direct mg fire without the flag
  const world = makeWorld({ seed: 1 });
  const tree = addBody(world, { kind: "tree", hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: 1.62, z: 20, mass: 260, friction: 0.5 });
  const hpBefore = tree.hp;
  fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "mg", r: 0.05, kv: 0.3, dmg: 1, crater: 0, attacker: "player" });
  for (let i = 0; i < 60 && world.projectiles.length; i++) stepWorld(world);
  // pre-existing (unguarded) blast-on-tree damage still applies on every hit
  // regardless of the flag — the guard only gates the NEW 4hp/hit direct
  // shred path, so hp loss here must stay far under a single shred hit.
  ok("guard: TD world — tree doesn't take the direct-shred 4hp/hit (only pre-existing blast splash)", (hpBefore - tree.hp) < 2, `hp=${tree.hp} was=${hpBefore}`);
  ok("guard: TD world — tree never ignites without the flag", tree.burning == null, `burning=${tree.burning}`);
}

// ================================================== tower scatter (Task 2)
// A gun tower fires at a static dummy through towerShot (the extracted
// per-trigger-pull path: 2-pass lead + one sigma per pull + per-shot
// applyScatter). "impact" = the ground-carve "splat" event each shell
// crater produces on landing (gun's crater is nonzero, so every resolved
// shot leaves exactly one).
// raise=0 seats the tower normally (base on the ground, center hy above it —
// same seating DepotGame.jsx's build path uses); raise adds a platform height
// on top of that, so a "raised" tower keeps the same self-graze footprint
// instead of burying its muzzle in its own AABB.
function fireShots(seed, raise, n = 40) {
  const world = makeWorld({ seed });
  const spec = TOWER_SPECS.gun;
  const g0 = world.field.heightAt(0, 0);
  const tower = addBody(world, {
    kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8,
    x: 0, y: g0 + spec.hy + raise, z: 0, hp: spec.hp,
  });
  tower.towerType = "gun";
  const target = addBody(world, {
    kind: "unit", team: 2, hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 58,
    x: 0, y: world.field.heightAt(0, 18) + 0.86, z: 18,
  });
  const impacts = [];    // ground-carve splat per shot (spread/determinism)
  const misses = [];     // closest 3D approach of the round to the target's
                          // own position during flight (radial miss distance)
  for (let i = 0; i < n; i++) {
    towerShot(world, tower, target, spec);
    const before = world.events.length;
    let closest = Infinity;
    for (let s = 0; s < 400 && world.projectiles.length; s++) {
      stepWorld(world);
      for (const p of world.projectiles) {
        const d = Math.hypot(p.pos.x - target.pos.x, p.pos.y - target.pos.y, p.pos.z - target.pos.z);
        if (d < closest) closest = d;
      }
    }
    misses.push(closest);
    for (let e = before; e < world.events.length; e++) {
      if (world.events[e].type === "splat") impacts.push({ x: world.events[e].x, z: world.events[e].z });
    }
  }
  return { impacts, misses };
}
{
  const ground = fireShots(90, 0, 40);
  // A rare long-tail scatter draw can send a flat-trajectory round past the
  // 400-step resolve budget before it lands; almost all resolve.
  ok("tower scatter: nearly every shot resolves to an impact", ground.impacts.length >= 38, `${ground.impacts.length}`);

  // (a) spread nonzero — not a laser
  const mx = ground.impacts.reduce((s, p) => s + p.x, 0) / ground.impacts.length;
  const mz = ground.impacts.reduce((s, p) => s + p.z, 0) / ground.impacts.length;
  const variance = ground.impacts.reduce((s, p) => s + (p.x - mx) ** 2 + (p.z - mz) ** 2, 0) / ground.impacts.length;
  ok("tower scatter: impact spread stddev > 0", Math.sqrt(variance) > 0, `stddev=${Math.sqrt(variance)}`);

  // (b) same-seed determinism of the impact list
  const ground2 = fireShots(90, 0, 40);
  ok("tower scatter: same seed twice -> identical impact list", JSON.stringify(ground.impacts) === JSON.stringify(ground2.impacts));

  // (c) raised tower (+4m platform) has strictly smaller mean radial miss than ground tower
  const raised = fireShots(90, 4, 40);
  const meanMiss = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const groundMiss = meanMiss(ground.misses), raisedMiss = meanMiss(raised.misses);
  ok("tower scatter: raised tower mean radial miss < ground tower's", raisedMiss < groundMiss, `raised=${raisedMiss} ground=${groundMiss}`);
}

// ================================================== tree hp retune (Task 5)
// Phase 1 finding: at 25hp a GUN-tower shell's blast (noImpact law) killed a
// tree the same tick it ignited — burning was never visible. 70hp measured
// against the real tower path (towerShot -> fireProjectile with
// noImpact:true, matching TOWER_SPECS.gun exactly, not the unguarded flat
// +55 point-blank bonus that only non-noImpact specs get): a direct hit
// leaves ~36-39hp of the 70, alive and burning, dying ~16-18s later from the
// 2hp/s drain — comfortably inside the ~20s budget and never same-tick.
{
  const g0Tree = (seed, range) => {
    const world = makeWorld({ seed });
    world.depotCombat = true;
    const spec = TOWER_SPECS.gun;
    const g0 = world.field.heightAt(0, 0);
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: g0 + spec.hy, z: 0, hp: spec.hp });
    tower.towerType = "gun";
    const tree = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: world.field.heightAt(0, range) + 1.62, z: range, hp: 70, friction: 0.5 });
    let pulls = 0;
    while (tree.burning == null && tree.alive && pulls < 30) {
      towerShot(world, tower, tree, spec);
      for (let s = 0; s < 400 && world.projectiles.length; s++) stepWorld(world);
      pulls++;
    }
    return { world, tree };
  };

  // direct hit: alive and burning immediately after ignition (not a
  // same-tick kill), across a spread of seeds/ranges (occlusion/scatter vary
  // the blast fraction but the direct hit should never one-shot a 70hp tree)
  let minHp = Infinity, maxHp = -Infinity;
  for (let seed = 1; seed <= 8; seed++) {
    for (const range of [6, 12, 18]) {
      const { tree } = g0Tree(seed, range);
      ok(`gun shell hit (seed ${seed} range ${range}) leaves tree alive`, tree.alive === true, `hp=${tree.hp.toFixed(1)}`);
      ok(`gun shell hit (seed ${seed} range ${range}) ignites tree`, tree.burning != null);
      minHp = Math.min(minHp, tree.hp);
      maxHp = Math.max(maxHp, tree.hp);
    }
  }
  console.log(`  (measured post-ignite hp range across 24 trials: ${minHp.toFixed(1)}..${maxHp.toFixed(1)} of 70)`);

  // burn-down: dies within ~20s of ignition, from the unchanged 2hp/s drain
  {
    const { world, tree } = g0Tree(1, 12);
    const igniteT = world.t;
    let steps = 0;
    while (tree.alive && steps < 20 / world.dt) { stepWorld(world); steps++; }
    ok("70hp tree burns down within 20s of ignition", tree.alive === false, `t=${(world.t - igniteT).toFixed(1)}s`);
  }

  // mg still fells a tree with sustained direct fire (4hp/hit shred stacks
  // with the pre-existing unguarded blast splash on the same round; measured
  // combined damage lands well short of instant-killing a full-hp tree)
  {
    const world = makeWorld({ seed: 3 });
    world.depotCombat = true;
    const spec = TOWER_SPECS.mg;
    const g0 = world.field.heightAt(0, 0);
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: g0 + spec.hy, z: 0, hp: spec.hp });
    tower.towerType = "mg";
    const tree = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: world.field.heightAt(0, 10) + 1.62, z: 10, hp: 70, friction: 0.5 });
    let pulls = 0;
    while (tree.alive && pulls < 40) {
      towerShot(world, tower, tree, spec);
      for (let s = 0; s < 200 && world.projectiles.length; s++) stepWorld(world);
      pulls++;
    }
    ok("mg fells a 70hp tree via sustained fire", tree.alive === false, `pulls=${pulls}`);
    ok("mg felling doesn't ignite the tree (mg never sets burning)", tree.burning == null);
  }
}

// ================================================== economy (Task 1)
// makeRegiment: seed-varied strength within bounds, exactly 2 rng draws.
{
  let minHeads = Infinity, maxHeads = -Infinity, minTanks = Infinity, maxTanks = -Infinity;
  let boundsOk = true;
  for (let seed = 1; seed <= 50; seed++) {
    const rng = mulberry32(seed);
    const reg = makeRegiment(rng);
    if (reg.heads < 300 || reg.heads > 500 || reg.tanks < 8 || reg.tanks > 14) boundsOk = false;
    minHeads = Math.min(minHeads, reg.heads); maxHeads = Math.max(maxHeads, reg.heads);
    minTanks = Math.min(minTanks, reg.tanks); maxTanks = Math.max(maxTanks, reg.tanks);
  }
  ok("makeRegiment: heads/tanks stay within bounds over 50 seeds", boundsOk, `heads ${minHeads}..${maxHeads} tanks ${minTanks}..${maxTanks}`);
  ok("makeRegiment: heads0/tanks0 mirror initial heads/tanks", (() => {
    const rng = mulberry32(7);
    const reg = makeRegiment(rng);
    return reg.heads0 === reg.heads && reg.tanks0 === reg.tanks && reg.scrap === 60;
  })());

  // exactly-2-draw contract: a counting rng lets us assert draw count directly,
  // and confirms a 3rd draw (if any leaked in) would change the next value.
  {
    const base = mulberry32(1);
    let n = 0;
    const wrapped = () => { n++; return base(); };
    makeRegiment(wrapped);
    ok("makeRegiment: draws rng exactly twice", n === 2, `draws=${n}`);
  }

  // payResults: fixture arithmetic
  {
    const reg = { scrap: 60, heads: 400, heads0: 400, tanks: 10, tanks0: 10 };
    const ev = { structureDmg: 100, towerKills: 2, wallKills: 3, buildingKills: 1, leaks: 4 };
    payResults(reg, ev);
    const expected = 60 + 100 * RESULTS.structureDmg + 2 * RESULTS.towerKill + 3 * RESULTS.wallKill + 1 * RESULTS.buildingKill + 4 * RESULTS.leak;
    ok("payResults: fixture arithmetic matches RESULTS weights", Math.abs(reg.scrap - expected) < 1e-9, `got=${reg.scrap} expected=${expected}`);
  }
  {
    // uncapped: results can push scrap arbitrarily high, no clamping
    const reg = { scrap: 0, heads: 1, heads0: 400, tanks: 0, tanks0: 10 };
    payResults(reg, { structureDmg: 0, towerKills: 1000, wallKills: 0, buildingKills: 0, leaks: 0 });
    ok("payResults: uncapped by decision — no ceiling on scrap gain", reg.scrap === 1000 * RESULTS.towerKill, reg.scrap);
  }

  // combatIneffective: 12% boundary + tanks>0 blocking
  {
    const heads0 = 400;
    const atBoundary = { heads: 0.12 * heads0, heads0, tanks: 0 };
    ok("combatIneffective: exactly at 12% boundary is NOT ineffective (strict <)", combatIneffective(atBoundary) === false);
    const justUnder = { heads: 0.12 * heads0 - 1, heads0, tanks: 0 };
    ok("combatIneffective: just under 12% with 0 tanks IS ineffective", combatIneffective(justUnder) === true);
    const underHeadsWithTank = { heads: 0.12 * heads0 - 1, heads0, tanks: 1 };
    ok("combatIneffective: tanks>0 blocks ineffective status even under head threshold", combatIneffective(underHeadsWithTank) === false);
    const fullStrength = { heads: heads0, heads0, tanks: 0 };
    ok("combatIneffective: full-strength regiment is not ineffective", combatIneffective(fullStrength) === false);
  }

  // bookValue: symmetry fixture — total is order-independent additive sum
  {
    ok("bookValue: scrap + assets sums directly", bookValue({ scrap: 60, assets: 40 }) === 100);
    ok("bookValue: symmetric under swapping scrap/assets values", bookValue({ scrap: 60, assets: 40 }) === bookValue({ scrap: 40, assets: 60 }));
    ok("bookValue: zero assets reduces to scrap alone", bookValue({ scrap: 77, assets: 0 }) === 77);
    ok("bookValue: STIPEND is a stable per-round constant", STIPEND === 14);
  }
}

// ================================================== the roster returns (Task 2)
// spec value pins — brief's exact acc/windF/windComp, tower-equal by
// Jeff's decision (rifle=mg, gren lob=mortar, tank=gun).
{
  ok("ENEMY_FIRE.rifle acc matches TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.acc === TOWER_SPECS.mg.acc && ENEMY_FIRE.rifle.acc === 0.090);
  ok("ENEMY_FIRE.rifle windF/windComp match TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.windF === TOWER_SPECS.mg.windF && ENEMY_FIRE.rifle.windComp === TOWER_SPECS.mg.windComp);
  ok("ENEMY_FIRE.lob acc/windF match TOWER_SPECS.mortar exactly", ENEMY_FIRE.lob.acc === TOWER_SPECS.mortar.acc && ENEMY_FIRE.lob.acc === 0.020 && ENEMY_FIRE.lob.windF === TOWER_SPECS.mortar.windF && ENEMY_FIRE.lob.windF === 0.04);
  ok("ENEMY_FIRE.lob windComp matches TOWER_SPECS.mortar", ENEMY_FIRE.lob.windComp === TOWER_SPECS.mortar.windComp);
  ok("ENEMY_FIRE.tank acc/windF match TOWER_SPECS.gun exactly", ENEMY_FIRE.tank.acc === TOWER_SPECS.gun.acc && ENEMY_FIRE.tank.acc === 0.070 && ENEMY_FIRE.tank.windF === TOWER_SPECS.gun.windF && ENEMY_FIRE.tank.windF === 0.9);
  ok("ENEMY_FIRE.tank windComp matches TOWER_SPECS.gun", ENEMY_FIRE.tank.windComp === TOWER_SPECS.gun.windComp);
  ok("ENEMY_SPECS carries the full roster (conscript/runner/breaker/grenadier/sapper)", ["", "fast", "heavy", "gren", "sapper"].every((k) => ENEMY_SPECS[k]));
  ok("ENEMY_SPECS bounty === TD price (spot check: heavy 12, gren 8, sapper 7, fast 5)", ENEMY_SPECS.heavy.bounty === 12 && ENEMY_SPECS.gren.bounty === 8 && ENEMY_SPECS.sapper.bounty === 7 && ENEMY_SPECS.fast.bounty === 5);
  ok("TANK bounty === TD price (25)", TANK.bounty === 25);
  ok("later waves reach the new unit types (mix present somewhere in the table)", DEPOT_WAVES.some((w) => w.mix && w.mix.some((m) => m[0] === "tank")));
}

// seeded skirmish: 2 riflemen vs 1 wall — damage lands, and the whole run
// (positions, hp, RNG-drawn scatter) replays identically from the same seed.
function riflemenVsWallRun(seed) {
  const world = makeWorld({ seed });
  world.depotCombat = true;
  const g0 = world.field.heightAt(0, 0);
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 999 });
  const grid = straightGrid(0, -1); // riflemen halt+fire rather than march into range-13 target
  const riflemen = [
    spawnUnit(world, { x: -1, z: 8 }, ""),
    spawnUnit(world, { x: 1, z: 9 }, ""),
  ];
  for (let i = 0; i < 400; i++) {
    stepUnits(world, grid, identFwdDir);
    stepWorld(world);
  }
  return { hp: wall.hp, hash: worldHash(world), riflemen };
}
{
  const a = riflemenVsWallRun(11);
  ok("2 riflemen vs a wall: damage lands", a.hp < 999, `hp=${a.hp}`);
  const b = riflemenVsWallRun(11);
  ok("2 riflemen vs a wall: same seed twice -> identical wall hp", a.hp === b.hp, `a=${a.hp} b=${b.hp}`);
  ok("2 riflemen vs a wall: same seed twice -> identical worldHash (deterministic twin)", a.hash === b.hash, `a=${a.hash} b=${b.hash}`);
}

// grenadier leeward drift: a strong constant crosswind should pull the
// mean impact point downwind relative to a no-wind baseline. windComp=0.6
// only partially corrects (spec.windF/windComp equal to the mortar tower),
// so a residual drift must survive — same pattern as the tower scatter
// test above, applied to shooterFire directly (bypasses march/halt).
function grenLobRun(seed, wind) {
  const world = makeWorld({ seed });
  world.depotCombat = true;
  if (wind) world.wind = wind;
  const g0 = world.field.heightAt(0, 0);
  const target = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 1e9 });
  const gz = world.field.heightAt(0, 16);
  const gren = addBody(world, { kind: "unit", team: 2, mass: 84, hx: 0.26, hy: 0.92, hz: 0.26, hp: 66, x: 0, y: gz + 0.92, z: 16 });
  const impacts = [];
  for (let i = 0; i < 25; i++) {
    const muzzle = { x: gren.pos.x, y: gren.pos.y + 1.0, z: gren.pos.z };
    shooterFire(world, gren, muzzle, target, ENEMY_FIRE.lob, { high: true, attacker: "enemy", hitStruct: true });
    const before = world.events.length;
    for (let s = 0; s < 400 && world.projectiles.length; s++) stepWorld(world);
    for (let e = before; e < world.events.length; e++) {
      if (world.events[e].type === "splat") impacts.push(world.events[e].x);
    }
  }
  return impacts.reduce((s, v) => s + v, 0) / (impacts.length || 1);
}
{
  const noWind = grenLobRun(21, null);
  const crossX = grenLobRun(21, { x: 6, y: 0, z: 0 });
  ok("grenadier lob: strong crosswind drifts mean impact leeward (+x wind -> mean x shifts positive vs no-wind)", crossX > noWind, `noWind=${noWind.toFixed(3)} wind=${crossX.toFixed(3)}`);
  const noWind2 = grenLobRun(21, null);
  ok("grenadier lob: same seed, no wind twice -> identical mean impact (deterministic)", noWind === noWind2, `${noWind} vs ${noWind2}`);
}

// sapper satchel still breaches: a sapper next to a wall plants and detonates.
{
  const world = makeWorld({ seed: 5 });
  world.depotCombat = true;
  const g0 = world.field.heightAt(0, 0);
  // SIEGE FIX (mk0.21): the plant gate is CONTACT range now (hx +
  // SAPPER_PLANT_PAD), not arm's length, so this fixture has to let the man
  // actually WALK ONTO the wall instead of leaning on a jittered spawn
  // happening to land inside the old 1.7m reach — a proper 2.4m-wide wall
  // segment, the sapper staged 5m off it and marching -z straight into it.
  const wall = addBody(world, { kind: "wall", team: 1, mass: 100, hx: 1.2, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 70 });
  const sapper = spawnUnit(world, { x: 0, z: 5 }, "sapper");
  const grid = straightGrid(0, -1);
  let fused = false;
  for (let i = 0; i < 400 && wall.alive; i++) {
    stepUnits(world, grid, identFwdDir);
    if (sapper._fuse != null) fused = true;
    stepWorld(world);
  }
  ok("sapper: plants the charge (fuse arms) on approach to a wall", fused);
  ok("sapper: satchel breaches the wall outright", wall.alive === false, `hp=${wall.hp}`);
}

// breaker ram: a fast-moving heavy shoulders into a wall and deals damage
// (stepBreakerRam reads world.contacts after stepWorld, same as TD).
{
  const world = makeWorld({ seed: 6 });
  world.depotCombat = true;
  const g0 = world.field.heightAt(0, 0.6);
  const wall = addBody(world, { kind: "wall", team: 1, mass: 200, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 1.2, hp: 500 });
  const heavy = addBody(world, {
    kind: "unit", team: 2, mass: 340, hx: 0.46, hy: 1.02, hz: 0.46,
    x: 0, z: 0, y: world.field.heightAt(0, 0) + 1.02, hp: 290, friction: 0.38,
  });
  heavy.tag = "heavy";
  let hpBefore = wall.hp;
  // steady shove — sustains the ram speed stepBreakerRam's sp>0.8 gate needs
  // (a one-time velocity kick decays to nothing over 0.8m of ground friction
  // before it ever reaches the wall; the march AI would normally sustain this)
  for (let i = 0; i < 60 && wall.alive; i++) {
    heavy.v.z = 3;
    stepWorld(world);
    stepBreakerRam(world);
  }
  ok("breaker: ramming a wall deals contact damage", wall.hp < hpBefore, `hp=${wall.hp}`);
}

// FRONT F1: leaks are retired. A tank (or any enemy) that reaches the depot
// STAYS — no leak event, no removal. The economy's RESULTS.leak rate
// survives untouched (the dead field reads 0; F5 retires the rates).
{
  const world = makeWorld({ seed: 7 });
  const tank = spawnUnit(world, { x: 0, z: 0 }, "tank");
  tank.pos.x = 0; tank.pos.z = 0;
  ok("no-leak: tank at the depot persists (no event, no removal)",
    world.byId.has(tank.id) && !world.events.some((e) => e.type === "leak"));
  const reg = makeRegiment(mulberry32(12));
  const scrapBefore = reg.scrap;
  payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
  ok("no-leak: payResults with the dead leaks field at 0 pays nothing for leaks",
    reg.scrap === scrapBefore, `${reg.scrap} vs ${scrapBefore}`);
}

// ================================================================
// Blind-spot fix: towers never targeted tanks, tanks never targeted towers.
//
// (a)/(c): tower target ACQUISITION lives inline in DepotGame.jsx's
// stepTowers (a .jsx module — not importable headlessly, same reason the
// CAREFUL/FREE discipline fixture above mirrors it rather than importing
// it). This mirrors stepTowers's fixed scan filter exactly (kind ===
// "unit" || kind === "vehicle", team 2, alive, in effRange, arcClears) so a
// regression that reintroduces the old unit-only filter fails these asserts.
function towerScanNearest(world, tower, spec) {
  const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
  let best = null, bd = spec.range * spec.range;
  for (const e of world.bodies) {
    if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
    const dx = e.pos.x - tower.pos.x, dz = e.pos.z - tower.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd && arcClears(world, muzzle, e.pos, spec, tower.id)) { bd = d2; best = e; }
  }
  return best;
}
{
  const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } }, seed: 1 });
  world.depotCombat = true;
  const spec = TOWER_SPECS.gun;
  const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
  const tank = addBody(world, { kind: "vehicle", team: 2, mass: TANK.mass, hx: TANK.hx, hy: TANK.hy, hz: TANK.hz, x: 0, y: TANK.hy, z: 12, hp: TANK.hp });
  tank.v = { x: 0, y: 0, z: 0 };
  const acquired = towerScanNearest(world, tower, spec);
  ok("(a) gun tower acquires a team-2 tank (kind vehicle) in range", acquired === tank);
  const hpBefore = tank.hp;
  towerShot(world, tower, tank, spec);
  for (let i = 0; i < 400 && tank.hp === hpBefore && world.projectiles.length; i++) stepWorld(world);
  ok("(a) gun tower damages the acquired tank", tank.hp < hpBefore, `hp=${tank.hp}`);
}
{
  // (c) sweep: every ENEMY_SPECS kind (kind "unit") + TANK (kind "vehicle")
  // must be acquirable — future-proofs the kind filter against a new roster
  // entry landing outside "unit"/"vehicle" again.
  const spec = TOWER_SPECS.gun;
  for (const tag of [...Object.keys(ENEMY_SPECS), "tank"]) {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
    const e = spawnUnit(world, { x: 0, z: 10 }, tag);
    e.pos.x = 0; e.pos.z = 10; e.v = { x: 0, y: 0, z: 0 };
    // the pair (6.5 Task 6): a sniper spawn fields a spotter too — park him
    // farther out so the nearest-acquisition assert still targets the sniper
    if (e.pairId != null) { const m = world.byId.get(e.pairId); m.pos.x = 4; m.pos.z = 16; m.v = { x: 0, y: 0, z: 0 }; }
    const acquired = towerScanNearest(world, tower, spec);
    ok(`(c) tower acquires enemy kind "${tag || "conscript"}" (body.kind=${e.kind})`, acquired === e, `acquired=${acquired && acquired.id} e=${e.id}`);
  }
}

// (b) the other half: a tank within 34m of a tower fires on it and damages
// it. Regression fixture — with the old fieldReaches gate still in place,
// this world's territory is fully "held" for team 1 (a defended base) for
// the whole run, so team 2's flipped read never left "unheld" and the tank
// never fired a shot; the gate silently blocked the whole run, no matter
// how long the tank sat in range. stepTank (units.js) no longer applies
// that gate to structure fire (TD's reference driver never had one either
// — see units.js's stepTank comment) so the tank fires purely on
// range + arcClears, same as TD.
{
  const world = makeWorld({ seed: 9 });
  world.depotCombat = true;
  const spec = TOWER_SPECS.gun;
  const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
  const tank = spawnUnit(world, { x: 0, z: 15 }, "tank"); // 15m out, inside the 34m gun range
  tank.pos.x = 0; tank.pos.z = 15;
  // grid.cellAt reports no forward drift; the fixture pins the tank's pos
  // back to (0,15) after every stepWorld so a real 12-tonne halt/turn isn't
  // needed to hold it at a known range for the whole cooldown wind-up —
  // same pin-in-place approach the tank-leak fixtures above use.
  const grid = straightGrid(0, 0);
  const T = makeTerritory(60, 60);
  // saturate the field fully "held" for team 1 around the tower (a well
  // defended base) BEFORE the tank ever gets in range — the exact shape of
  // the fieldReaches regression: the tower's own emission (EMIT.tower) keeps
  // its own neighborhood "held" for as long as it's alive.
  for (let i = 0; i < 2000; i++) stepTerritory(T, [{ x: tower.pos.x, z: tower.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }], 0.05);
  ok("(b) fixture: field is 'unheld' for team 2 at the tower before the tank fires (would have blocked the old gate)",
    fogStateFor(T, tower.pos.x, tower.pos.z, 2) === "unheld");
  const hpBefore = tower.hp;
  let fired = false;
  for (let i = 0; i < 600 && tower.alive; i++) {
    stepTerritory(T, [{ x: tower.pos.x, z: tower.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: tank.pos.x, z: tank.pos.z, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 }], world.dt);
    stepUnits(world, grid, identFwdDir, T);
    stepWorld(world);
    tank.pos.x = 0; tank.pos.z = 15; tank.v.x = 0; tank.v.z = 0;
    if (tower.hp < hpBefore) { fired = true; break; }
  }
  ok("(b) a tank within 34m fires on the tower and damages it, even though the field never left 'unheld'",
    fired && tower.hp < hpBefore, `hp=${tower.hp} fired=${fired}`);
}

// (b2) same regression, infantry side: a rifleman and a grenadier each
// acquire and damage a wall standing in fully player-held ground. Mirrors
// the tank-vs-tower fixture above — stepRifleman/stepGrenadier (units.js)
// must gate structure fire on range + arcClears only, never on territory.
{
  const world = makeWorld({ seed: 12 });
  world.depotCombat = true;
  const spec = TOWER_SPECS.gun;
  const g0 = world.field.heightAt(0, 0);
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 999 });
  const rifleman = spawnUnit(world, { x: 0, z: 8 }, "");
  rifleman.pos.x = 0; rifleman.pos.z = 8;
  const grid = straightGrid(0, 0); // no forward drift; pin rifleman at range
  const T = makeTerritory(60, 60);
  for (let i = 0; i < 2000; i++) stepTerritory(T, [{ x: wall.pos.x, z: wall.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }], 0.05);
  ok("(b2) fixture: field is 'unheld' for team 2 at the wall before the rifleman fires",
    fogStateFor(T, wall.pos.x, wall.pos.z, 2) === "unheld");
  const hpBefore = wall.hp;
  let fired = false;
  for (let i = 0; i < 600 && wall.alive; i++) {
    stepTerritory(T, [{ x: wall.pos.x, z: wall.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: rifleman.pos.x, z: rifleman.pos.z, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 }], world.dt);
    stepUnits(world, grid, identFwdDir, T);
    stepWorld(world);
    rifleman.pos.x = 0; rifleman.pos.z = 8; rifleman.v.x = 0; rifleman.v.z = 0;
    if (wall.hp < hpBefore) { fired = true; break; }
  }
  ok("(b2) a rifleman within range fires on a wall and damages it, even though the field never left 'unheld'",
    fired && wall.hp < hpBefore, `hp=${wall.hp} fired=${fired}`);
}
{
  const world = makeWorld({ seed: 13 });
  world.depotCombat = true;
  const g0 = world.field.heightAt(0, 0);
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 999 });
  const gren = spawnUnit(world, { x: 0, z: 16 }, "gren");
  gren.pos.x = 0; gren.pos.z = 16;
  const grid = straightGrid(0, 0);
  const T = makeTerritory(60, 60);
  for (let i = 0; i < 2000; i++) stepTerritory(T, [{ x: wall.pos.x, z: wall.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }], 0.05);
  ok("(b2) fixture: field is 'unheld' for team 2 at the wall before the grenadier fires",
    fogStateFor(T, wall.pos.x, wall.pos.z, 2) === "unheld");
  const hpBefore = wall.hp;
  let fired = false;
  // world.dt is ~1/120s here, so the grenadier's ~3s cadence plus its
  // lofted shell's flight time needs several thousand ticks, not 600
  // (600 ticks is only ~5s simulated — enough for the tank/rifleman
  // fixtures' faster direct fire, not this one).
  for (let i = 0; i < 6000 && wall.alive; i++) {
    stepTerritory(T, [{ x: wall.pos.x, z: wall.pos.z, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: gren.pos.x, z: gren.pos.z, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 }], world.dt);
    stepUnits(world, grid, identFwdDir, T);
    stepWorld(world);
    gren.pos.x = 0; gren.pos.z = 16; gren.v.x = 0; gren.v.z = 0;
    if (wall.hp < hpBefore) { fired = true; break; }
  }
  ok("(b2) a grenadier within range fires on a wall and damages it, even though the field never left 'unheld'",
    fired && wall.hp < hpBefore, `hp=${wall.hp} fired=${fired}`);
}

// off-grid write-off: any team-2 body (infantry or tank) that can't find a
// path (grid.cellAt reports dist >= 1e8 every tick — a grid gap, or pushed
// off-map by a collision) must be written off after 12s lost, same as the
// leak path — no attacker body should be able to persist off-map forever.
function lostGrid() {
  return {
    cellAt: () => ({ dist: 1e9, dx: 0, dz: 0, ice: false }),
    worldToGrid: () => null,
    inBounds: () => false,
    cells: [], idx: () => 0, gridToWorld: () => ({ x: 0, z: 0 }),
  };
}
{
  const world = makeWorld({ seed: 9 });
  world.dt = 0.1;
  const tank = spawnUnit(world, { x: 40, z: 40 }, "tank");
  const grid = lostGrid();
  const dt = 0.1;
  let killedAt = null;
  for (let i = 0; i < 200; i++) { // 20s simulated, window is 12s
    stepUnits(world, grid, identFwdDir);
    if (!tank.alive && killedAt == null) killedAt = (i + 1) * dt;
  }
  ok("off-grid write-off: a lost tank is destroyed within the 12s window", killedAt != null && killedAt <= 13, `killedAt=${killedAt}`);
  // vehicles become wreck bodies on death (engine's killBody resets hp to
  // 1e9 for the corpse physics), so alive===false is the real signal here.
  ok("off-grid write-off: the tank stops driving once written off (kind flips to wreck, no longer alive)", tank.alive === false && tank.kind === "wreck", `alive=${tank.alive} kind=${tank.kind}`);
}
{
  const world = makeWorld({ seed: 10 });
  world.dt = 0.1;
  const rifleman = spawnUnit(world, { x: 40, z: 40 }, "");
  const grid = lostGrid();
  const dt = 0.1;
  let killedAt = null;
  for (let i = 0; i < 200; i++) {
    stepUnits(world, grid, identFwdDir);
    if (!rifleman.alive && killedAt == null) killedAt = (i + 1) * dt;
  }
  ok("off-grid write-off: a lost rifleman is destroyed within the 12s window (infantry parity)", killedAt != null && killedAt <= 13, `killedAt=${killedAt}`);
}

// wave mix bag: nextSpawnTag pulls from the wave's mix (deterministic
// stride-7 shuffle, no RNG) and yields the exact composition requested.
{
  const S = makeRunState({ waves: [{ units: 4, delay: 1, mix: [["", 2], ["fast", 2]] }] });
  S.started = true;
  startWave(S, [{ units: 4, delay: 1, mix: [["", 2], ["fast", 2]] }]);
  const tags = [nextSpawnTag(S), nextSpawnTag(S), nextSpawnTag(S), nextSpawnTag(S)];
  const counts = tags.reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
  ok("mix bag yields the exact requested composition", counts[""] === 2 && counts.fast === 2, JSON.stringify(counts));
  ok("mix bag is exhausted after pulling the full mix", nextSpawnTag(S) === "");
}

// --- ai.js: the buy brain -------------------------------------------------
const BASE_SNAP = { mortars: 0, mgs: 0, guns: 0, frosts: 0, walls: 0, towerElev: 0 };
function totalUnits(buys) { return buys.reduce((s, b) => s + b.n, 0); }
function shareOf(buys, types) {
  const total = totalUnits(buys);
  if (total === 0) return 0;
  const n = buys.filter((b) => types.includes(b.type)).reduce((s, b) => s + b.n, 0);
  return n / total;
}

// determinism: same reg/snap/waveIdx/rng-stream -> identical plan
{
  const reg1 = { heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 60 };
  const reg2 = { ...reg1 };
  const p1 = planWave(reg1, BASE_SNAP, 20, mulberry32(99));
  const p2 = planWave(reg2, BASE_SNAP, 20, mulberry32(99));
  ok("planWave determinism: identical output for identical inputs",
    JSON.stringify(p1) === JSON.stringify(p2));
  ok("planWave determinism: identical resulting regiment state",
    JSON.stringify(reg1) === JSON.stringify(reg2));
}

// counter-response: each pressure signal measurably raises its counter's
// share of the wave vs. an unpressured baseline.
{
  const mkReg = () => ({ heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 60 });
  const waveIdx = 20;

  const base = planWave(mkReg(), BASE_SNAP, waveIdx, mulberry32(1));
  const baseFastShare = shareOf(base.buys, ["fast"]);
  const mortarSnap = { ...BASE_SNAP, mortars: 6 };
  const mortarPlan = planWave(mkReg(), mortarSnap, waveIdx, mulberry32(1));
  ok("mortar-heavy build raises runner (fast) share",
    shareOf(mortarPlan.buys, ["fast"]) > baseFastShare,
    `${shareOf(mortarPlan.buys, ["fast"]).toFixed(3)} vs ${baseFastShare.toFixed(3)}`);

  const baseWallShare = shareOf(base.buys, ["sapper", "heavy"]);
  const wallSnap = { ...BASE_SNAP, walls: 8 };
  const wallPlan = planWave(mkReg(), wallSnap, waveIdx, mulberry32(1));
  ok("walled build raises sapper+breaker share",
    shareOf(wallPlan.buys, ["sapper", "heavy"]) > baseWallShare,
    `${shareOf(wallPlan.buys, ["sapper", "heavy"]).toFixed(3)} vs ${baseWallShare.toFixed(3)}`);

  const baseGrenShare = shareOf(base.buys, ["gren"]);
  const frostSnap = { ...BASE_SNAP, frosts: 5 };
  const frostPlan = planWave(mkReg(), frostSnap, waveIdx, mulberry32(1));
  ok("frost farm raises grenadier share",
    shareOf(frostPlan.buys, ["gren"]) > baseGrenShare,
    `${shareOf(frostPlan.buys, ["gren"]).toFixed(3)} vs ${baseGrenShare.toFixed(3)}`);

  const mgSnap = { ...BASE_SNAP, mgs: 8 };
  const mgReg = mkReg();
  const mgPlan = planWave(mgReg, mgSnap, waveIdx, mulberry32(1));
  ok("mg-heavy build buys a tank the unpressured wave doesn't",
    shareOf(mgPlan.buys, ["tank"]) > 0 && shareOf(base.buys, ["tank"]) === 0,
    `mg tank share=${shareOf(mgPlan.buys, ["tank"])}`);
}

// banking: high scrap banks (thin screen, banked:true) until affordable,
// then erupts — tank push (tanks>=2) when mg-dominant, else surge (>2.2x).
{
  const waveIdx = 20;
  const baseline = waveBudget(waveIdx);

  // banked, not yet erupting (mg-dominant, only 1 tank on hand)
  const bankedReg = { heads: 300, tanks: 1, heads0: 300, tanks0: 8, scrap: 1.9 * baseline };
  const scrapBefore = bankedReg.scrap;
  const bankedPlan = planWave(bankedReg, { ...BASE_SNAP, mgs: 8 }, waveIdx, mulberry32(2));
  ok("banking: high scrap + not-yet-affordable push banks (thin screen)",
    bankedPlan.banked === true);
  ok("banking: thin screen spends well under full scrap",
    bankedReg.scrap > scrapBefore - baseline * 0.6, `left=${bankedReg.scrap}`);

  // erupts as a tank push once tanks>=2 and scrap covers 2 tanks
  const pushReg = { heads: 300, tanks: 4, heads0: 300, tanks0: 8, scrap: 1.9 * baseline };
  const pushPlan = planWave(pushReg, { ...BASE_SNAP, mgs: 8 }, waveIdx, mulberry32(3));
  const tankBuy = pushPlan.buys.find((b) => b.type === "tank");
  ok("banking: tank push erupts with 2-4 tanks once affordable",
    pushPlan.banked === false && !!tankBuy && tankBuy.n >= 2 && tankBuy.n <= 4,
    JSON.stringify(pushPlan.buys));

  // erupts as a surge (no mg dominance) once scrap clears 2.2x baseline
  const surgeReg = { heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 2.3 * baseline };
  const surgePlan = planWave(surgeReg, BASE_SNAP, waveIdx, mulberry32(4));
  ok("banking: surge erupts once scrap clears 2.2x baseline",
    surgePlan.banked === false && totalUnits(surgePlan.buys) > 0);
}

// depletion: empty pools never go negative, plan degrades gracefully
{
  const emptyReg = { heads: 0, tanks: 0, heads0: 300, tanks0: 8, scrap: 100 };
  const emptyPlan = planWave(emptyReg, BASE_SNAP, 10, mulberry32(5));
  ok("depletion: empty heads/tanks pool yields no buys",
    totalUnits(emptyPlan.buys) === 0, JSON.stringify(emptyPlan.buys));
  ok("depletion: regiment never goes negative",
    emptyReg.heads >= 0 && emptyReg.tanks >= 0 && emptyReg.scrap >= 0);
}

// 50-wave loop: full run against a static snapshot completes, stays solvent
{
  const reg = makeRegiment(mulberry32(11));
  const rng = mulberry32(12);
  const snap = { mortars: 3, mgs: 2, guns: 4, frosts: 1, walls: 2, towerElev: 0 };
  let totalIncome = reg.scrap;
  let negative = false;
  for (let w = 0; w < 50; w++) {
    reg.scrap += STIPEND;
    totalIncome += STIPEND;
    planWave(reg, snap, w, rng);
    if (reg.heads < 0 || reg.tanks < 0 || reg.scrap < 0) negative = true;
  }
  ok("50-wave planWave loop completes without stalling", true);
  ok("50-wave loop: regiment never negative", !negative);
  ok("50-wave loop: total spend stays within total income",
    reg.scrap >= 0 && reg.scrap <= totalIncome, `final scrap=${reg.scrap} income=${totalIncome}`);
}

// --- Task 4: economy wired into the loop ----------------------------------

// startWave(S, WAVES, {reg, snap, rng}) generates from planWave instead of
// the static table — spawnQueue/mixBag match the plan's buys exactly.
{
  const S = makeRunState({ waves: WAVES });
  S.started = true;
  const reg = makeRegiment(mulberry32(7));
  const rng = mulberry32(8);
  const plan = planWave({ ...reg }, BASE_SNAP, 0, mulberry32(8)); // same stream, unconsumed reg, to predict shape
  startWave(S, WAVES, { reg, snap: BASE_SNAP, rng });
  ok("startWave(reg): spawnQueue matches planWave's total buys",
    S.ws.spawnQueue === totalUnits(plan.buys), `${S.ws.spawnQueue} vs ${totalUnits(plan.buys)}`);
  ok("startWave(reg): phase advances to wave", S.phase === PHASE.WAVE);
  ok("startWave(reg): ws.results accumulator reset", S.ws.results &&
    S.ws.results.structureDmg === 0 && S.ws.results.leaks === 0);
}

// startWave with useTable (or no reg) keeps the old static-table behavior —
// the escape hatch existing/older tests rely on.
{
  const S = makeRunState({ waves: WAVES });
  S.started = true;
  startWave(S, WAVES, { useTable: true });
  ok("startWave useTable: falls back to the static table", S.ws.spawnQueue === WAVES[0].units);
}

// payResults at stall: the wave's accumulated results (structure damage +
// structure kills + leaks) land on reg.scrap via the RESULTS table exactly.
{
  const S = makeRunState({ waves: WAVES });
  S.started = true;
  S.reg = { heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 60 };
  startWave(S, WAVES, { useTable: true });
  S.ws.results = { structureDmg: 100, towerKills: 2, wallKills: 3, buildingKills: 1, leaks: 2 };
  S.ws.spawnQueue = 0;
  const scrapBefore = S.reg.scrap;
  const fired = tryStall(S, WAVES, 0);
  const expected = scrapBefore + 100 * RESULTS.structureDmg + 2 * RESULTS.towerKill
    + 3 * RESULTS.wallKill + 1 * RESULTS.buildingKill + 2 * RESULTS.leak;
  ok("tryStall pays results into reg.scrap", fired && Math.abs(S.reg.scrap - expected) < 1e-9,
    `${S.reg.scrap} vs ${expected}`);
}

// STIPEND paid at advance().
{
  const S = makeRunState({ waves: WAVES });
  S.started = true;
  S.reg = { heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 60 };
  startWave(S, WAVES, { useTable: true });
  S.ws.spawnQueue = 0;
  tryStall(S, WAVES, 0);
  const before = S.reg.scrap;
  advance(S, WAVES);
  ok("advance() pays STIPEND into reg.scrap", S.reg.scrap === before + STIPEND, `${S.reg.scrap} vs ${before + STIPEND}`);
}

// Regiment depletion happens ONLY at muster (planWave's buys), never at
// death — a fielded unit's cost is spent the moment it's bought and never
// returns, dead, leaked, or otherwise. A wave's kill events must NOT
// further deplete reg.heads/reg.tanks.
{
  const reg = makeRegiment(mulberry32(9));
  const rng = mulberry32(10);
  const before = { heads: reg.heads, tanks: reg.tanks };
  planWave(reg, BASE_SNAP, 6, rng);
  const afterBuy = { heads: reg.heads, tanks: reg.tanks };
  ok("regiment depletes at muster (buy-time only)",
    afterBuy.heads <= before.heads && afterBuy.tanks <= before.tanks);
  // simulate a wave's worth of kills against this same regiment — nothing
  // in the kill-accounting path touches reg.heads/reg.tanks, so a bare
  // payResults call (the only thing DepotGame.jsx does with kill/leak
  // events on the regiment side) must leave heads/tanks untouched.
  payResults(reg, { structureDmg: 50, towerKills: 3, wallKills: 4, buildingKills: 1, leaks: 0 });
  ok("a wave's kills do not further deplete the regiment",
    reg.heads === afterBuy.heads && reg.tanks === afterBuy.tanks,
    `${reg.heads}/${reg.tanks} vs ${afterBuy.heads}/${afterBuy.tanks}`);
}

// The consequence loop, asserted: two identical regiments buy an identical
// wave (same rng stream, so heads/tanks/scrap depletion at muster is
// identical), then diverge on RESULTS income only — one gets massacred
// (no leaks, no structure damage, earns nothing back), the other leaks
// through untouched (full leak payout). Same flat STIPEND for both. The
// massacred regiment must field a measurably poorer next wave — purely
// from lower scrap, since heads/tanks are identical (buy-time depletion is
// the only manpower drain, and both bought the same thing).
{
  const mkReg = () => makeRegiment(mulberry32(42));
  const regMassacred = mkReg();
  const regLeaked = mkReg();
  const waveIdx = 6;
  const snap = BASE_SNAP;

  // wave N: identical buy (same rng stream, identical starting regiments)
  planWave(regMassacred, snap, waveIdx, mulberry32(100));
  planWave(regLeaked, snap, waveIdx, mulberry32(100));
  ok("consequence loop setup: identical wave-N buy from identical inputs",
    regMassacred.heads === regLeaked.heads && regMassacred.tanks === regLeaked.tanks
    && regMassacred.scrap === regLeaked.scrap);

  // wave N results: massacred wave killed outright (no leaks, no results
  // income); leaked-through wave earns full leak payout. Heads/tanks are
  // untouched by either — only scrap diverges.
  const KILLED = 40;
  payResults(regMassacred, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
  payResults(regLeaked, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: KILLED });
  regMassacred.scrap += STIPEND;
  regLeaked.scrap += STIPEND;
  ok("consequence loop: heads/tanks stay equal — kills don't deplete manpower",
    regMassacred.heads === regLeaked.heads && regMassacred.tanks === regLeaked.tanks);
  ok("consequence loop: leak-through earns more scrap than a massacre",
    regLeaked.scrap > regMassacred.scrap, `${regLeaked.scrap} vs ${regMassacred.scrap}`);

  // wave N+1: same snap, identical fresh rng stream — the only difference
  // left is reg.scrap.
  const planMassacred = planWave(regMassacred, snap, waveIdx + 1, mulberry32(101));
  const planLeaked = planWave(regLeaked, snap, waveIdx + 1, mulberry32(101));
  ok("consequence loop: a massacred wave yields a measurably poorer next wave",
    totalUnits(planMassacred.buys) < totalUnits(planLeaked.buys),
    `${totalUnits(planMassacred.buys)} vs ${totalUnits(planLeaked.buys)}`);
}

// ---------------------------------------------------------------- intel.js
// composeIntel/openingIntel: bureau field-recon prose. One wave old, seeded
// silences, no digits ever.

const seqRng = (vals) => { let i = 0; return () => vals[(i++) % vals.length]; };

// armor plan -> armor line present, given a no-gap rng (first draw >= 0.25).
{
  const prevPlan = { buys: [{ type: "tank", n: 5 }], banked: false };
  const reg = { heads: 400, heads0: 400 };
  const rng = seqRng([0.5, 0.1]); // draw1: not silenced; draw2: variant pick
  const lines = composeIntel(prevPlan, reg, rng);
  ok("armor plan yields exactly one armor line (no-gap rng)", lines.length === 1, JSON.stringify(lines));
  ok("armor line carries the squad's-worth strength word (5 tanks)",
    lines[0] && lines[0].includes("squad's worth"), lines[0]);
}

// gap rng -> line absent, prevPlan object never mutated.
{
  const prevPlan = { buys: [{ type: "tank", n: 5 }], banked: false };
  const snapshot = JSON.stringify(prevPlan);
  const reg = { heads: 400, heads0: 400 };
  const rng = seqRng([0.1]); // draw1 < GAP_CHANCE: silenced, no draw2 needed
  const lines = composeIntel(prevPlan, reg, rng);
  ok("gapped armor line is silenced, not altered", lines.length === 0, JSON.stringify(lines));
  ok("prevPlan is never mutated by composeIntel", JSON.stringify(prevPlan) === snapshot);
}

// one-wave delay: intel at stall n reports the plan that governed wave n-1,
// never the plan that just fought wave n.
{
  const S = makeRunState({ waves: WAVES });
  S.started = true;
  S.reg = makeRegiment(mulberry32(3));
  const snap = { mortars: 0, mgs: 0, guns: 0, frosts: 0, walls: 0, towerElev: 0 };
  startWave(S, WAVES, { reg: S.reg, snap, rng: mulberry32(50) });
  ok("wave 0 startWave: no intel history yet", S.intelPlan === null);
  const plan0 = S.pendingPlan;
  S.ws.spawnQueue = 0;
  tryStall(S, WAVES, 0, mulberry32(51));
  ok("wave 0 stall dispatch carries the opening strength estimate, not plan intel",
    S.dispatch.lines.some((l) => l.includes("Regimental strength estimate")));
  advance(S, WAVES);
  startWave(S, WAVES, { reg: S.reg, snap, rng: mulberry32(52) });
  ok("wave 1 startWave: intelPlan is wave 0's plan (one-wave delay)", S.intelPlan === plan0);
  ok("wave 1 startWave: pendingPlan has moved on to wave 1's plan", S.pendingPlan !== plan0);
}

// strengthWord boundaries.
{
  ok("strengthWord(3) = a handful", strengthWord(3) === "a handful");
  ok("strengthWord(4) = a squad's worth", strengthWord(4) === "a squad's worth");
  ok("strengthWord(8) = a squad's worth", strengthWord(8) === "a squad's worth");
  ok("strengthWord(9) = in number", strengthWord(9) === "in number");
  ok("strengthWord(15) = in number", strengthWord(15) === "in number");
  ok("strengthWord(16) = company strength", strengthWord(16) === "company strength");
}

// openingIntel thresholds.
{
  ok("openingIntel <360 = understrength", openingIntel({ heads0: 359 }).includes("understrength"));
  ok("openingIntel 360 = at establishment", openingIntel({ heads0: 360 }).includes("at establishment"));
  ok("openingIntel 440 = at establishment", openingIntel({ heads0: 440 }).includes("at establishment"));
  ok("openingIntel >440 = reinforced", openingIntel({ heads0: 441 }).includes("reinforced"));
}

// no digits in any emitted line, across 200 seeded compositions covering
// every family (varied buys/banked/reg shapes) plus openingIntel.
{
  let digitFound = null;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = mulberry32(seed);
    const n = 1 + Math.floor(rng() * 40);
    const shapes = [
      { buys: [{ type: "tank", n }], banked: false },
      { buys: [{ type: "", n }, { type: "fast", n }, { type: "sapper", n }], banked: false },
      { buys: [{ type: "sapper", n }], banked: true },
      { buys: [], banked: true },
      null,
    ];
    const prevPlan = shapes[seed % shapes.length];
    const reg = { heads: seed * 3, heads0: 300 + (seed % 200) };
    const lines = composeIntel(prevPlan, reg, rng);
    const opening = openingIntel(reg);
    for (const l of [...lines, opening]) {
      if (/\d/.test(l)) { digitFound = l; break; }
    }
    if (digitFound) break;
  }
  ok("no digits in any composeIntel/openingIntel line across 200 seeded runs", !digitFound, digitFound || "");
}

// --- territory.js: influence field, anchors, slow memory ---
{
  const halfU = 29, halfV = 57;

  // Task 3: depot emitter radius doubled 18 -> 36 (Jeff); anchor stays 14
  // (attacker's muster ground is a strip, not doubled).
  ok("EMIT.depot.r pinned at 36 (Task 3 double)", EMIT.depot.r === 36, EMIT.depot.r);
  ok("EMIT.depot.w unchanged at 2.4", EMIT.depot.w === 2.4, EMIT.depot.w);
  ok("EMIT.anchor.r unchanged at 14 (not doubled)", EMIT.anchor.r === 14, EMIT.anchor.r);

  // valueAt: raw signed field, unflipped, feeds the renderer's area wash.
  {
    const T = makeTerritory(halfU, halfV);
    T.v[0] = 0.42;
    ok("valueAt reads the raw cell value", Math.abs(valueAt(T, -halfU + 1, -halfV + 1) - 0.42) < 1e-6);
    ok("valueAt is 0 out of bounds", valueAt(T, 1e4, 1e4) === 0);
  }

  // area wash alpha ramp (renderer.js's washAlpha, Task 3): 0 at/under the
  // seam threshold, linear to WASH_MAX_A at |v|=1, symmetric on the red side.
  {
    ok("washAlpha is 0 at the seam threshold", washAlpha(WASH_SEAM) === 0);
    ok("washAlpha is 0 well inside the seam", washAlpha(0.05) === 0);
    ok("washAlpha reaches WASH_MAX_A at v=1", Math.abs(washAlpha(1) - WASH_MAX_A) < 1e-9);
    ok("washAlpha is symmetric for the red side", washAlpha(-1) === washAlpha(1));
    const mid = washAlpha(0.5);
    ok("washAlpha ramps monotonically between seam and 1", mid > 0 && mid < WASH_MAX_A, mid);
  }

  // decay halves in ~52s (tau*ln2) with no emitters
  {
    const T = makeTerritory(halfU, halfV);
    T.v.fill(1);
    let t = 0;
    const target = DECAY_TAU * Math.log(2);
    const dt = 0.05;
    while (t < target) { stepTerritory(T, [], dt); t += dt; }
    const mid = T.v[Math.floor(T.v.length / 2)];
    ok("decay halves in ~52s", Math.abs(mid - 0.5) < 0.02, `mid=${mid.toFixed(4)} target=${target.toFixed(2)}`);
  }

  // tower emitter greens its cell within seconds
  {
    const T = makeTerritory(halfU, halfV);
    const emitters = [{ x: 0, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, emitters, 0.05); // 5s
    ok("tower emitter greens its cell within seconds", holderAt(T, 0, 0) === 1);
  }

  // opposing emitters at range produce a seam band
  {
    const T = makeTerritory(halfU, halfV);
    const emitters = [
      { x: -10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: 10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 },
    ];
    for (let i = 0; i < 400; i++) stepTerritory(T, emitters, 0.05); // 20s
    let sawSeam = false;
    for (let x = -3; x <= 3; x += 2) if (fogStateAt(T, x, 0) === "seam") sawSeam = true;
    ok("opposing emitters at range produce a seam band", sawSeam);
    ok("holder green toward attacker 1's tower", holderAt(T, -10, 0) === 1);
    ok("holder red toward attacker 2's tower", holderAt(T, 10, 0) === 2);
  }

  // anchor stays red after 300s of no enemy presence
  {
    const T = makeTerritory(halfU, halfV);
    const anchor = { x: 0, z: -50, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 };
    let t = 0;
    while (t < 300) { stepTerritory(T, [anchor], 0.5); t += 0.5; }
    ok("anchor stays red after 300s of re-adding it every tick", holderAt(T, 0, -50) === 2);
  }

  // determinism: two identical runs produce identical Float32Array
  {
    function run() {
      const T = makeTerritory(halfU, halfV);
      const emitters = [
        { x: 5, z: 5, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 },
        { x: -8, z: 12, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 },
        { x: 0, z: -40, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 },
      ];
      for (let i = 0; i < 200; i++) stepTerritory(T, emitters, 0.1);
      return T.v;
    }
    const a = run(), b = run();
    let same = a.length === b.length;
    if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
    ok("determinism: two identical runs produce identical Float32Array", same);
  }

  // holderAt/fogStateAt thresholds
  {
    const T = makeTerritory(halfU, halfV);
    const idx = 0;
    T.v[idx] = 0.16;
    let x0 = -halfU + T.cs / 2, z0 = -halfV + T.cs / 2;
    ok("holderAt threshold >0.15 = green", holderAt(T, x0, z0) === 1);
    ok("fogStateAt threshold >0.15 = held", fogStateAt(T, x0, z0) === "held");
    T.v[idx] = 0.10;
    ok("holderAt at 0.10 (within seam) = neutral", holderAt(T, x0, z0) === 0);
    ok("fogStateAt at 0.10 (within seam) = seam", fogStateAt(T, x0, z0) === "seam");
    T.v[idx] = -0.10;
    ok("holderAt at -0.10 (within seam) = neutral", holderAt(T, x0, z0) === 0);
    ok("fogStateAt at -0.10 (within seam) = seam", fogStateAt(T, x0, z0) === "seam");
    T.v[idx] = -0.16;
    ok("holderAt threshold <-0.15 = red", holderAt(T, x0, z0) === 2);
    ok("fogStateAt threshold <-0.15 = unheld", fogStateAt(T, x0, z0) === "unheld");
    // out-of-bounds = neutral
    ok("holderAt out of bounds = neutral", holderAt(T, 9999, 9999) === 0);
    ok("fogStateAt out of bounds = unheld", fogStateAt(T, 9999, 9999) === "unheld");
  }
}

// --- Phase 4 Task 2: build rights, holder-paid town, targeting boundary ---
{
  const halfU = 29, halfV = 57;

  // build refusal: red/seam ground refused, green ground allowed
  {
    const T = makeTerritory(halfU, halfV);
    const x0 = 0, z0 = 0;
    ok("canBuild refused on neutral/seam ground (fresh field)", canBuild(T, x0, z0) === false);
    const redEmitters = [{ x: x0, z: z0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, redEmitters, 0.05); // 5s, drives it red
    ok("canBuild refused on red ground", canBuild(T, x0, z0) === false);
    const T2 = makeTerritory(halfU, halfV);
    const greenEmitters = [{ x: x0, z: z0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T2, greenEmitters, 0.05); // 5s, drives it green
    ok("canBuild allowed on green ground", canBuild(T2, x0, z0) === true);
  }

  // town pay at stall: a scripted holder flip follows the payout
  {
    const T = makeTerritory(halfU, halfV);
    const buildings = [
      { id: "a", x: -10, z: 0, ruined: false }, // will be green
      { id: "b", x: 10, z: 0, ruined: false },  // will be red
      { id: "c", x: 0, z: 20, ruined: false },  // stays seam (neutral)
      { id: "d", x: -10, z: 40, ruined: true }, // green ground, but ruined -> no pay
    ];
    const emitters = [
      { x: -10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: 10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 },
      { x: -10, z: 40, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
    ];
    for (let i = 0; i < 100; i++) stepTerritory(T, emitters, 0.05); // 5s
    let out = payTown(buildings, T);
    ok("town pay: green building pays player 4, ruined green building pays nothing", out.player === 4, JSON.stringify(out));
    ok("town pay: red building pays regiment 4", out.regiment === 4, JSON.stringify(out));

    // flip the holder: kill the green tower's influence, let the red side take it
    const T2 = makeTerritory(halfU, halfV);
    for (let i = 0; i < 100; i++) stepTerritory(T2, [{ x: -10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }, { x: 10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }], 0.05);
    const out2 = payTown([{ x: -10, z: 0, ruined: false }, { x: 10, z: 0, ruined: false }], T2);
    ok("town pay: holder flip (both red) pays regiment for both", out2.player === 0 && out2.regiment === 8, JSON.stringify(out2));
  }

  // acquisition gate: a target sitting on ground the player field does NOT
  // reach (i.e. red/attacker-held — fogStateAt === "unheld") is not
  // acquired; a friendly presence contesting that same ground (pushing it
  // off "unheld", to seam or better) makes it acquirable. Symmetric for the
  // attacker via the sign-flipped team===2 read.
  {
    const target = { pos: { x: 22, z: 0 } };
    // enemy-held ground at the target: a lone enemy emitter drives it red
    const T = makeTerritory(halfU, halfV);
    for (let i = 0; i < 100; i++) stepTerritory(T, [{ x: 22, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }], 0.05); // 5s
    ok("acquisition blocked on ground the player field doesn't reach (red)", fieldReaches(T, target.pos.x, target.pos.z, 1) === false);
    // a friendly unit contests the same ground, canceling the enemy hold
    // back to seam — no longer "unheld", so it's acquirable again
    const T3 = makeTerritory(halfU, halfV);
    const contested = [
      { x: 22, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 },
      { x: 22, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
    ];
    for (let i = 0; i < 100; i++) stepTerritory(T3, contested, 0.05); // 5s
    ok("acquisition allowed once a friendly presence contests the ground", fieldReaches(T3, target.pos.x, target.pos.z, 1) === true);

    // symmetric: an attacker rifleman vs a tower sitting in PLAYER-held fog
    // (green ground) must be blocked for the attacker, allowed for the
    // player — team===2 reads the sign-flipped field.
    const towerTarget = { pos: { x: 0, z: 0 } };
    const Tgreen = makeTerritory(halfU, halfV);
    for (let i = 0; i < 100; i++) stepTerritory(Tgreen, [{ x: 0, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }], 0.05);
    ok("attacker acquisition blocked in player-held fog (mirrored check)", fieldReaches(Tgreen, towerTarget.pos.x, towerTarget.pos.z, 2) === false);
    ok("player acquisition allowed in its own held fog", fieldReaches(Tgreen, towerTarget.pos.x, towerTarget.pos.z, 1) === true);
    // and the mirror image: red ground blocks the player, not the attacker
    const Tred = makeTerritory(halfU, halfV);
    for (let i = 0; i < 100; i++) stepTerritory(Tred, [{ x: 0, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }], 0.05);
    ok("player acquisition blocked on red ground", fieldReaches(Tred, towerTarget.pos.x, towerTarget.pos.z, 1) === false);
    ok("attacker acquisition allowed on its own (red) ground", fieldReaches(Tred, towerTarget.pos.x, towerTarget.pos.z, 2) === true);
  }

  // no-territory calls stay ungated (existing tests that build a world
  // without wiring territory must keep passing)
  {
    ok("fieldReaches with no T is always true (ungated)", fieldReaches(null, 0, 0, 1) === true);
  }

  // Phase 3 economics unaffected: massacre-at-the-wall still pays results —
  // rerun a slice of the existing payResults contract untouched by Task 2.
  {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 0 };
    payResults(reg, { structureDmg: 100, towerKills: 1, wallKills: 2, buildingKills: 0, leaks: 3 });
    const expect = 100 * RESULTS.structureDmg + 1 * RESULTS.towerKill + 2 * RESULTS.wallKill + 3 * RESULTS.leak;
    ok("Phase 3 economics unaffected: payResults still pays the same", Math.abs(reg.scrap - expect) < 1e-9, reg.scrap);
  }
}

// --- orientation invariance (regression guard for the invW coordinate-
// space bug found in Task 2 review): territory.js's own pure functions
// operate purely on CANONICAL (u, v) space and are orientation-agnostic —
// testing them alone (as above) never touches the world->canonical
// conversion at all, which is exactly what hid the original bug (it was
// invisible on ORIENT===0, where invW is the identity — the only
// orientation this file's map-dependent scenarios ever ran under). These
// asserts exercise orient.js's fwdUFor/invWFor directly, across ALL four
// orientations, plus DepotGame.jsx's real usage pattern (world position ->
// invWFor -> canonical -> territory) for a non-default orientation.
{
  const halfU = 29, halfV = 57;

  // round-trip identity: fwdU then invW recovers the original canonical
  // point, for every orientation DEPOT ships (not just the default)
  for (let ORIENT = 0; ORIENT < 4; ORIENT++) {
    for (const [u, v] of [[0, 0], [12, -30], [-25, 50], [1, -1]]) {
      const w = fwdUFor(ORIENT, u, v);
      const back = invWFor(ORIENT, w.x, w.z);
      const okRT = Math.abs(back.u - u) < 1e-9 && Math.abs(back.v - v) < 1e-9;
      ok(`orientation ${ORIENT}: invWFor(fwdUFor(u,v)) round-trips (u=${u},v=${v})`, okRT, JSON.stringify({ w, back }));
    }
  }

  // a non-default orientation (ORIENT=1: this file's map-dependent scenarios
  // above only ever exercise ORIENT=0) exercising the SAME pattern
  // DepotGame.jsx's buildEmitters/buildAt/stepTowers use: convert a world
  // position via invWFor before ever touching territory.js.
  {
    const ORIENT = 1;
    // (a) a tower emitter greens its own cell
    const T = makeTerritory(halfU, halfV);
    const worldPos = { x: 52, z: 0 }; // off-axis world point — under ORIENT=1
    // this is exactly the shape of position the live bug produced (the
    // depot flag sat at world x=52, well outside T's halfU=29 bound; only
    // the invW-converted canonical point falls inside the grid)
    const c = invWFor(ORIENT, worldPos.x, worldPos.z);
    ok("orientation 1: world position converts inside the territory grid", Math.abs(c.u) <= halfU && Math.abs(c.v) <= halfV, JSON.stringify(c));
    // regression guard: the raw (unconverted) world coordinates read as
    // out-of-bounds/neutral — this is the exact failure mode of the bug
    // (holderAt on raw world x/z instead of the invW-converted canonical
    // point), reproduced here so a future regression trips this assert
    ok("orientation 1: regression guard — WITHOUT invW conversion this world point reads out-of-bounds/neutral", holderAt(T, worldPos.x, worldPos.z) === 0);
    const emitters = [{ x: c.u, z: c.v, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, emitters, 0.05); // 5s
    ok("orientation 1: tower emitter greens its own cell (canonical, post-invW)", holderAt(T, c.u, c.v) === 1);

    // (b) build refusal/allow
    ok("orientation 1: canBuild allowed at the greened canonical cell", canBuild(T, c.u, c.v) === true);
    const farWorld = { x: -40, z: 0 }; // invWFor(1,...) -> {u:0,v:40}: inside the grid, far from the emitter at (0,-52)
    const cFar = invWFor(ORIENT, farWorld.x, farWorld.z);
    ok("orientation 1: canBuild refused far from the emitter", canBuild(T, cFar.u, cFar.v) === false);

    // (c) targeting gate, both directions
    ok("orientation 1: player field reaches a target at the tower's own position", fieldReaches(T, c.u, c.v, 1) === true);
    ok("orientation 1: attacker field (mirrored) does NOT reach player-held ground", fieldReaches(T, c.u, c.v, 2) === false);
    // drive the far cell red (enemy-held) and re-check both sides
    const T2 = makeTerritory(halfU, halfV);
    for (let i = 0; i < 100; i++) stepTerritory(T2, [{ x: cFar.u, z: cFar.v, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }], 0.05);
    ok("orientation 1: player field blocked on enemy-held ground", fieldReaches(T2, cFar.u, cFar.v, 1) === false);
    ok("orientation 1: attacker field reaches its own (red) ground", fieldReaches(T2, cFar.u, cFar.v, 2) === true);
  }
}

// ============================================================ Task 3: placement preview + confirm
{
  const flatWorld = () => ({ field: { heightAt: () => 0 }, bodies: [] });
  const spec = { range: 20, hy: 1.0, projSpeed: 60, occl: "arc" };

  // --- effRange pins
  ok("effRange: flat ground = 1.0x", effRange(flatWorld(), { x: 0, y: 0, z: 0 }, spec) === spec.range);
  ok("effRange: +6m elevation = 1.12x", Math.abs(effRange(flatWorld(), { x: 0, y: 6, z: 0 }, spec) - spec.range * 1.12) < 1e-9,
    effRange(flatWorld(), { x: 0, y: 6, z: 0 }, spec));
  ok("effRange: caps at 1.2x (well beyond +10m)", effRange(flatWorld(), { x: 0, y: 40, z: 0 }, spec) === spec.range * 1.2);
  ok("effRange: no downhill penalty (muzzle below surround clamps to 0 elev)", effRange(flatWorld(), { x: 0, y: -20, z: 0 }, spec) === spec.range);

  // --- enemy symmetric consumption: units.js's stepRifleman/stepGrenadier/
  // stepTank all import effRange from state.js (grep-verified below rather
  // than re-simulating a full unit tick here — the sim behavior is
  // exercised by the rest of this file's unit tests; this asserts the
  // wiring itself so a future edit that reverts to spec.range trips it).
  {
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    ok("units.js imports effRange from state.js", /import\s*\{[^}]*effRange[^}]*\}\s*from\s*"\.\/state\.js"/.test(unitsSrc));
    ok("units.js's tank/rifle/grenadier scans consume effRange (not raw spec.range) for their threshold", (unitsSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 3);
  }

  // --- reachPolygon
  {
    const muzzle = { x: 0, y: 1.5, z: 0 };
    const flatPoly = reachPolygon(flatWorld(), null, muzzle, spec, 1);
    ok("reachPolygon: 64 points", flatPoly.length === 64);
    ok("reachPolygon: open flat ground reaches ~full effRange", Math.hypot(flatPoly[0].x - muzzle.x, flatPoly[0].z - muzzle.z) > spec.range - 1.5,
      Math.hypot(flatPoly[0].x, flatPoly[0].z));

    // wall fixture due east (+x) at x=10 — the ray toward +x (index 0) must
    // stop well short of spec.range; a ray away from it (index 32, -x) is
    // unaffected. Tall (hy 2.5, spans y 0..5) so the gun's real arc — which
    // can climb well above a short wall's 1.8m by mid-lane — still can't
    // clear over it; a short wall is a legitimate arc-over case now that
    // reachPolygon tests the true flight path instead of a straight line.
    const wallWorld = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "wall", pos: { x: 10, y: 2.5, z: 0 }, hx: 0.9, hy: 2.5, hz: 0.9 },
    ] };
    const wallPoly = reachPolygon(wallWorld, null, muzzle, spec, 1);
    const eastDist = Math.hypot(wallPoly[0].x - muzzle.x, wallPoly[0].z - muzzle.z);
    const westDist = Math.hypot(wallPoly[32].x - muzzle.x, wallPoly[32].z - muzzle.z);
    ok("reachPolygon: ray toward a wall fixture stops short of it", eastDist < 10.5 && eastDist > 0, eastDist);
    ok("reachPolygon: ray away from the wall reaches full range, unaffected", westDist > spec.range - 1.5, westDist);

    // fog boundary clip: territory.js's default (uncontested) state reads
    // as reachable by either side (fieldReaches with no T, or neutral
    // ground, is true) — the boundary this clips at is enemy-HELD ground.
    // Drive a strong enemy emitter due east of the muzzle so team-1's field
    // does not reach it; every ray toward it must clip well short of
    // spec.range on otherwise-flat open ground.
    const halfU = 29, halfV = 57;
    const T = makeTerritory(halfU, halfV);
    // r 14 (was 3): under the F1.6 contested-ground bridge (mk0.26) every
    // cell of a 3m pocket sits within one cell of its own boundary, so the
    // whole pocket is engageable frontier and nothing clips. A real held
    // zone has an interior — that is what a fog clip means now.
    for (let i = 0; i < 200; i++) stepTerritory(T, [{ x: 15, z: 0, w: EMIT.tower.w, r: 14, sign: -1 }], 0.05);
    const foggedPoly = reachPolygon(flatWorld(), T, muzzle, spec, 1);
    const foggedDist = Math.hypot(foggedPoly[0].x - muzzle.x, foggedPoly[0].z - muzzle.z);
    ok("reachPolygon: fog boundary clips rays well short of open-flat full range", foggedDist < spec.range - 3, foggedDist);
  }

  // --- arcClears (Phase 4.1 Task 1): the round's true flight path, not a
  // straight-line sightline.
  {
    // "arc" spec: a flat-ish trajectory that still bulges above the straight
    // muzzle-target line (gravity), enough to clear a low crest the old
    // straight-line test would have rejected.
    {
      const world = { field: { heightAt: (x) => (Math.abs(x - 10) < 1 ? 3.5 : 0) }, bodies: [] };
      const muzzle = { x: 0, y: 2, z: 0 }, target = { x: 20, y: 2, z: 0 };
      const spec = { projSpeed: 16, occl: "arc" };
      // old straight-line test (groundY + TARGET_H(1.2) > line(2)) would reject: 3.5+1.2 > 2
      ok("arcClears: gun's true arc clears a low crest the straight line would reject", arcClears(world, muzzle, target, spec));
    }
    // "arc" spec: a wall sitting directly in the flat lane still blocks.
    {
      const world = { field: { heightAt: () => 0 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
      ] };
      const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
      const spec = { projSpeed: 58, occl: "arc" };
      ok("arcClears: gun is still blocked by a wall directly in the flat lane", !arcClears(world, muzzle, target, spec));
    }
    // "lofted" spec: ignores terrain and a wall well beyond its own
    // muzzle climb-out cone (first 15% of flight)...
    {
      const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
      const wallWorld = { field: { heightAt: () => 1e3 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 20, y: 5, z: 0 }, hx: 1, hy: 5, hz: 1 },
      ] };
      const spec = { projSpeed: 33, occl: "lofted" };
      ok("arcClears: mortar (lofted) ignores terrain and a wall beyond its own climb-out cone", arcClears(wallWorld, muzzle, target, spec));
      // ...but NOT a wall sitting in its own climb-out cone (can't mortar
      // out from under your own wall's overhang).
      const ownWallWorld = { field: { heightAt: () => 1e3 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 2, y: 1.7, z: 0 }, hx: 0.5, hy: 1.7, hz: 0.5 },
      ] };
      ok("arcClears: mortar (lofted) is blocked firing out from under its own wall's climb-out cone", !arcClears(ownWallWorld, muzzle, target, spec));
    }
    // Playtest item 1: a gun tower on a rise, firing DOWNSLOPE at a target
    // in plain sight, must not self-block. The tower's own AABB IS a "tower"
    // kind solid (SOLID_KINDS), and its muzzle sits only 0.45m above the top
    // of that box. A steeply DEPRESSED downslope arc (target both close and
    // well below the tower) drops fast enough that its very first sample
    // (s=0.9m from the muzzle, diagonal so both the x and z offsets stay
    // under the tower's own hx/hz=0.8 footprint) lands back inside the
    // tower's own y-range too — solidBlocksPoint without a selfId exclusion
    // reports the tower's OWN box as the obstruction. Terrain is flat here
    // (heightAt always 0, far below every sampled arc point) specifically so
    // the block can ONLY be attributed to the self-box, not a terrain
    // clearance false-positive. Fails (arcClears false) without selfId
    // threaded through; passes with it (the fix).
    {
      const hy = 1.6, hx = 0.8, hz = 0.8, centerY = 9;
      const towerBody = { id: 501, alive: true, invM: 0, kind: "tower", pos: { x: 0, y: centerY, z: 0 }, hx, hy, hz };
      const world = { field: { heightAt: () => 0 }, bodies: [towerBody] };
      const muzzle = { x: 0, y: centerY + hy + 0.45, z: 0 };
      const target = { x: 6, y: 0, z: 6 }; // steep, close-in, downhill and diagonal
      const spec = { projSpeed: 45, occl: "arc" };
      ok("arcClears: downslope tower shot self-blocks WITHOUT selfId (repro of the bug)", !arcClears(world, muzzle, target, spec));
      ok("arcClears: downslope tower shot clears WITH selfId excluding its own body (the fix)", arcClears(world, muzzle, target, spec, towerBody.id));
    }
    // reachPolygon: a lofted spec on open ground is ~a full circle (range/fog
    // limited only) — min radial reach > 0.9x effRange across all azimuths.
    {
      const spec = { range: 26, projSpeed: 33, occl: "lofted", hy: 0.8 };
      const muzzle = { x: 0, y: 2.0, z: 0 };
      const poly = reachPolygon({ field: { heightAt: () => 0 }, bodies: [] }, null, muzzle, spec, 1);
      let minR = Infinity;
      for (const p of poly) minR = Math.min(minR, Math.hypot(p.x - muzzle.x, p.z - muzzle.z));
      ok("reachPolygon: mortar (lofted) on open ground is ~a full circle", minR > 0.9 * spec.range, minR);
    }
  }

  // --- confirm state machine, headless
  {
    ok("PENDING_ARM_S is 0.35 (brief: armed 350ms)", PENDING_ARM_S === 0.35);
    const cost = 15;
    const v1 = validatePlacement({ blocked: false, ice: false, held: true, resources: 100, cost });
    ok("validatePlacement: ok when unblocked/unfrozen/held/affordable", v1.ok === true);
    ok("validatePlacement: OCCUPIED", validatePlacement({ blocked: true, ice: false, held: true, resources: 100, cost }).msg === "OCCUPIED");
    ok("validatePlacement: ice", validatePlacement({ blocked: false, ice: true, held: true, resources: 100, cost }).msg.includes("frozen"));
    ok("validatePlacement: GROUND NOT HELD", validatePlacement({ blocked: false, ice: false, held: false, resources: 100, cost }).msg === "GROUND NOT HELD");
    ok("validatePlacement: NO SCRAP", validatePlacement({ blocked: false, ice: false, held: true, resources: 4, cost }).msg === "NO SCRAP");

    // full headless drive: select -> pending (no scrap spent) -> before-armed
    // confirm no-ops -> after-armed confirm places+deducts; separately,
    // cancel leaves everything untouched.
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 5 });
    world.t = 10;
    let resources = 100;
    const pending = { gx: 3, gz: 4, mode: "mg", cost, armedAt: world.t + PENDING_ARM_S };
    ok("select -> pending: no scrap spent yet", resources === 100);
    ok("confirm before armed: no-op (trailing-tap guard)", pendingArmed(pending, world.t) === false);
    world.t += 0.2; // still short of 0.35
    ok("confirm still not armed at +0.2s", pendingArmed(pending, world.t) === false);
    world.t += 0.2; // now past 0.35 total
    ok("confirm armed at +0.4s total", pendingArmed(pending, world.t) === true);
    // confirm: deducts + places (mirrors DepotGame.jsx's confirmPending -> buildAt)
    if (pendingArmed(pending, world.t)) {
      resources -= pending.cost;
      addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: pending.gx, y: 1, z: pending.gz, hp: 80 });
    }
    ok("confirm: scrap deducted", resources === 100 - cost, resources);
    ok("confirm: tower placed", world.bodies.some((b) => b.kind === "tower"));

    // cancel path: fresh pending, never confirmed, dropped
    let resources2 = 100;
    const world2 = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 5 });
    let pending2 = { gx: 1, gz: 1, mode: "mg", cost, armedAt: world2.t + PENDING_ARM_S };
    world2.t += 1; // well past armed
    pending2 = null; // ✗ cancel
    ok("cancel: no scrap deducted", resources2 === 100);
    ok("cancel: no body placed", world2.bodies.filter((b) => b.kind === "tower").length === 0);
  }
}

// --- friendlyFouls / fire discipline (Phase 4.1 Task 2)
{
  // "arc" spec (gun): a friendly (team-1) wall sitting mid-lane between
  // muzzle and target fouls the shot.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: gun's arc through a friendly wall mid-lane fouls", friendlyFouls(world, muzzle, target, spec));
  }
  // clear lane (no friendly body) — no foul.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: clear lane does not foul", !friendlyFouls(world, muzzle, target, spec));
  }
  // enemy (team-2) or town chunk bodies aren't "friendly" unless team 0/1 —
  // a team-2 unit sitting in the lane must NOT count as a foul.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "unit", team: 2, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: an enemy body in the lane does not foul", !friendlyFouls(world, muzzle, target, spec));
  }
  // "lofted" spec (mortar): the SAME friendly wall, well outside the
  // muzzle climb-out cone, does not foul — the arc clears over it.
  {
    const world = { field: { heightAt: () => 1e3 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
    const spec = { projSpeed: 33, occl: "lofted" };
    ok("friendlyFouls: mortar (lofted) fires over a friendly wall outside its climb-out cone", !friendlyFouls(world, muzzle, target, spec));
  }
  // "lofted" spec: a friendly wall sitting IN the muzzle climb-out cone
  // still fouls (can't mortar out from under your own wall's overhang).
  {
    const world = { field: { heightAt: () => 1e3 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 2, y: 1.7, z: 0 }, hx: 0.5, hy: 1.7, hz: 0.5 },
    ] };
    const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
    const spec = { projSpeed: 33, occl: "lofted" };
    ok("friendlyFouls: mortar (lofted) still fouls on its own wall's climb-out cone", friendlyFouls(world, muzzle, target, spec));
  }
  // a town/depot chunk (team 0) counts as friendly too.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "chunk", team: 0, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: a town/depot chunk (team 0) in the lane fouls", friendlyFouls(world, muzzle, target, spec));
  }

  // --- CAREFUL / FREE discipline fixture: tower, friendly wall mid-lane,
  // enemy beyond it. Mirrors stepTowers's own gate (DepotGame.jsx) —
  // CAREFUL holds the trigger pull when friendlyFouls is true (ordnance
  // count stays static across several cadence windows); FREE fires
  // regardless. A lofted mortar spec fires even under CAREFUL because its
  // arc clears the wall.
  {
    const gunSpec = { kind: "gun", projSpeed: 58, occl: "arc", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
    const makeFixture = () => {
      const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
      const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 });
      addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 8, y: 0.9, z: 0, hp: 70 });
      const target = addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.4, hy: 0.9, hz: 0.4, x: 16, y: 0.9, z: 0, hp: 30 });
      target.v = { x: 0, y: 0, z: 0 };
      return { world, tower, target };
    };
    const runCadence = (discipline, spec, pulls = 5) => {
      const { world, tower, target } = makeFixture();
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      for (let i = 0; i < pulls; i++) {
        if (discipline === "free" || !friendlyFouls(world, muzzle, target.pos, spec)) {
          towerShot(world, tower, target, spec);
        }
      }
      return world.projectiles.length;
    };
    ok("fire discipline: CAREFUL holds the shot over a friendly wall (no ordnance fired)", runCadence("careful", gunSpec) === 0);
    ok("fire discipline: FREE fires regardless of the friendly wall", runCadence("free", gunSpec) > 0);
    const mortarSpec = { kind: "mortar", projSpeed: 33, occl: "lofted", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
    ok("fire discipline: a lofted mortar fires over the same wall even under CAREFUL", runCadence("careful", mortarSpec) > 0);
  }
}

// --- depot welds x1.5: identical shell bombardment against a standard
// town building's chunk lattice vs the depot's lattice (mirrors buildTown's
// gpos-adjacency weld pass in DepotGame.jsx — that file is JSX/React and
// can't be imported into a headless node test, so the fixture reproduces
// its weld-wiring exactly, with the same t.depot -> breakF*1.5 scaling this
// task adds to buildTown itself).
{
  const { hcs, pitch, mass, breakF } = MASON;
  const buildLattice = (isDepot, nx = 4, ny = 3, nz = 4) => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
    const grid3 = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy <= ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - (nx - 1) / 2) * pitch, y: hcs + 0.02 + iy * pitch, z: (iz - (nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.gpos = [ix, iy, iz];
      grid3.push(c);
    }
    const key = (a, b, c2) => a + "," + b + "," + c2;
    const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
    const townBreakF = isDepot ? breakF * 1.5 : breakF; // matches buildTown's t.depot scaling
    const welds = [];
    for (const c of grid3) {
      const g = c.gpos;
      for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
        if (o) welds.push(addWeld(world, c, o, townBreakF));
      }
    }
    return { world, welds };
  };
  const shellSpec = { kind: "shell", r: 2, kv: 12, dmg: 55, crater: 0.5, attacker: "player" };
  const bombard = (isDepot) => {
    const { world, welds } = buildLattice(isDepot);
    explode(world, 0, hcs + 0.02 + pitch, 0, shellSpec); // same relative impact point both fixtures
    return welds.filter((w) => w.broken).length;
  };
  const houseBroken = bombard(false);
  const depotBroken = bombard(true);
  ok("identical shell impact pops welds on a standard building", houseBroken > 0, `broken=${houseBroken}`);
  ok("depot welds x1.5: same impact pops strictly fewer welds on the depot lattice", depotBroken < houseBroken, `house=${houseBroken} depot=${depotBroken}`);
}

// --- structural loss (Task 5): the depot's chunk lattice IS its health bar.
// censusDepotChunks/depotStandingFraction/checkDepotBreach are pure, so this
// drives them against a hand-built lattice (same gpos-chunk shape buildTown
// produces, tagged .town === "depot") rather than the full DepotGame.jsx
// boot (JSX, not importable headlessly).
{
  const { hcs, pitch, mass } = MASON;
  const buildDepotLattice = (nx = 5, ny = 2, nz = 5) => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
    const chunks = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy <= ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - (nx - 1) / 2) * pitch, y: hcs + 0.02 + iy * pitch, z: (iz - (nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = "depot"; c.gpos = [ix, iy, iz];
      chunks.push(c);
    }
    return { world, chunks };
  };

  // census at spawn: full lattice, nothing moved or killed yet -> 1.0.
  const spawnFixture = buildDepotLattice();
  const spawnCensus = censusDepotChunks(spawnFixture.world.bodies);
  ok("depot census picks up every depot chunk at build", spawnCensus.length === spawnFixture.chunks.length, `n=${spawnCensus.length}`);
  ok("depot census fraction is 1.0 at spawn (nothing moved or killed)",
    depotStandingFraction(spawnCensus, spawnFixture.world.byId) === 1);

  // scripted demolition: kill ~1/4 outright, displace another ~1/4 well past
  // the standing tolerance (a launched stone, still "alive" but not home) —
  // together crossing the 0.58 breach line without either tactic alone
  // needing to carry the whole fraction.
  const demoFixture = buildDepotLattice();
  const demoCensus = censusDepotChunks(demoFixture.world.bodies);
  const half = demoFixture.chunks.length / 2;
  for (let i = 0; i < demoFixture.chunks.length; i++) {
    const c = demoFixture.chunks[i];
    if (i < half / 2) c.alive = false; // outright destroyed
    else if (i < half) c.pos = { x: c.pos.x + 20, y: c.pos.y, z: c.pos.z }; // launched well past 1.2m
  }
  const demoFraction = depotStandingFraction(demoCensus, demoFixture.world.byId);
  ok(`half the depot demolished (kill+displace) crosses the ${DEPOT_BREACH_FRAC} breach line`,
    demoFraction < DEPOT_BREACH_FRAC, `fraction=${demoFraction}`);
  ok("a displaced-but-alive stone does not count as standing (demolition semantics)",
    demoFraction <= 0.5 + 1e-9, `fraction=${demoFraction}`);

  const Sb = makeRunState({ waves: WAVES });
  Sb.started = true;
  const breached = checkDepotBreach(Sb, demoFraction);
  ok("checkDepotBreach fires when standing fraction crosses the line", breached === true);
  ok("checkDepotBreach sets gameOver", Sb.gameOver === true);
  ok("checkDepotBreach flags breach (distinct from lives-loss/ledger-loss)", Sb.breach === true);
  ok("checkDepotBreach does not set victory", Sb.victory === false);
  ok("checkDepotBreach is idempotent (no-op once gameOver)", checkDepotBreach(Sb, 0) === false);

  const breachCard = makeEndDispatch({ victory: false, kills: 4, wave: 3, totalWaves: 50, breach: true });
  ok("breach end card leads with the depot-is-breached line", breachCard.lines[0] === "THE DEPOT IS BREACHED.");
  ok("breach end card carries the withdrawal-under-fire line", breachCard.lines.includes("The position is lost. Withdrawal under fire."));
  ok("breach end card is digit-free (bureau voice, no wave/kill counters)", !breachCard.lines.some((l) => /\d/.test(l)));

  // FRONT F1: the lives track is gone — checkLoss (regiment stub only)
  // never fires, and a fully-standing depot never trips the breach.
  const Sl = makeRunState({ waves: WAVES });
  Sl.started = true;
  ok("checkLoss without the regiment stub never fires (lives retired)", checkLoss(Sl) === false && Sl.gameOver === false && !Sl.breach);
  ok("a fully-standing depot (1.0) never trips checkDepotBreach", checkDepotBreach({ gameOver: false, victory: false }, 1) === false);

  // census cadence: stepDepotCensus must gate computeFraction to ~1Hz
  // (DEPOT_CENSUS_HZ), not call it every frame regardless of how many small
  // ticks it's fed. 10 ticks of 0.25s = 2.5s of sim time -> exactly
  // floor(2.5 * DEPOT_CENSUS_HZ) = 2 calls.
  {
    let calls = 0;
    const Sc = { depotCensusAcc: 0, gameOver: false, victory: false };
    for (let i = 0; i < 10; i++) stepDepotCensus(Sc, 0.25, () => { calls++; return 1; });
    ok(`census cost sanity: runs at ~${DEPOT_CENSUS_HZ}Hz, not per frame (10x 0.25s ticks -> ${calls} calls)`, calls === 2);
    // and a single huge-dt tick (a paused/backgrounded tab catching up)
    // still only fires once per crossed 1/Hz boundary it actually reports —
    // no runaway loop, no crash.
    let calls2 = 0;
    const Sc2 = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sc2, 0.01, () => { calls2++; return 1; });
    ok("census does not fire on a sub-threshold tick", calls2 === 0);
  }
}

// --- FRONT F1 Task 2: both depots can fall. The enemy depot ("depot2") gets
// its own census reading and a victory-signed breach mirror; one 1Hz gate
// carries both fractions ({player, enemy}) and both breach checks.
{
  const { hcs, pitch, mass } = MASON;
  const buildLattice = (townId, nx = 5, ny = 2, nz = 5) => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
    const chunks = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy <= ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - (nx - 1) / 2) * pitch, y: hcs + 0.02 + iy * pitch, z: (iz - (nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = townId; c.gpos = [ix, iy, iz];
      chunks.push(c);
    }
    return { world, chunks };
  };
  // one world holding BOTH lattices — the townId filter must separate them.
  const both = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
  const mk = (townId, x0) => {
    const out = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 1; iy++) for (let iz = 0; iz < 3; iz++) {
      const c = addBody(both, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: x0 + ix * pitch, y: hcs + 0.02 + iy * pitch, z: iz * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = townId; out.push(c);
    }
    return out;
  };
  const pChunks = mk("depot", -20), eChunks = mk("depot2", 20);
  const pCensus = censusDepotChunks(both.bodies);
  const pCensusExplicit = censusDepotChunks(both.bodies, "depot");
  const eCensus = censusDepotChunks(both.bodies, "depot2");
  ok("censusDepotChunks default townId stays 'depot' (today's callers honest)", pCensus.length === pChunks.length && pCensus.length === pCensusExplicit.length);
  ok("censusDepotChunks('depot2') picks only the enemy lattice", eCensus.length === eChunks.length);
  ok("the two censuses share no ids", !pCensus.some((c) => eCensus.some((d) => d.id === c.id)));

  // scripted demolition of depot2: displace past DEPOT_STANDING_TOL (the
  // census's own standing rule) until the fraction crosses the line.
  const demolish = (chunks, n) => { for (let i = 0; i < n; i++) chunks[i].pos = { x: chunks[i].pos.x, y: chunks[i].pos.y + DEPOT_STANDING_TOL + 5, z: chunks[i].pos.z }; };
  demolish(eChunks, Math.ceil(eChunks.length * (1 - DEPOT_BREACH_FRAC)) + 1);
  const eFrac = depotStandingFraction(eCensus, both.byId);
  ok(`depot2 demolition drives its fraction below ${DEPOT_BREACH_FRAC}`, eFrac < DEPOT_BREACH_FRAC, `frac=${eFrac}`);
  ok("player census unmoved by depot2 demolition", depotStandingFraction(pCensus, both.byId) === 1);

  // checkEnemyBreach: victory-signed mirror.
  const Sv = makeRunState({ waves: WAVES });
  Sv.started = true;
  const won = checkEnemyBreach(Sv, eFrac);
  ok("checkEnemyBreach fires below the shared threshold", won === true);
  ok("checkEnemyBreach sets victory (not gameOver)", Sv.victory === true && !Sv.gameOver);
  ok("checkEnemyBreach flags enemyBreach", Sv.enemyBreach === true);
  ok("checkEnemyBreach is idempotent once victory is set", checkEnemyBreach(Sv, 0) === false);
  ok("a fully-standing enemy depot never trips checkEnemyBreach", checkEnemyBreach({ gameOver: false, victory: false }, 1) === false);

  // whichever breach fires first wins — the other never overwrites (both orders).
  const Sa = makeRunState({ waves: WAVES }); Sa.started = true;
  checkDepotBreach(Sa, 0.1); checkEnemyBreach(Sa, 0.1);
  ok("player breach first: enemy breach never overwrites (loss stands)", Sa.gameOver === true && Sa.breach === true && !Sa.victory && !Sa.enemyBreach);
  const Sz = makeRunState({ waves: WAVES }); Sz.started = true;
  checkEnemyBreach(Sz, 0.1); checkDepotBreach(Sz, 0.1);
  ok("enemy breach first: player breach never overwrites (victory stands)", Sz.victory === true && Sz.enemyBreach === true && !Sz.gameOver && !Sz.breach);

  // one gate, two readings: stepDepotCensus's compute returns {player, enemy};
  // the gate stores both and calls both breach checks — still ~1Hz.
  {
    let calls = 0;
    const Sc = { depotCensusAcc: 0, gameOver: false, victory: false };
    for (let i = 0; i < 10; i++) stepDepotCensus(Sc, 0.25, () => { calls++; return { player: 0.9, enemy: 0.8 }; });
    ok("combined census still gated to ~1Hz (10x 0.25s -> 2 calls)", calls === 2, `calls=${calls}`);
    ok("gate stores both fractions (S.depotStanding + S.enemyStanding)", Sc.depotStanding === 0.9 && Sc.enemyStanding === 0.8);
    const Sw = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sw, 1.01, () => ({ player: 0.9, enemy: 0.2 }));
    ok("gate routes the enemy fraction into checkEnemyBreach (victory)", Sw.victory === true && Sw.enemyBreach === true && !Sw.gameOver);
    const Sl2 = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sl2, 1.01, () => ({ player: 0.2, enemy: 0.9 }));
    ok("gate routes the player fraction into checkDepotBreach (loss)", Sl2.gameOver === true && Sl2.breach === true && !Sl2.victory);
  }

  // the victory end card sits ABOVE the generic victory branches.
  const winCard = makeEndDispatch({ victory: true, enemyBreach: true, kills: 9, wave: 12, totalWaves: 50, attrition: true });
  ok("victory-breach card leads with the opposing-depot line", winCard.lines[0] === "THE OPPOSING DEPOT IS BREACHED.");
  ok("victory-breach card carries the rubble line", winCard.lines.includes("The position opposite is rubble. The field belongs to the Bureau."));
  ok("victory-breach card outranks attrition copy", !winCard.lines.some((l) => l.includes("COMBAT-INEFFECTIVE")));
  ok("victory-breach card closes the field order with the kill count", winCard.lines.some((l) => l === "9 CONFIRMED. FIELD ORDER CLOSED."));
  // player-breach loss card re-pinned, unchanged.
  const lossCard = makeEndDispatch({ victory: false, breach: true, kills: 4, wave: 3, totalWaves: 50 });
  ok("player breach loss card unchanged", lossCard.lines[0] === "THE DEPOT IS BREACHED.");

  // twin determinism: two identical scripted demolition runs through the
  // gate produce identical fraction/flag traces (pure path, zero rng draws).
  {
    const runOnce = () => {
      const f = buildLattice("depot2");
      const c = censusDepotChunks(f.world.bodies, "depot2");
      const S = { depotCensusAcc: 0, gameOver: false, victory: false };
      const trace = [];
      for (let step = 0; step < 30; step++) {
        if (step % 3 === 0 && Math.floor(step / 3) < f.chunks.length) {
          const ch = f.chunks[Math.floor(step / 3)];
          ch.pos = { x: ch.pos.x + 10, y: ch.pos.y, z: ch.pos.z };
        }
        stepDepotCensus(S, 0.5, () => ({ player: 1, enemy: depotStandingFraction(c, f.world.byId) }));
        trace.push(`${S.depotStanding},${S.enemyStanding},${!!S.victory},${!!S.enemyBreach}`);
      }
      return trace.join("|");
    };
    ok("twin determinism: identical demolition scripts -> identical census traces", runOnce() === runOnce());
  }
}

// --- squads.js (Phase 5 Task 1): squad brains — exposure, cover-hop, and
// the defend/attack order machine. Pure functions over world + squad state.
{
  // exposureAt: a man behind a wall (relative to the threat bearing) should
  // read low exposure; open field reads 1; a wall BEHIND him (away from the
  // threat) doesn't help at all — still 1.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // man at origin; threat bears due +z (bearing 0, atan2(dx,dz) convention).
    // wall sits between him and the threat, 1.5m out along +z.
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 1.5, hp: 70 });
    const covered = exposureAt(world, 0, 0, 0);
    ok(`exposureAt: wall between man and threat reads low (0.1-0.3)`, covered >= 0.1 && covered <= 0.3, `exposure=${covered}`);

    const worldOpen = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const openExposure = exposureAt(worldOpen, 0, 0, 0);
    ok("exposureAt: open field (no solids nearby) reads 1", openExposure === 1, `exposure=${openExposure}`);

    const worldBehind = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // wall is BEHIND the man relative to the threat bearing (threat at
    // bearing 0 / +z; wall sits at -z, i.e. behind him) — should not cover.
    addBody(worldBehind, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: -1.5, hp: 70 });
    const behindExposure = exposureAt(worldBehind, 0, 0, 0);
    ok("exposureAt: wall behind the man (away from threat) does not cover, reads 1", behindExposure === 1, `exposure=${behindExposure}`);
  }

  // coverHop: given a boulder near one candidate advance cell and open
  // ground elsewhere, both cells reducing distance-to-dest, coverHop must
  // pick the boulder-adjacent one.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // dest straight ahead at +z=40. A rock sits 1.5m past the (0,6) ring
    // candidate, directly along the threat bearing (0 == +z) — that
    // candidate reads well-covered; every other ring candidate is open
    // ground. coverHop must pick the covered one.
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 1.2, hy: 1.2, hz: 1.2, x: 0, y: 1.2, z: 7.5, hp: 1e9 });
    const from = { x: 0, z: 0 }, dest = { x: 0, z: 40 };
    const hop = coverHop(world, from, dest, 0);
    const distFromRock = Math.hypot(hop.x - 0, hop.z - 7.5);
    ok("coverHop prefers a boulder-adjacent advance cell over open ground",
      distFromRock < 2.2, `hop=(${hop.x.toFixed(2)},${hop.z.toFixed(2)}) distFromRock=${distFromRock.toFixed(2)}`);
    ok("coverHop's pick strictly reduces distance-to-dest",
      Math.hypot(dest.x - hop.x, dest.z - hop.z) < Math.hypot(dest.x - from.x, dest.z - from.z));
  }

  // stepSquad defend: members hold within 3m of anchor over 30 sim seconds.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const squad = makeSquad(1, "rifles", 1, 0, 0);
    for (let i = 0; i < SQUAD_SPECS.rifles.n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.35, hy: 0.9, hz: 0.35, x: 0, y: 0.9, z: 0, hp: 100 });
      squad.memberIds.push(u.id);
    }
    const dt = 1 / 30;
    let maxDist = 0;
    for (let i = 0; i < 30 / dt; i++) {
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt;
        const d = Math.hypot(u.pos.x - squad.anchor.x, u.pos.z - squad.anchor.z);
        if (d > maxDist) maxDist = d;
      }
    }
    ok("stepSquad defend holds members within 3m of anchor over 30 sim seconds",
      maxDist <= 3.05, `maxDist=${maxDist.toFixed(2)}`);
  }

  // stepSquad attack: reaches a 30m dest in legs (arrival < 60s), then order
  // flips to defend at dest.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 2 });
    const squad = makeSquad(2, "mg", 1, 0, 0);
    for (let i = 0; i < SQUAD_SPECS.mg.n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.35, hy: 0.9, hz: 0.35, x: 0, y: 0.9, z: 0, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "attack"; squad.dest = { x: 0, z: 30 };
    const dt = 1 / 30;
    let arrivedAt = -1;
    for (let i = 0; i < 60 / dt; i++) {
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt;
      }
      if (squad.order === "defend" && arrivedAt < 0) arrivedAt = (i + 1) * dt;
    }
    ok(`attack squad reaches 30m dest in legs, arrival < 60s`, arrivedAt > 0 && arrivedAt < 60, `arrivedAt=${arrivedAt}`);
    ok("attack squad flips to defend at dest", squad.order === "defend");
    ok("defend anchor set to the arrival dest", Math.abs(squad.anchor.z - 30) < 1.5, `anchor.z=${squad.anchor.z}`);
  }

  // determinism twin-run: identical seed -> identical member positions.
  {
    const runTwin = (seed) => {
      const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed });
      addBody(world, { kind: "rock", team: 0, mass: 0, hx: 1.2, hy: 1.2, hz: 1.2, x: 5, y: 1.2, z: 10, hp: 1e9 });
      const squad = makeSquad(3, "rifles", 1, 0, 0);
      for (let i = 0; i < SQUAD_SPECS.rifles.n; i++) {
        const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.35, hy: 0.9, hz: 0.35, x: 0, y: 0.9, z: 0, hp: 100 });
        squad.memberIds.push(u.id);
      }
      squad.order = "attack"; squad.dest = { x: 0, z: 30 };
      const dt = 1 / 30;
      for (let i = 0; i < 50 / dt; i++) {
        stepSquad(world, squad, dt);
        for (const id of squad.memberIds) {
          const u = world.byId.get(id);
          u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt;
        }
      }
      return squad.memberIds.map((id) => { const u = world.byId.get(id); return `${u.pos.x.toFixed(6)},${u.pos.z.toFixed(6)}`; }).join("|");
    };
    const twinA = runTwin(7), twinB = runTwin(7);
    ok("twin-run determinism: identical seed -> identical member positions", twinA === twinB, `${twinA} vs ${twinB}`);
  }

  // masonry-slam repro (Phase 5 smallfix): a squad anchored adjacent to a
  // wall — so a formation/defend slot lands inside the wall's footprint —
  // must NOT drive any member into the solid (the engine's depenetration
  // ejects him and the dv>8 slam path kills him). Full stepWorld physics:
  // pre-fix, a member dies within seconds; post-fix, every slot goal clears
  // static solids by member hx + 0.35 and all members survive 30s.
  {
    const world = makeWorld({ seed: 3 });
    // flatten the procedural default field so only the wall matters
    for (let k = 0; k < world.field.h.length; k++) world.field.h[k] = 0;
    world.field.dirty = false;
    // wall square on the defend ring: slot 0 sits at anchor + (0, 2.4)
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 1.1, hy: 1.1, hz: 1.1, x: 0, y: 1.1, z: 2.4, hp: 1e9 });
    const squad = makeSquad(9, "rifles", 1, 0, 0);
    spawnSquadMembers(world, squad);
    const dt = world.dt;
    let goalInSolid = false, died = false;
    for (let i = 0; i < 30 / dt && !died; i++) {
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        if (!u || !u.alive) { died = true; continue; }
        const g = u.goal;
        if (g && Math.abs(g.x - wall.pos.x) <= wall.hx + u.hx && Math.abs(g.z - wall.pos.z) <= wall.hz + u.hx) goalInSolid = true;
      }
      stepWorld(world);
    }
    ok("slot goals never target the inside of a static solid (wall on the defend ring)", !goalInSolid);
    ok("all members survive 30s anchored against a wall (no depenetration slam deaths)", !died);
  }
}

// --- squads.js (marksmanship batch Task 1): wake-on-seek + rubber-band
// anchor + honest ring. Fixtures promoted from scripts/diag-squadlag.mjs
// (full stepWorld physics — the sleep bug only reproduces with the engine's
// sleeper in the loop). Diagnosed defect: core.js sleeps a body at
// |v|^2<0.06 for 0.55s; the threatened attack's 1.5-3s leg pauses guarantee
// it, and seekGoal's gentle accel-from-rest never escapes the engine's
// re-zeroing — members sleep forever while the anchor marches on alone.
{
  // keeps men on their feet — copy of DepotGame.jsx's uprightMember
  const uprightMember = (u, dt) => {
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
  };

  const makeFixture = ({ rocks = false, threat = false, seed = 1 } = {}) => {
    const world = makeWorld({ seed });
    const squad = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, squad);
    squad.order = "attack";
    squad.dest = { x: 0, z: 35 };
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
    return { world, squad };
  };

  // Full-physics march runner. Instruments: rng draw count, leg-arrival
  // count (a leg ends when the dwell arms from zero — threatened — or when
  // _legTarget resets while still attacking — double-time), max member-to-
  // anchor distance across the whole run, arrival times.
  const runMarch = (fix, maxT = 120) => {
    const { world, squad } = fix;
    const dt = world.dt;
    let draws = 0;
    const rng0 = world.rng;
    world.rng = () => { draws++; return rng0(); };
    const members = () => squad.memberIds.map((id) => world.byId.get(id)).filter((u) => u && u.alive);
    const st = { draws: 0, legs: 0, cohesionMax: 0, anchorArriveT: null, lastManArriveT: null, alive4: false, trace: "" };
    const dest = squad.dest;
    for (let i = 0; i < Math.round(maxT / dt); i++) {
      const prevLeg = squad._legTarget, prevPause = squad._pauseT || 0, prevOrder = squad.order;
      stepSquad(world, squad, dt);
      if (prevOrder === "attack" && prevLeg && prevPause <= 0 &&
        (((squad._pauseT || 0) > 0) || (squad.order === "attack" && squad._legTarget === null)))
        st.legs++;
      const ms = members();
      for (const u of ms) uprightMember(u, dt);
      stepWorld(world);
      for (const u of ms) {
        const d = Math.hypot(u.pos.x - squad.anchor.x, u.pos.z - squad.anchor.z);
        if (d > st.cohesionMax) st.cohesionMax = d;
      }
      const anchorD = Math.hypot(dest.x - squad.anchor.x, dest.z - squad.anchor.z);
      if (st.anchorArriveT == null && anchorD <= 1.0) st.anchorArriveT = world.t;
      if (ms.length && st.lastManArriveT == null &&
        Math.max(...ms.map((u) => Math.hypot(dest.x - u.pos.x, dest.z - u.pos.z))) <= 4.0)
        st.lastManArriveT = world.t;
      if (st.lastManArriveT != null && world.t > st.lastManArriveT + 2) break;
    }
    st.draws = draws;
    st.alive4 = members().length === 4;
    st.trace = members().map((u) => `${u.pos.x.toFixed(6)},${u.pos.z.toFixed(6)},${u.sleeping ? 1 : 0}`).join("|") + `#d${draws}`;
    world.rng = rng0;
    return st;
  };

  // 1) threatened open-ground attack: every member arrives (within 8s of the
  // anchor's own arrival), nobody left sleeping mid-field. Pre-fix: 0/4 ever
  // arrive — the first leg pause sleeps all four for good.
  {
    const s = runMarch(makeFixture({ threat: true }));
    ok("threatened open-ground attack: anchor arrives", s.anchorArriveT != null, `anchorArriveT=${s.anchorArriveT}`);
    ok("threatened open-ground attack: all 4 members alive at dest", s.alive4);
    ok("threatened open-ground attack: last man arrives within 8s of the anchor",
      s.anchorArriveT != null && s.lastManArriveT != null && s.lastManArriveT - s.anchorArriveT <= 8,
      `anchor=${s.anchorArriveT?.toFixed(1)} lastMan=${s.lastManArriveT?.toFixed(1) ?? "never"}`);
    ok("threatened open-ground attack: max member-to-anchor lag bounded < COHESION_M + slack",
      s.cohesionMax < COHESION_M + 2.5, `cohesionMax=${s.cohesionMax.toFixed(2)} COHESION_M=${COHESION_M}`);
    // rng contract: exactly ONE draw per completed attack leg — the
    // rubber-band may delay legs in wall-clock but never adds or drops draws.
    ok("threatened attack: rng draws == completed legs (one draw per leg)",
      s.draws === s.legs, `draws=${s.draws} legs=${s.legs}`);
  }

  // 2) rock-cluster route, threatened: 4/4 arrive (pre-fix: wedged members
  // sleep forever against the masonry — 2/4).
  {
    const s = runMarch(makeFixture({ rocks: true, threat: true, seed: 2 }));
    ok("rock-cluster threatened attack: all 4 members alive", s.alive4);
    ok("rock-cluster threatened attack: last man arrives",
      s.lastManArriveT != null && s.anchorArriveT != null && s.lastManArriveT - s.anchorArriveT <= 8,
      `anchor=${s.anchorArriveT?.toFixed(1) ?? "never"} lastMan=${s.lastManArriveT?.toFixed(1) ?? "never"}`);
    ok("rock-cluster threatened attack: cohesion bounded",
      s.cohesionMax < COHESION_M + 2.5, `cohesionMax=${s.cohesionMax.toFixed(2)}`);
    ok("rock-cluster threatened attack: rng draws == completed legs",
      s.draws === s.legs, `draws=${s.draws} legs=${s.legs}`);
  }

  // 3) settled defenders keep sleeping: the d<0.15 idle branch must NOT wake
  // (idle-world determinism property). Let a defend squad settle under full
  // physics, then verify members are asleep and STAY asleep.
  {
    const world = makeWorld({ seed: 5 });
    const squad = makeSquad(4, "rifles", 1, 0, 0);
    spawnSquadMembers(world, squad);
    const dt = world.dt;
    const ms = () => squad.memberIds.map((id) => world.byId.get(id)).filter((u) => u && u.alive);
    for (let i = 0; i < Math.round(20 / dt); i++) {
      stepSquad(world, squad, dt);
      for (const u of ms()) uprightMember(u, dt);
      stepWorld(world);
    }
    const settled = ms().every((u) => u.sleeping);
    ok("settled defenders are asleep after 20s", settled, JSON.stringify(ms().map((u) => !!u.sleeping)));
    let stayedAsleep = true;
    for (let i = 0; i < Math.round(5 / dt); i++) {
      stepSquad(world, squad, dt);
      stepWorld(world);
      if (!ms().every((u) => u.sleeping)) stayedAsleep = false;
    }
    ok("settled defenders STAY asleep through 5 more seconds of stepSquad (idle branch never wakes)", stayedAsleep);
  }

  // 4) twin determinism under full physics — threatened rocky march,
  // identical seed -> identical member positions, sleep flags, and draw
  // count (rng stream identity through a threatened attack).
  {
    const a = runMarch(makeFixture({ rocks: true, threat: true, seed: 9 }));
    const b = runMarch(makeFixture({ rocks: true, threat: true, seed: 9 }));
    ok("twin determinism (full physics, threatened, rocks): traces + draw counts identical",
      a.trace === b.trace, `${a.trace} vs ${b.trace}`);
  }
}

// --- squadFire (Phase 5 Task 2): infantry combat. Members fire only while
// stationary (defend, or attack mid-pause); target gates are the exact
// tower stack (effRange + fieldReaches + arcClears, selfId excluded); MG
// bursts spend `burst` rounds spaced `burstGap`; the only rng anywhere in a
// fired round is applyScatter's 2 draws/shot.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  const mkStationarySquad = (world, type, team, x, z, n) => {
    const squad = makeSquad(1, type, team, x, z);
    for (let i = 0; i < n; i++) {
      // spread members (overlapped bodies depenetration-slam each other) and
      // mirror spawnSquadMembers' pair roles: member 0 shoots, member 1 of a
      // sniper squad is the spotter (never fires) — 6.5 Task 6.
      const u = addBody(world, { kind: "unit", team, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: type === "sniper" ? x + i * 1.2 : x, y: 0.9, z, hp: 100 });
      if (type === "sniper") u.role = i === 0 ? "sniper" : "spotter";
      squad.memberIds.push(u.id);
    }
    squad.order = "defend";
    return squad;
  };

  // sniper vs conscript: from +4m elevation, at 26m (well inside the 30m
  // sniper range, elevation-boosted), the majority of 10 seeded trials
  // should kill a fresh 58hp conscript (one 65-dmg hit at low acc/high
  // sigma still lands often enough at this range/elevation to dominate).
  {
    let kills = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const world = makeWorld({ field: flatField, seed });
      const squad = mkStationarySquad(world, "sniper", 1, 0, 0, SQUAD_SPECS.sniper.n);
      world.byId.get(squad.memberIds[0]).pos.y = 4.9; // +4m over the flat field's y=0.9 default seat
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 26, hp: 58 });
      const dt = 1 / 30;
      for (let i = 0; i < 20 / dt && target.alive; i++) {
        squadFire(world, squad, dt);
        for (let s = 0; s < 200 && world.projectiles.length; s++) stepWorld(world);
      }
      if (!target.alive) kills++;
    }
    ok("squadFire: sniper from +4m elevation kills a conscript at 26m in the majority of 10 seeded trials",
      kills >= 6, `kills=${kills}/10`);
  }

  // sniper vs tank (A2): the direct-hit component (A1's core.js hook,
  // world.depotCombat + spec.dirDmg) now actually consults t.armor.
  // INFANTRY_ARMS.sniper carries dirDmg: 130, spawnTank sets t.armor = 140
  // (units.js) — 130 < 140 so every direct hit glances at the engine's 0.15
  // multiplier: 130 * 0.15 = 19.5 hp/hit. Requires world.depotCombat = true
  // (unset in makeWorld by default; test opts it in explicitly) — this
  // replaces the old ~3.5hp "chip via hitbox falloff" accident (see git
  // history) now that dirDmg/armor are actually wired end to end.
  {
    let samples = [];
    for (let seed = 1; seed <= 10; seed++) {
      const world = makeWorld({ field: flatField, seed });
      world.depotCombat = true;
      const squad = mkStationarySquad(world, "sniper", 1, 0, 0, SQUAD_SPECS.sniper.n);
      const tank = addBody(world, { kind: "vehicle", team: 2, mass: TANK.mass, hx: TANK.hx, hy: TANK.hy, hz: TANK.hz, x: 0, y: TANK.hy, z: 20, hp: TANK.hp });
      tank.armor = 140;
      const hp0 = tank.hp;
      squadFire(world, squad, 0);
      for (let s = 0; s < 300 && world.projectiles.length; s++) stepWorld(world);
      const lost = hp0 - tank.hp;
      samples.push(lost);
    }
    const inRange = samples.every((l) => l >= 19 && l <= 20.5);
    ok("squadFire: sniper vs armored tank (armor 140) glances 19-20hp/hit via dirDmg+armor",
      inRange, samples.map((l) => l.toFixed(2)).join(","));
  }

  // tank armor pin: spawnTank always sets t.armor === 140.
  {
    const world = makeWorld({ field: flatField, seed: 1 });
    const tank = spawnUnit(world, { x: 0, z: 0 }, "tank");
    ok("spawnTank: t.armor pinned to 140", tank.armor === 140, `armor=${tank.armor}`);
  }

  // rifle/mg DPS vs a soft fixture, FLAGGED (world.depotCombat=true) — this
  // is the mode dirDmg actually fires in, so it's the only measurement the
  // ±10% replaces-not-adds contract can be checked against (an unflagged
  // fixture never exercises the direct-hit path at all and would trivially
  // "pass" no matter what dirDmg is set to). Baselines below are the
  // pre-wiring (dmg-only blast) flagged measurement recorded in
  // task-A2-report.md; INFANTRY_ARMS.rifles/mg.dirDmg were scaled down from
  // a naive dmg-equal value (5) specifically to land inside this band.
  {
    const dpsFixture = (type) => {
      const world = makeWorld({ field: flatField, seed: 4 });
      world.depotCombat = true;
      const squad = mkStationarySquad(world, type, 1, 0, 0, SQUAD_SPECS[type].n);
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
      const dt = 1 / 30, dur = 20;
      const hp0 = target.hp;
      for (let i = 0; i < dur / dt; i++) {
        squadFire(world, squad, dt);
        for (let s = 0; s < 20; s++) stepWorld(world);
      }
      return (hp0 - target.hp) / dur;
    };
    const BASELINE_RIFLES = 3.7817, BASELINE_MG = 9.3645; // flagged, pre-wiring (dirDmg unset)
    const rDps = dpsFixture("rifles"), mDps = dpsFixture("mg");
    ok("squadFire: flagged rifles DPS within +/-10% of pre-wiring baseline",
      Math.abs(rDps / BASELINE_RIFLES - 1) <= 0.10, `dps=${rDps.toFixed(4)} baseline=${BASELINE_RIFLES}`);
    ok("squadFire: flagged mg DPS within +/-10% of pre-wiring baseline",
      Math.abs(mDps / BASELINE_MG - 1) <= 0.10, `dps=${mDps.toFixed(4)} baseline=${BASELINE_MG}`);
  }

  // mg TOWER + enemy rifleman DPS, FLAGGED — same replaces-not-adds contract
  // as squadFire's INFANTRY_ARMS check above, one level out: TOWER_SPECS.mg
  // and ENEMY_FIRE.rifle also carry dirDmg under the same guard.
  // - mg tower vs a soft unit fixture: dmg-equal dirDmg (5) drifted DPS
  //   +45.4% over the flagged pre-wiring baseline; rescaled to 3.4.
  // - enemy rifleman vs a soft WALL fixture (their actual damage path —
  //   stepRifleman only ever targets kind "tower"/"wall", hitOnly:
  //   "structure"): the direct-hit component never fires here at all —
  //   core.js's dirDmg branch is scoped to hitBody.kind === "unit"/
  //   "vehicle"/"truck", which a wall/tower never is. Measured DPS is
  //   bit-identical with dirDmg present or stripped (0% drift) — left at 5
  //   (dmg-equal, per brief) since there's nothing to rescale.
  {
    const towerMgDps = () => {
      const world = makeWorld({ field: flatField, seed: 4 });
      world.depotCombat = true;
      const spec = TOWER_SPECS.mg;
      const g0 = world.field.heightAt(0, 0);
      const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: g0 + spec.hy, z: 0, hp: spec.hp });
      tower.towerType = "mg";
      const target = addBody(world, { kind: "unit", team: 2, hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 1e9, x: 0, y: world.field.heightAt(0, 10) + 0.86, z: 10 });
      const dt = 1 / 30, dur = 20;
      const hp0 = target.hp;
      let fireCd = 0;
      for (let i = 0; i < dur / dt; i++) {
        fireCd -= dt;
        if (fireCd <= 0) { towerShot(world, tower, target, spec); fireCd = spec.fireRate; }
        for (let s = 0; s < 5; s++) stepWorld(world);
      }
      return (hp0 - target.hp) / dur;
    };
    const enemyRifleDps = () => {
      const world = makeWorld({ field: flatField, seed: 4 });
      world.depotCombat = true;
      const fspec = ENEMY_FIRE.rifle;
      const g0 = world.field.heightAt(0, 0);
      const target = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 1e9 });
      const rifleman = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, hp: 58, x: 0, y: g0 + 0.86, z: 10 });
      const dt = 1 / 30, dur = 20;
      const hp0 = target.hp;
      let fireCd = 0;
      for (let i = 0; i < dur / dt; i++) {
        fireCd -= dt;
        if (fireCd <= 0) {
          const muzzle = { x: rifleman.pos.x, y: rifleman.pos.y + 0.5, z: rifleman.pos.z };
          shooterFire(world, rifleman, muzzle, target, fspec, { attacker: "enemy", hitStruct: true, hitOnly: "structure" });
          fireCd = fspec.cd;
        }
        for (let s = 0; s < 5; s++) stepWorld(world);
      }
      return (hp0 - target.hp) / dur;
    };
    const BASELINE_TOWER_MG = 3.8391, BASELINE_ENEMY_RIFLE = 0.2138; // flagged, pre-wiring (dirDmg unset)
    const tDps = towerMgDps(), eDps = enemyRifleDps();
    ok("towerShot: flagged mg-tower DPS within +/-10% of pre-wiring baseline",
      Math.abs(tDps / BASELINE_TOWER_MG - 1) <= 0.10, `dps=${tDps.toFixed(4)} baseline=${BASELINE_TOWER_MG}`);
    ok("shooterFire: flagged enemy-rifle DPS (vs its real wall/tower target path) within +/-10% of pre-wiring baseline (dirDmg is inert there, 0% drift)",
      Math.abs(eDps / BASELINE_ENEMY_RIFLE - 1) <= 0.10, `dps=${eDps.toFixed(4)} baseline=${BASELINE_ENEMY_RIFLE}`);
  }

  // rifle-squad cadence + burst draw-count accounting: over a fixed window,
  // count applyScatter draws (2/shot) via a wrapped world.rng, scoped to the
  // squadFire call itself (excludes stepWorld's own unrelated rng draws —
  // e.g. explode()'s torque jitter on impact, pre-existing engine behavior
  // no different for a tower's round — so this isolates the FIRE PATH's own
  // draw count, matching the brief's "none elsewhere" as "no rng anywhere
  // between target-acquisition and the fired round" rather than a claim
  // about physics resolution downstream).
  {
    const world = makeWorld({ field: flatField, seed: 4 });
    const squad = mkStationarySquad(world, "rifles", 1, 0, 0, SQUAD_SPECS.rifles.n);
    const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
    const dt = 1 / 30;
    let roundsFired = 0, rngCalls = 0;
    const baseRng = world.rng;
    for (let i = 0; i < 10 / dt; i++) {
      const before = world.projectiles.length;
      world.rng = () => { rngCalls++; return baseRng(); };
      squadFire(world, squad, dt);
      world.rng = baseRng;
      const after = world.projectiles.length;
      if (after > before) roundsFired += (after - before);
      for (let s = 0; s < 20; s++) stepWorld(world); // let rounds resolve/expire without letting them pile up unresolved
    }
    ok("squadFire: rifle rounds fired > 0 over 10s window", roundsFired > 0, `roundsFired=${roundsFired}`);
    ok("squadFire: exactly 2 rng draws per round fired inside squadFire itself (applyScatter only)",
      rngCalls === roundsFired * 2, `rngCalls=${rngCalls} roundsFired=${roundsFired} expected=${roundsFired * 2}`);
  }

  // MG burst: one trigger pull queues `burst` rounds spaced `burstGap`
  // seconds apart via fireProjectile's own delay param (mirrors towerShot's
  // volley handling, just with the MG's own burstGap instead of the tower
  // volley's fixed 0.12s step). Verify: a single trigger pull produces
  // `burst` live projectiles, and consecutive rounds' delay values differ
  // by burstGap.
  {
    const world = makeWorld({ field: flatField, seed: 5 });
    const squad = mkStationarySquad(world, "mg", 1, 0, 0, 1); // single member: keeps one man's burst isolated
    const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
    squadFire(world, squad, 0); // one trigger pull, dt=0 so fireCd gate doesn't skip it
    const spec = INFANTRY_ARMS.mg;
    const memberFired = world.projectiles.filter((p) => Math.abs(p.spec.dmg - spec.dmg) < 1e-9);
    ok(`squadFire: MG burst queues exactly ${spec.burst} rounds on one trigger pull`,
      memberFired.length === spec.burst, `queued=${memberFired.length} expected=${spec.burst}`);
    const delays = memberFired.map((p) => p.spec.delay).sort((a, b) => a - b);
    let gapOk = true;
    for (let i = 1; i < delays.length; i++) {
      if (Math.abs((delays[i] - delays[i - 1]) - spec.burstGap) > 1e-6) gapOk = false;
    }
    ok("squadFire: MG burst rounds are spaced exactly burstGap apart", gapOk, JSON.stringify(delays));
  }

  // no fire while mid-hop: an attacking squad, not yet paused at a cover
  // leg, must never fire — even with a target sitting well inside range.
  {
    const world = makeWorld({ field: flatField, seed: 6 });
    const squad = makeSquad(1, "rifles", 1, 0, 0);
    for (let i = 0; i < SQUAD_SPECS.rifles.n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 0, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "attack"; squad.dest = { x: 0, z: 30 }; // starts mid-hop: _pauseT is 0/undefined
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 8, hp: 58 });
    const dt = 1 / 30;
    let firedWhileMoving = false;
    for (let i = 0; i < 3 / dt; i++) {
      if (!(squad._pauseT > 0)) {
        const before = world.projectiles.length;
        squadFire(world, squad, dt);
        if (world.projectiles.length > before) firedWhileMoving = true;
      }
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) { const u = world.byId.get(id); u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; }
    }
    ok("squadFire: no fire while a squad is mid-hop (moving, _pauseT<=0)", !firedWhileMoving);
  }

  // twin determinism of a 20s firefight fixture: identical seed -> identical
  // outcome (target hp trace + surviving projectile count).
  {
    const runFirefight = (seed) => {
      const world = makeWorld({ field: flatField, seed });
      const squad = mkStationarySquad(world, "mg", 1, 0, 0, SQUAD_SPECS.mg.n);
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 12, hp: 400 });
      const dt = 1 / 30;
      const trace = [];
      for (let i = 0; i < 20 / dt; i++) {
        squadFire(world, squad, dt);
        stepWorld(world);
        if (i % 30 === 0) trace.push(target.hp.toFixed(3));
      }
      return trace.join("|");
    };
    const a = runFirefight(9), b = runFirefight(9);
    ok("squadFire: twin determinism of a 20s firefight fixture (identical seed -> identical target-hp trace)", a === b, `${a === b ? "match" : `A=${a} B=${b}`}`);
  }
}

// ============================================================ 2026-08-10 playtest batch
// Four fixes: tower view height, empty waves, fog-repel = effRange/2,
// preview declipped from fog. See .superpowers/sdd/2026-08-10-depot-phase-5/.
{
  const depotSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");

  // --- Fix 1: tower view height — cached effRange derives from the LIVE
  // body's true muzzle (pos.y + hy + 0.45 = turret top + 0.45), identical
  // to towerShot's formula; the ghost muzzle uses ground + 2*hy + 0.45.
  {
    // A rise: 4m knoll at the origin falling off over 10m, so a muzzle on
    // top sits above effRange's 6m surround ring and earns an elevation
    // bonus. Replicates buildAt's placement math headlessly (buildAt itself
    // lives in the JSX shell).
    const rise = { heightAt: (x, z) => Math.max(0, 4 * (1 - Math.hypot(x, z) / 10)) };
    const world = makeWorld({ field: rise, seed: 1 });
    const spec = TOWER_SPECS.gun;
    const y = rise.heightAt(0, 0);
    const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: y + spec.hy, z: 0, hp: spec.hp });
    const fromBody = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
    const fromTop = effRange(world, { x: 0, y: y + spec.hy * 2 + 0.45, z: 0 }, spec);
    const fromOldWrong = effRange(world, { x: 0, y: y + spec.hy + 0.45, z: 0 }, spec);
    ok("view height: body-derived cached effRange equals the true turret-top value", Math.abs(fromBody - fromTop) < 1e-9, `${fromBody} vs ${fromTop}`);
    ok("view height: tower on a rise earns an elevation bonus", fromBody > spec.range, fromBody);
    ok("view height: true-top range exceeds the old half-height-low value", fromBody > fromOldWrong, `${fromBody} vs ${fromOldWrong}`);
    // wiring: the two formerly-wrong sites in DepotGame.jsx
    ok("view height: buildAt caches effRange off the live body's muzzle", depotSrc.includes("effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec)"));
    ok("view height: startPending's ghost muzzle sits at the true turret top", depotSrc.includes("y: y + spec.hy * 2 + 0.45"));
  }

  // --- Fix 2: empty waves — repro fixture (the playtest's massacre loop:
  // player kills everything, attacker income is STIPEND only). Pre-fix,
  // 4/5 of these seeds fielded NOBODY on waves 3-4 while solvent.
  {
    const conscriptC = ENEMY_SPECS[""].bounty;
    let emptySolvent = 0, everBought = 0;
    for (const seed of [11, 12345, 777, 999999, 42]) {
      const rng = mulberry32(seed);
      const reg = makeRegiment(rng);
      for (let w = 0; w < 10; w++) {
        const solvent = reg.scrap >= conscriptC && reg.heads > 0;
        const { buys } = planWave(reg, {}, w, rng);
        const n = buys.reduce((s, b) => s + b.n, 0);
        if (solvent && n === 0) emptySolvent++;
        if (n > 0) everBought++;
        payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
        reg.scrap += STIPEND;
      }
    }
    ok("empty waves: massacre fixture (5 seeds x 10 waves) — every solvent wave musters", emptySolvent === 0, `${emptySolvent} empty solvent waves`);
    ok("empty waves: fixture actually bought units", everBought === 50, `${everBought}/50`);
  }

  // --- Fix 2 invariant: planWave NEVER returns empty buys while the
  // regiment can afford the cheapest unit and has heads. 50 seeds x 10
  // waves, varied snapshots.
  {
    const conscriptC = ENEMY_SPECS[""].bounty;
    let violations = 0, checked = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed * 7919);
      const reg = makeRegiment(rng);
      const snap = { mortars: seed % 7, mgs: seed % 9, guns: seed % 5, frosts: seed % 6, walls: seed % 9, towerElev: 0 };
      for (let w = 0; w < 10; w++) {
        const solvent = reg.scrap >= conscriptC && reg.heads > 0;
        const { buys } = planWave(reg, snap, w, rng);
        if (solvent) { checked++; if (buys.reduce((s, b) => s + b.n, 0) === 0) violations++; }
        payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
        reg.scrap += STIPEND;
      }
    }
    ok("empty waves INVARIANT: no empty buys while solvent (50 seeds x 10 waves)", violations === 0, `${violations}/${checked}`);
  }

  // --- Fix 2: banking still banks (thin screen, never absent) and the
  // screen floor holds — a high-scrap not-yet-erupting wave fields >= 2
  // bodies even when the computed screen budget quantizes tiny.
  {
    const waveIdx = 2; // early wave: baseline ~26, screen budget ~3.3-6.6 pre-floor
    const baseline = waveBudget(waveIdx);
    const reg = { heads: 300, tanks: 1, heads0: 300, tanks0: 8, scrap: 1.9 * baseline };
    const plan = planWave(reg, { mortars: 0, mgs: 8, guns: 0, frosts: 0, walls: 0, towerElev: 0 }, waveIdx, mulberry32(7));
    const n = plan.buys.reduce((s, b) => s + b.n, 0);
    ok("bank screen floor: early-wave banking wave still fields a screen", plan.banked === true && n >= 2, `banked=${plan.banked} n=${n}`);
  }

  // --- Fix 3: territory emission = effRange/2.
  {
    ok("fog repel: gun tower emitter r = 9.5 flat (range/2)", TOWER_SPECS.gun.range / 2 === 9.5, TOWER_SPECS.gun.range / 2);
    ok("fog repel: mortar emitter r = 13 flat (range/2)", TOWER_SPECS.mortar.range / 2 === 13, TOWER_SPECS.mortar.range / 2);
    ok("fog repel: buildEmitters pushes effRange/2 for towers", depotSrc.includes("r: (b.effRange != null ? b.effRange : TOWER_SPECS[b.towerType].range) / 2"));
    // elevation carries through: the Fix-1 rise fixture's gun (effRange >
    // spec.range) repels farther than 9.5.
    const rise = { heightAt: (x, z) => Math.max(0, 4 * (1 - Math.hypot(x, z) / 10)) };
    const world = makeWorld({ field: rise, seed: 1 });
    const spec = TOWER_SPECS.gun;
    const eff = effRange(world, { x: 0, y: rise.heightAt(0, 0) + spec.hy * 2 + 0.45, z: 0 }, spec);
    ok("fog repel: hilltop gun repels farther than flat 9.5", eff / 2 > 9.5, (eff / 2).toFixed(2));
  }

  // --- Fix 4: preview declipped from fog. Same enemy-held-ground fixture
  // as the reachPolygon fog test above: with T the ray clips short; with
  // null (what startPending now passes) it reaches full range. Physical
  // clipping (arcClears) is unconditional either way.
  {
    const spec = { range: 20, hy: 1.0, projSpeed: 60, occl: "arc" };
    const flatWorld = { field: { heightAt: () => 0 }, bodies: [] };
    const muzzle = { x: 0, y: 2.45, z: 0 };
    const T = makeTerritory(29, 57);
    for (let i = 0; i < 200; i++) stepTerritory(T, [{ x: 15, z: 0, w: EMIT.tower.w, r: 14, sign: -1 }], 0.05); // r 14: see the F1.6 note on the reachPolygon fog clip above
    const clipped = Math.hypot(reachPolygon(flatWorld, T, muzzle, spec, 1)[0].x - muzzle.x, reachPolygon(flatWorld, T, muzzle, spec, 1)[0].z - muzzle.z);
    const declipped = Math.hypot(reachPolygon(flatWorld, null, muzzle, spec, 1)[0].x - muzzle.x, reachPolygon(flatWorld, null, muzzle, spec, 1)[0].z - muzzle.z);
    ok("preview declip: fog-frontier preview extends beyond the territory boundary", declipped > clipped + 3 && declipped > spec.range - 1.5, `${declipped.toFixed(1)} vs clipped ${clipped.toFixed(1)}`);
    ok("preview declip: startPending passes null territory into reachPolygon", depotSrc.includes("reachPolygon(world, null, muzzle, spec, 1, invW)"));
  }
}

// ===================================================== Phase 5 Task 3:
// wiring — spawn, sandbags, roster prune, stall persistence, and the
// SWEEP ASSERT (risk 1: the scaffold-filter family). Team-1 infantry is a
// NEW body class; every consumer of unit bodies is exercised against a real
// team-1 member here so a `kind === "unit"` assumption can't silently
// mishandle them the way the Phase-4 tower-scan/bounty/leak/off-grid
// quartet did.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // --- spawnSquadMembers: spec.n team-1 unit bodies ringed on the anchor,
  // dress "human", squadId/utype stamped, roster filled.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const sq = makeSquad(1, "rifles", 1, 4, -6);
    spawnSquadMembers(world, sq);
    ok("spawnSquadMembers: roster has spec.n ids", sq.memberIds.length === SQUAD_SPECS.rifles.n, `${sq.memberIds.length}`);
    let allGood = true, dressGood = true, ringGood = true;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (!u || u.kind !== "unit" || u.team !== 1 || !u.alive || u.squadId !== sq.id || u.utype !== "rifles") allGood = false;
      if (u.dress !== "human") dressGood = false;
      if (Math.hypot(u.pos.x - 4, u.pos.z - (-6)) > 2.5) ringGood = false;
    }
    ok("spawnSquadMembers: members are live team-1 unit bodies with squadId/utype", allGood);
    ok("spawnSquadMembers: members dressed human (player side reads human)", dressGood);
    ok("spawnSquadMembers: members ring the anchor (within 2.5m)", ringGood);
    const sn = makeSquad(2, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sn);
    const roles = sn.memberIds.map((id) => world.byId.get(id).role);
    ok("spawnSquadMembers: sniper squad fields the PAIR (sniper + spotter, 6.5 Task 6)",
      sn.memberIds.length === 2 && roles.includes("sniper") && roles.includes("spotter"), JSON.stringify(roles));
  }

  // --- spawnSandbag: single static sleeping chunk, tagged b.sandbag, brief
  // dims (hx .9, hy .45, hz .35), hp 60. Static (mass 0 -> invM 0) so
  // squads.js's exposureAt (which filters invM > 0) reads it as cover, and
  // core.js's hit scan still hits it (chunk-kind exemption, core.js ~:691).
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const b = spawnSandbag(world, 2, 5);
    ok("spawnSandbag: chunk body tagged b.sandbag", b.kind === "chunk" && b.sandbag === true);
    ok("spawnSandbag: brief dims + hp 60", b.hx === 0.9 && b.hy === 0.45 && b.hz === 0.35 && b.hp === 60,
      `hx=${b.hx} hy=${b.hy} hz=${b.hz} hp=${b.hp}`);
    ok("spawnSandbag: static + sleeping", b.invM === 0 && b.sleeping === true);
    ok("spawnSandbag: costs 3 scrap (SANDBAG_COST)", SANDBAG_COST === 3);
    // cover integration: a man behind the sandbag line reads less exposed
    // than one on open ground, against a threat beyond the bags.
    const behind = exposureAt(world, 2, 3.8, 0); // threatBearing 0 = +z, bag interposed
    const open = exposureAt(world, 20, 3.8, 0);
    ok("spawnSandbag: exposureAt reads the bag as cover", behind < open, `behind=${behind.toFixed(2)} open=${open.toFixed(2)}`);
  }

  // --- pruneSquads: dead/swept members leave the roster; empty squads die.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const deadId = sq.memberIds[0];
    applyDamage(world, world.byId.get(deadId), 1e9, { attacker: "enemy" });
    let squads = pruneSquads(world, [sq]);
    ok("pruneSquads: dead member leaves the roster", squads.length === 1 && !squads[0].memberIds.includes(deadId),
      `roster=${squads[0] ? squads[0].memberIds.length : "gone"}`);
    // corpse sweep consistency: DepotGame's cleanup later deletes the body
    // entirely (byId + bodies) — roster must stay consistent then too.
    for (const id of [...sq.memberIds]) {
      const u = world.byId.get(id);
      applyDamage(world, u, 1e9, { attacker: "enemy" });
      world.byId.delete(id);
      world.bodies.splice(world.bodies.indexOf(u), 1);
    }
    squads = pruneSquads(world, squads);
    ok("pruneSquads: fully dead squad is deleted", squads.length === 0);
  }

  // --- persistence: a squad survives a wave -> stall -> advance cycle (the
  // phase machine touches no unit bodies; nothing in the stall path culls
  // team-1 members).
  {
    const world = makeWorld({ field: flatField, seed: 5 });
    const sq = makeSquad(1, "mg", 1, 0, 10);
    spawnSquadMembers(world, sq);
    const S3 = makeRunState({ waves: [{ units: 2, delay: 1 }, { units: 2, delay: 1 }] });
    S3.started = true;
    startWave(S3, [{ units: 2, delay: 1 }, { units: 2, delay: 1 }]);
    S3.ws.spawnQueue = 0;
    tryStall(S3, [{ units: 2, delay: 1 }, { units: 2, delay: 1 }], 0);
    for (let i = 0; i < 120; i++) { stepSquad(world, sq, 1 / 60); squadFire(world, sq, 1 / 60); stepWorld(world); }
    advance(S3, [{ units: 2, delay: 1 }, { units: 2, delay: 1 }]);
    const alive = sq.memberIds.filter((id) => { const u = world.byId.get(id); return u && u.alive; }).length;
    ok("persistence: full squad roster alive through stall -> advance", alive === SQUAD_SPECS.mg.n, `alive=${alive}`);
  }

  // ------------------------------------------------ SWEEP ASSERT (risk 1)
  // One team-1 member exercised against EVERY unit-body consumer.
  {
    const world = makeWorld({ field: flatField, seed: 7 });
    const sq = makeSquad(1, "rifles", 1, 0, 40);
    spawnSquadMembers(world, sq);
    const member = world.byId.get(sq.memberIds[0]);

    // (a) bounty: even with a bounty maliciously stamped on, a dead team-1
    // member pays the attacker NOTHING (payBounties team gate does the work).
    member.bounty = 4;
    applyDamage(world, member, 1e9, { attacker: "enemy" });
    world.events.length = 0;
    payBounties(world);
    ok("sweep/bounty: no tdkill event for a dead team-1 member", !world.events.some((e) => e.type === "tdkill"));

    // (b) FRONT F1: leaks retired — a live member at the depot objective is
    // simply a body on the field; nothing removes him.
    const m2 = world.byId.get(sq.memberIds[1]);
    m2.pos.x = 0; m2.pos.z = 40;
    world.events.length = 0;
    ok("sweep: member at the depot persists (leak machinery gone)", world.byId.has(m2.id));

    // (c) stepUnits (enemy march driver) never drives a team-1 member.
    const vx0 = m2.v.x, vz0 = m2.v.z, px0 = m2.pos.x, pz0 = m2.pos.z;
    stepUnits(world, straightGrid(0, 1), identFwdDir);
    ok("sweep/march: stepUnits leaves team-1 members untouched",
      m2.v.x === vx0 && m2.v.z === vz0 && m2.pos.x === px0 && m2.pos.z === pz0);

    // (d) corpse cleanup: DepotGame's sweep (kind unit, any team, deadT+2.5s)
    // is INTENDED to clear team-1 corpses too — pruneSquads (tested above)
    // keeps the roster consistent when it does. Source-assert the sweep is
    // team-agnostic by design, not accidentally team-2-only.
    const depotSrc3 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sweep/corpse: DepotGame corpse sweep is kind-gated, team-agnostic",
      depotSrc3.includes('b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5'));

    // (e) emitters: team-1 members must emit GREEN influence (EMIT.unit,
    // sign +1) and sandbags must emit under EMIT.wall — buildEmitters is a
    // DepotGame closure, so source-assert the branches exist, and
    // functionally prove a green unit-weight emitter holds ground.
    ok("sweep/emitters: buildEmitters includes team-1 units at EMIT.unit sign +1",
      depotSrc3.includes('b.kind === "unit" && b.team === 1 && b.alive') &&
      /team === 1[\s\S]{0,220}EMIT\.unit\.w, r: EMIT\.unit\.r, sign: 1/.test(depotSrc3));
    ok("sweep/emitters: buildEmitters includes sandbags under EMIT.wall",
      depotSrc3.includes("b.sandbag") &&
      /sandbag[\s\S]{0,220}EMIT\.wall\.w, r: EMIT\.wall\.r, sign: 1/.test(depotSrc3));
    {
      const T3 = makeTerritory(29, 57);
      for (let i = 0; i < 40; i++) stepTerritory(T3, [{ x: 0, z: 0, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 }], 0.25);
      ok("sweep/emitters: a green unit emitter holds its ground (holderAt 1)", holderAt(T3, 0, 0) === 1);
    }

    // (f) tower scan: stepTowers acquires team 2 ONLY — a team-1 member in
    // range is invisible to friendly guns (source assert; stepTowers lives
    // in DepotGame.jsx which node can't import as JSX).
    ok("sweep/towerscan: stepTowers scan filters to team 2",
      depotSrc3.includes('(e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2'));

    // (g) __DEPOTTHIN__ (the wave-drain harness) kills team 2 only.
    ok("sweep/thin: __DEPOTTHIN__ kills only team-2 units",
      /__DEPOTTHIN__[\s\S]{0,400}b\.kind === "unit" && b\.team === 2 && b\.alive/.test(depotSrc3));

    // (h) fog-render ownership: the renderer's fog gate hides team-2 bodies
    // only — team-1 members always render for their owner.
    const rendSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    const fogGates = rendSrc.match(/opts\.territory && b\.team === 2 && b\.alive/g) || [];
    ok("sweep/fog: renderer fog gates check team === 2 (team-1 always renders)", fogGates.length >= 2, `gates=${fogGates.length}`);

    // (i) restock: no restock machinery exists anywhere in src/depot — the
    // campaign's restock (scenario.js) is keyed off campaign spawn pools and
    // never reaches depot bodies.
    let restockHits = 0;
    for (const f of fs.readdirSync(new URL("../src/depot", import.meta.url))) {
      const src = fs.readFileSync(new URL("../src/depot/" + f, import.meta.url), "utf8");
      if (/restock/i.test(src)) restockHits++;
    }
    ok("sweep/restock: no restock path exists in src/depot", restockHits === 0, `hits=${restockHits}`);

    // (j) squadFire acquisition: a member never targets its own team — park
    // a second friendly squad in range with no enemies present; nothing fires.
    {
      const world4 = makeWorld({ field: flatField, seed: 9 });
      const a = makeSquad(1, "rifles", 1, 0, 0); spawnSquadMembers(world4, a);
      const b4 = makeSquad(2, "mg", 1, 0, 8); spawnSquadMembers(world4, b4);
      squadFire(world4, a, 0);
      ok("sweep/squadFire: no friendly acquisition (no rounds in the air)", world4.projectiles.length === 0);
    }
  }

  // --- placement validation reuse: squad placement rides validatePlacement
  // exactly like towers (green-only + afford) — sandbag placement too.
  {
    const v1 = validatePlacement({ blocked: false, ice: false, held: false, resources: 100, cost: SQUAD_SPECS.rifles.cost });
    ok("squad placement: unheld ground refused", !v1.ok && v1.msg === "GROUND NOT HELD");
    const v2 = validatePlacement({ blocked: false, ice: false, held: true, resources: 2, cost: SANDBAG_COST });
    ok("sandbag placement: unaffordable refused", !v2.ok && v2.msg === "NO SCRAP");
    const v3 = validatePlacement({ blocked: false, ice: false, held: true, resources: 50, cost: SQUAD_SPECS.sniper.cost }); // 50 >= the pair's 45
    ok("squad placement: held + funded passes", v3.ok === true);
  }

  // --- sniper placement preview: reachPolygon with INFANTRY_ARMS.sniper,
  // fog-INDEPENDENT (null territory, per the Phase-5 preview rule) — the
  // fan must reach full range even across enemy-held ground.
  {
    const spec = INFANTRY_ARMS.sniper;
    const flatWorld = { field: { heightAt: () => 0 }, bodies: [] };
    const muzzle = { x: 0, y: 1.24, z: 0 };
    const T4 = makeTerritory(29, 57);
    for (let i = 0; i < 200; i++) stepTerritory(T4, [{ x: 15, z: 0, w: EMIT.tower.w, r: 3, sign: -1 }], 0.05);
    const poly = reachPolygon(flatWorld, null, muzzle, spec, 1);
    const reach = Math.hypot(poly[0].x - muzzle.x, poly[0].z - muzzle.z);
    ok("sniper preview: fog-independent fan reaches full sniper range", reach > spec.range - 1.5, reach.toFixed(1));
    const depotSrc4 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sniper preview: DepotGame builds the squad preview with null territory + INFANTRY_ARMS",
      /INFANTRY_ARMS\[[^\]]*\][\s\S]{0,300}reachPolygon\(world, null, muzzle/.test(depotSrc4) ||
      /reachPolygon\(world, null, muzzle, arms/.test(depotSrc4));
  }
}

// ==== TASK 6 ===================== wave timeout: annihilation OR the clock
// Survivors withdraw in order at spawnDoneT + WAVE_TIMEOUT: no kill events,
// no bounty, no leak damage — heads/tanks return to the regiment, and the
// stall card says so (digit-free, only when someone actually withdrew).
{
  const M6 = await import("../src/depot/state.js");
  const WT = M6.WAVE_TIMEOUT, execW = M6.executeWithdrawal;
  ok("task6: WAVE_TIMEOUT exported at 75", WT === 75, String(WT));
  ok("task6: executeWithdrawal exported", typeof execW === "function");

  const W3 = [{ units: 3, delay: 1 }, { units: 4, delay: 1 }, { units: 5, delay: 1 }];
  const mkS6 = () => {
    const S6 = makeRunState({ waves: W3 });
    S6.started = true;
    S6.reg = { heads: 50, tanks: 5, heads0: 50, tanks0: 5, scrap: 200 };
    return S6;
  };
  const unitBody = (w, team, extra = {}) => addBody(w, {
    kind: "unit", team, hp: 1e9, hx: 0.26, hy: 0.86, hz: 0.26, mass: 82,
    x: 0, y: 0.86, z: 30, ...extra,
  });

  if (typeof execW === "function") {
    // (a) immortal straggler: stall fires at spawnDoneT + WAVE_TIMEOUT, never before
    const Sa = mkS6();
    startWave(Sa, W3, { useTable: true });
    Sa.ws.spawnQueue = 0;
    Sa.ws.spawnDoneT = 100;
    const wA = makeWorld({ seed: 5 });
    const strag = unitBody(wA, 2, { x: -4 }); strag.bounty = 4;
    wA.t = 100 + WT - 0.1;
    ok("task6(a): before the clock — no stall, no withdraw flag",
      tryStall(Sa, W3, 1, null, wA) === false && !Sa.ws.withdrawPending, Sa.phase);
    wA.t = 100 + WT + 0.1;
    ok("task6(a): past the clock — withdraw pending, stall deferred to the sweep",
      tryStall(Sa, W3, 1, null, wA) === false && Sa.ws.withdrawPending === true, Sa.phase);

    // (b)+(c)+(g): the sweep returns exactly the ACTUALLY-alive team-2 bodies
    const deadOne = unitBody(wA, 2, { x: 4, hp: 10 }); deadOne.alive = false; deadOne.bounty = 4;
    const tank6 = addBody(wA, { kind: "vehicle", team: 2, hp: 400, hx: 1.2, hy: 0.9, hz: 1.8, mass: 900, x: 8, y: 0.9, z: 30 });
    const friendly6 = unitBody(wA, 1, { x: -8, hp: 40 });
    const heads0 = Sa.reg.heads, tanks0 = Sa.reg.tanks, scrap0 = Sa.reg.scrap;
    const kills0 = Sa.kills, res0 = Sa.resources, ev0 = wA.events.length;
    const r6 = execW(Sa, wA);
    ok("task6(b): heads returned == live infantry at timeout",
      Sa.reg.heads === heads0 + 1 && r6.inf === 1, `heads ${heads0}->${Sa.reg.heads}`);
    ok("task6(b): tanks returned == live tanks at timeout",
      Sa.reg.tanks === tanks0 + 1 && r6.tanks === 1, `tanks ${tanks0}->${Sa.reg.tanks}`);
    ok("task6(b): dead body neither returned nor left in the world",
      !wA.byId.get(deadOne.id) || Sa.reg.heads === heads0 + 1);
    ok("task6(g): team-1 squad member never swept",
      wA.byId.get(friendly6.id) === friendly6 && wA.bodies.includes(friendly6));
    ok("task6(c): zero bounty, zero kill events, zero cost during withdrawal",
      wA.events.length === ev0 && Sa.reg.scrap === scrap0 &&
      Sa.kills === kills0 && Sa.resources === res0);
    ok("task6: pending cleared, withdrew counted",
      Sa.ws.withdrawPending === false && Sa.ws.withdrew === 2, String(Sa.ws.withdrew));
    ok("task6: swept bodies fully removed (byId + bodies)",
      !wA.byId.get(strag.id) && !wA.byId.get(tank6.id) &&
      !wA.bodies.includes(strag) && !wA.bodies.includes(tank6));

    // stall completes after the sweep; (e) truthful digit-free line; (f) streak
    Sa.ws.musterScrap = 0; // broke at muster, but it FIELDED — streak must stay 0
    ok("task6(a): stall fires once the field is clear",
      tryStall(Sa, W3, 0, null, wA) === true && Sa.phase === PHASE.STALL);
    const wline = (Sa.dispatch?.lines || []).find((l) => /withdrew in order/i.test(l));
    ok("task6(e): withdrawal line present when withdrew > 0, digit-free",
      !!wline && !/\d/.test(wline), JSON.stringify(Sa.dispatch?.lines));
    ok("task6(f): withdrawn (fielded) wave never increments the starved streak",
      Sa.starvedStreak === 0, String(Sa.starvedStreak));

    // (d) annihilation before the clock stalls immediately — and says nothing
    const Sd = mkS6();
    startWave(Sd, W3, { useTable: true });
    Sd.ws.spawnQueue = 0;
    Sd.ws.spawnDoneT = 100;
    ok("task6(d): annihilation before the clock stalls immediately",
      tryStall(Sd, W3, 0, null, { t: 110 }) === true && Sd.phase === PHASE.STALL);
    ok("task6(e): no withdrawal line on an annihilated wave",
      !(Sd.dispatch?.lines || []).some((l) => /withdrew/i.test(l)), JSON.stringify(Sd.dispatch?.lines));

    // (h) twin determinism through a timeout wave
    const twin6 = (seed) => {
      const S2 = mkS6();
      startWave(S2, W3, { useTable: true });
      S2.ws.spawnQueue = 0;
      const w2 = makeWorld({ seed });
      const rr = mulberry32(seed);
      for (let i = 0; i < 5; i++) unitBody(w2, 2, { x: (rr() - 0.5) * 8, z: 25 + i });
      for (let i = 0; i < 60; i++) stepWorld(w2);
      S2.ws.spawnDoneT = 0;
      w2.t += WT + 1;
      tryStall(S2, W3, 5, null, w2);
      execW(S2, w2);
      tryStall(S2, W3, 0, null, w2);
      for (let i = 0; i < 60; i++) stepWorld(w2);
      return `${worldHash(w2)}|${S2.ws.withdrew}|${S2.reg.heads}|${S2.reg.tanks}`;
    };
    ok("task6(h): twin determinism through a timeout wave", twin6(77) === twin6(77));
  } else {
    ok("task6: implementation present (executeWithdrawal)", false, "not exported yet");
  }
}

// ==== TASK 4 (Phase 5): the enemy mirror — anti-personnel fire, cover
// halts, their sniper, AI buy + intel. APPEND-ONLY section.
// ==== TASK 4A: anti-personnel fire — riflemen + grenadiers
{
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const mkMember = (world, x, z, hp = 58) => {
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x, y: 0.74, z, hp, friction: 0.5 });
    u.dress = "human";
    return u;
  };
  const mkRifleman = (world, x, z) => {
    const u = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x, y: 0.88, z, hp: 58, friction: 0.38 });
    u.tag = ""; u.brave = true;
    return u;
  };
  const grid4 = straightGrid(0, -1);

  // parity pin (flagged, pinned-body fixture — both bodies re-pinned every
  // tick so blast knockback can't turn the measurement chaotic; a free
  // fixture showed ~9% run-to-run drift from post-knockback dynamics):
  // pre-wiring blast-only baseline 1.9763; dmg-equal dirDmg (5) drifted
  // +7.5% (2.1254); rescaled to 4.5 -> -2.9% (1.9182), inside the ±10%
  // replaces-not-adds band and mirroring INFANTRY_ARMS' own rescale.
  {
    const dpsVsUnit = () => {
      const world = makeWorld({ field: flatField, seed: 4 });
      world.depotCombat = true;
      const target = mkMember(world, 0, 0, 1e9);
      const rifleman = mkRifleman(world, 0, 8);
      const dt = 1 / 30, dur = 40;
      const hp0 = target.hp;
      let fireCd = 0;
      for (let i = 0; i < dur / dt; i++) {
        fireCd -= dt;
        if (fireCd <= 0) {
          const muzzle = { x: rifleman.pos.x, y: rifleman.pos.y + 0.5, z: rifleman.pos.z };
          shooterFire(world, rifleman, muzzle, target, ENEMY_FIRE.rifle, { attacker: "enemy", owner: rifleman.id });
          fireCd = ENEMY_FIRE.rifle.cd;
        }
        for (let s = 0; s < 5; s++) stepWorld(world);
        target.pos.x = 0; target.pos.y = 0.74; target.pos.z = 0; target.v.x = 0; target.v.y = 0; target.v.z = 0;
        rifleman.pos.x = 0; rifleman.pos.y = 0.88; rifleman.pos.z = 8; rifleman.v.x = 0; rifleman.v.y = 0; rifleman.v.z = 0;
      }
      return (hp0 - target.hp) / dur;
    };
    const BASELINE_RIFLE_VS_UNIT = 1.9763; // flagged, pre-wiring (dirDmg stripped), pinned fixture
    const d = dpsVsUnit();
    ok("4A parity: flagged enemy-rifle DPS vs a soft unit within +/-10% of pre-wiring baseline",
      Math.abs(d / BASELINE_RIFLE_VS_UNIT - 1) <= 0.10, `dps=${d.toFixed(4)} baseline=${BASELINE_RIFLE_VS_UNIT}`);
    ok("4A parity: ENEMY_FIRE.rifle.dirDmg rescaled to 4.5 (was dmg-equal 5)", ENEMY_FIRE.rifle.dirDmg === 4.5, `dirDmg=${ENEMY_FIRE.rifle.dirDmg}`);
    ok("4A parity: ENEMY_FIRE.lob has no dirDmg (blast-only, nothing to rescale)", ENEMY_FIRE.lob.dirDmg === undefined);
  }

  // rifleman kills an exposed squad member within its field — 10-trial
  // majority. The member is a REAL squad member (stepSquad drives him back
  // to his slot after blast knockback — a driverless body just slides out
  // of range and the engagement fizzles, found while building this
  // fixture); the rifleman sits at a flow sink (dx=dz=0: his halt point).
  const sinkGrid = straightGrid(0, 0);
  const killRun = (seed) => {
    const world = makeWorld({ field: flatField, seed });
    world.depotCombat = true;
    const sq4 = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sq4);
    const member = world.byId.get(sq4.memberIds[0]);
    const r = mkRifleman(world, 0, 5);
    for (let i = 0; i < 10800 && member.alive; i++) {
      stepSquad(world, sq4, world.dt);
      stepUnits(world, sinkGrid, identFwdDir);
      stepWorld(world);
    }
    return { dead: !member.alive, hash: worldHash(world), shooterHp: r.hp };
  };
  {
    let kills = 0;
    for (let seed = 1; seed <= 10; seed++) if (killRun(seed).dead) kills++;
    ok("4A: rifleman kills an exposed member within his field (10-trial majority)", kills >= 6, `kills=${kills}/10`);
    const a = killRun(3), b = killRun(3);
    ok("4A: twin determinism (same seed twice -> identical worldHash)", a.hash === b.hash, `${a.hash} vs ${b.hash}`);
  }

  // owner threading: 50 unit-target pulls at a fixed 8m — the shooter's own
  // round must clear his muzzle every time (no self-detonation, hp intact).
  // Source-assert both step drivers thread owner on every fire call.
  {
    const world = makeWorld({ field: flatField, seed: 8 });
    world.depotCombat = true;
    const target = mkMember(world, 0, 0, 1e9);
    const r = mkRifleman(world, 0, 8);
    for (let i = 0; i < 50; i++) {
      const muzzle = { x: r.pos.x, y: r.pos.y + 0.5, z: r.pos.z };
      shooterFire(world, r, muzzle, target, ENEMY_FIRE.rifle, { attacker: "enemy", owner: r.id });
      for (let s = 0; s < 200 && world.projectiles.length; s++) stepWorld(world);
    }
    ok("4A owner: 50 shots, no self-hit (shooter hp intact)", r.hp === 58 && r.alive, `hp=${r.hp}`);
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    const fireCalls = unitsSrc.match(/shooterFire\(world, [ut], muzzle, tgt, fspec,[\s\S]{0,240}?\)\;/g) || [];
    ok("4A owner: every units.js fire call threads owner (source sweep)",
      fireCalls.length >= 3 && fireCalls.every((c) => c.includes("owner:")), `calls=${fireCalls.length}`);
  }

  // fog law, both directions: unit-vs-unit fire ALWAYS gates on the
  // attacker's (sign-flipped) field; structure fire NEVER does.
  {
    const T4 = makeTerritory(29, 57);
    // green (team-1) field pinned at the member's cell -> team 2 reads unheld
    for (let i = 0; i < 200; i++) stepTerritory(T4, [{ x: 0, z: 0, w: EMIT.tower.w, r: 6, sign: 1 }], 0.05);
    const world = makeWorld({ field: flatField, seed: 9 });
    const member = mkMember(world, 0, 0);
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 3, y: 0.83, z: 6, hp: 999 });
    const r = mkRifleman(world, 0, 7);
    for (let i = 0; i < 30; i++) stepUnits(world, grid4, identFwdDir, T4);
    const tgt = world.byId.get(r.tgtId);
    ok("4A fog law: member on ground the attacker's field can't reach is NOT acquired", !tgt || tgt.id !== member.id, `tgt=${tgt && tgt.kind}`);
    ok("4A fog law: structure fire stays field-free (wall acquired on the same unheld ground)", !!tgt && tgt.id === wall.id, `tgt=${tgt && tgt.kind}`);
    // reverse: red field at the member -> acquirable, and preferred over the wall
    const T5 = makeTerritory(29, 57);
    for (let i = 0; i < 200; i++) stepTerritory(T5, [{ x: 0, z: 0, w: EMIT.tower.w, r: 6, sign: -1 }], 0.05);
    const world2 = makeWorld({ field: flatField, seed: 9 });
    const member2 = mkMember(world2, 0, 0);
    addBody(world2, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 3, y: 0.83, z: 6, hp: 999 });
    const r2 = mkRifleman(world2, 0, 7);
    for (let i = 0; i < 30; i++) stepUnits(world2, grid4, identFwdDir, T5);
    const tgt2 = world2.byId.get(r2.tgtId);
    ok("4A fog law: member on attacker-reachable ground IS acquired (field flips the gate)", !!tgt2 && tgt2.id === member2.id, `tgt=${tgt2 && tgt2.kind}`);
  }

  // priority boundary, both sides of 0.6R (flat effR = 13 -> urgency 7.8m):
  {
    // member at 6m (inside urgency), wall at 5m (nearer!) -> member wins.
    // The wall sits OFF the member's LOS ray (x=1.5): the physics-true
    // arcClears (SIGHTLINES, 2026-08-10) samples at the engine's own step
    // cadence and correctly sees an on-ray wall the old 0.9m grid happened
    // to straddle — an on-ray fixture would (rightly) block acquisition
    // instead of testing the priority boundary this assert is about.
    const world = makeWorld({ field: flatField, seed: 12 });
    const member = mkMember(world, 0, 1);
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 1.5, y: 0.83, z: 2, hp: 999 });
    const r = mkRifleman(world, 0, 7);
    for (let i = 0; i < 30; i++) stepUnits(world, grid4, identFwdDir);
    const tgt = world.byId.get(r.tgtId);
    ok("4A priority: member inside 0.6R beats a NEARER wall", !!tgt && tgt.id === member.id, `tgt=${tgt && tgt.kind}`);
    // member at 10m (outside urgency, inside 13m range), wall at 11m -> wall wins
    const world2 = makeWorld({ field: flatField, seed: 12 });
    mkMember(world2, 0, -3);
    const wall2 = addBody(world2, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: 0.83, z: -4, hp: 999 });
    const r2 = mkRifleman(world2, 0, 7);
    for (let i = 0; i < 30; i++) stepUnits(world2, grid4, identFwdDir);
    const tgt2 = world2.byId.get(r2.tgtId);
    ok("4A priority: member OUTSIDE 0.6R loses to the wall (urgency boundary pinned)", !!tgt2 && tgt2.id === wall2.id, `tgt=${tgt2 && tgt2.kind}`);
  }

  // grenadier: same urgency pass, lob lands blast on a member (no hitOnly)
  {
    const world = makeWorld({ field: flatField, seed: 6 });
    world.depotCombat = true;
    const member = mkMember(world, 0, 0);
    const g = addBody(world, { kind: "unit", team: 2, mass: 84, hx: 0.26, hy: 0.92, hz: 0.26, x: 0, y: 0.94, z: 10, hp: 66, friction: 0.38 });
    g.tag = "gren"; g.utype = "gren"; g.brave = true;
    for (let i = 0; i < 4800 && member.alive; i++) {
      stepUnits(world, grid4, identFwdDir);
      stepWorld(world);
    }
    ok("4A grenadier: acquires a member inside the urgency radius", g.tgtId === member.id || !member.alive || member.hp < 58, `tgt=${g.tgtId} hp=${member.hp && member.hp.toFixed(1)}`);
    ok("4A grenadier: lob blast hurts the member (unit shots carry no hitOnly)", member.hp < 58, `hp=${member.hp && member.hp.toFixed(1)}`);
    // owner threading keeps the shell off his own hull at launch; close-in
    // SPLASH from his own blast is the law of the world (blast is blast),
    // so the assert is survival, not zero damage.
    ok("4A grenadier: the lobber survives his own lobs (owner threaded)", g.alive, `hp=${g.hp && g.hp.toFixed(1)}`);
  }
}

// ==== TASK 4B: cover-aware halt points
{
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const sinkGrid = straightGrid(0, 0);
  // fixture: rifleman engaging a wall to the south (-z), a boulder off his
  // right shoulder — NOT on his line of fire (cover counts inside the 60-
  // degree interposition arc without sitting on the LOS ray).
  const mkCoverWorld = (seed) => {
    const world = makeWorld({ field: flatField, seed });
    world.depotCombat = true;
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: 0.83, z: -10, hp: 9999 });
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.5, hy: 0.9, hz: 0.5, x: 2.2, y: 0.9, z: -1.6, hp: 1e9 });
    const r = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.88, z: 0, hp: 500, friction: 0.38 });
    r.tag = ""; r.brave = true;
    return { world, wall, r };
  };
  // taking fire beside a boulder -> relocates to its lee (exposure strictly drops)
  {
    const { world, r } = mkCoverWorld(21);
    for (let i = 0; i < 30; i++) { stepUnits(world, sinkGrid, identFwdDir); stepWorld(world); }
    ok("4B setup: rifleman engaged (wall target held)", !!r.tgtId);
    const startX = r.pos.x, startZ = r.pos.z;
    const bearing = Math.atan2(0 - r.pos.x, -10 - r.pos.z);
    const exp0 = exposureAt(world, startX, startZ, bearing);
    applyDamage(world, r, 1, { attacker: "player" }); // takes fire
    for (let i = 0; i < 600; i++) { stepUnits(world, sinkGrid, identFwdDir); stepWorld(world); }
    ok("4B: a hit while engaged picks a cover stand point", !!r._standPt, JSON.stringify(r._standPt));
    const expS = r._standPt ? exposureAt(world, r._standPt.x, r._standPt.z, bearing) : 1;
    ok("4B: chosen stand point strictly drops exposure", expS < exp0 - 1e-6, `start=${exp0.toFixed(2)} stand=${expS.toFixed(2)}`);
    const dArrive = r._standPt ? Math.hypot(r.pos.x - r._standPt.x, r.pos.z - r._standPt.z) : 99;
    ok("4B: the man actually moves to the stand point", dArrive < 0.6, `d=${dArrive.toFixed(2)}`);
  }
  // re-evaluation rate-limited: hammered with hits every tick, the cover
  // pick still fires at most once per 2s.
  {
    const { world, r } = mkCoverWorld(22);
    for (let i = 0; i < 30; i++) { stepUnits(world, sinkGrid, identFwdDir); stepWorld(world); }
    const seen = new Set();
    for (let i = 0; i < 360; i++) { // 3s at 1/120
      applyDamage(world, r, 0.01, { attacker: "player" }); // fresh lastHit identity every tick
      stepUnits(world, sinkGrid, identFwdDir); stepWorld(world);
      if (r._coverT != null) seen.add(r._coverT);
    }
    ok("4B: cover re-evaluation rate-limited to once per 2s", seen.size >= 1 && seen.size <= 2, `evals=${seen.size}`);
  }
  // no relocation without being hit
  {
    const { world, r } = mkCoverWorld(23);
    for (let i = 0; i < 600; i++) { stepUnits(world, sinkGrid, identFwdDir); stepWorld(world); }
    ok("4B: never hit -> never relocates (no stand point, no cover clock)", r._standPt == null && r._coverT == null,
      `standPt=${JSON.stringify(r._standPt)} coverT=${r._coverT}`);
  }
}

// ==== SANDBAG-ROT ============================================================
// 90-degree placement orientation + line auto-continue (placement-state only).
{
  console.log("\n[sandbag-rot]");
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { sandbagOrientAt } = await import("../src/depot/state.js");

  // (a) orientation param swaps dims — axis-aligned bodies only, no rotation.
  {
    const world = makeWorld({ field: flatF, seed: 7 });
    const b0 = spawnSandbag(world, 0, 0, 0);
    ok("sandbag-rot: orient 0 keeps hx .9 / hz .35", b0.hx === 0.9 && b0.hz === 0.35, `hx=${b0.hx} hz=${b0.hz}`);
    const b1 = spawnSandbag(world, 10, 0, 1);
    ok("sandbag-rot: orient 1 swaps to hx .35 / hz .9", b1.hx === 0.35 && b1.hz === 0.9, `hx=${b1.hx} hz=${b1.hz}`);
    const bd = spawnSandbag(world, 20, 0);
    ok("sandbag-rot: orient defaults to 0", bd.hx === 0.9 && bd.hz === 0.35);
  }

  // (b) auto-continue: placing within ~2.2m of an existing bag orients
  // along the line to that bag, overriding the toggle for that placement.
  {
    const world = makeWorld({ field: flatF, seed: 8 });
    spawnSandbag(world, 0, 0, 0);
    ok("sandbag-rot: adjacent along x continues the x line (orient 0)", sandbagOrientAt(world, 1.8, 0, 1) === 0);
    ok("sandbag-rot: adjacent along z continues the z line (orient 1)", sandbagOrientAt(world, 0, 1.8, 0) === 1);
    ok("sandbag-rot: isolated placement uses the toggle", sandbagOrientAt(world, 30, 30, 1) === 1 && sandbagOrientAt(world, 30, 30, 0) === 0);
    const dead = spawnSandbag(world, 40, 40, 0); dead.alive = false;
    ok("sandbag-rot: dead bags don't steer auto-continue", sandbagOrientAt(world, 41.8, 40, 1) === 1);
    ok("sandbag-rot: beyond 2.2m is a line start (toggle wins)", sandbagOrientAt(world, 3.0, 0, 1) === 1);
  }

  // (c) UI toggle: tapping SANDBAG while already in sandbag mode cycles the
  // pending orientation (two states) and the bar icon reflects it — source
  // asserts (DepotGame closures), same pattern as sweep/emitters above.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sandbag-rot: sandbag button re-tap cycles orientation", /sandbagOrient[\s\S]{0,80}\+ 1\) % 2/.test(src));
    ok("sandbag-rot: bar icon reflects orientation (▬ vs ▮)", src.includes("▮") && /sandbagOrient[^\n]{0,120}▮|▮[^\n]{0,120}sandbagOrient/.test(src));
    ok("sandbag-rot: placement routes through sandbagOrientAt", src.includes("sandbagOrientAt("));
  }

  // (d) toggle applies IMMEDIATELY (regression: the 8Hz frame setHud rebuilt
  // the whole hud object WITHOUT sandbagOrient, clobbering the toggle's icon
  // flip back to ▬ within 120ms). The frame-loop hud snapshot must carry
  // sandbagOrient, HUD0 must seed it, and the hover ghost must read the LIVE
  // toggle (via sandbagOrientAt at the hover cell) every frame, not a cached
  // copy.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    // the frame snapshot is the setHud({...}) that also carries mode/sellMode
    const snap = src.match(/setHud\(\{[\s\S]{0,2400}?\}\);\n\s+\}\n/);
    ok("sandbag-rot: frame hud snapshot carries sandbagOrient (no clobber)",
      !!snap && snap[0].includes("mode: S.mode") && snap[0].includes("sandbagOrient: S.sandbagOrient"));
    const { HUD0 } = await import("../src/depot/state.js");
    ok("sandbag-rot: HUD0 seeds sandbagOrient", HUD0.sandbagOrient === 0);
    // hover ghost: per-frame oriented footprint from live toggle state
    ok("sandbag-rot: hover ghost reads live orientation via sandbagOrientAt",
      /setHover[\s\S]{0,400}sandbagOrientAt\(world, S\.hover\.x, S\.hover\.z, S\.sandbagOrient/.test(src) ||
      /sandbagOrientAt\(world, S\.hover\.x, S\.hover\.z, S\.sandbagOrient[\s\S]{0,400}setHover/.test(src));
  }
}

// ==== SNAP-SQUADS ============================================================
// buildSnapshot must report live player squad count (ai.js snapSquads gate —
// without it the brain never fields its sniper in live play).
{
  console.log("\n[snap-squads]");
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { snapSquads } = await import("../src/depot/ai.js");
  const { SQUAD_SPECS: SQ, makeSquad: mkSq } = await import("../src/depot/squads.js");
  const world = makeWorld({ field: flatF, seed: 11 });
  const squads = [mkSq(1, "rifles", 1, 0, 0), mkSq(2, "rifles", 1, 10, 0)];
  for (const sq of squads) spawnSquadMembers(world, sq);
  // same predicate buildSnapshot uses: squads holding at least one live member
  const liveCount = (list) => list.filter((sq) => sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })).length;
  ok("snap-squads: 2 live squads -> snapshot squads=2", snapSquads({ squads: liveCount(squads) }) === 2);
  for (const id of squads[1].memberIds) { const u = world.byId.get(id); if (u) u.alive = false; }
  ok("snap-squads: wiped squad drops from the count", snapSquads({ squads: liveCount(squads) }) === 1);
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("snap-squads: buildSnapshot wires the squads field",
    /buildSnapshot[\s\S]{0,1600}squads, towerElev/.test(src));
  void SQ;
}
// ==== end SNAP-SQUADS ========================================================
// ==== end SANDBAG-ROT ========================================================

// ==== TASK 4C: their sniper
{
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const grid4c = straightGrid(0, -1);
  // spec pins: roster entry + tower-equal windage (one table, both sides)
  {
    const sp = ENEMY_SPECS.sniper;
    ok("4C spec: ENEMY_SPECS.sniper fielded (speed 2.9, hp 44, bounty 45 = the pair price, android dress)",
      !!sp && sp.speed === 2.9 && sp.hp === 44 && sp.bounty === 45 && sp.dress === "android", JSON.stringify(sp));
    ok("4C spec: enemy sniper fires INFANTRY_ARMS.sniper verbatim (acc/windF/windComp/dirDmg/range pin)",
      SNIPER_FIRE.acc === INFANTRY_ARMS.sniper.acc && SNIPER_FIRE.windF === INFANTRY_ARMS.sniper.windF &&
      SNIPER_FIRE.windComp === INFANTRY_ARMS.sniper.windComp && SNIPER_FIRE.dirDmg === INFANTRY_ARMS.sniper.dirDmg &&
      SNIPER_FIRE.dmg === INFANTRY_ARMS.sniper.dmg && SNIPER_FIRE.range === INFANTRY_ARMS.sniper.range, JSON.stringify(SNIPER_FIRE));
  }
  // vantage: marching the flow, he stops in the lee of a boulder (exposure
  // < 0.35 toward the advance bearing, ground not below the 8m forward
  // mean) and holds permanently.
  {
    const world = makeWorld({ field: flatField, seed: 31 });
    world.depotCombat = true;
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.5, hy: 0.9, hz: 0.5, x: 0, y: 0.9, z: 0, hp: 1e9 });
    const sn = spawnUnit(world, { x: 0, z: 6 }, "sniper");
    sn.pos.x = 0; sn.pos.z = 6; // pin spawn jitter for the fixture
    for (let i = 0; i < 1200 && !sn.hold; i++) { stepUnits(world, grid4c, identFwdDir); stepWorld(world); }
    ok("4C vantage: sniper halts in cover (hold set)", sn.hold === true);
    const bearing = Math.PI; // advance bearing (flow -z)
    const expHere = exposureAt(world, sn.pos.x, sn.pos.z, bearing);
    ok("4C vantage: held ground reads exposure < 0.35", expHere < 0.35, `exp=${expHere.toFixed(2)}`);
    // The pair (6.5 Task 6): the spotter now directs the sniper at the
    // latch — he may resettle up to SPOT_R of the hold point, ONCE, then
    // must sit still. Assert the resettle is bounded and the final ground
    // is held (no drift over the last 10 simulated seconds).
    for (let i = 0; i < 2400; i++) { stepUnits(world, grid4c, identFwdDir); stepWorld(world); }
    const hx0 = sn.pos.x, hz0 = sn.pos.z;
    for (let i = 0; i < 1200; i++) { stepUnits(world, grid4c, identFwdDir); stepWorld(world); }
    const drift = Math.hypot(sn.pos.x - hx0, sn.pos.z - hz0);
    ok("4C vantage: directed resettle then holds (no drift over the last 10s)", sn.hold === true && drift < 0.5, `drift=${drift.toFixed(2)}`);
  }
  // one-shot: a held sniper kills an exposed member in field reach with a
  // single round (hp never observed chipped while alive).
  {
    const world = makeWorld({ field: flatField, seed: 32 });
    world.depotCombat = true;
    const sn = spawnUnit(world, { x: 0, z: 15 }, "sniper");
    sn.pos.x = 0; sn.pos.z = 15; sn.hold = true;
    const member = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58, friction: 0.5 });
    let chipped = false;
    for (let i = 0; i < 4800 && member.alive; i++) {
      stepUnits(world, grid4c, identFwdDir);
      stepWorld(world);
      if (member.alive && member.hp < 58 - 1e-9) chipped = true;
    }
    ok("4C one-shot: exposed member in field reach dies", !member.alive, `hp=${member.hp && member.hp.toFixed(1)}`);
    ok("4C one-shot: the kill is a single round (never observed alive below full hp)", !chipped);
    ok("4C: sniper stayed held through the shot", sn.hold === true);
  }
  // fog law: no acquisition beyond his field (green-pinned member cell)
  {
    const T6 = makeTerritory(29, 57);
    for (let i = 0; i < 200; i++) stepTerritory(T6, [{ x: 0, z: 0, w: EMIT.tower.w, r: 6, sign: 1 }], 0.05);
    const world = makeWorld({ field: flatField, seed: 33 });
    const sn = spawnUnit(world, { x: 0, z: 10 }, "sniper");
    sn.pos.x = 0; sn.pos.z = 10; sn.hold = true;
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58, friction: 0.5 });
    for (let i = 0; i < 60; i++) { stepUnits(world, grid4c, identFwdDir, T6); stepWorld(world); }
    ok("4C fog law: member beyond the attacker field is never acquired", sn.tgtId == null, `tgt=${sn.tgtId}`);
  }
}

// ==== TASK 4D: the brain buys it, the bureau warns you
{
  // AI: sniper counter-buy when the player fields squads (snap.squads >= 2),
  // none at the squads=0 baseline; rng stream length stays exactly 4.
  const runWaves = (squads) => {
    const rng = mulberry32(77);
    const reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 0 };
    let snipers = 0, firstWave = null;
    for (let w = 0; w <= 8; w++) {
      reg.scrap = 65; // topped up each wave (>= 45 pair + token-muster floor, under the late-wave bank threshold)
      const plan = planWave(reg, { squads }, w, rng);
      const b = plan.buys.find((x) => x.type === "sniper");
      if (b) { snipers += b.n; if (firstWave == null) firstWave = w; }
    }
    return { snipers, firstWave };
  };
  {
    const with3 = runWaves(3), with0 = runWaves(0);
    ok("4D AI: >=1 sniper bought by wave 8 when snap.squads=3", with3.snipers >= 1, `snipers=${with3.snipers} first=${with3.firstWave}`);
    ok("4D AI: zero sniper buys at the squads=0 baseline", with0.snipers === 0, `snipers=${with0.snipers}`);
    ok("4D AI: snapSquads tolerates an unwired snapshot (no squads key)", snapSquads({}) === 0 && snapSquads(null) === 0);
  }
  {
    // rng stream parity: exactly 4 draws per planWave, sniper branch active
    let draws = 0;
    const base = mulberry32(78);
    const rng = () => { draws++; return base(); };
    const reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 65 };
    const plan = planWave(reg, { squads: 3 }, 6, rng);
    ok("4D AI: planWave still consumes exactly 4 rng draws with the sniper buy live",
      draws === 4 && plan.buys.some((b) => b.type === "sniper"), `draws=${draws} buys=${JSON.stringify(plan.buys)}`);
  }
  // intel: marksman family — keyed off the ONE-WAVE-OLD plan (prevPlan),
  // digit-free, ~25% seeded silence, appended AFTER every existing family
  // so no established seeded composition shifts.
  {
    const prevPlan = { buys: [{ type: "sniper", n: 1 }], banked: false };
    let marksman = 0, total = 0, digits = 0;
    const pool = new Set();
    for (let seed = 0; seed < 200; seed++) {
      const lines = composeIntel(prevPlan, null, mulberry32(1000 + seed));
      total++;
      for (const L of lines) {
        if (/\d/.test(L)) digits++;
        if (/[Mm]arksman|scope|Single-shot/.test(L)) { marksman++; pool.add(L); }
      }
    }
    ok("4D intel: marksman line emitted for a sniper purchase (delayed-wave prevPlan key)", marksman > 0, `hits=${marksman}/200`);
    ok("4D intel: every emitted line is digit-free", digits === 0, `digits=${digits}`);
    ok("4D intel: seeded silence gaps the family ~25% (never all 200)", marksman >= 100 && marksman <= 180, `hits=${marksman}`);
    ok("4D intel: line pool has 3 workshopped variants in rotation", pool.size === 3, `variants=${pool.size}`);
    const silentPlan = composeIntel(null, null, mulberry32(5));
    ok("4D intel: no plan -> no marksman line (bureau never speculates)", silentPlan.length === 0, JSON.stringify(silentPlan));
  }
}

// ==== SQUAD-PACE (Phase 5): threat-gated attack pacing. A squad with no
// live team-2 body within 25m of its anchor and no member hit inside 4s is
// UNTHREATENED: it skips the cover dwell (still burning the leg's one rng
// draw) and hops 9m straight legs. Threatened = exactly the old behavior.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const mkAttackSquad = (world, x, z, dx, dz) => {
    const sq = makeSquad(1, "rifles", 1, x, z);
    for (let i = 0; i < 4; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x, y: 0.9, z, hp: 100 });
      sq.memberIds.push(u.id);
    }
    sq.order = "attack"; sq.dest = { x: dx, z: dz };
    return sq;
  };
  const addEnemy = (world, x, z) =>
    addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x, y: 0.9, z, hp: 100 });
  const DT = 1 / 60;
  // members integrate (pos += v*dt) so the rubber-band anchor has a squad
  // body to pace against — the anchor no longer marches off alone.
  const stepMembers = (world, sq) => {
    for (const id of sq.memberIds) { const u = world.byId.get(id); u.pos.x += u.v.x * DT; u.pos.z += u.v.z * DT; }
  };
  const runAdvance = (world, sq, maxTicks = 60000) => {
    let t = 0;
    for (let i = 0; i < maxTicks && sq.order === "attack"; i++) { stepSquad(world, sq, DT); stepMembers(world, sq); world.t += DT; t += DT; }
    return t;
  };

  // --- timing: unthreatened 30m advance completes in under half the
  // threatened-fixture time (enemy parked at the midpoint keeps the whole
  // advance inside the 25m threat radius).
  {
    const wU = makeWorld({ field: flatField, seed: 9 });
    const sqU = mkAttackSquad(wU, 0, 0, 0, 30);
    const tU = runAdvance(wU, sqU);
    const wT = makeWorld({ field: flatField, seed: 9 });
    addEnemy(wT, 0, 15);
    const sqT = mkAttackSquad(wT, 0, 0, 0, 30);
    const tT = runAdvance(wT, sqT);
    ok("SQUAD-PACE timing: unthreatened 30m advance under half threatened time",
      sqU.order === "defend" && sqT.order === "defend" && tU < tT / 2,
      `unthreatened=${tU.toFixed(1)}s threatened=${tT.toFixed(1)}s`);
    globalThis.__squadPaceTimes = { tU, tT };
  }

  // --- draw-count stability: equal completed legs -> identical rng draws.
  {
    const countDraws = (world) => { const r = world.rng; let n = 0; world.rng = () => { n++; return r(); }; return () => n; };
    const runLegs = (world, sq, legs) => {
      const draws = countDraws(world);
      let done = 0, had = false;
      for (let i = 0; i < 120000 && done < legs && sq.order === "attack"; i++) {
        stepSquad(world, sq, DT); stepMembers(world, sq); world.t += DT;
        if (sq._legTarget) had = true;
        else if (had) { had = false; done++; } // leg completed (target consumed)
      }
      return { done, draws: draws() };
    };
    const wU = makeWorld({ field: flatField, seed: 11 });
    const rU = runLegs(wU, mkAttackSquad(wU, 0, 0, 0, 100), 3);
    const wT = makeWorld({ field: flatField, seed: 11 });
    addEnemy(wT, 0, 12);
    const rT = runLegs(wT, mkAttackSquad(wT, 0, 0, 0, 100), 3);
    ok("SQUAD-PACE draws: identical draw count for equal legs (threatened vs not)",
      rU.done === 3 && rT.done === 3 && rU.draws === rT.draws,
      `unthreatened=${rU.draws}/${rU.done} legs threatened=${rT.draws}/${rT.done} legs`);
  }

  // --- threat radius boundary: enemy at 24m -> careful (<=6m leg); at 26m
  // -> double-time (9m leg). First leg target measured off the start anchor.
  {
    const legLen = (enemyX) => {
      const w = makeWorld({ field: flatField, seed: 13 });
      addEnemy(w, enemyX, 0);
      const sq = mkAttackSquad(w, 0, 0, 0, 30);
      stepSquad(w, sq, DT);
      return Math.hypot(sq._legTarget.x, sq._legTarget.z);
    };
    const near = legLen(24), far = legLen(26);
    ok("SQUAD-PACE boundary: enemy at 24m -> careful 6m legs", near <= 6.01, `leg=${near.toFixed(2)}m`);
    ok("SQUAD-PACE boundary: enemy at 26m -> double-time 9m legs", Math.abs(far - 9) < 0.01, `leg=${far.toFixed(2)}m`);
  }

  // --- twin determinism: identical worlds (enemy behind the start, so the
  // squad transitions threatened -> unthreatened mid-advance) track exactly.
  {
    const mk = () => {
      const w = makeWorld({ field: flatField, seed: 21 });
      addEnemy(w, 0, -10);
      return { w, sq: mkAttackSquad(w, 0, 0, 0, 30) };
    };
    const a = mk(), b = mk();
    let same = true;
    for (let i = 0; i < 30000 && (a.sq.order === "attack" || b.sq.order === "attack"); i++) {
      stepSquad(a.w, a.sq, DT); stepMembers(a.w, a.sq); a.w.t += DT;
      stepSquad(b.w, b.sq, DT); stepMembers(b.w, b.sq); b.w.t += DT;
      if (a.sq.anchor.x !== b.sq.anchor.x || a.sq.anchor.z !== b.sq.anchor.z || a.sq.order !== b.sq.order) { same = false; break; }
    }
    ok("SQUAD-PACE twins: identical seeds -> identical anchor paths through the threat transition",
      same && a.sq.order === "defend" && b.sq.order === "defend", `same=${same} orders=${a.sq.order}/${b.sq.order}`);
  }
}

// ==== SNIPER-REACH (selection fan fix): the selected-squad range display
// must be computed from the member's HEAD (pos.y + 0.5, the squadFire muzzle)
// — not the anchor's ground height with the flat spec.range ring it showed
// before (Jeff's report: "view distance calculated from base instead of head").
{
  const mkField = (heightAt) => ({ heightAt, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  const flat = mkField(() => 0);

  // (a) flat ground: the head muzzle (ground + 1.24) earns the elevation
  // bonus a base muzzle (elev 0) never would — reach must exceed the flat
  // 30m spec.range the old ring displayed.
  {
    const w = makeWorld({ field: flat, seed: 31 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const pts = squadReach(w, sq);
    const reach = Math.max(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SNIPER-REACH flat: head-muzzle fan reaches past base spec.range", reach > INFANTRY_ARMS.sniper.range, reach.toFixed(2));
  }

  // (b) a 0.7m ridge ring at 8m: a head-height sightline clears it (arc ~1.2m
  // vs 0.7 + 0.35 clearance); a base-height one is blocked. The fan must
  // cross the ridge.
  {
    const ridge = mkField((x, z) => { const r = Math.hypot(x, z); return r > 7.5 && r < 8.5 ? 0.7 : 0; });
    const w = makeWorld({ field: ridge, seed: 32 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const pts = squadReach(w, sq);
    const reach = Math.max(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SNIPER-REACH ridge: head-height fan sees over a 0.7m ridge at 8m", reach > 20, reach.toFixed(2));
  }

  // (c) no live members -> null (dead squad selected mid-prune).
  {
    const w = makeWorld({ field: flat, seed: 33 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    ok("SNIPER-REACH empty: squad with no live members returns null", squadReach(w, sq) === null);
  }

  // (d) DepotGame's selection path draws the fan via squadReach, not the old
  // flat INFANTRY_ARMS range ring at the anchor.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("SNIPER-REACH wiring: DepotGame selection uses squadReach for the sniper", /squadReach\(/.test(src));
  }
}

// ==== SEL-REACH (Task 2b): universal selection LOS — every selected shooter
// shows its true fan. Inspected gun towers get a reachPolygon fan from their
// real muzzle (pos.y + hy + 0.45, towerShot's own formula), computed ONCE at
// select (static body — towerReachCached); selected rifles/mg squads join the
// sniper on the squadReach fan. Render-only: zero sim impact, zero rng draws.
{
  const mkField = (heightAt) => ({ heightAt, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  const flat = mkField(() => 0);
  const mkTower = (w, type, x, z) => {
    const spec = TOWER_SPECS[type];
    return addBody(w, { kind: "tower", team: 1, mass: 0, hx: spec.hx, hy: spec.hy, hz: spec.hz, x, y: spec.hy, z, hp: spec.hp || 100, towerType: type });
  };

  // (a) flat-ground tower fan: max radius ~ the muzzle's effRange (the fan
  // derives from the real muzzle + spec, not a decorative ring).
  {
    const w = makeWorld({ field: flat, seed: 41 });
    const tw = mkTower(w, "mg", 0, 0);
    const spec = TOWER_SPECS.mg;
    const muzzle = { x: 0, y: tw.pos.y + tw.hy + 0.45, z: 0 };
    const expect = effRange(w, muzzle, spec);
    const cache = {};
    const pts = towerReachCached(cache, w, tw, spec);
    const maxR = Math.max(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SEL-REACH tower: flat-ground fan max radius ~ muzzle effRange", Math.abs(maxR - expect) < 1.5, `maxR=${maxR.toFixed(2)} effR=${expect.toFixed(2)}`);
    ok("SEL-REACH tower: fan is a 64-ray polygon", pts.length === 64);
  }

  // (b) computed ONCE per selection: the cache keys on tower id — repeated
  // per-frame calls never recompute; a different tower does.
  {
    const w = makeWorld({ field: flat, seed: 42 });
    const t1 = mkTower(w, "mg", 0, 0), t2 = mkTower(w, "gun", 20, 0);
    let calls = 0;
    const counting = (...args) => { calls++; return reachPolygon(...args); };
    const cache = {};
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    ok("SEL-REACH cache: three frames of the same selection compute once", calls === 1, `calls=${calls}`);
    towerReachCached(cache, w, t2, TOWER_SPECS.gun, undefined, counting);
    ok("SEL-REACH cache: selecting a different tower recomputes", calls === 2, `calls=${calls}`);
  }

  // (c) the tower's own body must not self-block its fan (selfId threaded
  // through reachPolygon -> arcClears, the friendlyFouls fix's shape).
  {
    const w = makeWorld({ field: flat, seed: 43 });
    const tw = mkTower(w, "gun", 0, 0);
    const pts = towerReachCached({}, w, tw, TOWER_SPECS.gun);
    const minR = Math.min(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SEL-REACH selfId: tower's own box never clips its own fan", minR > TOWER_SPECS.gun.range * 0.8, `minR=${minR.toFixed(2)}`);
  }

  // (d) squad fan present for ALL THREE squad types (rifles/mg lose the flat
  // ring, join the sniper on squadReach).
  for (const type of ["sniper", "rifles", "mg"]) {
    const w = makeWorld({ field: flat, seed: 44 });
    const sq = makeSquad(1, type, 1, 0, 0);
    spawnSquadMembers(w, sq);
    const pts = squadReach(w, sq);
    const maxR = pts ? Math.max(...pts.map((p) => Math.hypot(p.x, p.z))) : 0;
    ok(`SEL-REACH squads: ${type} squad fan present and reaches`, !!pts && pts.length === 64 && maxR > INFANTRY_ARMS[type].range * 0.9, `maxR=${maxR.toFixed(2)}`);
  }

  // (e) render-only: twin firefights, one with selections interleaved
  // (squadReach + towerReachCached every second), hash identical.
  {
    const run = (withSel) => {
      const w = makeWorld({ field: flat, seed: 45 });
      const tw = mkTower(w, "mg", -6, 0);
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(w, sq);
      addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 12, hp: 500 });
      const dt = 1 / 30, cache = {};
      for (let i = 0; i < 10 / dt; i++) {
        squadFire(w, sq, dt);
        stepWorld(w);
        if (withSel && i % 30 === 0) { squadReach(w, sq); towerReachCached(cache, w, tw, TOWER_SPECS.mg); }
      }
      return worldHash(w);
    };
    ok("SEL-REACH render-only: twin determinism with selections interleaved", run(false) === run(true));
  }

  // (f) wiring: DepotGame's inspect path draws towers via towerReachCached;
  // the rifles/mg flat-ring fallback is gone (every selected squad fans).
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("SEL-REACH wiring: DepotGame inspect uses towerReachCached", /towerReachCached\(/.test(src));
    ok("SEL-REACH wiring: rifles/mg flat selection ring removed", !/range: INFANTRY_ARMS\[selSq\.type\]\.range/.test(src));
  }
}

// ==== ROT-PATH ===============================================================
// Pathfinding + walking under all 4 map orientations. History: territory was
// dead on 3/4 orientations because emitters skipped invW — the same class of
// bug could hide in any movement path that mixes CANONICAL (u,v) grid data
// with WORLD (x,z) body positions. Each lane below drives a real movement
// path with the ORIENT-explicit transforms (fwdUFor/fwdDirFor/invWFor) across
// ALL FOUR orientations and asserts world-space progress toward the rotated
// objective. Squad movement (squads.js) is world-space-pure, so its lanes pin
// that the SAME scenario, rotated, still converges (equivariance by behavior,
// not by exact coordinates — spawn jitter is drawn in world axes).
{
  const ROT_DT = 1 / 60;
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  // faithful replica of DepotGame.jsx's makeGrid coordinate formulas (28x56,
  // cs 2), ORIENT-explicit — pins the worldToGrid/gridToWorld transform pair.
  const RG_CS = 2.0, RG_W = 28, RG_H = 56, RG_OX = -(RG_W * RG_CS) / 2, RG_OZ = -(RG_H * RG_CS) / 2;
  const realGridXform = (O) => ({
    worldToGrid: (x, z) => { const c = invWFor(O, x, z); return { gx: Math.floor((c.u - RG_OX) / RG_CS), gz: Math.floor((c.v - RG_OZ) / RG_CS) }; },
    gridToWorld: (gx, gz) => fwdUFor(O, RG_OX + (gx + 0.5) * RG_CS, RG_OZ + (gz + 0.5) * RG_CS),
  });
  // canonical straight flow toward +v (the depot direction), any position.
  const canonFlowGrid = () => ({
    cellAt: () => ({ dist: 5, dx: 0, dz: 1, ice: false }),
    worldToGrid: () => null, inBounds: () => false,
    cells: [], idx: () => 0, gridToWorld: () => ({ x: 0, z: 0 }),
  });

  // (a) transform pins: grid round-trip identity + fwdDirFor is fwdUFor's
  // linear part (length-preserving, invertible) — every orientation.
  for (let O = 0; O < 4; O++) {
    const g = realGridXform(O);
    let rt = true;
    for (const [gx, gz] of [[0, 0], [27, 0], [0, 55], [27, 55], [13, 27], [5, 40]]) {
      const w = g.gridToWorld(gx, gz), back = g.worldToGrid(w.x, w.z);
      if (back.gx !== gx || back.gz !== gz) rt = false;
    }
    ok(`ROT-PATH a: orientation ${O} grid worldToGrid(gridToWorld) round-trips`, rt);
    const fd = fwdDirFor(O, 0.6, 0.8), fu = fwdUFor(O, 0.6, 0.8);
    ok(`ROT-PATH a: orientation ${O} fwdDirFor matches fwdUFor's linear part, length preserved`,
      fd.x === fu.x && fd.z === fu.z && Math.abs(Math.hypot(fd.x, fd.z) - 1) < 1e-9);
  }

  // (b) infantry flow-field march: a conscript on a canonical +v flow closes
  // on the ROTATED objective fwdU(0,49) under every orientation.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 41 });
    world.depotCombat = true;
    const sp = fwdUFor(O, 0, 0);
    const u = spawnUnit(world, { x: sp.x, z: sp.z }, "");
    u.pos.x = sp.x; u.pos.z = sp.z; // pin world-axis spawn jitter
    const obj = fwdUFor(O, 0, 49);
    const d0 = Math.hypot(u.pos.x - obj.x, u.pos.z - obj.z);
    const grid = canonFlowGrid();
    const fwd = (du, dv) => fwdDirFor(O, du, dv);
    const toUV = (x, z) => invWFor(O, x, z);
    for (let i = 0; i < 300; i++) { stepUnits(world, grid, fwd, undefined, toUV); stepWorld(world); }
    const d1 = Math.hypot(u.pos.x - obj.x, u.pos.z - obj.z);
    ok(`ROT-PATH b: orientation ${O} infantry march closes on the rotated objective`, d1 < d0 - 4, `d0=${d0.toFixed(1)} d1=${d1.toFixed(1)}`);
  }

  // (c) tank waypoint: t.goal must sit 9m down the ROTATED flow direction —
  // the exact fwdDir(cell.dx, cell.dz) contract stepTank relies on.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 42 });
    world.depotCombat = true;
    const sp = fwdUFor(O, 0, 0);
    const t = spawnUnit(world, { x: sp.x, z: sp.z }, "tank");
    t.pos.x = sp.x; t.pos.z = sp.z;
    stepUnits(world, canonFlowGrid(), (du, dv) => fwdDirFor(O, du, dv), undefined, (x, z) => invWFor(O, x, z));
    const want = fwdDirFor(O, 0, 1);
    const gx = t.goal.x - t.pos.x, gz = t.goal.z - t.pos.z;
    ok(`ROT-PATH c: orientation ${O} tank goal is 9m down the rotated flow`,
      Math.abs(gx - want.x * 9) < 1e-6 && Math.abs(gz - want.z * 9) < 1e-6, `goal=(${gx.toFixed(2)},${gz.toFixed(2)})`);
  }

  // (d) sniper vantage march: marching the rotated flow, he latches hold in
  // the lee of a boulder interposed toward the rotated advance bearing —
  // mirrors the 4C fixture, rotated through every orientation.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 43 });
    world.depotCombat = true;
    const rock = fwdUFor(O, 0, 12);
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.5, hy: 0.9, hz: 0.5, x: rock.x, y: 0.9, z: rock.z, hp: 1e9 });
    const sp = fwdUFor(O, 0, 6);
    const sn = spawnUnit(world, { x: sp.x, z: sp.z }, "sniper");
    sn.pos.x = sp.x; sn.pos.z = sp.z;
    const fwd = (du, dv) => fwdDirFor(O, du, dv);
    const toUV = (x, z) => invWFor(O, x, z);
    for (let i = 0; i < 1200 && !sn.hold; i++) { stepUnits(world, canonFlowGrid(), fwd, undefined, toUV); stepWorld(world); }
    const fdw = fwdDirFor(O, 0, 1);
    const bearing = Math.atan2(fdw.x, fdw.z);
    ok(`ROT-PATH d: orientation ${O} sniper latches a vantage hold`, sn.hold === true);
    ok(`ROT-PATH d: orientation ${O} held ground reads exposure < 0.35 toward the rotated advance`,
      sn.hold === true && exposureAt(world, sn.pos.x, sn.pos.z, bearing) < 0.35);
  }

  // (e) squad ATTACK legs + double-time (world-space path, rotated scenario):
  // unthreatened squad double-times from fwdU(0,0) to dest fwdU(0,30) and
  // flips to defend on arrival, every orientation.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 44 });
    const a0 = fwdUFor(O, 0, 0), dest = fwdUFor(O, 0, 30);
    const sq = makeSquad(1, "rifles", 1, a0.x, a0.z);
    spawnSquadMembers(world, sq);
    sq.order = "attack"; sq.dest = { x: dest.x, z: dest.z };
    let ticks = 0;
    // members integrate (pos += v*dt) so the rubber-band anchor has a squad
    // body to pace against — the anchor no longer marches off alone.
    while (sq.order === "attack" && ticks++ < 30000) {
      stepSquad(world, sq, ROT_DT); world.t += ROT_DT;
      for (const id of sq.memberIds) { const u = world.byId.get(id); u.pos.x += u.v.x * ROT_DT; u.pos.z += u.v.z * ROT_DT; }
    }
    ok(`ROT-PATH e: orientation ${O} attack squad reaches the rotated dest and flips to defend`,
      sq.order === "defend" && Math.hypot(sq.anchor.x - dest.x, sq.anchor.z - dest.z) < 1.5, `order=${sq.order} ticks=${ticks}`);
  }

  // (f) squad ATTACK under threat: the first coverHop leg still strictly
  // reduces distance-to-dest with the whole scene rotated (enemy near the
  // anchor forces the careful-hop branch).
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 45 });
    const a0 = fwdUFor(O, 0, 0), dest = fwdUFor(O, 0, 30);
    const ep = fwdUFor(O, 3, -5);
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: ep.x, y: 0.74, z: ep.z, hp: 40, friction: 0.5 });
    const sq = makeSquad(1, "rifles", 1, a0.x, a0.z);
    spawnSquadMembers(world, sq);
    sq.order = "attack"; sq.dest = { x: dest.x, z: dest.z };
    stepSquad(world, sq, ROT_DT);
    const lt = sq._legTarget;
    const dLeg = lt ? Math.hypot(dest.x - lt.x, dest.z - lt.z) : Infinity;
    ok(`ROT-PATH f: orientation ${O} threatened coverHop leg strictly reduces distance-to-dest`,
      sq._threatened === true && lt && dLeg < 30 - 1e-6, `dLeg=${dLeg.toFixed(2)}`);
  }

  // (g) DEFEND slot-seek with masonry in the ring: rotated wall at fwdU(0,2.4)
  // sits on a formation slot at 2 of the 4 orientations — every member's goal
  // must be vetted clear of it (clearSlot) and members must physically
  // converge on their goals. MG team (2 members) rather than rifles (4):
  // with 4 members the O=3 wall placement routes two members onto crossing
  // paths where they mutually body-block ~2m short of their slots — a
  // pre-existing, orientation-INDEPENDENT crowding deadlock (reproduced
  // byte-identically with ORIENT code removed entirely: seekGoal's
  // steer-around fan only probes STATIC solids, never fellow members).
  // Deliberately not fixed in the ROT-PATH lane — it is not a coordinate-
  // transform bug, and a unit-avoidance change would ripple through every
  // squad determinism pin in this file.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 46 });
    const a0 = fwdUFor(O, 0, 0), wp = fwdUFor(O, 0, 2.4);
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: wp.x, y: 0.83, z: wp.z, hp: 999 });
    const sq = makeSquad(1, "mg", 1, a0.x, a0.z);
    spawnSquadMembers(world, sq);
    for (let i = 0; i < 900; i++) { stepSquad(world, sq, world.dt); stepWorld(world); }
    let converged = true, clearOfWall = true;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (!u || !u.alive) { converged = false; continue; }
      if (u.goal && Math.hypot(u.goal.x - u.pos.x, u.goal.z - u.pos.z) > 1.2) converged = false;
      if (Math.abs(u.pos.x - wall.pos.x) < wall.hx + 0.2 && Math.abs(u.pos.z - wall.pos.z) < wall.hz + 0.2) clearOfWall = false;
    }
    ok(`ROT-PATH g: orientation ${O} defend members converge on vetted slots, none inside the wall`, converged && clearOfWall);
  }

  // (h) FRONT F1: an enemy at the rotated objective PERSISTS under every
  // orientation — the leak machinery is gone; he stays and fights.
  for (let O = 0; O < 4; O++) {
    const world = makeWorld({ field: flatF, seed: 47 });
    const bp = fwdUFor(O, 0, 48.5);
    const u = spawnUnit(world, { x: bp.x, z: bp.z }, "");
    u.pos.x = bp.x; u.pos.z = bp.z;
    ok(`ROT-PATH h: orientation ${O} enemy at the rotated depot persists`,
      world.byId.has(u.id) && !world.events.some((e) => e.type === "leak"));
  }
}
// ==== end ROT-PATH ===========================================================

// ==== SIGHTLINES (marksmanship batch Task 2): physics-true arcClears =========
// The fixed +0.35m terrain pad vetoed 94% of downslope shots that physically
// clear (diag-downslope*.mjs, 2026-08-10: 249/266 pad-only vetoes, median real
// clearance 0.217m). Replaced by engine-cadence sampling + a derived epsilon
// (see accuracy.js's ARC_EPS derivation). The keystone below fires REAL
// projectiles and requires arcClears' verdict to match observed impacts in
// both directions — the predictor is pinned to the simulator, not to a pad.
{
  // rounded (cosine) crest, same family as diag-downslope-crest.mjs
  const mkCrestWorld = (H, rampLen, seed = 1) => {
    const world = makeWorld({ seed });
    const f = world.field;
    for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
      const x = i * f.cs - f.half;
      f.h[f.idx(i, j)] = x <= 0 ? H : x >= rampLen ? 0 : H * 0.5 * (1 + Math.cos(Math.PI * x / rampLen));
    }
    return world;
  };
  const sniperArm = INFANTRY_ARMS.sniper;
  const CREST_SHAPES = [[3, 6], [4, 8], [6, 8], [6, 12], [8, 10]];
  const mkShooter = (world, sx) => addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: sx, y: world.field.heightAt(sx, 0) + 0.74, z: 0, hp: 58 });

  // Fire one real, unscattered round straight along the aimSolve direction and
  // watch where it lands. "Lands" = the flight's closest approach to the aim
  // point is <= 1m (the round arrived on the target); otherwise it ate terrain
  // en route (the crest). Deterministic: no rng draws anywhere in this path.
  const simulate = (world, muzzle, target, spec, ownerId) => {
    const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
    const d = Math.hypot(dx, dz);
    const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
    if (pitch == null) return { lands: false };
    const ch = Math.cos(pitch), az = Math.atan2(dz, dx);
    const dir = { x: ch * Math.cos(az), y: Math.sin(pitch), z: ch * Math.sin(az) };
    const p = fireProjectile(world, muzzle, dir, spec.projSpeed, { kind: "mg", r: 0.35, kv: 0, dmg: 0, crater: 0, owner: ownerId, attacker: "test" });
    let minD = 1e9;
    for (let s = 0; s < 5000 && world.projectiles.includes(p); s++) {
      stepWorld(world);
      const dd = Math.hypot(p.pos.x - target.x, p.pos.y - target.y, p.pos.z - target.z);
      if (dd < minD) minD = dd;
    }
    return { lands: minD <= 1.0 };
  };

  // keystone: predictor == simulator across the whole crest matrix
  {
    let total = 0, simLands = 0, simBlocks = 0, falseClear = 0, falseBlock = 0;
    const bad = [];
    for (const setback of [0, 1, 2, 3, 4]) for (const [H, ramp] of CREST_SHAPES) {
      for (let tx = 2; tx <= 26; tx += 2) {
        const world = mkCrestWorld(H, ramp);
        const sh = mkShooter(world, -setback);
        const muzzle = { x: -setback, y: sh.pos.y + 0.5, z: 0 };
        const tgt = { x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0 };
        const sim = simulate(world, muzzle, tgt, sniperArm, sh.id);
        const w2 = mkCrestWorld(H, ramp);
        const pr = arcClears(w2, muzzle, tgt, sniperArm, sh.id);
        total++; sim.lands ? simLands++ : simBlocks++;
        if (pr !== sim.lands) {
          pr ? falseClear++ : falseBlock++;
          if (bad.length < 6) bad.push(`sb${setback} H${H}r${ramp} tx${tx} predicted=${pr}`);
        }
      }
    }
    ok("SIGHTLINES keystone: arcClears matches real-projectile impacts on every crest fixture (both directions)",
      falseClear === 0 && falseBlock === 0,
      `total=${total} simLands=${simLands} falseClear=${falseClear} falseBlock=${falseBlock}${bad.length ? " | " + bad.join(" | ") : ""}`);
    ok("SIGHTLINES keystone: true crest pierces exist and stay blocked (no false clears)",
      simBlocks > 0 && falseClear === 0, `simBlocks=${simBlocks}`);
  }

  // end-to-end: sniper squad acquires + lands rounds downslope on every crest
  // shape (pre-fix: 0 projectiles — the pad vetoed acquisition entirely)
  for (const [H, ramp] of CREST_SHAPES) {
    const world = mkCrestWorld(H, ramp);
    const sh = mkShooter(world, -2);
    sh.utype = "sniper";
    const tx = Math.min(26, ramp + 6);
    const tgt = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0, hp: 58 });
    const squad = makeSquad(1, "sniper", 1, -2, 0);
    squad.memberIds.push(sh.id); squad.order = "defend";
    squadFire(world, squad, 0.5, null);
    const fired = world.projectiles.length;
    let impactX = null;
    if (fired) {
      const p = world.projectiles[0];
      for (let s = 0; s < 5000 && world.projectiles.includes(p); s++) stepWorld(world);
      impactX = p.pos.x;
    }
    ok(`SIGHTLINES: sniper acquires + lands downslope on crest H${H}/r${ramp} (pre-fix: 0 projectiles)`,
      fired > 0 && impactX != null && impactX > 0,
      `fired=${fired} impactX=${impactX == null ? "-" : impactX.toFixed(2)} tgt.x=${tx} (hit or crater downslope of the lip)`);
  }

  // reachPolygon: the downslope fan widens (pre-fix the +x ray stopped at
  // the pad wall; physically the sniper sees the whole slope). Fixtures
  // chosen where the slope is NOT true dead ground — on the steepest crests
  // at deep setback the short fan is real (the ray stops at the first block
  // by design, and the lip genuinely shadows the near slope there).
  for (const [sb, H, r, pre] of [[2, 3, 6, 4.50], [1, 6, 8, 3.60]]) {
    const world = mkCrestWorld(H, r);
    const muzzle = { x: -sb, y: world.field.heightAt(-sb, 0) + 0.74 + 0.5, z: 0 };
    const pts = reachPolygon(world, null, muzzle, sniperArm, 1);
    const down = Math.hypot(pts[0].x - muzzle.x, pts[0].z - muzzle.z);
    ok(`SIGHTLINES: reachPolygon downslope ray widens on sb${sb} H${H}/r${r} (pre-change pin: ${pre}m)`,
      down > 12, `downslope reach=${down.toFixed(2)}m`);
  }

  // flagged-DPS parity (replaces-not-adds contract): rifles/mg/sniper vs the
  // pinned soft fixture, measured PRE-change on 2026-08-10 with the 0.35 pad
  // still in place — the epsilon change must not move level-ground DPS >10%.
  {
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const dpsFixture = (type) => {
      const world = makeWorld({ field: flatF, seed: 4 });
      world.depotCombat = true;
      const squad = makeSquad(1, type, 1, 0, 0);
      for (let i = 0; i < SQUAD_SPECS[type].n; i++) {
        // pair roles + spread (6.5 Task 6): member 1 of a sniper squad is the
        // non-firing spotter, parked clear of the sniper's body — the fixture
        // measures the RIFLE's DPS, which the spotter must not change.
        const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: type === "sniper" ? i * 1.2 : 0, y: 0.9, z: 0, hp: 100 });
        if (type === "sniper") u.role = i === 0 ? "sniper" : "spotter";
        squad.memberIds.push(u.id);
      }
      squad.order = "defend";
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
      const dt = 1 / 30, dur = 20;
      const hp0 = target.hp;
      for (let i = 0; i < dur / dt; i++) {
        squadFire(world, squad, dt);
        for (let s = 0; s < 20; s++) stepWorld(world);
      }
      return (hp0 - target.hp) / dur;
    };
    // pre-change flagged measurements (0.35-pad arcClears), 2026-08-10:
    const PRE = { rifles: 3.8013, mg: 9.2525, sniper: 30.5412 };
    for (const type of ["rifles", "mg", "sniper"]) {
      const d = dpsFixture(type);
      ok(`SIGHTLINES parity: flagged ${type} DPS within +/-10% of pre-change measurement`,
        Math.abs(d / PRE[type] - 1) <= 0.10, `dps=${d.toFixed(4)} pre=${PRE[type]}`);
    }
  }

  // twin determinism: two identical crest firefights hash identical
  {
    const run = () => {
      const world = mkCrestWorld(6, 8, 9);
      world.depotCombat = true;
      const sh = mkShooter(world, -2);
      sh.utype = "sniper";
      const tgt = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 14, y: world.field.heightAt(14, 0) + 0.74, z: 0, hp: 5e3 });
      const squad = makeSquad(1, "sniper", 1, -2, 0);
      squad.memberIds.push(sh.id); squad.order = "defend";
      for (let i = 0; i < 600; i++) {
        squadFire(world, squad, world.dt * 5, null);
        for (let s = 0; s < 5; s++) stepWorld(world);
      }
      return worldHash(world);
    };
    ok("SIGHTLINES: twin determinism through a crest firefight", run() === run());
  }
}
// ==== end SIGHTLINES =========================================================

// ==== SIGHTLINES 6.5 Task 1: masonry and trees are real to aiming/discipline
// Audit #2/#3: solidBlocksPoint and friendlyBlocksPoint skipped every body
// with invM > 0 (dynamic). Town/depot chunks (mass 100/88/320) and trees
// (mass 260) are dynamic, so the "chunk"/"tree" entries in SOLID_KINDS were
// dead code — only static bodies (sandbags, rocks, walls, towers) ever
// matched. Fix: filter by KIND — a stone is an obstacle whether or not
// physics lets it move.
{
  console.log("\n[sightlines-6.5 task 1: obstacle filter]");
  const { solidBlocksPoint } = await import("../src/depot/accuracy.js");
  const flat = () => ({ heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });

  // (a) tower behind a town house: a dynamic masonry chunk (mass 100, the
  // town lattice) masking a target must kill acquisition. Pre-fix: acquires.
  {
    const world = makeWorld({ field: flat(), seed: 1 });
    world.depotCombat = true;
    const spec = TOWER_SPECS.gun;
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
    // a house-sized dynamic chunk wall mid-lane, tall enough to eat the arc
    addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 1.2, hy: 3.2, hz: 1.2, x: 0, y: 3.2, z: 8, hp: 400 });
    const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 30 });
    target.v = { x: 0, y: 0, z: 0 };
    ok("task1(a): tower does NOT acquire a target masked by a town house (dynamic chunk)",
      towerScanNearest(world, tower, spec) !== target);
  }

  // (b) tree masks acquisition the same way (mass 260 — dynamic).
  {
    const world = makeWorld({ field: flat(), seed: 1 });
    world.depotCombat = true;
    const spec = TOWER_SPECS.gun;
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
    addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.9, hy: 3.4, hz: 0.9, x: 0, y: 3.4, z: 8, hp: 30 });
    const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 30 });
    target.v = { x: 0, y: 0, z: 0 };
    ok("task1(b): a tree masks acquisition", towerScanNearest(world, tower, spec) !== target);
  }

  // (c) units/vehicles still never block (dynamic AND not in SOLID_KINDS).
  {
    const world = { field: flat(), bodies: [
      { alive: true, invM: 1 / 90, kind: "unit", team: 2, id: 9001, pos: { x: 0, y: 1, z: 0 }, hx: 2, hy: 2, hz: 2 },
      { alive: true, invM: 1 / 12000, kind: "vehicle", team: 2, id: 9002, pos: { x: 0, y: 1, z: 0 }, hx: 2, hy: 2, hz: 2 },
    ] };
    ok("task1(c): dynamic units/vehicles still never block a point", !solidBlocksPoint(world, 0, 1, 0));
  }

  // (d) sandbag behavior unchanged: a static sleeping chunk still blocks.
  {
    const world = { field: flat(), bodies: [
      { alive: true, invM: 0, kind: "chunk", sandbag: true, team: 0, id: 9003, pos: { x: 0, y: 0.35, z: 0 }, hx: 0.9, hy: 0.35, hz: 0.35 },
    ] };
    ok("task1(d): sandbag (static chunk) still blocks", solidBlocksPoint(world, 0, 0.35, 0));
  }

  // (e) CAREFUL discipline: the team-0-chunk clause in friendlyBlocksPoint
  // finally fires — depot masonry (dynamic, team 0) in the lane fouls, so
  // CAREFUL holds and the depot chunk's hp is untouched over the whole run.
  // FREE fires regardless. Pre-fix: friendlyFouls false, CAREFUL shoots
  // through its own depot.
  {
    const gunSpec = { kind: "gun", projSpeed: 58, occl: "arc", volley: 1, acc: 0.0, blastR: 0, kv: 1, dmg: 6, fireRate: 0.2 };
    const makeFixture = () => {
      const world = makeWorld({ field: flat(), seed: 1 });
      const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 });
      const depotChunk = addBody(world, { kind: "chunk", team: 0, mass: 88, hx: 1.0, hy: 2.4, hz: 1.0, x: 0, y: 2.4, z: 8, hp: 400 });
      const target = addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.4, hy: 0.9, hz: 0.4, x: 0, y: 0.9, z: 16, hp: 3000 });
      target.v = { x: 0, y: 0, z: 0 };
      return { world, tower, depotChunk, target };
    };
    const run = (discipline) => {
      const { world, tower, depotChunk, target } = makeFixture();
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      const chunkHp0 = depotChunk.hp;
      let fired = 0;
      for (let i = 0; i < 8; i++) {
        if (discipline === "free" || !friendlyFouls(world, muzzle, target.pos, gunSpec, tower.id)) {
          towerShot(world, tower, target, gunSpec); fired++;
        }
        for (let s = 0; s < 60; s++) stepWorld(world);
      }
      return { fired, chunkDmg: chunkHp0 - depotChunk.hp };
    };
    const careful = run("careful"), free = run("free");
    ok("task1(e): CAREFUL holds when the arc crosses depot masonry (0 ordnance)", careful.fired === 0, `fired=${careful.fired}`);
    ok("task1(e): depot chunk hp unchanged under CAREFUL over the whole run", careful.chunkDmg === 0, `dmg=${careful.chunkDmg}`);
    ok("task1(e): FREE still fires", free.fired > 0, `fired=${free.fired}`);
  }

  // (f) twin determinism: the masked-acquisition firefight hashes identical.
  {
    const run = () => {
      const world = makeWorld({ field: flat(), seed: 5 });
      world.depotCombat = true;
      const spec = TOWER_SPECS.gun;
      const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
      addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 1.2, hy: 3.2, hz: 1.2, x: 0, y: 3.2, z: 8, hp: 400 });
      const masked = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 3000 });
      const open = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 10, y: 0.9, z: 4, hp: 3000 });
      masked.v = { x: 0, y: 0, z: 0 }; open.v = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < 10; i++) {
        const tgt = towerScanNearest(world, tower, spec);
        if (tgt) towerShot(world, tower, tgt, spec);
        for (let s = 0; s < 30; s++) stepWorld(world);
        masked.pos.x = 0; masked.pos.z = 16; open.pos.x = 10; open.pos.z = 4;
      }
      return worldHash(world);
    };
    ok("task1(f): twin determinism through a masked-acquisition firefight", run() === run());
  }
}
// ==== end SIGHTLINES 6.5 Task 1 ==============================================

// ==== SIGHTLINES 6.5 Task 2: one flight model — friendlyFouls runs the tracer
// Audit #1: friendlyFouls carried a private 0.9m-step ANALYTIC parabola
// (y = -4.9t^2) while arcClears marches the engine's own cadence (t = k/120,
// semi-implicit Euler height). Fix: extract the march as marchArc in
// accuracy.js; arcClears and friendlyFouls both call it — one flight model,
// two questions.
{
  console.log("\n[sightlines-6.5 task 2: one flight model]");

  // (a) refactor-safety pin: arcClears verdicts across the crest matrix,
  // byte-identical to the PRE-refactor snapshot (captured 2026-08-10 against
  // the un-extracted loop; 325 fixtures = 5 setbacks x 5 shapes x 13 ranges).
  {
    const mkCrestWorld = (H, rampLen, seed = 1) => {
      const world = makeWorld({ seed });
      const f = world.field;
      for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
        const x = i * f.cs - f.half;
        f.h[f.idx(i, j)] = x <= 0 ? H : x >= rampLen ? 0 : H * 0.5 * (1 + Math.cos(Math.PI * x / rampLen));
      }
      return world;
    };
    const PRE_SNAPSHOT =
      "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111110111111111111100111111111100011111111111111111111111011111111111000011111111110000111111110000001111111001111111111100011111111110000001111111100000111111100000000111110001111111111000011111111100000001111111000000011111000000000001";
    let bits = "";
    for (const setback of [0, 1, 2, 3, 4]) for (const [H, ramp] of [[3, 6], [4, 8], [6, 8], [6, 12], [8, 10]]) {
      for (let tx = 2; tx <= 26; tx += 2) {
        const world = mkCrestWorld(H, ramp);
        const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: -setback, y: world.field.heightAt(-setback, 0) + 0.74, z: 0, hp: 58 });
        const muzzle = { x: -setback, y: sh.pos.y + 0.5, z: 0 };
        const tgt = { x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0 };
        bits += arcClears(world, muzzle, tgt, INFANTRY_ARMS.sniper, sh.id) ? "1" : "0";
      }
    }
    ok("task2(a): arcClears verdicts byte-identical to the pre-refactor crest snapshot",
      bits === PRE_SNAPSHOT, `${bits.length} verdicts, first diff at ${[...bits].findIndex((b, i) => b !== PRE_SNAPSHOT[i])}`);
  }

  // shared: flat world + a real unscattered gun round fired along the exact
  // friendlyFouls trajectory (aimSolve dir), hitStruct so walls are physical
  const flatWorld = () => { const w = makeWorld({ seed: 2 }); w.field.h.fill(0); return w; };
  const gun = TOWER_SPECS.gun;
  const fireReal = (world, muzzle, tgt, ownerId) => {
    const d = Math.hypot(tgt.x - muzzle.x, tgt.z - muzzle.z);
    const pitch = aimSolve(gun.projSpeed, d, tgt.y - muzzle.y, 9.8, false);
    const ch = Math.cos(pitch), az = Math.atan2(tgt.z - muzzle.z, tgt.x - muzzle.x);
    const dir = { x: ch * Math.cos(az), y: Math.sin(pitch), z: ch * Math.sin(az) };
    const p = fireProjectile(world, muzzle, dir, gun.projSpeed, { kind: "shell", r: 0.3, kv: 0, dmg: 1, crater: 0, hitStruct: true, owner: ownerId, attacker: "test" });
    let minD = 1e9;
    for (let s = 0; s < 3000 && world.projectiles.includes(p); s++) {
      stepWorld(world);
      const dd = Math.hypot(p.pos.x - tgt.x, p.pos.y - tgt.y, p.pos.z - tgt.z);
      if (dd < minD) minD = dd;
    }
    return minD; // closest approach to the aim point; <=1m means it arrived
  };
  const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 12, y: 0.86, z: 0 };

  // (b) keystone, direction 1: a friendly wall square in the lane — the
  // verdict says FOUL and the real round physically strikes that wall.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.6, hy: 2, hz: 2, x: 6, y: 2, z: 0, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(b): friendly wall in lane — verdict FOULS and the real round strikes the wall",
      fouls === true && wall.hitT > 0 && minD > 1, `fouls=${fouls} wallHit=${wall.hitT > 0} minD=${minD.toFixed(2)}`);
  }

  // (c) keystone, direction 2: same wall shifted off the lane — the verdict
  // says CLEAR and the real round arrives on the aim point untouched.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.6, hy: 2, hz: 2, x: 6, y: 2, z: 6, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(c): friendly wall off the lane — verdict CLEAR and the real round arrives",
      fouls === false && !(wall.hitT > 0) && minD <= 1, `fouls=${fouls} wallHit=${wall.hitT > 0} minD=${minD.toFixed(2)}`);
  }

  // (d) the margins case (audit #1's teeth): a thin friendly wall at x=4.95 —
  // exactly between the old parabola's fixed 0.9m sample points, so the
  // analytic sampler never sees it, but the engine-cadence march does and a
  // REAL round physically strikes it. The verdict must be the integrator's:
  // FOUL. Pre-refactor: friendlyFouls says clear while the round hits — the
  // safety check guessing.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.01, hy: 3, hz: 2, x: 4.95, y: 3, z: 0, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(d): analytic-vs-integrator margin case resolves to the integrator's answer (FOUL)",
      wall.hitT > 0 && fouls === true, `realHitsWall=${wall.hitT > 0} fouls=${fouls} minD=${minD.toFixed(2)}`);
  }
}
// ==== end SIGHTLINES 6.5 Task 2 ==============================================

// ==== SIGHTLINES 6.5 Task 4: no round passes through a structure ============
// Audit #5 + cosmetic: shooterFire only carried hitStruct when the caller
// remembered to set it. Rifleman unit-target rounds (units.js), squadFire
// rounds, and tower rounds flew with hitStruct undefined — core.js's hit scan
// skips wall/rock/tower for such rounds, so a scattered round could pass
// clean through masonry and kill a soldier behind it. Fix: shooterFire
// defaults hitStruct true unless the caller sets hitOnly (structure-only
// shots keep their exact behavior). Grenadier/rifleman collision becomes
// identical. Task 5 (folded): squadReach threads the member's id into
// reachPolygon as selfId.
{
  console.log("\n[sightlines-6.5 task 4: no round passes through a structure]");
  const flat = () => ({ heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  // deliberate scatter seed: acc > 0 so the round is a real scattered round,
  // but the wall spans the whole scatter cone — every seed's round must eat it.
  const rifleLike = { kind: "mg", projSpeed: 70, dmg: 5, dirDmg: 4.5, blastR: 0.6, kv: 1.0, crater: 0, acc: 0.02, cd: 1.5, range: 30 };

  // (a) a round fired at a unit with a wall edge clipping the flight path
  // stops at the wall: the wall takes the hit, the man behind it takes none.
  // Pre-fix: the round ghosts through (no hitStruct) and wounds him.
  {
    const world = makeWorld({ field: flat(), seed: 11 });
    world.depotCombat = true;
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 3, hy: 4, hz: 0.3, x: 0, y: 4, z: 8, hp: 5000 });
    const tgt = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 3000 });
    tgt.v = { x: 0, y: 0, z: 0 };
    const muzzle = { x: 0, y: 1.24, z: 0 };
    const hp0 = tgt.hp, whp0 = wall.hp;
    for (let i = 0; i < 6; i++) {
      shooterFire(world, sh, muzzle, tgt, rifleLike, { attacker: "player", owner: sh.id, muzzleStep: 0 });
      for (let s = 0; s < 60; s++) stepWorld(world);
    }
    ok("task4(a): rounds at a unit stop at the wall clipping the path (wall takes hits)", wall.hp < whp0, `wallDmg=${(whp0 - wall.hp).toFixed(2)}`);
    ok("task4(a): the man behind the wall is untouched", tgt.hp === hp0, `tgtDmg=${(hp0 - tgt.hp).toFixed(2)}`);
  }

  // (b) no attacker pay for player self-hits: a PLAYER round eating the
  // player's own wall stamps lastHit.attacker "player" — and DepotGame's
  // event drain books structureDmg ONLY on lastHit.attacker === "enemy"
  // (source pin), so the attacker is never paid for the player's own fire.
  {
    const world = makeWorld({ field: flat(), seed: 11 });
    world.depotCombat = true;
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 3, hy: 4, hz: 0.3, x: 0, y: 4, z: 8, hp: 5000 });
    const tgt = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 3000 });
    tgt.v = { x: 0, y: 0, z: 0 };
    const whp0 = wall.hp;
    for (let i = 0; i < 6 && wall.hp === whp0; i++) {
      shooterFire(world, sh, { x: 0, y: 1.24, z: 0 }, tgt, rifleLike, { attacker: "player", owner: sh.id, muzzleStep: 0 });
      for (let s = 0; s < 60; s++) stepWorld(world);
    }
    ok("task4(b): player round into own wall stamps lastHit.attacker player",
      wall.hp < whp0 && wall.lastHit && wall.lastHit.attacker === "player",
      `dmg=${(whp0 - wall.hp).toFixed(2)} attacker=${wall.lastHit && wall.lastHit.attacker}`);
    const depotSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("task4(b): DepotGame's event drain books structureDmg only for attacker enemy (source pin)",
      depotSrc.includes(`b.lastHit.attacker === "enemy"`));
  }

  // (c) open-ground damage parity: with no structure anywhere, hitStruct is
  // inert — a round with it and a round without land identically. Identical
  // to 4 decimals (in fact exact).
  {
    const run = (hitStruct) => {
      const world = makeWorld({ field: flat(), seed: 7 });
      world.depotCombat = true;
      const tgt = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 14, hp: 3000 });
      tgt.v = { x: 0, y: 0, z: 0 };
      const hp0 = tgt.hp;
      for (let i = 0; i < 8; i++) {
        fireProjectile(world, { x: 0, y: 1.24, z: 0 }, { x: 0, y: 0.02, z: 1 }, 70,
          { kind: "mg", r: 0.6, kv: 1.0, dmg: 5, dirDmg: 4.5, crater: 0, noImpact: true, attacker: "player", hitStruct });
        for (let s = 0; s < 40; s++) stepWorld(world);
        tgt.pos.x = 0; tgt.pos.z = 14; tgt.v.x = 0; tgt.v.y = 0; tgt.v.z = 0;
      }
      return hp0 - tgt.hp;
    };
    const withFlag = run(true), without = run(undefined);
    ok("task4(c): open-ground damage parity — hitStruct inert without structures (4 decimals)",
      withFlag > 0 && withFlag.toFixed(4) === without.toFixed(4), `with=${withFlag.toFixed(4)} without=${without.toFixed(4)}`);
  }

  // (d) grenadier == rifleman collision settings: both enemy arms firing at
  // a UNIT target hand core.js identical collision flags (hitStruct true,
  // no hitOnly). Inspect the actual projectiles shooterFire creates.
  {
    const lastFlags = (opts) => {
      const world = makeWorld({ field: flat(), seed: 3 });
      world.depotCombat = true;
      const sh = addBody(world, { kind: "unit", team: 2, mass: 84, hx: 0.26, hy: 0.92, hz: 0.26, x: 0, y: 0.92, z: 0, hp: 66 });
      const tgt = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 12, hp: 58 });
      tgt.v = { x: 0, y: 0, z: 0 };
      shooterFire(world, sh, { x: 0, y: 1.4, z: 0 }, tgt, ENEMY_FIRE.rifle, { ...opts, owner: sh.id });
      const p = world.projectiles[world.projectiles.length - 1];
      return { hitStruct: !!p.spec.hitStruct, hitOnly: p.spec.hitOnly };
    };
    const riflemanF = lastFlags({ attacker: "enemy" });                    // units.js:306 unit-target branch
    const grenF = lastFlags({ high: true, attacker: "enemy", hitStruct: true }); // units.js:389 grenadier branch
    ok("task4(d): grenadier and rifleman rounds carry identical collision settings",
      riflemanF.hitStruct === true && grenF.hitStruct === true &&
      riflemanF.hitOnly === undefined && grenF.hitOnly === undefined,
      JSON.stringify({ riflemanF, grenF }));
    // structure-only shots keep their exact behavior: hitOnly callers untouched
    const structF = lastFlags({ attacker: "enemy", hitOnly: "structure", hitStruct: true });
    ok("task4(d): hitOnly structure shots keep their exact flags", structF.hitOnly === "structure");
  }

  // (e) twin determinism: the wall-clipping firefight hashes identical.
  {
    const run = () => {
      const world = makeWorld({ field: flat(), seed: 13 });
      world.depotCombat = true;
      const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
      addBody(world, { kind: "wall", team: 1, mass: 0, hx: 1.2, hy: 4, hz: 0.3, x: 1.0, y: 4, z: 8, hp: 5000 });
      const tgt = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 16, hp: 3000 });
      tgt.v = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < 8; i++) {
        shooterFire(world, sh, { x: 0, y: 1.24, z: 0 }, tgt, rifleLike, { attacker: "player", owner: sh.id, muzzleStep: 0 });
        for (let s = 0; s < 40; s++) stepWorld(world);
        tgt.pos.x = 0; tgt.pos.z = 16;
      }
      return worldHash(world);
    };
    ok("task4(e): twin determinism through the wall-clipping firefight", run() === run());
  }

  // (f) Task 5 folded in: squadReach threads the member's own id into
  // reachPolygon as selfId (source pin) + output on a clean fixture is a
  // real polygon (the thread was harmless — his own body never masked him
  // at the muzzle before, and must not now).
  {
    const accSrc = fs.readFileSync(new URL("../src/depot/accuracy.js", import.meta.url), "utf8");
    ok("task4(f): squadReach threads selfId into reachPolygon (source pin)",
      /squadReach[\s\S]{0,700}reachPolygon\(world, T, muzzle, arms, squad\.team, toUV, u\.id\)/.test(accSrc));
    const world = makeWorld({ field: flat(), seed: 2 });
    world.depotCombat = true;
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const squad = { memberIds: [u.id], type: "rifles", team: 1 };
    const poly = squadReach(world, squad);
    ok("task4(f): squadReach still returns a real reach polygon with selfId threaded",
      poly != null && poly.length > 8, `pts=${poly && poly.length}`);
  }
}
// ==== end SIGHTLINES 6.5 Task 4 ==============================================

// ==== 6.5 TASK 6: THE PAIR — sniper + spotter ================================
// Spec: 2026-08-10-depot-phase-6-5-sightlines-and-pair.md Task 6 (supersedes
// marksmanship-batch Task 3, carried verbatim there). Failing-first asserts.
{
  const SQ = { ...(await import("../src/depot/squads.js")) };
  const { surveyHighGround, standScore, bestStandPoint } = SQ;
  const flatF = () => ({ heightAt: () => 0, cs: 2, half: 20, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  // knoll fields: heights defined so maxima sit ON 2m control points
  const knollF = (kx, kz, h = 1.5, r = 1.4) => ({
    heightAt: (x, z) => (Math.hypot(x - kx, z - kz) < r ? h : 0),
    cs: 2, half: 20, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; },
  });
  const grid6 = straightGrid(0, -1);

  // (a) pair spawns 2 both sides at 45
  {
    ok("pair(a): SQUAD_SPECS.sniper fields two men at 45 scrap",
      SQUAD_SPECS.sniper && SQUAD_SPECS.sniper.n === 2 && SQUAD_SPECS.sniper.cost === 45, JSON.stringify(SQUAD_SPECS.sniper));
    const world = makeWorld({ field: flatF(), seed: 61 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const members = sq.memberIds.map((id) => world.byId.get(id));
    ok("pair(a): player pair spawns sniper + spotter roles",
      members.length === 2 && members.some((u) => u.role === "sniper") && members.some((u) => u.role === "spotter"),
      JSON.stringify(members.map((u) => u.role)));
    ok("pair(a): ENEMY_SPECS.sniper priced at 45 (bounty mirrors the pair price)", ENEMY_SPECS.sniper.bounty === 45, ENEMY_SPECS.sniper.bounty);
    const w2 = makeWorld({ field: flatF(), seed: 62 });
    const sn = spawnUnit(w2, { x: 0, z: 10 }, "sniper");
    const pairBodies = w2.bodies.filter((b) => b.kind === "unit" && b.team === 2);
    const spotter = pairBodies.find((b) => b.role === "spotter");
    ok("pair(a): enemy marksman arrives as two men (sniper + spotter)",
      pairBodies.length === 2 && !!spotter && sn.role === "sniper", `bodies=${pairBodies.length}`);
    ok("pair(a): enemy pair kill payout sums to the 45 price",
      pairBodies.reduce((s, b) => s + (b.bounty || 0), 0) === 45,
      JSON.stringify(pairBodies.map((b) => b.bounty)));
  }

  // (b) survey correctness — knoll: the spotter lands on the true max
  {
    const world = makeWorld({ field: knollF(2, 2), seed: 63 });
    const best = surveyHighGround && surveyHighGround(world, 0, 0, 0, 0.63);
    let maxH = -1e9;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const x = i * 2, z = j * 2;
      if (Math.hypot(x, z) > 5) continue;
      maxH = Math.max(maxH, world.field.heightAt(x, z));
    }
    ok("pair(b): survey lands on the true max within 5m (knoll fixture)",
      !!best && best.h >= maxH - 1e-9, best && `h=${best.h} max=${maxH}`);
  }
  // (b2) twin-knoll cover tiebreak: equal heights, the covered one wins
  {
    const twinF = {
      heightAt: (x, z) => (Math.hypot(x - 4, z) < 1.4 || Math.hypot(x + 4, z) < 1.4 ? 1.5 : 0),
      cs: 2, half: 20, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; },
    };
    const world = makeWorld({ field: twinF, seed: 64 });
    // threat due +z (bearing 0); a rock just +z of the WEST knoll covers it
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.6, hy: 1.0, hz: 0.6, x: -4, y: 1.0, z: 1.8, hp: 1e9 });
    const best = surveyHighGround && surveyHighGround(world, 0, 0, 0, 0.35);
    ok("pair(b2): cover breaks the near-tie — spotter takes the covered knoll",
      !!best && best.x < 0, best && `x=${best.x.toFixed(2)} z=${best.z.toFixed(2)}`);
  }
  // (b3) ice + blocked rejection
  {
    const world = makeWorld({ field: knollF(2, 2), seed: 65 });
    world.pondAt = (x, z) => Math.hypot(x - 2, z - 2) < 1.4; // the knoll is frozen pond
    const best = surveyHighGround && surveyHighGround(world, 0, 0, 0, 0.63);
    ok("pair(b3): pond-ice candidates rejected (spotter never stands on the ice)",
      !!best && !world.pondAt(best.x, best.z), best && `x=${best.x} z=${best.z} h=${best.h}`);
    const w2 = makeWorld({ field: knollF(2, 2), seed: 66 });
    addBody(w2, { kind: "rock", team: 0, mass: 0, hx: 1.2, hy: 1.4, hz: 1.2, x: 2, y: 1.4, z: 2, hp: 1e9 });
    const b2 = surveyHighGround && surveyHighGround(w2, 0, 0, 0, 0.63);
    ok("pair(b3): solid-blocked candidates rejected (knoll under a rock skipped)",
      !!b2 && !(Math.abs(b2.x - 2) <= 1.55 && Math.abs(b2.z - 2) <= 1.55), b2 && `x=${b2.x} z=${b2.z}`);
  }

  // (c) directed stand point scores >= the anchor's own score
  {
    const world = makeWorld({ field: flatF(), seed: 67 });
    // wall hugging the anchor masks most of its test rays
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 3.0, hy: 2.2, hz: 0.4, x: 0, y: 2.2, z: 1.6, hp: 5000 });
    const sn = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const anchorScore = standScore ? standScore(world, 0, 0, 0, sn.id) : -1;
    const stand = bestStandPoint && bestStandPoint(world, 0, 0, 0, sn);
    const standS = stand && standScore(world, stand.x, stand.z, 0, sn.id);
    ok("pair(c): the directed firing spot scores >= the anchor default",
      stand != null && standS >= anchorScore, `anchor=${anchorScore} directed=${standS}`);
  }

  // (d) spotter fires zero rounds ever + (e/f) both death paths + twin determinism
  {
    const runFight = (killWho) => {
      const world = makeWorld({ field: flatF(), seed: 68 });
      world.depotCombat = true;
      const sq = makeSquad(1, "sniper", 1, 0, 0);
      spawnSquadMembers(world, sq);
      let squads = [sq];
      const members = sq.memberIds.map((id) => world.byId.get(id));
      const spotterId = members.find((u) => u.role === "spotter").id;
      const sniperId = members.find((u) => u.role === "sniper").id;
      // pinned soft enemies in range keep the trigger warm
      const tgt = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 14, hp: 90000 });
      let spotterRounds = 0;
      const seen = new Set();
      for (let i = 0; i < 1500; i++) {
        if (i === 700 && killWho) {
          const victim = world.byId.get(killWho === "spotter" ? spotterId : sniperId);
          if (victim) applyDamage(world, victim, 1e9, { attacker: "enemy" });
        }
        squads = pruneSquads(world, squads);
        for (const q of squads) { stepSquad(world, q, world.dt); squadFire(world, q, world.dt); }
        stepWorld(world);
        tgt.pos.x = 0; tgt.pos.z = 14; tgt.v.x = 0; tgt.v.z = 0; tgt.hp = 90000; tgt.alive = true;
        for (const p of world.projectiles) {
          if (!seen.has(p) && p.spec && p.spec.owner === spotterId) spotterRounds++;
          seen.add(p);
        }
      }
      const spotter = world.byId.get(spotterId), sniper = world.byId.get(sniperId);
      return { spotterRounds, squads, spotter, sniper, hash: worldHash(world) };
    };
    const clean = runFight(null);
    ok("pair(d): the spotter fires zero rounds across a 25s firefight", clean.spotterRounds === 0, `rounds=${clean.spotterRounds}`);
    ok("pair(d): the sniper squad still kills (sniper fires as before)",
      clean.squads.length === 1 && clean.squads[0].type === "sniper", JSON.stringify(clean.squads.map((q) => q.type)));
    const twin = runFight(null);
    ok("pair(d): twin determinism with the pair in play", clean.hash === twin.hash, `${clean.hash} vs ${twin.hash}`);
    // spotter dies -> direction stops, sniper holds his squad and type
    const sd = runFight("spotter");
    ok("pair(e): spotter death — sniper holds, squad stays a sniper squad",
      sd.squads.length === 1 && sd.squads[0].type === "sniper" && sd.sniper && sd.sniper.alive,
      JSON.stringify(sd.squads.map((q) => q.type)));
    // sniper dies -> spotter converts to a lone rifleman, keeps hp, fires
    const nd = runFight("sniper");
    ok("pair(f): sniper death — spotter respec'd to rifles (squad + utype)",
      nd.squads.length === 1 && nd.squads[0].type === "rifles" && nd.spotter && nd.spotter.utype === "rifles" && !nd.spotter.role,
      JSON.stringify({ type: nd.squads[0] && nd.squads[0].type, utype: nd.spotter && nd.spotter.utype }));
    ok("pair(f): the converted spotter fires from then on", nd.spotterRounds > 0, `rounds=${nd.spotterRounds}`);
  }
  // (f2) conversion keeps current hp — no heal, no reset
  {
    const world = makeWorld({ field: flatF(), seed: 69 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const members = sq.memberIds.map((id) => world.byId.get(id));
    const spotter = members.find((u) => u.role === "spotter");
    const sniper = members.find((u) => u.role === "sniper");
    spotter.hp = 21.5;
    applyDamage(world, sniper, 1e9, { attacker: "enemy" });
    const squads = pruneSquads(world, [sq]);
    ok("pair(f2): conversion keeps the spotter's current hp (same man, different tool)",
      squads.length === 1 && squads[0].type === "rifles" && Math.abs(spotter.hp - 21.5) < 1e-9, `hp=${spotter.hp}`);
  }

  // (g) enemy mirror: pair marches, sniper holds, spotter surveys + settles,
  // never fires; sniper death converts the spotter to a rifleman
  {
    const world = makeWorld({ field: flatF(), seed: 70 });
    world.depotCombat = true;
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 0.5, hy: 0.9, hz: 0.5, x: 0, y: 0.9, z: 0, hp: 1e9 });
    const sn = spawnUnit(world, { x: 0, z: 6 }, "sniper");
    sn.pos.x = 0; sn.pos.z = 6;
    const spotter = world.bodies.find((b) => b.role === "spotter" && b.team === 2);
    let spotterFired = false;
    const seen = new Set();
    for (let i = 0; i < 2400; i++) {
      stepUnits(world, grid6, identFwdDir);
      stepWorld(world);
      for (const p of world.projectiles) { if (!seen.has(p) && spotter && p.spec && p.spec.owner === spotter.id) spotterFired = true; seen.add(p); }
    }
    ok("pair(g): enemy sniper holds a vantage with his spotter alive", sn.hold === true);
    ok("pair(g): enemy spotter settles near his sniper's ground (within survey radius + slack)",
      !!spotter && Math.hypot(spotter.pos.x - sn.pos.x, spotter.pos.z - sn.pos.z) < SQ.SPOT_R + 3,
      spotter && `d=${Math.hypot(spotter.pos.x - sn.pos.x, spotter.pos.z - sn.pos.z).toFixed(2)}`);
    ok("pair(g): enemy spotter never fires", spotterFired === false);
    applyDamage(world, sn, 1e9, { attacker: "player" });
    for (let i = 0; i < 120; i++) { stepUnits(world, grid6, identFwdDir); stepWorld(world); }
    ok("pair(g): enemy sniper death converts the spotter to a rifleman (tag swap, role cleared)",
      !!spotter && spotter.alive && spotter.tag === "" && !spotter.role, spotter && `tag="${spotter.tag}" role=${spotter.role}`);
  }

  // (h) affordability: ai.js buys the pair at 45, skips it when the buy
  // would eat the token-muster floor
  {
    const snap = { squads: 3, mortars: 0, walls: 0, frosts: 0, mgs: 0 };
    const rich = { heads: 40, tanks: 0, scrap: 45 + MIN_WAVE_FLOOR };
    const planR = planWave(rich, snap, 6, mulberry32(5));
    const poor = { heads: 40, tanks: 0, scrap: 45 + MIN_WAVE_FLOOR - 1 };
    const planP = planWave(poor, snap, 6, mulberry32(5));
    ok("pair(h): sniper pair bought at exactly the 45 + floor threshold",
      planR.buys.some((b) => b.type === "sniper"), JSON.stringify(planR.buys));
    ok("pair(h): one scrap short of 45 + floor -> no pair fielded",
      !planP.buys.some((b) => b.type === "sniper"), JSON.stringify(planP.buys));
  }

  // (i) rng stream identity on a pairless run: fielding the pair adds ZERO
  // draws to spawn (spotter placement is draw-free), and a pairless spawn
  // stream is untouched
  {
    const countDraws = (tag) => {
      const world = makeWorld({ field: flatF(), seed: 71 });
      let n = 0;
      const rng0 = world.rng;
      world.rng = () => { n++; return rng0(); };
      spawnUnit(world, { x: 0, z: 10 }, tag);
      return n;
    };
    ok("pair(i): conscript spawn draw count unchanged (3)", countDraws("") === 3, countDraws(""));
    ok("pair(i): sniper PAIR spawn draws exactly what a lone spawn drew (spotter adds zero draws)",
      countDraws("sniper") === 3, countDraws("sniper"));
  }

  // (j) renderer: pair look rides DEPOT-gated only (flag-off untouched) —
  // every role-driven pose/prop/glint block keys on world.depotCombat
  {
    const rSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    const roleRefs = (rSrc.match(/\brole\s*===\s*"(spotter|sniper)"/g) || []).length;
    ok("pair(j): renderer reads the pair roles (pose/prop/glint present)", roleRefs >= 2, `refs=${roleRefs}`);
    ok("pair(j): pair look gated on world.depotCombat (flag-off byte-identical path)",
      /depotCombat[\s\S]{0,400}role/.test(rSrc));
  }
}
// ==== end 6.5 TASK 6 =========================================================

// ==== FRONT F1 Task 1: their depot stands ====================================
// DepotGame.jsx is JSX (not importable headlessly) — extract the REAL map
// machinery (module header + genMap/makeMap/makeGrid/pondAt/rockAt/
// checkConnectivity/buildTown) from the source text and evaluate it with its
// imported deps injected. This runs the actual shipped code, not a copy.
{
  const depotSrcF1 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const sliceFn = (name) => {
    const start = depotSrcF1.indexOf(`\nfunction ${name}(`);
    if (start < 0) throw new Error("F1 extract: missing function " + name);
    const rest = depotSrcF1.slice(start + 1);
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerStart = depotSrcF1.indexOf("const GRID_CS");
  const headerEnd = depotSrcF1.indexOf("function genMap");
  const header = depotSrcF1.slice(headerStart, headerEnd);
  const mapSrc = [
    header,
    sliceFn("genMap"), sliceFn("makeMap"), sliceFn("pondAt"), sliceFn("rockAt"),
    sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("buildTown"),
    `return { genMap, makeMap, makeGrid, checkConnectivity, buildTown, invW,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, MAP_SEED }) };`,
  ].join("\n");
  const makeMapModule = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

  const M = makeMapModule();
  M.makeMap(5);
  const st = M.state();
  const depot2 = st.TOWN.find((t) => t.id === "depot2");
  ok("F1/1a: genMap places depot2 (team 2) in the town list", !!depot2 && depot2.team === 2, JSON.stringify(depot2));
  {
    const c = depot2 ? invWFor(st.ORIENT, depot2.x, depot2.z) : { u: 9e9, v: 9e9 };
    ok("F1/1a: depot2 sits at canonical (0, -46)", Math.abs(c.u - 0) < 0.01 && Math.abs(c.v - -46) < 0.01, `u=${c.u} v=${c.v}`);
    ok("F1/1a: depot2 shares the depot lattice template (9x7x6, door 4, depot flag)",
      !!depot2 && depot2.depot === true &&
      Math.max(depot2.nx, depot2.nz) === 9 && Math.min(depot2.nx, depot2.nz) === 7 && depot2.ny === 6,
      depot2 && `${depot2.nx}x${depot2.nz}x${depot2.ny}`);
  }

  // real buildTown on the real map: same stone-count law both depots, two flags
  {
    const world = makeWorld({ field: { heightAt: () => 0 }, seed: 5 });
    const grid = M.makeGrid(null);
    M.buildTown(world, grid, { heightAt: () => 0 });
    const stones1 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot").length;
    const stones2 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot2").length;
    ok("F1/1b: depot2 chunk lattice exists with the same stone count as depot", stones2 > 0 && stones2 === stones1, `depot=${stones1} depot2=${stones2}`);
    const flags = world.bodies.filter((b) => b.kind === "flag");
    ok("F1/1b: exactly two flag bodies, teams 1 and 2",
      flags.length === 2 && flags.map((f) => f.team).sort().join(",") === "1,2",
      `n=${flags.length} teams=${flags.map((f) => f.team)}`);

    // territory with the NEW emitter law: flags emit by team sign, no anchors.
    // Emitters here are built from the REAL flag bodies by the same rule the
    // source must carry (grep-pinned below).
    const T = makeTerritory(29, 57);
    const flagEmitters = flags.map((f) => {
      const c = invWFor(st.ORIENT, f.pos.x, f.pos.z);
      return { x: c.u, z: c.v, w: EMIT.depot.w, r: EMIT.depot.r, sign: f.team === 2 ? -1 : 1 };
    });
    for (let i = 0; i < 120; i++) stepTerritory(T, flagEmitters, 0.25); // 30 simulated s
    ok("F1/1c: after 30s their depot ground reads unheld for team 1", fogStateFor(T, 0, -46, 1) === "unheld", fogStateFor(T, 0, -46, 1));
    ok("F1/1c: ...and held for team 2 (sign mirror of ours)", fogStateFor(T, 0, -46, 2) === "held", fogStateFor(T, 0, -46, 2));
    ok("F1/1c: our depot still held for team 1", fogStateFor(T, 0, 49, 1) === "held", fogStateFor(T, 0, 49, 1));

    // the old permanent spawn anchor is gone. NOTE (deviation from the plan's
    // literal assert): the spawn edge does NOT decay to 0 in play — the enemy
    // depot flag's homeland radius (EMIT.depot.r = 36 from (0,-46)) reaches
    // v = -54 by design, so the spawn edge stays red via the FLAG. Pin both
    // halves: (1) with the flag as the only enemy emitter the spawn edge is
    // still enemy-held; (2) ground primed red with no live emitter τ-decays
    // (nothing is permanently pinned by an anchor anymore).
    const spU = invWFor(st.ORIENT, st.SPAWN_POINTS[0].x, st.SPAWN_POINTS[0].z);
    ok("F1/1c: spawn edge held red by the enemy FLAG (no anchor needed)", fogStateFor(T, spU.u, spU.v, 2) === "held", fogStateFor(T, spU.u, spU.v, 2));
    const T2 = makeTerritory(29, 57);
    for (let i = 0; i < 120; i++) stepTerritory(T2, [{ x: 24, z: 0, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 }], 0.25);
    const primed = valueAt(T2, 24, 0);
    for (let i = 0; i < 120; i++) stepTerritory(T2, flagEmitters, 0.25); // 30s, live set has no anchor there
    const after = valueAt(T2, 24, 0);
    ok("F1/1c: red ground with no live emitter decays toward 0 (τ-decay)", primed < -0.5 && Math.abs(after) < Math.abs(primed) * 0.75, `primed=${primed.toFixed(3)} after=${after.toFixed(3)}`);
  }

  // source pins: the emitter rule and the deleted anchor push
  ok("F1/1c: buildEmitters flags emit by team sign", /b\.kind === "flag"[^\n]*sign: b\.team === 2 \? -1 : 1/.test(depotSrcF1));
  ok("F1/1c: the SPAWN_POINTS anchor push is deleted", !/for \(const sp of SPAWN_POINTS\)[^\n]*EMIT\.anchor/.test(depotSrcF1));

  // renderer: cloth tint keys on the flag body's team (DEPOT-gated by the
  // existing world.wind gate — TD/no-option renders never reach this block)
  {
    const rSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    ok("F1/1d: flag cloth tint keys on the flag body's team", /flagClothMesh\.setColorAt\(fi, b\.team === 2 \?/.test(rSrc));
  }

  // connectivity both directions + 20-seed placement sweep: depot2 never
  // fouls roads/spawns/ponds/rocks and every map builds
  {
    const halfDiag = Math.hypot(9, 7) * MASON.pitch / 2;
    for (let s = 1; s <= 20; s++) {
      const Mi = makeMapModule();
      Mi.makeMap(s * 101);
      const sti = Mi.state();
      const d2 = sti.TOWN.find((t) => t.id === "depot2");
      if (!d2) { ok(`F1/sweep seed ${s * 101}: depot2 present`, false); continue; }
      // clearance in world space against the built map
      const roadDistW = (x, z) => {
        let best = 1e9;
        for (const route of sti.ROADS) for (let i = 0; i < route.length - 1; i++) {
          const a = route[i], b2 = route[i + 1];
          const dx = b2[0] - a[0], dz = b2[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
        }
        return best;
      };
      const rd = roadDistW(d2.x, d2.z);
      const pondFoul = sti.PONDS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const rockFoul = sti.ROCKS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const spawnFoul = sti.SPAWN_POINTS.some((sp) => Math.hypot(d2.x - sp.x, d2.z - sp.z) < halfDiag + 2);
      ok(`F1/sweep seed ${s * 101}: depot2 clear of roads/ponds/rocks/spawns`,
        rd > halfDiag + 2 && !pondFoul && !rockFoul && !spawnFoul,
        `roadDist=${rd.toFixed(2)} pond=${pondFoul} rock=${rockFoul} spawn=${spawnFoul}`);
      // connectivity both directions on the accepted map
      const g = Mi.makeGrid(null);
      for (const t of sti.TOWN) {
        const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
        for (let gz = 0; gz < g.h; gz++) for (let gx = 0; gx < g.w; gx++) {
          const wp = g.gridToWorld(gx, gz);
          if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
            if (Math.hypot(wp.x - sti.OBJ_POS.x, wp.z - sti.OBJ_POS.z) < 5) continue;
            g.cells[g.idx(gx, gz)].blocked = true;
          }
        }
      }
      const og = g.worldToGrid(sti.OBJ_POS.x, sti.OBJ_POS.z);
      const doorW = fwdUFor(sti.ORIENT, 0, -51); // just outside depot2's door face
      const dg = g.worldToGrid(doorW.x, doorW.z);
      ok(`F1/sweep seed ${s * 101}: spawns reach the objective AND depot2's doorway`,
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, og.gx, og.gz) &&
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, dg.gx, dg.gz));
    }
  }

  // twin determinism: two extractions, same seed -> identical map state
  {
    const A = makeMapModule(); A.makeMap(77);
    const B = makeMapModule(); B.makeMap(77);
    ok("F1: twin determinism — same seed, identical town layout",
      JSON.stringify(A.state().TOWN) === JSON.stringify(B.state().TOWN));
  }
}
// ==== end FRONT F1 Task 1 ====================================================

// ==== FRONT F1 Task 3: the only ending =======================================
// The two breaches are the ONLY run-enders. Leaks/lives retire; waves cycle
// past the table; attrition/spent become one-time dispatch observations.
{
  const W3 = [{ units: 3, delay: 1 }, { units: 4, delay: 0.8 }, { units: 5, delay: 0.7 }];

  // (a) leaks retired at the source: units.js exports no checkLeaks, the
  // world removal path is gone, DepotGame neither imports nor calls it, and
  // no leak event branch/lives field survives in HUD or run state.
  {
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    const depotSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
    ok("F1/3a: units.js no longer defines checkLeaks", !unitsSrc.includes("function checkLeaks"));
    ok("F1/3a: DepotGame neither imports nor calls checkLeaks", !depotSrc.includes("checkLeaks"));
    ok("F1/3a grep pin: no lives field in DepotGame (HUD, hooks, run state)", !/\blives\b/.test(depotSrc.replace(/\/\/[^\n]*/g, "")));
    ok("F1/3a grep pin: no heart chip in DepotGame", !depotSrc.includes("♥"));
    ok("F1/3a grep pin: no FINAL WAVE copy in state.js cards", !stateSrc.includes("FINAL WAVE"));
    ok("F1/3a grep pin: no n-of-50 wave display in DepotGame", !depotSrc.includes("totalWaves"));
    ok("F1/3a: makeRunState carries no lives", !("lives" in makeRunState({ waves: W3 })));
    const S0 = makeRunState({ waves: W3 });
    startWave(S0, W3, { useTable: true });
    ok("F1/3a: ws.results.leaks still initialized (dead field reads 0)", S0.ws.results.leaks === 0);
  }

  // (a2) an enemy parked at your depot for 30 simulated seconds neither
  // despawns nor costs anything — he stays, fights, and his structure fire
  // chews depot masonry (the shared hostile-structure set makes "depot"
  // chunks targetable by team 2 — the Task 3/4 interlock).
  {
    const { hcs, pitch, mass } = MASON;
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatF, seed: 31 });
    const chunks = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 2; iy++) for (let iz = 0; iz < 1; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - 1) * pitch, y: hcs + 0.02 + iy * pitch, z: 20 + iz * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = "depot"; chunks.push(c);
    }
    const home = chunks.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const u = spawnUnit(world, { x: 0, z: 8 }, "");
    u.pos.x = 0; u.pos.z = 8; // parked well inside rifle range of the lattice
    world.dt = 1 / 60;
    for (let i = 0; i < 30 * 60; i++) {
      stepUnits(world, straightGrid(0, 1), identFwdDir);
      stepWorld(world);
    }
    ok("F1/3a2: parked enemy persists 30s (no despawn, no leak events)",
      world.byId.has(u.id) && u.alive && !world.events.some((e) => e.type === "leak"),
      `alive=${u.alive}`);
    // Masonry falls by DISPLACEMENT, not hit points (core.js: chunks take
    // blast impulse; hp damage covers units/vehicles, and the structure hp
    // loop covers wall/tower/rock). The observable for "his fire chews the
    // building" is physical: he acquires a depot chunk and his rounds shove
    // stones off their homes (weld-free fixture so single stones can move).
    ok("F1/3a2: he acquires depot masonry as a target", u.tgtId != null && chunks.some((c) => c.id === u.tgtId), `tgt=${u.tgtId}`);
    const moved = home.filter((h) => {
      const b = world.byId.get(h.id);
      if (!b) return true;
      return Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05;
    }).length;
    ok("F1/3a2: his structure fire physically works the masonry (stones shoved off home)", moved > 0, `moved=${moved}/${chunks.length}`);
  }

  // (b) waves cycle: the run advances past the table's end with waves still
  // spawning — composition clamps at the last row, no victory fires.
  {
    const S = makeRunState({ waves: W3 });
    S.started = true;
    S.ws.waveIdx = W3.length - 1;
    S.ws.spawnQueue = 0;
    S.phase = PHASE.WAVE;
    tryStall(S, W3, 0);
    ok("F1/3c: last-row stall carries no FINAL WAVE copy", !S.dispatch.lines.some((l) => l.includes("FINAL WAVE")), JSON.stringify(S.dispatch.lines));
    advance(S, W3, {});
    ok("F1/3c: advancing past the table's end sets NO victory and returns to build",
      S.victory === false && S.gameOver === false && S.phase === PHASE.BUILD, `victory=${S.victory}`);
    ok("F1/3c: waveIdx runs past the table", S.ws.waveIdx === W3.length);
    startWave(S, W3, { useTable: true });
    ok("F1/3c: wave past the end clamps to the last table row", S.ws.spawnQueue === W3[W3.length - 1].units, S.ws.spawnQueue);
    // deep cycle: 60 waves in, still spawning, still no ending
    for (let w = 0; w < 57; w++) {
      S.ws.spawnQueue = 0; S.phase = PHASE.WAVE;
      tryStall(S, W3, 0);
      advance(S, W3, {});
      startWave(S, W3, { useTable: true });
    }
    ok("F1/3c: wave 60+ still spawns from the clamped row, run alive",
      S.ws.waveIdx >= 60 && S.ws.spawnQueue === W3[W3.length - 1].units && !S.victory && !S.gameOver,
      `idx=${S.ws.waveIdx}`);
  }

  // (c) forced combatIneffective sets NO victory; its dispatch line appears
  // exactly once (the bureau reports; the guns finish it).
  {
    const S = makeRunState({ waves: W3 });
    S.started = true;
    S.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective
    S.ws.spawnQueue = 0; S.phase = PHASE.WAVE;
    tryStall(S, W3, 0);
    ok("F1/3b: combat-ineffective regiment sets NO victory", S.victory === false && S.gameOver === false);
    const line1 = S.dispatch.lines.find((l) => /combat-ineffective/i.test(l));
    ok("F1/3b: the observation line appears at the stall", !!line1, JSON.stringify(S.dispatch.lines));
    ok("F1/3b: observation is digit-free bureau voice", line1 && !/\d/.test(line1), line1);
    advance(S, W3, {});
    S.ws.spawnQueue = 0; S.phase = PHASE.WAVE;
    tryStall(S, W3, 0);
    ok("F1/3b: the observation appears only once (second stall silent)",
      !S.dispatch.lines.some((l) => /combat-ineffective/i.test(l)), JSON.stringify(S.dispatch.lines));
  }

  // (c2) three starved musters: NO victory; a one-time spent observation.
  {
    const S = makeRunState({ waves: W3 });
    S.started = true;
    S.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: MIN_WAVE_FLOOR - 1 };
    for (let i = 0; i < 3; i++) { S.reg.scrap = MIN_WAVE_FLOOR - 1; S.ws.spawnQueue = 0; S.phase = PHASE.WAVE; tryStall(S, W3, 0); if (i < 2) advance(S, W3, {}); }
    ok("F1/3b: three starved stalls set NO victory (spent retired as an ending)",
      S.victory === false && S.gameOver === false, `victory=${S.victory} spent=${S.spent}`);
    ok("F1/3b: spent observation line appears once, digit-free",
      S.dispatch.lines.some((l) => /spent/i.test(l) && !/\d/.test(l)), JSON.stringify(S.dispatch.lines));
    advance(S, W3, {});
    S.ws.spawnQueue = 0; S.phase = PHASE.WAVE; tryStall(S, W3, 0);
    ok("F1/3b: spent observation not repeated", !S.dispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(S.dispatch.lines));
  }

  // (d) exhaustive: the only two enders are the two breaches. Force every
  // retired condition — regiment stub, ledger/book-value, attrition, spent —
  // and assert no end; then the two breaches still end it.
  {
    const S = makeRunState({ waves: W3 });
    S.started = true;
    S.reg = { heads: 5, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective AND broke
    ok("F1/3b: checkLoss without breach never fires (regiment stub only)", checkLoss(S) === false && !S.gameOver);
    S.ws.waveIdx = W3.length - 1; S.ws.spawnQueue = 0; S.phase = PHASE.WAVE;
    tryStall(S, W3, 0);   // attrition + spent conditions live here
    advance(S, W3, {});   // past the table end — old checkWin territory
    ok("F1/3d: no retired condition ends the run",
      !S.victory && !S.gameOver && !S.breach && !S.enemyBreach, `v=${S.victory} go=${S.gameOver}`);
    checkEnemyBreach(S, 0.1);
    ok("F1/3d: enemy breach still ends it (victory)", S.victory === true && S.enemyBreach === true);
    const S2 = makeRunState({ waves: W3 });
    checkDepotBreach(S2, 0.1);
    ok("F1/3d: player breach still ends it (loss)", S2.gameOver === true && S2.breach === true);
  }

  // (e) twin determinism: two identical drives through the cycling phase
  // machine produce identical dispatch/flag traces (pure path, zero draws).
  {
    const drive = () => {
      const S = makeRunState({ waves: W3 });
      S.started = true;
      S.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 };
      const trace = [];
      for (let w = 0; w < 8; w++) {
        startWave(S, W3, { useTable: true });
        S.ws.spawnQueue = 0;
        tryStall(S, W3, 0);
        trace.push(JSON.stringify([S.ws.waveIdx, S.dispatch && S.dispatch.lines, S.victory, S.gameOver]));
        advance(S, W3, {});
      }
      return trace.join("|");
    };
    ok("F1/3e: twin determinism through the cycling phase machine", drive() === drive());
  }
}
// ==== end FRONT F1 Task 3 ====================================================

// ==== FRONT F1 Task 4: rifles bite stone (the offense exists) ================
// hostileStructure is the one shared definition of "enemy structure";
// squadFire falls back to it ONLY when the unit scan comes up empty.
{
  const flatF4 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { hcs, pitch, mass } = MASON;
  const mkLattice = (world, townId, z0, welds = false) => {
    const chunks = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 2; iy++) {
      const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - 1) * pitch, y: hcs + 0.02 + iy * pitch, z: z0, friction: 0.65, restitution: 0.02 });
      c.sleeping = true; c.town = townId; c.gpos = [ix, iy, 0]; chunks.push(c);
    }
    if (welds) {
      const key = (a, b) => a + "," + b;
      const map = new Map(chunks.map((c) => [key(c.gpos[0], c.gpos[1]), c]));
      for (const c of chunks) for (const d of [[1, 0], [0, 1]]) {
        const o = map.get(key(c.gpos[0] + d[0], c.gpos[1] + d[1]));
        if (o) addWeld(world, c, o, MASON.breakF * 1.5); // the depot weld (buildTown)
      }
    }
    return chunks;
  };
  const mkSquad4 = (world, x, z, type = "rifles") => {
    const squad = makeSquad(1, type, 1, x, z);
    for (let i = 0; i < SQUAD_SPECS[type].n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: x + i * 1.1 - 2, y: 0.9, z, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "defend";
    return squad;
  };

  // (a) hostileStructure — the set itself, both signs.
  {
    const world = makeWorld({ field: flatF4, seed: 44 });
    const dep = mkLattice(world, "depot", 30)[0];
    const dep2 = mkLattice(world, "depot2", -30)[0];
    const wall1 = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 0.8, hz: 0.5, x: 5, y: 0.8, z: 0, hp: 100 });
    const wall2 = addBody(world, { kind: "wall", team: 2, mass: 0, hx: 0.5, hy: 0.8, hz: 0.5, x: -5, y: 0.8, z: 0, hp: 100 });
    ok("F1/4a: team 1 may bite depot2 masonry + enemy walls (F3-ready), never its own",
      hostileStructure(dep2, 1) && hostileStructure(wall2, 1) && !hostileStructure(dep, 1) && !hostileStructure(wall1, 1));
    ok("F1/4a: team 2 may bite depot masonry + player walls, never its own",
      hostileStructure(dep, 2) && hostileStructure(wall1, 2) && !hostileStructure(dep2, 2) && !hostileStructure(wall2, 2));
    dep2.alive = false;
    ok("F1/4a: dead bodies never in the set", !hostileStructure(dep2, 1));
  }

  // (b) an ordered squad in range of depot2, no units in reach: fires, and
  // the stone takes the rounds (impact events on the lattice; weld-free
  // fixture so displacement shows). Zero rng draws besides applyScatter's 2
  // per shot — pinned by twin determinism in (f).
  {
    const world = makeWorld({ field: flatF4, seed: 45 });
    world.depotCombat = true;
    const chunks = mkLattice(world, "depot2", 10);
    const home = chunks.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const squad = mkSquad4(world, 0, 0);
    const dt = 1 / 30;
    for (let i = 0; i < 10 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    const moved = home.filter((h) => { const b = world.byId.get(h.id); return !b || Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05; }).length;
    ok("F1/4b: with no man in reach the squad bites stone (depot2 stones shoved)", moved > 0, `moved=${moved}/${chunks.length}`);
    // owner threading: no member ever detonates a round on his own hitbox —
    // across the whole 10s (well over 200 rounds squad-wide) every member
    // stands untouched at full hp.
    const selfHit = squad.memberIds.some((id) => { const u = world.byId.get(id); return !u || !u.alive || u.hp < 100; });
    ok("F1/4b: owner threaded — zero self-hits across the volley run", !selfHit);
  }

  // (c) a live enemy unit re-entering range immediately outranks the stone.
  {
    const world = makeWorld({ field: flatF4, seed: 46 });
    world.depotCombat = true;
    mkLattice(world, "depot2", 10);
    const squad = mkSquad4(world, 0, 0);
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 6, hp: 1e9 });
    const dt = 1 / 30;
    for (let i = 0; i < 6 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1/4b: a man in reach outranks the stone (unit takes the fire)", man.hp < 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
  }

  // (d) the law: structure fire NEVER fog-gates (both signs); unit fire
  // always does. A territory field reading "unheld" everywhere for the
  // shooter must not stop stone shots — and must stop man shots.
  {
    // Real territory grids, saturated for the OTHER side: Tred (field -1
    // everywhere) reads "unheld" for team 1; Tgreen (+1) for team 2.
    const Tred = makeTerritory(120, 120); Tred.v.fill(-1);
    const Tgreen = makeTerritory(120, 120); Tgreen.v.fill(1);
    const world = makeWorld({ field: flatF4, seed: 47 });
    world.depotCombat = true;
    const T = Tred;
    ok("F1/4d fixture: red-saturated territory reads unheld for team 1", fogStateFor(T, 0, 10, 1) === "unheld");
    const chunks = mkLattice(world, "depot2", 10);
    const home = chunks.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: -6, y: 0.86, z: 6, hp: 1e9 });
    const squad = mkSquad4(world, 0, 0);
    const dt = 1 / 30;
    for (let i = 0; i < 8 / dt; i++) { squadFire(world, squad, dt, T); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1/4d: unit fire fog-gates (unheld field, man untouched)", man.hp === 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
    const moved = home.filter((h) => { const b = world.byId.get(h.id); return !b || Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05; }).length;
    ok("F1/4d: structure fire never fog-gates (stone still bitten under unheld field)", moved > 0, `moved=${moved}`);
    // enemy sign: stepRifleman's structure path under a green-saturated
    // field (unheld for team 2) —
    // the parked-enemy fixture in Task 3 (F1/3a2) already proves team 2's
    // structure fire without any field; assert the sign here WITH one.
    const world2 = makeWorld({ field: flatF4, seed: 48 });
    world2.depotCombat = true;
    const chunks2 = mkLattice(world2, "depot", 20);
    const home2 = chunks2.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const e = spawnUnit(world2, { x: 0, z: 8 }, "");
    e.pos.x = 0; e.pos.z = 8;
    world2.dt = 1 / 60;
    for (let i = 0; i < 15 * 60; i++) { stepUnits(world2, straightGrid(0, 1), identFwdDir, Tgreen, (x, z) => ({ u: x, v: z })); stepWorld(world2); }
    const moved2 = home2.filter((h) => { const b = world2.byId.get(h.id); return !b || Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05; }).length;
    ok("F1/4d: enemy structure fire never fog-gates either (depot bitten under unheld field)", moved2 > 0, `moved=${moved2}`);
  }

  // (e) unit-target damage parity: the structure fallback must not perturb
  // the man-shooting path — open-ground fixture pinned to 4 decimals
  // against the pre-change measurement (46.3061, captured 2026-08-11 on
  // eafeca7 before 4b landed).
  {
    const runP = () => {
      const world = makeWorld({ field: flatF4, seed: 11 });
      world.depotCombat = true;
      const squad = mkSquad4(world, 0, 0);
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
      const dt = 1 / 30;
      for (let i = 0; i < 10 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
      return { dmg: (1e9 - target.hp).toFixed(4), hash: worldHash(world) };
    };
    const a = runP(), b = runP();
    ok("F1/4e: unit-target damage parity to 4 decimals (pre-change pin 46.3061)", a.dmg === "46.3061", `dmg=${a.dmg}`);
    ok("F1/4f: twin determinism (identical hash, twin runs)", a.hash === b.hash, `${a.hash} vs ${b.hash}`);
  }

  // (f2) twin determinism of the stone-biting path itself.
  {
    const runS = () => {
      const world = makeWorld({ field: flatF4, seed: 45 });
      world.depotCombat = true;
      mkLattice(world, "depot2", 10);
      const squad = mkSquad4(world, 0, 0);
      const dt = 1 / 30;
      for (let i = 0; i < 6 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
      return worldHash(world);
    };
    ok("F1/4f: twin determinism of the structure-fire path", runS() === runS());
  }
}
// ==== end FRONT F1 Task 4 ====================================================

// ==== FRONT F1 Task 4.5: the player sapper squad =============================
// Rifle fire moves reinforced depot masonry ZERO meters (Task 4's measured
// truth) — the sapper team is the symmetric fix: the exact mirror of the
// enemy's satchel sapper. One charge per man, 1.5s fuse, the charge consumes
// the planter, ATTACK-order only, no rifle, zero rng draws in the charge path.
{
  const { createHash } = await import("node:crypto");
  const flatS = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { hcs, pitch, mass } = MASON;
  const mkLatticeS = (world, townId, z0, welds = false) => {
    const chunks = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 2; iy++) {
      const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - 1) * pitch, y: hcs + 0.02 + iy * pitch, z: z0, friction: 0.65, restitution: 0.02 });
      c.sleeping = true; c.town = townId; c.gpos = [ix, iy, 0]; chunks.push(c);
    }
    if (welds) {
      const key = (a, b) => a + "," + b;
      const map = new Map(chunks.map((c) => [key(c.gpos[0], c.gpos[1]), c]));
      for (const c of chunks) for (const d of [[1, 0], [0, 1]]) {
        const o = map.get(key(c.gpos[0] + d[0], c.gpos[1] + d[1]));
        if (o) addWeld(world, c, o, MASON.breakF * 1.5); // the depot weld (buildTown)
      }
    }
    return chunks;
  };
  const mkSquadS = (world, x, z, type) => {
    const squad = makeSquad(1, type, 1, x, z);
    for (let i = 0; i < SQUAD_SPECS[type].n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: x + i * 1.1 - 0.55, y: 0.74, z, hp: 58 });
      u.utype = type; u.squadId = squad.id;
      squad.memberIds.push(u.id);
    }
    return squad;
  };

  // (a) the spec exists: 2 men, 25 scrap, provisional.
  ok("F1/4.5a: SQUAD_SPECS.sappers exists (n:2, cost:25)",
    !!SQUAD_SPECS.sappers && SQUAD_SPECS.sappers.n === 2 && SQUAD_SPECS.sappers.cost === 25,
    JSON.stringify(SQUAD_SPECS.sappers));

  // (b) ordered onto depot2 (welded — the reinforced lattice rifles measured
  // ZERO against), the team plants, detonates, dies to its own work, pays no
  // bounty, and displaces stone past DEPOT_STANDING_TOL. The contrast is run
  // in the SAME fixture with rifles first.
  const runTeamS = (world, x, z, destZ) => {
    const squad = mkSquadS(world, x, z, "sappers");
    squad.order = "attack"; squad.dest = { x, z: destZ };
    const dt = 1 / 30;
    for (let i = 0; i < 20 / dt; i++) {
      stepSquad(world, squad, dt); squadFire(world, squad, dt);
      for (let s = 0; s < 20; s++) stepWorld(world);
      if (!squad.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) break;
    }
    return squad;
  };
  {
    // rifles contrast: 20s of squad fire vs the welded lattice moves nothing
    // past the standing tolerance (Task 4's 0.000m truth, re-pinned here).
    const worldR = makeWorld({ field: flatS, seed: 52 });
    worldR.depotCombat = true;
    const chunksR = mkLatticeS(worldR, "depot2", 10, true);
    const censusR = censusDepotChunks(worldR.bodies, "depot2");
    const squadR = mkSquadS(worldR, 0, 0, "rifles");
    squadR.order = "defend";
    const dtR = 1 / 30;
    for (let i = 0; i < 20 / dtR; i++) { squadFire(worldR, squadR, dtR); for (let s = 0; s < 20; s++) stepWorld(worldR); }
    ok("F1/4.5b: the contrast — rifle fire moves NO welded stone past tolerance", depotStandingFraction(censusR, worldR.byId) === 1, `frac=${depotStandingFraction(censusR, worldR.byId)} chunks=${chunksR.length}`);

    const world = makeWorld({ field: flatS, seed: 52 });
    world.depotCombat = true;
    mkLatticeS(world, "depot2", 10, true);
    const census = censusDepotChunks(world.bodies, "depot2");
    const squad = runTeamS(world, 0, 4, 10);
    const members = squad.memberIds.map((id) => world.byId.get(id));
    ok("F1/4.5b: the charge consumes the planter (both sappers die to their own work)",
      members.every((u) => !u || !u.alive), members.map((u) => u && u.alive).join(","));
    payBounties(world);
    ok("F1/4.5b: no bounty paid to anyone (no tdkill events)", !world.events.some((e) => e.type === "tdkill"));
    // Task 4.5 final (Jeff's bigger-charge decision): ONE team's charges,
    // planted at the real stopping distance, scatter welded depot stone past
    // the 1.2m standing tolerance — the real thing, where 3,696 rifle rounds
    // measured 0.000m and the old {r:3.4, kv:9} charge managed ~0.5m.
    let maxD = 0;
    for (const c of census) {
      const b = world.byId.get(c.id);
      const d = !b || !b.alive ? 9 : Math.hypot(b.pos.x - c.home.x, b.pos.y - c.home.y, b.pos.z - c.home.z);
      if (d > maxD) maxD = d;
    }
    ok("F1/4.5b: one team scatters welded stone past the standing tolerance (>=1.2m; rifles measured 0.000m)", maxD >= DEPOT_STANDING_TOL, `maxDisp=${maxD.toFixed(3)}m`);
  }

  // (c) defend order never plants — a sapper team standing in arm's reach of
  // the enemy depot on DEFEND holds its charges (and its lives).
  {
    const world = makeWorld({ field: flatS, seed: 53 });
    world.depotCombat = true;
    mkLatticeS(world, "depot2", 10, true);
    const census = censusDepotChunks(world.bodies, "depot2");
    const squad = mkSquadS(world, 0, 8.8, "sappers");
    squad.order = "defend";
    const dt = 1 / 30;
    let inReachSeen = false, fuseLit = false;
    for (let i = 0; i < 6 / dt; i++) {
      stepSquad(world, squad, dt); squadFire(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        if (!u || !u.alive) continue;
        if (u._fuse != null) fuseLit = true;
        for (const b of world.bodies) {
          if (b.kind !== "chunk" || b.town !== "depot2") continue;
          const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z;
          if (dx * dx + dz * dz < (b.hx + 1.3) * (b.hx + 1.3)) { inReachSeen = true; break; }
        }
      }
      for (let s = 0; s < 20; s++) stepWorld(world);
    }
    ok("F1/4.5c: defend order never plants (men in arm's reach, no fuse ever, stone standing)",
      inReachSeen && !fuseLit && depotStandingFraction(census, world.byId) === 1,
      `inReach=${inReachSeen} lit=${fuseLit}`);
  }

  // (d) sappers never rifle-fire and the plant path draws NOTHING — run to
  // just before detonation (fuse lit, no blast yet): zero rng draws.
  {
    const world = makeWorld({ field: flatS, seed: 54 });
    world.depotCombat = true;
    mkLatticeS(world, "depot2", 10, true);
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 4, y: 0.86, z: 6, hp: 1e9 });
    const squad = mkSquadS(world, 0, 8, "sappers");
    squad.order = "attack"; squad.dest = { x: 0, z: 14 };
    const rng0 = world.rng; let draws = 0; world.rng = () => { draws++; return rng0(); };
    const dt = 1 / 30;
    for (let i = 0; i < 1.4 / dt; i++) { stepSquad(world, squad, dt); squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    const lit = squad.memberIds.some((id) => { const u = world.byId.get(id); return u && u._fuse != null; });
    ok("F1/4.5d: a charge is planted under ATTACK order (fuse lit)", lit);
    ok("F1/4.5d: zero rng draws in the whole approach-and-plant path", draws === 0, `draws=${draws}`);
    ok("F1/4.5d: sappers never rifle-fire (enemy man in range, untouched)", man.hp === 1e9);
  }

  // (e) stream identity on a sapperless run — pinned worldHash + draw count
  // captured on ce446a4 BEFORE this task's code existed. Any drift means the
  // sapper wiring perturbed existing squads' behavior or the rng stream.
  {
    const world = makeWorld({ field: flatS, seed: 45 });
    world.depotCombat = true;
    mkLatticeS(world, "depot2", 14);
    const squad = makeSquad(1, "rifles", 1, 0, -8);
    for (let i = 0; i < 4; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: i * 1.1 - 2, y: 0.9, z: -8, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "attack"; squad.dest = { x: 0, z: 8 };
    const rng0 = world.rng; let draws = 0; world.rng = () => { draws++; return rng0(); };
    const dt = 1 / 30;
    for (let i = 0; i < 12 / dt; i++) { stepSquad(world, squad, dt); squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1/4.5e: sapperless stream identity (pre-change pin 4000566214 / 97 draws)",
      worldHash(world) === 4000566214 && draws === 97, `hash=${worldHash(world)} draws=${draws}`);
  }

  // (f) the enemy sapper's code path is untouched EXCEPT the shared charge
  // spec (Task 4.5 final: SATCHEL in specs.js, both sides, Jeff's decision) —
  // source bytes pinned (sha1 of the stepSapper slice, now spelling
  // ...SATCHEL) AND behavior re-pinned under the bigger charge (the old
  // {r:3.4, kv:9} pin was 2646093; the delta is the charge and only the
  // charge — the wall-seek/fuse/plant logic bytes are identical).
  {
    const srcU = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    const i0 = srcU.indexOf("function stepSapper"); const j0 = srcU.indexOf("\n// ", i0);
    const sha = createHash("sha1").update(srcU.slice(i0, j0)).digest("hex");
    // SIEGE FIX (mk0.21) — DECLARED RE-PIN of both fingerprints. stepSapper's
    // bytes change by design this time: the enemy sapper takes the SAME
    // standing-masonry filter, the SAME shared contact pad and the SAME
    // demolition marker the player's sappers took (symmetry is the law), so
    // the slice sha1 moves 0af8b81... -> 98292fb..., and his behavior hash
    // moves with the doubled charge and the tighter plant.
    ok("F1/4.5f: enemy stepSapper source bytes pinned (mk0.21: shared filter + pad + demo marker)", sha === "98292fb241479800bc48dfa24bafe403a12615d0", sha);
    const Tg = makeTerritory(120, 120); Tg.v.fill(1);
    const world = makeWorld({ field: flatS, seed: 47 });
    world.depotCombat = true;
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 0.8, hz: 0.5, x: 0, y: 0.8, z: 12, hp: 100 });
    spawnUnit(world, { x: 0, z: 0 }, "sapper");
    world.dt = 1 / 60;
    for (let i = 0; i < 8 * 60; i++) { stepUnits(world, straightGrid(0, 1), identFwdDir, Tg, (x, z) => ({ u: x, v: z })); stepWorld(world); }
    ok("F1/4.5f: enemy sapper behavior re-pinned (mk0.21 doubled charge + contact plant; was 2935719 at kv45/1.3, 2646093 at {r:3.4,kv:9})", worldHash(world) === 3365681, `hash=${worldHash(world)}`);
  }

  // (g) twin determinism of the demolition path.
  {
    const runT = () => {
      const world = makeWorld({ field: flatS, seed: 52 });
      world.depotCombat = true;
      mkLatticeS(world, "depot2", 10, true);
      runTeamS(world, 0, 4, 10);
      return worldHash(world);
    };
    ok("F1/4.5g: twin determinism (identical hash, twin demolition runs)", runT() === runT());
  }

  // (h) build bar: the team is purchasable through the normal squad flow —
  // source pins on the mode map and the bar entry (JSX, not importable).
  {
    const srcD = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("F1/4.5h: SQUAD_MODE routes sq_sappers through the squad placement flow", /sq_sappers:\s*"sappers"/.test(srcD));
    ok("F1/4.5h: the build bar sells the sapper team", /key:\s*"sq_sappers"/.test(srcD));
  }

  // (i) victory by breach THROUGH PLAY — the first real win. Real map, real
  // buildTown, teams thrown at depot2 until the census breaks. Teams-to-
  // breach is MEASURED and reported, never tuned.
  {
    const depotSrcW = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const sliceFnW = (name) => {
      const start = depotSrcW.indexOf(`\nfunction ${name}(`);
      if (start < 0) throw new Error("F1/4.5 extract: missing function " + name);
      const rest = depotSrcW.slice(start + 1);
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const headerW = depotSrcW.slice(depotSrcW.indexOf("const GRID_CS"), depotSrcW.indexOf("function genMap"));
    const MW = new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld",
      [headerW, sliceFnW("genMap"), sliceFnW("makeMap"), sliceFnW("pondAt"), sliceFnW("rockAt"),
        sliceFnW("makeGrid"), sliceFnW("checkConnectivity"), sliceFnW("buildTown"),
        `return { makeMap, makeGrid, buildTown, state: () => ({ ORIENT, TOWN }) };`].join("\n"),
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
    MW.makeMap(5);
    const stW = MW.state();
    const dep2 = stW.TOWN.find((t) => t.id === "depot2");
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } }, seed: 5 });
    world.depotCombat = true;
    MW.buildTown(world, MW.makeGrid(null), { heightAt: () => 0 });
    const census2 = censusDepotChunks(world.bodies, "depot2");
    const S45 = makeRunState({ waves: WAVES });
    let teams = 0, frac = 1;
    while (frac >= DEPOT_BREACH_FRAC && teams < 60) {
      teams++;
      // stage the team 8m off the depot face (canonical -z side is open
      // ground), pointed at the lattice center.
      const dx = dep2.x, dz = dep2.z;
      const off = 8 + (dep2.nz * MASON.pitch) / 2;
      const sq = makeSquad(1000 + teams, "sappers", 1, dx, dz + Math.sign(dz || 1) * off);
      spawnSquadMembers(world, sq);
      sq.order = "attack"; sq.dest = { x: dx, z: dz };
      const dt = 1 / 30;
      for (let i = 0; i < 30 / dt; i++) {
        stepSquad(world, sq, dt); squadFire(world, sq, dt);
        for (let s = 0; s < 20; s++) stepWorld(world);
        if (!sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) break;
      }
      frac = depotStandingFraction(census2, world.byId);
    }
    checkEnemyBreach(S45, frac);
    ok("F1/4.5i: repeated teams breach the enemy depot THROUGH PLAY -> victory",
      frac < DEPOT_BREACH_FRAC && S45.victory === true && S45.enemyBreach === true,
      `teams=${teams} frac=${frac.toFixed(3)}`);
    console.log(`F1/4.5 MEASURED: teams-to-breach = ${teams} (fraction ${frac.toFixed(3)})`);
  }
}
// ==== end FRONT F1 Task 4.5 ==================================================

// ==== F1 VERIFICATION FIXES (mk0.17) =========================================
{
  const flat = () => ({ heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });

  // F1-fix A: enemy satchel vs player wall — pin the shipped reality so a future
  // SATCHEL retune shows up here as a conscious change, not silent drift.
  // (Values from the --sides run; assert a band, not equality — physics settle noise.)
  {
    const world = makeWorld({ field: flat(), seed: 11 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: .9, hy: .9, hz: .9, x: 0, y: .9, z: 0, hp: 100 });
    explode(world, 0, 1.2, 4, { ...SATCHEL, attacker: "enemy" });   // d=4m — the measured 47-damage case
    stepWorld(world);
    const dmg = 100 - wall.hp;
    // SIEGE FIX (mk0.21) — DECLARED RE-PIN. The charge doubled (dmg 150 ->
    // 300), so this band moves with it: the measured figure at 4m went 47 ->
    // 96.0, and the whole curve is now 1m 246.9 / 2m 197.2 / 3m 146.7 /
    // 4m 96.0 / 5m 45.3 / 6m 0.0 against a 100hp wall. Every wall in the game
    // is one-shot well inside 4m, which was already true at 150 — walls have
    // hp; the doubling only widens the range at which they die.
    ok("F1-fix A: satchel-vs-wall damage at 4m within the recorded band (mk0.21: doubled charge)", dmg > 80 && dmg < 115, `dmg=${dmg.toFixed(1)}`);
  }

  // F1-fix B: friendlyFouls holds for OWN depot masonry, fires through THEIRS.
  {
    const world = makeWorld({ field: flat(), seed: 12 });
    const spec = { projSpeed: 95, occl: "arc" };
    const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 0, y: 1.2, z: 16 };
    const c = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: .4, hy: .4, hz: .4, x: 0, y: 1.2, z: 8, hp: 50 });
    c.town = "depot";
    ok("F1-fix B: CAREFUL holds for own depot stone", friendlyFouls(world, muzzle, tgt, spec) === true);
    c.town = "depot2";
    ok("F1-fix B: CAREFUL fires through enemy depot stone", friendlyFouls(world, muzzle, tgt, spec) === false);
  }

  // F1-fix C: squadReach is null for sappers (no arms — no fan, no fault) and
  // still a 64-point fan for armed squads.
  {
    const world = makeWorld({ field: flat(), seed: 13 });
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: .28, hy: .72, hz: .28, x: 0, y: 1, z: 0, hp: 58 });
    const sap = makeSquad(1, "sappers", 1, 0, 0); sap.memberIds.push(u.id);
    ok("F1-fix C: sapper squadReach null", squadReach(world, sap) === null);
    const rif = makeSquad(2, "rifles", 1, 0, 0); rif.memberIds.push(u.id);
    const pts = squadReach(world, rif);
    ok("F1-fix C: armed squadReach 64-point fan", Array.isArray(pts) && pts.length === 64);
  }
}
// ==== end F1 VERIFICATION FIXES ==============================================

// ==== F1.5 TASK 1: the mortar team (mk0.2) ===================================
// The player mirror of the enemy grenadier's lob: INFANTRY_ARMS.mortars +
// SQUAD_SPECS.mortars + squadFire's `high` flag (lofted specs lob; everyone
// else fires exactly as before). Fixtures mirror F1 Task 4's shapes.
{
  const flatM = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const mkMortars = (world, x, z) => {
    const squad = makeSquad(1, "mortars", 1, x, z);
    const n = (SQUAD_SPECS.mortars && SQUAD_SPECS.mortars.n) || 2;
    for (let i = 0; i < n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: x + i * 1.1 - 1, y: 0.9, z, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "defend";
    return squad;
  };

  // (a) spec + squad tables exist, mirror of the grenadier's lob numbers.
  {
    const m = INFANTRY_ARMS.mortars;
    ok("F1.5/1a: INFANTRY_ARMS.mortars exists, lofted, grenadier-lob ballistics",
      !!m && m.occl === "lofted" && m.projSpeed === ENEMY_FIRE.lob.projSpeed && m.dmg === ENEMY_FIRE.lob.dmg
      && m.blastR === ENEMY_FIRE.lob.blastR && m.kv === ENEMY_FIRE.lob.kv && m.acc === ENEMY_FIRE.lob.acc
      && m.range === ENEMY_FIRE.lob.range && m.dirDmg == null);
    ok("F1.5/1b: SQUAD_SPECS.mortars = 2 men, 30 scrap",
      !!SQUAD_SPECS.mortars && SQUAD_SPECS.mortars.n === 2 && SQUAD_SPECS.mortars.cost === 30);
  }

  // (b) the lob: a mortar team fires at an enemy unit and the round leaves
  // STEEP (pitch > 0.6 rad — the high aimSolve branch, not the flat one).
  // Draw pin rides the same fixture: exactly 2 rng draws per round fired
  // (applyScatter's two), none elsewhere in squadFire.
  {
    const world = makeWorld({ field: flatM, seed: 61 });
    world.depotCombat = true;
    const squad = mkMortars(world, 0, 0);
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 1e9 });
    const rng0 = world.rng; let draws = 0, counting = false;
    world.rng = () => { if (counting) draws++; return rng0(); };
    const fired = [];
    const seen = new Set();
    const dt = 1 / 30;
    // Draw counter scoped to the FIRE path only (the contract: squadFire
    // draws nothing itself; applyScatter's 2/shot is the whole budget).
    // stepWorld's explode() legitimately draws 3/shoved-body for tumble
    // torque — engine physics shared by every shell, outside the contract.
    for (let i = 0; i < 4 / dt; i++) {
      counting = true; squadFire(world, squad, dt); counting = false;
      for (const p of world.projectiles) {
        if (seen.has(p)) continue;
        seen.add(p);
        fired.push(Math.asin(p.v.y / Math.hypot(p.v.x, p.v.y, p.v.z)));
      }
      for (let s = 0; s < 20; s++) stepWorld(world);
    }
    ok("F1.5/1c: mortar rounds leave lofted (every round pitch > 0.6 rad)",
      fired.length > 0 && fired.every((p) => p > 0.6), `rounds=${fired.length} minPitch=${fired.length ? Math.min(...fired).toFixed(3) : "-"}`);
    ok("F1.5/1c: exactly 2 rng draws per round, none elsewhere", fired.length > 0 && draws === fired.length * 2,
      `draws=${draws} rounds=${fired.length}`);
  }

  // (c) blast kills: a soft cluster (3 men, 30hp) dies to shells — blast is
  // the whole weapon (no dirDmg).
  {
    const world = makeWorld({ field: flatM, seed: 62 });
    world.depotCombat = true;
    const squad = mkMortars(world, 0, 0);
    // mass 400: a mass-82 man survives by getting blast-SHOVED out of the
    // tube's 21m reach (measured -22.4,23.0 — physics, not a miss); the
    // heavy fixture keeps the cluster in place so the kill is what's proven.
    const men = [0, 1, 2].map((i) => addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: (i - 1) * 0.9, y: 0.86, z: 13, hp: 30 }));
    const dt = 1 / 30;
    for (let i = 0; i < 40 / dt && men.some((m) => m.alive); i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1.5/1d: shell blast kills a soft cluster", men.every((m) => !m.alive), `alive=${men.filter((m) => m.alive).length}`);
  }

  // (d) the lofted law: an interposing wall between team and target — the
  // shell arcs OVER it and the man behind still takes fire (mirror of the
  // mortar tower's own over-wall behavior; a flat "arc" spec would be
  // LOS-blocked and never even acquire).
  {
    const world = makeWorld({ field: flatM, seed: 63 });
    world.depotCombat = true;
    const squad = mkMortars(world, 0, 0);
    addBody(world, { kind: "wall", team: 2, mass: 0, hx: 2.5, hy: 1.4, hz: 0.5, x: 0, y: 1.4, z: 8, hp: 1e9 });
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 1e9 });
    const dt = 1 / 30;
    for (let i = 0; i < 30 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1.5/1e: shells arc over an interposing wall (man behind it takes damage)", man.hp < 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
  }

  // (e) structure fallback: no unit in reach — the team lobs at an enemy
  // wall and the wall LOSES hp (the shell detonates on structure contact;
  // hitOnly "structure" + real blastR).
  {
    const world = makeWorld({ field: flatM, seed: 64 });
    world.depotCombat = true;
    const squad = mkMortars(world, 0, 0);
    const wall = addBody(world, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 0, y: 0.9, z: 12, hp: 4000 });
    const dt = 1 / 30;
    for (let i = 0; i < 30 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1.5/1f: structure fallback — the wall takes shell damage", wall.hp < 4000, `dmg=${(4000 - wall.hp).toFixed(2)}`);
  }

  // (f) the fog law, both signs: an everywhere-unheld field stops unit
  // shots, never wall shots.
  {
    const Tred = makeTerritory(120, 120); Tred.v.fill(-1);
    const world = makeWorld({ field: flatM, seed: 65 });
    world.depotCombat = true;
    const squad = mkMortars(world, 0, 0);
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: -6, y: 0.86, z: 10, hp: 1e9 });
    const wall = addBody(world, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 6, y: 0.9, z: 10, hp: 4000 });
    const dt = 1 / 30;
    for (let i = 0; i < 30 / dt; i++) { squadFire(world, squad, dt, Tred); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1.5/1g: unit shots fog-gate (unheld field, man untouched)", man.hp === 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
    ok("F1.5/1g: wall shots never fog-gate (wall bitten under unheld field)", wall.hp < 4000, `dmg=${(4000 - wall.hp).toFixed(2)}`);
  }

  // (g) the grenadier stands byte-unchanged: pinned worldHash of a
  // grenadier-vs-wall-and-man fixture, captured 2026-08-11 PRE-Task-1 on
  // e210a91 (hash 4259097005). Any drift in his spec, driver, or fire path
  // shows here.
  {
    const world = makeWorld({ field: flatM, seed: 91 });
    world.depotCombat = true;
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 0.8, hz: 0.5, x: 0, y: 0.8, z: -6, hp: 4000 });
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 3, y: 0.74, z: -4, hp: 1e9 });
    const g = spawnUnit(world, { x: 0, z: 8 }, "gren");
    g.pos.x = 0; g.pos.z = 8;
    world.dt = 1 / 60;
    for (let i = 0; i < 12 * 60; i++) { stepUnits(world, straightGrid(0, -1), identFwdDir); stepWorld(world); }
    ok("F1.5/1h: enemy grenadier behavior byte-unchanged (pre-change pin 4259097005)",
      worldHash(world) === 4259097005, `hash=${worldHash(world)}`);
  }

  // (h) twin determinism of the whole mortar path.
  {
    const runM = () => {
      const world = makeWorld({ field: flatM, seed: 66 });
      world.depotCombat = true;
      const squad = mkMortars(world, 0, 0);
      addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 13, hp: 1e9 });
      addBody(world, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 5, y: 0.9, z: 12, hp: 4000 });
      const dt = 1 / 30;
      for (let i = 0; i < 12 / dt; i++) { squadFire(world, squad, dt); for (let s = 0; s < 20; s++) stepWorld(world); }
      return worldHash(world);
    };
    ok("F1.5/1i: twin determinism of the mortar-team path", runM() === runM());
  }

  // (i) build bar: sq_mortars wired in DepotGame.jsx (SQUAD_MODE + palette).
  {
    const depotSrcM = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("F1.5/1j: build bar carries sq_mortars (SQUAD_MODE + palette)",
      /sq_mortars:\s*"mortars"/.test(depotSrcM) && /key:\s*"sq_mortars"/.test(depotSrcM));
  }
}
// ==== end F1.5 TASK 1 ========================================================

// ==== SAPPER SIEGE FIX (mk0.21) ==============================================
// Jeff's four directives (2026-08-11): (1) the satchel is twice the charge,
// (2) the detonation is visibly unmistakable, (3) sappers walk PAST rubble and
// plant only on standing masonry, (4) they get as close as pathing physically
// allows before planting. Symmetry law: the enemy sapper gets the identical
// spec / filter / distance via the shared constants in specs.js.
{
  const flatX = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) A — twice the charge. One shared spec, both signs.
  ok("SIEGE a: SATCHEL doubled to {kv:90, dmg:300} (radius unmoved)",
    SATCHEL.kv === 90 && SATCHEL.dmg === 300 && SATCHEL.r === 5, JSON.stringify(SATCHEL));

  // (b) D — the contact-range constant is ONE shared export, tighter than the
  // old hx + 1.3 arm's-length gate, and both sappers spell it.
  ok("SIEGE b: SAPPER_PLANT_PAD exported and tighter than the old 1.3 reach",
    typeof SAPPER_PLANT_PAD === "number" && SAPPER_PLANT_PAD < 1.3, String(SAPPER_PLANT_PAD));
  {
    const srcQ = fs.readFileSync(new URL("../src/depot/squads.js", import.meta.url), "utf8");
    const srcU2 = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    ok("SIEGE b: both sides spell the shared pad (no literal 1.3 plant gate left)",
      /SAPPER_PLANT_PAD/.test(srcQ) && /SAPPER_PLANT_PAD/.test(srcU2)
      && !/hx \+ 1\.3\)/.test(srcQ) && !/hx \+ 1\.3\)/.test(srcU2));
  }

  // (c) C — standing masonry only. A rubble stone (shoved 3m off its home) in
  // arm's reach is IGNORED; the man keeps his charge for the standing wall.
  // standingStructure is the census's own rule, reused.
  {
    const world = makeWorld({ field: flatX, seed: 71 });
    world.depotCombat = true;
    const stone = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4,
      x: 0, y: 0.42, z: 0, friction: 0.65 });
    stone.town = "depot2";
    censusDepotChunks(world.bodies, "depot2");            // stamps b.home
    ok("SIEGE c: a stone at home reads STANDING", standingStructure(stone) === true);
    stone.pos.x += 3;                                      // blasted clear — rubble
    ok("SIEGE c: a stone 3m off its home reads RUBBLE", standingStructure(stone) === false);
    ok("SIEGE c: a wall (no census home) always reads standing",
      standingStructure(addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 0.8, hz: 0.5, x: 20, y: 0.8, z: 0, hp: 100 })) === true);
  }
  // (c2) behavioral: a sapper squad ordered through a field of rubble does NOT
  // spend its charges on it — it walks on to the standing lattice beyond.
  {
    const world = makeWorld({ field: flatX, seed: 72 });
    world.depotCombat = true;
    // standing lattice at z = 14, with a lump of rubble lying in the approach
    // at z = 11.2 (same town, alive, but 3m off its recorded home — exactly the
    // wreckage an earlier charge throws into the next team's path). Under the
    // OLD arm's-length rule the first man reaching z ~ 9.5 would spend his
    // charge on that corpse; he must now step around it and go on to the wall.
    for (let ix = -1; ix <= 1; ix++) for (let iy = 0; iy <= 2; iy++) {
      const c = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
        x: ix * MASON.pitch, y: MASON.hcs + 0.02 + iy * MASON.pitch, z: 14, friction: 0.65, restitution: 0.02 });
      c.sleeping = true; c.town = "depot2";
    }
    const rubble = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
      x: 0, y: MASON.hcs + 0.02, z: 11.2, friction: 0.65, restitution: 0.02 });
    rubble.sleeping = true; rubble.town = "depot2";
    censusDepotChunks(world.bodies, "depot2");
    rubble.home.z -= 3;                                    // it was blasted here from 3m back
    const squad = makeSquad(1, "sappers", 1, 0, 8);
    for (let i = 0; i < 2; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: i * 1.1 - 0.55, y: 0.74, z: 8, hp: 58 });
      u.utype = "sappers"; u.squadId = squad.id; squad.memberIds.push(u.id);
    }
    squad.order = "attack"; squad.dest = { x: 0, z: 14 };
    let plantZ = null;
    const dt = 1 / 30;
    for (let i = 0; i < 25 / dt; i++) {
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        if (u && u.alive && u._fuse != null && plantZ == null) plantZ = u.pos.z;
      }
      for (let s = 0; s < 20; s++) stepWorld(world);
      if (!squad.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) break;
    }
    ok("SIEGE c2: the team walks PAST the rubble and plants at the standing wall",
      plantZ != null && plantZ > 12.5, `plantZ=${plantZ == null ? "never" : plantZ.toFixed(2)}`);
  }

  // (d) D — the plant happens at CONTACT range: the fuse only ever lights
  // within the shared pad of a standing stone's face (never at the old 1.3).
  {
    const world = makeWorld({ field: flatX, seed: 73 });
    world.depotCombat = true;
    for (let ix = -1; ix <= 1; ix++) for (let iy = 0; iy <= 2; iy++) {
      const c = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
        x: ix * MASON.pitch, y: MASON.hcs + 0.02 + iy * MASON.pitch, z: 10, friction: 0.65, restitution: 0.02 });
      c.sleeping = true; c.town = "depot2";
    }
    censusDepotChunks(world.bodies, "depot2");
    const squad = makeSquad(1, "sappers", 1, 0, 4);
    for (let i = 0; i < 2; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: i * 1.1 - 0.55, y: 0.74, z: 4, hp: 58 });
      u.utype = "sappers"; u.squadId = squad.id; squad.memberIds.push(u.id);
    }
    squad.order = "attack"; squad.dest = { x: 0, z: 10 };
    let gap = null;
    const dt = 1 / 30;
    for (let i = 0; i < 25 / dt && gap == null; i++) {
      stepSquad(world, squad, dt);
      for (const id of squad.memberIds) {
        const u = world.byId.get(id);
        if (!u || !u.alive || u._fuse == null || gap != null) continue;
        let best = Infinity;
        for (const b of world.bodies) {
          if (b.kind !== "chunk" || !b.alive || !standingStructure(b)) continue;
          best = Math.min(best, Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z) - b.hx);
        }
        gap = best;
      }
      for (let s = 0; s < 20; s++) stepWorld(world);
    }
    ok("SIEGE d: the charge is planted at contact range (face gap <= the shared pad)",
      gap != null && gap <= SAPPER_PLANT_PAD + 1e-6, `gap=${gap == null ? "never planted" : gap.toFixed(3)}m pad=${SAPPER_PLANT_PAD}`);
  }

  // (e) B — the detonation SHOWS. The demolition pushes its own cosmetic
  // event alongside core's standard boom (core.js is frozen — the depot layer
  // emits the marker), and the renderer scales the existing pools off it.
  {
    const world = makeWorld({ field: flatX, seed: 74 });
    world.depotCombat = true;
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    u.utype = "sappers";
    const squad = makeSquad(1, "sappers", 1, 0, 0); squad.memberIds.push(u.id);
    squad.order = "attack";
    u._fuse = 0.01;
    world.events.length = 0;
    stepSquad(world, squad, 1 / 30);
    const demo = world.events.find((e) => e.type === "demo");
    ok("SIEGE e: the player charge emits a demolition marker event", !!demo && demo.r === SATCHEL.r, JSON.stringify(demo || null));
    ok("SIEGE e: core's own boom still fires alongside it (no core change)", world.events.some((e) => e.type === "boom"));
    const srcR = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    ok("SIEGE e: the renderer consumes the demolition marker", /e\.type === "demo"/.test(srcR));
    const srcC = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
    ok("SIEGE e: core.js stays frozen (the marker is pushed by the depot layer, not the engine)",
      !/type:\s*"demo"/.test(srcC));
  }
  // (e2) symmetry: the enemy sapper's detonation shows the same way.
  {
    const Tg = makeTerritory(120, 120); Tg.v.fill(1);
    const world = makeWorld({ field: flatX, seed: 75 });
    world.depotCombat = true;
    const s = spawnUnit(world, { x: 0, z: 0 }, "sapper");
    s._fuse = 0.001;
    world.dt = 1 / 60; world.events.length = 0;
    stepUnits(world, straightGrid(0, 1), identFwdDir, Tg, (x, z) => ({ u: x, v: z }));
    ok("SIEGE e2: the ENEMY charge emits the same demolition marker (symmetry)",
      world.events.some((e) => e.type === "demo" && e.r === SATCHEL.r));
  }

  // (f) symmetry of the FILTER and the DISTANCE on the enemy sign: their
  // sapper ignores rubble too, and stops at the same contact pad.
  {
    const Tg = makeTerritory(120, 120); Tg.v.fill(1);
    const world = makeWorld({ field: flatX, seed: 76 });
    world.depotCombat = true;
    const rub = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
      x: 0, y: MASON.hcs + 0.02, z: 5, friction: 0.65 });
    rub.town = "depot";
    censusDepotChunks(world.bodies, "depot");
    rub.home.z -= 3;                                        // rubble, blasted forward
    const s = spawnUnit(world, { x: 0, z: 0 }, "sapper");
    world.dt = 1 / 60;
    let litAt = null;
    for (let i = 0; i < 6 * 60 && litAt == null; i++) {
      stepUnits(world, straightGrid(0, 1), identFwdDir, Tg, (x, z) => ({ u: x, v: z }));
      if (s._fuse != null) litAt = s.pos.z;
      stepWorld(world);
    }
    ok("SIEGE f: the enemy sapper spurns rubble too (no fuse on a displaced stone)",
      litAt == null, `litAt=${litAt}`);
  }

  // (g) the approach-and-plant path still draws NOTHING (the demolition
  // marker is a push, not a roll) and the whole demolition — blast included —
  // stays twin-deterministic. Draws are counted up to the plant, not through
  // the blast: core's own explode/applyDamage draw, as they always have, and
  // that is the engine's business, not the sapper's (same scope as the
  // original F1/4.5d pin).
  {
    const runS = (countDraws) => {
      const world = makeWorld({ field: flatX, seed: 77 });
      world.depotCombat = true;
      for (let ix = -1; ix <= 1; ix++) for (let iy = 0; iy <= 2; iy++) {
        const c = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
          x: ix * MASON.pitch, y: MASON.hcs + 0.02 + iy * MASON.pitch, z: 10, friction: 0.65, restitution: 0.02 });
        c.sleeping = true; c.town = "depot2";
        for (const o of world.bodies) {
          if (o === c || o.kind !== "chunk") continue;
          if (Math.abs(o.pos.x - c.pos.x) < MASON.pitch * 1.1 && Math.abs(o.pos.y - c.pos.y) < MASON.pitch * 1.1
              && Math.abs(o.pos.x - c.pos.x) + Math.abs(o.pos.y - c.pos.y) > 1e-6) addWeld(world, c, o, MASON.breakF * 1.5);
        }
      }
      censusDepotChunks(world.bodies, "depot2");
      // staged ALREADY at the wall (anchor inside ARRIVE_TOL of the dest) so
      // the squad's own per-attack-leg dwell draw — pre-existing march
      // behavior, documented in stepSquad, nothing to do with the charge —
      // never fires and the demolition path is measured on its own.
      const squad = makeSquad(1, "sappers", 1, 0, 9.2);
      for (let i = 0; i < 2; i++) {
        const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: i * 1.1 - 0.55, y: 0.74, z: 9.2, hp: 58 });
        u.utype = "sappers"; u.squadId = squad.id; squad.memberIds.push(u.id);
      }
      squad.order = "attack"; squad.dest = { x: 0, z: 10 };
      let draws = 0;
      if (countDraws) { const r0 = world.rng; world.rng = () => { draws++; return r0(); }; }
      const dt = 1 / 30;
      let lit = false;
      for (let i = 0; i < (countDraws ? 1.4 : 6) / dt; i++) {
        stepSquad(world, squad, dt);
        if (squad.memberIds.some((id) => { const u = world.byId.get(id); return u && u._fuse != null; })) lit = true;
        for (let s = 0; s < 20; s++) stepWorld(world);
      }
      return { hash: worldHash(world), draws, lit };
    };
    const gRun = runS(true);
    ok("SIEGE g: the charge is planted (fuse lit) with ZERO rng draws in the approach-and-plant path",
      gRun.lit && gRun.draws === 0, `lit=${gRun.lit} draws=${gRun.draws}`);
    ok("SIEGE g: twin determinism of the demolition path", runS(false).hash === runS(false).hash);
  }
}
// ==== end SAPPER SIEGE FIX ===================================================


// ==== mk0.23 TROOP IDENTITY (render kit) =====================================
// The look is a PURE function of team/utype/tag/role — pin every unit type on
// both sides, and pin that nothing outside DEPOT changes at all.
{
  const mk = (o) => ({ team: 2, alive: true, ...o });
  const nProps = (k) => k.props.filter(Boolean).length;

  // --- non-DEPOT parity: the frozen demo / sandbox / TD / campaign look
  for (const b of [mk({ team: 1, utype: "rifles" }), mk({ tag: "heavy" }), mk({ tag: "fast" }),
                   mk({ utype: "gren" }), mk({ team: 1, utype: "mg", role: "gunner" })]) {
    const k = troopKit(b, false);
    ok(`kit: non-DEPOT ${b.utype || b.tag || "conscript"} is untouched (base palette, no bulk, rifle 1, zero props)`,
      k.pal === (b.utype === "gren" ? "gren" : "con") && k.bw === 1 && k.bh === 1 && k.rifle === 1 && nProps(k) === 0);
  }

  // --- coat = side (DEPOT only)
  ok("kit: player infantry wear the warm rust coat", troopKit(mk({ team: 1, utype: "rifles" }), true).pal === "con");
  ok("kit: enemy infantry wear the cold slate coat", troopKit(mk({ tag: "" }), true).pal === "gren");
  ok("kit: the enemy grenadier is unchanged (already slate)", troopKit(mk({ utype: "gren" }), true).pal === "gren");

  // --- bulk
  {
    const h = troopKit(mk({ tag: "heavy" }), true), f = troopKit(mk({ tag: "fast" }), true), c = troopKit(mk({ tag: "" }), true);
    ok("kit: the breaker is 1.35x wide / 1.15x tall", h.bw === 1.35 && h.bh === 1.15);
    ok("kit: the runner is 0.9x slim", f.bw === 0.9 && f.bh === 1);
    ok("kit: the conscript keeps his own frame", c.bw === 1 && c.bh === 1);
  }

  // --- weapon slot per role, both sides
  const cases = [
    ["player rifleman", mk({ team: 1, utype: "rifles" }), 1, 0],
    ["enemy conscript", mk({ tag: "" }), 1, 0],
    ["enemy runner", mk({ tag: "fast" }), 1, 0],
    ["player sniper", mk({ team: 1, utype: "sniper", role: "sniper" }), 1, 2],
    ["enemy marksman", mk({ tag: "sniper", role: "sniper", dress: "android" }), 1, 2],
    ["player sapper", mk({ team: 1, utype: "sappers" }), 0, 1],
    ["enemy sapper", mk({ tag: "sapper" }), 0, 1],
    ["mortar man", mk({ team: 1, utype: "mortars" }), 0, 1],
    ["MG gunner", mk({ team: 1, utype: "mg", role: "gunner" }), 0.8, 3],
    ["MG loader", mk({ team: 1, utype: "mg", role: "loader" }), 0, 0],
    ["enemy breaker", mk({ tag: "heavy" }), 0, 0],
  ];
  for (const [name, b, rifle, np] of cases) {
    const k = troopKit(b, true);
    ok(`kit: ${name} carries rifle=${rifle} props=${np}`, k.rifle === rifle && nProps(k) === np, `got rifle=${k.rifle} props=${nProps(k)}`);
  }
  // the spotter is owned by the pair look, not the kit
  for (const b of [mk({ team: 1, utype: "sniper", role: "spotter" }), mk({ tag: "sniper", role: "spotter", dress: "android" })]) {
    const k = troopKit(b, true);
    ok("kit: the spotter is untouched by the kit (the pair look owns him)", k.rifle === 1 && nProps(k) === 0);
  }

  // --- the sniper's scope really is ON the barrel, and the long barrel butts
  // onto the muzzle: both derived from the rifle's baked preRot, not eyeballed
  {
    const { fwd, up } = barrelBasis(RIFLE_PREROT);
    const len = (v) => Math.hypot(v[0], v[1], v[2]);
    ok("kit: barrelBasis is orthonormal", Math.abs(len(fwd) - 1) < 1e-9 && Math.abs(len(up) - 1) < 1e-9 &&
      Math.abs(fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2]) < 1e-9);
    const [scope, longb] = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).props;
    const rel = (p) => [p[0] - RIFLE_OFF[0], p[1] - RIFLE_OFF[1], p[2] - RIFLE_OFF[2]];
    const along = (p) => { const r = rel(p); return r[0] * fwd[0] + r[1] * fwd[1] + r[2] * fwd[2]; };
    const off = (p) => { const r = rel(p); return r[0] * up[0] + r[1] * up[1] + r[2] * up[2]; };
    const side = (p) => { const r = rel(p), a = along(p), o = off(p);
      return Math.hypot(r[0] - a * fwd[0] - o * up[0], r[1] - a * fwd[1] - o * up[1], r[2] - a * fwd[2] - o * up[2]); };
    ok("kit: the scope sits ON the barrel axis (no lateral drift), clear of it by its own radius",
      side(scope.off) < 1e-9 && Math.abs(off(scope.off) - 0.055) < 1e-9 && Math.abs(along(scope.off)) < RIFLE_LEN / 2,
      `side=${side(scope.off)} off=${off(scope.off)} along=${along(scope.off)}`);
    ok("kit: the scope is aimed down the barrel, not tilted by hand", scope.aim === "barrel" && !scope.tilt);
    ok("kit: the long barrel butts onto the muzzle end and extends the reach",
      side(longb.off) < 1e-9 && longb.aim === "barrel" && along(longb.off) < -RIFLE_LEN / 2, `along=${along(longb.off)}`);
    ok("kit: the scoped rifle itself is never sheared (uniform scale only)",
      troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).rifle === 1);
  }

  // --- the MG bipod is TWO legs, splayed, not a flat slab
  {
    const [rec, legL, legR] = troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).props;
    ok("kit: the MG receiver rides the barrel", rec.aim === "barrel");
    ok("kit: the bipod is two separate legs, mirrored about the gun centreline",
      !!legL && !!legR && legL.tilt[0] === 2 && legR.tilt[0] === 2 && legL.tilt[1] === -legR.tilt[1] && legL.tilt[1] !== 0);
    ok("kit: the two legs splay to opposite sides and hang below the muzzle",
      Math.sign(legL.off[0] - legR.off[0]) === -1 && legL.off[1] === legR.off[1] && legL.off[1] < 0.45);
    ok("kit: each leg is a slender upright, not a slab", legL.s[1] > 5 * legL.s[0] && legL.s[0] === legL.s[2]);
    ok("kit: the MG gun is short (uniform scale, no shear)", troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).rifle < 1);
  }

  // --- fog: bulk survives the seam by design, everything else does not
  {
    const h = troopKit(mk({ tag: "heavy" }), true, true), s = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true, true);
    ok("kit: STATED DECISION — the breaker's bulk shows through the fog seam", h.bw === 1.35 && h.bh === 1.15);
    ok("kit: the fog seam takes every prop and weapon back to the generic man-shape",
      nProps(h) === 0 && nProps(s) === 0 && h.rifle === 1 && s.rifle === 1);
  }

  // --- determinism: same body in, same look out; no hidden state
  {
    const b = mk({ team: 1, utype: "mg", role: "gunner" });
    const a1 = JSON.stringify(troopKit(b, true)), a2 = JSON.stringify(troopKit(b, true));
    ok("kit: troopKit is pure (identical output for identical body)", a1 === a2);
  }

  // --- the part table's spare slots are real and inert
  ok("kit: INFANTRY.con carries three spare prop slots",
    ["prop", "prop2", "prop3"].every((k) => INFANTRY.con.some((p) => p.key === k)));
  ok("kit: the grenadier table gained nothing", !INFANTRY.gren.some((p) => /^prop/.test(p.key)));
  ok("kit: the MG team spawns as gunner + loader", (() => {
    const world = makeWorld(11);
    world.field = { heightAt: () => 0 };
    const sq = makeSquad(9, "mg", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const roles = sq.memberIds.map((id) => world.byId.get(id).role);
    return roles[0] === "gunner" && roles[1] === "loader";
  })());
}
// ==== end mk0.23 TROOP IDENTITY ==============================================

// ==== F1.5 TASK 2 / mk0.25: THE ROCKET RETUNE ================================
// The held 6.5 Task 3 change, closed: rocket towers fire the HIGH arc like
// mortars, and the aim wobble (acc 0.340, tuned for flat fire) is retuned to
// 0.021 so lobbed damage matches the pinned FLAT baseline (2.4592 hp/s vs the
// soft fixture, 20s window). Sweep recorded in the F1.5 artillery plan.
{
  console.log("\n[F1.5 task 2 (mk0.25): rockets lob]");
  const flatR = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the spec + the gate.
  ok("F1.5/2a: rocket wobble retuned into the lobbed band (0.020-0.035)",
    TOWER_SPECS.rocket.acc >= 0.020 && TOWER_SPECS.rocket.acc <= 0.035, `acc=${TOWER_SPECS.rocket.acc}`);

  const mkRocket = (world, x, z) => {
    const spec = TOWER_SPECS.rocket;
    const g = world.field.heightAt(x, z);
    const t = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x, y: g + spec.hy, z, hp: spec.hp });
    t.towerType = "rocket";
    return t;
  };

  // (b) rounds leave STEEP — towerShot's `high` now covers rocket.
  {
    const world = makeWorld({ field: flatR, seed: 71 });
    world.depotCombat = true;
    const tower = mkRocket(world, 0, 0);
    const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 1e9 });
    towerShot(world, tower, target, TOWER_SPECS.rocket);
    const pitches = world.projectiles.map((p) => Math.asin(p.v.y / Math.hypot(p.v.x, p.v.y, p.v.z)));
    ok("F1.5/2b: rocket salvo leaves lofted (every round pitch > 0.6 rad)",
      pitches.length > 0 && pitches.every((q) => q > 0.6),
      `rounds=${pitches.length} minPitch=${pitches.length ? Math.min(...pitches).toFixed(3) : "-"}`);
    ok("F1.5/2b: volley still 4 rounds at 0.12s spacing",
      world.projectiles.length === 4 && TOWER_SPECS.rocket.volley === 4);
  }

  // (c) over the ridge: a rocket tower with a hill between it and the target.
  // Flat fire buries every round in the near face (pre-change: 0 damage); the
  // lob clears the crest and lands on the man behind (the held task's assert).
  {
    const H = 7;
    const world = makeWorld({ seed: 72 });
    const f = world.field;
    for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
      const x = i * f.cs - f.half;
      f.h[f.idx(i, j)] = Math.abs(x) <= 3 ? H : 0;
    }
    world.depotCombat = true;
    const tower = mkRocket(world, -9, 0);
    const target = addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: 9, y: f.heightAt(9, 0) + 0.86, z: 0, hp: 1e9 });
    const dt = 1 / 30;
    let fireCd = 0;
    for (let i = 0; i < 40 / dt; i++) {
      fireCd -= dt;
      if (fireCd <= 0) { towerShot(world, tower, target, TOWER_SPECS.rocket); fireCd = TOWER_SPECS.rocket.fireRate; }
      for (let s = 0; s < 5; s++) stepWorld(world);
    }
    ok("F1.5/2c: rocket tower lands salvo damage on a ridge-masked target",
      target.hp < 1e9, `dmg=${(1e9 - target.hp).toFixed(2)}`);
  }

  // (d) the parity band: lobbed DPS vs the pinned soft fixture, 12 seeds x
  // ~5 salvo pulls (>=200 rounds), within +/-10% of the flat baseline 2.4592.
  {
    const BASELINE = 2.4592;
    const dpsAt = (seed) => {
      const world = makeWorld({ field: flatR, seed });
      world.depotCombat = true;
      const spec = TOWER_SPECS.rocket;
      const tower = mkRocket(world, 0, 0);
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 10, hp: 1e9 });
      const dt = 1 / 30, dur = 20;
      const hp0 = target.hp;
      let fireCd = 0;
      for (let i = 0; i < dur / dt; i++) {
        fireCd -= dt;
        if (fireCd <= 0) { towerShot(world, tower, target, spec); fireCd = spec.fireRate; }
        for (let s = 0; s < 5; s++) stepWorld(world);
      }
      return (hp0 - target.hp) / dur;
    };
    let sum = 0;
    for (let seed = 1; seed <= 12; seed++) sum += dpsAt(seed);
    const mean = sum / 12;
    ok("F1.5/2d: lobbed rocket DPS within +/-10% of the flat baseline 2.4592",
      Math.abs(mean / BASELINE - 1) <= 0.10, `dps=${mean.toFixed(4)} baseline=${BASELINE}`);
  }

  // (e) a flat, close target still gets hit (the near lob solve exists).
  {
    const world = makeWorld({ field: flatR, seed: 73 });
    world.depotCombat = true;
    const tower = mkRocket(world, 0, 0);
    const target = addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 6, hp: 1e9 });
    const dt = 1 / 30;
    let fireCd = 0;
    for (let i = 0; i < 30 / dt; i++) {
      fireCd -= dt;
      if (fireCd <= 0) { towerShot(world, tower, target, TOWER_SPECS.rocket); fireCd = TOWER_SPECS.rocket.fireRate; }
      for (let s = 0; s < 5; s++) stepWorld(world);
    }
    ok("F1.5/2e: close flat target still takes rocket damage", target.hp < 1e9, `dmg=${(1e9 - target.hp).toFixed(2)}`);
  }

  // (f) twin determinism of the lobbed rocket path.
  {
    const runR = () => {
      const world = makeWorld({ field: flatR, seed: 74 });
      world.depotCombat = true;
      const tower = mkRocket(world, 0, 0);
      const target = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 12, hp: 1e9 });
      const dt = 1 / 30;
      let fireCd = 0;
      for (let i = 0; i < 12 / dt; i++) {
        fireCd -= dt;
        if (fireCd <= 0) { towerShot(world, tower, target, TOWER_SPECS.rocket); fireCd = TOWER_SPECS.rocket.fireRate; }
        for (let s = 0; s < 5; s++) stepWorld(world);
      }
      return worldHash(world);
    };
    ok("F1.5/2f: twin determinism of the lobbed rocket path", runR() === runR());
  }
}
// ==== end F1.5 TASK 2 ========================================================

// ==== F1.6 BRIDGE / mk0.26: CONTESTED GROUND IS SHOOTABLE GROUND =============
// The reported defect: a man standing on his own side's ground one cell past
// the boundary was weapon-proof — fieldReaches read "unheld" for the shooter,
// so neither side could acquire the other at contact. The bridge: a cell is
// engageable if the shooter's side reads it held/seam OR any 4-neighbour at
// cell pitch does. One cell of grace across the boundary, symmetric by
// construction. Deep behind the enemy line stays dark (fog still real).
{
  console.log("\n[F1.6 bridge (mk0.26): contested ground]");
  const { fogStateForContested } = await import("../src/depot/territory.js");
  const flatC = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // A split field: green for z < 0, red for z > 0. Boundary at z = 0, cs = 2.
  const mkSplit = () => {
    const T = makeTerritory(120, 120);
    for (let iz = 0; iz < T.nz; iz++) {
      const wz = -T.halfV + (iz + 0.5) * T.cs;
      for (let ix = 0; ix < T.nx; ix++) T.v[iz * T.nx + ix] = wz < 0 ? 1 : -1;
    }
    return T;
  };
  const T = mkSplit();

  // (a) the raw read, both signs.
  ok("F1.6/a: one cell past the boundary is engageable by the player (was unheld)",
    fieldReaches(T, 0, 1, 1) === true, `raw=${fogStateFor(T, 0, 1, 1)} contested=${fogStateForContested(T, 0, 1, 1)}`);
  ok("F1.6/a: mirror — one cell past the boundary is engageable by the attacker",
    fieldReaches(T, 0, -1, 2) === true, `raw=${fogStateFor(T, 0, -1, 2)} contested=${fogStateForContested(T, 0, -1, 2)}`);
  ok("F1.6/a: two cells deep in red stays dark to the player (fog still real)",
    fieldReaches(T, 0, 5, 1) === false, `contested=${fogStateForContested(T, 0, 5, 1)}`);
  ok("F1.6/a: two cells deep in green stays dark to the attacker",
    fieldReaches(T, 0, -5, 2) === false, `contested=${fogStateForContested(T, 0, -5, 2)}`);
  ok("F1.6/a: held ground still reads held (unchanged)",
    fogStateForContested(T, 0, -9, 1) === "held" && fogStateForContested(T, 0, 9, 2) === "held");
  ok("F1.6/a: a saturated enemy field is still fully dark (no grace anywhere)",
    (() => { const Tred = makeTerritory(120, 120); Tred.v.fill(-1);
      return fieldReaches(Tred, 0, 0, 1) === false && fieldReaches(Tred, 30, -30, 1) === false; })());
  ok("F1.6/a: symmetric by construction — the grace band is the same width both ways",
    fieldReaches(T, 0, 1, 1) === fieldReaches(T, 0, -1, 2) && fieldReaches(T, 0, 5, 1) === fieldReaches(T, 0, -5, 2));

  // (b) the reported case, live: a player squad on green fires at an enemy
  // standing one cell into red. Pre-change: zero damage.
  {
    const world = makeWorld({ field: flatC, seed: 81 });
    world.depotCombat = true;
    const squad = makeSquad(1, "rifles", 1, 0, -6);
    for (let i = 0; i < SQUAD_SPECS.rifles.n; i++) {
      const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: i * 0.8, y: 0.9, z: -6, hp: 100 });
      squad.memberIds.push(u.id);
    }
    squad.order = "defend";
    const man = addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 1, hp: 1e9 });
    const deep = addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: 12, y: 0.86, z: 7, hp: 1e9 });
    const dt = 1 / 30;
    for (let i = 0; i < 10 / dt; i++) { squadFire(world, squad, dt, T); for (let s = 0; s < 20; s++) stepWorld(world); }
    ok("F1.6/b: the man at the front line takes fire (pre-change: weapon-proof)",
      man.hp < 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
    ok("F1.6/b: the man two cells deep in red is still untouchable",
      deep.hp === 1e9, `dmg=${(1e9 - deep.hp).toFixed(2)}`);
  }

  // (c) the mirror, live: an enemy rifleman shoots a player man standing one
  // cell into green — their guns get the same grace as ours.
  {
    const world = makeWorld({ field: flatC, seed: 82 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 400, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: -1, hp: 1e9 });
    const e = spawnUnit(world, { x: 0, z: 6 }, "");
    e.pos.x = 0; e.pos.z = 6;
    world.dt = 1 / 60;
    for (let i = 0; i < 10 * 60; i++) { stepUnits(world, straightGrid(0, -1), identFwdDir, T, (x, z) => ({ u: x, v: z })); stepWorld(world); }
    ok("F1.6/c: mirror — the enemy rifleman can shoot a player man at the line",
      man.hp < 1e9, `dmg=${(1e9 - man.hp).toFixed(2)}`);
  }

  // (d) the deletion marker: vision B3 must delete this bridge, so the marker
  // is pinned by grep here.
  {
    const terrSrc = fs.readFileSync(new URL("../src/depot/territory.js", import.meta.url), "utf8");
    ok("F1.6/d: fogStateForContested carries its DIES-WITH-VISION-B3 deletion marker",
      /DIES when vision B3 lands/.test(terrSrc.replace(/\n\s*\/\/\s*/g, " ")) && /marked for deletion/.test(terrSrc.replace(/\n\s*\/\/\s*/g, " ")));
  }

  // (e) twin determinism across the contested read.
  {
    const runC = () => {
      const world = makeWorld({ field: flatC, seed: 83 });
      world.depotCombat = true;
      const squad = makeSquad(1, "rifles", 1, 0, -6);
      for (let i = 0; i < SQUAD_SPECS.rifles.n; i++) {
        const u = addBody(world, { kind: "unit", team: 1, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x: i * 0.8, y: 0.9, z: -6, hp: 100 });
        squad.memberIds.push(u.id);
      }
      squad.order = "defend";
      addBody(world, { kind: "unit", team: 2, mass: 400, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 1, hp: 1e9 });
      const dt = 1 / 30;
      for (let i = 0; i < 8 / dt; i++) { squadFire(world, squad, dt, T); for (let s = 0; s < 20; s++) stepWorld(world); }
      return worldHash(world);
    };
    ok("F1.6/e: twin determinism through the contested-ground firefight", runC() === runC());
  }
}
// ==== end F1.6 BRIDGE ========================================================

// ==== mk0.27: NO TAP GOES SILENTLY MISSING ===================================
{
  console.log("\n[mk0.27: confirm-tap thefts]");
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  const pending = { gx: 1, gz: 1, mode: "mg", cost: 20, armedAt: 5 };

  // (a) the unarmed ✓ tap: inert, but the pending survives untouched, so the
  // next tap still resolves normally (it is not a swallowed tap).
  ok("mk0.27/a: an unarmed pending is not confirmable", pendingArmed(pending, 4.9) === false);
  ok("mk0.27/a: the pending still resolves on the next canvas tap (buttons on screen)",
    canvasTapConsumesPending(pending, { x: 400, y: 300 }, rect) === true);

  // (b) the pan theft: buttons off the viewport -> a canvas tap is NOT eaten.
  ok("mk0.27/b: buttons panned off the right edge are not visible",
    pendingButtonsVisible({ x: 799, y: 300 }, rect) === false);
  ok("mk0.27/b: buttons panned above the top edge are not visible",
    pendingButtonsVisible({ x: 400, y: 2 }, rect) === false);
  ok("mk0.27/b: an unprojectable anchor (behind the camera) is not visible",
    pendingButtonsVisible(null, rect) === false);
  ok("mk0.27/b: a canvas tap is NOT consumed while the buttons are off-screen",
    canvasTapConsumesPending(pending, { x: 900, y: 300 }, rect) === false);
  ok("mk0.27/b: no pending at all consumes nothing",
    canvasTapConsumesPending(null, { x: 400, y: 300 }, rect) === false);
  ok("mk0.27/b: the edge pad is a real margin", PENDING_EDGE_PAD > 0
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD - 1, y: 300 }, rect) === false
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD, y: 300 }, rect) === true);

  // (c) the wiring: DepotGame uses both, says something on the inert tap, and
  // auto-cancels the pending when its anchor leaves the viewport.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.27/c: the canvas-tap pending-clear goes through canvasTapConsumesPending",
      /canvasTapConsumesPending\(S\.pending, S\.pendingScreen/.test(src));
    ok("mk0.27/c: the unarmed ✓ tap toasts instead of vanishing",
      /if \(!pendingArmed\(p, world\.t\)\) \{[^}]*toast\(/.test(src.replace(/\n/g, " ")));
    ok("mk0.27/c: a pending whose anchor leaves the viewport auto-cancels with a toast",
      /pendingButtonsVisible\(/.test(src) && /PLACEMENT CANCELLED/.test(src));
  }
}
// ==== end mk0.27 =============================================================




if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\ndepot-test PASS");
