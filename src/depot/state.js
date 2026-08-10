// COLDSNAP DEPOT — run state shape. Kept tiny and dependency-free so
// DepotGame.jsx's loop can stuff a plain object in a ref (React state must
// never be read from the closure — see ColdsnapTD.jsx for why).
import { aimSolve, fireProjectile } from "../engine/core.js";
import { scatterSigma, applyScatter } from "./accuracy.js";
import { planWave } from "./ai.js";
import { STIPEND, payResults, combatIneffective, bookValue } from "./economy.js";
import { composeIntel, openingIntel } from "./intel.js";
import { TOWER_SPECS, ENEMY_SPECS, TANK } from "./specs.js";

// Wall build cost — mirrors DepotGame.jsx's buildAt (`const cost = spec ? spec.cost : 5`).
// specs.js has no wall entry (walls aren't a TOWER_SPECS type), so this is
// the single source of truth the book-value verdict below reads.
const WALL_COST = 5;

export const PHASE = { BUILD: "build", WAVE: "wave", STALL: "stall" };

// One trigger pull, general shooter core: 2-pass lead solve against
// `target`'s velocity, then fire spec.volley (or 1) shots. sigma is
// computed once per pull from the led aim point (spec.acc, range/
// elevation/graze) and applied per shot via applyScatter — conditional
// accuracy, not a flat volley spread. Shared by towers (towerShot below)
// and enemy shooters (src/depot/units.js) so every aimed shot in DEPOT —
// player or enemy — runs through the identical accuracy model.
// opts: { high (mortar-style lob arc), attacker ("player"|"enemy"),
//         hitStruct, hitOnly, muzzleStep (per-shot muzzle y offset) }
export function shooterFire(world, shooter, muzzle, target, spec, opts = {}) {
  const high = !!opts.high;
  const attacker = opts.attacker || "player";
  let ax2 = target.pos.x, az2 = target.pos.z, ay2 = target.pos.y;
  for (let li = 0; li < 2; li++) {
    const ld = Math.max(2, Math.hypot(ax2 - muzzle.x, az2 - muzzle.z));
    const lp = aimSolve(spec.projSpeed, ld, ay2 - muzzle.y, 9.8, high);
    if (lp == null) break;
    const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
    ax2 = target.pos.x + target.v.x * tof;
    az2 = target.pos.z + target.v.z * tof;
    ay2 = world.field.heightAt(ax2, az2) + target.hy;
    // DIVERGENCE (guarded): partial wind hold-off — shooters correct for
    // wind drift by only windComp of the true offset (imperfect by design;
    // doctrine raises it later). No-op without world.wind or spec.windF/
    // windComp. Enemy specs carry the same windF/windComp as their tower
    // analog (Jeff's decision: aim fully equal), so this applies identically.
    if (world.wind && spec.windF && spec.windComp) {
      ax2 -= world.wind.x * spec.windF * tof * spec.windComp;
      az2 -= world.wind.z * spec.windF * tof * spec.windComp;
    }
  }
  const dx = ax2 - muzzle.x, dz = az2 - muzzle.z, dy = ay2 - muzzle.y;
  const sigma = scatterSigma(world, muzzle, { x: ax2, y: ay2, z: az2 }, spec);
  const d = Math.max(2, Math.hypot(dx, dz));
  let pitch = aimSolve(spec.projSpeed, d, dy, 9.8, high);
  if (pitch == null) pitch = high ? 1.1 : 0.45;
  const rawDir = { x: (dx / d) * Math.cos(pitch), y: Math.sin(pitch), z: (dz / d) * Math.cos(pitch) };
  const shots = spec.volley || 1;
  const muzzleStep = opts.muzzleStep != null ? opts.muzzleStep : 0.28;
  for (let si = 0; si < shots; si++) {
    const dir = applyScatter(world, rawDir, sigma);
    fireProjectile(world, { x: muzzle.x, y: muzzle.y + si * muzzleStep, z: muzzle.z }, dir, spec.projSpeed,
      {
        kind: spec.kind, r: spec.blastR, kv: spec.kv, dmg: spec.dmg, crater: spec.crater,
        noImpact: true, attacker, delay: si * 0.12, windF: spec.windF,
        hitStruct: opts.hitStruct, hitOnly: opts.hitOnly,
      });
  }
}

// One tower trigger pull — thin wrapper over shooterFire. Kept as its own
// export (depot-test.mjs and DepotGame.jsx's stepTowers call it by name).
export function towerShot(world, tower, target, spec) {
  const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
  const high = tower.towerType === "mortar";
  shooterFire(world, tower, muzzle, target, spec, { high, attacker: "player" });
}

export function makeWaveState() {
  return { waveIdx: 0, spawnQueue: 0, spawnTimer: 0, spawnDelay: 1, active: false, betweenWaves: true, countdown: 8, mixBag: [], results: null };
}

export function makeRunState({ waves, startResources = 120, startLives = 20 }) {
  return {
    resources: startResources, lives: startLives, kills: 0,
    ws: makeWaveState(), spawnRR: 0,
    mode: "wall", sellMode: false, inspectId: null,
    started: false, gameOver: false, victory: false, attrition: false, ledgerLoss: false,
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
// just died, totalWaves is WAVES.length. intelLines (already composed by the
// caller — composeIntel/openingIntel run their own seeded rng draws before
// this is called) are appended under the CLEARED header.
export function makeDispatch(waveIdx, totalWaves, intelLines = []) {
  const wo = "WO-" + String(1000 + waveIdx).padStart(4, "0");
  const next = waveIdx + 2;
  return {
    wo,
    lines: [
      `WAVE ${waveIdx + 1} CLEARED. HOLD.`,
      next <= totalWaves ? `RESUPPLY INBOUND — WAVE ${next} OF ${totalWaves}.` : "FINAL WAVE CLEARED.",
      ...intelLines,
      "ACKNOWLEDGE TO CONTINUE.",
    ],
  };
}

// Player-side book value: scrap on hand plus the build cost of every
// standing structure. snap is the same shape DepotGame.jsx's buildSnapshot()
// produces ({mortars, mgs, guns, rockets, frosts, walls}) — live body counts
// by type, read fresh at the moment of the verdict. guns and rockets are
// counted separately and valued at each tower's own real spec cost — the
// AI's counter-play signal elsewhere still lumps gun+rocket together (that's
// a shopping-pressure heuristic, not a ledger), but the book-value verdict
// must not undervalue (or overvalue) a rocket tower at gun price.
function playerBookValue(S, snap) {
  const s = snap || {};
  const assets =
    (s.mortars || 0) * TOWER_SPECS.mortar.cost +
    (s.mgs || 0) * TOWER_SPECS.mg.cost +
    (s.guns || 0) * TOWER_SPECS.gun.cost +
    (s.rockets || 0) * TOWER_SPECS.rocket.cost +
    (s.frosts || 0) * TOWER_SPECS.frost.cost +
    (s.walls || 0) * WALL_COST;
  return bookValue({ scrap: S.resources, assets });
}

// Attacker-side book value: regiment scrap plus the purchase-price value of
// its surviving unfielded pool (heads at conscript price, tanks at tank
// price — same ENEMY_SPECS/TANK bounty values ai.js spends at muster).
function attackerBookValue(S) {
  if (!S.reg) return 0;
  const assets = S.reg.heads * ENEMY_SPECS[""].bounty + S.reg.tanks * TANK.bounty;
  return bookValue({ scrap: S.reg.scrap, assets });
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
// Real book-value audit — player side (scrap + standing structures) vs.
// attacker side (regiment scrap + surviving heads/tanks at purchase price).
// Falling short still ends the run, but as a ledger LOSS rather than a WIN.
export function checkWin(S, WAVES, snap = {}) {
  if (playerBookValue(S, snap) >= attackerBookValue(S)) {
    S.victory = true;
  } else {
    S.gameOver = true;
    S.ledgerLoss = true;
  }
  return S.victory;
}

// End-of-run dispatch copy — same teletyped card style as the between-wave
// stall dispatch, reused for the WIN/LOSS end card. Pure + deterministic.
export function makeEndDispatch({ victory, kills, wave, totalWaves, attrition = false, ledgerLoss = false }) {
  const wo = "WO-9999";
  if (victory) {
    if (attrition) {
      return {
        wo,
        lines: [
          "THE FORMATION OPPOSITE IS JUDGED COMBAT-INEFFECTIVE.",
          "The field remains in Bureau hands.",
          `${kills} CONFIRMED. FIELD ORDER CLOSED.`,
        ],
      };
    }
    return {
      wo,
      lines: [
        "FINAL WAVE CLEARED.",
        "The position held. The books close in the Bureau's favor.",
        `${kills} CONFIRMED. FIELD ORDER CLOSED.`,
      ],
    };
  }
  if (ledgerLoss) {
    return {
      wo,
      lines: [
        "FINAL WAVE CLEARED.",
        "The position is judged untenable. Withdrawal authorized.",
        `${kills} CONFIRMED BEFORE THE LEDGER CLOSED.`,
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
// Ported from ColdsnapTD.jsx's startWave: w.mix (an array of [tag, count]
// pairs) expands into a bag of tags, then a fixed-stride-7 shuffle
// interleaves types instead of clumping them. Deterministic — no RNG (the
// stride is a constant), so this needs no world.rng() plumbing.
function buildMixBag(mix) {
  const bag = [];
  for (const m of mix) for (let i = 0; i < m[1]; i++) bag.push(m[0]);
  const out = [];
  let i = 0;
  while (bag.length) { i = (i + 7) % bag.length; out.push(bag.splice(i, 1)[0]); }
  return out;
}
// opts: { useTable (escape hatch — old static-table behavior, no regiment
//         needed, kept for tests that don't wire an attacker economy),
//         reg (the attacker's live regiment — makeRegiment output, mutated
//         in place by planWave), snap (buildSnapshot), rng (world.rng) }.
// useTable, or no reg supplied, falls back to the static WAVES[waveIdx]
// entry exactly as before. Otherwise the wave is generated fresh from
// planWave(reg, snap, waveIdx, rng) — reg.heads/tanks/scrap deplete at buy
// time (ai.js's contract), so a depleted regiment naturally fields a
// smaller/weaker wave. Always resets ws.results, the accumulator DepotGame
// fills with this wave's structure-damage/kill/leak events for payResults
// at stall.
export function startWave(S, WAVES, opts = {}) {
  const { useTable = false, reg = null, snap = null, rng = null } = opts;
  const ws = S.ws;
  const w = WAVES[ws.waveIdx];
  let units, delay, mix;
  if (useTable || !reg) {
    units = w.units;
    delay = w.delay;
    mix = w.mix;
  } else {
    const plan = planWave(reg, snap || {}, ws.waveIdx, rng);
    const { buys } = plan;
    units = buys.reduce((s, b) => s + b.n, 0);
    delay = w.delay;
    mix = buys.map((b) => [b.type, b.n]);
    // Intel delay buffer: the plan that governed the PREVIOUS wave (still
    // sitting in S.pendingPlan from the prior startWave call) becomes the
    // one-wave-old source composeIntel reads at the next stall; this wave's
    // fresh plan takes pendingPlan's place and won't surface as intel until
    // the wave after this one clears. First wave of a run: intelPlan stays
    // null (no history yet), so plan-keyed intel families stay silent.
    S.intelPlan = S.pendingPlan || null;
    S.pendingPlan = plan;
  }
  ws.spawnQueue = units;
  ws.spawnDelay = delay;
  ws.spawnTimer = 0;
  ws.active = true;
  ws.betweenWaves = false;
  ws.mixBag = mix && mix.length ? buildMixBag(mix) : [];
  ws.results = { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 };
  S.phase = PHASE.WAVE;
}

// Next spawn tag for this tick: pulled from the wave's mix bag if the wave
// has one, "" (conscript) otherwise. Caller pops S.ws.spawnQueue itself.
export function nextSpawnTag(S) {
  const ws = S.ws;
  return ws.mixBag.length ? ws.mixBag.pop() : "";
}

// Called once per tick while phase === "wave". When the spawn queue is
// drained and no enemies remain alive, flips to "stall" and populates the
// dispatch card. Returns true if the transition happened this call.
export function tryStall(S, WAVES, liveEnemies, rng = null) {
  if (S.phase !== PHASE.WAVE) return false;
  if (S.ws.spawnQueue > 0) return false;
  if (liveEnemies > 0) return false;
  S.ws.active = false;
  S.phase = PHASE.STALL;
  // The attacker cashes in this wave's results (structure damage dealt,
  // structure kills, leaks) before the dispatch card is drawn — the next
  // wave's planWave call reads reg.scrap as left by this.
  if (S.reg && S.ws.results) payResults(S.reg, S.ws.results);
  // Attrition victory: checked at every stall, independent of wave index or
  // book value. A regiment driven combat-ineffective (see economy.js) ends
  // the run early as a WIN — the attacker can no longer field a wave.
  if (S.reg && !S.gameOver && !S.victory && combatIneffective(S.reg)) {
    S.victory = true;
    S.attrition = true;
  }
  // Intel: one-wave-old plan (S.intelPlan, buffered by startWave) plus the
  // live regiment read. rng is optional so callers/tests without a world
  // rng (useTable runs) get no intel lines rather than a crash. Wave 0's
  // stall gets the opening strength estimate instead — there's no plan
  // history yet for composeIntel to report on.
  let intelLines = [];
  if (rng) {
    if (S.ws.waveIdx === 0 && S.reg) intelLines = [openingIntel(S.reg)];
    else intelLines = composeIntel(S.intelPlan, S.reg, rng);
  }
  const d = makeDispatch(S.ws.waveIdx, WAVES.length, intelLines);
  S.dispatch = d;
  S.lastDispatch = d;
  return true;
}

// THE single entry point that moves the run out of a stall. A future
// multiplayer build swaps the ACKNOWLEDGE button for a network-ready gate
// that calls this same function once all players are ready.
export function advance(S, WAVES, snap = {}) {
  if (S.phase !== PHASE.STALL) return false;
  const ws = S.ws;
  ws.waveIdx++;
  S.dispatch = null;
  if (ws.waveIdx >= WAVES.length) {
    checkWin(S, WAVES, snap);
    S.phase = PHASE.BUILD;
    return true;
  }
  S.resources += 12;
  if (S.reg) S.reg.scrap += STIPEND;
  ws.betweenWaves = true;
  ws.countdown = 8;
  S.phase = PHASE.BUILD;
  return true;
}

export const HUD0 = {
  fps: 0, wave: 1, lives: 20, enemies: 0, resources: 120, walls: 0, towers: 0, kills: 0,
  totalWaves: 50, between: true, countdown: 8, phase: PHASE.BUILD, dispatch: null, lastDispatch: null,
  started: false, gameOver: false, victory: false, attrition: false, ledgerLoss: false,
  mode: "wall", sellMode: false, paused: false, speed: 1, inspect: null, toasts: [],
};
