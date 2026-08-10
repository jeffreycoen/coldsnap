// src/depot/ai.js — the attacker's buy brain. One fixed doctrine, blended
// counter-weights (never a pure counter), tank-push/surge banking. Pure:
// (regiment, buildSnapshot, waveIdx, rng) -> {buys, banked}. Mutates reg
// (heads/tanks/scrap depletion IS the purchase — see brief) but takes no
// other state; identical inputs (incl. rng stream) yield identical output.
import { ENEMY_SPECS, TANK } from "./specs.js";

// Infantry types this brain shops from (ENEMY_SPECS keys, minus the boss).
const INF_TYPES = ["", "fast", "heavy", "gren", "sapper"];
const cost = (type) => (type === "tank" ? TANK.bounty : ENEMY_SPECS[type].bounty);

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// waveBudget(waveIdx) — baseline scrap-spend ramp: ~20 at wave 0, ~120 by
// wave 50. Curve shape is tunable (Phase 3 Task 7 probe adjusts it); export
// kept so callers/tests can reference the same baseline the brain uses.
export function waveBudget(waveIdx) {
  const w = Math.max(0, waveIdx);
  return 20 + 100 * Math.pow(Math.min(w, 50) / 50, 0.85) + Math.max(0, w - 50) * 0.6;
}

// MIN_WAVE_FLOOR — the smallest muster still worth calling: 4 bare
// conscripts (ENEMY_SPECS[""].bounty each). Below this, reg.scrap can't even
// buy the cheapest possible wave (a wave with as few as one live body still
// makes the attacker "field" something), so scrap under the floor is read
// as genuine economic paralysis rather than a doctrine choosing to bank
// (see state.js's "spent offensive" trigger, Phase 3 Task 8). 4 is
// deliberately small — this must only fire when the attacker truly can't
// afford a token muster, not merely a thin one.
export const MIN_WAVE_FLOOR = 4 * cost("");

// snapSquads: count of live player squads from the build snapshot.
// DepotGame's buildSnapshot supplies `squads` (S.squads filtered to squads
// holding a live member). Tolerates absent/null snap for old fixtures.
export function snapSquads(snap) {
  return (snap && snap.squads) || 0;
}

// Counter-weight signals from the build snapshot, each 0..1.
function signals(snap) {
  return {
    mortar: clamp01((snap.mortars || 0) / 6),
    wall: clamp01((snap.walls || 0) / 8),
    frost: clamp01((snap.frosts || 0) / 5),
    mg: clamp01((snap.mgs || 0) / 8),
  };
}

function dominantCounter(sig) {
  let best = null, bestV = 0.15; // deadband: no dominant signal below this
  for (const k of ["mortar", "wall", "frost", "mg"]) {
    if (sig[k] > bestV) { bestV = sig[k]; best = k; }
  }
  return best;
}

// Blended infantry shares (sum to 1) + a separate tank-preference scalar.
// Base doctrine, then additive counter deltas, then renormalized — additive
// deltas only ever push shares up, so renormalizing dilutes everything
// else proportionally: a blend, never a pure hard-counter swap.
function computeShares(snap, jitter) {
  const sig = signals(snap);
  const base = { "": 0.30, fast: 0.175, heavy: 0.175, gren: 0.175, sapper: 0.175 };
  const raw = { ...base };
  raw.fast += 0.35 * sig.mortar;
  raw.sapper += 0.22 * sig.wall;
  raw.heavy += 0.18 * sig.wall;
  raw.gren += 0.30 * sig.frost;
  // small deterministic jitter (bounded, well under counter-delta scale)
  // so the doctrine isn't perfectly rigid without swamping the counters.
  const j = (jitter - 0.5) * 0.06;
  raw.fast = Math.max(0.02, raw.fast + j);
  raw.gren = Math.max(0.02, raw.gren - j);
  const sum = raw[""] + raw.fast + raw.heavy + raw.gren + raw.sapper;
  const shares = {};
  for (const t of INF_TYPES) shares[t] = raw[t] / sum;
  shares.tankPref = sig.mg; // 0..1, drives tank eagerness outside banking too
  return shares;
}

// Spend `budget` scrap across infantry types by share, respecting reg.heads
// and reg.scrap; appends/merges into `buys`. Never goes negative.
function buyInfantryMix(shares, budget, reg, buys) {
  const spend = Math.max(0, Math.min(budget, reg.scrap));
  let spent = 0;
  const take = (type, n) => {
    if (n <= 0) return;
    const c = cost(type);
    reg.heads -= n;
    reg.scrap -= n * c;
    spent += n * c;
    const existing = buys.find((b) => b.type === type);
    if (existing) existing.n += n; else buys.push({ type, n });
  };
  for (const type of INF_TYPES) {
    if (spent >= spend || reg.heads <= 0) break;
    const c = cost(type);
    const alloc = spend * shares[type];
    take(type, Math.min(Math.floor(alloc / c), reg.heads, Math.floor(reg.scrap / c)));
  }
  // Spend-down pass (playtest fix, 2026-08-10): the share pass floors each
  // type's allocation by its unit cost with no rollover, so a small budget
  // (waves 1-4, spend ~= 24) leaves ~80% unspent and fields one conscript —
  // or nobody at all — while the regiment is solvent. Roll the combined
  // remainder into the cheapest affordable types (cost-ascending) so any
  // budget >= one conscript's cost always fields something.
  for (const type of INF_TYPES.slice().sort((a, b) => cost(a) - cost(b))) {
    if (reg.heads <= 0) break;
    const c = cost(type);
    take(type, Math.min(Math.floor((spend - spent) / c), reg.heads, Math.floor(reg.scrap / c)));
  }
}

// Marksman counter-buy (Task 4D): player squads on the field make a
// sniper (ENEMY_SPECS.sniper, 30 scrap of regiment head) worth fielding.
// Mirrors buyTanks' shape; one head per sniper.
function buySnipers(n, reg, buys) {
  const c = cost("sniper");
  const take = Math.min(Math.max(0, n), reg.heads, Math.floor(reg.scrap / c));
  if (take <= 0) return 0;
  reg.heads -= take;
  reg.scrap -= take * c;
  const existing = buys.find((b) => b.type === "sniper");
  if (existing) existing.n += take; else buys.push({ type: "sniper", n: take });
  return take;
}

function buyTanks(n, reg, buys) {
  const c = cost("tank");
  const take = Math.min(Math.max(0, n), reg.tanks, Math.floor(reg.scrap / c));
  if (take <= 0) return 0;
  reg.tanks -= take;
  reg.scrap -= take * c;
  const existing = buys.find((b) => b.type === "tank");
  if (existing) existing.n += take; else buys.push({ type: "tank", n: take });
  return take;
}

// planWave(reg, snap, waveIdx, rng) -> {buys:[{type,n}], banked}
// Exactly 4 rng() draws, ALWAYS, on every branch — multiplayer contract:
// both clients must consume the identical rng stream length regardless of
// which path (bank/erupt/normal) this wave takes, or later waves desync.
//   draw 1: spend jitter        draw 2: share jitter
//   draw 3: thin-screen / tank-push size roll   draw 4: reserved (escort mix)
export function planWave(reg, snap, waveIdx, rng) {
  const jitterSpend = 0.85 + rng() * 0.15; // 1
  const jitterShare = rng();               // 2
  const sizeRoll = rng();                  // 3
  rng();                                   // 4 — reserved, kept for stream parity

  const baseline = waveBudget(waveIdx);
  const shares = computeShares(snap, jitterShare);
  const sig = signals(snap);
  const dominant = dominantCounter(sig);

  const buys = [];
  let banked = false;

  // Marksman counter-weight: modest and deterministic (NO rng draw — the
  // 4-draw stream contract stays intact). At >=2 live player squads, from
  // wave 4 on, one sniper goes forward per wave, provided the buy leaves
  // at least a token muster's scrap behind. Banking waves skip it (a thin
  // screen doesn't carry a scope). 3+ squads reads as saturation and is
  // still one sniper — they're 30 scrap of regiment head each.
  const sniperWanted = snapSquads(snap) >= 2 && waveIdx >= 4 &&
    reg.scrap >= cost("sniper") + MIN_WAVE_FLOOR ? 1 : 0;

  const bankThreshold = 1.8 * baseline;
  if (reg.scrap > bankThreshold) {
    const goal = dominant === "mg" ? "tankPush" : "surge";
    const tankC = cost("tank");
    const surgeThreshold = 2.2 * baseline;
    const tankPushReady = reg.tanks >= 2 && reg.scrap >= 2 * tankC;
    // Saturated wall pressure (a fully fortified position, signals.wall at
    // its clamp01 ceiling) reads as desperate — the doctrine skips the
    // patient 2.2x surge wait and throws whatever's banked at the wire now.
    // Only ever fires at the signal's max (walls >= 8), so a moderate
    // defense (median-strength builds) never trips it — only a maxed-out
    // wall count does.
    const desperate = dominant === "wall" && sig.wall >= 0.999;
    const erupt = goal === "tankPush" ? tankPushReady : (desperate || reg.scrap >= surgeThreshold);

    if (erupt && goal === "tankPush") {
      if (sniperWanted) buySnipers(sniperWanted, reg, buys);
      const want = 2 + Math.floor(sizeRoll * 3); // 2..4
      buyTanks(want, reg, buys);
      const screenBudget = Math.min(reg.scrap, baseline);
      buyInfantryMix(shares, screenBudget, reg, buys);
      banked = false;
    } else if (erupt) {
      if (sniperWanted) buySnipers(sniperWanted, reg, buys);
      const spend = reg.scrap * jitterSpend;
      buyInfantryMix(shares, spend, reg, buys);
      banked = false;
    } else {
      // not yet affordable: bank, buy a thin screen only. Floored at 2
      // conscripts (playtest fix): the computed budget at early-wave
      // baselines quantized to zero bodies, making a "banking" wave an
      // ABSENT wave — instant stall clear. A banking wave is thin, never
      // absent.
      const screenBudget = Math.min(reg.scrap, Math.max(baseline * 0.25 * (0.5 + sizeRoll * 0.5), 2 * cost("")));
      buyInfantryMix(shares, screenBudget, reg, buys);
      banked = true;
    }
  } else {
    // mg pressure buys a tank first (reserving its cost) before the
    // infantry mix spends down the rest of the wave's budget.
    if (sniperWanted) buySnipers(sniperWanted, reg, buys);
    if (shares.tankPref > 0.3 && reg.tanks > 0 && reg.scrap >= cost("tank")) {
      buyTanks(1, reg, buys);
    }
    const spend = Math.min(reg.scrap, baseline * jitterSpend);
    buyInfantryMix(shares, spend, reg, buys);
    banked = false;
  }

  return { buys, banked };
}
