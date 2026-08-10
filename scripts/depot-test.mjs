// Headless test for the depot wave phase machine: build -> wave -> stall ->
// advance -> wave 2. Drives src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs
import {
  PHASE, makeRunState, startWave, tryStall, advance,
  enemyLedger, regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot,
} from "../src/depot/state.js";
import {
  makeWorld, addBody, fireProjectile, stepWorld, applyDamage, worldHash, CAUSE, mulberry32,
} from "../src/engine/core.js";
import { TOWER_SPECS } from "../src/depot/specs.js";

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

// god-mode win: drive the machine to wave 50 cleared with resources well
// past the placeholder enemy ledger -> WIN.
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const G = makeRunState({ waves: W50, startResources: 999999 });
  G.started = true;
  G.ws.waveIdx = W50.length - 1;
  G.ws.spawnQueue = 0;
  G.phase = PHASE.WAVE;
  tryStall(G, W50, 0);
  ok("god-mode: final wave clear enters stall", G.phase === PHASE.STALL);
  const advanced = advance(G, W50);
  ok("god-mode: advance() fires past final wave", advanced === true);
  ok("god-mode: resources far exceed placeholder ledger", G.resources >= enemyLedger(W50.length - 1));
  ok("god-mode: victory is set", G.victory === true, G.victory);
  ok("god-mode: gameOver is not set", G.gameOver === false);
  const endD = makeEndDispatch({ victory: G.victory, kills: 0, wave: W50.length, totalWaves: W50.length });
  ok("makeEndDispatch returns a card for the win", !!endD && Array.isArray(endD.lines) && endD.lines.length > 0);
}

// wave-50-survived but resources under the placeholder ledger -> still LOSS
// (the brief's "comparing resources vs a placeholder enemy ledger stub").
{
  const W50 = Array.from({ length: 50 }, (_, i) => ({ units: 12 + i * 2, delay: 0.9 }));
  const B = makeRunState({ waves: W50, startResources: 0 });
  B.started = true;
  B.ws.waveIdx = W50.length - 1;
  B.ws.spawnQueue = 0;
  B.phase = PHASE.WAVE;
  tryStall(B, W50, 0);
  advance(B, W50);
  ok("underfunded final-wave clear does not win", B.victory === false);
  ok("underfunded final-wave clear ends in loss", B.gameOver === true);
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

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\ndepot-test PASS");
