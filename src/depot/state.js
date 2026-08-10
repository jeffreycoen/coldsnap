// COLDSNAP DEPOT — run state shape. Kept tiny and dependency-free so
// DepotGame.jsx's loop can stuff a plain object in a ref (React state must
// never be read from the closure — see ColdsnapTD.jsx for why).
import { aimSolve, fireProjectile } from "../engine/core.js";
import { scatterSigma, applyScatter } from "./accuracy.js";

export const PHASE = { BUILD: "build", WAVE: "wave", STALL: "stall" };

// One tower trigger pull: 2-pass lead solve against `target`'s velocity,
// then fire spec.volley (or 1) shots. sigma is computed once per pull from
// the led aim point (spec.acc, range/elevation/graze) and applied per shot
// via applyScatter — conditional accuracy, not a flat volley spread.
// Extracted out of DepotGame.jsx's stepTowers so it's reachable headless
// (that file is JSX; this one is plain JS, already imported by tests).
export function towerShot(world, tower, target, spec) {
  const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
  const high = tower.towerType === "mortar";
  let ax2 = target.pos.x, az2 = target.pos.z, ay2 = target.pos.y;
  for (let li = 0; li < 2; li++) {
    const ld = Math.max(2, Math.hypot(ax2 - muzzle.x, az2 - muzzle.z));
    const lp = aimSolve(spec.projSpeed, ld, ay2 - muzzle.y, 9.8, high);
    if (lp == null) break;
    const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
    ax2 = target.pos.x + target.v.x * tof;
    az2 = target.pos.z + target.v.z * tof;
    ay2 = world.field.heightAt(ax2, az2) + target.hy;
  }
  const dx = ax2 - muzzle.x, dz = az2 - muzzle.z, dy = ay2 - muzzle.y;
  const sigma = scatterSigma(world, muzzle, { x: ax2, y: ay2, z: az2 }, spec);
  const d = Math.max(2, Math.hypot(dx, dz));
  let pitch = aimSolve(spec.projSpeed, d, dy, 9.8, high);
  if (pitch == null) pitch = high ? 1.1 : 0.45;
  const rawDir = { x: (dx / d) * Math.cos(pitch), y: Math.sin(pitch), z: (dz / d) * Math.cos(pitch) };
  const shots = spec.volley || 1;
  for (let si = 0; si < shots; si++) {
    const dir = applyScatter(world, rawDir, sigma);
    fireProjectile(world, { x: muzzle.x, y: muzzle.y + si * 0.28, z: muzzle.z }, dir, spec.projSpeed,
      { kind: spec.kind, r: spec.blastR, kv: spec.kv, dmg: spec.dmg, crater: spec.crater, noImpact: true, attacker: "player", delay: si * 0.12 });
  }
}

export function makeWaveState() {
  return { waveIdx: 0, spawnQueue: 0, spawnTimer: 0, spawnDelay: 1, active: false, betweenWaves: true, countdown: 8 };
}

export function makeRunState({ waves, startResources = 120, startLives = 20 }) {
  return {
    resources: startResources, lives: startLives, kills: 0,
    ws: makeWaveState(), spawnRR: 0,
    mode: "wall", sellMode: false, inspectId: null,
    started: false, gameOver: false, victory: false,
    paused: false, speed: 1,
    phase: PHASE.BUILD,
    dispatch: null, lastDispatch: null,
    totalWaves: waves.length,
    zoom: 1, acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
    hover: null, pointer: null, toasts: [],
    hudT: 0, keys: {}, sellById: null,
  };
}

// Bureau placeholder copy for the between-wave stall card. Pure + deterministic
// (no RNG — depot-lint forbids it) — waveIdx is the index of the wave that
// just died, totalWaves is WAVES.length.
export function makeDispatch(waveIdx, totalWaves) {
  const wo = "WO-" + String(1000 + waveIdx).padStart(4, "0");
  const next = waveIdx + 2;
  return {
    wo,
    lines: [
      `WAVE ${waveIdx + 1} CLEARED. HOLD.`,
      next <= totalWaves ? `RESUPPLY INBOUND — WAVE ${next} OF ${totalWaves}.` : "FINAL WAVE CLEARED.",
      "ACKNOWLEDGE TO CONTINUE.",
    ],
  };
}

// Placeholder enemy economic ledger — Phase 3 replaces this with the real
// enemy economy. Climbs linearly with wave index so the final-wave victory
// check has a non-trivial comparison until then. Pure, no RNG.
export function enemyLedger(waveIdx) {
  return 80 + waveIdx * 14;
}

// Stub alternate loss condition — a future phase adds a regiment (a
// player-side unit group) that can be wiped out mid-run. Always false for
// now; the hook exists so callers already check it.
export function regimentDestroyed(S) {
  return false;
}

// The single place a run flips to LOSS: depot destroyed (lives <= 0) or the
// stubbed regiment-destroyed hook. Idempotent — no-ops once the run has
// already ended. Headless-testable, called from DepotGame.jsx's frame loop.
export function checkLoss(S) {
  if (S.gameOver || S.victory) return false;
  if (S.lives <= 0 || regimentDestroyed(S)) {
    S.lives = Math.max(0, S.lives);
    S.gameOver = true;
    return true;
  }
  return false;
}

// The single place a run flips to WIN: called once the final wave clears.
// Compares current resources against the placeholder enemy ledger (real
// economy arrives Phase 3) — falling short still ends the run, but as a
// LOSS rather than a WIN.
export function checkWin(S, WAVES) {
  const ledger = enemyLedger(WAVES.length - 1);
  if (S.resources >= ledger) {
    S.victory = true;
  } else {
    S.gameOver = true;
  }
  return S.victory;
}

// End-of-run dispatch copy — same teletyped card style as the between-wave
// stall dispatch, reused for the WIN/LOSS end card. Pure + deterministic.
export function makeEndDispatch({ victory, kills, wave, totalWaves }) {
  const wo = "WO-9999";
  if (victory) {
    return {
      wo,
      lines: [
        "FINAL WAVE CLEARED.",
        "THE DEPOT HOLDS.",
        `${kills} CONFIRMED. FIELD ORDER CLOSED.`,
      ],
    };
  }
  return {
    wo,
    lines: [
      "DEPOT OVERRUN.",
      `LOST AT WAVE ${wave} OF ${totalWaves}.`,
      `${kills} CONFIRMED BEFORE THE LINE BROKE.`,
    ],
  };
}

// Phase machine — the single source of truth for build/wave/stall transitions.
// Kept dependency-free (no world/render refs) so it is headless-testable from
// scripts/depot-test.mjs and so DepotGame.jsx's frame loop and the offline
// test drive the exact same code path.

// Begin spawning the next queued wave. Caller (DepotGame) is responsible for
// any presentation side effects (toasts) — this only mutates state.
export function startWave(S, WAVES) {
  const ws = S.ws;
  const w = WAVES[ws.waveIdx];
  ws.spawnQueue = w.units;
  ws.spawnDelay = w.delay;
  ws.spawnTimer = 0;
  ws.active = true;
  ws.betweenWaves = false;
  S.phase = PHASE.WAVE;
}

// Called once per tick while phase === "wave". When the spawn queue is
// drained and no enemies remain alive, flips to "stall" and populates the
// dispatch card. Returns true if the transition happened this call.
export function tryStall(S, WAVES, liveEnemies) {
  if (S.phase !== PHASE.WAVE) return false;
  if (S.ws.spawnQueue > 0) return false;
  if (liveEnemies > 0) return false;
  S.ws.active = false;
  S.phase = PHASE.STALL;
  const d = makeDispatch(S.ws.waveIdx, WAVES.length);
  S.dispatch = d;
  S.lastDispatch = d;
  return true;
}

// THE single entry point that moves the run out of a stall. A future
// multiplayer build swaps the ACKNOWLEDGE button for a network-ready gate
// that calls this same function once all players are ready.
export function advance(S, WAVES) {
  if (S.phase !== PHASE.STALL) return false;
  const ws = S.ws;
  ws.waveIdx++;
  S.dispatch = null;
  if (ws.waveIdx >= WAVES.length) {
    checkWin(S, WAVES);
    S.phase = PHASE.BUILD;
    return true;
  }
  S.resources += 12;
  ws.betweenWaves = true;
  ws.countdown = 8;
  S.phase = PHASE.BUILD;
  return true;
}

export const HUD0 = {
  fps: 0, wave: 1, lives: 20, enemies: 0, resources: 120, walls: 0, towers: 0, kills: 0,
  totalWaves: 50, between: true, countdown: 8, phase: PHASE.BUILD, dispatch: null, lastDispatch: null,
  started: false, gameOver: false, victory: false,
  mode: "wall", sellMode: false, paused: false, speed: 1, inspect: null, toasts: [],
};
