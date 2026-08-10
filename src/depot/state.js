// COLDSNAP DEPOT — run state shape. Kept tiny and dependency-free so
// DepotGame.jsx's loop can stuff a plain object in a ref (React state must
// never be read from the closure — see ColdsnapTD.jsx for why).
export const PHASE = { BUILD: "build", WAVE: "wave", STALL: "stall" };

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
    S.victory = true;
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
  totalWaves: 10, between: true, countdown: 8, phase: PHASE.BUILD, dispatch: null, lastDispatch: null,
  started: false, gameOver: false, victory: false,
  mode: "wall", sellMode: false, paused: false, speed: 1, inspect: null, toasts: [],
};
