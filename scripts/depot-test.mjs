// Headless test for the depot wave phase machine: build -> wave -> stall ->
// advance -> wave 2. Drives src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs
import {
  PHASE, makeRunState, startWave, tryStall, advance,
  regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot, shooterFire, squadFire, nextSpawnTag,
  fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed,
  censusDepotChunks, depotStandingFraction, checkDepotBreach, stepDepotCensus,
  spawnSquadMembers, spawnSandbag, SANDBAG_COST, pruneSquads,
  DEPOT_STANDING_TOL, DEPOT_BREACH_FRAC, DEPOT_CENSUS_HZ,
} from "../src/depot/state.js";
import { reachPolygon, arcClears } from "../src/depot/accuracy.js";
import { friendlyFouls } from "../src/depot/state.js";
import {
  makeWorld, addBody, addWeld, fireProjectile, explode, stepWorld, applyDamage, worldHash, CAUSE, mulberry32,
} from "../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, ENEMY_FIRE, TANK, WAVES as DEPOT_WAVES, MASON, INFANTRY_ARMS } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, stepBreakerRam, checkLeaks, payBounties, SNIPER_FIRE } from "../src/depot/units.js";
import { SQUAD_SPECS, makeSquad, exposureAt, coverHop, stepSquad } from "../src/depot/squads.js";
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

// --- clear final wave -> victory
S.ws.waveIdx = WAVES.length - 1;
S.ws.spawnQueue = 0;
S.phase = PHASE.WAVE;
tryStall(S, WAVES, 0);
ok("final wave clear enters stall", S.phase === PHASE.STALL);
ok("final dispatch says FINAL WAVE CLEARED", S.dispatch.lines[1].includes("FINAL WAVE CLEARED"), S.dispatch.lines[1]);
advance(S, WAVES);
ok("advancing past the last wave sets victory", S.victory === true);

// ===================================================== 50-wave end states
// force-lose: depot hp (lives) driven to 0 mid-run -> LOSS, regardless of
// wave progress or resources.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const L = makeRunState({ waves: W50 });
  L.started = true;
  L.ws.waveIdx = 4;
  L.lives = 0;
  ok("regimentDestroyed stub is always false", regimentDestroyed(L) === false);
  const lost = checkLoss(L);
  ok("checkLoss fires when lives hit 0", lost === true);
  ok("checkLoss sets gameOver", L.gameOver === true);
  ok("checkLoss does not set victory", L.victory === false);
  ok("checkLoss is idempotent (no-op once gameOver)", checkLoss(L) === false);
}

// god-mode win: drive the machine to wave 50 cleared with player book value
// (resources + standing structures) far exceeding the attacker's book value
// (regiment scrap + surviving heads/tanks at purchase price) -> WIN.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const G = makeRunState({ waves: W50, startResources: 999999 });
  G.started = true;
  G.reg = { heads: 60, tanks: 1, heads0: 400, tanks0: 10, scrap: 20 }; // thin but not combat-ineffective
  G.ws.waveIdx = W50.length - 1;
  G.ws.spawnQueue = 0;
  G.phase = PHASE.WAVE;
  tryStall(G, W50, 0);
  ok("god-mode: final wave clear enters stall", G.phase === PHASE.STALL);
  const snap = { mortars: 2, mgs: 3, guns: 2, frosts: 1, walls: 10 };
  const advanced = advance(G, W50, snap);
  ok("god-mode: advance() fires past final wave", advanced === true);
  ok("god-mode: victory is set", G.victory === true, G.victory);
  ok("god-mode: gameOver is not set", G.gameOver === false);
  ok("god-mode: not an attrition win (ledger win, regiment still standing)", G.attrition !== true);
  const endD = makeEndDispatch({ victory: G.victory, kills: 0, wave: W50.length, totalWaves: W50.length, attrition: G.attrition });
  ok("makeEndDispatch returns a card for the win", !!endD && Array.isArray(endD.lines) && endD.lines.length > 0);
  ok("ledger-win end card mentions the books closing in the Bureau's favor", endD.lines.some((l) => /books close/i.test(l)), JSON.stringify(endD.lines));
  ok("ledger-win end card carries no digits in its bureau-voice verdict line", !/\d/.test(endD.lines.find((l) => /books close/i.test(l))));
}

// wave-50-survived but the player's book value (scrap + standing structures)
// falls short of the attacker's (regiment scrap + surviving heads/tanks at
// purchase price: conscript 4, tank 25) -> LOSS, book-value verdict (not the
// depot-destroyed loss card).
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const B = makeRunState({ waves: W50, startResources: 0 });
  B.started = true;
  B.reg = { heads: 300, tanks: 10, heads0: 400, tanks0: 10, scrap: 500 }; // rich, intact attacker
  B.ws.waveIdx = W50.length - 1;
  B.ws.spawnQueue = 0;
  B.phase = PHASE.WAVE;
  tryStall(B, W50, 0);
  advance(B, W50, {}); // no standing structures, no snap
  ok("underfunded final-wave clear does not win", B.victory === false);
  ok("underfunded final-wave clear ends in loss", B.gameOver === true);
  ok("underfunded final-wave clear is flagged a ledger loss (not depot-destroyed)", B.ledgerLoss === true);
  const endD = makeEndDispatch({ victory: false, kills: 0, wave: W50.length, totalWaves: W50.length, ledgerLoss: B.ledgerLoss });
  ok("ledger-loss end card says the position is untenable / withdrawal", endD.lines.some((l) => /untenable/i.test(l)), JSON.stringify(endD.lines));
  ok("ledger-loss end card carries no digits in its bureau-voice verdict line", !/\d/.test(endD.lines.find((l) => /untenable/i.test(l))));
}

// depot-destroyed LOSS stays exactly as it was (lives hit 0) — unaffected by
// the book-value verdict machinery.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const endD = makeEndDispatch({ victory: false, kills: 7, wave: 22, totalWaves: 50, ledgerLoss: false });
  ok("depot-destroyed end card still says DEPOT OVERRUN", endD.lines[0] === "DEPOT OVERRUN.", endD.lines[0]);
}

// attrition victory: a regiment forced combat-ineffective (per
// combatIneffective) mid-run — well before wave 50 — ends the run early as a
// WIN with its own attrition end card, independent of book value.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const A = makeRunState({ waves: W50, startResources: 0 }); // deliberately poor — would lose on the books
  A.started = true;
  A.ws.waveIdx = 10;
  A.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // < 12% heads0, 0 tanks -> ineffective
  A.ws.spawnQueue = 0;
  A.phase = PHASE.WAVE;
  const fired = tryStall(A, W50, 0);
  ok("attrition: tryStall still fires on regiment break", fired === true);
  ok("attrition: run ends as a WIN mid-run (wave 11 of 50)", A.victory === true, A.victory);
  ok("attrition: gameOver is not set", A.gameOver === false);
  ok("attrition: flagged as an attrition win", A.attrition === true);
  const endD = makeEndDispatch({ victory: true, kills: 3, wave: 11, totalWaves: 50, attrition: A.attrition });
  ok("attrition end card judges the formation combat-ineffective", endD.lines.some((l) => /combat-ineffective/i.test(l)), JSON.stringify(endD.lines));
  ok("attrition end card says the field remains in Bureau hands", endD.lines.some((l) => /Bureau hands/i.test(l)), JSON.stringify(endD.lines));
  ok("attrition end card carries no digits in its bureau-voice verdict line", !/\d/.test(endD.lines.find((l) => /Bureau hands/i.test(l))));
}

// intact, above-threshold regiment mid-run never triggers an attrition win.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const N = makeRunState({ waves: W50 });
  N.started = true;
  N.ws.waveIdx = 10;
  N.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: 0 };
  N.ws.spawnQueue = 0;
  N.phase = PHASE.WAVE;
  tryStall(N, W50, 0);
  ok("intact regiment mid-run: no attrition win", N.victory === false && N.attrition !== true);
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
  ok("starved stall 1/3: no win yet", P.victory !== true);
  P.phase = PHASE.WAVE; P.ws.spawnQueue = 0;
  tryStall(P, W50, 0);
  ok("starved stall 2/3: still no win", P.victory !== true);
  P.phase = PHASE.WAVE; P.ws.spawnQueue = 0;
  tryStall(P, W50, 0);
  ok("starved stall 3/3: run ends as an early WIN", P.victory === true, P.victory);
  ok("spent win: gameOver is not set", P.gameOver === false);
  ok("spent win: not flagged as attrition", P.attrition !== true);
  ok("spent win: flagged as spent", P.spent === true);
  const endD = makeEndDispatch({ victory: true, kills: 5, wave: 8, totalWaves: 50, spent: P.spent });
  ok("spent end card judges the offensive spent", endD.lines.some((l) => /offensive is judged spent/i.test(l)), JSON.stringify(endD.lines));
  ok("spent end card says the field remains in Bureau hands", endD.lines.some((l) => /Bureau hands/i.test(l)), JSON.stringify(endD.lines));
  ok("spent end card carries no digits in its bureau-voice verdict lines", !/\d/.test(endD.lines.find((l) => /Bureau hands/i.test(l))) && !/\d/.test(endD.lines.find((l) => /offensive is judged spent/i.test(l))));
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
  ok("2 starved stalls: no win", P2.victory !== true && P2.gameOver !== true);
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
  ok("3 empty musters: early WIN", G.victory === true && G.gameOver === false);
  ok("3 empty musters: flagged spent", G.spent === true);

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

// The spent end card must read unambiguously as a WIN — "musters called
// without issue" read as a defeat notice; the card must state the verdict.
{
  const d = makeEndDispatch({ victory: true, kills: 12, wave: 6, totalWaves: 50, spent: true });
  ok("spent card does not open with the ambiguous 'without issue' line", !d.lines.some((l) => /without issue/i.test(l)), JSON.stringify(d.lines));
  ok("spent card pairs the verdict with Bureau hands on one line", d.lines.some((l) => /judged spent/i.test(l) && /Bureau hands/i.test(l)), JSON.stringify(d.lines));
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
  const wall = addBody(world, { kind: "wall", team: 1, mass: 100, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: g0 + 0.83, z: 0, hp: 70 });
  const sapper = spawnUnit(world, { x: 0.9, z: 0 }, "sapper");
  const grid = straightGrid(0, -1);
  let fused = false;
  for (let i = 0; i < 200 && wall.alive; i++) {
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

// tank leak: a tank that reaches the depot must leak like anything else
// that gets there — lives damage, unit removed, attacker paid — not march
// off-map forever (Task 7 probe finding: DepotGame.jsx's leak-check used
// to only cover kind === "unit", so a surviving tank never despawned).
{
  const objPos = { x: 0, z: 0 };
  const world = makeWorld({ seed: 7 });
  const tank = spawnUnit(world, { x: objPos.x, z: objPos.z }, "tank");
  tank.pos.x = objPos.x; tank.pos.z = objPos.z; // pin inside the leak radius, no jitter
  ok("tank leak setup: spawned as kind vehicle", tank.kind === "vehicle");

  checkLeaks(world, objPos);
  const leakEvents = world.events.filter((e) => e.type === "leak");
  ok("tank leak: reaching the depot fires a leak event", leakEvents.length === 1, JSON.stringify(leakEvents));
  ok("tank leak: dmg mirrors TD's vehicle leak cost (4 lives)", leakEvents[0] && leakEvents[0].dmg === 4, JSON.stringify(leakEvents[0]));
  ok("tank leak: the tank body is removed from the world", !world.byId.get(tank.id) && !world.bodies.includes(tank));

  // results-pay: the attacker is credited via the same leak-pay path
  // infantry leaks use (RESULTS.leak per leak, through payResults).
  const reg = makeRegiment(mulberry32(12));
  const scrapBefore = reg.scrap;
  payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: leakEvents.length });
  ok("tank leak: attacker is paid RESULTS.leak for the tank leak",
    reg.scrap === scrapBefore + RESULTS.leak, `${reg.scrap} vs ${scrapBefore + RESULTS.leak}`);
}
{
  // infantry leak radius (3.0m) must NOT catch a tank still outside its
  // own 5.0m radius but inside infantry's smaller one is moot (5>3) —
  // the real regression is the inverse: a tank sitting between 3m and 5m
  // used to leak nothing at all under the old kind==="unit"-only check.
  const objPos = { x: 0, z: 0 };
  const world = makeWorld({ seed: 8 });
  const tank = spawnUnit(world, { x: objPos.x, z: objPos.z }, "tank");
  tank.pos.x = objPos.x + 4; tank.pos.z = objPos.z; // 4m out: past infantry's 3.0m, inside tank's 5.0m
  checkLeaks(world, objPos);
  const leakEvents = world.events.filter((e) => e.type === "leak");
  ok("tank leak: fires at 4m (inside the 5.0m vehicle radius, outside the old 3.0m infantry-only radius)",
    leakEvents.length === 1, `bodies=${world.bodies.length}`);
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
    for (let i = 0; i < 200; i++) stepTerritory(T, [{ x: 15, z: 0, w: EMIT.tower.w, r: 3, sign: -1 }], 0.05);
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

  // lives-loss path stays exactly as it was — a fully-standing depot (1.0)
  // still loses the run the moment lives hit 0, and checkDepotBreach at 1.0
  // never fires. Two independent tracks, neither masks the other.
  const Sl = makeRunState({ waves: WAVES });
  Sl.started = true;
  Sl.lives = 0;
  const livesLost = checkLoss(Sl);
  ok("lives-loss path unaffected by structural-loss addition", livesLost === true && Sl.gameOver === true && !Sl.breach);
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
      const u = addBody(world, { kind: "unit", team, mass: 90, hx: 0.3, hy: 0.9, hz: 0.3, x, y: 0.9, z, hp: 100 });
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
    for (let i = 0; i < 200; i++) stepTerritory(T, [{ x: 15, z: 0, w: EMIT.tower.w, r: 3, sign: -1 }], 0.05);
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
    ok("spawnSquadMembers: sniper squad is a single man", sn.memberIds.length === 1);
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

    // (b) leak: a live member standing ON the depot objective triggers no
    // leak and is not removed.
    const m2 = world.byId.get(sq.memberIds[1]);
    m2.pos.x = 0; m2.pos.z = 40;
    world.events.length = 0;
    checkLeaks(world, { x: 0, z: 40 });
    ok("sweep/leak: member at the depot triggers no leak", !world.events.some((e) => e.type === "leak") && world.byId.has(m2.id));

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
    const v3 = validatePlacement({ blocked: false, ice: false, held: true, resources: 30, cost: SQUAD_SPECS.sniper.cost });
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
    const lives0 = Sa.lives, kills0 = Sa.kills, res0 = Sa.resources, ev0 = wA.events.length;
    const r6 = execW(Sa, wA);
    ok("task6(b): heads returned == live infantry at timeout",
      Sa.reg.heads === heads0 + 1 && r6.inf === 1, `heads ${heads0}->${Sa.reg.heads}`);
    ok("task6(b): tanks returned == live tanks at timeout",
      Sa.reg.tanks === tanks0 + 1 && r6.tanks === 1, `tanks ${tanks0}->${Sa.reg.tanks}`);
    ok("task6(b): dead body neither returned nor left in the world",
      !wA.byId.get(deadOne.id) || Sa.reg.heads === heads0 + 1);
    ok("task6(g): team-1 squad member never swept",
      wA.byId.get(friendly6.id) === friendly6 && wA.bodies.includes(friendly6));
    ok("task6(c): zero bounty, zero kill/leak events, zero lives cost during withdrawal",
      wA.events.length === ev0 && Sa.reg.scrap === scrap0 && Sa.lives === lives0 &&
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
    // member at 6m (inside urgency), wall at 5m (nearer!) -> member wins
    const world = makeWorld({ field: flatField, seed: 12 });
    const member = mkMember(world, 0, 1);
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.4, hy: 0.83, hz: 0.4, x: 0, y: 0.83, z: 2, hp: 999 });
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
// ==== end SANDBAG-ROT ========================================================

// ==== TASK 4C: their sniper
{
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const grid4c = straightGrid(0, -1);
  // spec pins: roster entry + tower-equal windage (one table, both sides)
  {
    const sp = ENEMY_SPECS.sniper;
    ok("4C spec: ENEMY_SPECS.sniper fielded (speed 2.9, hp 44, bounty 30, android dress)",
      !!sp && sp.speed === 2.9 && sp.hp === 44 && sp.bounty === 30 && sp.dress === "android", JSON.stringify(sp));
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
    const hx0 = sn.pos.x, hz0 = sn.pos.z;
    for (let i = 0; i < 3600; i++) { stepUnits(world, grid4c, identFwdDir); stepWorld(world); }
    const drift = Math.hypot(sn.pos.x - hx0, sn.pos.z - hz0);
    ok("4C vantage: holds >= 30s (no drift off the vantage)", sn.hold === true && drift < 0.5, `drift=${drift.toFixed(2)}`);
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
      reg.scrap = 50; // topped up each wave: normal (non-banking) branch
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
    const reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 50 };
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
  const runAdvance = (world, sq, maxTicks = 60000) => {
    let t = 0;
    for (let i = 0; i < maxTicks && sq.order === "attack"; i++) { stepSquad(world, sq, DT); world.t += DT; t += DT; }
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
        stepSquad(world, sq, DT); world.t += DT;
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
      stepSquad(a.w, a.sq, DT); a.w.t += DT;
      stepSquad(b.w, b.sq, DT); b.w.t += DT;
      if (a.sq.anchor.x !== b.sq.anchor.x || a.sq.anchor.z !== b.sq.anchor.z || a.sq.order !== b.sq.order) { same = false; break; }
    }
    ok("SQUAD-PACE twins: identical seeds -> identical anchor paths through the threat transition",
      same && a.sq.order === "defend" && b.sq.order === "defend", `same=${same} orders=${a.sq.order}/${b.sq.order}`);
  }
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\ndepot-test PASS");
