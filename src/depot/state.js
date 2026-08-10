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
    totalWaves: waves.length,
    zoom: 1, acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
    hover: null, pointer: null, toasts: [],
    hudT: 0, keys: {}, sellById: null,
  };
}

export const HUD0 = {
  fps: 0, wave: 1, lives: 20, enemies: 0, resources: 120, walls: 0, towers: 0, kills: 0,
  totalWaves: 10, between: true, countdown: 8, started: false, gameOver: false, victory: false,
  mode: "wall", sellMode: false, paused: false, speed: 1, inspect: null, toasts: [],
};
