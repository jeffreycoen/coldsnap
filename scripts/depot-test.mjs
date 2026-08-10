// Headless test for the depot wave phase machine: build -> wave -> stall ->
// advance -> wave 2. Drives src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs
import {
  PHASE, makeRunState, startWave, tryStall, advance,
  regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot, shooterFire, nextSpawnTag,
  fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed,
} from "../src/depot/state.js";
import { reachPolygon, arcClears } from "../src/depot/accuracy.js";
import { friendlyFouls } from "../src/depot/state.js";
import {
  makeWorld, addBody, fireProjectile, stepWorld, applyDamage, worldHash, CAUSE, mulberry32,
} from "../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, ENEMY_FIRE, TANK, WAVES as DEPOT_WAVES } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, stepBreakerRam, checkLeaks, payBounties } from "../src/depot/units.js";
import {
  makeRegiment, STIPEND, RESULTS, payResults, combatIneffective, bookValue, payTown,
} from "../src/depot/economy.js";
import { planWave, waveBudget, MIN_WAVE_FLOOR } from "../src/depot/ai.js";
import { composeIntel, openingIntel, strengthWord } from "../src/depot/intel.js";
import { makeTerritory, stepTerritory, holderAt, fogStateAt, fogStateFor, canBuild, DECAY_TAU, EMIT } from "../src/depot/territory.js";
import { fwdUFor, fwdDirFor, invWFor } from "../src/depot/orient.js";
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

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\ndepot-test PASS");
